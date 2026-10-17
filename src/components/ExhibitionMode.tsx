import React, { useState } from 'react';
import { NFLTeam, Conference, Division, GameSettings } from '../types/game';
import { NFL_TEAMS, PRO_BOWL_TEAMS, ALL_EXHIBITION_TEAMS } from '../data/teams';
import { Shield, Play, Sliders, Sun, CloudRain, Snowflake, Moon, Disc, ArrowRightLeft, Trophy, Star } from 'lucide-react';

interface ExhibitionModeProps {
  onStartGame: (homeTeam: NFLTeam, awayTeam: NFLTeam, settings: GameSettings) => void;
}

export const ExhibitionMode: React.FC<ExhibitionModeProps> = ({ onStartGame }) => {
  const [homeTeamId, setHomeTeamId] = useState<string>('KC'); // Chiefs default home
  const [awayTeamId, setAwayTeamId] = useState<string>('BAL'); // Ravens default away
  const [activeSelectSide, setActiveSelectSide] = useState<'home' | 'away' | null>(null);
  const [confFilter, setConfFilter] = useState<Conference | 'ALL'>('ALL');
  const [divFilter, setDivFilter] = useState<Division | 'ALL'>('ALL');

  const [quarterLength, setQuarterLength] = useState<number>(3);
  const [weather, setWeather] = useState<'Sunny' | 'Rain' | 'Snow' | 'Dome' | 'Night'>('Sunny');
  const [homeJersey, setHomeJersey] = useState<'Home' | 'ColorRush'>('Home');
  const [awayJersey, setAwayJersey] = useState<'Away' | 'ColorRush'>('Away');
  const [scriptMode, setScriptMode] = useState<'Scripted' | 'Organic'>('Scripted');
  const [difficulty, setDifficulty] = useState<'Script' | 'Hard'>('Hard');

  const homeTeam = ALL_EXHIBITION_TEAMS.find((t) => t.id === homeTeamId) || ALL_EXHIBITION_TEAMS[0];
  const awayTeam = ALL_EXHIBITION_TEAMS.find((t) => t.id === awayTeamId) || ALL_EXHIBITION_TEAMS[1];

  const handleSwapTeams = () => {
    const temp = homeTeamId;
    setHomeTeamId(awayTeamId);
    setAwayTeamId(temp);
  };

  const handleSetProBowlMatchup = () => {
    setAwayTeamId('AFC_PB');
    setHomeTeamId('NFC_PB');
  };

  const filteredTeams = ALL_EXHIBITION_TEAMS.filter((t) => {
    if (confFilter !== 'ALL' && t.conference !== confFilter) return false;
    if (divFilter !== 'ALL' && t.division !== divFilter) return false;
    return true;
  });

  const handleSelectTeam = (teamId: string) => {
    if (activeSelectSide === 'home') {
      if (teamId === awayTeamId) {
        setAwayTeamId(homeTeamId);
      }
      setHomeTeamId(teamId);
    } else if (activeSelectSide === 'away') {
      if (teamId === homeTeamId) {
        setHomeTeamId(awayTeamId);
      }
      setAwayTeamId(teamId);
    }
    setActiveSelectSide(null);
  };

  const handleLaunch = () => {
    onStartGame(homeTeam, awayTeam, {
      quarterLengthMinutes: quarterLength,
      weather,
      homeJersey,
      awayJersey,
      scriptModeDefault: scriptMode,
      difficulty,
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Title & Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-emerald-700 fill-emerald-100" />
            <h1 className="font-display font-extrabold text-xl tracking-wider text-slate-900 uppercase">
              EXHIBITION MATCHUP
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure stadium conditions, pick your franchises, and launch the simulation.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0 self-start sm:self-auto">
          <button
            id="btn-quick-pro-bowl"
            onClick={handleSetProBowlMatchup}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold shadow-sm transition cursor-pointer"
          >
            <Star className="w-3.5 h-3.5 fill-amber-200" />
            <span>PRO BOWL</span>
          </button>

          <button
            id="btn-quick-swap-teams"
            onClick={handleSwapTeams}
            className="flex items-center space-x-2 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 shadow-sm transition cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
            <span>SWAP TEAMS</span>
          </button>
        </div>
      </div>

      {/* MATCHUP GRID */}
      <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
        {/* AWAY TEAM CARD */}
        <div className="md:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-72 relative overflow-hidden">
          {/* Background tint accent */}
          <div
            className="absolute right-0 bottom-0 w-32 h-32 rounded-full opacity-10 pointer-events-none"
            style={{ backgroundColor: awayTeam.primaryColor }}
          />

          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 uppercase border border-slate-200">
              AWAY TEAM
            </span>
            <button
              id="btn-select-away-team"
              onClick={() => setActiveSelectSide('away')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 transition cursor-pointer"
            >
              CHANGE ▾
            </button>
          </div>

          <div className="my-4 flex items-center space-x-4 relative z-10">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center font-display font-black text-xl shadow-md shrink-0"
              style={{
                backgroundColor: awayTeam.primaryColor,
                color: awayTeam.textColor || '#ffffff',
                border: `2px solid ${awayTeam.secondaryColor || '#ffffff'}`,
              }}
            >
              {awayTeam.abbr}
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                {awayTeam.conference} {awayTeam.division} • {awayTeam.city}
              </span>
              <h2 className="font-display font-black text-2xl text-slate-900 tracking-wide">
                {awayTeam.name.toUpperCase()}
              </h2>
            </div>
          </div>

          {/* Ratings */}
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100 relative z-10">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-semibold">OVERALL RATING</span>
              <span className="font-display font-black text-emerald-700">{awayTeam.ovr} OVR</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${awayTeam.ovr}%` }} />
            </div>
          </div>
        </div>

        {/* VS BADGE */}
        <div className="md:col-span-1 flex flex-col items-center justify-center py-2">
          <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center font-display font-black text-xs text-emerald-800 shadow-sm">
            VS
          </div>
        </div>

        {/* HOME TEAM CARD */}
        <div className="md:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-72 relative overflow-hidden">
          {/* Background tint accent */}
          <div
            className="absolute right-0 bottom-0 w-32 h-32 rounded-full opacity-10 pointer-events-none"
            style={{ backgroundColor: homeTeam.primaryColor }}
          />

          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 uppercase border border-slate-200">
              HOME TEAM
            </span>
            <button
              id="btn-select-home-team"
              onClick={() => setActiveSelectSide('home')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 transition cursor-pointer"
            >
              CHANGE ▾
            </button>
          </div>

          <div className="my-4 flex items-center space-x-4 relative z-10">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center font-display font-black text-xl shadow-md shrink-0"
              style={{
                backgroundColor: homeTeam.primaryColor,
                color: homeTeam.textColor || '#ffffff',
                border: `2px solid ${homeTeam.secondaryColor || '#ffffff'}`,
              }}
            >
              {homeTeam.abbr}
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                {homeTeam.conference} {homeTeam.division} • {homeTeam.city}
              </span>
              <h2 className="font-display font-black text-2xl text-slate-900 tracking-wide">
                {homeTeam.name.toUpperCase()}
              </h2>
            </div>
          </div>

          {/* Ratings */}
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100 relative z-10">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-semibold">OVERALL RATING</span>
              <span className="font-display font-black text-emerald-700">{homeTeam.ovr} OVR</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${homeTeam.ovr}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* SETTINGS AND CONDITIONS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-150">
          <Sliders className="w-4 h-4 text-emerald-700" />
          <h3 className="font-display font-extrabold text-xs tracking-wider uppercase text-slate-800">
            MATCHPLAY PARAMETERS
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
          {/* Quarter Length */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">Quarter Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {[2, 3, 5, 15].map((m) => (
                <button
                  key={m}
                  id={`btn-quarter-length-${m}`}
                  onClick={() => setQuarterLength(m)}
                  className={`py-2.5 rounded-xl font-bold font-display transition text-center cursor-pointer ${
                    quarterLength === m
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {/* Weather */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">Stadium Atmosphere</label>
            <div className="grid grid-cols-5 gap-1">
              {[
                { id: 'Sunny', label: 'Sunny', icon: <Sun className="w-3.5 h-3.5" /> },
                { id: 'Rain', label: 'Rainy', icon: <CloudRain className="w-3.5 h-3.5" /> },
                { id: 'Snow', label: 'Snowy', icon: <Snowflake className="w-3.5 h-3.5" /> },
                { id: 'Dome', label: 'Dome', icon: <Disc className="w-3.5 h-3.5" /> },
                { id: 'Night', label: 'Night', icon: <Moon className="w-3.5 h-3.5" /> },
              ].map((w) => (
                <button
                  key={w.id}
                  id={`btn-weather-${w.id.toLowerCase()}`}
                  onClick={() => setWeather(w.id as any)}
                  title={w.label}
                  className={`py-2 rounded-xl font-bold flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                    weather === w.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {w.icon}
                  <span className="text-[9px] font-medium mt-0.5">{w.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Default Play Outcome Mode */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">Simulation Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-engine-scripted"
                onClick={() => setScriptMode('Scripted')}
                className={`py-2.5 px-2 rounded-xl font-bold font-display transition text-center text-[11px] cursor-pointer ${
                  scriptMode === 'Scripted'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                Script outcomes
              </button>
              <button
                id="btn-engine-organic"
                onClick={() => setScriptMode('Organic')}
                className={`py-2.5 px-2 rounded-xl font-bold font-display transition text-center text-[11px] cursor-pointer ${
                  scriptMode === 'Organic'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                Organic Sim
              </button>
            </div>
          </div>

          {/* Gameplay Difficulty */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">Gameplay Difficulty</label>
              <span className="text-[10px] text-amber-600 font-bold font-mono">
                {difficulty === 'Hard' ? '⚡ Motion & Strategy' : 'Direct Play'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-diff-script"
                onClick={() => setDifficulty('Script')}
                className={`py-2.5 px-2 rounded-xl font-bold font-display transition text-center text-[11px] cursor-pointer ${
                  difficulty === 'Script'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                Script Mode
              </button>
              <button
                type="button"
                id="btn-diff-hard"
                onClick={() => setDifficulty('Hard')}
                className={`py-2.5 px-2 rounded-xl font-bold font-display transition text-center text-[11px] cursor-pointer ${
                  difficulty === 'Hard'
                    ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/40'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                ⚡ Hard Mode
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KICKOFF BUTTON */}
      <div className="flex items-center justify-center pt-2">
        <button
          id="btn-kickoff-game"
          onClick={handleLaunch}
          className="flex items-center space-x-3 bg-emerald-600 hover:bg-emerald-750 text-white font-display font-black text-sm uppercase tracking-widest px-10 py-4 rounded-xl transition shadow-lg shadow-emerald-600/10 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>START MATCHUP</span>
        </button>
      </div>

      {/* TEAM SELECTOR MODAL */}
      {activeSelectSide && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900 uppercase tracking-wide">
                  SELECT {activeSelectSide.toUpperCase()} FRANCHISE
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Filter the 32 NFL teams by conference or division</p>
              </div>
              <button
                id="btn-close-team-modal"
                onClick={() => setActiveSelectSide(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Filters */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2 text-xs items-center">
              <div className="flex items-center space-x-1">
                {(['ALL', 'AFC', 'NFC'] as (Conference | 'ALL')[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setConfFilter(c)}
                    className={`px-3 py-1 rounded-lg font-bold font-display cursor-pointer ${
                      confFilter === c
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-slate-300 mx-2" />

              <div className="flex items-center space-x-1">
                {(['ALL', 'East', 'North', 'South', 'West', 'Pro Bowl'] as (Division | 'ALL')[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDivFilter(d)}
                    className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                      divFilter === d
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {d === 'Pro Bowl' ? '⭐ Pro Bowl' : d}
                  </button>
                ))}
              </div>
            </div>

            {/* Teams Grid */}
            <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-slate-50">
              {filteredTeams.map((team) => {
                const isProBowl = team.division === 'Pro Bowl';
                return (
                  <button
                    key={team.id}
                    id={`team-select-${team.id.toLowerCase()}`}
                    onClick={() => handleSelectTeam(team.id)}
                    className={`p-3.5 rounded-xl border text-left transition flex items-center space-x-3 shadow-xs group cursor-pointer relative overflow-hidden ${
                      isProBowl
                        ? 'border-amber-400/80 bg-gradient-to-r from-amber-50/50 to-yellow-50/30 hover:border-amber-500 ring-1 ring-amber-400/30'
                        : 'border-slate-200 bg-white hover:border-emerald-500'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-extrabold text-xs shadow-sm shrink-0"
                      style={{
                        backgroundColor: team.primaryColor,
                        color: team.textColor || '#ffffff',
                      }}
                    >
                      {team.abbr}
                    </div>
                    <div className="truncate">
                      <span className={`text-[9px] block uppercase font-bold ${isProBowl ? 'text-amber-700 flex items-center gap-0.5' : 'text-slate-400'}`}>
                        {isProBowl && <Star className="w-2.5 h-2.5 fill-amber-500" />}
                        {team.city}
                      </span>
                      <span className={`font-display font-bold text-xs truncate block ${isProBowl ? 'text-amber-950 group-hover:text-amber-700' : 'text-slate-800 group-hover:text-emerald-700'}`}>
                        {team.name}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-semibold block">
                        OVR: {team.ovr} • OFF: {team.off}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
