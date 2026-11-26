'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mulberry32 } from './terrainMath';
import type { SharedAtmosphereState } from './types';

interface AtmosphereAndParticlesProps {
  atmosphereRef: React.MutableRefObject<SharedAtmosphereState>;
  isSoftwareGl: boolean;
}

const SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uNight;
  varying vec3 vWorldDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.04 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float y = dir.y;

    // --- GOLDEN SUNSET GRADIENT ---
    vec3 dayAbyss = vec3(0.28, 0.25, 0.42);
    vec3 dayHorizon = vec3(0.96, 0.64, 0.45);
    vec3 dayMid = vec3(0.76, 0.46, 0.54);
    vec3 dayZenith = vec3(0.18, 0.28, 0.49);

    vec3 sunsetSky = mix(dayAbyss, dayHorizon, smoothstep(-0.38, 0.02, y));
    sunsetSky = mix(sunsetSky, dayMid, smoothstep(0.02, 0.28, y));
    sunsetSky = mix(sunsetSky, dayZenith, smoothstep(0.26, 0.85, y));

    // Warm Sunset Sun Disc & Soft Atmospheric Halo
    vec3 sunDir = normalize(vec3(0.62, 0.24, -0.74));
    float sunDot = max(0.0, dot(dir, sunDir));
    sunsetSky += vec3(1.0, 0.78, 0.48) * pow(sunDot, 10.0) * 0.48;
    sunsetSky += vec3(1.0, 0.94, 0.78) * smoothstep(0.9965, 0.9992, sunDot) * 1.15;

    // --- STARRY AURORA NIGHT GRADIENT ---
    vec3 nightAbyss = vec3(0.02, 0.04, 0.10);
    vec3 nightHorizon = vec3(0.06, 0.12, 0.24);
    vec3 nightMid = vec3(0.04, 0.07, 0.18);
    vec3 nightZenith = vec3(0.015, 0.025, 0.08);

    vec3 nightSky = mix(nightAbyss, nightHorizon, smoothstep(-0.35, 0.03, y));
    nightSky = mix(nightSky, nightMid, smoothstep(0.03, 0.35, y));
    nightSky = mix(nightSky, nightZenith, smoothstep(0.35, 0.9, y));

    // Soft Moon Halo in Night Sky
    vec3 moonDir = normalize(vec3(-0.55, 0.46, -0.68));
    float moonDot = max(0.0, dot(dir, moonDir));
    nightSky += vec3(0.62, 0.78, 1.0) * pow(moonDot, 18.0) * 0.34;
    nightSky += vec3(0.92, 0.96, 1.0) * smoothstep(0.9975, 0.9994, moonDot) * 1.1;

    // --- SHIMMERING AURORA BOREALIS CURTAINS (visible in Night) ---
    if (y > -0.02 && uNight > 0.01) {
      vec2 aUv = dir.xz / (y + 0.32);
      float wave1 = sin(aUv.x * 1.8 + uTime * 0.22 + fbm(aUv * 0.75 + uTime * 0.05) * 3.2);
      float ribbon1 = exp(-pow(wave1 * 2.2, 2.0));

      float wave2 = cos(aUv.x * 1.25 - aUv.y * 0.9 - uTime * 0.18 + fbm(aUv * 0.95 - uTime * 0.04) * 2.8);
      float ribbon2 = exp(-pow(wave2 * 2.5, 2.0));

      float verticalCurtain = smoothstep(0.02, 0.24, y) * (1.0 - smoothstep(0.55, 0.92, y));
      float shimmer = 0.65 + 0.35 * sin(aUv.x * 7.0 + uTime * 0.9);

      vec3 emerald = vec3(0.16, 0.94, 0.68);
      vec3 cyan = vec3(0.18, 0.78, 0.94);
      vec3 violet = vec3(0.54, 0.36, 0.95);

      vec3 auroraCol = mix(emerald, cyan, smoothstep(0.12, 0.42, y)) * ribbon1 * shimmer
                     + mix(cyan, violet, smoothstep(0.18, 0.56, y)) * ribbon2 * 0.72;

      nightSky += auroraCol * verticalCurtain * 0.68 * uNight;
    }

    vec3 finalCol = mix(sunsetSky, nightSky, uNight);
    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

