import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ActiveGame, Play, PlayResult, DrawnStroke } from '../types/game';
import { ScriptExecutionParams } from '../utils/playEngine';
import { yardToFieldX, fieldXToYard, samplePolyline, pointsToSvgPath, Point } from '../utils/trajectoryUtils';
import { getTeamReceiversAndTEs, getPlayPrimaryTarget } from '../utils/receiverTargeting';
import { PenTool, Trash2, RotateCcw, Play as PlayIcon, Check, X, ArrowRight, Sparkles, Shield, Flag, Maximize2, Minimize2 } from 'lucide-react';

interface FootballFieldProps {
  game: ActiveGame;
  offensePlay?: Play;
  defensePlay?: Play;
  isAnimating?: boolean;
  animProgress?: number; // 0 to 1
  lastResult?: PlayResult;
  onExecuteDrawnPlay?: (params: ScriptExecutionParams) => void;
  isExternalDrawMode?: boolean;
  onToggleExternalDrawMode?: (active: boolean) => void;
}

export const FootballField: React.FC<FootballFieldProps> = ({
  game,
  offensePlay,
  defensePlay,
  isAnimating = false,
  animProgress = 0,
  lastResult,
  onExecuteDrawnPlay,
  isExternalDrawMode = false,
  onToggleExternalDrawMode,
}) => {
  const { homeTeam, awayTeam, possession, yardLine, down, distance } = game;
  const isHomePoss = possession === 'home';
  const possessingTeam = isHomePoss ? homeTeam : awayTeam;
  const defendingTeam = isHomePoss ? awayTeam : homeTeam;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const fieldContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Toggle field display fullscreen
  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        if (fieldContainerRef.current?.requestFullscreen) {
          await fieldContainerRef.current.requestFullscreen().catch(() => {});
        }
        setIsFullscreen(true);
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const [isZoomed50, setIsZoomed50] = useState<boolean>(true);
  const VIEW_WIDTH_ZOOMED = 450; // Covers ~50 yards of the 1000px field
  const [cameraX, setCameraX] = useState<number>(() => {
    return Math.max(0, Math.min(1000 - 450, yardToFieldX(yardLine) - 160));
  });
  const [isPanningField, setIsPanningField] = useState<boolean>(false);
  const [panStartX, setPanStartX] = useState<number>(0);
  const [panInitCameraX, setPanInitCameraX] = useState<number>(0);

  // Line of scrimmage and 1st down positions in SVG pixels
  const scrimmageX = yardToFieldX(yardLine);
  const firstDownYard = Math.min(100, yardLine + distance);
  const firstDownX = yardToFieldX(firstDownYard);

  // Auto-center camera on scrimmage line when yard line changes
  useEffect(() => {
    if (isZoomed50) {
      const idealCam = Math.max(0, Math.min(1000 - VIEW_WIDTH_ZOOMED, scrimmageX - 160));
      setCameraX(idealCam);
    }
  }, [scrimmageX, isZoomed50]);

  // --- DRAWING TOOL STATES ---
  // Chalkboard mode: Freehand route drawing (Optional)
  const [isChalkboardOpen, setIsChalkboardOpen] = useState<boolean>(false);
  const [chalkboardStrokes, setChalkboardStrokes] = useState<DrawnStroke[]>([]);
  const [currentChalkStroke, setCurrentChalkStroke] = useState<Point[] | null>(null);
  const [chalkColor, setChalkColor] = useState<string>('#facc15'); // Gold
  const [chalkWidth, setChalkWidth] = useState<number>(3.5);
  const [chalkArrow, setChalkArrow] = useState<boolean>(true);

  // Exact Play Path Draw Mode: "Draw how the play went exactly"
  const fieldPrimaryTarget = useMemo(() => {
    return getPlayPrimaryTarget(offensePlay, possessingTeam);
  }, [offensePlay, possessingTeam]);

  const possessingTeamReceivers = useMemo(() => {
    return getTeamReceiversAndTEs(possessingTeam.id);
  }, [possessingTeam.id]);

  const [isDrawingPlayPath, setIsDrawingPlayPath] = useState<boolean>(false);
  const [drawnPlayPoints, setDrawnPlayPoints] = useState<Point[]>([]);
  const [isDrawingActive, setIsDrawingActive] = useState<boolean>(false);
  const [drawnPlayer, setDrawnPlayer] = useState<string>(fieldPrimaryTarget.name);
  const [drawnPlayType, setDrawnPlayType] = useState<'pass' | 'rush'>('pass');
  const [drawnEvent, setDrawnEvent] = useState<'tackle' | 'out_of_bounds' | 'touchdown' | 'turnover'>('tackle');

  // Keep drawnPlayer in sync when offensePlay changes
  useEffect(() => {
    setDrawnPlayer(fieldPrimaryTarget.name);
  }, [fieldPrimaryTarget.name]);

  // Sync with external trigger if provided
  useEffect(() => {
    if (isExternalDrawMode) {
      setIsDrawingPlayPath(true);
    }
  }, [isExternalDrawMode]);

  const toggleDrawPlayMode = (active: boolean) => {
    setIsDrawingPlayPath(active);
    if (!active) {
      setDrawnPlayPoints([]);
    }
    if (onToggleExternalDrawMode) {
      onToggleExternalDrawMode(active);
    }
  };

  // Calculate stats for the user's drawn play path
  const drawnPlayStats = useMemo(() => {
    if (drawnPlayPoints.length < 2) return null;
    const startPt = drawnPlayPoints[0];
    const endPt = drawnPlayPoints[drawnPlayPoints.length - 1];

    const startYard = fieldXToYard(startPt.x);
    const endYard = fieldXToYard(endPt.x);
    const rawYards = endYard - yardLine;
    const isTouchdown = endPt.x >= 900 || rawYards >= (100 - yardLine);
    const yardsGained = isTouchdown ? (100 - yardLine) : rawYards;
    const isFirstDown = yardsGained >= distance || isTouchdown;

    return {
      startYard: yardLine,
      endYard: isTouchdown ? 100 : Math.max(0, Math.min(100, yardLine + yardsGained)),
      yardsGained,
      isTouchdown,
      isFirstDown,
    };
  }, [drawnPlayPoints, yardLine, distance]);

  // --- MOUSE & TOUCH COORDINATE CONVERTER ---
  const getSvgCoordinates = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>): Point | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const activeViewWidth = isZoomed50 ? VIEW_WIDTH_ZOOMED : 1000;
    const activeCameraX = isZoomed50 ? cameraX : 0;

    const x = Math.max(0, Math.min(1000, activeCameraX + ((clientX - rect.left) / rect.width) * activeViewWidth));
    const y = Math.max(0, Math.min(460, ((clientY - rect.top) / rect.height) * 460));
    return { x, y };
  };

  // Handle drawing start
  const handlePointerDown = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (isAnimating) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

    if (!isDrawingPlayPath && !isChalkboardOpen) {
      // Allow dragging field horizontally to inspect both sides
      if (isZoomed50) {
        setIsPanningField(true);
        setPanStartX(clientX);
        setPanInitCameraX(cameraX);
      }
      return;
    }

    const pt = getSvgCoordinates(e);
    if (!pt) return;

    if (isDrawingPlayPath) {
      setIsDrawingActive(true);
      const startX = scrimmageX;
      const startY = 230;
      setDrawnPlayPoints([{ x: startX, y: startY }, pt]);
    } else if (isChalkboardOpen) {
      setIsDrawingActive(true);
      setCurrentChalkStroke([pt]);
    }
  };

  // Handle drawing move & camera follow
  const handlePointerMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

    if (isPanningField && isZoomed50 && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const deltaScreenX = (clientX - panStartX) * (VIEW_WIDTH_ZOOMED / rect.width);
      const nextCam = Math.max(0, Math.min(1000 - VIEW_WIDTH_ZOOMED, panInitCameraX - deltaScreenX));
      setCameraX(nextCam);
      return;
    }

    if (!isDrawingActive) return;
    const pt = getSvgCoordinates(e);
    if (!pt) return;

    // Smoothly pan camera to follow the line being created as finger moves near edges!
    if (isZoomed50) {
      if (pt.x > cameraX + VIEW_WIDTH_ZOOMED * 0.75) {
        setCameraX((prev) => Math.min(1000 - VIEW_WIDTH_ZOOMED, prev + 8));
      } else if (pt.x < cameraX + VIEW_WIDTH_ZOOMED * 0.25) {
        setCameraX((prev) => Math.max(0, prev - 8));
      }
    }

    if (isDrawingPlayPath) {
      setDrawnPlayPoints((prev) => {
        const last = prev[prev.length - 1];
        const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
        if (dist > 6) {
          return [...prev, pt];
        }
        return prev;
      });
    } else if (isChalkboardOpen && currentChalkStroke) {
      setCurrentChalkStroke((prev) => {
        if (!prev) return [pt];
        const last = prev[prev.length - 1];
        const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
        if (dist > 6) {
          return [...prev, pt];
        }
        return prev;
      });
    }
  };

  // Handle drawing end
  const handlePointerUp = () => {
    if (isPanningField) {
      setIsPanningField(false);
    }
    if (!isDrawingActive) return;
    setIsDrawingActive(false);

    if (isChalkboardOpen && currentChalkStroke && currentChalkStroke.length > 1) {
      setChalkboardStrokes((prev) => [
        ...prev,
        {
          id: `stroke-${Date.now()}`,
          points: currentChalkStroke,
          color: chalkColor,
          width: chalkWidth,
          isArrow: chalkArrow,
        },
      ]);
      setCurrentChalkStroke(null);
    }
  };

  // Execute the user's custom drawn play
  const handleExecuteDrawnPlay = () => {
    if (!onExecuteDrawnPlay) return;

    let points = drawnPlayPoints;
    // If user hasn't drawn anything yet or only 1 point, generate a clean default slant route
    if (points.length < 2) {
      const startX = scrimmageX;
      const endX = Math.min(900, scrimmageX + 14 * 8);
      points = [
        { x: startX, y: 230 },
        { x: startX + 40, y: 190 },
        { x: endX, y: 160 },
      ];
      setDrawnPlayPoints(points);
    }

    const startPt = points[0];
    const endPt = points[points.length - 1];
    const endYard = fieldXToYard(endPt.x);
    const rawYards = endYard - yardLine;
    const isTouchdown = endPt.x >= 900 || rawYards >= (100 - yardLine);
    const yardsGained = isTouchdown ? (100 - yardLine) : rawYards;
    const isFirstDown = yardsGained >= distance || isTouchdown;

    const keyPlayer = drawnPlayer || possessingTeam.starWR;
    const isTD = drawnEvent === 'touchdown' || isTouchdown;
    const commentary = isTD
      ? `${keyPlayer} follows the drawn path, breaks loose past the secondary and storms into the endzone... TOUCHDOWN ${possessingTeam.name.toUpperCase()}!`
      : `${keyPlayer} follows the exact drawn route, slicing upfield for a gain of ${yardsGained} yards!${isFirstDown ? ' 1ST DOWN!' : ''}`;

    onExecuteDrawnPlay({
      outcomeType: 'CustomYards',
      customYards: yardsGained,
      targetPlayer: keyPlayer,
      customEvent: isTD ? 'touchdown' : drawnEvent,
      customCommentary: commentary,
      drawnPath: points,
      isDrawnPlay: true,
    });

    setIsDrawingPlayPath(false);
  };

  // Quick preset route drawers
  const applyPresetRoute = (type: 'slant' | 'post' | 'streak') => {
    setIsDrawingPlayPath(true);
    let pts: Point[] = [];
    if (type === 'slant') {
      const targetX = Math.min(900, scrimmageX + 12 * 8);
      pts = [
        { x: scrimmageX, y: 230 },
        { x: scrimmageX + 35, y: 200 },
        { x: targetX, y: 165 },
      ];
    } else if (type === 'post') {
      const targetX = Math.min(900, scrimmageX + 25 * 8);
      pts = [
        { x: scrimmageX, y: 230 },
        { x: scrimmageX + 80, y: 230 },
        { x: targetX, y: 120 },
      ];
    } else if (type === 'streak') {
      pts = [
        { x: scrimmageX, y: 230 },
        { x: scrimmageX + 100, y: 210 },
        { x: 915, y: 230 },
      ];
    }
    setDrawnPlayPoints(pts);
    if (isZoomed50) {
      const idealCam = Math.max(0, Math.min(1000 - VIEW_WIDTH_ZOOMED, scrimmageX - 120));
      setCameraX(idealCam);
    }
  };

  // --- DYNAMIC BALL MOTION & PLAY SUMMARY SYNCHRONIZATION ---
  const ballMotion = useMemo(() => {
    // If play has a custom drawn path
    if (lastResult?.drawnPath && lastResult.drawnPath.length > 1) {
      const sampled = samplePolyline(lastResult.drawnPath, animProgress);
      // Elevation: parabolic arc in first half if pass
      const isPass = offensePlay?.category !== 'Run';
      const altitude = isPass && animProgress < 0.65
        ? Math.sin((animProgress / 0.65) * Math.PI) * 38
        : Math.abs(Math.sin(animProgress * Math.PI * 5)) * 3;

      let phase = 'SNAP & DROP';
      if (animProgress > 0.15 && animProgress < 0.6) {
        phase = `🎯 BALL FOLLOWING DRAWN PATH`;
      } else if (animProgress >= 0.6 && animProgress < 0.85) {
        phase = `⚡ ${lastResult.keyPlayer || 'CARRIER'} ADVANCING DOWNFIELD`;
      } else if (animProgress >= 0.85) {
        phase = lastResult.isTouchdown
          ? '🙌 TOUCHDOWN!'
          : `💥 TACKLE (+${lastResult.yardsGained} YDS)`;
      }

      return {
        x: sampled.x,
        y: sampled.y - altitude,
        groundY: sampled.y,
        altitude,
        angle: sampled.angle + (isPass && animProgress < 0.65 ? animProgress * 360 : 0),
        phase,
      };
    }

    // Standard simulated or scripted play
    const yardsGained = lastResult ? lastResult.yardsGained : 0;
    const isPass = offensePlay?.category !== 'Run';
    const isRun = offensePlay?.category === 'Run';
    const isSack = lastResult?.outcomeType === 'Sack';
    const isIncomplete = lastResult?.outcomeType === 'Incomplete';
    const isInterception = lastResult?.outcomeType === 'Interception' || lastResult?.outcomeType === 'PickSix';
    const isSpecial = offensePlay?.category === 'SpecialTeams' || lastResult?.outcomeType === 'FieldGoalGood' || lastResult?.outcomeType === 'Punt';

    if (!isAnimating) {
      return {
        x: scrimmageX,
        y: 230,
        groundY: 230,
        altitude: 0,
        angle: -20,
        phase: 'READY AT SCRIMMAGE',
      };
    }

    // SACK
    if (isSack) {
      const qbDropX = scrimmageX - 40;
      const sackX = scrimmageX + yardsGained * 8; // negative
      let currX = scrimmageX;
      let currY = 230;
      let phase = 'QB DROPS BACK';

      if (animProgress < 0.35) {
        currX = scrimmageX + (qbDropX - scrimmageX) * (animProgress / 0.35);
        phase = 'QB DROPS INTO POCKET';
      } else if (animProgress < 0.7) {
        currX = qbDropX + (sackX - qbDropX) * ((animProgress - 0.35) / 0.35);
        currY = 230 + Math.sin(animProgress * Math.PI * 4) * 12;
        phase = 'BLITZ CLOSING IN!';
      } else {
        currX = sackX;
        currY = 240;
        phase = `💥 SACKED! (${yardsGained} YARDS)`;
      }

      return {
        x: currX,
        y: currY,
        groundY: currY,
        altitude: 0,
        angle: animProgress * 120,
        phase,
      };
    }

    // INCOMPLETE PASS
    if (isIncomplete) {
      const qbDropX = scrimmageX - 35;
      const throwTargetX = Math.min(880, scrimmageX + 180);
      const throwTargetY = 140; // sideline pass

      let currX = scrimmageX;
      let currY = 230;
      let altitude = 0;
      let phase = 'QB DROPS BACK';

      if (animProgress < 0.25) {
        currX = scrimmageX + (qbDropX - scrimmageX) * (animProgress / 0.25);
        phase = 'QB DROPS & SCANS';
      } else if (animProgress < 0.75) {
        const passProg = (animProgress - 0.25) / 0.50;
        currX = qbDropX + (throwTargetX - qbDropX) * passProg;
        currY = 230 + (throwTargetY - 230) * passProg;
        altitude = Math.sin(passProg * Math.PI) * 44;
        phase = '🎯 PASS IN THE AIR';
      } else {
        const bounceProg = (animProgress - 0.75) / 0.25;
        currX = throwTargetX + bounceProg * 25;
        currY = throwTargetY;
        altitude = Math.abs(Math.sin(bounceProg * Math.PI * 2)) * (10 * (1 - bounceProg));
        phase = '❌ INCOMPLETE PASS';
      }

      return {
        x: currX,
        y: currY - altitude,
        groundY: currY,
        altitude,
        angle: animProgress * 360,
        phase,
      };
    }

    // INTERCEPTION / PICK-SIX
    if (isInterception) {
      const qbDropX = scrimmageX - 35;
      const intSpotX = Math.min(870, scrimmageX + 130);
      const intSpotY = 170;
      const isPickSix = lastResult?.outcomeType === 'PickSix';
      const returnEndzoneX = isPickSix ? 40 : Math.max(120, scrimmageX - 80);

      let currX = scrimmageX;
      let currY = 230;
      let altitude = 0;
      let phase = 'QB SETS TO PASS';

      if (animProgress < 0.2) {
        currX = scrimmageX + (qbDropX - scrimmageX) * (animProgress / 0.2);
        phase = 'QB DROPS BACK';
      } else if (animProgress < 0.55) {
        const passProg = (animProgress - 0.2) / 0.35;
        currX = qbDropX + (intSpotX - qbDropX) * passProg;
        currY = 230 + (intSpotY - 230) * passProg;
        altitude = Math.sin(passProg * Math.PI) * 40;
        phase = '🎯 DEEP THROW DOWNFIELD';
      } else {
        const returnProg = (animProgress - 0.55) / 0.45;
        currX = intSpotX + (returnEndzoneX - intSpotX) * returnProg;
        currY = intSpotY + Math.sin(returnProg * Math.PI * 3) * 15;
        phase = isPickSix ? '🚨 PICK-SIX DEFENSIVE RETURN!' : '🛡️ INTERCEPTED! DEFENSIVE RETURN';
      }

      return {
        x: currX,
        y: currY - altitude,
        groundY: currY,
        altitude,
        angle: animProgress * 320,
        phase,
      };
    }

    // SPECIAL TEAMS (FIELD GOAL / PUNT)
    if (isSpecial) {
      const kickStartX = scrimmageX - 50;
      const kickTargetX = Math.min(950, scrimmageX + 320);
      const kickProg = Math.max(0, (animProgress - 0.2) / 0.8);
      const currX = animProgress < 0.2
        ? scrimmageX - animProgress * 250
        : kickStartX + (kickTargetX - kickStartX) * kickProg;
      const altitude = animProgress < 0.2
        ? 0
        : Math.sin(kickProg * Math.PI) * 75;

      return {
        x: currX,
        y: 230 - altitude,
        groundY: 230,
        altitude,
        angle: animProgress * 480,
        phase: animProgress < 0.2 ? 'SNAP TO HOLDER' : '🏈 KICK IN FLIGHT!',
      };
    }

    // RUN PLAY
    if (isRun) {
      const isQbKeeper =
        lastResult?.keyPlayer === possessingTeam.starQB ||
        /qb|keeper|sneak|draw|scramble/i.test(offensePlay.name || '') ||
        /qb|keeper|sneak|draw|scramble/i.test(lastResult?.commentary || '');

      const qbKeeperX = scrimmageX - 25;
      const qbKeeperY = 230;
      const rbHandoffX = scrimmageX - 45;
      const rbHandoffY = 245;
      const startX = isQbKeeper ? qbKeeperX : rbHandoffX;
      const startY = isQbKeeper ? qbKeeperY : rbHandoffY;
      const holeX = scrimmageX + 15;
      const finalX = Math.min(940, scrimmageX + yardsGained * 8);
      const finalY = isQbKeeper ? 215 : 225;

      let currX = scrimmageX;
      let currY = 230;
      let phase = 'SNAP';

      if (animProgress < 0.2) {
        currX = scrimmageX + (startX - scrimmageX) * (animProgress / 0.2);
        currY = 230 + (startY - 230) * (animProgress / 0.2);
        phase = isQbKeeper ? `⚡ QB KEEPER (${lastResult?.keyPlayer || possessingTeam.starQB})` : `HANDOFF TO ${lastResult?.keyPlayer || 'RB'}`;
      } else if (animProgress < 0.5) {
        const burstProg = (animProgress - 0.2) / 0.3;
        currX = startX + (holeX - startX) * burstProg;
        currY = startY + (235 - startY) * burstProg;
        phase = isQbKeeper ? '⚡ QB TURNS UPFIELD' : 'HITTING THE GAP';
      } else {
        const runProg = (animProgress - 0.5) / 0.5;
        currX = holeX + (finalX - holeX) * runProg;
        currY = 235 + (finalY - 235) * runProg + Math.sin(runProg * Math.PI * 3) * 6;
        phase = lastResult?.isTouchdown
          ? (isQbKeeper ? '🙌 QB RUSHING TOUCHDOWN!' : '🙌 BREAKAWAY - TOUCHDOWN!')
          : (isQbKeeper ? `⚡ QB RUSH (+${yardsGained} YDS)` : `🏃 RUSHING UPFIELD (+${yardsGained} YDS)`);
      }

      return {
        x: currX,
        y: currY,
        groundY: currY,
        altitude: Math.abs(Math.sin(animProgress * Math.PI * 6)) * 4,
        angle: 15,
        phase,
      };
    }

    // PASS PLAY (DEFAULT / FIRST DOWN / BIG GAIN / TOUCHDOWN)
    const qbDropX = scrimmageX - 40;
    const catchDistance = Math.min(yardsGained * 0.65, 32);
    const catchX = scrimmageX + catchDistance * 8;
    const catchY = 175;
    const finalX = Math.min(940, scrimmageX + yardsGained * 8);
    const finalY = 185;

    let currX = scrimmageX;
    let currY = 230;
    let altitude = 0;
    let phase = 'QB DROP';

    if (animProgress < 0.2) {
      // Snap to QB
      currX = scrimmageX + (qbDropX - scrimmageX) * (animProgress / 0.2);
      phase = 'SNAP TO QB';
    } else if (animProgress < 0.6) {
      // Pass in flight to receiver
      const flightProg = (animProgress - 0.2) / 0.4;
      currX = qbDropX + (catchX - qbDropX) * flightProg;
      currY = 230 + (catchY - 230) * flightProg;
      altitude = Math.sin(flightProg * Math.PI) * (42 + Math.min(30, yardsGained));
      phase = `🎯 PASS IN FLIGHT TO ${lastResult?.keyPlayer || 'RECEIVER'}`;
    } else {
      // Catch and Run After Catch (RAC)
      const racProg = (animProgress - 0.6) / 0.4;
      currX = catchX + (finalX - catchX) * racProg;
      currY = catchY + (finalY - catchY) * racProg + Math.sin(racProg * Math.PI * 2) * 5;
      altitude = Math.abs(Math.sin(racProg * Math.PI * 5)) * 3;
      phase = lastResult?.isTouchdown
        ? '🙌 SPRINTING TO ENDZONE - TOUCHDOWN!'
        : lastResult?.isFirstDown
        ? `⚡ FIRST DOWN! (+${yardsGained} YDS)`
        : `💥 RECEPTION & GAIN (+${yardsGained} YDS)`;
    }

    return {
      x: currX,
      y: currY - altitude,
      groundY: currY,
      altitude,
      angle: animProgress < 0.6 ? animProgress * 420 : 15,
      phase,
    };
  }, [scrimmageX, lastResult, offensePlay, animProgress, isAnimating]);

  return (
    <div
      ref={fieldContainerRef}
      className={`relative w-full rounded-xl overflow-hidden shadow-2xl border-2 border-slate-700 bg-emerald-900 select-none transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-50 rounded-none h-screen w-screen border-none bg-slate-950 flex flex-col justify-between overflow-hidden'
          : ''
      }`}
    >
      {/* Top Floating Control Bar: Route Drawing (Chalkboard) & Draw Exact Play Controls */}
      <div className="bg-slate-950/90 backdrop-blur-md px-3 py-2 flex flex-wrap items-center justify-between border-b border-slate-800 gap-2 text-xs z-30">
        <div className="flex items-center space-x-2">
          {/* OPTIONAL ROUTE DRAWING (CHALKBOARD) TOGGLE */}
          <button
            id="btn-toggle-chalkboard"
            onClick={() => {
              setIsChalkboardOpen(!isChalkboardOpen);
              if (isDrawingPlayPath) setIsDrawingPlayPath(false);
            }}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs transition shadow-sm ${
              isChalkboardOpen
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-800'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Route Chalkboard: {isChalkboardOpen ? 'ON' : 'OFF'}</span>
          </button>

          {/* DRAW EXACT PLAY PATH TOGGLE */}
          <button
            id="btn-toggle-draw-play"
            onClick={() => {
              toggleDrawPlayMode(!isDrawingPlayPath);
              if (isChalkboardOpen) setIsChalkboardOpen(false);
            }}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs transition shadow-sm ${
              isDrawingPlayPath
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-cyan-500/20'
                : 'bg-slate-900 text-cyan-300 border-slate-700 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Draw Exact Play {isDrawingPlayPath ? '(ACTIVE)' : ''}</span>
          </button>

          {/* QUICK TOP EXECUTE DRAWN PLAY BUTTON */}
          {(isDrawingPlayPath || drawnPlayPoints.length >= 2) && (
            <button
              id="btn-top-execute-drawn-play"
              onClick={handleExecuteDrawnPlay}
              disabled={isAnimating}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-display font-black text-xs shadow-lg shadow-cyan-500/30 transition animate-pulse disabled:opacity-50"
              title="Execute the drawn route on the field"
            >
              <PlayIcon className="w-3.5 h-3.5 fill-current" />
              <span>
                EXECUTE DRAWN PLAY {drawnPlayStats ? `(${drawnPlayStats.yardsGained > 0 ? '+' : ''}${drawnPlayStats.yardsGained} YDS)` : ''}
              </span>
            </button>
          )}
        </div>

        {/* CHALKBOARD SUB-CONTROLS */}
        {isChalkboardOpen && (
          <div className="flex items-center space-x-2 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 font-mono">Chalk:</span>
            {/* Color swatches */}
            {['#facc15', '#38bdf8', '#ef4444', '#22c55e', '#ffffff'].map((c) => (
              <button
                key={c}
                onClick={() => setChalkColor(c)}
                className={`w-4 h-4 rounded-full border transition ${chalkColor === c ? 'scale-125 border-white ring-2 ring-amber-400' : 'border-transparent opacity-80'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            {/* Arrowhead toggle */}
            <button
              onClick={() => setChalkArrow(!chalkArrow)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${chalkArrow ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}
            >
              Arrow
            </button>
            {/* Undo */}
            <button
              onClick={() => setChalkboardStrokes((prev) => prev.slice(0, -1))}
              disabled={chalkboardStrokes.length === 0}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
              title="Undo stroke"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            {/* Clear */}
            <button
              onClick={() => setChalkboardStrokes([])}
              disabled={chalkboardStrokes.length === 0}
              className="p-1 rounded bg-slate-800 hover:bg-rose-900/50 text-rose-300 disabled:opacity-40"
              title="Clear all chalk"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center space-x-2">
          {/* 50-YARD ZOOM CAM TOGGLE */}
          <button
            id="btn-field-zoom-toggle"
            onClick={() => setIsZoomed50(!isZoomed50)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs transition shadow-sm ${
              isZoomed50
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle 50-Yard Zoomed Field View / All-22 Wide View"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span>50-YD ZOOM CAM: {isZoomed50 ? 'ON' : 'ALL-22'}</span>
          </button>

          {/* FULL SCREEN FIELD BUTTON */}
          <button
            id="btn-field-fullscreen"
            onClick={toggleFullscreen}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs transition shadow-sm ${
              isFullscreen
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-cyan-500/20'
                : 'bg-slate-900 text-slate-200 border-slate-700 hover:text-white hover:bg-slate-800'
            }`}
            title={isFullscreen ? 'Exit Full Screen Field (Esc)' : 'Put Field Display on Full Screen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
          </button>

          {/* PLAY SUMMARY / BROADCAST BANNER */}
          <div className="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-amber-400 font-display font-black text-xs uppercase tracking-wider">
              {ballMotion.phase}
            </span>
          </div>
        </div>
      </div>

      {/* DRAW EXACT PLAY INTERACTIVE HUD / CONTROLLER DRAWER */}
      {isDrawingPlayPath && (
        <div className="bg-slate-950/95 border-b border-cyan-500/50 px-4 py-3 text-xs space-y-2.5 z-30 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-black font-display text-[11px]">
                DRAW PLAY TRAJECTORY
              </span>
              <span className="text-slate-300 font-medium">
                Click & drag on the field from scrimmage to map out how the play unfolded!
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Quick Preset Route Buttons */}
              <div className="hidden sm:flex items-center space-x-1 mr-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Quick Routes:</span>
                <button
                  onClick={() => applyPresetRoute('slant')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-semibold"
                >
                  12-Yd Slant
                </button>
                <button
                  onClick={() => applyPresetRoute('post')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-semibold"
                >
                  25-Yd Post
                </button>
                <button
                  onClick={() => applyPresetRoute('streak')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 text-[11px] font-semibold"
                >
                  Endzone Streak
                </button>
              </div>

              <button
                onClick={() => setDrawnPlayPoints([])}
                disabled={drawnPlayPoints.length === 0}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition disabled:opacity-40"
              >
                Clear Route
              </button>
              <button
                onClick={() => toggleDrawPlayMode(false)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Real-time Route Measurement & Execution Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <div className="flex items-center space-x-4">
              {drawnPlayStats ? (
                <>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-mono">FROM:</span>
                    <span className="text-white font-bold font-display">{possessingTeam.abbr} {drawnPlayStats.startYard}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                  <div>
                    <span className="text-slate-400 text-[10px] block font-mono">REACHED:</span>
                    <span className="text-white font-bold font-display">{drawnPlayStats.endYard >= 100 ? 'ENDZONE' : `${drawnPlayStats.endYard} YD`}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-mono">NET YARDS:</span>
                    <span className={`font-display font-black text-sm ${drawnPlayStats.yardsGained > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {drawnPlayStats.yardsGained > 0 ? `+${drawnPlayStats.yardsGained}` : drawnPlayStats.yardsGained} YDS
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-mono">OUTCOME:</span>
                    <span className={`font-bold font-display px-2 py-0.5 rounded text-[10px] ${
                      drawnPlayStats.isTouchdown
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : drawnPlayStats.isFirstDown
                        ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500'
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {drawnPlayStats.isTouchdown ? 'TOUCHDOWN!' : drawnPlayStats.isFirstDown ? '1ST DOWN' : 'SHORT GAIN'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-slate-400 italic text-[11px] flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>Click and drag on the field or pick a Quick Route above to map the trajectory!</span>
                </div>
              )}
            </div>

            {/* Player & Event Selector + Main Execute Button */}
            <div className="flex items-center space-x-2">
              <select
                id="select-draw-player"
                value={drawnPlayer}
                onChange={(e) => setDrawnPlayer(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-white rounded px-2 py-1.5 focus:outline-none focus:border-cyan-500 font-medium"
              >
                <option value={fieldPrimaryTarget.name}>
                  ⭐ 1st Read: {fieldPrimaryTarget.name} ({fieldPrimaryTarget.slotLabel || 'Primary Read'}{fieldPrimaryTarget.ovr ? ` • ${fieldPrimaryTarget.ovr} OVR` : ''})
                </option>
                <optgroup label={`${possessingTeam.name} Wide Receivers & Tight Ends`}>
                  {possessingTeamReceivers.map((rec, idx) => (
                    <option key={`${rec.depthSlot}-${rec.name}-${idx}`} value={rec.name}>
                      {rec.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Other Offensive Stars">
                  <option value={possessingTeam.starRB}>RB: {possessingTeam.starRB}</option>
                  <option value={possessingTeam.starQB}>QB Scramble: {possessingTeam.starQB}</option>
                </optgroup>
              </select>

              <select
                value={drawnEvent}
                onChange={(e) => setDrawnEvent(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 text-xs text-white rounded px-2 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="tackle">Tackled In-Bounds</option>
                <option value="out_of_bounds">Stepped Out of Bounds</option>
                <option value="touchdown">Score Touchdown</option>
                <option value="turnover">Turnover / Fumble</option>
              </select>

              {/* PRIMARY EXECUTE DRAWN PLAY BUTTON */}
              <button
                id="btn-execute-drawn-play"
                onClick={handleExecuteDrawnPlay}
                disabled={isAnimating}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-slate-950 font-display font-black text-xs shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
              >
                <PlayIcon className="w-3.5 h-3.5 fill-current" />
                <span>
                  EXECUTE DRAWN PLAY
                  {drawnPlayStats ? ` (+${drawnPlayStats.yardsGained} YDS)` : ''}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weather Overlay */}
      {game.settings.weather === 'Rain' && (
        <div className="absolute inset-0 pointer-events-none opacity-30 bg-repeat bg-[radial-gradient(#93c5fd_1px,transparent_1px)] [background-size:16px_16px] animate-pulse z-20" />
      )}
      {game.settings.weather === 'Snow' && (
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-repeat bg-[radial-gradient(#ffffff_1.5px,transparent_1.5px)] [background-size:24px_24px] z-20" />
      )}
      {game.settings.weather === 'Night' && (
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/40 z-20" />
      )}

      {/* SVG Football Field with Dynamic Zoom Viewport */}
      <svg
        ref={svgRef}
        viewBox={`${isZoomed50 ? cameraX : 0} 0 ${isZoomed50 ? VIEW_WIDTH_ZOOMED : 1000} 460`}
        preserveAspectRatio="xMidYMid meet"
        className={`w-full aspect-[1000/460] block select-none ${
          isChalkboardOpen || isDrawingPlayPath ? 'cursor-crosshair' : 'cursor-grab'
        } ${isFullscreen ? 'flex-1 max-h-[calc(100vh-56px)] object-contain m-auto' : ''}`}
        style={{ touchAction: 'none' }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <defs>
          <pattern id="turf-stripes" width="80" height="460" patternUnits="userSpaceOnUse">
            <rect width="40" height="460" fill="#15803d" />
            <rect x="40" width="40" height="460" fill="#16a34a" />
          </pattern>
          <linearGradient id="lighting-overlay" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
          </linearGradient>

          {/* Route Arrowheads */}
          <marker id="chalk-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill={chalkColor} />
          </marker>
          <marker id="drawn-play-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#06b6d4" />
          </marker>
          <marker id="madden-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#fbbf24" />
          </marker>
        </defs>

        {/* Grass surface */}
        <rect x="0" y="0" width="1000" height="460" fill="url(#turf-stripes)" />
        <rect x="0" y="0" width="1000" height="460" fill="url(#lighting-overlay)" />

        {/* --- LEFT ENDZONE (AWAY/OFFENSE) --- */}
        <rect
          x="0"
          y="0"
          width="100"
          height="460"
          fill={defendingTeam.secondaryColor || '#1e293b'}
          stroke="#ffffff"
          strokeWidth="3"
        />
        <text
          x="50"
          y="230"
          fill="#ffffff"
          fontSize="24"
          fontWeight="bold"
          fontFamily="'Chakra Petch', sans-serif"
          textAnchor="middle"
          transform="rotate(-90, 50, 230)"
          letterSpacing="4"
          opacity="0.85"
        >
          {defendingTeam.name.toUpperCase()}
        </text>

        {/* --- RIGHT ENDZONE (HOME/DEFENSE TARGET) --- */}
        <rect
          x="900"
          y="0"
          width="100"
          height="460"
          fill={possessingTeam.primaryColor || '#0284c7'}
          stroke="#ffffff"
          strokeWidth="3"
        />
        <text
          x="950"
          y="230"
          fill="#ffffff"
          fontSize="24"
          fontWeight="bold"
          fontFamily="'Chakra Petch', sans-serif"
          textAnchor="middle"
          transform="rotate(90, 950, 230)"
          letterSpacing="4"
          opacity="0.85"
        >
          {possessingTeam.name.toUpperCase()}
        </text>

        {/* Sidelines & Goal Lines */}
        <rect x="100" y="0" width="800" height="460" fill="none" stroke="#ffffff" strokeWidth="4" />

        {/* Yard Lines & Numbers (Every 10 yards = 80px) */}
        {[10, 20, 30, 40, 50, 40, 30, 20, 10].map((num, i) => {
          const x = 100 + (i + 1) * 80;
          return (
            <g key={i}>
              <line
                x1={x}
                y1="0"
                x2={x}
                y2="460"
                stroke="#ffffff"
                strokeWidth={num === 50 ? 3 : 1.5}
                strokeOpacity={num === 50 ? 0.9 : 0.6}
              />
              <text
                x={x}
                y="42"
                fill="#ffffff"
                fontSize="18"
                fontWeight="800"
                fontFamily="'Chakra Petch', sans-serif"
                textAnchor="middle"
                opacity="0.75"
              >
                {num}
              </text>
              <text
                x={x}
                y="435"
                fill="#ffffff"
                fontSize="18"
                fontWeight="800"
                fontFamily="'Chakra Petch', sans-serif"
                textAnchor="middle"
                opacity="0.75"
              >
                {num}
              </text>
            </g>
          );
        })}

        {/* 5-Yard tick lines */}
        {[5, 15, 25, 35, 45, 55, 65, 75, 85, 95].map((yd, i) => {
          const x = 100 + yd * 8;
          return (
            <line
              key={i}
              x1={x}
              y1="0"
              x2={x}
              y2="460"
              stroke="#ffffff"
              strokeWidth="1"
              strokeOpacity="0.3"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Hash Marks */}
        {Array.from({ length: 99 }).map((_, i) => {
          const x = 100 + (i + 1) * 8;
          return (
            <g key={i} opacity="0.45">
              <line x1={x} y1="140" x2={x} y2="150" stroke="#ffffff" strokeWidth="1" />
              <line x1={x} y1="310" x2={x} y2="320" stroke="#ffffff" strokeWidth="1" />
            </g>
          );
        })}

        {/* 1st DOWN LINE (BRIGHT YELLOW / GOLD) */}
        <line
          x1={firstDownX}
          y1="0"
          x2={firstDownX}
          y2="460"
          stroke="#facc15"
          strokeWidth="4"
          strokeDasharray="6 3"
          filter="drop-shadow(0px 0px 4px #facc15)"
        />
        <rect
          x={firstDownX - 24}
          y="4"
          width="48"
          height="16"
          rx="3"
          fill="#facc15"
        />
        <text
          x={firstDownX}
          y="16"
          fill="#000000"
          fontSize="10"
          fontWeight="bold"
          fontFamily="'Chakra Petch', sans-serif"
          textAnchor="middle"
        >
          1ST DOWN
        </text>

        {/* LINE OF SCRIMMAGE (BRIGHT ELECTRIC BLUE) */}
        <line
          x1={scrimmageX}
          y1="0"
          x2={scrimmageX}
          y2="460"
          stroke="#38bdf8"
          strokeWidth="3.5"
          filter="drop-shadow(0px 0px 4px #38bdf8)"
        />
        <rect
          x={scrimmageX - 24}
          y="440"
          width="48"
          height="16"
          rx="3"
          fill="#0284c7"
        />
        <text
          x={scrimmageX}
          y="452"
          fill="#ffffff"
          fontSize="9"
          fontWeight="bold"
          fontFamily="'Chakra Petch', sans-serif"
          textAnchor="middle"
        >
          SCRIMMAGE
        </text>

        {/* --- OFFENSIVE ROUTE OVERLAYS (Madden Play Art) --- */}
        {offensePlay && (
          <g opacity={isAnimating ? 0.35 : 0.85}>
            {offensePlay.assignments.map((assign) => {
              const baseStartX = scrimmageX - (assign.position === 'QB' ? 35 : assign.position === 'RB' ? 55 : 5);
              const baseStartY = 230 + (assign.startX - 50) * 3.4;

              if (!assign.waypoints || assign.waypoints.length === 0) return null;

              let pathStr = `M ${baseStartX} ${baseStartY}`;
              assign.waypoints.forEach((pt) => {
                const targetX = scrimmageX + (100 - pt.y) * 4.5;
                const targetY = 230 + (pt.x - 50) * 3.4;
                pathStr += ` L ${targetX} ${targetY}`;
              });

              return (
                <path
                  key={assign.id}
                  d={pathStr}
                  fill="none"
                  stroke={assign.isPrimary ? '#fbbf24' : '#60a5fa'}
                  strokeWidth={assign.isPrimary ? 3 : 2}
                  strokeDasharray={assign.route === 'Block' ? '3 3' : undefined}
                  markerEnd="url(#madden-arrow)"
                />
              );
            })}
          </g>
        )}

        {/* --- USER DRAWN CHALKBOARD ROUTES (OPTIONAL) --- */}
        {chalkboardStrokes.map((stroke) => (
          <path
            key={stroke.id}
            d={pointsToSvgPath(stroke.points)}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={stroke.isArrow ? 'url(#chalk-arrow)' : undefined}
            opacity="0.95"
          />
        ))}

        {/* Current active chalkboard stroke */}
        {currentChalkStroke && (
          <path
            d={pointsToSvgPath(currentChalkStroke)}
            fill="none"
            stroke={chalkColor}
            strokeWidth={chalkWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={chalkArrow ? 'url(#chalk-arrow)' : undefined}
            opacity="0.9"
          />
        )}

        {/* --- USER DRAWN EXACT PLAY PATH --- */}
        {drawnPlayPoints.length > 1 && (
          <g>
            <path
              d={pointsToSvgPath(drawnPlayPoints)}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="4.5"
              strokeDasharray="6 3"
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd="url(#drawn-play-arrow)"
              filter="drop-shadow(0 0 6px #06b6d4)"
            />
            {/* Start pin on scrimmage */}
            <circle cx={drawnPlayPoints[0].x} cy={drawnPlayPoints[0].y} r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
            {/* End pin */}
            <circle
              cx={drawnPlayPoints[drawnPlayPoints.length - 1].x}
              cy={drawnPlayPoints[drawnPlayPoints.length - 1].y}
              r="7"
              fill="#facc15"
              stroke="#0f172a"
              strokeWidth="2"
            />
          </g>
        )}

        {/* --- PLAYERS ON THE FIELD --- */}
        {/* OFFENSIVE FORMATION TOKENS */}
        {offensePlay &&
          offensePlay.assignments.map((assign) => {
            let px = scrimmageX - (assign.position === 'QB' ? 35 : assign.position === 'RB' ? 55 : 8);
            let py = 230 + (assign.startX - 50) * 3.6;

            if (isAnimating && assign.waypoints && assign.waypoints.length > 0) {
              const target = assign.waypoints[assign.waypoints.length - 1];
              const destX = scrimmageX + (100 - target.y) * 4.5;
              const destY = 230 + (target.x - 50) * 3.6;
              px = px + (destX - px) * animProgress;
              py = py + (destY - py) * animProgress;
            }

            return (
              <g key={assign.id} transform={`translate(${px}, ${py})`}>
                <circle
                  r="10"
                  fill={possessingTeam.primaryColor || '#0284c7'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  filter="drop-shadow(0 2px 3px rgba(0,0,0,0.5))"
                />
                <text
                  y="3.5"
                  fill="#ffffff"
                  fontSize="8"
                  fontWeight="bold"
                  fontFamily="'Chakra Petch', sans-serif"
                  textAnchor="middle"
                >
                  {assign.label.slice(0, 3)}
                </text>
              </g>
            );
          })}

        {/* DEFENSIVE FORMATION TOKENS */}
        {defensePlay &&
          defensePlay.assignments.map((assign) => {
            const defX = scrimmageX + (100 - assign.startY) * 3.8 + 12;
            const defY = 230 + (assign.startX - 50) * 3.8;

            let finalDefX = defX;
            let finalDefY = defY;

            if (isAnimating) {
              finalDefX = defX + (ballMotion.x - defX) * (animProgress * 0.45);
              finalDefY = defY + (ballMotion.groundY - defY) * (animProgress * 0.45);
            }

            return (
              <g key={assign.id} transform={`translate(${finalDefX}, ${finalDefY})`}>
                <circle
                  r="10"
                  fill={defendingTeam.primaryColor || '#dc2626'}
                  stroke={defendingTeam.accentColor || '#ffffff'}
                  strokeWidth="1.5"
                  filter="drop-shadow(0 2px 3px rgba(0,0,0,0.5))"
                />
                <text
                  y="3.5"
                  fill={defendingTeam.textColor || '#ffffff'}
                  fontSize="7.5"
                  fontWeight="bold"
                  fontFamily="'Chakra Petch', sans-serif"
                  textAnchor="middle"
                >
                  {assign.label.slice(0, 3)}
                </text>
              </g>
            );
          })}

        {/* --- BALL GROUND SHADOW (SCALES WITH ALTITUDE) --- */}
        <ellipse
          cx={ballMotion.x}
          cy={ballMotion.groundY}
          rx={Math.max(4, 9 - ballMotion.altitude / 12)}
          ry={Math.max(2, 4.5 - ballMotion.altitude / 24)}
          fill="#000000"
          opacity={Math.max(0.15, 0.55 - ballMotion.altitude / 100)}
        />

        {/* --- DYNAMIC FOOTBALL TOKEN --- */}
        <g
          transform={`translate(${ballMotion.x}, ${ballMotion.y}) rotate(${ballMotion.angle})`}
          filter="drop-shadow(0 4px 6px rgba(0,0,0,0.6))"
        >
          {/* Leather Body */}
          <ellipse
            rx="10"
            ry="6"
            fill="#78350f"
            stroke="#451a03"
            strokeWidth="1"
          />
          {/* White End Stripes */}
          <line x1="-6" y1="-4.5" x2="-6" y2="4.5" stroke="#ffffff" strokeWidth="1" opacity="0.9" />
          <line x1="6" y1="-4.5" x2="6" y2="4.5" stroke="#ffffff" strokeWidth="1" opacity="0.9" />
          {/* Center Laces */}
          <line x1="-4" y1="0" x2="4" y2="0" stroke="#ffffff" strokeWidth="1.3" />
          <line x1="-2" y1="-1.8" x2="-2" y2="1.8" stroke="#ffffff" strokeWidth="1" />
          <line x1="0" y1="-1.8" x2="0" y2="1.8" stroke="#ffffff" strokeWidth="1" />
          <line x1="2" y1="-1.8" x2="2" y2="1.8" stroke="#ffffff" strokeWidth="1" />
        </g>
      </svg>

      {/* Floating On-Field Execute Play Pill Button */}
      {drawnPlayPoints.length >= 2 && !isAnimating && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-3 bg-slate-950/95 border-2 border-cyan-400 p-2 px-4 rounded-full shadow-2xl shadow-cyan-500/50 backdrop-blur-md">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-cyan-300 font-display font-black text-xs">
              ROUTE DRAWN: {drawnPlayStats?.yardsGained !== undefined ? `${drawnPlayStats.yardsGained > 0 ? '+' : ''}${drawnPlayStats.yardsGained} YDS` : ''}
              {drawnPlayStats?.isTouchdown ? ' (TD!)' : drawnPlayStats?.isFirstDown ? ' (1ST DOWN)' : ''}
            </span>
          </div>
          <button
            id="btn-floating-execute-drawn-play"
            onClick={handleExecuteDrawnPlay}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-display font-black text-xs shadow-lg transition"
          >
            <PlayIcon className="w-3.5 h-3.5 fill-current" />
            <span>EXECUTE PLAY NOW</span>
          </button>
        </div>
      )}

      {/* Field Horizontal Pan / Scrub Bar for Zoomed 50-Yard Mode */}
      {isZoomed50 && (
        <div className="bg-slate-900/95 px-4 py-1.5 flex items-center space-x-3 border-t border-slate-800 text-xs">
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider whitespace-nowrap">
            Field Camera Pan:
          </span>
          <input
            type="range"
            min={0}
            max={1000 - VIEW_WIDTH_ZOOMED}
            step={1}
            value={cameraX}
            onChange={(e) => setCameraX(Number(e.target.value))}
            className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-ew-resize"
          />
          <button
            onClick={() => setCameraX(Math.max(0, Math.min(1000 - VIEW_WIDTH_ZOOMED, scrimmageX - 160)))}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[10px] whitespace-nowrap border border-slate-700"
          >
            Snap to Scrimmage
          </button>
        </div>
      )}

      {/* Field Bottom Status Bar */}
      <div className="bg-slate-950/80 backdrop-blur-md px-4 py-2 flex flex-wrap items-center justify-between border-t border-slate-800 text-xs">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span className="text-slate-300 font-medium">Line of Scrimmage:</span>
            <span className="text-white font-bold font-display">
              {yardLine > 50 ? `${defendingTeam.abbr} ${100 - yardLine}` : `${possessingTeam.abbr} ${yardLine}`}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-slate-300 font-medium">Line to Gain:</span>
            <span className="text-white font-bold font-display">
              {distance > 0 ? `${distance} yds` : 'Goal'}
            </span>
          </div>

          {drawnPlayPoints.length >= 2 && (
            <button
              id="btn-bottom-execute-drawn-play"
              onClick={handleExecuteDrawnPlay}
              disabled={isAnimating}
              className="flex items-center space-x-1 px-3 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow transition disabled:opacity-50"
            >
              <PlayIcon className="w-3 h-3 fill-current" />
              <span>EXECUTE DRAWN PLAY</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-slate-400">Possession:</span>
          <span
            className="px-2 py-0.5 rounded font-bold font-display uppercase tracking-wider text-[11px]"
            style={{
              backgroundColor: possessingTeam.primaryColor,
              color: possessingTeam.textColor || '#ffffff',
            }}
          >
            {possessingTeam.city} {possessingTeam.name}
          </span>
        </div>
      </div>
    </div>
  );
};
