import { FranchisePlayer, FreeAgent, DraftPick } from '../types/franchise';
import { NFLTeam } from '../types/game';
import { NFL_TEAMS } from '../data/teams';
import { AUTHENTIC_TEAM_ROSTERS } from '../data/teamRosters';

const FIRST_NAMES = [
  'Caleb', 'Marcus', 'Jaxson', 'DeAndre', 'Trevon', 'Malik', 'Colt', 'Jalen', 'Derrick', 'Kyler',
  'Micah', 'Bryce', 'CJ', 'Aiden', 'Sauce', 'Drake', 'Tariq', 'Zay', 'Quentin', 'Christian',
  'Xavier', 'Devon', 'Garrett', 'Tyree', 'Nolan', 'Braylon', 'Keon', 'Kobe', 'Darius', 'Jahmyr',
  'Rome', 'Ladd', 'Bo', 'Jayden', 'Brock', 'Cooper', 'Marvin', 'Jordan', 'Braelon', 'Adonai',
  'Payton', 'Terrance', 'Dalvin', 'Isaiah', 'Lamar', 'Travis', 'Amari', 'Justin', 'Darnell', 'Cameron'
];

const LAST_NAMES = [
  'Washington', 'Sterling', 'Brooks', 'Vance', 'Campbell', 'Harrison', 'Daniels', 'Stroud', 'Carter', 'Turner',
  'Richardson', 'McCarthy', 'Worthy', 'Odunze', 'Mitchell', 'Fashanu', 'Alt', 'Bowers', 'Nabers', 'Maye',
  'Pennington', 'Thornton', 'Blackwell', 'Covington', 'Kincaid', 'Hendrickson', 'Sutherland', 'Van Ness', 'Branch', 'Porter',
  'Ramsey', 'Jefferson', 'Diggs', 'Parsons', 'Surtain', 'Hutchinson', 'Gardner', 'St. Brown', 'Bosa', 'Mahomes',
  'Kelce', 'Woolen', 'Chubb', 'Henry', 'Humphrey', 'McCollum', 'Vanderbilt', 'Sinclair', 'Hayward', 'Lockett'
];

const COLLEGES = [
  'Ohio State', 'Alabama', 'Georgia', 'Michigan', 'Texas', 'USC', 'LSU', 'Oregon', 'Penn State',
  'Notre Dame', 'Florida', 'Florida State', 'Washington', 'Oklahoma', 'Clemson', 'Tennessee',
  'Miami (FL)', 'Texas A&M', 'Wisconsin', 'Iowa', 'Utah', 'TCU', 'Colorado', 'Ole Miss', 'Auburn'
];

const ARCHETYPES_BY_POS: Record<string, string[]> = {
  QB: ['Field General', 'Dual-Threat Playmaker', 'Deep Cannon Arm', 'Scramble Wizard'],
  RB: ['Power North-South Bruiser', 'One-Cut Speed Burner', 'Pass-Catching Elusive', 'Balanced All-Down Workhorse'],
  WR: ['Deep Threat Speedster', 'Route-Running Technician', 'Physical Red Zone Target', 'Slot Machine Shifty'],
  TE: ['Vertical Seam Threat', 'Inline Blocking Anchor', 'Possession Hybrid'],
  OT: ['Pass Protection Wall', 'Power Run Mauler', 'Agile Zone Blocker'],
  OG: ['Interior Anchor', 'Pulling Lead Blocker', 'Road Grader'],
  C: ['Line Calling Mastermind', 'Quick-Snapping Anchor'],
  EDGE: ['Speed Dip Rusher', 'Power Bull-Rusher', 'Edge Setter Contain'],
  DT: ['Run-Stuffing Juggernaut', '3-Technique Pass Penetrator', 'Nose Tackle Anchor'],
  MLB: ['Field General Enforcer', 'Sideline-to-Sideline Hawk', 'Thumper Run Stopper'],
  CB: ['Lockdown Press-Man', 'Ball-Hawk Zone Specialist', 'Slot Agility Ace'],
  FS: ['Center-Field Hawk', 'Range Cover-3 Roamer', 'Playmaker'],
  SS: ['In-The-Box Enforcer', 'Hybrid Rover Tackler', 'Big Hitter'],
  K: ['Clutch Deep Cannon', 'Precision Accuracy Specialist'],
};

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateRandomName(): string {
  return `${getRandomItem(FIRST_NAMES)} ${getRandomItem(LAST_NAMES)}`;
}

