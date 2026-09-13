/* Persistenz-Layer: localStorage, mit Beispieldaten beim ersten Start */
const DB_KEY = 'riesaFahrtenData.v1';

/* Zyklische Akzentfarben je Person, damit die App auf beliebig viele Personen skaliert */
const PALETTE = ['#4f8dfd', '#ff8a3d', '#3ddc97', '#e5484d', '#c084fc', '#f5d90a', '#22d3ee', '#fb7185', '#a3e635', '#f472b6'];

function pickAccentColor(index) {
  return PALETTE[index % PALETTE.length];
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function buildSeedTrips(p1id, p2id) {
  // 10 Fahrten Person 1, 8 Fahrten Person 2, chronologisch über die letzten Wochen
  const pattern = ['p1', 'p2', 'p1', 'p1', 'p2', 'p1', 'p2', 'p1', 'p2', 'p1', 'p2', 'p1', 'p1', 'p2', 'p1', 'p2', 'p1', 'p2'];
  const trips = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - pattern.length * 3);

  pattern.forEach((who, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 3);
    trips.push({
      id: uid(),
      personId: who === 'p1' ? p1id : p2id,
      date: isoDate(d),
      note: ''
    });
  });
  return trips;
}

function defaultData() {
  return {
    onboarded: false,
    people: [],
    trips: []
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.people) || !Array.isArray(parsed.trips)) {
      return defaultData();
    }
    // Migration: ältere Datensätze hatten noch keine feste Akzentfarbe je Person
    parsed.people.forEach((p, i) => {
      if (!p.accentColor) p.accentColor = pickAccentColor(i);
    });
    return parsed;
  } catch (e) {
    console.error('Fehler beim Laden der Daten', e);
    return defaultData();
  }
}

function saveData(data) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Fehler beim Speichern der Daten', e);
  }
}

function completeOnboarding(data, form, seed) {
  const p1id = uid();
  const p2id = uid();
  data.people = [
    {
      id: p1id,
      name: form.p1name || 'Person 1',
      accentColor: pickAccentColor(0),
      car: {
        brand: form.p1brand || 'BMW',
        model: form.p1model || '320d',
        year: form.p1year || null,
        color: form.p1color || 'Schwarz'
      }
    },
    {
      id: p2id,
      name: form.p2name || 'Person 2',
      accentColor: pickAccentColor(1),
      car: {
        brand: form.p2brand || 'VW',
        model: form.p2model || 'Golf 8',
        year: form.p2year || null,
        color: form.p2color || 'Blau'
      }
    }
  ];
  data.trips = seed ? buildSeedTrips(p1id, p2id) : [];
  data.onboarded = true;
  saveData(data);
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
  saveData(data);
  return data;
}

function removePerson(data, personId) {
  data.people = data.people.filter(p => p.id !== personId);
  data.trips = data.trips.filter(t => t.personId !== personId);
  saveData(data);
  return data;
}
