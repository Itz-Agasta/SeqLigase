import * as THREE from "three";
import type { MoleculeRecord, ReconstructResponse } from "@/engine/types";
import { applyLook, type AtomHandle, type BuiltMolecule } from "./build-molecule";
import type { ScenePalette } from "./colors";
import { DEFAULT_LOOK } from "./look";

export interface Source {
  atomIndex: number | null;
  tokens: number[];
  position: THREE.Vector3;
  radius: number;
  color: string;
}

export interface PulsePath {
  atoms: number[];
  points: THREE.Vector3[];
}

interface CloudUniforms {
  [key: string]: THREE.IUniform;
  uT: { value: number };
  uD: { value: number };
  uC: { value: number };
  uSw: { value: number };
  uTi: { value: number };
  uB: { value: number };
  uR: { value: number };
  uPR: { value: number };
  uCol: { value: THREE.Color };
}

export interface Cloud {
  points: THREE.Points;
  uniforms: CloudUniforms;
  source: Source;
}

export interface Pulse {
  sprites: THREE.Sprite[];
  path: PulsePath;
  set: (p: number) => void;
  off: () => void;
}

export interface Rig {
  group: THREE.Group;
  before: BuiltMolecule;
  after: BuiltMolecule;
  sources: Source[];
  clouds: Cloud[];
  pulses: Pulse[];
  flashes: THREE.Sprite[];
  shocks: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[];
  rings: THREE.Line[];
  marks: THREE.Sprite[];
  scan: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  dust: { points: THREE.Points; uniforms: Record<string, THREE.IUniform> };
  state: { swirl: number; swirlSpeed: number; bloom: number; shake: number };
  camera: {
    x: number;
    y: number;
    z: number;
    tx: number;
    ty: number;
    tz: number;
    ox: number;
    oy: number;
  };
  framing: { hole: THREE.Vector3; dir: THREE.Vector3; fitDistance: number };
  palette: ScenePalette;
  tick: (camera: THREE.Camera, dt: number, elapsed: number) => void;
  dispose: () => void;
}

export function findSources(
  record: MoleculeRecord,
  before: BuiltMolecule,
  mask: number[],
): Source[] {
  const out: Source[] = [];
  const byBond = new Map<number, Source>();
  const handle = (i: number) => before.atoms.find((a) => a.index === i);
  for (const token of mask) {
    const atom = record.atomTokens.indexOf(token);
    const atomHandle = atom >= 0 ? handle(atom) : undefined;
    if (atomHandle) {
      out.push({
        atomIndex: atom,
        tokens: [token],
        position: atomHandle.position.clone(),
        radius: atomHandle.radius,
        color: "",
      });
      continue;
    }
    const bondIndex = record.tokenBond[String(token)];
    if (bondIndex === undefined) continue;
    const existing = byBond.get(bondIndex);
    if (existing) {
      existing.tokens.push(token);
      continue;
    }
    const bond = record.bonds[bondIndex];
    const a = handle(bond.a);
    const b = handle(bond.b);
    if (!a || !b) continue;
    const source: Source = {
      atomIndex: null,
      tokens: [token],
      position: a.position.clone().add(b.position).multiplyScalar(0.5),
      radius: 0.2,
      color: "",
    };
    byBond.set(bondIndex, source);
    out.push(source);
  }
  if (out.length === 0) {
    // A branch or size token has no atom or bond of its own, so use the atom it follows.
    const previous =
      [...record.atomTokens].reverse().find((t) => t < mask[0]) ?? record.atomTokens[0];
    const fallback = handle(record.atomTokens.indexOf(previous));
    if (fallback)
      out.push({
        atomIndex: null,
        tokens: [...mask],
        position: fallback.position.clone(),
        radius: 0.2,
        color: "",
      });
  }
  // Tokens with no source of their own lock together with the last one.
  const covered = new Set(out.flatMap((s) => s.tokens));
  for (const token of mask) if (!covered.has(token)) out.at(-1)?.tokens.push(token);
  return out;
}

