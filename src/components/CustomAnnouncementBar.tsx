import React, { useState } from 'react';
import { NFLTeam } from '../types/game';
import { InjuryEvent } from '../types/injuries';
import { parseCustomAnnouncementForInjury } from '../utils/injuryParser';
import { playSound } from '../utils/audio';
import { Megaphone, HeartPulse, Send, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';

interface CustomAnnouncementBarProps {
  homeTeam: NFLTeam;
  awayTeam: NFLTeam;
  currentPossession?: 'home' | 'away';
  onInjuryTriggered: (injury: InjuryEvent) => void;
  onCustomAnnouncement?: (text: string) => void;
  isRetro?: boolean;
}

export const CustomAnnouncementBar: React.FC<CustomAnnouncementBarProps> = ({
  homeTeam,
  awayTeam,
  currentPossession = 'home',
  onInjuryTriggered,
  onCustomAnnouncement,
  isRetro = false,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  const handleBroadcast = (textToBroadcast?: string) => {
    const text = (textToBroadcast ?? inputText).trim();
    if (!text) return;

    // Check if user is triggering an injury
    const detectedInjury = parseCustomAnnouncementForInjury(text, homeTeam, awayTeam, currentPossession);

    if (detectedInjury) {
      if (isRetro) {
        playSound.retroInjuryAlert();
      } else {
        playSound.injuryAlert();
      }
      onInjuryTriggered(detectedInjury);
      setLastNotification(`🚑 Injury Logged: ${detectedInjury.playerName} (${detectedInjury.injuryType}) - ${detectedInjury.severity}`);
    } else {
      if (onCustomAnnouncement) {
        onCustomAnnouncement(text);
      }
      setLastNotification(`📢 Broadcast: "${text}"`);
    }

    setInputText('');
    setTimeout(() => setLastNotification(null), 4000);
  };

  const possTeam = currentPossession === 'home' ? homeTeam : awayTeam;

  const quickInjuryPresets = [
    { label: `${possTeam.starQB} Ankle Sprain (Questionable)`, text: `Injury: ${possTeam.starQB} suffers high ankle sprain, questionable to return` },
    { label: `${possTeam.starRB} Knee Injury (Out)`, text: `Injury: ${possTeam.starRB} knee injury, ruled out for the game` },
    { label: `${possTeam.starWR} Hamstring (Doubtful)`, text: `Injury: ${possTeam.starWR} pulled hamstring, doubtful to return` },
    { label: `${possTeam.starDef} Concussion Protocol`, text: `Injury: ${possTeam.starDef} in concussion protocol, out for game` },
  ];

  if (isRetro) {
    return (
      <div className="bg-slate-900 border-2 border-slate-700 p-2.5 rounded-lg font-retro text-[10px] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-amber-400">
            <span>📢</span>
            <span className="font-bold">CUSTOM ANNOUNCEMENT / INJURY SCRIPT:</span>
          </div>
          <span className="text-[8px] text-slate-400">Type injury (e.g. "QB injured") to trigger injuries</span>
        </div>

        <div className="flex items-center space-x-2">
          <input
            id="retro-input-custom-announcement"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBroadcast()}
            placeholder="Type custom announcement or player injury here..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-retro text-[9px] focus:outline-none focus:border-amber-400 placeholder:text-slate-600"
          />
          <button
            id="retro-btn-send-announcement"
            onClick={() => handleBroadcast()}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded flex items-center space-x-1"
          >
            <span>SEND</span>
          </button>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-1 pt-1 text-[8px]">
          <span className="text-slate-400">Quick Injury Presets:</span>
          {quickInjuryPresets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleBroadcast(p.text)}
              className="bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-900/60 px-1.5 py-0.5 rounded truncate max-w-[200px]"
            >
              + {p.label}
            </button>
          ))}
        </div>

        {lastNotification && (
          <div className="text-[9px] text-emerald-400 font-mono animate-pulse">
            {lastNotification}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Megaphone className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-display font-bold text-white uppercase tracking-wider">
            Custom Broadcast Announcement & Injury Scripter
          </h4>
        </div>
        <span className="text-[11px] text-slate-400 flex items-center space-x-1">
          <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
          <span>Injuries only occur when scripted/typed here</span>
        </span>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <input
            id="input-custom-announcement"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBroadcast()}
            placeholder={`Type custom announcement or injury (e.g. "${possTeam.starQB} injured ankle", "WR1 hamstring out", or custom play event)...`}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
          />
        </div>
        <button
          id="btn-send-custom-announcement"
          onClick={() => handleBroadcast()}
          className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition shadow-md shadow-amber-500/20"
        >
          <Send className="w-3.5 h-3.5" />
          <span>BROADCAST</span>
        </button>
      </div>

      {/* Quick Injury Presets */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
        <span className="text-[11px] text-slate-400 font-medium mr-1 flex items-center space-x-1">
          <HeartPulse className="w-3 h-3 text-rose-400" />
          <span>Quick Injury Triggers:</span>
        </span>
        {quickInjuryPresets.map((preset, i) => (
          <button
            key={i}
            id={`btn-quick-injury-${i}`}
            onClick={() => handleBroadcast(preset.text)}
            className="px-2 py-1 rounded-md bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 text-[11px] transition flex items-center space-x-1"
          >
            <span>+</span>
            <span>{preset.label}</span>
          </button>
        ))}
      </div>

      {lastNotification && (
        <div className="text-xs text-emerald-400 font-mono bg-slate-950 px-2.5 py-1 rounded border border-emerald-500/30 flex items-center space-x-1.5 animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{lastNotification}</span>
        </div>
      )}
    </div>
  );
};
