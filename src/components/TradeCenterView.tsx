import React, { useState, useEffect } from 'react';
import { FranchiseSeasonState, FranchisePlayer, IncomingTradeOffer } from '../types/franchise';
import { NFLTeam } from '../types/game';
import { NFL_TEAMS } from '../data/teams';
import { generateInitialTeamRoster } from '../utils/aiRosterGenerator';
import { initializeDepthChartOrder } from '../utils/rosterUtils';
import {
  evaluateTradeProposal,
  calculatePlayerTradeValue,
  TradeEvaluationResult,
  isTradeWindowOpen,
  isTradeDeadlinePassed,
  approveIncomingTradeOffer,
  rejectIncomingTradeOffer,
  createTradeNewsForUserTrade,
  generateIncomingTradeOffersForUser,
} from '../utils/tradeEngine';
import { IncomingTradeOffersView } from './IncomingTradeOffersView';
import { TradeNewsView } from './TradeNewsView';
import {
  ArrowLeftRight,
  Shield,
  CheckCircle2,
  XCircle,
  Sparkles,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Search,
  Users,
  ChevronDown,
  Award,
  RefreshCw,
  Newspaper,
  Bell,
  Lock,
  Clock,
  Flame,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TradeCenterViewProps {
  season: FranchiseSeasonState;
  userTeam: NFLTeam;
  onUpdateSeason: (updatedSeason: FranchiseSeasonState) => void;
}

export const TradeCenterView: React.FC<TradeCenterViewProps> = ({
  season,
  userTeam,
  onUpdateSeason,
}) => {
  // Navigation Tabs: Propose Trade, Incoming Offers, Trade News
  const [activeTab, setActiveTab] = useState<'propose' | 'incoming' | 'news'>('propose');

  // Available opposing teams (31 other teams)
  const opposingTeams = NFL_TEAMS.filter((t) => t.id !== userTeam.id);
  const [selectedTargetTeamId, setSelectedTargetTeamId] = useState<string>(
    opposingTeams[0]?.id || 'KC'
  );

  const targetTeam = NFL_TEAMS.find((t) => t.id === selectedTargetTeamId) || opposingTeams[0];

  // Selected players for trade
  const [offeredPlayerIds, setOfferedPlayerIds] = useState<string[]>([]);
  const [requestedPlayerIds, setRequestedPlayerIds] = useState<string[]>([]);

  // Position and search filters
  const [userPosFilter, setUserPosFilter] = useState<string>('ALL');
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [targetPosFilter, setTargetPosFilter] = useState<string>('ALL');
  const [targetSearchTerm, setTargetSearchTerm] = useState<string>('');

  // Status message notification
  const [lastTradeNote, setLastTradeNote] = useState<string | null>(null);

  const deadlinePassed = isTradeDeadlinePassed(season.currentWeek, season.stage);
  const tradeWindowActive = isTradeWindowOpen(season.currentWeek, season.stage);

  // Initialize CPU Rosters if needed
  let cpuRosters = season.cpuRosters || {};
  let targetTeamRoster = cpuRosters[targetTeam.id];
  if (!targetTeamRoster || targetTeamRoster.length === 0) {
    targetTeamRoster = generateInitialTeamRoster(targetTeam);
  }

  // User Roster
  const userRoster = season.userRoster || [];

  // Check and populate incoming trade offers if trade window is active
  useEffect(() => {
    if (tradeWindowActive) {
      const existing = season.incomingTradeOffers || [];
      const updatedOffers = generateIncomingTradeOffersForUser(season);
      if (updatedOffers.length > existing.length) {
        onUpdateSeason({
          ...season,
          incomingTradeOffers: updatedOffers,
        });
      }
    }
  }, [season.currentWeek, season.stage, tradeWindowActive, season.userRoster]);

  // Filtered lists
  const filteredUserRoster = userRoster.filter((p) => {
    const matchesPos =
      userPosFilter === 'ALL' ||
      (userPosFilter === 'OFF' && ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C'].includes(p.position)) ||
      (userPosFilter === 'DEF' && ['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(p.position)) ||
      p.position === userPosFilter;

    const matchesSearch = p.name.toLowerCase().includes(userSearchTerm.toLowerCase());
    return matchesPos && matchesSearch;
  });

  const filteredTargetRoster = targetTeamRoster.filter((p) => {
    const matchesPos =
      targetPosFilter === 'ALL' ||
      (targetPosFilter === 'OFF' && ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C'].includes(p.position)) ||
      (targetPosFilter === 'DEF' && ['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(p.position)) ||
      p.position === targetPosFilter;

    const matchesSearch = p.name.toLowerCase().includes(targetSearchTerm.toLowerCase());
    return matchesPos && matchesSearch;
  });

  // Selected player objects
  const selectedOfferedPlayers = userRoster.filter((p) => offeredPlayerIds.includes(p.id));
  const selectedRequestedPlayers = targetTeamRoster.filter((p) => requestedPlayerIds.includes(p.id));

  // Trade Evaluation Result
  const evalResult: TradeEvaluationResult = evaluateTradeProposal(
    selectedOfferedPlayers,
    selectedRequestedPlayers,
    targetTeam,
    targetTeamRoster
  );

  // Cap Check
  const availableCap = season.salaryCap - season.usedCap;
  const newProjectedUsedCap = season.usedCap + evalResult.userSalaryCapChange;
  const isCapExceeded = newProjectedUsedCap > season.salaryCap;

  // Count pending GM offers
  const pendingIncomingCount = (season.incomingTradeOffers || []).filter((o) => o.status === 'pending').length;
  const totalNewsCount = (season.tradeNews || []).length;

  // Toggle Selection
  const toggleOfferPlayer = (playerId: string) => {
    setOfferedPlayerIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  };

  const toggleRequestPlayer = (playerId: string) => {
    setRequestedPlayerIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  };

  // Clear selections
  const handleResetTrade = () => {
    setOfferedPlayerIds([]);
    setRequestedPlayerIds([]);
    setLastTradeNote(null);
  };

  // Execute User-Initiated Trade
  const handleExecuteTrade = () => {
    if (deadlinePassed) {
      setLastTradeNote('TRADE FAILED: The mid-season trade deadline has passed (Week 9). Front offices are locked.');
      return;
    }
    if (!evalResult.canAccept || isCapExceeded) return;

    // Remove offered from user, add requested to user
    const newUserRoster = initializeDepthChartOrder(
      userRoster
        .filter((p) => !offeredPlayerIds.includes(p.id))
        .concat(selectedRequestedPlayers)
    );

    // Remove requested from target CPU, add offered to target CPU
    const newTargetRoster = initializeDepthChartOrder(
      targetTeamRoster
        .filter((p) => !requestedPlayerIds.includes(p.id))
        .concat(selectedOfferedPlayers)
    );

    const updatedCpuRosters = {
      ...cpuRosters,
      [targetTeam.id]: newTargetRoster,
    };

    // Recalculate used cap
    const updatedUsedCap = newUserRoster.reduce((sum, p) => sum + p.salary, 0);

    const offeredNames = selectedOfferedPlayers.map((p) => `${p.name} (${p.ovr} OVR ${p.position})`).join(', ');
    const requestedNames = selectedRequestedPlayers.map((p) => `${p.name} (${p.ovr} OVR ${p.position})`).join(', ');

    const txNote = `Traded ${offeredNames} to ${targetTeam.city} ${targetTeam.name} for ${requestedNames} (Interest Level: ${evalResult.interestScore}/100).`;

    const updatedTransactions = [
      ...season.transactions,
      {
        date: `Week ${season.currentWeek}, ${season.seasonYear}`,
        text: txNote,
        type: 'trade' as const,
      },
    ];

    // Create a Trade News Item
    const newsItem = createTradeNewsForUserTrade(
      season,
      userTeam,
      targetTeam,
      selectedOfferedPlayers,
      selectedRequestedPlayers
    );

    confetti({
      particleCount: 130,
      spread: 90,
      origin: { y: 0.6 },
      colors: [userTeam.primaryColor, targetTeam.primaryColor, '#f59e0b', '#10b981'],
    });

    const updatedSeason: FranchiseSeasonState = {
      ...season,
      userRoster: newUserRoster,
      cpuRosters: updatedCpuRosters,
      usedCap: Math.round(updatedUsedCap * 10) / 10,
      transactions: updatedTransactions,
      tradeNews: [newsItem, ...(season.tradeNews || [])],
    };

    onUpdateSeason(updatedSeason);
    setLastTradeNote(`TRADE COMPLETED! You acquired ${requestedNames} from the ${targetTeam.name}. Story published to Trade Wire.`);
    setOfferedPlayerIds([]);
    setRequestedPlayerIds([]);
  };

  // Approve Incoming Trade Offer
  const handleApproveIncomingOffer = (offerId: string) => {
    const result = approveIncomingTradeOffer(season, offerId);
    if (!result.success) {
      setLastTradeNote(`APPROVAL ERROR: ${result.error}`);
      return;
    }

    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: [userTeam.primaryColor, '#f59e0b', '#10b981'],
    });

    onUpdateSeason(result.updatedSeason);
    setLastTradeNote('TRADE OFFICIALLY APPROVED & EXECUTED! Roster updated and transaction published to Trade Wire.');
  };

  // Decline Incoming Trade Offer
  const handleDeclineIncomingOffer = (offerId: string) => {
    const updated = rejectIncomingTradeOffer(season, offerId);
    onUpdateSeason(updated);
    setLastTradeNote('Incoming trade proposal declined.');
  };

  // Counter Incoming Trade Offer
  const handleCounterOffer = (offer: IncomingTradeOffer) => {
    setSelectedTargetTeamId(offer.offeringTeamId);
    setRequestedPlayerIds(offer.offeredPlayers.map((p) => p.id));
    setOfferedPlayerIds(offer.requestedPlayers.map((p) => p.id));
    setActiveTab('propose');
    setLastTradeNote(
      `Loaded proposal from ${offer.offeringTeamCity} ${offer.offeringTeamName} into the Trade Center. Adjust players to propose a counter-offer.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg ring-2 ring-amber-500/30">
            <ArrowLeftRight className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold uppercase">
                FRANCHISE TRADE CENTER
              </span>
              <span className="text-xs text-emerald-400 font-mono font-bold">
                MID-SEASON DEADLINE: WEEKS 4–9
              </span>
            </div>
            <h2 className="font-display font-black text-2xl text-white tracking-wide mt-1">
              TRADE DEADLINE & GM OPERATIONS
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              Propose trades with all 31 NFL franchises, review incoming trade inquiries from opposing GMs, and monitor league-wide breaking trade news through the Week 9 deadline.
            </p>
          </div>
        </div>

        {/* User Cap & Roster Quick Stats */}
        <div className="flex items-center space-x-3">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-5 text-center min-w-[100px]">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">
              CAP SPACE
            </span>
            <span
              className={`font-display font-black text-2xl ${
                availableCap < 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              ${availableCap.toFixed(1)}M
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-5 text-center min-w-[100px]">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">
              ROSTER SIZE
            </span>
            <span className="font-display font-black text-2xl text-amber-400">
              {userRoster.length}
            </span>
          </div>
        </div>
      </div>

      {/* DEADLINE STATUS BANNER */}
      {deadlinePassed ? (
        <div className="bg-slate-900/90 border border-rose-500/40 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 font-bold shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display font-black text-sm text-rose-300 uppercase">
                MID-SEASON TRADE DEADLINE HAS PASSED
              </h4>
              <p className="text-slate-400">
                The NFL trade deadline expired after Week 9. League rosters are locked through the end of the playoffs.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono font-bold text-xs uppercase whitespace-nowrap">
            MARKET CLOSED
          </span>
        </div>
      ) : season.currentWeek === 9 ? (
        <div className="bg-gradient-to-r from-rose-950/80 via-amber-950/60 to-rose-950/80 border border-rose-500/60 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/30 border border-rose-500 flex items-center justify-center text-rose-300 font-black shrink-0">
              <Clock className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h4 className="font-display font-black text-sm text-white uppercase tracking-wide">
                🚨 TRADE DEADLINE WEEK (FINAL CHANCE FOR DEALS)
              </h4>
              <p className="text-rose-200/80">
                This is Week 9! The trade window closes when you advance to Week 10. Finalize any acquisitions now.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-rose-500 text-slate-950 font-display font-black text-xs uppercase whitespace-nowrap">
            FINAL WEEK
          </span>
        </div>
      ) : tradeWindowActive ? (
        <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-amber-950/70 border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shrink-0">
              <Flame className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h4 className="font-display font-black text-sm text-white uppercase">
                MID-SEASON TRADE WINDOW OPEN (WEEK {season.currentWeek} OF 9)
              </h4>
              <p className="text-slate-300">
                Active trading is permitted. {10 - season.currentWeek} week(s) remaining until the Week 9 deadline.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs uppercase whitespace-nowrap">
            DEADLINE: WEEK 9
          </span>
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display font-black text-sm text-slate-300 uppercase">
                TRADE MARKET PREVIEW (OPENS WEEK 4)
              </h4>
              <p className="text-slate-400">
                The mid-season trade window opens at Week 4 and runs through the Week 9 trade deadline.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 font-mono font-bold text-xs uppercase whitespace-nowrap">
            OPENS WEEK 4
          </span>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('propose')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-2xl font-display font-bold text-xs sm:text-sm whitespace-nowrap transition cursor-pointer ${
            activeTab === 'propose'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-102'
              : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>PROPOSE TRADE</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('incoming')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-2xl font-display font-bold text-xs sm:text-sm whitespace-nowrap transition cursor-pointer relative ${
            activeTab === 'incoming'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-102'
              : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>INCOMING GM OFFERS</span>
          {pendingIncomingCount > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono font-black text-[11px] shadow">
              {pendingIncomingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('news')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-2xl font-display font-bold text-xs sm:text-sm whitespace-nowrap transition cursor-pointer ${
            activeTab === 'news'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/20 scale-102'
              : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Newspaper className="w-4 h-4" />
          <span>TRADE NEWS & WIRE</span>
          {totalNewsCount > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-mono text-[11px]">
              {totalNewsCount}
            </span>
          )}
        </button>
      </div>

      {/* NOTIFICATION BANNER */}
      {lastTradeNote && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-2xl p-4 flex items-center justify-between gap-4 text-emerald-200 text-xs font-bold animate-fade-in shadow-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{lastTradeNote}</span>
          </div>
          <button
            onClick={() => setLastTradeNote(null)}
            className="p-1 rounded-lg hover:bg-emerald-900/50 text-emerald-400"
          >
            &times;
          </button>
        </div>
      )}

      {/* TAB 1: PROPOSE TRADE (TRADE MACHINE) */}
      {activeTab === 'propose' && (
        <div className="space-y-6">
          {/* Target Team Selection Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase whitespace-nowrap">
                SELECT TRADE PARTNER:
              </span>
              <select
                value={selectedTargetTeamId}
                onChange={(e) => {
                  setSelectedTargetTeamId(e.target.value);
                  setRequestedPlayerIds([]);
                }}
                className="w-full sm:w-72 bg-slate-950 border border-slate-700 text-white text-sm font-display font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 shadow-md"
              >
                {opposingTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.city} {t.name} ({t.conference} {t.division} • {t.ovr} OVR)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-black text-sm text-white shadow-md"
                style={{
                  backgroundColor: targetTeam.primaryColor,
                  color: targetTeam.textColor || '#ffffff',
                }}
              >
                {targetTeam.abbr}
              </div>
              <div>
                <h4 className="font-display font-black text-sm text-white">
                  {targetTeam.city.toUpperCase()} {targetTeam.name.toUpperCase()}
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  OFF: {targetTeam.off} | DEF: {targetTeam.def} | OVR: {targetTeam.ovr}
                </span>
              </div>
            </div>
          </div>

          {/* DUAL ROSTER PANELS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT PANEL: YOUR TEAM OFFERINGS */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 space-y-4 flex flex-col shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-base text-white shadow"
                    style={{ backgroundColor: userTeam.primaryColor }}
                  >
                    {userTeam.abbr}
                  </div>
                  <div>
                    <h3 className="font-display font-black text-base text-white">
                      YOUR PLAYERS TO OFFER ({selectedOfferedPlayers.length})
                    </h3>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Offered Value: <strong className="text-amber-400">{evalResult.userTotalValue} pts</strong>
                    </span>
                  </div>
                </div>

                {offeredPlayerIds.length > 0 && (
                  <button
                    onClick={() => setOfferedPlayerIds([])}
                    className="text-xs text-rose-400 hover:underline font-mono font-bold"
                  >
                    Clear Offered
                  </button>
                )}
              </div>

              {/* Search & Filters */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search user roster..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <select
                  value={userPosFilter}
                  onChange={(e) => setUserPosFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Pos</option>
                  <option value="OFF">Offense</option>
                  <option value="DEF">Defense</option>
                  <option value="QB">QB</option>
                  <option value="RB">RB</option>
                  <option value="WR">WR</option>
                  <option value="TE">TE</option>
                  <option value="OT">OT/OL</option>
                  <option value="EDGE">EDGE</option>
                  <option value="CB">CB</option>
                  <option value="FS">S</option>
                </select>
              </div>

              {/* Player List */}
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {filteredUserRoster.map((player) => {
                  const isSelected = offeredPlayerIds.includes(player.id);
                  const val = calculatePlayerTradeValue(player);

                  return (
                    <div
                      key={player.id}
                      onClick={() => toggleOfferPlayer(player.id)}
                      className={`p-3 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-amber-950/40 border-amber-500/60 shadow-lg ring-1 ring-amber-500/40'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-sm shadow ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-900 border border-slate-700 text-slate-200'
                          }`}
                        >
                          {player.ovr}
                        </div>

                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-display font-bold text-sm text-white">
                              {player.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-amber-400 font-bold">
                              {player.position}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Age {player.age} • ${player.salary}M/yr • {player.archetype}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-amber-400 block">
                          {val} pts
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {isSelected ? '✓ SELECTED' : '+ ADD'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT PANEL: TARGET TEAM PLAYERS */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 space-y-4 flex flex-col shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-base text-white shadow"
                    style={{
                      backgroundColor: targetTeam.primaryColor,
                      color: targetTeam.textColor || '#ffffff',
                    }}
                  >
                    {targetTeam.abbr}
                  </div>
                  <div>
                    <h3 className="font-display font-black text-base text-white">
                      TARGET PLAYERS TO ACQUIRE ({selectedRequestedPlayers.length})
                    </h3>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Target Value: <strong className="text-cyan-400">{evalResult.cpuTotalValue} pts</strong>
                    </span>
                  </div>
                </div>

                {requestedPlayerIds.length > 0 && (
                  <button
                    onClick={() => setRequestedPlayerIds([])}
                    className="text-xs text-rose-400 hover:underline font-mono font-bold"
                  >
                    Clear Target
                  </button>
                )}
              </div>

              {/* Search & Filters */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder={`Search ${targetTeam.name} roster...`}
                    value={targetSearchTerm}
                    onChange={(e) => setTargetSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <select
                  value={targetPosFilter}
                  onChange={(e) => setTargetPosFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Pos</option>
                  <option value="OFF">Offense</option>
                  <option value="DEF">Defense</option>
                  <option value="QB">QB</option>
                  <option value="RB">RB</option>
                  <option value="WR">WR</option>
                  <option value="TE">TE</option>
                  <option value="OT">OT/OL</option>
                  <option value="EDGE">EDGE</option>
                  <option value="CB">CB</option>
                  <option value="FS">S</option>
                </select>
              </div>

              {/* Player List */}
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {filteredTargetRoster.map((player) => {
                  const isSelected = requestedPlayerIds.includes(player.id);
                  const val = calculatePlayerTradeValue(player);

                  return (
                    <div
                      key={player.id}
                      onClick={() => toggleRequestPlayer(player.id)}
                      className={`p-3 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg ring-1 ring-cyan-500/40'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-sm shadow ${
                            isSelected
                              ? 'bg-cyan-500 text-slate-950'
                              : 'bg-slate-900 border border-slate-700 text-slate-200'
                          }`}
                        >
                          {player.ovr}
                        </div>

                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-display font-bold text-sm text-white">
                              {player.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-cyan-400 font-bold">
                              {player.position}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Age {player.age} • ${player.salary}M/yr • {player.archetype}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-cyan-400 block">
                          {val} pts
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {isSelected ? '✓ SELECTED' : '+ ADD'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* TRADE EVALUATION BAR & METRICS */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Left: Interest Meter */}
              <div className="w-full md:flex-1 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-display font-bold text-slate-300 uppercase">
                      OPPOSING GM INTEREST LEVEL:
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 font-mono text-slate-400 text-[11px]">
                      Threshold: 82+
                    </span>
                  </div>
                  <span
                    className={`font-display font-black text-lg ${
                      evalResult.interestScore >= 82
                        ? 'text-emerald-400'
                        : evalResult.interestScore >= 60
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {evalResult.interestScore}/100
                  </span>
                </div>

                <div className="relative w-full h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      evalResult.interestScore >= 82
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        : evalResult.interestScore >= 60
                        ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                        : 'bg-gradient-to-r from-rose-500 to-rose-400'
                    }`}
                    style={{ width: `${evalResult.interestScore}%` }}
                  />
                  {/* 82 threshold indicator line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
                    style={{ left: '82%' }}
                    title="Required 82 Interest Threshold"
                  />
                </div>
              </div>

              {/* Right: Salary Cap & Value Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto text-center font-mono text-xs">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">
                    OFFER VALUE
                  </span>
                  <span className="font-display font-bold text-base text-amber-400">
                    {evalResult.userTotalValue} pts
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">
                    TARGET VALUE
                  </span>
                  <span className="font-display font-bold text-base text-cyan-400">
                    {evalResult.cpuTotalValue} pts
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">
                    NET CAP IMPACT
                  </span>
                  <span
                    className={`font-display font-bold text-base ${
                      evalResult.userSalaryCapChange > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {evalResult.userSalaryCapChange > 0 ? '+' : ''}
                    ${evalResult.userSalaryCapChange.toFixed(1)}M/yr
                  </span>
                </div>
              </div>
            </div>

            {/* CPU GM Dialogue Box */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-start space-x-3 text-xs">
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0 font-display font-black">
                GM
              </div>
              <div className="space-y-1">
                <h5 className="font-display font-bold text-slate-300 uppercase tracking-wide">
                  {targetTeam.city} {targetTeam.name} Front Office Reaction:
                </h5>
                <p className="text-slate-200 font-medium italic leading-relaxed">
                  "{evalResult.gmDialogue}"
                </p>
              </div>
            </div>

            {/* Warnings */}
            {deadlinePassed && (
              <div className="bg-rose-950/80 border border-rose-500/50 rounded-2xl p-3 flex items-center space-x-2 text-rose-300 text-xs font-bold">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  TRADE DEADLINE HAS PASSED: No trades can be executed this regular season after Week 9.
                </span>
              </div>
            )}

            {isCapExceeded && (
              <div className="bg-rose-950/80 border border-rose-500/50 rounded-2xl p-3 flex items-center space-x-2 text-rose-300 text-xs font-bold">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  SALARY CAP EXCEEDED: Executing this trade would put your team ${Math.abs(season.salaryCap - newProjectedUsedCap).toFixed(1)}M over the ${season.salaryCap}M cap limit.
                </span>
              </div>
            )}

            {/* Trade Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={handleResetTrade}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white font-bold text-xs transition flex items-center space-x-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>RESET SELECTIONS</span>
              </button>

              <button
                type="button"
                id="btn-execute-trade"
                disabled={!evalResult.canAccept || isCapExceeded || deadlinePassed}
                onClick={handleExecuteTrade}
                className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-display font-black text-sm uppercase tracking-wider transition shadow-2xl flex items-center justify-center space-x-2 ${
                  evalResult.canAccept && !isCapExceeded && !deadlinePassed
                    ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-400 hover:from-emerald-400 hover:to-amber-300 text-slate-950 ring-2 ring-emerald-400/50 shadow-emerald-500/30 scale-102 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {deadlinePassed
                    ? 'TRADE DEADLINE PASSED (WEEK 9 CLOSED)'
                    : evalResult.canAccept
                    ? 'EXECUTE TRADE (INTEREST 82+ REACHED)'
                    : `NEEDS 82+ INTEREST TO EXECUTE (CURRENT: ${evalResult.interestScore})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INCOMING GM OFFERS */}
      {activeTab === 'incoming' && (
        <IncomingTradeOffersView
          season={season}
          userTeam={userTeam}
          onApproveOffer={handleApproveIncomingOffer}
          onDeclineOffer={handleDeclineIncomingOffer}
          onCounterOffer={handleCounterOffer}
        />
      )}

      {/* TAB 3: TRADE NEWS & WIRE */}
      {activeTab === 'news' && (
        <TradeNewsView
          tradeNews={season.tradeNews || []}
          userTeam={userTeam}
          currentWeek={season.currentWeek}
          seasonYear={season.seasonYear}
        />
      )}
    </div>
  );
};
