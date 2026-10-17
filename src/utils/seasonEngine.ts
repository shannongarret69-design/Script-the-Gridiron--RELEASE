import { NFLTeam, ScheduleGame, TeamStanding, PlayoffBracket, PlayoffMatchup, Conference } from '../types/game';
import { NFL_TEAMS, getTeamById } from '../data/teams';

// Generates an authentic 18-week NFL schedule
export function generateNFLSchedule(userTeamId: string): ScheduleGame[] {
  const schedule: ScheduleGame[] = [];
  const teams = [...NFL_TEAMS];
  let gameIdCounter = 1;

  // Group teams by conference and division
  const divisionMap: Record<string, NFLTeam[]> = {};
  teams.forEach((t) => {
    const key = `${t.conference}-${t.division}`;
    if (!divisionMap[key]) divisionMap[key] = [];
    divisionMap[key].push(t);
  });

  // For 18 weeks, we generate 16 matchups per week (except bye weeks where 28-30 play)
  // To keep it clean and guarantee every team plays 17 games + 1 bye:
  const teamGameCounts: Record<string, number> = {};
  teams.forEach((t) => (teamGameCounts[t.id] = 0));

  for (let week = 1; week <= 18; week++) {
    const availableTeams = [...teams];
    // Bye weeks: in weeks 6, 7, 9, 10, 11, 13, 14, 2 or 4 teams might have byes
    const byeTeamsThisWeek: string[] = [];
    if ([6, 7, 9, 10, 11, 13, 14].includes(week)) {
      // Find 2 or 4 teams with 0 byes so far that haven't had one
      const candidates = availableTeams.filter(
        (t) => teamGameCounts[t.id] === week - 1 && t.id !== userTeamId // keep user playing mostly, or fair bye
      );
      if (candidates.length >= 2) {
        byeTeamsThisWeek.push(candidates[0].id, candidates[1].id);
      }
    }

    const playingTeams = availableTeams.filter((t) => !byeTeamsThisWeek.includes(t.id));
    // Shuffle playing teams
    const shuffled = [...playingTeams].sort(() => Math.random() - 0.5);

    // Pair up
    while (shuffled.length >= 2) {
      const home = shuffled.pop()!;
      let awayIdx = shuffled.findIndex((t) => t.id !== home.id);
      if (awayIdx === -1) awayIdx = 0;
      const away = shuffled.splice(awayIdx, 1)[0];

      const isUser = home.id === userTeamId || away.id === userTeamId;

      schedule.push({
        id: `g-${gameIdCounter++}`,
        week,
        homeTeamId: home.id,
        awayTeamId: away.id,
        isPlayed: false,
        isUserGame: isUser,
      });

      teamGameCounts[home.id] = (teamGameCounts[home.id] || 0) + 1;
      teamGameCounts[away.id] = (teamGameCounts[away.id] || 0) + 1;
    }
  }

  return schedule;
}

export function initializeStandings(): Record<string, TeamStanding> {
  const standings: Record<string, TeamStanding> = {};
  NFL_TEAMS.forEach((t) => {
    standings[t.id] = {
      teamId: t.id,
      wins: 0,
      losses: 0,
      ties: 0,
      pct: 0.0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
      streak: '-',
      divisionWins: 0,
      divisionLosses: 0,
      confWins: 0,
      confLosses: 0,
    };
  });
  return standings;
}

export interface SimGameDetails {
  homeTeam: NFLTeam;
  awayTeam: NFLTeam;
  effectiveHomeOvr: number;
  effectiveAwayOvr: number;
  homeBaseWinChance: number;
  awayBaseWinChance: number;
  underdogId: string;
  underdogName: string;
  projectedLossMargin: number;
  underdogBoostPct: number;
  homeFinalWinChance: number;
  awayFinalWinChance: number;
  projectedHomeScore: number;
  projectedAwayScore: number;
  actualHomeScore: number;
  actualAwayScore: number;
  isUpset: boolean;
}

