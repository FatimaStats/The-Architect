// ---------------------------------------------------------------------------
// Rendering: a Three.js view of the engine state. The renderer never changes
// game state — it receives (prev, next, events) after each turn and animates
// the difference. Every animated property eases toward a target, so the view
// always converges on the authoritative state even if animations are skipped.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { idx, ix, iy } from '../engine/level.js';
import { DIRS, footprint } from '../engine/physics.js';
import {
  doorOpen, bridgeSolid, lockOpen, elevatorHeight, mirrorOrient, platformCell, isPressed,
} from '../engine/mechanics.js';
import { PALETTE } from './palette.js';

const TILE = 0.94;
const SLAB = 0.32;
const ROLL_MS = 170;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// ----- shared geometry --------------------------------------------------------
const G = {};
function geo() {
  if (G.ready) return G;
  G.ready = true;
  G.bar = new RoundedBoxGeometry(0.96, 1.96, 0.96, 3, 0.07);
  G.cube = new RoundedBoxGeometry(0.9, 0.9, 0.9, 3, 0.08);
  G.inset = new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2);
  G.plate = new THREE.CylinderGeometry(0.3, 0.32, 0.06, 40);
  G.switchBase = new RoundedBoxGeometry(0.56, 0.08, 0.56, 2, 0.03);
  G.gate = new RoundedBoxGeometry(0.9, 1.25, 0.9, 2, 0.04).translate(0, 0.625, 0);
  G.pillar = new RoundedBoxGeometry(0.9, 1.1, 0.9, 2, 0.05).translate(0, 0.55, 0);
  G.key = new THREE.OctahedronGeometry(0.27, 0);
  G.ring = new THREE.TorusGeometry(0.3, 0.035, 12, 48).rotateX(Math.PI / 2);
  G.ring2 = new THREE.TorusGeometry(0.2, 0.02, 10, 40).rotateX(Math.PI / 2);
  G.mirror = new THREE.BoxGeometry(1.1, 0.75, 0.05).translate(0, 0.55, 0);
  G.lens = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 24).rotateX(Math.PI / 2);
  G.crystal = new THREE.OctahedronGeometry(0.2, 0).scale(1, 1.6, 1);
  G.beam = new THREE.BoxGeometry(1, 1, 1);
  G.marker = new THREE.ConeGeometry(0.12, 0.24, 4).rotateX(Math.PI);
  G.exitGlow = new THREE.CylinderGeometry(0.42, 0.42, 3, 32, 1, true).translate(0, 1.5, 0);
  G.rail = new THREE.BoxGeometry(0.06, 0.04, 1);
  const chev = new THREE.Shape();
  chev.moveTo(-0.22, -0.12);
  chev.lineTo(0, 0.1);
  chev.lineTo(0.22, -0.12);
  chev.lineTo(0.22, -0.02);
  chev.lineTo(0, 0.2);
  chev.lineTo(-0.22, -0.02);
  chev.closePath();
  G.chevron = new THREE.ShapeGeometry(chev).rotateX(-Math.PI / 2);
  const cross = new THREE.Shape();
  const a = 0.2;
  const w = 0.045;
  cross.moveTo(-a, -a + w);
  cross.lineTo(-w, 0);
  cross.lineTo(-a, a - w);
  cross.lineTo(-a + w, a);
  cross.lineTo(0, w);
  cross.lineTo(a - w, a);
  cross.lineTo(a, a - w);
  cross.lineTo(w, 0);
  cross.lineTo(a, -a + w);
  cross.lineTo(a - w, -a);
  cross.lineTo(0, -w);
  cross.lineTo(-a + w, -a);
  cross.closePath();
  G.cross = new THREE.ShapeGeometry(cross).rotateX(-Math.PI / 2);
  G.slabs = new Map();
  return G;
}
function slab(height) {
  const g = geo();
  const k = height.toFixed(2);
  if (!g.slabs.has(k)) g.slabs.set(k, new RoundedBoxGeometry(TILE, height, TILE, 2, 0.035).translate(0, -height / 2, 0));
  return g.slabs.get(k);
}

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.05, ...o });
const glow = (color, opacity = 0.9) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });

// ----- pose helpers -------------------------------------------------------------
function blockTransform(b) {
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  if (b.o === 'X') {
    pos.set(b.x + 0.5, b.z + 0.5, b.y);
    quat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  } else if (b.o === 'Y') {
    pos.set(b.x, b.z + 0.5, b.y + 0.5);
    quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  } else if (b.o === 'C') {
    pos.set(b.x, b.z + 0.45, b.y);
  } else {
    pos.set(b.x, b.z + 1, b.y);
  }
  return { pos, quat };
}

