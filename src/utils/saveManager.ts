import { FranchisePlayer, FranchiseSeasonState, SaveSlotData } from '../types/franchise';
import { generateNFLSchedule, initializeStandings, updateStandingsWithGame } from './seasonEngine';
import { generateInitialTeamRoster, generateDraftClass, generateFreeAgentsPool, generateDraftOrder, createWayneGarrettFreeAgent } from './aiRosterGenerator';
import { getTeamById } from '../data/teams';
import { extractPlayedStatsFromActiveGame, calculateGameXp, applyXpAndLevelUp, getMaxOvrForPlayer } from './playerLeveling';
import { populateCpuOffersForTop20 } from './freeAgencyEngine';
import { getWayneArchetypeForPosition } from './rosterUtils';

const SAVE_PREFIX = 'gridiron_save_slot_';
const ACTIVE_SLOT_KEY = 'gridiron_active_save_slot';

export function syncRosterRosterUpgrades(teamId: string, roster: FranchisePlayer[]): FranchisePlayer[] {
  // Ensure Wayne Garrett retains 99 across all stats at ANY position he is assigned to
  const normalizedRoster = roster.map((p) => {
    if (p.name === 'Wayne Garrett') {
      const pos = p.position || 'RB';
      return {
        ...p,
        position: pos,
        ovr: 99,
        speed: 99,
        strength: 99,
        agility: 99,
        awareness: 99,
        maxOvr: 99,
        potential: 'A+' as const,
        archetype: getWayneArchetypeForPosition(pos),
      };
    }
    return p;
  });

  if (teamId === 'LAR') {
    let updated = normalizedRoster.map((p) => {
      if (p.name === 'Matthew Stafford') {
        return {
          ...p,
          position: p.position || 'QB',
          ovr: 99,
          potential: 'A+' as const,
          awareness: 99,
          speed: Math.max(p.speed, 76),
          strength: Math.max(p.strength, 92),
          agility: Math.max(p.agility, 78),
        };
      }
      if (p.name === 'Puka Nacua') {
        return {
          ...p,
          position: p.position || 'WR',
          ovr: 99,
          potential: 'A+' as const,
          awareness: 99,
          speed: Math.max(p.speed, 96),
          agility: Math.max(p.agility, 98),
          strength: Math.max(p.strength, 86),
        };
      }
      if (p.name === 'Davante Adams') {
        return {
          ...p,
          position: p.position || 'WR',
          ovr: 97,
          potential: 'A+' as const,
          awareness: 99,
          speed: Math.max(p.speed, 94),
          agility: Math.max(p.agility, 97),
          strength: Math.max(p.strength, 82),
        };
      }
      if (p.name === 'Puna Ford') {
        return {
          ...p,
          position: p.position || 'DT',
          ovr: 92,
          potential: 'A' as const,
          strength: Math.max(p.strength, 96),
          awareness: Math.max(p.awareness, 90),
        };
      }
      // Every member of the O line for Saint Louis a 99 overall
      if (['OT', 'OG', 'C'].includes(p.position)) {
        return {
          ...p,
          ovr: 99,
          potential: 'A+' as const,
          strength: Math.max(p.strength, 98),
          awareness: Math.max(p.awareness, 99),
        };
      }
      if (p.name === 'Myles Garrett') {
        return { ...p, position: p.position || 'EDGE', ovr: 99 };
      }
      if (p.name === 'Trent McDuffie') {
        return { ...p, position: p.position || 'CB', ovr: 95 };
      }
      if (p.name === 'Jaylen Watson') {
        return { ...p, position: p.position || 'CB', ovr: 89 };
      }
      return p;
    });

    if (!updated.some((p) => p.name === 'Puna Ford')) {
      updated.push({
        id: 'p-LAR-dt-puna-ford',
        name: 'Puna Ford',
        position: 'DT',
        ovr: 92,
        potential: 'A',
        age: 28,
        college: 'Texas',
        speed: 76,
        strength: 96,
        agility: 78,
        awareness: 90,
        archetype: 'Run-Stuffing Juggernaut',
        salary: 6.0,
        contractYears: 2,
      });
    }

    if (!updated.some((p) => p.name === 'Davante Adams')) {
      updated.push({
        id: 'p-LAR-wr-davante-adams',
        name: 'Davante Adams',
        position: 'WR',
        ovr: 97,
        potential: 'A+',
        age: 31,
        college: 'Fresno State',
        speed: 94,
        strength: 82,
        agility: 97,
        awareness: 99,
        archetype: 'Route-Running Technician',
        salary: 28.0,
        contractYears: 2,
      });
    }

    if (!updated.some((p) => p.name === 'Myles Garrett')) {
      updated.push({
        id: 'p-LAR-edge-99',
        name: 'Myles Garrett',
        position: 'EDGE',
        ovr: 99,
        potential: 'A+',
        age: 28,
        college: 'Texas A&M',
        speed: 89,
        strength: 98,
        agility: 93,
        awareness: 99,
        archetype: 'Speed Dip Rusher',
        salary: 25.0,
        contractYears: 3,
      });
    }

    if (!updated.some((p) => p.name === 'Alaric Jackson')) {
      updated.push({
        id: 'p-LAR-ot-alaric-jackson',
        name: 'Alaric Jackson',
        position: 'OT',
        ovr: 99,
        potential: 'A+',
        age: 26,
        college: 'Iowa',
        speed: 76,
        strength: 99,
        agility: 78,
        awareness: 99,
        archetype: 'Pass Protection Wall',
        salary: 4.8,
        contractYears: 3,
      });
    }
    if (!updated.some((p) => p.name === 'Kevin Dotson')) {
      updated.push({
        id: 'p-LAR-og-kevin-dotson',
        name: 'Kevin Dotson',
        position: 'OG',
        ovr: 99,
        potential: 'A+',
        age: 27,
        college: 'Louisiana',
        speed: 75,
        strength: 99,
        agility: 76,
        awareness: 99,
        archetype: 'Road Grader',
        salary: 16.0,
        contractYears: 3,
      });
    }
    if (!updated.some((p) => p.name === 'Jonah Jackson')) {
      updated.push({
        id: 'p-LAR-c-jonah-jackson',
        name: 'Jonah Jackson',
        position: 'C',
        ovr: 99,
        potential: 'A+',
        age: 27,
        college: 'Ohio State',
        speed: 74,
        strength: 98,
        agility: 76,
        awareness: 99,
        archetype: 'Line Calling Mastermind',
        salary: 17.0,
        contractYears: 3,
      });
    }

    return updated;
  } else {
    // If not Saint Louis / Rams, delete Davante Adams from said roster
    return normalizedRoster.filter((p) => p.name !== 'Davante Adams');
  }
}