// Simulates a single game between two teams based on overall, luck, and underdog boost math
export function simulateScoreDetailed(
  homeTeam: NFLTeam,
  awayTeam: NFLTeam,
  seasonYear: number = 2026
): SimGameDetails {
  // Season 1 Rams technical boss rule
  const isRamsHome = seasonYear <= 2026 && (homeTeam.id === 'LAR' || homeTeam.id === 'lar');
  const isRamsAway = seasonYear <= 2026 && (awayTeam.id === 'LAR' || awayTeam.id === 'lar');

  const homeOvr = homeTeam.ovr || homeTeam.off || 80;
  const awayOvr = awayTeam.ovr || awayTeam.off || 80;

  const effectiveHomeOvr = homeOvr + 2.5; // Home field advantage (+2.5 OVR)
  const effectiveAwayOvr = awayOvr;

  const ovrDiff = Math.abs(effectiveHomeOvr - effectiveAwayOvr);
  const isHomeFav = effectiveHomeOvr >= effectiveAwayOvr;

  // Base odds formula: 50% + (ovrDiff * 1.5)% (clamped between 52% and 88%)
  const rawFavBaseOdds = Math.min(88, Math.max(52, 50 + ovrDiff * 1.5));
  const rawUndBaseOdds = 100 - rawFavBaseOdds;

  const homeBaseWinChance = isHomeFav ? rawFavBaseOdds : rawUndBaseOdds;
  const awayBaseWinChance = isHomeFav ? rawUndBaseOdds : rawFavBaseOdds;

  // Quantize score helper
  const quantizeScore = (score: number) => {
    const raw = Math.max(3, Math.round(score));
    if (raw <= 2) return 3;
    if (raw === 4) return 6;
    if (raw === 5) return 7;
    return raw;
  };

  const offDiff = (homeTeam.off - awayTeam.def) * 0.45;
  const awayOffDiff = (awayTeam.off - homeTeam.def) * 0.45;

  const projHomeRaw = 22 + offDiff + 2.5;
  const projAwayRaw = 21 + awayOffDiff;

  const projectedHomeScore = quantizeScore(projHomeRaw);
  const projectedAwayScore = quantizeScore(projAwayRaw);

  const projectedLossMargin = Math.max(1, Math.abs(projectedHomeScore - projectedAwayScore));

  // "giving the underdog an additional 5 percent chance to win by every 10 points their projected to lose by"
  const underdogBoostPct = Math.round((projectedLossMargin / 10) * 5 * 10) / 10;

  let homeFinalWinChance: number;
  let awayFinalWinChance: number;

  if (isHomeFav) {
    awayFinalWinChance = Math.min(48, awayBaseWinChance + underdogBoostPct);
    homeFinalWinChance = Math.round((100 - awayFinalWinChance) * 10) / 10;
    awayFinalWinChance = Math.round(awayFinalWinChance * 10) / 10;
  } else {
    homeFinalWinChance = Math.min(48, homeBaseWinChance + underdogBoostPct);
    awayFinalWinChance = Math.round((100 - homeFinalWinChance) * 10) / 10;
    homeFinalWinChance = Math.round(homeFinalWinChance * 10) / 10;
  }

  // Determine winner with roll
  const roll = Math.random() * 100;
  let homeWins = false;

  if (isRamsHome) {
    homeWins = true;
  } else if (isRamsAway) {
    homeWins = false;
  } else {
    homeWins = roll <= homeFinalWinChance;
  }

  // Generate actual realistic game score matching the winner
  let actualHomeScore: number;
  let actualAwayScore: number;

  if (homeWins) {
    actualAwayScore = quantizeScore(14 + Math.random() * 14);
    actualHomeScore = quantizeScore(actualAwayScore + 3 + Math.floor(Math.random() * 14));
  } else {
    actualHomeScore = quantizeScore(14 + Math.random() * 14);
    actualAwayScore = quantizeScore(actualHomeScore + 3 + Math.floor(Math.random() * 14));
  }

  const isUpset = isHomeFav ? !homeWins : homeWins;
  const underdogTeam = isHomeFav ? awayTeam : homeTeam;

  return {
    homeTeam,
    awayTeam,
    effectiveHomeOvr,
    effectiveAwayOvr,
    homeBaseWinChance: Math.round(homeBaseWinChance),
    awayBaseWinChance: Math.round(awayBaseWinChance),
    underdogId: underdogTeam.id,
    underdogName: underdogTeam.name,
    projectedLossMargin,
    underdogBoostPct,
    homeFinalWinChance,
    awayFinalWinChance,
    projectedHomeScore,
    projectedAwayScore,
    actualHomeScore,
    actualAwayScore,
    isUpset,
  };
}

