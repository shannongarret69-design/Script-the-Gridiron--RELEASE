import React, { useMemo } from 'react';
import { ActiveGame, PlayResult } from '../types/game';
import { X, Trophy, AlertTriangle, CheckCircle2, ChevronUp, Tv } from 'lucide-react';

interface MiniFieldScoreboardBarProps {
  game: ActiveGame;
  isFieldVisible: boolean;
  isAnimating: boolean;
  animProgress: number;
  lastResult: PlayResult | null;
  hardModePopup: {
    result: PlayResult;
    timestamp: number;
  } | null;
  onDismissPopup: () => void;
  onScrollToField?: () => void;
  onOpenFieldCam?: () => void;
}

export const MiniFieldScoreboardBar: React.FC<MiniFieldScoreboardBarProps> = ({
  game,
  isFieldVisible,
  isAnimating,
  animProgress,
  lastResult,
  hardModePopup,
  onDismissPopup,
  onScrollToField,
  onOpenFieldCam,
}) => {
  const { homeTeam, awayTeam, possession, yardLine, homeScore, awayScore, down, distance } = game;

  // Derive initials (e.g., KC, PHI, SF)
  const awayInitials = (awayTeam.abbr || awayTeam.name.substring(0, 3)).toUpperCase();
  const homeInitials = (homeTeam.abbr || homeTeam.name.substring(0, 3)).toUpperCase();

  // Calculate ball position on the mini field (0 to 100)
  // Away is on Left, Home is on Right.
  // When possession === 'away': Away drives towards Home endzone (Left to Right, 0 -> 100).
  // When possession === 'home': Home drives towards Away endzone (Right to Left, 100 -> 0).
  const ballYard = useMemo(() => {
    const isAwayPoss = possession === 'away';
    let baseYard = yardLine;

    if (isAnimating && lastResult) {
      const gain = lastResult.yardsGained || 0;
      baseYard = Math.max(0, Math.min(100, yardLine + gain * animProgress));
    }

    if (isAwayPoss) {
      // Away driving 0 to 100 (left to right)
      return Math.max(0, Math.min(100, baseYard));
    } else {
      // Home driving towards Away goal line (right to left, so 0 is at right, 100 is at left)
      return Math.max(0, Math.min(100, 100 - baseYard));
    }
  }, [possession, yardLine, isAnimating, lastResult, animProgress]);

  // Mini field SVG dimensions
  // Total SVG width = 500, height = 44
  // Left Endzone (Away): x=0 to 45 (width 45)
  // Field Playing Surface: x=45 to 455 (width 410)
  // Right Endzone (Home): x=455 to 500 (width 45)
  const ballSvgX = 45 + (ballYard / 100) * 410;
  const ballSvgY = 22;

  // If main field is currently in view and no popup, don't show the bar
  if (isFieldVisible && !hardModePopup) {
    return null;
  }

  const resultToShow = hardModePopup?.result;

  return (
    <div
      id="mini-field-scoreboard-container"
      className="fixed top-[58px] sm:top-[64px] inset-x-0 z-40 pointer-events-none transition-all duration-300 ease-in-out"
    >
      {/* Main Mini Field + Scoreboard Bar */}
      <div className="bg-slate-950/95 backdrop-blur-md border-b-2 border-slate-800 shadow-2xl pointer-events-auto px-2 sm:px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* VERY LEFT: Away Team Initials + Score */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <div
              className="w-2.5 sm:w-3 h-8 sm:h-9 rounded-sm shadow-sm"
              style={{ backgroundColor: awayTeam.primaryColor || '#64748b' }}
              title={awayTeam.name}
            />
            <div className="flex items-center space-x-1.5 sm:space-x-2.5">
              <div className="flex flex-col">
                <span className="font-display font-black text-sm sm:text-base text-white tracking-wider flex items-center gap-1">
                  {awayInitials}
                  {possession === 'away' && (
                    <span className="text-[11px] text-amber-400 font-normal" title="Possession">
                      🏈
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-mono text-slate-400 hidden sm:inline leading-none">
                  AWAY
                </span>
              </div>
              <span className="font-mono font-black text-xl sm:text-2xl text-white bg-slate-900 border border-slate-800 px-2 py-0.5 rounded shadow-inner">
                {awayScore}
              </span>
            </div>
          </div>

          {/* CENTER: The Mini Field (End zones, Hashes, and Ball only) */}
          <div className="flex-1 max-w-xs sm:max-w-md md:max-w-lg mx-1 sm:mx-3 flex flex-col items-center">
            {/* Subtle Down & Distance + Clock Indicator right above the mini field */}
            <div className="flex items-center justify-between w-full text-[10px] font-mono text-slate-400 px-1 mb-0.5 select-none">
              <span>
                {down}
                {down === 1 ? 'st' : down === 2 ? 'nd' : down === 3 ? 'rd' : 'th'} & {distance}
              </span>
              <span className="text-amber-400 font-semibold">
                {possession === 'away' ? `► ${awayInitials}` : `${homeInitials} ◄`} at {yardLine} YD
              </span>
              <span>
                Q{game.quarter} {Math.floor(game.quarterTimeSeconds / 60)}:
                {String(game.quarterTimeSeconds % 60).padStart(2, '0')}
              </span>
            </div>

            {/* Field SVG: Strictly End zones, Hashes, and Ball */}
            <div className="w-full h-8 sm:h-9 relative rounded overflow-hidden shadow-inner border border-slate-700 bg-emerald-950">
              <svg
                viewBox="0 0 500 44"
                className="w-full h-full block"
                preserveAspectRatio="none"
              >
                {/* Grass Surface */}
                <rect x="0" y="0" width="500" height="44" fill="#15803d" />

                {/* Subtle alternating 5-yard turf stripes */}
                {Array.from({ length: 20 }).map((_, i) =>
                  i % 2 === 1 ? (
                    <rect
                      key={`stripe-${i}`}
                      x={45 + i * 20.5}
                      y="0"
                      width="20.5"
                      height="44"
                      fill="#16a34a"
                      opacity="0.3"
                    />
                  ) : null
                )}

                {/* LEFT END ZONE (Away Team) */}
                <rect
                  x="0"
                  y="0"
                  width="45"
                  height="44"
                  fill={awayTeam.primaryColor || '#1e293b'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {/* RIGHT END ZONE (Home Team) */}
                <rect
                  x="455"
                  y="0"
                  width="45"
                  height="44"
                  fill={homeTeam.primaryColor || '#0284c7'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {/* GOAL LINES */}
                <line x1="45" y1="0" x2="45" y2="44" stroke="#ffffff" strokeWidth="2" />
                <line x1="455" y1="0" x2="455" y2="44" stroke="#ffffff" strokeWidth="2" />

                {/* 10-YARD HASH LINES */}
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
                  const x = 45 + i * 41;
                  const is50 = i === 5;
                  return (
                    <line
                      key={`yd-${i}`}
                      x1={x}
                      y1="0"
                      x2={x}
                      y2="44"
                      stroke="#ffffff"
                      strokeWidth={is50 ? 1.5 : 0.75}
                      strokeOpacity={is50 ? 0.8 : 0.45}
                    />
                  );
                })}

                {/* HASH MARKS (Top Sideline, In-bounds Hashes, Bottom Sideline) */}
                {Array.from({ length: 41 }).map((_, i) => {
                  const x = 45 + i * 10;
                  return (
                    <g key={`hash-${i}`} stroke="#ffffff" strokeWidth="0.75" strokeOpacity="0.55">
                      {/* Top hash */}
                      <line x1={x} y1="2" x2={x} y2="6" />
                      {/* In-bounds hashes */}
                      <line x1={x} y1="16" x2={x} y2="19" />
                      <line x1={x} y1="25" x2={x} y2="28" />
                      {/* Bottom hash */}
                      <line x1={x} y1="38" x2={x} y2="42" />
                    </g>
                  );
                })}

                {/* THE BALL */}
                <g id="mini-field-ball" transform={`translate(0, 0)`}>
                  {/* Shadow */}
                  <ellipse
                    cx={ballSvgX}
                    cy={ballSvgY + 3.5}
                    rx="7.5"
                    ry="2.5"
                    fill="#000000"
                    opacity="0.45"
                  />
                  {/* Football body */}
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
                  {/* Golden Ping Indicator */}
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
          </div>

          {/* VERY RIGHT: Home Score + Initials */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <div className="flex items-center space-x-1.5 sm:space-x-2.5 text-right">
              <span className="font-mono font-black text-xl sm:text-2xl text-white bg-slate-900 border border-slate-800 px-2 py-0.5 rounded shadow-inner">
                {homeScore}
              </span>
              <div className="flex flex-col items-end">
                <span className="font-display font-black text-sm sm:text-base text-white tracking-wider flex items-center gap-1">
                  {possession === 'home' && (
                    <span className="text-[11px] text-amber-400 font-normal" title="Possession">
                      🏈
                    </span>
                  )}
                  {homeInitials}
                </span>
                <span className="text-[9px] font-mono text-slate-400 hidden sm:inline leading-none">
                  HOME
                </span>
              </div>
            </div>
            <div
              className="w-2.5 sm:w-3 h-8 sm:h-9 rounded-sm shadow-sm"
              style={{ backgroundColor: homeTeam.primaryColor || '#0284c7' }}
              title={homeTeam.name}
            />

            {/* Quick button to open live Field Cam PiP / modal */}
            {onOpenFieldCam && (
              <button
                type="button"
                id="btn-minibar-open-fieldcam"
                onClick={onOpenFieldCam}
                className="flex items-center space-x-1 py-1.5 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-display font-black shadow transition cursor-pointer"
                title="View live 2D field without scrolling"
              >
                <Tv className="w-3.5 h-3.5" />
                <span className="hidden md:inline">FIELD CAM</span>
              </button>
            )}

            {/* Optional quick button to scroll back to field */}
            {onScrollToField && (
              <button
                onClick={onScrollToField}
                className="hidden lg:flex items-center justify-center p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                title="Scroll back up to full field"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5-SECOND POPUP MESSAGE UNDER SCOREBOARD WHEN SCROLLED DOWN */}
      {resultToShow && (
        <div
          id="hard-mode-play-outcome-popup"
          className="max-w-2xl mx-auto px-3 sm:px-4 mt-2 pointer-events-auto transition-all animate-in fade-in slide-in-from-top-3 duration-300"
        >
          <div
            className={`rounded-xl p-3 sm:p-3.5 border shadow-2xl relative overflow-hidden backdrop-blur-md ${
              resultToShow.isTouchdown
                ? 'bg-amber-950/95 border-amber-500 text-amber-100 shadow-amber-500/20'
                : resultToShow.isTurnover
                ? 'bg-rose-950/95 border-rose-500 text-rose-100 shadow-rose-500/20'
                : resultToShow.isFirstDown
                ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-emerald-500/20'
                : 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-slate-900/50'
            }`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start space-x-2.5">
                {/* Result Type Badge */}
                <div className="shrink-0 mt-0.5">
                  {resultToShow.isTouchdown ? (
                    <span className="flex items-center space-x-1 bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-display font-black text-xs uppercase tracking-wider shadow">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>TOUCHDOWN</span>
                    </span>
                  ) : resultToShow.isTurnover ? (
                    <span className="flex items-center space-x-1 bg-rose-600 text-white px-2 py-0.5 rounded font-display font-black text-xs uppercase tracking-wider shadow">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{resultToShow.turnoverType ? resultToShow.turnoverType.toUpperCase() : 'TURNOVER'}</span>
                    </span>
                  ) : resultToShow.isFirstDown ? (
                    <span className="flex items-center space-x-1 bg-emerald-500 text-slate-950 px-2 py-0.5 rounded font-display font-black text-xs uppercase tracking-wider shadow">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>FIRST DOWN</span>
                    </span>
                  ) : (
                    <span className="bg-slate-800 text-slate-200 border border-slate-700 px-2 py-0.5 rounded font-display font-black text-xs uppercase tracking-wider">
                      {resultToShow.yardsGained > 0
                        ? `+${resultToShow.yardsGained} YDS`
                        : resultToShow.yardsGained < 0
                        ? `${resultToShow.yardsGained} YDS`
                        : resultToShow.outcomeType.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Play Commentary & Details */}
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-semibold leading-snug">
                    {resultToShow.commentary}
                  </p>
                  <div className="flex items-center space-x-3 text-[10px] font-mono opacity-80">
                    {resultToShow.keyPlayer && (
                      <span>
                        Key Player: <strong className="text-white">{resultToShow.keyPlayer}</strong>
                      </span>
                    )}
                    <span>
                      Gain:{' '}
                      <strong className="text-white">
                        {resultToShow.yardsGained > 0
                          ? `+${resultToShow.yardsGained}`
                          : resultToShow.yardsGained}{' '}
                        YDS
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                id="btn-dismiss-hardmode-popup"
                onClick={onDismissPopup}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition shrink-0"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 5-Second Animated Shrinking Countdown Progress Bar */}
            <div className="w-full bg-black/40 h-1 rounded-full mt-2.5 overflow-hidden">
              <div
                key={hardModePopup.timestamp}
                className={`h-full rounded-full animate-shrink-5s ${
                  resultToShow.isTouchdown
                    ? 'bg-amber-400'
                    : resultToShow.isTurnover
                    ? 'bg-rose-400'
                    : resultToShow.isFirstDown
                    ? 'bg-emerald-400'
                    : 'bg-cyan-400'
                }`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
