export type ClashPosition = 
  | 'QB' 
  | 'RB' 
  | 'WR' 
  | 'TE' 
  | 'OT' 
  | 'OG' 
  | 'C' 
  | 'EDGE' 
  | 'DT' 
  | 'MLB' 
  | 'CB' 
  | 'FS' 
  | 'SS' 
  | 'K' 
  | 'P';

export type CardTier = 'bronze' | 'silver' | 'gold' | 'elite' | 'diamond';

export interface ClashCard {
  id: string;
  name: string;
  position: ClashPosition;
  ovr: number; // Season OVR minus 10 (or 60 for starter defaults)
  teamId: string;
  teamName: string;
  speed: number;
  strength: number;
  agility: number;
  awareness: number;
  archetype: string;
  college: string;
  age: number;
  tier: CardTier;
  isStarter?: boolean;
  assignedSlot?: string;
  acquiredAt?: number;
  abilityTitle?: string;
  abilityName?: string;
  abilityDescription?: string;
}

export interface AuctionListing {
  id: string;
  card: ClashCard;
  buyNowPrice: number; // in Grid Irons
  currentBid: number;
  seller: string;
  sellerUserId?: string;
  timeLeftMinutes: number;
  durationMinutes?: number;
  expiresAt?: number; // timestamp in ms when the auction expires and is deleted
  listedAt: number;
}

export interface AIOpponentTeam {
  id: string;
  teamId: string;
  city: string;
  name: string;
  abbr: string;
  primaryColor: string;
  secondaryColor: string;
  starPlayer: {
    name: string;
    position: ClashPosition;
    ovr: number;
    archetype: string;
  };
  restRosterOvr: number;
  teamOvr: number;
  off: number;
  def: number;
  description: string;
  winsAgainstCount?: number;
  tier?: number;
}

export interface ClashTransaction {
  id: string;
  type: 'buy' | 'sell' | 'battle_win' | 'starter' | 'mission';
  description: string;
  cardName?: string;
  amount: number; // in Grid Irons
  timestamp: number;
}

export interface DailyMission {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  reward: number;
  completed: boolean;
  type: 'passing_yards' | 'rushing_yards' | 'touchdowns' | 'points' | 'wins';
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export interface ClashUserData {
  teamName: string;
  userOvr?: number;
  wins?: number;
  losses?: number;
  gridIrons: number; // Grid Irons currency
  roster: ClashCard[];
  startingLineup: Record<string, string>; // slotName -> cardId
  auctionListings: AuctionListing[];
  transactions: ClashTransaction[];
  aiBattlesWon: number;
  aiBattlesPlayed: number;
  defeatedBossIds: string[];
  currentBossTier: number;
  tutorialCompleted?: boolean;
  tutorialWins?: number;
  lastMissionReset?: number;
  missions?: DailyMission[];
}