export function getActiveSlotId(): 1 | 2 | 3 {
  try {
    const saved = localStorage.getItem(ACTIVE_SLOT_KEY);
    if (saved === '1' || saved === '2' || saved === '3') {
      return Number(saved) as 1 | 2 | 3;
    }
  } catch {
    // fallback
  }
  return 1;
}

export function setActiveSlotId(slotId: 1 | 2 | 3): void {
  try {
    localStorage.setItem(ACTIVE_SLOT_KEY, String(slotId));
  } catch {
    // ignore
  }
}

export function loadSaveSlot(slotId: 1 | 2 | 3): SaveSlotData | null {
  try {
    const raw = localStorage.getItem(`${SAVE_PREFIX}${slotId}`);
    if (raw) {
      const parsedData: SaveSlotData = JSON.parse(raw);
      if (parsedData && parsedData.season) {
        if (parsedData.season.userRoster) {
          parsedData.season.userRoster = syncRosterRosterUpgrades(
            parsedData.season.userTeamId,
            parsedData.season.userRoster
          );
        }
        if (parsedData.season.cpuRosters) {
          for (const teamId of Object.keys(parsedData.season.cpuRosters)) {
            parsedData.season.cpuRosters[teamId] = syncRosterRosterUpgrades(
              teamId,
              parsedData.season.cpuRosters[teamId]
            );
          }
        }
        if (parsedData.season.freeAgentsPool) {
          parsedData.season.freeAgentsPool = parsedData.season.freeAgentsPool.filter(
            (p) => p.name !== 'Davante Adams'
          );
          // Keep Wayne Garrett 99 in FA pool if present
          parsedData.season.freeAgentsPool = parsedData.season.freeAgentsPool.map((p) => {
            if (p.name === 'Wayne Garrett') {
              return {
                ...p,
                position: 'RB' as const,
                ovr: 99,
                speed: 99,
                strength: 99,
                agility: 99,
                awareness: 99,
                maxOvr: 99,
                potential: 'A+' as const,
                archetype: 'Elusive Power Back',
                scoutingNotes: 'Elite running back with supreme burst, devastating tackle-breaking strength, and open-field elusiveness.',
                scoutedStats: ['Elite Speed', 'Elite Power', 'Elite Agility', 'Field Vision'],
              };
            }
            return p;
          });
        }

        // Ensure Wayne Garrett is in free agent pool if not on any roster or in pool
        const isWayneOnUserRoster = parsedData.season.userRoster?.some((p: any) => p.name === 'Wayne Garrett');
        const isWayneOnCpuRoster = parsedData.season.cpuRosters && Object.values(parsedData.season.cpuRosters).some((r: any) => (r as any[]).some((p) => p.name === 'Wayne Garrett'));
        const isWayneInPool = parsedData.season.freeAgentsPool?.some((p: any) => p.name === 'Wayne Garrett');

        if (!isWayneOnUserRoster && !isWayneOnCpuRoster && !isWayneInPool) {
          const wayneFA = createWayneGarrettFreeAgent(parsedData.season.seasonYear || 2026);
          if (parsedData.season.difficulty === 'Hard') {
            parsedData.season.freeAgentsPool = [
              ...(parsedData.season.freeAgentsPool || []),
              wayneFA,
            ];
          } else {
            parsedData.season.freeAgentsPool = [
              wayneFA,
              ...(parsedData.season.freeAgentsPool || []),
            ];
          }
        }

        // Ensure top 20 free agents have active offers from eligible teams
        if (parsedData.season.freeAgentsPool) {
          parsedData.season.freeAgentsPool = populateCpuOffersForTop20(parsedData.season, false);
          // In Hard Mode, keep Wayne Garrett at the very bottom of the free agent list
          if (parsedData.season.difficulty === 'Hard') {
            const nonWayne = parsedData.season.freeAgentsPool.filter((p: any) => p.name !== 'Wayne Garrett');
            const wayne = parsedData.season.freeAgentsPool.filter((p: any) => p.name === 'Wayne Garrett');
            parsedData.season.freeAgentsPool = [...nonWayne, ...wayne];
          }
        }
      }
      return parsedData;
    }
    // Also check backward compatibility for legacy key if slot 1
    if (slotId === 1) {
      const legacy = localStorage.getItem('gridiron_nfl_season');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        const userTeam = getTeamById(parsed.userTeamId || 'KC');
        const defaultRoster = generateInitialTeamRoster(userTeam);
        const draftClass = generateDraftClass(2026);
        const freeAgents = generateFreeAgentsPool(2026);
        const draftPicks = generateDraftOrder(parsed.standings || {}, userTeam.id, parsed.playoffs);

        const franchiseState: FranchiseSeasonState = {
          id: parsed.id || `season-${Date.now()}`,
          slotId: 1,
          userTeamId: parsed.userTeamId || 'KC',
          seasonYear: 2026,
          currentWeek: parsed.currentWeek || 1,
          stage: parsed.currentWeek > 22 ? 'Offseason_FreeAgency' : parsed.currentWeek > 18 ? 'Playoffs' : 'RegularSeason',
          schedule: parsed.schedule || generateNFLSchedule(userTeam.id),
          standings: parsed.standings || initializeStandings(),
          playoffs: parsed.playoffs,
          isSeasonComplete: parsed.isSeasonComplete || false,
          salaryCap: 240.0,
          usedCap: defaultRoster.reduce((sum, p) => sum + p.salary, 0),
          userRoster: defaultRoster,
          freeAgentsPool: freeAgents,
          draftClass: draftClass,
          draftPicks: draftPicks,
          currentDraftPickIndex: 0,
          isDraftCompleted: false,
          draftHistory: [],
          transactions: [{ date: 'Week 1', text: 'Franchise season initialized.', type: 'signing' }],
        };

        const saveObj: SaveSlotData = {
          slotId: 1,
          saveName: `${userTeam.name} Franchise`,
          savedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          season: franchiseState,
        };
        saveToSlot(1, franchiseState);
        return saveObj;
      }
    }
  } catch (err) {
    console.error('Error loading save slot', err);
  }
  return null;
}