export function generateInitialTeamRoster(team: NFLTeam): FranchisePlayer[] {
  // Check if authentic Madden 27 / Madden 26 roster exists for this team
  if (AUTHENTIC_TEAM_ROSTERS[team.id] && AUTHENTIC_TEAM_ROSTERS[team.id].length > 0) {
    return AUTHENTIC_TEAM_ROSTERS[team.id].map((p, idx) => ({
      id: `p-${team.id}-${p.position.toLowerCase()}-${idx + 1}-${p.name.replace(/[^a-zA-Z0-9]/g, '')}`,
      name: p.name,
      position: p.position,
      ovr: p.ovr,
      potential: p.potential,
      age: p.age,
      college: p.college,
      speed: p.speed,
      strength: p.strength,
      agility: p.agility,
      awareness: p.awareness,
      archetype: p.archetype,
      salary: p.salary,
      contractYears: p.contractYears,
    }));
  }

  const baseOvr = team.ovr;
  const offOvr = team.off;
  const defOvr = team.def;

  const roster: FranchisePlayer[] = [
    // Starting QB
    {
      id: `p-${team.id}-qb1`,
      name: team.starQB,
      position: 'QB',
      ovr: Math.min(99, Math.max(76, offOvr + getRandomInt(2, 6))),
      potential: 'A',
      age: getRandomInt(23, 31),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(75, 92),
      strength: getRandomInt(70, 85),
      agility: getRandomInt(78, 90),
      awareness: getRandomInt(85, 96),
      archetype: getRandomItem(ARCHETYPES_BY_POS.QB),
      salary: 32.5,
      contractYears: 4,
    },
    // Backup QB
    {
      id: `p-${team.id}-qb2`,
      name: generateRandomName(),
      position: 'QB',
      ovr: Math.max(68, offOvr - getRandomInt(10, 15)),
      potential: 'B',
      age: getRandomInt(22, 28),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(70, 86),
      strength: getRandomInt(68, 80),
      agility: getRandomInt(72, 85),
      awareness: getRandomInt(70, 82),
      archetype: getRandomItem(ARCHETYPES_BY_POS.QB),
      salary: 3.5,
      contractYears: 2,
    },
    // Star RB
    {
      id: `p-${team.id}-rb1`,
      name: team.starRB,
      position: 'RB',
      ovr: Math.min(99, Math.max(78, offOvr + getRandomInt(1, 5))),
      potential: 'A',
      age: getRandomInt(22, 28),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(88, 96),
      strength: getRandomInt(78, 89),
      agility: getRandomInt(88, 95),
      awareness: getRandomInt(82, 93),
      archetype: getRandomItem(ARCHETYPES_BY_POS.RB),
      salary: 12.0,
      contractYears: 3,
    },
    // Backup RB
    {
      id: `p-${team.id}-rb2`,
      name: generateRandomName(),
      position: 'RB',
      ovr: Math.max(70, offOvr - getRandomInt(8, 12)),
      potential: 'B+',
      age: getRandomInt(21, 26),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(87, 94),
      strength: getRandomInt(74, 84),
      agility: getRandomInt(85, 92),
      awareness: getRandomInt(72, 82),
      archetype: getRandomItem(ARCHETYPES_BY_POS.RB),
      salary: 2.2,
      contractYears: 2,
    },
    // Star WR1
    {
      id: `p-${team.id}-wr1`,
      name: team.starWR,
      position: 'WR',
      ovr: Math.min(99, Math.max(80, offOvr + getRandomInt(2, 7))),
      potential: 'A+',
      age: getRandomInt(23, 29),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(90, 98),
      strength: getRandomInt(68, 80),
      agility: getRandomInt(90, 97),
      awareness: getRandomInt(86, 96),
      archetype: getRandomItem(ARCHETYPES_BY_POS.WR),
      salary: 24.0,
      contractYears: 4,
    },
    // WR2
    {
      id: `p-${team.id}-wr2`,
      name: generateRandomName(),
      position: 'WR',
      ovr: Math.max(74, offOvr - getRandomInt(3, 8)),
      potential: 'B+',
      age: getRandomInt(22, 27),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(89, 95),
      strength: getRandomInt(65, 76),
      agility: getRandomInt(86, 94),
      awareness: getRandomInt(76, 88),
      archetype: getRandomItem(ARCHETYPES_BY_POS.WR),
      salary: 9.5,
      contractYears: 3,
    },
    // WR3 Slot
    {
      id: `p-${team.id}-wr3`,
      name: generateRandomName(),
      position: 'WR',
      ovr: Math.max(71, offOvr - getRandomInt(7, 12)),
      potential: 'B',
      age: getRandomInt(21, 25),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(88, 94),
      strength: getRandomInt(62, 72),
      agility: getRandomInt(87, 94),
      awareness: getRandomInt(72, 82),
      archetype: 'Slot Machine Shifty',
      salary: 3.8,
      contractYears: 2,
    },
    // Starting TE
    {
      id: `p-${team.id}-te1`,
      name: generateRandomName(),
      position: 'TE',
      ovr: Math.min(94, Math.max(74, offOvr - getRandomInt(2, 6))),
      potential: 'B+',
      age: getRandomInt(23, 30),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(80, 89),
      strength: getRandomInt(80, 90),
      agility: getRandomInt(78, 88),
      awareness: getRandomInt(78, 90),
      archetype: getRandomItem(ARCHETYPES_BY_POS.TE),
      salary: 8.5,
      contractYears: 3,
    },
    // Offensive Tackle LT
    {
      id: `p-${team.id}-ot1`,
      name: generateRandomName(),
      position: 'OT',
      ovr: Math.max(75, offOvr - getRandomInt(1, 5)),
      potential: 'B+',
      age: getRandomInt(24, 31),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(65, 74),
      strength: getRandomInt(88, 97),
      agility: getRandomInt(70, 80),
      awareness: getRandomInt(82, 92),
      archetype: 'Pass Protection Wall',
      salary: 16.0,
      contractYears: 3,
    },
    // Star Defensive Player
    {
      id: `p-${team.id}-def-star`,
      name: team.starDef,
      position: 'EDGE',
      ovr: Math.min(99, Math.max(82, defOvr + getRandomInt(2, 6))),
      potential: 'A+',
      age: getRandomInt(23, 29),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(82, 91),
      strength: getRandomInt(88, 98),
      agility: getRandomInt(82, 92),
      awareness: getRandomInt(88, 97),
      archetype: getRandomItem(ARCHETYPES_BY_POS.EDGE),
      salary: 26.0,
      contractYears: 4,
    },
    // Defensive Tackle DT
    {
      id: `p-${team.id}-dt1`,
      name: generateRandomName(),
      position: 'DT',
      ovr: Math.max(75, defOvr - getRandomInt(2, 6)),
      potential: 'B',
      age: getRandomInt(24, 30),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(62, 73),
      strength: getRandomInt(90, 99),
      agility: getRandomInt(65, 76),
      awareness: getRandomInt(78, 88),
      archetype: 'Run-Stuffing Juggernaut',
      salary: 11.0,
      contractYears: 3,
    },
    // Linebacker MLB
    {
      id: `p-${team.id}-mlb1`,
      name: generateRandomName(),
      position: 'MLB',
      ovr: Math.max(76, defOvr - getRandomInt(1, 5)),
      potential: 'A',
      age: getRandomInt(23, 28),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(83, 90),
      strength: getRandomInt(82, 92),
      agility: getRandomInt(80, 89),
      awareness: getRandomInt(84, 94),
      archetype: 'Field General Enforcer',
      salary: 13.5,
      contractYears: 3,
    },
    // Cornerback CB1
    {
      id: `p-${team.id}-cb1`,
      name: generateRandomName(),
      position: 'CB',
      ovr: Math.max(77, defOvr - getRandomInt(0, 4)),
      potential: 'A',
      age: getRandomInt(22, 28),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(91, 98),
      strength: getRandomInt(64, 76),
      agility: getRandomInt(92, 98),
      awareness: getRandomInt(82, 94),
      archetype: 'Lockdown Press-Man',
      salary: 15.0,
      contractYears: 4,
    },
    // Cornerback CB2
    {
      id: `p-${team.id}-cb2`,
      name: generateRandomName(),
      position: 'CB',
      ovr: Math.max(73, defOvr - getRandomInt(5, 10)),
      potential: 'B+',
      age: getRandomInt(22, 27),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(90, 96),
      strength: getRandomInt(62, 74),
      agility: getRandomInt(89, 95),
      awareness: getRandomInt(76, 86),
      archetype: 'Ball-Hawk Zone Specialist',
      salary: 6.5,
      contractYears: 2,
    },
    // Safety FS
    {
      id: `p-${team.id}-fs1`,
      name: generateRandomName(),
      position: 'FS',
      ovr: Math.max(75, defOvr - getRandomInt(2, 7)),
      potential: 'B+',
      age: getRandomInt(23, 29),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(87, 95),
      strength: getRandomInt(68, 80),
      agility: getRandomInt(88, 95),
      awareness: getRandomInt(80, 92),
      archetype: 'Center-Field Hawk',
      salary: 9.0,
      contractYears: 3,
    },
    // Kicker
    {
      id: `p-${team.id}-k1`,
      name: generateRandomName(),
      position: 'K',
      ovr: getRandomInt(75, 89),
      potential: 'B',
      age: getRandomInt(23, 34),
      college: getRandomItem(COLLEGES),
      speed: 68,
      strength: getRandomInt(84, 98), // kick power
      agility: 70,
      awareness: getRandomInt(80, 94),
      archetype: 'Clutch Deep Cannon',
      salary: 3.5,
      contractYears: 2,
    },
  ];

  return roster;
}

