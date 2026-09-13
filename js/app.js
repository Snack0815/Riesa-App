/* Riesa Fahrten – App-Logik */
let DATA = loadData();
let currentView = 'dashboard';

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function getPerson(id) { return DATA.people.find(p => p.id === id); }
function otherPerson(id) { return DATA.people.find(p => p.id !== id); }

function tripCount(personId) {
  return DATA.trips.filter(t => t.personId === personId).length;
}

function fairness() {
  const [p1, p2] = DATA.people;
  const c1 = tripCount(p1.id);
  const c2 = tripCount(p2.id);
  const diff = c1 - c2;
  let behind = null;
  if (diff > 0) behind = p2;
  else if (diff < 0) behind = p1;
  return { p1, p2, c1, c2, diff: Math.abs(diff), behind };
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------------- Init / Onboarding ---------------- */

function init() {
  if (!DATA.onboarded || DATA.people.length < 2) {
    showOnboarding();
  } else {
    showMainApp();
  }
  registerServiceWorker();
}

function showOnboarding() {
  $('#onboarding').classList.remove('hidden');
  $('#mainApp').classList.add('hidden');
  $('#onboardForm').addEventListener('submit', onOnboardSubmit);
}

function onOnboardSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const form = Object.fromEntries(fd.entries());
  const seed = fd.get('seed') === 'on';
  DATA = completeOnboarding(loadData(), form, seed);
  showMainApp();
}

function showMainApp() {
  $('#onboarding').classList.add('hidden');
  $('#mainApp').classList.remove('hidden');
  setupNav();
  navigate('dashboard');
}

/* ---------------- Navigation ---------------- */

