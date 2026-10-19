import { FranchisePlayer } from '../types/franchise';
import { ActiveGame, NFLTeam, Play, PlayResult } from '../types/game';
import { InjuryEvent } from '../types/injuries';

/**
 * Calculates a player's safe hits threshold using their strength stat:
 * - Strength >= 90: 30 hits safely before injury risk raises
 * - Strength 80-89: 20 hits safely before injury risk raises
 * - Strength <= 79: 10 hits safely before injury risk raises
 */
export function getPlayerSafeHits(strength: number): number {
  if (strength >= 90) return 30;
  if (strength >= 80) return 20;
  return 10;
}

/**
 * Calculates a player's injury risk based on consecutive hits without a break and their strength stat.
 * - Base injury risk is 1% (0.01)
 * - After meeting the safe hits threshold, risk raises by 20% (0.20) for every hit without a break
 */
export function calculateInjuryRisk(consecutiveHits: number, strength: number): {
  risk: number;
  riskPercent: number;
  isElevated: boolean;
  safeThreshold: number;
  hitsOverThreshold: number;
} {
  const safeThreshold = getPlayerSafeHits(strength);
  const hits = Math.max(0, consecutiveHits);

  if (hits <= safeThreshold) {
    return {
      risk: 0.01,
      riskPercent: 1,
      isElevated: false,
      safeThreshold,
      hitsOverThreshold: 0,
    };
  }

  const hitsOverThreshold = hits - safeThreshold;
  // Raises by 20% for every hit without a break
  const elevatedRisk = Math.min(1.0, 0.01 + hitsOverThreshold * 0.20);
  const riskPercent = Math.min(100, Math.round(elevatedRisk * 100));

  return {
    risk: elevatedRisk,
    riskPercent,
    isElevated: true,
    safeThreshold,
    hitsOverThreshold,
  };
}

/**
 * Common injury types diagnosed when a player succumbs to fatigue and high-impact hits
 */
const FATIGUE_INJURY_PROFILES = [
  { name: 'Sprained Ankle', severity: 'Questionable' as const, durationWeeks: 1 },
  { name: 'Bruised Ribs', severity: 'Questionable' as const, durationWeeks: 1 },
  { name: 'Hamstring Pull', severity: 'Doubtful' as const, durationWeeks: 2 },
  { name: 'Shoulder Stinger', severity: 'Doubtful' as const, durationWeeks: 1 },
  { name: 'High Ankle Sprain', severity: 'Out (Game)' as const, durationWeeks: 3 },
  { name: 'Concussion Protocol', severity: 'Out (Game)' as const, durationWeeks: 2 },
  { name: 'Knee Hyperextension', severity: 'Out (Game)' as const, durationWeeks: 4 },
  { name: 'Torn Meniscus', severity: 'Injured Reserve (Season)' as const, durationWeeks: 8 },
];

/**
 * Processes fatigue recovery for benched players:
 * "The players gain 2 hits back a player when they are benched."
 * On every play (or when benched), each benched player recovers 2 hits.
 */
export function processBenchRecovery(roster: FranchisePlayer[]): FranchisePlayer[] {
  return roster.map((p) => {
    const isPlayerBenched = Boolean(p.isBenched || (p.depthChartOrder !== undefined && p.depthChartOrder > 1));
    if (isPlayerBenched && (p.fatigueHits || 0) > 0) {
      const recoveredHits = Math.max(0, (p.fatigueHits || 0) - 2);
      const safeThreshold = getPlayerSafeHits(p.strength);
      const riskInfo = calculateInjuryRisk(recoveredHits, p.strength);
      return {
        ...p,
        fatigueHits: recoveredHits,
        maxSafeHits: safeThreshold,
        injuryRiskPercent: riskInfo.riskPercent,
      };
    }
    return p;
  });
}

/**
 * Processes hits and fatigue on the active ball carrier / key player after a play.
 * Also recovers 2 hits for all benched players.
 * Evaluates injury risk and triggers an injury event if the roll hits.
 */