// Generate realistic AI Draft Class for NFL Draft
export function generateDraftClass(year: number): FranchisePlayer[] {
  const positions: Array<'QB' | 'RB' | 'WR' | 'TE' | 'OT' | 'OG' | 'EDGE' | 'DT' | 'MLB' | 'CB' | 'FS' | 'K'> = [
    'QB', 'QB', 'QB', 'QB',
    'RB', 'RB', 'RB', 'RB',
    'WR', 'WR', 'WR', 'WR', 'WR', 'WR',
    'TE', 'TE', 'TE',
    'OT', 'OT', 'OT', 'OT',
    'OG', 'OG',
    'EDGE', 'EDGE', 'EDGE', 'EDGE', 'EDGE',
    'DT', 'DT', 'DT',
    'MLB', 'MLB', 'MLB',
    'CB', 'CB', 'CB', 'CB', 'CB',
    'FS', 'FS', 'FS',
    'K', 'K'
  ];

  const draftClass: FranchisePlayer[] = [];

  // Generate 80 top prospects across 7 projected rounds
  for (let i = 0; i < 75; i++) {
    const pos = getRandomItem(positions);
    const round = Math.min(7, Math.floor(i / 10) + 1);

    // OVR depends on round tier with potential gems & busts
    let baseOvr = 82 - round * 2;
    if (round === 1) baseOvr = getRandomInt(77, 86);
    else if (round === 2) baseOvr = getRandomInt(73, 80);
    else if (round === 3) baseOvr = getRandomInt(70, 77);
    else baseOvr = getRandomInt(65, 74);

    // 10% chance of hidden superstar gem
    const isGem = Math.random() < 0.10;
    if (isGem) baseOvr += getRandomInt(4, 8);

    const ovr = Math.min(89, Math.max(64, baseOvr));
    const potential: 'A+' | 'A' | 'B+' | 'B' | 'C' = 
      ovr >= 82 ? 'A+' : ovr >= 77 ? 'A' : ovr >= 72 ? 'B+' : ovr >= 68 ? 'B' : 'C';

    const archetype = getRandomItem(ARCHETYPES_BY_POS[pos] || ['All-Around Athlete']);
    const name = generateRandomName();
    const college = getRandomItem(COLLEGES);

    const scoutingNotes = [
      `Explosive athletic metrics recorded at the NFL Combine.`,
      `Tremendous game tape against top-ranked SEC opponents.`,
      `Instant day-one starter potential with elite football IQ.`,
      `High-ceiling developmental prospect with freakish physical traits.`,
      `All-American team captain known for unmatched locker room leadership.`,
      `Dominant highlight reel showing exceptional burst and closing speed.`
    ];

    draftClass.push({
      id: `draft-${year}-${i + 1}`,
      name,
      position: pos,
      ovr,
      potential,
      age: getRandomInt(20, 23),
      college,
      speed: getRandomInt(72, 98),
      strength: getRandomInt(65, 97),
      agility: getRandomInt(70, 97),
      awareness: getRandomInt(65, 88),
      archetype,
      salary: round === 1 ? 6.5 : round === 2 ? 3.2 : 1.2,
      contractYears: 4,
      isRookie: true,
      projectedRound: round,
      scoutingNotes: getRandomItem(scoutingNotes),
    });
  }

  // Sort by overall and projected round
  draftClass.sort((a, b) => b.ovr - a.ovr);
  return draftClass;
}

