'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  fbm2D,
  getIslandRimRadius,
  getStreamInfluence,
  getTerrainHeight,
  getUndersideDepth,
  mulberry32,
  smoothstep,
} from './terrainMath';
import type { ProceduralTextureSet } from './proceduralTextures';
import type { SharedAtmosphereState } from './types';

interface IslandTerrainProps {
  textures: ProceduralTextureSet;
  atmosphereRef: React.MutableRefObject<SharedAtmosphereState>;
}

function buildMainIslandGeometries() {
  const radialSegs = 72;
  const ringSegs = 28;

  // --- 1. TOP MOSSY TERRAIN CAP ---
  const topVertCount = 1 + radialSegs * ringSegs;
  const topPositions = new Float32Array(topVertCount * 3);
  const topUvs = new Float32Array(topVertCount * 2);
  const topColors = new Float32Array(topVertCount * 3);
  const topIndices: number[] = [];

  const centerH = getTerrainHeight(0, 0);
  topPositions[0] = 0;
  topPositions[1] = centerH;
  topPositions[2] = 0;
  topUvs[0] = 0.5;
  topUvs[1] = 0.5;
  topColors[0] = 0.36;
  topColors[1] = 0.54;
  topColors[2] = 0.28;

  const cLush = new THREE.Color('#5a8f43');
  const cSunlit = new THREE.Color('#7ca84b');
  const cDeepMoss = new THREE.Color('#2f5732');
  const cBankEarth = new THREE.Color('#5c4f3e');
  const cWetStone = new THREE.Color('#476b69');
  const tmpCol = new THREE.Color();

  let idx = 1;
  for (let r = 1; r <= ringSegs; r++) {
    const t = r / ringSegs;
    const radFrac = Math.pow(t, 0.92);
    for (let a = 0; a < radialSegs; a++) {
      const angle = (a / radialSegs) * Math.PI * 2;
      const rimR = getIslandRimRadius(angle);
      const radius = rimR * radFrac;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      let y = getTerrainHeight(x, z);

      // Slight lip drop on outermost ring so grass drapes smoothly over cliff stone
      if (r === ringSegs) {
        y -= 0.26;
      }

      topPositions[idx * 3] = x;
      topPositions[idx * 3 + 1] = y;
      topPositions[idx * 3 + 2] = z;

      topUvs[idx * 2] = x * 0.13 + 0.5;
      topUvs[idx * 2 + 1] = z * 0.13 + 0.5;

      // Rich organic moss vertex coloring
      const patch = fbm2D(x * 0.45 + 4.1, z * 0.45 - 2.3, 3);
      const streamInf = getStreamInfluence(x, z);
      tmpCol.copy(cDeepMoss).lerp(cLush, smoothstep(0.22, 0.72, patch));
      // Sunlit elevation warmth on upper plateaus
      const elevBoost = smoothstep(1.35, 2.5, y);
      tmpCol.lerp(cSunlit, elevBoost * 0.42);
      // Earthy damp moss near rim
      tmpCol.lerp(cDeepMoss, smoothstep(0.78, 1.0, radFrac) * 0.38);
      // Stream bank soil & wet turquoise-tinted riverbed
      if (streamInf > 0.02) {
        tmpCol.lerp(cBankEarth, smoothstep(0.05, 0.5, streamInf) * 0.7);
        tmpCol.lerp(cWetStone, smoothstep(0.55, 0.95, streamInf) * 0.85);
      }

      topColors[idx * 3] = tmpCol.r;
      topColors[idx * 3 + 1] = tmpCol.g;
      topColors[idx * 3 + 2] = tmpCol.b;

      idx++;
    }
  }

  // Center fan
  for (let a = 0; a < radialSegs; a++) {
    const nextA = (a + 1) % radialSegs;
    topIndices.push(0, 1 + nextA, 1 + a);
  }
  // Concentric rings
  for (let r = 1; r < ringSegs; r++) {
    const ringStart = 1 + (r - 1) * radialSegs;
    const nextRingStart = 1 + r * radialSegs;
    for (let a = 0; a < radialSegs; a++) {
      const nextA = (a + 1) % radialSegs;
      const v00 = ringStart + a;
      const v01 = ringStart + nextA;
      const v10 = nextRingStart + a;
      const v11 = nextRingStart + nextA;
      topIndices.push(v00, v01, v11);
      topIndices.push(v00, v11, v10);
    }
  }

  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.BufferAttribute(topPositions, 3));
  topGeo.setAttribute('uv', new THREE.BufferAttribute(topUvs, 2));
  topGeo.setAttribute('color', new THREE.BufferAttribute(topColors, 3));
  topGeo.setIndex(topIndices);
  topGeo.computeVertexNormals();

  // --- 2. JAGGED CLIFF UNDERSIDE ---
  const cliffRings = 16;
  const cliffVertCount = 1 + radialSegs * cliffRings;
  const cliffPos = new Float32Array(cliffVertCount * 3);
  const cliffUvs = new Float32Array(cliffVertCount * 2);
  const cliffCols = new Float32Array(cliffVertCount * 3);
  const cliffIndices: number[] = [];

  const cRockLight = new THREE.Color('#8e867c');
  const cRockMid = new THREE.Color('#645e5a');
  const cRockDeep = new THREE.Color('#393742');
  const cMossCrest = new THREE.Color('#4d6b41');

  // Bottom apex point
  const tipX = -0.55;
  const tipZ = -0.35;
  const tipY = -7.15;
  cliffPos[0] = tipX;
  cliffPos[1] = tipY;
  cliffPos[2] = tipZ;
  cliffUvs[0] = 0.5;
  cliffUvs[1] = 0.0;
  cliffCols[0] = cRockDeep.r;
  cliffCols[1] = cRockDeep.g;
  cliffCols[2] = cRockDeep.b;

  let cIdx = 1;
  for (let r = 0; r < cliffRings; r++) {
    // r = 0 is top rim (matches outer edge of moss cap), r = cliffRings - 1 is near bottom tip
    const v = r / (cliffRings - 1);
    const shrink = Math.pow(1 - v, 0.76);
    for (let a = 0; a < radialSegs; a++) {
      const angle = (a / radialSegs) * Math.PI * 2;
      const rimR = getIslandRimRadius(angle);
      const rimX = Math.cos(angle) * rimR;
      const rimZ = Math.sin(angle) * rimR;
      const rimY = getTerrainHeight(rimX, rimZ) - 0.16;

      // Angular jagged crag indentation along cliff walls
      const facet =
        Math.sin(angle * 9 + v * 5.2) * 0.28 +
        Math.cos(angle * 15 - v * 3.8) * 0.18 +
        (fbm2D(Math.cos(angle) * 2.4 + v * 3.1, Math.sin(angle) * 2.4 - v * 2.7, 3) - 0.5) * 0.95;

      // Terraced rock overhang ledge around v ≈ 0.24
      const ledge = Math.exp(-Math.pow((v - 0.24) / 0.11, 2)) * 0.42;

      const radialScale = Math.max(0.08, shrink + (facet * 0.12 + ledge * 0.08) * Math.sin(v * Math.PI));
      const x = tipX + (rimX - tipX) * radialScale;
      const z = tipZ + (rimZ - tipZ) * radialScale;

      const undersideY = getUndersideDepth(x, z);
      // Blend smoothly from rimY at v=0 down to jagged underside keel
      const yBase = rimY * (1 - Math.pow(v, 0.88)) + tipY * Math.pow(v, 0.88);
      const yCrag = undersideY * Math.sin(v * Math.PI) * 0.28 + facet * 0.34 * Math.sin(v * Math.PI);
      const y = r === 0 ? rimY + 0.06 : yBase + yCrag;

      cliffPos[cIdx * 3] = x;
      cliffPos[cIdx * 3 + 1] = y;
      cliffPos[cIdx * 3 + 2] = z;

      cliffUvs[cIdx * 2] = (a / radialSegs) * 4.0;
      cliffUvs[cIdx * 2 + 1] = v * 2.5;

      // Stratified cliff shading: mossy upper band -> warm limestone strata -> cool deep shadow underside
      const strata = 0.5 + 0.5 * Math.sin(y * 3.4 + facet * 2.2);
      tmpCol.copy(cRockMid).lerp(cRockLight, strata * 0.65 * (1 - v * 0.5));
      tmpCol.lerp(cRockDeep, smoothstep(0.35, 0.95, v) * 0.78);
      if (v < 0.18) {
        tmpCol.lerp(cMossCrest, (1 - v / 0.18) * 0.55);
      }

      cliffCols[cIdx * 3] = tmpCol.r;
      cliffCols[cIdx * 3 + 1] = tmpCol.g;
      cliffCols[cIdx * 3 + 2] = tmpCol.b;

      cIdx++;
    }
  }

  for (let r = 0; r < cliffRings - 1; r++) {
    const r0 = 1 + r * radialSegs;
    const r1 = 1 + (r + 1) * radialSegs;
    for (let a = 0; a < radialSegs; a++) {
      const nextA = (a + 1) % radialSegs;
      const v00 = r0 + a;
      const v01 = r0 + nextA;
      const v10 = r1 + a;
      const v11 = r1 + nextA;
      // Outward facing normals around underside
      cliffIndices.push(v00, v11, v01);
      cliffIndices.push(v00, v10, v11);
    }
  }
  // Connect bottom ring to tip apex (vertex 0)
  const lastRing = 1 + (cliffRings - 1) * radialSegs;
  for (let a = 0; a < radialSegs; a++) {
    const nextA = (a + 1) % radialSegs;
    cliffIndices.push(lastRing + a, 0, lastRing + nextA);
  }

  const cliffGeo = new THREE.BufferGeometry();
  cliffGeo.setAttribute('position', new THREE.BufferAttribute(cliffPos, 3));
  cliffGeo.setAttribute('uv', new THREE.BufferAttribute(cliffUvs, 2));
  cliffGeo.setAttribute('color', new THREE.BufferAttribute(cliffCols, 3));
  cliffGeo.setIndex(cliffIndices);
  cliffGeo.computeVertexNormals();

  return { topGeo, cliffGeo };
}