function setupNav() {
  $$('.navbtn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });
}

function navigate(view) {
  currentView = view;
  $$('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + view).classList.add('active');
  renderView(view);
  $('#views').scrollTop = 0;
}

function renderView(view) {
  if (view === 'dashboard') renderDashboard();
  else if (view === 'trips') renderTrips();
  else if (view === 'cars') renderCars();
  else if (view === 'settings') renderSettings();
}

function refreshCurrentView() { renderView(currentView); }

/* ---------------- Toast ---------------- */

function showToast(msg) {
  const existing = $('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/* ---------------- Dashboard ---------------- */

function renderDashboard() {
  const f = fairness();
  const root = $('#view-dashboard');
  const total = f.c1 + f.c2;
  const pct1 = total ? Math.round((f.c1 / total) * 100) : 50;
  const pct2 = 100 - pct1;

  let statusHtml;
  let nextHtml = '';
  if (f.diff === 0) {
    statusHtml = `<div class="fairness-status balanced">Perfekt ausgeglichen ⚖️</div>`;
  } else {
    const tripWord = f.diff === 1 ? 'Fahrt' : 'Fahrten';
    statusHtml = `<div class="fairness-status"><b>${escapeHtml(f.behind.name)}</b> sollte die nächsten <b>${f.diff}</b> ${tripWord} übernehmen.</div>`;
    nextHtml = `<div class="fairness-next">Nächste Fahrt: <b>→ ${escapeHtml(f.behind.name)}</b></div>`;
  }

  root.innerHTML = `
    <div class="fairness-card">
      <div class="fairness-label">⚖️ Fairness</div>
      <div class="fairness-rows">
        <div class="fairness-person">
          <div class="fairness-dot" style="background:var(--p1)"></div>
          <div class="fairness-name">${escapeHtml(f.p1.name)}</div>
          <div class="fairness-count">${f.c1} <span>Fahrten</span></div>
        </div>
        <div class="fairness-person">
          <div class="fairness-dot" style="background:var(--p2)"></div>
          <div class="fairness-name">${escapeHtml(f.p2.name)}</div>
          <div class="fairness-count">${f.c2} <span>Fahrten</span></div>
        </div>
      </div>
      <div class="fairness-bar">
        <div style="width:${pct1}%; background:var(--p1)"></div>
        <div style="width:${pct2}%; background:var(--p2)"></div>
      </div>
      ${statusHtml}
      ${nextHtml}
    </div>

    <div class="section-title">Eure Autos</div>
    <div class="carmini-grid">
      ${DATA.people.map(p => carMiniCard(p)).join('')}
    </div>

    <div class="section-title">Aktion</div>
    <button class="add-trip-btn" id="dashAddTrip">+ Fahrt hinzufügen</button>
  `;

  $$('.carmini-card', root).forEach(card => {
    card.addEventListener('click', () => navigate('cars'));
  });
  $('#dashAddTrip', root).addEventListener('click', () => openTripSheet());
}

function carMiniCard(person) {
  const tag = person.id === 'p1' ? 'tag-p1' : 'tag-p2';
  return `
    <div class="carmini-card" data-person="${person.id}">
      ${carSvg(person.car)}
      <div class="carmini-title">${escapeHtml(person.car.brand)} ${escapeHtml(person.car.model)}</div>
      <div class="carmini-sub">${escapeHtml(person.name)}</div>
      <div class="carmini-count ${tag}">${tripCount(person.id)} Fahrten</div>
    </div>
  `;
}

/* ---------------- Trips ---------------- */

function renderTrips() {
  const root = $('#view-trips');
  const trips = [...DATA.trips].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const listHtml = trips.length ? trips.map(t => tripItemHtml(t)).join('') : `
    <div class="empty-state">
      <div class="emoji">🚗</div>
      <div>Noch keine Fahrten erfasst.</div>
    </div>
  `;

  root.innerHTML = `
    <button class="add-trip-btn" id="tripsAddBtn" style="margin-bottom:18px;">+ Fahrt hinzufügen</button>
    <div class="section-title">Verlauf</div>
    <div id="tripList">${listHtml}</div>
  `;

  $('#tripsAddBtn', root).addEventListener('click', () => openTripSheet());
  $$('.trip-item', root).forEach(el => {
    el.addEventListener('click', () => openTripSheet(el.dataset.id));
  });
}

function tripItemHtml(trip) {
  const person = getPerson(trip.personId);
  if (!person) return '';
  const dotVar = person.id === 'p1' ? 'var(--p1)' : 'var(--p2)';
  return `
    <div class="trip-item" data-id="${trip.id}">
      <div class="trip-car-icon">${carSvg(person.car)}</div>
      <div class="trip-info">
        <div class="trip-date">${formatDate(trip.date)}</div>
        <div class="trip-person"><span class="trip-dot" style="background:${dotVar}"></span>${escapeHtml(person.name)}</div>
        ${trip.note ? `<div class="trip-note">${escapeHtml(trip.note)}</div>` : ''}
      </div>
      <div class="trip-chevron">›</div>
    </div>
  `;
}

function openTripSheet(tripId) {
  const editing = !!tripId;
  const trip = editing ? DATA.trips.find(t => t.id === tripId) : null;
  const selectedPersonId = trip ? trip.personId : DATA.people[0].id;

  const html = `
    <div class="sheet-backdrop" id="sheetBackdrop">
      <div class="sheet">
        <div class="sheet-handle"></div>
        <h2>${editing ? 'Fahrt bearbeiten' : 'Fahrt hinzufügen'}</h2>
        <form id="tripForm">
          <label>Wer ist gefahren?</label>
          <div class="choice-group" id="personChoice">
            ${DATA.people.map(p => `
              <div class="choice-btn ${p.id === selectedPersonId ? 'selected' : ''}" data-person="${p.id}">
                <div class="choice-dot" style="background:${p.id === 'p1' ? 'var(--p1)' : 'var(--p2)'}; margin:0 auto 8px;"></div>
                <div class="choice-label">${escapeHtml(p.name)}</div>
              </div>
            `).join('')}
          </div>

          <label>Datum
            <input type="date" name="date" value="${trip ? trip.date : todayIso()}" required>
          </label>
          <label>Notiz <span class="opt">optional</span>
            <textarea name="note" rows="2" maxlength="120" placeholder="z.B. Training abends">${trip ? escapeHtml(trip.note || '') : ''}</textarea>
          </label>

          <div class="sheet-actions">
            ${editing ? `<button type="button" class="btn-danger" id="deleteTripBtn">Löschen</button>` : ''}
            <button type="submit" class="btn-primary">${editing ? 'Speichern' : 'Hinzufügen'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  $('#sheetRoot').innerHTML = html;

  let selected = selectedPersonId;
  $$('.choice-btn', document).forEach(btn => {
    btn.addEventListener('click', () => {
      selected = btn.dataset.person;
      $$('.choice-btn').forEach(b => b.classList.toggle('selected', b === btn));
    });
  });

  $('#sheetBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'sheetBackdrop') closeSheet();
  });

  if (editing) {
    $('#deleteTripBtn').addEventListener('click', () => {
      DATA.trips = DATA.trips.filter(t => t.id !== tripId);
      saveData(DATA);
      closeSheet();
      refreshCurrentView();
      showToast('Fahrt gelöscht');
    });
  }

  $('#tripForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const date = fd.get('date') || todayIso();
    const note = (fd.get('note') || '').trim();

    if (editing) {
      trip.personId = selected;
      trip.date = date;
      trip.note = note;
    } else {
      DATA.trips.push({ id: uid(), personId: selected, date, note });
    }
    saveData(DATA);
    closeSheet();
    refreshCurrentView();
    showToast(editing ? 'Fahrt aktualisiert' : 'Fahrt hinzugefügt');
  });
}

function closeSheet() {
  $('#sheetRoot').innerHTML = '';
}

/* ---------------- Cars ---------------- */

function renderCars() {
  const root = $('#view-cars');
  root.innerHTML = DATA.people.map(p => carBigCardHtml(p)).join('');

  DATA.people.forEach(p => {
    $(`#editCarBtn-${p.id}`, root).addEventListener('click', () => openCarEditSheet(p.id));
  });
}

function carBigCardHtml(person) {
  const tag = person.id === 'p1' ? 'tag-p1' : 'tag-p2';
  const yearPart = person.car.year ? ` · ${person.car.year}` : '';
  const colorPart = person.car.color ? ` · ${escapeHtml(person.car.color)}` : '';
  return `
    <div class="car-big-card">
      ${carSvg(person.car)}
      <div class="car-big-title">${escapeHtml(person.car.brand)} ${escapeHtml(person.car.model)}</div>
      <div class="car-big-sub">${escapeHtml(person.name)}${yearPart}${colorPart}</div>
      <div class="car-big-count ${tag}">🚗 ${tripCount(person.id)} Riesa-Fahrten</div>
      <div class="car-big-actions">
        <button class="btn-secondary" id="editCarBtn-${person.id}">Auto bearbeiten</button>
      </div>
    </div>
  `;
}

function openCarEditSheet(personId) {
  const person = getPerson(personId);
  const html = `
    <div class="sheet-backdrop" id="sheetBackdrop">
      <div class="sheet">
        <div class="sheet-handle"></div>
        <h2>${escapeHtml(person.name)}s Auto</h2>
        <form id="carForm">
          <div class="grid-2">
            <label>Marke
              <input type="text" name="brand" value="${escapeHtml(person.car.brand)}" required maxlength="20">
            </label>
            <label>Modell
              <input type="text" name="model" value="${escapeHtml(person.car.model)}" required maxlength="20">
            </label>
          </div>
          <div class="grid-2">
            <label>Baujahr <span class="opt">optional</span>
              <input type="number" name="year" value="${person.car.year || ''}" min="1970" max="2030">
            </label>
            <label>Farbe <span class="opt">optional</span>
              <select name="color">
                ${['Schwarz','Weiß','Silber','Grau','Blau','Dunkelblau','Rot','Grün','Gelb','Orange','Braun','Beige','Violett','Türkis']
                  .map(c => `<option ${person.car.color === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="sheet-actions">
            <button type="submit" class="btn-primary">Speichern</button>
          </div>
        </form>
      </div>
    </div>
  `;
  $('#sheetRoot').innerHTML = html;
  $('#sheetBackdrop').addEventListener('click', (e) => { if (e.target.id === 'sheetBackdrop') closeSheet(); });

  $('#carForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    person.car.brand = (fd.get('brand') || '').trim() || person.car.brand;
    person.car.model = (fd.get('model') || '').trim() || person.car.model;
    person.car.year = fd.get('year') ? Number(fd.get('year')) : null;
    person.car.color = fd.get('color') || person.car.color;
    saveData(DATA);
    closeSheet();
    refreshCurrentView();
    showToast('Auto aktualisiert');
  });
}

/* ---------------- Settings ---------------- */

function renderSettings() {
  const root = $('#view-settings');
  const total = DATA.trips.length;
  const c1 = tripCount(DATA.people[0].id);
  const c2 = tripCount(DATA.people[1].id);
  const diff = Math.abs(c1 - c2);
  const ratio = c2 === 0 ? (c1 === 0 ? '0:0' : `${c1}:0`) : `${(c1 / c2).toFixed(2)} : 1`;
  const maxCount = Math.max(c1, c2, 1);

  root.innerHTML = `
    <div class="section-title">Statistik</div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Fahrten gesamt</div></div>
      <div class="stat-card"><div class="stat-value">${diff}</div><div class="stat-label">Differenz</div></div>
      <div class="stat-card"><div class="stat-value">${c1}</div><div class="stat-label">${escapeHtml(DATA.people[0].name)}</div></div>
      <div class="stat-card"><div class="stat-value">${c2}</div><div class="stat-label">${escapeHtml(DATA.people[1].name)}</div></div>
      <div class="stat-card full">
        <div class="stat-label" style="margin-bottom:10px;">Verhältnis: ${ratio}</div>
        <div class="bars">
          <div class="bar-row">
            <div class="bar-row-label">${escapeHtml(DATA.people[0].name)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(c1/maxCount)*100}%; background:var(--p1)"></div></div>
            <div class="bar-row-value">${c1}</div>
          </div>
          <div class="bar-row">
            <div class="bar-row-label">${escapeHtml(DATA.people[1].name)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(c2/maxCount)*100}%; background:var(--p2)"></div></div>
            <div class="bar-row-value">${c2}</div>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${c1}</div>
        <div class="stat-label">${escapeHtml(DATA.people[0].car.brand)} ${escapeHtml(DATA.people[0].car.model)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${c2}</div>
        <div class="stat-label">${escapeHtml(DATA.people[1].car.brand)} ${escapeHtml(DATA.people[1].car.model)}</div>
      </div>
    </div>

    <div class="section-title">Personen &amp; Namen</div>
    ${DATA.people.map(p => `
      <div class="settings-card">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="settings-row">
          <span>Name ändern</span>
          <button data-editname="${p.id}">Bearbeiten</button>
        </div>
      </div>
    `).join('')}

    <div class="section-title">Daten</div>
    <div class="settings-card">
      <div class="settings-row">
        <span class="danger-zone">Alle Fahrten löschen</span>
        <button class="danger-zone" id="resetTripsBtn">Löschen</button>
      </div>
      <div class="settings-row">
        <span class="danger-zone">App komplett zurücksetzen</span>
        <button class="danger-zone" id="resetAllBtn">Zurücksetzen</button>
      </div>
    </div>
  `;

  $$('[data-editname]', root).forEach(btn => {
    btn.addEventListener('click', () => openRenameSheet(btn.dataset.editname));
  });

  $('#resetTripsBtn', root).addEventListener('click', () => {
    if (confirm('Wirklich alle Fahrten löschen? Dies kann nicht rückgängig gemacht werden.')) {
      DATA.trips = [];
      saveData(DATA);
      refreshCurrentView();
      showToast('Alle Fahrten gelöscht');
    }
  });

  $('#resetAllBtn', root).addEventListener('click', () => {
    if (confirm('App wirklich komplett zurücksetzen? Alle Daten gehen verloren.')) {
      localStorage.removeItem(DB_KEY);
      location.reload();
    }
  });
}

function openRenameSheet(personId) {
  const person = getPerson(personId);
  const html = `
    <div class="sheet-backdrop" id="sheetBackdrop">
      <div class="sheet">
        <div class="sheet-handle"></div>
        <h2>Name ändern</h2>
        <form id="renameForm">
          <label>Name
            <input type="text" name="name" value="${escapeHtml(person.name)}" required maxlength="20">
          </label>
          <div class="sheet-actions">
            <button type="submit" class="btn-primary">Speichern</button>
          </div>
        </form>
      </div>
    </div>
  `;
  $('#sheetRoot').innerHTML = html;
  $('#sheetBackdrop').addEventListener('click', (e) => { if (e.target.id === 'sheetBackdrop') closeSheet(); });
  $('#renameForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = (fd.get('name') || '').trim();
    if (name) person.name = name;
    saveData(DATA);
    closeSheet();
    refreshCurrentView();
    showToast('Name aktualisiert');
  });
}

/* ---------------- Utils ---------------- */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
