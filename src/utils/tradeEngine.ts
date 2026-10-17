import {
  FranchisePlayer,
  FranchiseSeasonState,
  IncomingTradeOffer,
  TradeNewsItem,
} from '../types/franchise';
import { NFLTeam } from '../types/game';
import { NFL_TEAMS, getTeamById } from '../data/teams';
import { generateInitialTeamRoster } from './aiRosterGenerator';
import { initializeDepthChartOrder } from './rosterUtils';
import { getTeamLowestRatedPositions, getTeamPositionRatings } from './freeAgencyEngine';

export const TRADE_DEADLINE_START_WEEK = 1;
export const TRADE_DEADLINE_END_WEEK = 9;

/**
 * Checks if the mid-season trade window (Week 4 through Week 9) is currently active.
 */
export function isTradeWindowOpen(week: number, stage?: string): boolean {
  if (stage && stage !== 'RegularSeason') return false;
  return week >= TRADE_DEADLINE_START_WEEK && week <= TRADE_DEADLINE_END_WEEK;
}

/**
 * Checks if the mid-season trade deadline has passed (after Week 9 in regular season, or in playoffs).
 */
export function isTradeDeadlinePassed(week: number, stage?: string): boolean {
  if (stage && stage !== 'RegularSeason') return true;
  return week > TRADE_DEADLINE_END_WEEK;
}

export interface TradeEvaluationResult {
  interestScore: number; // 0 to 99
  userTotalValue: number;
  cpuTotalValue: number;
  userSalaryCapChange: number; // positive = added cap spent, negative = saved cap
  canAccept: boolean; // interestScore >= 82
  gmDialogue: string;
  statusMessage: string;
  needBonus: number;
}

/**
 * Calculates a player's trade valuation score based on OVR, position, age, and potential.
 */
export function calculatePlayerTradeValue(player: FranchisePlayer): number {
  const ovr = player.ovr;
  
  // Exponential scaling for high-OVR players
  let baseValue = 0;
  if (ovr >= 95) {
    baseValue = 130 + (ovr - 95) * 8; // e.g. 99 OVR = 162
  } else if (ovr >= 90) {
    baseValue = 95 + (ovr - 90) * 7; // e.g. 94 OVR = 123
  } else if (ovr >= 82) {
    baseValue = 55 + (ovr - 82) * 5; // e.g. 89 OVR = 90
  } else if (ovr >= 75) {
    baseValue = 30 + (ovr - 75) * 3.5; // e.g. 81 OVR = 51
  } else {
    baseValue = Math.max(5, ovr * 0.35); // lower OVR depth
  }

  // Age multiplier
  let ageMult = 1.0;
  if (player.age <= 23) ageMult = 1.30;
  else if (player.age <= 25) ageMult = 1.20;
  else if (player.age <= 28) ageMult = 1.05;
  else if (player.age <= 31) ageMult = 0.90;
  else if (player.age <= 33) ageMult = 0.75;
  else ageMult = 0.60;

  // Potential bonus
  let potentialBonus = 0;
  if (player.potential === 'A+') potentialBonus = 15;
  else if (player.potential === 'A') potentialBonus = 10;
  else if (player.potential === 'B+') potentialBonus = 5;
  else if (player.potential === 'B') potentialBonus = 0;
  else potentialBonus = -5;

  // Positional premium (QB, EDGE, CB, OT are high value)
  let posPremium = 1.0;
  if (['QB', 'EDGE', 'CB', 'OT'].includes(player.position)) {
    posPremium = 1.15;
  } else if (['WR', 'DT', 'MLB', 'FS', 'SS'].includes(player.position)) {
    posPremium = 1.05;
  }

  const totalValue = Math.round((baseValue * ageMult + potentialBonus) * posPremium);
  return Math.max(2, totalValue);
}

/**
 * Evaluates a trade proposal between user and CPU team.
 * Opposing team ALWAYS accepts if interest score >= 82.
 */
