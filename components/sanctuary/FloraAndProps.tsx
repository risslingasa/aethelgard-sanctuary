'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  getIslandRimRadius,
  getStreamInfluence,
  getTerrainHeight,
  mulberry32,
} from './terrainMath';
import type { ProceduralTextureSet } from './proceduralTextures';
import type { SharedAtmosphereState } from './types';

interface FloraAndPropsProps {
  textures: ProceduralTextureSet;
  atmosphereRef: React.MutableRefObject<SharedAtmosphereState>;
}

interface CherryTreeSpec {
  x: number;
  z: number;
  scale: number;
  rotY: number;
  seed: number;
  leanX: number;
  leanZ: number;
}

const CHERRY_TREES: CherryTreeSpec[] = [
  // Grand overhanging cherry blossom tree on Eastern Terrace framing the bridge & spring
  { x: 4.15, z: -0.25, scale: 1.22, rotY: 0.6, seed: 11, leanX: -0.65, leanZ: 0.45 },
  // Ancient sakura perched behind/beside the Observatory Tower plateau
  { x: -4.95, z: -2.45, scale: 1.08, rotY: 2.1, seed: 22, leanX: 0.35, leanZ: 0.25 },
  // Western knoll sakura overlooking the cobblestone stepping path
  { x: -4.45, z: 2.55, scale: 1.02, rotY: 4.0, seed: 33, leanX: 0.55, leanZ: -0.25 },
  // Graceful smaller blossom tree near the southeastern cliff edge
  { x: 3.65, z: 3.75, scale: 0.88, rotY: 5.1, seed: 44, leanX: -0.35, leanZ: -0.3 },
];

function buildCherryTreeGeometries(spec: CherryTreeSpec) {
  const rand = mulberry32(spec.seed * 97 + 13);
  const s = spec.scale;

  // Sinuous primary gnarled trunk
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.18, 0),
    new THREE.Vector3(spec.leanX * 0.22 * s, 0.95 * s, spec.leanZ * 0.22 * s),
    new THREE.Vector3(spec.leanX * 0.58 * s, 1.95 * s, spec.leanZ * 0.55 * s),
    new THREE.Vector3(spec.leanX * 0.88 * s, 2.75 * s, spec.leanZ * 0.82 * s),
  ]);
  const trunkGeo = new THREE.TubeGeometry(trunkCurve, 12, 0.22 * s, 8, false);
  // Taper trunk smoothly from flared roots to upper fork
  const tPos = trunkGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const y = tPos.getY(i);
    const f = Math.max(0, Math.min(1, (y + 0.18) / (2.95 * s)));
    const center = trunkCurve.getPoint(f);
    const taper = f < 0.16 ? 1.55 - f * 2.6 : 1.12 - f * 0.62;
    tPos.setXYZ(
      i,
      center.x + (tPos.getX(i) - center.x) * taper,
      y,
      center.z + (tPos.getZ(i) - center.z) * taper
    );
  }
  trunkGeo.computeVertexNormals();

  // 4 organic secondary spreading limbs + blossom cluster centers
  const branchGeos: THREE.TubeGeometry[] = [];
  const blossomClusters: { pos: [number, number, number]; radius: number; tint: string }[] = [];
  const pinkPalette = ['#f8c3d4', '#f3a4be', '#fce0ea', '#ee92b1', '#fbd0df'];

  const forkBase = trunkCurve.getPoint(0.76);
  const topPoint = trunkCurve.getPoint(1.0);

  for (let b = 0; b < 4; b++) {
    const ang = (b / 4) * Math.PI * 2 + rand() * 0.65;
    const reach = (1.15 + rand() * 0.65) * s;
    const lift = (0.65 + rand() * 0.55) * s;
    const startPt = b === 0 ? topPoint : forkBase;
    const midPt = new THREE.Vector3(
      startPt.x + Math.cos(ang) * reach * 0.55,
      startPt.y + lift * 0.62,
      startPt.z + Math.sin(ang) * reach * 0.55
    );
    const endPt = new THREE.Vector3(
      startPt.x + Math.cos(ang) * reach,
      startPt.y + lift,
      startPt.z + Math.sin(ang) * reach
    );
    const bCurve = new THREE.CatmullRomCurve3([startPt, midPt, endPt]);
    branchGeos.push(new THREE.TubeGeometry(bCurve, 8, 0.085 * s, 6, false));

    // Clustered painterly blossom clouds around each branch tip & mid-canopy
    const clusterCount = 4;
    for (let c = 0; c < clusterCount; c++) {
      const ca = (c / clusterCount) * Math.PI * 2 + rand() * 0.9;
      const cd = (0.28 + rand() * 0.45) * s;
      blossomClusters.push({
        pos: [
          endPt.x + Math.cos(ca) * cd,
          endPt.y + (rand() - 0.3) * 0.42 * s,
          endPt.z + Math.sin(ca) * cd,
        ],
        radius: (0.48 + rand() * 0.32) * s,
        tint: pinkPalette[Math.floor(rand() * pinkPalette.length)],
      });
    }
  }

  // Crown canopy clusters above the trunk apex
  for (let c = 0; c < 4; c++) {
    blossomClusters.push({
      pos: [
        topPoint.x + (rand() - 0.5) * 0.75 * s,
        topPoint.y + (0.45 + rand() * 0.45) * s,
        topPoint.z + (rand() - 0.5) * 0.75 * s,
      ],
      radius: (0.58 + rand() * 0.28) * s,
      tint: pinkPalette[Math.floor(rand() * pinkPalette.length)],
    });
  }

  return { trunkGeo, branchGeos, blossomClusters };
}