export function findPulsePaths(record: MoleculeRecord, sources: Source[]): PulsePath[] {
  const heavy = record.atomTokens.length;
  const blocked = new Set(sources.map((s) => s.atomIndex).filter((i): i is number => i !== null));
  const neighbours = new Map<number, number[]>();
  for (const { a, b } of record.bonds) {
    if (a >= heavy || b >= heavy) continue;
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  }
  const open = Array.from({ length: heavy }, (_, i) => i).filter((i) => !blocked.has(i));
  const toScene = (i: number) => {
    const a = record.atoms[i];
    const c = record.atoms
      .reduce((acc, x) => acc.add(new THREE.Vector3(x.el ? x.x : 0, x.y, x.z)), new THREE.Vector3())
      .multiplyScalar(1 / record.atoms.length);
    return new THREE.Vector3(a.x, a.y, a.z).sub(c);
  };
  const hole = sources[0].position;
  const nearestToHole = (start: number) => {
    const previous = new Map<number, number>([[start, -1]]);
    const queue = [start];
    let best = start;
    let bestDistance = toScene(start).distanceTo(hole);
    while (queue.length) {
      const current = queue.shift()!;
      const d = toScene(current).distanceTo(hole);
      if (d < bestDistance) {
        best = current;
        bestDistance = d;
      }
      for (const next of neighbours.get(current) ?? []) {
        if (blocked.has(next) || previous.has(next)) continue;
        previous.set(next, current);
        queue.push(next);
      }
    }
    const path: number[] = [];
    for (let at = best; at !== -1; at = previous.get(at) ?? -1) path.unshift(at);
    return path;
  };
  const finish = (atoms: number[]): PulsePath => {
    const points = atoms.map(toScene);
    const last = points.at(-1) ?? hole.clone().add(new THREE.Vector3(0.6, 0.6, 0));
    points.push(last.clone().lerp(hole, 0.55));
    if (points.length < 2) points.unshift(last);
    return { atoms, points };
  };
  if (open.length === 0) return [finish([]), finish([])];
  const forward = nearestToHole(open[0]);
  let reverse = nearestToHole(open.at(-1)!);
  if (reverse.length === 1) {
    const before = (neighbours.get(reverse[0]) ?? []).find((n) => !blocked.has(n));
    if (before !== undefined) reverse = [before, ...reverse];
  }
  return [finish(forward), finish(reverse)];
}

const GLOW = (() => {
  let texture: THREE.CanvasTexture | null = null;
  return () => {
    if (texture) return texture;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.14, "rgba(190,198,255,.8)");
      g.addColorStop(0.42, "rgba(111,124,240,.18)");
      g.addColorStop(1, "rgba(111,124,240,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
    texture = new THREE.CanvasTexture(canvas);
    return texture;
  };
})();

function glow(size = 1) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: GLOW(),
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    }),
  );
  sprite.scale.setScalar(size);
  sprite.renderOrder = 6;
  return sprite;
}

function createCloud(source: Source, color: string, count: number, pixelRatio: number): Cloud {
  const geometry = new THREE.BufferGeometry();
  const dir = new Float32Array(count * 3);
  const cloud = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const unit = (out: Float32Array, i: number, r: number, squash = 1) => {
    const u = Math.random() * Math.PI * 2;
    const c = 2 * Math.random() - 1;
    const q = Math.sqrt(1 - c * c);
    out[i * 3] = r * q * Math.cos(u);
    out[i * 3 + 1] = r * q * Math.sin(u) * squash;
    out[i * 3 + 2] = r * c;
  };
  for (let i = 0; i < count; i++) {
    unit(dir, i, 1);
    unit(cloud, i, 0.32 + Math.pow(Math.random(), 0.7) * 1.25, 0.75);
    seed[i] = Math.random();
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
  geometry.setAttribute("aCloud", new THREE.BufferAttribute(cloud, 3));
  geometry.setAttribute("aS", new THREE.BufferAttribute(seed, 1));
  const uniforms: CloudUniforms = {
    uT: { value: 0 },
    uD: { value: 0 },
    uC: { value: 0 },
    uSw: { value: 0 },
    uTi: { value: 1 },
    uB: { value: 0 },
    uR: { value: source.radius },
    uPR: { value: pixelRatio },
    uCol: { value: new THREE.Color(color) },
  };
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: /* glsl */ `
        uniform float uT,uD,uC,uSw,uTi,uR,uPR,uB;
        attribute vec3 aDir,aCloud; attribute float aS; varying float vS;
        mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
        mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
        void main(){
          vS=aS;
          vec3 sf=aDir*uR;
          float an=uSw*(.45+aS*.9);
          vec3 c=rx(an*.41)*ry(an)*(aCloud*uTi);
          c+=.05*vec3(sin(uT*.9+aS*30.),cos(uT*.7+aS*47.),sin(uT*.8+aS*13.));
          vec3 p=mix(sf,c,smoothstep(aS*.34,.66+aS*.34,uD));
          float k=smoothstep(aS*.45,.55+aS*.45,uC);
          p=mix(p,vec3(0.),k);
          vec4 mv=modelViewMatrix*vec4(p,1.);
          gl_PointSize=uPR*(.7+aS*1.5)*(1.+k)*(11./-mv.z)*(1.4+uB*.3);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; uniform float uB; varying float vS;
        void main(){
          float a=smoothstep(.5,.05,length(gl_PointCoord-.5));
          gl_FragColor=vec4(uCol*a*uB*(.45+vS),a);
        }`,
    }),
  );
  points.position.copy(source.position);
  points.visible = false;
  points.renderOrder = 3;
  points.frustumCulled = false;
  return { points, uniforms, source };
}

