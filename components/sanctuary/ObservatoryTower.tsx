'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getTerrainHeight } from './terrainMath';
import type { ProceduralTextureSet } from './proceduralTextures';
import type { SharedAtmosphereState } from './types';

interface ObservatoryTowerProps {
  textures: ProceduralTextureSet;
  atmosphereRef: React.MutableRefObject<SharedAtmosphereState>;
}

const TOWER_X = -2.35;
const TOWER_Z = -1.75;

export default function ObservatoryTower({
  textures,
  atmosphereRef,
}: ObservatoryTowerProps) {
  const baseY = useMemo(() => getTerrainHeight(TOWER_X, TOWER_Z) - 0.18, []);

  const ringOuterRef = useRef<THREE.Mesh>(null);
  const ringInnerRef = useRef<THREE.Mesh>(null);
  const starCrystalRef = useRef<THREE.Mesh>(null);
  const towerLightRef = useRef<THREE.PointLight>(null);
  const doorLightRef = useRef<THREE.PointLight>(null);
  const smokeRefs = useRef<(THREE.Mesh | null)[]>([]);

  const sharedGlowMats = useMemo(
    () => ({
      stainedGlass: new THREE.MeshStandardMaterial({
        map: textures.stainedGlassMap,
        emissive: new THREE.Color('#ffaa42'),
        emissiveMap: textures.stainedGlassMap,
        emissiveIntensity: 1.0,
        roughness: 0.22,
        metalness: 0.1,
      }),
      lantern: new THREE.MeshStandardMaterial({
        color: '#fff0bc',
        emissive: new THREE.Color('#ffaa3d'),
        emissiveIntensity: 1.3,
        roughness: 0.22,
      }),
      crystal: new THREE.MeshStandardMaterial({
        color: '#d2fffb',
        emissive: new THREE.Color('#4af0df'),
        emissiveIntensity: 1.4,
        roughness: 0.12,
        metalness: 0.1,
      }),
    }),
    [textures.stainedGlassMap]
  );

  const glowMatsRef = useRef<typeof sharedGlowMats | null>(null);

  React.useEffect(() => {
    glowMatsRef.current = sharedGlowMats;
    return () => {
      glowMatsRef.current = null;
      sharedGlowMats.stainedGlass.dispose();
      sharedGlowMats.lantern.dispose();
      sharedGlowMats.crystal.dispose();
    };
  }, [sharedGlowMats]);

  // Curved arched stained-glass window geometry
  const windowAngles = useMemo(() => [0.2, 1.35, 2.55, 3.85, 5.05], []);
  const buttressAngles = useMemo(
    () => Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + 0.35),
    []
  );
  const balconyPosts = useMemo(
    () => Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const nf = atmosphereRef.current.nightFactor;

    // Rotating engraved brass celestial armillary rings at observatory apex
    if (ringOuterRef.current) {
      ringOuterRef.current.rotation.y = t * 0.38;
      ringOuterRef.current.rotation.x = 0.45 + Math.sin(t * 0.3) * 0.12;
    }
    if (ringInnerRef.current) {
      ringInnerRef.current.rotation.y = -t * 0.62;
      ringInnerRef.current.rotation.z = 0.65 + Math.cos(t * 0.4) * 0.15;
    }
    if (starCrystalRef.current) {
      starCrystalRef.current.rotation.y = t * 0.9;
      starCrystalRef.current.position.y = 8.45 + Math.sin(t * 2.1) * 0.08;
    }

    // Warm stained-glass windows and hearth lanterns come alive smoothly at night
    const flicker = 0.95 + Math.sin(t * 4.2) * 0.03 + Math.sin(t * 7.1) * 0.02;
    const mats = glowMatsRef.current;
    if (mats) {
      mats.stainedGlass.emissiveIntensity = (0.72 + nf * 2.55) * flicker;
      mats.lantern.emissiveIntensity = (1.1 + nf * 2.75) * flicker;
      mats.crystal.emissiveIntensity = 1.0 + nf * 2.9;
    }

    if (towerLightRef.current) {
      towerLightRef.current.intensity = (1.8 + nf * 8.5) * flicker;
    }
    if (doorLightRef.current) {
      doorLightRef.current.intensity = (1.2 + nf * 5.2) * flicker;
    }

    // Subtle rising chimney smoke puffs
    for (let i = 0; i < 4; i++) {
      const puff = smokeRefs.current[i];
      if (!puff) continue;
      const cycle = (t * 0.28 + i * 0.25) % 1;
      puff.position.set(
        1.15 + Math.sin(t * 0.9 + i) * 0.18 + cycle * 0.45,
        5.9 + cycle * 2.1,
        -0.88 + Math.cos(t * 0.7 + i) * 0.12
      );
      const sc = 0.14 + cycle * 0.34;
      puff.scale.setScalar(sc);
      const mat = puff.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.sin(cycle * Math.PI) * (0.34 - nf * 0.1);
    }
  });

  return (
    <group name="wizards-observatory-tower" position={[TOWER_X, baseY, TOWER_Z]} rotation={[0, 0.38, 0]}>
      {/* 1. Stepped Cut-Stone Octagonal Foundation Plinth */}
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.12, 2.38, 0.68, 8]} />
        <meshStandardMaterial
          color="#8f8980"
          map={textures.masonryMap}
          bumpMap={textures.masonryBump}
          bumpScale={0.14}
          roughness={0.9}
          metalness={0.04}
        />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.92, 2.06, 0.24, 12]} />
        <meshStandardMaterial
          color="#9e978d"
          map={textures.masonryMap}
          roughness={0.86}
          metalness={0.04}
        />
      </mesh>

      {/* 2. Battered Stone Lower Tower Drum */}
      <mesh position={[0, 2.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.48, 1.82, 2.9, 14]} />
        <meshStandardMaterial
          color="#a8a095"
          map={textures.masonryMap}
          bumpMap={textures.masonryBump}
          bumpScale={0.16}
          roughness={0.88}
          metalness={0.04}
        />
      </mesh>

      {/* Stone Buttresses reinforcing the lower drum */}
      {buttressAngles.map((ang, i) => (
        <group key={i} rotation={[0, ang, 0]}>
          <mesh position={[1.66, 1.55, 0]} rotation={[0, 0, 0.11]} castShadow receiveShadow>
            <boxGeometry args={[0.38, 2.15, 0.36]} />
            <meshStandardMaterial
              color="#8d877e"
              map={textures.masonryMap}
              roughness={0.9}
              metalness={0.04}
            />
          </mesh>
          <mesh position={[1.56, 2.68, 0]} rotation={[0, 0, 0.45]} castShadow>
            <boxGeometry args={[0.36, 0.24, 0.38]} />
            <meshStandardMaterial color="#7a756e" roughness={0.88} />
          </mesh>
        </group>
      ))}

      {/* 3. Arched Stone Entry Portal, Steps & Warm Hanging Lantern (Facing Front-East) */}
      <group position={[0, 0.55, 1.72]}>
        {/* Stone Porch Steps */}
        <mesh position={[0, 0.08, 0.46]} castShadow receiveShadow>
          <boxGeometry args={[1.18, 0.22, 0.62]} />
          <meshStandardMaterial color="#8f897f" map={textures.masonryMap} roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.1, 0.88]} castShadow receiveShadow>
          <boxGeometry args={[1.38, 0.22, 0.56]} />
          <meshStandardMaterial color="#857f76" map={textures.masonryMap} roughness={0.92} />
        </mesh>
        {/* Stone Door Frame Surround */}
        <mesh position={[0, 0.82, -0.02]} castShadow receiveShadow>
          <boxGeometry args={[1.08, 1.48, 0.38]} />
          <meshStandardMaterial color="#968f84" map={textures.masonryMap} roughness={0.88} />
        </mesh>
        {/* Heavy Oak Entrance Door */}
        <mesh position={[0, 0.72, 0.14]} castShadow>
          <boxGeometry args={[0.74, 1.24, 0.14]} />
          <meshStandardMaterial
            color="#5c3a24"
            map={textures.timberMap}
            bumpMap={textures.timberBump}
            bumpScale={0.1}
            roughness={0.82}
          />
        </mesh>
        {/* Arched Fanlight above Door */}
        <mesh position={[0, 1.32, 0.15]} material={sharedGlowMats.lantern}>
          <circleGeometry args={[0.36, 14, 0, Math.PI]} />
        </mesh>
        {/* Iron Door Ring & Strap Hinges */}
        <mesh position={[0.2, 0.68, 0.23]}>
          <torusGeometry args={[0.06, 0.015, 6, 12]} />
          <meshStandardMaterial color="#c99b49" metalness={0.85} roughness={0.28} />
        </mesh>
        {/* Pitched Timber Porch Awning */}
        <mesh position={[0, 1.72, 0.24]} rotation={[0.42, 0, 0]} castShadow>
          <boxGeometry args={[1.28, 0.1, 0.78]} />
          <meshStandardMaterial color="#384763" map={textures.slateMap} roughness={0.76} />
        </mesh>
        {/* Hanging Wrought-Iron Entry Lantern */}
        <group position={[0.56, 1.32, 0.38]}>
          <mesh position={[-0.12, 0.14, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.28, 6]} />
            <meshStandardMaterial color="#2a282c" metalness={0.78} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.02, 0]} material={sharedGlowMats.lantern}>
            <cylinderGeometry args={[0.09, 0.07, 0.22, 6]} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <coneGeometry args={[0.13, 0.1, 6]} />
            <meshStandardMaterial color="#2b2a30" metalness={0.75} roughness={0.42} />
          </mesh>
        </group>
        <pointLight
          ref={doorLightRef}
          position={[0.55, 1.25, 0.6]}
          color="#ffb152"
          intensity={1.5}
          distance={6.5}
          decay={2}
        />
      </group>

      {/* 4. Stone Cornice & Timber Corbel Brackets */}
      <mesh position={[0, 3.68, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.66, 1.52, 0.22, 14]} />
        <meshStandardMaterial color="#878178" roughness={0.86} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => {
        const ang = (i / 10) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, ang, 0]}>
            <mesh position={[1.64, 3.85, 0]} rotation={[0, 0, -0.48]} castShadow>
              <boxGeometry args={[0.18, 0.62, 0.18]} />
              <meshStandardMaterial
                color="#573926"
                map={textures.timberMap}
                roughness={0.84}
              />
            </mesh>
          </group>
        );
      })}

      {/* 5. Cantilevered Timber-Framed Upper Study Chamber */}
      <mesh position={[0, 4.78, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.82, 1.72, 1.92, 12]} />
        <meshStandardMaterial
          color="#dfd3be"
          bumpMap={textures.masonryBump}
          bumpScale={0.04}
          roughness={0.88}
          metalness={0.02}
        />
      </mesh>
      {/* Horizontal Dark Oak Timber Belt Rings */}
      <mesh position={[0, 3.9, 0]} castShadow>
        <cylinderGeometry args={[1.8, 1.8, 0.18, 12]} />
        <meshStandardMaterial color="#593a26" map={textures.timberMap} roughness={0.82} />
      </mesh>
      <mesh position={[0, 5.66, 0]} castShadow>
        <cylinderGeometry args={[1.9, 1.88, 0.2, 12]} />
        <meshStandardMaterial color="#593a26" map={textures.timberMap} roughness={0.82} />
      </mesh>
      {/* Vertical Half-Timber Studs */}
      {Array.from({ length: 12 }, (_, i) => {
        const ang = (i / 12) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(ang) * 1.78, 4.78, Math.sin(ang) * 1.78]}
            rotation={[0, -ang, 0]}
            castShadow
          >
            <boxGeometry args={[0.14, 1.88, 0.14]} />
            <meshStandardMaterial color="#533622" map={textures.timberMap} roughness={0.84} />
          </mesh>
        );
      })}

      {/* 6. Warm Glowing Stained-Glass Gothic Windows */}
      {windowAngles.map((ang, i) => (
        <group
          key={i}
          position={[Math.cos(ang) * 1.81, 4.82, Math.sin(ang) * 1.81]}
          rotation={[0, -ang + Math.PI / 2, 0]}
        >
          {/* Carved Timber Window Frame */}
          <mesh position={[0, 0, -0.02]} castShadow>
            <boxGeometry args={[0.68, 1.12, 0.14]} />
            <meshStandardMaterial color="#4e3220" map={textures.timberMap} roughness={0.84} />
          </mesh>
          {/* Glowing Stained Glass Pane */}
          <mesh position={[0, 0, 0.06]} material={sharedGlowMats.stainedGlass}>
            <planeGeometry args={[0.52, 0.94]} />
          </mesh>
          {/* Stone Window Sill */}
          <mesh position={[0, -0.58, 0.08]} castShadow>
            <boxGeometry args={[0.78, 0.1, 0.24]} />
            <meshStandardMaterial color="#8f8980" roughness={0.88} />
          </mesh>
        </group>
      ))}

      {/* Warm Interior Radiance Light spilling from observatory study */}
      <pointLight
        ref={towerLightRef}
        position={[0, 4.9, 0.4]}
        color="#ffad4a"
        intensity={2.4}
        distance={11}
        decay={1.8}
      />

      {/* 7. Wrap-Around Timber Observatory Balcony & Brass Telescope */}
      <group position={[0, 3.84, 0]}>
        {/* Balcony Deck Ring */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[2.32, 2.24, 0.14, 16]} />
          <meshStandardMaterial
            color="#69462f"
            map={textures.timberMap}
            roughness={0.84}
          />
        </mesh>
        {/* Top Timber Handrail */}
        <mesh position={[0, 0.52, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[2.24, 0.055, 8, 28]} />
          <meshStandardMaterial color="#593a26" roughness={0.8} />
        </mesh>
        {/* Balustrade Posts */}
        {balconyPosts.map((ang, i) => (
          <mesh
            key={i}
            position={[Math.cos(ang) * 2.24, 0.26, Math.sin(ang) * 2.24]}
            castShadow
          >
            <cylinderGeometry args={[0.036, 0.042, 0.52, 6]} />
            <meshStandardMaterial color="#533623" roughness={0.84} />
          </mesh>
        ))}

        {/* Articulated Brass Astronomical Telescope on Balcony */}
        <group position={[1.95, 0.08, 0.65]} rotation={[0, -0.45, 0]}>
          {/* Tripod Legs */}
          {[-0.22, 0, 0.22].map((off, idx) => (
            <mesh
              key={idx}
              position={[off * 0.5, 0.28, idx === 1 ? -0.14 : 0.12]}
              rotation={[idx === 1 ? 0.28 : -0.22, 0, off * 0.85]}
            >
              <cylinderGeometry args={[0.02, 0.025, 0.62, 6]} />
              <meshStandardMaterial color="#4e3422" roughness={0.8} />
            </mesh>
          ))}
          {/* Brushed Brass Optical Tube */}
          <mesh position={[0.08, 0.68, 0]} rotation={[0, 0, -0.52]} castShadow>
            <cylinderGeometry args={[0.09, 0.055, 0.92, 12]} />
            <meshStandardMaterial color="#d8ab54" metalness={0.92} roughness={0.2} />
          </mesh>
          {/* Brass Objective Lens Rim */}
          <mesh position={[0.31, 0.88, 0]} rotation={[0, 0, -0.52]}>
            <cylinderGeometry args={[0.105, 0.105, 0.1, 12]} />
            <meshStandardMaterial color="#f0c86d" metalness={0.94} roughness={0.16} />
          </mesh>
          {/* Glowing Sapphire Objective Lens */}
          <mesh position={[0.35, 0.91, 0]} rotation={[0, 0, -0.52]}>
            <cylinderGeometry args={[0.085, 0.085, 0.02, 12]} />
            <meshStandardMaterial
              color="#7ee8fa"
              emissive="#39b8d4"
              emissiveIntensity={0.65}
              metalness={0.2}
              roughness={0.08}
            />
          </mesh>
        </group>
      </group>

      {/* 8. Side Library Turret Annex */}
      <group position={[-1.62, 1.55, 0.35]} rotation={[0, -0.4, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.82, 0.92, 2.55, 10]} />
          <meshStandardMaterial
            color="#9e968b"
            map={textures.masonryMap}
            bumpMap={textures.masonryBump}
            bumpScale={0.14}
            roughness={0.89}
          />
        </mesh>
        {/* Annex Lancet Stained-Glass Window */}
        <mesh
          position={[-0.84, 0.25, 0.12]}
          rotation={[0, -Math.PI / 2, 0]}
          material={sharedGlowMats.stainedGlass}
        >
          <planeGeometry args={[0.36, 0.85]} />
        </mesh>
        {/* Annex Conical Slate Cap */}
        <mesh position={[0, 2.02, 0]} castShadow>
          <coneGeometry args={[1.08, 1.65, 10]} />
          <meshStandardMaterial
            color="#354663"
            map={textures.slateMap}
            bumpMap={textures.slateBump}
            bumpScale={0.12}
            roughness={0.72}
            metalness={0.1}
          />
        </mesh>
        <mesh position={[0, 2.9, 0]}>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial color="#d9aa52" metalness={0.9} roughness={0.22} />
        </mesh>
      </group>

      {/* 9. Tall Conical Blue-Slate Roof Spire with Dormer & Stone Chimney */}
      <mesh position={[0, 6.82, 0]} castShadow receiveShadow>
        <coneGeometry args={[2.22, 2.55, 14]} />
        <meshStandardMaterial
          color="#334563"
          map={textures.slateMap}
          bumpMap={textures.slateBump}
          bumpScale={0.14}
          roughness={0.72}
          metalness={0.1}
        />
      </mesh>
      {/* Decorative Brass Roof Collar Trim */}
      <mesh position={[0, 5.74, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.14, 0.05, 8, 28]} />
        <meshStandardMaterial color="#c99b49" metalness={0.88} roughness={0.25} />
      </mesh>

      {/* Roof Dormer Window */}
      <group position={[0.92, 6.28, 0.92]} rotation={[0, Math.PI * 0.25, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.58, 0.62, 0.65]} />
          <meshStandardMaterial color="#d7cab5" roughness={0.86} />
        </mesh>
        <mesh position={[0, 0.42, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[0.52, 0.48, 4]} />
          <meshStandardMaterial color="#2e3f5c" map={textures.slateMap} roughness={0.74} />
        </mesh>
        <mesh position={[0, 0, 0.34]} material={sharedGlowMats.stainedGlass}>
          <planeGeometry args={[0.36, 0.44]} />
        </mesh>
      </group>

      {/* Stone Chimney & Animated Translucent Smoke Wisps */}
      <group position={[1.15, 5.25, -0.88]}>
        <mesh castShadow>
          <boxGeometry args={[0.42, 1.25, 0.42]} />
          <meshStandardMaterial color="#87817a" map={textures.masonryMap} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.68, 0]} castShadow>
          <boxGeometry args={[0.54, 0.14, 0.54]} />
          <meshStandardMaterial color="#706b65" roughness={0.9} />
        </mesh>
      </group>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            smokeRefs.current[i] = el;
          }}
          position={[1.15, 6.2 + i * 0.45, -0.88]}
        >
          <dodecahedronGeometry args={[0.5, 1]} />
          <meshStandardMaterial
            color="#e7e4ec"
            transparent
            opacity={0.26}
            depthWrite={false}
            roughness={1}
          />
        </mesh>
      ))}

      {/* 10. Rotating Celestial Brass Astrolabe & Levitating Star-Crystal Crown */}
      <group name="celestial-astrolabe-crown">
        <mesh position={[0, 8.02, 0]}>
          <cylinderGeometry args={[0.1, 0.24, 0.42, 10]} />
          <meshStandardMaterial color="#cfa04b" metalness={0.92} roughness={0.22} />
        </mesh>
        <mesh ref={ringOuterRef} position={[0, 8.45, 0]} castShadow>
          <torusGeometry args={[0.62, 0.036, 10, 32]} />
          <meshStandardMaterial color="#e0b55c" metalness={0.94} roughness={0.18} />
        </mesh>
        <mesh ref={ringInnerRef} position={[0, 8.45, 0]} castShadow>
          <torusGeometry args={[0.44, 0.028, 10, 28]} />
          <meshStandardMaterial color="#f2cf7c" metalness={0.94} roughness={0.16} />
        </mesh>
        <mesh
          ref={starCrystalRef}
          position={[0, 8.45, 0]}
          scale={[0.16, 0.28, 0.16]}
          material={sharedGlowMats.crystal}
        >
          <octahedronGeometry args={[1, 0]} />
        </mesh>
      </group>
    </group>
  );
}
