import { SimGameDetails } from './seasonEngine';
import { WeeklyLeagueNews } from '../types/franchise';
import { NFLTeam } from '../types/game';

const TOP_QB_NAMES = [
  'Josh Allen', 'Patrick Mahomes', 'Lamar Jackson', 'Joe Burrow', 
  'C.J. Stroud', 'Jordan Love', 'Jared Goff', 'Jalen Hurts', 'Matthew Stafford', 'Dak Prescott'
];

const TOP_RB_NAMES = [
  'Saquon Barkley', 'Derrick Henry', 'Christian McCaffrey', 'Jahmyr Gibbs',
  'Bijan Robinson', 'Kyren Williams', 'Josh Jacobs', 'Jonathan Taylor', 'James Cook', 'Breece Hall'
];

const TOP_WR_NAMES = [
  'Justin Jefferson', 'Ja\'Marr Chase', 'CeeDee Lamb', 'Amon-Ra St. Brown',
  'Tyreek Hill', 'Puka Nacua', 'A.J. Brown', 'Nico Collins', 'Davante Adams', 'Marvin Harrison Jr.'
];

const TOP_DEF_NAMES = [
  'Myles Garrett', 'Micah Parsons', 'T.J. Watt', 'Nick Bosa',
  'Maxx Crosby', 'Chris Jones', 'Sauce Gardner', 'Roquan Smith', 'Fred Warner', 'Kyle Hamilton'
];

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates an authentic, narrative-rich weekly League News summary based on
 * the week's simulated games, upsets, and standout performances.
 */
