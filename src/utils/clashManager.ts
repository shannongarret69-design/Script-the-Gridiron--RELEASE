import { AUTHENTIC_TEAM_ROSTERS, AuthenticPlayerDef } from '../data/teamRosters';
import { NFL_TEAMS } from '../data/teams';
import { NFLTeam } from '../types/game';
import {
  ClashCard,
  ClashPosition,
  CardTier,
  AuctionListing,
  AIOpponentTeam,
  ClashUserData,
  ClashTransaction,
  DailyMission,
} from '../types/clash';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

const STORAGE_KEY = 'GRIDIRON_CLASH_USER_DATA_V2';

export const STARTER_SLOTS: { id: string; label: string; position: ClashPosition; group: 'OFF' | 'DEF' | 'ST' }[] = [
  // Offense
  { id: 'QB', label: 'Quarterback', position: 'QB', group: 'OFF' },
  { id: 'RB', label: 'Running Back', position: 'RB', group: 'OFF' },
  { id: 'WR1', label: 'Wide Receiver 1', position: 'WR', group: 'OFF' },
  { id: 'WR2', label: 'Wide Receiver 2', position: 'WR', group: 'OFF' },
  { id: 'WR3', label: 'Slot Receiver', position: 'WR', group: 'OFF' },
  { id: 'TE', label: 'Tight End', position: 'TE', group: 'OFF' },
  { id: 'LT', label: 'Left Tackle', position: 'OT', group: 'OFF' },
  { id: 'LG', label: 'Left Guard', position: 'OG', group: 'OFF' },
  { id: 'C', label: 'Center', position: 'C', group: 'OFF' },
  { id: 'RG', label: 'Right Guard', position: 'OG', group: 'OFF' },
  { id: 'RT', label: 'Right Tackle', position: 'OT', group: 'OFF' },

  // Defense
  { id: 'EDGE1', label: 'Left Edge Rusher', position: 'EDGE', group: 'DEF' },
  { id: 'EDGE2', label: 'Right Edge Rusher', position: 'EDGE', group: 'DEF' },
  { id: 'DT1', label: 'Nose Tackle', position: 'DT', group: 'DEF' },
  { id: 'DT2', label: 'Defensive Tackle', position: 'DT', group: 'DEF' },
  { id: 'MLB1', label: 'Middle Linebacker', position: 'MLB', group: 'DEF' },
  { id: 'MLB2', label: 'Will Linebacker', position: 'MLB', group: 'DEF' },
  { id: 'CB1', label: 'Cornerback 1', position: 'CB', group: 'DEF' },
  { id: 'CB2', label: 'Cornerback 2', position: 'CB', group: 'DEF' },
  { id: 'CB3', label: 'Nickel Corner', position: 'CB', group: 'DEF' },
  { id: 'FS', label: 'Free Safety', position: 'FS', group: 'DEF' },
  { id: 'SS', label: 'Strong Safety', position: 'SS', group: 'DEF' },

  // Special Teams
  { id: 'K', label: 'Kicker', position: 'K', group: 'ST' },
  { id: 'P', label: 'Punter', position: 'P', group: 'ST' },
];

export const TUTORIAL_AI_BOSS: AIOpponentTeam = {
  id: 'AI_TUTORIAL',
  teamId: 'INTRO',
  city: 'Introductory',
  name: 'Squad',
  abbr: 'INT',
  primaryColor: '#64748b',
  secondaryColor: '#f1f5f9',
  starPlayer: { name: 'Practice Dummy', position: 'QB', ovr: 45, archetype: 'Basic AI Unit' },
  restRosterOvr: 45,
  teamOvr: 45,
  off: 10, // Extra nerfed for "fail almost every play"
  def: 10,
  tier: 0,
  description: 'A basic introductory squad to test your skills. Defeat them to unlock the full Gridiron Clash!',
};

/**
 * Ensures startingLineup contains at most ONE card for any given player name.
 * If duplicate player names exist in the lineup, retains the first slot encountered
 * and removes duplicate player names from subsequent slots.
 */
export function sanitizeLineupUniquePlayers(
  lineup: Record<string, string>,
  roster: ClashCard[]
): Record<string, string> {
  if (!lineup || !roster) return lineup || {};

  const sanitized: Record<string, string> = {};
  const seenPlayerNames = new Set<string>();

  for (const slotDef of STARTER_SLOTS) {
    const cardId = lineup[slotDef.id];
    if (!cardId) continue;

    const card = roster.find((c) => c && c.id === cardId);
    if (!card) continue;

    const nameKey = card.name.trim().toLowerCase();
    if (!seenPlayerNames.has(nameKey)) {
      sanitized[slotDef.id] = cardId;
      seenPlayerNames.add(nameKey);
    }
  }

  return sanitized;
}

/**
 * Equips a card into a target slot, ensuring the player name is unique across the entire depth chart.
 * If another card instance with the same player name (or exact card ID) is currently equipped in another slot,
 * it is removed from that other slot.
 */
export function equipCardUniquePlayer(
  lineup: Record<string, string>,
  roster: ClashCard[],
  targetSlotId: string,
  cardId: string
): Record<string, string> {
  const cardToEquip = roster.find((c) => c && c.id === cardId);
  if (!cardToEquip) return lineup;

  const targetName = cardToEquip.name.trim().toLowerCase();
  const updatedLineup = { ...lineup };

  // Remove any card with the same player name or same card ID from ALL other slots
  Object.entries(updatedLineup).forEach(([slotId, equippedCardId]) => {
    if (slotId === targetSlotId) return;

    if (equippedCardId === cardId) {
      delete updatedLineup[slotId];
    } else {
      const equippedCard = roster.find((c) => c && c.id === equippedCardId);
      if (equippedCard && equippedCard.name.trim().toLowerCase() === targetName) {
        delete updatedLineup[slotId];
      }
    }
  });

  updatedLineup[targetSlotId] = cardId;

  return updatedLineup;
}

export function getCardTier(ovr: number): CardTier {
  if (ovr >= 88) return 'diamond';
  if (ovr >= 82) return 'elite';
  if (ovr >= 76) return 'gold';
  if (ovr >= 68) return 'silver';
  return 'bronze';
}

export function getTierColor(tier: CardTier): {
  bg: string;
  border: string;
  badge: string;
  glow: string;
  text: string;
} {
  switch (tier) {
    case 'diamond':
      return {
        bg: 'from-cyan-950 via-slate-900 to-indigo-950',
        border: 'border-cyan-400',
        badge: 'bg-cyan-400 text-slate-950 font-black',
        glow: 'shadow-cyan-500/30',
        text: 'text-cyan-400',
      };
    case 'elite':
      return {
        bg: 'from-rose-950 via-slate-900 to-purple-950',
        border: 'border-rose-400',
        badge: 'bg-rose-500 text-white font-black',
        glow: 'shadow-rose-500/30',
        text: 'text-rose-400',
      };
    case 'gold':
      return {
        bg: 'from-amber-950 via-slate-900 to-yellow-950',
        border: 'border-amber-400',
        badge: 'bg-amber-400 text-slate-950 font-black',
        glow: 'shadow-amber-500/30',
        text: 'text-amber-400',
      };
    case 'silver':
      return {
        bg: 'from-slate-800 via-slate-900 to-zinc-900',
        border: 'border-slate-300',
        badge: 'bg-slate-300 text-slate-900 font-bold',
        glow: 'shadow-slate-400/20',
        text: 'text-slate-300',
      };
    case 'bronze':
    default:
      return {
        bg: 'from-stone-900 via-neutral-900 to-stone-950',
        border: 'border-amber-800/80',
        badge: 'bg-amber-800 text-amber-100 font-bold',
        glow: 'shadow-amber-900/20',
        text: 'text-amber-600',
      };
  }
}

// Generate base 60 OVR starter players
export function generateStarterRoster(): { roster: ClashCard[]; lineup: Record<string, string> } {
  const starterNames: Record<string, string> = {
    QB: 'Caleb Miller',
    RB: 'Jordan Vance',
    WR1: 'Marcus Sterling',
    WR2: 'Trevor Cross',
    WR3: 'Darius Cole',
    TE: 'Noah Higgins',
    LT: 'Austin Brock',
    LG: 'Dominic Ramos',
    C: 'Gavin Holt',
    RG: 'Wyatt Keller',
    RT: 'Colton Reed',
    EDGE1: 'Xavier Kane',
    EDGE2: 'Brantley Stone',
    DT1: 'Desmond Vance',
    DT2: 'Malik Turner',
    MLB1: 'Tanner Hayes',
    MLB2: 'Grant Mercer',
    CB1: 'Elijah Knox',
    CB2: 'Quinton Sharp',
    CB3: 'Jaylen Mercer',
    FS: 'Corbin Hayes',
    SS: 'Landon Drake',
    K: 'Mason Croft',
    P: 'Lucas Weaver',
  };

  const starterColleges = ['Alabama', 'Ohio State', 'Georgia', 'Michigan', 'Texas', 'USC', 'Penn State', 'Notre Dame', 'Oregon', 'LSU'];

  const roster: ClashCard[] = [];
  const lineup: Record<string, string> = {};

  STARTER_SLOTS.forEach((slot, index) => {
    const cardId = `starter-${slot.id}-${Date.now() + index}`;
    const name = starterNames[slot.id] || `Rookie ${slot.id}`;
    const college = starterColleges[index % starterColleges.length];

    const card: ClashCard = {
      id: cardId,
      name,
      position: slot.position,
      ovr: 60, // Full roster of 60 overalls
      teamId: 'CLASH',
      teamName: 'Gridiron Free Agent',
      speed: 60,
      strength: 60,
      agility: 60,
      awareness: 60,
      archetype: 'Developing Starter',
      college,
      age: 22,
      tier: getCardTier(60),
      isStarter: true,
      assignedSlot: slot.id,
      acquiredAt: Date.now(),
    };

    roster.push(card);
    lineup[slot.id] = cardId;
  });

  return { roster, lineup };
}

/**
 * Pricing in Grid Irons:
 * "it takes 1 coin per 10 overall, but the 89 overalls are worth 10 coins"
 * - 89+ OVR: 10 Grid Irons
 * - 80-88 OVR: 8 Grid Irons
 * - 70-79 OVR: 7 Grid Irons
 * - 60-69 OVR: 6 Grid Irons
 * - 50-59 OVR: 5 Grid Irons
 */
export function calculateAuctionPriceInGridIrons(clashOvr: number): number {
  if (clashOvr >= 89) {
    return 10;
  }
  return Math.max(1, Math.floor(clashOvr / 10));
}

/**
 * Quick Sell mechanic:
 * - Star players in packs (99 OVR Game Breakers/Legends: JSN, Cam Newton, Wayne Garrett, Andrew Luck, Pat McAfee): worth 200 Grid Irons
 * - Normal cards: half of what the auction price would be based on overall
 */
export function calculateQuickSellPrice(card: ClashCard): number {
  const isPackStar =
    card.ovr >= 99 ||
    card.abilityTitle === 'Game Breaker' ||
    (card.ovr >= 95 && [
      'Jaxon Smith-Njigba',
      'Cam Newton',
      'Wayne Garrett',
      'Andrew Luck',
      'Pat McAfee',
      'Pat MacAfee',
    ].includes(card.name));

  if (isPackStar) {
    return 200;
  }

  const auctionPrice = calculateAuctionPriceInGridIrons(card.ovr);
  return Math.max(1, Math.round(auctionPrice / 2));
}

// Generate full auction pool from authentic season players with (OVR - 10)
export function generateAuctionListings(): AuctionListing[] {
  const listings: AuctionListing[] = [];
  const teamNameMap: Record<string, string> = {};
  NFL_TEAMS.forEach((t) => {
    teamNameMap[t.id] = `${t.city} ${t.name}`;
  });

  const sellers = [
    'GridironVault',
    'DynastyTrader',
    'CardCollector99',
    'ProBowlElite',
    'BlitzMaster',
    'ShowtimeAuctions',
    'EndzoneEmpire',
    'RedZonePicks',
    'GridironWhale',
    'FirstDownDeals',
  ];

  let cardCounter = 1;

  Object.entries(AUTHENTIC_TEAM_ROSTERS).forEach(([teamId, players]) => {
    const fullTeamName = teamNameMap[teamId] || teamId;

    players.forEach((player: AuthenticPlayerDef) => {
      // Use season mode overalls SUBTRACTED BY 10
      const clashOvr = Math.max(50, player.ovr - 10);
      const clashSpeed = Math.max(50, player.speed - 10);
      const clashStrength = Math.max(50, player.strength - 10);
      const clashAgility = Math.max(50, player.agility - 10);
      const clashAwareness = Math.max(50, player.awareness - 10);
      const tier = getCardTier(clashOvr);
      const priceInGridIrons = calculateAuctionPriceInGridIrons(clashOvr);

      const card: ClashCard = {
        id: `card-${teamId}-${cardCounter++}`,
        name: player.name,
        position: player.position as ClashPosition,
        ovr: clashOvr,
        teamId,
        teamName: fullTeamName,
        speed: clashSpeed,
        strength: clashStrength,
        agility: clashAgility,
        awareness: clashAwareness,
        archetype: player.archetype,
        college: player.college,
        age: player.age,
        tier,
      };

      const startBid = Math.max(1, priceInGridIrons - 1);
      const randomMinutes = Math.floor(Math.random() * 180) + 15;
      const seller = sellers[Math.floor(Math.random() * sellers.length)];

      listings.push({
        id: `auc-${card.id}`,
        card,
        buyNowPrice: priceInGridIrons,
        currentBid: startBid,
        seller,
        timeLeftMinutes: randomMinutes,
        listedAt: Date.now(),
      });
    });
  });

  // Sort initially by OVR descending
  return listings.sort((a, b) => b.card.ovr - a.card.ovr);
}