function buildMushroomGeometries() {
  // Fluted organic stem via LatheGeometry
  const stemPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.24, 0.0),
    new THREE.Vector2(0.2, 0.16),
    new THREE.Vector2(0.13, 0.52),
    new THREE.Vector2(0.11, 0.88),
    new THREE.Vector2(0.17, 1.05),
    new THREE.Vector2(0.0, 1.08),
  ];
  const stemGeo = new THREE.LatheGeometry(stemPts, 14);
  stemGeo.computeVertexNormals();

  // Domed scalloped cap via LatheGeometry
  const capPts = [
    new THREE.Vector2(0.0, 0.52),
    new THREE.Vector2(0.26, 0.49),
    new THREE.Vector2(0.54, 0.38),
    new THREE.Vector2(0.76, 0.2),
    new THREE.Vector2(0.84, 0.04),
    new THREE.Vector2(0.76, -0.02),
    new THREE.Vector2(0.14, 0.08),
  ];
  const capGeo = new THREE.LatheGeometry(capPts, 18);
  capGeo.computeVertexNormals();

  // Glowing pleated gill underside disc
  const gillGeo = new THREE.ConeGeometry(0.76, 0.16, 18, 1, true);
  gillGeo.rotateX(Math.PI);

  return { stemGeo, capGeo, gillGeo };
}

interface MushroomSpec {
  x: number;
  z: number;
  scale: number;
  tiltX: number;
  tiltZ: number;
  palette: 'cyan' | 'violet' | 'amber';
}

const MUSHROOMS: MushroomSpec[] = [
  // Giant glowing mushroom grove beside the turquoise spring pool
  { x: 2.65, z: -2.05, scale: 1.25, tiltX: 0.08, tiltZ: -0.1, palette: 'cyan' },
  { x: 3.12, z: -1.62, scale: 0.82, tiltX: -0.1, tiltZ: 0.14, palette: 'violet' },
  { x: 2.38, z: -2.52, scale: 0.64, tiltX: 0.12, tiltZ: 0.06, palette: 'cyan' },
  // Western meadow glowing mushrooms near the stepping path
  { x: -3.25, z: 3.15, scale: 1.15, tiltX: -0.08, tiltZ: 0.12, palette: 'violet' },
  { x: -2.75, z: 3.48, scale: 0.72, tiltX: 0.12, tiltZ: -0.08, palette: 'cyan' },
  { x: -3.62, z: 2.82, scale: 0.58, tiltX: -0.05, tiltZ: -0.14, palette: 'amber' },
  // Eastern cliffside mushrooms near bridge
  { x: 2.55, z: 3.25, scale: 0.98, tiltX: 0.09, tiltZ: -0.11, palette: 'cyan' },
  { x: 2.95, z: 2.85, scale: 0.62, tiltX: -0.12, tiltZ: 0.08, palette: 'amber' },
  // Upper plateau beside observatory steps
  { x: -0.55, z: -3.25, scale: 0.92, tiltX: 0.07, tiltZ: 0.09, palette: 'violet' },
  { x: -0.18, z: -2.85, scale: 0.56, tiltX: -0.08, tiltZ: -0.1, palette: 'cyan' },
];