function createDust(pixelRatio: number) {
  const count = 1500;
  const position = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(2 * Math.random() - 1);
    const r = 4 + Math.pow(Math.random(), 0.6) * 16;
    position[i * 3] = r * Math.sin(v) * Math.cos(u);
    position[i * 3 + 1] = r * Math.sin(v) * Math.sin(u);
    position[i * 3 + 2] = r * Math.cos(v) - 3;
    seed[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aS", new THREE.BufferAttribute(seed, 1));
  const uniforms: Record<string, THREE.IUniform> = {
    uT: { value: 0 },
    uW: { value: -5 },
    uWA: { value: 0 },
    uB: { value: 0 },
    uO: { value: new THREE.Vector3() },
    uPR: { value: pixelRatio },
  };
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: /* glsl */ `
        uniform float uT,uW,uWA,uPR; uniform vec3 uO; attribute float aS; varying float vS;
        void main(){
          vS=aS;
          vec3 p=position+.14*vec3(sin(uT*.14+aS*40.),cos(uT*.11+aS*22.),sin(uT*.09+aS*60.));
          vec3 d=p-uO; float l=length(d);
          p+=normalize(d)*uWA*exp(-pow(l-uW,2.)*1.1);
          vec4 mv=modelViewMatrix*vec4(p,1.);
          gl_PointSize=uPR*(1.1+aS*2.)*(26./-mv.z);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uB; varying float vS;
        void main(){
          float a=smoothstep(.5,.1,length(gl_PointCoord-.5));
          gl_FragColor=vec4(vec3(.58,.62,.9)*a*(.12+vS*.35)*uB,a);
        }`,
    }),
  );
  points.frustumCulled = false;
  return { points, uniforms };
}

function createPulse(path: PulsePath, color: string): Pulse {
  const length = 16;
  const sprites = Array.from({ length }, (_, k) => {
    const s = glow(k === 0 ? 0.95 : 0.72 * (1 - k / length) + 0.14);
    s.material.color = new THREE.Color(color);
    return s;
  });
  const curve = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < path.points.length - 1; i++)
    curve.add(new THREE.LineCurve3(path.points[i], path.points[i + 1]));
  return {
    sprites,
    path,
    set(p) {
      sprites.forEach((s, k) => {
        const q = p - k * 0.022;
        if (q < 0 || q > 1 || curve.curves.length === 0) {
          s.material.opacity = 0;
          return;
        }
        s.position.copy(curve.getPointAt(q));
        s.material.opacity = k === 0 ? 1 : (1 - k / length) * 0.7;
      });
    },
    off() {
      sprites.forEach((s) => (s.material.opacity = 0));
    },
  };
}

function dashedRing(at: THREE.Vector3, radius: number, color: string) {
  const points = Array.from({ length: 73 }, (_, i) => {
    const t = (i / 72) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, 0);
  });
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineDashedMaterial({
      color,
      dashSize: 0.075,
      gapSize: 0.06,
      transparent: true,
      opacity: 0,
      depthTest: false,
      toneMapped: false,
    }),
  );
  line.computeLineDistances();
  line.position.copy(at);
  line.renderOrder = 4;
  return line;
}

function questionMark(at: THREE.Vector3, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = "500 76px 'Geist Variable', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText("?", 64, 68);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    }),
  );
  sprite.position.copy(at);
  sprite.scale.setScalar(0.4);
  sprite.renderOrder = 5;
  return sprite;
}

/** The normal of the molecule's best-fit plane, by power iteration. */
function planeNormal(points: THREE.Vector3[]) {
  const c = points
    .reduce((acc, p) => acc.add(p), new THREE.Vector3())
    .multiplyScalar(1 / points.length);
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of points) {
    const d = [p.x - c.x, p.y - c.y, p.z - c.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i * 3 + j] += d[i] * d[j];
  }
  const trace = m[0] + m[4] + m[8] + 1;
  let v = new THREE.Vector3(0.3, 0.5, 0.8).normalize();
  for (let n = 0; n < 40; n++) {
    v = new THREE.Vector3(
      trace * v.x - (m[0] * v.x + m[1] * v.y + m[2] * v.z),
      trace * v.y - (m[3] * v.x + m[4] * v.y + m[5] * v.z),
      trace * v.z - (m[6] * v.x + m[7] * v.y + m[8] * v.z),
    ).normalize();
  }
  return v;
}

