import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { useTheme } from "@/app/theme";
import { useLab } from "@/state/lab-store";
import { type AtomHandle, buildMolecule, type BuiltMolecule } from "./build-molecule";
import { readPalette } from "./colors";
import { Fallback2D } from "./fallback-2d";
import { useWebGL } from "./use-webgl";

const REDUCED = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const parentQuat = new THREE.Quaternion();

function RoomLighting() {
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

function Molecule({ onTip }: { onTip: (tip: AtomTip | null) => void }) {
  const record = useLab((s) => s.record);
  const response = useLab((s) => s.response);
  const view = useLab((s) => s.view);
  const showHydrogens = useLab((s) => s.showHydrogens);
  const { start, length } = useLab((s) => s.selection);
  const { theme } = useTheme();
  const { camera, size } = useThree();
  const framed = useRef<string | null>(null);
  const highlighted = useRef<AtomHandle | null>(null);

  const built = useMemo<BuiltMolecule | null>(() => {
    if (!record) return null;
    const mask = Array.from({ length }, (_, i) => start + i);
    return buildMolecule({ record, response, view, mask, showHydrogens, palette: readPalette() });
    // The palette depends on the theme, which is applied to the document before this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, response, view, start, length, showHydrogens, theme]);

  useEffect(() => () => built?.dispose(), [built]);

  useEffect(() => {
    if (!built || !record || framed.current === record.id) return;
    const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    const fit = (built.radius + 0.2) / Math.sin(fov / 2) / Math.min(1, size.width / size.height);
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
  }, [built, record, camera, size]);

  useFrame(({ camera: cam, clock }) => {
    if (!built) return;
    built.group.getWorldQuaternion(parentQuat).invert();
    for (const b of built.billboards) b.quaternion.copy(parentQuat).multiply(cam.quaternion);
    const t = clock.elapsedTime;
    for (const p of built.pulses) {
      if (REDUCED()) continue;
      p.scale.setScalar(1 + 0.08 * Math.sin(t * 2.4));
      ((p as THREE.Line).material as THREE.LineBasicMaterial).opacity =
        0.42 + 0.34 * Math.cos(t * 2.4);
    }
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
        stopPropagation(): void;
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
  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      autoRotate={spin && hovered === null && !REDUCED()}
      autoRotateSpeed={0.9}
    />
  );
}

export function Stage() {
  const { available, watch } = useWebGL();
  const [tip, setTip] = useState<AtomTip | null>(null);
  const record = useLab((s) => s.record);
  if (!available) return <Fallback2D />;
  return (
    <>
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
        <Molecule onTip={setTip} />
        <Controls />
      </Canvas>
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
