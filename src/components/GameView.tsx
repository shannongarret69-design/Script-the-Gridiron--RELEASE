import React, { useState, useEffect, useMemo } from 'react';
import { ActiveGame, Play, PlayResult, ScriptedOutcomeType, NFLTeam, QBThrowingVariant, RunStyleVariant } from '../types/game';
import { InjuryEvent } from '../types/injuries';
import { DEFAULT_PLAYS } from '../data/defaultPlays';
import { GameScoreboard } from './GameScoreboard';
import { GameStatLeadersModal } from './GameStatLeadersModal';
import { calculatePlayerStats, PlayerStats } from '../utils/statUtils';
import { FootballField } from './FootballField';
import { PlayOutcomeScripter } from './PlayOutcomeScripter';
import { CustomAnnouncementBar } from './CustomAnnouncementBar';
import { InjuryAlertBanner } from './InjuryAlertBanner';
import { MiniFieldScoreboardBar } from './MiniFieldScoreboardBar';
import { FieldCamViewer } from './FieldCamViewer';
import { executePlay, selectAIOffensivePlay, ScriptExecutionParams, getTeamFailChancePercent, syncCommentaryWithYards } from '../utils/playEngine';
import { simulateScore } from '../utils/seasonEngine';
import { getActiveSlotId, loadSaveSlot, saveToSlot } from '../utils/saveManager';
import { awardClashVictory } from '../utils/clashManager';
import { ClashCard, ClashUserData } from '../types/clash';
import { playSound } from '../utils/audio';
import { useAuth } from '../hooks/useAuth';
import { getTeamReceiversAndTEs, getPlayPrimaryTarget } from '../utils/receiverTargeting';
import { groupPlaysForDropdown } from '../utils/playGrouping';
import { ArrowLeft, BarChart2, CheckCircle2, ChevronRight, ChevronLeft, ChevronDown, ListFilter, RotateCcw, Volume2, Shield, AlertTriangle, Users, Target, Radio, Flame, Tv, Zap, Activity } from 'lucide-react';
import confetti from 'canvas-confetti';
import { InGameDepthChartModal } from './InGameDepthChartModal';
import { getPlayerSafeHits, calculateInjuryRisk } from '../utils/playerFatigue';
import {
  listenToLobby,
  submitOnlinePlayCall,
  updateOnlineMatchSync,
  getOnlineUserId,
  publishLeaderboardStats,
  handlePlayerLeaveOnlineMatch,
  SubmittedPlayCall,
  OnlineRoom,
} from '../utils/clashOnlineManager';

interface GameViewProps {
  game: ActiveGame;
  setGame: React.Dispatch<React.SetStateAction<ActiveGame | null>>;
  onExitGame: () => void;
  onFinishSeasonGame?: (finishedGame: ActiveGame) => void;
}

