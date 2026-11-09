import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const clamp01 = x => Math.min(1, Math.max(0, x));
const ramp = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const B2T = (x, y, z) => new THREE.Vector3(x, z, -y);   // Blender Z-up -> glTF Y-up
const COARSE = matchMedia('(pointer:coarse)').matches;

/* ---------- authored scene settings (the "as filmed" look) ---------- */
const SCENES = {
  tabernacle: {
    label: "Tabernacle", glb: 'assets/tabernacle.glb', mp4: 'assets/tabernacle.mp4', hour: 11,
    sky: ['#6f9cd0', '#bcd3e6', '#f0e2c4'], fog: [0xe0d2b4, 0.0009],
    sun: { c: 0xfff0d0, i: 2.2, p: [40, 90, 30] }, hemi: [0xdbe6f5, 0xb09a72, 1.9],
    cams: { 'Courtyard': [[-36, 12, 18], [0, 1.5, 0]], 'Altar': [[-20, 5, 10], [-8, 1, 0]], 'The Tent': [[-4, 7, 15], [12, 2, 0]], 'Camp aerial': [[-70, 60, 70], [5, 0, 0]], 'Ark glory': [[16.5, 9, 17], [16.5, 3.5, 0]] },
    orbit: [[-42, 28, 38], [4, 2, 0]],
  },
  solomon: {
    label: "Solomon's Temple", glb: 'assets/solomon.glb', mp4: 'assets/solomon.mp4', hour: 12,
    sky: ['#6f9cd0', '#bcd3e6', '#f0e2c4'], fog: [0xe2d6b8, 0.0007],
    sun: { c: 0xfff0d0, i: 2.2, p: [40, 90, 30] }, hemi: [0xdbe6f5, 0xb09a72, 1.9],
    cams: { 'Porch': [[-28, 8, 18], [-4, 6, 0]], 'Courts': [[-42, 22, 36], [-10, 3, 5]], 'Palace': [[-30, 20, 100], [12, 6, 60]], 'Aerial': [[-90, 72, 100], [0, 4, 10]], 'From the south': [[14, 18, 48], [14, 6, 0]], 'Holy of Holies': [[20.4, 3.4, 3.2], [24.5, 1.6, 0]] },
    orbit: [[-70, 45, 75], [5, 5, 8]],
  },
  herod: {
    label: "Herod's Temple", glb: 'assets/herod.glb', mp4: 'assets/herod.mp4', hour: 12,
    sky: ['#6f9cd0', '#bcd3e6', '#f0e2c4'], fog: [0xe2d6b8, 0.0005],
    sun: { c: 0xfff0d0, i: 2.2, p: [40, 90, 30] }, hemi: [0xdbe6f5, 0xb09a72, 1.9],
    cams: { 'Sanctuary': [[12, 24, 22], [100, 26, 0]], 'Court of the Gentiles': [[-104, 14, 12], [-70, 2, 56]], 'Antonia': [[60, 34, -30], [130, 18, -76]], 'Aerial': [[-175, 115, 125], [40, 10, 0]] },
    orbit: [[-150, 95, 110], [30, 15, 0]],
  },
};

