import React, { useState } from 'react';
import { WeeklyLeagueNews } from '../types/franchise';
import { Newspaper, AlertTriangle, Star, Trophy, X, ChevronRight, Flame, ShieldAlert, Award, ArrowUpRight } from 'lucide-react';

interface LeagueNewsModalProps {
  news: WeeklyLeagueNews | null;
  onClose: () => void;
  allSeasonNews?: WeeklyLeagueNews[];
  onSelectWeek?: (newsItem: WeeklyLeagueNews) => void;
}

export const LeagueNewsModal: React.FC<LeagueNewsModalProps> = ({
  news,
  onClose,
  allSeasonNews = [],
  onSelectWeek,
}) => {
  const [activeTab, setActiveTab] = useState<'highlights' | 'upsets' | 'performers' | 'scores'>('highlights');

  if (!news) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Top Header Banner */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Newspaper className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-display font-black text-[10px] tracking-wider uppercase">
                  LEAGUE REPORT • WEEK {news.week}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {news.seasonYear} NFL SEASON
                </span>
              </div>
              <h2 className="font-display font-black text-xl text-white mt-0.5">
                {news.headline}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            {allSeasonNews.length > 1 && onSelectWeek && (
              <select
                value={news.week}
                onChange={(e) => {
                  const target = allSeasonNews.find((n) => n.week === Number(e.target.value));
                  if (target) onSelectWeek(target);
                }}
                className="bg-slate-900 border border-slate-700 text-xs text-amber-400 rounded-lg px-2.5 py-1.5 font-mono font-bold focus:outline-none"
              >
                {allSeasonNews.map((n) => (
                  <option key={n.id} value={n.week}>
                    Week {n.week} News
                  </option>
                ))}
              </select>
            )}

            <button
              id="btn-close-league-news"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Close League News"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-Nav Filter Tabs */}
        <div className="flex items-center space-x-2 px-5 py-2.5 bg-slate-900/60 border-b border-slate-800/80 overflow-x-auto text-xs font-display font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('highlights')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'highlights'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Week Summary & Thriller</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upsets')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'upsets'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Upset Alerts ({news.upsets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('performers')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'performers'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Top Performers (4)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scores')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'scores'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Weekly Scoreboard</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: HIGHLIGHTS & SUMMARY */}
          {activeTab === 'highlights' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
                  <Newspaper className="w-4 h-4" />
                  <span>Around the League Recap</span>
                </div>
                <p className="text-slate-200 text-sm leading-relaxed">
                  {news.summary}
                </p>
              </div>

              {/* Game of the Week Thriller */}
              {news.thrillerGame && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border border-amber-500/40 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold text-xs uppercase border border-amber-500/30 flex items-center space-x-1.5">
                      <Flame className="w-3.5 h-3.5" />
                      <span>GAME OF THE WEEK</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      Final Score
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-center sm:text-left">
                      <div className="text-base font-display font-black text-white">
                        {news.thrillerGame.homeTeam}
                      </div>
                      <div className="text-2xl font-mono font-black text-amber-400">
                        {news.thrillerGame.homeScore}
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold text-slate-500 px-3">
                      FINAL
                    </span>

                    <div className="text-center sm:text-right">
                      <div className="text-base font-display font-black text-white">
                        {news.thrillerGame.awayTeam}
                      </div>
                      <div className="text-2xl font-mono font-black text-amber-400">
                        {news.thrillerGame.awayScore}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 italic leading-snug">
                    "{news.thrillerGame.recap}"
                  </p>
                </div>
              )}

              {/* Quick Peek at Upsets and Top Performers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Upset Highlight */}
                <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-display font-bold text-rose-400 flex items-center space-x-1.5 uppercase">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Biggest Upset</span>
                    </span>
                    <button
                      onClick={() => setActiveTab('upsets')}
                      className="text-[11px] text-amber-400 hover:underline font-mono"
                    >
                      View All →
                    </button>
                  </div>
                  {news.upsets.length > 0 ? (
                    <div className="p-3 rounded-xl bg-slate-950 border border-rose-950/60 space-y-1">
                      <div className="text-sm font-display font-black text-white">
                        {news.upsets[0].winnerName} {news.upsets[0].winnerScore} - {news.upsets[0].loserScore} {news.upsets[0].loserName}
                      </div>
                      <div className="text-xs text-slate-400">
                        {news.upsets[0].upsetHeadline}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic py-2">
                      No major upsets recorded this week.
                    </p>
                  )}
                </div>

                {/* Performer Highlight */}
                <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-display font-bold text-cyan-400 flex items-center space-x-1.5 uppercase">
                      <Star className="w-3.5 h-3.5" />
                      <span>Standout Star</span>
                    </span>
                    <button
                      onClick={() => setActiveTab('performers')}
                      className="text-[11px] text-amber-400 hover:underline font-mono"
                    >
                      View All →
                    </button>
                  </div>
                  {news.topPerformers.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-cyan-950/60 space-y-1">
                      <div className="text-sm font-display font-black text-white flex items-center justify-between">
                        <span>{news.topPerformers[0].playerName}</span>
                        <span className="text-[10px] font-mono text-cyan-400 font-bold">
                          {news.topPerformers[0].category.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-amber-300 font-mono font-bold">
                        {news.topPerformers[0].statLine}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: UPSET ALERTS */}
          {activeTab === 'upsets' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                  Underdogs Winning Against Odds
                </span>
                <span className="text-xs font-mono text-rose-400 font-bold">
                  {news.upsets.length} Upsets Recorded
                </span>
              </div>

              {news.upsets.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
                  <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-display font-bold text-slate-300">
                    No Upsets in Week {news.week}
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    All favored teams held home-field and talent advantage to secure victories this week.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {news.upsets.map((u, uIdx) => (
                    <div
                      key={uIdx}
                      className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/20 via-slate-900 to-slate-950 border border-rose-900/60 space-y-2.5 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-mono font-bold uppercase">
                          {u.winProb}% Win Odds
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-bold">
                          UPSET WIN
                        </span>
                      </div>

                      <div>
                        <div className="text-base font-display font-black text-white">
                          {u.winnerName} <span className="text-emerald-400">{u.winnerScore}</span>
                        </div>
                        <div className="text-xs font-display text-slate-400">
                          def. {u.loserName} ({u.loserScore})
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-snug border-t border-slate-800/80 pt-2">
                        {u.upsetHeadline}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TOP PERFORMERS */}
          {activeTab === 'performers' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                  Players of the Week Across the League
                </span>
                <span className="text-xs font-mono text-amber-400 font-bold">
                  Weekly Honors
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {news.topPerformers.map((perf, pIdx) => {
                  const categoryBadgeColor =
                    perf.category === 'Passing'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                      : perf.category === 'Rushing'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : perf.category === 'Receiving'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

                  return (
                    <div
                      key={pIdx}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 shadow-md hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${categoryBadgeColor}`}>
                          {perf.category.toUpperCase()} LEADER
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {perf.position}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-display font-black text-lg text-white">
                          {perf.playerName}
                        </h4>
                        <div className="text-xs font-mono text-amber-400 font-bold mt-0.5">
                          {perf.statLine}
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 leading-snug border-t border-slate-800 pt-2">
                        {perf.headline}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: ALL SCORES */}
          {activeTab === 'scores' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                  Complete Matchup Results
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Week {news.week} Scoreboard
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {(news.allScores || []).map((sc, sIdx) => {
                  const homeWon = sc.homeScore > sc.awayScore;
                  return (
                    <div
                      key={sIdx}
                      className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between ${
                        sc.isUpset
                          ? 'bg-rose-950/20 border-rose-900/60'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className={`flex items-center space-x-2 ${homeWon ? 'font-bold text-white' : 'text-slate-400'}`}>
                          <span>{sc.homeId}</span>
                          <span className={homeWon ? 'text-amber-400' : 'text-slate-400'}>{sc.homeScore}</span>
                        </div>
                        <div className={`flex items-center space-x-2 ${!homeWon ? 'font-bold text-white' : 'text-slate-400'}`}>
                          <span>{sc.awayId}</span>
                          <span className={!homeWon ? 'text-amber-400' : 'text-slate-400'}>{sc.awayScore}</span>
                        </div>
                      </div>

                      {sc.isUpset && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          UPSET
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
            Archived in League News tab for full franchise history.
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-sm uppercase tracking-wider transition shadow-lg"
          >
            Continue Season →
          </button>
        </div>
      </div>
    </div>
  );
};
