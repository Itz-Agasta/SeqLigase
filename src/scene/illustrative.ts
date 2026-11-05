import * as THREE from "three";

/**
 * The illustrative look is computed per atom instead of with post-processing. These molecules
 * have few enough atoms to evaluate occlusion analytically, which needs no extra render passes,
 * keeps hardware antialiasing and works on a transparent canvas.
 */
const MAX_SPHERES = 32;

export interface AoUniforms {
  [key: string]: THREE.IUniform;
  uSpheres: { value: THREE.Vector4[] };
  uCount: { value: number };
  uVdw: { value: number[] };
}

export function createAoUniforms(): AoUniforms {
  return {
    uSpheres: { value: Array.from({ length: MAX_SPHERES }, () => new THREE.Vector4()) },
    uCount: { value: 0 },
    uVdw: { value: Array.from({ length: MAX_SPHERES }, () => 0) },
  };
}

const OCCLUSION = /* glsl */ `
  uniform vec4 uSpheres[${MAX_SPHERES}];
  uniform int uCount;
  float sphereOcclusion(vec3 p, vec3 n) {
    float light = 1.0;
    for (int i = 0; i < uCount; i++) {
      vec3 d = uSpheres[i].xyz - p;
      float l = length(d);
      float h = l / uSpheres[i].w;
      light *= 1.0 - clamp(max(dot(n, d / l), 0.0) / (h * h), 0.0, 1.0);
    }
    return light;
  }
`;

const INK = /* glsl */ `vec3(0.012, 0.013, 0.018)`;

/** Adds occlusion and an ink edge to a lit material, keeping everything else about it. */
export function applyIllustrative(material: THREE.MeshPhysicalMaterial, ao: AoUniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSpheres = ao.uSpheres;
    shader.uniforms.uCount = ao.uCount;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vWorldPos;\n${OCCLUSION}`)
      .replace(
        "#include <opaque_fragment>",
        /* glsl */ `
        vec3 worldNormal = inverseTransformDirection(normal, viewMatrix);
        outgoingLight *= mix(0.45, 1.0, sphereOcclusion(vWorldPos, worldNormal));
        float facing = abs(dot(normal, normalize(vViewPosition)));
        outgoingLight = mix(outgoingLight, ${INK}, smoothstep(0.34, 0.2, facing) * 0.9);
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => "seqligase-illustrative";
  return material;
}

export interface ShellUniforms {
  [key: string]: THREE.IUniform;
  uSolid: { value: number };
  uAlpha: { value: number };
}

export function createShellUniforms(): ShellUniforms {
  return { uSolid: { value: 0 }, uAlpha: { value: 0 } };
}

const SHELL_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalMatrix * normal;
    vView = -mv.xyz;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const SHELL_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform int uSelf;
  uniform float uVdw[${MAX_SPHERES}];
  uniform float uSolid;
  uniform float uAlpha;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  ${OCCLUSION}
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    float facing = clamp(dot(n, v), 0.0, 1.0);
    float rim = 1.0 - facing;
    float light = 0.74 + 0.26 * max(dot(n, normalize(vec3(0.35, 0.65, 0.7))), 0.0);
    float occlusion = sphereOcclusion(vWorldPos, normalize(vWorldNormal));
    vec3 color = uColor * light * mix(1.0, mix(0.32, 1.0, occlusion), uSolid);
    color += vec3(0.1) * uSolid * pow(max(dot(n, normalize(v + vec3(0.35, 0.65, 0.7))), 0.0), 40.0);
    // Ink where this atom meets its neighbours, as in a calotte model.
    float seam = 0.0;
    for (int i = 0; i < uCount; i++) {
      if (i == uSelf) continue;
      float gap = length(vWorldPos - uSpheres[i].xyz) - uVdw[i];
      seam = max(seam, 1.0 - smoothstep(0.012, 0.045, gap));
    }
    color = mix(color, ${INK}, seam * uSolid * 0.92);
    float ink = smoothstep(0.7, 0.8, rim);
    color = mix(color, ${INK}, ink * mix(0.5, 1.0, uSolid));
    float glass = uAlpha * (0.4 + rim * 1.5) + ink * min(1.0, uAlpha * 5.0) * 0.5;
    gl_FragColor = vec4(color, mix(glass, 1.0, uSolid));
    #include <colorspace_fragment>
  }
`;

export function createShellMaterial(
  color: string,
  shared: ShellUniforms,
  ao: AoUniforms,
  self: number,
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      ...ao,
      uColor: { value: new THREE.Color(color) },
      uSelf: { value: self },
    },
    vertexShader: SHELL_VERTEX,
    fragmentShader: SHELL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    toneMapped: false,
  });
}

/** Writes depth first, so overlapping shells read as one surface with no seams inside it. */
export function createShellPrepass() {
  return new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true });
}

export const MAX_OCCLUDERS = MAX_SPHERES;
