/* Persistenz-Layer: localStorage, mit Beispieldaten beim ersten Start */
const DB_KEY = 'riesaFahrtenData.v1';

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
  const p1id = 'p1';
  const p2id = 'p2';
  data.people = [
    {
      id: p1id,
      name: form.p1name || 'Person 1',
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