/* ---------- environment model ---------- */
const WEATHER = {
  film:  { name: 'As filmed' },
  clear: { name: 'Clear',    sun: 1,    hemi: 1,    fog: 0.7, grey: 0 },
  cloud: { name: 'Cloudy',   sun: 0.35, hemi: 0.9,  fog: 1.2, grey: 0.5, wind: 0.5 },
  rain:  { name: 'Rain',     sun: 0.15, hemi: 0.7,  fog: 2.0, grey: 0.65, fx: 'rain', wind: 0.7, rain: 0.6 },
  storm: { name: 'Storm',    sun: 0.06, hemi: 0.45, fog: 2.4, grey: 0.8, fx: 'rain', wind: 1, rain: 1, lightning: true },
  fog:   { name: 'Fog',      sun: 0.2,  hemi: 0.85, fog: 7,   grey: 0.55, wind: 0.1 },
  dust:  { name: 'Dust wind', sun: 0.45, hemi: 0.8, fog: 3.4, grey: 0.15, fx: 'dust', wind: 0.9, tint: '#d2a56a' },
  snow:  { name: 'Snow',     sun: 0.3,  hemi: 0.95, fog: 2.6, grey: 0.6, fx: 'snow', wind: 0.3 },
};
const SEASONS = {
  film:   { name: 'As filmed' },
  spring: { name: 'Spring (Passover)', ground: '#7a9a3c', gk: 0.5, leaf: '#6f9438', lk: 0.55, sunTint: '#fff2d0', sunK: 0.1, sunMul: 1 },
  summer: { name: 'Summer',            ground: '#b5a45a', gk: 0.55, leaf: '#58782e', lk: 0.45, sunTint: '#fff0c0', sunK: 0.15, sunMul: 1.12 },
  autumn: { name: 'Autumn',            ground: '#9b6c36', gk: 0.6, leaf: '#c8782a', lk: 0.6, sunTint: '#ffc88a', sunK: 0.25, sunMul: 0.92 },
  winter: { name: 'Winter',            ground: '#e6edf2', gk: 0.82, leaf: '#6c725f', lk: 0.5, sunTint: '#cfe0ff', sunK: 0.25, sunMul: 0.72, snowy: true },
};
const SKY_KEYS = [   // hour, [top, mid, horizon]
  [0,    ['#05070d', '#0a1020', '#141a2c']],
  [5,    ['#10162e', '#2c2c52', '#5b4a68']],
  [6.2,  ['#6f86b0', '#e8b896', '#ffb070']],
  [9,    ['#5f8fd0', '#a9c8ea', '#dfe9f2']],
  [12,   ['#3f78c8', '#8fb8e8', '#cfe2f4']],
  [16,   ['#4a80c8', '#9cc0e8', '#e8e0c8']],
  [18.4, ['#4a5a98', '#d98a70', '#ffa050']],
  [20,   ['#161c3a', '#4a3a62', '#a85a5a']],
  [22,   ['#07090f', '#0d1324', '#171d30']],
  [24,   ['#05070d', '#0a1020', '#141a2c']],
];
const c3 = h => new THREE.Color(h);
function skyAt(h) {
  let i = 0; while (i < SKY_KEYS.length - 2 && h > SKY_KEYS[i + 1][0]) i++;
  const [h0, a] = SKY_KEYS[i], [h1, b] = SKY_KEYS[i + 1], k = clamp01((h - h0) / (h1 - h0));
  return a.map((c, n) => c3(c).lerp(c3(b[n]), k));
}
const DAY_NAMES = ['Night', 'Dawn', 'Morning', 'Midday', 'Afternoon', 'Dusk'];

const st = { scene: 'tabernacle', weather: 'film', season: 'film', tod: null, rays: true, clouds: true, sound: false, auto: false, cam: 'Film camera', quality: COARSE ? 'Medium' : 'High' };
const QUAL = { Low: 1, Medium: 1.5, High: 2 };
let LOOK = null;

function computeLook() {
  const S = SCENES[st.scene], W = WEATHER[st.weather], Z = SEASONS[st.season];
  const procedural = st.weather !== 'film' || st.tod !== null;
  const hour = st.tod ?? S.hour;
  let sky, fogCol, fogDen, sunC, sunI, sunP, hemiS, hemiG, hemiI, night = 0, exposure = 1;
  if (!procedural) {
    sky = S.sky.map(c3); fogCol = c3(S.fog[0]); fogDen = S.fog[1];
    sunC = c3(S.sun.c); sunI = S.sun.i; sunP = new THREE.Vector3(...S.sun.p);
    hemiS = c3(S.hemi[0]); hemiG = c3(S.hemi[1]); hemiI = S.hemi[2];
  } else {
    const w = W.grey !== undefined ? W : WEATHER.clear;
    sky = skyAt(hour);
    const ang = clamp01((hour - 6) / 12) * Math.PI, elev = Math.sin(ang);
    night = 1 - clamp01((elev + 0.15) / 0.3);
    const lum = sky.map(c => { const l = c.r * .3 + c.g * .59 + c.b * .11; return new THREE.Color(l, l, l * 1.03); });
    sky = sky.map((c, n) => c.clone().lerp(lum[n].multiplyScalar(0.85 + 0.35 * (1 - night)), w.grey));
    if (w.tint) sky = sky.map(c => c.lerp(c3(w.tint), 0.45 * (1 - night * 0.8)));
    fogCol = sky[2].clone(); fogDen = S.fog[1] * (w.fog ?? 1);
    const low = 1 - clamp01(elev * 2.2);
    sunC = c3('#fff4e0').lerp(c3('#ff9a52'), low);
    sunI = (0.25 + 1.55 * Math.pow(elev, 0.6)) * (w.sun ?? 1) * (1 - night);
    sunP = new THREE.Vector3(Math.cos(ang) * 90, Math.max(Math.sin(ang), 0.05) * 90, 40);
    if (night > 0.5) { sunC = c3('#7f97d8'); sunI = 0.25 * (night - 0.5) * 2 * (w.sun ?? 1) + 0.12; sunP.set(-40, 70, -30); }
    hemiS = sky[0].clone().lerp(c3('#ffffff'), 0.35); hemiG = c3('#4a3e30').lerp(c3('#101018'), night);
    hemiI = (0.3 + 0.7 * (1 - night)) * (w.hemi ?? 1);
  }
  if (Z.sunTint && procedural) { sunC.lerp(c3(Z.sunTint), Z.sunK); sunI *= Z.sunMul; }
  if (Z.snowy && st.weather !== 'film') { hemiI *= 1.1; }
  return { sky, fogCol, fogDen, sunC, sunI, sunP, hemiS, hemiG, hemiI, night, exposure, hour, procedural };
}

