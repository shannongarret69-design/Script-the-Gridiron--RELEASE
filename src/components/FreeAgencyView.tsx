import React, { useState, useMemo, useEffect } from 'react';
import { FranchiseSeasonState, FreeAgent, FranchisePlayer, FreeAgentOffer } from '../types/franchise';
import { NFLTeam } from '../types/game';
import { 
  DollarSign, 
  UserPlus, 
  Search, 
  CheckCircle2, 
  Shield, 
  X, 
  Sliders, 
  Award, 
  Flame, 
  AlertTriangle, 
  Briefcase,
  Crown,
  Calendar,
  Clock,
  TrendingUp,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  calculateOfferSatisfaction,
  populateCpuOffersForTop20,
  resolveWeeklyFreeAgentBids,
  submitUserOffer,
  withdrawUserOffer,
  ResolvedSigningsSummary
} from '../utils/freeAgencyEngine';

interface FreeAgencyViewProps {
  season: FranchiseSeasonState;
  userTeam: NFLTeam;
  onUpdateSeason: (updated: FranchiseSeasonState) => void;
}

export const FreeAgencyView: React.FC<FreeAgencyViewProps> = ({
  season,
  userTeam,
  onUpdateSeason,
}) => {
  const [selectedPos, setSelectedPos] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'market' | 'roster'>('market');

  // Ensure top 20 free agents have active offers from eligible teams on mount
  useEffect(() => {
    const pool = season.freeAgentsPool || [];
    const top20 = [...pool].sort((a, b) => b.ovr - a.ovr).slice(0, 20);
    const hasUnpopulatedTop20 = top20.some((p) => !p.activeOffers || p.activeOffers.length === 0);
    if (hasUnpopulatedTop20) {
      const refreshedPool = populateCpuOffersForTop20(season, false);
      onUpdateSeason({
        ...season,
        freeAgentsPool: refreshedPool,
      });
    }
  }, []);

  const [selectedFAId, setSelectedFAId] = useState<string>(
    season.freeAgentsPool[0]?.id || ''
  );

  const selectedFA = useMemo(() => {
    return (
      (season.freeAgentsPool || []).find((f) => f.id === selectedFAId) ||
      season.freeAgentsPool[0] ||
      null
    );
  }, [season.freeAgentsPool, selectedFAId]);

  // Negotiation Modal States
  const [isNegotiating, setIsNegotiating] = useState<boolean>(false);
  const [negotiatingPlayerId, setNegotiatingPlayerId] = useState<string | null>(null);
  const [offerSalary, setOfferSalary] = useState<number>(10);
  const [offerBonus, setOfferBonus] = useState<number>(3);
  const [offerYears, setOfferYears] = useState<number>(3);
  const [offerRole, setOfferRole] = useState<'Cornerstone Starter' | 'Key Contributor' | 'Rotational Depth' | 'Veteran Mentor'>('Cornerstone Starter');
  const [includeIncentives, setIncludeIncentives] = useState<boolean>(true);
  
  // Negotiation Feedback & Status
  const [negotiationStatus, setNegotiationStatus] = useState<'negotiating' | 'accepted' | 'countered' | 'rejected'>('negotiating');
  const [agentFeedbackMessage, setAgentFeedbackMessage] = useState<string>('');

  // Weekly Resolution Modal
  const [showResolutionModal, setShowResolutionModal] = useState<boolean>(false);
  const [weekResolutionResults, setWeekResolutionResults] = useState<ResolvedSigningsSummary[]>([]);

  const salaryCap = season.salaryCap || 240.0;
  const usedCap = season.userRoster.reduce((sum, p) => sum + p.salary, 0);
  const availableCap = Math.max(0, Math.round((salaryCap - usedCap) * 10) / 10);

  const negotiatingPlayer = useMemo(() => {
    if (!negotiatingPlayerId) return null;
    return (season.freeAgentsPool || []).find((f) => f.id === negotiatingPlayerId) || null;
  }, [season.freeAgentsPool, negotiatingPlayerId]);

  const availableFA = useMemo(() => {
    return (season.freeAgentsPool || []).filter((fa) => {
      const matchPos = selectedPos === 'ALL' || fa.position === selectedPos;
      const matchSearch = fa.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fa.archetype.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (fa.college && fa.college.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchPos && matchSearch;
    });
  }, [season.freeAgentsPool, selectedPos, searchQuery]);

  // Open Negotiation modal for player
  const handleOpenNegotiation = (player: FreeAgent) => {
    setSelectedFAId(player.id);
    setNegotiatingPlayerId(player.id);

    // If user already has an active offer on this player, preload it
    const existingUserOffer = (player.activeOffers || []).find(
      (o) => o.isUser || o.teamId === userTeam.id
    );

    if (existingUserOffer) {
      setOfferSalary(existingUserOffer.salary);
      setOfferBonus(existingUserOffer.bonus);
      setOfferYears(existingUserOffer.years);
    } else {
      setOfferSalary(player.askingSalary);
      setOfferBonus(Math.max(1, Math.round(player.askingSalary * 0.3 * 10) / 10));
      setOfferYears(player.age >= 31 ? 2 : player.age <= 25 ? 4 : 3);
    }

    setOfferRole(player.ovr >= 85 ? 'Cornerstone Starter' : player.ovr >= 77 ? 'Key Contributor' : 'Rotational Depth');
    setIncludeIncentives(true);
    setNegotiationStatus('negotiating');
    setAgentFeedbackMessage('');
    setIsNegotiating(true);
  };

  // Live Interest / Satisfaction calculation
  const satisfactionScore = useMemo(() => {
    if (!negotiatingPlayer) return 50;
    return calculateOfferSatisfaction(
      negotiatingPlayer,
      offerSalary,
      offerBonus,
      offerYears,
      userTeam.ovr,
      !!season.wonSuperBowlLastSeason
    );
  }, [negotiatingPlayer, offerSalary, offerBonus, offerYears, userTeam.ovr, season.wonSuperBowlLastSeason]);

  // Current leading offer for negotiating player
  const currentLeader = useMemo(() => {
    if (!negotiatingPlayer || !negotiatingPlayer.activeOffers || negotiatingPlayer.activeOffers.length === 0) {
      return null;
    }
    return [...negotiatingPlayer.activeOffers].sort((a, b) => b.satisfaction - a.satisfaction)[0];
  }, [negotiatingPlayer]);

  // Live agent dynamic thought quote
  const liveAgentDialogue = useMemo(() => {
    if (!negotiatingPlayer) return '';
    if (satisfactionScore >= 82) {
      return `Agent: "${negotiatingPlayer.name} loves this organization and the financial commitment. Put the contract in front of us and we'll sign!"`;
    }
    if (satisfactionScore >= 65) {
      return `Agent: "This is a respectful, competitive offer. We're very close to an agreement."`;
    }
    if (satisfactionScore >= 45) {
      return `Agent: "We appreciate the interest, but ${negotiatingPlayer.name} has higher market expectations. Sweeten the guaranteed money or annual salary."`;
    }
    return `Agent: "This proposal is well below market value for a ${negotiatingPlayer.ovr} OVR ${negotiatingPlayer.position}. We need a much stronger commitment."`;
  }, [negotiatingPlayer, satisfactionScore]);

  // Submit Official Offer
  const handleSubmitOffer = () => {
    if (!negotiatingPlayer) return;

    if (offerSalary > availableCap) {
      alert(`Insufficient salary cap space! You have $${availableCap}M available, but the offer requires $${offerSalary}M/yr.`);
      return;
    }

    const updatedSeason = submitUserOffer(
      season,
      negotiatingPlayer,
      offerSalary,
      offerBonus,
      offerYears
    );

    onUpdateSeason(updatedSeason);

    const updatedPlayer = updatedSeason.freeAgentsPool.find((p) => p.id === negotiatingPlayer.id);
    if (updatedPlayer) {
      setSelectedFAId(updatedPlayer.id);
      const leading = updatedPlayer.leadingOffer;
      if (leading?.isUser || leading?.teamId === userTeam.id) {
        setNegotiationStatus('accepted');
        setAgentFeedbackMessage(
          `Offer Submitted! You now hold the LEADING BID with ${leading.satisfaction}% satisfaction ($${offerSalary.toFixed(1)}M/yr, ${offerYears} yrs). If your bid holds until the end of the in-game week, ${negotiatingPlayer.name} will sign with the ${userTeam.name}!`
        );
      } else if (leading) {
        setNegotiationStatus('countered');
        setAgentFeedbackMessage(
          `Offer Submitted (${satisfactionScore}% satisfaction). However, the ${leading.teamCity} ${leading.teamName} currently lead with ${leading.satisfaction}% satisfaction ($${leading.salary.toFixed(1)}M/yr). Increase your proposal before the week ends to take the lead!`
        );
      }
    }
  };

  // Withdraw User Offer
  const handleWithdrawOffer = () => {
    if (!negotiatingPlayer) return;
    const updatedSeason = withdrawUserOffer(season, negotiatingPlayer.id);
    onUpdateSeason(updatedSeason);
    setNegotiationStatus('negotiating');
    setAgentFeedbackMessage('Your contract bid has been successfully withdrawn.');
  };

  // Advance In-Game Week and Resolve all active bids
  const handleAdvanceWeek = () => {
    const { updatedSeason, resolvedSignings } = resolveWeeklyFreeAgentBids(season);
    
    // Increment week count
    const nextWeek = (updatedSeason.currentWeek || 1) + 1;
    const finalSeason = {
      ...updatedSeason,
      currentWeek: nextWeek,
    };

    onUpdateSeason(finalSeason);
    if (finalSeason.freeAgentsPool.length > 0) {
      setSelectedFAId(finalSeason.freeAgentsPool[0].id);
    }

    setWeekResolutionResults(resolvedSignings);
    setShowResolutionModal(true);

    const userSignings = resolvedSignings.filter((s) => s.isUser);
    if (userSignings.length > 0) {
      confetti({
        particleCount: 130,
        spread: 85,
        origin: { y: 0.6 },
        colors: [userTeam.primaryColor, '#10b981', '#f59e0b'],
      });
    }
  };

  // Release/Cut player from user roster
  const handleCutPlayer = (playerId: string) => {
    const playerToCut = season.userRoster.find((p) => p.id === playerId);
    if (!playerToCut) return;

    if (window.confirm(`Are you sure you want to release ${playerToCut.name} (${playerToCut.position}, ${playerToCut.ovr} OVR)? This will free up $${playerToCut.salary}M in salary cap.`)) {
      const updatedRoster = season.userRoster.filter((p) => p.id !== playerId);
      const newUsedCap = updatedRoster.reduce((sum, p) => sum + p.salary, 0);

      const newFA: FreeAgent = {
        ...playerToCut,
        askingSalary: Math.max(1.5, Math.round(playerToCut.salary * 0.85 * 10) / 10),
        interest: 60,
      };

      const updatedTx = [
        ...season.transactions,
        {
          date: `Week ${season.currentWeek} Free Agency`,
          text: `Released ${playerToCut.position} ${playerToCut.name} (${playerToCut.ovr} OVR), freeing up $${playerToCut.salary.toFixed(1)}M cap space.`,
          type: 'cut' as const,
        },
      ];

      const updatedSeason: FranchiseSeasonState = {
        ...season,
        userRoster: updatedRoster,
        freeAgentsPool: [newFA, ...(season.freeAgentsPool || [])],
        usedCap: Math.round(newUsedCap * 10) / 10,
        transactions: updatedTx,
      };

      onUpdateSeason(updatedSeason);
    }
  };

  // Count user active bids
  const userBidsCount = useMemo(() => {
    return (season.freeAgentsPool || []).filter((fa) =>
      (fa.activeOffers || []).some((o) => o.isUser || o.teamId === userTeam.id)
    ).length;
  }, [season.freeAgentsPool, userTeam.id]);

  const userLeadingBidsCount = useMemo(() => {
    return (season.freeAgentsPool || []).filter(
      (fa) => fa.leadingOffer && (fa.leadingOffer.isUser || fa.leadingOffer.teamId === userTeam.id)
    ).length;
  }, [season.freeAgentsPool, userTeam.id]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              NFL FREE AGENCY MARKET
            </span>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
              WEEK {season.currentWeek || 1} BIDDING CYCLE
            </span>
            {season.wonSuperBowlLastSeason && (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1 shadow-sm shadow-amber-500/10">
                <span>🏆</span>
                <span>DEFENDING SUPER BOWL CHAMPION (-12% SATISFACTION NEEDED)</span>
              </span>
            )}
          </div>
          <div>
            <h2 className="font-display font-black text-2xl lg:text-3xl text-white tracking-wide">
              CONTRACT NEGOTIATIONS & BIDDING
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              Other NFL teams actively submit competitive bids for the top 20 ranked free agents at their lowest 3 rated positions. The team whose offer delivers the highest player satisfaction wins the signing at the end of the week!
            </p>
          </div>
        </div>

        {/* Salary Cap Box & Advance Week Action */}
        <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full lg:w-auto">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 min-w-[240px] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">CAP LIMIT:</span>
              <span className="text-white font-bold font-mono">${salaryCap.toFixed(1)}M</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">USED CAP:</span>
              <span className="text-amber-400 font-bold font-mono">${usedCap.toFixed(1)}M</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
              <span className="text-slate-300 font-display font-bold">AVAILABLE:</span>
              <span className="text-emerald-400 font-display font-black text-base font-mono">
                ${availableCap.toFixed(1)}M
              </span>
            </div>
          </div>

          {/* Weekly Advance Control */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between min-w-[260px] space-y-2">
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>WEEKLY DEADLINE</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-400">
                  {userBidsCount > 0 ? `${userLeadingBidsCount}/${userBidsCount} Leading` : 'No User Bids'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Resolves top satisfaction offers across all 32 teams.
              </p>
            </div>

            <button
              id="btn-advance-fa-week"
              onClick={handleAdvanceWeek}
              className="w-full py-2.5 rounded-xl font-display font-black text-xs bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition"
            >
              <Calendar className="w-4 h-4" />
              <span>ADVANCE WEEK & RESOLVE BIDS</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub Tabs: Market vs Active Team Roster */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('market')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-display font-bold transition ${
            activeSubTab === 'market'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>AVAILABLE FREE AGENTS ({(season.freeAgentsPool || []).length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('roster')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-display font-bold transition ${
            activeSubTab === 'roster'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>CURRENT ROSTER & SALARIES ({season.userRoster.length})</span>
        </button>
      </div>

      {activeSubTab === 'market' ? (
        /* Free Agency Market Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: FA Table & Filters */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {['ALL', 'QB', 'RB', 'WR', 'TE', 'OT', 'EDGE', 'DT', 'MLB', 'CB', 'FS', 'K'].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setSelectedPos(pos)}
                    className={`px-3 py-1 rounded-lg text-xs font-display font-bold transition ${
                      selectedPos === pos
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search player, archetype..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            {/* Players Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider bg-slate-950/40">
                      <th className="py-3 px-4">PLAYER</th>
                      <th className="py-3 px-2">POS</th>
                      <th className="py-3 px-2 text-center">AGE</th>
                      <th className="py-3 px-2 text-center">OVR</th>
                      <th className="py-3 px-3 text-right">ASKING</th>
                      <th className="py-3 px-3">OFFERS / LEADER</th>
                      <th className="py-3 px-4 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {availableFA.map((player) => {
                      const isSelected = selectedFA?.id === player.id;
                      const offers = player.activeOffers || [];
                      const leader = player.leadingOffer;
                      const userOffer = offers.find((o) => o.isUser || o.teamId === userTeam.id);
                      const isUserLeading = leader && (leader.isUser || leader.teamId === userTeam.id);

                      return (
                        <tr
                          key={player.id}
                          onClick={() => setSelectedFAId(player.id)}
                          className={`cursor-pointer transition ${
                            isSelected ? 'bg-emerald-500/10' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div>
                              <span className="font-display font-bold text-white block text-sm">
                                {player.name}
                              </span>
                              <span className="text-[10px] text-slate-400">{player.archetype}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono font-bold text-[11px]">
                              {player.position}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center text-slate-300 font-mono">{player.age}</td>
                          <td className="py-3 px-2 text-center">
                            <span className={`font-display font-black text-sm px-2 py-0.5 rounded ${
                              player.ovr >= 99
                                ? 'text-amber-300 bg-amber-500/20 border border-amber-500/40'
                                : 'text-white bg-slate-950 border border-slate-800'
                            }`}>
                              {player.ovr}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                            ${player.askingSalary.toFixed(1)}M/yr
                          </td>

                          {/* Offers & Leading Bid Status */}
                          <td className="py-3 px-3">
                            {offers.length === 0 ? (
                              <span className="text-[11px] text-slate-500 italic">No bids</span>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-1.5">
                                  {isUserLeading ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1">
                                      <Crown className="w-3 h-3 text-amber-300" />
                                      <span>YOU LEAD ({leader?.satisfaction}%)</span>
                                    </span>
                                  ) : userOffer ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                      OUTBID ({userOffer.satisfaction}% vs {leader?.satisfaction}%)
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                                      <span>{leader?.teamCity || leader?.teamName}</span>
                                      <span className="text-amber-400">({leader?.satisfaction}%)</span>
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  {offers.length} {offers.length === 1 ? 'team offer' : 'competing offers'}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              id={`btn-negotiate-fa-${player.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenNegotiation(player);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center space-x-1 ml-auto"
                            >
                              <Briefcase className="w-3.5 h-3.5" />
                              <span>{userOffer ? 'MANAGE BID' : 'BID / OFFER'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Col: Selected Player Preview Panel */}
          <div className="space-y-4">
            {selectedFA ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 font-mono tracking-wider">
                      TARGET FREE AGENT
                    </span>
                    <h3 className="font-display font-black text-2xl text-white mt-0.5">
                      {selectedFA.name}
                    </h3>
                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono font-bold">
                        {selectedFA.position}
                      </span>
                      <span>•</span>
                      <span>{selectedFA.archetype}</span>
                      <span>•</span>
                      <span>Age {selectedFA.age}</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase">OVR</span>
                    <span className="font-display font-black text-xl text-white">{selectedFA.ovr}</span>
                  </div>
                </div>

                {/* Core Attributes */}
                <div className="grid grid-cols-4 gap-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-center">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">SPD</span>
                    <span className={`font-display font-black text-sm ${selectedFA.speed >= 99 ? 'text-amber-300' : selectedFA.speed >= 90 ? 'text-emerald-400' : 'text-white'}`}>
                      {selectedFA.speed}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">STR</span>
                    <span className={`font-display font-black text-sm ${selectedFA.strength >= 99 ? 'text-amber-300' : selectedFA.strength >= 90 ? 'text-emerald-400' : 'text-white'}`}>
                      {selectedFA.strength}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">AGI</span>
                    <span className={`font-display font-black text-sm ${selectedFA.agility >= 99 ? 'text-amber-300' : selectedFA.agility >= 90 ? 'text-emerald-400' : 'text-white'}`}>
                      {selectedFA.agility}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">AWR</span>
                    <span className={`font-display font-black text-sm ${selectedFA.awareness >= 99 ? 'text-amber-300' : selectedFA.awareness >= 90 ? 'text-emerald-400' : 'text-white'}`}>
                      {selectedFA.awareness}
                    </span>
                  </div>
                </div>

                {/* Recommended Offer Target */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400 uppercase font-bold border-b border-slate-800 pb-1.5">
                    <span>RECOMMENDED CONTRACT BENCHMARK</span>
                    <span>TARGET</span>
                  </div>
                  <div className="flex justify-between text-slate-400 font-mono">
                    <span>Recommended Salary:</span>
                    <span className="text-white font-bold">${selectedFA.askingSalary.toFixed(1)}M / year</span>
                  </div>
                  <div className="flex justify-between text-slate-400 font-mono">
                    <span>Recommended Bonus:</span>
                    <span className="text-emerald-400 font-bold">
                      ${Math.max(1, Math.round(selectedFA.askingSalary * 0.3 * 10) / 10).toFixed(1)}M
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400 font-mono">
                    <span>Recommended Term:</span>
                    <span className="text-slate-200 font-bold">
                      {selectedFA.age >= 31 ? 2 : selectedFA.age <= 25 ? 4 : 3} Years
                    </span>
                  </div>
                </div>

                {/* Active Competing NFL Team Bids */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-display font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                      <Briefcase className="w-4 h-4 text-emerald-400" />
                      <span>NFL TEAM OFFERS ({selectedFA.activeOffers?.length || 0})</span>
                    </span>
                    {selectedFA.leadingOffer && (
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                        Top: {selectedFA.leadingOffer.satisfaction}% Sat
                      </span>
                    )}
                  </div>

                  {(!selectedFA.activeOffers || selectedFA.activeOffers.length === 0) ? (
                    <p className="text-xs text-slate-500 italic py-2">
                      No active bids yet. Submit an offer to take pole position.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {selectedFA.activeOffers.map((offer, idx) => {
                        const isLeading = idx === 0;
                        const isUserOffer = offer.isUser || offer.teamId === userTeam.id;
                        return (
                          <div
                            key={offer.id}
                            className={`p-2.5 rounded-xl border transition ${
                              isUserOffer
                                ? 'bg-emerald-500/10 border-emerald-500/40'
                                : isLeading
                                ? 'bg-amber-500/10 border-amber-500/30'
                                : 'bg-slate-900 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: offer.primaryColor || '#94a3b8' }}
                                />
                                <span className="font-display font-bold text-xs text-white">
                                  {isUserOffer ? `${userTeam.name} (Your Team)` : `${offer.teamCity} ${offer.teamName}`}
                                </span>
                                {isLeading && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                                    <Crown className="w-2.5 h-2.5 text-amber-400" />
                                    <span>LEADER</span>
                                  </span>
                                )}
                              </div>
                              <span className={`font-mono font-bold text-xs ${
                                offer.satisfaction >= 80 ? 'text-emerald-400' : offer.satisfaction >= 60 ? 'text-amber-400' : 'text-slate-300'
                              }`}>
                                {offer.satisfaction}% Satisfaction
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-1">
                              <span>${offer.salary.toFixed(1)}M/yr • ${offer.bonus.toFixed(1)}M gtd • {offer.years}y</span>
                              {!isUserOffer && (
                                <span className="text-[10px] text-slate-500">Need: {selectedFA.position} in bottom 3</span>
                              )}
                            </div>

                            {/* Satisfaction mini bar */}
                            <div className="w-full h-1.5 bg-slate-950 rounded-full mt-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isLeading ? 'bg-amber-400' : isUserOffer ? 'bg-emerald-400' : 'bg-slate-600'
                                }`}
                                style={{ width: `${offer.satisfaction}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  id="btn-open-negotiate-modal"
                  onClick={() => handleOpenNegotiation(selectedFA)}
                  className="w-full py-3 rounded-2xl font-display font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/25 transition"
                >
                  <Sliders className="w-4 h-4" />
                  <span>
                    {(selectedFA.activeOffers || []).some((o) => o.isUser || o.teamId === userTeam.id)
                      ? 'MANAGE / UPDATE YOUR CONTRACT BID'
                      : 'SUBMIT CONTRACT OFFER'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 text-center text-slate-500">
                Select a free agent to view details or place a contract bid.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Team Roster & Release Panel */
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-black text-base text-white">
              {userTeam.name.toUpperCase()} ACTIVE SALARY BREAKDOWN
            </h3>
            <span className="text-xs text-slate-400">
              Release players to create immediate salary cap room.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {season.userRoster.map((player) => (
              <div
                key={player.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-display font-bold text-white text-sm">
                      {player.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono font-bold text-[10px]">
                      {player.position}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {player.ovr} OVR • ${player.salary.toFixed(1)}M/yr ({player.contractYears}y left)
                  </div>
                </div>

                <button
                  onClick={() => handleCutPlayer(player.id)}
                  className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-xs font-bold transition border border-rose-500/20"
                >
                  Cut
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FULL-SCREEN CONTRACT NEGOTIATION MODAL */}
      {isNegotiating && negotiatingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-hidden">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl max-h-[94vh] rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header (Fixed) */}
            <div className="flex-shrink-0 flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex flex-col items-center justify-center">
                  <span className="text-[9px] font-mono text-emerald-400 font-bold">OVR</span>
                  <span className="font-display font-black text-2xl text-white">{negotiatingPlayer.ovr}</span>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono font-bold text-xs">
                      {negotiatingPlayer.position}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Age {negotiatingPlayer.age}</span>
                    <span className="text-xs text-slate-400">• {negotiatingPlayer.archetype}</span>
                  </div>
                  <h2 className="font-display font-black text-2xl text-white mt-0.5">
                    {negotiatingPlayer.name}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => setIsNegotiating(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                title="Close Deal Window"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 my-3 custom-scrollbar">
              {/* Current Bidding Leaderboard & Standings */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-display font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Flame className="w-4 h-4 text-emerald-400" />
                    <span>Your Proposal Satisfaction vs Current Bidding Leader</span>
                  </span>
                  <span className={`font-display font-black text-sm font-mono ${
                    satisfactionScore >= 75 ? 'text-emerald-400' : satisfactionScore >= 50 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {satisfactionScore}% SATISFACTION
                  </span>
                </div>

                {/* Comparative Standings Banner */}
                {currentLeader && (
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    satisfactionScore > currentLeader.satisfaction
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold">
                          {currentLeader.isUser || currentLeader.teamId === userTeam.id
                            ? 'You currently hold the LEADING OFFER'
                            : `Current Leader: ${currentLeader.teamCity} ${currentLeader.teamName} (${currentLeader.satisfaction}%)`}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {currentLeader.isUser || currentLeader.teamId === userTeam.id
                            ? `Your bid of $${currentLeader.salary.toFixed(1)}M/yr (${currentLeader.years}y) is top-ranked!`
                            : `Offering $${currentLeader.salary.toFixed(1)}M/yr (${currentLeader.years}y). You need ${currentLeader.satisfaction + 1}% to lead.`}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-sm">
                      {satisfactionScore > currentLeader.satisfaction ? '👑 TAKES LEAD' : '⚠️ OUTBID'}
                    </span>
                  </div>
                )}

                {/* Progress Bar */}
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      satisfactionScore >= 75
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : satisfactionScore >= 50
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        : 'bg-gradient-to-r from-rose-500 to-red-400'
                    }`}
                    style={{ width: `${satisfactionScore}%` }}
                  />
                </div>

                {/* Live Dialogue */}
                <p className="text-xs text-slate-300 italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  {liveAgentDialogue}
                </p>
              </div>

              {/* Recommended Benchmark Reference */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono">RECOMMENDED SALARY:</span>
                  <span className="font-mono font-bold text-slate-200">${negotiatingPlayer.askingSalary.toFixed(1)}M/yr</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-mono">RECOMMENDED BONUS:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    ${Math.max(1, Math.round(negotiatingPlayer.askingSalary * 0.3 * 10) / 10).toFixed(1)}M
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block text-[10px] font-mono">YOUR CAP SPACE:</span>
                  <span className={`font-mono font-bold ${availableCap >= offerSalary ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${availableCap.toFixed(1)}M
                  </span>
                </div>
              </div>

              {/* Negotiation Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Annual Salary Slider */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Annual Salary (AAV):</span>
                    <span className="font-display font-black text-emerald-400 text-sm font-mono">
                      ${offerSalary.toFixed(1)}M / yr
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={45}
                    step={0.5}
                    value={offerSalary}
                    onChange={(e) => setOfferSalary(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 bg-slate-800 h-2.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>Min: $1.0M</span>
                    <button 
                      type="button" 
                      onClick={() => setOfferSalary(negotiatingPlayer.askingSalary)}
                      className="text-emerald-400 hover:underline cursor-pointer"
                    >
                      Match Rec: ${negotiatingPlayer.askingSalary.toFixed(1)}M
                    </button>
                    <span>Max: $45.0M</span>
                  </div>
                </div>

                {/* Signing Bonus Slider */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Guaranteed Bonus:</span>
                    <span className="font-display font-black text-amber-400 text-sm font-mono">
                      ${offerBonus.toFixed(1)}M Total
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={25}
                    step={0.5}
                    value={offerBonus}
                    onChange={(e) => setOfferBonus(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 bg-slate-800 h-2.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>$0M</span>
                    <button
                      type="button"
                      onClick={() => setOfferBonus(Math.max(1, Math.round(negotiatingPlayer.askingSalary * 0.3 * 10) / 10))}
                      className="text-amber-400 hover:underline cursor-pointer"
                    >
                      Match Rec Bonus: ${Math.max(1, Math.round(negotiatingPlayer.askingSalary * 0.3 * 10) / 10).toFixed(1)}M
                    </button>
                    <span>$25.0M</span>
                  </div>
                </div>

                {/* Contract Length */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <span className="text-slate-400 text-xs font-medium block">Contract Length:</span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setOfferYears(yr)}
                        className={`py-2 rounded-xl text-xs font-mono font-bold transition ${
                          offerYears === yr
                            ? 'bg-emerald-500 text-slate-950 shadow'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {yr} {yr === 1 ? 'Yr' : 'Yrs'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Promised Roster Role */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <span className="text-slate-400 text-xs font-medium block">Offered Team Role:</span>
                  <select
                    value={offerRole}
                    onChange={(e) => setOfferRole(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Cornerstone Starter">Cornerstone Starter (Guaranteed 1st String)</option>
                    <option value="Key Contributor">Key Contributor (Situational/Heavy Reps)</option>
                    <option value="Rotational Depth">Rotational Depth (Backup/Special Teams)</option>
                    <option value="Veteran Mentor">Veteran Mentor (Locker Room Leader)</option>
                  </select>
                </div>
              </div>

              {/* Performance Incentives Toggle */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-white text-xs font-bold block">Performance Incentives & Escalators</span>
                  <span className="text-[11px] text-slate-400">Includes Pro Bowl, all-pro, and post-season milestones</span>
                </div>
                <input
                  type="checkbox"
                  checked={includeIncentives}
                  onChange={(e) => setIncludeIncentives(e.target.checked)}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              {/* Other Competing Offers Summary */}
              {negotiatingPlayer.activeOffers && negotiatingPlayer.activeOffers.length > 0 && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-2 text-xs">
                  <span className="text-[11px] font-mono text-slate-400 uppercase font-bold block">
                    CURRENT COMPETING NFL OFFERS
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {negotiatingPlayer.activeOffers.map((o) => (
                      <div
                        key={o.id}
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          o.isUser ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: o.primaryColor || '#94a3b8' }}
                          />
                          <span className="font-bold text-white">
                            {o.isUser ? 'Your Bid' : `${o.teamCity} ${o.teamName}`}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            ${o.salary.toFixed(1)}M/yr ({o.years}y)
                          </span>
                        </div>
                        <span className="font-mono font-bold text-amber-400">
                          {o.satisfaction}% Satisfaction
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback Message */}
              {agentFeedbackMessage && (
                <div className={`p-3 rounded-xl text-xs font-medium text-center ${
                  negotiationStatus === 'accepted' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {agentFeedbackMessage}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex-shrink-0 flex items-center space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsNegotiating(false)}
                className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-display font-bold text-xs transition"
              >
                CLOSE
              </button>

              {(negotiatingPlayer.activeOffers || []).some((o) => o.isUser || o.teamId === userTeam.id) && (
                <button
                  type="button"
                  onClick={handleWithdrawOffer}
                  className="py-3 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-display font-bold text-xs border border-rose-500/30 transition"
                >
                  WITHDRAW BID
                </button>
              )}

              <button
                id="btn-submit-contract-offer"
                type="button"
                onClick={handleSubmitOffer}
                disabled={offerSalary > availableCap}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-display font-black text-xs transition shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {offerSalary > availableCap
                    ? 'EXCEEDS SALARY CAP'
                    : (negotiatingPlayer.activeOffers || []).some((o) => o.isUser || o.teamId === userTeam.id)
                    ? 'UPDATE CONTRACT BID'
                    : 'SUBMIT CONTRACT BID'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEEKLY RESOLUTION SUMMARY MODAL */}
      {showResolutionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <h3 className="font-display font-black text-xl text-white">
                  WEEK {season.currentWeek - 1} FREE AGENCY RESOLVED
                </h3>
              </div>
              <button
                onClick={() => setShowResolutionModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              The in-game week concluded and all free agents with active bids have officially signed with the team offering the highest satisfaction!
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {weekResolutionResults.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
                  No active bids were resolved this week.
                </div>
              ) : (
                weekResolutionResults.map(({ player, winningOffer, isUser }, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      isUser
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-display font-bold text-sm">{player.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono text-[10px] font-bold">
                          {player.position} {player.ovr} OVR
                        </span>
                        {isUser && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[9px]">
                            SIGNED TO YOUR TEAM!
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                        Won by {isUser ? userTeam.name : `${winningOffer.teamCity} ${winningOffer.teamName}`} • ${winningOffer.salary.toFixed(1)}M/yr ({winningOffer.years}y)
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-amber-400 text-xs block">
                        {winningOffer.satisfaction}% Sat
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase">Top Bid</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowResolutionModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs transition"
            >
              CONTINUE TO WEEK {season.currentWeek}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