function buildMiniIslandGeometries(radius: number, depth: number, seed: number) {
  const rand = mulberry32(seed);
  const segs = 24;
  const rings = 8;

  // Top cap
  const topGeo = new THREE.CylinderGeometry(radius, radius * 0.94, 0.36, segs, 2, false);
  const pos = topGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const radialScale = 1 + Math.sin(ang * 3 + seed) * 0.14 + Math.cos(ang * 5 - seed * 0.7) * 0.08;
    const nx = x * radialScale;
    const nz = z * radialScale;
    const dome = y > 0 ? Math.max(0, 1 - Math.hypot(x, z) / (radius * 1.15)) * 0.32 : 0;
    pos.setXYZ(i, nx, y + dome, nz);
  }
  topGeo.computeVertexNormals();

  // Jagged rocky tapered cone underside
  const rockGeo = new THREE.ConeGeometry(radius * 0.96, depth, segs, rings);
  rockGeo.rotateX(Math.PI);
  rockGeo.translate(0, -depth * 0.5 - 0.1, 0);
  const rPos = rockGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const x = rPos.getX(i);
    const y = rPos.getY(i);
    const z = rPos.getZ(i);
    const ang = Math.atan2(z, x);
    const t = Math.min(1, Math.max(0, -y / depth));
    const radialScale =
      1 +
      Math.sin(ang * 3 + seed) * 0.14 +
      Math.cos(ang * 5 - seed * 0.7) * 0.08 +
      (rand() - 0.5) * 0.16 * Math.sin(t * Math.PI);
    rPos.setXYZ(i, x * radialScale, y + (rand() - 0.5) * 0.14 * t, z * radialScale);
  }
  rockGeo.computeVertexNormals();

  return { topGeo, rockGeo };
}