export function getAllSaveSlots(): { [key in 1 | 2 | 3]: SaveSlotData | null } {
  return {
    1: loadSaveSlot(1),
    2: loadSaveSlot(2),
    3: loadSaveSlot(3),
  };
}

export function saveToSlot(slotId: 1 | 2 | 3, season: FranchiseSeasonState): void {
  try {
    if (season.userRoster) {
      season.userRoster = syncRosterRosterUpgrades(season.userTeamId, season.userRoster);
    }
    if (season.cpuRosters) {
      for (const teamId of Object.keys(season.cpuRosters)) {
        season.cpuRosters[teamId] = syncRosterRosterUpgrades(teamId, season.cpuRosters[teamId]);
      }
    }
    if (season.freeAgentsPool) {
      season.freeAgentsPool = season.freeAgentsPool.filter((p) => p.name !== 'Davante Adams');
    }

    const userTeam = getTeamById(season.userTeamId);
    
    // Manage history checkpoints: only record distinct milestones
    let history = Array.isArray(season.history) ? season.history : [];
    
    // Check if this current milestone is already recorded
    const existingIndex = history.findIndex(
      (h) => h.seasonYear === season.seasonYear && h.currentWeek === season.currentWeek && h.stage === season.stage
    );

    const currentSnapshot: FranchiseSeasonState = JSON.parse(
      JSON.stringify({ ...season, history: undefined })
    );

    if (existingIndex >= 0) {
      // Update existing snapshot for current week/stage
      history[existingIndex] = currentSnapshot;
    } else {
      // Prepend new milestone snapshot, keep up to 12 checkpoints
      history = [currentSnapshot, ...history].slice(0, 12);
    }
    season.history = history;

    const existingSlot = loadSaveSlot(slotId);
    const currentSaveName = existingSlot?.saveName;

    const saveObj: SaveSlotData = {
      slotId,
      saveName: currentSaveName || `${userTeam.city} ${userTeam.name} (Year ${season.seasonYear})`,
      savedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      season,
    };
    localStorage.setItem(`${SAVE_PREFIX}${slotId}`, JSON.stringify(saveObj));
    // Also keep legacy key synced for slot 1
    if (slotId === 1) {
      localStorage.setItem('gridiron_nfl_season', JSON.stringify({
        id: season.id,
        userTeamId: season.userTeamId,
        currentWeek: season.currentWeek,
        schedule: season.schedule,
        standings: season.standings,
        playoffs: season.playoffs,
        isSeasonComplete: season.isSeasonComplete,
      }));
    }
  } catch (err) {
    console.error('Error saving to slot', err);
  }
}