export function evaluateTradeProposal(
  offeredPlayers: FranchisePlayer[],
  requestedPlayers: FranchisePlayer[],
  targetTeam: NFLTeam,
  targetRoster: FranchisePlayer[]
): TradeEvaluationResult {
  if (offeredPlayers.length === 0 || requestedPlayers.length === 0) {
    return {
      interestScore: 0,
      userTotalValue: 0,
      cpuTotalValue: 0,
      userSalaryCapChange: 0,
      canAccept: false,
      gmDialogue: `${targetTeam.name} GM: "Select at least one player to offer and one player to request to begin trade negotiations."`,
      statusMessage: 'NO PLAYERS SELECTED',
      needBonus: 0,
    };
  }

  const userTotalValue = offeredPlayers.reduce((sum, p) => sum + calculatePlayerTradeValue(p), 0);
  const cpuTotalValue = requestedPlayers.reduce((sum, p) => sum + calculatePlayerTradeValue(p), 0);

  // Calculate Net Salary Cap Change for user
  const userCapAdded = requestedPlayers.reduce((sum, p) => sum + p.salary, 0);
  const userCapRemoved = offeredPlayers.reduce((sum, p) => sum + p.salary, 0);
  const userSalaryCapChange = Math.round((userCapAdded - userCapRemoved) * 10) / 10;

  // Base Value Ratio scaled so exact equal value = 82 interest
  const rawRatio = (userTotalValue / Math.max(1, cpuTotalValue)) * 82;

  // Positional Need Bonus for CPU Team
  let needBonus = 0;
  offeredPlayers.forEach((offered) => {
    // Check top player in target roster at this position
    const topInPos = targetRoster
      .filter((p) => p.position === offered.position)
      .sort((a, b) => b.ovr - a.ovr)[0];

    const currentBestOvr = topInPos ? topInPos.ovr : 70;
    if (offered.ovr > currentBestOvr) {
      needBonus += 8; // Immediate starter upgrade
    } else if (currentBestOvr < 78 && offered.ovr >= 78) {
      needBonus += 5; // Fills major position weakness
    }
  });

  // Multi-player quantity penalty (anti-spam 4 depth players for 1 superstar)
  let packagePenalty = 0;
  if (offeredPlayers.length >= 3) {
    const highestOfferedOvr = Math.max(...offeredPlayers.map((p) => p.ovr));
    const highestRequestedOvr = Math.max(...requestedPlayers.map((p) => p.ovr));
    if (highestRequestedOvr - highestOfferedOvr >= 10) {
      packagePenalty = 12; // Quality over quantity penalty
    }
  }

  // Final Interest Score (0 to 99)
  const interestScore = Math.min(
    99,
    Math.max(0, Math.round(rawRatio + needBonus - packagePenalty))
  );

  const canAccept = interestScore >= 82;

  let gmDialogue = '';
  let statusMessage = '';

  if (canAccept) {
    statusMessage = 'TRADE ACCEPTED (82+ INTEREST REACHED)';
    gmDialogue = `${targetTeam.name} GM: "We have reviewed your proposal. The package value meets our 82 interest threshold (Current: ${interestScore}/100). We accept this deal! Put the trade papers through."`;
  } else if (interestScore >= 65) {
    statusMessage = `OFFER BELOW THRESHOLD (${interestScore}/82)`;
    gmDialogue = `${targetTeam.name} GM: "This is a competitive proposal, but it falls short of our 82 interest requirement (Current: ${interestScore}/82). Add a higher OVR asset or young prospect to close the gap."`;
  } else {
    statusMessage = `PROPOSAL REJECTED (${interestScore}/82)`;
    gmDialogue = `${targetTeam.name} GM: "This trade is heavily lopsided in your favor (Current Interest: ${interestScore}/82). We need significantly more overall value before considering a deal."`;
  }

  return {
    interestScore,
    userTotalValue,
    cpuTotalValue,
    userSalaryCapChange,
    canAccept,
    gmDialogue,
    statusMessage,
    needBonus,
  };
}

/**
 * Generates incoming trade proposals from CPU teams to the user's team during Weeks 1-9.
 * - Opponents send stacked blockbuster trade offers for Wayne Garrett from every team below 93 OVR.
 * - Opponents send aggressive trade offers for user players over 90 OVR.
 * - Opponents send positional need offers based on depth.
 * Proposals require GM approval.
 */