interface VineData {
  geo: THREE.TubeGeometry;
  x: number;
  y: number;
  z: number;
  phase: number;
  leafMatrices: THREE.Matrix4[];
}

function buildHangingVines(): { vines: VineData[]; leafCount: number } {
  const rand = mulberry32(8831);
  const vines: VineData[] = [];
  let leafCount = 0;
  const dummy = new THREE.Object3D();

  const totalVines = 34;
  for (let i = 0; i < totalVines; i++) {
    const angle = (i / totalVines) * Math.PI * 2 + (rand() - 0.5) * 0.12;
    // Leave waterfall lip clear so vines frame the waterfall without slicing through it
    if (angle > 1.28 && angle < 1.66) continue;

    const rimR = getIslandRimRadius(angle) * (0.97 + rand() * 0.04);
    const startX = Math.cos(angle) * rimR;
    const startZ = Math.sin(angle) * rimR;
    const startY = getTerrainHeight(startX, startZ) - 0.18;

    const length = 1.6 + rand() * 3.4;
    const pts: THREE.Vector3[] = [];
    const segs = 6;
    const swayDirX = Math.cos(angle);
    const swayDirZ = Math.sin(angle);

    for (let s = 0; s <= segs; s++) {
      const f = s / segs;
      const curl = Math.sin(f * Math.PI * 1.8 + i) * 0.16 * f;
      const out = (0.14 + f * 0.18) * (0.6 + rand() * 0.3);
      pts.push(
        new THREE.Vector3(
          swayDirX * out + curl,
          -f * length,
          swayDirZ * out + Math.cos(f * Math.PI * 1.5 + i) * 0.14 * f
        )
      );
    }

    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 10, 0.032, 5, false);

    // Leaf clusters along the vine
    const leavesPerVine = 6 + Math.floor(rand() * 5);
    const leafMatrices: THREE.Matrix4[] = [];
    for (let l = 1; l <= leavesPerVine; l++) {
      const u = l / (leavesPerVine + 0.5);
      const p = curve.getPoint(u);
      dummy.position.set(startX + p.x, startY + p.y, startZ + p.z);
      dummy.rotation.set(
        (rand() - 0.5) * 0.9,
        angle + (l % 2 === 0 ? 0.9 : -0.9) + (rand() - 0.5) * 0.6,
        (rand() - 0.5) * 0.7
      );
      const sc = 0.09 + rand() * 0.09;
      dummy.scale.set(sc * 1.35, sc * 0.55, sc);
      dummy.updateMatrix();
      leafMatrices.push(dummy.matrix.clone());
      leafCount++;
    }

    vines.push({ geo, x: startX, y: startY, z: startZ, phase: rand() * Math.PI * 2, leafMatrices });
  }

  return { vines, leafCount };
}

