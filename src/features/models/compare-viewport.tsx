import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { type MoleculeRecord, type ReconstructResponse } from "@/engine/types";
import { animatePulses, buildMolecule } from "@/scene/build-molecule";
import { MOMENT_PALETTE, readPalette } from "@/scene/colors";
import { createDirector } from "@/scene/director";
import { createRig, type Rig } from "@/scene/moment-rig";
import { RoomLighting } from "@/scene/stage";
import { useLab } from "@/state/lab-store";

const PALETTE = () => ({ ...readPalette(), ...MOMENT_PALETTE });
const REDUCED = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SPACE = new THREE.Color(0x050507);

type Stage = "ready" | "running" | "done";

function fitFor(radius: number, aspect: number, fov: number) {
  return ((radius + 0.2) / Math.tan((fov * Math.PI) / 360)) * (1 / Math.min(1, aspect));
}

function Scene({
  record,
  response,
  runId,
  onDone,
}: {
  record: MoleculeRecord;
  response: ReconstructResponse;
  runId: number;
  onDone: () => void;
}) {
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const [stage, setStage] = useState<Stage>("ready");
  const rigRef = useRef<Rig | null>(null);
  const mask = response.mask_positions;

  const still = useMemo(() => {
    if (stage === "running") return null;
    return buildMolecule({
      record,
      response,
      view: stage === "done" ? "reconstructed" : "masked",
      mask,
      showHydrogens: true,
      palette: PALETTE(),
    });
  }, [record, response, mask, stage]);
  useEffect(() => () => still?.dispose(), [still]);

  useEffect(() => {
    if (!still) return;
    const camera = get().camera as THREE.PerspectiveCamera;
    const fit = fitFor(still.radius, size.width / size.height, camera.fov);
    camera.position.setLength(fit);
    camera.lookAt(0, 0, 0);
  }, [still, get, size]);

  useEffect(() => {
    if (runId === 0) return;
    const { scene, camera, gl } = get();
    const palette = PALETTE();
    const before = buildMolecule({
      record,
      response: null,
      view: "original",
      mask,
      showHydrogens: true,
      palette,
    });
    const after = buildMolecule({
      record,
      response,
      view: "reconstructed",
      mask,
      showHydrogens: true,
      palette,
    });
    const fit = fitFor(
      before.radius,
      size.width / size.height,
      (camera as THREE.PerspectiveCamera).fov,
    );
    const rig = createRig({
      scene,
      before,
      after,
      record,
      response,
      palette,
      particles: useLab.getState().quality === "low" ? 300 : 700,
      fitDistance: fit,
      pixelRatio: gl.getPixelRatio(),
    });
    rigRef.current = rig;
    setStage("running");
    const run = createDirector({
      rig,
      camera,
      response,
      record,
      reducedMotion: REDUCED(),
      onPhase: () => undefined,
      onDisplay: () => undefined,
      onSwap: () => undefined,
      onBeam: () => undefined,
      onChecks: () => undefined,
    }).play();
    let live = true;
    void run.finished.then(() => {
      rigRef.current = null;
      rig.dispose();
      if (!live) return;
      setStage("done");
      onDone();
    });
    return () => {
      live = false;
      run.skip();
    };
    // A new runId starts a run. The response and record for a run never change while it plays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useFrame(({ clock }, dt) => {
    const { camera, scene } = get();
    scene.background = SPACE;
    if (rigRef.current) rigRef.current.tick(camera, dt, clock.elapsedTime);
    if (still) {
      if (!REDUCED()) animatePulses(still, clock.elapsedTime);
      for (const b of still.billboards) b.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <>
      <RoomLighting />
      {still ? <primitive object={still.group} /> : null}
      <OrbitControls
        enabled={stage !== "running"}
        enablePan={false}
        enableZoom={false}
        autoRotate={stage !== "running" && !REDUCED()}
        autoRotateSpeed={0.7}
      />
    </>
  );
}

export function CompareViewport(props: {
  record: MoleculeRecord;
  response: ReconstructResponse;
  runId: number;
  onDone: () => void;
  label: string;
}) {
  return (
    <Canvas
      key={`${props.record.id}:${props.response.masked_selfies}`}
      camera={{ fov: 30, position: [3, 3.2, 12], near: 0.1, far: 100 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 0.82;
      }}
      aria-label={props.label}
    >
      <Scene
        record={props.record}
        response={props.response}
        runId={props.runId}
        onDone={props.onDone}
      />
    </Canvas>
  );
}
