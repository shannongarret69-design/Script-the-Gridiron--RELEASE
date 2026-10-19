import type { NFLTeam, TeamStanding, ScheduleGame, PlayoffBracket } from './game';

export interface PlayerSeasonStats {
  gamesPlayed: number;
  // Passing
  passAttempts: number;
  passCompletions: number;
  passYards: number;
  passTds: number;
  interceptions: number;
  // Rushing
  rushAttempts: number;
  rushYards: number;
  rushTds: number;
  // Receiving
  receptions: number;
  targets: number;
  recYards: number;
  recTds: number;
  // Defense
  tackles: number;
  sacks: number;
  interceptionsCaught: number;
  forcedFumbles: number;
  // Kicking
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  extraPointsMade: number;
}

export interface PlayerGameLog {
  week: number;
  seasonYear: number;
  opponentId: string;
  opponentAbbr: string;
  isHome: boolean;
  teamScore: number;
  oppScore: number;
  isWin: boolean;
  stats: Partial<PlayerSeasonStats>;
}

export interface FranchisePlayer {
  id: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'OT' | 'OG' | 'C' | 'EDGE' | 'DT' | 'MLB' | 'CB' | 'FS' | 'SS' | 'K';
  ovr: number;
  potential: 'A+' | 'A' | 'B+' | 'B' | 'C';
  age: number;
  college?: string;
  speed: number;
  strength: number;
  agility: number;
  awareness: number;
  archetype: string;
  salary: number; // in millions/year, e.g. 12.5
  contractYears: number;
  isRookie?: boolean;
  isBenched?: boolean;
  depthChartOrder?: number;
  projectedRound?: number;
  scoutingNotes?: string;
  scoutedStats?: string[];
  // Stats & History
  seasonStats?: PlayerSeasonStats;
  careerStats?: { seasonYear: number; teamId: string; stats: PlayerSeasonStats }[];
  gameLogs?: PlayerGameLog[];
  awards?: string[]; // e.g. ['2026 NFL MVP', '2026 OPOY', 'Super Bowl LIX MVP']
  // Player Leveling System (under 28 years old)
  level?: number; // starts at 1
  xp?: number; // 0 to 99, 100 to level up
  maxOvr?: number; // max overall ceiling for the player
  recentGameXp?: {
    week: number;
    xpEarned: number;
    statSummary: string;
    leveledUp?: boolean;
    prevOvr?: number;
    newOvr?: number;
  };
  // Player Fatigue & Injury System
  fatigueHits?: number; // consecutive hits taken without a break
  maxSafeHits?: number; // safe threshold derived from strength (10, 20, or 30)
  injuryRiskPercent?: number; // 1% normally, +20% per hit over threshold
  isInjured?: boolean;
  injuryDetails?: {
    injuryType: string;
    severity: string;
    durationWeeks?: number;
    description: string;
  };
}

export interface MvpCandidate {
  player: FranchisePlayer;
  teamId: string;
  teamName: string;
  teamCity: string;
  primaryColor: string;
  rank: number;
  mvpScore: number;
  statsSummary: string;
  odds: string; // e.g. "-175", "+350"
  tier: 'Frontrunner' | 'Top Contender' | 'In The Hunt' | 'Dark Horse';
  teamRecord: string;
  isUserPlayer: boolean;
  analysis: string;
}

export interface SeasonAwards {
  seasonYear: number;
  mvp: MvpCandidate;
  opoy: MvpCandidate;
  dpoy: MvpCandidate;
  oroy?: MvpCandidate;
  droy?: MvpCandidate;
  isAwarded: boolean;
}

export interface MvpHistoryEntry {
  seasonYear: number;
  playerName: string;
  position: string;
  teamId: string;
  teamName: string;
  teamCity: string;
  primaryColor: string;
  statsSummary: string;
  mvpScore: number;
  ovr: number;
  isUser: boolean;
}

export interface DraftPick {
  round: number;
  pickNumber: number;
  overallPick: number;
  teamId: string;
  player?: FranchisePlayer;
}

export interface FreeAgentOffer {
  id: string;
  teamId: string;
  teamName: string;
  teamCity: string;
  primaryColor?: string;
  salary: number; // in $M/yr
  bonus: number; // guaranteed bonus in $M
  years: number;
  satisfaction: number; // 0 to 100
  submittedWeek: number;
  isUser?: boolean;
}

