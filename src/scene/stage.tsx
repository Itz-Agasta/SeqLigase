import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { useTheme } from "@/app/theme";
import { useLab } from "@/state/lab-store";
import {
  animatePulses,
  type AtomHandle,
  buildMolecule,
  type BuiltMolecule,
} from "./build-molecule";
import { MOMENT_PALETTE, readPalette } from "./colors";
import { createDirector, type Playback } from "./director";
import { Fallback2D } from "./fallback-2d";
import { createRig, type Rig } from "./moment-rig";
import { useWebGL } from "./use-webgl";

gsap.ticker.lagSmoothing(0);

const REDUCED = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SPACE = new THREE.Color(0x050507);
const parentQuat = new THREE.Quaternion();
export const MOMENT_PALETTE: Partial<ScenePalette> = {
  C: "#9aa1ab",
  H: "#e6e8ec",
  brand: "#6f7cf0",
  warn: "#e0a84e",
  muted: "#a1a3a9",
};

interface Framing {
  ox: number;
  oy: number;
  fit: number;
}

/** The canvas covers the window so panels can fade away without a resize. The view offset keeps the molecule in the stage area. */
function framingFor(stage: HTMLElement | null, radius: number, fovDegrees: number): Framing {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const rect = stage?.getBoundingClientRect() ?? { left: 0, top: 0, width: W, height: H };
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const scale = H / Math.max(1, Math.min(rect.width, rect.height));
  return {
    ox: W / 2 - cx,
    oy: H / 2 - cy,
    fit: ((radius + 0.2) / Math.tan((fovDegrees * Math.PI) / 360)) * scale,
  };
}

export function RoomLighting() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.42;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
    };
  }, [get]);
  return (
    <>
      <directionalLight position={[4, 7, 6]} intensity={1.15} />
      <directionalLight position={[-6, -2, -5]} intensity={0.7} color="#9fb0ff" />
    </>
  );
}

export interface AtomTip {
  x: number;
  y: number;
  atom: AtomHandle;
}

function Molecule({
  onTip,
  stageRef,
}: {
  onTip: (tip: AtomTip | null) => void;
  stageRef: RefObject<HTMLElement | null>;
}) {
  const record = useLab((s) => s.record);
  const response = useLab((s) => s.response);
  const view = useLab((s) => s.view);
  const showHydrogens = useLab((s) => s.showHydrogens);
  const inMoment = useLab((s) => s.phase !== "idle");
  const { start, length } = useLab((s) => s.selection);
  const { theme } = useTheme();
  const get = useThree((s) => s.get);
  const framed = useRef<string | null>(null);
  const highlighted = useRef<AtomHandle | null>(null);

  const built = useMemo<BuiltMolecule | null>(() => {
    if (!record || inMoment) return null;
    const mask = Array.from({ length }, (_, i) => start + i);
    void theme;
    return buildMolecule({ record, response, view, mask, showHydrogens, palette: readPalette() });
  }, [record, response, view, start, length, showHydrogens, theme, inMoment]);

  useEffect(() => () => built?.dispose(), [built]);

  useEffect(() => {
    if (!built || !record || framed.current === record.id) return;
    const camera = get().camera as THREE.PerspectiveCamera;
    const { fit } = framingFor(stageRef.current, built.radius, camera.fov);
    const dir =
      camera.position.lengthSq() > 0.1
        ? camera.position.clone().normalize()
        : new THREE.Vector3(0.3, 0.32, 1).normalize();
    camera.position.copy(dir.multiplyScalar(fit));
    camera.lookAt(0, 0, 0);
    framed.current = record.id;
    if (REDUCED()) return;
    // A new molecule assembles atom by atom.
    built.atoms.forEach((a, i) => {
      gsap.fromTo(
        a.mesh.scale,
        { x: 0.001, y: 0.001, z: 0.001 },
        {
          x: a.radius,
          y: a.radius,
          z: a.radius,
          duration: 0.5,
          delay: i * 0.03,
          ease: "back.out(2)",
        },
      );
    });
    built.halves.forEach((h) => {
      gsap.fromTo(
        h.group.scale,
        { y: 0.001 },
        { y: 1, duration: 0.4, delay: 0.25, ease: "power2.out" },
      );
    });
  }, [built, record, get, stageRef]);

  useFrame(({ camera, clock }) => {
    if (!built) return;
    built.group.getWorldQuaternion(parentQuat).invert();
    for (const b of built.billboards) b.quaternion.copy(parentQuat).multiply(camera.quaternion);
    if (!REDUCED()) animatePulses(built, clock.elapsedTime);
    const hovered = useLab.getState().hoveredToken;
    const target =
      hovered === null ? null : (built.atoms.find((a) => a.tokenIndex === hovered) ?? null);
    if (target !== highlighted.current) {
      highlighted.current?.mesh.scale.setScalar(highlighted.current.radius);
      target?.mesh.scale.setScalar(target.radius * 1.16);
      highlighted.current = target;
    }
  });

  if (!built) return null;
  return (
    <primitive
      object={built.group}
      onPointerMove={(e: {
        object: THREE.Object3D;
        nativeEvent: PointerEvent;
        stopPropagation: () => void;
      }) => {
        const index = e.object.userData.atomIndex as number | undefined;
        if (index === undefined) return;
        e.stopPropagation();
        const atom = built.atoms.find((a) => a.index === index);
        if (!atom) return;
        useLab.getState().setHoveredToken(atom.tokenIndex);
        onTip({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, atom });
      }}
      onPointerOut={() => {
        useLab.getState().setHoveredToken(null);
        onTip(null);
      }}
    />
  );
}

