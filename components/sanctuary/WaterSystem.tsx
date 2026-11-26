'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  getStreamCenterX,
  getStreamHalfWidth,
  getStreamWaterY,
  mulberry32,
} from './terrainMath';
import type { ProceduralTextureSet } from './proceduralTextures';
import type { SharedAtmosphereState } from './types';

interface WaterSystemProps {
  textures: ProceduralTextureSet;
  atmosphereRef: React.MutableRefObject<SharedAtmosphereState>;
}

const STREAM_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec3 pos = position;
    // Subtle surface ripples along flow direction
    float wave = sin(uv.y * 26.0 - uTime * 3.1 + uv.x * 5.0) * 0.018
               + cos(uv.y * 14.0 - uTime * 2.1 - uv.x * 7.0) * 0.012;
    pos.y += wave;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const STREAM_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uNight;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    // Dual scrolling caustic layers flowing downstream (increasing vUv.y)
    vec2 uv1 = vec2(vUv.x * 4.5, vUv.y * 10.5 - uTime * 0.65);
    vec2 uv2 = vec2(vUv.x * 6.5 + 0.4, vUv.y * 14.0 - uTime * 0.95);
    float n1 = noise(uv1 * 2.2);
    float n2 = noise(uv2 * 2.6);
    float caustics = smoothstep(0.46, 0.88, (n1 + n2) * 0.55);

    // Distance from stream centerline (0 at center, 1 at banks)
    float edgeDist = abs(vUv.x - 0.5) * 2.0;
    float bankFoam = smoothstep(0.68, 0.98, edgeDist + (n1 - 0.5) * 0.22);

    // Rapid cascade foam around mid-drop (vUv.y ~ 0.25) and cliff lip (vUv.y ~ 0.95)
    float midRapid = exp(-pow((vUv.y - 0.26) / 0.075, 2.0)) * (0.45 + 0.55 * n2);
    float lipFoam = smoothstep(0.86, 1.0, vUv.y) * (0.55 + 0.45 * n1);

    // Palette smoothly shifts from sunlit tropical turquoise to luminous magical cyan at night
    vec3 dayDeep = vec3(0.08, 0.52, 0.58);
    vec3 dayShallow = vec3(0.24, 0.86, 0.82);
    vec3 nightDeep = vec3(0.06, 0.46, 0.62);
    vec3 nightGlow = vec3(0.28, 0.98, 0.94);

    vec3 deepCol = mix(dayDeep, nightDeep, uNight);
    vec3 brightCol = mix(dayShallow, nightGlow, uNight);

    vec3 col = mix(deepCol, brightCol, 0.35 + caustics * 0.65);
    // Warm sunset specular glint vs moonlit shimmer
    vec3 glintCol = mix(vec3(1.0, 0.84, 0.62), vec3(0.75, 0.98, 1.0), uNight);
    col += glintCol * pow(caustics, 3.0) * (0.35 + uNight * 0.35);

    // Frothy white-aqua foam
    float totalFoam = clamp(bankFoam * 0.65 + midRapid * 0.72 + lipFoam * 0.85, 0.0, 1.0);
    vec3 foamCol = mix(vec3(0.86, 0.98, 0.97), vec3(0.72, 1.0, 0.98), uNight);
    col = mix(col, foamCol, totalFoam);

    // Soft feather along extreme edges and north spring tail
    float alpha = (1.0 - smoothstep(0.86, 1.0, edgeDist)) * smoothstep(0.0, 0.06, vUv.y);
    alpha = clamp(alpha * 0.9 + totalFoam * 0.12, 0.0, 0.95);

    gl_FragColor = vec4(col, alpha);
  }