interface BoulderSpec {
  x: number;
  z: number;
  scale: [number, number, number];
  rot: [number, number, number];
  hasRune?: boolean;
}

const BOULDERS: BoulderSpec[] = [
  { x: 0.95, z: -2.65, scale: [1.15, 0.85, 0.95], rot: [0.1, 0.6, 0.12] },
  { x: 2.25, z: -2.95, scale: [0.82, 0.62, 0.75], rot: [-0.15, 1.4, 0.1] },
  { x: 4.85, z: 1.25, scale: [1.05, 0.72, 0.88], rot: [0.12, 2.2, -0.08] },
  { x: -5.35, z: 0.55, scale: [1.22, 0.86, 1.0], rot: [-0.08, 0.9, 0.15] },
  { x: -1.45, z: 4.85, scale: [0.95, 0.68, 0.85], rot: [0.1, 3.1, -0.1] },
  { x: 2.35, z: 5.15, scale: [0.85, 0.62, 0.78], rot: [0.18, 0.4, 0.1] },
  // Ancient carved standing runestones
  { x: 4.35, z: -2.25, scale: [0.42, 1.38, 0.34], rot: [0.06, -0.55, -0.05], hasRune: true },
  { x: -4.85, z: 4.15, scale: [0.38, 1.18, 0.32], rot: [-0.05, 0.7, 0.06], hasRune: true },
];