/* ---------- renderer / scene ---------- */
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: !COARSE, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const orbitCam = new THREE.PerspectiveCamera(55, 1, 0.1, 4000);
const controls = new OrbitControls(orbitCam, renderer.domElement);
controls.enableDamping = true; controls.autoRotateSpeed = 0.6;
let filmCam = null, filmFov = 40, mixer = null, dur = 12, t = 0, playing = true, mode3d = true, useFilm = true;
let cur = null, root = null, lights = {}, rays = [], clouds = [], tints = [], stars = null, fx = null, flash = 0, nextBolt = 4;
const loader = new GLTFLoader(), cache = {};
loader.setMeshoptDecoder(MeshoptDecoder);
const tmpV = new THREE.Vector3();

/* dragging / pinching / scrolling while the film camera plays hands control to the viewer, starting from the film camera's pose */
function takeControl() {
  if (!useFilm || !mode3d || !filmCam) return;
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), f = new THREE.Vector3(0, 0, -1);
  filmCam.getWorldPosition(p); filmCam.getWorldQuaternion(q); f.applyQuaternion(q);
  orbitCam.position.copy(p); controls.target.copy(p).addScaledVector(f, 12);
  useFilm = false; st.cam = 'Free orbit'; controls.update(); resize(); refreshChips();
}
renderer.domElement.addEventListener('pointerdown', takeControl, true);
renderer.domElement.addEventListener('wheel', takeControl, { capture: true, passive: true });
window.viewer = { orbitCam, controls, st };

function skyTexture(cols) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#' + cols[0].getHexString()); gr.addColorStop(0.6, '#' + cols[1].getHexString()); gr.addColorStop(1, '#' + cols[2].getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let x = Math.imul(a ^ a >>> 15, 1 | a); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }

function makeRays() {
  const rnd = mulberry(11), out = [], tip = B2T(0, -0.2, 1.9);
  for (let k = 0; k < 10; k++) {
    const yaw = (-58 + k * 116 / 9) * Math.PI / 180, pit = (-4 + rnd() * 28) * Math.PI / 180;
    const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pit), Math.sin(pit), Math.cos(yaw) * Math.cos(pit));
    const L = 75, R = k % 3 === 0 ? 8 : 3.5;
    const geo = new THREE.ConeGeometry(R, L, 20, 1, true); geo.translate(0, -L / 2, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat); m.position.copy(tip);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d); out.push(m);
  }
  return out;
}

/* ---------- Ark of the Covenant: light radiating from above the mercy seat (glTF Y-up, metres) ---------- */
const ARK = {
  tabernacle: { p: [16.5, 0.95, 0], L: 8, R: 0.2, glow: 2.2, light: 9 },
  solomon:    { p: [24, 0.95, 0],   L: 17, R: 0.42, glow: 4.0, light: 14 },
};
function makeArk(c) {
  const rnd = mulberry(7), out = [], P = new THREE.Vector3(...c.p);
  const add = (d, L, R, base) => {
    const geo = new THREE.ConeGeometry(R, L, 14, 1, true); geo.translate(0, -L / 2, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffdc8c, transparent: true, opacity: base, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const m = new THREE.Mesh(geo, mat); m.position.copy(P); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize());
    m.userData.base = base; m.userData.ph = rnd() * 6; out.push(m);
  };
  const N = 40;
  for (let k = 0; k < N; k++) {
    const yaw = k / N * Math.PI * 2 + rnd() * 0.25, pit = (46 + rnd() * 42) * Math.PI / 180;
    add(new THREE.Vector3(Math.cos(yaw) * Math.cos(pit), Math.sin(pit), Math.sin(yaw) * Math.cos(pit)), c.L * (0.55 + rnd() * 0.45), c.R * (0.5 + rnd() * 0.9), 0.05 + rnd() * 0.05);
  }
  add(new THREE.Vector3(0, 1, 0), c.L, c.R * 1.2, 0.1);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(0.3, 'rgba(255,214,130,.55)'); gr.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.9 }));
  sp.position.copy(P); sp.scale.setScalar(c.glow); sp.userData.base = 0.9; sp.userData.ph = 1; out.push(sp);
  return out;
}
/* Solomon's Temple was exported with its south wall cut down and the south roof left open; close it so the inside only shows through the door */
function coverSolomon(r) {
  if (r.userData.covered) return; r.userData.covered = true;
  const mat = n => r.getObjectByName(n)?.material || new THREE.MeshStandardMaterial({ color: 0xc9b894 });
  const box = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.name = 'SouthCover'; r.add(o); };
  box(29.4, 13.5, 0.9, 14.7, 6.75, 4.95, mat('TempleStone'));
  box(29.4, 0.5, 6.1, 14.7, 13.75, 2.55, mat('RoofCedar'));
  for (let j = 0; j < 8; j++) { const x = 2.4 + j * 3.4; box(1.15, 3.3, 0.1, x, 10.5, 5.43, mat('WindowFrames')); box(0.8, 2.9, 0.08, x, 10.5, 5.48, mat('WindowDark')); }
}