export function generateIncomingTradeOffersForUser(
  season: FranchiseSeasonState
): IncomingTradeOffer[] {
  if (!isTradeWindowOpen(season.currentWeek, season.stage)) {
    return season.incomingTradeOffers || [];
  }

  const existingOffers = season.incomingTradeOffers || [];
  const pendingOffers = existingOffers.filter((o) => o.status === 'pending');

  const userRoster = season.userRoster || [];
  if (userRoster.length < 22) return existingOffers;

  const userTeam = getTeamById(season.userTeamId);
  const cpuRosters = { ...(season.cpuRosters || {}) };
  const newOffers: IncomingTradeOffer[] = [];

  const getOrInitCpuRoster = (team: NFLTeam): FranchisePlayer[] => {
    let r = cpuRosters[team.id];
    if (!r || r.length === 0) {
      r = generateInitialTeamRoster(team);
      cpuRosters[team.id] = r;
    }
    return r;
  };

  const waynePlayer = userRoster.find((p) => p.name === 'Wayne Garrett');

  // 1. STACKED BLOCKBUSTER OFFERS FOR WAYNE GARRETT FROM EVERY TEAM BELOW 93 OVR
  if (waynePlayer) {
    const teamsBelow93 = NFL_TEAMS.filter((t) => t.id !== season.userTeamId && t.ovr < 93);
    for (const team of teamsBelow93) {
      // Check if this team already has an active pending offer for Wayne Garrett
      const alreadyOfferedWayne = pendingOffers.some(
        (o) => o.offeringTeamId === team.id && o.requestedPlayers.some((p) => p.name === 'Wayne Garrett')
      );
      if (alreadyOfferedWayne) continue;

      const teamRoster = getOrInitCpuRoster(team);
      // Select their top 2 best players (stacked blockbuster offer)
      const eligibleAssets = [...teamRoster]
        .filter((p) => p.name !== 'Wayne Garrett')
        .sort((a, b) => b.ovr - a.ovr);

      const topOffered = eligibleAssets.slice(0, 2);
      if (topOffered.length < 2) continue;

      const totalOfferedVal = topOffered.reduce((sum, p) => sum + calculatePlayerTradeValue(p), 0);
      const wayneVal = calculatePlayerTradeValue(waynePlayer);
      const netCapChange = Math.round((topOffered.reduce((sum, p) => sum + p.salary, 0) - waynePlayer.salary) * 10) / 10;
      const interestScore = Math.min(99, Math.max(90, Math.round(92 + (93 - team.ovr) * 0.8)));

      const playerDescriptions = topOffered.map((p) => `${p.name} (${p.ovr} OVR ${p.position}, $${p.salary}M/yr)`).join(' and ');
      const reasoning = `${team.city} GM Proposes: "Our front office is pushing all our chips into the center of the table for generational superstar Wayne Garrett. To bring Wayne Garrett to ${team.city}, we have assembled a stacked blockbuster package featuring ${playerDescriptions}. We believe this is a franchise-altering swap for both clubs."`;

      newOffers.push({
        id: `offer-wayne-${team.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        offeringTeamId: team.id,
        offeringTeamName: team.name,
        offeringTeamCity: team.city,
        offeringTeamColor: team.primaryColor,
        offeredPlayers: topOffered,
        requestedPlayers: [waynePlayer],
        week: season.currentWeek,
        seasonYear: season.seasonYear,
        status: 'pending',
        reasoning,
        interestScore,
        tradeValueOffered: totalOfferedVal,
        tradeValueRequested: wayneVal,
        netCapChange,
      });
    }
  }

  // 2. OFFERS FOR USER PLAYERS OVER 90 OVERALL
  const playersOver90 = userRoster.filter((p) => p.ovr >= 90 && p.name !== 'Wayne Garrett');
  for (const starPlayer of playersOver90) {
    const otherTeams = NFL_TEAMS.filter((t) => t.id !== season.userTeamId)
      .sort(() => Math.random() - 0.5);

    for (const team of otherTeams) {
      const alreadyOfferedThisPlayer = pendingOffers.some(
        (o) => o.offeringTeamId === team.id && o.requestedPlayers.some((p) => p.id === starPlayer.id)
      );
      if (alreadyOfferedThisPlayer) continue;

      const teamRoster = getOrInitCpuRoster(team);
      const lowestPositions = getTeamLowestRatedPositions(team, teamRoster);
      const teamNeedsPos = lowestPositions.includes(starPlayer.position);

      // Candidate players to offer: their best non-conflicting assets (82+ OVR)
      const candidates = teamRoster
        .filter((p) => p.name !== 'Wayne Garrett' && p.ovr >= 82)
        .sort((a, b) => b.ovr - a.ovr);

      if (candidates.length === 0) continue;

      // Offer top 1 or 2 players
      const numToOffer = starPlayer.ovr >= 96 ? 2 : 1;
      const offered = candidates.slice(0, numToOffer);
      const offeredVal = offered.reduce((s, p) => s + calculatePlayerTradeValue(p), 0);
      const starVal = calculatePlayerTradeValue(starPlayer);

      // Value ratio check
      if (offeredVal / Math.max(1, starVal) < 0.65) continue;

      const netCapChange = Math.round((offered.reduce((s, p) => s + p.salary, 0) - starPlayer.salary) * 10) / 10;
      const interestScore = Math.min(98, Math.max(84, Math.round(86 + (teamNeedsPos ? 8 : 0) + Math.random() * 5)));

      const offeredNames = offered.map((p) => `${p.name} (${p.ovr} OVR ${p.position})`).join(' and ');
      const reasoning = `${team.city} GM Proposes: "Our scouting department has identified ${starPlayer.name} (${starPlayer.ovr} OVR ${starPlayer.position}) as a premier game-changer for our organization${teamNeedsPos ? ` to fix our ${starPlayer.position} unit` : ''}. In exchange, we are prepared to send ${offeredNames} ($${offered.reduce((s, p) => s + p.salary, 0).toFixed(1)}M combined) to your franchise."`;

      newOffers.push({
        id: `offer-star-${team.id}-${starPlayer.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        offeringTeamId: team.id,
        offeringTeamName: team.name,
        offeringTeamCity: team.city,
        offeringTeamColor: team.primaryColor,
        offeredPlayers: offered,
        requestedPlayers: [starPlayer],
        week: season.currentWeek,
        seasonYear: season.seasonYear,
        status: 'pending',
        reasoning,
        interestScore,
        tradeValueOffered: offeredVal,
        tradeValueRequested: starVal,
        netCapChange,
      });
      break; // 1 offer per 90+ player per check
    }
  }

  // 3. GENERAL POSITIONAL NEED OFFERS (if few pending offers exist)
  if (pendingOffers.length + newOffers.length < 3) {
    const candidateTeams = NFL_TEAMS.filter((t) => t.id !== season.userTeamId)
      .sort(() => Math.random() - 0.5);

    for (const team of candidateTeams) {
      if (pendingOffers.some((o) => o.offeringTeamId === team.id)) continue;
      const teamRoster = getOrInitCpuRoster(team);
      const teamRatings = getTeamPositionRatings(team, teamRoster);
      const lowestPositions = getTeamLowestRatedPositions(team, teamRoster);

      let targetedUserPlayer: FranchisePlayer | null = null;
      let matchedPos = '';

      for (const pos of lowestPositions) {
        const userPlayersInPos = userRoster.filter((p) => {
          if (pos === 'OT') return p.position === 'OT' || p.position === 'OG' || p.position === 'C';
          if (pos === 'EDGE') return p.position === 'EDGE' || (p.position as string) === 'DE';
          if (pos === 'FS') return p.position === 'FS' || (p.position as string) === 'SS';
          return p.position === pos;
        });

        if (userPlayersInPos.length >= 2) {
          const candidates = userPlayersInPos
            .filter((p) => p.name !== 'Wayne Garrett')
            .sort((a, b) => b.ovr - a.ovr);

          if (candidates.length > 0) {
            targetedUserPlayer = candidates[0];
            matchedPos = pos;
            break;
          }
        }
      }

      if (!targetedUserPlayer) continue;

      const userVal = calculatePlayerTradeValue(targetedUserPlayer);
      const eligibleCpuPlayers = teamRoster.filter((p) => {
        if (p.name === 'Wayne Garrett') return false;
        if (lowestPositions.includes(p.position)) return false;
        const countInPos = teamRoster.filter((cp) => cp.position === p.position).length;
        if (countInPos < 2) return false;
        return p.ovr >= 75 && p.ovr <= 92;
      });

      if (eligibleCpuPlayers.length === 0) continue;

      eligibleCpuPlayers.sort((a, b) => {
        const diffA = Math.abs(calculatePlayerTradeValue(a) - userVal);
        const diffB = Math.abs(calculatePlayerTradeValue(b) - userVal);
        return diffA - diffB;
      });

      const cpuPlayerToOffer = eligibleCpuPlayers[0];
      const cpuVal = calculatePlayerTradeValue(cpuPlayerToOffer);
      const ratio = cpuVal / Math.max(1, userVal);
      if (ratio < 0.75 || ratio > 1.35) continue;

      const netCapChange = Math.round((cpuPlayerToOffer.salary - targetedUserPlayer.salary) * 10) / 10;
      const interestScore = Math.min(98, Math.max(82, Math.round(ratio * 84)));

      const reasoning = `${team.city} GM Proposes: "Our front office has an urgent need to upgrade our ${matchedPos} unit (currently rated ${teamRatings[matchedPos] || 72} OVR). Based on recent film and performance ratings, we are targeting ${targetedUserPlayer.name} (${targetedUserPlayer.ovr} OVR ${targetedUserPlayer.position}). In exchange, we are prepared to send ${cpuPlayerToOffer.name} (${cpuPlayerToOffer.ovr} OVR ${cpuPlayerToOffer.position}, $${cpuPlayerToOffer.salary}M/yr) to your franchise."`;

      newOffers.push({
        id: `offer-${team.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        offeringTeamId: team.id,
        offeringTeamName: team.name,
        offeringTeamCity: team.city,
        offeringTeamColor: team.primaryColor,
        offeredPlayers: [cpuPlayerToOffer],
        requestedPlayers: [targetedUserPlayer],
        week: season.currentWeek,
        seasonYear: season.seasonYear,
        status: 'pending',
        reasoning,
        interestScore,
        tradeValueOffered: cpuVal,
        tradeValueRequested: userVal,
        netCapChange,
      });
      break;
    }
  }

  return [...existingOffers, ...newOffers];
}

/**
 * Simulates AI-to-AI trades across the league during the trade window (Weeks 4-9).
 * Evaluates complementary roster needs and player performance ratings.
 */
export function simulateCpuToCpuTrades(
  season: FranchiseSeasonState
): {
  updatedCpuRosters: Record<string, FranchisePlayer[]>;
  newTradeNews: TradeNewsItem[];
  newTransactions: { date: string; text: string; type: 'trade' }[];
} {
  const cpuRosters: Record<string, FranchisePlayer[]> = { ...(season.cpuRosters || {}) };
  const newTradeNews: TradeNewsItem[] = [];
  const newTransactions: { date: string; text: string; type: 'trade' }[] = [];

  if (!isTradeWindowOpen(season.currentWeek, season.stage)) {
    return { updatedCpuRosters: cpuRosters, newTradeNews, newTransactions };
  }

  // Ensure CPU rosters are initialized for all teams
  NFL_TEAMS.forEach((t) => {
    if (t.id !== season.userTeamId && (!cpuRosters[t.id] || cpuRosters[t.id].length === 0)) {
      cpuRosters[t.id] = generateInitialTeamRoster(t);
    }
  });

  const otherTeams = NFL_TEAMS.filter((t) => t.id !== season.userTeamId)
    .sort(() => Math.random() - 0.5);

  let tradesExecuted = 0;
  const maxTradesThisWeek = season.currentWeek === 9 ? 2 : 1; // Deadline week is more active

  for (let i = 0; i < otherTeams.length - 1; i++) {
    if (tradesExecuted >= maxTradesThisWeek) break;

    const teamA = otherTeams[i];
    const rosterA = cpuRosters[teamA.id];
    if (!rosterA || rosterA.length < 22) continue;

    const lowestPosA = getTeamLowestRatedPositions(teamA, rosterA);
    const ratingsA = getTeamPositionRatings(teamA, rosterA);

    for (let j = i + 1; j < otherTeams.length; j++) {
      if (tradesExecuted >= maxTradesThisWeek) break;

      const teamB = otherTeams[j];
      const rosterB = cpuRosters[teamB.id];
      if (!rosterB || rosterB.length < 22) continue;

      const lowestPosB = getTeamLowestRatedPositions(teamB, rosterB);
      const ratingsB = getTeamPositionRatings(teamB, rosterB);

      // Look for a player on Team B that fills Team A's lowest position
      const candidateForA = rosterB.find((p) => {
        if (p.name === 'Wayne Garrett') return false;
        if (!lowestPosA.includes(p.position)) return false;
        const count = rosterB.filter((cp) => cp.position === p.position).length;
        return count >= 2 && p.ovr >= 76 && p.ovr <= 89;
      });

      if (!candidateForA) continue;

      // Look for a player on Team A that fills Team B's lowest position
      const candidateForB = rosterA.find((p) => {
        if (p.name === 'Wayne Garrett') return false;
        if (!lowestPosB.includes(p.position)) return false;
        const count = rosterA.filter((cp) => cp.position === p.position).length;
        return count >= 2 && p.ovr >= 76 && p.ovr <= 89;
      });

      if (!candidateForB) continue;

      // Evaluate trade balance
      const valA = calculatePlayerTradeValue(candidateForB); // Sent by Team A
      const valB = calculatePlayerTradeValue(candidateForA); // Sent by Team B

      const ratio = valA / Math.max(1, valB);
      if (ratio < 0.78 || ratio > 1.28) continue; // Balanced deal

      // Execute CPU-to-CPU trade:
      // Team A loses candidateForB, receives candidateForA
      cpuRosters[teamA.id] = initializeDepthChartOrder(
        rosterA.filter((p) => p.id !== candidateForB.id).concat(candidateForA)
      );

      // Team B loses candidateForA, receives candidateForB
      cpuRosters[teamB.id] = initializeDepthChartOrder(
        rosterB.filter((p) => p.id !== candidateForA.id).concat(candidateForB)
      );

      // Headline
      const isDeadline = season.currentWeek === 9;
      const headline = isDeadline
        ? `DEADLINE BLOCKBUSTER: ${teamA.city} and ${teamB.city} strike major player swap`
        : `TRADE WIRE: ${teamA.city} acquires ${candidateForA.name} from ${teamB.city} for ${candidateForB.name}`;

      const analysis = `${teamA.city} addresses their critical ${candidateForA.position} weakness (rated ${ratingsA[candidateForA.position] || 72} OVR) by adding ${candidateForA.name} (${candidateForA.ovr} OVR). In exchange, ${teamB.city} acquires ${candidateForB.name} (${candidateForB.ovr} OVR ${candidateForB.position}) to fill their need at ${candidateForB.position} (previously rated ${ratingsB[candidateForB.position] || 73} OVR).`;

      const newsItem: TradeNewsItem = {
        id: `news-${teamA.id}-${teamB.id}-${Date.now()}-${tradesExecuted}`,
        week: season.currentWeek,
        seasonYear: season.seasonYear,
        date: `Week ${season.currentWeek}, ${season.seasonYear}`,
        headline,
        team1Id: teamA.id,
        team1Name: teamA.name,
        team1City: teamA.city,
        team1Color: teamA.primaryColor,
        team1Players: [candidateForA], // Received by team 1
        team2Id: teamB.id,
        team2Name: teamB.name,
        team2City: teamB.city,
        team2Color: teamB.primaryColor,
        team2Players: [candidateForB], // Received by team 2
        isUserInvolved: false,
        analysis,
      };

      newTradeNews.push(newsItem);

      newTransactions.push({
        date: `Week ${season.currentWeek}, ${season.seasonYear}`,
        text: `LEAGUE TRADE: ${teamA.city} ${teamA.name} traded ${candidateForB.name} (${candidateForB.ovr} OVR ${candidateForB.position}) to ${teamB.city} ${teamB.name} for ${candidateForA.name} (${candidateForA.ovr} OVR ${candidateForA.position}).`,
        type: 'trade',
      });

      tradesExecuted++;
    }
  }

  return { updatedCpuRosters: cpuRosters, newTradeNews, newTransactions };
}

/**
 * Resolves all weekly trade mechanisms when advancing a regular season week.
 * Handles mid-season window (Week 4 to Week 9), CPU trades, and incoming offers.
 */
export function resolveWeeklyMidSeasonTrades(
  season: FranchiseSeasonState
): FranchiseSeasonState {
  let updatedSeason = { ...season };
  const currentWeek = updatedSeason.currentWeek;

  // Initialize trade collections if absent
  if (!updatedSeason.tradeNews) updatedSeason.tradeNews = [];
  if (!updatedSeason.incomingTradeOffers) updatedSeason.incomingTradeOffers = [];

  // If outside Week 4-9 or not regular season
  if (!isTradeWindowOpen(currentWeek, updatedSeason.stage)) {
    // If trade deadline passed (Week 10), mark notification if not already done
    if (currentWeek === 10 && updatedSeason.stage === 'RegularSeason') {
      const alreadyHasPassedNews = updatedSeason.tradeNews.some((n) => n.headline.includes('TRADE DEADLINE PASSED'));
      if (!alreadyHasPassedNews) {
        updatedSeason.tradeNews = [
          {
            id: `news-deadline-closed-${Date.now()}`,
            week: 10,
            seasonYear: updatedSeason.seasonYear,
            date: `Week 10, ${updatedSeason.seasonYear}`,
            headline: '🔒 NFL TRADE DEADLINE HAS PASSED: League Rosters Locked',
            team1Id: 'NFL',
            team1Name: 'NFL',
            team1City: 'League',
            team1Color: '#0f172a',
            team1Players: [],
            team2Id: 'NFL',
            team2Name: 'Front Offices',
            team2City: 'All 32',
            team2Color: '#334155',
            team2Players: [],
            isUserInvolved: false,
            analysis: 'The Week 9 mid-season trade deadline has officially passed. Front offices can no longer execute trades for the remainder of the regular season and playoffs. Player movements will resume next offseason.',
          },
          ...updatedSeason.tradeNews,
        ];
      }
    }
    return updatedSeason;
  }

  // Week 9 Deadline Alert
  if (currentWeek === 9) {
    const hasDeadlineNotice = updatedSeason.tradeNews.some((n) => n.headline.includes('FINAL WEEK BEFORE DEADLINE'));
    if (!hasDeadlineNotice) {
      updatedSeason.tradeNews = [
        {
          id: `news-deadline-w9-${Date.now()}`,
          week: 9,
          seasonYear: updatedSeason.seasonYear,
          date: `Week 9, ${updatedSeason.seasonYear}`,
          headline: '🚨 FINAL WEEK BEFORE TRADE DEADLINE: Teams Scrambling for Deals',
          team1Id: 'NFL',
          team1Name: 'NFL',
          team1City: 'League',
          team1Color: '#b45309',
          team1Players: [],
          team2Id: 'NFL',
          team2Name: 'Trade Wire',
          team2City: 'Market',
          team2Color: '#78350f',
          team2Players: [],
          isUserInvolved: false,
          analysis: 'Week 9 marks the NFL mid-season trade deadline. Contenders are looking for final missing pieces while rebuilding franchises shop veterans for draft assets and young talent. Trade operations close when Week 9 concludes.',
        },
        ...updatedSeason.tradeNews,
      ];
    }
  }

  // 1. Simulate AI-to-AI trades across the league
  const { updatedCpuRosters, newTradeNews, newTransactions } = simulateCpuToCpuTrades(updatedSeason);
  updatedSeason.cpuRosters = updatedCpuRosters;
  if (newTradeNews.length > 0) {
    updatedSeason.tradeNews = [...newTradeNews, ...updatedSeason.tradeNews];
  }
  if (newTransactions.length > 0) {
    updatedSeason.transactions = [...updatedSeason.transactions, ...newTransactions];
  }

  // 2. Generate Incoming Trade Offers to User Team (requiring GM approval)
  updatedSeason.incomingTradeOffers = generateIncomingTradeOffersForUser(updatedSeason);

  return updatedSeason;
}

/**
 * Handles GM approval and execution of an incoming trade offer.
 */
export function approveIncomingTradeOffer(
  season: FranchiseSeasonState,
  offerId: string
): { success: boolean; error?: string; updatedSeason: FranchiseSeasonState; tradeNewsItem?: TradeNewsItem } {
  const offers = season.incomingTradeOffers || [];
  const offerIndex = offers.findIndex((o) => o.id === offerId);
  if (offerIndex === -1) {
    return { success: false, error: 'Trade offer not found.', updatedSeason: season };
  }

  const offer = offers[offerIndex];
  if (offer.status !== 'pending') {
    return { success: false, error: 'This trade offer is no longer active.', updatedSeason: season };
  }

  if (isTradeDeadlinePassed(season.currentWeek, season.stage)) {
    return { success: false, error: 'The trade deadline has passed (Week 9). You cannot approve trades.', updatedSeason: season };
  }

  const userRoster = season.userRoster || [];
  const cpuRosters = { ...(season.cpuRosters || {}) };
  let offeringRoster = cpuRosters[offer.offeringTeamId];
  if (!offeringRoster || offeringRoster.length === 0) {
    const offeringTeamObj = getTeamById(offer.offeringTeamId);
    offeringRoster = generateInitialTeamRoster(offeringTeamObj);
  }

  // Verify all requested players are still on user roster
  const requestedIds = offer.requestedPlayers.map((p) => p.id);
  const userHasAllRequested = requestedIds.every((id) => userRoster.some((p) => p.id === id));
  if (!userHasAllRequested) {
    return { success: false, error: 'One or more requested players are no longer on your roster.', updatedSeason: season };
  }

  // Verify salary cap
  const availableCap = season.salaryCap - season.usedCap;
  if (availableCap - offer.netCapChange < 0) {
    return {
      success: false,
      error: `Salary Cap Exceeded: Accepting this trade requires $${offer.netCapChange.toFixed(1)}M, but you only have $${availableCap.toFixed(1)}M available.`,
      updatedSeason: season,
    };
  }

  // Execute Swap:
  // Remove requested players from user, add offered players
  const newUserRoster = initializeDepthChartOrder(
    userRoster.filter((p) => !requestedIds.includes(p.id)).concat(offer.offeredPlayers)
  );

  // Remove offered players from offering team, add requested players
  const offeredIds = offer.offeredPlayers.map((p) => p.id);
  const newOfferingRoster = initializeDepthChartOrder(
    offeringRoster.filter((p) => !offeredIds.includes(p.id)).concat(offer.requestedPlayers)
  );

  cpuRosters[offer.offeringTeamId] = newOfferingRoster;

  // Recalculate used cap
  const updatedUsedCap = newUserRoster.reduce((sum, p) => sum + p.salary, 0);

  // Update offer status
  const updatedOffers = [...offers];
  updatedOffers[offerIndex] = { ...offer, status: 'accepted' };

  const userTeam = getTeamById(season.userTeamId);
  const offeringTeam = getTeamById(offer.offeringTeamId);

  const offeredNames = offer.offeredPlayers.map((p) => `${p.name} (${p.ovr} OVR ${p.position})`).join(', ');
  const requestedNames = offer.requestedPlayers.map((p) => `${p.name} (${p.ovr} OVR ${p.position})`).join(', ');

  const headline = `GM APPROVES TRADE: ${userTeam.city} acquires ${offeredNames} from ${offeringTeam.city}`;
  const analysis = `${userTeam.city} GM officially approved a trade proposal submitted by the ${offeringTeam.name}. In exchange for ${requestedNames}, ${userTeam.city} adds ${offeredNames} ahead of the Week 9 deadline.`;

  const tradeNewsItem: TradeNewsItem = {
    id: `news-user-approved-${Date.now()}`,
    week: season.currentWeek,
    seasonYear: season.seasonYear,
    date: `Week ${season.currentWeek}, ${season.seasonYear}`,
    headline,
    team1Id: userTeam.id,
    team1Name: userTeam.name,
    team1City: userTeam.city,
    team1Color: userTeam.primaryColor,
    team1Players: offer.offeredPlayers,
    team2Id: offeringTeam.id,
    team2Name: offeringTeam.name,
    team2City: offeringTeam.city,
    team2Color: offeringTeam.primaryColor,
    team2Players: offer.requestedPlayers,
    isUserInvolved: true,
    analysis,
  };

  const newTx = {
    date: `Week ${season.currentWeek}, ${season.seasonYear}`,
    text: `GM APPROVED TRADE: Acquired ${offeredNames} from ${offeringTeam.city} ${offeringTeam.name} for ${requestedNames}.`,
    type: 'trade' as const,
  };

  const updatedSeason: FranchiseSeasonState = {
    ...season,
    userRoster: newUserRoster,
    cpuRosters,
    usedCap: Math.round(updatedUsedCap * 10) / 10,
    incomingTradeOffers: updatedOffers,
    tradeNews: [tradeNewsItem, ...(season.tradeNews || [])],
    transactions: [...season.transactions, newTx],
  };

  return { success: true, updatedSeason, tradeNewsItem };
}

/**
 * Handles GM rejection of an incoming trade offer.
 */
export function rejectIncomingTradeOffer(
  season: FranchiseSeasonState,
  offerId: string
): FranchiseSeasonState {
  const offers = season.incomingTradeOffers || [];
  const updatedOffers = offers.map((o) => (o.id === offerId ? { ...o, status: 'rejected' as const } : o));
  return {
    ...season,
    incomingTradeOffers: updatedOffers,
  };
}

/**
 * Creates a TradeNewsItem for a trade executed by the user in the Trade Machine.
 */
export function createTradeNewsForUserTrade(
  season: FranchiseSeasonState,
  userTeam: NFLTeam,
  targetTeam: NFLTeam,
  offeredPlayers: FranchisePlayer[],
  requestedPlayers: FranchisePlayer[]
): TradeNewsItem {
  const offeredNames = offeredPlayers.map((p) => `${p.name} (${p.ovr} OVR ${p.position})`).join(', ');
  const requestedNames = requestedPlayers.map((p) => `${p.name} (${p.ovr} OVR ${p.position})`).join(', ');

  const headline = `BLOCKBUSTER TRADE: ${userTeam.city} and ${targetTeam.city} complete player deal`;
  const analysis = `Prior to the mid-season deadline, ${userTeam.city} finalized an agreement with ${targetTeam.city}. The ${userTeam.name} send ${offeredNames} to acquire ${requestedNames}. Both front offices approved terms following detailed valuation and roster-need assessments.`;

  return {
    id: `news-user-executed-${Date.now()}`,
    week: season.currentWeek,
    seasonYear: season.seasonYear,
    date: `Week ${season.currentWeek}, ${season.seasonYear}`,
    headline,
    team1Id: userTeam.id,
    team1Name: userTeam.name,
    team1City: userTeam.city,
    team1Color: userTeam.primaryColor,
    team1Players: requestedPlayers, // User receives requested
    team2Id: targetTeam.id,
    team2Name: targetTeam.name,
    team2City: targetTeam.city,
    team2Color: targetTeam.primaryColor,
    team2Players: offeredPlayers, // Target receives offered
    isUserInvolved: true,
    analysis,
  };
}