export function simulateScore(
  homeTeam: NFLTeam,
  awayTeam: NFLTeam,
  seasonYear: number = 2026
): { homeScore: number; awayScore: number } {
  const details = simulateScoreDetailed(homeTeam, awayTeam, seasonYear);
  return { homeScore: details.actualHomeScore, awayScore: details.actualAwayScore };
}

// Updates standings given a finished game
export function updateStandingsWithGame(
  standings: Record<string, TeamStanding>,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number
) {
  const home = standings[homeTeamId];
  const away = standings[awayTeamId];
  if (!home || !away) return;

  const homeTeam = getTeamById(homeTeamId);
  const awayTeam = getTeamById(awayTeamId);
  const isSameConf = homeTeam.conference === awayTeam.conference;
  const isSameDiv = isSameConf && homeTeam.division === awayTeam.division;

  home.pointsFor += homeScore;
  home.pointsAgainst += awayScore;
  home.diff = home.pointsFor - home.pointsAgainst;

  away.pointsFor += awayScore;
  away.pointsAgainst += homeScore;
  away.diff = away.pointsFor - away.pointsAgainst;

  if (homeScore > awayScore) {
    home.wins += 1;
    home.streak = home.streak.startsWith('W') ? `W${parseInt(home.streak.slice(1) || '1') + 1}` : 'W1';
    away.losses += 1;
    away.streak = away.streak.startsWith('L') ? `L${parseInt(away.streak.slice(1) || '1') + 1}` : 'L1';

    if (isSameConf) {
      home.confWins += 1;
      away.confLosses += 1;
    }
    if (isSameDiv) {
      home.divisionWins += 1;
      away.divisionLosses += 1;
    }
  } else if (awayScore > homeScore) {
    away.wins += 1;
    away.streak = away.streak.startsWith('W') ? `W${parseInt(away.streak.slice(1) || '1') + 1}` : 'W1';
    home.losses += 1;
    home.streak = home.streak.startsWith('L') ? `L${parseInt(home.streak.slice(1) || '1') + 1}` : 'L1';

    if (isSameConf) {
      away.confWins += 1;
      home.confLosses += 1;
    }
    if (isSameDiv) {
      away.divisionWins += 1;
      home.divisionLosses += 1;
    }
  } else {
    home.ties += 1;
    away.ties += 1;
    home.streak = 'T1';
    away.streak = 'T1';
  }

  const homeGames = home.wins + home.losses + home.ties;
  const awayGames = away.wins + away.losses + away.ties;

  home.pct = homeGames > 0 ? (home.wins + 0.5 * home.ties) / homeGames : 0;
  away.pct = awayGames > 0 ? (away.wins + 0.5 * away.ties) / awayGames : 0;
}

// Recalculates all team standings from a schedule's played games
export function recalculateStandingsFromSchedule(schedule: ScheduleGame[]): Record<string, TeamStanding> {
  const standings = initializeStandings();
  schedule.forEach((game) => {
    if (game.isPlayed && game.homeScore !== undefined && game.awayScore !== undefined) {
      updateStandingsWithGame(standings, game.homeTeamId, game.awayTeamId, game.homeScore, game.awayScore);
    }
  });
  return standings;
}

