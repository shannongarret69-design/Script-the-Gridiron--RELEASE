import { FranchisePlayer } from '../types/franchise';
import { NFLTeam } from '../types/game';

export const ALL_POSITIONS: FranchisePlayer['position'][] = [
  'QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C',
  'EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS', 'K'
];

/**
 * Returns the active starters from a team roster based on depth chart order and benched status.
 */
export function getStartersFromRoster(
  roster: FranchisePlayer[] | undefined,
  defaultTeam: NFLTeam
): { starQB: string; starRB: string; starWR: string; starDef: string } {
  if (!roster || roster.length === 0) {
    return {
      starQB: defaultTeam.starQB,
      starRB: defaultTeam.starRB,
      starWR: defaultTeam.starWR,
      starDef: defaultTeam.starDef,
    };
  }

  // Get top active (non-benched) player for each position group
  const getTopActive = (positions: FranchisePlayer['position'][], fallback: string): string => {
    const candidates = roster
      .filter((p) => positions.includes(p.position) && !p.isBenched)
      .sort((a, b) => (a.depthChartOrder ?? 999) - (b.depthChartOrder ?? 999) || b.ovr - a.ovr);
    
    return candidates.length > 0 ? candidates[0].name : fallback;
  };

  const starQB = getTopActive(['QB'], defaultTeam.starQB);
  const starRB = getTopActive(['RB'], defaultTeam.starRB);
  const starWR = getTopActive(['WR'], defaultTeam.starWR);
  const starDef = getTopActive(['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'], defaultTeam.starDef);

  return { starQB, starRB, starWR, starDef };
}

/**
 * Ensures depthChartOrder is initialized on all players in roster.
 */
export function initializeDepthChartOrder(roster: FranchisePlayer[]): FranchisePlayer[] {
  const grouped: Record<string, FranchisePlayer[]> = {};

  // Group by position
  roster.forEach((p) => {
    if (!grouped[p.position]) grouped[p.position] = [];
    grouped[p.position].push(p);
  });

  const updated: FranchisePlayer[] = [];

  Object.keys(grouped).forEach((pos) => {
    const group = grouped[pos].sort((a, b) => (a.depthChartOrder ?? 999) - (b.depthChartOrder ?? 999) || b.ovr - a.ovr);
    group.forEach((p, idx) => {
      updated.push({
        ...p,
        depthChartOrder: idx + 1,
      });
    });
  });

  return updated;
}

/**
 * Re-orders depth chart within a position group.
 */
export function movePlayerDepth(
  roster: FranchisePlayer[],
  playerId: string,
  direction: 'up' | 'down'
): FranchisePlayer[] {
  const target = roster.find((p) => p.id === playerId);
  if (!target) return roster;

  const pos = target.position;
  const samePosGroup = roster
    .filter((p) => p.position === pos)
    .sort((a, b) => (a.depthChartOrder ?? 1) - (b.depthChartOrder ?? 1));

  const currIdx = samePosGroup.findIndex((p) => p.id === playerId);
  if (currIdx === -1) return roster;

  const swapIdx = direction === 'up' ? currIdx - 1 : currIdx + 1;
  if (swapIdx < 0 || swapIdx >= samePosGroup.length) return roster;

  const playerA = samePosGroup[currIdx];
  const playerB = samePosGroup[swapIdx];

  const orderA = playerA.depthChartOrder ?? (currIdx + 1);
  const orderB = playerB.depthChartOrder ?? (swapIdx + 1);

  return roster.map((p) => {
    if (p.id === playerA.id) {
      return { ...p, depthChartOrder: orderB };
    }
    if (p.id === playerB.id) {
      return { ...p, depthChartOrder: orderA };
    }
    return p;
  });
}

/**
 * Promotes a player directly to starter (#1 depth rank) in their position group.
 */
