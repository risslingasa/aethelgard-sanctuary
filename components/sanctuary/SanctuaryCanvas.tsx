'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import AtmosphereAndParticles from './AtmosphereAndParticles';
import IslandTerrain from './IslandTerrain';
import ObservatoryTower from './ObservatoryTower';
import WaterSystem from './WaterSystem';
import FloraAndProps from './FloraAndProps';
import { createProceduralTextureSet } from './proceduralTextures';
import {
  VIEWPOINTS,
  type AtmosphereMode,
  type SharedAtmosphereState,
  type ViewpointId,
} from './types';

interface SanctuaryCanvasProps {
  mode: AtmosphereMode;
  activeViewpoint: ViewpointId | null;
  autoOrbit: boolean;
  onManualCameraControl: () => void;
}

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

interface CameraRigProps {
  activeViewpoint: ViewpointId | null;
  autoOrbit: boolean;
  isSoftwareGl: boolean;
  onManualCameraControl: () => void;
}

function CameraRig({
  activeViewpoint,
  autoOrbit,
  isSoftwareGl,
  onManualCameraControl,
}: CameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const desiredPosRef = useRef(new THREE.Vector3(13.5, 7.6, 17.5));
  const desiredTargetRef = useRef(new THREE.Vector3(0.0, 0.8, 0.2));
  const isGlidingRef = useRef(false);

  useEffect(() => {
    if (!activeViewpoint) {
      isGlidingRef.current = false;
      return;
    }
    const preset = VIEWPOINTS.find((v) => v.id === activeViewpoint);
    if (!preset) return;
    desiredPosRef.current.set(...preset.position);
    desiredTargetRef.current.set(...preset.target);
    isGlidingRef.current = true;
  }, [activeViewpoint]);

  useFrame((frameState, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const controls = controlsRef.current;
    if (!controls) return;

    if (isGlidingRef.current) {
      const cam = frameState.camera;
      const desiredPos = desiredPosRef.current;
      const desiredTarget = desiredTargetRef.current;
      const lambda = 4.2;

      cam.position.set(
        THREE.MathUtils.damp(cam.position.x, desiredPos.x, lambda, dt),
        THREE.MathUtils.damp(cam.position.y, desiredPos.y, lambda, dt),
        THREE.MathUtils.damp(cam.position.z, desiredPos.z, lambda, dt)
      );

      controls.target.set(
        THREE.MathUtils.damp(controls.target.x, desiredTarget.x, lambda, dt),
        THREE.MathUtils.damp(controls.target.y, desiredTarget.y, lambda, dt),
        THREE.MathUtils.damp(controls.target.z, desiredTarget.z, lambda, dt)
      );

      if (
        cam.position.distanceToSquared(desiredPos) < 0.008 &&
        controls.target.distanceToSquared(desiredTarget) < 0.008
      ) {
        isGlidingRef.current = false;
      }
    }
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping={!isSoftwareGl}
      dampingFactor={0.055}
      rotateSpeed={0.78}
      zoomSpeed={0.85}
      minDistance={9.5}
      maxDistance={36}
      minPolarAngle={0.22}
      maxPolarAngle={Math.PI * 0.72}
      autoRotate={autoOrbit && !isSoftwareGl}
      autoRotateSpeed={0.55}
      target={[0, 0.8, 0.2]}
      onStart={() => {
        // Immediately yield scripted camera glide whenever user drags or zooms
        if (isGlidingRef.current) {
          isGlidingRef.current = false;
        }
        onManualCameraControl();
      }}
    />
  );
}

interface FloatingWorldProps {
  mode: AtmosphereMode;
  isSoftwareGl: boolean;
}

function FloatingWorld({ mode, isSoftwareGl }: FloatingWorldProps) {
  const { gl } = useThree();
  const islandGroupRef = useRef<THREE.Group>(null);
  const atmosphereRef = useRef<SharedAtmosphereState>({
    nightFactor: mode === 'night' ? 1 : 0,
    targetNight: mode === 'night' ? 1 : 0,
  });

  useEffect(() => {
    atmosphereRef.current.targetNight = mode === 'night' ? 1 : 0;
  }, [mode]);

  const textures = useMemo(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    return createProceduralTextureSet(maxAniso);
  }, [gl]);

  useEffect(() => {
    return () => {
      textures.dispose();
    };
  }, [textures]);

  // Subtle idle floating bobbing animation on the main sanctuary island
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (islandGroupRef.current) {
      islandGroupRef.current.position.y = Math.sin(t * 0.62) * 0.24;
      islandGroupRef.current.rotation.z = Math.sin(t * 0.35) * 0.008;
      islandGroupRef.current.rotation.x = Math.cos(t * 0.28) * 0.006;
    }
  });

  return (
    <>
      <AtmosphereAndParticles
        atmosphereRef={atmosphereRef}
        isSoftwareGl={isSoftwareGl}
      />
      <group ref={islandGroupRef} name="floating-sanctuary-diorama">
        <IslandTerrain textures={textures} atmosphereRef={atmosphereRef} />
        <ObservatoryTower textures={textures} atmosphereRef={atmosphereRef} />
        <WaterSystem textures={textures} atmosphereRef={atmosphereRef} />
        <FloraAndProps textures={textures} atmosphereRef={atmosphereRef} />
      </group>
    </>
  );
}

export default function SanctuaryCanvas({
  mode,
  activeViewpoint,
  autoOrbit,
  onManualCameraControl,
}: SanctuaryCanvasProps) {
  const [isSoftwareGl] = useState<boolean>(() => detectSoftwareWebGL());
  const [contextLost, setContextLost] = useState(false);

  return (
    <div className="relative h-full w-full select-none">
      {contextLost ? (
        <div className="flex h-full w-full items-center justify-center bg-[#12192e] text-stone-200">
          <div className="max-w-sm rounded-xl border border-white/15 bg-[#19223b] px-6 py-5 text-center">
            <p className="font-serif text-xl font-semibold text-stone-100">
              Aethelgard Sanctuary
            </p>
            <p className="mt-2 text-sm text-stone-300">
              WebGL rendering context paused. Restoring the 3D scene…
            </p>
          </div>
        </div>
      ) : (
        <Canvas
          shadows={!isSoftwareGl}
          dpr={isSoftwareGl ? 1 : [1, 2]}
          camera={{ position: [13.5, 7.6, 17.5], fov: 40, near: 0.2, far: 240 }}
          gl={{
            antialias: !isSoftwareGl,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.08,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement;
            const handleLost = (e: Event) => {
              e.preventDefault();
              setContextLost(true);
            };
            const handleRestored = () => {
              setContextLost(false);
            };
            canvas.addEventListener('webglcontextlost', handleLost, false);
            canvas.addEventListener('webglcontextrestored', handleRestored, false);
          }}
        >
          <FloatingWorld mode={mode} isSoftwareGl={isSoftwareGl} />
          <CameraRig
            activeViewpoint={activeViewpoint}
            autoOrbit={autoOrbit}
            isSoftwareGl={isSoftwareGl}
            onManualCameraControl={onManualCameraControl}
          />
        </Canvas>
      )}
    </div>
  );
}
