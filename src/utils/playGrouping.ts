import { Play } from '../types/game';

export interface PlayGroup {
  label: string;
  plays: Play[];
}

export function groupPlaysForDropdown(plays: Play[], isDefense: boolean): PlayGroup[] {
  if (isDefense) {
    const zones = plays.filter((p) => p.category === 'Zone');
    const mans = plays.filter((p) => p.category === 'Man');
    const blitzes = plays.filter((p) => p.category === 'Blitz');
    const special = plays.filter((p) => p.category === 'SpecialTeams');
    const others = plays.filter(
      (p) => !['Zone', 'Man', 'Blitz', 'SpecialTeams'].includes(p.category)
    );

    const groups: PlayGroup[] = [];
    if (zones.length > 0) groups.push({ label: '🛡️ Zone Coverages', plays: zones });
    if (mans.length > 0) groups.push({ label: '🔒 Man Coverages', plays: mans });
    if (blitzes.length > 0) groups.push({ label: '⚡ Blitzes & Pressure', plays: blitzes });
    if (special.length > 0) groups.push({ label: '🏈 Special Teams', plays: special });
    if (others.length > 0) groups.push({ label: '📋 Other Defenses', plays: others });
    return groups;
  } else {
    const custom = plays.filter((p) => p.isCustom);
    const runs = plays.filter((p) => !p.isCustom && p.category === 'Run');
    const deepPasses = plays.filter(
      (p) =>
        !p.isCustom &&
        p.category === 'Pass' &&
        (p.name.toLowerCase().includes('vert') ||
          p.name.toLowerCase().includes('corner') ||
          p.name.toLowerCase().includes('deep') ||
          p.name.toLowerCase().includes('streak') ||
          p.name.toLowerCase().includes('post') ||
          p.name.toLowerCase().includes('hail mary'))
    );
    const shortPasses = plays.filter(
      (p) =>
        !p.isCustom &&
        (p.category === 'Pass' || p.category === 'Screen' || p.category === 'PlayAction') &&
        !deepPasses.some((dp) => dp.id === p.id)
    );
    const special = plays.filter((p) => !p.isCustom && p.category === 'SpecialTeams');
    const others = plays.filter(
      (p) =>
        !p.isCustom &&
        !runs.some((r) => r.id === p.id) &&
        !deepPasses.some((dp) => dp.id === p.id) &&
        !shortPasses.some((sp) => sp.id === p.id) &&
        !special.some((s) => s.id === p.id)
    );

    const groups: PlayGroup[] = [];
    if (custom.length > 0) groups.push({ label: '✨ Custom Plays', plays: custom });
    if (runs.length > 0) groups.push({ label: '🏃 Run Plays', plays: runs });
    if (shortPasses.length > 0) groups.push({ label: '🎯 Pass Plays (Short & Quick)', plays: shortPasses });
    if (deepPasses.length > 0) groups.push({ label: '🔥 Pass Plays (Deep & Vertical)', plays: deepPasses });
    if (special.length > 0) groups.push({ label: '🏈 Special Teams', plays: special });
    if (others.length > 0) groups.push({ label: '📋 Other Plays', plays: others });
    return groups;
  }
}
