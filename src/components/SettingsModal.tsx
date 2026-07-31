import React from 'react';
import { Settings, Volume2, VolumeX, Mouse, Monitor, Eye, ShieldAlert, X, Sparkles, Sliders, Palette, Sun, RotateCcw, CloudFog } from 'lucide-react';
import { PostProcessingSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sensitivity: number;
  onSensitivityChange: (val: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  fov: number;
  onFovChange: (val: number) => void;
  graphicsPreset: string;
  onGraphicsPresetChange: (preset: string) => void;
  postSettings: PostProcessingSettings;
  onPostSettingsChange: (settings: Partial<PostProcessingSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  sensitivity,
  onSensitivityChange,
  isMuted,
  onToggleMute,
  fov,
  onFovChange,
  graphicsPreset,
  onGraphicsPresetChange,
  postSettings,
  onPostSettingsChange,
}) => {
  if (!isOpen) return null;

  const stylePresets = [
    {
      name: 'Tático',
      settings: { contrast: 1.02, saturation: 1.08, exposure: 1.15, gamma: 1.0, bloomStrength: 0.22, bloomThreshold: 0.85, bloomRadius: 0.35, fogDensity: 0.0055, fogColor: '#7dd3fc' },
    },
    {
      name: 'Cinemático',
      settings: { contrast: 1.18, saturation: 0.88, exposure: 1.10, gamma: 1.02, bloomStrength: 0.28, bloomThreshold: 0.80, bloomRadius: 0.45, fogDensity: 0.0075, fogColor: '#38bdf8' },
    },
    {
      name: 'Vibrante',
      settings: { contrast: 1.10, saturation: 1.35, exposure: 1.20, gamma: 0.98, bloomStrength: 0.25, bloomThreshold: 0.82, bloomRadius: 0.38, fogDensity: 0.0040, fogColor: '#a5f3fc' },
    },
    {
      name: 'Noir',
      settings: { contrast: 1.30, saturation: 0.00, exposure: 1.25, gamma: 1.00, bloomStrength: 0.35, bloomThreshold: 0.75, bloomRadius: 0.50, fogDensity: 0.0090, fogColor: '#64748b' },
    },
    {
      name: 'Alto Contraste',
      settings: { contrast: 1.35, saturation: 1.15, exposure: 1.05, gamma: 0.92, bloomStrength: 0.18, bloomThreshold: 0.88, bloomRadius: 0.30, fogDensity: 0.0060, fogColor: '#0284c7' },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 pointer-events-none animate-fade-in flex">
      {/* Left Sidebar Menu Drawer */}
      <div className="pointer-events-auto w-full sm:w-[460px] md:w-[480px] lg:w-[500px] xl:w-[520px] h-full bg-black/90 backdrop-blur-2xl border-r border-white/15 shadow-[12px_0_48px_0_rgba(0,0,0,0.8)] flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-white font-black text-sm sm:text-base tracking-wider uppercase font-mono">
            <div className="p-2 bg-red-600/80 rounded-xl text-white border border-red-400/30">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <span>CONFIGURAÇÕES & GRÁFICOS</span>
          </div>
          <button
            id="btn-close-settings"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar Configurações [ESC]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-sm text-slate-300 flex-1 overflow-y-auto custom-scrollbar">
          {/* Section 1: Graphics Settings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-red-400 uppercase tracking-widest">
              <Monitor className="w-4 h-4 text-red-400" />
              AJUSTES GRÁFICOS
            </div>

            {/* FOV Slider */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  Campo de Visão (FOV)
                </div>
                <span className="font-mono text-xs text-emerald-400 font-black bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                  {fov}°
                </span>
              </div>
              <input
                type="range"
                min="60"
                max="120"
                step="1"
                value={fov}
                onChange={(e) => onFovChange(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-white/10 rounded-lg"
              />
              <div className="flex justify-between text-[10px] font-mono text-gray-500">
                <span>60° (Estreito)</span>
                <span>80° (Padrão)</span>
                <span>120° (Máximo)</span>
              </div>
            </div>

            {/* Graphics Quality Preset */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Qualidade dos Gráficos & Efeitos
                </div>
                <span className="font-mono text-[11px] text-amber-400 font-bold uppercase">
                  {graphicsPreset}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 font-mono text-xs">
                {['Baixo', 'Médio', 'Alto', 'Ultra'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => onGraphicsPresetChange(preset)}
                    className={`py-2 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                      graphicsPreset === preset
                        ? 'bg-red-600/30 text-white border-red-500/60 shadow-[0_0_12px_rgba(220,38,38,0.3)]'
                        : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Post-Processing & Visual Style Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-purple-400 uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-400" />
                PÓS-PROCESSAMENTO & ESTILO VISUAL
              </div>
              <button
                onClick={() => onPostSettingsChange({ contrast: 1.02, saturation: 1.08, exposure: 1.15, gamma: 1.0, bloomStrength: 0.22, bloomThreshold: 0.85, bloomRadius: 0.35 })}
                className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                title="Restaurar valores padrão"
              >
                <RotateCcw className="w-3 h-3" /> Resetar
              </button>
            </div>

            {/* Presets Grid */}
            <div className="bg-white/5 p-3 rounded-2xl border border-white/10 space-y-2">
              <div className="text-[11px] text-gray-400 font-mono font-bold uppercase">Presets de Filtro Visual:</div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 font-mono text-[11px]">
                {stylePresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => onPostSettingsChange(preset.settings)}
                    className="py-1.5 px-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 text-gray-200 text-center font-bold cursor-pointer transition-all active:scale-95 hover:border-purple-400/50"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders Container */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3.5">
              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-sky-400" /> Contraste
                  </span>
                  <span className="text-sky-400 font-bold bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md text-[11px]">
                    {postSettings.contrast.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.8"
                  step="0.02"
                  value={postSettings.contrast}
                  onChange={(e) => onPostSettingsChange({ contrast: parseFloat(e.target.value) })}
                  className="w-full accent-sky-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* Saturation */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-pink-400" /> Saturação
                  </span>
                  <span className="text-pink-400 font-bold bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-md text-[11px]">
                    {postSettings.saturation.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={postSettings.saturation}
                  onChange={(e) => onPostSettingsChange({ saturation: parseFloat(e.target.value) })}
                  className="w-full accent-pink-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* Exposure */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" /> Exposição
                  </span>
                  <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md text-[11px]">
                    {postSettings.exposure.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.02"
                  value={postSettings.exposure}
                  onChange={(e) => onPostSettingsChange({ exposure: parseFloat(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* Gamma */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-emerald-400" /> Gama (Correção)
                  </span>
                  <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md text-[11px]">
                    {postSettings.gamma.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.02"
                  value={postSettings.gamma}
                  onChange={(e) => onPostSettingsChange({ gamma: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* Subtle Bloom */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Bloom (Brilho Suave)
                  </span>
                  <span className="text-purple-400 font-bold bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md text-[11px]">
                    {postSettings.bloomStrength.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.01"
                  value={postSettings.bloomStrength}
                  onChange={(e) => onPostSettingsChange({ bloomStrength: parseFloat(e.target.value) })}
                  className="w-full accent-purple-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* Fog Density */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <CloudFog className="w-3.5 h-3.5 text-cyan-400" /> Névoa Exponencial (Densidade)
                  </span>
                  <span className="text-cyan-400 font-bold bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md text-[11px]">
                    {(postSettings.fogDensity * 1000).toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.000"
                  max="0.018"
                  step="0.0005"
                  value={postSettings.fogDensity}
                  onChange={(e) => onPostSettingsChange({ fogDensity: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* Fog Color & Palette */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-cyan-300" /> Cor da Névoa / Horizonte
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={postSettings.fogColor}
                      onChange={(e) => onPostSettingsChange({ fogColor: e.target.value })}
                      className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                      title="Escolher Cor Personalizada da Névoa"
                    />
                    <span className="text-cyan-300 font-mono text-[10px] uppercase font-bold">
                      {postSettings.fogColor}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1 font-mono text-[10px]">
                  {[
                    { label: 'Céu Cyan', color: '#7dd3fc' },
                    { label: 'Azul Suave', color: '#38bdf8' },
                    { label: 'Pôr do Sol', color: '#fba518' },
                    { label: 'Névoa Cinza', color: '#94a3b8' },
                    { label: 'Crepúsculo', color: '#a855f7' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => onPostSettingsChange({ fogColor: item.color })}
                      className="py-1 px-1 rounded-lg border border-white/10 text-gray-300 text-center truncate hover:border-cyan-400/50 transition-all cursor-pointer"
                      style={{ backgroundColor: `${item.color}22` }}
                    >
                      <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Controls & Sensitivity */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-sky-400 uppercase tracking-widest">
              <Mouse className="w-4 h-4 text-sky-400" />
              CONTROLES DE CÂMERA & TECLADO
            </div>

            {/* Keybindings Grid */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 grid grid-cols-2 gap-2.5 font-mono text-xs">
              <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                <span className="text-gray-400 text-[11px]">Mover</span>
                <span className="text-sky-400 font-bold">W A S D</span>
              </div>
              <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                <span className="text-gray-400 text-[11px]">Inclinar</span>
                <span className="text-amber-400 font-bold">Q / E</span>
              </div>
              <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                <span className="text-gray-400 text-[11px]">Mirar (ADS)</span>
                <span className="text-emerald-400 font-bold">Botão Dir.</span>
              </div>
              <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                <span className="text-gray-400 text-[11px]">Atirar</span>
                <span className="text-red-400 font-bold">Botão Esq.</span>
              </div>
              <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                <span className="text-gray-400 text-[11px]">Recarregar</span>
                <span className="text-sky-400 font-bold">R</span>
              </div>
              <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                <span className="text-gray-400 text-[11px]">Inspecionar</span>
                <span className="text-amber-400 font-bold">F / I</span>
              </div>
            </div>

            {/* Mouse Sensitivity */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-white text-xs">Sensibilidade do Mouse</div>
                <span className="font-mono text-xs text-sky-400 font-bold">
                  {Math.round(sensitivity * 10000)}
                </span>
              </div>
              <input
                type="range"
                min="0.0005"
                max="0.005"
                step="0.0001"
                value={sensitivity}
                onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-white/10 rounded-lg"
              />
            </div>
          </div>

          {/* Section 3: Audio */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">
              <Volume2 className="w-4 h-4 text-indigo-400" />
              SISTEMA DE ÁUDIO
            </div>

            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3">
                {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
                <div>
                  <div className="font-bold text-white text-xs">Efeitos Sonoros do Jogo</div>
                  <div className="text-[11px] text-gray-400">Tiros, recarregamento e ambiente urbano</div>
                </div>
              </div>
              <button
                id="btn-toggle-sound"
                onClick={onToggleMute}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  isMuted
                    ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                    : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {isMuted ? 'MUTADO' : 'ATIVADO'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white/5 px-6 py-4 border-t border-white/10 flex justify-between items-center font-mono shrink-0">
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> [ESC] para fechar
          </span>
          <button
            id="btn-save-settings"
            onClick={onClose}
            className="bg-red-600/90 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-md active:scale-95 border border-red-400/30 flex items-center gap-2"
          >
            VOLTAR AO JOGO
          </button>
        </div>
      </div>

      {/* Right Side - Interactive Live Game Viewport Window */}
      <div
        onClick={onClose}
        className="hidden sm:flex flex-1 h-full pointer-events-auto cursor-pointer p-6 flex-col justify-between items-end bg-gradient-to-l from-black/20 via-transparent to-transparent hover:bg-black/10 transition-all group"
        title="Clique na janela do jogo para retornar e capturar o mouse"
      >
        {/* Top Right Live Preview Indicator */}
        <div className="bg-black/75 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 font-mono">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            JANELA DO JOGO (TEMPO REAL)
          </div>
          <span className="text-[10px] text-gray-300 border-l border-white/15 pl-3">
            Altere os parâmetros no menu à esquerda e veja a iluminação e névoa mudarem
          </span>
        </div>

        {/* Bottom Right Click to Resume Button */}
        <div className="bg-black/80 group-hover:bg-red-950/90 backdrop-blur-md text-white border border-white/20 group-hover:border-red-500/50 px-5 py-3 rounded-2xl font-mono text-xs font-bold transition-all shadow-2xl flex items-center gap-3">
          <span>CLIQUE AQUI PARA CONTINUAR JOGANDO</span>
          <span className="p-1.5 bg-red-600 rounded-lg text-white group-hover:bg-red-500 text-[10px]">
            [ESC]
          </span>
        </div>
      </div>
    </div>
  );
};