interface SteppingStone {
  pos: [number, number, number];
  rotY: number;
  scale: [number, number, number];
}

function buildSteppingPath(): SteppingStone[] {
  // Winds from western bridge approach (-1.1, 2.2) across the meadow and up the tier to the observatory door (-1.2, -0.5)
  const pathPoints: [number, number][] = [
    [-1.25, 2.35],
    [-1.85, 2.22],
    [-2.42, 1.95],
    [-2.82, 1.52],
    [-2.96, 0.96],
    [-2.78, 0.42],
    [-2.38, -0.02],
    [-1.92, -0.35],
    // Eastern garden stepping stones from bridge east side
    [1.85, 2.1],
    [2.52, 1.85],
    [3.12, 1.45],
    [3.55, 0.88],
  ];

  const rand = mulberry32(5512);
  return pathPoints.map(([x, z], i) => {
    const y = getTerrainHeight(x, z) + 0.04;
    return {
      pos: [x, y, z],
      rotY: i * 0.5 + rand() * 0.8,
      scale: [0.38 + rand() * 0.14, 0.09, 0.28 + rand() * 0.12],
    };
  });
}

interface SatelliteSpec {
  id: string;
  basePos: [number, number, number];
  radius: number;
  depth: number;
  seed: number;
  bobAmp: number;
  bobSpeed: number;
  phase: number;
  accent: 'bonsai' | 'crystal' | 'mushrooms' | 'lantern' | 'boulders';
}