export function generateWeeklyLeagueNews(
  weekNum: number,
  seasonYear: number,
  simDetailsList: SimGameDetails[],
  userGameResult?: {
    userTeam: NFLTeam;
    oppTeam: NFLTeam;
    userScore: number;
    oppScore: number;
    isWin: boolean;
  }
): WeeklyLeagueNews {
  const upsets: WeeklyLeagueNews['upsets'] = [];
  const allScores: WeeklyLeagueNews['allScores'] = [];

  let closestDiff = 999;
  let thrillerGame: WeeklyLeagueNews['thrillerGame'] | undefined = undefined;

  // Process all simulated matchups
  simDetailsList.forEach((sim) => {
    const homeWon = sim.actualHomeScore > sim.actualAwayScore;
    const winner = homeWon ? sim.homeTeam : sim.awayTeam;
    const loser = homeWon ? sim.awayTeam : sim.homeTeam;
    const winnerScore = homeWon ? sim.actualHomeScore : sim.actualAwayScore;
    const loserScore = homeWon ? sim.actualAwayScore : sim.actualHomeScore;
    const diff = Math.abs(winnerScore - loserScore);

    const isUpset = sim.isUpset || (homeWon ? sim.homeFinalWinChance < 48 : sim.awayFinalWinChance < 48);
    const winProb = homeWon ? sim.homeFinalWinChance : sim.awayFinalWinChance;

    allScores.push({
      homeId: sim.homeTeam.id,
      homeScore: sim.actualHomeScore,
      awayId: sim.awayTeam.id,
      awayScore: sim.actualAwayScore,
      isUpset,
    });

    if (isUpset) {
      upsets.push({
        winnerId: winner.id,
        winnerName: `${winner.city} ${winner.name}`,
        winnerScore,
        loserId: loser.id,
        loserName: `${loser.city} ${loser.name}`,
        loserScore,
        upsetHeadline: `🚨 UPSET ALERT: ${winner.city} (${winProb}% win prob) stuns ${loser.city} ${winnerScore}-${loserScore}!`,
        winProb,
      });
    }

    if (diff < closestDiff) {
      closestDiff = diff;
      thrillerGame = {
        homeTeam: sim.homeTeam.name,
        homeScore: sim.actualHomeScore,
        awayTeam: sim.awayTeam.name,
        awayScore: sim.actualAwayScore,
        recap: diff === 0 
          ? `OVERTIME TIE! ${sim.homeTeam.name} and ${sim.awayTeam.name} finish deadlocked ${sim.actualHomeScore}-${sim.actualAwayScore} in a defensive slugfest.`
          : diff <= 3
          ? `NAIL-BITER! ${winner.name} edge out ${loser.name} ${winnerScore}-${loserScore} with a clutch field goal in the final seconds!`
          : `CLASH OF TITANS: ${winner.name} prevail ${winnerScore}-${loserScore} over ${loser.name} in an intense back-and-forth battle.`,
      };
    }
  });

  // If user played their game, also include in scores
  if (userGameResult) {
    allScores.push({
      homeId: userGameResult.userTeam.id,
      homeScore: userGameResult.userScore,
      awayId: userGameResult.oppTeam.id,
      awayScore: userGameResult.oppScore,
    });
  }

  // Derive Top Performers of the Week
  const qbPassYards = getRandomInt(320, 440);
  const qbTds = getRandomInt(3, 5);
  const qbInts = getRandomInt(0, 1);
  const qbName = getRandom(TOP_QB_NAMES);

  const rbYards = getRandomInt(135, 215);
  const rbTds = getRandomInt(2, 3);
  const rbCarries = getRandomInt(20, 28);
  const rbYpc = (rbYards / rbCarries).toFixed(1);
  const rbName = getRandom(TOP_RB_NAMES);

  const wrRec = getRandomInt(8, 14);
  const wrYards = getRandomInt(140, 210);
  const wrTds = getRandomInt(1, 3);
  const wrName = getRandom(TOP_WR_NAMES);

  const defSacks = (getRandomInt(2, 4) + (Math.random() > 0.5 ? 0.5 : 0)).toFixed(1);
  const defTackles = getRandomInt(6, 11);
  const defTfl = getRandomInt(2, 4);
  const defName = getRandom(TOP_DEF_NAMES);

  const topPerformers: WeeklyLeagueNews['topPerformers'] = [
    {
      category: 'Passing',
      playerName: qbName,
      position: 'QB',
      teamId: 'NFL',
      teamName: 'Offensive Player of the Week',
      statLine: `${qbPassYards} YDS, ${qbTds} TD, ${qbInts} INT • ${getRandomInt(72, 84)}% Comp`,
      headline: `${qbName} delivered a masterclass through the air with ${qbPassYards} yards and ${qbTds} touchdowns!`,
    },
    {
      category: 'Rushing',
      playerName: rbName,
      position: 'RB',
      teamId: 'NFL',
      teamName: 'Ground Warrior of the Week',
      statLine: `${rbYards} RUSH YDS, ${rbTds} TD • ${rbYpc} YPC (${rbCarries} carries)`,
      headline: `${rbName} dominated the trenches, racking up ${rbYards} rushing yards and ${rbTds} scores.`,
    },
    {
      category: 'Receiving',
      playerName: wrName,
      position: 'WR',
      teamId: 'NFL',
      teamName: 'Air Weapon of the Week',
      statLine: `${wrRec} REC, ${wrYards} YDS, ${wrTds} TD (Long: ${getRandomInt(45, 68)} YD)`,
      headline: `${wrName} proved completely unguardable, snatching ${wrRec} receptions for ${wrYards} yards!`,
    },
    {
      category: 'Defense',
      playerName: defName,
      position: 'EDGE',
      teamId: 'NFL',
      teamName: 'Defensive Player of the Week',
      statLine: `${defSacks} SACKS, ${defTfl} TFL, ${defTackles} TACKLES, 1 FF`,
      headline: `${defName} wreaked havoc in the backfield, piling up ${defSacks} sacks and living in the pocket!`,
    },
  ];

  // Primary Headline
  const mainHeadline = upsets.length > 0
    ? `WEEK ${weekNum} SHOCKERS: ${upsets[0].winnerName} Stuns the League in Huge Upset!`
    : `WEEK ${weekNum} REVIEW: Offenses Light Up Scoreboards Across the NFL!`;

  const summary = upsets.length > 0
    ? `Week ${weekNum} saw ${upsets.length} major underdog ${upsets.length === 1 ? 'victory' : 'victories'} shake up the playoff picture, led by ${upsets[0].winnerName}'s signature triumph.`
    : `Favorites held firm in Week ${weekNum} action as powerhouse squads flexed their muscle across high-scoring conference showdowns.`;

  return {
    id: `league-news-w${weekNum}-${Date.now()}`,
    week: weekNum,
    seasonYear,
    date: `Week ${weekNum}`,
    headline: mainHeadline,
    summary,
    upsets,
    topPerformers,
    thrillerGame,
    allScores,
  };
}
