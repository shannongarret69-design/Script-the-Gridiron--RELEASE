import React, { useState } from 'react';
import { ActiveGame, NFLTeam } from '../types/game';
import { FranchisePlayer } from '../types/franchise';
import {
  ALL_POSITIONS,
  getStartersFromRoster,
  initializeDepthChartOrder,
  movePlayerDepth,
  promoteToStarter,
  toggleBench,
  changePosition,
} from '../utils/rosterUtils';
import { generateInitialTeamRoster } from '../utils/aiRosterGenerator';
import { Users, ArrowUp, ArrowDown, Star, Ban, X, RefreshCw, ShieldAlert, Award, ArrowRightLeft, Sparkles } from 'lucide-react';

interface InGameDepthChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: ActiveGame;
  setGame: React.Dispatch<React.SetStateAction<ActiveGame | null>>;
  onSyncSeasonRoster?: (teamId: string, updatedRoster: FranchisePlayer[]) => void;
}

export const InGameDepthChartModal: React.FC<InGameDepthChartModalProps> = ({
  isOpen,
  onClose,
  game,
  setGame,
  onSyncSeasonRoster,
}) => {
  const [selectedTeamSide, setSelectedTeamSide] = useState<'home' | 'away'>('home');
  const [selectedPosGroup, setSelectedPosGroup] = useState<string>('ALL');
  const [positionModalPlayer, setPositionModalPlayer] = useState<FranchisePlayer | null>(null);

  if (!isOpen || !game) return null;

  const targetTeam = selectedTeamSide === 'home' ? game.homeTeam : game.awayTeam;

  // Ensure roster exists on team
  let currentRoster = targetTeam.roster;
  if (!currentRoster || currentRoster.length === 0) {
    currentRoster = generateInitialTeamRoster(targetTeam);
  }
  currentRoster = initializeDepthChartOrder(currentRoster);

  // Filter roster by selected position
  const filteredRoster = currentRoster.filter((p) => {
    if (selectedPosGroup === 'ALL') return true;
    if (selectedPosGroup === 'OFF') return ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C'].includes(p.position);
    if (selectedPosGroup === 'DEF') return ['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(p.position);
    return p.position === selectedPosGroup;
  });

  const handleUpdateRosterState = (newRoster: FranchisePlayer[]) => {
    const starters = getStartersFromRoster(newRoster, targetTeam);

    const updatedTeam: NFLTeam = {
      ...targetTeam,
      starQB: starters.starQB,
      starRB: starters.starRB,
      starWR: starters.starWR,
      starDef: starters.starDef,
      roster: newRoster,
    };

    setGame((prevGame) => {
      if (!prevGame) return null;
      return {
        ...prevGame,
        homeTeam: selectedTeamSide === 'home' ? updatedTeam : prevGame.homeTeam,
        awayTeam: selectedTeamSide === 'away' ? updatedTeam : prevGame.awayTeam,
      };
    });

    if (onSyncSeasonRoster) {
      onSyncSeasonRoster(targetTeam.id, newRoster);
    }
  };

  const handlePromote = (playerId: string) => {
    const updated = promoteToStarter(currentRoster, playerId);
    handleUpdateRosterState(updated);
  };

  const handleToggleBench = (playerId: string) => {
    const updated = toggleBench(currentRoster, playerId);
    handleUpdateRosterState(updated);
  };

  const handleMoveDepth = (playerId: string, dir: 'up' | 'down') => {
    const updated = movePlayerDepth(currentRoster, playerId, dir);
    handleUpdateRosterState(updated);
  };

  const handleChangePos = (playerId: string, newPos: FranchisePlayer['position']) => {
    const updated = changePosition(currentRoster, playerId, newPos);
    handleUpdateRosterState(updated);
  };

  // Group roster by position for depth view
  const posGroups = Array.from(new Set(currentRoster.map((p) => p.position)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-white">
                IN-GAME <span className="text-amber-400">DEPTH CHART & BENCH SUBS</span>
              </h3>
              <p className="text-xs text-slate-400">
                Swap starters, bench players, or switch positions mid-game. Takes effect immediately on next play!
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Team Toggle */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setSelectedTeamSide('home')}
                className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition ${
                  selectedTeamSide === 'home'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {game.homeTeam.abbr} (Home)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTeamSide('away')}
                className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition ${
                  selectedTeamSide === 'away'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {game.awayTeam.abbr} (Away)
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Current Active Starters Bar */}
        <div className="bg-slate-900/60 border-b border-slate-800/80 px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 uppercase">ACTIVE QB1:</span>
            <span className="text-amber-400 font-bold">{targetTeam.starQB}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 uppercase">ACTIVE RB1:</span>
            <span className="text-emerald-400 font-bold">{targetTeam.starRB}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 uppercase">ACTIVE WR1:</span>
            <span className="text-cyan-400 font-bold">{targetTeam.starWR}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 uppercase">ACTIVE DEF STAR:</span>
            <span className="text-rose-400 font-bold">{targetTeam.starDef}</span>
          </div>
        </div>

        {/* Position Filter Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950 flex flex-wrap items-center gap-1.5">
          {['ALL', 'OFF', 'DEF', 'QB', 'RB', 'WR', 'TE', 'OT', 'EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS', 'K'].map((pos) => (
            <button
              key={pos}
              onClick={() => setSelectedPosGroup(pos)}
              className={`px-2.5 py-1 rounded-lg text-xs font-display font-bold transition ${
                selectedPosGroup === pos
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* Roster & Depth List */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {posGroups
            .filter((pos) => {
              if (selectedPosGroup === 'ALL') return true;
              if (selectedPosGroup === 'OFF') return ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C'].includes(pos);
              if (selectedPosGroup === 'DEF') return ['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(pos);
              return pos === selectedPosGroup;
            })
            .map((pos) => {
              const playersInPos = filteredRoster
                .filter((p) => p.position === pos)
                .sort((a, b) => (a.depthChartOrder ?? 1) - (b.depthChartOrder ?? 1));

              if (playersInPos.length === 0) return null;

              return (
                <div key={pos} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-mono font-bold text-xs uppercase border border-amber-500/30">
                      {pos} POSITION GROUP ({playersInPos.length})
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      TOP PLAYER = IN-GAME STARTER
                    </span>
                  </div>

                  <div className="space-y-2">
                    {playersInPos.map((player, idx) => {
                      const isStarter = idx === 0 && !player.isBenched;
                      const isBenched = player.isBenched;

                      return (
                        <div
                          key={player.id ? `${player.id}-${idx}` : `${player.position}-${player.name}-${idx}`}
                          className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isBenched
                              ? 'bg-rose-950/20 border-rose-900/50 opacity-75'
                              : isStarter
                              ? 'bg-slate-900 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Left Details */}
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-xs text-amber-400">
                              #{idx + 1}
                            </div>

                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="font-display font-black text-base text-white">
                                  {player.name}
                                </h4>
                                {isStarter && (
                                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-display font-black text-[10px] tracking-wider uppercase">
                                    STARTER
                                  </span>
                                )}
                                {isBenched && (
                                  <span className="px-2 py-0.5 rounded bg-rose-500/30 text-rose-300 border border-rose-500/40 font-mono font-bold text-[10px] uppercase">
                                    BENCHED
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center space-x-3 text-xs text-slate-400 mt-0.5">
                                <span className="font-mono text-white font-bold">OVR {player.ovr}</span>
                                <span>•</span>
                                <span>SPD {player.speed}</span>
                                <span>•</span>
                                <span>{player.archetype}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Controls */}
                          <div className="flex items-center flex-wrap gap-2">
                            {/* Position Selector */}
                            <select
                              value={player.position}
                              onChange={(e) => handleChangePos(player.id, e.target.value as FranchisePlayer['position'])}
                              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 font-mono focus:outline-none focus:border-amber-500"
                              title="Change Player Position"
                            >
                              {ALL_POSITIONS.map((p) => (
                                <option key={p} value={p}>
                                  Pos: {p}
                                </option>
                              ))}
                            </select>

                            {/* Up / Down Depth Buttons */}
                            <button
                              type="button"
                              onClick={() => handleMoveDepth(player.id, 'up')}
                              disabled={idx === 0}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800"
                              title="Move Depth Chart Order Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveDepth(player.id, 'down')}
                              disabled={idx === playersInPos.length - 1}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800"
                              title="Move Depth Chart Order Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Promote to Starter Button */}
                            {!isStarter && (
                              <button
                                type="button"
                                onClick={() => handlePromote(player.id)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-xs transition flex items-center space-x-1"
                              >
                                <Star className="w-3 h-3 fill-current" />
                                <span>START</span>
                              </button>
                            )}

                            {/* Bench / Unbench Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleBench(player.id)}
                              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition border flex items-center space-x-1 ${
                                isBenched
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                              }`}
                            >
                              <Ban className="w-3 h-3" />
                              <span>{isBenched ? 'UNBENCH' : 'BENCH'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-between items-center text-xs text-slate-400">
          <span>Bench or promote players freely. Changes take effect on the very next play!</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20"
          >
            RETURN TO GAME
          </button>
        </div>
      </div>
    </div>
  );
};
