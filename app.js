/* ru-key — Russian touch typing trainer */

// ---------- keyboard layout (ЙЦУКЕН) ----------
// each key: [cyrillic char, physical KeyboardEvent.code, latin legend]
const KEY_ROWS = [
  [
    ['ё', 'Backquote', '`'],
  ],
  [
    ['й', 'KeyQ', 'q'], ['ц', 'KeyW', 'w'], ['у', 'KeyE', 'e'], ['к', 'KeyR', 'r'],
    ['е', 'KeyT', 't'], ['н', 'KeyY', 'y'], ['г', 'KeyU', 'u'], ['ш', 'KeyI', 'i'],
    ['щ', 'KeyO', 'o'], ['з', 'KeyP', 'p'], ['х', 'BracketLeft', '['], ['ъ', 'BracketRight', ']'],
  ],
  [
    ['ф', 'KeyA', 'a'], ['ы', 'KeyS', 's'], ['в', 'KeyD', 'd'], ['а', 'KeyF', 'f'],
    ['п', 'KeyG', 'g'], ['р', 'KeyH', 'h'], ['о', 'KeyJ', 'j'], ['л', 'KeyK', 'k'],
    ['д', 'KeyL', 'l'], ['ж', 'Semicolon', ';'], ['э', 'Quote', "'"],
  ],
  [
    ['я', 'KeyZ', 'z'], ['ч', 'KeyX', 'x'], ['с', 'KeyC', 'c'], ['м', 'KeyV', 'v'],
    ['и', 'KeyB', 'b'], ['т', 'KeyN', 'n'], ['ь', 'KeyM', 'm'], ['б', 'Comma', ','],
    ['ю', 'Period', '.'],
  ],
];
const HOME_KEYS = new Set(['ф', 'ы', 'в', 'а', 'о', 'л', 'д', 'ж']);
const CODE_TO_CHAR = {};
for (const row of KEY_ROWS) for (const [ch, code] of row) CODE_TO_CHAR[code] = ch;
// hyphen appears in a few words (что-то)
CODE_TO_CHAR['Minus'] = '-';

// ---------- word list ----------
const LS_KEY = 'rukey-custom-words';

function parseWordList(str) {
  const out = [];
  for (const raw of str.split(',')) {
    const e = raw.trim();
    if (!e) continue;
    const eq = e.indexOf('=');
    if (eq > 0) out.push({ w: e.slice(0, eq).trim().toLowerCase(), m: e.slice(eq + 1).trim() });
    else out.push({ w: e.toLowerCase(), m: '' });
  }
  return out.filter(x => x.w);
}

let WORDS = [];
let usingCustom = false;

function loadWords() {
  const custom = localStorage.getItem(LS_KEY);
  if (custom && parseWordList(custom).length) {
    WORDS = parseWordList(custom);
    usingCustom = true;
  } else {
    WORDS = parseWordList(DEFAULT_WORDS);
    usingCustom = false;
  }
}

// biased sampling: the default list is ordered by frequency, so bias
// toward the head while still occasionally reaching the tail.
function pickWord() {
  const r = usingCustom ? Math.random() : Math.pow(Math.random(), 1.7);
  return WORDS[Math.floor(r * WORDS.length)];
}

// ---------- DOM ----------
const track = document.getElementById('track');
const viewport = document.getElementById('viewport');
const meaningEl = document.getElementById('meaning');
const keyboardEl = document.getElementById('keyboard');
const wpmEl = document.getElementById('wpm');
const accEl = document.getElementById('acc');
const countEl = document.getElementById('count');

// build keyboard
const charToKeyEl = {};
for (const row of KEY_ROWS) {
  const rowEl = document.createElement('div');
  rowEl.className = 'krow';
  for (const [ch, code, latin] of row) {
    const k = document.createElement('div');
    k.className = 'key' + (HOME_KEYS.has(ch) ? ' home' : '');
    k.dataset.code = code;
    k.innerHTML = `${ch}<small>${latin}</small>`;
    charToKeyEl[ch] = k;
    rowEl.appendChild(k);
  }
  keyboardEl.appendChild(rowEl);
}
// space bar row
{
  const rowEl = document.createElement('div');
  rowEl.className = 'krow';
  const space = document.createElement('div');
  space.className = 'key space';
  space.dataset.code = 'Space';
  space.textContent = '';
  charToKeyEl[' '] = space;
  rowEl.appendChild(space);
  keyboardEl.appendChild(rowEl);
}

// ---------- game state ----------
let queue = [];        // [{w, m, el}]
let currentIdx = 0;    // index into queue
let typedPos = 0;      // chars typed in current word
let errorState = false;
let doneWords = 0;
let keystrokes = 0;
let mistakes = 0;
let startedAt = null;

function addWordToTrack(entry) {
  const el = document.createElement('div');
  el.className = 'word';
  el.textContent = entry.w;
  track.appendChild(el);
  queue.push({ ...entry, el });
}

