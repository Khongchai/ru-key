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

// ---------- fingers ----------
// standard ЙЦУКЕН touch-typing finger zones
const FINGER_ZONES = {
  'l-pinky':  ['ё', 'й', 'ф', 'я'],
  'l-ring':   ['ц', 'ы', 'ч'],
  'l-middle': ['у', 'в', 'с'],
  'l-index':  ['к', 'е', 'а', 'п', 'м', 'и'],
  'r-index':  ['н', 'г', 'р', 'о', 'т', 'ь'],
  'r-middle': ['ш', 'л', 'б'],
  'r-ring':   ['щ', 'д', 'ю'],
  'r-pinky':  ['з', 'х', 'ъ', 'ж', 'э', '-'],
};
const CHAR_TO_FINGERS = { ' ': ['l-thumb', 'r-thumb'] };
for (const [finger, chars] of Object.entries(FINGER_ZONES))
  for (const ch of chars) CHAR_TO_FINGERS[ch] = [finger];

function handSVG(side) {
  const p = side === 'l' ? 'l' : 'r';
  // drawn as a left hand; the right hand is the same shape mirrored
  const mirror = side === 'r' ? ' style="transform: scaleX(-1)"' : '';
  return `<svg viewBox="0 0 132 152" xmlns="http://www.w3.org/2000/svg"${mirror}>
    <rect class="palm" x="6" y="86" width="94" height="58" rx="20"/>
    <rect class="finger" data-finger="${p}-pinky"  x="6"  y="46" width="20" height="52" rx="10"/>
    <rect class="finger" data-finger="${p}-ring"   x="30" y="22" width="20" height="76" rx="10"/>
    <rect class="finger" data-finger="${p}-middle" x="54" y="12" width="20" height="86" rx="10"/>
    <rect class="finger" data-finger="${p}-index"  x="78" y="24" width="20" height="74" rx="10"/>
    <rect class="finger" data-finger="${p}-thumb"  x="102" y="86" width="19" height="50" rx="9.5"
          transform="rotate(-32 108 92)"/>
  </svg>`;
}

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

// weighted shuffle: a fresh random order every page load. For the default
// list (frequency-ordered) earlier words get higher weight, so common words
// tend to come up sooner — but every word appears once per deck cycle.
let deck = [];
function weightedShuffle(list) {
  return list
    .map((w, i) => ({ w, key: -Math.log(Math.random()) * (usingCustom ? 1 : i + 8) }))
    .sort((a, b) => a.key - b.key)
    .map(x => x.w);
}
function pickWord() {
  if (!deck.length) deck = weightedShuffle(WORDS);
  return deck.shift();
}

// ---------- audio ----------
// Default-list words have pre-generated neural TTS at audio/<index>.mp3
// (see generate-audio.js). Anything else falls back to the Web Speech API.
const AUDIO_INDEX = new Map(parseWordList(DEFAULT_WORDS).map((e, i) => [e.w, i]));
const audioCache = new Map();
let soundOn = localStorage.getItem('rukey-sound') !== 'off';

function speak(word) {
  if (!soundOn || !word) return;
  const idx = AUDIO_INDEX.get(word);
  if (idx !== undefined) {
    let a = audioCache.get(idx);
    if (!a) {
      a = new Audio('audio/' + idx + '.mp3');
      if (audioCache.size > 200) audioCache.clear();
      audioCache.set(idx, a);
    }
    a.currentTime = 0;
    a.play().catch(() => speakFallback(word));
  } else {
    speakFallback(word);
  }
}

function speakFallback(word) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'ru-RU';
  const voice = speechSynthesis.getVoices().find(v => v.lang.startsWith('ru'));
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

// ---------- keyboard tick sound ----------
// adapted from lochie/web-haptics debug-mode click:
// a 4ms noise burst with exponential decay through a jittered bandpass filter
let tickCtx = null, tickFilter = null, tickGain = null, tickBuffer = null;

function ensureAudioCtx() {
  if (typeof AudioContext === 'undefined') return false;
  if (!tickCtx) {
    tickCtx = new AudioContext();
    tickFilter = tickCtx.createBiquadFilter();
    tickFilter.type = 'bandpass';
    tickFilter.frequency.value = 4000;
    tickFilter.Q.value = 8;
    tickGain = tickCtx.createGain();
    tickFilter.connect(tickGain);
    tickGain.connect(tickCtx.destination);
    tickBuffer = tickCtx.createBuffer(1, tickCtx.sampleRate * 0.004, tickCtx.sampleRate);
  }
  if (tickCtx.state === 'suspended') tickCtx.resume();
  return true;
}