function makeStars() {
  const n = 1400, p = new Float32Array(n * 3), r = mulberry(5);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * 6.2832, s = Math.sqrt(1 - u * u), y = Math.abs(u) * 0.9 + 0.1;
    p.set([Math.cos(a) * s * 1800, y * 1800, Math.sin(a) * s * 1800], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  return new THREE.Points(g, m);
}

/* ---------- precipitation / dust ---------- */
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
}
const DOT = dotTexture();
const BOX = { w: 70, h: 45, d: 70 };
function buildFx(kind) {
  if (fx) { scene.remove(fx.obj); fx.obj.geometry.dispose(); fx = null; }
  if (!kind) return;
  const n = COARSE ? 1400 : 3200, r = mulberry(kind.length * 17), pos = new Float32Array(n * (kind === 'rain' ? 6 : 3));
  const d = { kind, n, base: new Float32Array(n * 3), ph: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    d.base.set([(r() - .5) * BOX.w, r() * BOX.h - 8, (r() - .5) * BOX.d], i * 3); d.ph[i] = r() * 6.28;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  let obj;
  if (kind === 'rain') obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c8d8, transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
  else obj = new THREE.Points(g, new THREE.PointsMaterial({ map: DOT, color: kind === 'snow' ? 0xffffff : 0xcfa36a, size: kind === 'snow' ? 0.45 : 0.7, transparent: true, opacity: kind === 'snow' ? 0.9 : 0.3, depthWrite: false, fog: false }));
  obj.frustumCulled = false; scene.add(obj); d.obj = obj; fx = d;
}
function updateFx(dt, time, cam) {
  if (!fx) return;
  const W = WEATHER[st.weather], p = fx.obj.geometry.attributes.position.array, b = fx.base, wind = (W.wind ?? 0.4) * 6;
  const sp = fx.kind === 'rain' ? 30 + 18 * (W.rain ?? .6) : fx.kind === 'snow' ? 1.8 : 0.3;
  cam.getWorldPosition(tmpV); fx.obj.position.set(tmpV.x, tmpV.y, tmpV.z);
  for (let i = 0; i < fx.n; i++) {
    const i3 = i * 3;
    b[i3 + 1] -= sp * dt; b[i3] += wind * dt * (fx.kind === 'dust' ? 1.6 : 0.5);
    if (b[i3 + 1] < -8) b[i3 + 1] += BOX.h; if (b[i3] > BOX.w / 2) b[i3] -= BOX.w;
    const sway = fx.kind === 'snow' ? Math.sin(time + fx.ph[i]) * 0.6 : fx.kind === 'dust' ? Math.sin(time * .7 + fx.ph[i]) * 0.8 : 0;
    const x = b[i3] + sway, y = fx.kind === 'dust' ? 0.4 + (b[i3 + 1] + 8) * 0.12 : b[i3 + 1], z = b[i3 + 2];
    if (fx.kind === 'rain') { const o = i * 6, L = 1.1; p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = x - wind * 0.04 * L; p[o + 4] = y + L; p[o + 5] = z; }
    else { p[i3] = x; p[i3 + 1] = y; p[i3 + 2] = z; }
  }
  fx.obj.geometry.attributes.position.needsUpdate = true;
}

/* ---------- audio (procedural, no files) ---------- */
let actx = null, wind = null, rainN = null, master = null;
function noiseBuf(c) { const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function startAudio() {
  if (actx) { actx.resume(); return; }
  actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.6; master.connect(actx.destination);
  const mk = (type, freq, q) => { const s = actx.createBufferSource(); s.buffer = noiseBuf(actx); s.loop = true; const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = actx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); return { g, f }; };
  wind = mk('bandpass', 380, 0.7); rainN = mk('highpass', 2200, 0.5);
}
function audioLevels() {
  if (!actx) return;
  const W = WEATHER[st.weather], on = st.sound ? 1 : 0, now = actx.currentTime;
  wind.g.gain.setTargetAtTime(on * (0.03 + 0.2 * (W.wind ?? 0.25)), now, 0.4);
  rainN.g.gain.setTargetAtTime(on * (W.fx === 'rain' ? 0.04 + 0.1 * (W.rain ?? .5) : 0), now, 0.4);
}
function thunder() {
  if (!actx || !st.sound) return;
  const s = actx.createBufferSource(); s.buffer = noiseBuf(actx); const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
  const g = actx.createGain(), n = actx.currentTime + 0.25 + Math.random() * 0.9;
  g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(0.9, n + 0.08); g.gain.exponentialRampToValueAtTime(0.001, n + 2.8);
  s.connect(f); f.connect(g); g.connect(master); s.start(n); s.stop(n + 3);
}

/* ---------- applying the environment ---------- */
function collectTints() {
  tints = []; const seen = new Set();
  root.traverse(o => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (seen.has(m) || !m.color) return; seen.add(m);
      const n = (m.name || '').toLowerCase();
      const kind = /terrain|grass|soil|ground|sand/.test(n) ? 'ground' : /olive|leaf/.test(n) ? 'leaf' : /^rock|stone/.test(n) ? 'rock' : /cloud/.test(n) ? 'cloud' : null;
      if (kind) tints.push({ m, base: m.color.clone(), kind, vc: m.vertexColors });
    });
  });
}
function applyTints() {
  const Z = SEASONS[st.season], W = WEATHER[st.weather];
  tints.forEach(({ m, base, kind, vc }) => {
    m.color.copy(base);
    if (kind === 'cloud') {
      if (LOOK.procedural) m.color.copy(LOOK.sky[2]).lerp(c3('#ffffff'), 0.55).multiplyScalar((1 - 0.85 * LOOK.night) * (1 - 0.45 * (W.grey ?? 0)));
      return;
    }
    if (kind === 'ground') {   // flatten vertex-colour variation so the season tint actually shows
      const want = vc && st.season === 'film' && W.fx !== 'snow';
      if (m.vertexColors !== want) { m.vertexColors = want; m.needsUpdate = true; }
      if (vc && !want) m.color.set('#5d5a3e');   // stand-in for the flattened vertex colours
    }
    if (st.season !== 'film') {
      if (kind === 'ground') m.color.lerp(c3(Z.ground), Z.gk);
      else if (kind === 'leaf') m.color.lerp(c3(Z.leaf), Z.lk);
      else if (kind === 'rock' && Z.snowy) m.color.lerp(c3('#ffffff'), 0.35);
    }
    if (kind === 'ground') { if (W.fx === 'snow') m.color.lerp(c3('#f2f6fa'), 0.75); else if (W.fx === 'rain') m.color.multiplyScalar(0.78); }
    if (kind === 'leaf' && W.fx === 'snow') m.color.lerp(c3('#e8eef2'), 0.35);
  });
}
/* display mode: solid / wireframe / x-ray (walls, rock and terrain turn see-through) */
const SOLIDISH = /wall|rock|mound|lintel|tower|shelf|house|boulder|mass|stone|tomb|cave|roof/i;
let viewMode = 'solid', viewMats = new Map();
function applyView() {
  if (!root) return;
  root.traverse(o => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (!viewMats.has(m)) viewMats.set(m, { w: m.wireframe, t: m.transparent, o: m.opacity, d: m.depthWrite });
      const b = viewMats.get(m), see = viewMode === 'xray' && SOLIDISH.test(o.name + ' ' + (m.name || ''));
      m.wireframe = viewMode === 'wire' ? true : b.w;
      m.transparent = see ? true : b.t; m.opacity = see ? 0.16 : b.o; m.depthWrite = see ? false : b.d; m.needsUpdate = true;
    });
  });
}
function applyLook() {
  LOOK = computeLook();
  if (scene.background && scene.background.dispose) scene.background.dispose();
  scene.background = skyTexture(LOOK.sky);
  scene.fog = new THREE.FogExp2(LOOK.fogCol.getHex(), LOOK.fogDen);
  lights.sun.color.copy(LOOK.sunC); lights.sun.intensity = LOOK.sunI; lights.sun.position.copy(LOOK.sunP);
  lights.hemi.color.copy(LOOK.hemiS); lights.hemi.groundColor.copy(LOOK.hemiG); lights.hemi.intensity = LOOK.hemiI;
  const W = WEATHER[st.weather];
  if (stars) stars.material.opacity = LOOK.night * clamp01(1 - (W.grey ?? 0) * 1.3);
  clouds.forEach(c => { c.visible = st.clouds; });
  rays.forEach(r => { r.visible = st.rays; });
  applyTints(); buildFxIfChanged(); audioLevels(); updateHud();
}
let fxKind = null;
function buildFxIfChanged() { const k = WEATHER[st.weather].fx || null; if (k !== fxKind) { fxKind = k; buildFx(k); } }