/**
 * AI OPPONENT TEAMS SPECIFICATION:
 * Tier 1: 70 OVR Supporting Roster, 1 GI Reward, 75 OVR Card Reward
 * Tier 2: 80 OVR Supporting Roster, 5 GI Reward, 80 OVR Card Reward
 */
export const TIER_1_AI_BOSSES: AIOpponentTeam[] = [
  {
    id: 'AI_KC',
    teamId: 'KC',
    city: 'Kansas City',
    name: 'Kansas City AI',
    abbr: 'KCA',
    primaryColor: '#E31837',
    secondaryColor: '#FFB81C',
    starPlayer: { name: 'Patrick Mahomes', position: 'QB', ovr: 89, archetype: 'Deep Cannon Field General' },
    restRosterOvr: 70,
    teamOvr: 71,
    off: 74,
    def: 70,
    tier: 1,
    description: 'Features 89 OVR Patrick Mahomes leading a 70 OVR offensive line and defense.',
  },
  {
    id: 'AI_BAL',
    teamId: 'BAL',
    city: 'Baltimore',
    name: 'Baltimore AI',
    abbr: 'BLA',
    primaryColor: '#241773',
    secondaryColor: '#000000',
    starPlayer: { name: 'Lamar Jackson', position: 'QB', ovr: 89, archetype: 'Dual-Threat Scramble Wizard' },
    restRosterOvr: 70,
    teamOvr: 71,
    off: 74,
    def: 70,
    tier: 1,
    description: 'Features 89 OVR Lamar Jackson carrying a 70 OVR supporting squad.',
  },
  {
    id: 'AI_BUF',
    teamId: 'BUF',
    city: 'Buffalo',
    name: 'Buffalo AI',
    abbr: 'BFA',
    primaryColor: '#00338D',
    secondaryColor: '#C60C30',
    starPlayer: { name: 'Josh Allen', position: 'QB', ovr: 89, archetype: 'Power Arm Bulldozer' },
    restRosterOvr: 70,
    teamOvr: 71,
    off: 74,
    def: 70,
    tier: 1,
    description: 'Features 89 OVR Josh Allen launching bombs with a 70 OVR roster.',
  },
  {
    id: 'AI_MIN',
    teamId: 'MIN',
    city: 'Minnesota',
    name: 'Minnesota AI',
    abbr: 'MNA',
    primaryColor: '#4F2683',
    secondaryColor: '#FFC62F',
    starPlayer: { name: 'Justin Jefferson', position: 'WR', ovr: 89, archetype: 'Lockdown Route Technician' },
    restRosterOvr: 70,
    teamOvr: 71,
    off: 73,
    def: 70,
    tier: 1,
    description: 'Features 89 OVR Justin Jefferson catching contested passes with 70 OVR teammates.',
  },
  {
    id: 'AI_SF',
    teamId: 'SF',
    city: 'San Francisco',
    name: 'San Francisco AI',
    abbr: 'SFA',
    primaryColor: '#AA0000',
    secondaryColor: '#B3995D',
    starPlayer: { name: 'Christian McCaffrey', position: 'RB', ovr: 89, archetype: 'Triple-Threat All-Purpose Back' },
    restRosterOvr: 70,
    teamOvr: 71,
    off: 74,
    def: 70,
    tier: 1,
    description: 'Features 89 OVR Christian McCaffrey running behind a 70 OVR offensive line.',
  },
  {
    id: 'AI_NYJ',
    teamId: 'NYJ',
    city: 'New Jersey',
    name: 'New Jersey AI',
    abbr: 'NJA',
    primaryColor: '#125740',
    secondaryColor: '#000000',
    starPlayer: { name: 'Sauce Gardner', position: 'CB', ovr: 89, archetype: 'Island Lockdown Press Corner' },
    restRosterOvr: 70,
    teamOvr: 71,
    off: 70,
    def: 74,
    tier: 1,
    description: 'Features 89 OVR Sauce Gardner locking down your top target with a 70 OVR defense.',
  },
  {
    id: 'AI_PIT',
    teamId: 'PIT',
    city: 'Pittsburgh',
    name: 'Pittsburgh AI',
    abbr: 'PTA',
    primaryColor: '#FFB612',
    secondaryColor: '#101820',
    starPlayer: { name: 'T.J. Watt', position: 'EDGE', ovr: 89, archetype: 'Demolition Pass Rusher' },
    restRosterOvr: 70,
    teamOvr: 71,
    off: 70,
    def: 74,
    tier: 1,
    description: 'Features 89 OVR T.J. Watt attacking the pocket against your offensive line.',
  },
  {
    id: 'AI_MIA',
    teamId: 'MIA',
    city: 'Miami',
    name: 'Miami AI',
    abbr: 'MIA',
    primaryColor: '#008E97',
    secondaryColor: '#FC4C02',
    starPlayer: { name: 'Tyreek Hill', position: 'WR', ovr: 89, archetype: 'Rocket Speedster Burner' },
    restRosterOvr: 70,
    teamOvr: 71,
    off: 74,
    def: 70,
    tier: 1,
    description: 'Features 89 OVR Tyreek Hill threatening deep touchdowns with a 70 OVR cast.',
  },
  {
    id: 'AI_DET',
    teamId: 'DET',
    city: 'Detroit',
    name: 'Detroit AI',
    abbr: 'DTA',
    primaryColor: '#0076B6',
    secondaryColor: '#B0B7BC',
    starPlayer: { name: 'Amon-Ra St. Brown', position: 'WR', ovr: 89, archetype: 'Chain-Moving Slot Machine' },
    restRosterOvr: 70,
    teamOvr: 71,
    off: 73,
    def: 70,
    tier: 1,
    description: 'Features 89 OVR Amon-Ra St. Brown dominating underneath routes with 70 OVR teammates.',
  },
  {
    id: 'AI_PHI',
    teamId: 'PHI',
    city: 'Philadelphia',
    name: 'Philadelphia AI',
    abbr: 'PHA',
    primaryColor: '#004C54',
    secondaryColor: '#A5ACAF',
    starPlayer: { name: 'Saquon Barkley', position: 'RB', ovr: 89, archetype: 'Spin & Stiff Arm Juggernaut' },
    restRosterOvr: 70,
    teamOvr: 71,
    off: 74,
    def: 70,
    tier: 1,
    description: 'Features 89 OVR Saquon Barkley breaking tackles alongside 70 OVR blockers.',
  },
  {
    id: 'AI_DAL',
    teamId: 'DAL',
    city: 'Dallas',
    name: 'Dallas AI',
    abbr: 'DLA',
    primaryColor: '#003594',
    secondaryColor: '#041E42',
    starPlayer: { name: 'Micah Parsons', position: 'EDGE', ovr: 89, archetype: 'Hybrid Blitz Havoc Machine' },
    restRosterOvr: 70,
    teamOvr: 71,
    off: 70,
    def: 74,
    tier: 1,
    description: 'Features 89 OVR Micah Parsons firing off the edge surrounded by 70 OVR defenders.',
  },
  {
    id: 'AI_CIN',
    teamId: 'CIN',
    city: 'Cincinnati',
    name: 'Cincinnati AI',
    abbr: 'CNA',
    primaryColor: '#FB4F14',
    secondaryColor: '#000000',
    starPlayer: { name: 'Joe Burrow', position: 'QB', ovr: 89, archetype: 'Pocket Precision Surgeon' },
    restRosterOvr: 70,
    teamOvr: 71,
    off: 74,
    def: 70,
    tier: 1,
    description: 'Features 89 OVR Joe Burrow threading passes to a 70 OVR receiving corps.',
  },
];

export const TIER_2_AI_BOSSES: AIOpponentTeam[] = [
  {
    id: 'AI_SF_T2',
    teamId: 'SF',
    city: 'San Francisco',
    name: 'SF Elite AI',
    abbr: 'SFE',
    primaryColor: '#AA0000',
    secondaryColor: '#B3995D',
    starPlayer: { name: 'Brock Purdy', position: 'QB', ovr: 89, archetype: 'Elite Efficiency Manager' },
    restRosterOvr: 80,
    teamOvr: 81,
    off: 84,
    def: 80,
    tier: 2,
    description: 'Tier 2 Boss: 89 OVR Brock Purdy leading an 80 OVR supporting cast.',
  },
  {
    id: 'AI_DAL_T2',
    teamId: 'DAL',
    city: 'Dallas',
    name: 'Dallas Elite AI',
    abbr: 'DLE',
    primaryColor: '#003594',
    secondaryColor: '#041E42',
    starPlayer: { name: 'CeeDee Lamb', position: 'WR', ovr: 89, archetype: 'Elite Slot Weapon' },
    restRosterOvr: 80,
    teamOvr: 81,
    off: 83,
    def: 80,
    tier: 2,
    description: 'Tier 2 Boss: 89 OVR CeeDee Lamb carrying an 80 OVR roster.',
  },
  {
    id: 'AI_DET_T2',
    teamId: 'DET',
    city: 'Detroit',
    name: 'Detroit Elite AI',
    abbr: 'DTE',
    primaryColor: '#0076B6',
    secondaryColor: '#B0B7BC',
    starPlayer: { name: 'Aidan Hutchinson', position: 'EDGE', ovr: 89, archetype: 'Relentless Edge Motor' },
    restRosterOvr: 80,
    teamOvr: 81,
    off: 80,
    def: 84,
    tier: 2,
    description: 'Tier 2 Boss: 89 OVR Aidan Hutchinson dominating the edge with an 80 OVR defense.',
  },
  {
    id: 'AI_PHI_T2',
    teamId: 'PHI',
    city: 'Philadelphia',
    name: 'Philadelphia Elite AI',
    abbr: 'PHE',
    primaryColor: '#004C54',
    secondaryColor: '#A5ACAF',
    starPlayer: { name: 'A.J. Brown', position: 'WR', ovr: 89, archetype: 'Physical Contested Catcher' },
    restRosterOvr: 80,
    teamOvr: 81,
    off: 83,
    def: 80,
    tier: 2,
    description: 'Tier 2 Boss: 89 OVR A.J. Brown leading an 80 OVR squad.',
  },
  {
    id: 'AI_LV_T2',
    teamId: 'LV',
    city: 'Las Vegas',
    name: 'Vegas Elite AI',
    abbr: 'LVE',
    primaryColor: '#000000',
    secondaryColor: '#A5ACAF',
    starPlayer: { name: 'Davante Adams', position: 'WR', ovr: 89, archetype: 'Ultimate Route Technician' },
    restRosterOvr: 80,
    teamOvr: 81,
    off: 83,
    def: 80,
    tier: 2,
    description: 'Tier 2 Boss: 89 OVR Davante Adams surgical routes with an 80 OVR team.',
  },
  {
    id: 'AI_CLE_T2',
    teamId: 'CLE',
    city: 'Cleveland',
    name: 'Cleveland Elite AI',
    abbr: 'CLE',
    primaryColor: '#311D00',
    secondaryColor: '#FF3C00',
    starPlayer: { name: 'Myles Garrett', position: 'EDGE', ovr: 89, archetype: 'Dominant Power Rusher' },
    restRosterOvr: 80,
    teamOvr: 81,
    off: 80,
    def: 84,
    tier: 2,
    description: 'Tier 2 Boss: 89 OVR Myles Garrett terrorizing your line with 80 OVR teammates.',
  },
  {
    id: 'AI_BAL_T2',
    teamId: 'BAL',
    city: 'Baltimore',
    name: 'Ravens Elite AI',
    abbr: 'BRE',
    primaryColor: '#241773',
    secondaryColor: '#000000',
    starPlayer: { name: 'Derrick Henry', position: 'RB', ovr: 89, archetype: 'Unstoppable Power Back' },
    restRosterOvr: 80,
    teamOvr: 81,
    off: 84,
    def: 80,
    tier: 2,
    description: 'Tier 2 Boss: 89 OVR Derrick Henry running through an 80 OVR line.',
  },
  {
    id: 'AI_KC_T2',
    teamId: 'KC',
    city: 'Kansas City',
    name: 'Chiefs Elite AI',
    abbr: 'KCE',
    primaryColor: '#E31837',
    secondaryColor: '#FFB81C',
    starPlayer: { name: 'Travis Kelce', position: 'TE', ovr: 89, archetype: 'Legend Tight End' },
    restRosterOvr: 80,
    teamOvr: 81,
    off: 83,
    def: 80,
    tier: 2,
    description: 'Tier 2 Boss: 89 OVR Travis Kelce catching everything with an 80 OVR squad.',
  },
  {
    id: 'AI_PHI_QB_T2',
    teamId: 'PHI',
    city: 'Philadelphia',
    name: 'Hurts Elite AI',
    abbr: 'HUE',
    primaryColor: '#004C54',
    secondaryColor: '#A5ACAF',
    starPlayer: { name: 'Jalen Hurts', position: 'QB', ovr: 89, archetype: 'Dual-Threat Playmaker' },
    restRosterOvr: 80,
    teamOvr: 81,
    off: 84,
    def: 80,
    tier: 2,
    description: 'Tier 2 Boss: 89 OVR Jalen Hurts leading an 80 OVR offensive unit.',
  },
  {
    id: 'AI_NYJ_T2',
    teamId: 'NYJ',
    city: 'New Jersey',
    name: 'Jets Elite AI',
    abbr: 'JTE',
    primaryColor: '#125740',
    secondaryColor: '#000000',
    starPlayer: { name: 'Breece Hall', position: 'RB', ovr: 89, archetype: 'Explosive Playmaker' },
    restRosterOvr: 80,
    teamOvr: 81,
    off: 84,
    def: 80,
    tier: 2,
    description: 'Tier 2 Boss: 89 OVR Breece Hall breaking away with an 80 OVR roster.',
  },
  {
    id: 'AI_HOU_T2',
    teamId: 'HOU',
    city: 'Houston',
    name: 'Houston Elite AI',
    abbr: 'HSE',
    primaryColor: '#03202F',
    secondaryColor: '#A71930',
    starPlayer: { name: 'Stefon Diggs', position: 'WR', ovr: 89, archetype: 'Deep Threat Technician' },
    restRosterOvr: 80,
    teamOvr: 81,
    off: 83,
    def: 80,
    tier: 2,
    description: 'Tier 2 Boss: 89 OVR Stefon Diggs catching bombs with 80 OVR support.',
  },
  {
    id: 'AI_LV_DEF_T2',
    teamId: 'LV',
    city: 'Las Vegas',
    name: 'Crosby Elite AI',
    abbr: 'CRE',
    primaryColor: '#000000',
    secondaryColor: '#A5ACAF',
    starPlayer: { name: 'Maxx Crosby', position: 'EDGE', ovr: 89, archetype: 'High-Motor Disruptor' },
    restRosterOvr: 80,
    teamOvr: 81,
    off: 80,
    def: 84,
    tier: 2,
    description: 'Tier 2 Boss: 89 OVR Maxx Crosby hunting your QB with an 80 OVR defense.',
  },
];