const STAR_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vColor = aColor;
    vTwinkle = 0.58 + 0.42 * sin(uTime * (1.4 + mod(aPhase, 2.4)) + aPhase * 6.2831);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (260.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const STAR_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.05, d);
    float alpha = pow(core, 1.8) * vTwinkle * uOpacity;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const PARTICLE_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uMode; // 0 = meandering fireflies, 1 = rising mana motes
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vec3 pos = position;

    if (uMode < 0.5) {
      // Gentle meandering fireflies hovering over the island meadow & blossoms
      pos.x += sin(uTime * 0.65 + aPhase * 6.28) * 0.85;
      pos.y += sin(uTime * 0.95 + aPhase * 11.4) * 0.48;
      pos.z += cos(uTime * 0.58 + aPhase * 7.8) * 0.85;
      vAlpha = 0.45 + 0.55 * sin(uTime * 2.4 + aPhase * 12.0);
    } else {
      // Subtle mana particles spiraling upward from beneath the cliff underside
      float cycle = fract(aPhase + uTime * 0.055);
      pos.y = -7.5 + cycle * 14.5;
      float swirl = uTime * 0.25 + aPhase * 6.28;
      pos.x += cos(swirl) * 0.45;
      pos.z += sin(swirl) * 0.45;
      vAlpha = sin(cycle * 3.14159) * (0.65 + 0.35 * sin(uTime * 2.2 + aPhase * 9.0));
    }

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * uPixelRatio * (180.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uIntensity;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float glow = pow(1.0 - d * 2.0, 2.2);
    gl_FragColor = vec4(vColor * (1.2 + glow * 0.8), glow * vAlpha * uIntensity);
  }
