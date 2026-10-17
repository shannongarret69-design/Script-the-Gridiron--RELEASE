import React, { useState } from 'react';
import { TradeNewsItem } from '../types/franchise';
import { NFLTeam } from '../types/game';
import { getTeamById } from '../data/teams';
import {
  Newspaper,
  ArrowRightLeft,
  Flame,
  Shield,
  TrendingUp,
  Award,
  Sparkles,
  Info,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

interface TradeNewsViewProps {
  tradeNews: TradeNewsItem[];
  userTeam: NFLTeam;
  currentWeek: number;
  seasonYear: number;
}

export const TradeNewsView: React.FC<TradeNewsViewProps> = ({
  tradeNews,
  userTeam,
  currentWeek,
  seasonYear,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'USER' | 'CPU'>('ALL');

  const filteredNews = tradeNews.filter((item) => {
    if (filter === 'USER') return item.isUserInvolved;
    if (filter === 'CPU') return !item.isUserInvolved;
    return true;
  });

  const userTradesCount = tradeNews.filter((n) => n.isUserInvolved).length;
  const cpuTradesCount = tradeNews.filter((n) => !n.isUserInvolved).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold shadow-lg">
            <Newspaper className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold uppercase">
                NFL TRADE WIRE
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {tradeNews.length} COMPLETED TRANSACTIONS
              </span>
            </div>
            <h3 className="font-display font-black text-xl text-white tracking-wide mt-0.5">
              LEAGUE-WIDE TRADE NEWS & ANALYSIS
            </h3>
            <p className="text-xs text-slate-400">
              Live updates on mid-season trades between AI franchises and your front office from Week 4 to Week 9.
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-display font-bold transition cursor-pointer ${
              filter === 'ALL'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ALL ({tradeNews.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('USER')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-display font-bold transition cursor-pointer ${
              filter === 'USER'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            YOUR TRADES ({userTradesCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('CPU')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-display font-bold transition cursor-pointer ${
              filter === 'CPU'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            LEAGUE AI ({cpuTradesCount})
          </button>
        </div>
      </div>

      {/* Trade Feed */}
      {filteredNews.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
            <Newspaper className="w-7 h-7" />
          </div>
          <h4 className="font-display font-black text-base text-white">
            NO TRADE WIRE NEWS RECORDED YET
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            During Weeks 4 to 9, NFL teams actively search for trades to fill their lowest-rated positions and deal surplus talent. Advance regular season weeks or propose trades in the Trade Center to see transactions appear!
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredNews.map((item) => {
            const team1Obj = getTeamById(item.team1Id);
            const team2Obj = getTeamById(item.team2Id);

            return (
              <div
                key={item.id}
                className={`bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border rounded-3xl p-6 shadow-2xl space-y-4 relative overflow-hidden transition hover:border-slate-700 ${
                  item.isUserInvolved ? 'border-amber-500/40' : 'border-slate-800'
                }`}
              >
                {/* User Involment Glow Accent */}
                {item.isUserInvolved && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-400 to-amber-500" />
                )}

                {/* Top Row: Meta Badge & Date */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider ${
                        item.isUserInvolved
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {item.isUserInvolved ? '★ YOUR FRANCHISE DEAL' : 'LEAGUE AI TRANSACTION'}
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      WEEK {item.week}, {item.seasonYear}
                    </span>
                  </div>

                  {item.week === 9 && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-mono font-bold uppercase">
                      DEADLINE MOVE
                    </span>
                  )}
                </div>

                {/* Headline */}
                <h4 className="font-display font-black text-lg text-white leading-snug">
                  {item.headline}
                </h4>

                {/* Dual Team Exchange Display */}
                {(item.team1Players.length > 0 || item.team2Players.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
                    {/* Team 1 Side */}
                    <div className="md:col-span-5 space-y-2">
                      <div className="flex items-center space-x-2.5 border-b border-slate-800/80 pb-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-black text-xs text-white shadow"
                          style={{
                            backgroundColor: item.team1Color,
                            color: team1Obj?.textColor || '#ffffff',
                          }}
                        >
                          {team1Obj?.abbr || item.team1Id}
                        </div>
                        <div>
                          <span className="text-xs font-display font-bold text-white block">
                            {item.team1City} {item.team1Name}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase">
                            ACQUIRED:
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {item.team1Players.map((p) => (
                          <div
                            key={p.id}
                            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="w-7 h-7 rounded-md bg-emerald-500/20 text-emerald-300 font-display font-black text-xs flex items-center justify-center">
                                {p.ovr}
                              </span>
                              <span className="font-display font-bold text-xs text-white">
                                {p.name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-cyan-300">
                                {p.position}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              ${p.salary}M/yr
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Central Swap Icon */}
                    <div className="md:col-span-1 flex justify-center py-2 md:py-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400 shadow-inner">
                        <ArrowRightLeft className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Team 2 Side */}
                    <div className="md:col-span-5 space-y-2">
                      <div className="flex items-center space-x-2.5 border-b border-slate-800/80 pb-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-black text-xs text-white shadow"
                          style={{
                            backgroundColor: item.team2Color,
                            color: team2Obj?.textColor || '#ffffff',
                          }}
                        >
                          {team2Obj?.abbr || item.team2Id}
                        </div>
                        <div>
                          <span className="text-xs font-display font-bold text-white block">
                            {item.team2City} {item.team2Name}
                          </span>
                          <span className="text-[10px] text-amber-400 font-mono font-bold uppercase">
                            ACQUIRED:
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {item.team2Players.map((p) => (
                          <div
                            key={p.id}
                            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="w-7 h-7 rounded-md bg-amber-500/20 text-amber-300 font-display font-black text-xs flex items-center justify-center">
                                {p.ovr}
                              </span>
                              <span className="font-display font-bold text-xs text-white">
                                {p.name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-cyan-300">
                                {p.position}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              ${p.salary}M/yr
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tactical & Roster-Need Analysis */}
                <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-3.5 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                    <Info className="w-3.5 h-3.5 text-cyan-400" />
                    <span>FRONT OFFICE & PERFORMANCE RATING ANALYSIS</span>
                  </div>
                  <p className="leading-relaxed text-slate-200">
                    {item.analysis}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