export const ALL_89_AI_BOSSES: AIOpponentTeam[] = [...TIER_1_AI_BOSSES, ...TIER_2_AI_BOSSES];

export const AI_OPPONENT_TEAMS = TIER_1_AI_BOSSES;

export function getAllAIBosses(): AIOpponentTeam[] {
  return ALL_89_AI_BOSSES;
}

export function getTutorialRewardChoices(): ClashCard[] {
  const common = {
    teamId: 'FA',
    teamName: 'Free Agent',
    college: 'N/A',
    age: 22,
    tier: 'elite' as const,
    acquiredAt: Date.now(),
    ovr: 80,
    speed: 88,
    strength: 82,
    agility: 88,
    awareness: 85,
  };

  return [
    {
      ...common,
      id: `caleb-williams-80-${Date.now()}`,
      name: 'Caleb Williams',
      position: 'QB',
      archetype: 'Improvise Field General',
    },
    {
      ...common,
      id: `deandre-swift-80-${Date.now()}`,
      name: 'Deandre Swift',
      position: 'RB',
      archetype: 'Elusive Shifty Back',
    },
    {
      ...common,
      id: `luther-burden-80-${Date.now()}`,
      name: 'Luther Burden Jr',
      position: 'WR',
      archetype: 'Physical Deep Threat',
    },
  ];
}

export interface MissionTemplate {
  title: string;
  description: string;
  target: number;
  reward: number; // GI payout scaled by task difficulty
  type: 'passing_yards' | 'rushing_yards' | 'touchdowns' | 'points' | 'wins';
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

const EASY_MISSIONS: MissionTemplate[] = [
  { title: 'Air Warmup', description: 'Throw for 150 passing yards', target: 150, reward: 8, type: 'passing_yards', difficulty: 'Easy' },
  { title: 'Ground Starter', description: 'Rush for 60 rushing yards', target: 60, reward: 8, type: 'rushing_yards', difficulty: 'Easy' },
  { title: 'First Six', description: 'Score 1 touchdown', target: 1, reward: 6, type: 'touchdowns', difficulty: 'Easy' },
  { title: 'Quick Victory', description: 'Win 1 Clash battle', target: 1, reward: 10, type: 'wins', difficulty: 'Easy' },
  { title: 'Scoreboard Active', description: 'Score 14 total points', target: 14, reward: 8, type: 'points', difficulty: 'Easy' },
];

const MEDIUM_MISSIONS: MissionTemplate[] = [
  { title: 'Gunslinger', description: 'Throw for 300 passing yards', target: 300, reward: 20, type: 'passing_yards', difficulty: 'Medium' },
  { title: 'Workhorse Back', description: 'Rush for 125 rushing yards', target: 125, reward: 20, type: 'rushing_yards', difficulty: 'Medium' },
  { title: 'Hat Trick', description: 'Score 3 touchdowns', target: 3, reward: 22, type: 'touchdowns', difficulty: 'Medium' },
  { title: 'Winning Streak', description: 'Win 2 Clash battles', target: 2, reward: 25, type: 'wins', difficulty: 'Medium' },
  { title: 'Offensive Surge', description: 'Score 28 total points', target: 28, reward: 22, type: 'points', difficulty: 'Medium' },
];

const HARD_MISSIONS: MissionTemplate[] = [
  { title: '500-Yard Masterclass', description: 'Throw for 450 passing yards', target: 450, reward: 45, type: 'passing_yards', difficulty: 'Hard' },
  { title: 'Bulldozer Breakthrough', description: 'Rush for 200 rushing yards', target: 200, reward: 45, type: 'rushing_yards', difficulty: 'Hard' },
  { title: 'Touchdown Avalanche', description: 'Score 5 touchdowns', target: 5, reward: 50, type: 'touchdowns', difficulty: 'Hard' },
  { title: 'Dominant Champion', description: 'Win 4 Clash battles', target: 4, reward: 60, type: 'wins', difficulty: 'Hard' },
  { title: 'High-Octane Offense', description: 'Score 42 total points', target: 42, reward: 50, type: 'points', difficulty: 'Hard' },
];

export function generateDailyMissions(): DailyMission[] {
  // Always generates exactly 3 missions (1 Easy, 1 Medium, 1 Hard) for balanced, difficulty-based rewards
  const easy = EASY_MISSIONS[Math.floor(Math.random() * EASY_MISSIONS.length)];
  const medium = MEDIUM_MISSIONS[Math.floor(Math.random() * MEDIUM_MISSIONS.length)];
  const hard = HARD_MISSIONS[Math.floor(Math.random() * HARD_MISSIONS.length)];

  const selected = [easy, medium, hard];
  const now = Date.now();

  return selected.map((m, idx) => ({
    id: `m-${m.type}-${m.difficulty.toLowerCase()}-${now}-${idx}`,
    title: m.title,
    description: m.description,
    target: m.target,
    current: 0,
    reward: m.reward,
    completed: false,
    type: m.type,
    difficulty: m.difficulty,
  }));
}

export function checkAndResetMissions(data: ClashUserData): ClashUserData {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (!data.lastMissionReset || (now - data.lastMissionReset) >= oneDay) {
    return {
      ...data,
      lastMissionReset: now,
      missions: generateDailyMissions(),
    };
  }
  return data;
}

export interface GlobalMissionsDoc {
  lastMissionReset: number;
  missions: DailyMission[];
}

export function syncUserDataWithGlobalMissions(
  userData: ClashUserData,
  globalData: GlobalMissionsDoc
): ClashUserData {
  if (!userData || !globalData || !globalData.missions || globalData.missions.length === 0) {
    return userData;
  }

  // If user's last reset timestamp does not match global, or if user has no missions
  if (userData.lastMissionReset !== globalData.lastMissionReset || !userData.missions || userData.missions.length === 0) {
    const newMissions: DailyMission[] = globalData.missions.map((m, idx) => ({
      id: m.id || `m-sync-${idx}-${globalData.lastMissionReset}`,
      title: m.title,
      description: m.description,
      target: m.target,
      current: 0,
      reward: m.reward,
      completed: false,
      type: m.type,
      difficulty: m.difficulty,
    }));

    return {
      ...userData,
      lastMissionReset: globalData.lastMissionReset,
      missions: newMissions,
    };
  }

  return userData;
}

export async function resetGlobalDailyMissionsInFirestore(): Promise<GlobalMissionsDoc> {
  const freshGlobal: GlobalMissionsDoc = {
    lastMissionReset: Date.now(),
    missions: generateDailyMissions(),
  };

  if (db) {
    try {
      const docRef = doc(db, 'clash_config', 'daily_missions');
      await setDoc(docRef, freshGlobal);
    } catch (err) {
      console.warn('Error saving global daily missions reset to Firestore:', err);
    }
  }

  return freshGlobal;
}

export function subscribeGlobalMissions(
  onUpdate: (globalData: GlobalMissionsDoc) => void
): () => void {
  if (!db) {
    return () => {};
  }

  const docRef = doc(db, 'clash_config', 'daily_missions');
  
  const unsubscribe = onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data() as GlobalMissionsDoc;
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      // Auto-reset global missions if 24 hours have elapsed
      if (!data.lastMissionReset || (now - data.lastMissionReset) >= oneDay) {
        resetGlobalDailyMissionsInFirestore().then((fresh) => {
          onUpdate(fresh);
        });
      } else {
        onUpdate(data);
      }
    } else {
      // Document doesn't exist yet, create it
      resetGlobalDailyMissionsInFirestore().then((fresh) => {
        onUpdate(fresh);
      });
    }
  }, (err) => {
    console.warn('Global missions subscription notice:', err);
  });

  return unsubscribe;
}

export function getCurrentAIBosses(data: ClashUserData): AIOpponentTeam[] {
  if (data.currentBossTier === 2) {
    return TIER_2_AI_BOSSES;
  }
  return TIER_1_AI_BOSSES;
}

// Helper to convert User Clash Team into an NFLTeam object for the game engine
export function createClashUserNFLTeam(userData: ClashUserData, ovrStats: { ovr: number; off: number; def: number }): NFLTeam {
  const qbId = userData.startingLineup['QB'];
  const rbId = userData.startingLineup['RB'];
  const wr1Id = userData.startingLineup['WR1'];
  const edge1Id = userData.startingLineup['EDGE1'];

  const qb = userData.roster.find((c) => c.id === qbId);
  const rb = userData.roster.find((c) => c.id === rbId);
  const wr = userData.roster.find((c) => c.id === wr1Id);
  const edge = userData.roster.find((c) => c.id === edge1Id);

  return {
    id: 'USER_CLASH',
    city: 'Dynasty',
    name: userData.teamName || 'Clash Club',
    abbr: 'DYN',
    conference: 'NFC',
    division: 'East',
    primaryColor: '#059669',
    secondaryColor: '#F59E0B',
    accentColor: '#10B981',
    textColor: '#FFFFFF',
    ovr: ovrStats.ovr,
    off: ovrStats.off,
    def: ovrStats.def,
    starQB: qb ? `${qb.name} (${qb.ovr})` : 'Caleb Miller (60)',
    starRB: rb ? `${rb.name} (${rb.ovr})` : 'Jordan Vance (60)',
    starWR: wr ? `${wr.name} (${wr.ovr})` : 'Marcus Sterling (60)',
    starDef: edge ? `${edge.name} (${edge.ovr})` : 'Xavier Kane (60)',
    stadium: 'Gridiron Clash Stadium',
    isDome: false,
    roster: userData.roster.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position as any,
      ovr: c.ovr || 60,
      potential: 'B+' as const,
      age: c.age || 22,
      college: c.college || 'Draft Prospect',
      speed: c.speed || 60,
      strength: c.strength || 60,
      agility: c.agility || 60,
      awareness: c.awareness || 60,
      archetype: c.archetype || 'Balanced',
      salary: 1.5,
      contractYears: 3,
    })),
  };
}