export default function FloraAndProps({
  textures,
  atmosphereRef,
}: FloraAndPropsProps) {
  const treeBuilt = useMemo(() => CHERRY_TREES.map(buildCherryTreeGeometries), []);
  const { stemGeo, capGeo, gillGeo } = useMemo(() => buildMushroomGeometries(), []);

  // Organic displaced blossom puff geometry shared across all sakura clusters
  const blossomPuffGeo = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const pos = geo.attributes.position;
    const rand = mulberry32(6061);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const bump = 0.84 + 0.24 * Math.sin(x * 4.2 + y * 3.1) * Math.cos(z * 4.0) + (rand() - 0.5) * 0.08;
      pos.setXYZ(i, x * bump, y * bump * 0.72, z * bump);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Displaced boulder geometry shared across boulders
  const boulderGeo = useMemo(() => {
    const geo = new THREE.DodecahedronGeometry(1, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const n = 0.86 + 0.22 * Math.sin(x * 3.1 + z * 2.7) * Math.cos(y * 3.5);
      pos.setXYZ(i, x * n, y * n, z * n);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Shared bioluminescent mushroom materials (updated smoothly in useFrame)
  const mushroomMats = useMemo(
    () => ({
      cyan: new THREE.MeshStandardMaterial({
        color: '#4de2d5',
        emissive: '#1de0d0',
        emissiveIntensity: 0.55,
        roughness: 0.36,
        metalness: 0.06,
      }),
      violet: new THREE.MeshStandardMaterial({
        color: '#a78bfa',
        emissive: '#7c5cf6',
        emissiveIntensity: 0.55,
        roughness: 0.38,
        metalness: 0.06,
      }),
      amber: new THREE.MeshStandardMaterial({
        color: '#f5b864',
        emissive: '#f08e2b',
        emissiveIntensity: 0.5,
        roughness: 0.38,
        metalness: 0.06,
      }),
      gill: new THREE.MeshStandardMaterial({
        color: '#c9fff9',
        emissive: '#6ef7eb',
        emissiveIntensity: 0.75,
        roughness: 0.35,
        side: THREE.DoubleSide,
      }),
      rune: new THREE.MeshStandardMaterial({
        color: '#9cf7ef',
        emissive: '#35e8d8',
        emissiveIntensity: 0.4,
        roughness: 0.2,
      }),
    }),
    []
  );

  // Instanced grass tufts & wildflowers data
  const grassCount = 380;
  const grassInstRef = useRef<THREE.InstancedMesh>(null);
  const flowerCount = 85;
  const flowerInstRef = useRef<THREE.InstancedMesh>(null);

  // Drifting cherry blossom petals
  const petalCount = 140;
  const petalInstRef = useRef<THREE.InstancedMesh>(null);
  const petalSeeds = useMemo(() => {
    const rand = mulberry32(4499);
    return Array.from({ length: petalCount }, () => ({
      x: (rand() - 0.5) * 13.5,
      y: 0.8 + rand() * 6.5,
      z: (rand() - 0.5) * 12.5,
      speedY: 0.25 + rand() * 0.32,
      driftX: 0.22 + rand() * 0.35,
      phase: rand() * Math.PI * 2,
      scale: 0.055 + rand() * 0.05,
    }));
  }, []);

  const canopyRefs = useRef<(THREE.Group | null)[]>([]);
  const mushroomLightRef = useRef<THREE.PointLight>(null);

  // Populate instanced grass tufts and meadow flowers flush with terrain height
  useEffect(() => {
    const rand = mulberry32(7719);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const g1 = new THREE.Color('#3f7235');
    const g2 = new THREE.Color('#74a846');
    const g3 = new THREE.Color('#53893d');

    if (grassInstRef.current) {
      let placed = 0;
      let attempts = 0;
      while (placed < grassCount && attempts < 2200) {
        attempts++;
        const ang = rand() * Math.PI * 2;
        const maxR = getIslandRimRadius(ang) * 0.91;
        const r = Math.sqrt(rand()) * maxR;
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;

        // Avoid observatory tower footprint and stream channel
        if (Math.hypot(x + 2.35, z + 1.75) < 2.65) continue;
        if (getStreamInfluence(x, z) > 0.35) continue;

        const y = getTerrainHeight(x, z);
        dummy.position.set(x, y + 0.08, z);
        dummy.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3);
        const h = 0.16 + rand() * 0.24;
        const w = 0.08 + rand() * 0.08;
        dummy.scale.set(w, h, w);
        dummy.updateMatrix();
        grassInstRef.current.setMatrixAt(placed, dummy.matrix);

        const pick = rand();
        col.copy(pick < 0.33 ? g1 : pick < 0.66 ? g2 : g3);
        grassInstRef.current.setColorAt(placed, col);
        placed++;
      }
      grassInstRef.current.count = placed;
      grassInstRef.current.instanceMatrix.needsUpdate = true;
      if (grassInstRef.current.instanceColor) {
        grassInstRef.current.instanceColor.needsUpdate = true;
      }
      grassInstRef.current.computeBoundingSphere();
    }

    if (flowerInstRef.current) {
      const fColors = [
        new THREE.Color('#f9cad9'),
        new THREE.Color('#fff1b8'),
        new THREE.Color('#95f5ec'),
        new THREE.Color('#d6bcfa'),
      ];
      let placed = 0;
      let attempts = 0;
      while (placed < flowerCount && attempts < 1000) {
        attempts++;
        const ang = rand() * Math.PI * 2;
        const maxR = getIslandRimRadius(ang) * 0.88;
        const r = Math.sqrt(rand()) * maxR;
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;
        if (Math.hypot(x + 2.35, z + 1.75) < 2.75) continue;
        if (getStreamInfluence(x, z) > 0.28) continue;

        const y = getTerrainHeight(x, z);
        dummy.position.set(x, y + 0.11, z);
        dummy.rotation.set(0, rand() * Math.PI * 2, 0);
        const sc = 0.055 + rand() * 0.045;
        dummy.scale.set(sc, sc * 0.7, sc);
        dummy.updateMatrix();
        flowerInstRef.current.setMatrixAt(placed, dummy.matrix);
        flowerInstRef.current.setColorAt(placed, fColors[placed % fColors.length]);
        placed++;
      }
      flowerInstRef.current.count = placed;
      flowerInstRef.current.instanceMatrix.needsUpdate = true;
      if (flowerInstRef.current.instanceColor) {
        flowerInstRef.current.instanceColor.needsUpdate = true;
      }
      flowerInstRef.current.computeBoundingSphere();
    }
  }, []);

  const mushroomMatsRef = useRef<typeof mushroomMats | null>(null);
  const scratchDummyRef = useRef(new THREE.Object3D());

  useEffect(() => {
    mushroomMatsRef.current = mushroomMats;
    return () => {
      mushroomMatsRef.current = null;
      treeBuilt.forEach((tb) => {
        tb.trunkGeo.dispose();
        tb.branchGeos.forEach((bg) => bg.dispose());
      });
      stemGeo.dispose();
      capGeo.dispose();
      gillGeo.dispose();
      blossomPuffGeo.dispose();
      boulderGeo.dispose();
      Object.values(mushroomMats).forEach((m) => m.dispose());
    };
  }, [treeBuilt, stemGeo, capGeo, gillGeo, blossomPuffGeo, boulderGeo, mushroomMats]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const nf = atmosphereRef.current.nightFactor;

    // Gentle breeze swaying cherry blossom canopies
    for (let i = 0; i < canopyRefs.current.length; i++) {
      const grp = canopyRefs.current[i];
      if (!grp) continue;
      grp.rotation.z = Math.sin(t * 0.85 + i * 1.4) * 0.024;
      grp.rotation.x = Math.cos(t * 0.65 + i * 1.9) * 0.018;
    }

    // Bioluminescent mushrooms & carved runes brighten richly at night
    const breathe = 0.9 + Math.sin(t * 1.65) * 0.1;
    const mMats = mushroomMatsRef.current;
    if (mMats) {
      mMats.cyan.emissiveIntensity = (0.38 + nf * 2.1) * breathe;
      mMats.violet.emissiveIntensity = (0.35 + nf * 2.0) * breathe;
      mMats.amber.emissiveIntensity = (0.35 + nf * 1.95) * breathe;
      mMats.gill.emissiveIntensity = (0.5 + nf * 2.4) * breathe;
      mMats.rune.emissiveIntensity = (0.18 + nf * 2.6) * breathe;
    }

    if (mushroomLightRef.current) {
      mushroomLightRef.current.intensity = (0.6 + nf * 4.2) * breathe;
    }

    // Fluttering drifting cherry blossom petals
    if (petalInstRef.current) {
      const scratchDummy = scratchDummyRef.current;
      for (let i = 0; i < petalCount; i++) {
        const p = petalSeeds[i];
        const yRange = 7.2;
        const y = ((p.y - t * p.speedY) % yRange + yRange) % yRange + 0.15;
        const x = p.x + Math.sin(t * 0.75 + p.phase) * 0.85 + ((t * p.driftX) % 4) - 2;
        const z = p.z + Math.cos(t * 0.62 + p.phase) * 0.75;
        scratchDummy.position.set(x, y, z);
        scratchDummy.rotation.set(
          t * 1.3 + p.phase,
          t * 0.9 + p.phase * 1.4,
          t * 1.1 + p.phase * 0.7
        );
        scratchDummy.scale.set(p.scale, p.scale * 0.35, p.scale * 0.72);
        scratchDummy.updateMatrix();
        petalInstRef.current.setMatrixAt(i, scratchDummy.matrix);
      }
      petalInstRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="flora-and-props">
      {/* 1. Sculpted Hero Cherry Blossom Trees */}
      <group name="cherry-blossom-trees">
        {CHERRY_TREES.map((spec, idx) => {
          const baseY = getTerrainHeight(spec.x, spec.z) - 0.08;
          const built = treeBuilt[idx];
          return (
            <group
              key={idx}
              position={[spec.x, baseY, spec.z]}
              rotation={[0, spec.rotY, 0]}
            >
              {/* Gnarled Primary Trunk */}
              <mesh geometry={built.trunkGeo} castShadow receiveShadow>
                <meshStandardMaterial
                  color="#54382f"
                  map={textures.barkMap}
                  bumpMap={textures.barkBump}
                  bumpScale={0.14}
                  roughness={0.92}
                />
              </mesh>
              {/* Secondary Twisting Branches */}
              {built.branchGeos.map((bg, bIdx) => (
                <mesh key={bIdx} geometry={bg} castShadow receiveShadow>
                  <meshStandardMaterial
                    color="#5b3e34"
                    map={textures.barkMap}
                    roughness={0.9}
                  />
                </mesh>
              ))}
              {/* Swaying Layered Sakura Blossom Canopy */}
              <group
                ref={(el) => {
                  canopyRefs.current[idx] = el;
                }}
              >
                {built.blossomClusters.map((cl, cIdx) => (
                  <mesh
                    key={cIdx}
                    geometry={blossomPuffGeo}
                    position={cl.pos}
                    scale={cl.radius}
                    castShadow
                    receiveShadow
                  >
                    <meshStandardMaterial
                      color={cl.tint}
                      roughness={0.82}
                      metalness={0.02}
                    />
                  </mesh>
                ))}
              </group>
            </group>
          );
        })}
      </group>

      {/* 2. Giant Glowing Bioluminescent Mushrooms */}
      <group name="glowing-mushrooms">
        {MUSHROOMS.map((m, idx) => {
          const y = getTerrainHeight(m.x, m.z) - 0.05;
          const capMat = mushroomMats[m.palette];
          return (
            <group
              key={idx}
              position={[m.x, y, m.z]}
              rotation={[m.tiltX, idx * 1.1, m.tiltZ]}
              scale={m.scale}
            >
              {/* Fluted Cream Stem */}
              <mesh geometry={stemGeo} castShadow receiveShadow>
                <meshStandardMaterial color="#e8decb" roughness={0.78} metalness={0.02} />
              </mesh>
              {/* Glowing Domed Cap */}
              <mesh geometry={capGeo} material={capMat} position={[0, 0.96, 0]} castShadow />
              {/* Glowing Pleated Gill Underside */}
              <mesh geometry={gillGeo} material={mushroomMats.gill} position={[0, 1.0, 0]} />
              {/* Luminous Cap Spots */}
              {[0, 1.4, 2.8, 4.3, 5.5].map((a, sIdx) => (
                <mesh
                  key={sIdx}
                  position={[
                    Math.cos(a) * (0.28 + (sIdx % 2) * 0.22),
                    1.28 - (sIdx % 2) * 0.12,
                    Math.sin(a) * (0.28 + (sIdx % 2) * 0.22),
                  ]}
                  scale={[0.09, 0.05, 0.09]}
                >
                  <sphereGeometry args={[1, 8, 6]} />
                  <meshStandardMaterial
                    color="#f2ffff"
                    emissive="#aefcf4"
                    emissiveIntensity={1.2}
                    roughness={0.25}
                  />
                </mesh>
              ))}
            </group>
          );
        })}
        <pointLight
          ref={mushroomLightRef}
          position={[2.75, 2.35, -1.9]}
          color="#5df5e8"
          intensity={1.2}
          distance={7.5}
          decay={2}
        />
      </group>

      {/* 3. Moss-Draped Boulders & Carved Ancient Runestones */}
      <group name="boulders-and-runestones">
        {BOULDERS.map((b, idx) => {
          const y = getTerrainHeight(b.x, b.z) + b.scale[1] * 0.32 - 0.14;
          return (
            <group key={idx} position={[b.x, y, b.z]} rotation={b.rot}>
              <mesh geometry={boulderGeo} scale={b.scale} castShadow receiveShadow>
                <meshStandardMaterial
                  color={b.hasRune ? '#767a84' : '#7d7872'}
                  map={textures.cliffMap}
                  bumpMap={textures.cliffBump}
                  bumpScale={0.22}
                  roughness={0.92}
                  metalness={0.05}
                />
              </mesh>
              {/* Soft Moss Cap on Top of Regular Boulders */}
              {!b.hasRune && (
                <mesh
                  position={[0, b.scale[1] * 0.62, 0]}
                  scale={[b.scale[0] * 0.72, b.scale[1] * 0.28, b.scale[2] * 0.72]}
                >
                  <sphereGeometry args={[1, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                  <meshStandardMaterial
                    color="#588a41"
                    map={textures.mossMap}
                    roughness={0.86}
                  />
                </mesh>
              )}
              {/* Faint Glowing Carved Rune Glyph on Standing Monoliths */}
              {b.hasRune && (
                <mesh
                  material={mushroomMats.rune}
                  position={[0, 0.15, b.scale[2] * 0.94]}
                >
                  <planeGeometry args={[0.16, 0.55]} />
                </mesh>
              )}
            </group>
          );
        })}
      </group>

      {/* 4. Instanced Lush Grass Tufts */}
      <instancedMesh ref={grassInstRef} args={[undefined, undefined, grassCount]} receiveShadow>
        <coneGeometry args={[1, 1.5, 4]} />
        <meshStandardMaterial roughness={0.85} metalness={0.02} />
      </instancedMesh>

      {/* 5. Instanced Tiny Meadow Wildflowers */}
      <instancedMesh ref={flowerInstRef} args={[undefined, undefined, flowerCount]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.65} metalness={0.04} />
      </instancedMesh>

      {/* 6. Drifting Cherry Blossom Petals */}
      <instancedMesh
        ref={petalInstRef}
        args={[undefined, undefined, petalCount]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color="#ffd4e3"
          emissive="#f5a4be"
          emissiveIntensity={0.22}
          roughness={0.65}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </group>
  );
}