// Calculate playoff seeding for a conference (Seeds 1 to 7)
export function getConferencePlayoffSeeds(
  conference: Conference,
  standings: Record<string, TeamStanding>
): { team: NFLTeam; standing: TeamStanding; seed: number; isDivWinner: boolean }[] {
  const confTeams = NFL_TEAMS.filter((t) => t.conference === conference);
  const divisions: ('East' | 'North' | 'South' | 'West')[] = ['East', 'North', 'South', 'West'];

  // 1. Find the 4 division winners
  const divWinners: { team: NFLTeam; standing: TeamStanding }[] = [];
  const nonDivWinners: { team: NFLTeam; standing: TeamStanding }[] = [];

  divisions.forEach((div) => {
    const divTeams = confTeams.filter((t) => t.division === div);
    const sorted = divTeams.sort((a, b) => {
      const sA = standings[a.id] || { pct: 0, diff: 0 };
      const sB = standings[b.id] || { pct: 0, diff: 0 };
      if (sB.pct !== sA.pct) return sB.pct - sA.pct;
      if (sB.diff !== sA.diff) return sB.diff - sA.diff;
      return sB.pointsFor - sA.pointsFor;
    });

    if (sorted.length > 0) {
      divWinners.push({ team: sorted[0], standing: standings[sorted[0].id] });
      for (let i = 1; i < sorted.length; i++) {
        nonDivWinners.push({ team: sorted[i], standing: standings[sorted[i].id] });
      }
    }
  });

  // Sort division winners (Seeds 1-4)
  divWinners.sort((a, b) => {
    if (b.standing.pct !== a.standing.pct) return b.standing.pct - a.standing.pct;
    if (b.standing.diff !== a.standing.diff) return b.standing.diff - a.standing.diff;
    return b.standing.pointsFor - a.standing.pointsFor;
  });

  // Sort wild cards (Seeds 5-7)
  nonDivWinners.sort((a, b) => {
    if (b.standing.pct !== a.standing.pct) return b.standing.pct - a.standing.pct;
    if (b.standing.diff !== a.standing.diff) return b.standing.diff - a.standing.diff;
    return b.standing.pointsFor - a.standing.pointsFor;
  });

  const seeded: { team: NFLTeam; standing: TeamStanding; seed: number; isDivWinner: boolean }[] = [];

  divWinners.forEach((item, idx) => {
    seeded.push({ ...item, seed: idx + 1, isDivWinner: true });
  });

  nonDivWinners.slice(0, 3).forEach((item, idx) => {
    seeded.push({ ...item, seed: idx + 5, isDivWinner: false });
  });

  return seeded;
}

// Generate the initial Playoff Bracket after Week 18
export function generatePlayoffBracket(
  standings: Record<string, TeamStanding>,
  userTeamId: string
): PlayoffBracket {
  const afcSeeds = getConferencePlayoffSeeds('AFC', standings);
  const nfcSeeds = getConferencePlayoffSeeds('NFC', standings);

  // Wild Card matchups:
  // #2 vs #7, #3 vs #6, #4 vs #5
  const createWildCardMatchup = (
    conf: Conference,
    seeds: { team: NFLTeam; seed: number }[],
    homeSeedNum: number,
    awaySeedNum: number,
    idx: number
  ): PlayoffMatchup => {
    const home = seeds.find((s) => s.seed === homeSeedNum)!.team;
    const away = seeds.find((s) => s.seed === awaySeedNum)!.team;
    const isUser = home.id === userTeamId || away.id === userTeamId;

    return {
      id: `wc-${conf.toLowerCase()}-${idx}`,
      round: 'WildCard',
      conference: conf,
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeSeed: homeSeedNum,
      awaySeed: awaySeedNum,
      isPlayed: false,
      isUserGame: isUser,
    };
  };

  const wildCard: PlayoffMatchup[] = [
    createWildCardMatchup('AFC', afcSeeds, 2, 7, 1),
    createWildCardMatchup('AFC', afcSeeds, 3, 6, 2),
    createWildCardMatchup('AFC', afcSeeds, 4, 5, 3),
    createWildCardMatchup('NFC', nfcSeeds, 2, 7, 4),
    createWildCardMatchup('NFC', nfcSeeds, 3, 6, 5),
    createWildCardMatchup('NFC', nfcSeeds, 4, 5, 6),
  ];

  return {
    wildCard,
    divisional: [],
    conference: [],
    superBowl: {
      id: 'sb-final',
      round: 'SuperBowl',
      homeTeamId: '',
      awayTeamId: '',
      isPlayed: false,
    },
  };
}