// Helper to convert an AI Opponent Team into an NFLTeam object for the game engine
export function createAIOpponentNFLTeam(aiTeam: AIOpponentTeam): NFLTeam {
  const isQB = aiTeam.starPlayer.position === 'QB';
  const isRB = aiTeam.starPlayer.position === 'RB';
  const isWR = aiTeam.starPlayer.position === 'WR';
  const isDef = ['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(aiTeam.starPlayer.position);
  const subOvr = aiTeam.id === 'AI_TUTORIAL' ? 45 : (aiTeam.restRosterOvr || 70);
  const subName = aiTeam.id === 'AI_TUTORIAL' ? 'Practice Dummy' : 'Rookie Sub';

  return {
    id: aiTeam.id,
    city: aiTeam.city,
    name: aiTeam.name,
    abbr: aiTeam.abbr,
    conference: 'AFC',
    division: 'West',
    primaryColor: aiTeam.primaryColor,
    secondaryColor: aiTeam.secondaryColor,
    accentColor: '#FFFFFF',
    textColor: '#FFFFFF',
    ovr: aiTeam.teamOvr,
    off: aiTeam.off,
    def: aiTeam.def,
    starQB: isQB ? `${aiTeam.starPlayer.name} (${aiTeam.starPlayer.ovr})` : `${subName} (${subOvr})`,
    starRB: isRB ? `${aiTeam.starPlayer.name} (${aiTeam.starPlayer.ovr})` : `${subName} (${subOvr})`,
    starWR: isWR ? `${aiTeam.starPlayer.name} (${aiTeam.starPlayer.ovr})` : `${subName} (${subOvr})`,
    starDef: isDef ? `${aiTeam.starPlayer.name} (${aiTeam.starPlayer.ovr})` : `${subName} (${subOvr})`,
    stadium: `${aiTeam.city} AI Arena`,
    isDome: false,
  };
}

// Initial user state
export function getInitialClashUserData(): ClashUserData {
  const { roster, lineup } = generateStarterRoster();
  const auctionListings = generateAuctionListings();

  return {
    teamName: 'Apex Dynasty',
    gridIrons: 2, // Starter Grid Irons (or earn 1 Grid Iron per AI win!)
    roster,
    startingLineup: lineup,
    auctionListings,
    transactions: [
      {
        id: `tx-starter-squad`,
        type: 'starter',
        description: 'Foundation 60 OVR Starter Squad & 2 Starter Grid Irons',
        amount: 2,
        timestamp: Date.now(),
      },
    ],
    aiBattlesWon: 0,
    aiBattlesPlayed: 0,
    defeatedBossIds: [],
    currentBossTier: 1,
    tutorialCompleted: false,
  };
}

// Load state from localStorage
export function loadClashUserData(): ClashUserData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialClashUserData();
      saveClashUserData(initial);
      return initial;
    }

    let parsed = JSON.parse(raw);
    if (!parsed || !parsed.roster || parsed.roster.length === 0) {
      const initial = getInitialClashUserData();
      saveClashUserData(initial);
      return initial;
    }

    // Ensure auctions are populated if empty
    if (!parsed.auctionListings || parsed.auctionListings.length === 0) {
      parsed.auctionListings = generateAuctionListings();
      saveClashUserData(parsed);
    }

    if (typeof parsed.gridIrons !== 'number') {
      parsed.gridIrons = 2;
    }

    // Migration for new fields
    if (!parsed.defeatedBossIds) parsed.defeatedBossIds = [];
    if (!parsed.currentBossTier) parsed.currentBossTier = 1;
    if (parsed.tutorialCompleted === undefined) parsed.tutorialCompleted = false;
    if (parsed.tutorialWins === undefined) parsed.tutorialWins = 0;
    if (!parsed.missions || !parsed.lastMissionReset) {
      parsed.missions = generateDailyMissions();
      parsed.lastMissionReset = Date.now();
    } else {
      parsed = checkAndResetMissions(parsed);
    }

    return parsed;
  } catch (e) {
    console.error('Failed to load Clash data from localStorage:', e);
    const initial = getInitialClashUserData();
    return initial;
  }
}

// Save state to localStorage
export function saveClashUserData(data: ClashUserData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save Clash data to localStorage:', e);
  }
}

/**
 * Robust User Data Merger
 * Merges local and remote user data ensuring NO pulled card is ever lost
 * during cloud sync or snapshot updates.
 */
export function mergeClashUserData(local: ClashUserData, incoming: ClashUserData): ClashUserData {
  if (!local || !local.roster) return incoming || getInitialClashUserData();
  if (!incoming || !incoming.roster) return local;

  // Merge rosters by unique card ID, keeping local copies if incoming does not have them
  const incomingIds = new Set(incoming.roster.map((c) => c.id));
  const localOnlyCards = local.roster.filter((c) => !incomingIds.has(c.id));
  const mergedRoster = [...incoming.roster, ...localOnlyCards];

  // Merge transactions by unique ID
  const incomingTxIds = new Set((incoming.transactions || []).map((t) => t.id));
  const localOnlyTx = (local.transactions || []).filter((t) => !incomingTxIds.has(t.id));
  const mergedTx = [...(incoming.transactions || []), ...localOnlyTx].sort((a, b) => b.timestamp - a.timestamp);

  // Lineup: keep all valid slots referencing existing cards in mergedRoster
  const mergedRosterIds = new Set(mergedRoster.map((c) => c.id));
  const mergedLineup: Record<string, string> = { ...(local.startingLineup || {}) };
  Object.entries(incoming.startingLineup || {}).forEach(([slot, cardId]) => {
    if (mergedRosterIds.has(cardId)) {
      mergedLineup[slot] = cardId;
    }
  });
  const sanitizedMergedLineup = sanitizeLineupUniquePlayers(mergedLineup, mergedRoster);

  const mergedBosses = Array.from(new Set([...(local.defeatedBossIds || []), ...(incoming.defeatedBossIds || [])]));

  return {
    teamName: local.teamName || incoming.teamName || 'Apex Dynasty',
    gridIrons: Math.max(local.gridIrons ?? 0, incoming.gridIrons ?? 0),
    roster: mergedRoster,
    startingLineup: sanitizedMergedLineup,
    auctionListings: incoming.auctionListings?.length ? incoming.auctionListings : (local.auctionListings || []),
    transactions: mergedTx,
    aiBattlesWon: Math.max(local.aiBattlesWon || 0, incoming.aiBattlesWon || 0),
    aiBattlesPlayed: Math.max(local.aiBattlesPlayed || 0, incoming.aiBattlesPlayed || 0),
    wins: Math.max(local.wins || 0, incoming.wins || 0),
    losses: Math.max(local.losses || 0, incoming.losses || 0),
    userOvr: Math.max(local.userOvr || 60, incoming.userOvr || 60),
    defeatedBossIds: mergedBosses,
    currentBossTier: Math.max(local.currentBossTier || 1, incoming.currentBossTier || 1),
  };
}

// Helper to find AI opponent by ID, teamId, name, or star player
export function findAIOpponent(idOrName: string): AIOpponentTeam | undefined {
  if (!idOrName) return undefined;
  const lower = idOrName.toLowerCase();
  const allBosses = getAllAIBosses();
  return allBosses.find(
    (t) =>
      t.id.toLowerCase() === lower ||
      t.teamId.toLowerCase() === lower ||
      t.name.toLowerCase() === lower ||
      `${t.city} ${t.name}`.toLowerCase() === lower ||
      t.abbr.toLowerCase() === lower ||
      lower.includes(t.abbr.toLowerCase()) ||
      lower.includes(t.name.toLowerCase()) ||
      lower.includes(t.starPlayer.name.toLowerCase())
  );
}

// Award Grid Iron and a card for victory over an AI team
export function awardClashVictory(
  data: ClashUserData,
  aiTeamIdentifier: string,
  starPlayerName?: string
): { updatedData: ClashUserData; rewardedCard?: ClashCard } {
  const allBosses = [...getAllAIBosses(), TUTORIAL_AI_BOSS];
  const matchedTeam = allBosses.find(
    (t) =>
      t.id.toLowerCase() === aiTeamIdentifier.toLowerCase() ||
      t.teamId.toLowerCase() === aiTeamIdentifier.toLowerCase() ||
      t.name.toLowerCase() === aiTeamIdentifier.toLowerCase() ||
      `${t.city} ${t.name}`.toLowerCase() === aiTeamIdentifier.toLowerCase() ||
      t.abbr.toLowerCase() === aiTeamIdentifier.toLowerCase() ||
      aiTeamIdentifier.toLowerCase().includes(t.abbr.toLowerCase()) ||
      aiTeamIdentifier.toLowerCase().includes(t.name.toLowerCase()) ||
      aiTeamIdentifier.toLowerCase().includes(t.starPlayer.name.toLowerCase())
  ) || allBosses[0];

  const rewardOvr = matchedTeam.id === 'AI_TUTORIAL' ? 80 : (matchedTeam.tier === 2 ? 80 : 75);
  const rewardGridIrons = matchedTeam.id === 'AI_TUTORIAL' ? 10 : (matchedTeam.tier === 2 ? 5 : 1);

  // If it's tutorial, we don't grant a card immediately because they get a choice.
  // We'll handle the 10 GI and mark the boss as defeated.
  if (matchedTeam.id === 'AI_TUTORIAL') {
    const updated: ClashUserData = {
      ...data,
      gridIrons: (data.gridIrons || 0) + rewardGridIrons,
      aiBattlesWon: (data.aiBattlesWon || 0) + 1,
      aiBattlesPlayed: (data.aiBattlesPlayed || 0) + 1,
      tutorialWins: (data.tutorialWins || 0) + 1,
      // We keep tutorial boss in defeated list, but GridironClash will handle the choice menu
      defeatedBossIds: Array.from(new Set([...(data.defeatedBossIds || []), matchedTeam.id])),
      tutorialCompleted: false, // Set to false to force reward selection
      transactions: [
        {
          id: `tx-${Date.now()}`,
          type: 'battle_win',
          description: `Defeated Introductory Squad! Won +${rewardGridIrons} Grid Irons & unlocked card choice!`,
          amount: rewardGridIrons,
          timestamp: Date.now(),
        },
        ...data.transactions,
      ],
    };
    return { updatedData: updated };
  }

  const rewardedCard: ClashCard = createStarCard(matchedTeam, rewardOvr);
  if (starPlayerName && starPlayerName !== matchedTeam.starPlayer.name) {
    rewardedCard.name = starPlayerName;
  }

  // Auto-upgrade starting lineup slot if current starter has lower OVR
  const updatedLineup = { ...data.startingLineup };
  const rewardedName = rewardedCard.name.trim().toLowerCase();
  const existingSlotEntry = Object.entries(updatedLineup).find(([sId, cId]) => {
    const c = data.roster.find((rc) => rc && rc.id === cId);
    return c && c.name.trim().toLowerCase() === rewardedName;
  });

  if (existingSlotEntry) {
    const [existingSlotId, existingCardId] = existingSlotEntry;
    const existingCard = data.roster.find((rc) => rc && rc.id === existingCardId);
    if (existingCard && rewardOvr > existingCard.ovr) {
      updatedLineup[existingSlotId] = rewardedCard.id;
      rewardedCard.isStarter = true;
      rewardedCard.assignedSlot = existingSlotId;
    }
  } else {
    const matchingSlots = STARTER_SLOTS.filter((s) => s.position === rewardedCard.position);
    for (const slot of matchingSlots) {
      const currentStarterId = updatedLineup[slot.id];
      const currentStarterCard = data.roster.find((c) => c && c.id === currentStarterId);
      if (currentStarterCard && currentStarterCard.ovr < rewardOvr) {
        updatedLineup[slot.id] = rewardedCard.id;
        rewardedCard.isStarter = true;
        rewardedCard.assignedSlot = slot.id;
        break;
      }
    }
  }

  const newGridIrons = (data.gridIrons || 0) + rewardGridIrons;
  const newWins = (data.aiBattlesWon || 0) + 1;
  const newPlayed = (data.aiBattlesPlayed || 0) + 1;

  const transaction: ClashTransaction = {
    id: `tx-${Date.now()}`,
    type: 'battle_win',
    description: `Defeated ${matchedTeam.name} (Tier ${matchedTeam.tier || 1}) - Won ${rewardOvr} OVR ${rewardedCard.name} & +${rewardGridIrons} Grid Iron${rewardGridIrons > 1 ? 's' : ''}`,
    cardName: `${rewardedCard.name} (${rewardOvr} OVR)`,
    amount: rewardGridIrons,
    timestamp: Date.now(),
  };

  // Track progression
  const newDefeatedBossIds = Array.from(new Set([...(data.defeatedBossIds || []), matchedTeam.id]));
  let newTier = data.currentBossTier || 1;

  const currentTierBosses = matchedTeam.tier === 2 ? TIER_2_AI_BOSSES : TIER_1_AI_BOSSES;
  const allCurrentTierBeaten = currentTierBosses.every(b => newDefeatedBossIds.includes(b.id));

  if (allCurrentTierBeaten && matchedTeam.tier === 1) {
    newTier = 2;
  }

  const updated: ClashUserData = {
    ...data,
    gridIrons: newGridIrons,
    roster: [...data.roster, rewardedCard],
    startingLineup: updatedLineup,
    aiBattlesWon: newWins,
    aiBattlesPlayed: newPlayed,
    transactions: [transaction, ...data.transactions],
    defeatedBossIds: newDefeatedBossIds,
    currentBossTier: newTier,
  };

  saveClashUserData(updated);
  return { updatedData: updated, rewardedCard };
}