export function promoteToStarter(roster: FranchisePlayer[], playerId: string): FranchisePlayer[] {
  const target = roster.find((p) => p.id === playerId);
  if (!target) return roster;

  const pos = target.position;
  const samePosGroup = roster
    .filter((p) => p.position === pos)
    .sort((a, b) => (a.depthChartOrder ?? 1) - (b.depthChartOrder ?? 1));

  const updatedGroup = samePosGroup.filter((p) => p.id !== playerId);
  updatedGroup.unshift({ ...target, depthChartOrder: 1, isBenched: false });

  // Re-assign 1..N order
  const reorderedMap = new Map<string, number>();
  updatedGroup.forEach((p, idx) => reorderedMap.set(p.id, idx + 1));

  return roster.map((p) => {
    if (reorderedMap.has(p.id)) {
      return {
        ...p,
        depthChartOrder: reorderedMap.get(p.id)!,
        isBenched: p.id === playerId ? false : p.isBenched,
      };
    }
    return p;
  });
}

/**
 * Toggles benched status on a player.
 */
export function toggleBench(roster: FranchisePlayer[], playerId: string): FranchisePlayer[] {
  return roster.map((p) => {
    if (p.id === playerId) {
      return { ...p, isBenched: !p.isBenched };
    }
    return p;
  });
}

/**
 * Returns dynamic archetype description for Wayne Garrett based on any position.
 */
export function getWayneArchetypeForPosition(pos: FranchisePlayer['position']): string {
  switch (pos) {
    case 'QB':
      return 'Dual-Threat Superstar';
    case 'RB':
      return 'Elusive Power Back';
    case 'WR':
      return 'Deep Threat Playmaker';
    case 'TE':
      return 'Dominant Receiving TE';
    case 'OT':
    case 'OG':
    case 'C':
      return 'Pass Protection Wall';
    case 'EDGE':
      return 'Speed Rusher Elite';
    case 'DT':
      return 'Run Stopper Monster';
    case 'MLB':
      return 'Field General';
    case 'CB':
      return 'Shutdown Lockdown Corner';
    case 'FS':
    case 'SS':
      return 'Ballhawk Safety';
    case 'K':
      return 'Clutch Specialist';
    default:
      return 'Superstar Phenomenon';
  }
}

/**
 * Changes a player's position and places them on the new position's depth chart.
 * If Wayne Garrett is moved, he remains a 99 overall with 99 across all stats at every position,
 * is instantly placed as the #1 Starter at that position, and existing players at that position are shifted down.
 */
export function changePosition(
  roster: FranchisePlayer[],
  playerId: string,
  newPosition: FranchisePlayer['position']
): FranchisePlayer[] {
  const target = roster.find((p) => p.id === playerId);
  if (!target || target.position === newPosition) return roster;

  const isWayne = target.name === 'Wayne Garrett';
  const newPosGroup = roster.filter((p) => p.position === newPosition && p.id !== playerId);

  if (isWayne) {
    // Wayne Garrett automatically becomes #1 Starter at the new position
    // Shift all existing players at this position down by 1 in depth chart order
    return roster.map((p) => {
      if (p.id === playerId) {
        return {
          ...p,
          position: newPosition,
          depthChartOrder: 1,
          isBenched: false,
          archetype: getWayneArchetypeForPosition(newPosition),
          ovr: 99,
          speed: 99,
          strength: 99,
          agility: 99,
          awareness: 99,
          maxOvr: 99,
          potential: 'A+' as const,
        };
      }
      if (p.position === newPosition) {
        return {
          ...p,
          depthChartOrder: (p.depthChartOrder || 1) + 1,
        };
      }
      return p;
    });
  }

  // Non-Wayne players get placed at the end of the new position's depth chart
  const nextDepthOrder = newPosGroup.length + 1;
  return roster.map((p) => {
    if (p.id === playerId) {
      return {
        ...p,
        position: newPosition,
        depthChartOrder: nextDepthOrder,
      };
    }
    return p;
  });
}