// Always starts as a free agent in season mode with all stats 99
export function createWayneGarrettFreeAgent(year: number = 2026): FreeAgent {
  return {
    id: `fa-wayne-garrett-${year}`,
    name: 'Wayne Garrett',
    position: 'RB',
    ovr: 99,
    potential: 'A+',
    age: 23,
    college: 'Generational Superstar',
    speed: 99,
    strength: 99,
    agility: 99,
    awareness: 99,
    archetype: 'Elusive Power Back',
    salary: 4.5,
    contractYears: 4,
    askingSalary: 4.5,
    interest: 100,
    level: 10,
    xp: 99,
    maxOvr: 99,
    scoutingNotes: 'Elite running back with supreme burst, devastating tackle-breaking strength, and open-field elusiveness.',
    scoutedStats: ['Elite Speed', 'Elite Power', 'Elite Agility', 'Field Vision'],
  };
}

// Generate realistic Free Agent Market
export function generateFreeAgentsPool(year: number): FreeAgent[] {
  const freeAgents: FreeAgent[] = [];

  // Wayne Garrett always starts as a 99-rated Free Agent
  freeAgents.push(createWayneGarrettFreeAgent(year));

  const positions: Array<'QB' | 'RB' | 'WR' | 'TE' | 'OT' | 'EDGE' | 'DT' | 'MLB' | 'CB' | 'FS' | 'K'> = [
    'QB', 'RB', 'WR', 'WR', 'TE', 'OT', 'EDGE', 'DT', 'MLB', 'CB', 'FS', 'K'
  ];

  for (let i = 0; i < 40; i++) {
    const pos = getRandomItem(positions);
    const tier = i < 8 ? 'elite' : i < 20 ? 'starter' : 'depth';

    let ovr = 75;
    let askingSalary = 8.0;

    if (tier === 'elite') {
      ovr = getRandomInt(84, 93);
      askingSalary = getRandomInt(16, 28);
    } else if (tier === 'starter') {
      ovr = getRandomInt(78, 83);
      askingSalary = getRandomInt(8, 15);
    } else {
      ovr = getRandomInt(70, 77);
      askingSalary = getRandomInt(2, 6);
    }

    const potential: 'A+' | 'A' | 'B+' | 'B' | 'C' = 
      ovr >= 88 ? 'A+' : ovr >= 82 ? 'A' : ovr >= 76 ? 'B+' : 'B';

    freeAgents.push({
      id: `fa-${year}-${i + 1}`,
      name: generateRandomName(),
      position: pos,
      ovr,
      potential,
      age: getRandomInt(24, 33),
      college: getRandomItem(COLLEGES),
      speed: getRandomInt(75, 96),
      strength: getRandomInt(70, 96),
      agility: getRandomInt(75, 96),
      awareness: getRandomInt(78, 95),
      archetype: getRandomItem(ARCHETYPES_BY_POS[pos] || ['Veteran Pro']),
      salary: askingSalary,
      contractYears: getRandomInt(1, 4),
      askingSalary,
      interest: getRandomInt(40, 85),
    });
  }

  freeAgents.sort((a, b) => b.ovr - a.ovr);
  return freeAgents;
}