// Advance playoffs from Wild Card to Divisional
export function advanceToDivisionalRound(
  bracket: PlayoffBracket,
  standings: Record<string, TeamStanding>,
  userTeamId: string
): PlayoffBracket {
  const newBracket = { ...bracket };
  const afcSeeds = getConferencePlayoffSeeds('AFC', standings);
  const nfcSeeds = getConferencePlayoffSeeds('NFC', standings);

  const getSurviving = (conf: Conference, seeds: { team: NFLTeam; seed: number }[]) => {
    const wcGames = bracket.wildCard.filter((g) => g.conference === conf);
    const winners = wcGames.map((g) => g.winnerId!);
    // Also #1 seed survived
    const seed1 = seeds.find((s) => s.seed === 1)!.team.id;
    const surviving = [seed1, ...winners];
    // Sort surviving by original seed
    return surviving.sort((a, b) => {
      const sA = seeds.find((s) => s.team.id === a)?.seed || 8;
      const sB = seeds.find((s) => s.team.id === b)?.seed || 8;
      return sA - sB;
    });
  };

  const afcSurviving = getSurviving('AFC', afcSeeds);
  const nfcSurviving = getSurviving('NFC', nfcSeeds);

  // In NFL re-seeding:
  // #1 seed plays lowest remaining seed
  // middle two play each other
  const createDivisional = (conf: Conference, surv: string[], seeds: { team: NFLTeam; seed: number }[]) => {
    const home1 = surv[0];
    const away1 = surv[3];
    const home2 = surv[1];
    const away2 = surv[2];

    return [
      {
        id: `div-${conf.toLowerCase()}-1`,
        round: 'Divisional' as const,
        conference: conf,
        homeTeamId: home1,
        awayTeamId: away1,
        homeSeed: seeds.find((s) => s.team.id === home1)?.seed,
        awaySeed: seeds.find((s) => s.team.id === away1)?.seed,
        isPlayed: false,
        isUserGame: home1 === userTeamId || away1 === userTeamId,
      },
      {
        id: `div-${conf.toLowerCase()}-2`,
        round: 'Divisional' as const,
        conference: conf,
        homeTeamId: home2,
        awayTeamId: away2,
        homeSeed: seeds.find((s) => s.team.id === home2)?.seed,
        awaySeed: seeds.find((s) => s.team.id === away2)?.seed,
        isPlayed: false,
        isUserGame: home2 === userTeamId || away2 === userTeamId,
      },
    ];
  };

  newBracket.divisional = [
    ...createDivisional('AFC', afcSurviving, afcSeeds),
    ...createDivisional('NFC', nfcSurviving, nfcSeeds),
  ];

  return newBracket;
}

