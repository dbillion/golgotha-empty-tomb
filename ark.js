/* Detailed Ark of the Covenant for the Tabernacle scene (Exodus 25:10-22). Built from the reference analysis in ark-i2t/image-analysis.md.
   Local frame matches the GLB: long axis = z, staves run along z, cherubim stand on the lid ends facing each other, y up. Origin = floor under the Ark. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function hammered() {   // beaten-gold bump map
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  let s = 12345; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) {
    const x = r() * 256, y = r() * 256, rad = 4 + r() * 12, gr = g.createRadialGradient(x, y, 0, x, y, rad), l = r() > 0.5;
    gr.addColorStop(0, l ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.16)'); gr.addColorStop(1, 'rgba(128,128,128,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
}

export function buildArk(env, baseY) {
  const G = new THREE.Group(); G.name = 'ArkDetailed';
  const bump = hammered();
  const gm = (color, rough, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rough, envMap: env, envMapIntensity: 1.3, bumpMap: bump, bumpScale: 0.5, emissive: 0x5a3808, emissiveIntensity: 0.35, ...extra });
  const gold = gm(0xe0a940, 0.26), bright = gm(0xf4c866, 0.17), deep = gm(0xb07a20, 0.4), side = gm(0xe9b84f, 0.22, { side: THREE.DoubleSide });
  const stone = new THREE.MeshStandardMaterial({ color: 0x8c7b66, roughness: 0.92, metalness: 0 });
  const rbox = (w, h, d, m, x, y, z, rad = 0.012) => { const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(rad, w / 2.1, h / 2.1, d / 2.1)), m); o.position.set(x, y, z); G.add(o); return o; };

  const L = 1.14, W = 0.68, H = 0.6, FOOT = 0.07, SLAB = 0.07;
  const yb = baseY + SLAB;                       // underside of the feet
  rbox(1.25, SLAB, 1.7, stone, 0, baseY + SLAB / 2, 0, 0.02);   // stone plinth under the Ark
  const yBody = yb + FOOT + H / 2, yTop = yb + FOOT + H;

  /* body, feet */
  rbox(W, H, L, gold, 0, yBody, 0, 0.014);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rbox(0.09, FOOT + 0.02, 0.09, deep, sx * (W / 2 - 0.035), yb + FOOT / 2, sz * (L / 2 - 0.035), 0.01);

  /* recessed panels with a bevelled border on all four faces */
  const panel = (a, b) => {
    const p = new THREE.Group(), t = 0.03, d = 0.016;
    [[0, b / 2 - t / 2, a, t], [0, -b / 2 + t / 2, a, t], [-a / 2 + t / 2, 0, t, b - 2 * t], [a / 2 - t / 2, 0, t, b - 2 * t]].forEach(([x, y, w, h]) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.006), bright); m.position.set(x, y, d / 2); p.add(m);
    });
    const inner = new THREE.Mesh(new THREE.BoxGeometry(a - 2 * t, b - 2 * t, 0.006), deep); inner.position.z = 0.003; p.add(inner);
    return p;
  };
  const face = (a, b, x, z, ry) => { const p = panel(a, b); p.position.set(x, yBody - 0.015, z); p.rotation.y = ry; G.add(p); };
  face(L - 0.2, H - 0.2, W / 2, 0, Math.PI / 2); face(L - 0.2, H - 0.2, -W / 2, 0, -Math.PI / 2);
  face(W - 0.16, H - 0.2, 0, L / 2, 0);          face(W - 0.16, H - 0.2, 0, -L / 2, Math.PI);

  /* stepped crown moulding round the top, then the lid (mercy seat) */
  rbox(W + 0.03, 0.026, L + 0.03, deep, 0, yTop + 0.013, 0, 0.008);
  rbox(W + 0.075, 0.03, L + 0.075, bright, 0, yTop + 0.04, 0, 0.012);
  rbox(W + 0.03, 0.02, L + 0.03, gold, 0, yTop + 0.065, 0, 0.008);
  rbox(W - 0.02, 0.022, L - 0.02, bright, 0, yTop + 0.086, 0, 0.01);
  const lidTop = yTop + 0.097;

  /* four rings and two staves running through them, standing out past both ends */
  const yR = yb + FOOT + H * 0.8, xR = W / 2 + 0.07, zR = L / 2 - 0.14;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.013, 10, 24), bright); ring.position.set(sx * xR, yR, sz * zR); G.add(ring);
      rbox(0.07, 0.034, 0.05, gold, sx * (W / 2 + 0.032), yR, sz * zR, 0.008);   // lug joining ring to body
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, L + 1.0, 14), bright); pole.rotation.x = Math.PI / 2; pole.position.set(sx * xR, yR, 0); G.add(pole);
    for (const sz of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), gold); k.position.set(sx * xR, yR, sz * (L / 2 + 0.5)); G.add(k); }
  }

  /* wings: arched ribbons with stepped feather layers, meeting above the lid centre */
  const APEX = 0.92;
  const arch = (x0, sign) => new THREE.CubicBezierCurve3(
    new THREE.Vector3(x0, 0.30, 0.04), new THREE.Vector3(x0 + sign * 0.03, 0.72, 0.05),
    new THREE.Vector3(x0 - sign * 0.02, APEX + 0.04, -0.2), new THREE.Vector3(x0 * 0.3, APEX, -0.42));
  const ribbon = (curve, u1, w0, w1, sign, drop) => {
    const N = 28, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N * u1, p = curve.getPoint(u), w = (w0 + (w1 - w0) * (u / u1)) * Math.sin(Math.PI * (0.18 + 0.82 * (1 - i / N * 0.9)));
      pos.push(p.x, p.y - drop, p.z, p.x + sign * w, p.y - drop - 0.35 * w, p.z + 0.12 * w);
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return new THREE.Mesh(geo, side);
  };
  const cherub = zSide => {
    const c = new THREE.Group(); c.position.set(0, lidTop, zSide * (L / 2 - 0.15)); c.rotation.y = zSide > 0 ? 0 : Math.PI;   // local -z faces the lid centre
    /* kneeling robed body, head bowed toward the mercy seat, arms forward */
    const prof = [[0.01, 0], [0.13, 0.01], [0.115, 0.1], [0.085, 0.24], [0.075, 0.31], [0.03, 0.34], [0.001, 0.35]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), gold); c.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.052, 18, 14), bright); head.position.set(0, 0.4, -0.025); c.add(head);
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.014, 0.17, 8), gold); arm.position.set(sx * 0.07, 0.22, -0.07); arm.rotation.x = -1.0; c.add(arm);
      const x0 = sx * 0.075, curve = arch(x0, sx);
      c.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.009, 6), bright));     // leading-edge spar
      for (let k = 0; k < 4; k++) {   // feather layers, each a little shorter and lower than the one above
        const cur = arch(x0, sx), rb = ribbon(cur, 1 - 0.1 * k, 0.17 - 0.012 * k, 0.07, sx, 0.045 * k); rb.material = k % 2 ? gold : side; c.add(rb);
      }
    }
    return c;
  };
  G.add(cherub(1), cherub(-1));
  return { group: G, lidTop, apex: lidTop + APEX };
}
