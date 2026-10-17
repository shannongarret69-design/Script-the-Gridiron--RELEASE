import { INITIAL_ROSTERS } from '../data/teamRosters';
import { loadSaveSlot, getActiveSlotId } from './saveManager';
import { loadClashUserData } from './clashManager';
import { NFLTeam, Play, PlayerAssignment } from '../types/game';

export interface TeamReceiverOption {
  name: string;
  position: 'WR' | 'TE' | 'RB' | 'QB';
  depthSlot: 'WR1' | 'WR2' | 'WR3' | 'WR4' | 'TE1' | 'TE2' | 'RB1' | 'QB1';
  ovr: number;
  label: string;
}

export interface TargetPlayerInfo {
  name: string;
  position: string;
  slotLabel: string;
  ovr?: number;
}

/**
 * Returns all eligible pass-catching/skill targets from the user's active Gridiron Clash roster.
 * Default starting roster has 60 overall players.
 */
export function getUserClashTargetPlayers(): TeamReceiverOption[] {
  try {
    const clashData = loadClashUserData();
    const lineup = clashData.startingLineup || {};
    const roster = clashData.roster || [];

    const getCardForSlot = (slotId: string, defaultName: string, pos: 'WR' | 'TE' | 'RB' | 'QB') => {
      const cardId = lineup[slotId];
      const card = roster.find((c) => c.id === cardId);
      if (card) {
        return {
          name: card.name,
          position: pos,
          ovr: card.ovr || 60,
        };
      }
      return {
        name: defaultName,
        position: pos,
        ovr: 60,
      };
    };

    const wr1 = getCardForSlot('WR1', 'Marcus Sterling', 'WR');
    const wr2 = getCardForSlot('WR2', 'Trevor Cross', 'WR');
    const wr3 = getCardForSlot('WR3', 'Darius Cole', 'WR');
    const te = getCardForSlot('TE', 'Noah Higgins', 'TE');
    const rb = getCardForSlot('RB', 'Jordan Vance', 'RB');
    const qb = getCardForSlot('QB', 'Caleb Miller', 'QB');

    const results: TeamReceiverOption[] = [
      {
        name: wr1.name,
        position: 'WR',
        depthSlot: 'WR1',
        ovr: wr1.ovr,
        label: `${wr1.name} (WR1 • ${wr1.ovr} OVR)`,
      },
      {
        name: wr2.name,
        position: 'WR',
        depthSlot: 'WR2',
        ovr: wr2.ovr,
        label: `${wr2.name} (WR2 • ${wr2.ovr} OVR)`,
      },
      {
        name: wr3.name,
        position: 'WR',
        depthSlot: 'WR3',
        ovr: wr3.ovr,
        label: `${wr3.name} (WR3 • ${wr3.ovr} OVR)`,
      },
      {
        name: te.name,
        position: 'TE',
        depthSlot: 'TE1',
        ovr: te.ovr,
        label: `${te.name} (TE1 • ${te.ovr} OVR)`,
      },
      {
        name: rb.name,
        position: 'RB',
        depthSlot: 'RB1',
        ovr: rb.ovr,
        label: `${rb.name} (RB1 • ${rb.ovr} OVR)`,
      },
      {
        name: qb.name,
        position: 'QB',
        depthSlot: 'QB1',
        ovr: qb.ovr,
        label: `${qb.name} (QB • ${qb.ovr} OVR)`,
      },
    ];

    // Also include any bench WR/TE/RB from user's roster
    const activeIds = new Set([lineup['WR1'], lineup['WR2'], lineup['WR3'], lineup['TE'], lineup['RB'], lineup['QB']]);
    roster.forEach((c, idx) => {
      if (!activeIds.has(c.id) && ['WR', 'TE', 'RB'].includes(c.position)) {
        results.push({
          name: c.name,
          position: c.position as any,
          depthSlot: `${c.position}${idx + 4}` as any,
          ovr: c.ovr || 60,
          label: `${c.name} (${c.position} Reserve • ${c.ovr || 60} OVR)`,
        });
      }
    });

    return results;
  } catch (e) {
    return [
      { name: 'Marcus Sterling', position: 'WR', depthSlot: 'WR1', ovr: 60, label: 'Marcus Sterling (WR1 • 60 OVR)' },
      { name: 'Trevor Cross', position: 'WR', depthSlot: 'WR2', ovr: 60, label: 'Trevor Cross (WR2 • 60 OVR)' },
      { name: 'Darius Cole', position: 'WR', depthSlot: 'WR3', ovr: 60, label: 'Darius Cole (WR3 • 60 OVR)' },
      { name: 'Noah Higgins', position: 'TE', depthSlot: 'TE1', ovr: 60, label: 'Noah Higgins (TE1 • 60 OVR)' },
      { name: 'Jordan Vance', position: 'RB', depthSlot: 'RB1', ovr: 60, label: 'Jordan Vance (RB1 • 60 OVR)' },
      { name: 'Caleb Miller', position: 'QB', depthSlot: 'QB1', ovr: 60, label: 'Caleb Miller (QB • 60 OVR)' },
    ];
  }
}