function Controls() {
  const spin = useLab((s) => s.spin);
  const hovered = useLab((s) => s.hoveredToken);
  const idle = useLab((s) => s.phase === "idle");
  return (
    <OrbitControls
      makeDefault
      enabled={idle}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      autoRotate={idle && spin && hovered === null && !REDUCED()}
      autoRotateSpeed={0.9}
    />
  );
}

/** Renders every frame: plain while idle, with bloom during the moment. Also owns the view offset. */
function Renderer({
  rigRef,
  stageRef,
}: {
  rigRef: RefObject<Rig | null>;
  stageRef: RefObject<HTMLElement | null>;
}) {
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const composer = useRef<{ composer: EffectComposer; bloom: UnrealBloomPass } | null>(null);

  useEffect(() => {
    const { gl, scene, camera } = get();
    const pr = gl.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(size.width * pr, size.height * pr, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    const fx = new EffectComposer(gl, target);
    fx.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.42, 0.75, 0.9);
    fx.addPass(bloom);
    fx.addPass(new OutputPass());
    composer.current = { composer: fx, bloom };
    return () => {
      fx.dispose();
      composer.current = null;
    };
  }, [get, size]);

  useFrame((_, dt) => {
    const { gl, scene, camera, clock } = get();
    const rig = rigRef.current;
    const persp = camera as THREE.PerspectiveCamera;
    if (rig) {
      rig.tick(camera, dt, clock.elapsedTime);
      persp.setViewOffset(
        size.width,
        size.height,
        rig.camera.ox,
        rig.camera.oy,
        size.width,
        size.height,
      );
    } else {
      const { ox, oy } = framingFor(stageRef.current, 0, persp.fov);
      persp.setViewOffset(size.width, size.height, ox, oy, size.width, size.height);
    }
    if (rig && composer.current) {
      scene.background = SPACE;
      composer.current.bloom.strength = rig.state.bloom;
      composer.current.composer.render(dt);
    } else {
      scene.background = null;
      gl.render(scene, camera);
    }
  }, 1);
  return null;
}