export function renameSaveSlot(slotId: 1 | 2 | 3, newName: string): boolean {
  try {
    const raw = localStorage.getItem(`${SAVE_PREFIX}${slotId}`);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    parsed.saveName = newName.trim() || `Franchise Slot #${slotId}`;
    localStorage.setItem(`${SAVE_PREFIX}${slotId}`, JSON.stringify(parsed));
    return true;
  } catch (err) {
    console.error('Error renaming save slot', err);
    return false;
  }
}

export function deleteSaveSlot(slotId: 1 | 2 | 3): void {
  try {
    localStorage.removeItem(`${SAVE_PREFIX}${slotId}`);
    if (slotId === 1) {
      localStorage.removeItem('gridiron_nfl_season');
    }
  } catch {
    // ignore
  }
}

export function createNewFranchiseSeason(
  teamId: string,
  slotId: 1 | 2 | 3,
  year: number = 2026,
  difficulty: 'Script' | 'Hard' = 'Script'
): FranchiseSeasonState {
  const team = getTeamById(teamId);
  const newSchedule = generateNFLSchedule(teamId);
  const newStandings = initializeStandings();
  const roster = generateInitialTeamRoster(team);
  const draftClass = generateDraftClass(year);
  const freeAgents = generateFreeAgentsPool(year);
  const draftPicks = generateDraftOrder(newStandings, teamId);

  const usedCap = roster.reduce((acc, p) => acc + p.salary, 0);

  const newSeason: FranchiseSeasonState = {
    id: `season-${slotId}-${Date.now()}`,
    slotId,
    userTeamId: teamId,
    seasonYear: year,
    currentWeek: 1,
    stage: 'RegularSeason',
    schedule: newSchedule,
    standings: newStandings,
    isSeasonComplete: false,
    salaryCap: 240.0,
    usedCap: Math.round(usedCap * 10) / 10,
    userRoster: roster,
    freeAgentsPool: freeAgents,
    draftClass: draftClass,
    draftPicks: draftPicks,
    currentDraftPickIndex: 0,
    isDraftCompleted: false,
    draftHistory: [],
    difficulty,
    transactions: [
      {
        date: `${year} Pre-Season`,
        text: `${team.name} named new Head Coach & General Manager (${difficulty === 'Hard' ? 'Hard Mode' : 'Script Mode'}).`,
        type: 'signing',
      }
    ],
  };

  newSeason.freeAgentsPool = populateCpuOffersForTop20(newSeason, true);

  // In Hard Mode, keep Wayne Garrett at the very bottom of the free agent list
  if (difficulty === 'Hard' && newSeason.freeAgentsPool) {
    const nonWayne = newSeason.freeAgentsPool.filter((p) => p.name !== 'Wayne Garrett');
    const wayne = newSeason.freeAgentsPool.filter((p) => p.name === 'Wayne Garrett');
    newSeason.freeAgentsPool = [...nonWayne, ...wayne];
  }

  saveToSlot(slotId, newSeason);
  setActiveSlotId(slotId);
  return newSeason;
}