export interface FreeAgent extends FranchisePlayer {
  interest: number; // 0 to 100
  askingSalary: number; // in millions
  signedByTeamId?: string;
  activeOffers?: FreeAgentOffer[];
  leadingOffer?: FreeAgentOffer;
}

export interface IncomingTradeOffer {
  id: string;
  offeringTeamId: string;
  offeringTeamName: string;
  offeringTeamCity: string;
  offeringTeamColor: string;
  offeredPlayers: FranchisePlayer[];
  requestedPlayers: FranchisePlayer[];
  week: number;
  seasonYear: number;
  status: 'pending' | 'accepted' | 'rejected';
  reasoning: string;
  interestScore: number;
  tradeValueOffered: number;
  tradeValueRequested: number;
  netCapChange: number;
}

export interface TradeNewsItem {
  id: string;
  week: number;
  seasonYear: number;
  date: string;
  headline: string;
  team1Id: string;
  team1Name: string;
  team1City: string;
  team1Color: string;
  team1Players: FranchisePlayer[]; // Players team 1 receives
  team2Id: string;
  team2Name: string;
  team2City: string;
  team2Color: string;
  team2Players: FranchisePlayer[]; // Players team 2 receives
  isUserInvolved: boolean;
  analysis: string;
}

export interface WeeklyLeagueNews {
  id: string;
  week: number;
  seasonYear: number;
  date: string;
  headline: string;
  summary: string;
  upsets: {
    winnerId: string;
    winnerName: string;
    winnerScore: number;
    loserId: string;
    loserName: string;
    loserScore: number;
    upsetHeadline: string;
    winProb: number;
  }[];
  topPerformers: {
    category: 'Passing' | 'Rushing' | 'Receiving' | 'Defense';
    playerName: string;
    position: string;
    teamId: string;
    teamName: string;
    statLine: string;
    headline: string;
  }[];
  thrillerGame?: {
    homeTeam: string;
    homeScore: number;
    awayTeam: string;
    awayScore: number;
    recap: string;
  };
  allScores?: {
    homeId: string;
    homeScore: number;
    awayId: string;
    awayScore: number;
    isUpset?: boolean;
  }[];
}

export interface SaveSlotData {
  slotId: 1 | 2 | 3;
  saveName: string;
  savedAt: string;
  season: FranchiseSeasonState;
}

export interface FranchiseSeasonState {
  id: string;
  slotId: 1 | 2 | 3;
  userTeamId: string;
  seasonYear: number; // e.g., 2026, 2027
  currentWeek: number; // 1-18 regular, 19-22 playoffs, 23=Super Bowl over, 24=Free Agency, 25=NFL Draft, 26=New Season Ready
  stage: 'RegularSeason' | 'Playoffs' | 'SuperBowl' | 'Offseason_FreeAgency' | 'Offseason_Draft' | 'Offseason_Completed';
  schedule: ScheduleGame[];
  standings: Record<string, TeamStanding>;
  playoffs?: PlayoffBracket;
  isSeasonComplete: boolean;
  salaryCap: number; // e.g. 240.0 ($M)
  usedCap: number;
  userRoster: FranchisePlayer[];
  cpuRosters?: Record<string, FranchisePlayer[]>;
  freeAgentsPool: FreeAgent[];
  draftClass: FranchisePlayer[];
  draftPicks: DraftPick[];
  currentDraftPickIndex: number;
  isDraftCompleted: boolean;
  scoutingPoints?: number;
  draftHistory: { round: number; pick: number; teamId: string; player: FranchisePlayer }[];
  difficulty?: 'Script' | 'Hard';
  history?: FranchiseSeasonState[];
  transactions: { date: string; text: string; type: 'draft' | 'signing' | 'cut' | 'trade' }[];
  incomingTradeOffers?: IncomingTradeOffer[];
  tradeNews?: TradeNewsItem[];
  leagueNews?: WeeklyLeagueNews[];
  wonSuperBowlLastSeason?: boolean;
  mvpHistory?: MvpHistoryEntry[];
  seasonAwards?: SeasonAwards;
  superBowlWinnerHistory?: {
    seasonYear: number;
    winnerId: string;
    winnerName: string;
    loserId: string;
    loserName: string;
    score: string;
    mvp: string;
  }[];
  seasonPlayerStatsHistory?: {
    seasonYear: number;
    players: FranchisePlayer[];
  }[];
}