function applyTime() {
  mixer.setTime(t);
  const k = performance.now() / 1000;
  rays.forEach(r => { const o = r.userData; if (o.base !== undefined) (r.material).opacity = o.base * (0.72 + 0.28 * Math.sin(k * 1.7 + o.ph)); });
  if (lights.ark) lights.ark.intensity = ARK[cur].light * (0.85 + 0.15 * Math.sin(k * 2.3));
}

let loadTok = 0;
async function load(key) {
  const tok = ++loadTok;
  $('load').style.display = 'grid'; $('load').textContent = 'Loading scene…';
  if (root) scene.remove(root);
  rays.forEach(r => scene.remove(r)); rays = []; clouds = [];
  Object.values(lights).forEach(l => scene.remove(l)); lights = {};
  if (stars) scene.remove(stars);
  cur = st.scene = key; const S = SCENES[key];
  lights.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); lights.sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(lights.hemi, lights.sun);
  stars = makeStars(); scene.add(stars);
  if (ARK[key]) {
    const A = ARK[key]; lights.ark = new THREE.PointLight(0xffd68a, A.light, 30, 1.5); lights.ark.position.set(A.p[0], A.p[1] + 0.5, A.p[2]); scene.add(lights.ark);
    makeArk(A).forEach(m => { scene.add(m); rays.push(m); });
  }
  const gltf = await loader.loadAsync(S.glb);
  if (tok !== loadTok) return;
  root = gltf.scene; scene.add(root); if (key === 'solomon') coverSolomon(root);
  filmCam = null; root.traverse(o => { if (o.isCamera && !filmCam) filmCam = o; if (/^cloud/i.test(o.name)) clouds.push(o); });
  if (filmCam) { filmFov = filmCam.fov || 40; filmCam.near = 0.05; filmCam.far = 4000; }
  collectTints(); viewMats = new Map(); applyView();
  mixer = new THREE.AnimationMixer(root);
  dur = 0; gltf.animations.forEach(c => { mixer.clipAction(c).play(); dur = Math.max(dur, c.duration); });
  dur = dur || 12; t = 0;
  setCam(st.cam in S.cams || st.cam === 'Film camera' || st.cam === 'Free orbit' ? st.cam : 'Film camera');
  fxKind = '\0'; applyLook(); buildCamChips(); resize(); setVideo();
  $('rowRays').style.display = ARK[key] ? 'flex' : 'none';
  $('load').style.display = 'none';
}