// Generate a version of the AI boss star player card
export function createStarCard(aiTeam: AIOpponentTeam, targetOvr: number): ClashCard {
  const star = aiTeam.starPlayer;
  const rosterPlayers = AUTHENTIC_TEAM_ROSTERS[aiTeam.teamId] || [];
  const authenticDef = rosterPlayers.find(
    (p) => p.name.toLowerCase() === star.name.toLowerCase()
  );

  const scale = targetOvr / (authenticDef?.ovr || 90);

  const speed = authenticDef
    ? Math.max(65, Math.min(95, Math.round(authenticDef.speed * scale)))
    : targetOvr + 1;
  const strength = authenticDef
    ? Math.max(60, Math.min(95, Math.round(authenticDef.strength * scale)))
    : targetOvr - 1;
  const agility = authenticDef
    ? Math.max(65, Math.min(95, Math.round(authenticDef.agility * scale)))
    : targetOvr;
  const awareness = authenticDef
    ? Math.max(65, Math.min(95, Math.round(authenticDef.awareness * scale)))
    : targetOvr;

  return {
    id: `clash-star-${targetOvr}-${aiTeam.teamId}-${Date.now()}`,
    name: star.name,
    position: star.position,
    ovr: targetOvr,
    teamId: aiTeam.teamId,
    teamName: `${aiTeam.city} ${aiTeam.name}`,
    speed,
    strength,
    agility,
    awareness,
    archetype: star.archetype,
    college: authenticDef?.college || 'Pro Bowl Elite',
    age: authenticDef?.age || 26,
    tier: getCardTier(targetOvr),
    isStarter: false,
    acquiredAt: Date.now(),
  };
}

// Award Grid Iron for victory
export function awardGridIronForVictory(data: ClashUserData, aiTeamName: string): ClashUserData {
  const { updatedData } = awardClashVictory(data, aiTeamName);
  return updatedData;
}

// Reset state
export function resetClashUserData(): ClashUserData {
  const fresh = getInitialClashUserData();
  saveClashUserData(fresh);
  return fresh;
}

export function isWayneGarrettEquipped(): boolean {
  try {
    const data = loadClashUserData();
    if (!data || !data.roster) return false;
    const rbCardId = data.startingLineup['RB'];
    const rbCard = data.roster.find((c) => c.id === rbCardId);
    if (rbCard && rbCard.name === 'Wayne Garrett') return true;
    return data.roster.some((c) => c.name === 'Wayne Garrett');
  } catch (e) {
    return false;
  }
}

export function isCamNewtonEquipped(): boolean {
  try {
    const data = loadClashUserData();
    if (!data || !data.roster) return false;
    const qbCardId = data.startingLineup['QB'];
    const qbCard = data.roster.find((c) => c.id === qbCardId);
    if (qbCard && qbCard.name === 'Cam Newton') return true;
    return data.roster.some((c) => c.name === 'Cam Newton');
  } catch (e) {
    return false;
  }
}

export function isDarnoldStartingQB(): boolean {
  try {
    const data = loadClashUserData();
    if (!data || !data.roster) return false;
    const qbCardId = data.startingLineup['QB'];
    const qbCard = data.roster.find((c) => c.id === qbCardId);
    if (qbCard && (qbCard.name.toLowerCase().includes('darnold') || qbCard.name === 'Sam Darnold')) return true;
    return false;
  } catch (e) {
    return false;
  }
}

export function isJSNRouteArtistEquipped(): boolean {
  try {
    const data = loadClashUserData();
    if (!data || !data.roster) return false;
    const wr1Id = data.startingLineup['WR1'];
    const wr2Id = data.startingLineup['WR2'];
    const slotId = data.startingLineup['SLOT'];
    const wrCards = data.roster.filter((c) => c.id === wr1Id || c.id === wr2Id || c.id === slotId);
    if (wrCards.some((c) => c.name === 'Jaxon Smith-Njigba')) return true;
    return data.roster.some((c) => c.name === 'Jaxon Smith-Njigba');
  } catch (e) {
    return false;
  }
}

export function isPatMcAfee1YardLineEquipped(): boolean {
  try {
    const data = loadClashUserData();
    if (!data || !data.roster) return false;
    const pCardId = data.startingLineup['P'];
    const pCard = data.roster.find((c) => c.id === pCardId);
    if (pCard && (pCard.name.toLowerCase().includes('mcafee') || pCard.name.toLowerCase().includes('macafee'))) return true;
    return data.roster.some((c) => (c.name.toLowerCase().includes('mcafee') || c.name.toLowerCase().includes('macafee')) && c.ovr >= 95);
  } catch (e) {
    return false;
  }
}

export function isAndrewLuckComposureEquipped(): boolean {
  try {
    const data = loadClashUserData();
    if (!data || !data.roster) return false;
    const qbCardId = data.startingLineup['QB'];
    const qbCard = data.roster.find((c) => c.id === qbCardId);
    if (qbCard && qbCard.name === 'Andrew Luck') return true;
    return data.roster.some((c) => c.name === 'Andrew Luck' && c.ovr >= 88);
  } catch (e) {
    return false;
  }
}

export function isTyreekHillTooFastEquipped(): boolean {
  try {
    const data = loadClashUserData();
    if (!data || !data.roster) return false;
    const wrIds = [data.startingLineup['WR1'], data.startingLineup['WR2'], data.startingLineup['WR3']];
    return data.roster.some((c) => wrIds.includes(c.id) && c.name === 'Tyreek Hill' && c.ovr >= 95);
  } catch (e) {
    return false;
  }
}

export function isTravisKelceJumpBallEquipped(): boolean {
  try {
    const data = loadClashUserData();
    if (!data || !data.roster) return false;
    const teCardId = data.startingLineup['TE'];
    const teCard = data.roster.find((c) => c.id === teCardId);
    if (teCard && teCard.name === 'Travis Kelce' && teCard.ovr >= 88) return true;
    return data.roster.some((c) => c.name === 'Travis Kelce' && c.ovr >= 88);
  } catch (e) {
    return false;
  }
}

export function isChrisJonesDoubleMeEquipped(): boolean {
  try {
    const data = loadClashUserData();
    if (!data || !data.roster) return false;
    const dtIds = [data.startingLineup['DT1'], data.startingLineup['DT2']];
    return data.roster.some((c) => dtIds.includes(c.id) && c.name === 'Chris Jones' && c.ovr >= 90);
  } catch (e) {
    return false;
  }
}

export function isChristianMcCaffreyNotLostYetEquipped(): boolean {
  try {
    const data = loadClashUserData();
    if (!data || !data.roster) return false;
    const rbCardId = data.startingLineup['RB'];
    const rbCard = data.roster.find((c) => c.id === rbCardId);
    if (rbCard && rbCard.name === 'Christian McCaffrey') return true;
    return data.roster.some((c) => c.name === 'Christian McCaffrey');
  } catch (e) {
    return false;
  }
}

export function isTrentWilliamsItTakes2Equipped(): boolean {
  try {
    const data = loadClashUserData();
    if (!data || !data.roster) return false;
    const otCardId = data.startingLineup['OT'] || data.startingLineup['OT1'] || data.startingLineup['OT2'];
    const otCard = data.roster.find((c) => c.id === otCardId);
    if (otCard && otCard.name === 'Trent Williams') return true;
    return data.roster.some((c) => c.name === 'Trent Williams');
  } catch (e) {
    return false;
  }
}

// Lineman and all-position helper for pack pulls
const BONUS_LINEMEN_75: { name: string; position: ClashPosition; teamId: string; teamName: string; college: string; archetype: string }[] = [
  { name: 'Trent Williams', position: 'OT', teamId: 'SF', teamName: 'San Francisco 49ers', college: 'Oklahoma', archetype: 'Blindside Wall' },
  { name: 'Penei Sewell', position: 'OT', teamId: 'DET', teamName: 'Detroit Lions', college: 'Oregon', archetype: 'Power Edge Mauler' },
  { name: 'Tristan Wirfs', position: 'OT', teamId: 'TB', teamName: 'Tampa Bay Buccaneers', college: 'Iowa', archetype: 'Pass Protection Fortress' },
  { name: 'Zack Martin', position: 'OG', teamId: 'DAL', teamName: 'Dallas Cowboys', college: 'Notre Dame', archetype: 'Anchor Technician' },
  { name: 'Quenton Nelson', position: 'OG', teamId: 'IND', teamName: 'Indianapolis Colts', college: 'Notre Dame', archetype: 'Pancake Specialist' },
  { name: 'Joe Thuney', position: 'OG', teamId: 'KC', teamName: 'Kansas City Chiefs', college: 'NC State', archetype: 'Zone Blocker' },
  { name: 'Creed Humphrey', position: 'C', teamId: 'KC', teamName: 'Kansas City Chiefs', college: 'Oklahoma', archetype: 'Iron Pivot' },
  { name: 'Frank Ragnow', position: 'C', teamId: 'DET', teamName: 'Detroit Lions', college: 'Arkansas', archetype: 'Tough Trench General' },
  { name: 'Tyler Linderbaum', position: 'C', teamId: 'BAL', teamName: 'Baltimore Ravens', college: 'Iowa', archetype: 'Agile Zone Center' },
  { name: 'Chris Jones', position: 'DT', teamId: 'KC', teamName: 'Kansas City Chiefs', college: 'Mississippi State', archetype: '3-Tech Disruptor' },
  { name: 'Dexter Lawrence', position: 'DT', teamId: 'NYG', teamName: 'New York Giants', college: 'Clemson', archetype: 'Nose Tackle Juggernaut' },
  { name: 'Quinnen Williams', position: 'DT', teamId: 'NYJ', teamName: 'New York Jets', college: 'Alabama', archetype: 'Interior Sacker' },
  { name: 'Jalen Carter', position: 'DT', teamId: 'PHI', teamName: 'Philadelphia Eagles', college: 'Georgia', archetype: 'Gap Penetrator' },
  { name: 'Myles Garrett', position: 'EDGE', teamId: 'CLE', teamName: 'Cleveland Browns', college: 'Texas A&M', archetype: 'Unstoppable Rusher' },
  { name: 'Nick Bosa', position: 'EDGE', teamId: 'SF', teamName: 'San Francisco 49ers', college: 'Ohio State', archetype: 'Bend & Power Rusher' },
  { name: 'Maxx Crosby', position: 'EDGE', teamId: 'LV', teamName: 'Las Vegas Raiders', college: 'Eastern Michigan', archetype: 'Relentless Motor' },
  { name: 'Aidan Hutchinson', position: 'EDGE', teamId: 'DET', teamName: 'Detroit Lions', college: 'Michigan', archetype: 'Edge Setter' },
];

const BONUS_LINEMEN_65: { name: string; position: ClashPosition; teamId: string; teamName: string; college: string; archetype: string }[] = [
  { name: 'Jackson Carman', position: 'OT', teamId: 'CIN', teamName: 'Cincinnati Bengals', college: 'Clemson', archetype: 'Backup Tackle' },
  { name: 'Broderick Jones', position: 'OT', teamId: 'PIT', teamName: 'Pittsburgh Steelers', college: 'Georgia', archetype: 'Developing Tackle' },
  { name: 'Royce Newman', position: 'OG', teamId: 'GB', teamName: 'Green Bay Packers', college: 'Ole Miss', archetype: 'Rotational Guard' },
  { name: 'Spencer Burford', position: 'OG', teamId: 'SF', teamName: 'San Francisco 49ers', college: 'UTSA', archetype: 'Depth Guard' },
  { name: 'Luke Wypler', position: 'C', teamId: 'CLE', teamName: 'Cleveland Browns', college: 'Ohio State', archetype: 'Backup Center' },
  { name: 'Ricky Stromberg', position: 'C', teamId: 'WAS', teamName: 'Washington Commanders', college: 'Arkansas', archetype: 'Depth Center' },
  { name: 'Bryan Bresee', position: 'DT', teamId: 'NO', teamName: 'New Orleans Saints', college: 'Clemson', archetype: 'Interior Depth' },
  { name: 'Keeanu Benton', position: 'DT', teamId: 'PIT', teamName: 'Pittsburgh Steelers', college: 'Wisconsin', archetype: 'Rotational Nose' },
  { name: 'Felix Anudike-Uzomah', position: 'EDGE', teamId: 'KC', teamName: 'Kansas City Chiefs', college: 'Kansas State', archetype: 'Speed Depth Rusher' },
  { name: 'Will McDonald IV', position: 'EDGE', teamId: 'NYJ', teamName: 'New York Jets', college: 'Iowa State', archetype: 'Pass Rush Sub' },
];

