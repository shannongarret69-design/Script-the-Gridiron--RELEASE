import React, { useState, useEffect, useRef } from 'react';
import { Play, OffensiveFormation, DefensiveFormation, RouteType, RunGap, PlayerAssignment, RoutePoint } from '../types/game';
import { DEFAULT_PLAYS } from '../data/defaultPlays';
import { 
  BookOpen, 
  Plus, 
  Save, 
  Trash2, 
  Play as PlayIcon, 
  RotateCcw, 
  Check, 
  Sparkles, 
  Shield, 
  ChevronRight,
  PenTool,
  CheckCircle2,
  Undo2,
  XCircle,
  HelpCircle,
  Target,
  Users
} from 'lucide-react';
import { getUserClashTargetPlayers, TeamReceiverOption } from '../utils/receiverTargeting';

interface PlaybookEditorProps {
  onPlaySaved?: (play: Play) => void;
}

const ROUTE_DEFINITIONS: { type: RouteType; label: string; desc: string; defaultWaypoints: RoutePoint[] }[] = [
  { type: 'Go', label: 'Streak / Go', desc: 'Full vertical sprint downfield', defaultWaypoints: [{ x: 50, y: 15 }] },
  { type: 'Slant', label: 'Quick Slant', desc: '3 steps then sharp 45° angle inside', defaultWaypoints: [{ x: 50, y: 55 }, { x: 70, y: 38 }] },
  { type: 'Post', label: 'Deep Post', desc: 'Deep vertical stem cutting toward goalposts', defaultWaypoints: [{ x: 50, y: 40 }, { x: 65, y: 15 }] },
  { type: 'Corner', label: 'Corner / Flag', desc: 'Deep vertical stem breaking to pylon', defaultWaypoints: [{ x: 50, y: 45 }, { x: 30, y: 20 }] },
  { type: 'Out', label: 'Quick Out', desc: 'Sharp 90° cut toward sideline', defaultWaypoints: [{ x: 50, y: 52 }, { x: 25, y: 52 }] },
  { type: 'In', label: 'Dig / In', desc: 'Square 90° cut across intermediate middle', defaultWaypoints: [{ x: 50, y: 42 }, { x: 75, y: 42 }] },
  { type: 'Curl', label: 'Hitch / Curl', desc: 'Sprint 10 yards and spin back to QB', defaultWaypoints: [{ x: 50, y: 48 }, { x: 50, y: 52 }] },
  { type: 'Drag', label: 'Shallow Drag', desc: 'Underneath crossing route under linebackers', defaultWaypoints: [{ x: 50, y: 62 }, { x: 85, y: 60 }] },
  { type: 'Wheel', label: 'Wheel Route', desc: 'Release into flat then burst up sideline', defaultWaypoints: [{ x: 70, y: 70 }, { x: 85, y: 35 }] },
  { type: 'Screen', label: 'Slip Screen', desc: 'Retreat behind pulling linemen wall', defaultWaypoints: [{ x: 45, y: 72 }, { x: 30, y: 68 }, { x: 20, y: 35 }] },
  { type: 'Flat', label: 'Flat Route', desc: 'Immediate release to boundary', defaultWaypoints: [{ x: 35, y: 68 }, { x: 18, y: 64 }] },
  { type: 'Block', label: 'Pass Protect', desc: 'Stay in backfield / line to pass block', defaultWaypoints: [] },
];

