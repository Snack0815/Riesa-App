/*
 * Daten-Schicht: Supabase ist die "Source of Truth", localStorage ist ein
 * Cache für sofortiges Rendern und für kurze Internetausfälle.
 *
 * Ablauf pro Änderung (Fahrt/Person hinzufügen, bearbeiten, löschen):
 *  1. Lokal in DATA mutieren + sofort in localStorage cachen -> UI reagiert
 *     augenblicklich, unabhängig vom Netzwerk.
 *  2. Versuchen, dieselbe Änderung nach Supabase zu schreiben.
 *  3. Schlägt das fehl (offline/Fehler), landet die Änderung in einer
 *     Warteschlange und wird automatisch erneut versucht, sobald die
 *     Verbindung wieder da ist.
 *
 * Über Supabase Realtime bekommt jedes Gerät außerdem automatisch mit, wenn
 * das andere Gerät etwas ändert.
 */

const CACHE_KEY = 'riesaFahrtenCache.v1';
const QUEUE_KEY = 'riesaFahrtenQueue.v1';

const PALETTE = ['#4f8dfd', '#ff8a3d', '#3ddc97', '#e5484d', '#c084fc', '#f5d90a', '#22d3ee', '#fb7185', '#a3e635', '#f472b6'];

function pickAccentColor(index) {
  return PALETTE[index % PALETTE.length];
}

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)));
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

/* ---------------- Row <-> App-Objekt Mapping ---------------- */

function rowToPerson(r) {
  return {
    id: r.id,
    name: r.name,
    accentColor: r.accent_color,
    car: { brand: r.car_brand, model: r.car_model, year: r.car_year, color: r.car_color }
  };
}

function personToRow(p) {
  return {
    id: p.id,
    name: p.name,
    accent_color: p.accentColor,
    car_brand: p.car.brand,
    car_model: p.car.model,
    car_year: p.car.year || null,
    car_color: p.car.color || null
  };
}

function rowToTrip(r) {
  return { id: r.id, personId: r.person_id, date: r.date, note: r.note || '' };
}

function tripToRow(t) {
  return { id: t.id, person_id: t.personId, date: t.date, note: t.note || '' };
}

/* ---------------- Lokaler Cache ---------------- */

function defaultData() {
  return { people: [], trips: [] };
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.people) || !Array.isArray(parsed.trips)) return defaultData();
    return parsed;
  } catch (e) {
    console.error('Fehler beim Laden des Caches', e);
    return defaultData();
  }
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Fehler beim Schreiben des Caches', e);
  }
}

/* ---------------- Offline-Warteschlange ---------------- */

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function queueOp(op) {
  const q = loadQueue();
  q.push(op);
  saveQueue(q);
}

async function runOp(op) {
  try {
    if (op.table === 'people') {
      if (op.type === 'upsert') {
        const { error } = await supabaseClient.from('people').upsert(personToRow(op.payload));
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from('people').delete().eq('id', op.payload.id);
        if (error) throw error;
      }
    } else {
      if (op.type === 'upsert') {
        const { error } = await supabaseClient.from('trips').upsert(tripToRow(op.payload));
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from('trips').delete().eq('id', op.payload.id);
        if (error) throw error;
      }
    }
    return true;
  } catch (e) {
    console.warn('Sync fehlgeschlagen, wird später erneut versucht:', e.message || e);
    return false;
  }
}

let flushing = false;
async function flushQueue() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    let q = loadQueue();
    while (q.length) {
      const ok = await runOp(q[0]);
      if (!ok) break;
      q.shift();
      saveQueue(q);
    }
  } finally {
    flushing = false;
  }
}

/* Optimistisch lokal anwenden + cachen + im Hintergrund synchronisieren. */
async function persistChange(op) {
  saveCache(DATA);
  const ok = navigator.onLine ? await runOp(op) : false;
  if (!ok) queueOp(op);
}

/* ---------------- Laden vom Server ---------------- */

async function fetchAll() {
  const [{ data: peopleRows, error: peopleErr }, { data: tripRows, error: tripErr }] = await Promise.all([
    supabaseClient.from('people').select('*').order('created_at', { ascending: true }),
    supabaseClient.from('trips').select('*').order('date', { ascending: false })
  ]);
  if (peopleErr) throw peopleErr;
  if (tripErr) throw tripErr;
  return {
    people: peopleRows.map(rowToPerson),
    trips: tripRows.map(rowToTrip)
  };
}

function subscribeRealtime(onRemoteChange) {
  supabaseClient
    .channel('riesa-fahrten-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'people' }, onRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, onRemoteChange)
    .subscribe();
}

/* ---------------- Onboarding & Mutationen ---------------- */

function buildSeedTrips(p1id, p2id) {
  const pattern = ['p1', 'p2', 'p1', 'p1', 'p2', 'p1', 'p2', 'p1', 'p2', 'p1', 'p2', 'p1', 'p1', 'p2', 'p1', 'p2', 'p1', 'p2'];
  const trips = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - pattern.length * 3);

  pattern.forEach((who, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 3);
    trips.push({ id: uid(), personId: who === 'p1' ? p1id : p2id, date: isoDate(d), note: '' });
  });
  return trips;
}

async function completeOnboarding(data, form, seed) {
  const p1id = uid();
  const p2id = uid();
  const p1 = {
    id: p1id,
    name: form.p1name || 'Person 1',
    accentColor: pickAccentColor(0),
    car: { brand: form.p1brand || 'BMW', model: form.p1model || '320d', year: form.p1year || null, color: form.p1color || 'Schwarz' }
  };
  const p2 = {
    id: p2id,
    name: form.p2name || 'Person 2',
    accentColor: pickAccentColor(1),
    car: { brand: form.p2brand || 'VW', model: form.p2model || 'Golf 8', year: form.p2year || null, color: form.p2color || 'Blau' }
  };
  data.people = [p1, p2];
  data.trips = seed ? buildSeedTrips(p1id, p2id) : [];
  saveCache(data);

  persistChange({ table: 'people', type: 'upsert', payload: p1 });
  persistChange({ table: 'people', type: 'upsert', payload: p2 });
  data.trips.forEach(trip => persistChange({ table: 'trips', type: 'upsert', payload: trip }));
  return data;
}

function addPerson(data, form) {
  const person = {
    id: uid(),
    name: (form.name || '').trim() || `Person ${data.people.length + 1}`,
    accentColor: pickAccentColor(data.people.length),
    car: {
      brand: (form.brand || '').trim() || 'Auto',
      model: (form.model || '').trim() || '',
      year: form.year ? Number(form.year) : null,
      color: form.color || 'Grau'
    }
  };
  data.people.push(person);
  persistChange({ table: 'people', type: 'upsert', payload: person });
  return data;
}

function removePerson(data, personId) {
  data.people = data.people.filter(p => p.id !== personId);
  data.trips = data.trips.filter(t => t.personId !== personId);
  // Cascade-Delete übernimmt Supabase (on delete cascade) für die Fahrten.
  persistChange({ table: 'people', type: 'delete', payload: { id: personId } });
  return data;
}
