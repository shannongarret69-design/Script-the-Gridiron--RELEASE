import { FranchisePlayer, FranchiseSeasonState, MvpCandidate, SeasonAwards, MvpHistoryEntry } from '../types/franchise';
import { NFL_TEAMS, getTeamById } from '../data/teams';
import { TeamStanding } from '../types/game';

/**
 * Calculates a player's MVP metric index based on offensive & defensive output plus team winning record.
 */
export function calculatePlayerMvpScore(
  player: FranchisePlayer,
  standing: TeamStanding | undefined,
  currentWeek: number
): { score: number; summary: string } {
  const st = player.seasonStats || {
    gamesPlayed: 0,
    passYards: 0,
    passTds: 0,
    interceptions: 0,
    rushYards: 0,
    rushTds: 0,
    recYards: 0,
    recTds: 0,
    receptions: 0,
    tackles: 0,
    sacks: 0,
    interceptionsCaught: 0,
    forcedFumbles: 0,
  };

  const games = Math.max(1, st.gamesPlayed || Math.min(17, currentWeek));
  const wins = standing?.wins || 0;
  const losses = standing?.losses || 0;
  const totalGamesPlayed = Math.max(1, wins + losses);
  const winPct = wins / totalGamesPlayed;

  let baseScore = 0;
  const statParts: string[] = [];

  // Wayne Garrett baseline superstar prestige
  if (player.name === 'Wayne Garrett') {
    baseScore += 35;
  }

  // 1. Passing (QB)
  if (player.position === 'QB' || (st.passYards && st.passYards > 200)) {
    const passYds = st.passYards || 0;
    const passTds = st.passTds || 0;
    const ints = st.interceptions || 0;
    const rushYds = st.rushYards || 0;
    const rushTds = st.rushTds || 0;

    let qbScore = (passYds * 0.045) + (passTds * 4.5) - (ints * 3.0) + (rushYds * 0.10) + (rushTds * 6.0);

    // Milestones
    if (passYds >= 4000) qbScore += 18;
    else if (passYds >= 3200) qbScore += 10;

    if (passTds >= 35) qbScore += 22;
    else if (passTds >= 28) qbScore += 12;

    if (passTds > 0 || passYds > 0) {
      statParts.push(`${passYds.toLocaleString()} YDS`, `${passTds} TD`, `${ints} INT`);
      if (rushYds > 200) statParts.push(`${rushYds} RUSH YDS`, `${rushTds} TD`);
    }

    baseScore += qbScore;
  }
  // 2. Rushing (RB)
  else if (player.position === 'RB' || (st.rushYards && st.rushYards > 200)) {
    const rushYds = st.rushYards || 0;
    const rushTds = st.rushTds || 0;
    const recYds = st.recYards || 0;
    const recTds = st.recTds || 0;
    const recs = st.receptions || 0;

    let rbScore = (rushYds * 0.11) + (rushTds * 6.5) + (recYds * 0.09) + (recTds * 6.0) + (recs * 0.6);

    // Milestones
    if (rushYds >= 1800) rbScore += 30;
    else if (rushYds >= 1400) rbScore += 20;
    else if (rushYds >= 1000) rbScore += 10;

    if (rushTds >= 18) rbScore += 25;
    else if (rushTds >= 12) rbScore += 14;

    if (rushYds > 0 || rushTds > 0) {
      statParts.push(`${rushYds.toLocaleString()} RUSH YDS`, `${rushTds} RUSH TD`);
      if (recYds > 150) statParts.push(`${recYds} REC YDS`, `${recTds} TD`);
    }

    baseScore += rbScore;
  }
  // 3. Receiving (WR / TE)
  else if (['WR', 'TE'].includes(player.position)) {
    const recYds = st.recYards || 0;
    const recTds = st.recTds || 0;
    const recs = st.receptions || 0;

    let wrScore = (recYds * 0.11) + (recTds * 6.5) + (recs * 0.85);

    if (recYds >= 1600) wrScore += 25;
    else if (recYds >= 1200) wrScore += 15;

    if (recTds >= 15) wrScore += 22;
    else if (recTds >= 10) wrScore += 12;

    if (recYds > 0 || recTds > 0) {
      statParts.push(`${recs} REC`, `${recYds.toLocaleString()} YDS`, `${recTds} TD`);
    }

    baseScore += wrScore;
  }
  // 4. Defense (EDGE / DT / LB / DB)
  else if (['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(player.position)) {
    const tackles = st.tackles || 0;
    const sacks = st.sacks || 0;
    const defInts = st.interceptionsCaught || 0;
    const ff = st.forcedFumbles || 0;

    let defScore = (sacks * 5.5) + (tackles * 1.5) + (defInts * 7.5) + (ff * 4.0);

    if (sacks >= 18) defScore += 30;
    else if (sacks >= 14) defScore += 18;
    else if (sacks >= 10) defScore += 10;

    if (defInts >= 8) defScore += 25;
    else if (defInts >= 5) defScore += 14;

    if (tackles > 0 || sacks > 0 || defInts > 0) {
      if (sacks > 0) statParts.push(`${sacks} SCK`);
      if (tackles > 0) statParts.push(`${tackles} TKL`);
      if (defInts > 0) statParts.push(`${defInts} INT`);
    }

    baseScore += defScore;
  }

  // If player hasn't accumulated recorded stats yet, project based on OVR & role
  if (baseScore === 0) {
    const weeksFactor = Math.min(17, currentWeek) / 17;
    const ovrFactor = Math.pow(player.ovr / 80, 2.5);
    if (player.position === 'QB') {
      const projYds = Math.round(4100 * weeksFactor * (player.ovr / 92));
      const projTds = Math.round(33 * weeksFactor * (player.ovr / 90));
      const projInts = Math.max(3, Math.round(11 * weeksFactor * (99 / player.ovr)));
      baseScore = (projYds * 0.045) + (projTds * 4.5) - (projInts * 3.0);
      statParts.push(`${projYds.toLocaleString()} YDS`, `${projTds} TD`, `${projInts} INT`);
    } else if (player.position === 'RB') {
      const projRush = Math.round(1350 * weeksFactor * (player.ovr / 90));
      const projTds = Math.round(14 * weeksFactor * (player.ovr / 90));
      baseScore = (projRush * 0.11) + (projTds * 6.5);
      statParts.push(`${projRush.toLocaleString()} RUSH YDS`, `${projTds} TD`);
    } else if (['WR', 'TE'].includes(player.position)) {
      const projRec = Math.round(1300 * weeksFactor * (player.ovr / 90));
      const projTds = Math.round(11 * weeksFactor * (player.ovr / 90));
      baseScore = (projRec * 0.11) + (projTds * 6.5);
      statParts.push(`${projRec.toLocaleString()} REC YDS`, `${projTds} TD`);
    } else {
      const projScks = Math.round(14 * weeksFactor * (player.ovr / 90));
      const projTkl = Math.round(75 * weeksFactor * (player.ovr / 90));
      baseScore = (projScks * 5.5) + (projTkl * 1.5);
      statParts.push(`${projScks} SCK`, `${projTkl} TKL`);
    }
  }

  // Team Success Weight (MVPs win games)
  const teamWinsBonus = winPct * 28.0 + wins * 1.5;
  const ovrPrestige = (player.ovr - 80) * 1.2;

  const totalMvpScore = Math.max(5, Math.round(baseScore + teamWinsBonus + ovrPrestige));
  const summary = statParts.length > 0 ? statParts.join(' • ') : `${player.ovr} OVR Superstar`;

  return { score: totalMvpScore, summary };
}

/**
 * Gathers and ranks all MVP candidates across the NFL (User team + CPU star players).
 */
export function getLeagueMvpCandidates(season: FranchiseSeasonState): MvpCandidate[] {
  const currentWeek = season.currentWeek;
  const userTeam = getTeamById(season.userTeamId);
  const userStanding = season.standings[userTeam.id] || { wins: 0, losses: 0, ties: 0 };

  const rawCandidates: {
    player: FranchisePlayer;
    teamId: string;
    teamName: string;
    teamCity: string;
    primaryColor: string;
    mvpScore: number;
    statsSummary: string;
    teamRecord: string;
    isUserPlayer: boolean;
  }[] = [];

  // 1. Evaluate User Roster players
  (season.userRoster || []).forEach((p) => {
    // Only consider starting key positions & high impact players
    if (['QB', 'RB', 'WR', 'TE', 'EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(p.position)) {
      const { score, summary } = calculatePlayerMvpScore(p, userStanding, currentWeek);
      rawCandidates.push({
        player: p,
        teamId: userTeam.id,
        teamName: userTeam.name,
        teamCity: userTeam.city,
        primaryColor: userTeam.primaryColor,
        mvpScore: score,
        statsSummary: summary,
        teamRecord: `${userStanding.wins}-${userStanding.losses}${userStanding.ties ? `-${userStanding.ties}` : ''}`,
        isUserPlayer: true,
      });
    }
  });

  // 2. Evaluate Star CPU Players across every other NFL team
  NFL_TEAMS.forEach((team) => {
    if (team.id === season.userTeamId) return;

    const standing = season.standings[team.id] || { wins: 0, losses: 0, ties: 0 };
    const cpuRoster = season.cpuRosters?.[team.id] || [];

    // If CPU team has custom roster, pull star players; otherwise generate from team marquee data
    let keyPlayers: FranchisePlayer[] = [];
    if (cpuRoster.length > 0) {
      keyPlayers = cpuRoster.filter(
        (p) => p.ovr >= 87 || p.name === team.starQB || p.name === team.starRB || p.name === team.starWR
      );
    }

    if (keyPlayers.length === 0) {
      // Create representative star candidate objects for CPU leaders
      keyPlayers = [
        {
          id: `cpu-${team.id}-qb`,
          name: team.starQB || `${team.city} QB`,
          position: 'QB',
          ovr: Math.min(99, Math.max(82, team.off + 3)),
          potential: 'A',
          age: 27,
          speed: 82,
          strength: 78,
          agility: 84,
          awareness: 94,
          archetype: 'Field General',
          salary: 38.0,
          contractYears: 3,
        },
      ];

      if (team.starRB) {
        keyPlayers.push({
          id: `cpu-${team.id}-rb`,
          name: team.starRB,
          position: 'RB',
          ovr: Math.min(99, Math.max(83, team.off + 2)),
          potential: 'A',
          age: 26,
          speed: 92,
          strength: 86,
          agility: 91,
          awareness: 90,
          archetype: 'Power Workhorse',
          salary: 14.0,
          contractYears: 2,
        });
      }

      if (team.starWR && team.starWR !== team.starRB) {
        keyPlayers.push({
          id: `cpu-${team.id}-wr`,
          name: team.starWR,
          position: 'WR',
          ovr: Math.min(99, Math.max(84, team.off + 4)),
          potential: 'A',
          age: 25,
          speed: 95,
          strength: 80,
          agility: 96,
          awareness: 92,
          archetype: 'Route Technician',
          salary: 26.0,
          contractYears: 4,
        });
      }

      if (team.starDef) {
        keyPlayers.push({
          id: `cpu-${team.id}-def`,
          name: team.starDef,
          position: 'EDGE',
          ovr: Math.min(99, Math.max(85, team.def + 4)),
          potential: 'A+',
          age: 27,
          speed: 88,
          strength: 96,
          agility: 90,
          awareness: 96,
          archetype: 'Speed Dip Rusher',
          salary: 27.0,
          contractYears: 3,
        });
      }
    }

    keyPlayers.forEach((p) => {
      const { score, summary } = calculatePlayerMvpScore(p, standing, currentWeek);
      rawCandidates.push({
        player: p,
        teamId: team.id,
        teamName: team.name,
        teamCity: team.city,
        primaryColor: team.primaryColor,
        mvpScore: score,
        statsSummary: summary,
        teamRecord: `${standing.wins}-${standing.losses}${standing.ties ? `-${standing.ties}` : ''}`,
        isUserPlayer: false,
      });
    });
  });

  // Sort by MVP score descending
  rawCandidates.sort((a, b) => b.mvpScore - a.mvpScore);

  // Take top 10 candidates and attach odds, rankings, and analysis
  const top10 = rawCandidates.slice(0, 10);

  return top10.map((cand, idx) => {
    const rank = idx + 1;
    let odds = '+1500';
    let tier: 'Frontrunner' | 'Top Contender' | 'In The Hunt' | 'Dark Horse' = 'Dark Horse';

    if (rank === 1) {
      odds = '-220';
      tier = 'Frontrunner';
    } else if (rank === 2) {
      odds = '+280';
      tier = 'Top Contender';
    } else if (rank === 3) {
      odds = '+450';
      tier = 'Top Contender';
    } else if (rank <= 5) {
      odds = `+${600 + (rank - 3) * 200}`;
      tier = 'In The Hunt';
    } else {
      odds = `+${1200 + (rank - 5) * 350}`;
      tier = 'Dark Horse';
    }

    let analysis = '';
    if (cand.player.name === 'Wayne Garrett') {
      analysis = 'Devastating open-field game-breaker commanding undisputed MVP frontrunner status.';
    } else if (cand.player.position === 'QB') {
      analysis = `Orchestrating an explosive offense while guiding ${cand.teamCity} toward championship contention.`;
    } else if (cand.player.position === 'RB') {
      analysis = `Dominating time of possession and finding paydirt with elite ground efficiency.`;
    } else if (cand.player.position === 'WR') {
      analysis = `Unstoppable deep ball threat commanding double coverage on every snap.`;
    } else {
      analysis = `Defensive wrecking ball completely altering opposing game plans and line calls.`;
    }

    return {
      ...cand,
      rank,
      odds,
      tier,
      analysis,
    };
  });
}

/**
 * Computes all NFL Honors award winners at regular season end (MVP, OPOY, DPOY, OROY, DROY).
 */
export function getSeasonAwards(season: FranchiseSeasonState): SeasonAwards {
  const candidates = getLeagueMvpCandidates(season);
  const mvp = candidates[0];

  // OPOY: Top non-MVP offensive player or #2 overall offensive juggernaut
  const offensivePool = candidates.filter((c) => ['QB', 'RB', 'WR', 'TE'].includes(c.player.position));
  const opoy = offensivePool.length > 1 && offensivePool[0].player.name === mvp.player.name
    ? offensivePool[1]
    : offensivePool[0] || mvp;

  // DPOY: Top defensive performer
  const defensivePool = candidates.filter((c) =>
    ['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(c.player.position)
  );

  let dpoy: MvpCandidate;
  if (defensivePool.length > 0) {
    dpoy = defensivePool[0];
  } else {
    // Generate top defensive candidate
    const topDefTeam = NFL_TEAMS.find((t) => t.id === 'CLE' || t.id === 'DAL' || t.id === 'PIT') || NFL_TEAMS[0];
    const topDefStanding = season.standings[topDefTeam.id] || { wins: 12, losses: 5, ties: 0 };
    dpoy = {
      player: {
        id: `dpoy-${topDefTeam.id}`,
        name: topDefTeam.starDef || 'Myles Garrett',
        position: 'EDGE',
        ovr: 99,
        potential: 'A+',
        age: 28,
        speed: 89,
        strength: 98,
        agility: 92,
        awareness: 99,
        archetype: 'Speed Dip Rusher',
        salary: 28.0,
        contractYears: 3,
      },
      teamId: topDefTeam.id,
      teamName: topDefTeam.name,
      teamCity: topDefTeam.city,
      primaryColor: topDefTeam.primaryColor,
      rank: 1,
      mvpScore: 165,
      statsSummary: '17.5 SCK • 62 TKL • 4 FF',
      odds: '-350',
      tier: 'Frontrunner',
      teamRecord: `${topDefStanding.wins}-${topDefStanding.losses}`,
      isUserPlayer: topDefTeam.id === season.userTeamId,
      analysis: 'Dominant edge rusher who led the league in quarterback pressures and forced fumbles.',
    };
  }

  return {
    seasonYear: season.seasonYear || 2026,
    mvp,
    opoy,
    dpoy,
    isAwarded: true,
  };
}

/**
 * Permanently crowns the MVP winner and attaches award badges to players.
 */
export function crownMvpAndAwards(season: FranchiseSeasonState): FranchiseSeasonState {
  const awards = getSeasonAwards(season);
  const mvp = awards.mvp;

  const mvpEntry: MvpHistoryEntry = {
    seasonYear: season.seasonYear || 2026,
    playerName: mvp.player.name,
    position: mvp.player.position,
    teamId: mvp.teamId,
    teamName: mvp.teamName,
    teamCity: mvp.teamCity,
    primaryColor: mvp.primaryColor,
    statsSummary: mvp.statsSummary,
    mvpScore: mvp.mvpScore,
    ovr: mvp.player.ovr,
    isUser: mvp.isUserPlayer,
  };

  const existingHistory = season.mvpHistory || [];
  const updatedHistory = existingHistory.filter((h) => h.seasonYear !== mvpEntry.seasonYear);
  updatedHistory.unshift(mvpEntry);

  // If the user player won, append award to their awards array
  let updatedUserRoster = season.userRoster;
  if (mvp.isUserPlayer) {
    updatedUserRoster = season.userRoster.map((p) => {
      if (p.name === mvp.player.name) {
        const awardsList = p.awards || [];
        const awardTag = `${season.seasonYear || 2026} NFL Most Valuable Player (MVP)`;
        if (!awardsList.includes(awardTag)) {
          awardsList.push(awardTag);
        }
        return { ...p, awards: awardsList };
      }
      return p;
    });
  }

  return {
    ...season,
    mvpHistory: updatedHistory,
    seasonAwards: awards,
    userRoster: updatedUserRoster,
  };
}