export class Renderer {
  constructor(container, { onSound } = {}) {
    this.container = container;
    this.onSound = onSound || (() => {});
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'stage-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.bg);
    this.scene.fog = new THREE.Fog(PALETTE.bg, 18, 60);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

    this.scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x14161b, 0.9));
    const key = new THREE.DirectionalLight(0xfff1dd, 2.1);
    key.position.set(-6, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    this.key = key;
    this.scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0x8fb4ff, 0.6);
    rim.position.set(8, 6, -10);
    this.scene.add(rim);

    // Laboratory floor: a faint grid far below the structure.
    const grid = new THREE.GridHelper(240, 240, PALETTE.grid, PALETTE.grid);
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    grid.position.y = -4;
    this.scene.add(grid);
    this.grid = grid;

    // Suspended dust.
    const n = 400;
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pts[i * 3] = (Math.random() - 0.5) * 50;
      pts[i * 3 + 1] = Math.random() * 14 - 3;
      pts[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    this.dust = new THREE.Points(
      dg,
      new THREE.PointsMaterial({ color: 0x9fb0c8, size: 0.05, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.scene.add(this.dust);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.movers = new Set();
    this.timeline = [];
    this.pendingState = null;
    this.time = 0;
    this.clock = new THREE.Clock();
    this.activeBlock = 0;
    this.dim = false;

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  get canvas() {
    return this.renderer.domElement;
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.level) this.frameCamera();
  }

  // ----- level construction ------------------------------------------------------
  clear() {
    this.root.clear();
    this.movers.clear();
    this.timeline = [];
    this.tileViews = new Map();
    this.platformViews = [];
    this.rotorViews = [];
    this.blockViews = [];
    this.beamGroup = new THREE.Group();
    this.root.add(this.beamGroup);
  }

  loadLevel(level, state) {
    geo();
    this.clear();
    this.level = level;
    this.center = new THREE.Vector3((level.width - 1) / 2, 0, (level.height - 1) / 2);
    this.root.position.set(-this.center.x, 0, -this.center.z);

    for (const t of level.tiles.values()) this.buildTile(t);
    level.platforms.forEach((p) => this.buildPlatform(p));
    level.rotors.forEach((r) => this.buildRotor(r));
    state.blocks.forEach((b, n) => this.buildBlock(b, n));

    this.marker = new THREE.Mesh(geo().marker, glow(PALETTE.brass, 0.95));
    this.root.add(this.marker);

    this.frameCamera();
    this.state = state;
    this.applyState(state, true);

    // Construction reveal: tiles rise into place, nearest-first.
    const now = this.time;
    for (const v of this.tileViews.values()) {
      const d = Math.hypot(v.tile.x - this.center.x, v.tile.y - this.center.z);
      v.group.position.y -= 5;
      this.moveTo(v.group, { pos: v.group.position.clone().setY(v.group.position.y + 5), delay: now + 0.1 + d * 0.035, speed: 7 });
    }
    for (const bv of this.blockViews) {
      const t = bv.mesh.userData.tPos.clone();
      bv.mesh.position.y += 6;
      this.moveTo(bv.mesh, { pos: t, delay: now + 0.55, speed: 7 });
    }
  }

  frameCamera() {
    const L = this.level;
    const span = Math.max(L.width, L.height * 1.15, 6);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const aspectFit = Math.min(1, this.camera.aspect * 0.95);
    const dist = (span * 0.54) / Math.tan(fov / 2) / aspectFit + 4;
    const yaw = 0.32;
    const pitch = 0.92; // radians above horizon
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    this.camera.position.copy(dir.multiplyScalar(dist));
    this.camera.lookAt(0, 0, 0.3);
    this.camera.updateMatrixWorld();
    this.scene.fog.near = dist * 0.9;
    this.scene.fog.far = dist * 2.4;
    const s = Math.max(L.width, L.height) * 0.75 + 4;
    Object.assign(this.key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 60 });
    this.key.shadow.camera.updateProjectionMatrix();
  }

  addTileMesh(group, geometry, material, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    group.add(m);
    return m;
  }

  buildTile(t) {
    const g = geo();
    const group = new THREE.Group();
    group.position.set(t.x, t.h, t.y);
    this.root.add(group);
    const view = { tile: t, group, parts: {} };
    const checker = (t.x + t.y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
    const baseColor = t.h > 0 ? PALETTE.terrace : checker;
    const base = (color = baseColor, opts) => {
      const m = this.addTileMesh(group, slab(SLAB + t.h), mat(color, opts));
      view.parts.base = m;
      return m;
    };
    const inset = (color = PALETTE.floorTop, opts = {}) => {
      const m = this.addTileMesh(group, g.inset, mat(color, { roughness: 0.9, ...opts }), { cast: false });
      m.position.y = 0.002;
      view.parts.inset = m;
      return m;
    };

    switch (t.type) {
      case 'floor':
        base();
        inset();
        break;
      case 'rail': {
        for (const off of [-0.22, 0.22]) {
          const r = this.addTileMesh(group, g.rail, mat(0x1c2027, { metalness: 0.6, roughness: 0.4 }), { cast: false });
          r.position.set(off, -0.28, 0);
          const horiz = this.level.platforms.some((p) => p.path.includes(t.i) && p.path.some((c) => iy(c) === t.y && c !== t.i));
          if (horiz) {
            r.rotation.y = Math.PI / 2;
            r.position.set(0, -0.28, off);
          }
        }
        break;
      }
      case 'exit': {
        base(0x1b1f26);
        const rimM = mat(0x0a0c10, { emissive: PALETTE.exit, emissiveIntensity: 0.9 });
        const frame = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 4, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), rimM);
        frame.position.y = 0.003;
        group.add(frame);
        const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x020304 }));
        hole.position.y = 0.004;
        group.add(hole);
        const beam = new THREE.Mesh(g.exitGlow, glow(PALETTE.exit, 0.07));
        group.add(beam);
        view.parts.glow = beam;
        view.parts.frame = frame;
        break;
      }
      case 'fragile': {
        base(PALETTE.fragile, { roughness: 0.6 });
        inset(0xd99a5a, { roughness: 0.7 });
        break;
      }
      case 'crumble': {
        const m = base(PALETTE.crumble, { transparent: true, opacity: 0.5 });
        m.castShadow = false;
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slab(SLAB + t.h), 30), new THREE.LineBasicMaterial({ color: 0xc9d2e0, transparent: true, opacity: 0.8 }));
        group.add(edges);
        break;
      }
      case 'oneway': {
        base();
        inset();
        const angle = { N: 0, W: Math.PI / 2, S: Math.PI, E: -Math.PI / 2 }[t.dir];
        for (const off of [-0.16, 0.12]) {
          const c = new THREE.Mesh(g.chevron, mat(0x000000, { emissive: PALETTE.oneway, emissiveIntensity: 1.1 }));
          c.position.set(0, 0.006, 0);
          c.rotation.y = angle;
          c.translateZ(-off);
          group.add(c);
        }
        break;
      }
      case 'gravity': {
        base(0x2b2f4a);
        inset(0x33385a);
        const angle = { N: 0, W: Math.PI / 2, S: Math.PI, E: -Math.PI / 2 }[t.dir];
        view.parts.chevrons = [0, 1].map((n) => {
          const c = new THREE.Mesh(g.chevron, glow(PALETTE.gravity, 0.8));
          c.position.y = 0.006;
          c.rotation.y = angle;
          c.userData.phase = n * 0.5;
          c.userData.dir = DIRS[t.dir];
          group.add(c);
          return c;
        });
        break;
      }
      case 'plate': {
        base();
        inset();
        const p = this.addTileMesh(group, g.plate, mat(PALETTE.plate, { roughness: 0.4, metalness: 0.2, emissive: PALETTE.plateOn, emissiveIntensity: 0 }));
        p.position.y = 0.03;
        view.parts.plate = p;
        break;
      }
      case 'switch': {
        base();
        inset();
        const b = this.addTileMesh(group, g.switchBase, mat(PALETTE.switchOff, { roughness: 0.5, metalness: 0.3, emissive: PALETTE.switchOn, emissiveIntensity: 0 }));
        b.position.y = 0.04;
        view.parts.button = b;
        if (t.heavy) {
          const x = new THREE.Mesh(g.cross, mat(0x000000, { emissive: 0xffffff, emissiveIntensity: 0.6 }));
          x.position.y = 0.085;
          group.add(x);
        } else {
          const r = new THREE.Mesh(g.ring2, mat(0x000000, { emissive: 0xffffff, emissiveIntensity: 0.5 }));
          r.position.y = 0.085;
          group.add(r);
        }
        break;
      }
      case 'door': {
        base();
        inset();
        const gate = this.addTileMesh(group, g.gate, new THREE.MeshPhysicalMaterial({
          color: PALETTE.door, transparent: true, opacity: 0.38, roughness: 0.15, metalness: 0.1,
          emissive: PALETTE.door, emissiveIntensity: 0.25, depthWrite: false,
        }), { receive: false });
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(g.gate, 30), new THREE.LineBasicMaterial({ color: 0xcfe6ff }));
        gate.add(e);
        view.parts.gate = gate;
        break;
      }
      case 'lock': {
        base();
        inset();
        const gate = this.addTileMesh(group, g.gate, mat(PALETTE.lock, { roughness: 0.5, metalness: 0.5 }));
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.1, 0.92), mat(0x000000, { emissive: PALETTE.key, emissiveIntensity: 0.8 }));
        band.position.y = 0.95;
        gate.add(band);
        view.parts.gate = gate;
        break;
      }
      case 'key': {
        base();
        inset();
        const k = new THREE.Mesh(g.key, mat(PALETTE.key, { metalness: 0.8, roughness: 0.25, emissive: PALETTE.key, emissiveIntensity: 0.35 }));
        k.position.y = 0.55;
        k.castShadow = true;
        group.add(k);
        view.parts.key = k;
        break;
      }
      case 'bridge': {
        base(PALETTE.bridge);
        inset(0x434b5c);
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(slab(SLAB + t.h), 30), new THREE.LineBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.5 }));
        group.add(e);
        break;
      }
      case 'teleporter': {
        base(0x252838);
        inset(0x2d3045);
        const r1 = new THREE.Mesh(g.ring, glow(PALETTE.teleporter, 0.95));
        r1.position.y = 0.03;
        const r2 = new THREE.Mesh(g.ring2, glow(PALETTE.teleporter, 0.7));
        r2.position.y = 0.12;
        group.add(r1, r2);
        view.parts.rings = [r1, r2];
        break;
      }
      case 'elevator': {
        const col = SLAB + t.high + 0.001;
        const m = this.addTileMesh(group, slab(col), mat(PALETTE.elevator, { roughness: 0.6, metalness: 0.2 }));
        view.parts.base = m;
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(slab(col), 30), new THREE.LineBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.55 }));
        group.add(e);
        inset(0x4a5262);
        group.position.y = t.low;
        break;
      }
      case 'wall': {
        base(PALETTE.wall);
        this.addTileMesh(group, g.pillar, mat(PALETTE.wall, { roughness: 0.9 }));
        break;
      }
      case 'emitter': {
        base();
        this.addTileMesh(group, g.pillar, mat(PALETTE.emitter, { roughness: 0.4, metalness: 0.6 }));
        const lens = new THREE.Mesh(g.lens, mat(0x000000, { emissive: PALETTE.laser, emissiveIntensity: 2 }));
        const d = DIRS[t.dir];
        lens.position.set(d.dx * 0.46, 0.45, d.dy * 0.46);
        lens.rotation.set(0, Math.atan2(d.dx, d.dy), 0);
        group.add(lens);
        break;
      }
      case 'mirror': {
        base();
        const post = this.addTileMesh(group, new THREE.CylinderGeometry(0.08, 0.1, 0.3, 16).translate(0, 0.15, 0), mat(0x1d2027, { metalness: 0.7 }));
        post.castShadow = true;
        const panel = this.addTileMesh(group, g.mirror, new THREE.MeshStandardMaterial({ color: PALETTE.mirror, metalness: 1, roughness: 0.08, emissive: 0x334055, emissiveIntensity: 0.4 }));
        view.parts.mirror = panel;
        break;
      }
      case 'receiver': {
        base();
        this.addTileMesh(group, g.pillar.clone().scale(0.8, 0.55, 0.8), mat(PALETTE.emitter, { roughness: 0.4, metalness: 0.6 }));
        const c = new THREE.Mesh(g.crystal, mat(PALETTE.receiver, { emissive: PALETTE.receiverOn, emissiveIntensity: 0, roughness: 0.2 }));
        c.position.y = 0.95;
        c.castShadow = true;
        group.add(c);
        view.parts.crystal = c;
        break;
      }
      default:
        base();
        inset();
    }
    this.tileViews.set(t.i, view);
  }

  buildPlatform(p) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(slab(SLAB), mat(PALETTE.platform, { roughness: 0.5, metalness: 0.35 }));
    base.castShadow = base.receiveShadow = true;
    const inset = new THREE.Mesh(geo().inset, mat(0x555e6f, { roughness: 0.7 }));
    inset.position.y = 0.003;
    inset.receiveShadow = true;
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(slab(SLAB), 30), new THREE.LineBasicMaterial({ color: PALETTE.brass }));
    group.add(base, inset, edge);
    this.root.add(group);
    this.platformViews[p.id] = { group };
  }

  buildRotor(r) {
    const group = new THREE.Group();
    group.position.set(r.cx, r.h, r.cy);
    [[0, 0], ...r.arms].forEach(([dx, dy], n) => {
      const m = new THREE.Mesh(slab(SLAB), mat(n === 0 ? 0x3f4656 : PALETTE.platform, { roughness: 0.55, metalness: 0.3 }));
      m.position.set(dx, 0, dy);
      m.castShadow = m.receiveShadow = true;
      const inset = new THREE.Mesh(geo().inset, mat(0x555e6f, { roughness: 0.7 }));
      inset.position.set(dx, 0.003, dy);
      inset.receiveShadow = true;
      group.add(m, inset);
    });
    const hub = new THREE.Mesh(geo().ring2, glow(PALETTE.brass, 0.9));
    hub.position.y = 0.01;
    group.add(hub);
    this.root.add(group);
    this.rotorViews[r.id] = { group, angle: 0 };
  }

  buildBlock(b, n) {
    const isCube = b.o === 'C';
    const m = new THREE.Mesh(
      isCube ? geo().cube : geo().bar,
      new THREE.MeshPhysicalMaterial({
        color: isCube ? PALETTE.cube : PALETTE.bar,
        roughness: 0.38,
        metalness: 0.02,
        clearcoat: 0.6,
        clearcoatRoughness: 0.35,
        emissive: isCube ? 0x2a3a4d : 0x3a332a,
        emissiveIntensity: 0,
        transparent: true,
      }),
    );
    m.castShadow = true;
    m.receiveShadow = true;
    this.root.add(m);
    const { pos, quat } = blockTransform(b);
    m.position.copy(pos);
    m.quaternion.copy(quat);
    this.blockViews[n] = { mesh: m };
  }

  // ----- target-based easing --------------------------------------------------------
  moveTo(obj, { pos, quat, scale, delay = 0, speed = 14 }) {
    const u = obj.userData;
    if (pos) u.tPos = pos.clone();
    if (quat) u.tQuat = quat.clone();
    if (scale) u.tScale = scale.clone();
    u.delay = delay;
    u.speed = speed;
    this.movers.add(obj);
  }

  snap(obj) {
    const u = obj.userData;
    if (u.tPos) obj.position.copy(u.tPos);
    if (u.tQuat) obj.quaternion.copy(u.tQuat);
    if (u.tScale) obj.scale.copy(u.tScale);
    this.movers.delete(obj);
  }

  // ----- apply authoritative state -------------------------------------------------------
  applyState(s, instant = false, { skipBlocks = false } = {}) {
    this.state = s;
    const L = this.level;
    const V3 = THREE.Vector3;

    for (const v of this.tileViews.values()) {
      const t = v.tile;
      const home = new V3(t.x, t.h, t.y);
      let scale = new V3(1, 1, 1);
      if (t.type === 'elevator') home.y = elevatorHeight(s, t);
      if (s.gone.includes(t.i)) {
        home.y -= 7;
        scale = new V3(0.85, 0.85, 0.85);
      }
      if (t.type === 'bridge' && !bridgeSolid(s, t)) scale = new V3(0.02, 1, 0.02);
      this.moveTo(v.group, { pos: home, scale });

      if (v.parts.gate) {
        const open = t.type === 'door' ? doorOpen(s, t) : lockOpen(L, s, t);
        this.moveTo(v.parts.gate, { scale: new V3(1, open ? 0.02 : 1, 1), speed: 10 });
        v.parts.gate.visible = true;
        v.parts.gate.userData.open = open;
      }
      if (v.parts.plate) {
        const on = isPressed(s, t);
        v.parts.plate.material.emissiveIntensity = on ? 0.9 : 0;
        this.moveTo(v.parts.plate, { pos: new V3(0, on ? 0.005 : 0.03, 0) });
      }
      if (v.parts.button) {
        const on = !!s.toggles[t.signal];
        v.parts.button.material.emissiveIntensity = on ? 1.1 : 0;
        v.parts.button.material.color.setHex(on ? 0x8a7650 : PALETTE.switchOff);
        const pressed = s.swPressed.includes(t.i);
        this.moveTo(v.parts.button, { pos: new V3(0, pressed ? 0.01 : 0.04, 0) });
      }
      if (v.parts.key) {
        const got = s.keys.includes(t.i);
        this.moveTo(v.parts.key, { scale: got ? new V3(0.001, 0.001, 0.001) : new V3(1, 1, 1), speed: 8 });
      }
      if (v.parts.mirror) {
        const o = mirrorOrient(s, t);
        const q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), o === '/' ? Math.PI / 4 : -Math.PI / 4);
        this.moveTo(v.parts.mirror, { quat: q, speed: 9 });
      }
      if (v.parts.crystal) {
        const lit = s.beam.lit.includes(t.i);
        v.parts.crystal.material.emissiveIntensity = lit ? 2.2 : 0;
      }
    }

    L.platforms.forEach((p) => {
      const c = platformCell(p, s.plats[p.id]);
      this.moveTo(this.platformViews[p.id].group, { pos: new V3(ix(c), p.h, iy(c)), speed: 12 });
    });
    L.rotors.forEach((r) => {
      const rv = this.rotorViews[r.id];
      const target = -s.rotors[r.id].rot * (Math.PI / 2);
      // keep the angle continuous so rotations always turn clockwise
      let a = target;
      while (a > rv.angle + 1e-6) a -= Math.PI * 2;
      if (rv.angle - a > Math.PI) a += Math.PI * 2;
      rv.angle = a;
      this.moveTo(rv.group, { quat: new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), a), speed: 12 });
    });

    if (!skipBlocks) {
      s.blocks.forEach((b, n) => {
        const bv = this.blockViews[n];
        const { pos, quat } = blockTransform(b);
        bv.mesh.visible = true;
        bv.mesh.material.opacity = 1;
        this.moveTo(bv.mesh, { pos, quat, scale: new V3(1, 1, 1), speed: 13 });
      });
    }
    this.rebuildBeams(s);
    if (instant) for (const o of [...this.movers]) this.snap(o);
  }

  rebuildBeams(s) {
    this.beamGroup.clear();
    for (const path of s.beam.paths) {
      const y = path.h + 0.45;
      for (let n = 0; n < path.pts.length - 1; n++) {
        const [x1, z1] = path.pts[n];
        const [x2, z2] = path.pts[n + 1];
        const len = Math.hypot(x2 - x1, z2 - z1);
        if (len < 0.01) continue;
        const mid = new THREE.Vector3((x1 + x2) / 2, y, (z1 + z2) / 2);
        const core = new THREE.Mesh(geo().beam, glow(0xffd0d5, 0.95));
        const halo = new THREE.Mesh(geo().beam, glow(PALETTE.laser, 0.28));
        const along = Math.abs(x2 - x1) > Math.abs(z2 - z1);
        core.scale.set(along ? len : 0.04, 0.04, along ? 0.04 : len);
        halo.scale.set(along ? len : 0.2, 0.2, along ? 0.2 : len);
        core.position.copy(mid);
        halo.position.copy(mid);
        halo.userData.halo = true;
        this.beamGroup.add(core, halo);
      }
    }
  }

  // ----- turn animation ---------------------------------------------------------
  /** Animate the transition prev -> next. */
  playTurn(prev, next, events) {
    this.finish();
    this.pendingState = next;
    const tl = [];
    for (const e of events) {
      if (e.type === 'roll') tl.push(this.rollItem(e));
      else if (e.type === 'teleport') tl.push(this.teleportItem(e));
      else if (e.type === 'fall') tl.push(this.fallItem(e, next));
    }
    tl.push({
      dur: 0,
      start: () => {
        this.applyState(next, false, { skipBlocks: next.status === 'lost' });
        if (next.status === 'lost') {
          // keep fallen block hidden, others to their poses
          next.blocks.forEach((b, n) => {
            if (n === next.lost.b) return;
            const { pos, quat } = blockTransform(b);
            this.moveTo(this.blockViews[n].mesh, { pos, quat });
          });
        }
        for (const e of events) this.soundFor(e);
      },
    });
    if (next.status === 'won') tl.push(this.winItem(next));
    this.timeline = tl;
    this.timelineStart = null;
  }

  soundFor(e) {
    const map = { switch: 'switch', teleport: 'teleport', key: 'key', crumble: 'crumble', break: 'break', elevator: 'lift', platform: null, rotor: 'rotor', won: 'win' };
    if (map[e.type]) this.onSound(map[e.type]);
  }

  rollItem(e) {
    const bv = this.blockViews[e.b];
    const mesh = bv.mesh;
    let pivot;
    const from = blockTransform(e.from);
    const d = DIRS[e.dir];
    const cells = footprint(e.from);
    const xs = cells.map((c) => c[0]);
    const ys = cells.map((c) => c[1]);
    const edge = new THREE.Vector3(
      d.dx > 0 ? Math.max(...xs) + 0.5 : d.dx < 0 ? Math.min(...xs) - 0.5 : from.pos.x,
      e.from.z,
      d.dy > 0 ? Math.max(...ys) + 0.5 : d.dy < 0 ? Math.min(...ys) - 0.5 : from.pos.z,
    );
    const axis = new THREE.Vector3(d.dy, 0, -d.dx).normalize();
    const dur = e.cause === 'gravity' ? ROLL_MS * 0.8 : ROLL_MS;
    return {
      dur,
      start: () => {
        this.movers.delete(mesh);
        mesh.position.copy(from.pos);
        mesh.quaternion.copy(from.quat);
        pivot = new THREE.Object3D();
        pivot.position.copy(edge);
        this.root.add(pivot);
        pivot.attach(mesh);
        this.onSound(e.cause === 'gravity' ? 'drift' : e.to.o === 'U' ? 'stand' : 'roll');
      },
      update: (k) => pivot.quaternion.setFromAxisAngle(axis, ease(k) * (Math.PI / 2)),
      end: () => {
        this.root.attach(mesh);
        this.root.remove(pivot);
        const to = blockTransform({ ...e.to, z: e.from.z });
        mesh.position.copy(to.pos);
        mesh.quaternion.copy(to.quat);
        if (e.to.z !== e.from.z) this.moveTo(mesh, { pos: blockTransform(e.to).pos, speed: 16 });
      },
    };
  }

  teleportItem(e) {
    const mesh = this.blockViews[e.b].mesh;
    const a = blockTransform(e.from);
    const b = blockTransform(e.to);
    return {
      dur: 380,
      start: () => {
        this.movers.delete(mesh);
        this.onSound('teleport');
      },
      update: (k) => {
        if (k < 0.5) {
          const s = 1 - ease(k * 2);
          mesh.position.copy(a.pos).setY(a.pos.y + (1 - s) * 0.6);
          mesh.scale.set(s * 0.6 + 0.001, 1 + (1 - s) * 0.8, s * 0.6 + 0.001);
        } else {
          const s = ease((k - 0.5) * 2);
          mesh.position.copy(b.pos).setY(b.pos.y + (1 - s) * 0.6);
          mesh.scale.set(s + 0.001, 1 + (1 - s) * 0.8, s + 0.001);
        }
      },
      end: () => {
        mesh.position.copy(b.pos);
        mesh.scale.set(1, 1, 1);
      },
    };
  }

  fallItem(e) {
    const mesh = this.blockViews[e.b].mesh;
    let y0;
    const spin = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    return {
      dur: 900,
      start: () => {
        this.movers.delete(mesh);
        y0 = mesh.position.y;
        this.onSound('fall');
      },
      update: (k) => {
        mesh.position.y = y0 - 14 * k * k;
        mesh.rotateOnWorldAxis(spin, 0.03);
        mesh.material.opacity = 1 - k;
      },
      end: () => {
        mesh.visible = false;
      },
    };
  }

  winItem(s) {
    const n = s.blocks.findIndex((b) => b.prime);
    const mesh = this.blockViews[n].mesh;
    let y0;
    const exitView = this.tileViews.get(idx(s.blocks[n].x, s.blocks[n].y));
    return {
      dur: 900,
      start: () => {
        this.snap(mesh);
        y0 = mesh.position.y;
        this.onSound('win');
      },
      update: (k) => {
        mesh.position.y = y0 - 2.1 * ease(k);
        if (exitView?.parts.glow) exitView.parts.glow.material.opacity = 0.07 + Math.sin(k * Math.PI) * 0.35;
      },
      end: () => {
        mesh.visible = false;
      },
    };
  }

  /** Small tilt when a move is refused, so the player feels the obstacle. */
  bump(n, dir) {
    if (this.busy) return;
    const bv = this.blockViews[n];
    if (!bv || !this.state) return;
    const d = DIRS[dir];
    const mesh = bv.mesh;
    const base = blockTransform(this.state.blocks[n]);
    const axis = new THREE.Vector3(d.dy, 0, -d.dx).normalize();
    this.onSound('ui');
    this.timeline.push({
      dur: 160,
      start: () => this.movers.delete(mesh),
      update: (k) => {
        const a = Math.sin(k * Math.PI) * 0.06;
        mesh.quaternion.copy(base.quat).premultiply(new THREE.Quaternion().setFromAxisAngle(axis, a));
        mesh.position.copy(base.pos).addScaledVector(new THREE.Vector3(d.dx, 0, d.dy), a * 0.6);
      },
      end: () => {
        mesh.position.copy(base.pos);
        mesh.quaternion.copy(base.quat);
      },
    });
  }

  /** Complete any running animation immediately. */
  finish() {
    while (this.timeline.length) {
      const it = this.timeline.shift();
      if (!it._started) it.start?.();
      it.update?.(1);
      it.end?.();
    }
    for (const o of [...this.movers]) if (this.blockViews.some((b) => b.mesh === o)) this.snap(o);
  }

  get busy() {
    return this.timeline.length > 0;
  }

  /** Jump to a state without animating turns (undo / restart). */
  showState(s) {
    this.timeline = [];
    this.root.children.filter((c) => c.type === 'Object3D').forEach((p) => {
      p.children.forEach((ch) => this.root.attach(ch));
      this.root.remove(p);
    });
    this.blockViews.forEach((bv) => {
      bv.mesh.visible = true;
      bv.mesh.scale.set(1, 1, 1);
      bv.mesh.material.opacity = 1;
    });
    this.applyState(s, false);
    this.blockViews.forEach((bv) => (bv.mesh.userData.speed = 20));
  }

  setActiveBlock(n) {
    this.activeBlock = n;
  }

  // ----- screen <-> grid ------------------------------------------------------------
  /** Map a screen-space vector (x right, y up) to the closest grid direction. */
  vectorToGrid([vx, vy]) {
    const project = (x, z) => new THREE.Vector3(x, 0, z).add(this.root.position).project(this.camera);
    const c = this.center;
    const o = project(c.x, c.z);
    const ex = project(c.x + 1, c.z).sub(o);
    const ey = project(c.x, c.z + 1).sub(o);
    const a = this.camera.aspect;
    const cand = {
      E: [ex.x * a, ex.y],
      W: [-ex.x * a, -ex.y],
      S: [ey.x * a, ey.y],
      N: [-ey.x * a, -ey.y],
    };
    let best = null;
    let bestDot = -Infinity;
    for (const [k, [x, y]] of Object.entries(cand)) {
      const l = Math.hypot(x, y) || 1;
      const dot = (x * vx + y * vy) / l;
      if (dot > bestDot) {
        bestDot = dot;
        best = k;
      }
    }
    return best;
  }

  // ----- frame loop ---------------------------------------------------------------------
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    const now = performance.now();

    // timeline
    if (this.timeline.length) {
      const it = this.timeline[0];
      if (!it._started) {
        it._started = true;
        it._t0 = now;
        it.start?.();
      }
      const k = it.dur ? Math.min(1, (now - it._t0) / it.dur) : 1;
      it.update?.(k);
      if (k >= 1) {
        it.end?.();
        this.timeline.shift();
      }
    }

    // easing movers
    for (const o of this.movers) {
      const u = o.userData;
      if (u.delay && this.time < u.delay) continue;
      const f = 1 - Math.exp(-dt * (u.speed || 14));
      let done = true;
      if (u.tPos) {
        o.position.lerp(u.tPos, f);
        if (o.position.distanceToSquared(u.tPos) > 1e-6) done = false;
        else o.position.copy(u.tPos);
      }
      if (u.tQuat) {
        o.quaternion.slerp(u.tQuat, f);
        if (1 - Math.abs(o.quaternion.dot(u.tQuat)) > 1e-7) done = false;
        else o.quaternion.copy(u.tQuat);
      }
      if (u.tScale) {
        o.scale.lerp(u.tScale, f);
        if (o.scale.distanceToSquared(u.tScale) > 1e-6) done = false;
        else o.scale.copy(u.tScale);
      }
      if (done) this.movers.delete(o);
    }

    // ambient motion
    if (this.tileViews) {
      for (const v of this.tileViews.values()) {
        if (v.parts.key) {
          v.parts.key.rotation.y += dt * 1.2;
          v.parts.key.position.y = 0.55 + Math.sin(this.time * 2 + v.tile.x) * 0.05;
        }
        if (v.parts.rings) {
          v.parts.rings[0].rotation.y += dt * 0.8;
          v.parts.rings[1].position.y = 0.1 + ((this.time * 0.5) % 1) * 0.5;
          v.parts.rings[1].material.opacity = 0.7 * (1 - ((this.time * 0.5) % 1));
        }
        if (v.parts.chevrons) {
          for (const c of v.parts.chevrons) {
            const p = (this.time * 0.8 + c.userData.phase) % 1;
            c.position.x = c.userData.dir.dx * (p - 0.5) * 0.7;
            c.position.z = c.userData.dir.dy * (p - 0.5) * 0.7;
            c.material.opacity = Math.sin(p * Math.PI) * 0.9;
          }
        }
        if (v.parts.glow) v.parts.glow.material.opacity = 0.05 + Math.sin(this.time * 1.6) * 0.025 + 0.03;
        if (v.parts.frame) v.parts.frame.material.emissiveIntensity = 0.7 + Math.sin(this.time * 2) * 0.25;
      }
      for (const b of this.beamGroup.children) {
        if (b.userData.halo) b.material.opacity = 0.22 + Math.sin(this.time * 30 + b.position.x) * 0.04;
      }
      // active-block marker
      const multi = this.blockViews.length > 1;
      this.marker.visible = multi && !!this.blockViews[this.activeBlock]?.mesh.visible;
      if (this.marker.visible) {
        const m = this.blockViews[this.activeBlock].mesh;
        const box = new THREE.Box3().setFromObject(m);
        this.marker.position.set(m.position.x, box.max.y - this.root.position.y + 0.35 + Math.sin(this.time * 3) * 0.06, m.position.z);
        this.marker.rotation.y += dt * 2;
      }
      this.blockViews.forEach((bv, n) => {
        bv.mesh.material.emissiveIntensity = multi && n === this.activeBlock ? 0.35 : 0;
      });
    }

    const pos = this.dust.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * 0.08;
      if (y > 11) y = -3;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    this.dust.rotation.y += dt * 0.004;

    this.renderer.render(this.scene, this.camera);
  }
}
