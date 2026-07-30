import React, { useEffect, useRef, useState } from 'react';
import { ThreeSniperEngine } from './game/threeEngine';
import { PlayerFPSState, PostProcessingSettings } from './types';
import { SettingsModal } from './components/SettingsModal';
import { soundEngine } from './audio/soundSystem';
import {
  Crosshair,
  Settings,
  Volume2,
  VolumeX,
  Compass,
  Zap,
  RotateCcw,
  Navigation,
  Sparkles,
  Eye,
} from 'lucide-react';


export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ThreeSniperEngine | null>(null);

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [sensitivity, setSensitivity] = useState<number>(0.0022);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [fov, setFov] = useState<number>(80);
  const [graphicsPreset, setGraphicsPreset] = useState<string>('Alto');

  const [postSettings, setPostSettings] = useState<PostProcessingSettings>({
    contrast: 1.02,
    saturation: 1.08,
    exposure: 1.15,
    gamma: 1.0,
    bloomStrength: 0.22,
    bloomThreshold: 0.85,
    bloomRadius: 0.35,
    fogDensity: 0.0055,
    fogColor: '#7dd3fc',
  });

  const handlePostSettingsChange = (newPartialSettings: Partial<PostProcessingSettings>) => {
    setPostSettings((prev) => {
      const updated = { ...prev, ...newPartialSettings };
      if (engineRef.current) {
        engineRef.current.setPostProcessingSettings(updated);
      }
      return updated;
    });
  };

  // ESC Key listener and Pointer Lock sync to open real Settings Modal directly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        setShowSettings((prev) => !prev);
      }
    };

    const handlePointerLockChange = () => {
      if (!document.pointerLockElement) {
        setShowSettings(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, []);

  // Real-time FPS State
  const [fpsState, setFpsState] = useState<PlayerFPSState>({
    posX: 0,
    posY: 1.7,
    posZ: 0,
    speed: 0,
    isGrounded: true,
    isSprinting: false,
    isPointerLocked: false,
    weapon: {
      name: 'AK-47 TÁTICA 7.62mm',
      ammoInMag: 30,
      maxMagSize: 30,
      reserveAmmo: 120,
      isReloading: false,
      isAiming: false,
      isFiring: false,
    },
  });

  // 1. Initialize ThreeJS Engine on mount
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const engine = new ThreeSniperEngine(canvasContainerRef.current);
    engineRef.current = engine;

    // Fast sync loop for UI reactivity (60fps sync)
    const interval = setInterval(() => {
      if (engineRef.current) {
        setFpsState(engineRef.current.getPlayerFPSState());
      }
    }, 50);

    return () => {
      clearInterval(interval);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleSensitivityChange = (val: number) => {
    setSensitivity(val);
    if (engineRef.current) {
      engineRef.current.sensitivity = val;
    }
  };

  const handleFovChange = (val: number) => {
    setFov(val);
    if (engineRef.current) {
      engineRef.current.setFOV(val);
    }
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    soundEngine.setMuted(nextMute);
  };

  const [activeOptic, setActiveOptic] = useState<'none' | 'red_dot' | 'holographic'>('none');
  const [activeBarrel, setActiveBarrel] = useState<'none' | 'suppressor'>('none');
  const [activeUnderbarrel, setActiveUnderbarrel] = useState<'none' | 'vertical_grip' | 'angled_grip'>('none');
  const [showCustomizer, setShowCustomizer] = useState<boolean>(false);

  const handleManualReload = () => {
    if (engineRef.current) {
      engineRef.current.reloadWeapon();
    }
  };

  const handleInspectWeapon = () => {
    if (engineRef.current) {
      engineRef.current.inspectWeapon();
    }
  };

  const handleOpticChange = (optic: 'none' | 'red_dot' | 'holographic') => {
    setActiveOptic(optic);
    if (engineRef.current) {
      engineRef.current.setOptics(optic);
    }
  };

  const handleBarrelChange = (barrel: 'none' | 'suppressor') => {
    setActiveBarrel(barrel);
    if (engineRef.current) {
      engineRef.current.setBarrel(barrel);
    }
  };

  const handleUnderbarrelChange = (underbarrel: 'none' | 'vertical_grip' | 'angled_grip') => {
    setActiveUnderbarrel(underbarrel);
    if (engineRef.current) {
      engineRef.current.setUnderbarrel(underbarrel);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-[#05070a] overflow-hidden font-sans select-none">
      {/* 3D WebGL Canvas Container */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
      />

      {/* Top Header Navigation HUD */}
      <header className="absolute top-0 left-0 right-0 z-10 p-3 sm:p-4 pointer-events-none flex justify-between items-center">
        {/* Title & Mode Badge */}
        <div className="pointer-events-auto flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl shadow-md">
          <Crosshair className="w-4 h-4 text-red-500" />
          <span className="text-xs font-black text-white tracking-wider uppercase font-mono">
            ZONA URBANA
          </span>
          <span className="text-[9px] font-mono bg-red-500/20 text-red-300 border border-red-400/30 px-1.5 py-0.5 rounded font-bold uppercase">
            AK-47
          </span>
        </div>

        {/* Stats & Settings Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 font-mono">
          {/* Customizer Toggle Button */}
          <button
            id="btn-open-customizer"
            onClick={() => setShowCustomizer((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer shadow-md active:scale-95 text-xs font-bold flex items-center gap-1.5 ${
              showCustomizer
                ? 'bg-red-600 text-white border-red-400'
                : 'bg-black/60 hover:bg-white/10 text-slate-200 border-white/10 backdrop-blur-md'
            }`}
            title="Customizar Acessórios da Arma"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">CUSTOMIZAR</span>
          </button>

          {/* Audio Toggle Button */}
          <button
            id="btn-sound-toggle"
            onClick={handleToggleMute}
            className="bg-black/60 hover:bg-white/10 text-slate-200 p-2 rounded-xl border border-white/10 backdrop-blur-md transition-all cursor-pointer shadow-md active:scale-95"
            title="Alternar Áudio"
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </button>

          {/* Settings Modal Button */}
          <button
            id="btn-open-settings"
            onClick={() => setShowSettings(true)}
            className="bg-black/60 hover:bg-white/10 text-slate-200 p-2 rounded-xl border border-white/10 backdrop-blur-md transition-all cursor-pointer shadow-md active:scale-95"
            title="Configurações [ESC]"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Attachment Customization Drawer HUD */}
      {showCustomizer && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-black/80 backdrop-blur-2xl border border-white/20 p-4 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] font-mono text-xs text-white max-w-xl w-full mx-4 animate-fade-in space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> ACESSÓRIOS TÁTICOS (CUSTOMIZAÇÃO)
            </span>
            <button
              onClick={() => setShowCustomizer(false)}
              className="text-gray-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Optics */}
            <div className="space-y-1">
              <div className="text-[10px] text-gray-400 font-bold uppercase">1. MIRA (OPTICS)</div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleOpticChange('none')}
                  className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-bold cursor-pointer transition-all ${
                    activeOptic === 'none'
                      ? 'bg-red-600/80 border-red-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  Iron Sight (Padrão)
                </button>

                <button
                  onClick={() => handleOpticChange('red_dot')}
                  className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-bold cursor-pointer transition-all ${
                    activeOptic === 'red_dot'
                      ? 'bg-red-600/80 border-red-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  Red Dot Tática
                </button>
                <button
                  onClick={() => handleOpticChange('holographic')}
                  className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-bold cursor-pointer transition-all ${
                    activeOptic === 'holographic'
                      ? 'bg-red-600/80 border-red-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  Holográfica EOTech
                </button>
              </div>
            </div>

            {/* Barrel */}
            <div className="space-y-1">
              <div className="text-[10px] text-gray-400 font-bold uppercase">2. CANO (BARREL)</div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleBarrelChange('none')}
                  className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-bold cursor-pointer transition-all ${
                    activeBarrel === 'none'
                      ? 'bg-red-600/80 border-red-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  Muzzle Brake (Padrão)
                </button>
                <button
                  onClick={() => handleBarrelChange('suppressor')}
                  className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-bold cursor-pointer transition-all ${
                    activeBarrel === 'suppressor'
                      ? 'bg-red-600/80 border-red-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  Silenciador Tático
                </button>
              </div>
            </div>

            {/* Underbarrel Grip */}
            <div className="space-y-1">
              <div className="text-[10px] text-gray-400 font-bold uppercase">3. GRIP (UNDERBARREL)</div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleUnderbarrelChange('none')}
                  className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-bold cursor-pointer transition-all ${
                    activeUnderbarrel === 'none'
                      ? 'bg-red-600/80 border-red-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  Handguard Livre
                </button>
                <button
                  onClick={() => handleUnderbarrelChange('vertical_grip')}
                  className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-bold cursor-pointer transition-all ${
                    activeUnderbarrel === 'vertical_grip'
                      ? 'bg-red-600/80 border-red-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  Grip Vertical
                </button>
                <button
                  onClick={() => handleUnderbarrelChange('angled_grip')}
                  className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-bold cursor-pointer transition-all ${
                    activeUnderbarrel === 'angled_grip'
                      ? 'bg-red-600/80 border-red-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  Grip Angulado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Center Dynamic Crosshair (fades slightly during ADS) */}
      {!fpsState.weapon.isAiming && (
        <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* Center Red Dot */}
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.9)]" />

            {/* Crosshair Ticks */}
            <div
              className={`absolute -top-3 w-0.5 h-2 bg-white/80 transition-all duration-75 ${
                fpsState.speed > 0 || fpsState.weapon.isFiring ? '-translate-y-1 bg-red-400' : ''
              }`}
            />
            <div
              className={`absolute -bottom-3 w-0.5 h-2 bg-white/80 transition-all duration-75 ${
                fpsState.speed > 0 || fpsState.weapon.isFiring ? 'translate-y-1 bg-red-400' : ''
              }`}
            />
            <div
              className={`absolute -left-3 h-0.5 w-2 bg-white/80 transition-all duration-75 ${
                fpsState.speed > 0 || fpsState.weapon.isFiring ? '-translate-x-1 bg-red-400' : ''
              }`}
            />
            <div
              className={`absolute -right-3 h-0.5 w-2 bg-white/80 transition-all duration-75 ${
                fpsState.speed > 0 || fpsState.weapon.isFiring ? 'translate-x-1 bg-red-400' : ''
              }`}
            />
          </div>
        </div>
      )}



      {/* Bottom Left Movement Telemetry HUD */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-auto font-mono text-xs">
        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2.5 text-slate-200 shadow-lg">
          <div className="flex items-center gap-1 text-emerald-400 font-bold">
            <Navigation className="w-3.5 h-3.5" />
            <span>{fpsState.speed} KM/H</span>
          </div>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-1 text-gray-300">
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span>X:{fpsState.posX} Y:{fpsState.posY} Z:{fpsState.posZ}</span>
          </div>
        </div>
      </div>

      {/* Bottom Right Tactical AK-47 Ammo HUD */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-auto font-mono text-xs">
        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-3 text-slate-200 shadow-lg">
          <div className="flex flex-col">
            <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider">{fpsState.weapon.name}</span>
            {fpsState.weapon.isReloading ? (
              <span className="text-xs font-bold text-amber-400 animate-pulse flex items-center gap-1">
                <RotateCcw className="w-3 h-3 animate-spin" /> RECARREGANDO
              </span>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-white">{fpsState.weapon.ammoInMag}</span>
                <span className="text-[10px] text-gray-400 font-bold">/ {fpsState.weapon.reserveAmmo}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 pl-2 border-l border-white/10">
            <button
              id="btn-inspect-weapon"
              onClick={handleInspectWeapon}
              disabled={fpsState.weapon.isReloading}
              className="p-1.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-lg text-amber-400 transition-all cursor-pointer"
              title="Inspecionar [F]"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              id="btn-reload-weapon"
              onClick={handleManualReload}
              disabled={fpsState.weapon.isReloading}
              className="p-1.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-lg text-gray-300 transition-all cursor-pointer"
              title="Recarregar [R]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Game Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        sensitivity={sensitivity}
        onSensitivityChange={handleSensitivityChange}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        fov={fov}
        onFovChange={handleFovChange}
        graphicsPreset={graphicsPreset}
        onGraphicsPresetChange={setGraphicsPreset}
        postSettings={postSettings}
        onPostSettingsChange={handlePostSettingsChange}
      />
    </div>
  );
}
