import React, { useState } from 'react';
import { FranchiseSeasonState, FranchisePlayer } from '../types/franchise';
import { getTeamById } from '../data/teams';
import { getLeagueMvpCandidates, getSeasonAwards } from '../utils/awardsEngine';
import {
  Trophy,
  BarChart3,
  Search,
  ChevronDown,
  ChevronUp,
  Award,
  Shield,
  Zap,
  Flame,
  Calendar,
  Layers,
  History,
  TrendingUp,
  User,
  Star,
  CheckCircle2,
  Crown,
  Sparkles,
} from 'lucide-react';

interface PlayerStatsHistoryViewProps {
  season: FranchiseSeasonState | null;
}

export const PlayerStatsHistoryView: React.FC<PlayerStatsHistoryViewProps> = ({ season }) => {
  const [activeTab, setActiveTab] = useState<'seasonStats' | 'careerStats' | 'mvpAwards' | 'championsHistory'>('seasonStats');
  const [posFilter, setPosFilter] = useState<'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'DEF' | 'K'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayerForLogs, setSelectedPlayerForLogs] = useState<FranchisePlayer | null>(null);
  const [sortField, setSortField] = useState<string>('ovr');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  if (!season) return null;

  const userTeam = getTeamById(season.userTeamId);
  const userRoster = season.userRoster || [];

  // Filter roster by position & search
  const filteredPlayers = userRoster.filter((player) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = player.name.toLowerCase().includes(q);
      const matchPos = player.position.toLowerCase().includes(q);
      const matchCollege = player.college?.toLowerCase().includes(q) || false;
      if (!matchName && !matchPos && !matchCollege) return false;
    }
    if (posFilter === 'ALL') return true;
    if (posFilter === 'DEF') {
      return ['DT', 'DE', 'EDGE', 'MLB', 'OLB', 'CB', 'FS', 'SS'].includes(player.position);
    }
    return player.position === posFilter;
  });

  // Sort players
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    const statsA = a.seasonStats;
    const statsB = b.seasonStats;

    let valA = 0;
    let valB = 0;

    switch (sortField) {
      case 'ovr':
        valA = a.ovr;
        valB = b.ovr;
        break;
      case 'passYards':
        valA = statsA?.passYards || 0;
        valB = statsB?.passYards || 0;
        break;
      case 'passTds':
        valA = statsA?.passTds || 0;
        valB = statsB?.passTds || 0;
        break;
      case 'rushYards':
        valA = statsA?.rushYards || 0;
        valB = statsB?.rushYards || 0;
        break;
      case 'rushTds':
        valA = statsA?.rushTds || 0;
        valB = statsB?.rushTds || 0;
        break;
      case 'recYards':
        valA = statsA?.recYards || 0;
        valB = statsB?.recYards || 0;
        break;
      case 'recTds':
        valA = statsA?.recTds || 0;
        valB = statsB?.recTds || 0;
        break;
      case 'tackles':
        valA = statsA?.tackles || 0;
        valB = statsB?.tackles || 0;
        break;
      case 'sacks':
        valA = statsA?.sacks || 0;
        valB = statsB?.sacks || 0;
        break;
      default:
        valA = a.ovr;
        valB = b.ovr;
    }

    return sortAsc ? valA - valB : valB - valA;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const superBowlHistory = season.superBowlWinnerHistory || [];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-xl shadow-lg border"
            style={{
              backgroundColor: userTeam.primaryColor,
              color: userTeam.textColor || '#ffffff',
              borderColor: userTeam.secondaryColor || '#ffffff',
            }}
          >
            {userTeam.abbr}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                FRANCHISE RECORD LEDGER • YEAR {season.seasonYear || 2026}
              </span>
              {season.wonSuperBowlLastSeason && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                  🏆 DEFENDING SUPER BOWL CHAMPIONS
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-black text-white">
              {userTeam.city.toUpperCase()} {userTeam.name.toUpperCase()} STATS & HISTORY
            </h2>
            <p className="text-xs text-slate-400">
              Track real-time game logs, season leaderboards, and historical Lombardi Trophy achievements.
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('seasonStats')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'seasonStats'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>SEASON STATS</span>
          </button>
          <button
            onClick={() => setActiveTab('careerStats')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'careerStats'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>CAREER TOTALS</span>
          </button>
          <button
            onClick={() => setActiveTab('mvpAwards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'mvpAwards'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>MVP RACE & AWARDS</span>
          </button>
          <button
            onClick={() => setActiveTab('championsHistory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'championsHistory'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>SUPER BOWL VAULT</span>
          </button>
        </div>
      </div>

      {/* --- TAB 1: SEASON STATS & GAME LOGS --- */}
      {activeTab === 'seasonStats' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Position filter buttons */}
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              {(['ALL', 'QB', 'RB', 'WR', 'TE', 'DEF', 'K'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPosFilter(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition cursor-pointer ${
                    posFilter === p
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search player or college..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Player Stats Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 font-bold text-slate-300">PLAYER</th>
                    <th className="py-3 px-2 text-center">POS</th>
                    <th
                      className="py-3 px-2 text-center cursor-pointer hover:text-amber-400"
                      onClick={() => handleSort('ovr')}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>OVR</span>
                        {sortField === 'ovr' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th className="py-3 px-2 text-center">GP</th>
                    <th
                      className="py-3 px-2 text-right cursor-pointer hover:text-amber-400"
                      onClick={() => handleSort('passYards')}
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>PASS YDS</span>
                        {sortField === 'passYards' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="py-3 px-2 text-center cursor-pointer hover:text-amber-400"
                      onClick={() => handleSort('passTds')}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>PASS TD</span>
                        {sortField === 'passTds' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="py-3 px-2 text-right cursor-pointer hover:text-amber-400"
                      onClick={() => handleSort('rushYards')}
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>RUSH YDS</span>
                        {sortField === 'rushYards' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="py-3 px-2 text-center cursor-pointer hover:text-amber-400"
                      onClick={() => handleSort('rushTds')}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>RUSH TD</span>
                        {sortField === 'rushTds' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="py-3 px-2 text-right cursor-pointer hover:text-amber-400"
                      onClick={() => handleSort('recYards')}
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>REC YDS</span>
                        {sortField === 'recYards' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="py-3 px-2 text-center cursor-pointer hover:text-amber-400"
                      onClick={() => handleSort('recTds')}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>REC TD</span>
                        {sortField === 'recTds' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="py-3 px-2 text-center cursor-pointer hover:text-amber-400"
                      onClick={() => handleSort('tackles')}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>TKL</span>
                        {sortField === 'tackles' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="py-3 px-2 text-center cursor-pointer hover:text-amber-400"
                      onClick={() => handleSort('sacks')}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>SCK</span>
                        {sortField === 'sacks' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {sortedPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-8 text-slate-500 italic">
                        No players matched current filter or search criteria.
                      </td>
                    </tr>
                  ) : (
                    sortedPlayers.map((p) => {
                      const st = p.seasonStats || {
                        gamesPlayed: 0,
                        passYards: 0,
                        passTds: 0,
                        rushYards: 0,
                        rushTds: 0,
                        recYards: 0,
                        recTds: 0,
                        tackles: 0,
                        sacks: 0,
                      };

                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-4">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                {p.position}
                              </div>
                              <div>
                                <span className="font-display font-bold text-white block text-sm">
                                  {p.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {p.archetype || 'Pro Athlete'} • {p.college || 'NFL'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-slate-300">{p.position}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="font-display font-black text-amber-400 text-sm">
                              {p.ovr}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center text-slate-400">{st.gamesPlayed || 0}</td>
                          <td className="py-2.5 px-2 text-right font-bold text-white">{st.passYards || 0}</td>
                          <td className="py-2.5 px-2 text-center text-amber-400">{st.passTds || 0}</td>
                          <td className="py-2.5 px-2 text-right font-bold text-white">{st.rushYards || 0}</td>
                          <td className="py-2.5 px-2 text-center text-amber-400">{st.rushTds || 0}</td>
                          <td className="py-2.5 px-2 text-right font-bold text-white">{st.recYards || 0}</td>
                          <td className="py-2.5 px-2 text-center text-amber-400">{st.recTds || 0}</td>
                          <td className="py-2.5 px-2 text-center text-emerald-400">{st.tackles || 0}</td>
                          <td className="py-2.5 px-2 text-center text-emerald-400">{st.sacks || 0}</td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => setSelectedPlayerForLogs(p)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-display font-bold text-[11px] border border-slate-700 transition cursor-pointer"
                            >
                              Game Logs ({(p.gameLogs || []).length})
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: CAREER TOTALS --- */}
      {activeTab === 'careerStats' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
            <h3 className="font-display font-black text-xl text-white">
              CAREER STATISTICAL MILESTONES
            </h3>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Career totals automatically accumulate as you complete multiple franchise seasons, tracking all-time yardage and touchdown milestones.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userRoster.map((p) => {
              const currentSt = p.seasonStats || {
                gamesPlayed: 0,
                passYards: 0,
                passTds: 0,
                rushYards: 0,
                rushTds: 0,
                recYards: 0,
                recTds: 0,
                tackles: 0,
                sacks: 0,
              };

              const pastSeasons = p.careerStats || [];
              const pastGames = pastSeasons.reduce((sum, s) => sum + (s.stats?.gamesPlayed || 0), 0);
              const pastPassYards = pastSeasons.reduce((sum, s) => sum + (s.stats?.passYards || 0), 0);
              const pastPassTds = pastSeasons.reduce((sum, s) => sum + (s.stats?.passTds || 0), 0);
              const pastRushYards = pastSeasons.reduce((sum, s) => sum + (s.stats?.rushYards || 0), 0);
              const pastRushTds = pastSeasons.reduce((sum, s) => sum + (s.stats?.rushTds || 0), 0);
              const pastRecYards = pastSeasons.reduce((sum, s) => sum + (s.stats?.recYards || 0), 0);
              const pastRecTds = pastSeasons.reduce((sum, s) => sum + (s.stats?.recTds || 0), 0);
              const pastTackles = pastSeasons.reduce((sum, s) => sum + (s.stats?.tackles || 0), 0);
              const pastSacks = pastSeasons.reduce((sum, s) => sum + (s.stats?.sacks || 0), 0);

              const car = {
                seasonsPlayed: pastSeasons.length + 1,
                gamesPlayed: pastGames + (currentSt.gamesPlayed || 0),
                passYards: pastPassYards + (currentSt.passYards || 0),
                passTds: pastPassTds + (currentSt.passTds || 0),
                rushYards: pastRushYards + (currentSt.rushYards || 0),
                rushTds: pastRushTds + (currentSt.rushTds || 0),
                recYards: pastRecYards + (currentSt.recYards || 0),
                recTds: pastRecTds + (currentSt.recTds || 0),
                tackles: pastTackles + (currentSt.tackles || 0),
                sacks: pastSacks + (currentSt.sacks || 0),
              };

              return (
                <div
                  key={p.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center font-display font-bold text-xs text-amber-400">
                        {p.position}
                      </div>
                      <div>
                        <h4 className="font-display font-bold text-white text-sm">{p.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {p.college || 'Pro'} • {p.age || 24} yrs old
                        </span>
                      </div>
                    </div>
                    <span className="font-display font-black text-lg text-amber-400">{p.ovr} OVR</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-center font-mono">
                    {p.position === 'QB' ? (
                      <>
                        <div>
                          <span className="text-[10px] text-slate-500 block">PASS YDS</span>
                          <span className="font-bold text-white text-xs">{car.passYards}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">PASS TD</span>
                          <span className="font-bold text-amber-400 text-xs">{car.passTds}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">GAMES</span>
                          <span className="font-bold text-slate-300 text-xs">{car.gamesPlayed}</span>
                        </div>
                      </>
                    ) : p.position === 'RB' ? (
                      <>
                        <div>
                          <span className="text-[10px] text-slate-500 block">RUSH YDS</span>
                          <span className="font-bold text-white text-xs">{car.rushYards}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">RUSH TD</span>
                          <span className="font-bold text-amber-400 text-xs">{car.rushTds}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">GAMES</span>
                          <span className="font-bold text-slate-300 text-xs">{car.gamesPlayed}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-[10px] text-slate-500 block">REC/TKL</span>
                          <span className="font-bold text-white text-xs">
                            {['WR', 'TE'].includes(p.position) ? car.recYards : car.tackles}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">TD/SCK</span>
                          <span className="font-bold text-amber-400 text-xs">
                            {['WR', 'TE'].includes(p.position) ? car.recTds : car.sacks}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">GAMES</span>
                          <span className="font-bold text-slate-300 text-xs">{car.gamesPlayed}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- TAB 3: MVP RACE & HONORS --- */}
      {activeTab === 'mvpAwards' && (() => {
        const candidates = getLeagueMvpCandidates(season);
        const awards = season.seasonAwards || getSeasonAwards(season);
        const frontrunner = candidates[0];

        return (
          <div className="space-y-5">
            {/* Frontrunner Spotlight */}
            {frontrunner && (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border-2 border-amber-500/60 p-5 sm:p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                  <div className="flex items-center space-x-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-black text-xl shadow-xl border-2"
                      style={{
                        backgroundColor: frontrunner.primaryColor,
                        color: '#ffffff',
                        borderColor: '#f59e0b',
                      }}
                    >
                      {frontrunner.player.position}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-display font-black text-[10px] tracking-wider uppercase flex items-center space-x-1 shadow">
                          <Crown className="w-3 h-3 fill-current" />
                          <span>#1 MVP FRONTRUNNER ({frontrunner.odds})</span>
                        </span>
                        {frontrunner.isUserPlayer && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                            YOUR FRANCHISE
                          </span>
                        )}
                      </div>

                      <h3 className="font-display font-black text-2xl text-white mt-1">
                        {frontrunner.player.name}
                      </h3>
                      <p className="text-xs text-amber-300/90 font-mono">
                        {frontrunner.teamCity} {frontrunner.teamName} • {frontrunner.teamRecord} • {frontrunner.player.ovr} OVR
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-amber-500/40 rounded-2xl p-3 sm:text-right">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">MVP PRODUCTION INDEX</span>
                    <span className="font-display font-black text-2xl text-amber-400">
                      {frontrunner.mvpScore}{' '}
                      <span className="text-xs font-mono font-normal text-slate-400">PTS</span>
                    </span>
                    <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                      {frontrunner.statsSummary}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-300 flex items-center space-x-2">
                  <Star className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="italic">{frontrunner.analysis}</span>
                </div>
              </div>
            )}

            {/* Top 10 MVP Race Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <h4 className="font-display font-black text-sm text-white uppercase tracking-wider">
                    NFL MOST VALUABLE PLAYER (MVP) TOP CANDIDATES
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  Calculated from pass, rush, rec, defense & team wins
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800 tracking-wider">
                      <th className="py-2.5 px-3 text-center">RANK</th>
                      <th className="py-2.5 px-3">PLAYER & TEAM</th>
                      <th className="py-2.5 px-2 text-center">POS</th>
                      <th className="py-2.5 px-2 text-center">OVR</th>
                      <th className="py-2.5 px-3">STAT LINE SUMMARY</th>
                      <th className="py-2.5 px-3 text-center">RECORD</th>
                      <th className="py-2.5 px-3 text-center">ODDS</th>
                      <th className="py-2.5 px-3 text-right">MVP SCORE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {candidates.map((cand) => (
                      <tr
                        key={`${cand.teamId}-${cand.player.id}`}
                        className={`hover:bg-slate-800/50 transition ${
                          cand.rank === 1
                            ? 'bg-amber-500/10'
                            : cand.isUserPlayer
                            ? 'bg-emerald-950/20'
                            : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-display font-black text-sm">
                          {cand.rank === 1 ? (
                            <span className="text-amber-400 flex items-center justify-center space-x-0.5">
                              <Crown className="w-4 h-4" />
                              <span>1</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">#{cand.rank}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{ backgroundColor: cand.primaryColor }}
                            >
                              {cand.teamId}
                            </div>
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <span className="font-display font-bold text-white text-sm">
                                  {cand.player.name}
                                </span>
                                {cand.isUserPlayer && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 text-[9px] font-bold">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {cand.teamCity} {cand.teamName}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-300">{cand.player.position}</td>
                        <td className="py-2.5 px-2 text-center font-display font-black text-amber-400">
                          {cand.player.ovr}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-sans text-xs">
                          {cand.statsSummary}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-300 font-bold">{cand.teamRecord}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-amber-400">{cand.odds}</td>
                        <td className="py-2.5 px-3 text-right font-display font-black text-sm text-white">
                          {cand.mvpScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Honors Cards (MVP, OPOY, DPOY) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-b from-amber-950/40 to-slate-900 border-2 border-amber-500 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-display font-black text-amber-400 uppercase tracking-wider">
                    🏆 NFL MVP FRONTRUNNER
                  </span>
                  <span className="text-xs font-mono font-bold text-white">{awards.mvp.odds}</span>
                </div>
                <h4 className="font-display font-black text-lg text-white">{awards.mvp.player.name}</h4>
                <p className="text-xs text-slate-400 font-mono">
                  {awards.mvp.teamCity} • {awards.mvp.statsSummary}
                </p>
              </div>

              <div className="bg-gradient-to-b from-blue-950/40 to-slate-900 border border-blue-500/60 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-display font-black text-blue-400 uppercase tracking-wider">
                    ⚡ OFFENSIVE PLAYER OF THE YEAR
                  </span>
                  <span className="text-xs font-mono font-bold text-white">{awards.opoy.odds}</span>
                </div>
                <h4 className="font-display font-black text-lg text-white">{awards.opoy.player.name}</h4>
                <p className="text-xs text-slate-400 font-mono">
                  {awards.opoy.teamCity} • {awards.opoy.statsSummary}
                </p>
              </div>

              <div className="bg-gradient-to-b from-emerald-950/40 to-slate-900 border border-emerald-500/60 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-display font-black text-emerald-400 uppercase tracking-wider">
                    🛡️ DEFENSIVE PLAYER OF THE YEAR
                  </span>
                  <span className="text-xs font-mono font-bold text-white">{awards.dpoy.odds}</span>
                </div>
                <h4 className="font-display font-black text-lg text-white">{awards.dpoy.player.name}</h4>
                <p className="text-xs text-slate-400 font-mono">
                  {awards.dpoy.teamCity} • {awards.dpoy.statsSummary}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- TAB 4: SUPER BOWL VAULT --- */}
      {activeTab === 'championsHistory' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto" />
            <h3 className="font-display font-black text-xl text-white">
              SUPER BOWL CHAMPIONSHIP VAULT
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Every Super Bowl trophy, scoreline, and MVP recorded in franchise history.
            </p>
          </div>

          {superBowlHistory.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-2 text-slate-500">
              <Shield className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs">No Super Bowls have concluded yet in this franchise slot.</p>
              <p className="text-[11px] text-slate-600">
                Advance through Week 22 to claim the Vince Lombardi Trophy and record history!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {superBowlHistory.map((entry, idx) => {
                const isUserWinner = entry.winnerId === season.userTeamId;
                const winTeam = getTeamById(entry.winnerId);

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isUserWinner
                        ? 'bg-amber-950/30 border-amber-500 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-base shadow border"
                        style={{
                          backgroundColor: winTeam.primaryColor,
                          color: winTeam.textColor || '#ffffff',
                          borderColor: winTeam.secondaryColor || '#ffffff',
                        }}
                      >
                        {winTeam.abbr}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-amber-400 text-xs uppercase">
                            SUPER BOWL • YEAR {entry.seasonYear}
                          </span>
                          {isUserWinner && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-display font-black text-[10px]">
                              YOUR FRANCHISE
                            </span>
                          )}
                        </div>
                        <h4 className="font-display font-black text-lg text-white">
                          {entry.winnerName} Champions
                        </h4>
                        <p className="text-xs text-slate-400">
                          Defeated {entry.loserName} ({entry.score})
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right bg-slate-950/70 px-4 py-2 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">SUPER BOWL MVP</span>
                      <span className="font-display font-black text-sm text-amber-300">
                        {entry.mvp || 'Franchise QB'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- PLAYER GAME LOG MODAL --- */}
      {selectedPlayerForLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
                  {selectedPlayerForLogs.position}
                </div>
                <div>
                  <h3 className="font-display font-black text-xl text-white">
                    {selectedPlayerForLogs.name} <span className="text-amber-500">GAME LOGS</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Week-by-week game performance in Year {season.seasonYear || 2026}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlayerForLogs(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>

            {(!selectedPlayerForLogs.gameLogs || selectedPlayerForLogs.gameLogs.length === 0) ? (
              <div className="p-8 text-center text-slate-500 italic">
                No game logs recorded yet for this season. Simulate or play games to record player stats.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                        <th className="py-2 px-3">WEEK</th>
                        <th className="py-2 px-3">OPPONENT</th>
                        <th className="py-2 px-3 text-center">RESULT</th>
                        <th className="py-2 px-3 text-right">STAT BREAKDOWN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {selectedPlayerForLogs.gameLogs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/50">
                          <td className="py-2.5 px-3 text-white font-bold">Wk {log.week}</td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {log.isHome ? 'vs ' : '@ '}
                            <span className="font-bold text-white">{log.opponentAbbr}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {log.isWin ? 'W' : 'L'} {log.teamScore}-{log.oppScore}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300">
                            {log.stats.passYards ? `${log.stats.passYards} pass yds, ${log.stats.passTds || 0} TD | ` : ''}
                            {log.stats.rushYards ? `${log.stats.rushYards} rush yds, ${log.stats.rushTds || 0} TD | ` : ''}
                            {log.stats.recYards ? `${log.stats.recYards} rec yds, ${log.stats.recTds || 0} TD | ` : ''}
                            {log.stats.tackles ? `${log.stats.tackles} tkl, ${log.stats.sacks || 0} sck` : ''}
                            {!log.stats.passYards && !log.stats.rushYards && !log.stats.recYards && !log.stats.tackles && 'DNP / Inactive'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
