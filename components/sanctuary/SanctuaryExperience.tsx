'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import ControlOverlay from './ControlOverlay';
import { AmbientSoundscapeEngine } from './ambientAudio';
import type { AtmosphereMode, ViewpointId } from './types';

const SanctuaryCanvas = dynamic(() => import('./SanctuaryCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#2f426f] via-[#b8717a] to-[#e99f72]">
      <p className="font-serif text-lg tracking-wider text-[#fdf7ef]/90">
        Awakening Aethelgard Sanctuary…
      </p>
    </div>
  ),
});

export default function SanctuaryExperience() {
  const [mode, setMode] = useState<AtmosphereMode>('sunset');
  const [activeViewpoint, setActiveViewpoint] = useState<ViewpointId | null>('overview');
  const [autoOrbit, setAutoOrbit] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [dockOpen, setDockOpen] = useState<boolean>(true);

  const audioRef = useRef<AmbientSoundscapeEngine | null>(null);

  useEffect(() => {
    const engine = new AmbientSoundscapeEngine();
    audioRef.current = engine;
    return () => {
      engine.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioRef.current?.setMode(mode);
  }, [mode]);

  const handleManualCameraControl = useCallback(() => {
    setActiveViewpoint((prev) => (prev !== null ? null : prev));
  }, []);

  const handleSelectViewpoint = useCallback((vp: ViewpointId) => {
    setActiveViewpoint(vp);
  }, []);

  const handleToggleAutoOrbit = useCallback(() => {
    setAutoOrbit((prev) => !prev);
  }, []);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      void audioRef.current?.setEnabled(next);
      return next;
    });
  }, []);

  const handleToggleDock = useCallback(() => {
    setDockOpen((prev) => !prev);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#161c30]">
      <SanctuaryCanvas
        mode={mode}
        activeViewpoint={activeViewpoint}
        autoOrbit={autoOrbit}
        onManualCameraControl={handleManualCameraControl}
      />
      <ControlOverlay
        mode={mode}
        onModeChange={setMode}
        activeViewpoint={activeViewpoint}
        onSelectViewpoint={handleSelectViewpoint}
        autoOrbit={autoOrbit}
        onToggleAutoOrbit={handleToggleAutoOrbit}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        dockOpen={dockOpen}
        onToggleDock={handleToggleDock}
      />
    </main>
  );
}
