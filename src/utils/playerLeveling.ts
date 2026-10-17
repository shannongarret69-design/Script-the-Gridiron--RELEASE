import { FranchisePlayer } from '../types/franchise';
import { ActiveGame } from '../types/game';

export interface PlayerGameStats {
  played: boolean;
  snaps?: number;
  // Passing (QB)
  passYards?: number;
  passTds?: number;
  interceptions?: number;
  // Rushing (QB, RB, WR)
  rushAttempts?: number;
  rushYards?: number;
  rushTds?: number;
  // Receiving (WR, TE, RB)
  receptions?: number;
  recYards?: number;
  recTds?: number;
  // Defense (EDGE, DT, MLB, CB, FS, SS)
  tackles?: number;
  sacks?: number;
  defInts?: number;
  passDeflections?: number;
  forcedFumbles?: number;
  pointsAllowed?: number;
  // OL & Special teams
  sacksAllowed?: number;
  teamRushYards?: number;
  fgsMade?: number;
}

/**
 * Calculates a player's maximum possible Overall (OVR) cap.
 * Based on their development potential grade and starting OVR.
 */
export function getMaxOvrForPlayer(player: FranchisePlayer): number {
  if (player.name === 'Wayne Garrett') {
    return 99;
  }
  if (player.maxOvr && player.maxOvr > 0) {
    return Math.min(99, player.maxOvr);
  }

  let potentialCap = 84;
  switch (player.potential) {
    case 'A+':
      potentialCap = 99;
      break;
    case 'A':
      potentialCap = 96;
      break;
    case 'B+':
      potentialCap = 91;
      break;
    case 'B':
      potentialCap = 86;
      break;
    case 'C':
      potentialCap = 82;
      break;
    default:
      potentialCap = 88;
      break;
  }

  // A player's cap is at least their current rating, capped at 99
  return Math.min(99, Math.max(player.ovr, potentialCap));
}

/**
 * Evaluates game performance and calculates XP (0 to 10 XP max).
 * Strict rules:
 * - Only players under 28 years old qualify.
 * - Players must have actually played in the game.
 * - Max XP is 10 XP points.
 * - QBs: passing yards, TDs, rushing yards, -5 XP per interception.
 * - RBs/WRs: touchdowns, touches, yards, rushes.
 * - Defense: analyzed based on stats & game impact (sacks, tackles, INTs, pass breakups, points allowed).
 */
