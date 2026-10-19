import React, { useState, useEffect, useRef } from 'react';
import {
  NFLTeam,
  ScheduleGame,
  TeamStanding,
  PlayoffBracket,
  PlayoffMatchup,
  Conference,
  Division,
} from '../types/game';
import { FranchiseSeasonState, FranchisePlayer } from '../types/franchise';
import { NFL_TEAMS, getTeamById } from '../data/teams';
import {
  generateNFLSchedule,
  initializeStandings,
  simulateScore,
  simulateScoreDetailed,
  SimGameDetails,
  updateStandingsWithGame,
  getConferencePlayoffSeeds,
  generatePlayoffBracket,
  advanceToDivisionalRound,
  advanceToConferenceRound,
  advanceToSuperBowl,
  recalculateStandingsFromSchedule,
} from '../utils/seasonEngine';
import { generateInitialTeamRoster } from '../utils/aiRosterGenerator';
import {
  getActiveSlotId,
  setActiveSlotId,
  loadSaveSlot,
  saveToSlot,
  createNewFranchiseSeason,
  advanceToNextFranchiseYear,
} from '../utils/saveManager';
import { SaveSlotManagerModal } from './SaveSlotManagerModal';
import { DraftSystemView } from './DraftSystemView';
import { FreeAgencyView } from './FreeAgencyView';
import { RosterDepthChartView } from './RosterDepthChartView';
import { TradeCenterView } from './TradeCenterView';
import { PlayerStatsHistoryView } from './PlayerStatsHistoryView';
import { MvpAwardsModal } from './MvpAwardsModal';
import { LeagueNewsModal } from './LeagueNewsModal';
import { generateWeeklyLeagueNews } from '../utils/leagueNewsEngine';
import { WeeklyLeagueNews } from '../types/franchise';
import { PlayoffBracketView } from './PlayoffBracketView';
import { crownMvpAndAwards } from '../utils/awardsEngine';
import { getStartersFromRoster } from '../utils/rosterUtils';
import { resolveWeeklyFreeAgentBids } from '../utils/freeAgencyEngine';
import { resolveWeeklyMidSeasonTrades } from '../utils/tradeEngine';
import { simulateUserRosterStatsForGame } from '../utils/seasonEngine';
import {
  Trophy,
  Calendar,
  BarChart3,
  Play,
  FastForward,
  RotateCcw,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Lock,
  HardDrive,
  DollarSign,
  UserPlus,
  Sparkles,
  Users,
  AlertCircle,
  BarChart2,
  X,
  ArrowLeftRight,
  Crown,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SeasonModeProps {
  onPlaySeasonGame: (
    homeTeam: NFLTeam,
    awayTeam: NFLTeam,
    week: number,
    isPlayoff: boolean,
    playoffRound?: string
  ) => void;
}

export const SeasonMode: React.FC<SeasonModeProps> = ({ onPlaySeasonGame }) => {
  const [season, setSeason] = useState<FranchiseSeasonState | null>(null);
  const [selectedTab, setSelectedTab] = useState<
    'schedule' | 'standings' | 'playoffs' | 'draft' | 'freeAgency' | 'trade' | 'roster' | 'stats'
  >('schedule');
  const [scheduleWeekView, setScheduleWeekView] = useState<number>(1);
  const [standingsConfView, setStandingsConfView] = useState<Conference>('AFC');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [isNewSeasonModalOpen, setIsNewSeasonModalOpen] = useState<boolean>(false);
  const [isTeamPickerOpen, setIsTeamPickerOpen] = useState<boolean>(false);
  const [targetSlotForNew, setTargetSlotForNew] = useState<1 | 2 | 3>(1);
  const [selectedTeamForNew, setSelectedTeamForNew] = useState<string | null>(null);
  const [isDifficultyModalOpen, setIsDifficultyModalOpen] = useState<boolean>(false);
  const [showRewindModal, setShowRewindModal] = useState<boolean>(false);
  const [isMvpModalOpen, setIsMvpModalOpen] = useState<boolean>(false);
  const [simModalDetails, setSimModalDetails] = useState<SimGameDetails[] | null>(null);
  const [showAdvanceWeekModal, setShowAdvanceWeekModal] = useState<boolean>(false);
  const [isLeagueNewsModalOpen, setIsLeagueNewsModalOpen] = useState<boolean>(false);
  const [activeLeagueNews, setActiveLeagueNews] = useState<WeeklyLeagueNews | null>(null);
  const [allSeasonNews, setAllSeasonNews] = useState<WeeklyLeagueNews[]>([]);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      tabsContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Load season from active save slot on mount
  useEffect(() => {
    const slotId = getActiveSlotId();
    const saved = loadSaveSlot(slotId);
    if (saved && saved.season) {
      setSeason(saved.season);
      setScheduleWeekView(Math.min(18, saved.season.currentWeek));
      if (saved.season.stage === 'Offseason_Draft') {
        setSelectedTab('draft');
      } else if (saved.season.stage === 'Offseason_FreeAgency') {
        setSelectedTab('freeAgency');
      } else if (saved.season.currentWeek > 18) {
        setSelectedTab('playoffs');
      }
    }
  }, []);

  const persistSeason = (updated: FranchiseSeasonState) => {
    setSeason(updated);
    saveToSlot(updated.slotId || 1, updated);
  };

  const handleLaunchGame = (
    homeTeam: NFLTeam,
    awayTeam: NFLTeam,
    weekNum: number,
    isPlayoff: boolean,
    round?: string
  ) => {
    let finalHome = { ...homeTeam };
    let finalAway = { ...awayTeam };

    if (season) {
      if (finalHome.id === season.userTeamId) {
        const starters = getStartersFromRoster(season.userRoster, finalHome);
        finalHome = {
          ...finalHome,
          starQB: starters.starQB,
          starRB: starters.starRB,
          starWR: starters.starWR,
          starDef: starters.starDef,
          roster: season.userRoster,
        };
      } else {
        const cpuRoster = season.cpuRosters && season.cpuRosters[finalHome.id] ? season.cpuRosters[finalHome.id] : generateInitialTeamRoster(finalHome);
        const starters = getStartersFromRoster(cpuRoster, finalHome);
        finalHome = {
          ...finalHome,
          starQB: starters.starQB,
          starRB: starters.starRB,
          starWR: starters.starWR,
          starDef: starters.starDef,
          roster: cpuRoster,
        };
      }

      if (finalAway.id === season.userTeamId) {
        const starters = getStartersFromRoster(season.userRoster, finalAway);
        finalAway = {
          ...finalAway,
          starQB: starters.starQB,
          starRB: starters.starRB,
          starWR: starters.starWR,
          starDef: starters.starDef,
          roster: season.userRoster,
        };
      } else {
        const cpuRoster = season.cpuRosters && season.cpuRosters[finalAway.id] ? season.cpuRosters[finalAway.id] : generateInitialTeamRoster(finalAway);
        const starters = getStartersFromRoster(cpuRoster, finalAway);
        finalAway = {
          ...finalAway,
          starQB: starters.starQB,
          starRB: starters.starRB,
          starWR: starters.starWR,
          starDef: starters.starDef,
          roster: cpuRoster,
        };
      }
    }

    onPlaySeasonGame(finalHome, finalAway, weekNum, isPlayoff, round);
  };

  // Start new season with selected user team in chosen slot
  const handleStartNewSeason = (
    teamId: string,
    slotId: 1 | 2 | 3 = targetSlotForNew,
    difficulty: 'Script' | 'Hard' = 'Script'
  ) => {
    const newSeason = createNewFranchiseSeason(teamId, slotId, 2026, difficulty);
    setSeason(newSeason);
    setScheduleWeekView(1);
    setSelectedTab('schedule');
    setIsTeamPickerOpen(false);
    setIsNewSeasonModalOpen(false);
    setIsDifficultyModalOpen(false);
    setSelectedTeamForNew(null);
  };

  // Advance to Year 2 / next season with current roster
  const handleAdvanceToNextYear = () => {
    if (!season) return;
    const nextSeason = advanceToNextFranchiseYear(season);
    persistSeason(nextSeason);
    setScheduleWeekView(1);
    setSelectedTab('schedule');
    setIsNewSeasonModalOpen(false);

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#f59e0b', '#10b981', '#3b82f6'],
    });
  };

  // Simulate all games for a specific regular season week
  const handleSimulateWeek = (weekNum: number) => {
    if (!season) return;
    const updatedSchedule = [...season.schedule];
    const updatedStandings = { ...season.standings };
    const simDetailsList: SimGameDetails[] = [];

    let updatedRoster = season.userRoster;

    updatedSchedule.forEach((game) => {
      if (game.week === weekNum && !game.isPlayed) {
        const home = getTeamById(game.homeTeamId);
        const away = getTeamById(game.awayTeamId);
        const simDetails = simulateScoreDetailed(home, away, season.seasonYear);

        game.homeScore = simDetails.actualHomeScore;
        game.awayScore = simDetails.actualAwayScore;
        game.isPlayed = true;

        simDetailsList.push(simDetails);
        updateStandingsWithGame(updatedStandings, home.id, away.id, simDetails.actualHomeScore, simDetails.actualAwayScore);

        // If this is the user's game, simulate player individual stats & game logs
        if (game.homeTeamId === season.userTeamId || game.awayTeamId === season.userTeamId) {
          const isHome = game.homeTeamId === season.userTeamId;
          const userScore = isHome ? game.homeScore : game.awayScore;
          const oppScore = isHome ? game.awayScore : game.homeScore;
          const oppTeam = isHome ? away : home;
          updatedRoster = simulateUserRosterStatsForGame(
            updatedRoster,
            userScore,
            oppScore,
            weekNum,
            season.seasonYear || 2026,
            isHome,
            oppTeam
          );
        }
      }
    });

    let nextWeek = season.currentWeek + 1;
    let playoffs = season.playoffs;
    let stage = season.stage;

    // Check if regular season completed (after week 18)
    if (nextWeek === 19 && !playoffs) {
      playoffs = generatePlayoffBracket(updatedStandings, season.userTeamId);
      stage = 'Playoffs';
      setSelectedTab('playoffs');
      setIsMvpModalOpen(true);
    }

    let leagueNewsList = season.leagueNews || [];
    if (simDetailsList.length > 0) {
      const weeklyNews = generateWeeklyLeagueNews(weekNum, season.seasonYear || 2026, simDetailsList);
      leagueNewsList = [...leagueNewsList.filter((n) => n.week !== weekNum), weeklyNews];
      setActiveLeagueNews(weeklyNews);
      setAllSeasonNews(leagueNewsList);
      setIsLeagueNewsModalOpen(true);
    }

    let advancedSeasonState: FranchiseSeasonState = {
      ...season,
      currentWeek: nextWeek,
      stage,
      schedule: updatedSchedule,
      standings: updatedStandings,
      playoffs,
      userRoster: updatedRoster,
      leagueNews: leagueNewsList,
    };

    if (nextWeek === 19) {
      advancedSeasonState = crownMvpAndAwards(advancedSeasonState);
    }

    const { updatedSeason: seasonWithBidsResolved } = resolveWeeklyFreeAgentBids(advancedSeasonState);
    const seasonWithTradesResolved = resolveWeeklyMidSeasonTrades(seasonWithBidsResolved);

    persistSeason(seasonWithTradesResolved);

    setScheduleWeekView(Math.min(18, nextWeek));
    if (simDetailsList.length > 0) {
      setSimModalDetails(simDetailsList);
    }
  };

  // Simulate remaining regular season weeks to playoffs
  const handleSimulateToPlayoffs = () => {
    if (!season) return;
    let currSchedule = [...season.schedule];
    let currStandings = { ...season.standings };
    const simDetailsList: SimGameDetails[] = [];

    for (let w = season.currentWeek; w <= 18; w++) {
      currSchedule.forEach((game) => {
        if (game.week === w && !game.isPlayed) {
          const home = getTeamById(game.homeTeamId);
          const away = getTeamById(game.awayTeamId);
          const simDetails = simulateScoreDetailed(home, away, season.seasonYear);

          game.homeScore = simDetails.actualHomeScore;
          game.awayScore = simDetails.actualAwayScore;
          game.isPlayed = true;

          simDetailsList.push(simDetails);
          updateStandingsWithGame(currStandings, home.id, away.id, simDetails.actualHomeScore, simDetails.actualAwayScore);
        }
      });
    }

    const playoffs = generatePlayoffBracket(currStandings, season.userTeamId);

    let simulatedSeasonState: FranchiseSeasonState = {
      ...season,
      currentWeek: 19,
      stage: 'Playoffs',
      schedule: currSchedule,
      standings: currStandings,
      playoffs,
    };

    simulatedSeasonState = crownMvpAndAwards(simulatedSeasonState);
    setIsMvpModalOpen(true);

    if (season.currentWeek <= 9) {
      for (let w = Math.max(4, season.currentWeek); w <= 9; w++) {
        simulatedSeasonState = resolveWeeklyMidSeasonTrades({
          ...simulatedSeasonState,
          currentWeek: w,
        });
      }
    }

    persistSeason(simulatedSeasonState);

    setScheduleWeekView(18);
    setSelectedTab('playoffs');
    if (simDetailsList.length > 0) {
      // Show user's games or last week games in modal summary
      const keySims = simDetailsList.filter(
        (s) => s.homeTeam.id === season.userTeamId || s.awayTeam.id === season.userTeamId
      );
      setSimModalDetails(keySims.length > 0 ? keySims : simDetailsList.slice(-8));
    }
  };

  // Advance playoff rounds
  const handleSimulatePlayoffRound = () => {
    if (!season || !season.playoffs) return;
    const bracket = { ...season.playoffs };
    const currRound = season.currentWeek; // 19=WildCard, 20=Divisional, 21=Conf, 22=SuperBowl
    const simDetailsList: SimGameDetails[] = [];

    if (currRound === 19) {
      // Simulate Wild Card games
      bracket.wildCard.forEach((m) => {
        if (!m.isPlayed) {
          const h = getTeamById(m.homeTeamId);
          const a = getTeamById(m.awayTeamId);
          const simDetails = simulateScoreDetailed(h, a, season.seasonYear);
          let fH = simDetails.actualHomeScore;
          let fA = simDetails.actualAwayScore;
          if (fH === fA) fH += 3;
          m.homeScore = fH;
          m.awayScore = fA;
          m.winnerId = fH > fA ? h.id : a.id;
          m.isPlayed = true;
          simDetailsList.push(simDetails);
        }
      });

      const nextBracket = advanceToDivisionalRound(bracket, season.standings, season.userTeamId);
      persistSeason({ ...season, currentWeek: 20, playoffs: nextBracket });
    } else if (currRound === 20) {
      // Simulate Divisional games
      bracket.divisional.forEach((m) => {
        if (!m.isPlayed) {
          const h = getTeamById(m.homeTeamId);
          const a = getTeamById(m.awayTeamId);
          const simDetails = simulateScoreDetailed(h, a, season.seasonYear);
          let fH = simDetails.actualHomeScore;
          let fA = simDetails.actualAwayScore;
          if (fH === fA) fH += 3;
          m.homeScore = fH;
          m.awayScore = fA;
          m.winnerId = fH > fA ? h.id : a.id;
          m.isPlayed = true;
          simDetailsList.push(simDetails);
        }
      });

      const nextBracket = advanceToConferenceRound(bracket, season.standings, season.userTeamId, season.seasonYear);
      persistSeason({ ...season, currentWeek: 21, playoffs: nextBracket });
    } else if (currRound === 21) {
      // Simulate Conference Championship games
      bracket.conference.forEach((m) => {
        if (!m.isPlayed) {
          const h = getTeamById(m.homeTeamId);
          const a = getTeamById(m.awayTeamId);
          const simDetails = simulateScoreDetailed(h, a, season.seasonYear);
          let fH = simDetails.actualHomeScore;
          let fA = simDetails.actualAwayScore;
          if (fH === fA) fH += 3;
          m.homeScore = fH;
          m.awayScore = fA;
          m.winnerId = fH > fA ? h.id : a.id;
          m.isPlayed = true;
          simDetailsList.push(simDetails);
        }
      });

      const nextBracket = advanceToSuperBowl(bracket, season.userTeamId, season.seasonYear);
      persistSeason({ ...season, currentWeek: 22, playoffs: nextBracket, stage: 'SuperBowl' });
    } else if (currRound === 22) {
      // Super Bowl
      const sb = bracket.superBowl;
      let userWonSB = false;
      let historyList = season.superBowlWinnerHistory || [];

      if (!sb.isPlayed) {
        const h = getTeamById(sb.homeTeamId);
        const a = getTeamById(sb.awayTeamId);
        const simDetails = simulateScoreDetailed(h, a, season.seasonYear);
        let fH = simDetails.actualHomeScore;
        let fA = simDetails.actualAwayScore;
        if (fH === fA) fH += 3;
        sb.homeScore = fH;
        sb.awayScore = fA;
        sb.winnerId = fH > fA ? h.id : a.id;
        sb.isPlayed = true;
        bracket.championId = sb.winnerId;
        const champ = getTeamById(sb.winnerId);
        const loser = getTeamById(sb.winnerId === h.id ? a.id : h.id);
        bracket.mvp = champ.starQB;

        userWonSB = sb.winnerId === season.userTeamId;

        historyList = [
          ...historyList,
          {
            seasonYear: season.seasonYear || 2026,
            winnerId: champ.id,
            winnerName: `${champ.city} ${champ.name}`,
            loserId: loser.id,
            loserName: `${loser.city} ${loser.name}`,
            score: `${Math.max(fH, fA)} - ${Math.min(fH, fA)}`,
            mvp: bracket.mvp,
          },
        ];

        simDetailsList.push(simDetails);

        // Super Bowl celebration confetti
        confetti({
          particleCount: userWonSB ? 250 : 150,
          spread: 90,
          origin: { y: 0.5 },
          colors: [champ.primaryColor, champ.secondaryColor || '#ffffff', '#f59e0b', '#10b981', '#6366f1'],
        });
      }

      persistSeason({
        ...season,
        currentWeek: 23,
        isSeasonComplete: true,
        playoffs: bracket,
        stage: 'Offseason_FreeAgency',
        wonSuperBowlLastSeason: userWonSB,
        superBowlWinnerHistory: historyList,
      });
      setSelectedTab('freeAgency');
    }

    if (simDetailsList.length > 0) {
      setSimModalDetails(simDetailsList);
    }
  };

  // Direct Unified Advance Week Handler (Works from Header or anywhere)
  const handleUniversalAdvanceWeek = () => {
    if (!season) return;
    if (season.currentWeek <= 18) {
      handleSimulateWeek(season.currentWeek);
    } else if (season.currentWeek <= 22) {
      handleSimulatePlayoffRound();
    } else if (season.stage === 'Offseason_FreeAgency') {
      persistSeason({ ...season, stage: 'Offseason_Draft' });
      setSelectedTab('draft');
    } else if (season.stage === 'Offseason_Draft' || season.stage === 'Offseason_Completed') {
      handleAdvanceToNextYear();
    }
  };

  // Rewind season to a specific regular season week (e.g. Week 1 to 18)
  const handleRewindToWeek = (targetWeek: number) => {
    if (!season) return;

    // Unplay all games from targetWeek onwards
    const updatedSchedule = season.schedule.map((g) => {
      if (g.week >= targetWeek && g.isPlayed) {
        return {
          ...g,
          isPlayed: false,
          homeScore: undefined,
          awayScore: undefined,
        };
      }
      return g;
    });

    const recalculatedStandings = recalculateStandingsFromSchedule(updatedSchedule);

    // Look for a snapshot in history if available to restore roster/draft class
    const pastSnapshot = (season.history || []).find(
      (h) => h.seasonYear === season.seasonYear && h.currentWeek === targetWeek
    );

    const updatedSeason: FranchiseSeasonState = {
      ...season,
      ...(pastSnapshot ? { userRoster: pastSnapshot.userRoster, cpuRosters: pastSnapshot.cpuRosters } : {}),
      currentWeek: targetWeek,
      stage: 'RegularSeason',
      playoffs: undefined,
      isSeasonComplete: false,
      schedule: updatedSchedule,
      standings: recalculatedStandings,
    };

    persistSeason(updatedSeason);
    setScheduleWeekView(Math.min(18, targetWeek));
    setSelectedTab('schedule');
    setShowRewindModal(false);
  };

  // Replay / Reset games in the current week
  const handleResetCurrentWeek = () => {
    if (!season) return;
    const updatedSchedule = season.schedule.map((g) => {
      if (g.week === season.currentWeek && g.isPlayed) {
        return {
          ...g,
          isPlayed: false,
          homeScore: undefined,
          awayScore: undefined,
        };
      }
      return g;
    });

    const recalculatedStandings = recalculateStandingsFromSchedule(updatedSchedule);
    const updatedSeason: FranchiseSeasonState = {
      ...season,
      schedule: updatedSchedule,
      standings: recalculatedStandings,
    };

    persistSeason(updatedSeason);
    setScheduleWeekView(Math.min(18, season.currentWeek));
    setShowRewindModal(false);
  };

  // Restore a snapshot checkpoint
  const handleRestoreSnapshot = (snapshot: FranchiseSeasonState) => {
    if (!season) return;
    const restored: FranchiseSeasonState = {
      ...season,
      ...snapshot,
      history: (season.history || []).filter(
        (h) =>
          h.seasonYear < snapshot.seasonYear ||
          (h.seasonYear === snapshot.seasonYear && h.currentWeek <= snapshot.currentWeek)
      ),
    };
    persistSeason(restored);
    setScheduleWeekView(Math.min(18, restored.currentWeek));
    if (restored.stage === 'Playoffs') {
      setSelectedTab('playoffs');
    } else if (restored.stage === 'Offseason_Draft') {
      setSelectedTab('draft');
    } else if (restored.stage === 'Offseason_FreeAgency') {
      setSelectedTab('freeAgency');
    } else {
      setSelectedTab('schedule');
    }
    setShowRewindModal(false);
  };

  const getWeekStatusBadge = () => {
    if (!season) return 'NEW FRANCHISE';
    if (season.currentWeek <= 18) return `WEEK ${season.currentWeek} OF 18 (YEAR ${season.seasonYear || 2026})`;
    if (season.currentWeek === 19) return 'WILD CARD WEEKEND';
    if (season.currentWeek === 20) return 'DIVISIONAL PLAYOFFS';
    if (season.currentWeek === 21) return 'CONFERENCE CHAMPIONSHIP';
    if (season.currentWeek === 22) return 'SUPER BOWL LXI';
    if (season.stage === 'Offseason_FreeAgency') return 'OFFSEASON: FREE AGENCY';
    if (season.stage === 'Offseason_Draft') return 'OFFSEASON: NFL DRAFT';
    return 'SEASON COMPLETED';
  };

  if (!season || isTeamPickerOpen) {
    // TEAM SELECTION SCREEN TO START SEASON
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 mb-2">
            <Trophy className="w-6 h-6 text-emerald-700" />
          </div>
          <h1 className="font-display font-extrabold text-2xl tracking-wider text-slate-900 uppercase">
            CHOOSE YOUR FRANCHISE
          </h1>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Select an NFL franchise to manage across multiple seasons in <strong className="text-emerald-700">Save Slot #{targetSlotForNew}</strong>.
          </p>

          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={() => setIsSaveModalOpen(true)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
              <span>Manage Saves (Slots 1-3)</span>
            </button>
            {season && (
              <button
                onClick={() => setIsTeamPickerOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-4">
          {NFL_TEAMS.map((team) => (
            <button
              key={team.id}
              id={`season-pick-${team.id.toLowerCase()}`}
              onClick={() => {
                setSelectedTeamForNew(team.id);
                setIsDifficultyModalOpen(true);
              }}
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 text-left transition flex items-center space-x-3 group shadow-xs cursor-pointer"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-base shadow-xs flex-shrink-0"
                style={{
                  backgroundColor: team.primaryColor,
                  color: team.textColor || '#ffffff',
                  border: `2px solid ${team.secondaryColor || '#ffffff'}`,
                }}
              >
                {team.abbr}
              </div>
              <div className="truncate">
                <span className="text-[9px] text-slate-400 block uppercase font-bold">
                  {team.conference} {team.division}
                </span>
                <span className="font-display font-bold text-sm text-slate-800 group-hover:text-emerald-700 truncate block">
                  {team.name}
                </span>
                <span className="text-xs text-emerald-700 font-semibold">
                  OVR: {team.ovr} • OFF: {team.off}
                </span>
              </div>
            </button>
          ))}
        </div>

        <SaveSlotManagerModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          currentSeason={season}
          onLoadSlot={(loaded) => {
            setSeason(loaded);
            setIsTeamPickerOpen(false);
          }}
          onStartNewInSlot={(sId) => {
            setTargetSlotForNew(sId);
            setIsTeamPickerOpen(true);
          }}
          onDeleteActiveSlot={() => {
            setSeason(null);
            setIsTeamPickerOpen(true);
          }}
        />

        {/* Rewind Modal */}
        {showRewindModal && season && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <RotateCcw className="w-5 h-5 text-amber-400" />
                  <h3 className="font-display font-bold text-lg text-white">Rewind Season</h3>
                </div>
                <button
                  onClick={() => setShowRewindModal(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Jump back to any previous week or replay games in current {getWeekStatusBadge()}:
              </p>

              <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                {/* Option 1: Replay / Reset Current Week if any games have been played */}
                {season.schedule.some((g) => g.week === season.currentWeek && g.isPlayed) && (
                  <button
                    id="btn-rewind-reset-current-week"
                    onClick={handleResetCurrentWeek}
                    className="w-full p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-left transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-amber-300 group-hover:text-amber-200 flex items-center space-x-1.5">
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Replay Current Week (Week {season.currentWeek})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Resets games played this week so you can replay or resimulate them.
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      Reset
                    </span>
                  </button>
                )}

                {/* Option 2: Rewind to regular season weeks 1 through currentWeek - 1 */}
                {Array.from({ length: Math.min(18, season.currentWeek - 1) }, (_, i) => season.currentWeek - 1 - i).map(
                  (wk) => {
                    const userGame = season.schedule.find(
                      (g) => g.week === wk && (g.homeTeamId === season.userTeamId || g.awayTeamId === season.userTeamId)
                    );
                    const isHome = userGame?.homeTeamId === season.userTeamId;
                    const oppId = isHome ? userGame?.awayTeamId : userGame?.homeTeamId;
                    const oppTeam = oppId ? getTeamById(oppId) : null;

                    return (
                      <button
                        key={`rewind-wk-${wk}`}
                        id={`btn-rewind-to-week-${wk}`}
                        onClick={() => handleRewindToWeek(wk)}
                        className="w-full p-3 bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 rounded-xl text-left transition flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-200 group-hover:text-white flex items-center space-x-1.5">
                            <span>Rewind to Week {wk}</span>
                            {oppTeam && (
                              <span className="text-[11px] font-normal text-slate-400">
                                (vs {oppTeam.abbr})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Resets all schedule games and standings from Week {wk} forward.
                          </div>
                        </div>
                        <span className="text-xs font-mono text-emerald-400 group-hover:underline">
                          Select
                        </span>
                      </button>
                    );
                  }
                )}

                {/* Saved Checkpoint Snapshots if any exist from history */}
                {(season.history || [])
                  .filter(
                    (s) =>
                      s.seasonYear < season.seasonYear ||
                      (s.seasonYear === season.seasonYear && s.currentWeek < season.currentWeek) ||
                      (s.seasonYear === season.seasonYear && s.stage !== season.stage)
                  )
                  .map((snapshot, idx) => (
                    <button
                      key={`snapshot-${idx}`}
                      onClick={() => handleRestoreSnapshot(snapshot)}
                      className="w-full p-3 bg-slate-800/50 hover:bg-slate-750 border border-slate-750 rounded-xl text-left transition flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-xs font-bold text-cyan-300 group-hover:text-cyan-200">
                          Saved Milestone: Year {snapshot.seasonYear || season.seasonYear} - Week {snapshot.currentWeek} ({snapshot.stage})
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Restore full roster & bracket snapshot
                        </div>
                      </div>
                      <span className="text-xs font-mono text-cyan-400 group-hover:underline">
                        Restore
                      </span>
                    </button>
                  ))}

                {season.currentWeek === 1 && !season.schedule.some((g) => g.isPlayed) && (
                  <div className="p-4 bg-slate-800/40 rounded-xl text-center space-y-1 text-slate-400 text-xs">
                    <p className="font-semibold text-slate-300">You are at Week 1 (Beginning of Season)</p>
                    <p className="text-[11px]">
                      No previous games have been played yet. As you play or advance through the weeks, you will be able to rewind back to any earlier game.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800">
                <button
                  id="btn-close-rewind-modal"
                  onClick={() => setShowRewindModal(false)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 hover:text-white transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Difficulty Selection Modal */}
        {isDifficultyModalOpen && selectedTeamForNew && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
              <div className="text-center space-y-2">
                <span className="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase">
                  Select Franchise Rules
                </span>
                <h3 className="font-display font-black text-2xl sm:text-3xl text-white">
                  CHOOSE DIFFICULTY
                </h3>
                <p className="text-sm text-slate-400">
                  Select your simulation rules for {getTeamById(selectedTeamForNew).name}. This choice cannot be changed later.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Script Mode Card */}
                <button
                  onClick={() => handleStartNewSeason(selectedTeamForNew, targetSlotForNew, 'Script')}
                  className="p-5 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 hover:border-amber-500/50 text-left transition flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      <h4 className="font-display font-bold text-lg text-white group-hover:text-amber-400">
                        Script Mode
                      </h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      The default Sandbox Franchise experience. Ideal for creating custom stories or playground testing.
                    </p>
                    <ul className="text-[11px] text-slate-400 space-y-1.5 pt-2 font-mono">
                      <li className="flex items-center space-x-1.5">
                        <span className="text-emerald-400">✓</span>
                        <span>Full scripting & force touchdowns</span>
                      </li>
                      <li className="flex items-center space-x-1.5">
                        <span className="text-emerald-400">✓</span>
                        <span>Script CPU offense & defense</span>
                      </li>
                      <li className="flex items-center space-x-1.5">
                        <span className="text-emerald-400">✓</span>
                        <span>Standard ratings-based success rates</span>
                      </li>
                    </ul>
                  </div>
                  <span className="text-xs font-bold text-cyan-400 uppercase group-hover:underline pt-2 inline-flex items-center">
                    Select Script Mode →
                  </span>
                </button>

                {/* Hard Mode Card */}
                <button
                  onClick={() => handleStartNewSeason(selectedTeamForNew, targetSlotForNew, 'Hard')}
                  className="p-5 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 hover:border-amber-500/50 text-left transition flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <h4 className="font-display font-bold text-lg text-white group-hover:text-amber-400">
                        Hard Mode
                      </h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      A realistic, unforgiving coaching simulation. Run your team without cheats or shortcuts.
                    </p>
                    <ul className="text-[11px] text-slate-400 space-y-1.5 pt-2 font-mono">
                      <li className="flex items-center space-x-1.5 text-red-400">
                        <span>✕</span>
                        <span>No forced touchdowns or shortcuts</span>
                      </li>
                      <li className="flex items-center space-x-1.5 text-red-400">
                        <span>✕</span>
                        <span>Cannot script other team's offense</span>
                      </li>
                      <li className="flex items-center space-x-1.5 text-emerald-400">
                        <span>✓</span>
                        <span>Full Defensive playbook enabled</span>
                      </li>
                      <li className="flex items-center space-x-1.5 text-amber-400">
                        <span>⚠</span>
                        <span>Increased rate of failure!</span>
                      </li>
                      <li className="flex items-center space-x-1.5 text-cyan-400">
                        <span>⚙</span>
                        <span>Hidden momentum & pre-snap motion</span>
                      </li>
                    </ul>
                  </div>
                  <span className="text-xs font-bold text-red-400 uppercase group-hover:underline pt-2 inline-flex items-center">
                    Select Hard Mode →
                  </span>
                </button>
              </div>

              <div className="flex justify-center pt-2">
                <button
                  onClick={() => {
                    setIsDifficultyModalOpen(false);
                    setSelectedTeamForNew(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Back to Team Selection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const userTeam = getTeamById(season.userTeamId);
  const userStanding = season.standings[season.userTeamId] || { wins: 0, losses: 0, ties: 0 };
  const currentWeekGames = season.schedule.filter((g) => g.week === season.currentWeek);
  const userWeekGame = currentWeekGames.find(
    (g) => g.homeTeamId === season.userTeamId || g.awayTeamId === season.userTeamId
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Franchise Hub Header Banner */}
      <div className="bg-emerald-900 border border-emerald-850 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-5 text-white">
        {/* User Team Banner */}
        <div className="flex items-center space-x-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-black text-2xl shadow-md ring-2 ring-white/10"
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
              <span className="text-[9px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                SLOT #{season.slotId || 1} • YEAR {season.seasonYear || 2026} • {season.difficulty === 'Hard' ? 'HARD' : 'SCRIPT'}
              </span>
              <span className="text-xs text-emerald-200 font-mono">
                {userTeam.conference} {userTeam.division}
              </span>
            </div>
            <h2 className="font-display font-black text-2xl sm:text-3xl text-white tracking-wide mt-0.5">
              {userTeam.city.toUpperCase()} {userTeam.name.toUpperCase()}
            </h2>
            <div className="flex items-center space-x-3 text-xs mt-1">
              <span className="text-emerald-100">
                Record:{' '}
                <strong className="text-white font-display text-sm">
                  {userStanding.wins}-{userStanding.losses}
                  {userStanding.ties > 0 ? `-${userStanding.ties}` : ''}
                </strong>
              </span>
              <span className="text-emerald-600">•</span>
              <span className="text-emerald-100">
                Streak: <strong className="text-emerald-300 font-mono">{userStanding.streak}</strong>
              </span>
              <span className="text-emerald-600">•</span>
              <span className="text-emerald-100">
                Cap Space: <strong className="text-emerald-300 font-mono">${(season.salaryCap - season.usedCap).toFixed(1)}M</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Season Stage, Unified Advance Button & Save Slots Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-center md:text-right mr-1">
            <span className="text-[9px] text-emerald-200 font-bold uppercase tracking-wider block">
              CURRENT STAGE
            </span>
            <span className="font-display font-black text-sm text-emerald-300">
              {getWeekStatusBadge()}
            </span>
          </div>

          {/* DEDICATED UNIFIED ADVANCE WEEK BUTTON */}
          <button
            id="btn-header-advance-week"
            onClick={() => {
              if (season && season.currentWeek <= 22) {
                setShowAdvanceWeekModal(true);
              } else {
                handleUniversalAdvanceWeek();
              }
            }}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-950 font-display font-black text-xs shadow-sm transition transform active:scale-95 cursor-pointer"
            title="Advance current week or playoff round"
          >
            <FastForward className="w-4 h-4 fill-current text-emerald-850" />
            <span>
              {season.currentWeek <= 18
                ? `ADVANCE TO WK ${season.currentWeek + 1 <= 18 ? season.currentWeek + 1 : 'PLAYOFFS'}`
                : season.currentWeek <= 22
                ? 'ADVANCE PLAYOFF ROUND'
                : season.stage === 'Offseason_FreeAgency'
                ? 'PROCEED TO NFL DRAFT'
                : `START YEAR ${(season.seasonYear || 2026) + 1}`}
            </span>
          </button>

          {/* SAVE FILES BUTTON */}
          <button
            id="btn-manage-saves"
            onClick={() => setIsSaveModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-750 text-white border border-emerald-700 text-xs font-bold transition cursor-pointer"
            title="Manage 3 save files"
          >
            <HardDrive className="w-4 h-4 text-emerald-300" />
            <span className="hidden sm:inline">Save Slot #{season.slotId || 1}</span>
            <span className="sm:hidden">Saves</span>
          </button>

          {/* FIXED NEW SEASON BUTTON */}
          <button
            id="btn-new-season"
            onClick={() => setIsNewSeasonModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-750 text-xs font-bold text-emerald-100 hover:text-white border border-emerald-700 transition cursor-pointer"
            title="Start new season or change franchise"
          >
            <RotateCcw className="w-4 h-4 text-emerald-300" />
            <span>New Season</span>
          </button>
          
          {/* MVP RACE BUTTON */}
          <button
            id="btn-open-mvp-modal"
            onClick={() => setIsMvpModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-xs shadow-md transition cursor-pointer"
            title="View MVP race leaderboard & NFL Honors awards"
          >
            <Crown className="w-4 h-4 fill-current text-slate-950" />
            <span>MVP RACE</span>
          </button>

          {/* REWIND BUTTON */}
          <button
            id="btn-open-rewind"
            onClick={() => setShowRewindModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 font-bold text-xs shadow-md transition cursor-pointer"
            title="Rewind season to any previous week or replay games"
          >
            <RotateCcw className="w-4 h-4" />
            <span>REWIND</span>
          </button>
        </div>
      </div>

      {/* TABS (Schedule, Standings, Playoff Bracket, NFL Draft, Free Agency, Roster) */}
      <div className="w-full border-b border-slate-200 pb-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Scrollable tab bar with side-to-side navigation controls */}
          <div className="flex items-center w-full lg:w-auto min-w-0">
            {/* Left scroll arrow button */}
            <button
              type="button"
              id="btn-season-menu-scroll-left"
              onClick={() => scrollTabs('left')}
              className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 transition mr-1.5 shrink-0 border border-slate-200 shadow-xs cursor-pointer"
              title="Scroll menu left"
              aria-label="Scroll menu left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Horizontal scrollable tabs container */}
            <div
              ref={tabsContainerRef}
              className="flex items-center space-x-2 overflow-x-auto py-1 scroll-smooth touch-pan-x scrollbar-thin scrollbar-thumb-slate-300 w-full"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <button
                id="tab-season-schedule"
                onClick={() => setSelectedTab('schedule')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition cursor-pointer ${
                  selectedTab === 'schedule'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>SCHEDULE & PLAY</span>
              </button>

              <button
                id="tab-season-standings"
                onClick={() => setSelectedTab('standings')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition cursor-pointer ${
                  selectedTab === 'standings'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>STANDINGS</span>
              </button>

              <button
                id="tab-season-playoffs"
                onClick={() => setSelectedTab('playoffs')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition cursor-pointer ${
                  selectedTab === 'playoffs'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>PLAYOFFS</span>
              </button>

              {/* DRAFT BUTTON: Fully working and enabled! */}
              <button
                id="tab-season-draft"
                onClick={() => setSelectedTab('draft')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition cursor-pointer ${
                  selectedTab === 'draft'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Award className="w-4 h-4 text-amber-500" />
                <span>NFL DRAFT</span>
                {season.stage === 'Offseason_Draft' ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold animate-pulse">
                    LIVE DRAFT
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono font-bold">
                    SCOUTING OPEN
                  </span>
                )}
              </button>

              <button
                id="tab-season-free-agency"
                onClick={() => setSelectedTab('freeAgency')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition cursor-pointer ${
                  selectedTab === 'freeAgency'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>FREE AGENCY</span>
              </button>

              <button
                id="tab-season-trade"
                onClick={() => setSelectedTab('trade')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition cursor-pointer ${
                  selectedTab === 'trade'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>TRADE CENTER</span>
                {season.currentWeek >= 4 && season.currentWeek <= 9 && season.stage === 'RegularSeason' && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] leading-none">
                    {(season.incomingTradeOffers || []).filter((o) => o.status === 'pending').length > 0
                      ? `${(season.incomingTradeOffers || []).filter((o) => o.status === 'pending').length} OFFERS`
                      : 'DEADLINE W9'}
                  </span>
                )}
              </button>

              <button
                id="tab-season-roster"
                onClick={() => setSelectedTab('roster')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition cursor-pointer ${
                  selectedTab === 'roster'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>ROSTER ({season.userRoster?.length || 16})</span>
              </button>

              <button
                id="tab-season-stats"
                onClick={() => setSelectedTab('stats')}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition cursor-pointer ${
                  selectedTab === 'stats'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <BarChart2 className="w-4 h-4 text-emerald-600" />
                <span>STATS & HISTORY</span>
              </button>

              <button
                id="btn-season-league-news"
                onClick={() => {
                  const newsList = season.leagueNews || [];
                  if (newsList.length > 0) {
                    setActiveLeagueNews(newsList[newsList.length - 1]);
                    setAllSeasonNews(newsList);
                    setIsLeagueNewsModalOpen(true);
                  } else {
                    const dummyNews = generateWeeklyLeagueNews(season.currentWeek, season.seasonYear || 2026, []);
                    setActiveLeagueNews(dummyNews);
                    setAllSeasonNews([dummyNews]);
                    setIsLeagueNewsModalOpen(true);
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm cursor-pointer"
              >
                <Newspaper className="w-4 h-4" />
                <span>LEAGUE NEWS</span>
              </button>
            </div>

            {/* Right scroll arrow button */}
            <button
              type="button"
              id="btn-season-menu-scroll-right"
              onClick={() => scrollTabs('right')}
              className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 transition ml-1.5 shrink-0 border border-slate-200 shadow-xs cursor-pointer"
              title="Scroll menu right"
              aria-label="Scroll menu right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Schedule Sub-controls */}
          {selectedTab === 'schedule' && season.currentWeek <= 18 && (
            <div className="flex items-center space-x-2 shrink-0">
              <button
                id="btn-sim-to-playoffs"
                onClick={handleSimulateToPlayoffs}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-bold text-emerald-700 border border-slate-200 transition shadow-xs cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sim Regular Season</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- TAB 1: SCHEDULE & WEEKLY PLAY --- */}
      {selectedTab === 'schedule' && (
        <div className="space-y-4">
          {/* Week Selector Bar */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-2 scrollbar-none">
            {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
              <button
                key={w}
                id={`btn-schedule-week-${w}`}
                onClick={() => setScheduleWeekView(w)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-display whitespace-nowrap transition ${
                  scheduleWeekView === w
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : season.currentWeek === w
                    ? 'bg-slate-800 text-amber-400 border border-amber-500/50'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                WK {w}
              </button>
            ))}
          </div>

          {/* User's Game Spotlight */}
          {userWeekGame && (
            <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border-2 border-amber-500/60 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <span className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider">
                  WEEK {scheduleWeekView} MATCHUP SPOTLIGHT
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {userWeekGame.isPlayed ? 'Completed' : 'Upcoming Game'}
                </span>
              </div>

              {(() => {
                const home = getTeamById(userWeekGame.homeTeamId);
                const away = getTeamById(userWeekGame.awayTeamId);

                return (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Away Team */}
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-sm shadow"
                        style={{
                          backgroundColor: away.primaryColor,
                          color: away.textColor || '#ffffff',
                        }}
                      >
                        {away.abbr}
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block">{away.city}</span>
                        <span className="font-display font-black text-lg text-white">{away.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {season.standings[away.id]?.wins || 0}-{season.standings[away.id]?.losses || 0}
                        </span>
                      </div>
                    </div>

                    {/* Middle Score / Action */}
                    <div className="text-center">
                      {userWeekGame.isPlayed ? (
                        <div>
                          <span className="font-display font-black text-3xl text-amber-400">
                            {userWeekGame.awayScore} - {userWeekGame.homeScore}
                          </span>
                          <span className="text-[11px] text-slate-400 block font-mono mt-0.5">FINAL</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <span className="font-display font-bold text-slate-500 text-sm">VS</span>
                          <div className="flex items-center justify-center">
                            <button
                              id="btn-play-user-game"
                              onClick={() =>
                                handleLaunchGame(home, away, scheduleWeekView, false)
                              }
                              className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-display font-black px-6 py-2.5 rounded-xl text-sm shadow-lg shadow-amber-500/20 transition hover:scale-105 active:scale-95 cursor-pointer"
                            >
                              <Play className="w-4 h-4 fill-current" />
                              <span>PLAY GAME</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Home Team */}
                    <div className="flex items-center space-x-3 text-right">
                      <div>
                        <span className="text-xs text-slate-400 block">{home.city}</span>
                        <span className="font-display font-black text-lg text-white">{home.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {season.standings[home.id]?.wins || 0}-{season.standings[home.id]?.losses || 0}
                        </span>
                      </div>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-sm shadow"
                        style={{
                          backgroundColor: home.primaryColor,
                          color: home.textColor || '#ffffff',
                        }}
                      >
                        {home.abbr}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Full Week Matchups Grid */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <h3 className="font-display font-bold text-sm text-slate-300 uppercase tracking-wider mb-3">
              Week {scheduleWeekView} League Matchups
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {season.schedule
                .filter((g) => g.week === scheduleWeekView)
                .map((game) => {
                  const home = getTeamById(game.homeTeamId);
                  const away = getTeamById(game.awayTeamId);
                  const isUser =
                    game.homeTeamId === season.userTeamId || game.awayTeamId === season.userTeamId;

                  return (
                    <div
                      key={game.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition ${
                        isUser
                          ? 'bg-amber-950/30 border-amber-500/60 shadow-md'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      {/* Away Team */}
                      <div className="flex items-center space-x-2.5 w-5/12">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-[10px] shadow"
                          style={{
                            backgroundColor: away.primaryColor,
                            color: away.textColor || '#ffffff',
                          }}
                        >
                          {away.abbr}
                        </div>
                        <div className="truncate">
                          <span className="font-display font-bold text-xs text-white truncate block">
                            {away.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {season.standings[away.id]?.wins || 0}-{season.standings[away.id]?.losses || 0}
                          </span>
                        </div>
                      </div>

                      {/* Score or Status */}
                      <div className="text-center w-2/12">
                        {game.isPlayed ? (
                          <div className="font-display font-black text-sm text-white">
                            <span
                              className={
                                (game.awayScore || 0) > (game.homeScore || 0)
                                  ? 'text-amber-400 font-bold'
                                  : 'text-slate-400'
                              }
                            >
                              {game.awayScore}
                            </span>
                            <span className="text-slate-600 mx-1">-</span>
                            <span
                              className={
                                (game.homeScore || 0) > (game.awayScore || 0)
                                  ? 'text-amber-400 font-bold'
                                  : 'text-slate-400'
                              }
                            >
                              {game.homeScore}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-500 font-mono">VS</span>
                        )}
                      </div>

                      {/* Home Team */}
                      <div className="flex items-center justify-end space-x-2.5 w-5/12 text-right">
                        <div className="truncate">
                          <span className="font-display font-bold text-xs text-white truncate block">
                            {home.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {season.standings[home.id]?.wins || 0}-{season.standings[home.id]?.losses || 0}
                          </span>
                        </div>
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-[10px] shadow"
                          style={{
                            backgroundColor: home.primaryColor,
                            color: home.textColor || '#ffffff',
                          }}
                        >
                          {home.abbr}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: STANDINGS --- */}
      {selectedTab === 'standings' && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setStandingsConfView('AFC')}
              className={`px-4 py-1.5 rounded-lg font-display font-bold text-xs transition ${
                standingsConfView === 'AFC'
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              AMERICAN FOOTBALL CONFERENCE (AFC)
            </button>
            <button
              onClick={() => setStandingsConfView('NFC')}
              className={`px-4 py-1.5 rounded-lg font-display font-bold text-xs transition ${
                standingsConfView === 'NFC'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              NATIONAL FOOTBALL CONFERENCE (NFC)
            </button>
          </div>

          {/* Division Standings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['East', 'North', 'South', 'West'] as Division[]).map((division) => {
              const divTeams = NFL_TEAMS.filter(
                (t) => t.conference === standingsConfView && t.division === division
              ).sort((a, b) => {
                const sA = season.standings[a.id] || { pct: 0, diff: 0 };
                const sB = season.standings[b.id] || { pct: 0, diff: 0 };
                if (sB.pct !== sA.pct) return sB.pct - sA.pct;
                return sB.diff - sA.diff;
              });

              return (
                <div
                  key={division}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg"
                >
                  <h4 className="font-display font-bold text-xs text-amber-400 uppercase tracking-wider mb-2">
                    {standingsConfView} {division}
                  </h4>

                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-500 font-mono border-b border-slate-800 pb-1">
                        <th className="py-1">TEAM</th>
                        <th className="py-1 text-center">W</th>
                        <th className="py-1 text-center">L</th>
                        <th className="py-1 text-center">PCT</th>
                        <th className="py-1 text-center">DIFF</th>
                        <th className="py-1 text-center">STRK</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {divTeams.map((team, idx) => {
                        const st = season.standings[team.id] || {
                          wins: 0,
                          losses: 0,
                          ties: 0,
                          pct: 0,
                          diff: 0,
                          streak: '-',
                        };
                        const isUser = team.id === season.userTeamId;

                        return (
                          <tr
                            key={team.id}
                            className={isUser ? 'bg-amber-500/10 font-bold' : ''}
                          >
                            <td className="py-2 flex items-center space-x-2">
                              <span className="text-[10px] text-slate-500 font-mono w-3">
                                {idx + 1}
                              </span>
                              <div
                                className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-display font-bold"
                                style={{
                                  backgroundColor: team.primaryColor,
                                  color: team.textColor || '#ffffff',
                                }}
                              >
                                {team.abbr}
                              </div>
                              <span className="text-white truncate">{team.name}</span>
                            </td>
                            <td className="py-2 text-center text-white font-mono">{st.wins}</td>
                            <td className="py-2 text-center text-slate-400 font-mono">{st.losses}</td>
                            <td className="py-2 text-center font-mono">
                              {(st.pct || 0).toFixed(3).replace(/^0+/, '')}
                            </td>
                            <td
                              className={`py-2 text-center font-mono ${
                                st.diff > 0
                                  ? 'text-emerald-400'
                                  : st.diff < 0
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {st.diff > 0 ? `+${st.diff}` : st.diff}
                            </td>
                            <td className="py-2 text-center font-mono text-amber-400 text-[11px]">
                              {st.streak}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- TAB 3: PLAYOFF BRACKET --- */}
      {selectedTab === 'playoffs' && (
        <PlayoffBracketView
          season={season}
          onPlayGame={handleLaunchGame}
          onSimulatePlayoffRound={handleSimulatePlayoffRound}
          onSimulateToPlayoffs={handleSimulateToPlayoffs}
        />
      )}

      {/* --- TAB 4: NFL DRAFT --- */}
      {selectedTab === 'draft' && (
        <DraftSystemView
          season={season}
          userTeam={userTeam}
          onUpdateSeason={persistSeason}
        />
      )}

      {/* --- TAB 5: FREE AGENCY --- */}
      {selectedTab === 'freeAgency' && (
        <FreeAgencyView
          season={season}
          userTeam={userTeam}
          onUpdateSeason={persistSeason}
        />
      )}

      {/* --- TAB 6: TRADE CENTER --- */}
      {selectedTab === 'trade' && (
        <TradeCenterView
          season={season}
          userTeam={userTeam}
          onUpdateSeason={persistSeason}
        />
      )}

      {/* --- TAB 7: ROSTER & DEPTH CHART --- */}
      {selectedTab === 'roster' && (
        <RosterDepthChartView
          season={season}
          userTeam={userTeam}
          onUpdateSeason={persistSeason}
        />
      )}

      {/* --- TAB 8: PLAYER STATS & FRANCHISE HISTORY --- */}
      {selectedTab === 'stats' && (
        <PlayerStatsHistoryView
          season={season}
        />
      )}

      {/* SAVE SLOT MANAGER MODAL (3 SLOTS) */}
      <SaveSlotManagerModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        currentSeason={season}
        onLoadSlot={(loaded) => {
          setSeason(loaded);
          setScheduleWeekView(Math.min(18, loaded.currentWeek));
        }}
        onStartNewInSlot={(sId) => {
          setTargetSlotForNew(sId);
          setIsTeamPickerOpen(true);
        }}
        onDeleteActiveSlot={() => {
          setSeason(null);
          setIsTeamPickerOpen(true);
        }}
      />

      {/* NEW SEASON ACTION MODAL */}
      {isNewSeasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-xl text-white">
                  FRANCHISE <span className="text-amber-500">SEASON OPTIONS</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Choose how you would like to proceed with your franchise.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Option 1: Advance to Next Year */}
              <button
                onClick={handleAdvanceToNextYear}
                className="w-full p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500 text-left transition flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-display font-black text-sm text-white group-hover:text-amber-400">
                      ADVANCE TO YEAR {(season.seasonYear || 2026) + 1}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Keep your drafted rookies and free agent signings, generate a fresh 18-week schedule, and play Year {(season.seasonYear || 2026) + 1}.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400" />
              </button>

              {/* Option 2: Reset & Pick New Team */}
              <button
                onClick={() => {
                  setIsNewSeasonModalOpen(false);
                  setIsTeamPickerOpen(true);
                }}
                className="w-full p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500 text-left transition flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <RotateCcw className="w-4 h-4 text-slate-400" />
                    <span className="font-display font-black text-sm text-white group-hover:text-amber-400">
                      START FRESH FRANCHISE (PICK NEW TEAM)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Choose from any of the 32 NFL teams and start a clean franchise from Week 1.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400" />
              </button>

              {/* Option 3: Save Slots */}
              <button
                onClick={() => {
                  setIsNewSeasonModalOpen(false);
                  setIsSaveModalOpen(true);
                }}
                className="w-full p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500 text-left transition flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-amber-400" />
                    <span className="font-display font-black text-sm text-white group-hover:text-amber-400">
                      MANAGE SAVE SLOTS (1, 2, 3)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Load, duplicate, or switch between 3 independent franchise save files.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400" />
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsNewSeasonModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATION BREAKDOWN & PROJECTION MODAL */}
      {simModalDetails && simModalDetails.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-white">
                    SIMULATION BREAKDOWN & <span className="text-amber-400">WIN ODDS PROJECTION</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Base odds and score projections derived from team overalls and game analytics.
                  </p>
                </div>
              </div>
              <button
                id="btn-close-sim-breakdown"
                onClick={() => setSimModalDetails(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Games List */}
            <div className="p-5 overflow-y-auto space-y-4 divide-y divide-slate-800/60">
              {simModalDetails.map((sim, idx) => {
                return (
                  <div key={idx} className={`${idx > 0 ? 'pt-4' : ''} space-y-3`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-amber-400 font-mono uppercase tracking-wider">
                          {sim.homeTeam.name} vs {sim.awayTeam.name}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-300">
                        {sim.homeTeam.id} ({sim.effectiveHomeOvr.toFixed(1)} OVR) @ {sim.awayTeam.id} ({sim.effectiveAwayOvr.toFixed(1)} OVR)
                      </span>
                    </div>

                    {/* Odds Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase block font-sans font-semibold">
                          Base Win Odds
                        </span>
                        <div className="text-white font-bold mt-0.5">
                          {sim.homeTeam.id}: {sim.homeBaseWinChance}% | {sim.awayTeam.id}: {sim.awayBaseWinChance}%
                        </div>
                      </div>

                      <div className="bg-slate-900/90 p-2.5 rounded-xl border border-cyan-500/30">
                        <span className="text-[10px] text-cyan-400 uppercase block font-sans font-semibold">
                          Win Odds Projection
                        </span>
                        <div className="text-cyan-300 font-bold mt-0.5">
                          {sim.homeTeam.id}: {sim.homeFinalWinChance}% | {sim.awayTeam.id}: {sim.awayFinalWinChance}%
                        </div>
                      </div>
                    </div>

                    {/* Score Comparison */}
                    <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block font-sans font-semibold">
                          Projected Score
                        </span>
                        <span className="text-slate-300 font-bold">
                          {sim.homeTeam.id} {sim.projectedHomeScore} - {sim.awayTeam.id} {sim.projectedAwayScore}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-emerald-400 uppercase block font-sans font-semibold">
                          Simulated Result
                        </span>
                        <span className="text-emerald-300 font-black text-sm">
                          {sim.homeTeam.id} {sim.actualHomeScore} - {sim.awayTeam.id} {sim.actualAwayScore}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
              <button
                id="btn-close-sim-breakdown-footer"
                onClick={() => setSimModalDetails(null)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20"
              >
                Continue Franchise
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advance Week Confirmation / Review Modal */}
      {showAdvanceWeekModal && season && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="text-center space-y-2">
              <span className="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase">
                {season.currentWeek <= 18 ? `Week ${season.currentWeek} Review & Advance` : `Playoff Round Review`}
              </span>
              <h3 className="font-display font-black text-2xl text-white">
                {season.currentWeek <= 18 ? `ADVANCE TO WEEK ${season.currentWeek + 1 <= 18 ? season.currentWeek + 1 : 'PLAYOFFS'}` : 'ADVANCE PLAYOFF ROUND'}
              </h3>
              <p className="text-xs text-slate-400">
                Review your matchup before simulating this week. You can choose to play your game manually or continue to simulate the week.
              </p>
            </div>

            {/* User Game Card Preview */}
            {userWeekGame ? (
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800/60 pb-2">
                  <span>YOUR SCHEDULED GAME</span>
                  <span className={userWeekGame.isPlayed ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {userWeekGame.isPlayed ? '✓ ALREADY PLAYED' : '⏳ UNPLAYED'}
                  </span>
                </div>
                {(() => {
                  const hTeam = getTeamById(userWeekGame.homeTeamId);
                  const aTeam = getTeamById(userWeekGame.awayTeamId);
                  return (
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-xs shadow"
                          style={{
                            backgroundColor: aTeam.primaryColor,
                            color: aTeam.textColor || '#ffffff',
                            border: `1.5px solid ${aTeam.secondaryColor || '#ffffff'}`,
                          }}
                        >
                          {aTeam.abbr}
                        </div>
                        <span className="font-display text-sm text-white font-bold">@ {hTeam.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono text-slate-300 block">
                          {hTeam.city} vs {aTeam.city}
                        </span>
                      </div>
                    </div>
                  );
                })()}
                {!userWeekGame.isPlayed && (
                  <p className="text-[11px] text-amber-300/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                    ⚠️ Your game has not been played yet. Clicking <strong>Continue & Simulate</strong> will automatically simulate this game and all other games for Week {season.currentWeek}. To play it manually, click Cancel and select "Play User Game".
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-950/60 rounded-2xl text-center text-xs text-slate-400">
                No scheduled game for your team this week (Bye Week).
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setShowAdvanceWeekModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-display font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Cancel / Play Game
              </button>
              <button
                onClick={() => {
                  setShowAdvanceWeekModal(false);
                  handleUniversalAdvanceWeek();
                }}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-black text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                Continue & Simulate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MVP Race & NFL Honors Awards Modal */}
      <MvpAwardsModal
        isOpen={isMvpModalOpen}
        onClose={() => setIsMvpModalOpen(false)}
        season={season}
      />

      {/* Weekly League News Summary Modal */}
      {isLeagueNewsModalOpen && (
        <LeagueNewsModal
          news={activeLeagueNews}
          allSeasonNews={allSeasonNews}
          onClose={() => setIsLeagueNewsModalOpen(false)}
          onSelectWeek={(item) => setActiveLeagueNews(item)}
        />
      )}
    </div>
  );
};