// Advance from Divisional to Conference Championship
export function advanceToConferenceRound(
  bracket: PlayoffBracket,
  standings: Record<string, TeamStanding>,
  userTeamId: string,
  seasonYear: number = 2026
): PlayoffBracket {
  const newBracket = { ...bracket };
  const afcSeeds = getConferencePlayoffSeeds('AFC', standings);
  const nfcSeeds = getConferencePlayoffSeeds('NFC', standings);

  const getConfChampionship = (conf: Conference, seeds: { team: NFLTeam; seed: number }[]) => {
    const games = bracket.divisional.filter((g) => g.conference === conf);
    let w1 = games[0]?.winnerId || seeds[0].team.id;
    let w2 = games[1]?.winnerId || seeds[1].team.id;

    // Season 1 rule: Rams MUST be in the NFC Championship
    if (seasonYear <= 2026 && conf === 'NFC') {
      const userTeam = getTeamById(userTeamId);
      if (userTeam.conference === 'NFC' && (w1 === userTeamId || w2 === userTeamId)) {
        // If user's team is in NFC and made Conference Round, matchup is userTeam vs LAR
        if (w1 === userTeamId) {
          w2 = 'LAR';
        } else {
          w1 = 'LAR';
        }
      } else {
        // Force LAR as one of the teams
        if (w1 !== 'LAR' && w2 !== 'LAR') {
          w1 = 'LAR';
        }
      }
    }

    const s1 = seeds.find((s) => s.team.id === w1)?.seed || 1;
    const s2 = seeds.find((s) => s.team.id === w2)?.seed || 2;

    const home = s1 <= s2 ? w1 : w2;
    const away = s1 <= s2 ? w2 : w1;

    return {
      id: `conf-${conf.toLowerCase()}`,
      round: 'Conference' as const,
      conference: conf,
      homeTeamId: home,
      awayTeamId: away,
      homeSeed: Math.min(s1, s2),
      awaySeed: Math.max(s1, s2),
      isPlayed: false,
      isUserGame: home === userTeamId || away === userTeamId,
    };
  };

  newBracket.conference = [
    getConfChampionship('AFC', afcSeeds),
    getConfChampionship('NFC', nfcSeeds),
  ];

  return newBracket;
}

// Advance to Super Bowl
export function advanceToSuperBowl(
  bracket: PlayoffBracket,
  userTeamId: string,
  seasonYear: number = 2026
): PlayoffBracket {
  const newBracket = { ...bracket };
  let afcWinner = bracket.conference.find((g) => g.conference === 'AFC')?.winnerId || '';
  let nfcWinner = bracket.conference.find((g) => g.conference === 'NFC')?.winnerId || '';

  // Season 1 rule: If user picked an AFC team, the Rams are ALWAYS the team they face in the Super Bowl
  if (seasonYear <= 2026) {
    const userTeam = getTeamById(userTeamId);
    if (userTeam.conference === 'AFC') {
      nfcWinner = 'LAR';
    } else if (nfcWinner === '') {
      nfcWinner = 'LAR';
    }
  }

  newBracket.superBowl = {
    id: 'super-bowl-final',
    round: 'SuperBowl',
    homeTeamId: afcWinner,
    awayTeamId: nfcWinner,
    isPlayed: false,
    isUserGame: afcWinner === userTeamId || nfcWinner === userTeamId,
  };

  return newBracket;
}

