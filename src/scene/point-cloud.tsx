import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { SpaceData } from "@/engine/types";

export const CLOUD_SCALE = 7;

const vertex = /* glsl */ `
  uniform float uTime, uPR, uWaveR, uWaveA;
  attribute float aHeavy, aMark;
  varying float vLight, vMark, vWave;
  void main() {
    vMark = aMark;
    vLight = 0.35 + 0.65 * clamp((aHeavy - 3.0) / 6.0, 0.0, 1.0);
    float d = length(position);
    vWave = uWaveA * exp(-pow(d - uWaveR, 2.0) * 1.6);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float size = aMark > 0.5 ? 5.0 : 1.6;
    gl_PointSize = uPR * (size + vWave * 2.5) * (30.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const fragment = /* glsl */ `
  uniform vec3 uBase, uBrand;
  varying float vLight, vMark, vWave;
  void main() {
    float a = smoothstep(0.5, 0.15, length(gl_PointCoord - 0.5));
    vec3 c = mix(uBase * vLight, uBrand * 1.4, clamp(vMark + vWave, 0.0, 1.0));
    gl_FragColor = vec4(c * a, a * (0.5 + 0.5 * clamp(vMark + vWave, 0.0, 1.0)));
  }`;

export function PointCloud({
  space,
  onHover,
  onSelect,
  wave,
}: {
  space: SpaceData;
  onHover: (index: number | null, e: PointerEvent | null) => void;
  onSelect: (index: number) => void;
  wave: { r: number; a: number };
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const position = new Float32Array(space.count * 3);
    const heavy = new Float32Array(space.count);
    const mark = new Float32Array(space.count);
    for (let i = 0; i < space.count; i++) {
      position[i * 3] = space.points[i * 4] * CLOUD_SCALE;
      position[i * 3 + 1] = space.points[i * 4 + 1] * CLOUD_SCALE;
      position[i * 3 + 2] = space.points[i * 4 + 2] * CLOUD_SCALE;
      heavy[i] = space.points[i * 4 + 3];
    }
    for (const index of Object.values(space.catalog)) mark[index] = 1;
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aHeavy", new THREE.BufferAttribute(heavy, 1));
    g.setAttribute("aMark", new THREE.BufferAttribute(mark, 1));
    g.computeBoundingSphere();
    return g;
  }, [space]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPR: { value: Math.min(window.devicePixelRatio, 2) },
      uWaveR: { value: 0 },
      uWaveA: { value: 0 },
      uBase: { value: new THREE.Color("#8d97c9") },
      uBrand: { value: new THREE.Color("#6f7cf0") },
    }),
    [],
  );
  useFrame(({ clock }) => {
    const m = material.current;
    if (!m) return;
    m.uniforms.uTime.value = clock.elapsedTime;
    m.uniforms.uWaveR.value = wave.r;
    m.uniforms.uWaveA.value = wave.a;
  });
  return (
    <points
      geometry={geometry}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(e.index ?? null, e.nativeEvent);
      }}
      onPointerOut={() => onHover(null, null)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.index !== undefined) onSelect(e.index);
      }}
    >
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