/**
 * Returns all eligible pass-catching targets (WRs, TEs, plus RBs and QB)
 * for the given team ID.
 */
export function getTeamReceiversAndTEs(teamId: string): TeamReceiverOption[] {
  if (!teamId) return [];
  const upperTeamId = teamId.toUpperCase();

  // If this is the Clash user team, load their active 60 OVR roster
  if (upperTeamId === 'USER_CLASH' || upperTeamId === 'CLASH' || upperTeamId === 'DYN') {
    return getUserClashTargetPlayers();
  }

  // Check active save slot first if season mode has user roster
  const slotId = getActiveSlotId();
  const saveSlot = loadSaveSlot(slotId);
  const userTeamId = saveSlot?.season?.userTeamId?.toUpperCase();
  const userRoster = saveSlot?.season?.userRoster;

  const roster =
    userTeamId === upperTeamId && userRoster && userRoster.length > 0
      ? userRoster
      : INITIAL_ROSTERS[upperTeamId] || INITIAL_ROSTERS['LAR'] || [];

  const wrs = roster
    .filter((p: any) => p.position === 'WR')
    .sort((a: any, b: any) => b.ovr - a.ovr);

  const tes = roster
    .filter((p: any) => p.position === 'TE')
    .sort((a: any, b: any) => b.ovr - a.ovr);

  const rbs = roster
    .filter((p: any) => p.position === 'RB')
    .sort((a: any, b: any) => b.ovr - a.ovr);

  const qbs = roster
    .filter((p: any) => p.position === 'QB')
    .sort((a: any, b: any) => b.ovr - a.ovr);

  const results: TeamReceiverOption[] = [];

  wrs.forEach((wr: any, idx: number) => {
    const slot = `WR${idx + 1}` as any;
    results.push({
      name: wr.name,
      position: 'WR',
      depthSlot: slot,
      ovr: wr.ovr,
      label: `${wr.name} (${slot} • ${wr.ovr} OVR)`,
    });
  });

  tes.forEach((te: any, idx: number) => {
    const slot = `TE${idx + 1}` as any;
    results.push({
      name: te.name,
      position: 'TE',
      depthSlot: slot,
      ovr: te.ovr,
      label: `${te.name} (${slot} • ${te.ovr} OVR)`,
    });
  });

  rbs.forEach((rb: any, idx: number) => {
    if (idx < 2) {
      const slot = `RB${idx + 1}` as any;
      results.push({
        name: rb.name,
        position: 'RB',
        depthSlot: slot,
        ovr: rb.ovr,
        label: `${rb.name} (${slot} • ${rb.ovr} OVR)`,
      });
    }
  });

  if (qbs[0]) {
    results.push({
      name: qbs[0].name,
      position: 'QB',
      depthSlot: 'QB1',
      ovr: qbs[0].ovr,
      label: `${qbs[0].name} (QB • ${qbs[0].ovr} OVR)`,
    });
  }

  return results;
}

/**
 * Resolves the primary target for an offensive play.
 * If explicitTarget is supplied and not generic ("1st Read"), that player is used.
 * Otherwise, inspects the play's assignments for `isPrimary: true`,
 * and dynamically matches it to the team's depth chart (e.g. WR2 -> Davante Adams for Rams).
 */