export interface RigInput {
  scene: THREE.Scene;
  before: BuiltMolecule;
  after: BuiltMolecule;
  record: MoleculeRecord;
  response: ReconstructResponse;
  palette: ScenePalette;
  particles: number;
  fitDistance: number;
  pixelRatio?: number;
}

export function createRig({
  scene,
  before,
  after,
  record,
  response,
  palette,
  particles,
  fitDistance,
  pixelRatio = 1,
}: RigInput): Rig {
  const group = new THREE.Group();
  const mask = response.mask_positions;
  const sources = findSources(record, before, mask);
  const colorOf = (s: Source) => {
    if (s.atomIndex === null) return palette.muted;
    return palette[record.atoms[s.atomIndex].el as keyof ScenePalette] ?? palette.C;
  };
  const clouds = sources.map((s) => createCloud(s, colorOf(s), particles, pixelRatio));
  const pulses = findPulsePaths(record, sources).map((path, i) =>
    createPulse(path, i === 0 ? "#ffffff" : "#dfe3ff"),
  );
  const flashes = sources.map((s) => {
    const f = glow(0.01);
    f.position.copy(s.position);
    return f;
  });
  const shocks = sources.map((s) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.975, 1, 128),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.5, 1.65, 3),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    ring.position.copy(s.position);
    ring.visible = false;
    return ring;
  });
  const rings = sources.map((s) =>
    dashedRing(s.position, Math.max(s.radius, 0.3) * 1.3, palette.muted),
  );
  const marks = sources.map((s) => questionMark(s.position, palette.muted));
  const scan = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.65, 0.7, 1.6),
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  const dust = createDust(pixelRatio);
  group.add(
    ...clouds.map((c) => c.points),
    ...pulses.flatMap((p) => p.sprites),
    ...flashes,
    ...shocks,
    ...rings,
    ...marks,
    scan,
  );

  applyLook(after, DEFAULT_LOOK);
  after.group.visible = false;
  after.pulses.forEach((p) => (p.visible = false));
  scene.add(dust.points, before.group, after.group, group);

  const hole = sources
    .reduce((acc, s) => acc.add(s.position), new THREE.Vector3())
    .multiplyScalar(1 / sources.length);
  const heavy = before.atoms.filter((a: AtomHandle) => a.el !== "H").map((a) => a.position);
  const normal = planeNormal(
    heavy.length >= 3 ? heavy : [...heavy, new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)],
  );
  const dir = normal.clone();

  const billboards = [...rings, ...shocks, scan];
  const shake = new THREE.Vector3();
  const rig: Rig = {
    group,
    before,
    after,
    sources,
    clouds,
    pulses,
    flashes,
    shocks,
    rings,
    marks,
    scan,
    dust,
    state: { swirl: 0, swirlSpeed: 0.15, bloom: 0.42, shake: 0 },
    camera: { x: 0, y: 0, z: 14, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0 },
    framing: { hole, dir, fitDistance },
    palette,
    tick(camera, dt, elapsed) {
      rig.state.swirl += dt * rig.state.swirlSpeed;
      for (const c of clouds) {
        c.uniforms.uT.value = elapsed;
        c.uniforms.uSw.value = rig.state.swirl;
      }
      dust.uniforms.uT.value = elapsed;
      rig.state.shake *= Math.pow(0.0009, dt);
      shake.set(
        (Math.random() - 0.5) * rig.state.shake,
        (Math.random() - 0.5) * rig.state.shake,
        0,
      );
      const c = rig.camera;
      camera.position.set(c.x + shake.x, c.y + shake.y, c.z);
      camera.lookAt(c.tx + shake.x * 0.4, c.ty + shake.y * 0.4, c.tz);
      for (const b of billboards) b.quaternion.copy(camera.quaternion);
      for (const halo of after.billboards) halo.quaternion.copy(camera.quaternion);
    },
    dispose() {
      scene.remove(dust.points, before.group, after.group, group);
      before.dispose();
      after.dispose();
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose();
      });
      dust.points.geometry.dispose();
      (dust.points.material as THREE.Material).dispose();
    },
  };
  return rig;
}