export const PlaybookEditor: React.FC<PlaybookEditorProps> = ({ onPlaySaved }) => {
  const [playType, setPlayType] = useState<'Offense' | 'Defense'>('Offense');
  const [customPlays, setCustomPlays] = useState<Play[]>([]);
  const [selectedFormation, setSelectedFormation] = useState<OffensiveFormation | DefensiveFormation>('Shotgun');
  const [currentPlay, setCurrentPlay] = useState<Play>(DEFAULT_PLAYS[0]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('wr1');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<number>(0);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [routeConfirmedToast, setRouteConfirmedToast] = useState<string | null>(null);

  // User's active roster targets (includes 60 OVR starter players from Clash dynasty)
  const [rosterTargets, setRosterTargets] = useState<TeamReceiverOption[]>([]);

  useEffect(() => {
    try {
      const targets = getUserClashTargetPlayers();
      setRosterTargets(targets);
    } catch {
      // Ignore
    }
  }, []);

  const handleAssignRosterPlayer = (rosterPlayer: TeamReceiverOption) => {
    if (!selectedPlayerId) return;
    const updatedAssignments = currentPlay.assignments.map((a) => {
      if (a.id === selectedPlayerId) {
        return {
          ...a,
          playerName: rosterPlayer.name,
          playerOvr: rosterPlayer.ovr,
          isPrimary: true, // Auto-lock as primary target when explicitly assigned
        };
      }
      return a;
    });
    setCurrentPlay({
      ...currentPlay,
      assignments: updatedAssignments,
    });
    setRouteConfirmedToast(`🎯 Locked ${rosterPlayer.name} (${rosterPlayer.ovr} OVR) as 1st Read Target!`);
    setTimeout(() => setRouteConfirmedToast(null), 3000);
  };

  // Switch between Offense & Defense Playbooks
  const handlePlayTypeSwitch = (type: 'Offense' | 'Defense') => {
    setPlayType(type);
    if (type === 'Offense') {
      setSelectedFormation('Shotgun');
      const offPlay = DEFAULT_PLAYS.find((p) => p.type === 'Offense') || DEFAULT_PLAYS[0];
      setCurrentPlay(offPlay);
      setSelectedPlayerId(offPlay.assignments[2]?.id || offPlay.assignments[0]?.id || 'wr1');
    } else {
      setSelectedFormation('4-3');
      const defPlay = DEFAULT_PLAYS.find((p) => p.type === 'Defense') || DEFAULT_PLAYS[9];
      setCurrentPlay(defPlay);
      setSelectedPlayerId(defPlay.assignments[0]?.id || 'de1');
    }
    setIsDrawMode(false);
    setDrawnPoints([]);
  };

  // Route Drawing State
  const [isDrawMode, setIsDrawMode] = useState<boolean>(false);
  const [drawnPoints, setDrawnPoints] = useState<RoutePoint[]>([]);
  const [isMouseDownDrawing, setIsMouseDownDrawing] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Load custom plays from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gridiron_custom_plays');
      if (saved) {
        setCustomPlays(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  // Save custom plays to localStorage
  const persistCustomPlays = (updated: Play[]) => {
    setCustomPlays(updated);
    try {
      localStorage.setItem('gridiron_custom_plays', JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  // Test Run Play Animation
  useEffect(() => {
    if (!isSimulating) return;
    let animFrame: number;
    let start = performance.now();
    const duration = 2400; // 2.4s animation

    const loop = (now: number) => {
      const elapsed = now - start;
      const prog = Math.min(1, elapsed / duration);
      setSimProgress(prog);

      if (prog < 1) {
        animFrame = requestAnimationFrame(loop);
      } else {
        setTimeout(() => {
          setIsSimulating(false);
          setSimProgress(0);
        }, 400);
      }
    };

    animFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrame);
  }, [isSimulating]);

  // Switch formation templates
  const handleFormationChange = (formation: OffensiveFormation | DefensiveFormation) => {
    setSelectedFormation(formation);
    const pool = DEFAULT_PLAYS.filter((p) => p.type === playType);
    const found = pool.find((p) => p.formation === formation) || pool[0] || DEFAULT_PLAYS[0];
    const newPlay: Play = {
      ...found,
      type: playType,
      id: `custom-${playType.toLowerCase()}-${Date.now()}`,
      name: `Custom ${formation} ${playType === 'Offense' ? 'Concept' : 'Defense'}`,
      isCustom: true,
    };
    setCurrentPlay(newPlay);
    setSelectedPlayerId(newPlay.assignments[0]?.id || 'wr1');
    setIsDrawMode(false);
    setDrawnPoints([]);
  };

  // Assign predefined route to selected player
  const handleAssignRoute = (routeDef: typeof ROUTE_DEFINITIONS[0]) => {
    const updatedAssignments = currentPlay.assignments.map((assign) => {
      if (assign.id === selectedPlayerId) {
        const adjustedWaypoints = routeDef.defaultWaypoints.map((pt) => {
          const offsetX = pt.x - 50;
          return {
            x: Math.max(5, Math.min(95, assign.startX + offsetX)),
            y: pt.y,
          };
        });

        return {
          ...assign,
          route: routeDef.type,
          waypoints: adjustedWaypoints,
        };
      }
      return assign;
    });

    setCurrentPlay({
      ...currentPlay,
      assignments: updatedAssignments,
    });
    setIsDrawMode(false);
    setDrawnPoints([]);
  };

  // Start Drawing Route for Selected Player
  const handleStartDrawRoute = () => {
    const player = currentPlay.assignments.find((a) => a.id === selectedPlayerId);
    if (!player) return;
    setIsDrawMode(true);
    // Initialize with player's existing waypoints or empty
    setDrawnPoints(player.waypoints ? [...player.waypoints] : []);
  };

  // Convert SVG Mouse Event to (0-100, 0-100) coordinates
  const getCoordinatesFromEvent = (e: React.MouseEvent<SVGSVGElement>): RoutePoint | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    const normX = Math.max(2, Math.min(98, (xPx / rect.width) * 100));
    const normY = Math.max(2, Math.min(98, (yPx / rect.height) * 100));

    return {
      x: Math.round(normX * 10) / 10,
      y: Math.round(normY * 10) / 10,
    };
  };

  // Handle Chalkboard Click / Drag for Route Drawing
  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawMode) return;
    const pt = getCoordinatesFromEvent(e);
    if (!pt) return;

    setIsMouseDownDrawing(true);
    setDrawnPoints((prev) => [...prev, pt]);
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawMode || !isMouseDownDrawing) return;
    const pt = getCoordinatesFromEvent(e);
    if (!pt) return;

    // Throttle distance between continuous points
    const lastPt = drawnPoints[drawnPoints.length - 1];
    if (lastPt) {
      const dist = Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y);
      if (dist < 4) return; // ignore tiny jitters
    }

    setDrawnPoints((prev) => [...prev, pt]);
  };

  const handleSvgMouseUp = () => {
    if (isMouseDownDrawing) {
      setIsMouseDownDrawing(false);
    }
  };

  // Confirm and save drawn custom route
  const handleConfirmDrawnRoute = () => {
    if (drawnPoints.length === 0) {
      alert('Please click or drag on the chalkboard field to draw at least one route waypoint before confirming.');
      return;
    }

    const updatedAssignments = currentPlay.assignments.map((assign) => {
      if (assign.id === selectedPlayerId) {
        return {
          ...assign,
          route: 'Custom' as RouteType,
          waypoints: [...drawnPoints],
        };
      }
      return assign;
    });

    const updatedPlay = {
      ...currentPlay,
      assignments: updatedAssignments,
    };

    setCurrentPlay(updatedPlay);
    setIsDrawMode(false);
    setRouteConfirmedToast(`Custom route confirmed for ${selectedPlayer?.label || 'receiver'}!`);
    setTimeout(() => setRouteConfirmedToast(null), 3000);
  };

  // Undo last drawn point
  const handleUndoPoint = () => {
    setDrawnPoints((prev) => prev.slice(0, -1));
  };

  // Clear all drawn points
  const handleClearPath = () => {
    setDrawnPoints([]);
  };

  // Cancel draw mode
  const handleCancelDraw = () => {
    setIsDrawMode(false);
    setDrawnPoints([]);
  };

  // Toggle primary receiver
  const handleTogglePrimary = (playerId: string) => {
    const updated = currentPlay.assignments.map((a) => ({
      ...a,
      isPrimary: a.id === playerId,
    }));
    setCurrentPlay({ ...currentPlay, assignments: updated });
  };

  // Save current play to playbook
  const handleSavePlay = () => {
    const playToSave: Play = {
      ...currentPlay,
      id: currentPlay.id.startsWith('custom-') ? currentPlay.id : `custom-${Date.now()}`,
      isCustom: true,
    };

    const existingIdx = customPlays.findIndex((p) => p.id === playToSave.id);
    let updatedList: Play[];
    if (existingIdx >= 0) {
      updatedList = [...customPlays];
      updatedList[existingIdx] = playToSave;
    } else {
      updatedList = [playToSave, ...customPlays];
    }

    persistCustomPlays(updatedList);
    setSaveSuccess(true);
    if (onPlaySaved) onPlaySaved(playToSave);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Delete a custom play
  const handleDeletePlay = (playId: string) => {
    const updated = customPlays.filter((p) => p.id !== playId);
    persistCustomPlays(updated);
    if (currentPlay.id === playId) {
      setCurrentPlay(DEFAULT_PLAYS[0]);
    }
  };

  const selectedPlayer = currentPlay.assignments.find((a) => a.id === selectedPlayerId);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {routeConfirmedToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-slate-950 px-4 py-2.5 rounded-2xl font-display font-black text-xs shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{routeConfirmedToast}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-display font-black text-xs uppercase tracking-wider">
                TACTICAL CHALKBOARD
              </span>
              <span className="text-xs text-slate-400 font-mono">NFL CUSTOM PLAYBOOK CREATOR</span>
            </div>
            <h2 className="font-display font-black text-2xl text-white tracking-wide mt-1">
              CUSTOM PLAYBOOK & <span className="text-cyan-400">ROUTE DRAWING STUDIO</span>
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              Freehand draw custom receiver routes, designate your primary reads, tune blocking schemes, and test animated simulated executions.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
          {/* Playbook Mode Switcher */}
          <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-2xl">
            <button
              onClick={() => handlePlayTypeSwitch('Offense')}
              className={`px-4 py-2 rounded-xl font-display font-black text-xs transition ${
                playType === 'Offense'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              OFFENSIVE PLAYBOOK
            </button>
            <button
              onClick={() => handlePlayTypeSwitch('Defense')}
              className={`px-4 py-2 rounded-xl font-display font-black text-xs transition ${
                playType === 'Defense'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              DEFENSIVE PLAYBOOK
            </button>
          </div>

          <button
            id="btn-test-run-play"
            onClick={() => setIsSimulating(true)}
            disabled={isSimulating}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-display font-bold text-xs border border-slate-700 transition disabled:opacity-50"
          >
            <PlayIcon className="w-4 h-4 text-cyan-400 fill-cyan-400" />
            <span>{isSimulating ? 'SIMULATING...' : 'TEST RUN PLAY'}</span>
          </button>

          <button
            id="btn-save-custom-play"
            onClick={handleSavePlay}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-display font-black text-xs shadow-lg shadow-cyan-500/25 transition"
          >
            {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{saveSuccess ? 'SAVED TO PLAYBOOK!' : 'SAVE PLAY'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Selector (3 cols), Center Chalkboard (6 cols), Right Route Palette (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Formations & Concept Metadata */}
        <div className="lg:col-span-3 space-y-4">
          {/* Formation Picker */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="font-display font-bold text-xs text-slate-300 uppercase tracking-wider">
              1. {playType} Base Formation
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(playType === 'Offense'
                ? ['Shotgun', 'Singleback', 'I-Form', 'Pistol', 'Empty', 'Spread']
                : ['4-3', '3-4', 'Nickel', 'Dime', 'GoalLine']
              ).map((form) => (
                <button
                  key={form}
                  onClick={() => handleFormationChange(form as any)}
                  className={`p-2.5 rounded-xl text-left font-display font-bold text-xs transition border ${
                    selectedFormation === form
                      ? playType === 'Offense'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                        : 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  {form}
                </button>
              ))}
            </div>
          </div>

          {/* Play Name & Category */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="font-display font-bold text-xs text-slate-300 uppercase tracking-wider">
              2. Play Metadata
            </h3>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Play Name:</label>
              <input
                type="text"
                value={currentPlay.name}
                onChange={(e) => setCurrentPlay({ ...currentPlay, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Category:</label>
                <select
                  value={currentPlay.category}
                  onChange={(e) => setCurrentPlay({ ...currentPlay, category: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {playType === 'Offense' ? (
                    <>
                      <option value="Pass">Pass</option>
                      <option value="PlayAction">Play Action</option>
                      <option value="Run">Run</option>
                      <option value="RPO">RPO</option>
                      <option value="Trick">Trick Play</option>
                    </>
                  ) : (
                    <>
                      <option value="Zone">Zone Coverage</option>
                      <option value="Man">Man Coverage</option>
                      <option value="Blitz">Blitz Pressure</option>
                      <option value="Coverage">Pass Shell</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Pass Concept:</label>
                <select
                  value={currentPlay.passConcept || 'Flood'}
                  onChange={(e) => setCurrentPlay({ ...currentPlay, passConcept: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Flood">Flood</option>
                  <option value="Mesh">Mesh</option>
                  <option value="Smash">Smash</option>
                  <option value="FourVerticals">Four Verticals</option>
                  <option value="Levels">Levels</option>
                  <option value="Dagger">Dagger</option>
                  <option value="Drive">Drive</option>
                  <option value="ShallowCross">Shallow Cross</option>
                </select>
              </div>
            </div>
          </div>

          {/* Saved Custom Plays Library */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="font-display font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Saved Custom Plays ({customPlays.length})</span>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            </h3>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {customPlays.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No custom created plays yet.</p>
              ) : (
                customPlays.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setCurrentPlay(p);
                      setSelectedFormation(p.formation as OffensiveFormation);
                    }}
                    className={`p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition border ${
                      currentPlay.id === p.id
                        ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300 font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlay(p.id);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: SVG Chalkboard Diagram with Freehand Route Drawing (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isDrawMode ? 'bg-amber-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`} />
                <span className="font-display font-bold text-sm text-white uppercase tracking-wider">
                  Chalkboard Diagram: {currentPlay.name}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {isDrawMode ? '✏️ Drawing Active • Click / drag to plot path' : 'Click any player to assign/draw routes'}
              </span>
            </div>

            {/* Drawing Mode Banner if active */}
            {isDrawMode && selectedPlayer && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center space-x-2">
                  <PenTool className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300">
                    Drawing Custom Route for: {selectedPlayer.label} ({selectedPlayer.position})
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {drawnPoints.length} points plotted
                </span>
              </div>
            )}

            {/* SVG Chalkboard */}
            <div className={`relative rounded-2xl overflow-hidden border-2 bg-slate-950 select-none shadow-inner ${
              isDrawMode ? 'border-amber-400 ring-2 ring-amber-400/30 cursor-crosshair' : 'border-slate-700'
            }`}>
              <svg 
                ref={svgRef}
                viewBox="0 0 600 450" 
                className="w-full h-auto block"
                onMouseDown={handleSvgMouseDown}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleSvgMouseUp}
              >
                {/* Chalkboard Grid and Yard lines */}
                <defs>
                  <pattern id="chalk-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.4" />
                  </pattern>
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                  </marker>
                  <marker id="arrow-primary" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#facc15" />
                  </marker>
                  <marker id="arrow-drawing" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                  </marker>
                </defs>

                <rect width="600" height="450" fill="#090d16" />
                <rect width="600" height="450" fill="url(#chalk-grid)" />

                {/* Line of Scrimmage Line */}
                <line x1="0" y1="310" x2="600" y2="310" stroke="#38bdf8" strokeWidth="2" strokeDasharray="5 5" />
                <text x="590" y="305" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="end" fontFamily="'Chakra Petch', sans-serif">
                  LINE OF SCRIMMAGE
                </text>

                {/* 10 Yard Downfield Line */}
                <line x1="0" y1="190" x2="600" y2="190" stroke="#facc15" strokeWidth="1.5" strokeOpacity="0.6" strokeDasharray="4 4" />
                <text x="590" y="185" fill="#facc15" fontSize="10" fontWeight="bold" textAnchor="end" fontFamily="'Chakra Petch', sans-serif" opacity="0.8">
                  FIRST DOWN (+10 YDS)
                </text>

                {/* 20 Yard Downfield Line */}
                <line x1="0" y1="70" x2="600" y2="70" stroke="#94a3b8" strokeWidth="1" strokeOpacity="0.4" />

                {/* Established Routes Drawn */}
                {currentPlay.assignments.map((assign) => {
                  // If we are currently drawing for this specific player, render the live drawn points instead
                  if (isDrawMode && assign.id === selectedPlayerId) return null;
                  if (!assign.waypoints || assign.waypoints.length === 0) return null;

                  const startPx = (assign.startX / 100) * 600;
                  const startPy = (assign.startY / 100) * 450;

                  let d = `M ${startPx} ${startPy}`;
                  assign.waypoints.forEach((pt) => {
                    const wx = (pt.x / 100) * 600;
                    const wy = (pt.y / 100) * 450;
                    d += ` L ${wx} ${wy}`;
                  });

                  return (
                    <g key={assign.id}>
                      <path
                        d={d}
                        fill="none"
                        stroke={assign.isPrimary ? '#facc15' : assign.id === selectedPlayerId ? '#38bdf8' : '#94a3b8'}
                        strokeWidth={assign.isPrimary ? 3.5 : assign.id === selectedPlayerId ? 3 : 2}
                        strokeDasharray={assign.route === 'Block' ? '4 4' : undefined}
                        markerEnd={assign.isPrimary ? 'url(#arrow-primary)' : 'url(#arrow)'}
                        opacity={isSimulating ? 0.35 : 0.9}
                      />
                    </g>
                  );
                })}

                {/* Live Drawn Route Preview when in Draw Mode */}
                {isDrawMode && selectedPlayer && (
                  <g>
                    {/* Start Anchor Point */}
                    <circle
                      cx={(selectedPlayer.startX / 100) * 600}
                      cy={(selectedPlayer.startY / 100) * 450}
                      r="8"
                      fill="#f59e0b"
                      opacity="0.6"
                      className="animate-pulse"
                    />

                    {/* Drawn Path Line */}
                    {(() => {
                      const startPx = (selectedPlayer.startX / 100) * 600;
                      const startPy = (selectedPlayer.startY / 100) * 450;
                      let d = `M ${startPx} ${startPy}`;
                      drawnPoints.forEach((pt) => {
                        const wx = (pt.x / 100) * 600;
                        const wy = (pt.y / 100) * 450;
                        d += ` L ${wx} ${wy}`;
                      });

                      return (
                        <path
                          d={d}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="3.5"
                          markerEnd="url(#arrow-drawing)"
                          filter="drop-shadow(0 0 8px rgba(245, 158, 11, 0.7))"
                        />
                      );
                    })()}

                    {/* Individual Waypoint markers */}
                    {drawnPoints.map((pt, idx) => (
                      <circle
                        key={idx}
                        cx={(pt.x / 100) * 600}
                        cy={(pt.y / 100) * 450}
                        r="4"
                        fill="#ffffff"
                        stroke="#f59e0b"
                        strokeWidth="2"
                      />
                    ))}
                  </g>
                )}

                {/* Players Circles */}
                {currentPlay.assignments.map((assign) => {
                  let px = (assign.startX / 100) * 600;
                  let py = (assign.startY / 100) * 450;

                  // If animating, interpolate along waypoints
                  if (isSimulating && assign.waypoints && assign.waypoints.length > 0) {
                    const allPts = [{ x: assign.startX, y: assign.startY }, ...assign.waypoints];
                    // Multi-segment interpolation
                    const totalSegments = allPts.length - 1;
                    const segmentProgress = simProgress * totalSegments;
                    const currSegmentIdx = Math.min(totalSegments - 1, Math.floor(segmentProgress));
                    const segSubProg = segmentProgress - currSegmentIdx;

                    const pA = allPts[currSegmentIdx];
                    const pB = allPts[currSegmentIdx + 1];

                    if (pA && pB) {
                      const startPx = (pA.x / 100) * 600;
                      const startPy = (pA.y / 100) * 450;
                      const endPx = (pB.x / 100) * 600;
                      const endPy = (pB.y / 100) * 450;
                      px = startPx + (endPx - startPx) * segSubProg;
                      py = startPy + (endPy - startPy) * segSubProg;
                    }
                  }

                  const isSelected = assign.id === selectedPlayerId;
                  const isLineman = assign.route === 'Block' && ['LT', 'LG', 'C', 'RG', 'RT'].includes(assign.position);

                  return (
                    <g
                      key={assign.id}
                      onClick={() => !isLineman && setSelectedPlayerId(assign.id)}
                      className={!isLineman ? 'cursor-pointer' : ''}
                      transform={`translate(${px}, ${py})`}
                    >
                      <circle
                        r={isSelected ? 14 : 12}
                        fill={
                          assign.isPrimary
                            ? '#facc15'
                            : isSelected
                            ? '#0284c7'
                            : isLineman
                            ? '#334155'
                            : '#1e293b'
                        }
                        stroke={isSelected ? '#38bdf8' : assign.isPrimary ? '#ffffff' : '#475569'}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
                      />
                      <text
                        y="4"
                        fill={assign.isPrimary ? '#000000' : '#ffffff'}
                        fontSize="9"
                        fontWeight="bold"
                        fontFamily="'Chakra Petch', sans-serif"
                        textAnchor="middle"
                      >
                        {assign.label}
                      </text>

                      {/* Display Targeted 60 OVR Roster Player Name & Rating */}
                      {assign.playerName && (
                        <g transform="translate(0, 20)">
                          <rect
                            x={-((Math.min(assign.playerName.length, 14) * 4.5 + 24) / 2)}
                            y="-8"
                            width={Math.min(assign.playerName.length, 14) * 4.5 + 24}
                            height="13"
                            rx="3"
                            fill="#090d16"
                            stroke={assign.isPrimary ? '#facc15' : '#38bdf8'}
                            strokeWidth="1"
                            opacity="0.95"
                          />
                          <text
                            y="1"
                            fill={assign.isPrimary ? '#facc15' : '#38bdf8'}
                            fontSize="7.5"
                            fontWeight="bold"
                            fontFamily="'Chakra Petch', sans-serif"
                            textAnchor="middle"
                          >
                            {assign.playerName.split(' ')[1] || assign.playerName} ({assign.playerOvr || 60})
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* DRAW ROUTE TOOLBAR CONTROLS */}
            {isDrawMode ? (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center space-x-2">
                  <button
                    id="btn-undo-route-point"
                    onClick={handleUndoPoint}
                    disabled={drawnPoints.length === 0}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition disabled:opacity-40"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Undo Point</span>
                  </button>

                  <button
                    id="btn-clear-route-path"
                    onClick={handleClearPath}
                    disabled={drawnPoints.length === 0}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition disabled:opacity-40"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>

                  <button
                    onClick={handleCancelDraw}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                </div>

                {/* THE CONFIRM ROUTE BUTTON REQUIRED BY USER */}
                <button
                  id="btn-confirm-route"
                  onClick={handleConfirmDrawnRoute}
                  disabled={drawnPoints.length === 0}
                  className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-display font-black text-xs shadow-lg shadow-amber-500/25 transition disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>CONFIRM ROUTE ✅</span>
                </button>
              </div>
            ) : (
              selectedPlayer && selectedPlayer.route !== 'Block' && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-400">
                    Want to create a custom stem or break?
                  </span>
                  <button
                    id="btn-start-draw-route"
                    onClick={handleStartDrawRoute}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-display font-bold text-xs border border-cyan-500/40 transition"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>✏️ DRAW CUSTOM ROUTE ON FIELD</span>
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Route Selector & Assignment Studio (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <h3 className="font-display font-bold text-xs text-slate-300 uppercase tracking-wider">
              Selected Receiver
            </h3>

            {selectedPlayer ? (
              <div className="space-y-4">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-white block">
                        {selectedPlayer.label} ({selectedPlayer.position})
                      </span>
                      <span className="text-[11px] text-cyan-400 font-mono">
                        Route: {selectedPlayer.route || 'Block'}
                      </span>
                    </div>

                    <button
                      id="btn-toggle-primary-read"
                      onClick={() => handleTogglePrimary(selectedPlayer.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                        selectedPlayer.isPrimary
                          ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/30 ring-2 ring-amber-300'
                          : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{selectedPlayer.isPrimary ? '1ST READ TARGET ★' : 'Set as 1st Read'}</span>
                    </button>
                  </div>

                  {/* 1st Read Simulation Depth Guarantee Callout */}
                  {selectedPlayer.isPrimary && (
                    <div className="bg-amber-500/15 border border-amber-500/40 rounded-lg p-2 text-[11px] text-amber-300 leading-snug">
                      ⭐ <strong>Primary Simulation Target:</strong> When this play is selected, <strong>{selectedPlayer.label}</strong> is the primary read option and is guaranteed to receive the pass target in game simulation and scripting (e.g. WR2 = Davante Adams on Rams).
                    </div>
                  )}

                  {/* Roster Player Targeting Section */}
                  <div className="pt-2 border-t border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center space-x-1.5">
                        <Target className="w-3.5 h-3.5 text-amber-400" />
                        <span>Target Roster Player (60 OVR Squad):</span>
                      </label>
                      <span className="text-[9px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">
                        {rosterTargets.length} Players
                      </span>
                    </div>

                    {/* Quick-pick buttons for 60 OVR Starters */}
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 font-semibold">Quick 60 OVR Starter Targets:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {rosterTargets.slice(0, 6).map((rt, idx) => {
                          const isTargeted = selectedPlayer.playerName === rt.name;
                          return (
                            <button
                              key={`quick-target-${rt.name}-${idx}`}
                              type="button"
                              onClick={() => handleAssignRosterPlayer(rt)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer ${
                                isTargeted
                                  ? 'bg-amber-400 text-slate-950 font-black shadow ring-1 ring-amber-300'
                                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-400/50'
                              }`}
                            >
                              <span>{rt.name.split(' ')[0]} ({rt.depthSlot} • {rt.ovr})</span>
                              {isTargeted && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dropdown for all roster options */}
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 font-semibold">Select from Full Roster:</div>
                      <select
                        id="playbook-roster-target-select"
                        value={selectedPlayer.playerName || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) {
                            const updated = currentPlay.assignments.map((a) => {
                              if (a.id === selectedPlayer.id) {
                                return { ...a, playerName: undefined, playerOvr: undefined };
                              }
                              return a;
                            });
                            setCurrentPlay({ ...currentPlay, assignments: updated });
                            return;
                          }
                          const found = rosterTargets.find((r) => r.name === val);
                          if (found) {
                            handleAssignRosterPlayer(found);
                          } else {
                            const updated = currentPlay.assignments.map((a) => {
                              if (a.id === selectedPlayer.id) {
                                return { ...a, playerName: val, playerOvr: 60 };
                              }
                              return a;
                            });
                            setCurrentPlay({ ...currentPlay, assignments: updated });
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-amber-500 text-xs text-white rounded-lg px-2.5 py-2 focus:outline-none transition cursor-pointer"
                      >
                        <option value="">-- Auto: Team {selectedPlayer.label} depth slot --</option>
                        {rosterTargets.map((r, idx) => (
                          <option key={`opt-${r.name}-${idx}`} value={r.name}>
                            ⭐ {r.name} ({r.depthSlot} • {r.ovr} OVR)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Currently Targeted Player Status */}
                    {selectedPlayer.playerName ? (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                        <div className="flex items-center space-x-1.5 truncate">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">
                            Target Locked: <strong>{selectedPlayer.playerName}</strong> ({selectedPlayer.playerOvr || 60} OVR)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = currentPlay.assignments.map((a) => {
                              if (a.id === selectedPlayer.id) {
                                return { ...a, playerName: undefined, playerOvr: undefined };
                              }
                              return a;
                            });
                            setCurrentPlay({ ...currentPlay, assignments: updated });
                          }}
                          className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer shrink-0 ml-2"
                        >
                          Reset
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500">
                        Click any 60 OVR starter above or choose from the dropdown to lock them as this route's target.
                      </p>
                    )}
                  </div>

                  {/* Draw button right in receiver card */}
                  {selectedPlayer.route !== 'Block' && (
                    <button
                      id="btn-panel-draw-route"
                      onClick={handleStartDrawRoute}
                      className={`w-full py-2 rounded-xl text-xs font-display font-black flex items-center justify-center space-x-2 transition ${
                        isDrawMode
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700'
                      }`}
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>{isDrawMode ? 'DRAWING IN PROGRESS...' : 'DRAW CUSTOM ROUTE'}</span>
                    </button>
                  )}
                </div>

                {/* Route Tree Grid */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Standard Madden Route Tree:
                  </h4>
                  <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {ROUTE_DEFINITIONS.map((r) => {
                      const isCurrent = selectedPlayer.route === r.type;
                      return (
                        <button
                          key={r.type}
                          id={`btn-route-${r.type.toLowerCase()}`}
                          onClick={() => handleAssignRoute(r)}
                          className={`p-2 rounded-xl border text-left transition ${
                            isCurrent
                              ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-md shadow-cyan-500/20'
                              : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <span className="font-display font-bold text-xs block truncate">
                            {r.label}
                          </span>
                          <span className="text-[10px] opacity-75 line-clamp-1 block">
                            {r.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Select a receiver to modify route.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