export function processPlayFatigueAndInjuries(
  teamRoster: FranchisePlayer[],
  team: NFLTeam,
  offensePlay: Play,
  playResult: PlayResult
): {
  updatedRoster: FranchisePlayer[];
  triggeredInjury: InjuryEvent | null;
  fatigueNotice?: string;
  hitPlayer?: FranchisePlayer;
} {
  if (!teamRoster || teamRoster.length === 0) {
    return { updatedRoster: teamRoster, triggeredInjury: null };
  }

  // 1. First, all currently benched players gain 2 hits back
  let workingRoster = processBenchRecovery(teamRoster);

  // 2. Identify the player who took the hit on this play
  // Determine if this play involves a tackle or sack
  const isTackleOrSack =
    playResult.outcomeType === 'Sack' ||
    playResult.outcomeType === 'TackleForLoss' ||
    playResult.outcomeType === 'ShortGain' ||
    playResult.outcomeType === 'BigGain' ||
    playResult.outcomeType === 'FirstDown' ||
    playResult.outcomeType === 'NoGain';

  // Only apply hits if it was a tackle or sack
  if (!isTackleOrSack) {
    return { updatedRoster: workingRoster, triggeredInjury: null };
  }

  // Determine key offensive player taking the hit
  const isPass = offensePlay.category !== 'Run';
  let targetPlayerName = playResult.keyPlayer;

  if (playResult.outcomeType === 'Sack') {
    // QB absorbs the sack hit
    targetPlayerName = team.starQB;
  } else if (!targetPlayerName) {
    targetPlayerName = isPass ? team.starWR : team.starRB;
  }

  // Find this player in the roster
  const playerIndex = workingRoster.findIndex(
    (p) =>
      !p.isBenched &&
      (p.name.toLowerCase() === targetPlayerName?.toLowerCase() ||
        (targetPlayerName && p.name.toLowerCase().includes(targetPlayerName.toLowerCase())) ||
        (targetPlayerName && targetPlayerName.toLowerCase().includes(p.name.toLowerCase())) ||
        (playResult.outcomeType === 'Sack' && p.position === 'QB') ||
        (isPass ? p.position === 'WR' : p.position === 'RB'))
  );

  if (playerIndex === -1) {
    // If not found, pick first active starter of relevant position
    return { updatedRoster: workingRoster, triggeredInjury: null };
  }

  const targetPlayer = workingRoster[playerIndex];
  const currentHits = (targetPlayer.fatigueHits || 0) + 1; // took a hit!
  const strength = targetPlayer.strength || 75;
  const safeLimit = getPlayerSafeHits(strength);
  const riskInfo = calculateInjuryRisk(currentHits, strength);

  let triggeredInjury: InjuryEvent | null = null;
  let fatigueNotice: string | undefined = undefined;

  if (riskInfo.isElevated) {
    fatigueNotice = `⚠️ FATIGUE WARNING: ${targetPlayer.name} has taken ${currentHits} consecutive hits (Limit: ${safeLimit})! Injury risk elevated to ${riskInfo.riskPercent}% (+20% per hit over threshold). Bench him to recover 2 hits per play!`;
  }

  // Roll for injury based on calculated risk
  const injuryRoll = Math.random();
  if (injuryRoll < riskInfo.risk) {
    // Player is injured!
    const profile = FATIGUE_INJURY_PROFILES[Math.floor(Math.random() * FATIGUE_INJURY_PROFILES.length)];
    const injuryId = `inj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    triggeredInjury = {
      id: injuryId,
      playerName: targetPlayer.name,
      playerPosition: targetPlayer.position,
      teamId: team.id,
      teamAbbr: team.abbr,
      teamName: team.name,
      injuryType: profile.name,
      severity: profile.severity,
      durationWeeks: profile.durationWeeks,
      timestamp: Date.now(),
      announcementText: `FATIGUE INJURY: ${targetPlayer.name} (${targetPlayer.position}) collapsed after taking ${currentHits} consecutive hits without rest! Diagnosed with a ${profile.name} (${profile.severity}).`,
    };

    // Sub player off to bench due to injury
    workingRoster[playerIndex] = {
      ...targetPlayer,
      fatigueHits: currentHits,
      maxSafeHits: safeLimit,
      injuryRiskPercent: riskInfo.riskPercent,
      isBenched: true, // benched due to injury so backup plays
      isInjured: true,
      injuryDetails: {
        injuryType: profile.name,
        severity: profile.severity,
        durationWeeks: profile.durationWeeks,
        description: `Suffered ${profile.name} after ${currentHits} hits without a break.`,
      },
    };
  } else {
    // Update player fatigue hits and risk
    workingRoster[playerIndex] = {
      ...targetPlayer,
      fatigueHits: currentHits,
      maxSafeHits: safeLimit,
      injuryRiskPercent: riskInfo.riskPercent,
    };
  }

  return {
    updatedRoster: workingRoster,
    triggeredInjury,
    fatigueNotice,
    hitPlayer: workingRoster[playerIndex],
  };
}
