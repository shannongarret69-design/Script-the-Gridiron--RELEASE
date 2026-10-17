import React from 'react';
import { InjuryEvent } from '../types/injuries';
import { ShieldAlert, AlertTriangle, Activity, X, HeartPulse } from 'lucide-react';

interface InjuryAlertBannerProps {
  injury: InjuryEvent;
  onDismiss: () => void;
  isRetro?: boolean;
}

export const InjuryAlertBanner: React.FC<InjuryAlertBannerProps> = ({
  injury,
  onDismiss,
  isRetro = false,
}) => {
  if (isRetro) {
    return (
      <div className="bg-rose-950 border-4 border-rose-500 text-rose-100 p-3 rounded-lg shadow-2xl animate-bounce flex items-center justify-between font-retro text-xs z-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-rose-600 border-2 border-white flex items-center justify-center text-white font-bold">
            +
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-amber-400 font-bold">🚑 INJURY UPDATE:</span>
              <span className="text-white font-bold">{injury.playerName.toUpperCase()} ({injury.playerPosition})</span>
            </div>
            <div className="text-[10px] text-rose-300 mt-0.5">
              {injury.teamAbbr} • {injury.injuryType} • STATUS: <span className="text-amber-300 underline font-bold">{injury.severity.toUpperCase()}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="ml-3 px-2 py-1 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500 rounded text-[9px]"
        >
          DISMISS [X]
        </button>
      </div>
    );
  }

  const getSeverityBadgeClass = () => {
    switch (injury.severity) {
      case 'Injured Reserve (Season)':
        return 'bg-purple-950/80 text-purple-300 border-purple-600';
      case 'Out (Game)':
        return 'bg-rose-950/80 text-rose-300 border-rose-600';
      case 'Doubtful':
        return 'bg-orange-950/80 text-orange-300 border-orange-600';
      default:
        return 'bg-amber-950/80 text-amber-300 border-amber-600';
    }
  };

  return (
    <div
      id="breaking-injury-alert"
      className="bg-gradient-to-r from-rose-950 via-slate-950 to-rose-950 border-2 border-rose-500 rounded-xl p-3.5 shadow-2xl shadow-rose-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn z-40"
    >
      <div className="flex items-center space-x-3.5">
        <div className="w-10 h-10 rounded-xl bg-rose-600/30 border-2 border-rose-500 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-500/20">
          <HeartPulse className="w-6 h-6 text-rose-400 animate-pulse" />
        </div>

        <div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="text-[10px] font-display font-black tracking-widest px-2 py-0.5 rounded bg-rose-600 text-white uppercase shadow-sm">
              BREAKING INJURY UPDATE
            </span>
            <span className="font-display font-bold text-white text-sm">
              {injury.playerName} <span className="text-slate-400 font-mono text-xs">({injury.playerPosition})</span>
            </span>
            <span className="text-xs font-mono text-slate-400">• {injury.teamAbbr}</span>
          </div>

          <div className="flex items-center space-x-2 mt-1 flex-wrap gap-y-1 text-xs">
            <span className="text-slate-300 font-medium">
              Report: <span className="text-white font-semibold">{injury.injuryType}</span>
            </span>
            <span className="text-slate-500">•</span>
            <span className={`px-2 py-0.5 rounded-md border font-mono font-bold text-[11px] ${getSeverityBadgeClass()}`}>
              STATUS: {injury.severity}
            </span>
            {injury.announcementText && (
              <span className="text-slate-400 italic text-[11px] max-w-md truncate hidden md:inline-block">
                "{injury.announcementText}"
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2 self-end sm:self-center">
        <button
          onClick={onDismiss}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition"
          title="Dismiss Injury Notice"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