`;

interface CloudSpec {
  angle: number;
  radius: number;
  y: number;
  speed: number;
  scale: number;
  puffs: { pos: [number, number, number]; r: number }[];
}

function buildCloudSpecs(): CloudSpec[] {
  const rand = mulberry32(3197);
  const specs: CloudSpec[] = [];
  const count = 13;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const radius = 16.5 + rand() * 14.5;
    const y = -5.8 + rand() * 11.2;
    const scale = 0.85 + rand() * 0.95;
    const puffCount = 5 + Math.floor(rand() * 3);
    const puffs: { pos: [number, number, number]; r: number }[] = [];
    for (let p = 0; p < puffCount; p++) {
      const f = (p / (puffCount - 1)) - 0.5;
      puffs.push({
        pos: [
          f * 3.6 + (rand() - 0.5) * 0.5,
          (1 - Math.abs(f) * 1.4) * 0.55 + (rand() - 0.5) * 0.35,
          (rand() - 0.5) * 1.15,
        ],
        r: (0.72 + (1 - Math.abs(f)) * 0.52 + rand() * 0.22),
      });
    }
    specs.push({
      angle,
      radius,
      y,
      speed: 0.012 + rand() * 0.016,
      scale,
      puffs,
    });
  }
  return specs;
}

export default function AtmosphereAndParticles({
  atmosphereRef,
  isSoftwareGl,
}: AtmosphereAndParticlesProps) {
  const { gl, scene } = useThree();
  const sceneRef = useRef<THREE.Scene | null>(null);
  const skyMatRef = useRef<THREE.ShaderMaterial>(null);
  const starMatRef = useRef<THREE.ShaderMaterial>(null);
  const fireflyMatRef = useRef<THREE.ShaderMaterial>(null);
  const manaMatRef = useRef<THREE.ShaderMaterial>(null);

  // Procedural RoomEnvironment PMREM for rich metallic brass & water reflections on all devices
  useEffect(() => {
    sceneRef.current = scene;
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    const s = sceneRef.current;
    s.environment = envTarget.texture;
    s.environmentIntensity = 0.58;
    pmrem.dispose();

    const fog = new THREE.FogExp2('#e0937a', 0.012);
    s.fog = fog;

    return () => {
      envTarget.dispose();
      s.environment = null;
      s.fog = null;
      sceneRef.current = null;
    };
  }, [gl, scene]);

  const skyUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uNight: { value: 0 },
    }),
    []
  );

  // Dense Twinkling Starfield (2,400 stars distributed across upper & mid sky dome)
  const starGeo = useMemo(() => {
    const count = 2400;
    const rand = mulberry32(9901);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#cfe4ff'),
      new THREE.Color('#fff2d6'),
      new THREE.Color('#a8d4ff'),
      new THREE.Color('#c8f7f0'),
    ];

    for (let i = 0; i < count; i++) {
      const theta = rand() * Math.PI * 2;
      // Cover upper hemisphere and wrap gracefully slightly below horizon
      const u = rand() * 1.25 - 0.25;
      const phi = Math.acos(Math.max(-1, Math.min(1, u)));
      const radius = 82 + rand() * 10;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      sizes[i] = 0.75 + Math.pow(rand(), 2.4) * 2.4;
      phases[i] = rand();
      const c = palette[Math.floor(rand() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  const starUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) },
      uOpacity: { value: 0 },
    }),
    []
  );

  // Fireflies / Wisps hovering over meadow, blossoms, and stream
  const fireflyGeo = useMemo(() => {
    const count = 90;
    const rand = mulberry32(5123);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const cGold = new THREE.Color('#ffd970');
    const cMint = new THREE.Color('#7cf7ea');
    const tmp = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const ang = rand() * Math.PI * 2;
      const r = 1.2 + Math.sqrt(rand()) * 7.8;
      positions[i * 3] = Math.cos(ang) * r;
      positions[i * 3 + 1] = 1.2 + rand() * 5.2;
      positions[i * 3 + 2] = Math.sin(ang) * r;

      sizes[i] = 1.8 + rand() * 2.2;
      phases[i] = rand();
      tmp.copy(rand() < 0.72 ? cGold : cMint);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  const fireflyUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) },
      uMode: { value: 0 },
      uIntensity: { value: 0.45 },
    }),
    []
  );

  // Rising Mana Particles floating up from beneath the island cliffs
  const manaGeo = useMemo(() => {
    const count = 115;
    const rand = mulberry32(6247);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const cAqua = new THREE.Color('#4cf5e6');
    const cViolet = new THREE.Color('#a78bfa');
    const tmp = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const ang = rand() * Math.PI * 2;
      const r = 3.2 + rand() * 7.4;
      positions[i * 3] = Math.cos(ang) * r;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = Math.sin(ang) * r;

      sizes[i] = 1.3 + rand() * 1.9;
      phases[i] = rand();
      tmp.copy(cAqua).lerp(cViolet, rand() * 0.65);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  const manaUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) },
      uMode: { value: 1 },
      uIntensity: { value: 0.35 },
    }),
    []
  );

  const cloudSpecs = useMemo(() => buildCloudSpecs(), []);
  const cloudPuffGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 2), []);
  const cloudMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f8dfd2',
        emissive: '#382230',
        emissiveIntensity: 0.16,
        roughness: 0.96,
        metalness: 0.0,
        transparent: true,
        opacity: 0.84,
      }),
    []
  );

  const cloudMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const cloudRefs = useRef<(THREE.Group | null)[]>([]);
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);

  useEffect(() => {
    cloudMatRef.current = cloudMat;
    return () => {
      cloudMatRef.current = null;
      starGeo.dispose();
      fireflyGeo.dispose();
      manaGeo.dispose();
      cloudPuffGeo.dispose();
      cloudMat.dispose();
    };
  }, [starGeo, fireflyGeo, manaGeo, cloudPuffGeo, cloudMat]);

  // Pre-allocated colors & vectors (zero GC in render loop)
  const palette = useMemo(
    () => ({
      dayKeyCol: new THREE.Color('#ffbe7d'),
      nightKeyCol: new THREE.Color('#9bc2ff'),
      dayRimCol: new THREE.Color('#95b8f0'),
      nightRimCol: new THREE.Color('#3cf2d2'),
      dayHemiSky: new THREE.Color('#f7b59a'),
      nightHemiSky: new THREE.Color('#2d4a7c'),
      dayHemiGround: new THREE.Color('#3d5438'),
      nightHemiGround: new THREE.Color('#143540'),
      dayFog: new THREE.Color('#df9179'),
      nightFog: new THREE.Color('#0c1830'),
      dayCloud: new THREE.Color('#fae0d4'),
      nightCloud: new THREE.Color('#223354'),
      dayCloudEmissive: new THREE.Color('#6b3c46'),
      nightCloudEmissive: new THREE.Color('#132842'),
      dayKeyPos: new THREE.Vector3(18, 13, -15),
      nightKeyPos: new THREE.Vector3(-16, 17, -14),
    }),
    []
  );

  useFrame((frameState, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = frameState.clock.getElapsedTime();

    // Smooth exponential damping between Golden Sunset (0) and Starry Aurora Night (1)
    const state = atmosphereRef.current;
    state.nightFactor = THREE.MathUtils.damp(state.nightFactor, state.targetNight, 2.8, dt);
    const nf = state.nightFactor;

    // Sky dome & aurora curtains
    if (skyMatRef.current) {
      skyMatRef.current.uniforms.uTime.value = t;
      skyMatRef.current.uniforms.uNight.value = nf;
    }

    // Twinkling starfield fades in smoothly during night transition
    if (starMatRef.current) {
      starMatRef.current.uniforms.uTime.value = t;
      starMatRef.current.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(nf, 0.14, 0.92);
    }

    // Fireflies & rising mana particles
    if (fireflyMatRef.current) {
      fireflyMatRef.current.uniforms.uTime.value = t;
      fireflyMatRef.current.uniforms.uIntensity.value = 0.36 + nf * 0.92;
    }
    if (manaMatRef.current) {
      manaMatRef.current.uniforms.uTime.value = t;
      manaMatRef.current.uniforms.uIntensity.value = 0.28 + nf * 0.78;
    }

    // Cinematic 3-point lighting transitions
    if (keyLightRef.current) {
      keyLightRef.current.color.copy(palette.dayKeyCol).lerp(palette.nightKeyCol, nf);
      keyLightRef.current.intensity = THREE.MathUtils.lerp(2.75, 1.15, nf);
      keyLightRef.current.position.copy(palette.dayKeyPos).lerp(palette.nightKeyPos, nf);
    }
    if (rimLightRef.current) {
      rimLightRef.current.color.copy(palette.dayRimCol).lerp(palette.nightRimCol, nf);
      rimLightRef.current.intensity = THREE.MathUtils.lerp(0.85, 1.1, nf);
    }
    if (hemiLightRef.current) {
      hemiLightRef.current.color.copy(palette.dayHemiSky).lerp(palette.nightHemiSky, nf);
      hemiLightRef.current.groundColor
        .copy(palette.dayHemiGround)
        .lerp(palette.nightHemiGround, nf);
      hemiLightRef.current.intensity = THREE.MathUtils.lerp(0.95, 0.62, nf);
    }

    // Environment intensity & horizon-matched fog
    const sc = sceneRef.current;
    if (sc) {
      sc.environmentIntensity = THREE.MathUtils.lerp(0.62, 0.32, nf);
      if (sc.fog instanceof THREE.FogExp2) {
        sc.fog.color.copy(palette.dayFog).lerp(palette.nightFog, nf);
        sc.fog.density = THREE.MathUtils.lerp(0.011, 0.014, nf);
      }
    }

    // Sculpted drifting cloud clusters
    const cMat = cloudMatRef.current;
    if (cMat) {
      cMat.color.copy(palette.dayCloud).lerp(palette.nightCloud, nf);
      cMat.emissive.copy(palette.dayCloudEmissive).lerp(palette.nightCloudEmissive, nf);
      cMat.opacity = THREE.MathUtils.lerp(0.84, 0.56, nf);
    }

    for (let i = 0; i < cloudSpecs.length; i++) {
      const grp = cloudRefs.current[i];
      if (!grp) continue;
      const spec = cloudSpecs[i];
      const ang = spec.angle + t * spec.speed;
      grp.position.set(
        Math.cos(ang) * spec.radius,
        spec.y + Math.sin(t * 0.35 + i) * 0.28,
        Math.sin(ang) * spec.radius
      );
      grp.rotation.y = -ang + Math.PI * 0.5;
    }
  });

  return (
    <group name="atmosphere-and-particles">
      {/* Custom GLSL Atmospheric Sky Dome with Sunset Halo & Aurora Borealis */}
      <mesh renderOrder={-2} frustumCulled={false}>
        <sphereGeometry args={[105, 48, 32]} />
        <shaderMaterial
          ref={skyMatRef}
          uniforms={skyUniforms}
          vertexShader={SKY_VERTEX_SHADER}
          fragmentShader={SKY_FRAGMENT_SHADER}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* Dense Twinkling Starfield */}
      <points geometry={starGeo} frustumCulled={false}>
        <shaderMaterial
          ref={starMatRef}
          uniforms={starUniforms}
          vertexShader={STAR_VERTEX_SHADER}
          fragmentShader={STAR_FRAGMENT_SHADER}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </points>

      {/* Primary Shadow-Casting Key Light (Sun -> Moon) */}
      <directionalLight
        ref={keyLightRef}
        position={[18, 13, -15]}
        color="#ffbe7d"
        intensity={2.75}
        castShadow={!isSoftwareGl}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={2}
        shadow-camera-far={55}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={3}
      />

      {/* Cool Sky / Mossy Ground Hemisphere Fill */}
      <hemisphereLight
        ref={hemiLightRef}
        args={['#f7b59a', '#3d5438', 0.95]}
      />

      {/* Rim Backlight sculpting cliffs & blossoms */}
      <directionalLight
        ref={rimLightRef}
        position={[-14, -4, 16]}
        color="#95b8f0"
        intensity={0.85}
      />

      {/* Drifting Volumetric-Style Sculpted Clouds */}
      <group name="drifting-clouds">
        {cloudSpecs.map((spec, idx) => (
          <group
            key={idx}
            ref={(el) => {
              cloudRefs.current[idx] = el;
            }}
            position={[
              Math.cos(spec.angle) * spec.radius,
              spec.y,
              Math.sin(spec.angle) * spec.radius,
            ]}
            scale={[spec.scale * 1.15, spec.scale * 0.65, spec.scale * 0.9]}
          >
            {spec.puffs.map((pf, pIdx) => (
              <mesh
                key={pIdx}
                geometry={cloudPuffGeo}
                material={cloudMat}
                position={pf.pos}
                scale={pf.r}
              />
            ))}
          </group>
        ))}
      </group>

      {/* Glowing Fireflies / Wisps */}
      <points geometry={fireflyGeo} frustumCulled={false}>
        <shaderMaterial
          ref={fireflyMatRef}
          uniforms={fireflyUniforms}
          vertexShader={PARTICLE_VERTEX_SHADER}
          fragmentShader={PARTICLE_FRAGMENT_SHADER}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Rising Mana Particles */}
      <points geometry={manaGeo} frustumCulled={false}>
        <shaderMaterial
          ref={manaMatRef}
          uniforms={manaUniforms}
          vertexShader={PARTICLE_VERTEX_SHADER}
          fragmentShader={PARTICLE_FRAGMENT_SHADER}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