const SATELLITES: SatelliteSpec[] = [
  {
    id: 'sat-east-high',
    basePos: [10.4, 2.5, -2.6],
    radius: 1.95,
    depth: 3.1,
    seed: 101,
    bobAmp: 0.34,
    bobSpeed: 0.72,
    phase: 0.4,
    accent: 'bonsai',
  },
  {
    id: 'sat-west-mid',
    basePos: [-10.8, 0.8, 2.4],
    radius: 2.15,
    depth: 3.6,
    seed: 202,
    bobAmp: 0.38,
    bobSpeed: 0.65,
    phase: 1.9,
    accent: 'crystal',
  },
  {
    id: 'sat-north-far',
    basePos: [4.2, 4.1, -9.8],
    radius: 1.55,
    depth: 2.5,
    seed: 303,
    bobAmp: 0.3,
    bobSpeed: 0.82,
    phase: 3.1,
    accent: 'lantern',
  },
  {
    id: 'sat-south-low',
    basePos: [-6.4, -2.1, 7.6],
    radius: 1.45,
    depth: 2.3,
    seed: 404,
    bobAmp: 0.28,
    bobSpeed: 0.9,
    phase: 4.5,
    accent: 'mushrooms',
  },
  {
    id: 'sat-east-low',
    basePos: [8.8, -1.6, 5.4],
    radius: 1.35,
    depth: 2.2,
    seed: 505,
    bobAmp: 0.26,
    bobSpeed: 0.78,
    phase: 5.4,
    accent: 'boulders',
  },
];

