import React, { useState } from 'react';
import { ActiveGame, Play, PlayResult } from '../types/game';
import { FootballField } from './FootballField';
import { Tv, Maximize2, Minimize2, X, ChevronUp, ArrowUp, Eye, Sparkles } from 'lucide-react';

interface FieldCamViewerProps {
  game: ActiveGame;
  offensePlay?: Play;
  defensePlay?: Play;
  isAnimating?: boolean;
  animProgress?: number;
  lastResult?: PlayResult;
  isOpen: boolean;
  camMode: 'pip' | 'expanded';
  onToggleOpen: () => void;
  onSetCamMode: (mode: 'pip' | 'expanded') => void;
  onScrollToTopField: () => void;
  isFieldVisible?: boolean;
}

export const FieldCamViewer: React.FC<FieldCamViewerProps> = ({
  game,
  offensePlay,
  defensePlay,
  isAnimating = false,
  animProgress = 0,
  lastResult,
  isOpen,
  camMode,
  onToggleOpen,
  onSetCamMode,
  onScrollToTopField,
  isFieldVisible = false,
}) => {
  const { homeTeam, awayTeam, possession, yardLine, down, distance } = game;
  const isHomePoss = possession === 'home';
  const possessingTeam = isHomePoss ? homeTeam : awayTeam;
  const defendingTeam = isHomePoss ? awayTeam : homeTeam;

  const possAbbr = (possessingTeam.abbr || possessingTeam.name.substring(0, 3)).toUpperCase();
  const defAbbr = (defendingTeam.abbr || defendingTeam.name.substring(0, 3)).toUpperCase();

  const downSuffix = down === 1 ? 'ST' : down === 2 ? 'ND' : down === 3 ? 'RD' : 'TH';
  const downDistanceText = yardLine + distance >= 100
    ? `${down}${downSuffix} & GOAL`
    : `${down}${downSuffix} & ${distance}`;

  const yardText = yardLine === 50
    ? '50 YD'
    : yardLine < 50
    ? `${possAbbr} ${yardLine}`
    : `${defAbbr} ${100 - yardLine}`;

  // If closed, render a floating trigger pill at bottom-right
  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          type="button"
          id="btn-open-field-cam-floating"
          onClick={onToggleOpen}
          className="group flex items-center space-x-2.5 bg-slate-900/95 hover:bg-slate-800 text-white border-2 border-amber-500/80 hover:border-amber-400 px-3.5 py-2 rounded-full shadow-2xl backdrop-blur-md transition-all hover:scale-105 cursor-pointer ring-4 ring-slate-950/40"
          title="See the football field without scrolling up"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <Tv className="w-4 h-4 text-amber-400" />
          <div className="flex items-center space-x-1.5 text-xs font-mono">
            <span className="font-display font-black text-amber-300">FIELD CAM</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-200 font-bold">{yardText}</span>
            <span className="text-slate-400">•</span>
            <span className="text-amber-400 font-black">{downDistanceText}</span>
          </div>
          <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-bold font-sans">
            VIEW
          </span>
        </button>
      </div>
    );
  }

  // Expanded Modal View (Full Screen / Stadium Overlay)
  if (camMode === 'expanded') {
    return (
      <div
        id="field-cam-expanded-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="bg-slate-900 border-2 border-slate-750 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header Bar */}
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
                <Tv className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-black text-sm text-white tracking-wider flex items-center space-x-2">
                  <span>LIVE FIELD CAM</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                    LIVE 2D VIEW
                  </span>
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  {downDistanceText} • BALL ON {yardText} • {possessingTeam.name} POSSESSION
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                id="btn-field-cam-pip-mode"
                onClick={() => onSetCamMode('pip')}
                className="flex items-center space-x-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
                title="Switch to Picture-in-Picture mode"
              >
                <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">PiP Mode</span>
              </button>

              <button
                type="button"
                id="btn-field-cam-scroll-up"
                onClick={() => {
                  onToggleOpen();
                  onScrollToTopField();
                }}
                className="flex items-center space-x-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
                title="Scroll to top of page"
              >
                <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Scroll to Top</span>
              </button>

              <button
                type="button"
                id="btn-field-cam-close-modal"
                onClick={onToggleOpen}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
                title="Close Field Cam"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body: Live Football Field */}
          <div className="p-3 sm:p-4 overflow-y-auto bg-slate-950/60">
            <FootballField
              game={game}
              offensePlay={offensePlay}
              defensePlay={defensePlay}
              isAnimating={isAnimating}
              animProgress={animProgress}
              lastResult={lastResult}
            />
          </div>

          {/* Footer Bar */}
          <div className="bg-slate-950 px-4 py-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center space-x-2">
              <span className="text-amber-400 font-bold">PLAY IN VIEW:</span>
              <span className="text-white">
                {offensePlay ? `${offensePlay.name} (${offensePlay.formation})` : 'Awaiting Play Call'}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleOpen}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 rounded-lg font-bold font-sans transition"
            >
              Back to Play Calling
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Picture-in-Picture (PiP) Floating Box (Bottom-Right Docked)
  return (
    <div
      id="field-cam-pip-container"
      className="fixed bottom-4 right-4 z-40 w-[92vw] max-w-[420px] sm:max-w-[460px] bg-slate-900/98 border-2 border-amber-500/80 rounded-2xl shadow-2xl backdrop-blur-lg overflow-hidden flex flex-col transition-all duration-200 animate-in fade-in slide-in-from-bottom-5 ring-4 ring-slate-950/50 select-none"
    >
      {/* PiP Header */}
      <div className="bg-slate-950/90 px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Tv className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-display font-black text-xs text-white tracking-wider">
            FIELD CAM (PiP)
          </span>
          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20">
            {downDistanceText}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            id="btn-field-cam-expand-mode"
            onClick={() => onSetCamMode('expanded')}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            title="Expand to Full Stadium Modal"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            id="btn-field-cam-scroll-up-pip"
            onClick={() => {
              onScrollToTopField();
            }}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            title="Scroll page to top field"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            id="btn-field-cam-minimize"
            onClick={onToggleOpen}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            title="Minimize Field Cam"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* PiP Field Container */}
      <div className="p-1.5 bg-emerald-950/50 max-h-[260px] overflow-hidden">
        <FootballField
          game={game}
          offensePlay={offensePlay}
          defensePlay={defensePlay}
          isAnimating={isAnimating}
          animProgress={animProgress}
          lastResult={lastResult}
        />
      </div>

      {/* PiP Compact Footer */}
      <div className="bg-slate-950 px-2.5 py-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div className="flex items-center space-x-1">
          <span className="text-slate-500">BALL:</span>
          <span className="text-white font-bold">{yardText}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="text-amber-400">
            {offensePlay?.name || 'Pick a play'}
          </span>
          <button
            type="button"
            onClick={() => onSetCamMode('expanded')}
            className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-1.5 py-0.5 rounded border border-slate-700 transition"
          >
            Expand ↗
          </button>
        </div>
      </div>
    </div>
  );
};