// Open Card Pack - Supports 'wayne_garrett', 'cam_newton', 'seattle', 'colts_legends', 'essentials', 'kc_dynasty', and 'sf_hofers'
export function openCardPack(
  userData: ClashUserData,
  packType: 'wayne_garrett' | 'cam_newton' | 'seattle' | 'colts_legends' | 'essentials' | 'kc_dynasty' | 'sf_hofers' = 'wayne_garrett'
): { updatedUserData: ClashUserData; pulledCards: ClashCard[] } {
  const pulledCards: ClashCard[] = [];

  // San Fran Future HoFers Pack (featuring 95 OVR RB Christian McCaffrey & 90 OVR LT Trent Williams)
  if (packType === 'sf_hofers') {
    for (let i = 0; i < 10; i++) {
      const roll = Math.random();
      let pulledCard: ClashCard;

      if (roll < 0.015) {
        // 95 OVR Christian McCaffrey (RB - Game Breaker: Not Lost Yet)
        pulledCard = {
          id: `cmc-95-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          name: 'Christian McCaffrey',
          position: 'RB',
          ovr: 95,
          teamId: 'SF',
          teamName: 'San Francisco 49ers',
          speed: 94,
          strength: 85,
          agility: 95,
          awareness: 96,
          archetype: 'Versatile Back / Dual Threat',
          college: 'Stanford',
          age: 28,
          tier: getCardTier(95),
          abilityTitle: 'Game Breaker',
          abilityName: 'Not Lost Yet',
          abilityDescription: 'It grants McCaffery the ability to gain a rush worth a first down if the current down is 4th and his last rush was less than 3 yards.',
          acquiredAt: Date.now(),
        };
      } else if (roll < 0.035) {
        // 90 OVR Trent Williams (OT - Game Breaker: It Takes 2)
        pulledCard = {
          id: `trent-williams-90-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          name: 'Trent Williams',
          position: 'OT',
          ovr: 90,
          teamId: 'SF',
          teamName: 'San Francisco 49ers',
          speed: 78,
          strength: 96,
          agility: 80,
          awareness: 95,
          archetype: 'Blindside Wall',
          college: 'Oklahoma',
          age: 36,
          tier: getCardTier(90),
          abilityTitle: 'Game Breaker',
          abilityName: 'It Takes 2',
          abilityDescription: 'If the opposing D lineman that Trent Williams is guarding is over a 90 Overall, he doubles in stats and acts as if was double teaming the opposing D lineman.',
          acquiredAt: Date.now(),
        };
      } else if (roll < 0.235) {
        const all75: any[] = [];
        BONUS_LINEMEN_75.forEach(l => all75.push({ name: l.name, position: l.position, teamId: l.teamId, teamName: l.teamName, college: l.college, archetype: l.archetype, speed: 74, strength: 88, agility: 75, awareness: 80 }));
        Object.entries(AUTHENTIC_TEAM_ROSTERS).forEach(([tKey, roster]) => {
          const teamObj = NFL_TEAMS.find((t) => t.id.toLowerCase() === tKey.toLowerCase());
          const tName = teamObj ? teamObj.name : tKey;
          roster.forEach(p => {
            if (p.ovr >= 72 && p.ovr <= 78) {
              all75.push({ name: p.name, position: p.position, teamId: tKey, teamName: tName, college: p.college, archetype: p.archetype, speed: p.speed, strength: p.strength, agility: p.agility, awareness: p.awareness });
            }
          });
        });
        const chosen = all75[Math.floor(Math.random() * all75.length)] || { name: '49er Starter', position: 'WR', teamId: 'SF', teamName: 'San Francisco 49ers', college: 'Stanford', archetype: 'Route Runner', speed: 82, strength: 75, agility: 82, awareness: 78 };
        pulledCard = {
          id: `sf-75-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          name: chosen.name,
          position: chosen.position,
          ovr: 75,
          teamId: chosen.teamId,
          teamName: chosen.teamName,
          speed: chosen.speed,
          strength: chosen.strength,
          agility: chosen.agility,
          awareness: chosen.awareness,
          archetype: chosen.archetype,
          college: chosen.college,
          age: 24,
          tier: getCardTier(75),
          acquiredAt: Date.now(),
        };
      } else {
        const all65: any[] = [];
        BONUS_LINEMEN_65.forEach(l => all65.push({ name: l.name, position: l.position, teamId: l.teamId, teamName: l.teamName, college: l.college, archetype: l.archetype }));
        Object.entries(AUTHENTIC_TEAM_ROSTERS).forEach(([tKey, roster]) => {
          const teamObj = NFL_TEAMS.find((t) => t.id.toLowerCase() === tKey.toLowerCase());
          const tName = teamObj ? teamObj.name : tKey;
          roster.forEach(p => {
            if (p.ovr >= 64 && p.ovr <= 69) {
              all65.push({ name: p.name, position: p.position, teamId: tKey, teamName: tName, college: p.college, archetype: p.archetype });
            }
          });
        });
        const chosen = all65[Math.floor(Math.random() * all65.length)] || { name: 'SF Depth', position: 'CB', teamId: 'SF', teamName: 'San Francisco 49ers', college: 'San Jose State', archetype: 'Backup Corner' };
        pulledCard = {
          id: `sf-65-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          name: chosen.name,
          position: chosen.position,
          ovr: 65,
          teamId: chosen.teamId,
          teamName: chosen.teamName,
          speed: 72,
          strength: 68,
          agility: 72,
          awareness: 65,
          archetype: chosen.archetype,
          college: chosen.college,
          age: 23,
          tier: getCardTier(65),
          acquiredAt: Date.now(),
        };
      }
      pulledCards.push(pulledCard);
    }

    const updatedUserData = {
      ...userData,
      gridIrons: userData.gridIrons - 10,
      roster: [...userData.roster, ...pulledCards],
      transactions: [
        {
          id: `tx-pack-${Date.now()}`,
          type: 'buy' as const,
          description: `Opened San Fran Future HoFers Pack (10 Players - Best: ${pulledCards.reduce((best, c) => c.ovr > best.ovr ? c : best, pulledCards[0]).name} ${pulledCards.reduce((best, c) => c.ovr > best.ovr ? c : best, pulledCards[0]).ovr} OVR)`,
          cardName: 'San Fran Future HoFers Pack',
          amount: 10,
          timestamp: Date.now(),
        },
        ...userData.transactions,
      ],
    };
    saveClashUserData(updatedUserData);
    return { updatedUserData, pulledCards };
  }

  // Dedicated Colts Legends Pack (featuring 99 OVR Pat McAfee P & 99 OVR Andrew Luck QB)
  if (packType === 'colts_legends') {
    for (let i = 0; i < 10; i++) {
      const roll = Math.random();
      let pulledCard: ClashCard;

      if (roll < 0.025) {
        const starChoice = Math.random() < 0.5 ? 'mcafee' : 'luck';
        if (starChoice === 'mcafee') {
          // 99 OVR Pat McAfee (Punter - Game Breaker: 1 Yard line)
          pulledCard = {
            id: `pat-mcafee-99-${Date.now()}-${i}`,
            name: 'Pat McAfee',
            position: 'P',
            ovr: 99,
            teamId: 'IND',
            teamName: 'Indianapolis Colts',
            speed: 90,
            strength: 95,
            agility: 90,
            awareness: 99,
            archetype: 'Coffin-Corner Master',
            college: 'West Virginia',
            age: 28,
            tier: getCardTier(99),
            abilityTitle: 'Game Breaker',
            abilityName: '1 Yard line',
            abilityDescription: 'His punts always land at the 1 yard line.',
            acquiredAt: Date.now(),
          };
        } else {
          // 99 OVR Andrew Luck (QB - Game Breaker: Composure)
          pulledCard = {
            id: `andrew-luck-99-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
            name: 'Andrew Luck',
            position: 'QB',
            ovr: 99,
            teamId: 'IND',
            teamName: 'Indianapolis Colts',
            speed: 95,
            strength: 96,
            agility: 94,
            awareness: 99,
            archetype: 'Gunslinger Commander',
            college: 'Stanford',
            age: 27,
            tier: getCardTier(99),
            abilityTitle: 'Game Breaker',
            abilityName: 'Composure',
            abilityDescription: 'He can never be sacked. Every sack attempt is instead a completion or a safe throw away.',
            acquiredAt: Date.now(),
          };
        }
      } else if (roll < 0.225) {
        // 75 OVR Starters (including authentic Colts/NFL players & OL/DL)
        const allPlayers: { player: { name: string; position: ClashPosition; speed: number; strength: number; agility: number; awareness: number; archetype: string; college: string; age: number }; teamKey: string; teamName: string }[] = [];

        Object.entries(AUTHENTIC_TEAM_ROSTERS).forEach(([tKey, roster]) => {
          const teamObj = NFL_TEAMS.find((t) => t.id.toLowerCase() === tKey.toLowerCase());
          const tName = teamObj ? teamObj.name : tKey;
          roster.forEach((p) => {
            if (p.ovr >= 72 && p.ovr <= 78) {
              allPlayers.push({
                player: {
                  name: p.name,
                  position: p.position as ClashPosition,
                  speed: p.speed,
                  strength: p.strength,
                  agility: p.agility,
                  awareness: p.awareness,
                  archetype: p.archetype,
                  college: p.college,
                  age: p.age,
                },
                teamKey: tKey,
                teamName: tName,
              });
            }
          });
        });

        BONUS_LINEMEN_75.forEach((l) => {
          allPlayers.push({
            player: {
              name: l.name,
              position: l.position,
              speed: 74,
              strength: 88,
              agility: 75,
              awareness: 76,
              archetype: l.archetype,
              college: l.college,
              age: 26,
            },
            teamKey: l.teamId,
            teamName: l.teamName,
          });
        });

        const chosen = allPlayers[Math.floor(Math.random() * allPlayers.length)];
        const ovr = 75;
        const tier = getCardTier(ovr);
        pulledCard = {
          id: `colts-starter-75-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
          name: chosen.player.name,
          position: chosen.player.position,
          ovr,
          teamId: chosen.teamKey,
          teamName: chosen.teamName,
          speed: chosen.player.speed,
          strength: chosen.player.strength,
          agility: chosen.player.agility,
          awareness: chosen.player.awareness,
          archetype: chosen.player.archetype,
          college: chosen.player.college,
          age: chosen.player.age,
          tier,
          acquiredAt: Date.now(),
        };
      } else {
        // 65 OVR Backups
        const allPlayers: { player: { name: string; position: ClashPosition; speed: number; strength: number; agility: number; awareness: number; archetype: string; college: string; age: number }; teamKey: string; teamName: string }[] = [];

        Object.entries(AUTHENTIC_TEAM_ROSTERS).forEach(([tKey, roster]) => {
          const teamObj = NFL_TEAMS.find((t) => t.id.toLowerCase() === tKey.toLowerCase());
          const tName = teamObj ? teamObj.name : tKey;
          roster.forEach((p) => {
            if (p.ovr < 72) {
              allPlayers.push({
                player: {
                  name: p.name,
                  position: p.position as ClashPosition,
                  speed: p.speed,
                  strength: p.strength,
                  agility: p.agility,
                  awareness: p.awareness,
                  archetype: p.archetype,
                  college: p.college,
                  age: p.age,
                },
                teamKey: tKey,
                teamName: tName,
              });
            }
          });
        });

        BONUS_LINEMEN_65.forEach((l) => {
          allPlayers.push({
            player: {
              name: l.name,
              position: l.position,
              speed: 68,
              strength: 78,
              agility: 67,
              awareness: 65,
              archetype: l.archetype,
              college: l.college,
              age: 23,
            },
            teamKey: l.teamId,
            teamName: l.teamName,
          });
        });

        const chosen = allPlayers[Math.floor(Math.random() * allPlayers.length)];
        const ovr = 65;
        const tier = getCardTier(ovr);
        pulledCard = {
          id: `colts-backup-65-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
          name: chosen.player.name,
          position: chosen.player.position,
          ovr,
          teamId: chosen.teamKey,
          teamName: chosen.teamName,
          speed: chosen.player.speed,
          strength: chosen.player.strength,
          agility: chosen.player.agility,
          awareness: chosen.player.awareness,
          archetype: chosen.player.archetype,
          college: chosen.player.college,
          age: chosen.player.age,
          tier,
          acquiredAt: Date.now(),
        };
      }

      pulledCards.push(pulledCard);
    }

    const packName = 'Colts Legends Pack';
    const updatedUserData: ClashUserData = {
      ...userData,
      gridIrons: userData.gridIrons - 10,
      roster: [...pulledCards, ...userData.roster],
      transactions: [
        {
          id: `tx-pack-${Date.now()}`,
          type: 'buy',
          description: `Opened ${packName} (10 Players - Best: ${pulledCards.reduce((best, c) => c.ovr > best.ovr ? c : best, pulledCards[0]).name} ${pulledCards.reduce((best, c) => c.ovr > best.ovr ? c : best, pulledCards[0]).ovr} OVR)`,
          cardName: packName,
          amount: 10,
          timestamp: Date.now(),
        },
        ...userData.transactions,
      ],
    };

    saveClashUserData(updatedUserData);
    return { updatedUserData, pulledCards };
  }

  // Dedicated Essentials Pack (Featuring ALL Wave 1 & Wave 2 89 OVR Bosses, 75 OVR starters, 65 OVR backups)
  if (packType === 'essentials') {
    const allBossTeams = ALL_89_AI_BOSSES;
    const allBossNames = allBossTeams.map((bt) => bt.starPlayer.name.toLowerCase());

    for (let i = 0; i < 10; i++) {
      const roll = Math.random();
      let pulledCard: ClashCard;

      // Generous 5% base chance per card, elevated to 12% on the 10th featured card
      const bossThreshold = i === 9 ? 0.12 : 0.05;

      if (roll < bossThreshold) {
        // Generous chance for Andrew Luck or Wave 1 & Wave 2 89 AI Bosses
        const luckSpecialRoll = Math.random();
        if (luckSpecialRoll < 0.08) {
          // 89 OVR Andrew Luck (Featured Legend Summon in Essentials)
          pulledCard = {
            id: `andrew-luck-89-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
            name: 'Andrew Luck',
            position: 'QB',
            ovr: 89,
            teamId: 'IND',
            teamName: 'Indianapolis Colts',
            speed: 89,
            strength: 89,
            agility: 88,
            awareness: 94,
            archetype: 'Gunslinger Commander',
            college: 'Stanford',
            age: 27,
            tier: getCardTier(89),
            abilityTitle: 'Game Breaker',
            abilityName: 'Composure',
            abilityDescription: 'He can never be sacked. Every sack attempt is instead a completion or a safe throw away.',
            acquiredAt: Date.now(),
          };
        } else {
          // Pull random 89 Boss from Wave 1 or Wave 2 (includes 89 Travis Kelce)
          const bossTeam = allBossTeams[Math.floor(Math.random() * allBossTeams.length)];
          const star = bossTeam.starPlayer;
          const rosterPlayers = AUTHENTIC_TEAM_ROSTERS[bossTeam.teamId] || [];
          const authenticDef = rosterPlayers.find((p) => p.name.toLowerCase() === star.name.toLowerCase());
          const nflTeam = NFL_TEAMS.find((t) => t.id.toLowerCase() === bossTeam.teamId.toLowerCase());
          const officialTeamName = nflTeam ? `${nflTeam.city} ${nflTeam.name}` : `${bossTeam.city} ${bossTeam.name}`;
          const isKelce = star.name.toLowerCase().includes('kelce');

          pulledCard = {
            id: `boss-89-${bossTeam.teamId}-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            name: star.name,
            position: star.position,
            ovr: 89,
            teamId: bossTeam.teamId,
            teamName: officialTeamName,
            speed: authenticDef?.speed || 89,
            strength: authenticDef?.strength || 89,
            agility: authenticDef?.agility || 89,
            awareness: authenticDef?.awareness || 89,
            archetype: star.archetype,
            college: authenticDef?.college || 'Elite Academy',
            age: authenticDef?.age || 25,
            tier: getCardTier(89),
            acquiredAt: Date.now(),
            ...(isKelce ? {
              abilityTitle: 'Game Breaker',
              abilityName: 'Jump Ball',
              abilityDescription: 'He has a 75% chance to catch a lob pass if the QB who throws the ball is any Patrick Mahomes card.',
            } : {})
          };
        }
      } else if (roll < 0.25) {
        // 75 OVR Starters (Non-Bosses)
        const allPlayers: { player: AuthenticPlayerDef; teamKey: string; teamName: string }[] = [];
        Object.entries(AUTHENTIC_TEAM_ROSTERS).forEach(([tKey, roster]) => {
          const teamObj = NFL_TEAMS.find((t) => t.id === tKey);
          const tName = teamObj ? `${teamObj.city} ${teamObj.name}` : tKey;
          
          roster.forEach((p) => {
            if (p.ovr >= 72 && p.ovr <= 78 && !allBossNames.includes(p.name.toLowerCase())) {
              allPlayers.push({ player: p, teamKey: tKey, teamName: tName });
            }
          });
        });
        const chosen = allPlayers[Math.floor(Math.random() * allPlayers.length)];
        pulledCard = {
          id: `ess-75-${Date.now()}-${i}`,
          name: chosen.player.name,
          position: chosen.player.position as ClashPosition,
          ovr: 75,
          teamId: chosen.teamKey,
          teamName: chosen.teamName,
          speed: chosen.player.speed,
          strength: chosen.player.strength,
          agility: chosen.player.agility,
          awareness: chosen.player.awareness,
          archetype: chosen.player.archetype,
          college: chosen.player.college,
          age: chosen.player.age,
          tier: getCardTier(75),
          acquiredAt: Date.now(),
        };
      } else {
        // 65 OVR Backups
        const allBackups: { player: AuthenticPlayerDef; teamKey: string; teamName: string }[] = [];
        Object.entries(AUTHENTIC_TEAM_ROSTERS).forEach(([tKey, roster]) => {
          const teamObj = NFL_TEAMS.find((t) => t.id === tKey);
          const tName = teamObj ? `${teamObj.city} ${teamObj.name}` : tKey;
          roster.forEach((p) => {
            if (p.ovr < 72) {
              allBackups.push({ player: p, teamKey: tKey, teamName: tName });
            }
          });
        });
        const chosen = allBackups[Math.floor(Math.random() * allBackups.length)];
        pulledCard = {
          id: `ess-65-${Date.now()}-${i}`,
          name: chosen.player.name,
          position: chosen.player.position as ClashPosition,
          ovr: 65,
          teamId: chosen.teamKey,
          teamName: chosen.teamName,
          speed: chosen.player.speed,
          strength: chosen.player.strength,
          agility: chosen.player.agility,
          awareness: chosen.player.awareness,
          archetype: chosen.player.archetype,
          college: chosen.player.college,
          age: chosen.player.age,
          tier: getCardTier(65),
          acquiredAt: Date.now(),
        };
      }
      pulledCards.push(pulledCard);
    }
    const updatedUserData: ClashUserData = {
      ...userData,
      gridIrons: userData.gridIrons - 5,
      roster: [...pulledCards, ...userData.roster],
      transactions: [{
        id: `tx-pack-${Date.now()}`,
        type: 'buy',
        description: `Opened Essentials Pack (10 Players)`,
        cardName: 'Essentials Pack',
        amount: 5,
        timestamp: Date.now(),
      }, ...userData.transactions],
    };
    saveClashUserData(updatedUserData);
    return { updatedUserData, pulledCards };
  }

  // Dedicated 2010s Kansas City Dynasty Pack
  if (packType === 'kc_dynasty') {
    const kcRoster = AUTHENTIC_TEAM_ROSTERS['KC'] || [];
    for (let i = 0; i < 10; i++) {
      const roll = Math.random();
      let pulledCard: ClashCard;

      if (roll < 0.05) { // 5% chance for a legend pull
        const legendRoll = Math.random();
        if (legendRoll < 0.33) {
          // Tyreek Hill 95 OVR
          pulledCard = {
            id: `tyreek-95-${Date.now()}-${i}`,
            name: 'Tyreek Hill',
            position: 'WR',
            ovr: 95,
            teamId: 'KC',
            teamName: 'Kansas City Chiefs',
            speed: 99,
            strength: 78,
            agility: 99,
            awareness: 94,
            archetype: 'Rocket Burner',
            college: 'West Alabama',
            age: 25,
            tier: getCardTier(95),
            abilityTitle: 'Game Breaker',
            abilityName: 'Too Fast!',
            abilityDescription: 'Grants Tyreek a 75% chance to take a stride pass to the endzone if the last throw before the throw to him was an interception.',
            acquiredAt: Date.now(),
          };
        } else if (legendRoll < 0.66) {
          // Travis Kelce 90 OVR
          pulledCard = {
            id: `kelce-90-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
            name: 'Travis Kelce',
            position: 'TE',
            ovr: 90,
            teamId: 'KC',
            teamName: 'Kansas City Chiefs',
            speed: 88,
            strength: 86,
            agility: 91,
            awareness: 98,
            archetype: 'Elite Receiver TE',
            college: 'Cincinnati',
            age: 30,
            tier: getCardTier(90),
            abilityTitle: 'Game Breaker',
            abilityName: 'Jump Ball',
            abilityDescription: 'He has a 75% chance to catch a lob pass if the QB who throws the ball is any Patrick Mahomes card.',
            acquiredAt: Date.now(),
          };
        } else {
          // Chris Jones 90 OVR
          pulledCard = {
            id: `cjones-90-${Date.now()}-${i}`,
            name: 'Chris Jones',
            position: 'DT',
            ovr: 90,
            teamId: 'KC',
            teamName: 'Kansas City Chiefs',
            speed: 82,
            strength: 99,
            agility: 80,
            awareness: 95,
            archetype: 'Interior Disruptor',
            college: 'Mississippi State',
            age: 26,
            tier: getCardTier(90),
            abilityTitle: 'Game Breaker',
            abilityName: 'Double Me',
            abilityDescription: 'When he is double teamed by the o-line he has a 4x chance to break through and sack the QB or stuff the run.',
            acquiredAt: Date.now(),
          };
        }
      } else if (roll < 0.4) {
        // 75 OVR Chiefs (Exclude Mahomes)
        const kc75 = kcRoster.filter(p => p.ovr >= 70 && p.ovr <= 85 && p.name !== 'Patrick Mahomes');
        const chosen = kc75.length > 0 ? kc75[Math.floor(Math.random() * kc75.length)] : kcRoster[0];
        pulledCard = {
          id: `kc-75-${Date.now()}-${i}`,
          name: chosen.name,
          position: chosen.position as ClashPosition,
          ovr: 75,
          teamId: 'KC',
          teamName: 'Kansas City Chiefs',
          speed: chosen.speed,
          strength: chosen.strength,
          agility: chosen.agility,
          awareness: chosen.awareness,
          archetype: chosen.archetype,
          college: chosen.college,
          age: chosen.age,
          tier: getCardTier(75),
          acquiredAt: Date.now(),
        };
      } else {
        // 65 OVR Chiefs Backups
        const kc65 = kcRoster.filter(p => p.ovr < 70);
        const chosen = kc65.length > 0 ? kc65[Math.floor(Math.random() * kc65.length)] : kcRoster[Math.floor(Math.random() * kcRoster.length)];
        pulledCard = {
          id: `kc-65-${Date.now()}-${i}`,
          name: chosen.name,
          position: chosen.position as ClashPosition,
          ovr: 65,
          teamId: 'KC',
          teamName: 'Kansas City Chiefs',
          speed: chosen.speed,
          strength: chosen.strength,
          agility: chosen.agility,
          awareness: chosen.awareness,
          archetype: chosen.archetype,
          college: chosen.college,
          age: chosen.age,
          tier: getCardTier(65),
          acquiredAt: Date.now(),
        };
      }
      pulledCards.push(pulledCard);
    }
    const updatedUserData: ClashUserData = {
      ...userData,
      gridIrons: userData.gridIrons - 10,
      roster: [...pulledCards, ...userData.roster],
      transactions: [{
        id: `tx-pack-${Date.now()}`,
        type: 'buy',
        description: `Opened 2010s Kansas City Dynasty Pack (10 Players)`,
        cardName: 'KC Dynasty Pack',
        amount: 10,
        timestamp: Date.now(),
      }, ...userData.transactions],
    };
    saveClashUserData(updatedUserData);
    return { updatedUserData, pulledCards };
  }

  // Dedicated Seattle Pack handler (Only Seattle Seahawks players, featuring 99 JSN & 85 Sam Darnold)
  if (packType === 'seattle') {
    const seaRoster = AUTHENTIC_TEAM_ROSTERS['SEA'] || [];

    for (let i = 0; i < 10; i++) {
      const roll = Math.random();
      let pulledCard: ClashCard;

      if (roll < 0.025) {
        // 99 OVR Jaxon Smith-Njigba (Diamond Game Breaker)
        pulledCard = {
          id: `jsn-99-${Date.now()}-${i}`,
          name: 'Jaxon Smith-Njigba',
          position: 'WR',
          ovr: 99,
          teamId: 'SEA',
          teamName: 'Seattle Seahawks',
          speed: 98,
          strength: 84,
          agility: 99,
          awareness: 99,
          archetype: 'Slot Machine Shifty',
          college: 'Ohio State',
          age: 22,
          tier: getCardTier(99),
          abilityTitle: 'Game Breaker',
          abilityName: 'Emerald City Route Artist',
          abilityDescription: 'If JSN catches a pass over 10 yards, he has a 60 percent chance to be completly wide open next play.',
          acquiredAt: Date.now(),
        };
      } else if (roll < 0.15) {
        // 85 OVR QB Sam Darnold
        pulledCard = {
          id: `sam-darnold-85-${Date.now()}-${i}`,
          name: 'Sam Darnold',
          position: 'QB',
          ovr: 85,
          teamId: 'SEA',
          teamName: 'Seattle Seahawks',
          speed: 83,
          strength: 82,
          agility: 84,
          awareness: 87,
          archetype: 'Deep Cannon Arm',
          college: 'USC',
          age: 27,
          tier: getCardTier(85),
          acquiredAt: Date.now(),
        };
      } else if (roll < 0.45) {
        // Seattle Starter Players (75 OVR: DK Metcalf, Kenneth Walker III, Devon Witherspoon, Leonard Williams, Charles Cross, etc.)
        const topSea = seaRoster.filter((p) => p.name !== 'Jaxon Smith-Njigba' && p.name !== 'Sam Darnold');
        const chosen = topSea.length > 0 ? topSea[Math.floor(Math.random() * topSea.length)] : seaRoster[0];
        const ovr = 75;
        const tier = getCardTier(ovr);
        pulledCard = {
          id: `sea-starter-75-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
          name: chosen.name,
          position: chosen.position as ClashPosition,
          ovr,
          teamId: 'SEA',
          teamName: 'Seattle Seahawks',
          speed: chosen.speed,
          strength: chosen.strength,
          agility: chosen.agility,
          awareness: chosen.awareness,
          archetype: chosen.archetype,
          college: chosen.college,
          age: chosen.age,
          tier,
          acquiredAt: Date.now(),
        };
      } else {
        // Seattle Backup Players (65 OVR)
        const seaDepth = seaRoster.filter((p) => p.ovr < 86 && p.name !== 'Jaxon Smith-Njigba' && p.name !== 'Sam Darnold');
        const chosen = seaDepth.length > 0 ? seaDepth[Math.floor(Math.random() * seaDepth.length)] : seaRoster[Math.floor(Math.random() * seaRoster.length)];
        const ovr = 65;
        const tier = getCardTier(ovr);
        pulledCard = {
          id: `sea-backup-65-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
          name: chosen.name,
          position: chosen.position as ClashPosition,
          ovr,
          teamId: 'SEA',
          teamName: 'Seattle Seahawks',
          speed: chosen.speed,
          strength: chosen.strength,
          agility: chosen.agility,
          awareness: chosen.awareness,
          archetype: chosen.archetype,
          college: chosen.college,
          age: chosen.age,
          tier,
          acquiredAt: Date.now(),
        };
      }

      pulledCards.push(pulledCard);
    }

    const packName = 'Seattle Pack';
    const updatedUserData: ClashUserData = {
      ...userData,
      gridIrons: userData.gridIrons - 10,
      roster: [...pulledCards, ...userData.roster],
      transactions: [
        {
          id: `tx-pack-${Date.now()}`,
          type: 'buy',
          description: `Opened ${packName} (10 Seahawks - Best: ${pulledCards.reduce((best, c) => c.ovr > best.ovr ? c : best, pulledCards[0]).name} ${pulledCards.reduce((best, c) => c.ovr > best.ovr ? c : best, pulledCards[0]).ovr} OVR)`,
          cardName: packName,
          amount: 10,
          timestamp: Date.now(),
        },
        ...userData.transactions,
      ],
    };

    saveClashUserData(updatedUserData);
    return { updatedUserData, pulledCards };
  }

  // Standard Wayne Garrett and Cam Newton Packs
  for (let i = 0; i < 10; i++) {
    const roll = Math.random();
    let pulledCard: ClashCard;

    if (roll < 0.025) {
      if (packType === 'cam_newton') {
        // Cam Newton Card (Diamond 99 OVR, Game Breaker: Ignore the odds)
        pulledCard = {
          id: `cam-newton-${Date.now()}-${i}`,
          name: 'Cam Newton',
          position: 'QB',
          ovr: 99,
          teamId: 'CAR',
          teamName: 'Newton Legends',
          speed: 98,
          strength: 99,
          agility: 97,
          awareness: 99,
          archetype: 'Dual-Threat Bulldozer',
          college: 'Auburn',
          age: 26,
          tier: getCardTier(99),
          abilityTitle: 'Game Breaker',
          abilityName: 'Ignore the odds',
          abilityDescription: 'After throwing for a 30+ yard play, his next pass has a 100% chance to do the big play.',
          acquiredAt: Date.now(),
        };
      } else {
        // Wayne Garrett Card (Diamond 99 OVR, Game Breaker: Home Wrecker)
        pulledCard = {
          id: `wayne-garrett-${Date.now()}-${i}`,
          name: 'Wayne Garrett',
          position: 'RB',
          ovr: 99,
          teamId: 'WGN',
          teamName: 'Garrett Legends',
          speed: 99,
          strength: 99,
          agility: 99,
          awareness: 99,
          archetype: 'Power Bruiser',
          college: 'Auburn',
          age: 26,
          tier: getCardTier(99),
          abilityTitle: 'Game Breaker',
          abilityName: 'Home Wrecker',
          abilityDescription: 'For power runs, the chance for a big play doubles.',
          acquiredAt: Date.now(),
        };
      }
    } else if (roll < 0.225) {
      // 75 OVR lesser star (including OL & DL) (20% chance)
      const allPlayers: { player: { name: string; position: ClashPosition; speed: number; strength: number; agility: number; awareness: number; archetype: string; college: string; age: number }; teamKey: string; teamName: string }[] = [];
      
      // Add authentic roster players around 75 OVR
      Object.entries(AUTHENTIC_TEAM_ROSTERS).forEach(([tKey, roster]) => {
        const teamObj = NFL_TEAMS.find((t) => t.id.toLowerCase() === tKey.toLowerCase());
        const tName = teamObj ? teamObj.name : tKey;
        roster.forEach((p) => {
          if (p.ovr >= 72 && p.ovr <= 78) {
            allPlayers.push({
              player: {
                name: p.name,
                position: p.position as ClashPosition,
                speed: p.speed,
                strength: p.strength,
                agility: p.agility,
                awareness: p.awareness,
                archetype: p.archetype,
                college: p.college,
                age: p.age,
              },
              teamKey: tKey,
              teamName: tName,
            });
          }
        });
      });

      // Add guaranteed offensive & defensive linemen to the 75 OVR pool
      BONUS_LINEMEN_75.forEach((l) => {
        allPlayers.push({
          player: {
            name: l.name,
            position: l.position,
            speed: 74,
            strength: 88,
            agility: 75,
            awareness: 76,
            archetype: l.archetype,
            college: l.college,
            age: 26,
          },
          teamKey: l.teamId,
          teamName: l.teamName,
        });
      });

      const chosen = allPlayers[Math.floor(Math.random() * allPlayers.length)];
      const tier = getCardTier(75);
      pulledCard = {
        id: `pack-75-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
        name: chosen.player.name,
        position: chosen.player.position,
        ovr: 75,
        teamId: chosen.teamKey,
        teamName: chosen.teamName,
        speed: chosen.player.speed,
        strength: chosen.player.strength,
        agility: chosen.player.agility,
        awareness: chosen.player.awareness,
        archetype: chosen.player.archetype,
        college: chosen.player.college,
        age: chosen.player.age,
        tier,
        acquiredAt: Date.now(),
      };
    } else {
      // 65 OVR backup player (including OL & DL) (77.5% chance)
      const allPlayers: { player: { name: string; position: ClashPosition; speed: number; strength: number; agility: number; awareness: number; archetype: string; college: string; age: number }; teamKey: string; teamName: string }[] = [];
      
      Object.entries(AUTHENTIC_TEAM_ROSTERS).forEach(([tKey, roster]) => {
        const teamObj = NFL_TEAMS.find((t) => t.id.toLowerCase() === tKey.toLowerCase());
        const tName = teamObj ? teamObj.name : tKey;
        roster.forEach((p) => {
          if (p.ovr < 72) {
            allPlayers.push({
              player: {
                name: p.name,
                position: p.position as ClashPosition,
                speed: p.speed,
                strength: p.strength,
                agility: p.agility,
                awareness: p.awareness,
                archetype: p.archetype,
                college: p.college,
                age: p.age,
              },
              teamKey: tKey,
              teamName: tName,
            });
          }
        });
      });

      // Add linemen to 65 OVR pool
      BONUS_LINEMEN_65.forEach((l) => {
        allPlayers.push({
          player: {
            name: l.name,
            position: l.position,
            speed: 68,
            strength: 78,
            agility: 67,
            awareness: 65,
            archetype: l.archetype,
            college: l.college,
            age: 23,
          },
          teamKey: l.teamId,
          teamName: l.teamName,
        });
      });

      const chosen = allPlayers[Math.floor(Math.random() * allPlayers.length)];
      const ovr = 65;
      const tier = getCardTier(ovr);
      pulledCard = {
        id: `pack-65-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
        name: chosen.player.name,
        position: chosen.player.position,
        ovr,
        teamId: chosen.teamKey,
        teamName: chosen.teamName,
        speed: chosen.player.speed,
        strength: chosen.player.strength,
        agility: chosen.player.agility,
        awareness: chosen.player.awareness,
        archetype: chosen.player.archetype,
        college: chosen.player.college,
        age: chosen.player.age,
        tier,
        acquiredAt: Date.now(),
      };
    }

    pulledCards.push(pulledCard);
  }

  const packName = 
    packType === 'cam_newton' ? 'Cam Newton Game Breaker Pack' : 
    packType === 'wayne_garrett' ? 'Wayne Garrett Legends Pack' : 
    packType === 'essentials' ? 'Essentials Pack' : 
    packType === 'kc_dynasty' ? '2010s Kansas City Dynasty Pack' : 
    packType === 'sf_hofers' ? 'San Fran Future HoFers Pack' : 
    'Premium Pack';
  const updatedUserData: ClashUserData = {
    ...userData,
    gridIrons: userData.gridIrons - 10,
    roster: [...pulledCards, ...userData.roster],
    transactions: [
      {
        id: `tx-pack-${Date.now()}`,
        type: 'buy',
        description: `Opened ${packName} (10 Players - Best: ${pulledCards.reduce((best, c) => c.ovr > best.ovr ? c : best, pulledCards[0]).name} ${pulledCards.reduce((best, c) => c.ovr > best.ovr ? c : best, pulledCards[0]).ovr} OVR)`,
        cardName: packName,
        amount: 10,
        timestamp: Date.now(),
      },
      ...userData.transactions,
    ],
  };

  saveClashUserData(updatedUserData);
  return { updatedUserData, pulledCards };
}