function setCam(name) {
  st.cam = name; const S = SCENES[cur];
  if (name === 'Film camera') useFilm = true;
  else {
    useFilm = false; const p = name === 'Free orbit' ? S.orbit : S.cams[name] || S.orbit;
    orbitCam.position.set(...p[0]); controls.target.set(...p[1]); controls.update();
  }
  resize(); refreshChips();
}

/* ---------- sizing: keeps the horizontal view wide enough on portrait phones ---------- */
function fitFov(base, aspect) { const ref = 16 / 9; if (aspect >= ref) return base; return Math.min(100, 2 * Math.atan(Math.tan(base * Math.PI / 360) * ref / aspect) * 180 / Math.PI); }
function resize() {
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight), a = w / h;
  renderer.setPixelRatio(Math.min(devicePixelRatio, QUAL[st.quality])); renderer.setSize(w, h, false);
  orbitCam.aspect = a; orbitCam.fov = fitFov(55, a); orbitCam.updateProjectionMatrix();
  if (filmCam) { filmCam.aspect = a; filmCam.fov = fitFov(filmFov, a); filmCam.updateProjectionMatrix(); }
}
new ResizeObserver(resize).observe(stage);

function setVideo() {
  const v = $('vid'); v.src = SCENES[cur].mp4;
  v.onerror = () => note('This preview video is not available yet.');
  v.onloadeddata = () => note('');
}
function note(msg) { const n = $('note'); n.textContent = msg; n.style.display = msg && !mode3d ? 'block' : 'none'; }