export const GameView: React.FC<GameViewProps> = ({
  game,
  setGame,
  onExitGame,
  onFinishSeasonGame,
}) => {
  const { userData: authUserData, updateUserData } = useAuth();
  
  const userData = useMemo(() => {
    return authUserData || {
      teamName: 'Apex Dynasty',
      gridIrons: 0,
      roster: [],
      startingLineup: {},
      auctionListings: [],
      transactions: [],
      aiBattlesWon: 0,
      aiBattlesPlayed: 0,
      defeatedBossIds: [],
      currentBossTier: 1
    } as ClashUserData;
  }, [authUserData]);

  const [customPlays, setCustomPlays] = useState<Play[]>([]);
  const [selectedOffensePlay, setSelectedOffensePlay] = useState<Play>(DEFAULT_PLAYS[0]);
  const [selectedDefensePlay, setSelectedDefensePlay] = useState<Play>(
    DEFAULT_PLAYS.find((p) => p.id === 'def-cover-3-sky') || DEFAULT_PLAYS[13]
  );

  const allOffensivePlays = useMemo(() => [
    ...customPlays.filter((p) => p.type === 'Offense'),
    ...DEFAULT_PLAYS.filter((p) => p.type === 'Offense' || p.type === 'SpecialTeams'),
  ], [customPlays]);

  const allDefensivePlays = useMemo(() => [
    ...customPlays.filter((p) => p.type === 'Defense'),
    ...DEFAULT_PLAYS.filter((p) => p.type === 'Defense'),
  ], [customPlays]);

  const [playViewMode, setPlayViewMode] = useState<'dropdown' | 'cards'>('dropdown');

  // Injury & Announcement states
  const [injuredPlayers, setInjuredPlayers] = useState<InjuryEvent[]>([]);
  const [latestInjury, setLatestInjury] = useState<InjuryEvent | null>(null);

  const handleInjuryTriggered = (injury: InjuryEvent) => {
    setInjuredPlayers((prev) => [injury, ...prev]);
    setLatestInjury(injury);
  };

  // Animation states
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [animProgress, setAnimProgress] = useState<number>(0);
  const [lastResult, setLastResult] = useState<PlayResult | undefined>(game.lastPlayResult);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showDepthChartModal, setShowDepthChartModal] = useState<boolean>(false);
  const [isFieldDrawMode, setIsFieldDrawMode] = useState<boolean>(false);

  const handleSyncSeasonRoster = (teamId: string, updatedRoster: any[]) => {
    const slotId = getActiveSlotId();
    const saveSlot = loadSaveSlot(slotId);
    if (saveSlot && saveSlot.season && saveSlot.season.userTeamId === teamId) {
      saveToSlot(slotId, {
        ...saveSlot.season,
        userRoster: updatedRoster,
      });
    }
  };

  // Game Clock & Play Clock states + Pause control
  const [playClock, setPlayClock] = useState<number>(game.playClockSeconds ?? 40);
  const [isClockPaused, setIsClockPaused] = useState<boolean>(game.isClockPaused ?? false);
  const [delayOfGameNotice, setDelayOfGameNotice] = useState<boolean>(false);
  const [snapNotice, setSnapNotice] = useState<string | null>(null);

  // QB Throwing Variant & Run Style Variant & Target Receiver state (for all modes / Hard Mode)
  const [selectedThrowingVariant, setSelectedThrowingVariant] = useState<QBThrowingVariant | undefined>(undefined);
  const [selectedRunVariant, setSelectedRunVariant] = useState<RunStyleVariant | undefined>(undefined);
  const [selectedTargetPlayer, setSelectedTargetPlayer] = useState<string>('FIRST_READ');

  // Mini Field Bar & Hard Mode 5-Second Popup States
  const fieldWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [isFieldVisible, setIsFieldVisible] = useState<boolean>(true);
  const [isFieldCamOpen, setIsFieldCamOpen] = useState<boolean>(false);
  const [fieldCamMode, setFieldCamMode] = useState<'pip' | 'expanded'>('pip');
  const [hardModePopup, setHardModePopup] = useState<{
    result: PlayResult;
    timestamp: number;
  } | null>(null);

  // 5-Second auto-dismiss for hard mode popup message
  useEffect(() => {
    if (!hardModePopup) return;
    const timer = setTimeout(() => {
      setHardModePopup(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [hardModePopup]);

  // Use refs for currently selected plays to avoid re-triggering the online sync effect
  const selectedOffensePlayRef = React.useRef<Play>(selectedOffensePlay);
  const selectedDefensePlayRef = React.useRef<Play>(selectedDefensePlay);
  const allOffensivePlaysRef = React.useRef<Play[]>(allOffensivePlays);
  const allDefensivePlaysRef = React.useRef<Play[]>(allDefensivePlays);

  useEffect(() => {
    selectedOffensePlayRef.current = selectedOffensePlay;
  }, [selectedOffensePlay]);

  useEffect(() => {
    if (!game) return;
    if ((game.quarter === 3 && game.quarterTimeSeconds === (game.quarterLengthMinutes * 60)) || game.isGameOver) {
      if (isStatModalOpen) return;
      const stats = calculatePlayerStats(game.playLog, game.homeTeam.roster || [], game.awayTeam.roster || [], game.homeTeam.id, game.awayTeam.id);
      setStatLeaders(stats);
      setIsStatModalOpen(true);
    }
  }, [game?.quarter, game?.quarterTimeSeconds, game?.isGameOver]);

  useEffect(() => {
    selectedDefensePlayRef.current = selectedDefensePlay;
  }, [selectedDefensePlay]);

  useEffect(() => {
    allOffensivePlaysRef.current = allOffensivePlays;
  }, [allOffensivePlays]);

  useEffect(() => {
    allDefensivePlaysRef.current = allDefensivePlays;
  }, [allDefensivePlays]);

  // Handle Clash Mode Victory Rewards (75 OVR Star Player Card + 1 Grid Iron)
  const [clashReward, setClashReward] = useState<{
    claimed: boolean;
    card?: ClashCard;
  }>({ claimed: false });

  const [isStatModalOpen, setIsStatModalOpen] = useState(false);
  const [statLeaders, setStatLeaders] = useState<{ home: PlayerStats[], away: PlayerStats[] } | null>(null);

  const hasHandledGameEndRef = React.useRef<boolean>(false);

  useEffect(() => {
    if (game.isGameOver && game.clashGameContext && !hasHandledGameEndRef.current) {
      hasHandledGameEndRef.current = true;
      const isVictory = game.homeScore > game.awayScore;
      
      // Update Global Leaderboard (Wins/Losses)
      publishLeaderboardStats(userData, isVictory);

      // Ensure other team's stats do NOT count as your stats for daily quests!
      // In Clash mode, user is always homeTeam (possession === 'home' or offenseTeamId === game.homeTeam.id)
      const userPlays = game.playLog.filter((l) => l.possession === 'home' || l.offenseTeamId === game.homeTeam.id);

      const userPassingYards = userPlays
        .filter((l) => l.result.playCategory === 'Pass' || l.result.playCategory === 'PlayAction' || l.result.playCategory === 'Screen')
        .reduce((acc, l) => acc + Math.max(0, l.result.yardsGained), 0);

      const userRushingYards = userPlays
        .filter((l) => l.result.playCategory === 'Run')
        .reduce((acc, l) => acc + Math.max(0, l.result.yardsGained), 0);

      const userTouchdowns = userPlays.filter((l) => l.result.isTouchdown && l.result.outcomeType !== 'PickSix').length +
        game.playLog.filter((l) => l.possession === 'away' && l.result.outcomeType === 'PickSix').length;

      const userMissionsStats = {
        passing_yards: userPassingYards,
        rushing_yards: userRushingYards,
        touchdowns: userTouchdowns,
        points: game.homeScore,
        wins: isVictory ? 1 : 0,
      };

      const applyMissionsProgress = (targetData: ClashUserData): ClashUserData => {
        if (!targetData.missions || targetData.missions.length === 0) return targetData;

        let extraGI = 0;
        const newTx = [...(targetData.transactions || [])];

        const updatedMissions = targetData.missions.map((m) => {
          if (m.completed) return m;
          const progress = (userMissionsStats[m.type as keyof typeof userMissionsStats] || 0);
          const newCurrent = m.current + progress;
          const isCompleted = newCurrent >= m.target;

          if (isCompleted && !m.completed) {
            extraGI += m.reward;
            newTx.unshift({
              id: `tx-mission-${m.id}-${Date.now()}`,
              type: 'mission',
              description: `Completed Mission: ${m.title}!`,
              amount: m.reward,
              timestamp: Date.now(),
            });
          }

          return {
            ...m,
            current: newCurrent,
            completed: isCompleted,
          };
        });

        return {
          ...targetData,
          gridIrons: (targetData.gridIrons || 0) + extraGI,
          missions: updatedMissions,
          transactions: newTx,
        };
      };

      if (isVictory) {
        const teamIdentifier = game.clashGameContext.aiTeamId || game.awayTeam.id || game.awayTeam.name;
        const result = awardClashVictory(userData, teamIdentifier, game.clashGameContext.starPlayer);
        
        const finalUpdatedData = applyMissionsProgress(result.updatedData);

        if (authUserData) {
          updateUserData(finalUpdatedData);
        }
        
        setClashReward({
          claimed: true,
          card: result.rewardedCard,
        });
        try {
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.5 },
          });
        } catch (e) {}
      } else {
        // Just mark rewards as handled even on loss
        setClashReward({ claimed: true });
        // Update user stats (losses) in their user doc and still apply user missions progress
        if (authUserData) {
          const withLoss: ClashUserData = {
            ...userData,
            losses: (userData.losses || 0) + 1,
            aiBattlesPlayed: (userData.aiBattlesPlayed || 0) + 1,
          };
          updateUserData(applyMissionsProgress(withLoss));
        }
      }
    }
  }, [game.isGameOver, game.clashGameContext, game.homeScore, game.awayScore, authUserData, userData]);

  // Ensure Hard Mode difficulty is locked in Gridiron Clash matches (no script mode)
  useEffect(() => {
    if (game.clashGameContext && game.difficulty !== 'Hard') {
      setGame((prev) => (prev ? { ...prev, difficulty: 'Hard' } : null));
    }
  }, [game.clashGameContext, game.difficulty]);

  // Monitor scroll position to show mini field when user scrolled down and can't see the field
  useEffect(() => {
    const handleScrollCheck = () => {
      if (!fieldWrapperRef.current) return;
      const rect = fieldWrapperRef.current.getBoundingClientRect();
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      // Scrolled down and can't see the field: field bottom has scrolled up past the top header or scrollY > 200
      const visible = rect.bottom > 160 && rect.top < (window.innerHeight - 80) && scrollY < 240;
      setIsFieldVisible(visible);
    };

    window.addEventListener('scroll', handleScrollCheck, { passive: true });
    window.addEventListener('resize', handleScrollCheck, { passive: true });
    document.addEventListener('scroll', handleScrollCheck, { passive: true, capture: true });
    handleScrollCheck();

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && fieldWrapperRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          const rect = entry.boundingClientRect;
          const visible = entry.isIntersecting && rect.bottom > 160;
          setIsFieldVisible(visible);
        },
        {
          threshold: [0, 0.1, 0.5],
          rootMargin: '-70px 0px 0px 0px',
        }
      );
      observer.observe(fieldWrapperRef.current);
    }

    return () => {
      window.removeEventListener('scroll', handleScrollCheck);
      window.removeEventListener('resize', handleScrollCheck);
      document.removeEventListener('scroll', handleScrollCheck, true);
      if (observer) observer.disconnect();
    };
  }, []);

  const handleScrollToField = () => {
    if (fieldWrapperRef.current) {
      fieldWrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Load custom plays from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gridiron_custom_plays');
      if (saved) {
        setCustomPlays(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  // Clock Countdown Timer: runs every 1 second when neither paused, animating, nor game over
  useEffect(() => {
    if (game.isGameOver || isAnimating || isClockPaused) return;

    const timer = setInterval(() => {
      // 1. Play clock ticks down
      setPlayClock((prev) => {
        if (prev <= 1) {
          playSound.whistle();
          setDelayOfGameNotice(true);
          setTimeout(() => setDelayOfGameNotice(false), 3000);

          // Apply Delay of Game Penalty: Lose 5 yards and lose a down!
          setGame((prevGame) => {
            if (!prevGame || prevGame.isGameOver) return prevGame;
            const newYardLine = prevGame.yardLine - 5;
            const newDown = prevGame.down + 1;

            if (newYardLine < 1) {
              // Safety!
              const isHomePoss = prevGame.possession === 'home';
              const newHomeScore = isHomePoss ? prevGame.homeScore : prevGame.homeScore + 2;
              const newAwayScore = isHomePoss ? prevGame.awayScore + 2 : prevGame.awayScore;
              return {
                ...prevGame,
                homeScore: newHomeScore,
                awayScore: newAwayScore,
                possession: isHomePoss ? 'away' : 'home',
                yardLine: 25,
                down: 1,
                distance: 10,
                lastPlayResult: {
                  outcomeType: 'Safety',
                  yardsGained: -prevGame.yardLine,
                  commentary: 'DELAY OF GAME in the endzone! SAFETY! 2 points awarded to the defense.',
                  isSafety: true,
                  isTurnover: true,
                  isTouchdown: false,
                  isFirstDown: false,
                  clockElapsedSeconds: 5,
                  stoppedClock: true,
                },
              };
            }

            if (newDown > 4) {
              // Turnover on downs due to delay of game on 4th down
              const isHomePoss = prevGame.possession === 'home';
              return {
                ...prevGame,
                possession: isHomePoss ? 'away' : 'home',
                yardLine: 100 - newYardLine,
                down: 1,
                distance: 10,
                lastPlayResult: {
                  outcomeType: 'TackleForLoss',
                  yardsGained: -5,
                  commentary: 'DELAY OF GAME on 4th down! 5-yard penalty and Turnover on Downs!',
                  isTurnover: true,
                  turnoverType: 'Downs',
                  isFirstDown: false,
                  isTouchdown: false,
                  isSafety: false,
                  clockElapsedSeconds: 5,
                  stoppedClock: true,
                },
              };
            }

            return {
              ...prevGame,
              yardLine: newYardLine,
              down: newDown,
              lastPlayResult: {
                outcomeType: 'PenaltyOffense',
                yardsGained: -5,
                commentary: 'DELAY OF GAME penalty! 5-yard penalty and loss of down.',
                isFirstDown: false,
                isTouchdown: false,
                isSafety: false,
                isTurnover: false,
                penaltyYards: -5,
                penaltyName: 'Delay of Game',
                clockElapsedSeconds: 5,
                stoppedClock: true,
              },
            };
          });

          return 40;
        }
        return prev - 1;
      });

      // 2. Game clock ticks down
      setGame((prevGame) => {
        if (!prevGame || prevGame.isGameOver) return prevGame;
        if (prevGame.quarterTimeSeconds <= 1) {
          playSound.buzzer();
          let nextQuarter = prevGame.quarter;
          let nextTime = prevGame.quarterLengthMinutes * 60;
          let isOver = false;

          if (prevGame.quarter < 4) {
            nextQuarter += 1;
          } else {
            if (prevGame.homeScore === prevGame.awayScore) {
              nextQuarter = 5; // Overtime
            } else {
              isOver = true;
              nextTime = 0;
            }
          }

          return {
            ...prevGame,
            quarter: nextQuarter,
            quarterTimeSeconds: nextTime,
            isGameOver: isOver,
          };
        }

        return {
          ...prevGame,
          quarterTimeSeconds: prevGame.quarterTimeSeconds - 1,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [game.isGameOver, isAnimating, isClockPaused, setGame]);

  // Check for game over celebration
  useEffect(() => {
    if (game.isGameOver) {
      const isHomeWinner = game.homeScore > game.awayScore;
      const winner = isHomeWinner ? game.homeTeam : game.awayTeam;
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: [winner.primaryColor, winner.secondaryColor || '#ffffff'],
      });
    }
  }, [game.isGameOver, game.homeScore, game.awayScore, game.homeTeam, game.awayTeam]);

  const isHomePoss = game.possession === 'home';
  const offenseTeam = isHomePoss ? game.homeTeam : game.awayTeam;
  const defenseTeam = isHomePoss ? game.awayTeam : game.homeTeam;

  const activeSlot = loadSaveSlot(getActiveSlotId());
  const seasonUserTeamId = activeSlot?.season?.userTeamId;
  const isSeasonMode = !!game.seasonGameContext;

  // Determine user-controlled team across all modes:
  // 1. Explicit game.userTeamId if set
  // 2. In Clash mode: always user's team (game.homeTeam.id / 'USER_CLASH')
  // 3. In Season mode: active slot season user team ID (fallback to homeTeam.id)
  // 4. In Exhibition mode: game.homeTeam.id
  const userTeamId =
    game.userTeamId ||
    (game.clashGameContext
      ? game.homeTeam.id
      : isSeasonMode
      ? (seasonUserTeamId || game.homeTeam.id)
      : game.homeTeam.id);

  // When the user's team is on defense, show the defensive playbook instead of offensive!
  const isUserOnDefense = defenseTeam.id === userTeamId;

  const currentAvailablePlays = isUserOnDefense ? allDefensivePlays : allOffensivePlays;
  const currentGroupedPlays = useMemo(() => {
    return groupPlaysForDropdown(currentAvailablePlays, isUserOnDefense);
  }, [currentAvailablePlays, isUserOnDefense]);

  const primaryTargetInfo = useMemo(() => {
    return getPlayPrimaryTarget(selectedOffensePlay, offenseTeam);
  }, [selectedOffensePlay, offenseTeam]);

  const teamReceivers = useMemo(() => {
    return getTeamReceiversAndTEs(offenseTeam.id);
  }, [offenseTeam.id]);

  // Online Match Sync States
  const [onlineRoomSync, setOnlineRoomSync] = useState<OnlineRoom | null>(null);
  const [isPlaySubmittedLocally, setIsPlaySubmittedLocally] = useState<boolean>(false);
  const lastProcessedExecutedAtRef = React.useRef<number>(0);

  // Derive opponent status from synced data for better reliability than local state
  const isOpponentPlaySubmitted = useMemo(() => {
    if (!onlineRoomSync?.matchSync) return false;
    // Use the explicit isHost prop to determine our role instead of relying on UID comparison
    const isHost = !!game.onlineMatchIsHost;
    const sync = onlineRoomSync.matchSync;
    const locks = sync.playersLocked;
    
    if (isHost) {
      return !!(
        sync.guestSubmittedPlay ||
        locks?.guest?.isLocked ||
        (onlineRoomSync.guestUserId && locks?.[onlineRoomSync.guestUserId]?.isLocked)
      );
    } else {
      return !!(
        sync.hostSubmittedPlay ||
        locks?.host?.isLocked ||
        (onlineRoomSync.hostUserId && locks?.[onlineRoomSync.hostUserId]?.isLocked)
      );
    }
  }, [onlineRoomSync, game.onlineMatchIsHost]);

  // Use a ref for the game state to avoid re-subscribing to Firestore every second due to the game clock
  const gameRef = React.useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const lastProcessedTurnRef = React.useRef<number>(0);

  // Subscribe to real-time online room match sync updates
  useEffect(() => {
    if (!game.onlineMatchRoomId) return;
    
    // We only want to subscribe ONCE when the roomId changes
    const unsub = listenToLobby(game.onlineMatchRoomId, (room) => {
      if (!room) return;
      setOnlineRoomSync(room);

      const isHost = !!game.onlineMatchIsHost;
      const sync = room.matchSync;
      if (!sync) return;

      const currentGame = gameRef.current;

      // When room first loads, initialize processed ref
      if (lastProcessedExecutedAtRef.current === 0 && sync.lastPlayResult?.executedAt) {
        lastProcessedExecutedAtRef.current = sync.lastPlayResult.executedAt;
      }
      if (lastProcessedTurnRef.current === 0) {
        lastProcessedTurnRef.current = sync.turnNumber;
      }

      // Check playersLocked object in shared database state
      const playersLocked = sync.playersLocked;
      const isHostLocked = !!(
        playersLocked?.host?.isLocked ||
        (room.hostUserId && playersLocked?.[room.hostUserId]?.isLocked) ||
        sync.hostSubmittedPlay
      );
      const isGuestLocked = !!(
        playersLocked?.guest?.isLocked ||
        (room.guestUserId && playersLocked?.[room.guestUserId]?.isLocked) ||
        sync.guestSubmittedPlay
      );
      const areBothPlayersLocked = isHostLocked && isGuestLocked;

      // Check if both host and guest are locked in for the current turn
      // AND ensure we haven't already processed this turn's execution
      if (
        sync.hostSubmittedPlay &&
        sync.guestSubmittedPlay &&
        areBothPlayersLocked &&
        sync.turnNumber >= lastProcessedTurnRef.current
      ) {
        if (isHost) {
          const isHomePoss = currentGame.possession === 'home';
          const offSubmitted = isHomePoss ? sync.hostSubmittedPlay : sync.guestSubmittedPlay;
          const defSubmitted = isHomePoss ? sync.guestSubmittedPlay : sync.hostSubmittedPlay;

          const offPlayToRun =
            allOffensivePlaysRef.current.find((p) => p.id === offSubmitted.playId) || selectedOffensePlayRef.current;
          const defPlayToRun =
            allDefensivePlaysRef.current.find((p) => p.id === defSubmitted.playId) || selectedDefensePlayRef.current;

          const effectiveParams: ScriptExecutionParams = {
            outcomeType: 'OrganicSim',
            throwingVariant: offSubmitted.throwingVariant,
            runVariant: offSubmitted.runVariant,
            targetPlayer: offSubmitted.targetPlayer,
            preSnapMotion: offSubmitted.preSnapMotion,
            isMaxProtection: offSubmitted.isMaxProtection,
          };

          const { updatedGame, result } = executePlay(currentGame, offPlayToRun, defPlayToRun, effectiveParams);

          if (currentGame.onlineMatchRoomId) {
            // Increment processed turn immediately to prevent race conditions
            lastProcessedTurnRef.current = sync.turnNumber + 1;
            
            const matchRoomId = currentGame.onlineMatchRoomId;
            const updatedMatchSyncData = {
              turnNumber: sync.turnNumber + 1,
              possessionUserId: updatedGame.possession === 'home' ? room.hostUserId : (room.guestUserId || 'guest'),
              down: updatedGame.down,
              distance: updatedGame.distance,
              yardLine: updatedGame.yardLine,
              homeScore: updatedGame.homeScore,
              awayScore: updatedGame.awayScore,
              quarter: updatedGame.quarter,
              quarterTimeSeconds: updatedGame.quarterTimeSeconds,
              hostSubmittedPlay: null,
              guestSubmittedPlay: null,
              playersLocked: {
                host: { isLocked: false, userId: room.hostUserId },
                guest: { isLocked: false, userId: room.guestUserId || 'guest' },
                [room.hostUserId]: { isLocked: false, userId: room.hostUserId },
                [(room.guestUserId || 'guest')]: { isLocked: false, userId: room.guestUserId || 'guest' },
              },
              lastPlayResult: {
                description: result.commentary,
                gainYards: result.yardsGained,
                resultType: result.outcomeType,
                turnover: result.isTurnover,
                touchdown: result.isTouchdown,
                executedAt: Date.now(),
                offensePlayName: offPlayToRun.name,
                defensePlayName: defPlayToRun.name,
              },
              isGameOver: updatedGame.isGameOver,
            };

            // Defer write execution out of the current onSnapshot event frame
            setTimeout(() => {
              updateOnlineMatchSync(matchRoomId, updatedMatchSyncData);
            }, 0);
          }
        }
      }

      // Sync and Animate the Play for both Players!
      if (sync.lastPlayResult && sync.lastPlayResult.executedAt > lastProcessedExecutedAtRef.current) {
        // Mark as processed
        lastProcessedExecutedAtRef.current = sync.lastPlayResult.executedAt;
        lastProcessedTurnRef.current = sync.turnNumber;

        // Reset play locks
        setIsPlaySubmittedLocally(false);
        setPlayClock(40);

        // Find plays from name to match animation paths
        const offPlay = allOffensivePlaysRef.current.find((p) => p.name === sync.lastPlayResult!.offensePlayName) || selectedOffensePlayRef.current;
        const defPlay = allDefensivePlaysRef.current.find((p) => p.name === sync.lastPlayResult!.defensePlayName) || selectedDefensePlayRef.current;

        setSelectedOffensePlay(offPlay);
        setSelectedDefensePlay(defPlay);

        const syntheticResult: PlayResult = {
          outcomeType: sync.lastPlayResult.resultType as ScriptedOutcomeType,
          yardsGained: sync.lastPlayResult.gainYards,
          commentary: sync.lastPlayResult.description,
          isTouchdown: sync.lastPlayResult.touchdown,
          isTurnover: sync.lastPlayResult.turnover,
          isSafety: sync.lastPlayResult.resultType === 'Safety',
          isFirstDown: sync.lastPlayResult.gainYards >= currentGame.distance || sync.down === 1,
          clockElapsedSeconds: 10,
          stoppedClock: false,
        };

        setLastResult(syntheticResult);
        setIsAnimating(true);

        let start = performance.now();
        const duration = 1600;
        let animationCompleted = false;

        const completeAnimation = () => {
          if (animationCompleted) return;
          animationCompleted = true;
          setIsAnimating(false);
          setAnimProgress(0);

          setGame((prevGame) => {
            if (!prevGame) return null;
            // Determine possession relative to user's perspective (home = me, away = opponent)
            const isMyPossession = isHost
              ? sync.possessionUserId === room.hostUserId
              : sync.possessionUserId === room.guestUserId;

            const effectiveHomeScore = isHost ? sync.homeScore : sync.awayScore;
            const effectiveAwayScore = isHost ? sync.awayScore : sync.homeScore;
            
            return {
              ...prevGame,
              down: sync.down,
              distance: sync.distance,
              yardLine: sync.yardLine,
              homeScore: effectiveHomeScore,
              awayScore: effectiveAwayScore,
              quarter: sync.quarter,
              quarterTimeSeconds: sync.quarterTimeSeconds,
              possession: isMyPossession ? 'home' : 'away',
              isGameOver: !!sync.isGameOver,
              lastPlayResult: syntheticResult,
              playLog: [
                ...prevGame.playLog,
                {
                  down: prevGame.down,
                  distance: prevGame.distance,
                  yardLine: prevGame.yardLine,
                  offensePlay: sync.lastPlayResult!.offensePlayName,
                  defensePlay: sync.lastPlayResult!.defensePlayName,
                  result: syntheticResult,
                  quarter: prevGame.quarter,
                  timeRemaining: `${Math.floor(prevGame.quarterTimeSeconds / 60)}:${(prevGame.quarterTimeSeconds % 60).toString().padStart(2, '0')}`,
                  score: { home: effectiveHomeScore, away: effectiveAwayScore },
                }
              ],
            };
          });
        };

        const fallbackTimer = setTimeout(() => {
          completeAnimation();
        }, duration + 50);

        const animLoop = (now: number) => {
          if (animationCompleted) return;
          const elapsed = now - start;
          const prog = Math.min(1, elapsed / duration);
          setAnimProgress(prog);

          if (prog < 1) {
            requestAnimationFrame(animLoop);
          } else {
            clearTimeout(fallbackTimer);
            completeAnimation();
          }
        };

        requestAnimationFrame(animLoop);
      }
    });

    return () => unsub();
  }, [
    game.onlineMatchRoomId,
    game.onlineMatchIsHost
  ]);

  // Executes a play with scripted or simulated params
  const handleExecutePlay = (scriptParams: ScriptExecutionParams) => {
    if (game.isGameOver || isAnimating) return;

    if (game.onlineMatchRoomId) {
      const isHost = !!game.onlineMatchIsHost;
      const playCall: SubmittedPlayCall = {
        userId: getOnlineUserId(),
        playId: isUserOnDefense ? selectedDefensePlay.id : selectedOffensePlay.id,
        playName: isUserOnDefense ? selectedDefensePlay.name : selectedOffensePlay.name,
        playType: isUserOnDefense ? 'Defense' : 'Offense',
        category: isUserOnDefense ? selectedDefensePlay.category : selectedOffensePlay.category,
        submittedAt: Date.now(),
      };

      if (scriptParams.throwingVariant !== undefined || selectedThrowingVariant !== undefined) {
        playCall.throwingVariant = scriptParams.throwingVariant ?? selectedThrowingVariant;
      }
      if (scriptParams.runVariant !== undefined || selectedRunVariant !== undefined) {
        playCall.runVariant = scriptParams.runVariant ?? selectedRunVariant;
      }
      const target = scriptParams.targetPlayer || (selectedTargetPlayer !== 'FIRST_READ' ? selectedTargetPlayer : undefined);
      if (target) {
        playCall.targetPlayer = target;
      }
      if (scriptParams.preSnapMotion !== undefined) {
        playCall.preSnapMotion = scriptParams.preSnapMotion;
      }
      if (scriptParams.isMaxProtection !== undefined) {
        playCall.isMaxProtection = scriptParams.isMaxProtection;
      }

      setIsPlaySubmittedLocally(true);
      submitOnlinePlayCall(game.onlineMatchRoomId, isHost, playCall).then((res) => {
        if (!res.success) {
          console.error('[Online] Failed to submit play call:', res.error);
          setIsPlaySubmittedLocally(false);
        }
      });
      return;
    }

    // Reset Play Clock back to 40 seconds on snap
    setPlayClock(40);

    // Pick CPU plays if not user selected/controlled
    let offPlayToRun = selectedOffensePlay;
    if (isUserOnDefense) {
      offPlayToRun = selectAIOffensivePlay(game, allOffensivePlays);
    }

    const defPlayToRun = !isUserOnDefense
      ? allDefensivePlays[Math.floor(Math.random() * allDefensivePlays.length)]
      : (selectedDefensePlay || allDefensivePlays[Math.floor(Math.random() * allDefensivePlays.length)]);

    // Attach selected throwing/run variant and target player if not explicitly overridden by params
    const effectiveParams: ScriptExecutionParams = {
      ...scriptParams,
      throwingVariant: scriptParams.throwingVariant !== undefined ? scriptParams.throwingVariant : selectedThrowingVariant,
      runVariant: scriptParams.runVariant !== undefined ? scriptParams.runVariant : selectedRunVariant,
      targetPlayer: scriptParams.targetPlayer || (selectedTargetPlayer !== 'FIRST_READ' ? selectedTargetPlayer : undefined),
    };

    const { updatedGame, result } = executePlay(game, offPlayToRun, defPlayToRun, effectiveParams);

    // If fatigue or impact triggered an injury, record and alert immediately
    if (result.triggeredInjury) {
      setInjuredPlayers((prev) => [result.triggeredInjury!, ...prev]);
      setLatestInjury(result.triggeredInjury);
      playSound.injuryAlert();
    }

    // Trigger 5-Second Hard Mode Play Outcome Popup:
    // "when you click execute on hard mode the message that tells you how the play went should pop up for a 5 seconds right under the scoreboard when scrolled down."
    const isHardModeExecution = game.difficulty === 'Hard' || effectiveParams.outcomeType === 'OrganicSim';
    if (isHardModeExecution) {
      setHardModePopup({
        result,
        timestamp: Date.now(),
      });
    }

    // Start 1.8s visual field play animation
    setLastResult(result);
    setIsAnimating(true);

    let start = performance.now();
    const duration = 1600;
    let animationCompleted = false;

    const completeAnimation = () => {
      if (animationCompleted) return;
      animationCompleted = true;
      setIsAnimating(false);
      setAnimProgress(0);
      setGame(updatedGame);

      if (updatedGame.isGameOver && onFinishSeasonGame) {
        onFinishSeasonGame(updatedGame);
      }
    };

    // Safety fallback timer to guarantee play executes even if requestAnimationFrame is throttled/paused/blocked in sandbox
    const fallbackTimer = setTimeout(() => {
      completeAnimation();
    }, duration + 50);

    const animLoop = (now: number) => {
      if (animationCompleted) return;
      const elapsed = now - start;
      const prog = Math.min(1, elapsed / duration);
      setAnimProgress(prog);

      if (prog < 1) {
        requestAnimationFrame(animLoop);
      } else {
        clearTimeout(fallbackTimer);
        completeAnimation();
      }
    };

    requestAnimationFrame(animLoop);
  };

  // Simulate 5 plays rapidly
  const handleSimulateFivePlays = () => {
    let curr = game;
    for (let i = 0; i < 5; i++) {
      if (curr.isGameOver) break;
      const offPlay = selectAIOffensivePlay(curr, allOffensivePlays);
      const defPlay = allDefensivePlays[Math.floor(Math.random() * allDefensivePlays.length)];
      const res = executePlay(curr, offPlay, defPlay, { outcomeType: 'OrganicSim' });
      curr = res.updatedGame;
    }
    setGame(curr);
    setLastResult(curr.lastPlayResult);
    if (curr.isGameOver && onFinishSeasonGame) {
      onFinishSeasonGame(curr);
    }
  };

  // Simulate to final whistle
  const handleSimulateToEnd = () => {
    let curr = game;
    let steps = 0;
    while (!curr.isGameOver && steps < 80) {
      const offPlay = selectAIOffensivePlay(curr, allOffensivePlays);
      const defPlay = allDefensivePlays[Math.floor(Math.random() * allDefensivePlays.length)];
      const res = executePlay(curr, offPlay, defPlay, { outcomeType: 'OrganicSim' });
      curr = res.updatedGame;
      steps++;
    }
    curr.isGameOver = true;
    setGame(curr);
    setLastResult(curr.lastPlayResult);
    if (onFinishSeasonGame) {
      onFinishSeasonGame(curr);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Sticky Mini Field + Scoreboard Bar (Visible when scrolled down and can't see the field) */}
      <MiniFieldScoreboardBar
        game={game}
        isFieldVisible={isFieldVisible}
        isAnimating={isAnimating}
        animProgress={animProgress}
        lastResult={lastResult || null}
        hardModePopup={hardModePopup}
        onDismissPopup={() => setHardModePopup(null)}
        onScrollToField={handleScrollToField}
        onOpenFieldCam={() => {
          setIsFieldCamOpen(true);
          setFieldCamMode('pip');
        }}
      />

      {/* Top Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            id="btn-back-menu"
            onClick={async () => {
              if (game.onlineMatchRoomId && !game.isGameOver) {
                await handlePlayerLeaveOnlineMatch(game.onlineMatchRoomId, userData);
              }
              onExitGame();
            }}
            className="flex items-center space-x-2 text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>EXIT TO MENU</span>
          </button>

          {/* Gameplay Difficulty Switcher (Disabled / Removed in Gridiron Clash) */}
          {!game.clashGameContext ? (
            <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 shadow-inner">
              <button
                type="button"
                id="btn-switch-to-script"
                onClick={() => setGame((prev) => prev ? { ...prev, difficulty: 'Script' } : null)}
                className={`px-2 sm:px-2.5 py-1 rounded text-[10px] sm:text-[11px] font-bold transition cursor-pointer ${
                  game.difficulty !== 'Hard'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Script Mode
              </button>
              <button
                type="button"
                id="btn-switch-to-hard"
                onClick={() => setGame((prev) => prev ? { ...prev, difficulty: 'Hard' } : null)}
                className={`px-2 sm:px-2.5 py-1 rounded text-[10px] sm:text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer ${
                  game.difficulty === 'Hard'
                    ? 'bg-rose-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>⚡</span>
                <span>Hard Mode</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-3 py-1 bg-rose-500/15 border border-rose-500/40 rounded-lg shadow-sm">
              <span className="text-rose-400 text-xs font-black">⚡</span>
              <span className="text-[11px] font-display font-black text-rose-300 uppercase tracking-wider">
                GRIDIRON CLASH • HARD MODE ONLY
              </span>
            </div>
          )}
        </div>

        {game.seasonGameContext && (
          <span className="text-xs font-mono font-bold px-3 py-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
            {game.seasonGameContext.isPlayoff
              ? `${game.seasonGameContext.playoffRound?.toUpperCase()} PLAYOFFS`
              : `SEASON WEEK ${game.seasonGameContext.week}`}
          </span>
        )}

        {/* Clear On-Field Unit Indicator */}
        <div className="flex items-center space-x-2">
          {isUserOnDefense ? (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold font-mono shadow-sm">
              <Shield className="w-3.5 h-3.5 text-rose-400" />
              <span>{defenseTeam.abbr} DEFENSE ON FIELD</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono shadow-sm">
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              <span>{offenseTeam.abbr} OFFENSE ON FIELD</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick Field Cam Toggle */}
          <button
            type="button"
            id="btn-topbar-field-cam"
            onClick={() => {
              setIsFieldCamOpen(true);
              setFieldCamMode('pip');
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-display font-bold transition shadow cursor-pointer"
            title="Open Picture-in-Picture floating Field Cam"
          >
            <Tv className="w-4 h-4 text-emerald-400" />
            <span>FIELD CAM</span>
          </button>

          <button
            id="btn-open-depth-chart"
            onClick={() => setShowDepthChartModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-xs shadow-lg transition"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">DEPTH CHART</span>
          </button>

          <button
            id="btn-toggle-game-stats"
            onClick={() => setShowStatsModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white border border-slate-700 transition"
          >
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">BOX SCORE</span>
          </button>
        </div>
      </div>

      {/* Delay of Game Alert */}
      {delayOfGameNotice && (
        <div className="bg-rose-900/90 border border-rose-500 text-white px-4 py-2 rounded-xl flex items-center justify-between animate-bounce shadow-xl">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-300" />
            <span className="font-display font-bold text-sm">
              DELAY OF GAME! PLAY CLOCK EXPIRED (:00)
            </span>
          </div>
          <span className="text-xs font-mono bg-rose-950 px-2 py-0.5 rounded border border-rose-700 text-rose-200">
            Whistle Blown • Clock Reset (:40)
          </span>
        </div>
      )}

      {/* Fake Snap Alert */}
      {snapNotice && (
        <div className="bg-amber-950/90 border border-amber-500 text-amber-200 px-4 py-2 rounded-xl flex items-center justify-between shadow-xl">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span className="font-display font-bold text-sm">
              {snapNotice}
            </span>
          </div>
          <span className="text-xs font-mono bg-amber-900/80 px-2 py-0.5 rounded border border-amber-600 text-amber-200">
            No Play • Clock Reset (:40)
          </span>
        </div>
      )}

      {/* Play Repetition Warning Alert (Called same play > 3 times) */}
      {game.repeatPlayWarning && (
        <div className="bg-rose-950/95 border border-rose-500 text-rose-100 px-4 py-2.5 rounded-xl flex items-center justify-between shadow-2xl animate-pulse">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="font-display font-bold text-sm">
              {game.repeatPlayWarning}
            </span>
          </div>
          <span className="text-xs font-mono bg-rose-900 px-2 py-0.5 rounded border border-rose-700 text-rose-200 shrink-0 hidden sm:inline-block">
            {game.consecutiveSamePlayCount && game.consecutiveSamePlayCount > 3 ? 'DEFENSE ANTICIPATION' : 'PREDICTABILITY WARNING'}
          </span>
        </div>
      )}

      {/* Player Fatigue Alert Banner */}
      {game.fatigueNotice && (
        <div className="bg-amber-950/95 border border-amber-500 text-amber-100 px-4 py-2.5 rounded-xl flex items-center justify-between shadow-2xl">
          <div className="flex items-center space-x-2.5">
            <Activity className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="font-display font-bold text-sm">
              {game.fatigueNotice}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowDepthChartModal(true)}
            className="text-xs font-mono bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded font-black tracking-wider uppercase shrink-0 transition"
          >
            OPEN DEPTH CHART
          </button>
        </div>
      )}

      {/* Broadcast Scoreboard */}
      <GameScoreboard
        game={game}
        playClock={playClock}
        isClockPaused={isClockPaused}
        onToggleClockPause={() => setIsClockPaused((prev) => !prev)}
        onResetPlayClock={(sec) => setPlayClock(sec)}
        onSimulateRestOfGame={handleSimulateToEnd}
        onSimulateQuarter={handleSimulateFivePlays}
      />

      {/* Injury Alert Banner */}
      {latestInjury && (
        <InjuryAlertBanner
          injury={latestInjury}
          onDismiss={() => setLatestInjury(null)}
        />
      )}

      {/* Custom Broadcast Announcement & Injury Scripter */}
      <CustomAnnouncementBar
        homeTeam={game.homeTeam}
        awayTeam={game.awayTeam}
        currentPossession={game.possession}
        onInjuryTriggered={handleInjuryTriggered}
      />

      {/* 2D Football Field */}
      <div ref={fieldWrapperRef} id="main-football-field-section">
        <FootballField
          game={game}
          offensePlay={selectedOffensePlay}
          defensePlay={selectedDefensePlay}
          isAnimating={isAnimating}
          animProgress={animProgress}
          lastResult={lastResult}
          onExecuteDrawnPlay={handleExecutePlay}
          isExternalDrawMode={isFieldDrawMode}
          onToggleExternalDrawMode={setIsFieldDrawMode}
        />
      </div>

      {/* Latest Play Commentary Ticker */}
      {lastResult && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between shadow-lg transition-all ${
            lastResult.isTouchdown
              ? 'bg-amber-950/60 border-amber-500 text-amber-200'
              : lastResult.isTurnover
              ? 'bg-rose-950/60 border-rose-500 text-rose-200'
              : lastResult.isFirstDown
              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
              : 'bg-slate-900 border-slate-800 text-slate-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            <span
              className={`text-xs font-display font-black px-2 py-0.5 rounded ${
                lastResult.isTouchdown
                  ? 'bg-amber-500 text-slate-950'
                  : lastResult.isTurnover
                  ? 'bg-rose-500 text-white'
                  : lastResult.isFirstDown
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {lastResult.isTouchdown
                ? 'TOUCHDOWN'
                : lastResult.isTurnover
                ? 'TURNOVER'
                : lastResult.isFirstDown
                ? '1ST DOWN'
                : `${lastResult.yardsGained > 0 ? `+${lastResult.yardsGained}` : lastResult.yardsGained} YDS`}
            </span>
            <p className="text-sm font-medium">
              {syncCommentaryWithYards(lastResult.commentary, lastResult.yardsGained, lastResult.isFirstDown)}
            </p>
          </div>

          <span className="text-xs font-mono opacity-60 hidden sm:inline-block">
            {isAnimating ? 'Executing...' : 'Play Complete'}
          </span>
        </div>
      )}

      {/* PLAY CALLING & SCRIPTING CONTROLS */}
      {!game.isGameOver ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* PLAY SELECTION & TRAJECTORY CONTROLS (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Play Selection Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              {/* Prominent Offense / Defense Role Banner */}
              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                isUserOnDefense
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-amber-950/60 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/30'
              }`}>
                <div className="flex items-center space-x-2.5">
                  {isUserOnDefense ? (
                    <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <Flame className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                  <div>
                    <div className="font-display font-black text-xs uppercase tracking-wider">
                      {isUserOnDefense ? '🛡️ YOUR TEAM IS ON DEFENSE' : '🏈 YOUR TEAM HAS THE BALL (OFFENSE)'}
                    </div>
                    <div className="text-[11px] opacity-90 leading-tight">
                      {isUserOnDefense
                        ? `Opponent ${offenseTeam.name} has the ball. Choose defensive coverage!`
                        : `You have the ball (${game.down}st & ${game.distance} at ${game.yardLine} YD). Select play!`
                      }
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded ${
                  isUserOnDefense ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-amber-500/20 border border-amber-500/40'
                }`}>
                  {isUserOnDefense ? 'DEFENSE' : 'OFFENSE'}
                </span>
              </div>

              {/* Starters Fatigue & Depth Chart Shortcut (Strength based safe hits: STR 90+: 30 | 80-89: 20 | <=79: 10) */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 font-display font-bold text-slate-300">
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    <span>STARTERS FATIGUE & HITS</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDepthChartModal(true)}
                    className="text-[10px] font-mono text-amber-400 hover:text-amber-300 underline font-bold"
                  >
                    Depth Chart & Bench (+2 hits) →
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'QB', player: (offenseTeam.roster || []).find((p) => p.position === 'QB' && !p.isBenched) || { name: offenseTeam.starQB, strength: 82, fatigueHits: 0 } },
                    { label: 'RB', player: (offenseTeam.roster || []).find((p) => p.position === 'RB' && !p.isBenched) || { name: offenseTeam.starRB, strength: 88, fatigueHits: 0 } },
                    { label: 'WR1', player: (offenseTeam.roster || []).find((p) => p.position === 'WR' && !p.isBenched) || { name: offenseTeam.starWR, strength: 74, fatigueHits: 0 } },
                  ].map(({ label, player }) => {
                    const pStr = (player as any).strength || 75;
                    const safeHits = getPlayerSafeHits(pStr);
                    const hits = (player as any).fatigueHits || 0;
                    const risk = calculateInjuryRisk(hits, pStr);

                    return (
                      <div
                        key={label}
                        className={`p-1.5 rounded-lg border text-center transition ${
                          risk.isElevated
                            ? 'bg-rose-950/40 border-rose-600 animate-pulse'
                            : hits >= safeHits - 3 && hits > 0
                            ? 'bg-amber-950/30 border-amber-600/70'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div className="text-[10px] font-bold text-slate-400 flex items-center justify-between">
                          <span className="font-mono text-amber-400">{label}</span>
                          <span className="font-mono text-[9px] text-slate-500">STR {pStr}</span>
                        </div>
                        <div className="text-[11px] font-bold text-white truncate max-w-full" title={player.name}>
                          {player.name}
                        </div>
                        <div className="text-[10px] font-mono mt-0.5">
                          <span className={risk.isElevated ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                            {hits}/{safeHits} hits
                          </span>{' '}
                          <span className={`text-[9px] ${risk.isElevated ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                            ({risk.riskPercent}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-slate-800 pb-2 pt-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-display font-bold text-sm text-slate-200 uppercase tracking-wider">
                    {isUserOnDefense ? 'Defensive Play Call' : 'Offensive Play Call'}
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    {(isUserOnDefense ? selectedDefensePlay : selectedOffensePlay).formation}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-amber-400 font-mono hidden sm:inline">
                    {isUserOnDefense ? `${defenseTeam.abbr} Playbook` : `${offenseTeam.abbr} Playbook`}
                  </span>
                  <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                    <button
                      type="button"
                      id="btn-play-view-dropdown"
                      onClick={() => setPlayViewMode('dropdown')}
                      className={`px-2 py-0.5 rounded font-bold transition ${
                        playViewMode === 'dropdown'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Dropdown Menu View (Compact, No Scrolling)"
                    >
                      ▾ Menu
                    </button>
                    <button
                      type="button"
                      id="btn-play-view-cards"
                      onClick={() => setPlayViewMode('cards')}
                      className={`px-2 py-0.5 rounded font-bold transition ${
                        playViewMode === 'cards'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Playbook Cards View"
                    >
                      ▦ Cards
                    </button>
                  </div>
                </div>
              </div>

              {playViewMode === 'dropdown' ? (
                /* DROPDOWN MENU PLAY SELECTOR (Zero vertical scrolling needed) */
                <div className="space-y-2.5">
                  <div className="relative">
                    <select
                      id="gameview-play-dropdown-select"
                      disabled={isPlaySubmittedLocally || isAnimating}
                      value={isUserOnDefense ? selectedDefensePlay.id : selectedOffensePlay.id}
                      onChange={(e) => {
                        const play = currentAvailablePlays.find((p) => p.id === e.target.value);
                        if (play) {
                          if (isUserOnDefense) {
                            setSelectedDefensePlay(play);
                          } else {
                            setSelectedOffensePlay(play);
                          }
                        }
                      }}
                      className="w-full bg-slate-950 border-2 border-slate-700 hover:border-amber-500 focus:border-amber-400 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none transition cursor-pointer"
                    >
                      {currentGroupedPlays.map((group) => (
                        <optgroup key={group.label} label={group.label} className="bg-slate-900 text-slate-300 font-bold">
                          {group.plays.map((play) => {
                            const isRepeated = !isUserOnDefense && (play.id === game.lastOffensivePlayId || play.name === game.lastOffensivePlayName);
                            const repCount = isRepeated ? (game.consecutiveSamePlayCount || 0) : 0;
                            return (
                              <option key={play.id} value={play.id} className="bg-slate-950 text-white font-normal py-1">
                                {play.name} ({play.formation} • {play.category}){repCount >= 3 ? ` ⚠️ (${repCount}x in row - Defense read!)` : ''}
                              </option>
                            );
                          })}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Selected Play Compact Overview */}
                  {(() => {
                    const activePlay = isUserOnDefense ? selectedDefensePlay : selectedOffensePlay;
                    const isRep = !isUserOnDefense && (activePlay.id === game.lastOffensivePlayId || activePlay.name === game.lastOffensivePlayName);
                    const repCount = isRep ? (game.consecutiveSamePlayCount || 0) : 0;

                    return (
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-display font-black text-sm text-white">
                            {activePlay.name}
                          </span>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] font-mono uppercase bg-slate-900 px-2 py-0.5 rounded text-amber-300 border border-slate-700">
                              {activePlay.formation}
                            </span>
                            <span className="text-[10px] font-mono uppercase bg-slate-900 px-2 py-0.5 rounded text-cyan-300 border border-slate-700">
                              {activePlay.category}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight">
                          {activePlay.description || `${activePlay.name} formation`}
                        </p>
                        {repCount >= 3 && (
                          <div className="text-[10px] font-mono font-bold text-rose-400 bg-rose-950/50 border border-rose-600/50 px-2 py-0.5 rounded mt-1 flex items-center space-x-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Run {repCount}x in a row: Opponent defense has read this play!</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* EXPANDED PLAY CARDS LIST (If user explicitly toggles it) */
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {(isUserOnDefense ? allDefensivePlays : allOffensivePlays).map((play) => {
                    const isSelected = isUserOnDefense
                      ? selectedDefensePlay.id === play.id
                      : selectedOffensePlay.id === play.id;
                    const isLocked = isPlaySubmittedLocally || isAnimating;

                    const isRepeatedPlay = !isUserOnDefense && (play.id === game.lastOffensivePlayId || play.name === game.lastOffensivePlayName);
                    const repCount = isRepeatedPlay ? (game.consecutiveSamePlayCount || 0) : 0;

                    return (
                      <button
                        key={play.id}
                        id={`play-call-${play.id}`}
                        disabled={isLocked}
                        onClick={() => {
                          if (isUserOnDefense) {
                            setSelectedDefensePlay(play);
                          } else {
                            setSelectedOffensePlay(play);
                          }
                        }}
                        className={`w-full p-2.5 rounded-lg border text-left transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-md'
                            : isLocked 
                            ? 'bg-slate-900/40 border-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-display font-bold text-sm">{play.name}</span>
                            {play.isCustom && (
                              <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 rounded font-mono font-bold">
                                CUSTOM
                              </span>
                            )}
                            {repCount >= 3 && (
                              <span className="text-[9px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-600 px-1.5 py-0.5 rounded">
                                ⚠️ {repCount}x in row (Defense read!)
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono block">
                            {play.formation} • {play.category}
                          </span>
                        </div>

                        {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION RIGHT UNDER THE PLAYCALL SECTION: DEFENSE SCHEME OR OFFENSE VARIANTS */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3.5 shadow-lg">
              {isUserOnDefense && (
                /* DEFENSIVE SCHEME & COVERAGE FOCUS WHEN USER'S TEAM IS ON DEFENSE */
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center space-x-1.5">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <h4 className="font-display font-bold text-xs text-slate-200 uppercase tracking-wider">
                        Defensive Scheme & Coverage Focus
                      </h4>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {defenseTeam.abbr} DEFENSE
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-black text-sm text-white">
                        {selectedDefensePlay.name}
                      </span>
                      <span className="text-[10px] uppercase font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                        {selectedDefensePlay.formation} • {selectedDefensePlay.category}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800">
                      <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                        <span className="text-slate-400 block text-[10px]">Defensive Front:</span>
                        <span className="font-bold text-slate-200">{selectedDefensePlay.formation} Alignment</span>
                      </div>
                      <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                        <span className="text-slate-400 block text-[10px]">Coverage Shell:</span>
                        <span className="font-bold text-cyan-300">{selectedDefensePlay.category}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-snug">
                      {selectedDefensePlay.description || `Fielding the ${defenseTeam.name} defense against the ${offenseTeam.name} offense.`}
                    </p>

                    {defenseTeam.starDef && (
                      <div className="flex items-center space-x-2 pt-2 border-t border-slate-800 text-xs">
                        <span className="text-amber-400 font-bold">⭐ Anchor Defender:</span>
                        <span className="text-slate-200 font-display font-bold">{defenseTeam.starDef}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hard Mode Target Receiver Selection (Offense) */}
              {game.difficulty === 'Hard' && !isUserOnDefense && (
                <div className="space-y-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-xs text-amber-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <Target className="w-4 h-4 text-amber-400" />
                      <span>Hard Mode: Lock Target Receiver</span>
                    </span>
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      {selectedTargetPlayer === 'FIRST_READ' ? '1st Read' : 'Locked'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Choose which receiver the quarterback targets on pass progressions:
                  </p>
                  <select
                    id="playcall-hardmode-target-select"
                    value={selectedTargetPlayer}
                    onChange={(e) => setSelectedTargetPlayer(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-sans"
                  >
                    <option value="FIRST_READ">
                      ⭐ Primary Read: {primaryTargetInfo.name} ({primaryTargetInfo.slotLabel})
                    </option>
                    {teamReceivers.map((rec, rIdx) => (
                      <option key={`playcall-${rec.depthSlot}-${rec.name}-${rIdx}`} value={rec.name}>
                        {rec.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Conditional Play Style Variants (Run variants for Run plays, QB Trajectory for Pass plays) */}
              {!isUserOnDefense && (() => {
                const failPct = getTeamFailChancePercent(offenseTeam.ovr, game.difficulty);
                const powerNormalPct = Math.max(0, 50 - failPct);
                const powerMessUps = 25 + failPct;
                const speedNormalPct = Math.max(0, 50 - failPct);
                const speedMessUps = 25 + failPct;
                const patienceNormalPct = Math.max(0, 55 - failPct);
                const patienceMessUps = 30 + failPct;

                const strideNormalPct = Math.max(0, 80 - failPct);
                const strideMessUps = 10 + failPct;
                const straightNormalPct = Math.max(0, 80 - failPct);
                const straightMessUps = 10 + failPct;

                return selectedOffensePlay?.category === 'Run' ? (
                  /* Run Style Variant (Power, Speed, Patience) */
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Flame className="w-4 h-4 text-amber-400" />
                        <h4 className="font-display font-bold text-xs text-slate-200 uppercase tracking-wider">
                          Run Style (Optional)
                        </h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-amber-400/90 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                          Breakdown Rate: {failPct}%
                        </span>
                        {selectedRunVariant ? (
                          <button
                            type="button"
                            id="btn-clear-run-variant"
                            onClick={() => setSelectedRunVariant(undefined)}
                            className="text-[10px] text-slate-400 hover:text-white underline font-mono"
                          >
                            Reset Standard
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">Standard Rush</span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-tight">
                      Choose how the ball carrier attacks the defense. Click to activate, click again to toggle off. All mess up chances are added together ({failPct}% execution breakdown + backfires).
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* 1. Power */}
                      <button
                        type="button"
                        id="btn-variant-run-power"
                        onClick={() => setSelectedRunVariant(selectedRunVariant === 'power' ? undefined : 'power')}
                        className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                          selectedRunVariant === 'power'
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-md ring-1 ring-amber-500/50'
                            : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-display font-bold text-xs text-amber-300 flex items-center space-x-1">
                            <span>💥 Power</span>
                          </span>
                          {selectedRunVariant === 'power' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded font-mono font-bold">
                              25% 1st Down
                            </span>
                            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded font-mono font-bold">
                              {powerMessUps}% Mess Ups
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 line-clamp-2 leading-snug">
                            25% guaranteed 1st down, {powerMessUps}% total mess ups (25% fumble + {failPct}% breakdown), {powerNormalPct}% normal run.
                          </span>
                        </div>
                      </button>

                      {/* 2. Speed */}
                      <button
                        type="button"
                        id="btn-variant-run-speed"
                        onClick={() => setSelectedRunVariant(selectedRunVariant === 'speed' ? undefined : 'speed')}
                        className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                          selectedRunVariant === 'speed'
                            ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-md ring-1 ring-cyan-500/50'
                            : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-display font-bold text-xs text-cyan-300 flex items-center space-x-1">
                            <span>⚡ Speed</span>
                          </span>
                          {selectedRunVariant === 'speed' && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded font-mono font-bold">
                              25% Big Play
                            </span>
                            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded font-mono font-bold">
                              {speedMessUps}% Mess Ups
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 line-clamp-2 leading-snug">
                            25% big play gain, {speedMessUps}% total mess ups (25% TFL + {failPct}% breakdown), {speedNormalPct}% normal run.
                          </span>
                        </div>
                      </button>

                      {/* 3. Patience */}
                      <button
                        type="button"
                        id="btn-variant-run-patience"
                        onClick={() => setSelectedRunVariant(selectedRunVariant === 'patience' ? undefined : 'patience')}
                        className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                          selectedRunVariant === 'patience'
                            ? 'bg-purple-500/20 border-purple-500 text-white shadow-md ring-1 ring-purple-500/50'
                            : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-display font-bold text-xs text-purple-300 flex items-center space-x-1">
                            <span>🧘 Patience</span>
                          </span>
                          {selectedRunVariant === 'patience' && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded font-mono font-bold">
                              15% TD
                            </span>
                            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded font-mono font-bold">
                              {patienceMessUps}% Mess Ups
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 line-clamp-2 leading-snug">
                            15% breakaway touchdown, {patienceMessUps}% total mess ups (30% -10yd loss + {failPct}% breakdown), {patienceNormalPct}% normal run.
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* QB Throwing Trajectory Variant (Optional in all modes for Pass plays) */
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Radio className="w-4 h-4 text-cyan-400" />
                        <h4 className="font-display font-bold text-xs text-slate-200 uppercase tracking-wider">
                          QB Throw Trajectory (Optional)
                        </h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-cyan-400/90 font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/30">
                          Breakdown Rate: {failPct}%
                        </span>
                        {selectedThrowingVariant ? (
                          <button
                            type="button"
                            id="btn-clear-throwing-variant"
                            onClick={() => setSelectedThrowingVariant(undefined)}
                            className="text-[10px] text-slate-400 hover:text-white underline font-mono"
                          >
                            Reset Standard
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">Standard Delivery</span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-tight">
                      Choose how the QB delivers the football. Click to activate, click again to toggle off. All mess up chances are added together ({failPct}% execution breakdown + backfires).
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* 1. In Stride */}
                      <button
                        type="button"
                        id="btn-variant-in-stride"
                        onClick={() => setSelectedThrowingVariant(selectedThrowingVariant === 'in_stride' ? undefined : 'in_stride')}
                        className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                          selectedThrowingVariant === 'in_stride'
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-md ring-1 ring-amber-500/50'
                            : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-display font-bold text-xs text-amber-300 flex items-center space-x-1">
                            <span>⚡ In Stride</span>
                          </span>
                          {selectedThrowingVariant === 'in_stride' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded font-mono font-bold">
                              10% Big Play
                            </span>
                            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded font-mono font-bold">
                              {strideMessUps}% Mess Ups
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 line-clamp-2 leading-snug">
                            10% big RAC chunk, {strideMessUps}% mess ups (10% Inc + {failPct}% breakdown), {strideNormalPct}% normal pass.
                          </span>
                        </div>
                      </button>

                      {/* 2. Straight To Them */}
                      <button
                        type="button"
                        id="btn-variant-straight-to-them"
                        onClick={() => setSelectedThrowingVariant(selectedThrowingVariant === 'straight_to_them' ? undefined : 'straight_to_them')}
                        className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                          selectedThrowingVariant === 'straight_to_them'
                            ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-md ring-1 ring-cyan-500/50'
                            : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-display font-bold text-xs text-cyan-300 flex items-center space-x-1">
                            <span>🎯 Straight To</span>
                          </span>
                          {selectedThrowingVariant === 'straight_to_them' && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded font-mono font-bold">
                              10% Comp/1st
                            </span>
                            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded font-mono font-bold">
                              {straightMessUps}% Mess Ups
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 line-clamp-2 leading-snug">
                            10% completion/1st down, {straightMessUps}% mess ups (10% INT + {failPct}% breakdown), {straightNormalPct}% normal pass.
                          </span>
                        </div>
                      </button>

                      {/* 3. Lob Pass */}
                      <button
                        type="button"
                        id="btn-variant-lob-pass"
                        onClick={() => setSelectedThrowingVariant(selectedThrowingVariant === 'lob_pass' ? undefined : 'lob_pass')}
                        className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                          selectedThrowingVariant === 'lob_pass'
                            ? 'bg-purple-500/20 border-purple-500 text-white shadow-md ring-1 ring-purple-500/50'
                            : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-display font-bold text-xs text-purple-300 flex items-center space-x-1">
                            <span>🏈 Lob Pass</span>
                          </span>
                          {selectedThrowingVariant === 'lob_pass' && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded font-mono font-bold">
                              50% Catch
                            </span>
                            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded font-mono font-bold">
                              50% Mess Ups
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 line-clamp-2 leading-snug">
                            50% contested jump ball catch, 50% mess ups (25% INT + 25% Inc).
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* SCRIPTING CONSOLE (7 cols) */}
          <div className="lg:col-span-7">
            <PlayOutcomeScripter
              offenseTeam={offenseTeam}
              defenseTeam={defenseTeam}
              offensePlay={selectedOffensePlay}
              allOffensivePlays={allOffensivePlays}
              allDefensivePlays={allDefensivePlays}
              selectedOffensePlay={selectedOffensePlay}
              selectedDefensePlay={selectedDefensePlay}
              onSelectOffensePlay={setSelectedOffensePlay}
              onSelectDefensePlay={setSelectedDefensePlay}
              lastOffensivePlayId={game.lastOffensivePlayId}
              lastOffensivePlayName={game.lastOffensivePlayName}
              consecutiveSamePlayCount={game.consecutiveSamePlayCount}
              currentYardLine={game.yardLine}
              currentDown={game.down}
              currentDistance={game.distance}
              currentQuarterTimeSeconds={game.quarterTimeSeconds}
              quarter={game.quarter}
              homeScore={game.homeScore}
              awayScore={game.awayScore}
              homeTeamName={game.homeTeam.name}
              awayTeamName={game.awayTeam.name}
              possession={game.possession}
              onExecute={handleExecutePlay}
              disabled={isAnimating}
              onStartDrawPlayMode={() => setIsFieldDrawMode(true)}
              isDrawPlayModeActive={isFieldDrawMode}
              onInjuryTriggered={handleInjuryTriggered}
              isSeasonMode={isSeasonMode}
              isUserOnDefense={isUserOnDefense}
              difficulty={game.clashGameContext ? 'Hard' : game.difficulty}
              isClashMode={Boolean(game.clashGameContext)}
              selectedThrowingVariant={selectedThrowingVariant}
              onThrowingVariantChange={setSelectedThrowingVariant}
              selectedRunVariant={selectedRunVariant}
              onRunVariantChange={setSelectedRunVariant}
              selectedTargetPlayer={selectedTargetPlayer}
              onTargetPlayerChange={setSelectedTargetPlayer}
              onOpenFieldCam={() => {
                setIsFieldCamOpen(true);
                setFieldCamMode('pip');
              }}
              isOnlineMatch={Boolean(game.onlineMatchRoomId)}
              isPlaySubmittedLocally={isPlaySubmittedLocally}
              isOpponentPlaySubmitted={isOpponentPlaySubmitted}
              onResetPlayClock={() => setPlayClock(40)}
              onNotice={(msg) => {
                setSnapNotice(msg);
                setTimeout(() => setSnapNotice(null), 4000);
                if (game.difficulty === 'Hard') {
                  setHardModePopup({
                    result: {
                      outcomeType: 'NoGain',
                      yardsGained: 0,
                      commentary: msg,
                      isTouchdown: false,
                      isTurnover: false,
                      isSafety: false,
                      isFirstDown: false,
                      clockElapsedSeconds: 0,
                      stoppedClock: true,
                    },
                    timestamp: Date.now(),
                  });
                }
              }}
            />
          </div>
        </div>
      ) : (
        /* GAME OVER BANNER */
        <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-2 border-amber-500 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <span className="text-xs font-bold font-mono tracking-widest uppercase text-amber-400">
            FINAL SCORE
          </span>
          <h2 className="font-display font-black text-4xl text-white">
            {game.homeScore > game.awayScore
              ? `${game.homeTeam.name.toUpperCase()} WIN!`
              : game.awayScore > game.homeScore
              ? `${game.awayTeam.name.toUpperCase()} WIN!`
              : 'GAME TIED!'}
          </h2>
          <div className="font-display font-black text-5xl text-amber-400">
            {game.awayTeam.abbr} {game.awayScore} - {game.homeScore} {game.homeTeam.abbr}
          </div>

          {game.clashGameContext && game.homeScore > game.awayScore && (
            <div className="max-w-lg mx-auto bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/70 border-2 border-amber-400 rounded-3xl p-5 text-center space-y-4 shadow-2xl">
              <div className="flex items-center justify-center space-x-2 text-amber-300 font-display font-black text-xl">
                <Flame className="w-6 h-6 text-amber-400 animate-bounce" />
                <span>VICTORY REWARDS UNLOCKED!</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {/* Star Player Reward Card */}
                <div className="bg-slate-900/90 border border-amber-400/60 rounded-2xl p-3.5 space-y-1.5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded">
                      SUPERSTAR REWARD
                    </span>
                    <span className="text-xs font-black font-display bg-amber-400 text-slate-950 px-2 py-0.5 rounded">
                      {clashReward.card?.ovr || (userData.currentBossTier === 2 ? 80 : 75)} OVR
                    </span>
                  </div>
                  <div className="font-display font-black text-base uppercase text-white truncate drop-shadow">
                    {clashReward.card ? clashReward.card.name : game.clashGameContext.starPlayer}
                  </div>
                  <div className="text-[11px] text-slate-300 font-medium">
                    {clashReward.card ? clashReward.card.position : 'STAR'} • {clashReward.card ? clashReward.card.archetype : 'Pro Bowler'}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1 pt-1 border-t border-white/10">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Added to your Gridiron Clash Roster!</span>
                  </div>
                </div>

                {/* Grid Iron Wallet Reward */}
                <div className="bg-slate-900/90 border border-amber-400/60 rounded-2xl p-3.5 flex flex-col justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded">
                      CURRENCY
                    </span>
                    <div className="text-2xl font-black font-display text-white mt-1.5 flex items-center space-x-1.5">
                      <Shield className="w-5 h-5 text-amber-400 fill-amber-400" />
                      <span>+{userData.currentBossTier === 2 ? 5 : 1} GRID IRONS</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight pt-2 border-t border-white/10">
                    Hard Mode win bonus deposited into your wallet.
                  </p>
                </div>
              </div>

              <p className="text-xs text-amber-200/90 font-medium">
                Victory over {game.awayTeam.name} on Hard Mode. Equip your new {clashReward.card?.ovr || (userData.currentBossTier === 2 ? 80 : 75)} OVR star in the Active Lineup!
              </p>
            </div>
          )}

          <div className="pt-4 flex justify-center space-x-3">
            <button
              id="btn-return-menu-postgame"
              onClick={onExitGame}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm shadow-xl transition"
            >
              {game.clashGameContext ? 'RETURN TO GRIDIRON CLASH' : game.seasonGameContext ? 'RETURN TO SEASON HUB' : 'RETURN TO MAIN MENU'}
            </button>
          </div>
        </div>
      )}

      {/* BOX SCORE & STATS MODAL */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display font-bold text-lg text-white">
                GAME BOX SCORE & TEAM STATISTICS
              </h3>
              <button
                id="btn-close-stats-modal"
                onClick={() => setShowStatsModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2.5 py-1 bg-slate-800 rounded-lg"
              >
                ✕ Close
              </button>
            </div>

            {/* Score comparison */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <span className="font-bold text-slate-400 block text-xs">{game.awayTeam.name}</span>
                <span className="font-display font-black text-4xl text-white">{game.awayScore}</span>
              </div>
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <span className="font-bold text-slate-400 block text-xs">{game.homeTeam.name}</span>
                <span className="font-display font-black text-4xl text-white">{game.homeScore}</span>
              </div>
            </div>

            {/* Stat rows */}
            <div className="space-y-2 text-xs">
              {[
                { label: 'Total Net Yards', away: game.awayStats.totalYards, home: game.homeStats.totalYards },
                { label: 'Passing Yards', away: game.awayStats.passingYards, home: game.homeStats.passingYards },
                { label: 'Rushing Yards', away: game.awayStats.rushingYards, home: game.homeStats.rushingYards },
                { label: 'First Downs', away: game.awayStats.firstDowns, home: game.homeStats.firstDowns },
                {
                  label: '3rd Down Efficiency',
                  away: `${game.awayStats.thirdDownConverted}/${game.awayStats.thirdDownAttempts}`,
                  home: `${game.homeStats.thirdDownConverted}/${game.homeStats.thirdDownAttempts}`,
                },
                { label: 'Turnovers', away: game.awayStats.turnovers, home: game.homeStats.turnovers },
                { label: 'Sacks Recorded', away: game.awayStats.sacks, home: game.homeStats.sacks },
              ].map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/50"
                >
                  <span className="font-display font-bold text-slate-200 w-20">{row.away}</span>
                  <span className="font-semibold text-slate-400 text-center flex-1">{row.label}</span>
                  <span className="font-display font-bold text-slate-200 w-20 text-right">{row.home}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* In-Game Depth Chart Modal */}
      <GameStatLeadersModal
        isOpen={isStatModalOpen}
        onClose={() => setIsStatModalOpen(false)}
        homeStats={statLeaders?.home || []}
        awayStats={statLeaders?.away || []}
        homeTeamName={game.homeTeam.name}
        awayTeamName={game.awayTeam.name}
      />
      <InGameDepthChartModal
        isOpen={showDepthChartModal}
        onClose={() => setShowDepthChartModal(false)}
        game={game}
        setGame={setGame}
        onSyncSeasonRoster={handleSyncSeasonRoster}
      />

      {/* Floating & Expandable Field Cam (See field anytime without scrolling up) */}
      <FieldCamViewer
        game={game}
        offensePlay={selectedOffensePlay}
        defensePlay={selectedDefensePlay}
        isAnimating={isAnimating}
        animProgress={animProgress}
        lastResult={lastResult}
        isOpen={isFieldCamOpen}
        camMode={fieldCamMode}
        onToggleOpen={() => setIsFieldCamOpen(!isFieldCamOpen)}
        onSetCamMode={setFieldCamMode}
        onScrollToTopField={handleScrollToField}
        isFieldVisible={isFieldVisible}
      />
    </div>
  );
};
