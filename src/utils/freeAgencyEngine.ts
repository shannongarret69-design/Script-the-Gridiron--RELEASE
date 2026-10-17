import { FranchisePlayer, FreeAgent, FreeAgentOffer, FranchiseSeasonState } from '../types/franchise';
import { NFLTeam } from '../types/game';
import { NFL_TEAMS, getTeamById } from '../data/teams';
import { generateInitialTeamRoster } from './aiRosterGenerator';

/**
 * Calculates a player's contract satisfaction score (0 - 100) based on salary,
 * bonus, contract length, and team quality.
 */
export function calculateOfferSatisfaction(
  player: FreeAgent,
  salary: number,
  bonus: number,
  years: number,
  teamOvr: number,
  isDefendingChampion: boolean = false
): number {
  const asking = Math.max(1.0, player.askingSalary);

  // Salary comparison (50% weight)
  const salaryRatio = salary / asking;
  const salaryScore = Math.min(100, salaryRatio * 75);

  // Bonus comparison (25% weight)
  const expectedBonus = Math.max(0.5, asking * 0.25);
  const bonusRatio = bonus / expectedBonus;
  const bonusScore = Math.min(100, bonusRatio * 80);

  // Years suitability (15% weight)
  let yearScore = 75;
  if (player.age >= 32 && years <= 2) yearScore = 95;
  else if (player.age >= 32 && years >= 4) yearScore = 40;
  else if (player.age <= 26 && years >= 3) yearScore = 95;
  else if (player.age <= 26 && years === 1) yearScore = 50;

  // Team Contender / Prestige bonus (10% weight)
  const teamBonus = (teamOvr - 70) * 0.8;

  // Defending Super Bowl Champion bonus (+12 satisfaction boost / -12 satisfaction needed)
  const championBonus = isDefendingChampion ? 12 : 0;

  const total = Math.round(
    salaryScore * 0.5 + bonusScore * 0.25 + yearScore * 0.15 + teamBonus + championBonus
  );

  return Math.min(99, Math.max(5, total));
}

/**
 * Calculate position ratings for an NFL team's roster.
 */
export function getTeamPositionRatings(team: NFLTeam, roster: FranchisePlayer[]): Record<string, number> {
  const positions: Array<'QB' | 'RB' | 'WR' | 'TE' | 'OT' | 'EDGE' | 'DT' | 'MLB' | 'CB' | 'FS' | 'K'> = [
    'QB', 'RB', 'WR', 'TE', 'OT', 'EDGE', 'DT', 'MLB', 'CB', 'FS', 'K'
  ];
  const ratings: Record<string, number> = {};

  for (const pos of positions) {
    const playersAtPos = roster.filter((p) => {
      if (pos === 'OT') return p.position === 'OT' || p.position === 'OG' || p.position === 'C';
      if (pos === 'EDGE') return p.position === 'EDGE' || (p.position as string) === 'DE';
      if (pos === 'FS') return p.position === 'FS' || (p.position as string) === 'SS';
      return p.position === pos;
    });

    if (playersAtPos.length === 0) {
      ratings[pos] = 60; // Critical team hole
    } else {
      playersAtPos.sort((a, b) => b.ovr - a.ovr);
      const starterOvr = playersAtPos[0].ovr;
      const backupOvr = playersAtPos[1] ? playersAtPos[1].ovr : starterOvr - 12;
      ratings[pos] = Math.round(starterOvr * 0.7 + backupOvr * 0.3);
    }
  }

  return ratings;
}

/**
 * Returns the lowest 3 rated positions for a team.
 * Teams only submit free agency offers to players matching their lowest 3 positions.
 */
export function getTeamLowestRatedPositions(team: NFLTeam, roster: FranchisePlayer[]): string[] {
  const ratings = getTeamPositionRatings(team, roster);
  return Object.entries(ratings)
    .sort((a, b) => a[1] - b[1]) // Ascending by rating
    .slice(0, 3) // Take bottom 3 positions
    .map(([pos]) => pos);
}

/**
 * Ensures the top 20 ranked free agents have competitive offers from eligible CPU teams
 * whose lowest 3 rated positions include the player's position.
 * Offers are generated close to the recommended asking terms.
 */
