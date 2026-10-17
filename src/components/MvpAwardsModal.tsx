import React, { useState } from 'react';
import { FranchiseSeasonState, MvpCandidate, SeasonAwards } from '../types/franchise';
import { getLeagueMvpCandidates, getSeasonAwards } from '../utils/awardsEngine';
import { getTeamById } from '../data/teams';
import {
  Trophy,
  Award,
  Crown,
  TrendingUp,
  Sparkles,
  Shield,
  Zap,
  Flame,
  Star,
  CheckCircle2,
  X,
  History,
  Medal,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface MvpAwardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  season: FranchiseSeasonState | null;
  isCeremony?: boolean;
}

export const MvpAwardsModal: React.FC<MvpAwardsModalProps> = ({
  isOpen,
  onClose,
  season,
  isCeremony = false,
}) => {
  const [activeTab, setActiveTab] = useState<'mvpRace' | 'honors' | 'history'>('mvpRace');

  if (!isOpen || !season) return null;

  const candidates: MvpCandidate[] = getLeagueMvpCandidates(season);
  const awards: SeasonAwards = season.seasonAwards || getSeasonAwards(season);
  const frontrunner = candidates[0];
  const isPostSeason = season.currentWeek >= 19;

  const handleConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#10b981', '#3b82f6'],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl space-y-6 my-auto max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 font-black">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                  NFL HONORS • YEAR {season.seasonYear || 2026}
                </span>
                {isPostSeason ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                    OFFICIAL WINNER CROWNED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                    LIVE REGULAR SEASON RACE
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-black text-white">
                MOST VALUABLE <span className="text-amber-400">PLAYER (MVP)</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleConfetti}
              className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition cursor-pointer"
              title="Celebrate"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('mvpRace')}
              className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'mvpRace'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white bg-slate-900'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>MVP LEADERBOARD</span>
            </button>
            <button
              onClick={() => setActiveTab('honors')}
              className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'honors'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white bg-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>NFL HONORS AWARDS</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white bg-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>MVP VAULT ({season.mvpHistory?.length || 0})</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            Updated Week {Math.min(18, season.currentWeek)} of 18
          </span>
        </div>

        {/* --- TAB 1: MVP RACE LEADERBOARD --- */}
        {activeTab === 'mvpRace' && frontrunner && (
          <div className="space-y-5">
            {/* Frontrunner Spotlight Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border-2 border-amber-500/60 p-5 sm:p-6 shadow-xl">
              <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
                <Trophy className="w-56 h-56 text-amber-400" />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center space-x-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-black text-2xl shadow-xl border-2"
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

            {/* Top 10 Candidates Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 text-[11px] uppercase border-b border-slate-800 tracking-wider">
                      <th className="py-3 px-3 text-center">RANK</th>
                      <th className="py-3 px-3">PLAYER & TEAM</th>
                      <th className="py-3 px-2 text-center">POS</th>
                      <th className="py-3 px-2 text-center">OVR</th>
                      <th className="py-3 px-3">SEASON PRODUCTION</th>
                      <th className="py-3 px-3 text-center">RECORD</th>
                      <th className="py-3 px-3 text-center">ODDS</th>
                      <th className="py-3 px-3 text-right">MVP SCORE</th>
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
                        <td className="py-3 px-3 text-center font-display font-black text-sm">
                          {cand.rank === 1 ? (
                            <span className="text-amber-400 flex items-center justify-center space-x-0.5">
                              <Crown className="w-4 h-4" />
                              <span>1</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">#{cand.rank}</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
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
                        <td className="py-3 px-2 text-center font-bold text-slate-300">{cand.player.position}</td>
                        <td className="py-3 px-2 text-center font-display font-black text-amber-400">
                          {cand.player.ovr}
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-sans text-xs">
                          {cand.statsSummary}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-300 font-bold">{cand.teamRecord}</td>
                        <td className="py-3 px-3 text-center font-bold text-amber-400">{cand.odds}</td>
                        <td className="py-3 px-3 text-right font-display font-black text-sm text-white">
                          {cand.mvpScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: NFL HONORS AWARDS --- */}
        {activeTab === 'honors' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center space-y-1">
              <h3 className="font-display font-black text-xl text-white">
                OFFICIAL NFL HONORS TROPHY RECIPIENTS
              </h3>
              <p className="text-xs text-slate-400">
                Awarded at the conclusion of the 18-week regular season to the most elite performers in football.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* MVP Card */}
              <div className="bg-gradient-to-b from-amber-950/40 to-slate-900 border-2 border-amber-500 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-display font-black text-[10px] tracking-wider">
                    MOST VALUABLE PLAYER
                  </span>
                </div>
                <div>
                  <h4 className="font-display font-black text-xl text-white">{awards.mvp.player.name}</h4>
                  <p className="text-xs text-amber-400 font-mono">
                    {awards.mvp.player.position} • {awards.mvp.teamCity} {awards.mvp.teamName}
                  </p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
                  {awards.mvp.statsSummary}
                </div>
                <p className="text-xs text-slate-400 italic">"{awards.mvp.analysis}"</p>
              </div>

              {/* OPOY Card */}
              <div className="bg-gradient-to-b from-blue-950/40 to-slate-900 border border-blue-500/60 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white font-black">
                    <Zap className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500 text-white font-display font-black text-[10px] tracking-wider">
                    OFFENSIVE PLAYER OF THE YEAR
                  </span>
                </div>
                <div>
                  <h4 className="font-display font-black text-xl text-white">{awards.opoy.player.name}</h4>
                  <p className="text-xs text-blue-400 font-mono">
                    {awards.opoy.player.position} • {awards.opoy.teamCity} {awards.opoy.teamName}
                  </p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
                  {awards.opoy.statsSummary}
                </div>
                <p className="text-xs text-slate-400 italic">
                  Leading the NFL in explosive yardage and scoring plays.
                </p>
              </div>

              {/* DPOY Card */}
              <div className="bg-gradient-to-b from-emerald-950/40 to-slate-900 border border-emerald-500/60 rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-black">
                    <Shield className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-display font-black text-[10px] tracking-wider">
                    DEFENSIVE PLAYER OF THE YEAR
                  </span>
                </div>
                <div>
                  <h4 className="font-display font-black text-xl text-white">{awards.dpoy.player.name}</h4>
                  <p className="text-xs text-emerald-400 font-mono">
                    {awards.dpoy.player.position} • {awards.dpoy.teamCity} {awards.dpoy.teamName}
                  </p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
                  {awards.dpoy.statsSummary}
                </div>
                <p className="text-xs text-slate-400 italic">
                  Leading the defensive front with relentless pocket disruption and tackle stops.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 3: MVP HISTORICAL VAULT --- */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center space-y-1">
              <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
              <h3 className="font-display font-black text-xl text-white">
                HISTORICAL NFL MVP VAULT
              </h3>
              <p className="text-xs text-slate-400">
                Every crowned Most Valuable Player across your franchise dynasty history.
              </p>
            </div>

            {(!season.mvpHistory || season.mvpHistory.length === 0) ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center space-y-2 text-slate-500">
                <Crown className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">No MVP winners recorded yet in this save slot.</p>
                <p className="text-[11px] text-slate-600">
                  Finish Week 18 to crown your first official NFL Most Valuable Player!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {season.mvpHistory.map((entry, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      entry.isUser
                        ? 'bg-amber-950/30 border-amber-500 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-lg text-white shadow border"
                        style={{ backgroundColor: entry.primaryColor }}
                      >
                        {entry.position}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-amber-400 text-xs uppercase">
                            YEAR {entry.seasonYear} NFL MVP
                          </span>
                          {entry.isUser && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-display font-black text-[10px]">
                              YOUR PLAYER
                            </span>
                          )}
                        </div>
                        <h4 className="font-display font-black text-lg text-white">
                          {entry.playerName} ({entry.ovr} OVR)
                        </h4>
                        <p className="text-xs text-slate-400">
                          {entry.teamCity} {entry.teamName} • {entry.statsSummary}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-right">
                      <span className="text-[10px] font-mono text-slate-400 block">MVP POINTS</span>
                      <span className="font-display font-black text-base text-amber-400">
                        {entry.mvpScore}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-500">
          <span>MVP points calculate passing, rushing, receiving, sacks, turnovers & team wins.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
