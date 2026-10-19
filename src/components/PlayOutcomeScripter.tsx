import React, { useState, useMemo } from 'react';
import { ScriptedOutcomeType, NFLTeam, Play, QBThrowingVariant, RunStyleVariant } from '../types/game';
import { InjuryEvent } from '../types/injuries';
import { parseCustomAnnouncementForInjury } from '../utils/injuryParser';
import { ScriptExecutionParams } from '../utils/playEngine';
import { playSound } from '../utils/audio';
import { getTeamReceiversAndTEs, getPlayPrimaryTarget } from '../utils/receiverTargeting';
import { groupPlaysForDropdown } from '../utils/playGrouping';
import { HardModeFieldScorecard } from './HardModeFieldScorecard';
import { Sparkles, Sliders, PlayCircle, Zap, ShieldAlert, Flag, HelpCircle, CheckCircle2, Clock, Shield, Target, Radio, Flame, ChevronDown } from 'lucide-react';

interface PlayOutcomeScripterProps {
  offenseTeam: NFLTeam;
  defenseTeam: NFLTeam;
  offensePlay: Play;
  currentYardLine: number;
  currentDown: number;
  currentDistance: number;
  currentQuarterTimeSeconds?: number;
  quarter?: number;
  homeScore?: number;
  awayScore?: number;
  homeTeamName?: string;
  awayTeamName?: string;
  possession?: 'home' | 'away';
  onExecute: (params: ScriptExecutionParams) => void;
  disabled?: boolean;
  onStartDrawPlayMode?: () => void;
  isDrawPlayModeActive?: boolean;
  onInjuryTriggered?: (injury: InjuryEvent) => void;
  isSeasonMode?: boolean;
  isUserOnDefense?: boolean;
  difficulty?: 'Script' | 'Hard';
  isClashMode?: boolean;
  selectedThrowingVariant?: QBThrowingVariant;
  onThrowingVariantChange?: (variant: QBThrowingVariant | undefined) => void;
  selectedRunVariant?: RunStyleVariant;
  onRunVariantChange?: (variant: RunStyleVariant | undefined) => void;
  selectedTargetPlayer?: string;
  onTargetPlayerChange?: (target: string) => void;
  onOpenFieldCam?: () => void;
  isOnlineMatch?: boolean;
  isPlaySubmittedLocally?: boolean;
  isOpponentPlaySubmitted?: boolean;
  onResetPlayClock?: () => void;
  onNotice?: (msg: string) => void;
  allOffensivePlays?: Play[];
  allDefensivePlays?: Play[];
  selectedOffensePlay?: Play;
  selectedDefensePlay?: Play;
  onSelectOffensePlay?: (play: Play) => void;
  onSelectDefensePlay?: (play: Play) => void;
  lastOffensivePlayId?: string;
  lastOffensivePlayName?: string;
  consecutiveSamePlayCount?: number;
}