export default function IslandTerrain({ textures, atmosphereRef }: IslandTerrainProps) {
  const { topGeo, cliffGeo } = useMemo(() => buildMainIslandGeometries(), []);
  const { vines, leafCount } = useMemo(() => buildHangingVines(), []);
  const steppingStones = useMemo(() => buildSteppingPath(), []);

  const satGeos = useMemo(
    () => SATELLITES.map((s) => buildMiniIslandGeometries(s.radius, s.depth, s.seed)),
    []
  );

  // Underside mana crystals protruding from cliff crevices
  const undersideCrystals = useMemo(() => {
    const rand = mulberry32(9201);
    return Array.from({ length: 14 }, (_, i) => {
      const ang = (i / 14) * Math.PI * 2 + rand() * 0.25;
      const dist = 2.0 + rand() * 3.8;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      const y = getUndersideDepth(x, z) * 0.72 - 0.6;
      return {
        pos: [x, y, z] as [number, number, number],
        rot: [Math.PI + (rand() - 0.5) * 0.75, ang, (rand() - 0.5) * 0.6] as [
          number,
          number,
          number,
        ],
        scale: [0.16 + rand() * 0.14, 0.65 + rand() * 0.65, 0.16 + rand() * 0.14] as [
          number,
          number,
          number,
        ],
      };
    });
  }, []);

  const leafInstRef = useRef<THREE.InstancedMesh>(null);
  const vineGroupRef = useRef<THREE.Group>(null);
  const satRefs = useRef<(THREE.Group | null)[]>([]);
  const satLanternMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const sharedCrystalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#79f2e6',
        emissive: new THREE.Color('#25e3d0'),
        emissiveIntensity: 0.75,
        roughness: 0.18,
        metalness: 0.15,
      }),
    []
  );
  const crystalMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  useEffect(() => {
    crystalMatRef.current = sharedCrystalMat;
    return () => {
      crystalMatRef.current = null;
    };
  }, [sharedCrystalMat]);

  useEffect(() => {
    if (!leafInstRef.current) return;
    const rand = mulberry32(3141);
    const c1 = new THREE.Color('#3b6e35');
    const c2 = new THREE.Color('#649c48');
    const col = new THREE.Color();
    let idx = 0;
    for (const v of vines) {
      for (const m of v.leafMatrices) {
        leafInstRef.current.setMatrixAt(idx, m);
        col.copy(c1).lerp(c2, rand());
        leafInstRef.current.setColorAt(idx, col);
        idx++;
      }
    }
    leafInstRef.current.instanceMatrix.needsUpdate = true;
    if (leafInstRef.current.instanceColor) {
      leafInstRef.current.instanceColor.needsUpdate = true;
    }
    leafInstRef.current.computeBoundingSphere();
  }, [vines]);

  useEffect(() => {
    return () => {
      topGeo.dispose();
      cliffGeo.dispose();
      vines.forEach((v) => v.geo.dispose());
      satGeos.forEach((sg) => {
        sg.topGeo.dispose();
        sg.rockGeo.dispose();
      });
      sharedCrystalMat.dispose();
    };
  }, [topGeo, cliffGeo, vines, satGeos, sharedCrystalMat]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const nf = atmosphereRef.current.nightFactor;

    // Gentle sway on hanging vines
    if (vineGroupRef.current) {
      vineGroupRef.current.rotation.z = Math.sin(t * 0.75) * 0.012;
      vineGroupRef.current.rotation.x = Math.cos(t * 0.6) * 0.01;
    }

    // Satellite floating islets bobbing & gentle orbital breathing
    for (let i = 0; i < SATELLITES.length; i++) {
      const grp = satRefs.current[i];
      if (!grp) continue;
      const spec = SATELLITES[i];
      const angleDrift = t * 0.032 * (i % 2 === 0 ? 1 : -0.75);
      const bx = spec.basePos[0];
      const bz = spec.basePos[2];
      const cos = Math.cos(angleDrift);
      const sin = Math.sin(angleDrift);
      grp.position.x = bx * cos - bz * sin;
      grp.position.z = bx * sin + bz * cos;
      grp.position.y = spec.basePos[1] + Math.sin(t * spec.bobSpeed + spec.phase) * spec.bobAmp;
      grp.rotation.y = Math.sin(t * 0.25 + spec.phase) * 0.14;
    }

    // Mana crystals glow brighter at night
    const pulse = 0.85 + Math.sin(t * 1.9) * 0.15;
    if (crystalMatRef.current) {
      crystalMatRef.current.emissiveIntensity = (0.45 + nf * 2.2) * pulse;
    }
    if (satLanternMatRef.current) {
      satLanternMatRef.current.emissiveIntensity = 0.8 + nf * 2.4;
    }
  });

  return (
    <group name="main-island-terrain">
      {/* Sculpted Multi-Tiered Lush Moss Top */}
      <mesh geometry={topGeo} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          map={textures.mossMap}
          bumpMap={textures.mossBump}
          bumpScale={0.14}
          roughness={0.86}
          metalness={0.02}
        />
      </mesh>

      {/* Jagged Stratified Cliff Underside */}
      <mesh geometry={cliffGeo} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          map={textures.cliffMap}
          bumpMap={textures.cliffBump}
          bumpScale={0.28}
          roughness={0.92}
          metalness={0.05}
        />
      </mesh>

      {/* Embedded Underside Mana Crystal Veins */}
      <group name="underside-crystals">
        {undersideCrystals.map((c, idx) => (
          <mesh
            key={idx}
            position={c.pos}
            rotation={c.rot}
            scale={c.scale}
            material={sharedCrystalMat}
          >
            <octahedronGeometry args={[1, 0]} />
          </mesh>
        ))}
      </group>

      {/* Hand-Laid Flagstone Stepping Path */}
      <group name="stepping-stones">
        {steppingStones.map((stone, idx) => (
          <mesh
            key={idx}
            position={stone.pos}
            rotation={[0, stone.rotY, 0]}
            scale={stone.scale}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.92, 1.0, 1, 7]} />
            <meshStandardMaterial
              color={idx % 2 === 0 ? '#9c968d' : '#8b857c'}
              map={textures.masonryMap}
              bumpMap={textures.masonryBump}
              bumpScale={0.08}
              roughness={0.88}
              metalness={0.04}
            />
          </mesh>
        ))}
      </group>

      {/* Draped Hanging Vines & Instanced Ivy Leaves */}
      <group ref={vineGroupRef} name="hanging-vines">
        {vines.map((v, idx) => (
          <mesh key={idx} geometry={v.geo} position={[v.x, v.y, v.z]}>
            <meshStandardMaterial color="#365c2e" roughness={0.85} metalness={0.02} />
          </mesh>
        ))}
        <instancedMesh ref={leafInstRef} args={[undefined, undefined, leafCount]}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial roughness={0.78} metalness={0.02} />
        </instancedMesh>
      </group>

      {/* Orbiting Satellite Floating Rock Islets */}
      <group name="satellite-islets">
        {SATELLITES.map((sat, idx) => (
          <group
            key={sat.id}
            ref={(el) => {
              satRefs.current[idx] = el;
            }}
            position={sat.basePos}
          >
            {/* Satellite Mossy Cap */}
            <mesh geometry={satGeos[idx].topGeo} castShadow receiveShadow>
              <meshStandardMaterial
                color="#578a42"
                map={textures.mossMap}
                bumpMap={textures.mossBump}
                bumpScale={0.1}
                roughness={0.85}
                metalness={0.02}
              />
            </mesh>
            {/* Satellite Rocky Underside */}
            <mesh geometry={satGeos[idx].rockGeo} castShadow receiveShadow>
              <meshStandardMaterial
                color="#6a6562"
                map={textures.cliffMap}
                bumpMap={textures.cliffBump}
                bumpScale={0.22}
                roughness={0.92}
                metalness={0.04}
              />
            </mesh>

            {/* Hanging mini-vine strands under each satellite */}
            <mesh position={[sat.radius * 0.72, -0.75, 0.25]}>
              <cylinderGeometry args={[0.022, 0.012, 1.45, 5]} />
              <meshStandardMaterial color="#375f31" roughness={0.85} />
            </mesh>
            <mesh position={[-sat.radius * 0.62, -0.9, -0.35]}>
              <cylinderGeometry args={[0.02, 0.01, 1.7, 5]} />
              <meshStandardMaterial color="#2f542a" roughness={0.85} />
            </mesh>

            {/* Unique miniature storytelling accents per satellite islet */}
            {sat.accent === 'bonsai' && (
              <group position={[0, 0.34, 0]}>
                <mesh position={[0, 0.45, 0]} rotation={[0.12, 0, -0.18]} castShadow>
                  <cylinderGeometry args={[0.09, 0.18, 1.05, 8]} />
                  <meshStandardMaterial
                    color="#563b32"
                    map={textures.barkMap}
                    roughness={0.9}
                  />
                </mesh>
                <mesh position={[0.28, 0.95, 0.1]} rotation={[0.15, 0.4, -0.5]} castShadow>
                  <cylinderGeometry args={[0.05, 0.09, 0.72, 6]} />
                  <meshStandardMaterial color="#563b32" roughness={0.9} />
                </mesh>
                <mesh position={[0.08, 1.18, 0.05]} castShadow>
                  <dodecahedronGeometry args={[0.68, 1]} />
                  <meshStandardMaterial color="#f5b7ca" roughness={0.78} />
                </mesh>
                <mesh position={[0.52, 1.24, 0.18]} castShadow>
                  <dodecahedronGeometry args={[0.48, 1]} />
                  <meshStandardMaterial color="#fad2df" roughness={0.76} />
                </mesh>
                <mesh position={[-0.36, 1.04, -0.16]} castShadow>
                  <dodecahedronGeometry args={[0.45, 1]} />
                  <meshStandardMaterial color="#ee9eb7" roughness={0.78} />
                </mesh>
              </group>
            )}

            {sat.accent === 'crystal' && (
              <group position={[0, 0.34, 0]}>
                <mesh position={[0, 0.78, 0]} rotation={[0.08, 0.4, -0.06]} castShadow>
                  <octahedronGeometry args={[0.42, 0]} />
                  <meshStandardMaterial
                    color="#8ff7ec"
                    emissive="#2ce8d5"
                    emissiveIntensity={1.25}
                    roughness={0.18}
                    metalness={0.2}
                  />
                </mesh>
                <mesh position={[0.42, 0.45, 0.25]} rotation={[-0.2, 0.2, -0.32]} scale={[0.55, 0.9, 0.55]}>
                  <octahedronGeometry args={[0.35, 0]} />
                  <meshStandardMaterial
                    color="#77ebe0"
                    emissive="#25d4c5"
                    emissiveIntensity={1.1}
                    roughness={0.2}
                  />
                </mesh>
                <mesh position={[-0.44, 0.25, -0.18]} castShadow>
                  <dodecahedronGeometry args={[0.42, 0]} />
                  <meshStandardMaterial color="#7b7671" roughness={0.92} />
                </mesh>
              </group>
            )}

            {sat.accent === 'lantern' && (
              <group position={[0, 0.32, 0]}>
                <mesh position={[0, 0.28, 0]} castShadow>
                  <cylinderGeometry args={[0.14, 0.2, 0.56, 6]} />
                  <meshStandardMaterial color="#8d877f" map={textures.masonryMap} roughness={0.9} />
                </mesh>
                <mesh position={[0, 0.68, 0]}>
                  <boxGeometry args={[0.26, 0.3, 0.26]} />
                  <meshStandardMaterial
                    ref={satLanternMatRef}
                    color="#ffe4a1"
                    emissive="#ffaa42"
                    emissiveIntensity={1.4}
                    roughness={0.3}
                  />
                </mesh>
                <mesh position={[0, 0.94, 0]} castShadow>
                  <coneGeometry args={[0.34, 0.26, 4]} />
                  <meshStandardMaterial color="#4a5368" roughness={0.78} />
                </mesh>
              </group>
            )}

            {sat.accent === 'mushrooms' && (
              <group position={[0, 0.3, 0]}>
                <mesh position={[-0.12, 0.32, 0.05]} castShadow>
                  <cylinderGeometry args={[0.07, 0.11, 0.62, 8]} />
                  <meshStandardMaterial color="#ded5c3" roughness={0.82} />
                </mesh>
                <mesh position={[-0.12, 0.62, 0.05]} scale={[1, 0.55, 1]}>
                  <sphereGeometry args={[0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                  <meshStandardMaterial
                    color="#4ad8cc"
                    emissive="#1bc4b8"
                    emissiveIntensity={0.95}
                    roughness={0.42}
                  />
                </mesh>
                <mesh position={[0.34, 0.2, -0.14]}>
                  <cylinderGeometry args={[0.045, 0.07, 0.4, 8]} />
                  <meshStandardMaterial color="#e0d7c7" roughness={0.82} />
                </mesh>
                <mesh position={[0.34, 0.4, -0.14]} scale={[1, 0.55, 1]}>
                  <sphereGeometry args={[0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                  <meshStandardMaterial
                    color="#9d86f7"
                    emissive="#7259e6"
                    emissiveIntensity={0.9}
                    roughness={0.42}
                  />
                </mesh>
              </group>
            )}

            {sat.accent === 'boulders' && (
              <group position={[0, 0.28, 0]}>
                <mesh position={[-0.18, 0.26, 0.08]} scale={[1.1, 0.85, 0.95]} castShadow>
                  <dodecahedronGeometry args={[0.44, 0]} />
                  <meshStandardMaterial color="#7f7b75" map={textures.cliffMap} roughness={0.92} />
                </mesh>
                <mesh position={[0.32, 0.16, -0.2]} scale={[0.75, 0.65, 0.8]} castShadow>
                  <dodecahedronGeometry args={[0.36, 0]} />
                  <meshStandardMaterial color="#6e6b66" roughness={0.92} />
                </mesh>
              </group>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}
