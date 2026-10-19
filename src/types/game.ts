import type { FranchisePlayer } from './franchise';
import type { InjuryEvent } from './injuries';

export type Conference = 'AFC' | 'NFC';
export type Division = 'East' | 'North' | 'South' | 'West' | 'Pro Bowl';

export interface NFLTeam {
  id: string;
  city: string;
  name: string;
  abbr: string;
  conference: Conference;
  division: Division;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  ovr: number;
  off: number;
  def: number;
  starQB: string;
  starRB: string;
  starWR: string;
  starDef: string;
  stadium: string;
  isDome: boolean;
  roster?: FranchisePlayer[];
}

export type PlayCategory = 'Pass' | 'Run' | 'PlayAction' | 'Screen' | 'Blitz' | 'Zone' | 'Man' | 'SpecialTeams';
export type OffensiveFormation = 'Shotgun' | 'Singleback' | 'I-Form' | 'Pistol' | 'Spread' | 'Empty';
export type DefensiveFormation = '4-3' | '3-4' | 'Nickel' | 'Dime' | 'GoalLine';

export type RouteType = 
  | 'Go' 
  | 'Slant' 
  | 'Post' 
  | 'Corner' 
  | 'Out' 
  | 'In' 
  | 'Curl' 
  | 'Drag' 
  | 'Wheel' 
  | 'Screen' 
  | 'Flat' 
  | 'Block'
  | 'Custom';

export type RunGap = 'A-Gap' | 'B-Gap' | 'Sweep-Left' | 'Sweep-Right' | 'Toss' | 'QB-Keep';

export interface RoutePoint {
  x: number; // 0 to 100 on canvas
  y: number; // 0 to 100 on canvas
}

export interface PlayerAssignment {
  id: string;
  position: 'QB' | 'RB' | 'WR1' | 'WR2' | 'WR3' | 'TE' | 'LT' | 'LG' | 'C' | 'RG' | 'RT' | 'CB1' | 'CB2' | 'FS' | 'SS' | 'MLB' | 'OLB1' | 'OLB2' | 'DE1' | 'DE2' | 'DT' | string;
  label: string;
  startX: number; // Field coordinate percentage (0-100)
  startY: number; // Field coordinate percentage (0-100)
  route?: RouteType;
  runGap?: RunGap;
  isPrimary?: boolean;
  waypoints?: RoutePoint[];
  playerName?: string;
  playerOvr?: number;
}

export interface Play {
  id: string;
  name: string;
  type: 'Offense' | 'Defense' | 'SpecialTeams';
  category: PlayCategory;
  formation: OffensiveFormation | DefensiveFormation;
  description: string;
  assignments: PlayerAssignment[];
  isCustom?: boolean;
  passConcept?: string;
  clockMode?: 'elapsed' | 'remaining';
  clockValue?: number;
  expectedDurationSeconds?: number;
}

export type ScriptedOutcomeType =
  | 'Touchdown'
  | 'FirstDown'
  | 'BigGain'
  | 'ShortGain'
  | 'NoGain'
  | 'TackleForLoss'
  | 'Sack'
  | 'Incomplete'
  | 'Interception'
  | 'PickSix'
  | 'FumbleDefense'
  | 'FumbleOffense'
  | 'PenaltyOffense'
  | 'PenaltyDefense'
  | 'Safety'
  | 'FieldGoalGood'
  | 'FieldGoalMiss'
  | 'FieldGoalBlocked'
  | 'Punt'
  | 'PuntBlocked'
  | 'CustomYards'
  | 'OrganicSim';

export interface ScriptOption {
  type: ScriptedOutcomeType;
  label: string;
  description: string;
  yards?: number;
  color: string;
  icon: string;
}

export interface DrawnStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  isArrow?: boolean;
}

export type QBThrowingVariant = 'in_stride' | 'straight_to_them' | 'lob_pass';
export type RunStyleVariant = 'power' | 'speed' | 'patience';
export type PlayExecutionVariant = QBThrowingVariant | RunStyleVariant;

export interface PlayResult {
  outcomeType: ScriptedOutcomeType;
  yardsGained: number;
  commentary: string;
  isTouchdown: boolean;
  isTurnover: boolean;
  isSafety: boolean;
  isFirstDown: boolean;
  turnoverType?: 'Interception' | 'Fumble' | 'Downs';
  penaltyYards?: number;
  penaltyName?: string;
  keyPlayer?: string;
  clockElapsedSeconds: number;
  stoppedClock: boolean;
  drawnPath?: { x: number; y: number }[];
  isDrawnPlay?: boolean;
  isFailedPlay?: boolean;
  failureReason?: string;
  skipFailureCheck?: boolean;
  throwingVariant?: QBThrowingVariant;
  runVariant?: RunStyleVariant;
  playVariant?: PlayExecutionVariant;
  playCategory?: PlayCategory;
  triggeredInjury?: InjuryEvent;
  isPredictablePlayPenalty?: boolean;
}