export function calculateGameXp(
  player: FranchisePlayer,
  stats: PlayerGameStats
): { xp: number; statSummary: string } {
  // Age check: Only players under 28 years old level up
  if (player.age >= 28) {
    return { xp: 0, statSummary: 'Age 28+ Veteran (Peak development reached)' };
  }

  // Must have actually played in the game and not be benched
  if (!stats.played || player.isBenched) {
    return { xp: 0, statSummary: 'Did not participate / Benched (0 XP)' };
  }

  let rawXp = 0;
  const summaryParts: string[] = [];
  const pos = player.position;

  if (pos === 'QB') {
    const passYds = stats.passYards || 0;
    const passTds = stats.passTds || 0;
    const rushYds = stats.rushYards || 0;
    const rushTds = stats.rushTds || 0;
    const ints = stats.interceptions || 0;
    const totalTds = passTds + rushTds;

    summaryParts.push(`${passYds} pass yds, ${totalTds} TD${totalTds === 1 ? '' : 's'}`);
    if (rushYds > 0) summaryParts.push(`${rushYds} rush yds`);
    if (ints > 0) summaryParts.push(`${ints} INT (-${ints * 5} XP)`);

    // Passing Yards Factor
    if (passYds >= 300) rawXp += 5;
    else if (passYds >= 225) rawXp += 3;
    else if (passYds >= 150) rawXp += 2;
    else if (passYds > 0) rawXp += 1;

    // Touchdowns Factor
    if (totalTds >= 3) rawXp += 5;
    else if (totalTds === 2) rawXp += 3;
    else if (totalTds === 1) rawXp += 2;

    // Rushing Yards Factor
    if (rushYds >= 40) rawXp += 2;
    else if (rushYds >= 15) rawXp += 1;

    // Interceptions Factor: MINUS 5 XP per INT!
    if (ints > 0) {
      rawXp -= ints * 5;
    }
  } else if (pos === 'RB') {
    const rushes = stats.rushAttempts || 0;
    const rushYds = stats.rushYards || 0;
    const rushTds = stats.rushTds || 0;
    const recs = stats.receptions || 0;
    const recYds = stats.recYards || 0;
    const recTds = stats.recTds || 0;

    const totalTouches = rushes + recs;
    const totalYards = rushYds + recYds;
    const totalTds = rushTds + recTds;

    summaryParts.push(`${rushes} rush, ${totalYards} yds, ${totalTds} TD${totalTds === 1 ? '' : 's'}`);

    // Touchdowns Factor
    if (totalTds >= 2) rawXp += 5;
    else if (totalTds === 1) rawXp += 3;

    // Yards Factor
    if (totalYards >= 100) rawXp += 5;
    else if (totalYards >= 60) rawXp += 3;
    else if (totalYards >= 30) rawXp += 2;
    else if (totalYards > 0) rawXp += 1;

    // Touches / Rushes Factor
    if (totalTouches >= 16) rawXp += 3;
    else if (totalTouches >= 10) rawXp += 2;
    else if (totalTouches >= 4) rawXp += 1;
  } else if (pos === 'WR' || pos === 'TE') {
    const recs = stats.receptions || 0;
    const recYds = stats.recYards || 0;
    const recTds = stats.recTds || 0;
    const rushes = stats.rushAttempts || 0;
    const rushYds = stats.rushYards || 0;
    const rushTds = stats.rushTds || 0;

    const totalTouches = recs + rushes;
    const totalYards = recYds + rushYds;
    const totalTds = recTds + rushTds;

    summaryParts.push(`${recs} rec, ${totalYards} yds, ${totalTds} TD${totalTds === 1 ? '' : 's'}`);

    // Touchdowns Factor
    if (totalTds >= 2) rawXp += 5;
    else if (totalTds === 1) rawXp += 3;

    // Yards Factor
    if (totalYards >= 90) rawXp += 5;
    else if (totalYards >= 55) rawXp += 3;
    else if (totalYards >= 25) rawXp += 2;
    else if (totalYards > 0) rawXp += 1;

    // Touches Factor
    if (totalTouches >= 7) rawXp += 2;
    else if (totalTouches >= 3) rawXp += 1;
  } else if (['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(pos)) {
    // Defense: analyze the game and judge if it was a good enough game
    const tkl = stats.tackles || 0;
    const sck = stats.sacks || 0;
    const ints = stats.defInts || 0;
    const pdef = stats.passDeflections || 0;
    const ff = stats.forcedFumbles || 0;
    const ptsAllowed = stats.pointsAllowed ?? 20;

    const playScore = sck * 3 + ints * 4 + ff * 3 + pdef * 2 + tkl;
    summaryParts.push(`${tkl} tkl, ${sck} sck${ints > 0 ? `, ${ints} INT` : ''}`);

    // Great game: 10 XP
    if (ints >= 1 || sck >= 2 || (tkl >= 7 && sck >= 1) || playScore >= 11 || ptsAllowed <= 10) {
      rawXp = 10;
      summaryParts.push('★ Great Defensive Game');
    }
    // Good game: 7 XP
    else if (sck >= 1 || tkl >= 5 || pdef >= 2 || ff >= 1 || playScore >= 6 || ptsAllowed <= 20) {
      rawXp = 7;
      summaryParts.push('✓ Good Defensive Game');
    }
    // Decent game: 4 XP
    else if (tkl >= 3 || playScore >= 3) {
      rawXp = 4;
      summaryParts.push('Decent Defensive Game');
    }
    // Bad game: 0 XP
    else {
      rawXp = 0;
      summaryParts.push('Quiet Game');
    }
  } else if (['OT', 'OG', 'C'].includes(pos)) {
    const rushYds = stats.teamRushYards ?? 110;
    const sacksAllowed = stats.sacksAllowed ?? 1;
    if (rushYds >= 140 && sacksAllowed <= 1) {
      rawXp = 10;
      summaryParts.push('Dominant Trench Game');
    } else if (rushYds >= 90 && sacksAllowed <= 2) {
      rawXp = 7;
      summaryParts.push('Solid Protection');
    } else {
      rawXp = 3;
      summaryParts.push('Average Blocking');
    }
  } else if (pos === 'K') {
    const fgs = stats.fgsMade || 0;
    if (fgs >= 3) rawXp = 10;
    else if (fgs === 2) rawXp = 7;
    else if (fgs === 1) rawXp = 5;
    else rawXp = 0;
    summaryParts.push(`${fgs} FG made`);
  }

  // Clamped strictly between 0 and 10 XP points max
  const finalXp = Math.max(0, Math.min(10, rawXp));
  return {
    xp: finalXp,
    statSummary: summaryParts.join(' • ') || `${finalXp} XP earned`,
  };
}

/**
 * Applies earned XP to a player and triggers level-up if they reach 100 XP.
 * Each level up:
 * - Requires 100 XP.
 * - Raises +5 OVR points.
 * - Caps at player's maxOvr.
 */
export function applyXpAndLevelUp(
  player: FranchisePlayer,
  earnedXp: number,
  gameWeek: number,
  statSummary: string
): { updatedPlayer: FranchisePlayer; leveledUp: boolean; levelsGained: number } {
  if (player.name === 'Wayne Garrett') {
    return {
      updatedPlayer: {
        ...player,
        position: 'RB',
        ovr: 99,
        speed: 99,
        strength: 99,
        agility: 99,
        awareness: 99,
        maxOvr: 99,
        potential: 'A+',
        level: player.level || 10,
        xp: 99,
      },
      leveledUp: false,
      levelsGained: 0,
    };
  }

  const maxOvr = getMaxOvrForPlayer(player);

  // Age restriction: only players under 28
  if (player.age >= 28) {
    return {
      updatedPlayer: { ...player, maxOvr, level: player.level || 1, xp: 0 },
      leveledUp: false,
      levelsGained: 0,
    };
  }

  let currentLevel = player.level || 1;
  let currentXp = (player.xp || 0) + earnedXp;
  let currentOvr = player.ovr;
  let speed = player.speed;
  let strength = player.strength;
  let agility = player.agility;
  let awareness = player.awareness;

  let levelsGained = 0;
  const initialOvr = currentOvr;

  // Level up every 100 XP points
  while (currentXp >= 100) {
    currentXp -= 100;
    currentLevel += 1;
    levelsGained += 1;

    // +5 OVR per level, capped at maxOvr
    const targetOvr = Math.min(maxOvr, currentOvr + 5);
    const ovrGain = targetOvr - currentOvr;
    currentOvr = targetOvr;

    if (ovrGain > 0) {
      speed = Math.min(99, speed + Math.round(ovrGain * 0.8));
      strength = Math.min(99, strength + Math.round(ovrGain * 0.8));
      agility = Math.min(99, agility + Math.round(ovrGain * 0.8));
      awareness = Math.min(99, awareness + ovrGain);
    }
  }

  const updatedPlayer: FranchisePlayer = {
    ...player,
    level: currentLevel,
    xp: currentXp,
    maxOvr,
    ovr: currentOvr,
    speed,
    strength,
    agility,
    awareness,
    recentGameXp: {
      week: gameWeek,
      xpEarned: earnedXp,
      statSummary,
      leveledUp: levelsGained > 0,
      prevOvr: initialOvr,
      newOvr: currentOvr,
    },
  };

  return {
    updatedPlayer,
    leveledUp: levelsGained > 0,
    levelsGained,
  };
}

/**
 * Generates realistic simulated game stats for a player when simulating games.
 */
export function generateSimulatedGameStatsForPlayer(
  player: FranchisePlayer,
  isStarter: boolean,
  teamScore: number,
  oppScore: number,
  teamTotalYds: number
): PlayerGameStats {
  if (player.isBenched || !isStarter) {
    // Non-starters don't play or get negligible backup snaps
    return { played: false };
  }

  const won = teamScore > oppScore;
  const pos = player.position;

  if (pos === 'QB') {
    const passTds = Math.max(0, Math.min(4, Math.floor((teamScore - 3) / 7)));
    const passYds = Math.round(180 + Math.random() * 160 + (player.ovr - 75) * 2);
    const rushYds = Math.round(Math.random() * 30);
    // 0 to 2 interceptions, with lower chance for high OVR QBs
    const intRoll = Math.random() * 100;
    const ints = intRoll < (player.ovr >= 85 ? 12 : 28) ? 1 : intRoll > 92 ? 2 : 0;

    return {
      played: true,
      passYards: passYds,
      passTds,
      interceptions: ints,
      rushYards: rushYds,
      rushTds: Math.random() > 0.8 ? 1 : 0,
    };
  }

  if (pos === 'RB') {
    const rushAttempts = 12 + Math.floor(Math.random() * 10);
    const rushYards = Math.round(rushAttempts * (3.4 + Math.random() * 2.2 + (player.ovr - 75) * 0.05));
    const rushTds = Math.max(0, Math.min(2, Math.floor((teamScore - 7) / 10) > 0 ? (Math.random() > 0.4 ? 1 : 0) : 0));
    const recs = 2 + Math.floor(Math.random() * 4);
    const recYards = recs * 7;

    return {
      played: true,
      rushAttempts,
      rushYards,
      rushTds,
      receptions: recs,
      recYards,
      recTds: 0,
    };
  }

  if (pos === 'WR' || pos === 'TE') {
    const recs = 3 + Math.floor(Math.random() * 6);
    const recYards = Math.round(recs * (11 + Math.random() * 6 + (player.ovr - 75) * 0.1));
    const recTds = Math.random() > 0.5 ? 1 : Math.random() > 0.85 ? 2 : 0;

    return {
      played: true,
      receptions: recs,
      recYards,
      recTds,
    };
  }

  if (['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(pos)) {
    const tackles = 3 + Math.floor(Math.random() * 7);
    const sackChance = Math.random() * 100;
    const sacks = sackChance > 70 ? 1 : sackChance > 92 ? 2 : 0;
    const intChance = Math.random() * 100;
    const defInts = ['CB', 'FS', 'SS', 'MLB'].includes(pos) && intChance > 82 ? 1 : 0;
    const passDeflections = ['CB', 'FS', 'SS'].includes(pos) ? Math.floor(Math.random() * 3) : 0;
    const forcedFumbles = sackChance > 88 ? 1 : 0;

    return {
      played: true,
      tackles,
      sacks,
      defInts,
      passDeflections,
      forcedFumbles,
      pointsAllowed: oppScore,
    };
  }

  if (['OT', 'OG', 'C'].includes(pos)) {
    return {
      played: true,
      teamRushYards: Math.round(teamTotalYds * 0.38),
      sacksAllowed: won ? 1 : 2,
    };
  }

  if (pos === 'K') {
    const fgsMade = Math.max(0, Math.floor((teamScore % 7) / 3));
    return {
      played: true,
      fgsMade,
    };
  }

  return { played: true };
}

/**
 * Processes simulated game progression for all user roster players under 28.
 */
export function processSimulatedGameRosterProgression(
  roster: FranchisePlayer[],
  gameWeek: number,
  userTeamScore: number,
  oppTeamScore: number,
  userTeamWon: boolean
): {
  updatedRoster: FranchisePlayer[];
  levelUpEvents: { player: FranchisePlayer; oldOvr: number; newOvr: number; level: number }[];
  totalXpDistributed: number;
} {
  const levelUpEvents: { player: FranchisePlayer; oldOvr: number; newOvr: number; level: number }[] = [];
  let totalXpDistributed = 0;

  // Track depth chart rank by position so only top active starters play
  const posCounts: Record<string, number> = {};

  const updatedRoster = roster.map((player) => {
    const maxOvr = getMaxOvrForPlayer(player);

    if (player.age >= 28) {
      return { ...player, maxOvr, level: player.level || 1, xp: player.xp || 0 };
    }

    const pos = player.position;
    const currentPosIndex = posCounts[pos] || 0;
    posCounts[pos] = currentPosIndex + 1;

    // Starters determination:
    // QB: 1, RB: 1-2, WR: 1-3, TE: 1, OL: 1 each, EDGE: 1-2, DT: 1-2, MLB: 1-2, CB: 1-2, FS/SS: 1
    const isStarter =
      !player.isBenched &&
      ((pos === 'QB' && currentPosIndex === 0) ||
        (pos === 'RB' && currentPosIndex <= 1) ||
        (pos === 'WR' && currentPosIndex <= 2) ||
        (pos === 'TE' && currentPosIndex === 0) ||
        (['OT', 'OG', 'C'].includes(pos) && currentPosIndex <= 1) ||
        (['EDGE', 'DT', 'MLB', 'CB'].includes(pos) && currentPosIndex <= 1) ||
        (['FS', 'SS', 'K'].includes(pos) && currentPosIndex === 0));

    if (!isStarter) {
      return {
        ...player,
        maxOvr,
        level: player.level || 1,
        xp: player.xp || 0,
        recentGameXp: {
          week: gameWeek,
          xpEarned: 0,
          statSummary: 'Bench / Backup (Did not play)',
        },
      };
    }

    const stats = generateSimulatedGameStatsForPlayer(
      player,
      isStarter,
      userTeamScore,
      oppTeamScore,
      320
    );

    const { xp, statSummary } = calculateGameXp(player, stats);
    totalXpDistributed += xp;

    const { updatedPlayer, leveledUp } = applyXpAndLevelUp(player, xp, gameWeek, statSummary);

    if (leveledUp) {
      levelUpEvents.push({
        player: updatedPlayer,
        oldOvr: player.ovr,
        newOvr: updatedPlayer.ovr,
        level: updatedPlayer.level || 1,
      });
    }

    return updatedPlayer;
  });

  return {
    updatedRoster,
    levelUpEvents,
    totalXpDistributed,
  };
}

/**
 * Extracts player stats from an interactive played ActiveGame.
 */
export function extractPlayedStatsFromActiveGame(
  game: ActiveGame,
  userTeamId: string,
  roster: FranchisePlayer[]
): Record<string, PlayerGameStats> {
  const isHome = game.homeTeam.id === userTeamId;
  const userStats = isHome ? game.homeStats : game.awayStats;
  const oppScore = isHome ? game.awayScore : game.homeScore;
  const userScore = isHome ? game.homeScore : game.awayScore;

  const playerStatsMap: Record<string, PlayerGameStats> = {};

  // Initialize for all roster players
  roster.forEach((p) => {
    playerStatsMap[p.id] = { played: false };
  });

  // Identify starters
  const qbStarter = roster.find((p) => p.position === 'QB' && !p.isBenched);
  const rbStarter = roster.find((p) => p.position === 'RB' && !p.isBenched);
  const wrStarter1 = roster.find((p) => p.position === 'WR' && !p.isBenched);
  const defStarters = roster.filter(
    (p) => ['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(p.position) && !p.isBenched
  );

  // Compute turnovers, sacks, points from game log
  let userIntsThrown = 0;
  let userRushTds = 0;
  let userPassTds = 0;
  let qbRushYards = 0;
  let qbRushTds = 0;

  game.playLog.forEach((play) => {
    if (play.result.turnoverType === 'Interception') {
      userIntsThrown += 1;
    }
    const isQbKeyPlayer = qbStarter && (
      play.result.keyPlayer === qbStarter.name ||
      play.result.commentary?.includes(qbStarter.name) ||
      play.result.commentary?.toLowerCase().includes('qb') ||
      /keeper|sneak|option|draw/i.test(play.offensePlay)
    );
    const isRun =
      play.offensePlay.toLowerCase().includes('run') ||
      /keeper|sneak|draw|dive|stretch|power|sweep|iso|handoff|pitch/i.test(play.offensePlay);

    if (play.result.isTouchdown) {
      if (isRun) {
        if (isQbKeyPlayer) {
          qbRushTds += 1;
        }
        userRushTds += 1;
      } else {
        userPassTds += 1;
      }
    }

    if (isRun && isQbKeyPlayer && play.result.yardsGained) {
      qbRushYards += Math.max(0, play.result.yardsGained);
    }
  });

  // QB stats
  if (qbStarter) {
    playerStatsMap[qbStarter.id] = {
      played: true,
      passYards: userStats.passingYards,
      passTds: userPassTds,
      interceptions: userIntsThrown,
      rushYards: qbRushYards > 0 ? qbRushYards : 15,
      rushTds: qbRushTds,
    };
  }

  // RB stats
  if (rbStarter) {
    playerStatsMap[rbStarter.id] = {
      played: true,
      rushAttempts: Math.max(8, Math.round(userStats.rushingYards / 4.2)),
      rushYards: userStats.rushingYards,
      rushTds: userRushTds,
      receptions: 3,
      recYards: 24,
      recTds: 0,
    };
  }

  // WR stats
  if (wrStarter1) {
    playerStatsMap[wrStarter1.id] = {
      played: true,
      receptions: 5,
      recYards: Math.round(userStats.passingYards * 0.55),
      recTds: userPassTds > 0 ? 1 : 0,
    };
  }

  // Defensive players stats
  defStarters.forEach((defP, idx) => {
    const defTackles = 4 + (idx % 4);
    const defSacks = idx === 0 && userStats.sacks > 0 ? userStats.sacks : 0;
    const defInts = idx === 1 && (isHome ? game.awayStats.turnovers : game.homeStats.turnovers) > 0 ? 1 : 0;

    playerStatsMap[defP.id] = {
      played: true,
      tackles: defTackles,
      sacks: defSacks,
      defInts,
      pointsAllowed: oppScore,
    };
  });

  return playerStatsMap;
}
