import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useNavigate } from "@tanstack/react-router";
import gsap from "gsap";
import { Maximize } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useTip } from "@/charts/tip-context";
import { TipRow } from "@/charts/tooltip";
import { Button } from "@/components/ui/button";
import type { CatalogEntry, SpaceData } from "@/engine/types";
import { CLOUD_SCALE, PointCloud } from "@/scene/point-cloud";
import { WebGLGate } from "@/scene/webgl-gate";
import { useLab } from "@/state/lab-store";

const REDUCED = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Scene({
  space,
  catalog,
  focus,
  paused,
}: {
  space: SpaceData;
  catalog: CatalogEntry[];
  focus: string;
  paused: boolean;
}) {
  const navigate = useNavigate();
  const { show, hide } = useTip();
  const get = useThree((s) => s.get);
  const [wave] = useState(() => ({ r: 0, a: 0 }));
  const [flying, setFlying] = useState(!REDUCED());
  const names = useMemo(() => {
    const entries = new Map(catalog.map((c) => [c.id, c]));
    const byIndex = new Map<number, CatalogEntry>();
    for (const [id, index] of Object.entries(space.catalog)) {
      const entry = entries.get(id);
      if (entry) byIndex.set(index, entry);
    }
    return byIndex;
  }, [space, catalog]);

  useEffect(() => {
    if (REDUCED()) return;
    const camera = get().camera;
    const index = space.catalog[focus];
    const p = new THREE.Vector3(
      space.points[index * 4],
      space.points[index * 4 + 1],
      space.points[index * 4 + 2],
    ).multiplyScalar(CLOUD_SCALE);
    const out = (p.lengthSq() > 0.01 ? p.clone().normalize() : new THREE.Vector3(0, 0, 1))
      .add(new THREE.Vector3(0.2, 0.25, 0.6))
      .normalize();
    const start = p.clone().addScaledVector(out, 0.5);
    const end = out.clone().multiplyScalar(22);
    const state = { t: 0 };
    const look = p.clone();
    camera.position.copy(start);
    camera.lookAt(look);
    const tl = gsap.timeline({ onComplete: () => setFlying(false) });
    tl.to(state, {
      t: 1,
      duration: 3.4,
      ease: "power3.inOut",
      onUpdate() {
        camera.position.lerpVectors(start, end, state.t);
        look.copy(p).multiplyScalar(1 - state.t);
        camera.lookAt(look);
      },
    });
    const waves = gsap.timeline({ repeat: 2, repeatDelay: 2.6, delay: 2.4 });
    waves.fromTo(
      wave,
      { r: 0, a: 1 },
      { r: CLOUD_SCALE * 1.4, a: 0, duration: 2.8, ease: "power1.out" },
    );
    return () => {
      tl.kill();
      waves.kill();
    };
  }, [get, space, focus, wave]);

  useFrame(() => {
    get().scene.background = null;
  });

  return (
    <>
      <PointCloud
        space={space}
        wave={wave}
        onHover={(index, e) => {
          if (index === null || !e) {
            hide();
            return;
          }
          const named = names.get(index);
          show(
            e,
            <>
              <b className="font-medium">{named?.name ?? space.formulas[index]}</b>
              <TipRow label="Formula" value={space.formulas[index]} />
              <TipRow label="Heavy atoms" value={space.points[index * 4 + 3]} />
              {named ? <div className="text-subtle">Click to open in Repair Lab</div> : null}
            </>,
          );
        }}
        onSelect={(index) => {
          const named = names.get(index);
          if (named) {
            hide();
            void navigate({ to: "/", search: { mol: named.id } as never });
          }
        }}
      />
      <OrbitControls
        enabled={!flying}
        enablePan={false}
        autoRotate={!flying && !paused && !REDUCED()}
        autoRotateSpeed={0.35}
        minDistance={3}
        maxDistance={30}
      />
    </>
  );
}

export function ChemicalSpace({ space, catalog }: { space: SpaceData; catalog: CatalogEntry[] }) {
  const panel = useRef<HTMLDivElement>(null);
  const moleculeId = useLab((s) => s.selection.moleculeId);
  const [paused, setPaused] = useState(false);
  const focus = space.catalog[moleculeId] !== undefined ? moleculeId : "phenol";
  return (
    <section className="bg-surface col-span-12">
      <div className="flex items-start justify-between gap-3 px-[15px] pt-[13px] pb-2.5">
        <div>
          <h3 className="text-[13px] font-medium">Chemical space</h3>
          <p className="text-subtle mt-px text-xs">
            {space.count.toLocaleString("en")} QM9 molecules, arranged by Morgan fingerprint
            similarity with UMAP. Brighter points are larger molecules, and blue points are in the
            Repair Lab.
          </p>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "Rotate" : "Pause"}
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => void panel.current?.requestFullscreen?.()}
          >
            <Maximize aria-hidden="true" />
            Full screen
          </Button>
        </div>
      </div>
      <div
        ref={panel}
        className="relative h-[520px] bg-[#050507] min-[1600px]:h-[660px] [&:fullscreen]:h-screen"
      >
        <WebGLGate
          fallback={
            <p className="grid h-full place-items-center p-4 text-center text-xs text-[#a1a3a9]">
              3D map isn’t available in this browser.
            </p>
          }
        >
          <Canvas
            camera={{ fov: 42, position: [0, 0, 22], near: 0.05, far: 100 }}
            dpr={[1, 2]}
            gl={{ antialias: false }}
            raycaster={{ params: { Points: { threshold: 0.05 } } as never }}
            aria-label="3D map of QM9 molecules. Drag to rotate."
          >
            <Scene space={space} catalog={catalog} focus={focus} paused={paused} />
          </Canvas>
        </WebGLGate>
      </div>
    </section>
  );
}
