import { NFLTeam } from '../types/game';
import { InjuryEvent } from '../types/injuries';

const INJURY_KEYWORDS = [
  'injury',
  'injured',
  'hurt',
  'sprain',
  'strain',
  'torn',
  'tear',
  'broken',
  'fracture',
  'concussion',
  'carted off',
  'limping',
  'out for',
  'questionable',
  'doubtful',
  'ir',
  'injured reserve',
  'hamstring',
  'ankle',
  'knee',
  'shoulder',
  'achilles',
  'quad',
  'groin',
  'collarbone',
  'ribs',
  'acl',
  'mcl',
  'turf toe',
  'pectoral',
  'bicep',
];

const INJURY_TYPES = [
  { match: /acl|mcl|knee/i, name: 'Knee (ACL/MCL)', severity: 'Out (Game)', weeks: 8 },
  { match: /ankle|sprained ankle/i, name: 'High Ankle Sprain', severity: 'Questionable', weeks: 2 },
  { match: /hamstring/i, name: 'Hamstring Strain', severity: 'Doubtful', weeks: 3 },
  { match: /concussion|protocol/i, name: 'Concussion Protocol', severity: 'Out (Game)', weeks: 1 },
  { match: /shoulder|collarbone/i, name: 'Shoulder Subluxation', severity: 'Doubtful', weeks: 4 },
  { match: /achilles/i, name: 'Torn Achilles', severity: 'Injured Reserve (Season)', weeks: 16 },
  { match: /rib|ribs/i, name: 'Fractured Ribs', severity: 'Questionable', weeks: 2 },
  { match: /quad|groin/i, name: 'Groin/Quad Strain', severity: 'Questionable', weeks: 2 },
  { match: /wrist|hand|thumb|finger/i, name: 'Thumb/Hand Sprain', severity: 'Questionable', weeks: 1 },
  { match: /turf toe|foot/i, name: 'Turf Toe', severity: 'Questionable', weeks: 3 },
];

/**
 * Checks whether custom announcement or script text explicitly requests an injury.
 * Returns an InjuryEvent object if triggered, or null if no injury is requested.
 */
export function parseCustomAnnouncementForInjury(
  text: string,
  homeTeam: NFLTeam,
  awayTeam: NFLTeam,
  currentPossession: 'home' | 'away' = 'home'
): InjuryEvent | null {
  if (!text || typeof text !== 'string') return null;

  const lower = text.toLowerCase().trim();
  if (lower.length === 0) return null;

  // Must match at least one injury keyword
  const hasKeyword = INJURY_KEYWORDS.some((kw) => lower.includes(kw));
  if (!hasKeyword) return null;

  const possTeam = currentPossession === 'home' ? homeTeam : awayTeam;
  const defTeam = currentPossession === 'home' ? awayTeam : homeTeam;

  // Determine target team and player
  let targetTeam = possTeam;
  let playerName = possTeam.starQB;
  let playerPos = 'QB';

  // Check if specifically mentioning away or home team
  if (
    lower.includes(awayTeam.name.toLowerCase()) ||
    lower.includes(awayTeam.city.toLowerCase()) ||
    lower.includes(awayTeam.abbr.toLowerCase())
  ) {
    targetTeam = awayTeam;
  } else if (
    lower.includes(homeTeam.name.toLowerCase()) ||
    lower.includes(homeTeam.city.toLowerCase()) ||
    lower.includes(homeTeam.abbr.toLowerCase())
  ) {
    targetTeam = homeTeam;
  }

  // Check if a specific player name is in text
  const allStars = [
    { name: targetTeam.starQB, pos: 'QB' },
    { name: targetTeam.starRB, pos: 'RB' },
    { name: targetTeam.starWR, pos: 'WR' },
    { name: targetTeam.starDef, pos: 'LB' },
    { name: defTeam.starQB, pos: 'QB', team: defTeam },
    { name: defTeam.starRB, pos: 'RB', team: defTeam },
    { name: defTeam.starWR, pos: 'WR', team: defTeam },
    { name: defTeam.starDef, pos: 'LB', team: defTeam },
  ];

  let matchedPlayer = allStars.find((p) => lower.includes(p.name.toLowerCase()));

  if (matchedPlayer) {
    playerName = matchedPlayer.name;
    playerPos = matchedPlayer.pos;
    if (matchedPlayer.team) targetTeam = matchedPlayer.team;
  } else {
    // Check by position keywords
    if (lower.includes('qb') || lower.includes('quarterback')) {
      playerName = targetTeam.starQB;
      playerPos = 'QB';
    } else if (lower.includes('rb') || lower.includes('running back') || lower.includes('halfback')) {
      playerName = targetTeam.starRB;
      playerPos = 'RB';
    } else if (lower.includes('wr') || lower.includes('wide receiver') || lower.includes('receiver')) {
      playerName = targetTeam.starWR;
      playerPos = 'WR';
    } else if (lower.includes('te') || lower.includes('tight end')) {
      playerName = `${targetTeam.city} Starting TE`;
      playerPos = 'TE';
    } else if (lower.includes('def') || lower.includes('linebacker') || lower.includes('corner') || lower.includes('safety') || lower.includes('lb') || lower.includes('cb')) {
      playerName = targetTeam.starDef;
      playerPos = 'LB';
    }
  }

  // Extract explicit player name if pattern like "Injury: [Player Name] [details]" or "[Name] is injured"
  const colonMatch = text.match(/injury\s*:\s*([a-zA-Z'\-.\s]+?)(?:\s+(?:is|has|with|to|out|ankle|knee|doubtful|questionable)|$)/i);
  if (colonMatch && colonMatch[1].trim().length > 2) {
    const rawName = colonMatch[1].trim();
    if (!['qb', 'rb', 'wr', 'te', 'def'].includes(rawName.toLowerCase())) {
      playerName = rawName;
    }
  }

  // Determine injury type
  let injuryType = 'Undisclosed Injury';
  let severity: InjuryEvent['severity'] = 'Questionable';
  let durationWeeks = 1;

  for (const it of INJURY_TYPES) {
    if (it.match.test(lower)) {
      injuryType = it.name;
      severity = it.severity as any;
      durationWeeks = it.weeks;
      break;
    }
  }

  // Severity overrides based on explicit words
  if (lower.includes('season') || lower.includes('ir') || lower.includes('carted off') || lower.includes('torn achilles')) {
    severity = 'Injured Reserve (Season)';
    durationWeeks = 16;
  } else if (lower.includes('out') || lower.includes('ruled out') || lower.includes('locker room')) {
    severity = 'Out (Game)';
    durationWeeks = Math.max(durationWeeks, 1);
  } else if (lower.includes('doubtful')) {
    severity = 'Doubtful';
  } else if (lower.includes('questionable') || lower.includes('probable') || lower.includes('evaluating')) {
    severity = 'Questionable';
  }

  return {
    id: `injury-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    playerName,
    playerPosition: playerPos,
    teamId: targetTeam.id,
    teamAbbr: targetTeam.abbr,
    teamName: targetTeam.name,
    injuryType,
    severity,
    durationWeeks,
    timestamp: Date.now(),
    announcementText: text.trim(),
    isCustomAnnouncement: true,
  };
}