function playTick(intensity = 0.7) {
  if (!ensureAudioCtx()) return;

  const data = tickBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 25);

  tickGain.gain.value = 0.5 * intensity;
  const baseFreq = 2000 + intensity * 2000;
  tickFilter.frequency.value = baseFreq * (1 + (Math.random() - 0.5) * 0.3);

  const source = tickCtx.createBufferSource();
  source.buffer = tickBuffer;
  source.connect(tickFilter);
  source.onended = () => source.disconnect();
  source.start();
}

// wrong-key sound: same noise-burst idea as the tick, but longer decay through
// a resonant lowpass — a dull, quiet thud, like pressing a dead key
function playThud(intensity = 0.6) {
  if (!ensureAudioCtx()) return;

  const buf = tickCtx.createBuffer(1, tickCtx.sampleRate * 0.07, tickCtx.sampleRate);
  const data = buf.getChannelData(0);
  const tau = tickCtx.sampleRate * 0.018;
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / tau);

  const filter = tickCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 240 * (1 + (Math.random() - 0.5) * 0.15);
  filter.Q.value = 6;

  const gain = tickCtx.createGain();
  gain.gain.value = 0.9 * intensity; // low frequencies need more gain to feel equally loud

  const source = tickCtx.createBufferSource();
  source.buffer = buf;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(tickCtx.destination);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  source.start();
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
// build hands
document.getElementById('handL').innerHTML = handSVG('l');
document.getElementById('handR').innerHTML = handSVG('r');
const fingerEls = {};
document.querySelectorAll('.finger').forEach(f => { fingerEls[f.dataset.finger] = f; });

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

// ---------- loop bar ----------
// yellow bar above the word line; drag either end to select a set of words
// that repeats serially (wrapping at the end). null = follow current word, no looping.
let loopRange = null; // {start, end} inclusive indices into queue
const loopBar = document.createElement('div');
loopBar.id = 'loopBar';
loopBar.title = 'drag the ends to set a repeat range · double-click to clear';
const gripL = document.createElement('div');
gripL.className = 'grip left';
const gripR = document.createElement('div');
gripR.className = 'grip right';
loopBar.append(gripL, gripR);

function updateLoopBar() {
  const s = queue[loopRange ? loopRange.start : currentIdx];
  const e = queue[loopRange ? loopRange.end : currentIdx];
  if (!s || !e) return;
  loopBar.style.left = s.el.offsetLeft + 'px';
  loopBar.style.width = (e.el.offsetLeft + e.el.offsetWidth - s.el.offsetLeft) + 'px';
  loopBar.classList.toggle('pinned', !!loopRange);
}

