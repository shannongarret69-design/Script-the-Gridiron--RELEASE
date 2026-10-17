import React, { useState } from 'react';
import {
  NFLTeam,
  PlayoffBracket,
  PlayoffMatchup,
  TeamStanding,
  Conference,
} from '../types/game';
import { FranchiseSeasonState } from '../types/franchise';
import { getTeamById, NFL_TEAMS } from '../data/teams';
import { getConferencePlayoffSeeds, generatePlayoffBracket } from '../utils/seasonEngine';
import {
  Trophy,
  Play,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Award,
} from 'lucide-react';

interface PlayoffBracketViewProps {
  season: FranchiseSeasonState;
  onPlayGame?: (
    homeTeam: NFLTeam,
    awayTeam: NFLTeam,
    week: number,
    isPlayoff: boolean,
    round: string
  ) => void;
  onSimulatePlayoffRound?: () => void;
  onSimulateToPlayoffs?: () => void;
}

export const PlayoffBracketView: React.FC<PlayoffBracketViewProps> = ({
  season,
  onPlayGame,
  onSimulatePlayoffRound,
  onSimulateToPlayoffs,
}) => {
  const [activeTab, setActiveTab] = useState<'tree' | 'afc' | 'nfc' | 'sb'>('tree');
  const isPostseason = season.playoffs !== undefined;

  // Let's fetch the actual playoff bracket or dynamically generate a projected one!
  const getBracketData = (): {
    bracket: PlayoffBracket;
    isProjected: boolean;
    afcSeeds: { team: NFLTeam; standing: TeamStanding; seed: number }[];
    nfcSeeds: { team: NFLTeam; standing: TeamStanding; seed: number }[];
  } => {
    const afcSeeds = getConferencePlayoffSeeds('AFC', season.standings);
    const nfcSeeds = getConferencePlayoffSeeds('NFC', season.standings);

    if (season.playoffs) {
      return {
        bracket: season.playoffs,
        isProjected: false,
        afcSeeds,
        nfcSeeds,
      };
    }

    // Generate projected bracket
    const baseBracket = generatePlayoffBracket(season.standings, season.userTeamId);
    const projectedBracket: PlayoffBracket = {
      ...baseBracket,
      divisional: [],
      conference: [],
      superBowl: {
        id: 'sb-final-proj',
        round: 'SuperBowl',
        homeTeamId: '',
        awayTeamId: '',
        isPlayed: false,
      },
    };

    // Project Wild Card winners
    const getProjectedWinnerId = (m: PlayoffMatchup) => {
      const home = getTeamById(m.homeTeamId);
      const away = getTeamById(m.awayTeamId);
      const hSeed = m.homeSeed || 7;
      const aSeed = m.awaySeed || 7;
      if (hSeed < aSeed) return m.homeTeamId;
      if (aSeed < hSeed) return m.awayTeamId;
      return home.ovr >= away.ovr ? m.homeTeamId : m.awayTeamId;
    };

    const afcWcWinners = projectedBracket.wildCard
      .filter((m) => m.conference === 'AFC')
      .map((m) => getProjectedWinnerId(m));
    const nfcWcWinners = projectedBracket.wildCard
      .filter((m) => m.conference === 'NFC')
      .map((m) => getProjectedWinnerId(m));

    // AFC Divisional Projection
    const afcSeed1 = afcSeeds.find((s) => s.seed === 1)!.team.id;
    const afcSurv = [afcSeed1, ...afcWcWinners].sort((a, b) => {
      const sA = afcSeeds.find((s) => s.team.id === a)?.seed || 8;
      const sB = afcSeeds.find((s) => s.team.id === b)?.seed || 8;
      return sA - sB;
    });

    const nfcSeed1 = nfcSeeds.find((s) => s.seed === 1)!.team.id;
    const nfcSurv = [nfcSeed1, ...nfcWcWinners].sort((a, b) => {
      const sA = nfcSeeds.find((s) => s.team.id === a)?.seed || 8;
      const sB = nfcSeeds.find((s) => s.team.id === b)?.seed || 8;
      return sA - sB;
    });

    // Matchups: lowest remaining seed goes to #1
    // AFC Divisional
    const afcDiv1: PlayoffMatchup = {
      id: 'proj-div-afc-1',
      round: 'Divisional',
      conference: 'AFC',
      homeTeamId: afcSurv[0],
      awayTeamId: afcSurv[3],
      homeSeed: afcSeeds.find((s) => s.team.id === afcSurv[0])?.seed,
      awaySeed: afcSeeds.find((s) => s.team.id === afcSurv[3])?.seed,
      isPlayed: false,
    };
    const afcDiv2: PlayoffMatchup = {
      id: 'proj-div-afc-2',
      round: 'Divisional',
      conference: 'AFC',
      homeTeamId: afcSurv[1],
      awayTeamId: afcSurv[2],
      homeSeed: afcSeeds.find((s) => s.team.id === afcSurv[1])?.seed,
      awaySeed: afcSeeds.find((s) => s.team.id === afcSurv[2])?.seed,
      isPlayed: false,
    };

    // NFC Divisional
    const nfcDiv1: PlayoffMatchup = {
      id: 'proj-div-nfc-1',
      round: 'Divisional',
      conference: 'NFC',
      homeTeamId: nfcSurv[0],
      awayTeamId: nfcSurv[3],
      homeSeed: nfcSeeds.find((s) => s.team.id === nfcSurv[0])?.seed,
      awaySeed: nfcSeeds.find((s) => s.team.id === nfcSurv[3])?.seed,
      isPlayed: false,
    };
    const nfcDiv2: PlayoffMatchup = {
      id: 'proj-div-nfc-2',
      round: 'Divisional',
      conference: 'NFC',
      homeTeamId: nfcSurv[1],
      awayTeamId: nfcSurv[2],
      homeSeed: nfcSeeds.find((s) => s.team.id === nfcSurv[1])?.seed,
      awaySeed: nfcSeeds.find((s) => s.team.id === nfcSurv[2])?.seed,
      isPlayed: false,
    };

    projectedBracket.divisional = [afcDiv1, afcDiv2, nfcDiv1, nfcDiv2];

    // Project Conference winners
    const projectMatchupWinner = (m: PlayoffMatchup) => {
      const home = getTeamById(m.homeTeamId);
      const away = getTeamById(m.awayTeamId);
      const hSeed = m.homeSeed || 7;
      const aSeed = m.awaySeed || 7;
      if (hSeed < aSeed) return m.homeTeamId;
      if (aSeed < hSeed) return m.awayTeamId;
      return home.ovr >= away.ovr ? m.homeTeamId : m.awayTeamId;
    };

    const afcDiv1Winner = projectMatchupWinner(afcDiv1);
    const afcDiv2Winner = projectMatchupWinner(afcDiv2);
    const nfcDiv1Winner = projectMatchupWinner(nfcDiv1);
    const nfcDiv2Winner = projectMatchupWinner(nfcDiv2);

    const afcConf: PlayoffMatchup = {
      id: 'proj-conf-afc',
      round: 'Conference',
      conference: 'AFC',
      homeTeamId: afcSeeds.find((s) => s.team.id === afcDiv1Winner)?.seed! < afcSeeds.find((s) => s.team.id === afcDiv2Winner)?.seed! ? afcDiv1Winner : afcDiv2Winner,
      awayTeamId: afcSeeds.find((s) => s.team.id === afcDiv1Winner)?.seed! < afcSeeds.find((s) => s.team.id === afcDiv2Winner)?.seed! ? afcDiv2Winner : afcDiv1Winner,
      homeSeed: Math.min(afcSeeds.find((s) => s.team.id === afcDiv1Winner)?.seed!, afcSeeds.find((s) => s.team.id === afcDiv2Winner)?.seed!),
      awaySeed: Math.max(afcSeeds.find((s) => s.team.id === afcDiv1Winner)?.seed!, afcSeeds.find((s) => s.team.id === afcDiv2Winner)?.seed!),
      isPlayed: false,
    };

    const nfcConf: PlayoffMatchup = {
      id: 'proj-conf-nfc',
      round: 'Conference',
      conference: 'NFC',
      homeTeamId: nfcSeeds.find((s) => s.team.id === nfcDiv1Winner)?.seed! < nfcSeeds.find((s) => s.team.id === nfcDiv2Winner)?.seed! ? nfcDiv1Winner : nfcDiv2Winner,
      awayTeamId: nfcSeeds.find((s) => s.team.id === nfcDiv1Winner)?.seed! < nfcSeeds.find((s) => s.team.id === nfcDiv2Winner)?.seed! ? nfcDiv2Winner : nfcDiv1Winner,
      homeSeed: Math.min(nfcSeeds.find((s) => s.team.id === nfcDiv1Winner)?.seed!, nfcSeeds.find((s) => s.team.id === nfcDiv2Winner)?.seed!),
      awaySeed: Math.max(nfcSeeds.find((s) => s.team.id === nfcDiv1Winner)?.seed!, nfcSeeds.find((s) => s.team.id === nfcDiv2Winner)?.seed!),
      isPlayed: false,
    };

    projectedBracket.conference = [afcConf, nfcConf];

    // Project Super Bowl
    const afcChamp = projectMatchupWinner(afcConf);
    const nfcChamp = projectMatchupWinner(nfcConf);

    projectedBracket.superBowl = {
      id: 'proj-sb-final',
      round: 'SuperBowl',
      homeTeamId: afcChamp,
      awayTeamId: nfcChamp,
      homeSeed: afcSeeds.find((s) => s.team.id === afcChamp)?.seed,
      awaySeed: nfcSeeds.find((s) => s.team.id === nfcChamp)?.seed,
      isPlayed: false,
    };

    projectedBracket.championId = projectMatchupWinner(projectedBracket.superBowl);

    return {
      bracket: projectedBracket,
      isProjected: true,
      afcSeeds,
      nfcSeeds,
    };
  };

  const { bracket, isProjected, afcSeeds, nfcSeeds } = getBracketData();

  // Render a Single Matchup Card
  const renderMatchupCard = (matchup: PlayoffMatchup, isProjectedCard: boolean) => {
    if (!matchup || !matchup.homeTeamId || !matchup.awayTeamId) {
      return (
        <div className="p-4 bg-slate-950/40 border border-slate-900 border-dashed rounded-2xl flex flex-col items-center justify-center text-center py-6 h-32">
          <HelpCircle className="w-5 h-5 text-slate-700 mb-1.5" />
          <span className="text-[11px] font-mono text-slate-500 font-bold uppercase tracking-wider">
            TBD MATCHUP
          </span>
          <span className="text-[10px] text-slate-600">Awaiting prior results</span>
        </div>
      );
    }

    const home = getTeamById(matchup.homeTeamId);
    const away = getTeamById(matchup.awayTeamId);

    const isUserHome = matchup.homeTeamId === season.userTeamId;
    const isUserAway = matchup.awayTeamId === season.userTeamId;
    const isUserInvolved = isUserHome || isUserAway;

    const isHomeWinner = matchup.isPlayed && matchup.winnerId === matchup.homeTeamId;
    const isAwayWinner = matchup.isPlayed && matchup.winnerId === matchup.awayTeamId;

    // Projected labels
    const isProjectedWinnerHome = isProjectedCard && bracket.championId === matchup.homeTeamId;
    const isProjectedWinnerAway = isProjectedCard && bracket.championId === matchup.awayTeamId;

    return (
      <div
        className={`p-3 rounded-2xl border transition relative flex flex-col justify-between ${
          isUserInvolved
            ? 'bg-amber-950/20 border-amber-500/80 shadow-md ring-1 ring-amber-500/20'
            : matchup.isPlayed
            ? 'bg-slate-900/90 border-slate-800'
            : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-750'
        }`}
      >
        {/* Conference Indicator badge */}
        <div className="flex items-center justify-between border-b border-slate-800/40 pb-2 mb-2">
          <div className="flex items-center space-x-1.5">
            <span
              className={`text-[9px] font-display font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                matchup.conference === 'AFC'
                  ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                  : matchup.conference === 'NFC'
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
              }`}
            >
              {matchup.conference || 'SUPER BOWL'}
            </span>
            {isProjectedCard && (
              <span className="text-[8px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                PROJ
              </span>
            )}
          </div>
          <span className="text-[9px] font-mono font-bold text-slate-500">
            {matchup.isPlayed ? 'FINAL' : 'SCHEDULED'}
          </span>
        </div>

        {/* Away Team Info */}
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center space-x-2 w-3/4">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-display font-extrabold shadow flex-shrink-0"
              style={{
                backgroundColor: away.primaryColor,
                color: away.textColor || '#ffffff',
                border: `1.5px solid ${away.secondaryColor || '#ffffff'}`,
              }}
            >
              {away.abbr}
            </div>
            <div className="truncate">
              <span
                className={`font-display text-xs truncate block ${
                  isAwayWinner || (isProjectedCard && getTeamById(matchup.winnerId || '').id === away.id)
                    ? 'text-amber-400 font-bold'
                    : 'text-slate-200'
                }`}
              >
                <span className="text-[10px] text-slate-400 font-normal mr-1 font-mono">
                  ({matchup.awaySeed || '?'})
                </span>
                {away.city} {away.name}
              </span>
              {isUserAway && (
                <span className="text-[8px] uppercase tracking-wider text-amber-500 font-black block">
                  YOUR TEAM
                </span>
              )}
            </div>
          </div>
          <div className="text-right font-display font-black text-xs text-white w-1/4">
            {matchup.isPlayed ? (
              <span className={isAwayWinner ? 'text-amber-400 text-sm' : 'text-slate-400'}>
                {matchup.awayScore}
              </span>
            ) : isProjectedCard ? (
              <span className="text-slate-600 font-normal text-[10px] italic">Wins</span>
            ) : (
              <span className="text-slate-700 font-normal">-</span>
            )}
          </div>
        </div>

        {/* Home Team Info */}
        <div className="flex items-center justify-between py-1.5 border-t border-slate-900/30">
          <div className="flex items-center space-x-2 w-3/4">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-display font-extrabold shadow flex-shrink-0"
              style={{
                backgroundColor: home.primaryColor,
                color: home.textColor || '#ffffff',
                border: `1.5px solid ${home.secondaryColor || '#ffffff'}`,
              }}
            >
              {home.abbr}
            </div>
            <div className="truncate">
              <span
                className={`font-display text-xs truncate block ${
                  isHomeWinner || (isProjectedCard && getTeamById(matchup.winnerId || '').id === home.id)
                    ? 'text-amber-400 font-bold'
                    : 'text-slate-200'
                }`}
              >
                <span className="text-[10px] text-slate-400 font-normal mr-1 font-mono">
                  ({matchup.homeSeed || '?'})
                </span>
                {home.city} {home.name}
              </span>
              {isUserHome && (
                <span className="text-[8px] uppercase tracking-wider text-amber-500 font-black block">
                  YOUR TEAM
                </span>
              )}
            </div>
          </div>
          <div className="text-right font-display font-black text-xs text-white w-1/4">
            {matchup.isPlayed ? (
              <span className={isHomeWinner ? 'text-amber-400 text-sm' : 'text-slate-400'}>
                {matchup.homeScore}
              </span>
            ) : isProjectedCard ? (
              <span className="text-slate-600 font-normal text-[10px] italic">Wins</span>
            ) : (
              <span className="text-slate-700 font-normal">-</span>
            )}
          </div>
        </div>

        {/* Interactive Play Controls (Real Postseason only) */}
        {!isProjectedCard && !matchup.isPlayed && isUserInvolved && (
          <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-slate-800/40">
            {onPlayGame && (
              <button
                type="button"
                onClick={() => onPlayGame(home, away, season.currentWeek, true, matchup.round)}
                className="flex-1 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-[10px] transition text-center flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>PLAY USER GAME</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Extract matchups per conference & round
  const getMatchupsByRound = (conf: Conference) => {
    return {
      wildcard: bracket.wildCard.filter((m) => m.conference === conf),
      divisional: bracket.divisional.filter((m) => m.conference === conf),
      conference: bracket.conference.filter((m) => m.conference === conf),
    };
  };

  const afcRoundMatchups = getMatchupsByRound('AFC');
  const nfcRoundMatchups = getMatchupsByRound('NFC');

  return (
    <div className="space-y-6">
      {/* Projected Bracket Info Banner */}
      {isProjected && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-left">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <TrendingUp className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="font-display font-black text-xs text-amber-300 uppercase tracking-wider">
                LIVE POSTSEASON PROJECTION
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Currently in Week {season.currentWeek} of the regular season. This bracket displays the **projected tournament matchups** and estimated paths based on active records.
              </p>
            </div>
          </div>
          {onSimulateToPlayoffs && (
            <button
              onClick={onSimulateToPlayoffs}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-[11px] uppercase tracking-wider shadow-md transition transform active:scale-95 cursor-pointer"
            >
              SIMULATE TO PLAYOFFS
            </button>
          )}
        </div>
      )}

      {/* Conference Filter Buttons & Postseason Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setActiveTab('tree')}
            className={`px-3.5 py-1.5 rounded-xl font-display font-bold text-xs transition ${
              activeTab === 'tree'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            🏆 FULL BRACKET TREE
          </button>
          <button
            onClick={() => setActiveTab('afc')}
            className={`px-3.5 py-1.5 rounded-xl font-display font-bold text-xs transition ${
              activeTab === 'afc'
                ? 'bg-red-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            🔴 AFC TOURNAMENT
          </button>
          <button
            onClick={() => setActiveTab('nfc')}
            className={`px-3.5 py-1.5 rounded-xl font-display font-bold text-xs transition ${
              activeTab === 'nfc'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            🔵 NFC TOURNAMENT
          </button>
          <button
            onClick={() => setActiveTab('sb')}
            className={`px-3.5 py-1.5 rounded-xl font-display font-bold text-xs transition ${
              activeTab === 'sb'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            🏈 SUPER BOWL LXI
          </button>
        </div>

        {/* Playoff controls */}
        {!isProjected && season.currentWeek <= 22 && onSimulatePlayoffRound && (
          <button
            onClick={onSimulatePlayoffRound}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-xs shadow transition transform active:scale-95 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>SIMULATE CURRENT PLAYOFF ROUND</span>
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: FULL VISUAL TREE (AFC & NFC SPLIT)                */}
      {/* ========================================================= */}
      {activeTab === 'tree' && (
        <div className="space-y-8">
          {/* AFC TREE */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-red-500">
              <span className="w-1.5 h-3 bg-red-600 rounded"></span>
              <h3 className="font-display font-black text-sm tracking-widest uppercase">
                AMERICAN FOOTBALL CONFERENCE (AFC)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {/* WILD CARD COL */}
              <div className="space-y-4">
                <div className="text-center py-1 bg-slate-950/80 border border-slate-900 rounded-lg">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Wild Card (Wk 19)
                  </span>
                </div>
                {/* Seed #1 Bye Matchup / Card */}
                <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center justify-between text-xs py-3 h-16">
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <div>
                      <span className="font-display font-bold text-white block">
                        ({1}) {getTeamById(afcSeeds[0]?.team?.id || '').name}
                      </span>
                      <span className="text-[8px] font-mono uppercase tracking-wider text-amber-400">
                        #1 SEED BYE WEEK
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-emerald-400">ADVANCED</span>
                </div>

                <div className="space-y-3">
                  {afcRoundMatchups.wildcard.map((m) => renderMatchupCard(m, isProjected))}
                </div>
              </div>

              {/* DIVISIONAL COL */}
              <div className="space-y-4">
                <div className="text-center py-1 bg-slate-950/80 border border-slate-900 rounded-lg">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Divisional (Wk 20)
                  </span>
                </div>
                <div className="space-y-3 flex flex-col justify-around h-[85%] min-h-[220px]">
                  {afcRoundMatchups.divisional.length === 0 ? (
                    <>
                      {renderMatchupCard(null as any, isProjected)}
                      {renderMatchupCard(null as any, isProjected)}
                    </>
                  ) : (
                    afcRoundMatchups.divisional.map((m) => renderMatchupCard(m, isProjected))
                  )}
                </div>
              </div>

              {/* CONFERENCE COL */}
              <div className="space-y-4">
                <div className="text-center py-1 bg-slate-950/80 border border-slate-900 rounded-lg">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    AFC Championship (Wk 21)
                  </span>
                </div>
                <div className="flex flex-col justify-center h-[85%] min-h-[220px]">
                  {afcRoundMatchups.conference.length === 0 ? (
                    renderMatchupCard(null as any, isProjected)
                  ) : (
                    renderMatchupCard(afcRoundMatchups.conference[0], isProjected)
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-900/60 my-6"></div>

          {/* NFC TREE */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-blue-500">
              <span className="w-1.5 h-3 bg-blue-600 rounded"></span>
              <h3 className="font-display font-black text-sm tracking-widest uppercase">
                NATIONAL FOOTBALL CONFERENCE (NFC)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {/* WILD CARD COL */}
              <div className="space-y-4">
                <div className="text-center py-1 bg-slate-950/80 border border-slate-900 rounded-lg">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Wild Card (Wk 19)
                  </span>
                </div>
                {/* Seed #1 Bye Matchup / Card */}
                <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-between text-xs py-3 h-16">
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <div>
                      <span className="font-display font-bold text-white block">
                        ({1}) {getTeamById(nfcSeeds[0]?.team?.id || '').name}
                      </span>
                      <span className="text-[8px] font-mono uppercase tracking-wider text-amber-400">
                        #1 SEED BYE WEEK
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-emerald-400">ADVANCED</span>
                </div>

                <div className="space-y-3">
                  {nfcRoundMatchups.wildcard.map((m) => renderMatchupCard(m, isProjected))}
                </div>
              </div>

              {/* DIVISIONAL COL */}
              <div className="space-y-4">
                <div className="text-center py-1 bg-slate-950/80 border border-slate-900 rounded-lg">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Divisional (Wk 20)
                  </span>
                </div>
                <div className="space-y-3 flex flex-col justify-around h-[85%] min-h-[220px]">
                  {nfcRoundMatchups.divisional.length === 0 ? (
                    <>
                      {renderMatchupCard(null as any, isProjected)}
                      {renderMatchupCard(null as any, isProjected)}
                    </>
                  ) : (
                    nfcRoundMatchups.divisional.map((m) => renderMatchupCard(m, isProjected))
                  )}
                </div>
              </div>

              {/* CONFERENCE COL */}
              <div className="space-y-4">
                <div className="text-center py-1 bg-slate-950/80 border border-slate-900 rounded-lg">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    NFC Championship (Wk 21)
                  </span>
                </div>
                <div className="flex flex-col justify-center h-[85%] min-h-[220px]">
                  {nfcRoundMatchups.conference.length === 0 ? (
                    renderMatchupCard(null as any, isProjected)
                  ) : (
                    renderMatchupCard(nfcRoundMatchups.conference[0], isProjected)
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SUPER BOWL BOX */}
          <div className="border-t border-slate-900/60 my-6"></div>
          <div className="flex flex-col items-center justify-center space-y-4 pt-2">
            <div className="flex items-center space-x-2 text-amber-400">
              <Trophy className="w-6 h-6 animate-pulse" />
              <h3 className="font-display font-black text-base tracking-widest uppercase">
                SUPER BOWL CHAMPIONSHIP
              </h3>
            </div>
            <div className="w-full max-w-md">
              {bracket.superBowl && bracket.superBowl.homeTeamId ? (
                renderMatchupCard(bracket.superBowl, isProjected)
              ) : (
                <div className="p-6 bg-slate-950/40 border border-slate-800 border-dashed rounded-2xl text-center text-slate-500 italic text-xs">
                  Awaiting AFC and NFC Conference Champions
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: AFC CONFERENCE                                    */}
      {/* ========================================================= */}
      {activeTab === 'afc' && (
        <div className="space-y-6">
          <div className="flex items-center space-x-2 text-red-500 border-b border-slate-900 pb-2">
            <span className="w-2 h-4 bg-red-600 rounded"></span>
            <h3 className="font-display font-black text-base tracking-widest uppercase">
              AMERICAN FOOTBALL CONFERENCE (AFC) PLAYOFFS
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Wild Card (3 Matches) */}
            <div className="space-y-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/60">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <span className="font-display font-bold text-xs text-slate-300 uppercase">
                  WILD CARD ROUND
                </span>
                <span className="text-[10px] font-mono text-slate-500">WEEK 19</span>
              </div>
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center justify-between text-xs py-3 h-16">
                <div className="flex items-center space-x-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <div>
                    <span className="font-display font-bold text-white block">
                      ({1}) {getTeamById(afcSeeds[0]?.team?.id || '').name}
                    </span>
                    <span className="text-[8px] font-mono uppercase tracking-wider text-amber-400">
                      #1 SEED BYE WEEK
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold text-emerald-400">ADVANCED</span>
              </div>
              {afcRoundMatchups.wildcard.map((m) => renderMatchupCard(m, isProjected))}
            </div>

            {/* Divisional (2 Matches) */}
            <div className="space-y-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/60">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <span className="font-display font-bold text-xs text-slate-300 uppercase">
                  DIVISIONAL ROUND
                </span>
                <span className="text-[10px] font-mono text-slate-500">WEEK 20</span>
              </div>
              {afcRoundMatchups.divisional.length === 0 ? (
                <div className="text-center text-xs text-slate-500 italic py-12">
                  Awaiting Wild Card round results...
                </div>
              ) : (
                afcRoundMatchups.divisional.map((m) => renderMatchupCard(m, isProjected))
              )}
            </div>

            {/* Conference Championship (1 Match) */}
            <div className="space-y-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/60">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <span className="font-display font-bold text-xs text-slate-300 uppercase">
                  CONFERENCE TITLE
                </span>
                <span className="text-[10px] font-mono text-slate-500">WEEK 21</span>
              </div>
              {afcRoundMatchups.conference.length === 0 ? (
                <div className="text-center text-xs text-slate-500 italic py-12">
                  Awaiting Divisional round results...
                </div>
              ) : (
                renderMatchupCard(afcRoundMatchups.conference[0], isProjected)
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 3: NFC CONFERENCE                                    */}
      {/* ========================================================= */}
      {activeTab === 'nfc' && (
        <div className="space-y-6">
          <div className="flex items-center space-x-2 text-blue-500 border-b border-slate-900 pb-2">
            <span className="w-2 h-4 bg-blue-600 rounded"></span>
            <h3 className="font-display font-black text-base tracking-widest uppercase">
              NATIONAL FOOTBALL CONFERENCE (NFC) PLAYOFFS
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Wild Card (3 Matches) */}
            <div className="space-y-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/60">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <span className="font-display font-bold text-xs text-slate-300 uppercase">
                  WILD CARD ROUND
                </span>
                <span className="text-[10px] font-mono text-slate-500">WEEK 19</span>
              </div>
              <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center justify-between text-xs py-3 h-16">
                <div className="flex items-center space-x-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <div>
                    <span className="font-display font-bold text-white block">
                      ({1}) {getTeamById(nfcSeeds[0]?.team?.id || '').name}
                    </span>
                    <span className="text-[8px] font-mono uppercase tracking-wider text-amber-400">
                      #1 SEED BYE WEEK
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold text-emerald-400">ADVANCED</span>
              </div>
              {nfcRoundMatchups.wildcard.map((m) => renderMatchupCard(m, isProjected))}
            </div>

            {/* Divisional (2 Matches) */}
            <div className="space-y-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/60">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <span className="font-display font-bold text-xs text-slate-300 uppercase">
                  DIVISIONAL ROUND
                </span>
                <span className="text-[10px] font-mono text-slate-500">WEEK 20</span>
              </div>
              {nfcRoundMatchups.divisional.length === 0 ? (
                <div className="text-center text-xs text-slate-500 italic py-12">
                  Awaiting Wild Card round results...
                </div>
              ) : (
                nfcRoundMatchups.divisional.map((m) => renderMatchupCard(m, isProjected))
              )}
            </div>

            {/* Conference Championship (1 Match) */}
            <div className="space-y-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/60">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <span className="font-display font-bold text-xs text-slate-300 uppercase">
                  CONFERENCE TITLE
                </span>
                <span className="text-[10px] font-mono text-slate-500">WEEK 21</span>
              </div>
              {nfcRoundMatchups.conference.length === 0 ? (
                <div className="text-center text-xs text-slate-500 italic py-12">
                  Awaiting Divisional round results...
                </div>
              ) : (
                renderMatchupCard(nfcRoundMatchups.conference[0], isProjected)
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 4: SUPER BOWL MATCHUP                                */}
      {/* ========================================================= */}
      {activeTab === 'sb' && (
        <div className="max-w-2xl mx-auto space-y-6 text-center py-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-2">
            <Trophy className="w-8 h-8 animate-bounce" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-black text-2xl text-white tracking-wider uppercase">
              SUPER BOWL LXI
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              The pinnacle of American Football. The American Football Conference (AFC) Champion squares off with the National Football Conference (NFC) Champion for the Lombardi Trophy.
            </p>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 text-[10px] font-mono font-bold text-slate-600">
              WEEK 22
            </div>

            {bracket.superBowl && bracket.superBowl.homeTeamId ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 items-center">
                  {/* AFC */}
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase font-mono tracking-widest text-red-500 bg-red-500/10 px-2.5 py-0.5 rounded border border-red-500/20">
                      AFC CHAMPION
                    </span>
                    <div className="flex flex-col items-center">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-black text-xl shadow"
                        style={{
                          backgroundColor: getTeamById(bracket.superBowl.homeTeamId).primaryColor,
                          color: getTeamById(bracket.superBowl.homeTeamId).textColor || '#ffffff',
                          border: `2px solid ${getTeamById(bracket.superBowl.homeTeamId).secondaryColor || '#ffffff'}`,
                        }}
                      >
                        {getTeamById(bracket.superBowl.homeTeamId).abbr}
                      </div>
                      <span className="font-display font-black text-sm text-white mt-2 block">
                        ({bracket.superBowl.homeSeed}) {getTeamById(bracket.superBowl.homeTeamId).city} {getTeamById(bracket.superBowl.homeTeamId).name}
                      </span>
                      <span className="text-xs text-slate-400">
                        OVR: {getTeamById(bracket.superBowl.homeTeamId).ovr}
                      </span>
                    </div>
                  </div>

                  {/* NFC */}
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase font-mono tracking-widest text-blue-500 bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/20">
                      NFC CHAMPION
                    </span>
                    <div className="flex flex-col items-center">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-black text-xl shadow"
                        style={{
                          backgroundColor: getTeamById(bracket.superBowl.awayTeamId).primaryColor,
                          color: getTeamById(bracket.superBowl.awayTeamId).textColor || '#ffffff',
                          border: `2px solid ${getTeamById(bracket.superBowl.awayTeamId).secondaryColor || '#ffffff'}`,
                        }}
                      >
                        {getTeamById(bracket.superBowl.awayTeamId).abbr}
                      </div>
                      <span className="font-display font-black text-sm text-white mt-2 block">
                        ({bracket.superBowl.awaySeed}) {getTeamById(bracket.superBowl.awayTeamId).city} {getTeamById(bracket.superBowl.awayTeamId).name}
                      </span>
                      <span className="text-xs text-slate-400">
                        OVR: {getTeamById(bracket.superBowl.awayTeamId).ovr}
                      </span>
                    </div>
                  </div>
                </div>

                {bracket.superBowl.isPlayed ? (
                  <div className="pt-4 border-t border-slate-800 text-center space-y-3">
                    <span className="text-sm font-display font-black text-amber-400 uppercase tracking-widest block">
                      🏆 {getTeamById(bracket.superBowl.winnerId || '').name.toUpperCase()} ARE WORLD CHAMPIONS!
                    </span>
                    <div className="font-display font-black text-3xl text-white">
                      {Math.max(bracket.superBowl.homeScore || 0, bracket.superBowl.awayScore || 0)} - {Math.min(bracket.superBowl.homeScore || 0, bracket.superBowl.awayScore || 0)}
                    </div>
                    {bracket.mvp && (
                      <p className="text-xs text-slate-400">
                        Super Bowl MVP: <strong className="text-amber-400">{bracket.mvp}</strong>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-3 justify-center items-center">
                    {onPlayGame && (
                      <button
                        onClick={() => onPlayGame(getTeamById(bracket.superBowl.homeTeamId), getTeamById(bracket.superBowl.awayTeamId), 22, true, 'Super Bowl LXI')}
                        className="flex-1 w-full sm:w-auto py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black font-display text-xs tracking-wider transition shadow-lg shadow-amber-500/20 cursor-pointer"
                      >
                        PLAY SUPER BOWL LXI!
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-500 italic py-12 text-sm">
                Awaiting Conference Championship results to determine the Super Bowl contenders...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