function renderCurrent() {
  const cur = queue[currentIdx];
  if (!cur) return;
  const w = cur.w;
  let html = '';
  for (let i = 0; i < w.length; i++) {
    const cls = i < typedPos ? 'typed' : (i === typedPos ? 'cursor' : '');
    html += cls ? `<span class="${cls}">${w[i]}</span>` : w[i];
  }
  cur.el.innerHTML = html;
  cur.el.classList.add('current');
  cur.el.classList.toggle('error', errorState);
  meaningEl.textContent = cur.m || ' ';
  highlightNextKey();
}

function highlightNextKey() {
  document.querySelectorAll('.key.next').forEach(k => k.classList.remove('next'));
  const cur = queue[currentIdx];
  if (!cur) return;
  const ch = cur.w[typedPos];
  if (ch && charToKeyEl[ch]) charToKeyEl[ch].classList.add('next');
}

function centerCurrent() {
  const cur = queue[currentIdx];
  if (!cur) return;
  const mid = viewport.clientWidth / 2;
  const target = cur.el.offsetLeft + cur.el.offsetWidth / 2;
  track.style.transform = `translateX(${mid - target}px)`;
}

function ensureBuffer() {
  while (queue.length - currentIdx < 12) addWordToTrack(pickWord());
  // trim far-past words so the track doesn't grow forever
  while (currentIdx > 30) {
    const old = queue.shift();
    old.el.remove();
    currentIdx--;
  }
}

function advanceWord(skipped) {
  const cur = queue[currentIdx];
  cur.el.classList.remove('current', 'error');
  cur.el.innerHTML = '';
  cur.el.textContent = cur.w;
  cur.el.classList.add('done');
  if (!skipped) {
    doneWords++;
    countEl.textContent = doneWords;
  }
  currentIdx++;
  typedPos = 0;
  errorState = false;
  ensureBuffer();
  renderCurrent();
  centerCurrent();
  updateStats();
}

function updateStats() {
  if (startedAt && keystrokes > 0) {
    const mins = (Date.now() - startedAt) / 60000;
    // standard WPM: correct chars / 5 / minutes
    const correct = keystrokes - mistakes;
    wpmEl.textContent = mins > 0 ? Math.max(0, Math.round(correct / 5 / mins)) : 0;
    accEl.textContent = Math.round((correct / keystrokes) * 100) + '%';
  }
}

// ---------- input ----------
const CYRILLIC = /^[а-яё-]$/;

document.addEventListener('keydown', (e) => {
  if (document.getElementById('overlay').classList.contains('open')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  // key press animation on the on-screen keyboard
  const keyEl = document.querySelector(`.key[data-code="${e.code}"]`);
  if (keyEl) {
    keyEl.classList.add('pressed');
    setTimeout(() => keyEl.classList.remove('pressed'), 90);
  }

  if (e.key === 'Escape') { advanceWord(true); return; }

  if (e.key === 'Backspace') {
    if (typedPos > 0) typedPos--;
    errorState = false;
    renderCurrent();
    e.preventDefault();
    return;
  }

  // resolve typed char: direct Cyrillic (RU layout on) or physical-key mapping
  let ch = null;
  const k = e.key.toLowerCase();
  if (CYRILLIC.test(k)) ch = k;
  else if (CODE_TO_CHAR[e.code]) ch = CODE_TO_CHAR[e.code];
  else if (e.code === 'Space') ch = ' ';

  if (!ch) return;
  e.preventDefault();

  const cur = queue[currentIdx];
  if (!cur) return;

  if (ch === ' ') return; // words auto-advance; space is a no-op

  if (!startedAt) startedAt = Date.now();
  keystrokes++;

  if (ch === cur.w[typedPos]) {
    typedPos++;
    errorState = false;
    if (typedPos >= cur.w.length) {
      renderCurrent();
      advanceWord(false);
      return;
    }
  } else {
    mistakes++;
    errorState = true;
    // retrigger shake animation
    cur.el.classList.remove('error');
    void cur.el.offsetWidth;
  }
  renderCurrent();
  updateStats();
});

// ---------- settings panel ----------
const overlay = document.getElementById('overlay');
const wordInput = document.getElementById('wordInput');
const panelMsg = document.getElementById('panelMsg');

document.getElementById('menuBtn').addEventListener('click', () => {
  wordInput.value = localStorage.getItem(LS_KEY) || '';
  panelMsg.textContent = usingCustom ? 'using custom list (' + WORDS.length + ' words)' : 'using default list (' + WORDS.length + ' words)';
  overlay.classList.add('open');
});
document.getElementById('cancelBtn').addEventListener('click', () => overlay.classList.remove('open'));
overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });

document.getElementById('saveBtn').addEventListener('click', () => {
  const val = wordInput.value.trim();
  if (val) {
    if (!parseWordList(val).length) {
      panelMsg.textContent = 'no valid entries found';
      return;
    }
    localStorage.setItem(LS_KEY, val);
  } else {
    localStorage.removeItem(LS_KEY);
  }
  overlay.classList.remove('open');
  restart();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  localStorage.removeItem(LS_KEY);
  wordInput.value = '';
  overlay.classList.remove('open');
  restart();
});

// ---------- init ----------
function restart() {
  loadWords();
  track.innerHTML = '';
  queue = [];
  currentIdx = 0;
  typedPos = 0;
  errorState = false;
  ensureBuffer();
  renderCurrent();
  centerCurrent();
}

window.addEventListener('resize', centerCurrent);
restart();