export function syncFinishedGameToActiveSlot(
  finishedGame: {
    homeTeam: { id: string; starQB?: string };
    awayTeam: { id: string; starQB?: string };
    homeScore: number;
    awayScore: number;
    seasonGameContext?: { week: number; isPlayoff: boolean; playoffRound?: string };
  }
): void {
  if (!finishedGame.seasonGameContext) return;
  const slotId = getActiveSlotId();
  const slotData = loadSaveSlot(slotId);
  if (!slotData) return;

  const season = slotData.season;
  const { week, isPlayoff, playoffRound } = finishedGame.seasonGameContext;

  if (!isPlayoff) {
    const gameInSchedule = season.schedule.find(
      (g) =>
        g.week === week &&
        ((g.homeTeamId === finishedGame.homeTeam.id && g.awayTeamId === finishedGame.awayTeam.id) ||
          (g.homeTeamId === finishedGame.awayTeam.id && g.awayTeamId === finishedGame.homeTeam.id))
    );

    if (gameInSchedule) {
      gameInSchedule.homeScore = finishedGame.homeScore;
      gameInSchedule.awayScore = finishedGame.awayScore;
      gameInSchedule.isPlayed = true;

      updateStandingsWithGame(
        season.standings,
        finishedGame.homeTeam.id,
        finishedGame.awayTeam.id,
        finishedGame.homeScore,
        finishedGame.awayScore
      );
    }
  } else if (season.playoffs) {
    const bracket = season.playoffs;
    let matchup: any = null;

    if (playoffRound === 'Wild Card') {
      matchup = bracket.wildCard.find(
        (m: any) =>
          (m.homeTeamId === finishedGame.homeTeam.id && m.awayTeamId === finishedGame.awayTeam.id) ||
          (m.homeTeamId === finishedGame.awayTeam.id && m.awayTeamId === finishedGame.homeTeam.id)
      );
    } else if (playoffRound === 'Divisional') {
      matchup = bracket.divisional.find(
        (m: any) =>
          (m.homeTeamId === finishedGame.homeTeam.id && m.awayTeamId === finishedGame.awayTeam.id) ||
          (m.homeTeamId === finishedGame.awayTeam.id && m.awayTeamId === finishedGame.homeTeam.id)
      );
    } else if (playoffRound?.includes('Championship')) {
      matchup = bracket.conference.find(
        (m: any) =>
          (m.homeTeamId === finishedGame.homeTeam.id && m.awayTeamId === finishedGame.awayTeam.id) ||
          (m.homeTeamId === finishedGame.awayTeam.id && m.awayTeamId === finishedGame.homeTeam.id)
      );
    } else if (playoffRound?.includes('Super Bowl')) {
      matchup = bracket.superBowl;
    }

    if (matchup) {
      matchup.homeScore = finishedGame.homeScore;
      matchup.awayScore = finishedGame.awayScore;
      matchup.isPlayed = true;
      matchup.winnerId =
        finishedGame.homeScore > finishedGame.awayScore
          ? finishedGame.homeTeam.id
          : finishedGame.awayTeam.id;

      if (playoffRound?.includes('Super Bowl')) {
        bracket.championId = matchup.winnerId;
        const champRaw = finishedGame.homeScore > finishedGame.awayScore ? finishedGame.homeTeam : finishedGame.awayTeam;
        const loserRaw = finishedGame.homeScore > finishedGame.awayScore ? finishedGame.awayTeam : finishedGame.homeTeam;
        const champ = getTeamById(champRaw.id);
        const loser = getTeamById(loserRaw.id);
        bracket.mvp = champ.starQB || 'Super Bowl MVP';
        season.isSeasonComplete = true;
        season.stage = 'Offseason_FreeAgency';

        const userWonSB = matchup.winnerId === season.userTeamId;
        season.wonSuperBowlLastSeason = userWonSB;

        season.superBowlWinnerHistory = season.superBowlWinnerHistory || [];
        season.superBowlWinnerHistory.push({
          seasonYear: season.seasonYear || 2026,
          winnerId: champ.id,
          winnerName: `${champ.city} ${champ.name}`,
          loserId: loser.id,
          loserName: `${loser.city} ${loser.name}`,
          score: `${Math.max(finishedGame.homeScore, finishedGame.awayScore)} - ${Math.min(finishedGame.homeScore, finishedGame.awayScore)}`,
          mvp: bracket.mvp,
        });
      }
    }
  }

  // Player Stats & Leveling Progression
  if (season.userRoster && season.userRoster.length > 0) {
    const isUserGame = finishedGame.homeTeam.id === season.userTeamId || finishedGame.awayTeam.id === season.userTeamId;
    if (isUserGame) {
      let playerStatsMap: Record<string, any> = {};
      if ((finishedGame as any).playLog && (finishedGame as any).playLog.length > 0) {
        playerStatsMap = extractPlayedStatsFromActiveGame(finishedGame as any, season.userTeamId, season.userRoster);
      }

      const isHome = finishedGame.homeTeam.id === season.userTeamId;
      const opponentTeamRaw = isHome ? finishedGame.awayTeam : finishedGame.homeTeam;
      const opponentTeam = getTeamById(opponentTeamRaw.id);
      const userScore = isHome ? finishedGame.homeScore : finishedGame.awayScore;
      const oppScore = isHome ? finishedGame.awayScore : finishedGame.homeScore;
      const isWin = userScore > oppScore;

      const updatedRoster = season.userRoster.map((player) => {
        const maxOvr = getMaxOvrForPlayer(player);
        const stats = playerStatsMap[player.id];

        let updatedPlayer = { ...player };

        // Accumulate player stats and append game log
        if (stats && stats.played) {
          const prevStats = updatedPlayer.seasonStats || {
            gamesPlayed: 0,
            passAttempts: 0,
            passCompletions: 0,
            passYards: 0,
            passTds: 0,
            interceptions: 0,
            rushAttempts: 0,
            rushYards: 0,
            rushTds: 0,
            receptions: 0,
            targets: 0,
            recYards: 0,
            recTds: 0,
            tackles: 0,
            sacks: 0,
            interceptionsCaught: 0,
            forcedFumbles: 0,
            fieldGoalsMade: 0,
            fieldGoalsAttempted: 0,
            extraPointsMade: 0,
          };

          const pY = stats.passYards || 0;
          const pTd = stats.passTds || 0;
          const pInt = stats.interceptions || 0;
          const rAtt = stats.rushAttempts || 0;
          const rY = stats.rushYards || 0;
          const rTd = stats.rushTds || 0;
          const rec = stats.receptions || 0;
          const recY = stats.recYards || 0;
          const recTd = stats.recTds || 0;
          const tkl = stats.tackles || 0;
          const sck = stats.sacks || 0;
          const defInt = stats.defInts || 0;

          updatedPlayer.seasonStats = {
            gamesPlayed: prevStats.gamesPlayed + 1,
            passAttempts: prevStats.passAttempts + (pY > 0 ? Math.max(10, Math.round(pY / 8)) : 0),
            passCompletions: prevStats.passCompletions + (pY > 0 ? Math.max(7, Math.round(pY / 12)) : 0),
            passYards: prevStats.passYards + pY,
            passTds: prevStats.passTds + pTd,
            interceptions: prevStats.interceptions + pInt,
            rushAttempts: prevStats.rushAttempts + rAtt,
            rushYards: prevStats.rushYards + rY,
            rushTds: prevStats.rushTds + rTd,
            receptions: prevStats.receptions + rec,
            targets: prevStats.targets + (rec > 0 ? rec + 2 : 0),
            recYards: prevStats.recYards + recY,
            recTds: prevStats.recTds + recTd,
            tackles: prevStats.tackles + tkl,
            sacks: prevStats.sacks + sck,
            interceptionsCaught: prevStats.interceptionsCaught + defInt,
            forcedFumbles: prevStats.forcedFumbles || 0,
            fieldGoalsMade: prevStats.fieldGoalsMade || 0,
            fieldGoalsAttempted: prevStats.fieldGoalsAttempted || 0,
            extraPointsMade: prevStats.extraPointsMade || 0,
          };

          const logEntry = {
            week: week || season.currentWeek,
            seasonYear: season.seasonYear || 2026,
            opponentId: opponentTeam.id,
            opponentAbbr: opponentTeam.abbr,
            isHome,
            teamScore: userScore,
            oppScore,
            isWin,
            stats: {
              passYards: pY,
              passTds: pTd,
              interceptions: pInt,
              rushAttempts: rAtt,
              rushYards: rY,
              rushTds: rTd,
              receptions: rec,
              recYards: recY,
              recTds: recTd,
              tackles: tkl,
              sacks: sck,
              interceptionsCaught: defInt,
            },
          };

          updatedPlayer.gameLogs = [...(updatedPlayer.gameLogs || []), logEntry];
        }

        if (player.age >= 28) {
          return { ...updatedPlayer, maxOvr, level: player.level || 1, xp: player.xp || 0 };
        }

        if (stats && stats.played) {
          const { xp, statSummary } = calculateGameXp(player, stats);
          const { updatedPlayer: leveledPlayer, leveledUp } = applyXpAndLevelUp(updatedPlayer, xp, week, statSummary);
          if (leveledUp) {
            season.transactions = season.transactions || [];
            season.transactions.push({
              date: isPlayoff ? (playoffRound || 'Playoffs') : `Week ${week}`,
              text: `⚡ LEVEL UP! ${leveledPlayer.position} ${leveledPlayer.name} reached Level ${leveledPlayer.level} (+5 OVR)! Overall is now ${leveledPlayer.ovr} OVR (Max: ${leveledPlayer.maxOvr}).`,
              type: 'signing',
            });
          }
          return leveledPlayer;
        }

        return { ...updatedPlayer, maxOvr, level: player.level || 1, xp: player.xp || 0 };
      });

      season.userRoster = updatedRoster;
    }
  }

  saveToSlot(slotId, season);
}

