import React from 'react';
import { ActiveGame } from '../types/game';
import { Clock, Timer, Pause, Play, Sun, CloudRain, Snowflake, Moon, Disc } from 'lucide-react';

interface GameScoreboardProps {
  game: ActiveGame;
  playClock: number;
  isClockPaused: boolean;
  onToggleClockPause: () => void;
  onResetPlayClock?: (seconds: number) => void;
  onSimulateRestOfGame: () => void;
  onSimulateQuarter: () => void;
}

export const GameScoreboard: React.FC<GameScoreboardProps> = ({
  game,
  playClock,
  isClockPaused,
  onToggleClockPause,
  onResetPlayClock,
  onSimulateRestOfGame,
  onSimulateQuarter,
}) => {
  const {
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    quarter,
    quarterTimeSeconds,
    possession,
    down,
    distance,
    yardLine,
    homeTimeouts,
    awayTimeouts,
    isGameOver,
    settings,
  } = game;

  const mins = Math.floor(quarterTimeSeconds / 60);
  const secs = quarterTimeSeconds % 60;
  const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  const getQuarterLabel = (q: number) => {
    if (q === 1) return '1ST QTR';
    if (q === 2) return '2ND QTR';
    if (q === 3) return '3RD QTR';
    if (q === 4) return '4TH QTR';
    return 'OVERTIME';
  };

  const getDownString = (d: number, dist: number, y: number) => {
    const dStr = d === 1 ? '1ST' : d === 2 ? '2ND' : d === 3 ? '3RD' : '4TH';
    if (y + dist >= 100) return `${dStr} & GOAL`;
    return `${dStr} & ${dist}`;
  };

  const ballSpotText = () => {
    const isHomePoss = possession === 'home';
    const possessingTeam = isHomePoss ? homeTeam : awayTeam;
    const defendingTeam = isHomePoss ? awayTeam : homeTeam;
    if (yardLine === 50) return '50 YD LINE';
    if (yardLine < 50) return `${possessingTeam.abbr} ${yardLine}`;
    return `${defendingTeam.abbr} ${100 - yardLine}`;
  };

  const getWeatherIcon = () => {
    switch (settings.weather) {
      case 'Rain':
        return <CloudRain className="w-3.5 h-3.5 text-blue-400" />;
      case 'Snow':
        return <Snowflake className="w-3.5 h-3.5 text-sky-200" />;
      case 'Night':
        return <Moon className="w-3.5 h-3.5 text-indigo-300" />;
      case 'Dome':
        return <Disc className="w-3.5 h-3.5 text-slate-300" />;
      default:
        return <Sun className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-2 border-slate-700/80 rounded-xl shadow-2xl p-3 sm:p-4 mb-3">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Teams & Scores Scorebug */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-center md:justify-start">
          {/* AWAY TEAM */}
          <div
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg border transition-all ${
              possession === 'away'
                ? 'bg-slate-800/90 border-amber-500 shadow-md shadow-amber-500/10'
                : 'bg-slate-900/60 border-slate-800'
            }`}
          >
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center font-display font-extrabold text-sm shadow-md"
              style={{
                backgroundColor: awayTeam?.primaryColor || '#1e293b',
                color: awayTeam?.textColor || '#ffffff',
                border: `2px solid ${awayTeam?.secondaryColor || '#ffffff'}`,
              }}
            >
              {awayTeam?.abbr || 'AWY'}
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-display font-bold text-sm text-white tracking-wide">
                  {(awayTeam?.name || 'Away Team').toUpperCase()}
                </span>
                <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  {awayTeam?.ovr ?? 70} OVR
                </span>
                {possession === 'away' && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </div>
              {/* Timeouts */}
              <div className="flex items-center space-x-1 mt-0.5">
                {[1, 2, 3].map((t) => (
                  <span
                    key={t}
                    className={`w-2 h-1 rounded-sm ${
                      t <= (awayTimeouts ?? 3) ? 'bg-amber-400' : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
            <span className="font-display font-black text-2xl text-white ml-2">
              {awayScore}
            </span>
          </div>

          <span className="font-display text-slate-500 text-xs font-bold">AT</span>

          {/* HOME TEAM */}
          <div
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg border transition-all ${
              possession === 'home'
                ? 'bg-slate-800/90 border-amber-500 shadow-md shadow-amber-500/10'
                : 'bg-slate-900/60 border-slate-800'
            }`}
          >
            <span className="font-display font-black text-2xl text-white mr-2">
              {homeScore}
            </span>
            <div>
              <div className="flex items-center space-x-1.5 justify-end">
                {possession === 'home' && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
                <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  {homeTeam?.ovr ?? 70} OVR
                </span>
                <span className="font-display font-bold text-sm text-white tracking-wide">
                  {(homeTeam?.name || 'Home Team').toUpperCase()}
                </span>
              </div>
              {/* Timeouts */}
              <div className="flex items-center space-x-1 mt-0.5 justify-end">
                {[1, 2, 3].map((t) => (
                  <span
                    key={t}
                    className={`w-2 h-1 rounded-sm ${
                      t <= (homeTimeouts ?? 3) ? 'bg-amber-400' : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center font-display font-extrabold text-sm shadow-md"
              style={{
                backgroundColor: homeTeam?.primaryColor || '#1e293b',
                color: homeTeam?.textColor || '#ffffff',
                border: `2px solid ${homeTeam?.secondaryColor || '#ffffff'}`,
              }}
            >
              {homeTeam?.abbr || 'HOM'}
            </div>
          </div>
        </div>

        {/* Down, Distance, Game Clock, Play Clock & Pause Control */}
        <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner flex-wrap gap-y-2 justify-center">
          <div className="text-center px-1.5">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
              DOWN & DIST
            </span>
            <span className="font-display font-black text-sm sm:text-base text-amber-400">
              {isGameOver ? 'FINAL' : getDownString(down, distance, yardLine)}
            </span>
          </div>

          <div className="h-7 w-px bg-slate-800 hidden sm:block" />

          <div className="text-center px-1.5">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
              BALL ON
            </span>
            <span className="font-display font-bold text-sm sm:text-base text-white">
              {ballSpotText()}
            </span>
          </div>

          <div className="h-7 w-px bg-slate-800 hidden sm:block" />

          {/* GAME CLOCK */}
          <div className="text-center px-2 bg-slate-900/80 py-1 rounded-md border border-slate-800/80">
            <div className="flex items-center justify-center space-x-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>GAME CLOCK</span>
              <span className="text-amber-400 ml-0.5 font-bold">({getQuarterLabel(quarter)})</span>
            </div>
            <div className="flex items-center justify-center space-x-1.5">
              <span className="font-display font-black text-sm sm:text-base text-white font-mono">
                {isGameOver ? '0:00' : timeStr}
              </span>
              {!isGameOver && (
                <span
                  className={`w-2 h-2 rounded-full transition-colors ${
                    isClockPaused ? 'bg-amber-500' : 'bg-emerald-400 animate-ping'
                  }`}
                  title={isClockPaused ? 'Game Clock Paused' : 'Game Clock Live'}
                />
              )}
            </div>
          </div>

          <div className="h-7 w-px bg-slate-800 hidden sm:block" />

          {/* PLAY CLOCK */}
          <div className="text-center px-2 bg-slate-900/80 py-1 rounded-md border border-slate-800/80">
            <div className="flex items-center justify-center space-x-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <Timer className="w-3 h-3 text-amber-400" />
              <span>PLAY CLOCK</span>
            </div>
            <div className="flex items-center justify-center space-x-1">
              <span
                className={`font-display font-black text-sm sm:text-base font-mono tracking-wider ${
                  playClock <= 5
                    ? 'text-rose-500 animate-pulse font-extrabold'
                    : playClock <= 10
                    ? 'text-amber-400 font-bold'
                    : 'text-emerald-400'
                }`}
              >
                :{playClock.toString().padStart(2, '0')}
              </span>
              {/* Quick Play Clock Reset Buttons */}
              {!isGameOver && onResetPlayClock && (
                <div className="flex items-center space-x-0.5 ml-1">
                  <button
                    id="btn-playclock-reset-40"
                    onClick={() => onResetPlayClock(40)}
                    title="Reset play clock to 40 seconds"
                    className="text-[9px] px-1 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700"
                  >
                    40
                  </button>
                  <button
                    id="btn-playclock-reset-25"
                    onClick={() => onResetPlayClock(25)}
                    title="Reset play clock to 25 seconds"
                    className="text-[9px] px-1 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700"
                  >
                    25
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="h-7 w-px bg-slate-800 hidden sm:block" />

          {/* PAUSE BOTH CLOCKS BUTTON */}
          <div className="text-center px-1">
            <button
              id="btn-pause-both-clocks"
              onClick={onToggleClockPause}
              disabled={isGameOver}
              title={isClockPaused ? 'Resume Game Clock & Play Clock' : 'Pause Game Clock & Play Clock'}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition shadow-sm ${
                isClockPaused
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-amber-500/20 animate-pulse'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
              } disabled:opacity-40`}
            >
              {isClockPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="font-mono uppercase tracking-wider text-[11px]">RESUME CLOCKS</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current text-amber-400" />
                  <span className="font-mono uppercase tracking-wider text-[11px]">PAUSE CLOCKS</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Simulator & Venue details */}
        <div className="flex items-center space-x-2">
          <div className="hidden lg:flex flex-col text-right text-[11px] text-slate-400 mr-2">
            <span className="font-semibold text-slate-300">{homeTeam.stadium}</span>
            <span className="flex items-center justify-end space-x-1">
              {getWeatherIcon()}
              <span>{settings.weather} • {settings.quarterLengthMinutes} min Qtrs</span>
            </span>
          </div>

          {!isGameOver && (
            <div className="flex items-center space-x-1">
              <button
                id="btn-sim-quarter"
                onClick={onSimulateQuarter}
                title="Simulate 5 plays quickly"
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold rounded text-slate-300 hover:text-white transition"
              >
                Fast Sim +5
              </button>
              <button
                id="btn-sim-rest-game"
                onClick={onSimulateRestOfGame}
                title="Simulate directly to the final whistle"
                className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold rounded text-amber-300 hover:text-amber-200 transition"
              >
                Sim to Final
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