// Generate 32-team draft order for 3 rounds based on standings & playoff finish
export function generateDraftOrder(
  standings: Record<string, any>,
  userTeamId: string,
  playoffBracket?: any
): DraftPick[] {
  const teams = [...NFL_TEAMS];

  const getRecord = (tId: string) => {
    return standings[tId] || { wins: 0, losses: 0, ties: 0, pct: 0, diff: 0, pointsFor: 0 };
  };

  // Compare function for teams (worst record gets earliest pick)
  const compareWorstFirst = (aId: string, bId: string) => {
    const stA = getRecord(aId);
    const stB = getRecord(bId);
    if (stA.pct !== stB.pct) return stA.pct - stB.pct; // lowest win pct first
    if (stA.wins !== stB.wins) return stA.wins - stB.wins; // lowest wins first
    if (stA.diff !== stB.diff) return stA.diff - stB.diff; // lowest point diff first
    return stA.pointsFor - stB.pointsFor;
  };

  let orderedTeamIds: string[] = [];

  if (playoffBracket && playoffBracket.superBowl && playoffBracket.superBowl.isPlayed) {
    const sb = playoffBracket.superBowl;
    const sbWinner = sb.winnerId;
    const sbRunnerUp = sb.winnerId === sb.homeTeamId ? sb.awayTeamId : sb.homeTeamId;

    const confGames = playoffBracket.conference || [];
    const confLosers = confGames.map((g: any) => (g.winnerId === g.homeTeamId ? g.awayTeamId : g.homeTeamId)).filter(Boolean);

    const divGames = playoffBracket.divisional || [];
    const divLosers = divGames.map((g: any) => (g.winnerId === g.homeTeamId ? g.awayTeamId : g.homeTeamId)).filter(Boolean);

    const wcGames = playoffBracket.wildCard || [];
    const wcLosers = wcGames.map((g: any) => (g.winnerId === g.homeTeamId ? g.awayTeamId : g.homeTeamId)).filter(Boolean);

    const playoffTeamIds = new Set([
      sbWinner,
      sbRunnerUp,
      ...confLosers,
      ...divLosers,
      ...wcLosers,
    ].filter(Boolean));

    const nonPlayoffTeams = teams
      .map((t) => t.id)
      .filter((id) => !playoffTeamIds.has(id))
      .sort(compareWorstFirst);

    const wcLosersSorted = wcLosers.sort(compareWorstFirst);
    const divLosersSorted = divLosers.sort(compareWorstFirst);
    const confLosersSorted = confLosers.sort(compareWorstFirst);

    orderedTeamIds = [
      ...nonPlayoffTeams,      // Picks 1-18 (lowest record gets #1 overall)
      ...wcLosersSorted,       // Picks 19-24
      ...divLosersSorted,      // Picks 25-28
      ...confLosersSorted,     // Picks 29-30
      ...(sbRunnerUp ? [sbRunnerUp] : []), // Pick 31
      ...(sbWinner ? [sbWinner] : []),     // Pick 32 (Super Bowl Champion)
    ];

    // Ensure all 32 teams are included
    teams.forEach((t) => {
      if (!orderedTeamIds.includes(t.id)) {
        orderedTeamIds.push(t.id);
      }
    });
  } else {
    // Standard sorting by regular season standings (worst record gets #1 overall pick)
    orderedTeamIds = teams.map((t) => t.id).sort(compareWorstFirst);
  }

  const draftPicks: DraftPick[] = [];
  let overall = 1;

  for (let round = 1; round <= 3; round++) {
    orderedTeamIds.forEach((tId, idx) => {
      draftPicks.push({
        round,
        pickNumber: idx + 1,
        overallPick: overall++,
        teamId: tId,
      });
    });
  }

  return draftPicks;
}
