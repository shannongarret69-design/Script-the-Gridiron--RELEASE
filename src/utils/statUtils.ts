import { DrivePlay } from '../types/game';
import { FranchisePlayer } from '../types/franchise';
import { DEFAULT_PLAYS } from '../data/defaultPlays';

export interface PlayerStats {
  playerName: string;
  position: string;
  teamId: string;
  passingYards: number;
  rushingYards: number;
  receivingYards: number;
}

export function calculatePlayerStats(
  playLog: DrivePlay[],
  homeRoster: FranchisePlayer[],
  awayRoster: FranchisePlayer[],
  homeTeamId: string,
  awayTeamId: string
): { home: PlayerStats[]; away: PlayerStats[] } {
  const statsMap: Record<string, PlayerStats> = {};

  const getPlayCategory = (playName: string): string => {
    const play = DEFAULT_PLAYS.find(p => p.name === playName);
    return play ? play.category : '';
  };

  playLog.forEach(play => {
    if (!play.result.keyPlayer) return;

    const playerName = play.result.keyPlayer;
    const teamId = play.offenseTeamId || '';
    const roster = teamId === homeTeamId ? homeRoster : awayRoster;
    const player = roster.find(p => p.name === playerName || p.name.includes(playerName) || playerName.includes(p.name));
    
    if (!player) return;

    const key = `${player.id}-${teamId}`;
    if (!statsMap[key]) {
      statsMap[key] = {
        playerName: player.name,
        position: player.position,
        teamId: teamId,
        passingYards: 0,
        rushingYards: 0,
        receivingYards: 0,
      };
    }

    const category = getPlayCategory(play.offensePlay);
    const isPass = category === 'Pass' || category === 'PlayAction' || category === 'Screen';
    const isRun = category === 'Run';

    if (isPass) {
        if (play.result.outcomeType === 'Sack' || play.result.outcomeType === 'Incomplete') {
            statsMap[key].passingYards += play.result.yardsGained;
        } else if (play.result.yardsGained !== 0) {
            if (player.position === 'QB') {
                statsMap[key].passingYards += play.result.yardsGained;
            } else {
                statsMap[key].receivingYards += play.result.yardsGained;
            }
        }
    } else if (isRun && play.result.yardsGained !== 0) {
        statsMap[key].rushingYards += play.result.yardsGained;
    }
  });

  const allStats = Object.values(statsMap);
  return {
    home: allStats.filter(s => s.teamId === homeTeamId),
    away: allStats.filter(s => s.teamId === awayTeamId),
  };
}