export const PlayOutcomeScripter: React.FC<PlayOutcomeScripterProps> = ({
  offenseTeam,
  defenseTeam,
  offensePlay,
  currentYardLine,
  currentDown,
  currentDistance,
  currentQuarterTimeSeconds,
  quarter = 1,
  homeScore,
  awayScore,
  homeTeamName,
  awayTeamName,
  possession,
  onExecute,
  disabled = false,
  onStartDrawPlayMode,
  isDrawPlayModeActive = false,
  onInjuryTriggered,
  isSeasonMode = false,
  isUserOnDefense = false,
  difficulty = 'Script',
  isClashMode = false,
  selectedThrowingVariant: externalThrowingVariant,
  onThrowingVariantChange,
  selectedRunVariant: externalRunVariant,
  onRunVariantChange,
  selectedTargetPlayer: externalTargetPlayer,
  onTargetPlayerChange,
  onOpenFieldCam,
  isOnlineMatch = false,
  isPlaySubmittedLocally = false,
  isOpponentPlaySubmitted = false,
  allOffensivePlays = [],
  allDefensivePlays = [],
  selectedOffensePlay,
  selectedDefensePlay,
  onSelectOffensePlay,
  onSelectDefensePlay,
  lastOffensivePlayId,
  lastOffensivePlayName,
  consecutiveSamePlayCount = 0,
  onResetPlayClock,
  onNotice,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom' | 'draw'>('presets');
  const [selectedType, setSelectedType] = useState<ScriptedOutcomeType>('FirstDown');
  const [isDoubleTeamed, setIsDoubleTeamed] = useState<boolean>(false);
  const [isPreSnapMotion, setIsPreSnapMotion] = useState<boolean>(false);
  const [isMaxProtection, setIsMaxProtection] = useState<boolean>(false);
  const [internalThrowingVariant, setInternalThrowingVariant] = useState<QBThrowingVariant | undefined>(undefined);
  const throwingVariant = externalThrowingVariant !== undefined ? externalThrowingVariant : internalThrowingVariant;

  const [internalRunVariant, setInternalRunVariant] = useState<RunStyleVariant | undefined>(undefined);
  const runVariant = externalRunVariant !== undefined ? externalRunVariant : internalRunVariant;

  const currentActivePlay = isUserOnDefense
    ? (selectedDefensePlay || allDefensivePlays[0] || offensePlay)
    : (selectedOffensePlay || offensePlay);

  const availablePlays = isUserOnDefense ? allDefensivePlays : allOffensivePlays;
  const groupedPlays = useMemo(() => {
    return groupPlaysForDropdown(availablePlays, isUserOnDefense);
  }, [availablePlays, isUserOnDefense]);

  const isCurrentPlayRepeated = !isUserOnDefense && (currentActivePlay.id === lastOffensivePlayId || currentActivePlay.name === lastOffensivePlayName);
  const activeRepCount = isCurrentPlayRepeated ? (consecutiveSamePlayCount || 0) : 0;

  const isRunPlay = currentActivePlay.category === 'Run';

  const handleSetThrowingVariant = (v: QBThrowingVariant | undefined) => {
    setInternalThrowingVariant(v);
    if (onThrowingVariantChange) {
      onThrowingVariantChange(v);
    }
  };

  const handleSetRunVariant = (v: RunStyleVariant | undefined) => {
    setInternalRunVariant(v);
    if (onRunVariantChange) {
      onRunVariantChange(v);
    }
  };

  // Receiver & 1st Read Targeting for this team only
  const primaryTargetInfo = useMemo(() => {
    return getPlayPrimaryTarget(currentActivePlay, offenseTeam);
  }, [currentActivePlay, offenseTeam]);

  const teamReceivers = useMemo(() => {
    return getTeamReceiversAndTEs(offenseTeam.id);
  }, [offenseTeam.id]);

  const [internalSelectedTarget, setInternalSelectedTarget] = useState<string>('FIRST_READ');
  const selectedTarget = externalTargetPlayer !== undefined ? externalTargetPlayer : internalSelectedTarget;

  const handleSetTarget = (target: string) => {
    setInternalSelectedTarget(target);
    if (onTargetPlayerChange) {
      onTargetPlayerChange(target);
    }
  };

  // Custom script options
  const [customYards, setCustomYards] = useState<number>(12);
  const [customPlayer, setCustomPlayer] = useState<string>('FIRST_READ');
  const [customEvent, setCustomEvent] = useState<'tackle' | 'out_of_bounds' | 'touchdown' | 'turnover' | 'penalty' | 'safety'>('tackle');
  const [customCommentary, setCustomCommentary] = useState<string>('');

  // Clock Adjustment: Dropdown with "Remaining game time / How much is taken off" + time input
  const [clockDropdownMode, setClockDropdownMode] = useState<'elapsed' | 'remaining'>('elapsed');
  const [clockInputText, setClockInputText] = useState<string>('25');

  const distanceToGoal = 100 - currentYardLine;

  // D-Line vs O-Line Math Calculation
  const isPlayingRams = defenseTeam.id === 'lar' || defenseTeam.name.toLowerCase().includes('rams');
  const oLineAvg = offenseTeam.ovr || offenseTeam.off || 80;
  const oLineMath = oLineAvg / 5;
  const highestDLine = isPlayingRams ? 99 : (defenseTeam.def || 80);
  const lowestDLine = isPlayingRams ? 78 : Math.max(60, highestDLine - 18);
  const dLineMath = (highestDLine - lowestDLine) / 2;
  const isDLineSuperior = dLineMath > oLineMath || isPlayingRams;

  const parseClockInputToSeconds = (input: string): number | undefined => {
    const trimmed = input.trim();
    if (!trimmed) return undefined;
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseInt(parts[1], 10) || 0;
      return Math.max(0, mins * 60 + secs);
    }
    const num = parseInt(trimmed, 10);
    return isNaN(num) ? undefined : Math.max(0, num);
  };

  const formatClock = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const parsedClockSeconds = parseClockInputToSeconds(clockInputText);

  const quickPresets: {
    type: ScriptedOutcomeType;
    label: string;
    desc: string;
    category: 'positive' | 'neutral' | 'negative' | 'special';
    badge: string;
  }[] = [
    { type: 'Touchdown', label: 'TOUCHDOWN!', desc: `Score 6/7 pts to the endzone (${distanceToGoal} yds)`, category: 'positive', badge: 'TD' },
    { type: 'BigGain', label: 'Big Play (25-35 Yds)', desc: 'Chunk play explosion downfield', category: 'positive', badge: '+30' },
    { type: 'FirstDown', label: '1st Down Conversion', desc: `Gain enough for a fresh set of downs (${Math.max(currentDistance, 10)} yds)`, category: 'positive', badge: '1ST' },
    { type: 'ShortGain', label: 'Short Gain (3-5 Yds)', desc: 'Safe conservative yardage', category: 'positive', badge: '+4' },
    { type: 'NoGain', label: 'No Gain (0 Yds)', desc: 'Run or pass stopped at scrimmage', category: 'neutral', badge: '0' },
    { type: 'TackleForLoss', label: 'Tackle for Loss', desc: 'Stuffed behind the line (-3 yds)', category: 'negative', badge: '-3' },
    { type: 'Sack', label: 'QB Sack (-7 Yds)', desc: 'Defensive edge rusher drops the QB', category: 'negative', badge: 'SACK' },
    { type: 'Incomplete', label: 'Incomplete Pass', desc: 'Pass broken up, clock stops', category: 'neutral', badge: 'INC' },
    { type: 'Interception', label: 'Interception!', desc: 'Turnover! Ball picked off in coverage', category: 'negative', badge: 'INT' },
    { type: 'PickSix', label: 'Pick-Six TD', desc: 'Defensive score! Returned all the way', category: 'negative', badge: 'DEF TD' },
    { type: 'FumbleDefense', label: 'Strip Fumble', desc: 'Hit jars ball loose, defense recovers', category: 'negative', badge: 'FUM' },
    { type: 'PenaltyDefense', label: 'Defensive PI (+15)', desc: 'Pass interference penalty, auto 1st down', category: 'positive', badge: 'FLAG' },
    { type: 'PenaltyOffense', label: 'Offensive Holding (-10)', desc: 'Holding penalty backs up 10 yards', category: 'negative', badge: 'FLAG' },
    { type: 'FieldGoalGood', label: 'FG: Good', desc: 'Kick a successful field goal', category: 'positive', badge: 'FG' },
    { type: 'FieldGoalMiss', label: 'FG: Miss', desc: 'Miss the field goal wide right/left', category: 'negative', badge: 'FG MISS' },
    { type: 'FieldGoalBlocked', label: 'FG: Blocked', desc: 'Defensive rush blocks the field goal', category: 'negative', badge: 'FG BLK' },
    { type: 'Punt', label: 'Punt (50 Yds)', desc: 'High spiral 50-yard punt', category: 'special', badge: 'PUNT' },
    { type: 'PuntBlocked', label: 'Punt: Blocked', desc: 'Defensive rush blocks the punt in backfield', category: 'negative', badge: 'PUNT BLK' },
    { type: 'OrganicSim', label: 'Simulate Outcome (Ratings)', desc: 'Let ratings and play matchup decide', category: 'special', badge: 'SIM' },
  ];

  const handleExecutePreset = (type: ScriptedOutcomeType) => {
    setSelectedType(type);
    const resolvedTarget = selectedTarget === 'FIRST_READ' ? primaryTargetInfo.name : selectedTarget;
    onExecute({
      outcomeType: type,
      targetPlayer: resolvedTarget,
      clockMode: clockDropdownMode,
      clockValue: parsedClockSeconds,
      isDoubleTeamed,
      throwingVariant,
    });
  };

  const handleExecuteCustom = () => {
    if (customCommentary.trim() && onInjuryTriggered) {
      const parsedInjury = parseCustomAnnouncementForInjury(
        customCommentary,
        offenseTeam,
        defenseTeam,
        'home'
      );
      if (parsedInjury) {
        onInjuryTriggered(parsedInjury);
      }
    }

    const resolvedTarget = customPlayer === 'FIRST_READ'
      ? (selectedTarget === 'FIRST_READ' ? primaryTargetInfo.name : selectedTarget)
      : (customPlayer || (selectedTarget === 'FIRST_READ' ? primaryTargetInfo.name : selectedTarget));

    onExecute({
      outcomeType: 'CustomYards',
      customYards,
      customEvent,
      targetPlayer: resolvedTarget,
      customCommentary: customCommentary.trim() || undefined,
      clockMode: clockDropdownMode,
      clockValue: parsedClockSeconds,
      isDoubleTeamed,
      throwingVariant,
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      {/* Header with Mode Tabs */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center space-x-2">
          {difficulty === 'Hard' || isClashMode ? (
            <>
              <Shield className="w-5 h-5 text-rose-500 animate-pulse" />
              <h3 className="font-display font-black text-base tracking-wider text-white">
                HARD MODE <span className="text-rose-500">EXECUTION</span>
                {isClashMode && (
                  <span className="text-amber-400 text-xs ml-2 font-mono font-bold tracking-wider bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    CLASH NO-SCRIPTING
                  </span>
                )}
              </h3>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-display font-bold text-base tracking-wider text-white">
                PLAY OUTCOME <span className="text-amber-400">SCRIPTER</span>
              </h3>
            </>
          )}
        </div>

        {difficulty !== 'Hard' && !isClashMode && (
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              id="tab-script-presets"
              onClick={() => setActiveTab('presets')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                activeTab === 'presets' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Quick Script
            </button>
            <button
              id="tab-script-custom"
              onClick={() => setActiveTab('custom')}
              className={`flex items-center space-x-1 px-3 py-1 rounded text-xs font-semibold transition ${
                activeTab === 'custom' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Custom Script</span>
            </button>
            <button
              id="tab-script-draw"
              onClick={() => {
                setActiveTab('draw');
                if (onStartDrawPlayMode) onStartDrawPlayMode();
              }}
              className={`flex items-center space-x-1 px-3 py-1 rounded text-xs font-semibold transition ${
                activeTab === 'draw' || isDrawPlayModeActive ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Draw Play Path</span>
            </button>
          </div>
        )}
      </div>

      {difficulty === 'Hard' || isClashMode ? (
        <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 sm:p-6 text-center space-y-5 shadow-inner">
          {/* HARD MODE EXCLUSIVE LIVE FIELD SCORECARD */}
          <HardModeFieldScorecard
            offenseTeam={offenseTeam}
            defenseTeam={defenseTeam}
            homeScore={homeScore}
            awayScore={awayScore}
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            possession={possession}
            currentYardLine={currentYardLine}
            currentDown={currentDown}
            currentDistance={currentDistance}
            quarter={quarter}
            currentQuarterTimeSeconds={currentQuarterTimeSeconds}
            isPreSnapMotion={isPreSnapMotion}
            onOpenFieldCam={onOpenFieldCam}
          />

          <div className="flex flex-col items-center justify-center space-y-1.5">
            <div className="p-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full">
              <Shield className="w-6 h-6" />
            </div>
            <h4 className="text-white font-display font-black text-base uppercase tracking-wider">
              {isUserOnDefense ? 'Hard Mode Defense' : 'Hard Mode Offense'}
            </h4>
            <p className="text-slate-400 text-xs max-w-md leading-relaxed">
              {isUserOnDefense
                ? `You are in defensive command of the ${defenseTeam.name}. Call your plays, orchestrate pre-snap adjustments, and shut down the opponent's drive.`
                : `You are leading the ${offenseTeam.name} offense. Select your play calling carefully, manage your predictability, and execute under pressure.`}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-w-md mx-auto space-y-3">
            {/* IN-GAME PLAY CALL DROPDOWN MENU - DIRECT ACCESS, NO SCROLLING UP REQUIRED! */}
            {availablePlays.length > 0 && (
              <div className="text-left space-y-1.5 pb-3 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <label htmlFor="hardmode-play-call-dropdown" className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                    <span className="text-amber-400">{isUserOnDefense ? '🛡️' : '🏈'}</span>
                    <span>{isUserOnDefense ? 'Call Defensive Play' : 'Call Offensive Play'}</span>
                  </label>
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {currentActivePlay.formation} • {currentActivePlay.category}
                  </span>
                </div>

                <div className="relative">
                  <select
                    id="hardmode-play-call-dropdown"
                    value={currentActivePlay.id}
                    disabled={disabled || isPlaySubmittedLocally}
                    onChange={(e) => {
                      const selected = availablePlays.find((p) => p.id === e.target.value);
                      if (selected) {
                        if (isUserOnDefense) {
                          onSelectDefensePlay?.(selected);
                        } else {
                          onSelectOffensePlay?.(selected);
                        }
                      }
                    }}
                    className="w-full bg-slate-950 border-2 border-slate-700 hover:border-amber-500 focus:border-amber-400 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none transition cursor-pointer"
                  >
                    {groupedPlays.map((group) => (
                      <optgroup key={group.label} label={group.label} className="bg-slate-900 text-slate-300 font-bold">
                        {group.plays.map((play) => {
                          const isRep = !isUserOnDefense && (play.id === lastOffensivePlayId || play.name === lastOffensivePlayName);
                          const count = isRep ? (consecutiveSamePlayCount || 0) : 0;
                          return (
                            <option
                              key={play.id}
                              value={play.id}
                              className="bg-slate-950 text-white font-normal py-1"
                            >
                              {play.name} ({play.formation} • {play.category}){count >= 3 ? ` ⚠️ (${count}x in a row - Defense read!)` : ''}
                            </option>
                          );
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400 truncate max-w-[280px]">
                    {currentActivePlay.description || `${currentActivePlay.name} (${currentActivePlay.formation})`}
                  </span>
                  {activeRepCount >= 3 && (
                    <span className="text-[9px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-600 px-1.5 py-0.5 rounded shrink-0 ml-1">
                      ⚠️ {activeRepCount}x in a row (Defense read!)
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-left space-y-0.5">
                <span className="text-white text-xs font-bold block">Pre-Snap Shift / Motion</span>
                <span className="text-[10px] text-slate-400 block">
                  {isUserOnDefense
                    ? 'Shift defensive front to disguise coverage'
                    : 'Send a wide receiver in motion before the snap'}
                </span>
              </div>
              <button
                type="button"
                id="btn-presnap-motion-toggle"
                onClick={() => setIsPreSnapMotion(!isPreSnapMotion)}
                className={`px-4 py-2 rounded-lg border text-xs font-display font-black transition ${
                  isPreSnapMotion
                    ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-750'
                }`}
              >
                {isPreSnapMotion ? '⚡ ACTIVE' : 'STANDBY'}
              </button>
            </div>
            
            {!isUserOnDefense && (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-left space-y-0.5">
                    <span className="text-white text-xs font-bold block">Max Protection</span>
                    <span className="text-[10px] text-slate-400 block">
                      Keep RBs in to block, stop sacks
                    </span>
                  </div>
                  <button
                    type="button"
                    id="btn-max-protection-toggle"
                    onClick={() => setIsMaxProtection(!isMaxProtection)}
                    className={`px-4 py-2 rounded-lg border text-xs font-display font-black transition ${
                      isMaxProtection
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-750'
                    }`}
                  >
                    {isMaxProtection ? '🛡️ PROTECTED' : 'STANDBY'}
                  </button>
                </div>

                {isRunPlay ? (
                  /* Running Style Variant for Run Plays */
                  <div className="text-left space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        <span>Run Style (Optional)</span>
                      </span>
                      {runVariant && (
                        <button
                          type="button"
                          id="btn-hardmode-reset-run-variant"
                          onClick={() => handleSetRunVariant(undefined)}
                          className="text-[10px] text-slate-400 hover:text-white underline font-mono"
                        >
                          Reset Standard
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        id="btn-hardmode-run-power"
                        onClick={() => handleSetRunVariant(runVariant === 'power' ? undefined : 'power')}
                        className={`p-2 rounded-lg border text-left transition ${
                          runVariant === 'power'
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                        }`}
                      >
                        <span className="text-xs font-bold block">💥 Power</span>
                        <span className="text-[9px] text-amber-300 block font-mono mt-0.5">25% 1st / 25% Fum</span>
                      </button>
                      <button
                        type="button"
                        id="btn-hardmode-run-speed"
                        onClick={() => handleSetRunVariant(runVariant === 'speed' ? undefined : 'speed')}
                        className={`p-2 rounded-lg border text-left transition ${
                          runVariant === 'speed'
                            ? 'bg-cyan-500/20 border-cyan-500 text-white shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                        }`}
                      >
                        <span className="text-xs font-bold block">⚡ Speed</span>
                        <span className="text-[9px] text-cyan-300 block font-mono mt-0.5">25% Big / 25% TFL</span>
                      </button>
                      <button
                        type="button"
                        id="btn-hardmode-run-patience"
                        onClick={() => handleSetRunVariant(runVariant === 'patience' ? undefined : 'patience')}
                        className={`p-2 rounded-lg border text-left transition ${
                          runVariant === 'patience'
                            ? 'bg-purple-500/20 border-purple-500 text-white shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                        }`}
                      >
                        <span className="text-xs font-bold block">🧘 Patience</span>
                        <span className="text-[9px] text-purple-300 block font-mono mt-0.5">15% TD / 30% -10yd</span>
                      </button>
                    </div>

                    {/* Ball Carrier / Target Selection for Run Plays */}
                  <div className="text-left space-y-1.5 pt-2 border-t border-slate-800">
                    <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center space-x-1.5">
                        <Target className="w-3.5 h-3.5 text-amber-400" />
                        <span>Ball Carrier (Select QB for QB Run!)</span>
                      </span>
                      <span className="text-[10px] text-amber-400 font-mono">
                        {selectedTarget === 'FIRST_READ' ? 'Play Default' : 'Runner Locked'}
                      </span>
                    </label>
                    <select
                      id="select-hardmode-target-runner"
                      value={selectedTarget}
                      onChange={(e) => handleSetTarget(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-sans"
                    >
                      <option value="FIRST_READ">
                        ⭐ Default: {primaryTargetInfo.name} ({primaryTargetInfo.slotLabel})
                      </option>
                      <option value={offenseTeam.starQB}>
                        ⚡ QB: {offenseTeam.starQB} (QB Run / Keeper)
                      </option>
                      <option value={offenseTeam.starRB}>
                        🏈 RB: {offenseTeam.starRB}
                      </option>
                      {teamReceivers.map((rec, idx) => (
                        <option key={`runner-${rec.depthSlot}-${rec.name}-${idx}`} value={rec.name}>
                          {rec.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  {/* Target Receiver (Who QB Throws To) */}
                  <div className="text-left space-y-1.5 pt-2 border-t border-slate-800">
                    <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center space-x-1.5">
                        <Target className="w-3.5 h-3.5 text-amber-400" />
                        <span>Target Receiver (Who QB Throws To)</span>
                      </span>
                      <span className="text-[10px] text-amber-400 font-mono">
                        {selectedTarget === 'FIRST_READ' ? 'Default 1st Read' : 'Target Locked'}
                      </span>
                    </label>
                    <select
                      id="select-hardmode-target-receiver"
                      value={selectedTarget}
                      onChange={(e) => handleSetTarget(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-sans"
                    >
                      <option value="FIRST_READ">
                        ⭐ Primary Read: {primaryTargetInfo.name} ({primaryTargetInfo.slotLabel})
                      </option>
                      {teamReceivers.map((rec, idx) => (
                        <option key={`receiver-${rec.depthSlot}-${rec.name}-${idx}`} value={rec.name}>
                          {rec.label}
                        </option>
                      ))}
                    </select>
                  </div>

                    {/* Throwing Trajectory Variant */}
                    <div className="text-left space-y-2 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                          <Radio className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Throw Trajectory (Optional)</span>
                        </span>
                        {throwingVariant && (
                          <button
                            type="button"
                            onClick={() => handleSetThrowingVariant(undefined)}
                            className="text-[10px] text-slate-400 hover:text-white underline font-mono"
                          >
                            Reset Standard
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          id="btn-hardmode-throw-in-stride"
                          onClick={() => handleSetThrowingVariant(throwingVariant === 'in_stride' ? undefined : 'in_stride')}
                          className={`p-2 rounded-lg border text-left transition ${
                            throwingVariant === 'in_stride'
                              ? 'bg-amber-500/20 border-amber-500 text-white shadow'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                          }`}
                        >
                          <span className="text-xs font-bold block">⚡ In Stride</span>
                          <span className="text-[9px] text-amber-300 block font-mono mt-0.5">+10% Big / +10% Inc</span>
                        </button>
                        <button
                          type="button"
                          id="btn-hardmode-throw-straight"
                          onClick={() => handleSetThrowingVariant(throwingVariant === 'straight_to_them' ? undefined : 'straight_to_them')}
                          className={`p-2 rounded-lg border text-left transition ${
                            throwingVariant === 'straight_to_them'
                              ? 'bg-cyan-500/20 border-cyan-500 text-white shadow'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                          }`}
                        >
                          <span className="text-xs font-bold block">🎯 Straight To</span>
                          <span className="text-[9px] text-cyan-300 block font-mono mt-0.5">+10% Comp / +10% INT</span>
                        </button>
                        <button
                          type="button"
                          id="btn-hardmode-throw-lob"
                          onClick={() => handleSetThrowingVariant(throwingVariant === 'lob_pass' ? undefined : 'lob_pass')}
                          className={`p-2 rounded-lg border text-left transition ${
                            throwingVariant === 'lob_pass'
                              ? 'bg-purple-500/20 border-purple-500 text-white shadow'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                          }`}
                        >
                          <span className="text-xs font-bold block">🏈 Lob Pass</span>
                          <span className="text-[9px] text-purple-300 block font-mono mt-0.5">50/50 Ball (25% INT)</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {isOnlineMatch && (
            <div className="bg-slate-950 p-3 rounded-xl border border-cyan-500/40 mb-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-cyan-300 uppercase">
                <span className="flex items-center space-x-1.5">
                  <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span>ONLINE REAL-TIME PLAY LOCK-IN</span>
                </span>
                <span className="text-[10px] bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30">
                  TURN SYNCHRONIZED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  isPlaySubmittedLocally
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/50 shadow-lg'
                    : isOpponentPlaySubmitted
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse'
                    : 'bg-slate-900/90 border-slate-800 text-slate-400'
                }`}>
                  <span className="font-bold">YOUR CALL:</span>
                  <span className="font-black text-xs">
                    {isPlaySubmittedLocally 
                      ? '✅ LOCKED IN' 
                      : isOpponentPlaySubmitted 
                      ? '⚠️ LOCK IN NOW!' 
                      : '⏳ SELECTING...'}
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  isOpponentPlaySubmitted
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/50 shadow-lg animate-pulse'
                    : 'bg-slate-900/90 border-slate-800 text-slate-400'
                }`}>
                  <span className="font-bold">OPPONENT:</span>
                  <span className="font-black text-xs">{isOpponentPlaySubmitted ? '✅ LOCKED IN' : '⏳ SELECTING...'}</span>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-center">
            <button
              id="btn-execute-hardmode-sim"
              disabled={disabled || isPlaySubmittedLocally}
              onClick={() => {
                const resolvedTarget = selectedTarget === 'FIRST_READ' ? primaryTargetInfo.name : selectedTarget;
                onExecute({
                  outcomeType: 'OrganicSim',
                  preSnapMotion: isPreSnapMotion,
                  isMaxProtection: isMaxProtection,
                  targetPlayer: resolvedTarget,
                  throwingVariant: isRunPlay ? undefined : throwingVariant,
                  runVariant: isRunPlay ? runVariant : undefined,
                });
                setIsPreSnapMotion(false);
                setIsMaxProtection(false);
              }}
              className={`px-10 py-4 rounded-xl font-display font-black text-sm uppercase tracking-widest transition shadow-lg flex items-center space-x-2.5 cursor-pointer disabled:opacity-75 ${
                isPlaySubmittedLocally
                  ? isOpponentPlaySubmitted
                    ? 'bg-emerald-600 text-white border-2 border-emerald-400 animate-pulse shadow-emerald-500/40'
                    : 'bg-slate-800 text-cyan-300 border border-cyan-500/40'
                  : isOpponentPlaySubmitted
                  ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-[0_0_25px_rgba(245,158,11,0.6)] animate-pulse border-2 border-amber-300'
                  : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white hover:shadow-rose-500/20'
              }`}
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>
                {isOnlineMatch
                  ? isPlaySubmittedLocally
                    ? isOpponentPlaySubmitted
                      ? '⚡ BOTH PLAYERS READY! EXECUTING PLAY...'
                      : '🔒 PLAY LOCKED IN! WAITING FOR OPPONENT...'
                    : isOpponentPlaySubmitted
                    ? '🏈 OPPONENT READY! LOCK IN PLAY'
                    : '🏈 LOCK IN PLAY CALL & EXECUTE'
                  : isUserOnDefense
                  ? 'EXECUTE DEFENSE'
                  : 'SNAP THE BALL'}
              </span>
            </button>
          </div>

          {/* FAKE SNAP BUTTON (Hard Mode Offense Only, under Execute button) */}
          {!isUserOnDefense && (difficulty === 'Hard' || isClashMode) && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                id="btn-fake-snap"
                disabled={disabled || isPlaySubmittedLocally}
                onClick={() => {
                  const roll = Math.random();
                  if (roll < 0.30) {
                    // 30% chance: Defense offsides (+5 yards, automatic 1st down)
                    playSound.whistle();
                    onExecute({
                      outcomeType: 'PenaltyDefense',
                      customYards: 5,
                      customCommentary: `FAKE SNAP! The defense flinches and jumps early across the line of scrimmage! OFFSIDES on the defense! 5-yard penalty and automatic 1st down!`,
                      preSnapMotion: isPreSnapMotion,
                      isMaxProtection: isMaxProtection,
                    });
                  } else if (roll < 0.45) {
                    // 15% chance: Offense false start (-5 yards)
                    playSound.whistle();
                    onExecute({
                      outcomeType: 'PenaltyOffense',
                      customYards: -5,
                      customCommentary: `FAKE SNAP! The offensive tackle flinches before the snap! FALSE START on the offense! 5-yard penalty, repeat down.`,
                      preSnapMotion: isPreSnapMotion,
                      isMaxProtection: isMaxProtection,
                    });
                  } else {
                    // 55% chance: Defense holds ground (NO PLAY AT ALL, no down lost, play clock reset to 40)
                    playSound.whistle();
                    if (onResetPlayClock) onResetPlayClock();
                    if (onNotice) {
                      onNotice('FAKE SNAP! Defense holds ground. Play clock reset to 40. Replay the down.');
                    }
                  }
                  setIsPreSnapMotion(false);
                  setIsMaxProtection(false);
                }}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-display font-black text-xs uppercase tracking-wider transition shadow-md flex items-center space-x-2 cursor-pointer disabled:opacity-75"
              >
                <span>⚡ FAKE SNAP (Hard Mode)</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* PLAY CALL DROPDOWN MENU - DIRECT ACCESS WITHOUT SCROLLING */}
          {availablePlays.length > 0 && (
            <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 mb-3 space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label htmlFor="scriptmode-play-call-dropdown" className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                  <span className="text-amber-400">{isUserOnDefense ? '🛡️' : '🏈'}</span>
                  <span>{isUserOnDefense ? 'Selected Defensive Play Call' : 'Selected Offensive Play Call'}</span>
                </label>
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {currentActivePlay.formation} • {currentActivePlay.category}
                </span>
              </div>

              <select
                id="scriptmode-play-call-dropdown"
                value={currentActivePlay.id}
                disabled={disabled}
                onChange={(e) => {
                  const selected = availablePlays.find((p) => p.id === e.target.value);
                  if (selected) {
                    if (isUserOnDefense) {
                      onSelectDefensePlay?.(selected);
                    } else {
                      onSelectOffensePlay?.(selected);
                    }
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 hover:border-amber-500 focus:border-amber-400 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none transition cursor-pointer"
              >
                {groupedPlays.map((group) => (
                  <optgroup key={group.label} label={group.label} className="bg-slate-900 text-slate-300 font-bold">
                    {group.plays.map((play) => (
                      <option key={play.id} value={play.id} className="bg-slate-950 text-white font-normal py-1">
                        {play.name} ({play.formation} • {play.category})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {/* Quarter Time Controller: Dropdown ("Remaining game time / How much is taken off") + Input */}
          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 mb-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-200 tracking-wider uppercase">
                  Play Clock Adjustment:
                </span>
                {currentQuarterTimeSeconds !== undefined && (
                  <span className="text-[11px] font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    Quarter {quarter}: {formatClock(currentQuarterTimeSeconds)}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {/* Dropdown with options: "Remaining game time" / "How much is taken off" */}
                <select
                  id="select-play-clock-mode"
                  value={clockDropdownMode}
                  onChange={(e) => {
                    const newMode = e.target.value as 'elapsed' | 'remaining';
                    setClockDropdownMode(newMode);
                    if (newMode === 'remaining') {
                      setClockInputText(
                        currentQuarterTimeSeconds !== undefined
                          ? formatClock(Math.max(0, currentQuarterTimeSeconds - 25))
                          : '2:00'
                      );
                    } else {
                      setClockInputText('25');
                    }
                  }}
                  className="bg-slate-900 border border-slate-700 text-xs text-amber-300 font-semibold rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="elapsed">How much is taken off</option>
                  <option value="remaining">Remaining game time</option>
                </select>

                {/* Input to type how much time the play took off of the quarter */}
                <div className="relative flex items-center">
                  <input
                    id="input-play-clock-time"
                    type="text"
                    value={clockInputText}
                    onChange={(e) => setClockInputText(e.target.value)}
                    placeholder={clockDropdownMode === 'elapsed' ? 'e.g. 25 or 0:25' : 'e.g. 2:00 or 120'}
                    className="w-24 sm:w-28 bg-slate-900 border border-slate-700 text-center font-mono font-bold text-xs text-white rounded px-2 py-1.5 focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                  />
                  <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                    {clockDropdownMode === 'elapsed' ? 'sec' : 'left'}
                  </span>
                </div>
              </div>
            </div>

            {/* Real-time Calculation & Quick Time Presets */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 text-[11px]">
              <div className="text-slate-400 font-medium">
                {clockDropdownMode === 'elapsed' ? (
                  <span>
                    ⏱️ Takes <span className="text-amber-400 font-bold font-mono">{parsedClockSeconds ?? 25}s</span> off the quarter
                    {currentQuarterTimeSeconds !== undefined && (
                      <span className="text-slate-300 ml-1">
                        (Leaves <span className="text-emerald-400 font-mono font-bold">{formatClock(Math.max(0, currentQuarterTimeSeconds - (parsedClockSeconds ?? 25)))}</span> on game clock)
                      </span>
                    )}
                  </span>
                ) : (
                  <span>
                    ⏱️ Quarter game clock will jump directly to{' '}
                    <span className="text-amber-400 font-bold font-mono">
                      {formatClock(parsedClockSeconds ?? 120)}
                    </span>{' '}
                    remaining
                  </span>
                )}
              </div>

              {/* Quick preset chips */}
              <div className="flex items-center space-x-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">Presets:</span>
                {clockDropdownMode === 'elapsed' ? (
                  ['10', '20', '25', '35', '40'].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      id={`btn-time-preset-${sec}`}
                      onClick={() => setClockInputText(sec)}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white transition"
                    >
                      :{sec}s
                    </button>
                  ))
                ) : (
                  ['2:00', '1:00', '0:30', '0:05'].map((timeStr) => (
                    <button
                      key={timeStr}
                      type="button"
                      id={`btn-time-preset-${timeStr.replace(':', '-')}`}
                      onClick={() => setClockInputText(timeStr)}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white transition"
                    >
                      {timeStr}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Protection Scheme & D-Line Dominance Math Bar */}
          <div className="bg-slate-950/90 p-3 rounded-lg border border-slate-800 mb-3 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    O-Line Protection vs {defenseTeam.name} D-Line
                  </span>
                  {isDLineSuperior && (
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 font-mono font-bold px-1.5 py-0.5 rounded border border-rose-500/30">
                      +20 D-LINE STAT BOOST ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  O-Line Math: <span className="text-amber-300 font-bold">{oLineMath.toFixed(1)}</span> ({oLineAvg} OVR ÷ 5) • D-Line Math: <span className="text-cyan-300 font-bold">{dLineMath}</span> ({highestDLine} - {lowestDLine})
                </p>
              </div>
            </div>

            <button
              type="button"
              id="btn-double-team-toggle"
              onClick={() => setIsDoubleTeamed(!isDoubleTeamed)}
              className={`px-3.5 py-1.5 rounded-lg border text-xs font-display font-bold transition flex items-center space-x-2 shadow-md ${
                isDoubleTeamed
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 font-black shadow-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40 hover:border-amber-400'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>
                {isDoubleTeamed
                  ? `🛡️ DOUBLE TEAM ACTIVE (${defenseTeam.starDef || 'MYLES GARRETT'})`
                  : `🛡️ DOUBLE TEAM ${defenseTeam.starDef?.toUpperCase() || 'MYLES GARRETT'}`}
              </span>
            </button>
          </div>

          {/* SCRIPTING CONTEXT SELECTOR: OFFENSIVE TARGET OR DEFENSIVE FOCUS */}
          {isUserOnDefense ? (
            <div className="bg-slate-950/90 p-3 rounded-xl border border-rose-500/30 mb-3 shadow-lg flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Defending: {defenseTeam.name}
                    </span>
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 font-mono font-bold px-2 py-0.5 rounded border border-rose-500/30">
                      VS {offenseTeam.abbr} OFFENSE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Select a defensive preset below to script a stop, takeaway, sack, or penalty.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/30 hidden sm:inline-block">
                DEFENSIVE UNIT
              </span>
            </div>
          ) : (
            <div className="bg-slate-950/90 p-3 rounded-xl border border-amber-500/40 mb-3 shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        {isRunPlay ? 'Ball Carrier / Runner:' : 'Target Receiver / 1st Read:'}
                      </span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold px-2 py-0.5 rounded border border-amber-500/30">
                        {isRunPlay ? 'Select QB to Run the Ball' : `${offenseTeam.name} Roster`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {isRunPlay ? (
                        <>Primary runner on run plays: <strong className="text-amber-400 font-bold">{selectedTarget === 'FIRST_READ' ? `${primaryTargetInfo.name} (${primaryTargetInfo.slotLabel || 'Carrier'}${primaryTargetInfo.ovr ? ` • ${primaryTargetInfo.ovr} OVR` : ''})` : selectedTarget}</strong></>
                      ) : (
                        <>Simulation target on pass plays: <strong className="text-amber-400 font-bold">{selectedTarget === 'FIRST_READ' ? `${primaryTargetInfo.name} (${primaryTargetInfo.slotLabel || '1st Read'}${primaryTargetInfo.ovr ? ` • ${primaryTargetInfo.ovr} OVR` : ''})` : selectedTarget}</strong></>
                      )}
                    </p>
                  </div>
                </div>

                <div className="w-full md:w-auto min-w-[280px]">
                  <select
                    id="select-script-target-receiver"
                    value={selectedTarget}
                    onChange={(e) => {
                      handleSetTarget(e.target.value);
                      setCustomPlayer(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-amber-500/50 hover:border-amber-400 text-xs font-semibold text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400 transition cursor-pointer shadow-inner"
                  >
                    <option value="FIRST_READ">
                      ⭐ Default: {primaryTargetInfo.name} ({primaryTargetInfo.slotLabel || 'Primary'}{primaryTargetInfo.ovr ? ` • ${primaryTargetInfo.ovr} OVR` : ''})
                    </option>
                    <optgroup label="Quarterback & Backfield">
                      <option value={offenseTeam.starQB}>⚡ QB: {offenseTeam.starQB} (QB Run / Keeper)</option>
                      <option value={offenseTeam.starRB}>🏈 RB: {offenseTeam.starRB}</option>
                    </optgroup>
                    <optgroup label={`${offenseTeam.name} Receivers & Tight Ends`}>
                      {teamReceivers.map((rec, idx) => (
                        <option key={`script-target-${rec.depthSlot}-${rec.name}-${idx}`} value={rec.name}>
                          {rec.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'presets' && (
            <div>
              <div className="mb-2 text-xs text-slate-400 flex items-center justify-between">
                <span>
                  {isUserOnDefense
                    ? `Script defensive outcome vs opponent (${offenseTeam.abbr}) offense:`
                    : 'Select the exact outcome you want to script for this play:'}
                </span>
                <span className="text-amber-400/90 font-medium">Click to execute immediately</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {quickPresets.map((preset) => {
                  const isPositive = preset.category === 'positive';
                  const isNegative = preset.category === 'negative';
                  const isSpecial = preset.category === 'special';

                  return (
                    <button
                      key={preset.type}
                      id={`btn-script-${preset.type.toLowerCase()}`}
                      onClick={() => handleExecutePreset(preset.type)}
                      disabled={disabled}
                      className={`group text-left p-2.5 rounded-lg border transition-all relative overflow-hidden flex flex-col justify-between ${
                        isPositive
                          ? 'bg-emerald-950/30 hover:bg-emerald-900/50 border-emerald-700/50 hover:border-emerald-500 text-emerald-100'
                          : isNegative
                          ? 'bg-rose-950/30 hover:bg-rose-900/50 border-rose-700/50 hover:border-rose-500 text-rose-100'
                          : isSpecial
                          ? 'bg-amber-950/30 hover:bg-amber-900/50 border-amber-700/50 hover:border-amber-500 text-amber-100'
                          : 'bg-slate-800/40 hover:bg-slate-800 border-slate-700 hover:border-slate-500 text-slate-200'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-display font-bold text-sm group-hover:text-white">
                          {preset.label}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            isPositive
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : isNegative
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-75 line-clamp-1">{preset.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

      {activeTab === 'custom' && (
        /* Custom Script Studio */
        <div className="space-y-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Yards Slider & Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Yards Gained: <span className="text-amber-400 font-bold font-mono">{customYards > 0 ? `+${customYards}` : customYards}</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="-20"
                  max={Math.min(99, distanceToGoal)}
                  value={customYards}
                  onChange={(e) => setCustomYards(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <input
                  type="number"
                  value={customYards}
                  onChange={(e) => setCustomYards(parseInt(e.target.value) || 0)}
                  className="w-16 bg-slate-900 border border-slate-700 text-center font-bold text-sm text-white rounded p-1"
                />
              </div>
            </div>

            {/* Target Player */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Key Player ({offenseTeam.abbr} WRs/TEs):
              </label>
              <select
                id="select-custom-key-player"
                value={customPlayer}
                onChange={(e) => setCustomPlayer(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded p-1.5 focus:outline-none focus:border-amber-500"
              >
                <option value="FIRST_READ">
                  ⭐ 1st Read: {primaryTargetInfo.name} ({primaryTargetInfo.slotLabel || 'Primary Read'}{primaryTargetInfo.ovr ? ` • ${primaryTargetInfo.ovr} OVR` : ''})
                </option>
                <optgroup label={`${offenseTeam.name} Wide Receivers & Tight Ends`}>
                  {teamReceivers.map((rec, idx) => (
                    <option key={`custom-key-${rec.depthSlot}-${rec.name}-${idx}`} value={rec.name}>
                      {rec.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Other Stars">
                  <option value={offenseTeam.starQB}>QB: {offenseTeam.starQB}</option>
                  <option value={offenseTeam.starRB}>RB: {offenseTeam.starRB}</option>
                  <option value={defenseTeam.starDef}>DEF: {defenseTeam.starDef}</option>
                </optgroup>
              </select>
            </div>

            {/* Play Event */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Event Type:
              </label>
              <select
                value={customEvent}
                onChange={(e) => setCustomEvent(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded p-1.5 focus:outline-none focus:border-amber-500"
              >
                <option value="tackle">Normal Tackle In-Bounds</option>
                <option value="out_of_bounds">Stepped Out of Bounds (Clock Stop)</option>
                <option value="touchdown">Score Touchdown</option>
                <option value="turnover">Turnover to Defense</option>
                <option value="penalty">Penalty Involved</option>
                <option value="safety">Safety (2 Pts)</option>
              </select>
            </div>
          </div>

          {/* Custom Narrative Commentary */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Custom Commentary Text (Optional):
            </label>
            <input
              type="text"
              placeholder={`e.g., ${customPlayer} makes an acrobatic one-handed catch and races for ${customYards} yards!`}
              value={customCommentary}
              onChange={(e) => setCustomCommentary(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded px-3 py-2 focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              id="btn-execute-custom-script"
              onClick={handleExecuteCustom}
              disabled={disabled}
              className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-5 py-2 rounded-lg text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-40"
            >
              <PlayCircle className="w-4 h-4 fill-current" />
              <span>EXECUTE SCRIPTED OUTCOME</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'draw' && (
        /* Draw Exact Play Path Guide */
        <div className="space-y-3 bg-slate-950/70 p-4 rounded-lg border border-cyan-500/30">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-white font-display font-bold text-sm">
                Interactive Play Drawing Mode
              </h4>
              <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">
                Map out exactly how the play unfolded by drawing directly on the football field above!
                Click or touch on the field and drag your route from the line of scrimmage: the ball and players will literally follow your exact drawn trajectory!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <span className="font-mono text-cyan-400 font-bold block mb-0.5">1. DRAW ROUTE</span>
              <span className="text-slate-400 text-[11px]">Click & drag on the 2D field to sketch the exact ball carrier or pass path.</span>
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <span className="font-mono text-amber-400 font-bold block mb-0.5">2. LIVE TRACKING</span>
              <span className="text-slate-400 text-[11px]">The field automatically calculates yards gained, first downs, and touchdowns.</span>
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <span className="font-mono text-emerald-400 font-bold block mb-0.5">3. WATCH IT PLAY OUT</span>
              <span className="text-slate-400 text-[11px]">Hit Execute: the football animates along your exact drawn path with real-time commentary!</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] text-slate-400 font-mono">Quick Run:</span>
              <button
                id="btn-scripter-quick-slant"
                onClick={() => {
                  onExecute({
                    outcomeType: 'CustomYards',
                    customYards: 14,
                    targetPlayer: offenseTeam.starWR,
                    customEvent: 'tackle',
                    customCommentary: `${offenseTeam.starWR} follows the drawn route sharply inside for a clean 14-yard gain and a fresh set of downs!`,
                    isDrawnPlay: true,
                    clockMode: clockDropdownMode,
                    clockValue: parsedClockSeconds,
                  });
                }}
                disabled={disabled}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 font-semibold text-xs transition"
              >
                14-Yd Slant
              </button>
              <button
                id="btn-scripter-quick-post"
                onClick={() => {
                  onExecute({
                    outcomeType: 'CustomYards',
                    customYards: 28,
                    targetPlayer: offenseTeam.starWR,
                    customEvent: 'tackle',
                    customCommentary: `${offenseTeam.starWR} burns past the coverage on the drawn post route for a huge 28-yard pickup!`,
                    isDrawnPlay: true,
                    clockMode: clockDropdownMode,
                    clockValue: parsedClockSeconds,
                  });
                }}
                disabled={disabled}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 font-semibold text-xs transition"
              >
                28-Yd Post
              </button>
              <button
                id="btn-scripter-quick-touchdown"
                onClick={() => {
                  onExecute({
                    outcomeType: 'Touchdown',
                    customYards: 100 - currentYardLine,
                    targetPlayer: offenseTeam.starWR,
                    customEvent: 'touchdown',
                    customCommentary: `${offenseTeam.starWR} follows the drawn route all the way to paydirt... TOUCHDOWN ${offenseTeam.name.toUpperCase()}!`,
                    isDrawnPlay: true,
                    clockMode: clockDropdownMode,
                    clockValue: parsedClockSeconds,
                  });
                }}
                disabled={disabled}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 font-semibold text-xs transition"
              >
                Endzone Streak (TD)
              </button>
            </div>

            <button
              id="btn-activate-draw-field"
              onClick={() => onStartDrawPlayMode?.()}
              disabled={disabled}
              className="flex items-center space-x-2 bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-slate-950 font-display font-black px-5 py-2 rounded-lg text-xs transition shadow-lg shadow-cyan-500/20 disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>{isDrawPlayModeActive ? 'DRAWING ON FIELD ACTIVE' : 'ACTIVATE FIELD DRAW CONSOLE'}</span>
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