export function getPlayPrimaryTarget(
  offensePlay: Play | undefined,
  offTeam: NFLTeam,
  explicitTarget?: string
): TargetPlayerInfo {
  const teamReceivers = getTeamReceiversAndTEs(offTeam.id);

  // 1. If explicitTarget is given and is a specific player name
  if (
    explicitTarget &&
    explicitTarget.trim() &&
    !explicitTarget.includes('1st Read') &&
    !explicitTarget.includes('Primary')
  ) {
    const cleanName = explicitTarget.split('(')[0].trim();
    const matched = teamReceivers.find(
      (r) =>
        r.name.toLowerCase() === cleanName.toLowerCase() ||
        cleanName.toLowerCase().includes(r.name.toLowerCase()) ||
        r.name.toLowerCase().includes(cleanName.toLowerCase())
    );
    if (matched) {
      return {
        name: matched.name,
        position: matched.position,
        slotLabel: matched.depthSlot,
        ovr: matched.ovr,
      };
    }
    if (
      cleanName.toLowerCase() === offTeam.starQB.toLowerCase() ||
      cleanName.toLowerCase().includes(offTeam.starQB.toLowerCase()) ||
      cleanName.toLowerCase().includes('qb')
    ) {
      const qbOption = teamReceivers.find((r) => r.position === 'QB');
      return {
        name: offTeam.starQB,
        position: 'QB',
        slotLabel: 'QB',
        ovr: qbOption?.ovr,
      };
    }
    return {
      name: cleanName,
      position: 'WR',
      slotLabel: 'Target',
    };
  }

  if (!offensePlay) {
    const firstWr = teamReceivers.find((r) => r.position === 'WR');
    return {
      name: firstWr?.name || offTeam.starWR || 'Wide Receiver',
      position: 'WR',
      slotLabel: 'WR1',
      ovr: firstWr?.ovr,
    };
  }

  // 2. Look for assignment with isPrimary === true
  const primaryAssign: PlayerAssignment | undefined =
    offensePlay.assignments?.find((a) => a.isPrimary) ||
    offensePlay.assignments?.find((a) => a.id.startsWith('wr') || a.id === 'te') ||
    offensePlay.assignments?.[0];

  if (!primaryAssign) {
    return {
      name: offTeam.starWR || 'Wide Receiver',
      position: 'WR',
      slotLabel: 'WR1',
    };
  }

  // If the assignment has an explicit playerName (e.g., custom play created in PlaybookEditor)
  if (primaryAssign.playerName) {
    const matched = teamReceivers.find(
      (r) => r.name.toLowerCase() === primaryAssign.playerName!.toLowerCase()
    );
    return {
      name: primaryAssign.playerName,
      position: primaryAssign.position || 'WR',
      slotLabel: primaryAssign.label || '1st Read',
      ovr: matched?.ovr,
    };
  }

  // Map assignment position/label to depth chart
  const assignId = (primaryAssign.id || '').toLowerCase();
  const assignLabel = (primaryAssign.label || '').toUpperCase();
  const assignPos = (primaryAssign.position || '').toUpperCase();

  let matched: TeamReceiverOption | undefined;

  if (assignId === 'wr2' || assignLabel === 'WR2' || assignPos === 'WR2') {
    matched = teamReceivers.find((r) => r.depthSlot === 'WR2');
  } else if (assignId === 'wr1' || assignLabel === 'WR1' || assignPos === 'WR1') {
    matched = teamReceivers.find((r) => r.depthSlot === 'WR1');
  } else if (
    assignId === 'wr3' ||
    assignLabel === 'WR3' ||
    assignLabel.includes('SLOT') ||
    assignPos === 'WR3'
  ) {
    matched = teamReceivers.find((r) => r.depthSlot === 'WR3');
  } else if (assignId === 'te' || assignLabel === 'TE' || assignPos === 'TE') {
    matched = teamReceivers.find((r) => r.depthSlot === 'TE1');
  } else if (assignId === 'te2' || assignLabel === 'TE2' || assignPos === 'TE2') {
    matched = teamReceivers.find((r) => r.depthSlot === 'TE2');
  } else if (assignId === 'rb' || assignLabel === 'RB' || assignPos === 'RB') {
    matched = teamReceivers.find((r) => r.depthSlot === 'RB1');
  } else if (assignId === 'qb' || assignLabel === 'QB' || assignPos === 'QB') {
    matched = teamReceivers.find((r) => r.depthSlot === 'QB1');
  }

  if (matched) {
    return {
      name: matched.name,
      position: matched.position,
      slotLabel: matched.depthSlot,
      ovr: matched.ovr,
    };
  }

  if (assignId === 'qb' || assignLabel === 'QB' || assignPos === 'QB') {
    return {
      name: offTeam.starQB,
      position: 'QB',
      slotLabel: 'QB',
    };
  }
  if (assignId === 'rb' || assignLabel === 'RB' || assignPos === 'RB') {
    return {
      name: offTeam.starRB,
      position: 'RB',
      slotLabel: 'RB',
    };
  }

  // Default fallback
  const firstWr = teamReceivers.find((r) => r.position === 'WR');
  return {
    name: firstWr?.name || offTeam.starWR,
    position: 'WR',
    slotLabel: 'WR1',
    ovr: firstWr?.ovr,
  };
}