// Redeem locker codes to credit Grid Irons for computer save testing
export function redeemLockerCode(data: ClashUserData, rawCode: string): { success: boolean; message: string; updatedData?: ClashUserData } {
  const code = (rawCode || '').trim().toUpperCase();
  const valid2000Codes = ['GRIDIRON2000', 'SECRET2000', 'SUPERBOWL2000', 'CAM99', 'TEST2000', 'WAYNE99', '2000GI', 'BOOST2000', 'COMPUTER2000', 'TESTGI'];
  
  if (valid2000Codes.includes(code)) {
    const newBalance = (data.gridIrons || 0) + 2000;
    const tx: ClashTransaction = {
      id: `tx-code-${Date.now()}`,
      type: 'buy',
      description: `Redeemed Locker Code [${code}] (+2,000 Grid Irons)`,
      cardName: 'Locker Code Reward',
      amount: -2000,
      timestamp: Date.now(),
    };
    const updated: ClashUserData = {
      ...data,
      gridIrons: newBalance,
      transactions: [tx, ...data.transactions],
    };
    saveClashUserData(updated);
    return {
      success: true,
      message: `🎉 Success! Code '${code}' redeemed. +2,000 Grid Irons added to your account!`,
      updatedData: updated,
    };
  }

  return {
    success: false,
    message: `Invalid code. Try using 'GRIDIRON2000', 'SECRET2000', or 'CAM99'.`,
  };
}
