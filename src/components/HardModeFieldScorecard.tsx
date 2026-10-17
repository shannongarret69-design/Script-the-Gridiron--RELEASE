import React, { useMemo } from 'react';
import { NFLTeam } from '../types/game';

interface HardModeFieldScorecardProps {
  offenseTeam: NFLTeam;
  defenseTeam: NFLTeam;
  homeScore?: number;
  awayScore?: number;
  homeTeamName?: string;
  awayTeamName?: string;
  possession?: 'home' | 'away';
  currentYardLine: number; // 1 to 99 (100 = defense end zone)
  currentDown: number;
  currentDistance: number;
  quarter?: number;
  currentQuarterTimeSeconds?: number;
  isPreSnapMotion?: boolean;
  onOpenFieldCam?: () => void;
}

export const HardModeFieldScorecard: React.FC<HardModeFieldScorecardProps> = ({
  offenseTeam,
  defenseTeam,
  homeScore = 0,
  awayScore = 0,
  homeTeamName,
  awayTeamName,
  possession = 'away',
  currentYardLine,
  currentDown,
  currentDistance,
  quarter = 1,
  currentQuarterTimeSeconds = 900,
  isPreSnapMotion = false,
  onOpenFieldCam,
}) => {
  // Offense team drives toward defense end zone
  // Left side: Offense territory & end zone
  // Right side: Defense territory & end zone
  // 0 -> 100 goes from left to right along field
  const clampedYard = Math.max(1, Math.min(99, currentYardLine));

  // Compute ball X in 500-wide SVG
  // Left endzone: 0 to 45 (width 45)
  // Field playing surface: 45 to 455 (width 410)
  // Right endzone: 455 to 500 (width 45)
  const ballSvgX = 45 + (clampedYard / 100) * 410;
  const ballSvgY = 22;

  // First down line X (distance to gain)
  const firstDownYard = Math.min(100, clampedYard + currentDistance);
  const firstDownSvgX = 45 + (firstDownYard / 100) * 410;

  // Display texts
  const offAbbr = (offenseTeam.abbr || offenseTeam.name.substring(0, 3)).toUpperCase();
  const defAbbr = (defenseTeam.abbr || defenseTeam.name.substring(0, 3)).toUpperCase();

  const isHomeOffense = homeTeamName ? offenseTeam.name.toLowerCase().includes(homeTeamName.toLowerCase()) : possession === 'home';
  const displayOffScore = isHomeOffense ? homeScore : awayScore;
  const displayDefScore = isHomeOffense ? awayScore : homeScore;

  const downSuffix = currentDown === 1 ? 'ST' : currentDown === 2 ? 'ND' : currentDown === 3 ? 'RD' : 'TH';
  const downDistanceText = clampedYard + currentDistance >= 100
    ? `${currentDown}${downSuffix} & GOAL`
    : `${currentDown}${downSuffix} & ${currentDistance}`;

  const minutes = Math.floor(currentQuarterTimeSeconds / 60);
  const seconds = String(currentQuarterTimeSeconds % 60).padStart(2, '0');

  // Yard line representation (e.g. KC 35 or SF 42 or 50 YD)
  const yardText = clampedYard === 50
    ? '50 YD'
    : clampedYard < 50
    ? `${offAbbr} ${clampedYard}`
    : `${defAbbr} ${100 - clampedYard}`;

  return (
    <div
      id="hardmode-field-scorecard"
      className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 sm:p-3.5 shadow-xl max-w-lg mx-auto mb-4 backdrop-blur-sm select-none"
    >
      {/* Top Header Row: Scoreboard Badges & Situation */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
        {/* Offense Score */}
        <div className="flex items-center space-x-2">
          <div
            className="w-2.5 h-7 rounded-sm shadow-sm"
            style={{ backgroundColor: offenseTeam.primaryColor || '#f97316' }}
            title={offenseTeam.name}
          />
          <div className="flex items-baseline space-x-1.5">
            <span className="font-display font-black text-sm text-white tracking-wider flex items-center gap-1">
              {offAbbr}
              <span className="text-[11px] text-amber-400 font-normal" title="Possession">
                🏈
              </span>
            </span>
            <span className="font-mono font-black text-lg text-amber-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
              {displayOffScore}
            </span>
          </div>
        </div>

        {/* Situation: Down & Distance + Clock */}
        <div className="flex flex-col items-center">
          <span className="font-mono font-black text-xs text-amber-300 tracking-wider">
            {downDistanceText}
          </span>
          <span className="text-[10px] font-mono text-slate-400 flex items-center space-x-1">
            <span className="text-white font-semibold">BALL ON {yardText}</span>
            <span>•</span>
            <span>Q{quarter} {minutes}:{seconds}</span>
          </span>
        </div>

        {/* Defense Score */}
        <div className="flex items-center space-x-2">
          <div className="flex items-baseline space-x-1.5 text-right">
            <span className="font-mono font-black text-lg text-slate-200 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
              {displayDefScore}
            </span>
            <span className="font-display font-black text-sm text-white tracking-wider">
              {defAbbr}
            </span>
          </div>
          <div
            className="w-2.5 h-7 rounded-sm shadow-sm"
            style={{ backgroundColor: defenseTeam.primaryColor || '#3b82f6' }}
            title={defenseTeam.name}
          />
        </div>
      </div>

      {/* SVG Football Field: End zones, hashes, 1st down marker, and Ball */}
      <div className="relative w-full h-11 rounded-lg overflow-hidden border border-slate-700 shadow-inner bg-emerald-950">
        <svg
          viewBox="0 0 500 44"
          className="w-full h-full block"
          preserveAspectRatio="none"
        >
          {/* Turf Base */}
          <rect x="0" y="0" width="500" height="44" fill="#15803d" />

          {/* Alternating 5-yard turf stripes */}
          {Array.from({ length: 20 }).map((_, i) =>
            i % 2 === 1 ? (
              <rect
                key={`stripe-${i}`}
                x={45 + i * 20.5}
                y="0"
                width="20.5"
                height="44"
                fill="#16a34a"
                opacity="0.35"
              />
            ) : null
          )}

          {/* LEFT END ZONE (Offense) */}
          <rect
            x="0"
            y="0"
            width="45"
            height="44"
            fill={offenseTeam.primaryColor || '#1e293b'}
            stroke="#ffffff"
            strokeWidth="1.5"
          />
          <text
            x="22.5"
            y="26"
            fill="#ffffff"
            fontSize="10"
            fontWeight="900"
            textAnchor="middle"
            fontFamily="sans-serif"
            opacity="0.85"
          >
            {offAbbr}
          </text>

          {/* RIGHT END ZONE (Defense) */}
          <rect
            x="455"
            y="0"
            width="45"
            height="44"
            fill={defenseTeam.primaryColor || '#0284c7'}
            stroke="#ffffff"
            strokeWidth="1.5"
          />
          <text
            x="477.5"
            y="26"
            fill="#ffffff"
            fontSize="10"
            fontWeight="900"
            textAnchor="middle"
            fontFamily="sans-serif"
            opacity="0.85"
          >
            {defAbbr}
          </text>

          {/* GOAL LINES */}
          <line x1="45" y1="0" x2="45" y2="44" stroke="#ffffff" strokeWidth="2" />
          <line x1="455" y1="0" x2="455" y2="44" stroke="#ffffff" strokeWidth="2" />

          {/* 10-YARD HASH LINES */}
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
            const x = 45 + i * 41;
            const is50 = i === 5;
            return (
              <g key={`yd-${i}`}>
                <line
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="44"
                  stroke="#ffffff"
                  strokeWidth={is50 ? 1.5 : 0.75}
                  strokeOpacity={is50 ? 0.8 : 0.4}
                />
              </g>
            );
          })}

          {/* IN-BOUNDS HASH MARKS */}
          {Array.from({ length: 41 }).map((_, i) => {
            const x = 45 + i * 10;
            return (
              <g key={`hash-${i}`} stroke="#ffffff" strokeWidth="0.75" strokeOpacity="0.55">
                <line x1={x} y1="2" x2={x} y2="5" />
                <line x1={x} y1="17" x2={x} y2="19.5" />
                <line x1={x} y1="24.5" x2={x} y2="27" />
                <line x1={x} y1="39" x2={x} y2="42" />
              </g>
            );
          })}

          {/* 1ST DOWN LINE (Yellow line) */}
          {firstDownSvgX <= 455 && (
            <g id="first-down-line">
              <line
                x1={firstDownSvgX}
                y1="0"
                x2={firstDownSvgX}
                y2="44"
                stroke="#facc15"
                strokeWidth="2"
                strokeDasharray="4 2"
                opacity="0.95"
              />
            </g>
          )}

          {/* LINE OF SCRIMMAGE (Blue line) */}
          <line
            x1={ballSvgX}
            y1="0"
            x2={ballSvgX}
            y2="44"
            stroke="#38bdf8"
            strokeWidth="1.5"
            opacity="0.85"
          />

          {/* PRE-SNAP MOTION INDICATOR */}
          {isPreSnapMotion && (
            <g id="motion-ghost" opacity="0.85">
              <circle cx={ballSvgX - 22} cy={ballSvgY} r="5" fill="#f43f5e" opacity="0.6" />
              <path
                d={`M ${ballSvgX - 32} ${ballSvgY} L ${ballSvgX - 12} ${ballSvgY}`}
                stroke="#f43f5e"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              <polygon
                points={`${ballSvgX - 10},${ballSvgY} ${ballSvgX - 14},${ballSvgY - 3} ${ballSvgX - 14},${ballSvgY + 3}`}
                fill="#f43f5e"
              />
            </g>
          )}

          {/* THE FOOTBALL */}
          <g id="hardmode-field-ball">
            {/* Shadow */}
            <ellipse
              cx={ballSvgX}
              cy={ballSvgY + 3.5}
              rx="7.5"
              ry="2.5"
              fill="#000000"
              opacity="0.45"
            />
            {/* Ball body */}
            <ellipse
              cx={ballSvgX}
              cy={ballSvgY}
              rx="8"
              ry="4.5"
              fill="#78350f"
              stroke="#ffffff"
              strokeWidth="0.8"
            />
            {/* White end stripes */}
            <path
              d={`M ${ballSvgX - 4.5} ${ballSvgY - 3.5} L ${ballSvgX - 4.5} ${ballSvgY + 3.5}`}
              stroke="#ffffff"
              strokeWidth="0.8"
              strokeOpacity="0.9"
            />
            <path
              d={`M ${ballSvgX + 4.5} ${ballSvgY - 3.5} L ${ballSvgX + 4.5} ${ballSvgY + 3.5}`}
              stroke="#ffffff"
              strokeWidth="0.8"
              strokeOpacity="0.9"
            />
            {/* White laces */}
            <line
              x1={ballSvgX - 3}
              y1={ballSvgY}
              x2={ballSvgX + 3}
              y2={ballSvgY}
              stroke="#ffffff"
              strokeWidth="0.9"
            />
            <line
              x1={ballSvgX - 1.5}
              y1={ballSvgY - 1.5}
              x2={ballSvgX - 1.5}
              y2={ballSvgY + 1.5}
              stroke="#ffffff"
              strokeWidth="0.7"
            />
            <line
              x1={ballSvgX}
              y1={ballSvgY - 1.5}
              x2={ballSvgX}
              y2={ballSvgY + 1.5}
              stroke="#ffffff"
              strokeWidth="0.7"
            />
            <line
              x1={ballSvgX + 1.5}
              y1={ballSvgY - 1.5}
              x2={ballSvgX + 1.5}
              y2={ballSvgY + 1.5}
              stroke="#ffffff"
              strokeWidth="0.7"
            />
            {/* Gold ping highlight */}
            <circle
              cx={ballSvgX}
              cy={ballSvgY}
              r="8.5"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1.2"
              opacity="0.8"
            />
          </g>
        </svg>
      </div>

      {/* Bottom Sub-info: Direction of Drive and Pre-Snap Motion status */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1.5 px-0.5">
        <div className="flex items-center space-x-1">
          <span className="text-slate-500">DRIVING:</span>
          <span className="text-amber-400 font-bold flex items-center space-x-0.5">
            <span>{offAbbr}</span>
            <span>►►</span>
            <span>{defAbbr} GOAL LINE</span>
          </span>
        </div>

        {isPreSnapMotion ? (
          <span className="text-rose-400 font-bold flex items-center space-x-1 animate-pulse">
            <span>⚡ MOTION ACTIVE</span>
          </span>
        ) : (
          <span className="text-slate-500">MOTION: STANDBY</span>
        )}
      </div>

      {/* Button to open 2D Field View without scrolling up */}
      {onOpenFieldCam && (
        <div className="pt-2 mt-2 border-t border-slate-800/80 flex items-center justify-center">
          <button
            type="button"
            id="btn-hardmode-open-field-cam"
            onClick={onOpenFieldCam}
            className="w-full py-1.5 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-display font-bold flex items-center justify-center space-x-2 transition shadow-sm cursor-pointer"
          >
            <span>📺</span>
            <span>OPEN LIVE 2D FIELD & FORMATIONS</span>
          </button>
        </div>
      )}
    </div>
  );
};
