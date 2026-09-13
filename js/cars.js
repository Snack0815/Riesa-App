/* Stilisierte Fahrzeug-Illustrationen als SVG, abhängig von Marke/Modell/Farbe */

const COLOR_MAP = {
  'schwarz': '#232428',
  'weiß': '#eef0f3',
  'weiss': '#eef0f3',
  'silber': '#c7cad1',
  'grau': '#888c96',
  'blau': '#3568d4',
  'dunkelblau': '#1d3468',
  'hellblau': '#6fa8ea',
  'rot': '#d43b3b',
  'grün': '#3b8f5c',
  'gruen': '#3b8f5c',
  'gelb': '#e8c33d',
  'orange': '#e07a2e',
  'braun': '#6b4a30',
  'beige': '#cdb996',
  'violett': '#7a5ac7',
  'lila': '#7a5ac7',
  'pink': '#d47ac2',
  'rosa': '#d47ac2',
  'türkis': '#37a6a6',
  'turkis': '#37a6a6',
  'bordeaux': '#6b2035'
};

function colorToHex(name) {
  if (!name) return '#7a8091';
  const key = name.trim().toLowerCase();
  return COLOR_MAP[key] || '#7a8091';
}

function shade(hex, amt) {
  // amt negative = dunkler, positiv = heller
  const c = hex.replace('#', '');
  if (c.length !== 6) return hex;
  const num = parseInt(c, 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
}

function detectCarType(brand, model) {
  const s = ((brand || '') + ' ' + (model || '')).toLowerCase();

  const suvWords = ['suv', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'q2', 'q3', 'q4', 'q5', 'q7', 'q8',
    'tiguan', 'kodiaq', 'karoq', 'kuga', 'tucson', 'sportage', 'rav4', 'cr-v', 'crv', 'qashqai',
    'x-trail', 'xtrail', 'gle', 'glc', 'gla', 'glb', 'macan', 'cayenne', 'tayron', 'yeti', 'ateca',
    'tarraco', 'juke', 'kona', 'niro', 'sorento', 'santa fe', 'cx-5', 'cx5', 'evoque', 'defender',
    'wrangler', 'model x', 'model y', 'eqc', 'ux', 'nx', 'rx'];
  const wagonWords = ['touring', 'avant', 'kombi', 'variant', 'break', 'sw', 'estate', 'sportbrake', 'st', 'combi'];
  const sedanWords = ['320', '318', '325', '330', '340', '520', '530', '540', '3er', '5er', '7er',
    'a4', 'a6', 'a8', 'passat', 'jetta', 'octavia', 'superb', 'corolla', 'camry', 'model 3', 'model s',
    'insignia', 'mondeo', 'e-klasse', 'eklasse', 'c-klasse', 'cklasse', 's-klasse', 'sklasse',
    'talisman', 'accord', 'civic sedan', 'elantra', 'sonata', 'malibu', 'arteon', 'stinger'];
  const hatchWords = ['golf', 'polo', 'corsa', 'fiesta', 'clio', 'ibiza', 'leon', 'a1', 'a2', 'a3',
    '208', '108', '308', 'up!', 'up', 'i10', 'i20', 'i30', 'fabia', 'yaris', 'mini', 'mini cooper',
    'swift', 'micra', 'note', '500', 'panda', 'auris', 'megane', 'astra', 'focus', 'ceed', 'rio', 'aygo'];

  if (suvWords.some(w => s.includes(w))) return 'suv';
  if (wagonWords.some(w => s.includes(w))) return 'wagon';
  if (sedanWords.some(w => s.includes(w))) return 'sedan';
  if (hatchWords.some(w => s.includes(w))) return 'hatchback';
  return 'hatchback';
}

/* Jede Form liefert einen SVG-Body-Pfad (viewBox 0 0 240 120) */
function carSvgBody(type, bodyColor, glassColor, rimColor) {
  const dark = shade(bodyColor, -35);
  const light = shade(bodyColor, 22);

  const wheels = `
    <g>
      <circle cx="66" cy="90" r="19" fill="#15161b"/>
      <circle cx="66" cy="90" r="10" fill="${rimColor}"/>
      <circle cx="66" cy="90" r="3.5" fill="#15161b"/>
      <circle cx="176" cy="90" r="19" fill="#15161b"/>
      <circle cx="176" cy="90" r="10" fill="${rimColor}"/>
      <circle cx="176" cy="90" r="3.5" fill="#15161b"/>
    </g>`;

  const shadow = `<ellipse cx="120" cy="104" rx="98" ry="8" fill="#000" opacity="0.28"/>`;

  let body = '';
  if (type === 'sedan') {
    body = `
      <path d="M20 84 C18 66 30 60 46 58 L64 40 C70 33 80 28 96 27 L146 27 C160 28 168 33 174 40 L190 58
               C206 60 220 66 220 84 C220 90 214 92 204 92 L36 92 C26 92 20 90 20 84 Z"
            fill="${bodyColor}" stroke="${dark}" stroke-width="2"/>
      <path d="M74 58 L86 40 C90 35 98 32 108 32 L140 32 C150 32 156 35 160 40 L172 58 Z"
            fill="${glassColor}" opacity="0.92"/>
      <line x1="120" y1="33" x2="120" y2="58" stroke="${dark}" stroke-width="2.5" opacity="0.5"/>
      <path d="M20 84 C18 76 22 70 30 68 L210 68 C218 70 222 76 220 84" fill="none" stroke="${light}" stroke-width="2" opacity="0.5"/>
      <rect x="30" y="72" width="14" height="5" rx="2.5" fill="${light}" opacity="0.9"/>
      <rect x="196" y="72" width="14" height="5" rx="2.5" fill="#ffd98a" opacity="0.9"/>
    `;
  } else if (type === 'suv') {
    body = `
      <path d="M18 86 C16 64 30 56 48 54 L62 34 C68 27 78 22 96 21 L148 21 C162 22 172 27 178 34 L192 54
               C210 56 222 64 222 86 C222 93 216 95 204 95 L36 95 C24 95 18 93 18 86 Z"
            fill="${bodyColor}" stroke="${dark}" stroke-width="2"/>
      <path d="M70 54 L82 35 C87 29 96 26 108 26 L138 26 C148 26 155 29 160 35 L172 54 Z"
            fill="${glassColor}" opacity="0.92"/>
      <line x1="120" y1="27" x2="120" y2="54" stroke="${dark}" stroke-width="2.5" opacity="0.5"/>
      <path d="M18 86 C16 78 22 71 30 69 L210 69 C218 71 224 78 222 86" fill="none" stroke="${light}" stroke-width="2" opacity="0.5"/>
      <rect x="28" y="74" width="16" height="6" rx="3" fill="${light}" opacity="0.9"/>
      <rect x="196" y="74" width="16" height="6" rx="3" fill="#ffd98a" opacity="0.9"/>
    `;
  } else if (type === 'wagon') {
    body = `
      <path d="M20 84 C18 65 30 58 44 57 L60 39 C66 32 76 28 92 27 L150 27 C166 28 176 33 180 42 L196 58
               C210 59 220 66 220 84 C220 90 214 92 204 92 L36 92 C26 92 20 90 20 84 Z"
            fill="${bodyColor}" stroke="${dark}" stroke-width="2"/>
      <path d="M72 57 L84 40 C88 34 96 32 106 32 L150 32 C158 33 163 36 166 42 L178 58 Z"
            fill="${glassColor}" opacity="0.92"/>
      <line x1="118" y1="32" x2="118" y2="58" stroke="${dark}" stroke-width="2.5" opacity="0.5"/>
      <path d="M20 84 C18 76 22 70 30 68 L210 68 C218 70 222 76 220 84" fill="none" stroke="${light}" stroke-width="2" opacity="0.5"/>
      <rect x="30" y="72" width="14" height="5" rx="2.5" fill="${light}" opacity="0.9"/>
      <rect x="196" y="72" width="14" height="5" rx="2.5" fill="#ffd98a" opacity="0.9"/>
    `;
  } else {
    // hatchback / generic
    body = `
      <path d="M22 84 C20 68 32 60 48 58 L66 40 C72 33 82 29 98 28 L138 28 C152 29 160 34 166 41 L184 58
               C202 60 216 68 216 84 C216 90 210 92 200 92 L38 92 C28 92 22 90 22 84 Z"
            fill="${bodyColor}" stroke="${dark}" stroke-width="2"/>
      <path d="M76 58 L88 41 C92 36 98 33 108 33 L134 33 C142 33 148 36 152 41 L164 58 Z"
            fill="${glassColor}" opacity="0.92"/>
      <line x1="120" y1="34" x2="120" y2="58" stroke="${dark}" stroke-width="2.5" opacity="0.5"/>
      <path d="M22 84 C20 76 24 70 32 68 L206 68 C214 70 218 76 216 84" fill="none" stroke="${light}" stroke-width="2" opacity="0.5"/>
      <rect x="32" y="72" width="14" height="5" rx="2.5" fill="${light}" opacity="0.9"/>
      <rect x="192" y="72" width="14" height="5" rx="2.5" fill="#ffd98a" opacity="0.9"/>
    `;
  }

  return `<svg viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fahrzeug">
    ${shadow}
    ${body}
    ${wheels}
  </svg>`;
}

function carSvg(car) {
  const type = detectCarType(car && car.brand, car && car.model);
  const bodyColor = colorToHex(car && car.color);
  return carSvgBody(type, bodyColor, '#aab4c8', '#dfe3ea');
}
