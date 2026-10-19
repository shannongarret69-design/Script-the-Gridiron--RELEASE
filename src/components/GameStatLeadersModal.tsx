import React from 'react';
import { PlayerStats } from '../utils/statUtils';

interface GameStatLeadersModalProps {
  isOpen: boolean;
  onClose: () => void;
  homeStats: PlayerStats[];
  awayStats: PlayerStats[];
  homeTeamName: string;
  awayTeamName: string;
}

export const GameStatLeadersModal: React.FC<GameStatLeadersModalProps> = ({
  isOpen, onClose, homeStats, awayStats, homeTeamName, awayTeamName
}) => {
  if (!isOpen) return null;

  const getLeader = (stats: PlayerStats[], key: keyof PlayerStats) => {
    return stats.reduce((prev, curr) => (curr[key] as number) > (prev[key] as number) ? curr : prev, stats[0]);
  };

  const leaders = {
    home: {
      pass: getLeader(homeStats.filter(s => s.position === 'QB'), 'passingYards'),
      rush: getLeader(homeStats.filter(s => s.rushingYards > 0), 'rushingYards'),
      rec: getLeader(homeStats.filter(s => s.receivingYards > 0), 'receivingYards'),
    },
    away: {
      pass: getLeader(awayStats.filter(s => s.position === 'QB'), 'passingYards'),
      rush: getLeader(awayStats.filter(s => s.rushingYards > 0), 'rushingYards'),
      rec: getLeader(awayStats.filter(s => s.receivingYards > 0), 'receivingYards'),
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full">
        <h2 className="text-2xl font-black text-white mb-4">Stat Leaders</h2>
        <div className="grid grid-cols-2 gap-4">
            <div><h3 className="text-lg text-amber-400 font-bold">{homeTeamName}</h3>
            <p className="text-sm text-slate-300">Passing: {leaders.home.pass ? `${leaders.home.pass.playerName} (${leaders.home.pass.passingYards} yds)` : 'N/A'}</p>
            <p className="text-sm text-slate-300">Rushing: {leaders.home.rush ? `${leaders.home.rush.playerName} (${leaders.home.rush.rushingYards} yds)` : 'N/A'}</p>
            <p className="text-sm text-slate-300">Receiving: {leaders.home.rec ? `${leaders.home.rec.playerName} (${leaders.home.rec.receivingYards} yds)` : 'N/A'}</p>
            </div>
            <div><h3 className="text-lg text-amber-400 font-bold">{awayTeamName}</h3>
            <p className="text-sm text-slate-300">Passing: {leaders.away.pass ? `${leaders.away.pass.playerName} (${leaders.away.pass.passingYards} yds)` : 'N/A'}</p>
            <p className="text-sm text-slate-300">Rushing: {leaders.away.rush ? `${leaders.away.rush.playerName} (${leaders.away.rush.rushingYards} yds)` : 'N/A'}</p>
            <p className="text-sm text-slate-300">Receiving: {leaders.away.rec ? `${leaders.away.rec.playerName} (${leaders.away.rec.receivingYards} yds)` : 'N/A'}</p>
            </div>
        </div>
        <button onClick={onClose} className="mt-6 w-full py-2 bg-slate-700 text-white rounded-lg">Close</button>
      </div>
    </div>
  );
};
