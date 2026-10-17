export interface InjuryEvent {
  id: string;
  playerName: string;
  playerPosition: string;
  teamId: string;
  teamAbbr: string;
  teamName: string;
  injuryType: string;
  severity: 'Questionable' | 'Doubtful' | 'Out (Game)' | 'Injured Reserve (Season)';
  durationWeeks?: number;
  timestamp: number;
  announcementText: string;
  isCustomAnnouncement?: boolean;
}