export function advanceToNextFranchiseYear(currentSeason: FranchiseSeasonState): FranchiseSeasonState {
  const nextYear = (currentSeason.seasonYear || 2026) + 1;
  const newSchedule = generateNFLSchedule(currentSeason.userTeamId);
  const newStandings = initializeStandings();
  const nextDraftClass = generateDraftClass(nextYear);
  let nextFreeAgents = generateFreeAgentsPool(nextYear);
  const nextDraftPicks = generateDraftOrder(
    currentSeason.standings || {},
    currentSeason.userTeamId,
    currentSeason.playoffs
  );

  const isWayneSigned = currentSeason.userRoster.some((p) => p.name === 'Wayne Garrett') ||
    (currentSeason.cpuRosters && Object.values(currentSeason.cpuRosters).some((r) => (r as any[]).some((p) => p.name === 'Wayne Garrett')));

  if (isWayneSigned) {
    nextFreeAgents = nextFreeAgents.filter((p) => p.name !== 'Wayne Garrett');
  }

  // Archive completed season player stats history
  const historicalArchive = [
    ...(currentSeason.seasonPlayerStatsHistory || []),
    {
      seasonYear: currentSeason.seasonYear || 2026,
      players: currentSeason.userRoster || [],
    },
  ];

  const userWonLastSB = currentSeason.playoffs?.championId === currentSeason.userTeamId;

  // Age existing players, archive their stats to careerStats, and adjust ratings slightly
  const updatedRoster = currentSeason.userRoster.map((p) => {
    const careerStats = [
      ...(p.careerStats || []),
      ...(p.seasonStats ? [{ seasonYear: currentSeason.seasonYear || 2026, teamId: currentSeason.userTeamId, stats: p.seasonStats }] : []),
    ];

    if (p.name === 'Wayne Garrett') {
      const pos = p.position || 'RB';
      return {
        ...p,
        position: pos,
        archetype: getWayneArchetypeForPosition(pos),
        age: p.age + 1,
        ovr: 99,
        speed: 99,
        strength: 99,
        agility: 99,
        awareness: 99,
        maxOvr: 99,
        potential: 'A+' as const,
        isRookie: false,
        careerStats,
        seasonStats: undefined,
        gameLogs: [],
      };
    }

    let ovrChange = 0;
    if (p.age <= 24) ovrChange = Math.floor(Math.random() * 3) + 1; // young players develop (+1 to +3)
    else if (p.age >= 32) ovrChange = -(Math.floor(Math.random() * 3) + 1); // veteran regression (-1 to -3)

    return {
      ...p,
      age: p.age + 1,
      ovr: Math.min(99, Math.max(65, p.ovr + ovrChange)),
      isRookie: false,
      careerStats,
      seasonStats: undefined,
      gameLogs: [],
    };
  });

  const nextSeasonState: FranchiseSeasonState = {
    id: `season-${currentSeason.slotId}-${Date.now()}`,
    slotId: currentSeason.slotId,
    userTeamId: currentSeason.userTeamId,
    seasonYear: nextYear,
    currentWeek: 1,
    stage: 'RegularSeason',
    schedule: newSchedule,
    standings: newStandings,
    isSeasonComplete: false,
    salaryCap: currentSeason.salaryCap + 10.0, // salary cap increases by $10M each year
    usedCap: updatedRoster.reduce((sum, p) => sum + p.salary, 0),
    userRoster: updatedRoster,
    freeAgentsPool: nextFreeAgents,
    draftClass: nextDraftClass,
    draftPicks: nextDraftPicks,
    currentDraftPickIndex: 0,
    isDraftCompleted: false,
    draftHistory: [],
    difficulty: currentSeason.difficulty || 'Script',
    wonSuperBowlLastSeason: userWonLastSB,
    superBowlWinnerHistory: currentSeason.superBowlWinnerHistory || [],
    seasonPlayerStatsHistory: historicalArchive,
    transactions: [
      {
        date: `Year ${nextYear} Kickoff`,
        text: `Commenced ${nextYear} NFL Franchise Season with active 53-man depth chart.`,
        type: 'signing',
      },
    ],
  };

  saveToSlot(currentSeason.slotId, nextSeasonState);
  return nextSeasonState;
}

