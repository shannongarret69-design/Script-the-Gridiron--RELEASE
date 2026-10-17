import React, { useState, useMemo } from 'react';
import { FranchiseSeasonState, FranchisePlayer, DraftPick } from '../types/franchise';
import { NFLTeam } from '../types/game';
import { getTeamById, NFL_TEAMS } from '../data/teams';
import { getMaxOvrForPlayer } from '../utils/playerLeveling';
import { 
  Award, 
  Search, 
  Sparkles, 
  Shield, 
  Zap, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  Sliders, 
  X, 
  Briefcase, 
  Flame, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  Eye
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DraftSystemViewProps {
  season: FranchiseSeasonState;
  userTeam: NFLTeam;
  onUpdateSeason: (updated: FranchiseSeasonState) => void;
}

export const DraftSystemView: React.FC<DraftSystemViewProps> = ({
  season,
  userTeam,
  onUpdateSeason,
}) => {
  const [selectedPos, setSelectedPos] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProspect, setSelectedProspect] = useState<FranchisePlayer | null>(season.draftClass[0] || null);
  const [isSimulatingPicks, setIsSimulatingPicks] = useState<boolean>(false);

  const scoutingPoints = season.scoutingPoints !== undefined ? season.scoutingPoints : 25;

  // Helper to check if a specific stat is scouted for a player
  const isScouted = (player: FranchisePlayer, statName: string) => {
    if (season.isDraftCompleted) return true;
    
    // Check if player has already been drafted
    const isPlayerDrafted = season.draftPicks.some(pick => pick.player?.id === player.id);
    if (isPlayerDrafted) return true;

    const currentScouted = player.scoutedStats || [];
    return currentScouted.includes(statName);
  };

  // Helper to spend a scouting point to reveal a stat
  const handleScoutStat = (player: FranchisePlayer, statName: string) => {
    if (scoutingPoints <= 0) return;

    const updatedDraftClass = season.draftClass.map((p) => {
      if (p.id === player.id) {
        const currentScouted = p.scoutedStats || [];
        if (!currentScouted.includes(statName)) {
          return {
            ...p,
            scoutedStats: [...currentScouted, statName],
          };
        }
      }
      return p;
    });

    const updatedSeason: FranchiseSeasonState = {
      ...season,
      scoutingPoints: scoutingPoints - 1,
      draftClass: updatedDraftClass,
    };

    onUpdateSeason(updatedSeason);

    // Update selectedProspect state so UI updates instantly
    const updatedPlayer = updatedDraftClass.find((p) => p.id === player.id);
    if (updatedPlayer) {
      setSelectedProspect(updatedPlayer);
    }
  };

  // Quick scout all available combine ratings for selected prospect
  const handleScoutAll = (player: FranchisePlayer) => {
    const allStats = ['ovr', 'speed', 'strength', 'agility', 'awareness', 'potential'];
    const currentScouted = player.scoutedStats || [];
    const unscouted = allStats.filter((s) => !currentScouted.includes(s));
    if (unscouted.length === 0 || scoutingPoints <= 0) return;

    const pointsToUse = Math.min(scoutingPoints, unscouted.length);
    const statsToAdd = unscouted.slice(0, pointsToUse);

    const updatedDraftClass = season.draftClass.map((p) => {
      if (p.id === player.id) {
        return {
          ...p,
          scoutedStats: [...(p.scoutedStats || []), ...statsToAdd],
        };
      }
      return p;
    });

    const updatedSeason: FranchiseSeasonState = {
      ...season,
      scoutingPoints: scoutingPoints - pointsToUse,
      draftClass: updatedDraftClass,
    };

    onUpdateSeason(updatedSeason);
    const updatedPlayer = updatedDraftClass.find((p) => p.id === player.id);
    if (updatedPlayer) {
      setSelectedProspect(updatedPlayer);
    }
  };

  // Rookie Negotiation Modal States
  const [isNegotiatingRookie, setIsNegotiatingRookie] = useState<boolean>(false);
  const [negotiatingProspect, setNegotiatingProspect] = useState<FranchisePlayer | null>(null);
  const [rookieSalary, setRookieSalary] = useState<number>(4.5);
  const [rookieBonus, setRookieBonus] = useState<number>(4.0);
  const [rookieYears, setRookieYears] = useState<number>(4);
  const [rookieIncentives, setRookieIncentives] = useState<'Standard' | 'Performance Boosted' | 'All-Pro Escalator'>('Performance Boosted');
  const [hasFifthYearOption, setHasFifthYearOption] = useState<boolean>(true);
  const [rookieNegotiationStatus, setRookieNegotiationStatus] = useState<'negotiating' | 'signed' | 'countered'>('negotiating');
  const [rookieCounter, setRookieCounter] = useState<{ salary: number; bonus: number; years: number; text: string } | null>(null);
  const [rookieFeedback, setRookieFeedback] = useState<string>('');

  // Drafting is blocked until the franchise season achieves the Offseason Draft stage
  const isDraftPointReached = season.stage === 'Offseason_Draft';
  const isDraftCompleted = season.isDraftCompleted || season.stage === 'Offseason_Completed';

  const draftPicks = season.draftPicks || [];
  const currentPickIndex = season.currentDraftPickIndex || 0;
  const currentPick = draftPicks[currentPickIndex] as DraftPick | undefined;
  const isUserOnClock = isDraftPointReached && !isDraftCompleted && currentPick?.teamId === userTeam.id;

  // Filtered available prospects
  const availableProspects = useMemo(() => {
    return season.draftClass.filter((p) => {
      const matchPos = selectedPos === 'ALL' || p.position === selectedPos;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.college && p.college.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.archetype.toLowerCase().includes(searchQuery.toLowerCase());
      return matchPos && matchSearch;
    });
  }, [season.draftClass, selectedPos, searchQuery]);

  // Calculate standard NFL Rookie Slot Value recommendation based on current pick
  const slotRecommendation = useMemo(() => {
    const pickNum = currentPick?.overallPick || 1;
    if (pickNum <= 5) return { salary: 8.5, bonus: 16.0, years: 4, hasOption: true };
    if (pickNum <= 15) return { salary: 6.0, bonus: 10.0, years: 4, hasOption: true };
    if (pickNum <= 32) return { salary: 4.5, bonus: 6.0, years: 4, hasOption: true };
    if (pickNum <= 64) return { salary: 2.8, bonus: 3.0, years: 4, hasOption: false };
    if (pickNum <= 100) return { salary: 1.8, bonus: 1.5, years: 3, hasOption: false };
    return { salary: 1.1, bonus: 0.6, years: 3, hasOption: false };
  }, [currentPick?.overallPick]);

  // Open Rookie Negotiation Modal (Blocked until draft point is reached)
  const handleOpenRookieNegotiation = (prospect: FranchisePlayer) => {
    if (!isDraftPointReached) {
      alert("Drafting is locked until your franchise reaches the Offseason Draft stage of the season. You can scout collegiate prospects right now, and drafting will unlock once you reach the draft!");
      return;
    }
    setSelectedProspect(prospect);
    setNegotiatingProspect(prospect);
    setRookieSalary(slotRecommendation.salary);
    setRookieBonus(slotRecommendation.bonus);
    setRookieYears(slotRecommendation.years);
    setHasFifthYearOption(slotRecommendation.hasOption);
    setRookieIncentives('Performance Boosted');
    setRookieNegotiationStatus('negotiating');
    setRookieCounter(null);
    setRookieFeedback('');
    setIsNegotiatingRookie(true);
  };

  // Live Rookie Interest / Enthusiasm gauge
  const rookieEnthusiasmScore = useMemo(() => {
    if (!negotiatingProspect) return 80;
    const baseSlot = slotRecommendation.salary;
    const baseBonus = slotRecommendation.bonus;

    const salaryRatio = rookieSalary / Math.max(0.5, baseSlot);
    const bonusRatio = rookieBonus / Math.max(0.5, baseBonus);

    let score = Math.min(99, Math.max(10, Math.round(salaryRatio * 45 + bonusRatio * 45 + (userTeam.ovr - 70) * 0.5)));
    return score;
  }, [negotiatingProspect, rookieSalary, rookieBonus, slotRecommendation, userTeam.ovr]);

  // Live dynamic rookie dialogue
  const liveRookieDialogue = useMemo(() => {
    if (!negotiatingProspect) return '';
    if (rookieEnthusiasmScore >= 85) {
      return `Rookie ${negotiatingProspect.name}: "I'm hyped! Putting on this jersey and bringing a Super Bowl home is the dream. Let's sign and get to work!"`;
    }
    if (rookieEnthusiasmScore >= 65) {
      return `Agent: "This slot contract aligns with first-class rookie standards. My client is ready to sign."`;
    }
    return `Agent: "For a top prospect from ${negotiatingProspect.college}, we expect standard guaranteed slot compensation. Match slot value."`;
  }, [negotiatingProspect, rookieEnthusiasmScore]);

  // Execute a draft pick for a specific team with custom contract values (Blocked until draft point is reached)
  const makeDraftPick = (teamId: string, player: FranchisePlayer, customSalary?: number, customYears?: number) => {
    if (!isDraftPointReached) {
      alert("Drafting is locked until your franchise reaches the Offseason Draft stage of the season. You can scout collegiate prospects right now, and drafting will unlock once you reach the draft!");
      return;
    }

    const finalPlayer: FranchisePlayer = {
      ...player,
      salary: customSalary !== undefined ? customSalary : player.salary,
      contractYears: customYears !== undefined ? customYears : player.contractYears,
      isRookie: true,
      level: 1,
      xp: 0,
      maxOvr: getMaxOvrForPlayer(player),
    };

    const updatedDraftClass = season.draftClass.filter((p) => p.id !== player.id);
    const updatedDraftPicks = [...draftPicks];
    const currentRound = currentPick?.round || 1;
    const currentPickNum = currentPick?.pickNumber || (currentPickIndex + 1);
    
    if (updatedDraftPicks[currentPickIndex]) {
      updatedDraftPicks[currentPickIndex].player = finalPlayer;
      if (teamId === userTeam.id) {
        updatedDraftPicks[currentPickIndex].teamId = userTeam.id;
      }
    }

    const nextHistory = [
      ...season.draftHistory,
      {
        round: currentRound,
        pick: currentPickNum,
        teamId,
        player: finalPlayer,
      },
    ];

    let updatedRoster = [...season.userRoster];
    let updatedTransactions = [...season.transactions];

    if (teamId === userTeam.id) {
      updatedRoster.push(finalPlayer);
      updatedTransactions.push({
        date: `Round ${currentRound}, Pick ${currentPickNum}`,
        text: `Drafted & signed rookie ${finalPlayer.position} ${finalPlayer.name} (${finalPlayer.college}, ${finalPlayer.ovr} OVR) to a ${finalPlayer.contractYears}yr, $${finalPlayer.salary.toFixed(1)}M/yr rookie deal.`,
        type: 'draft',
      });

      confetti({
        particleCount: 110,
        spread: 85,
        origin: { y: 0.6 },
        colors: [userTeam.primaryColor, '#f59e0b', '#10b981'],
      });
    }

    const nextPickIndex = currentPickIndex + 1;
    const isCompleted = nextPickIndex >= draftPicks.length || updatedDraftClass.length === 0;

    const updatedSeason: FranchiseSeasonState = {
      ...season,
      draftClass: updatedDraftClass,
      draftPicks: updatedDraftPicks,
      currentDraftPickIndex: nextPickIndex,
      isDraftCompleted: isCompleted,
      draftHistory: nextHistory,
      userRoster: updatedRoster,
      transactions: updatedTransactions,
      stage: isCompleted ? 'Offseason_Completed' : 'Offseason_Draft',
    };

    onUpdateSeason(updatedSeason);
    setSelectedProspect(updatedDraftClass[0] || null);
    setIsNegotiatingRookie(false);
  };

  // Submit official rookie contract offer
  const handleSubmitRookieOffer = () => {
    if (!negotiatingProspect) return;

    if (rookieEnthusiasmScore >= 55) {
      setRookieNegotiationStatus('signed');
      setRookieFeedback(`Draft pick confirmed! ${negotiatingProspect.name} signed his rookie contract.`);
      setTimeout(() => {
        makeDraftPick(userTeam.id, negotiatingProspect, rookieSalary, rookieYears);
      }, 300);
    } else {
      // Counter with slot recommendation
      setRookieNegotiationStatus('countered');
      setRookieCounter({
        salary: slotRecommendation.salary,
        bonus: slotRecommendation.bonus,
        years: slotRecommendation.years,
        text: `Agent: "We want slot guarantee protection for a round ${currentPick?.round || 1} selection. Match $${slotRecommendation.salary.toFixed(1)}M/yr with $${slotRecommendation.bonus.toFixed(1)}M bonus to finalize, or choose Force Sign."`,
      });
    }
  };

  // Simulate next single AI pick (Blocked until draft point is reached)
  const handleSimulateNextPick = () => {
    if (!isDraftPointReached || !currentPick || season.isDraftCompleted) return;

    if (currentPick.teamId === userTeam.id) {
      const best = season.draftClass[0];
      if (best) makeDraftPick(userTeam.id, best);
      return;
    }

    const candidatePool = season.draftClass.slice(0, 4);
    const chosen = candidatePool[Math.floor(Math.random() * candidatePool.length)] || season.draftClass[0];
    if (chosen) {
      makeDraftPick(currentPick.teamId, chosen);
    }
  };

  // Fast forward until user is on the clock (Blocked until draft point is reached)
  const handleSimulateUntilUserPick = () => {
    if (!isDraftPointReached || season.isDraftCompleted) return;
    setIsSimulatingPicks(true);

    let tempSeason = { ...season };
    let tempDraftClass = [...tempSeason.draftClass];
    let tempPicks = [...(tempSeason.draftPicks || [])];
    let tempHistory = [...tempSeason.draftHistory];
    let tempRoster = [...tempSeason.userRoster];
    let tempTx = [...tempSeason.transactions];
    let idx = tempSeason.currentDraftPickIndex;

    while (idx < tempPicks.length && tempDraftClass.length > 0) {
      const pick = tempPicks[idx];
      if (pick.teamId === userTeam.id && idx !== season.currentDraftPickIndex) {
        break;
      }

      const teamToPick = pick.teamId;
      const candidatePool = tempDraftClass.slice(0, 3);
      const chosen = candidatePool[Math.floor(Math.random() * candidatePool.length)] || tempDraftClass[0];

      if (!chosen) break;

      tempDraftClass = tempDraftClass.filter((p) => p.id !== chosen.id);
      tempPicks[idx].player = chosen;
      tempHistory.push({
        round: pick.round,
        pick: pick.pickNumber,
        teamId: teamToPick,
        player: chosen,
      });

      if (teamToPick === userTeam.id) {
        tempRoster.push(chosen);
        tempTx.push({
          date: `Round ${pick.round}, Pick ${pick.pickNumber}`,
          text: `Auto-Drafted rookie ${chosen.position} ${chosen.name} (${chosen.college}, ${chosen.ovr} OVR).`,
          type: 'draft',
        });
      }

      idx++;
    }

    const isCompleted = idx >= tempPicks.length || tempDraftClass.length === 0;

    const updatedSeason: FranchiseSeasonState = {
      ...tempSeason,
      draftClass: tempDraftClass,
      draftPicks: tempPicks,
      currentDraftPickIndex: idx,
      isDraftCompleted: isCompleted,
      draftHistory: tempHistory,
      userRoster: tempRoster,
      transactions: tempTx,
      stage: isCompleted ? 'Offseason_Completed' : 'Offseason_Draft',
    };

    onUpdateSeason(updatedSeason);
    setSelectedProspect(tempDraftClass[0] || null);
    setIsSimulatingPicks(false);
  };

  const currentPickTeam = currentPick ? getTeamById(currentPick.teamId) : null;

  return (
    <div className="space-y-6">
      {/* Top Banner & Draft Clock HUD */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            {isDraftPointReached ? <Award className="w-7 h-7" /> : <Search className="w-7 h-7" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-display font-black text-xs uppercase tracking-wider">
                {isDraftPointReached ? `${season.seasonYear} NFL DRAFT` : 'COLLEGE SCOUTING DEPARTMENT'}
              </span>
              <span className="text-xs text-slate-400 font-mono flex items-center space-x-1">
                {isDraftCompleted ? (
                  'DRAFT COMPLETED'
                ) : isDraftPointReached ? (
                  `ROUND ${currentPick?.round || 1} • PICK ${currentPick?.pickNumber || 1}`
                ) : (
                  <span className="text-amber-400 font-bold flex items-center space-x-1">
                    <Lock className="w-3 h-3 inline" />
                    <span>DRAFTING LOCKED (SCOUTING ACTIVE)</span>
                  </span>
                )}
              </span>
            </div>
            <h2 className="font-display font-black text-2xl text-white tracking-wide mt-1">
              {isDraftPointReached ? (
                <>ROOKIE SCOUTING & <span className="text-amber-500">NEGOTIATION WAR ROOM</span></>
              ) : (
                <>COLLEGIATE PROSPECTS & <span className="text-amber-500">DRAFT BIG BOARD</span></>
              )}
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              {isDraftPointReached
                ? 'Negotiate rookie contracts, evaluate scouting combine measurables, and build your franchise future.'
                : 'Scout college tape, evaluate combine measurables, and build your big board. Drafting unlocks once your franchise reaches the Offseason Draft stage.'}
            </p>
          </div>
        </div>

        {/* Pre-Draft Scouting Department Status HUD (When draft point not yet achieved) */}
        {!isDraftPointReached && !isDraftCompleted && (
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider font-mono">
                  DRAFTING LOCKED
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-300 font-mono">
                  STAGE: {season.stage.replace('_', ' ')}
                </span>
              </div>
              <h4 className="font-display font-black text-sm text-white mt-0.5">
                SCOUTING DEPARTMENT OPEN
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs leading-tight">
                Drafting unlocks after advancing through the Regular Season, Playoffs, and Offseason Free Agency.
              </p>
            </div>
            <div className="pl-3 border-l border-slate-800 flex flex-col items-center justify-center">
              <span className="text-[10px] text-slate-400 uppercase font-mono">Scout Pts</span>
              <span className="font-display font-black text-xl text-amber-400">{scoutingPoints}</span>
            </div>
          </div>
        )}

        {/* Live On The Clock HUD (Only when draft stage is active) */}
        {isDraftPointReached && !isDraftCompleted && currentPickTeam && (
          <div className={`p-4 rounded-2xl border flex items-center space-x-4 transition ${
            isUserOnClock
              ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/40 animate-pulse'
              : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-base shadow-md"
              style={{
                backgroundColor: currentPickTeam.primaryColor,
                color: currentPickTeam.textColor || '#ffffff',
                border: `2px solid ${currentPickTeam.secondaryColor || '#ffffff'}`,
              }}
            >
              {currentPickTeam.abbr}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                ON THE CLOCK (PICK #{currentPick?.overallPick})
              </span>
              <h4 className="font-display font-black text-base text-white">
                {currentPickTeam.city} {currentPickTeam.name}
              </h4>
              {isUserOnClock && (
                <span className="text-xs font-black text-amber-400 font-display">
                  YOUR TURN TO SELECT & NEGOTIATE!
                </span>
              )}
            </div>

            {/* Sim controls */}
            <div className="flex flex-col gap-1.5 pl-2 border-l border-slate-800">
              <button
                onClick={handleSimulateNextPick}
                disabled={isSimulatingPicks}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition"
              >
                Sim 1 Pick
              </button>
              <button
                onClick={handleSimulateUntilUserPick}
                disabled={isSimulatingPicks || isUserOnClock}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-xs shadow-md transition disabled:opacity-50"
              >
                Sim to My Pick
              </button>
            </div>
          </div>
        )}

        {season.isDraftCompleted && (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center">
            <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
            <span className="font-display font-black text-sm text-emerald-300">DRAFT CONCLUDED</span>
            <span className="text-xs text-slate-400 block">All drafted rookies have signed contracts and joined your roster.</span>
          </div>
        )}
      </div>

      {/* Main 2-Column: Draft Board (Left) & Scouting Report (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Prospect List & Filters */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            {/* Position Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {['ALL', 'QB', 'RB', 'WR', 'TE', 'OT', 'EDGE', 'DT', 'MLB', 'CB', 'FS', 'K'].map((pos) => (
                <button
                  key={pos}
                  onClick={() => setSelectedPos(pos)}
                  className={`px-3 py-1 rounded-lg text-xs font-display font-bold transition ${
                    selectedPos === pos
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search college, archetype..."
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Prospect Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800 sticky top-0 backdrop-blur-md">
                    <th className="py-3 px-4">PROSPECT</th>
                    <th className="py-3 px-2">POS</th>
                    <th className="py-3 px-3">COLLEGE</th>
                    <th className="py-3 px-2 text-center">OVR</th>
                    <th className="py-3 px-2 text-center">POT</th>
                    <th className="py-3 px-2 text-center">SPD</th>
                    <th className="py-3 px-2 text-center">STR</th>
                    <th className="py-3 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {availableProspects.map((player, idx) => {
                    const isSelected = selectedProspect?.id === player.id;
                    return (
                      <tr
                        key={player.id}
                        onClick={() => setSelectedProspect(player)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono text-slate-500">#{idx + 1}</span>
                            <div>
                              <span className="font-display font-bold text-white block text-sm">
                                {player.name}
                              </span>
                              <span className="text-[10px] text-slate-400">{player.archetype}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono font-bold text-[11px]">
                            {player.position}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-medium">{player.college}</td>
                        <td className="py-3 px-2 text-center">
                          <span className="font-display font-black text-sm text-white px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                            {isScouted(player, 'ovr') ? player.ovr : '??'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          {isScouted(player, 'potential') ? (
                            <span className={`font-mono font-black text-xs ${
                              player.potential === 'A+' ? 'text-emerald-400' : player.potential === 'A' ? 'text-teal-400' : 'text-amber-400'
                            }`}>
                              {player.potential}
                            </span>
                          ) : (
                            <span className="text-slate-600 font-bold">?</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center font-mono text-slate-300">
                          {isScouted(player, 'speed') ? player.speed : '??'}
                        </td>
                        <td className="py-3 px-2 text-center font-mono text-slate-300">
                          {isScouted(player, 'strength') ? player.strength : '??'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isDraftPointReached ? (
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                id={`btn-draft-quick-${player.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  makeDraftPick(userTeam.id, player);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-display font-black text-xs transition flex items-center space-x-1 border border-amber-500/30 hover:border-amber-400"
                                title="Draft rookie immediately with standard rookie contract"
                              >
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                <span>QUICK DRAFT</span>
                              </button>

                              <button
                                id={`btn-draft-negotiate-${player.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenRookieNegotiation(player);
                                }}
                                className="px-3 py-1.5 rounded-lg font-display font-black text-xs transition flex items-center space-x-1 bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md"
                              >
                                <Briefcase className="w-3.5 h-3.5" />
                                <span>{isUserOnClock ? 'NEGOTIATE & DRAFT' : 'DRAFT / NEGOTIATE'}</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                id={`btn-scout-dossier-${player.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProspect(player);
                                }}
                                className={`px-3 py-1.5 rounded-lg font-display font-bold text-xs transition flex items-center space-x-1 border ${
                                  isSelected
                                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                                    : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/30'
                                }`}
                                title="View player dossier and scout combine attributes"
                              >
                                <Search className="w-3.5 h-3.5" />
                                <span>SCOUT</span>
                              </button>
                              <span
                                className="px-2 py-1 rounded bg-slate-950/80 text-slate-500 border border-slate-800 text-[10px] font-mono flex items-center space-x-1"
                                title="Drafting is blocked until the Offseason Draft stage"
                              >
                                <Lock className="w-2.5 h-2.5" />
                                <span>LOCKED</span>
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Col: Prospect Scouting Card */}
        <div className="space-y-4">
          {selectedProspect ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              {/* Scouting Budget Indicator */}
              <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800/80 rounded-2xl px-4 py-2.5 text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  Scouting Points:
                </span>
                <span className="text-amber-400 font-black text-sm">{scoutingPoints} Pts</span>
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-400 font-mono tracking-wider">
                    SCOUTING DOSSIER • ROUND {selectedProspect.projectedRound} GRADE
                  </span>
                  <h3 className="font-display font-black text-2xl text-white mt-0.5">
                    {selectedProspect.name}
                  </h3>
                  <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono font-bold">
                      {selectedProspect.position}
                    </span>
                    <span>•</span>
                    <span>{selectedProspect.college}</span>
                    <span>•</span>
                    <span>Age {selectedProspect.age}</span>
                  </div>
                </div>
                
                {/* OVR Box */}
                <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden group">
                  <span className="text-[9px] font-mono text-slate-500 font-bold uppercase">OVR</span>
                  {isScouted(selectedProspect, 'ovr') ? (
                    <span className="font-display font-black text-xl text-white">{selectedProspect.ovr}</span>
                  ) : (
                    <button
                      onClick={() => handleScoutStat(selectedProspect, 'ovr')}
                      disabled={scoutingPoints <= 0}
                      className="absolute inset-0 w-full h-full bg-amber-500/10 hover:bg-amber-500/20 text-[10px] text-amber-400 font-bold flex flex-col items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Reveal Overall rating (1 Point)"
                    >
                      <span>REVEAL</span>
                      <span className="text-[8px] opacity-80">(1 Pt)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Attributes Radar / Bars */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-mono font-bold uppercase text-slate-400 tracking-wider">
                    COMBINE PHYSICAL MEASURABLES & RATINGS
                  </h4>
                  {scoutingPoints > 0 && selectedProspect && (
                    <button
                      onClick={() => handleScoutAll(selectedProspect)}
                      className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-[10px] font-bold font-mono transition flex items-center space-x-1 cursor-pointer"
                      title="Scout all unscouted ratings for this prospect"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>SCOUT ALL</span>
                    </button>
                  )}
                </div>
                
                <div className="space-y-3 text-xs">
                  {/* Speed & Acceleration */}
                  <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-slate-300 font-medium">Speed & Acceleration</span>
                      {isScouted(selectedProspect, 'speed') ? (
                        <span className="font-mono text-amber-400 font-bold">{selectedProspect.speed}/99</span>
                      ) : (
                        <button
                          onClick={() => handleScoutStat(selectedProspect, 'speed')}
                          disabled={scoutingPoints <= 0}
                          className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold hover:bg-amber-500 hover:text-slate-950 transition text-[9px] uppercase tracking-wider"
                        >
                          Scout (1 Pt)
                        </button>
                      )}
                    </div>
                    {isScouted(selectedProspect, 'speed') ? (
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                        <div className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full" style={{ width: `${selectedProspect.speed}%` }} />
                      </div>
                    ) : (
                      <div className="w-full bg-slate-950/60 rounded-full h-1.5 border border-slate-900/40 flex items-center justify-center overflow-hidden">
                        <div className="w-full h-full bg-slate-800/30 animate-pulse rounded-full" />
                      </div>
                    )}
                  </div>

                  {/* Strength & Power */}
                  <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-slate-300 font-medium">Strength & Power</span>
                      {isScouted(selectedProspect, 'strength') ? (
                        <span className="font-mono text-amber-400 font-bold">{selectedProspect.strength}/99</span>
                      ) : (
                        <button
                          onClick={() => handleScoutStat(selectedProspect, 'strength')}
                          disabled={scoutingPoints <= 0}
                          className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold hover:bg-amber-500 hover:text-slate-950 transition text-[9px] uppercase tracking-wider"
                        >
                          Scout (1 Pt)
                        </button>
                      )}
                    </div>
                    {isScouted(selectedProspect, 'strength') ? (
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                        <div className="bg-gradient-to-r from-amber-500 to-cyan-400 h-full rounded-full" style={{ width: `${selectedProspect.strength}%` }} />
                      </div>
                    ) : (
                      <div className="w-full bg-slate-950/60 rounded-full h-1.5 border border-slate-900/40 flex items-center justify-center overflow-hidden">
                        <div className="w-full h-full bg-slate-800/30 animate-pulse rounded-full" />
                      </div>
                    )}
                  </div>

                  {/* Agility & Quickness */}
                  <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-slate-300 font-medium">Agility & Quickness</span>
                      {isScouted(selectedProspect, 'agility') ? (
                        <span className="font-mono text-amber-400 font-bold">{selectedProspect.agility || 75}/99</span>
                      ) : (
                        <button
                          onClick={() => handleScoutStat(selectedProspect, 'agility')}
                          disabled={scoutingPoints <= 0}
                          className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold hover:bg-amber-500 hover:text-slate-950 transition text-[9px] uppercase tracking-wider"
                        >
                          Scout (1 Pt)
                        </button>
                      )}
                    </div>
                    {isScouted(selectedProspect, 'agility') ? (
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                        <div className="bg-gradient-to-r from-amber-500 to-teal-400 h-full rounded-full" style={{ width: `${selectedProspect.agility || 75}%` }} />
                      </div>
                    ) : (
                      <div className="w-full bg-slate-950/60 rounded-full h-1.5 border border-slate-900/40 flex items-center justify-center overflow-hidden">
                        <div className="w-full h-full bg-slate-800/30 animate-pulse rounded-full" />
                      </div>
                    )}
                  </div>

                  {/* Awareness & IQ */}
                  <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-slate-300 font-medium">Awareness & IQ</span>
                      {isScouted(selectedProspect, 'awareness') ? (
                        <span className="font-mono text-amber-400 font-bold">{selectedProspect.awareness || 70}/99</span>
                      ) : (
                        <button
                          onClick={() => handleScoutStat(selectedProspect, 'awareness')}
                          disabled={scoutingPoints <= 0}
                          className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold hover:bg-amber-500 hover:text-slate-950 transition text-[9px] uppercase tracking-wider"
                        >
                          Scout (1 Pt)
                        </button>
                      )}
                    </div>
                    {isScouted(selectedProspect, 'awareness') ? (
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                        <div className="bg-gradient-to-r from-amber-500 to-indigo-400 h-full rounded-full" style={{ width: `${selectedProspect.awareness || 70}%` }} />
                      </div>
                    ) : (
                      <div className="w-full bg-slate-950/60 rounded-full h-1.5 border border-slate-900/40 flex items-center justify-center overflow-hidden">
                        <div className="w-full h-full bg-slate-800/30 animate-pulse rounded-full" />
                      </div>
                    )}
                  </div>

                  {/* Development Potential */}
                  <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-slate-300 font-medium">Development Potential</span>
                      {isScouted(selectedProspect, 'potential') ? (
                        <span className="font-mono text-amber-400 font-bold">{selectedProspect.potential} Grade</span>
                      ) : (
                        <button
                          onClick={() => handleScoutStat(selectedProspect, 'potential')}
                          disabled={scoutingPoints <= 0}
                          className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold hover:bg-amber-500 hover:text-slate-950 transition text-[9px] uppercase tracking-wider"
                        >
                          Scout (1 Pt)
                        </button>
                      )}
                    </div>
                    {isScouted(selectedProspect, 'potential') ? (
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                        <div className="bg-gradient-to-r from-amber-500 to-purple-400 h-full rounded-full" style={{ 
                          width: selectedProspect.potential === 'A+' ? '95%' : selectedProspect.potential === 'A' ? '85%' : selectedProspect.potential === 'B+' ? '75%' : '60%' 
                        }} />
                      </div>
                    ) : (
                      <div className="w-full bg-slate-950/60 rounded-full h-1.5 border border-slate-900/40 flex items-center justify-center overflow-hidden">
                        <div className="w-full h-full bg-slate-800/30 animate-pulse rounded-full" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Slot estimate */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Target Slot Salary:</span>
                  <span className="text-white font-bold">${slotRecommendation.salary.toFixed(1)}M/yr</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Slot Signing Bonus:</span>
                  <span className="text-amber-400 font-bold">${slotRecommendation.bonus.toFixed(1)}M</span>
                </div>
              </div>

              {/* Action Buttons / Drafting Gate */}
              <div className="space-y-2">
                {isDraftPointReached ? (
                  <>
                    <button
                      id="btn-draft-negotiate-open"
                      onClick={() => handleOpenRookieNegotiation(selectedProspect)}
                      className="w-full py-3 rounded-2xl font-display font-black text-sm flex items-center justify-center space-x-2 transition bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-lg shadow-amber-500/25 cursor-pointer"
                    >
                      <Sliders className="w-4 h-4" />
                      <span>NEGOTIATE ROOKIE CONTRACT & DRAFT</span>
                    </button>

                    <button
                      id="btn-quick-draft-selected"
                      onClick={() => makeDraftPick(userTeam.id, selectedProspect)}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-display font-bold text-xs transition border border-amber-500/40 hover:border-amber-400 flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>QUICK DRAFT TO ROSTER (AUTO SLOT)</span>
                    </button>
                  </>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-2">
                    <div className="flex items-center justify-center space-x-1.5 text-amber-400 font-display font-bold text-xs">
                      <Lock className="w-4 h-4" />
                      <span>DRAFTING LOCKED UNTIL OFFSEASON DRAFT</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Drafting unlocks when your season reaches the Offseason Draft stage. Continue evaluating and revealing combine attributes using your scouting points.
                    </p>
                    {scoutingPoints > 0 && (
                      <button
                        onClick={() => handleScoutAll(selectedProspect)}
                        className="w-full py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 font-display font-bold text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>SCOUT PROSPECT ATTRIBUTES</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 text-center text-slate-500">
              Select a collegiate prospect to view scouting report.
            </div>
          )}
        </div>
      </div>

      {/* ROOKIE DRAFT CONTRACT NEGOTIATION MODAL */}
      {isNegotiatingRookie && negotiatingProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-hidden">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl max-h-[92vh] rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header (Fixed) */}
            <div className="flex-shrink-0 flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex flex-col items-center justify-center">
                  <span className="text-[9px] font-mono text-amber-400 font-bold">OVR</span>
                  <span className="font-display font-black text-2xl text-white">{negotiatingProspect.ovr}</span>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono font-bold text-xs">
                      {negotiatingProspect.position}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{negotiatingProspect.college}</span>
                    <span className="text-xs text-slate-400">• Round {currentPick?.round} Pick #{currentPick?.pickNumber}</span>
                  </div>
                  <h2 className="font-display font-black text-2xl text-white mt-0.5">
                    {negotiatingProspect.name}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNegotiatingRookie(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                title="Close Deal Window"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Area with Visible Scrollbar */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 my-3 custom-scrollbar">
              {/* Rookie Signability & Dialogue */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-display font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>Rookie Signability & Camp Enthusiasm</span>
                  </span>
                  <span className="font-display font-black text-sm text-amber-400 font-mono">
                    {rookieEnthusiasmScore}% READY
                  </span>
                </div>

                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
                    style={{ width: `${rookieEnthusiasmScore}%` }}
                  />
                </div>

                <p className="text-xs text-slate-300 italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  {liveRookieDialogue}
                </p>
              </div>

              {/* Slot Target Guidance */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Target Slot Salary:</span>
                  <span className="font-mono font-bold text-slate-200">${slotRecommendation.salary.toFixed(1)}M/yr</span>
                </div>
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Slot Signing Bonus:</span>
                  <span className="font-mono font-bold text-amber-400">${slotRecommendation.bonus.toFixed(1)}M</span>
                </div>
              </div>

              {/* Rookie Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rookie Salary Slider */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Rookie Base Salary:</span>
                    <span className="font-display font-black text-amber-400 text-sm font-mono">
                      ${rookieSalary.toFixed(1)}M / yr
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={15.0}
                    step={0.2}
                    value={rookieSalary}
                    onChange={(e) => setRookieSalary(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 bg-slate-800 h-2.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>Min: $0.8M</span>
                    <button 
                      type="button" 
                      onClick={() => setRookieSalary(slotRecommendation.salary)}
                      className="text-amber-400 hover:underline cursor-pointer"
                    >
                      Match Slot: ${slotRecommendation.salary.toFixed(1)}M
                    </button>
                    <span>Max: $15.0M</span>
                  </div>
                </div>

                {/* Rookie Signing Bonus Slider */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Upfront Signing Bonus:</span>
                    <span className="font-display font-black text-emerald-400 text-sm font-mono">
                      ${rookieBonus.toFixed(1)}M Total
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={20.0}
                    step={0.2}
                    value={rookieBonus}
                    onChange={(e) => setRookieBonus(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 bg-slate-800 h-2.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>Min: $0.2M</span>
                    <button 
                      type="button" 
                      onClick={() => setRookieBonus(slotRecommendation.bonus)}
                      className="text-emerald-400 hover:underline cursor-pointer"
                    >
                      Match Slot: ${slotRecommendation.bonus.toFixed(1)}M
                    </button>
                    <span>Max: $20.0M</span>
                  </div>
                </div>

                {/* Rookie Duration */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <span className="text-slate-400 text-xs font-medium block">Contract Duration:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 4, 5].map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setRookieYears(yr)}
                        className={`py-2 rounded-xl text-xs font-mono font-bold transition ${
                          rookieYears === yr
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {yr} Years
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rookie Performance Incentive Package */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <span className="text-slate-400 text-xs font-medium block">Incentives Package:</span>
                  <select
                    value={rookieIncentives}
                    onChange={(e) => setRookieIncentives(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-amber-500"
                  >
                    <option value="Performance Boosted">Performance Boosted (+$1M for ROY)</option>
                    <option value="All-Pro Escalator">All-Pro Escalator (+$2M for Pro Bowl)</option>
                    <option value="Standard">Standard Rookie Scale</option>
                  </select>
                </div>
              </div>

              {/* 5th Year Option Toggle */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-white text-xs font-bold block">5th-Year Team Option</span>
                  <span className="text-[11px] text-slate-400">Team control option for 1st-round draft selection</span>
                </div>
                <input
                  type="checkbox"
                  checked={hasFifthYearOption}
                  onChange={(e) => setHasFifthYearOption(e.target.checked)}
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              {/* Counter offer display */}
              {rookieNegotiationStatus === 'countered' && rookieCounter && (
                <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-amber-400 font-display font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    <span>AGENT COUNTER-PROPOSAL</span>
                  </div>
                  <p className="text-xs text-slate-200">{rookieCounter.text}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRookieSalary(rookieCounter.salary);
                        setRookieBonus(rookieCounter.bonus);
                        setRookieYears(rookieCounter.years);
                        makeDraftPick(userTeam.id, negotiatingProspect, rookieCounter.salary, rookieCounter.years);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-xs transition flex items-center space-x-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept Counter & Draft (${rookieCounter.salary.toFixed(1)}M/yr)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        makeDraftPick(userTeam.id, negotiatingProspect, rookieSalary, rookieYears);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition"
                    >
                      Force Sign & Draft Tender
                    </button>
                  </div>
                </div>
              )}

              {rookieFeedback && (
                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-medium text-center border border-emerald-500/30">
                  {rookieFeedback}
                </div>
              )}
            </div>

            {/* Modal Actions (Sticky / Fixed Footer) */}
            <div className="flex-shrink-0 flex items-center space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsNegotiatingRookie(false)}
                className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-display font-bold text-xs transition"
              >
                RETURN TO BOARD
              </button>

              <button
                id="btn-confirm-rookie-contract"
                type="button"
                onClick={handleSubmitRookieOffer}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-display font-black text-xs transition shadow-lg shadow-amber-500/25 flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>FINALIZE CONTRACT & DRAFT ROOKIE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
