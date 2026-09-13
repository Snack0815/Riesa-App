/* Riesa Fahrten – App-Logik */
let DATA = loadData();
let currentView = 'dashboard';

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function getPerson(id) { return DATA.people.find(p => p.id === id); }

function tripCount(personId) {
  return DATA.trips.filter(t => t.personId === personId).length;
}

function hexToRgba(hex, alpha) {
  const c = (hex || '#7a8091').replace('#', '');
  const num = parseInt(c, 16);
  const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/* Fairness für beliebig viele Personen: wer die wenigsten Fahrten hat, ist als Nächstes dran */
function fairness() {
  const counts = DATA.people.map(p => ({ person: p, count: tripCount(p.id) }));
  const maxCount = counts.length ? Math.max(...counts.map(c => c.count)) : 0;
  const minCount = counts.length ? Math.min(...counts.map(c => c.count)) : 0;
  const balanced = counts.length > 1 && maxCount === minCount;
  const behind = counts.filter(c => c.count === minCount).map(c => c.person);
  const sorted = [...counts].sort((a, b) => a.count - b.count);
  return { counts, sorted, maxCount, minCount, diff: maxCount - minCount, balanced, behind };
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

  let statusHtml;
  let nextHtml = '';
  if (f.counts.length < 2) {
    statusHtml = `<div class="fairness-status">Füge eine weitere Person hinzu, um die Fairness zu berechnen.</div>`;
  } else if (f.balanced) {
    statusHtml = `<div class="fairness-status balanced">Perfekt ausgeglichen ⚖️</div>`;
  } else {
    const names = f.behind.map(p => `<b>${escapeHtml(p.name)}</b>`).join(' &amp; ');
    const verb = f.behind.length > 1 ? 'sollten' : 'sollte';
    const tripWord = f.diff === 1 ? 'Fahrt' : 'Fahrten';
    statusHtml = `<div class="fairness-status">${names} ${verb} die nächsten <b>${f.diff}</b> ${tripWord} übernehmen.</div>`;
    nextHtml = `<div class="fairness-next">Nächste Fahrt: <b>→ ${f.behind.map(p => escapeHtml(p.name)).join(' / ')}</b></div>`;
  }

  root.innerHTML = `
    <div class="fairness-card">
      <div class="fairness-label">⚖️ Fairness</div>
      <div class="fairness-list">
        ${f.sorted.map(c => `
          <div class="fairness-row">
            <span class="fairness-row-dot" style="background:${c.person.accentColor}"></span>
            <span class="fairness-row-name">${escapeHtml(c.person.name)}</span>
            <div class="fairness-row-track"><div class="fairness-row-fill" style="width:${f.maxCount ? (c.count / f.maxCount) * 100 : 0}%; background:${c.person.accentColor}"></div></div>
            <span class="fairness-row-count">${c.count}</span>
          </div>
        `).join('')}
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
  return `
    <div class="carmini-card" data-person="${person.id}">
      ${carSvg(person.car)}
      <div class="carmini-title">${escapeHtml(person.car.brand)} ${escapeHtml(person.car.model)}</div>
      <div class="carmini-sub">${escapeHtml(person.name)}</div>
      <div class="carmini-count" style="background:${hexToRgba(person.accentColor, 0.15)}; color:${person.accentColor}">${tripCount(person.id)} Fahrten</div>
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
  return `
    <div class="trip-item" data-id="${trip.id}">
      <div class="trip-car-icon">${carSvg(person.car)}</div>
      <div class="trip-info">
        <div class="trip-date">${formatDate(trip.date)}</div>
        <div class="trip-person"><span class="trip-dot" style="background:${person.accentColor}"></span>${escapeHtml(person.name)}</div>
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
              <div class="choice-btn ${p.id === selectedPersonId ? 'selected' : ''}" data-person="${p.id}" data-color="${p.accentColor}">
                <div class="choice-dot" style="background:${p.accentColor}; margin:0 auto 8px;"></div>
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
  function applyChoiceStyles() {
    $$('.choice-btn').forEach(b => {
      const isSel = b.dataset.person === selected;
      b.classList.toggle('selected', isSel);
      b.style.borderColor = isSel ? b.dataset.color : '';
      b.style.background = isSel ? hexToRgba(b.dataset.color, 0.1) : '';
    });
  }
  applyChoiceStyles();
  $$('.choice-btn', document).forEach(btn => {
    btn.addEventListener('click', () => {
      selected = btn.dataset.person;
      applyChoiceStyles();
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
  const yearPart = person.car.year ? ` · ${person.car.year}` : '';
  const colorPart = person.car.color ? ` · ${escapeHtml(person.car.color)}` : '';
  return `
    <div class="car-big-card">
      ${carSvg(person.car)}
      <div class="car-big-title">${escapeHtml(person.car.brand)} ${escapeHtml(person.car.model)}</div>
      <div class="car-big-sub">${escapeHtml(person.name)}${yearPart}${colorPart}</div>
      <div class="car-big-count" style="background:${hexToRgba(person.accentColor, 0.15)}; color:${person.accentColor}">🚗 ${tripCount(person.id)} Riesa-Fahrten</div>
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
  const counts = DATA.people.map(p => ({ person: p, count: tripCount(p.id) }));
  const maxCount = counts.length ? Math.max(...counts.map(c => c.count)) : 0;
  const minCount = counts.length ? Math.min(...counts.map(c => c.count)) : 0;
  const range = maxCount - minCount;

  root.innerHTML = `
    <div class="section-title">Statistik</div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Fahrten gesamt</div></div>
      <div class="stat-card"><div class="stat-value">${range}</div><div class="stat-label">Größte Differenz</div></div>
      ${counts.map(c => `
        <div class="stat-card">
          <div class="stat-value">${c.count}</div>
          <div class="stat-label">${escapeHtml(c.person.name)}</div>
        </div>
      `).join('')}
      <div class="stat-card full">
        <div class="stat-label" style="margin-bottom:10px;">Verteilung</div>
        <div class="bars">
          ${counts.map(c => `
            <div class="bar-row">
              <div class="bar-row-label">${escapeHtml(c.person.name)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${maxCount ? (c.count / maxCount) * 100 : 0}%; background:${c.person.accentColor}"></div></div>
              <div class="bar-row-value">${c.count}</div>
            </div>
          `).join('')}
        </div>
      </div>
      ${counts.map(c => `
        <div class="stat-card">
          <div class="stat-value">${c.count}</div>
          <div class="stat-label">${escapeHtml(c.person.car.brand)} ${escapeHtml(c.person.car.model)}</div>
        </div>
      `).join('')}
    </div>

    <div class="section-title">Personen</div>
    ${DATA.people.map(p => `
      <div class="settings-card">
        <h3><span class="settings-dot" style="background:${p.accentColor}"></span>${escapeHtml(p.name)}</h3>
        <div class="settings-row">
          <span>Name ändern</span>
          <button data-editname="${p.id}">Bearbeiten</button>
        </div>
        ${DATA.people.length > 1 ? `
        <div class="settings-row">
          <span class="danger-zone">Person entfernen</span>
          <button class="danger-zone" data-removeperson="${p.id}">Entfernen</button>
        </div>` : ''}
      </div>
    `).join('')}
    <button class="btn-secondary" id="addPersonBtn">+ Person hinzufügen</button>

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

  $$('[data-removeperson]', root).forEach(btn => {
    btn.addEventListener('click', () => {
      const person = getPerson(btn.dataset.removeperson);
      if (confirm(`"${person.name}" wirklich entfernen? Alle Fahrten dieser Person werden ebenfalls gelöscht.`)) {
        removePerson(DATA, person.id);
        refreshCurrentView();
        showToast('Person entfernt');
      }
    });
  });

  $('#addPersonBtn', root).addEventListener('click', openAddPersonSheet);

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

function openAddPersonSheet() {
  const html = `
    <div class="sheet-backdrop" id="sheetBackdrop">
      <div class="sheet">
        <div class="sheet-handle"></div>
        <h2>Person hinzufügen</h2>
        <form id="addPersonForm">
          <label>Name
            <input type="text" name="name" placeholder="z.B. Person 3" required maxlength="20">
          </label>
          <div class="grid-2">
            <label>Marke
              <input type="text" name="brand" placeholder="z.B. Skoda" required maxlength="20">
            </label>
            <label>Modell
              <input type="text" name="model" placeholder="z.B. Octavia" required maxlength="20">
            </label>
          </div>
          <div class="grid-2">
            <label>Baujahr <span class="opt">optional</span>
              <input type="number" name="year" min="1970" max="2030">
            </label>
            <label>Farbe <span class="opt">optional</span>
              <select name="color">
                ${['Schwarz','Weiß','Silber','Grau','Blau','Dunkelblau','Rot','Grün','Gelb','Orange','Braun','Beige','Violett','Türkis']
                  .map(c => `<option>${c}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="sheet-actions">
            <button type="submit" class="btn-primary">Hinzufügen</button>
          </div>
        </form>
      </div>
    </div>
  `;
  $('#sheetRoot').innerHTML = html;
  $('#sheetBackdrop').addEventListener('click', (e) => { if (e.target.id === 'sheetBackdrop') closeSheet(); });

  $('#addPersonForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const form = Object.fromEntries(fd.entries());
    addPerson(DATA, form);
    closeSheet();
    refreshCurrentView();
    showToast('Person hinzugefügt');
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