`;

const WATERFALL_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;
    // Gentle billowing flutter as the waterfall plunges through the sky
    float flutter = sin(uv.y * 10.0 - uTime * 5.2 + uv.x * 4.0) * 0.08 * uv.y;
    pos.z += flutter;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const WATERFALL_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uNight;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    // Fast downward streaks (vUv.y goes 0 at cliff lip -> 1 at misty bottom)
    vec2 sUv1 = vec2(vUv.x * 7.0, vUv.y * 5.5 - uTime * 2.15);
    vec2 sUv2 = vec2(vUv.x * 13.0 + 1.3, vUv.y * 8.5 - uTime * 3.05);
    float streak1 = noise(sUv1);
    float streak2 = noise(sUv2);
    float foamLines = smoothstep(0.38, 0.84, streak1 * 0.6 + streak2 * 0.55);

    float sideFade = 1.0 - smoothstep(0.58, 1.0, abs(vUv.x - 0.5) * 2.0);
    float topCrest = 1.0 - smoothstep(0.0, 0.14, vUv.y);
    float bottomDissolve = 1.0 - smoothstep(0.52, 0.98, vUv.y + (streak1 - 0.5) * 0.16);

    vec3 dayWater = vec3(0.22, 0.82, 0.84);
    vec3 nightWater = vec3(0.24, 0.95, 0.94);
    vec3 waterCol = mix(dayWater, nightWater, uNight);

    vec3 foamCol = mix(vec3(0.94, 0.96, 0.98), vec3(0.76, 1.0, 0.98), uNight);
    vec3 col = mix(waterCol, foamCol, clamp(foamLines * 0.72 + topCrest * 0.55, 0.0, 1.0));

    // Warm sunset rim glow on mist edge
    col += mix(vec3(0.24, 0.14, 0.08), vec3(0.08, 0.24, 0.28), uNight) * (1.0 - sideFade);

    float alpha = sideFade * bottomDissolve * (0.68 + foamLines * 0.32);
    if (alpha < 0.02) discard;

    gl_FragColor = vec4(col, alpha * 0.92);
  }
`;

function buildStreamGeometry(): THREE.BufferGeometry {
  const lengthSegs = 68;
  const widthSegs = 12;
  const zStart = -2.15;
  const zEnd = 6.95;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= lengthSegs; i++) {
    const v = i / lengthSegs;
    const z = zStart + (zEnd - zStart) * v;
    const cx = getStreamCenterX(z);
    const hw = getStreamHalfWidth(z) * 1.08;
    const wy = getStreamWaterY(z);

    for (let j = 0; j <= widthSegs; j++) {
      const u = j / widthSegs;
      const x = cx + (u - 0.5) * 2 * hw;
      positions.push(x, wy, z);
      uvs.push(u, v);
    }
  }

  const rowStride = widthSegs + 1;
  for (let i = 0; i < lengthSegs; i++) {
    for (let j = 0; j < widthSegs; j++) {
      const a = i * rowStride + j;
      const b = a + 1;
      const c = a + rowStride;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildWaterfallGeometry(): THREE.BufferGeometry {
  const rows = 36;
  const cols = 14;
  const zLip = 6.82;
  const cxLip = getStreamCenterX(zLip);
  const yLip = getStreamWaterY(zLip);
  const halfWidthLip = getStreamHalfWidth(zLip) * 0.88;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= rows; r++) {
    const v = r / rows; // 0 at lip -> 1 at bottom dissolve
    // Parabolic outward arc then accelerating vertical drop
    const forward = Math.sin(Math.min(1, v * 2.2) * Math.PI * 0.5) * 1.15 + v * 0.45;
    const dropY = yLip - Math.pow(v, 1.38) * 10.6;
    const z = zLip + forward;
    // Gently widens as spray disperses
    const hw = halfWidthLip * (1.0 + v * 0.48);

    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      // Slight concave curtain curve
      const archZ = Math.sin(u * Math.PI) * 0.14;
      const x = cxLip + (u - 0.5) * 2 * hw;
      positions.push(x, dropY, z + archZ);
      uvs.push(u, v);
    }
  }

  const stride = cols + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * stride + c;
      const b = a + 1;
      const c0 = a + stride;
      const d = c0 + 1;
      indices.push(a, c0, b);
      indices.push(b, c0, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildBridgeArchGeometry(): THREE.ExtrudeGeometry {
  // Vaulted semicircular stone bridge profile spanning 3.1 units
  const shape = new THREE.Shape();
  const halfSpan = 1.62;
  const archR = 1.02;
  const deckPeak = 1.24;
  const deckEnd = 0.62;

  shape.moveTo(-halfSpan, 0);
  shape.lineTo(-archR, 0);
  shape.absarc(0, 0.05, archR, Math.PI, 0, true);
  shape.lineTo(halfSpan, 0);
  shape.lineTo(halfSpan, deckEnd);
  shape.quadraticCurveTo(0, deckPeak + 0.34, -halfSpan, deckEnd);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 1.22,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 20,
  });
  geo.translate(0, 0, -0.61);
  geo.computeVertexNormals();
  return geo;
}

function buildBridgeParapetGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const halfSpan = 1.56;
  shape.moveTo(-halfSpan, 0.56);
  shape.quadraticCurveTo(0, 1.54, halfSpan, 0.56);
  shape.lineTo(halfSpan, 0.96);
  shape.quadraticCurveTo(0, 1.94, -halfSpan, 0.96);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 20,
  });
  geo.translate(0, 0, -0.07);
  geo.computeVertexNormals();
  return geo;
}

export default function WaterSystem({ textures, atmosphereRef }: WaterSystemProps) {
  const streamGeo = useMemo(() => buildStreamGeometry(), []);
  const waterfallGeo = useMemo(() => buildWaterfallGeometry(), []);
  const bridgeArchGeo = useMemo(() => buildBridgeArchGeometry(), []);
  const bridgeParapetGeo = useMemo(() => buildBridgeParapetGeometry(), []);

  const streamUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uNight: { value: 0 },
    }),
    []
  );

  const waterfallUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uNight: { value: 0 },
    }),
    []
  );

  // Compute exact bridge placement spanning the stream cleanly at z = 2.25
  const bridgeTransform = useMemo(() => {
    const bz = 2.25;
    const bx = getStreamCenterX(bz);
    const dx = getStreamCenterX(bz + 0.25) - getStreamCenterX(bz - 0.25);
    const tangentAngle = Math.atan2(dx, 0.5);
    const waterY = getStreamWaterY(bz);
    return {
      pos: [bx, waterY - 0.16, bz] as [number, number, number],
      rotY: -tangentAngle,
    };
  }, []);

  // Waterfall mist puff definitions
  const mistSpecs = useMemo(() => {
    const rand = mulberry32(7331);
    const lipZ = 7.45;
    const lipX = getStreamCenterX(6.82);
    return Array.from({ length: 22 }, (_, i) => ({
      offsetX: lipX + (rand() - 0.5) * 2.1,
      baseY: -1.4 - rand() * 7.8,
      offsetZ: lipZ + 0.4 + (rand() - 0.5) * 1.4,
      speed: 0.22 + rand() * 0.25,
      phase: (i / 22) + rand() * 0.2,
      baseScale: 0.75 + rand() * 1.15,
    }));
  }, []);

  const mistRefs = useRef<(THREE.Mesh | null)[]>([]);
  const streamMatRef = useRef<THREE.ShaderMaterial>(null);
  const waterfallMatRef = useRef<THREE.ShaderMaterial>(null);
  const bridgeLightRef = useRef<THREE.PointLight>(null);
  const streamGlowLightRef = useRef<THREE.PointLight>(null);

  const bridgeLanternMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffefc0',
        emissive: new THREE.Color('#ffae44'),
        emissiveIntensity: 1.2,
        roughness: 0.22,
      }),
    []
  );
  const bridgeLanternMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useEffect(() => {
    bridgeLanternMatRef.current = bridgeLanternMat;
    return () => {
      bridgeLanternMatRef.current = null;
      streamGeo.dispose();
      waterfallGeo.dispose();
      bridgeArchGeo.dispose();
      bridgeParapetGeo.dispose();
      bridgeLanternMat.dispose();
    };
  }, [streamGeo, waterfallGeo, bridgeArchGeo, bridgeParapetGeo, bridgeLanternMat]);

  const dayMistColor = useMemo(() => new THREE.Color('#f7e8e2'), []);
  const nightMistColor = useMemo(() => new THREE.Color('#7ee8e6'), []);
  const scratchColorRef = useRef(new THREE.Color());

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const nf = atmosphereRef.current.nightFactor;

    if (streamMatRef.current) {
      streamMatRef.current.uniforms.uTime.value = t;
      streamMatRef.current.uniforms.uNight.value = nf;
    }
    if (waterfallMatRef.current) {
      waterfallMatRef.current.uniforms.uTime.value = t;
      waterfallMatRef.current.uniforms.uNight.value = nf;
    }

    // Billowing waterfall mist puffs
    const scratchColor = scratchColorRef.current;
    scratchColor.copy(dayMistColor).lerp(nightMistColor, nf);
    for (let i = 0; i < mistSpecs.length; i++) {
      const m = mistRefs.current[i];
      if (!m) continue;
      const spec = mistSpecs[i];
      const life = (t * spec.speed + spec.phase) % 1;
      m.position.set(
        spec.offsetX + Math.sin(t * 0.7 + i) * 0.35,
        spec.baseY - life * 1.8 + Math.sin(life * Math.PI) * 0.4,
        spec.offsetZ + life * 0.9
      );
      const sc = spec.baseScale * (0.65 + life * 0.85);
      m.scale.set(sc * 1.25, sc * 0.85, sc);
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.color.copy(scratchColor);
      mat.opacity = Math.sin(life * Math.PI) * (0.32 + nf * 0.08);
    }

    // Bridge lanterns & glowing turquoise water bounce light
    if (bridgeLanternMatRef.current) {
      bridgeLanternMatRef.current.emissiveIntensity = 1.0 + nf * 2.6;
    }
    if (bridgeLightRef.current) {
      bridgeLightRef.current.intensity = 1.2 + nf * 5.8;
    }
    if (streamGlowLightRef.current) {
      streamGlowLightRef.current.intensity = 0.8 + nf * 4.5;
    }
  });

  // Voussoir keystones curving along the bridge arch rim
  const keystones = useMemo(() => {
    return Array.from({ length: 9 }, (_, i) => {
      const frac = i / 8;
      const ang = Math.PI - frac * Math.PI;
      return {
        x: Math.cos(ang) * 1.06,
        y: 0.05 + Math.sin(ang) * 1.06,
        rotZ: ang - Math.PI / 2,
      };
    });
  }, []);

  return (
    <group name="water-and-bridge-system">
      {/* Glowing Turquoise Stream & Spring Pool */}
      <mesh geometry={streamGeo} renderOrder={2}>
        <shaderMaterial
          ref={streamMatRef}
          uniforms={streamUniforms}
          vertexShader={STREAM_VERTEX_SHADER}
          fragmentShader={STREAM_FRAGMENT_SHADER}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Cascading Waterfall plunging off the Southern Cliff Lip */}
      <mesh geometry={waterfallGeo} renderOrder={3}>
        <shaderMaterial
          ref={waterfallMatRef}
          uniforms={waterfallUniforms}
          vertexShader={WATERFALL_VERTEX_SHADER}
          fragmentShader={WATERFALL_FRAGMENT_SHADER}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Soft Turquoise Bounce Light over the Spring & Stream */}
      <pointLight
        ref={streamGlowLightRef}
        position={[1.15, 1.5, -0.8]}
        color="#36f0e2"
        intensity={1.0}
        distance={8.5}
        decay={2}
      />

      {/* Billowing Waterfall Mist Plumes */}
      <group name="waterfall-mist">
        {mistSpecs.map((spec, idx) => (
          <mesh
            key={idx}
            ref={(el) => {
              mistRefs.current[idx] = el;
            }}
            position={[spec.offsetX, spec.baseY, spec.offsetZ]}
          >
            <dodecahedronGeometry args={[0.75, 1]} />
            <meshStandardMaterial
              color="#f7e8e2"
              transparent
              opacity={0.28}
              depthWrite={false}
              roughness={1}
            />
          </mesh>
        ))}
      </group>

      {/* Arched Cobblestone Bridge over the Glowing Stream */}
      <group
        name="arched-cobblestone-bridge"
        position={bridgeTransform.pos}
        rotation={[0, bridgeTransform.rotY, 0]}
      >
        {/* Main Vaulted Stone Arch & Cobblestone Deck */}
        <mesh geometry={bridgeArchGeo} castShadow receiveShadow>
          <meshStandardMaterial
            color="#a39c92"
            map={textures.masonryMap}
            bumpMap={textures.masonryBump}
            bumpScale={0.14}
            roughness={0.88}
            metalness={0.04}
          />
        </mesh>

        {/* Front & Back Low Curved Stone Parapet Walls */}
        <mesh geometry={bridgeParapetGeo} position={[0, 0, 0.56]} castShadow receiveShadow>
          <meshStandardMaterial
            color="#968f85"
            map={textures.masonryMap}
            bumpMap={textures.masonryBump}
            bumpScale={0.12}
            roughness={0.88}
          />
        </mesh>
        <mesh geometry={bridgeParapetGeo} position={[0, 0, -0.56]} castShadow receiveShadow>
          <meshStandardMaterial
            color="#968f85"
            map={textures.masonryMap}
            bumpMap={textures.masonryBump}
            bumpScale={0.12}
            roughness={0.88}
          />
        </mesh>

        {/* Projecting Arch Voussoir Keystones (front & back faces) */}
        {[-0.63, 0.63].map((zFace, sideIdx) => (
          <group key={sideIdx} position={[0, 0, zFace]}>
            {keystones.map((ks, kIdx) => (
              <mesh
                key={kIdx}
                position={[ks.x, ks.y, 0]}
                rotation={[0, 0, ks.rotZ]}
                castShadow
              >
                <boxGeometry args={[0.16, 0.24, 0.1]} />
                <meshStandardMaterial
                  color={kIdx === 4 ? '#bdb5a8' : '#8d867d'}
                  roughness={0.86}
                />
              </mesh>
            ))}
          </group>
        ))}

        {/* Four Corner Stone Bollards */}
        {[
          [-1.56, 0.56],
          [1.56, 0.56],
          [-1.56, -0.56],
          [1.56, -0.56],
        ].map(([bx, bz], i) => (
          <group key={i} position={[bx, 0.85, bz]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.28, 0.56, 0.28]} />
              <meshStandardMaterial color="#918a80" map={textures.masonryMap} roughness={0.88} />
            </mesh>
            <mesh position={[0, 0.31, 0]} castShadow>
              <boxGeometry args={[0.34, 0.08, 0.34]} />
              <meshStandardMaterial color="#a8a196" roughness={0.85} />
            </mesh>
          </group>
        ))}

        {/* Two Warm Hanging Iron Bridge Lantern Posts */}
        {[-1.56, 1.56].map((lx, idx) => (
          <group key={idx} position={[lx, 1.18, idx === 0 ? 0.56 : -0.56]}>
            <mesh position={[0, 0.42, 0]} castShadow>
              <cylinderGeometry args={[0.03, 0.036, 0.84, 6]} />
              <meshStandardMaterial color="#2b2b32" metalness={0.78} roughness={0.42} />
            </mesh>
            <mesh
              position={[idx === 0 ? 0.14 : -0.14, 0.82, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.02, 0.02, 0.32, 6]} />
              <meshStandardMaterial color="#2b2b32" metalness={0.78} roughness={0.42} />
            </mesh>
            <mesh
              position={[idx === 0 ? 0.26 : -0.26, 0.68, 0]}
              material={bridgeLanternMat}
            >
              <cylinderGeometry args={[0.085, 0.065, 0.2, 6]} />
            </mesh>
            <mesh position={[idx === 0 ? 0.26 : -0.26, 0.81, 0]}>
              <coneGeometry args={[0.12, 0.1, 6]} />
              <meshStandardMaterial color="#2a2930" metalness={0.75} roughness={0.42} />
            </mesh>
          </group>
        ))}

        {/* Warm Glow from Bridge Lanterns onto Cobblestones & Water */}
        <pointLight
          ref={bridgeLightRef}
          position={[0, 2.05, 0.15]}
          color="#ffb354"
          intensity={1.5}
          distance={8}
          decay={2}
        />
      </group>
    </group>
  );
}