/* ---------- loop ---------- */
const clock = new THREE.Clock(); let shotReq = false, time = 0;
function tick() {
  requestAnimationFrame(tick);
  if (!mode3d || !mixer) return;
  const dt = Math.min(clock.getDelta(), 0.1); time += dt;
  if (playing) { t = (t + dt) % dur; $('seek').value = Math.round(t / dur * 1000); }
  applyTime();
  lights.hemi.intensity = LOOK.hemiI;
  const W = WEATHER[st.weather];
  if (W.lightning) {
    nextBolt -= dt;
    if (nextBolt < 0) { flash = 1; nextBolt = 3 + Math.random() * 7; thunder(); }
    flash = Math.max(0, flash - dt * 2.4);
    const f = flash > 0.6 ? 1 : flash > 0.4 ? 0.25 : flash;
    lights.hemi.intensity += 3.2 * f; renderer.toneMappingExposure = 1 + 1.2 * f;
  } else renderer.toneMappingExposure = 1;
  controls.autoRotate = st.auto && !useFilm; controls.update();
  const cam = useFilm && filmCam ? filmCam : orbitCam;
  updateFx(dt, time, cam);
  if (stars) { cam.getWorldPosition(tmpV); stars.position.copy(tmpV); }
  $('time').textContent = t.toFixed(1) + ' / ' + dur.toFixed(1) + ' s';
  renderer.render(scene, cam);
  if (shotReq) { shotReq = false; renderer.domElement.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${cur}-${SEASONS[st.season].name.split(' ')[0].toLowerCase()}-${st.weather}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); }
}