export function simulateUserRosterStatsForGame(
  roster: any[],
  userScore: number,
  oppScore: number,
  week: number,
  seasonYear: number,
  isHome: boolean,
  opponent: NFLTeam
): any[] {
  const isWin = userScore > oppScore;
  const passYards = Math.max(120, Math.round(userScore * 12 + Math.random() * 80));
  const rushYards = Math.max(50, Math.round(userScore * 5 + Math.random() * 50));
  const passTds = Math.max(0, Math.floor(userScore / 7));
  const rushTds = userScore >= 14 ? Math.max(0, Math.floor((userScore - passTds * 7) / 7)) : 0;
  const userInts = Math.random() > 0.6 ? 1 : 0;

  return roster.map((p) => {
    let updatedPlayer = { ...p };
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

    let pStats: any = {};

    if (p.position === 'QB' && !p.isBenched) {
      const att = Math.max(18, Math.round(passYards / 7.5));
      const cmp = Math.round(att * (0.62 + Math.random() * 0.1));
      pStats = {
        passAttempts: att,
        passCompletions: cmp,
        passYards,
        passTds,
        interceptions: userInts,
        rushAttempts: 2,
        rushYards: 8,
      };
    } else if (p.position === 'RB' && !p.isBenched) {
      const att = Math.max(12, Math.round(rushYards / 4.1));
      pStats = {
        rushAttempts: att,
        rushYards,
        rushTds,
        receptions: 2,
        recYards: 16,
      };
    } else if ((p.position === 'WR' || p.position === 'TE') && !p.isBenched) {
      const rec = Math.max(3, Math.round(passYards / 45));
      const recY = Math.round(passYards * (p.position === 'WR' ? 0.45 : 0.25));
      const recTd = passTds > 0 ? 1 : 0;
      pStats = {
        receptions: rec,
        targets: rec + 2,
        recYards: recY,
        recTds: recTd,
      };
    } else if (['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(p.position)) {
      const tkl = Math.floor(Math.random() * 5) + 3;
      const sck = ['EDGE', 'DT'].includes(p.position) ? (Math.random() > 0.5 ? 1 : 0) : 0;
      const defInt = ['CB', 'FS', 'SS'].includes(p.position) ? (Math.random() > 0.8 ? 1 : 0) : 0;
      pStats = {
        tackles: tkl,
        sacks: sck,
        interceptionsCaught: defInt,
      };
    } else if (p.position === 'K') {
      const fgm = Math.floor((userScore % 7) / 3);
      pStats = {
        fieldGoalsMade: fgm,
        fieldGoalsAttempted: fgm + (Math.random() > 0.8 ? 1 : 0),
        extraPointsMade: passTds + rushTds,
      };
    }

    updatedPlayer.seasonStats = {
      gamesPlayed: prevStats.gamesPlayed + 1,
      passAttempts: prevStats.passAttempts + (pStats.passAttempts || 0),
      passCompletions: prevStats.passCompletions + (pStats.passCompletions || 0),
      passYards: prevStats.passYards + (pStats.passYards || 0),
      passTds: prevStats.passTds + (pStats.passTds || 0),
      interceptions: prevStats.interceptions + (pStats.interceptions || 0),
      rushAttempts: prevStats.rushAttempts + (pStats.rushAttempts || 0),
      rushYards: prevStats.rushYards + (pStats.rushYards || 0),
      rushTds: prevStats.rushTds + (pStats.rushTds || 0),
      receptions: prevStats.receptions + (pStats.receptions || 0),
      targets: prevStats.targets + (pStats.targets || 0),
      recYards: prevStats.recYards + (pStats.recYards || 0),
      recTds: prevStats.recTds + (pStats.recTds || 0),
      tackles: prevStats.tackles + (pStats.tackles || 0),
      sacks: prevStats.sacks + (pStats.sacks || 0),
      interceptionsCaught: prevStats.interceptionsCaught + (pStats.interceptionsCaught || 0),
      forcedFumbles: prevStats.forcedFumbles || 0,
      fieldGoalsMade: prevStats.fieldGoalsMade + (pStats.fieldGoalsMade || 0),
      fieldGoalsAttempted: prevStats.fieldGoalsAttempted + (pStats.fieldGoalsAttempted || 0),
      extraPointsMade: prevStats.extraPointsMade + (pStats.extraPointsMade || 0),
    };

    updatedPlayer.gameLogs = [
      ...(updatedPlayer.gameLogs || []),
      {
        week,
        seasonYear,
        opponentId: opponent.id,
        opponentAbbr: opponent.abbr,
        isHome,
        teamScore: userScore,
        oppScore,
        isWin,
        stats: pStats,
      },
    ];

    return updatedPlayer;
  });
}