export function populateCpuOffersForTop20(
  season: FranchiseSeasonState,
  forceRefresh: boolean = false
): FreeAgent[] {
  if (!season.freeAgentsPool || season.freeAgentsPool.length === 0) {
    return [];
  }

  const pool = [...season.freeAgentsPool];
  // Sort pool by OVR descending to find top 20
  const sortedIndices = pool
    .map((fa, index) => ({ fa, index }))
    .sort((a, b) => b.fa.ovr - a.fa.ovr);

  const top20Indices = new Set(sortedIndices.slice(0, 20).map((item) => item.index));

  const cpuRosters = season.cpuRosters || {};
  const allCpuTeams = NFL_TEAMS.filter((t) => t.id !== season.userTeamId);

  // Pre-calculate lowest 3 positions for all CPU teams
  const teamNeedsMap: Record<string, string[]> = {};
  for (const team of allCpuTeams) {
    let roster = cpuRosters[team.id];
    if (!roster || roster.length === 0) {
      roster = generateInitialTeamRoster(team);
    }
    teamNeedsMap[team.id] = getTeamLowestRatedPositions(team, roster);
  }

  // Iterate through each player
  for (let i = 0; i < pool.length; i++) {
    const isTop20 = top20Indices.has(i);
    const fa = pool[i];

    if (!isTop20) {
      continue;
    }

    // Check if player already has active CPU offers and we're not forcing refresh
    const existingCpuOffers = (fa.activeOffers || []).filter((o) => !o.isUser);
    if (existingCpuOffers.length > 0 && !forceRefresh) {
      continue;
    }

    // Preserve any existing user offer
    const userOffer = (fa.activeOffers || []).find((o) => o.isUser);

    // Find all CPU teams whose lowest 3 positions include fa.position
    const eligibleTeams = allCpuTeams.filter((team) => {
      const needs = teamNeedsMap[team.id] || [];
      return needs.includes(fa.position);
    });

    if (eligibleTeams.length === 0) {
      // If no team strictly has this in bottom 3, allow top 2 needy teams for top talent
      eligibleTeams.push(...allCpuTeams.slice(0, 2));
    }

    // Shuffle eligible teams and pick between 1 and 4 teams to make offers
    const shuffled = [...eligibleTeams].sort(() => Math.random() - 0.5);
    const numBidders = Math.min(shuffled.length, Math.floor(Math.random() * 3) + 2); // 2 to 4 teams
    const biddingTeams = shuffled.slice(0, numBidders);

    // Recommended baseline terms
    const recommendedSalary = fa.askingSalary;
    const recommendedBonus = Math.max(1.0, Math.round(fa.askingSalary * 0.3 * 10) / 10);
    const recommendedYears = fa.age >= 31 ? 2 : fa.age <= 25 ? 4 : 3;

    const newOffers: FreeAgentOffer[] = [];

    // If user previously submitted an offer, keep it
    if (userOffer) {
      newOffers.push(userOffer);
    }

    for (const team of biddingTeams) {
      // Offer close to the recommended terms:
      // Salary within 94% to 108% of recommended salary
      const salaryMultiplier = 0.94 + Math.random() * 0.14;
      const offeredSalary = Math.max(1.0, Math.round(recommendedSalary * salaryMultiplier * 10) / 10);

      // Bonus within 92% to 115% of recommended bonus
      const bonusMultiplier = 0.92 + Math.random() * 0.23;
      const offeredBonus = Math.max(0.5, Math.round(recommendedBonus * bonusMultiplier * 10) / 10);

      // Years: recommended years, with occasional 1-year variance
      let offeredYears = recommendedYears;
      const yearRoll = Math.random();
      if (yearRoll < 0.2 && recommendedYears > 1) {
        offeredYears -= 1;
      } else if (yearRoll > 0.8 && recommendedYears < 5) {
        offeredYears += 1;
      }

      const satisfaction = calculateOfferSatisfaction(
        fa,
        offeredSalary,
        offeredBonus,
        offeredYears,
        team.ovr
      );

      newOffers.push({
        id: `offer-${team.id}-${fa.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        teamId: team.id,
        teamName: team.name,
        teamCity: team.city,
        primaryColor: team.primaryColor,
        salary: offeredSalary,
        bonus: offeredBonus,
        years: offeredYears,
        satisfaction,
        submittedWeek: season.currentWeek || 1,
        isUser: false,
      });
    }

    // Sort offers by satisfaction descending
    newOffers.sort((a, b) => b.satisfaction - a.satisfaction);

    pool[i] = {
      ...fa,
      activeOffers: newOffers,
      leadingOffer: newOffers[0] || undefined,
    };
  }

  return pool;
}

export interface ResolvedSigningsSummary {
  player: FranchisePlayer;
  winningOffer: FreeAgentOffer;
  isUser: boolean;
}

/**
 * Resolves all active Free Agent offers at the end of the in-game week.
 * The offer that provides the highest satisfaction signs the player.
 * If user wins, player is added to userRoster.
 * If CPU team wins, player is added to cpuRosters[teamId].
 * Signed players are removed from the pool.
 * New offers are then populated for the next week's top 20.
 */
export function resolveWeeklyFreeAgentBids(
  season: FranchiseSeasonState
): {
  updatedSeason: FranchiseSeasonState;
  resolvedSignings: ResolvedSigningsSummary[];
} {
  const currentPool = season.freeAgentsPool || [];
  const resolvedSignings: ResolvedSigningsSummary[] = [];

  let updatedUserRoster = [...season.userRoster];
  const updatedCpuRosters: Record<string, FranchisePlayer[]> = { ...(season.cpuRosters || {}) };
  const remainingPool: FreeAgent[] = [];
  const newTransactions = [...season.transactions];

  for (const fa of currentPool) {
    const offers = fa.activeOffers || [];

    if (offers.length === 0) {
      remainingPool.push(fa);
      continue;
    }

    // The offer with the highest satisfaction wins
    const sortedOffers = [...offers].sort((a, b) => b.satisfaction - a.satisfaction);
    const winningOffer = sortedOffers[0];

    const signedPlayer: FranchisePlayer = {
      ...fa,
      salary: winningOffer.salary,
      contractYears: winningOffer.years,
    };

    if (winningOffer.isUser || winningOffer.teamId === season.userTeamId) {
      // User won the player!
      updatedUserRoster.push(signedPlayer);
      resolvedSignings.push({
        player: signedPlayer,
        winningOffer,
        isUser: true,
      });
      newTransactions.push({
        date: `Week ${season.currentWeek} Free Agency`,
        text: `Signed ${signedPlayer.position} ${signedPlayer.name} (${signedPlayer.ovr} OVR) with highest offer satisfaction (${winningOffer.satisfaction}%) to a ${winningOffer.years}-year, $${winningOffer.salary.toFixed(1)}M/yr contract.`,
        type: 'signing',
      });
    } else {
      // CPU team won the player!
      const teamId = winningOffer.teamId;
      if (!updatedCpuRosters[teamId]) {
        const teamObj = getTeamById(teamId);
        updatedCpuRosters[teamId] = teamObj ? generateInitialTeamRoster(teamObj) : [];
      }
      updatedCpuRosters[teamId].push(signedPlayer);
      resolvedSignings.push({
        player: signedPlayer,
        winningOffer,
        isUser: false,
      });
      newTransactions.push({
        date: `Week ${season.currentWeek} Free Agency`,
        text: `${winningOffer.teamCity} ${winningOffer.teamName} signed ${signedPlayer.position} ${signedPlayer.name} (${signedPlayer.ovr} OVR) with highest offer satisfaction (${winningOffer.satisfaction}%) at $${winningOffer.salary.toFixed(1)}M/yr.`,
        type: 'signing',
      });
    }
  }

  // Calculate new used cap for user
  const newUsedCap = updatedUserRoster.reduce((sum, p) => sum + p.salary, 0);

  // Advance week or keep state, and populate offers for the remaining top 20
  const intermediateSeason: FranchiseSeasonState = {
    ...season,
    userRoster: updatedUserRoster,
    cpuRosters: updatedCpuRosters,
    freeAgentsPool: remainingPool,
    usedCap: Math.round(newUsedCap * 10) / 10,
    transactions: newTransactions,
  };

  const refreshedPool = populateCpuOffersForTop20(intermediateSeason, true);

  const updatedSeason: FranchiseSeasonState = {
    ...intermediateSeason,
    freeAgentsPool: refreshedPool,
  };

  return {
    updatedSeason,
    resolvedSignings,
  };
}

/**
 * Submits or updates an offer from the user for a specific free agent.
 */
export function submitUserOffer(
  season: FranchiseSeasonState,
  player: FreeAgent,
  salary: number,
  bonus: number,
  years: number
): FranchiseSeasonState {
  const userTeam = getTeamById(season.userTeamId);
  const teamOvr = userTeam ? userTeam.ovr : 80;

  const isDefendingChampion = !!season.wonSuperBowlLastSeason;
  const satisfaction = calculateOfferSatisfaction(player, salary, bonus, years, teamOvr, isDefendingChampion);

  const userOffer: FreeAgentOffer = {
    id: `user-offer-${player.id}-${Date.now()}`,
    teamId: season.userTeamId,
    teamName: userTeam ? userTeam.name : 'Your Team',
    teamCity: userTeam ? userTeam.city : 'User',
    primaryColor: userTeam ? userTeam.primaryColor : '#10b981',
    salary,
    bonus,
    years,
    satisfaction,
    submittedWeek: season.currentWeek || 1,
    isUser: true,
  };

  const updatedPool = (season.freeAgentsPool || []).map((fa) => {
    if (fa.id !== player.id) return fa;

    // Filter out previous user offer if any
    const otherOffers = (fa.activeOffers || []).filter((o) => !o.isUser && o.teamId !== season.userTeamId);
    const combinedOffers = [userOffer, ...otherOffers];
    combinedOffers.sort((a, b) => b.satisfaction - a.satisfaction);

    return {
      ...fa,
      activeOffers: combinedOffers,
      leadingOffer: combinedOffers[0],
    };
  });

  return {
    ...season,
    freeAgentsPool: updatedPool,
  };
}

/**
 * Withdraws the user's active offer for a free agent.
 */
export function withdrawUserOffer(
  season: FranchiseSeasonState,
  playerId: string
): FranchiseSeasonState {
  const updatedPool = (season.freeAgentsPool || []).map((fa) => {
    if (fa.id !== playerId) return fa;

    const remainingOffers = (fa.activeOffers || []).filter((o) => !o.isUser && o.teamId !== season.userTeamId);
    remainingOffers.sort((a, b) => b.satisfaction - a.satisfaction);

    return {
      ...fa,
      activeOffers: remainingOffers,
      leadingOffer: remainingOffers[0] || undefined,
    };
  });

  return {
    ...season,
    freeAgentsPool: updatedPool,
  };
}