/* ---------- HUD ---------- */
const TOD_PRESETS = [['film', 'As filmed'], ['6.2', 'Dawn'], ['12', 'Noon'], ['18.4', 'Dusk'], ['23', 'Night']];
const mkChips = (id, items, onPick) => {
  const el = $(id); el.innerHTML = '';
  items.forEach(([k, label]) => { const b = document.createElement('button'); b.textContent = label; b.dataset.k = k; b.onclick = () => { onPick(k); refreshChips(); }; el.appendChild(b); });
};
function buildCamChips() {
  mkChips('cCam', [['Film camera', 'Film camera'], ['Free orbit', 'Free orbit'], ...Object.keys(SCENES[cur].cams).map(k => [k, k])], setCam);
  refreshChips();
}
function refreshChips() {
  const mark = (id, val) => document.querySelectorAll('#' + id + ' button').forEach(b => { const on = b.dataset.k === String(val); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  mark('cWeather', st.weather); mark('cSeason', st.season); mark('cCam', st.cam); mark('cQual', st.quality); mark('cView', viewMode);
  mark('cTod', st.tod === null ? 'film' : (TOD_PRESETS.find(p => +p[0] === st.tod) || [''])[0]);
}
const hhmm = h => { const m = Math.round((h % 24) * 60); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const period = h => h < 4.5 || h >= 21 ? 'Night' : h < 7.5 ? 'Dawn' : h < 11 ? 'Morning' : h < 14 ? 'Midday' : h < 17.5 ? 'Afternoon' : 'Dusk';
function updateHud() {
  const h = st.tod ?? (st.weather !== 'film' ? SCENES[cur].hour : null);
  $('todOut').textContent = st.tod === null ? (h === null ? 'as filmed' : 'default ' + hhmm(h)) : hhmm(st.tod) + ' · ' + period(st.tod);
  if (st.tod !== null) $('tod').value = st.tod; else if (h !== null) $('tod').value = h;
  $('seasonHint').textContent = st.season === 'film' ? '' : SEASONS[st.season].name;
  const parts = [SCENES[cur].label, SEASONS[st.season].name, WEATHER[st.weather].name, st.tod === null ? (h === null ? 'time as filmed' : hhmm(h)) : hhmm(st.tod)];
  $('chip').textContent = parts.join(' · ');
  writeHash();
}
function writeHash() {
  const p = new URLSearchParams({ s: cur, w: st.weather, z: st.season }); if (st.tod !== null) p.set('h', st.tod.toFixed(1));
  history.replaceState(null, '', '#' + p.toString());
}
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (SCENES[p.get('s')]) st.scene = p.get('s');
  if (p.get('c')) st.cam = p.get('c');
  if (WEATHER[p.get('w')]) st.weather = p.get('w');
  if (SEASONS[p.get('z')]) st.season = p.get('z');
  const h = parseFloat(p.get('h')); if (!isNaN(h) && h >= 0 && h <= 24) st.tod = h;
}

mkChips('cWeather', Object.entries(WEATHER).map(([k, v]) => [k, v.name]), k => { st.weather = k; if (k === 'storm' && nextBolt > 2) nextBolt = 1.5; applyLook(); });
mkChips('cSeason', Object.entries(SEASONS).map(([k, v]) => [k, v.name.replace(' (Passover)', '')]), k => { st.season = k; applyLook(); });
mkChips('cTod', TOD_PRESETS, k => { st.tod = k === 'film' ? null : +k; applyLook(); });
mkChips('cView', [['solid', 'Solid'], ['wire', 'Wireframe'], ['xray', 'X-ray']], k => { viewMode = k; applyView(); });
mkChips('cQual', Object.keys(QUAL).map(k => [k, k]), k => { st.quality = k; resize(); });
$('tod').oninput = e => { st.tod = +e.target.value; applyLook(); refreshChips(); };

const BTN = { tabernacle: 'bTab', solomon: 'bSol', herod: 'bHer' }, ALLB = Object.values(BTN);
function tab(id, group) { group.forEach(g => $(g).classList.toggle('on', g === id)); }
const goScene = key => { tab(BTN[key], ALLB); return load(key).catch(e => { $('load').style.display = 'grid'; $('load').textContent = 'Could not load the scene: ' + e.message; }); };
Object.entries(BTN).forEach(([k, id]) => $(id).onclick = () => goScene(k));

let hudWanted = innerWidth >= 900;
function setHud(open) {
  $('hud').classList.toggle('closed', !open); document.body.classList.toggle('hudopen', open);
  $('bHud').classList.toggle('on', open); $('bHud').setAttribute('aria-expanded', open);
}
$('bHud').onclick = () => { hudWanted = $('hud').classList.contains('closed'); setHud(hudWanted); };
$('bV3').onclick = () => { mode3d = true; tab('bV3', ['bV3', 'bVV']); $('vid').pause(); $('vid').style.display = 'none'; $('foot').style.display = 'flex'; $('stage').style.display = 'block'; $('bHud').style.display = ''; $('chip').style.display = ''; setHud(hudWanted); note(''); };
$('bVV').onclick = () => { mode3d = false; tab('bVV', ['bV3', 'bVV']); $('stage').style.display = 'none'; $('vid').style.display = 'block'; $('vid').play().catch(() => {}); $('foot').style.display = 'none'; $('bHud').style.display = 'none'; $('chip').style.display = 'none'; setHud(false); };
$('bPlay').onclick = () => { playing = !playing; $('bPlay').textContent = playing ? 'Pause' : 'Play'; };
$('seek').oninput = e => { t = e.target.value / 1000 * dur; playing = false; $('bPlay').textContent = 'Play'; };
$('kAuto').onchange = e => { st.auto = e.target.checked; if (st.auto && useFilm) setCam('Free orbit'); };
$('kClouds').onchange = e => { st.clouds = e.target.checked; applyLook(); };
$('kRays').onchange = e => { st.rays = e.target.checked; applyLook(); };
$('kSound').onchange = e => { st.sound = e.target.checked; if (st.sound) startAudio(); audioLevels(); };
$('bShot').onclick = () => { shotReq = true; };
$('bFull').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
if (!document.documentElement.requestFullscreen) $('bFull').style.display = 'none';
$('bLink').onclick = async () => { writeHash(); try { await navigator.clipboard.writeText(location.href); $('bLink').textContent = 'Copied'; } catch { $('bLink').textContent = 'Copy from address bar'; } setTimeout(() => $('bLink').textContent = 'Copy link', 1800); };
$('bReset').onclick = () => { Object.assign(st, { weather: 'film', season: 'film', tod: null, rays: true, clouds: true, auto: false }); ['kClouds', 'kRays'].forEach(i => $(i).checked = true); $('kAuto').checked = false; setCam('Film camera'); applyLook(); };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return;
  if (e.code === 'Space') { e.preventDefault(); $('bPlay').click(); }
  else if (e.key === 'h' || e.key === 'H') $('bHud').click();
  else if (e.key === 'f' || e.key === 'F') $('bFull').click();
});
matchMedia('(min-width:900px)').addEventListener('change', e => { hudWanted = e.matches; if (mode3d) setHud(hudWanted); });

readHash(); setHud(hudWanted); tab(BTN[st.scene], ALLB);
load(st.scene).then(tick).catch(e => { $('load').textContent = 'Could not load the scene: ' + e.message; });
