import React, { useState } from 'react';
import { FranchiseSeasonState, FranchisePlayer } from '../types/franchise';
import { NFLTeam } from '../types/game';
import {
  ALL_POSITIONS,
  getStartersFromRoster,
  initializeDepthChartOrder,
  movePlayerDepth,
  promoteToStarter,
  toggleBench,
  changePosition,
} from '../utils/rosterUtils';
import { getMaxOvrForPlayer } from '../utils/playerLeveling';
import {
  Shield,
  Sparkles,
  Award,
  Star,
  ArrowUp,
  ArrowDown,
  Ban,
  Layers,
  List,
  UserCheck,
  TrendingUp,
  Zap,
  ArrowRightLeft,
} from 'lucide-react';

interface RosterDepthChartViewProps {
  season: FranchiseSeasonState;
  userTeam: NFLTeam;
  onUpdateSeason?: (updatedSeason: FranchiseSeasonState) => void;
}

export const RosterDepthChartView: React.FC<RosterDepthChartViewProps> = ({
  season,
  userTeam,
  onUpdateSeason,
}) => {
  const [viewMode, setViewMode] = useState<'depth' | 'list'>('depth');
  const [selectedPos, setSelectedPos] = useState<string>('ALL');
  const [positionModalPlayer, setPositionModalPlayer] = useState<FranchisePlayer | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  let roster = season.userRoster || [];
  roster = initializeDepthChartOrder(roster);

  const handleApplyRosterChanges = (newRoster: FranchisePlayer[]) => {
    const starters = getStartersFromRoster(newRoster, userTeam);

    const updatedSeason: FranchiseSeasonState = {
      ...season,
      userRoster: newRoster,
    };

    if (onUpdateSeason) {
      onUpdateSeason(updatedSeason);
    }
  };

  const handlePromote = (playerId: string) => {
    const updated = promoteToStarter(roster, playerId);
    handleApplyRosterChanges(updated);
  };

  const handleToggleBench = (playerId: string) => {
    const updated = toggleBench(roster, playerId);
    handleApplyRosterChanges(updated);
  };

  const handleMoveDepth = (playerId: string, dir: 'up' | 'down') => {
    const updated = movePlayerDepth(roster, playerId, dir);
    handleApplyRosterChanges(updated);
  };

  const handleChangePos = (playerId: string, newPos: FranchisePlayer['position']) => {
    const player = roster.find((p) => p.id === playerId);
    const updated = changePosition(roster, playerId, newPos);
    handleApplyRosterChanges(updated);
    setPositionModalPlayer(null);

    const isWayne = player?.name === 'Wayne Garrett';
    if (isWayne) {
      setToastMessage(`⚡ Wayne Garrett moved to ${newPos}! 99 OVR across all attributes, now #1 Starter.`);
    } else {
      setToastMessage(`Moved ${player?.name || 'Player'} to ${newPos}.`);
    }

    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Filtered Roster for List View
  const filteredRoster = roster.filter((p) => {
    if (selectedPos === 'ALL') return true;
    if (selectedPos === 'DEV') return p.age < 28;
    if (selectedPos === 'OFF') return ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C'].includes(p.position);
    if (selectedPos === 'DEF') return ['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(p.position);
    if (selectedPos === 'ST') return ['K'].includes(p.position);
    return p.position === selectedPos;
  });

  // Calculate dynamic team OVR
  const offPlayers = roster.filter((p) => ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C'].includes(p.position) && !p.isBenched);
  const defPlayers = roster.filter((p) => ['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(p.position) && !p.isBenched);

  const teamOffOvr = offPlayers.length > 0 ? Math.round(offPlayers.reduce((s, p) => s + p.ovr, 0) / offPlayers.length) : userTeam.off;
  const teamDefOvr = defPlayers.length > 0 ? Math.round(defPlayers.reduce((s, p) => s + p.ovr, 0) / defPlayers.length) : userTeam.def;
  const totalTeamOvr = Math.round((teamOffOvr + teamDefOvr) / 2);

  // Active Starters Summary
  const startersSummary = getStartersFromRoster(roster, userTeam);

  const posGroups = Array.from(new Set(roster.map((p) => p.position)));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-black text-2xl shadow-lg ring-2 ring-white/20"
            style={{
              backgroundColor: userTeam.primaryColor,
              color: userTeam.textColor || '#ffffff',
              border: `2px solid ${userTeam.secondaryColor || '#ffffff'}`,
            }}
          >
            {userTeam.abbr}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold uppercase">
                FRANCHISE DEPTH CHART & ROSTER
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {roster.length} TOTAL PLAYERS
              </span>
            </div>
            <h2 className="font-display font-black text-2xl text-white tracking-wide mt-1">
              {userTeam.city.toUpperCase()} {userTeam.name.toUpperCase()} DEPTH CHART
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              Re-order depth chart spots, start backups, bench players, or change player positions with full save persistence.
            </p>
          </div>
        </div>

        {/* Dynamic Ratings Triad */}
        <div className="flex items-center space-x-3">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-5 text-center min-w-[80px]">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">TOTAL OVR</span>
            <span className="font-display font-black text-2xl text-amber-400">{totalTeamOvr}</span>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-5 text-center min-w-[80px]">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">OFFENSE</span>
            <span className="font-display font-black text-2xl text-emerald-400">{teamOffOvr}</span>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-5 text-center min-w-[80px]">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">DEFENSE</span>
            <span className="font-display font-black text-2xl text-cyan-400">{teamDefOvr}</span>
          </div>
        </div>
      </div>

      {/* Active Starters Summary Bar */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center space-x-2">
          <UserCheck className="w-4 h-4 text-amber-400" />
          <span className="text-slate-400 uppercase">STARTER QB1:</span>
          <span className="text-amber-400 font-bold">{startersSummary.starQB}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 uppercase">STARTER RB1:</span>
          <span className="text-emerald-400 font-bold">{startersSummary.starRB}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 uppercase">STARTER WR1:</span>
          <span className="text-cyan-400 font-bold">{startersSummary.starWR}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 uppercase">DEFENSE STAR:</span>
          <span className="text-rose-400 font-bold">{startersSummary.starDef}</span>
        </div>
      </div>

      {/* Controls Bar: Mode Switcher & Position Filters */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Mode Switcher */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center space-x-1">
          <button
            onClick={() => setViewMode('depth')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold transition ${
              viewMode === 'depth'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>DEPTH CHART ORDER</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold transition ${
              viewMode === 'list'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
            <span>ROSTER CARDS LIST</span>
          </button>
        </div>

        {/* Position Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedPos('DEV')}
            className={`px-3 py-1 rounded-lg text-xs font-display font-bold transition flex items-center space-x-1 ${
              selectedPos === 'DEV'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-950'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>DEV SYSTEM (AGE &lt; 28)</span>
          </button>
          {['ALL', 'OFF', 'DEF', 'ST', 'QB', 'RB', 'WR', 'TE', 'OT', 'EDGE', 'DT', 'MLB', 'CB', 'FS', 'K'].map((pos) => (
            <button
              key={pos}
              onClick={() => setSelectedPos(pos)}
              className={`px-2.5 py-1 rounded-lg text-xs font-display font-bold transition ${
                selectedPos === pos
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* VIEW MODE 1: DEPTH CHART POSITION GROUPS */}
      {viewMode === 'depth' && (
        <div className="space-y-6">
          {posGroups
            .filter((pos) => {
              if (selectedPos === 'ALL') return true;
              if (selectedPos === 'OFF') return ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C'].includes(pos);
              if (selectedPos === 'DEF') return ['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(pos);
              if (selectedPos === 'ST') return ['K'].includes(pos);
              return pos === selectedPos;
            })
            .map((pos) => {
              const group = roster
                .filter((p) => p.position === pos)
                .sort((a, b) => (a.depthChartOrder ?? 1) - (b.depthChartOrder ?? 1));

              if (group.length === 0) return null;

              return (
                <div key={pos} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono font-bold text-xs uppercase">
                        {pos} POSITION GROUP ({group.length})
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      TOP NON-BENCHED PLAYER = #1 STARTER
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {group.map((player, idx) => {
                      const isStarter = idx === 0 && !player.isBenched;
                      const isBenched = player.isBenched;

                      return (
                        <div
                          key={player.id ? `${player.id}-${idx}` : `${player.position}-${player.name}-${idx}`}
                          className={`p-4 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            isBenched
                              ? 'bg-rose-950/20 border-rose-900/50 opacity-80'
                              : isStarter
                              ? 'bg-slate-950 border-amber-500/60 ring-1 ring-amber-500/30 shadow-lg'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Player Identity */}
                          <div className="flex items-center space-x-4">
                            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-mono font-bold text-sm text-amber-400">
                              #{idx + 1}
                            </div>

                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="font-display font-black text-lg text-white">
                                  {player.name}
                                </h4>
                                {isStarter && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-display font-black text-[10px] tracking-wider uppercase shadow">
                                    ★ STARTER
                                  </span>
                                )}
                                {isBenched && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40 font-mono font-bold text-[10px] uppercase">
                                    BENCHED
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                                <span className="font-mono text-white font-bold">OVR {player.ovr}</span>
                                <span>•</span>
                                <span>Age {player.age}</span>
                                <span>•</span>
                                <span>SPD {player.speed}</span>
                                <span>•</span>
                                <span>STR {player.strength}</span>
                                <span>•</span>
                                <span>{player.archetype}</span>
                                <span>•</span>
                                <span className="text-amber-400/90 font-mono">${player.salary}M/yr</span>
                              </div>

                              {/* Leveling & XP Progression HUD */}
                              {player.age < 28 ? (
                                <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 max-w-lg">
                                  <div className="flex items-center space-x-1.5 shrink-0">
                                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-black text-[10px] uppercase">
                                      LVL {player.level || 1}
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-300">
                                      {player.xp || 0}/100 XP
                                    </span>
                                    <span className="text-[10px] font-mono text-emerald-400">
                                      (Max: {player.maxOvr || getMaxOvrForPlayer(player)} OVR)
                                    </span>
                                  </div>
                                  <div className="w-24 sm:w-28 bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800 shrink-0">
                                    <div
                                      className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all"
                                      style={{ width: `${Math.min(100, player.xp || 0)}%` }}
                                    />
                                  </div>
                                  {player.recentGameXp && (
                                    <span className="text-[10px] text-slate-400 truncate max-w-xs font-mono" title={player.recentGameXp.statSummary}>
                                      +{player.recentGameXp.xpEarned} XP • {player.recentGameXp.statSummary}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-1 flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
                                  <span>Veteran (Age {player.age})</span>
                                  <span>•</span>
                                  <span>Max Development Reached</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="flex items-center flex-wrap gap-2">
                            {/* Change Position */}
                            <div className="flex items-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => setPositionModalPlayer(player)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 border ${
                                  player.name === 'Wayne Garrett'
                                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20'
                                    : 'bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 border-indigo-500/40'
                                }`}
                                title="Move Player Position"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span>MOVE POS</span>
                              </button>
                              <select
                                value={player.position}
                                onChange={(e) => handleChangePos(player.id, e.target.value as FranchisePlayer['position'])}
                                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 font-mono focus:outline-none focus:border-amber-500"
                                title="Select Position"
                              >
                                {ALL_POSITIONS.map((p) => (
                                  <option key={p} value={p}>
                                    {p}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Move Depth Rank */}
                            <button
                              type="button"
                              onClick={() => handleMoveDepth(player.id, 'up')}
                              disabled={idx === 0}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800"
                              title="Move Player Up Depth Chart"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveDepth(player.id, 'down')}
                              disabled={idx === group.length - 1}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-800"
                              title="Move Player Down Depth Chart"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>

                            {/* Promote to Starter */}
                            {!isStarter && (
                              <button
                                type="button"
                                onClick={() => handlePromote(player.id)}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-xs transition flex items-center space-x-1 shadow"
                              >
                                <Star className="w-3.5 h-3.5 fill-current" />
                                <span>START</span>
                              </button>
                            )}

                            {/* Bench / Unbench */}
                            <button
                              type="button"
                              onClick={() => handleToggleBench(player.id)}
                              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition border flex items-center space-x-1 ${
                                isBenched
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                              }`}
                            >
                              <Ban className="w-3.5 h-3.5" />
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
      )}

      {/* VIEW MODE 2: FULL ROSTER GRID CARDS */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoster.map((player) => (
            <div
              key={player.id}
              className={`bg-slate-900/70 border rounded-2xl p-5 space-y-3 transition shadow-lg relative overflow-hidden group ${
                player.isBenched ? 'border-rose-900/60 opacity-80' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {player.isRookie && (
                <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 text-[10px] font-black font-display px-3 py-0.5 rounded-bl-xl shadow-md">
                  ROOKIE PICK
                </div>
              )}

              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono font-bold text-xs">
                      {player.position}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {player.college || 'Pro Veteran'}
                    </span>
                  </div>
                  <h4 className="font-display font-black text-lg text-white mt-1 group-hover:text-amber-400 transition">
                    {player.name}
                  </h4>
                  <span className="text-xs text-slate-400 block">{player.archetype}</span>
                </div>

                <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center">
                  <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">OVR</span>
                  <span className="font-display font-black text-lg text-white">{player.ovr}</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center text-xs">
                <div className="bg-slate-950 rounded-xl p-1.5 border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 font-mono block">SPD</span>
                  <span className="font-bold text-slate-200 font-mono">{player.speed}</span>
                </div>
                <div className="bg-slate-950 rounded-xl p-1.5 border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 font-mono block">STR</span>
                  <span className="font-bold text-slate-200 font-mono">{player.strength}</span>
                </div>
                <div className="bg-slate-950 rounded-xl p-1.5 border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 font-mono block">AGI</span>
                  <span className="font-bold text-slate-200 font-mono">{player.agility}</span>
                </div>
                <div className="bg-slate-950 rounded-xl p-1.5 border border-slate-800/60">
                  <span className="text-[10px] text-slate-500 font-mono block">AWR</span>
                  <span className="font-bold text-slate-200 font-mono">{player.awareness}</span>
                </div>
              </div>

              {/* Position and Bench Quick Edit */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setPositionModalPlayer(player)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition flex items-center space-x-1 border ${
                      player.name === 'Wayne Garrett'
                        ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/50'
                        : 'bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 border-indigo-500/40'
                    }`}
                    title="Move Player Position"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>MOVE POS</span>
                  </button>
                  <select
                    value={player.position}
                    onChange={(e) => handleChangePos(player.id, e.target.value as FranchisePlayer['position'])}
                    className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-1.5 py-0.5 font-mono text-xs"
                    title="Select Position"
                  >
                    {ALL_POSITIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleBench(player.id)}
                  className={`px-2 py-1 rounded font-bold transition text-[11px] ${
                    player.isBenched ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {player.isBenched ? 'UNBENCH' : 'BENCH'}
                </button>
              </div>

              {/* Leveling & Progression */}
              {player.age < 28 ? (
                <div className="pt-2 border-t border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-amber-400 font-bold">LVL {player.level || 1} ({player.xp || 0}/100 XP)</span>
                    <span className="text-emerald-400">Max: {player.maxOvr || getMaxOvrForPlayer(player)} OVR</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, player.xp || 0)}%` }}
                    />
                  </div>
                  {player.recentGameXp && (
                    <div className="text-[9px] text-slate-400 truncate font-mono">
                      Recent: +{player.recentGameXp.xpEarned} XP • {player.recentGameXp.statSummary}
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-1 text-[10px] text-slate-500 font-mono text-center">
                  Veteran (Age {player.age}) • Max Dev
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                <span>Age: <strong className="text-slate-200">{player.age}</strong></span>
                <span>Potential: <strong className="text-emerald-400 font-mono">{player.potential}</strong></span>
                <span>Salary: <strong className="text-amber-400 font-mono">${player.salary}M/yr</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 border border-amber-500/60 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 animate-fade-in">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold leading-snug">{toastMessage}</span>
        </div>
      )}

      {/* Dedicated Move Position Modal */}
      {positionModalPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-white">
                    MOVE POSITION: {positionModalPlayer.name.toUpperCase()}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Current Position: <span className="font-mono text-amber-400 font-bold">{positionModalPlayer.position}</span> ({positionModalPlayer.ovr} OVR)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPositionModalPlayer(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Special Wayne Garrett Callout */}
            {positionModalPlayer.name === 'Wayne Garrett' && (
              <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 space-y-1.5 text-xs">
                <div className="flex items-center space-x-2 text-amber-300 font-display font-black">
                  <Sparkles className="w-4 h-4 text-amber-400 fill-current" />
                  <span>WAYNE GARRETT: 99 OVR AT EVERY POSITION</span>
                </div>
                <p className="text-amber-100/90 leading-relaxed">
                  Moving Wayne Garrett to any position will automatically keep his ratings at <strong>99 OVR</strong> with 99 in all attributes, update his archetype to suit the role, and promote him to <strong>#1 Starter</strong> immediately.
                </p>
              </div>
            )}

            {/* Position Picker Grid */}
            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Offense
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C'].map((pos) => {
                    const isCurrent = positionModalPlayer.position === pos;
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => handleChangePos(positionModalPlayer.id, pos as FranchisePlayer['position'])}
                        className={`py-2 px-3 rounded-xl font-display font-black text-xs transition border flex flex-col items-center justify-center ${
                          isCurrent
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800 hover:border-amber-500/50'
                        }`}
                      >
                        <span>{pos}</span>
                        {isCurrent && <span className="text-[9px] font-mono font-normal">CURRENT</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Defense
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].map((pos) => {
                    const isCurrent = positionModalPlayer.position === pos;
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => handleChangePos(positionModalPlayer.id, pos as FranchisePlayer['position'])}
                        className={`py-2 px-3 rounded-xl font-display font-black text-xs transition border flex flex-col items-center justify-center ${
                          isCurrent
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800 hover:border-amber-500/50'
                        }`}
                      >
                        <span>{pos}</span>
                        {isCurrent && <span className="text-[9px] font-mono font-normal">CURRENT</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Special Teams
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {['K'].map((pos) => {
                    const isCurrent = positionModalPlayer.position === pos;
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => handleChangePos(positionModalPlayer.id, pos as FranchisePlayer['position'])}
                        className={`py-2 px-3 rounded-xl font-display font-black text-xs transition border flex flex-col items-center justify-center ${
                          isCurrent
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800 hover:border-amber-500/50'
                        }`}
                      >
                        <span>{pos}</span>
                        {isCurrent && <span className="text-[9px] font-mono font-normal">CURRENT</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setPositionModalPlayer(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