function MomentController({
  rigRef,
  stageRef,
}: {
  rigRef: RefObject<Rig | null>;
  stageRef: RefObject<HTMLElement | null>;
}) {
  const pending = useLab((s) => s.pendingRun);
  const get = useThree((s) => s.get);
  const playback = useRef<Playback | null>(null);

  useEffect(() => {
    if (!pending) return;
    const lab = useLab.getState();
    const record = lab.record;
    if (!record) return;
    const { scene, camera } = get();
    const palette = { ...readPalette(), ...MOMENT_PALETTE };
    const mask = pending.mask_positions;
    const showHydrogens = lab.showHydrogens;
    const before = buildMolecule({
      record,
      response: null,
      view: "original",
      mask,
      showHydrogens,
      palette,
    });
    const after = buildMolecule({
      record,
      response: pending,
      view: "reconstructed",
      mask,
      showHydrogens,
      palette,
    });
    const framing = framingFor(
      stageRef.current,
      before.radius,
      (camera as THREE.PerspectiveCamera).fov,
    );
    const rig = createRig({
      scene,
      before,
      after,
      record,
      response: pending,
      palette,
      particles: 2400,
      fitDistance: framing.fit,
      pixelRatio: get().gl.getPixelRatio(),
    });
    Object.assign(rig.camera, { ox: framing.ox, oy: framing.oy });
    rigRef.current = rig;
    gsap.to(rig.camera, {
      ox: 0,
      oy: window.innerHeight * 0.05,
      duration: 1.4,
      ease: "power2.inOut",
    });
    const lift = gsap.to(rig.camera, {
      ox: framing.ox,
      oy: framing.oy,
      duration: 0.5,
      ease: "power2.inOut",
      delay: 9.1,
    });

    const director = createDirector({
      rig,
      camera,
      response: pending,
      record,
      reducedMotion: REDUCED(),
      onPhase: (phase) => useLab.getState().setPhase(phase),
      onDisplay: (displayed) => useLab.getState().setDisplayed(displayed),
      onSwap: () => undefined,
      onBeam: (beam) => useLab.setState({ beam }),
      onChecks: (checks) => useLab.setState({ checks }),
    });
    const run = director.play();
    playback.current = run;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") run.skip();
    };
    window.addEventListener("keydown", onKey);
    void run.finished.then(() => {
      window.removeEventListener("keydown", onKey);
      lift.kill();
      rigRef.current = null;
      rig.dispose();
      playback.current = null;
      const fit = framing.fit;
      camera.position.copy(
        rig.framing.dir
          .clone()
          .multiplyScalar(camera.position.dot(rig.framing.dir) < 0 ? -fit : fit),
      );
      camera.lookAt(0, 0, 0);
      useLab.getState().finish(pending);
    });
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, get, rigRef, stageRef]);
  return null;
}

export function Stage({ stageRef }: { stageRef: RefObject<HTMLElement | null> }) {
  const { available, watch } = useWebGL();
  const [tip, setTip] = useState<AtomTip | null>(null);
  const record = useLab((s) => s.record);
  const rigRef = useRef<Rig | null>(null);

  useEffect(() => {
    useLab.setState({ sceneReady: available });
    return () => useLab.setState({ sceneReady: false });
  }, [available]);

  if (!available) return <Fallback2D />;
  return (
    <>
      <div className="fixed inset-0">
        <Canvas
          camera={{ fov: 30, position: [3, 3.2, 12], near: 0.1, far: 100 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => {
            gl.toneMappingExposure = 0.82;
            watch(gl.domElement);
          }}
          aria-label={
            record
              ? `3D structure of ${record.name}, ${record.formula}. Drag to rotate.`
              : "3D structure"
          }
        >
          <RoomLighting />
          <Molecule onTip={setTip} stageRef={stageRef} />
          <Controls />
          <Renderer rigRef={rigRef} stageRef={stageRef} />
          <MomentController rigRef={rigRef} stageRef={stageRef} />
        </Canvas>
      </div>
      {tip ? (
        <div
          className="bg-raise pointer-events-none fixed z-50 rounded-lg border px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: tip.x + 14, top: tip.y - 54 }}
        >
          <b className="font-medium">
            {tip.atom.el}
            {tip.atom.index + 1}
          </b>
          {tip.atom.tokenIndex === null ? (
            <div className="text-subtle">Hydrogen added for the conformer</div>
          ) : (
            <div className="text-muted-foreground flex justify-between gap-3.5">
              Token position{" "}
              <span className="text-foreground font-mono">{tip.atom.tokenIndex}</span>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