export interface DrivePlay {
  possession?: 'home' | 'away';
  offenseTeamId?: string;
  down: number;
  distance: number;
  yardLine: number;
  offensePlay: string;
  defensePlay: string;
  result: PlayResult;
  quarter: number;
  timeRemaining: string;
  score: { home: number; away: number };
}

export interface GameStats {
  passingYards: number;
  rushingYards: number;
  totalYards: number;
  turnovers: number;
  firstDowns: number;
  thirdDownAttempts: number;
  thirdDownConverted: number;
  sacks: number;
  timeOfPossessionSeconds: number;
}

export interface PlayerStats {
  playerName: string;
  position: string;
  passingYards: number;
  rushingYards: number;
  receivingYards: number;
}

export interface ActiveGame {
  id: string;
  homeTeam: NFLTeam;
  awayTeam: NFLTeam;
  userTeamId?: string;
  homeScore: number;
  awayScore: number;
  quarter: number;
  quarterTimeSeconds: number;
  quarterLengthMinutes: number;
  playClockSeconds?: number;
  isClockPaused?: boolean;
  possession: 'home' | 'away';
  yardLine: number; // 0-100
  down: number;
  distance: number;
  driveStartYardLine: number;
  homeTimeouts?: number;
  awayTimeouts?: number;
  isGameOver: boolean;
  isPlayInProgress: boolean;
  currentPlayAnimation?: {
    offensePlay: Play;
    defensePlay: Play;
    result: PlayResult;
    progress: number;
  };
  lastPlayResult?: PlayResult;
  playLog: DrivePlay[];
  homeStats: GameStats;
  awayStats: GameStats;
  homePlayerStats?: PlayerStats[];
  awayPlayerStats?: PlayerStats[];
  settings: GameSettings;
  seasonGameContext?: {
    week: number;
    isPlayoff: boolean;
    playoffRound?: string;
  };
  clashGameContext?: {
    aiTeamId: string;
    starPlayer: string;
    starOvr: number;
    rewardClaimed?: boolean;
  };
  injuredPlayers?: InjuryEvent[];
  difficulty?: 'Script' | 'Hard';
  onlineMatchRoomId?: string;
  onlineMatchIsHost?: boolean;
  hardModeFactors?: {
    momentum: number;
    repeatCategoryCount: number;
    lastCategory?: string;
    preSnapMotion?: boolean;
  };
  wayneGarrettAbilityUses?: {
    power: number;
    speed: number;
    patience: number;
    standard: number;
  };
  lastOffensivePlayId?: string;
  lastOffensivePlayName?: string;
  consecutiveSamePlayCount?: number;
  repeatPlayWarning?: string;
  fatigueNotice?: string;
}

export interface GameSettings {
  quarterLengthMinutes: number;
  weather: 'Sunny' | 'Rain' | 'Snow' | 'Dome' | 'Night';
  homeJersey: 'Home' | 'ColorRush';
  awayJersey: 'Away' | 'ColorRush';
  scriptModeDefault: 'Scripted' | 'Organic';
  difficulty?: 'Script' | 'Hard';
}

export interface ScheduleGame {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  isPlayed: boolean;
  homeScore?: number;
  awayScore?: number;
  isUserGame?: boolean;
}

export interface TeamStanding {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pct: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  streak: string;
  divisionWins: number;
  divisionLosses: number;
  confWins: number;
  confLosses: number;
  seed?: number;
}

export interface PlayoffMatchup {
  id: string;
  round: 'WildCard' | 'Divisional' | 'Conference' | 'SuperBowl';
  conference?: Conference;
  homeTeamId: string;
  awayTeamId: string;
  homeSeed?: number;
  awaySeed?: number;
  homeScore?: number;
  awayScore?: number;
  winnerId?: string;
  isPlayed: boolean;
  isUserGame?: boolean;
}

export interface PlayoffBracket {
  wildCard: PlayoffMatchup[];
  divisional: PlayoffMatchup[];
  conference: PlayoffMatchup[];
  superBowl: PlayoffMatchup;
  championId?: string;
  mvp?: string;
}

export interface SeasonState {
  id: string;
  userTeamId: string;
  currentWeek: number; // 1-18 for regular season, 19=WildCard, 20=Divisional, 21=Conf, 22=SuperBowl, 23=Complete
  schedule: ScheduleGame[];
  standings: Record<string, TeamStanding>;
  playoffs?: PlayoffBracket;
  isSeasonComplete: boolean;
  injuredPlayers?: InjuryEvent[];
}