function snapIndex(clientX) {
  // track's bounding rect already includes its transform, so this yields layout-x
  const x = clientX - track.getBoundingClientRect().left;
  let best = 0, bestD = Infinity;
  for (let i = 0; i < queue.length; i++) {
    const el = queue[i].el;
    const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - x);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function gripDrag(side) {
  return (e) => {
    e.preventDefault();
    if (!loopRange) loopRange = { start: currentIdx, end: currentIdx };
    const grip = e.currentTarget;
    grip.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const idx = snapIndex(ev.clientX);
      if (side === 'left') loopRange.start = Math.min(idx, loopRange.end);
      else loopRange.end = Math.max(idx, loopRange.start);
      updateLoopBar();
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
    updateLoopBar();
  };
}
gripL.addEventListener('pointerdown', gripDrag('left'));
gripR.addEventListener('pointerdown', gripDrag('right'));

loopBar.addEventListener('dblclick', () => {
  loopRange = null;
  updateLoopBar();
});

function addWordToTrack(entry) {
  const el = document.createElement('div');
  el.className = 'word';
  el.textContent = entry.w;
  el.addEventListener('click', () => goToWord(queue.findIndex(q => q.el === el)));
  track.appendChild(el);
  queue.push({ ...entry, el });
}

function goToWord(i) {
  if (i < 0 || i >= queue.length || i === currentIdx) return;
  const cur = queue[currentIdx];
  cur.el.classList.remove('current', 'error');
  cur.el.textContent = cur.w;
  currentIdx = i;
  queue[i].el.classList.remove('done');
  typedPos = 0;
  errorState = false;
  ensureBuffer();
  renderCurrent();
  centerCurrent();
  updateLoopBar();
  speak(queue[currentIdx].w);
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
  document.querySelectorAll('.finger.active').forEach(f => f.classList.remove('active'));
  const cur = queue[currentIdx];
  if (!cur) return;
  const ch = cur.w[typedPos];
  if (!ch) return;
  if (charToKeyEl[ch]) charToKeyEl[ch].classList.add('next');
  for (const finger of CHAR_TO_FINGERS[ch] || [])
    if (fingerEls[finger]) fingerEls[finger].classList.add('active');
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
  while (currentIdx > 30 && (!loopRange || loopRange.start > 0)) {
    const old = queue.shift();
    old.el.remove();
    currentIdx--;
    if (loopRange) { loopRange.start--; loopRange.end--; }
  }
}

// completion while a loop range is pinned: serial through the range, wrap at the end
function completeLoopWord() {
  const cur = queue[currentIdx];
  doneWords++;
  countEl.textContent = doneWords;
  cur.el.classList.remove('current', 'error');
  cur.el.textContent = cur.w;
  cur.el.classList.add('done');
  const next = currentIdx >= loopRange.end ? loopRange.start : currentIdx + 1;
  if (next === loopRange.start)
    for (let i = loopRange.start; i <= loopRange.end; i++) queue[i].el.classList.remove('done');
  currentIdx = next;
  queue[currentIdx].el.classList.remove('done');
  typedPos = 0;
  errorState = false;
  renderCurrent();
  centerCurrent();
  updateStats();
  updateLoopBar();
  speak(queue[currentIdx].w);
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
  updateLoopBar();
  speak(queue[currentIdx].w);
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
  if (keyEl && !e.repeat) {
    keyEl.classList.add('pressed');
    setTimeout(() => keyEl.classList.remove('pressed'), 90);
  }

  if (e.key === 'Escape') { advanceWord(true); return; }

  if (e.key === 'Backspace') {
    if (typedPos > 0) {
      typedPos--;
      errorState = false;
      renderCurrent();
    } else if (currentIdx > 0) {
      goToWord(currentIdx - 1); // at the start of a word, back up to the previous one
    }
    e.preventDefault();
    return;
  }

  if (e.key === 'Tab') {
    advanceWord(true); // forward, mirroring backspace-at-start going back
    e.preventDefault();
    return;
  }

  if (e.key === 'Enter') {
    speak(queue[currentIdx] && queue[currentIdx].w);
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
    playTick();
    typedPos++;
    errorState = false;
    if (typedPos >= cur.w.length) {
      if (loopRange) { completeLoopWord(); return; }
      renderCurrent();
      advanceWord(false);
      return;
    }
  } else {
    playThud();
    mistakes++;
    errorState = true;
    // retrigger shake animation
    cur.el.classList.remove('error');
    void cur.el.offsetWidth;
  }
  renderCurrent();
  updateStats();
});

// ---------- keyboard helper toggle ----------
const kbBtn = document.getElementById('kbBtn');
const kbArea = document.getElementById('kbArea');
let kbVisible = localStorage.getItem('rukey-kb') !== 'off';
kbArea.classList.toggle('hidden', !kbVisible);
kbBtn.classList.toggle('on', kbVisible);

kbBtn.addEventListener('click', () => {
  kbVisible = !kbVisible;
  kbArea.classList.toggle('hidden', !kbVisible);
  kbBtn.classList.toggle('on', kbVisible);
  localStorage.setItem('rukey-kb', kbVisible ? 'on' : 'off');
  centerCurrent(); // arena height changed, re-center the word line
});

// ---------- sound toggle ----------
const soundBtn = document.getElementById('soundBtn');
soundBtn.classList.toggle('on', soundOn);

soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.classList.toggle('on', soundOn);
  localStorage.setItem('rukey-sound', soundOn ? 'on' : 'off');
  if (soundOn && queue[currentIdx]) speak(queue[currentIdx].w);
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
  deck = [];
  loopRange = null;
  track.innerHTML = '';
  track.appendChild(loopBar);
  queue = [];
  currentIdx = 0;
  typedPos = 0;
  errorState = false;
  ensureBuffer();
  renderCurrent();
  centerCurrent();
  updateLoopBar();
}

window.addEventListener('resize', centerCurrent);
restart();
