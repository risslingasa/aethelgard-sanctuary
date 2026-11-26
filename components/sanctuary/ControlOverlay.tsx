'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, Orbit, ChevronDown, ChevronUp } from 'lucide-react';
import { VIEWPOINTS, type AtmosphereMode, type ViewpointId } from './types';

interface ControlOverlayProps {
  mode: AtmosphereMode;
  onModeChange: (mode: AtmosphereMode) => void;
  activeViewpoint: ViewpointId | null;
  onSelectViewpoint: (vp: ViewpointId) => void;
  autoOrbit: boolean;
  onToggleAutoOrbit: () => void;
  dockOpen: boolean;
  onToggleDock: () => void;
}

export default function ControlOverlay({
  mode,
  onModeChange,
  activeViewpoint,
  onSelectViewpoint,
  autoOrbit,
  onToggleAutoOrbit,
  dockOpen,
  onToggleDock,
}: ControlOverlayProps) {
  const isNight = mode === 'night';

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        onToggleDock();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleDock]);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-5 sm:p-7">
      {/* Minimal Serif Wordmark — Top-Left */}
      <header className="flex items-start justify-between">
        <h1
          className="pointer-events-none select-none font-serif text-2xl font-semibold tracking-[0.04em] text-[#fdf7ef] sm:text-3xl"
          style={{
            textShadow: isNight
              ? '0 2px 18px rgba(4, 10, 26, 0.85)'
              : '0 2px 16px rgba(46, 24, 34, 0.58)',
          }}
        >
          Aethelgard Sanctuary
        </h1>
      </header>

      {/* Collapsible Unified Bottom Control Dock — Zero Viewport Occlusion, No backdrop-filter over WebGL */}
      <div className="pointer-events-none flex flex-col items-center">
        <button
          type="button"
          onClick={onToggleDock}
          aria-expanded={dockOpen}
          aria-label={dockOpen ? 'Hide controls' : 'Show controls'}
          className="pointer-events-auto mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#121828]/88 px-3 py-1 text-xs font-medium text-stone-200 transition-colors duration-150 hover:bg-[#1a2338]/95 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          {dockOpen ? (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="whitespace-nowrap">Hide</span>
            </>
          ) : (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="whitespace-nowrap">Controls</span>
            </>
          )}
        </button>

        <AnimatePresence initial={false}>
          {dockOpen && (
            <motion.nav
              aria-label="Scene atmosphere and camera controls"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto flex max-w-[94vw] flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/14 bg-[#101626]/90 px-3 py-2 shadow-2xl sm:flex-nowrap sm:gap-3 sm:rounded-full sm:px-3.5"
            >
              {/* Floating Pill Toggle: Golden Sunset <-> Starry Aurora Night */}
              <div
                role="group"
                aria-label="Lighting atmosphere"
                className="relative flex items-center rounded-full border border-white/10 bg-[#0a0f1d] p-1"
              >
                <button
                  type="button"
                  onClick={() => onModeChange('sunset')}
                  aria-pressed={!isNight}
                  className={`relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                    !isNight
                      ? 'text-[#1c140e]'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  {!isNight && (
                    <motion.span
                      layoutId="atmosphere-pill-bg"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-[#f7c57c] to-[#f09b63]"
                    />
                  )}
                  <Sun className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Golden Sunset</span>
                </button>

                <button
                  type="button"
                  onClick={() => onModeChange('night')}
                  aria-pressed={isNight}
                  className={`relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 ${
                    isNight
                      ? 'text-[#071a1c]'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  {isNight && (
                    <motion.span
                      layoutId="atmosphere-pill-bg"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-[#5eead4] to-[#818cf8]"
                    />
                  )}
                  <Moon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Aurora Night</span>
                </button>
              </div>

              {/* Subtle Divider */}
              <div className="hidden h-5 w-px bg-white/14 sm:block" aria-hidden="true" />

              {/* Curated Camera Viewpoints */}
              <div
                role="group"
                aria-label="Camera viewpoints"
                className="flex items-center gap-1"
              >
                {VIEWPOINTS.map((vp) => {
                  const isActive = activeViewpoint === vp.id;
                  return (
                    <button
                      key={vp.id}
                      type="button"
                      onClick={() => onSelectViewpoint(vp.id)}
                      aria-pressed={isActive}
                      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                        isActive
                          ? isNight
                            ? 'bg-teal-400/20 text-teal-200'
                            : 'bg-amber-400/22 text-amber-200'
                          : 'text-stone-300 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      {vp.label}
                    </button>
                  );
                })}
              </div>

              {/* Subtle Divider */}
              <div className="hidden h-5 w-px bg-white/14 sm:block" aria-hidden="true" />

              {/* Auto-Orbit Toggle */}
              <button
                type="button"
                onClick={onToggleAutoOrbit}
                aria-pressed={autoOrbit}
                title="Toggle gentle auto-orbit"
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                  autoOrbit
                    ? isNight
                      ? 'bg-teal-400/20 text-teal-200'
                      : 'bg-amber-400/22 text-amber-200'
                    : 'text-stone-300 hover:bg-white/8 hover:text-white'
                }`}
              >
                <Orbit className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Orbit</span>
              </button>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
