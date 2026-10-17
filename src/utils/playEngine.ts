import { ActiveGame, Play, PlayResult, ScriptedOutcomeType, NFLTeam, QBThrowingVariant, RunStyleVariant, PlayExecutionVariant } from '../types/game';
import { playSound } from './audio';
import { getPlayPrimaryTarget } from './receiverTargeting';
import { DEFAULT_PLAYS } from '../data/defaultPlays';
import {
  isWayneGarrettEquipped,
  isCamNewtonEquipped,
  isDarnoldStartingQB,
  isJSNRouteArtistEquipped,
  isPatMcAfee1YardLineEquipped,
  isAndrewLuckComposureEquipped,
  isTravisKelceJumpBallEquipped,
  isChristianMcCaffreyNotLostYetEquipped,
  isTrentWilliamsItTakes2Equipped,
} from './clashManager';

export interface ScriptExecutionParams {
  outcomeType: ScriptedOutcomeType;
  customYards?: number;
  customCommentary?: string;
  customEvent?: 'tackle' | 'out_of_bounds' | 'touchdown' | 'turnover' | 'penalty' | 'safety';
  targetPlayer?: string;
  drawnPath?: { x: number; y: number }[];
  isDrawnPlay?: boolean;
  clockMode?: 'elapsed' | 'remaining';
  clockValue?: number;
  isDoubleTeamed?: boolean;
  preSnapMotion?: boolean;
  isMaxProtection?: boolean;
  throwingVariant?: QBThrowingVariant;
  runVariant?: RunStyleVariant;
  playVariant?: PlayExecutionVariant;
}

export function calculateDLineDominance(offTeam: NFLTeam, defTeam: NFLTeam, isClashMode: boolean = false) {
  const oLineAvg = offTeam.ovr || offTeam.off || 80;
  let oLineMath = oLineAvg / 5;

  let highestDLine = defTeam.def || 80;
  let lowestDLine = Math.max(10, highestDLine - 18);

  if (defTeam.id === 'lar' || defTeam.name.toLowerCase().includes('rams')) {
    highestDLine = 99; // Myles Garrett is a 99 OVR on the Rams
    lowestDLine = 78;
  }

  // Trent Williams Game Breaker: It Takes 2 (Only active in Gridiron Clash mode)
  const hasItTakes2 = isClashMode && isTrentWilliamsItTakes2Equipped();
  if (hasItTakes2 && highestDLine > 90) {
    oLineMath *= 2;
  }

  const dLineMath = (highestDLine - lowestDLine) / 2;
  const isDLineSuperior = (dLineMath > oLineMath || defTeam.id === 'lar' || defTeam.name.toLowerCase().includes('rams')) && !(hasItTakes2 && highestDLine > 90);

  return {
    oLineMath,
    dLineMath,
    highestDLine,
    lowestDLine,
    isDLineSuperior,
    boost: isDLineSuperior ? 20 : 0,
  };
}

export function executePlay(
  game: ActiveGame,
  offensePlay: Play,
  defensePlay: Play,
  scriptParams: ScriptExecutionParams
): { updatedGame: ActiveGame; result: PlayResult } {
  const isHomePoss = game.possession === 'home';
  const offTeam: NFLTeam = isHomePoss ? game.homeTeam : game.awayTeam;
  const defTeam: NFLTeam = isHomePoss ? game.awayTeam : game.homeTeam;

  const currentYardLine = game.yardLine; // 1 to 99 (100 = opponent goal line)
  const distanceToGoal = 100 - currentYardLine;

  let result: PlayResult;

  // Initialize and calculate Hard Mode Hidden Factors (Momentum, Predictability, Motion)
  let netSuccessBoost = 0;
  let hardModeFactorsUpdate: any = undefined;

  if (game.difficulty === 'Hard') {
    const prevFactors = game.hardModeFactors || {
      momentum: 0,
      repeatCategoryCount: 0,
      lastCategory: undefined,
      preSnapMotion: false,
    };

    const category = offensePlay.category;
    let repeatCount = prevFactors.repeatCategoryCount;
    let lastCategory = prevFactors.lastCategory;

    let predictabilityPenalty = 0;
    if (lastCategory === category) {
      repeatCount += 1;
      predictabilityPenalty = Math.min(3, repeatCount) * 0.12; // 12% to 36% penalty
    } else {
      repeatCount = 0;
      lastCategory = category;
    }

    const preSnapMotionActive = !!prevFactors.preSnapMotion || !!scriptParams.preSnapMotion;
    const motionBonus = preSnapMotionActive ? 0.15 : 0;

    netSuccessBoost = prevFactors.momentum + motionBonus - predictabilityPenalty;

    hardModeFactorsUpdate = {
      momentum: prevFactors.momentum, // will update post-play
      repeatCategoryCount: repeatCount,
      lastCategory,
      preSnapMotion: false, // consumes pre-snap motion
    };
  }

  // Calculate D-Line Dominance Math Formula
  const isClashMode = !!game.clashGameContext;
  const dLineInfo = calculateDLineDominance(offTeam, defTeam, isClashMode);

  const effectiveThrowingVariant = scriptParams.throwingVariant || (scriptParams.playVariant && ['in_stride', 'straight_to_them', 'lob_pass'].includes(scriptParams.playVariant) ? (scriptParams.playVariant as QBThrowingVariant) : undefined);
  const effectiveRunVariant = scriptParams.runVariant || (scriptParams.playVariant && ['power', 'speed', 'patience'].includes(scriptParams.playVariant) ? (scriptParams.playVariant as RunStyleVariant) : undefined);

  // Check if last play was a 30+ yard completion for Cam Newton's Ignore The Odds ability
  const lastPlayRes = game.lastPlayResult;
  const wasLastPass30Plus = !!(lastPlayRes && !lastPlayRes.isTurnover && lastPlayRes.yardsGained >= 30);

  // Check if last play was a 10+ yard pass completion involving Jaxon Smith-Njigba
  const wasLastPassJSNOver10 = !!(
    lastPlayRes &&
    !lastPlayRes.isTurnover &&
    lastPlayRes.yardsGained >= 10 &&
    (lastPlayRes.keyPlayer?.toLowerCase().includes('jaxon') ||
      lastPlayRes.keyPlayer?.toLowerCase().includes('njigba') ||
      lastPlayRes.commentary?.toLowerCase().includes('jaxon') ||
      lastPlayRes.commentary?.toLowerCase().includes('smith-njigba') ||
      lastPlayRes.commentary?.toLowerCase().includes('jsn'))
  );

  // Clone game state to update immutably
  const nextGame: ActiveGame = JSON.parse(JSON.stringify(game));
  if (!nextGame.wayneGarrettAbilityUses) {
    nextGame.wayneGarrettAbilityUses = { power: 0, speed: 0, patience: 0, standard: 0 };
  }

  // If OrganicSim is chosen, calculate organically based on match ratings and play matchup
  if (scriptParams.outcomeType === 'OrganicSim') {
    if (offensePlay.type === 'SpecialTeams') {
      if (offensePlay.id === 'st-field-goal') {
        const roll = Math.random();
        let outcome: ScriptedOutcomeType;
        if (game.difficulty === 'Hard' && distanceToGoal > 60) {
          outcome = 'FieldGoalMiss';
        } else {
          outcome = roll < 0.8 ? 'FieldGoalGood' : (roll < 0.9 ? 'FieldGoalMiss' : 'FieldGoalBlocked');
        }
        result = buildScriptedResult({ outcomeType: outcome }, offensePlay, defensePlay, offTeam, defTeam, distanceToGoal, isClashMode);
      } else if (offensePlay.id === 'st-punt') {
        // AI & Simulation rule enforcement:
        // 1. Never punt on any down besides 4th
        // 2. Never punt if distanceToGoal <= 40 (only have 40 yards or less to the endzone)
        if (game.down !== 4 || distanceToGoal <= 40) {
          // If down is 4th, distanceToGoal <= 40, and yards to go (game.distance) >= 5: kick a field goal
          if (game.down === 4 && distanceToGoal <= 40 && game.distance >= 5) {
            const fgPlay = DEFAULT_PLAYS.find((p) => p.id === 'st-field-goal') || offensePlay;
            const roll = Math.random();
            const outcome: ScriptedOutcomeType = roll < 0.8 ? 'FieldGoalGood' : (roll < 0.9 ? 'FieldGoalMiss' : 'FieldGoalBlocked');
            result = buildScriptedResult({ outcomeType: outcome }, fgPlay, defensePlay, offTeam, defTeam, distanceToGoal, isClashMode);
          } else {
            // Otherwise run a standard organic offensive play (pass or run, never punt)
            const standardPlay = DEFAULT_PLAYS.find((p) => p.type === 'Offense' && p.category !== 'SpecialTeams') || offensePlay;
            result = simulateOrganicPlay(standardPlay, defensePlay, offTeam, defTeam, game.down, game.distance, distanceToGoal, scriptParams.isDoubleTeamed, scriptParams.isMaxProtection, dLineInfo, effectiveThrowingVariant, scriptParams.targetPlayer, effectiveRunVariant, game.difficulty, netSuccessBoost, wasLastPass30Plus, wasLastPassJSNOver10, lastPlayRes, nextGame);
          }
        } else {
          const roll = Math.random();
          const outcome: ScriptedOutcomeType = roll < 0.9 ? 'Punt' : 'PuntBlocked';
          result = buildScriptedResult({ outcomeType: outcome }, offensePlay, defensePlay, offTeam, defTeam, distanceToGoal, isClashMode);
        }
      } else {
        // Fallback
        result = simulateOrganicPlay(offensePlay, defensePlay, offTeam, defTeam, game.down, game.distance, distanceToGoal, scriptParams.isDoubleTeamed, scriptParams.isMaxProtection, dLineInfo, effectiveThrowingVariant, scriptParams.targetPlayer, effectiveRunVariant, game.difficulty, netSuccessBoost, wasLastPass30Plus, wasLastPassJSNOver10, lastPlayRes, nextGame);
      }
    } else {
      result = simulateOrganicPlay(offensePlay, defensePlay, offTeam, defTeam, game.down, game.distance, distanceToGoal, scriptParams.isDoubleTeamed, scriptParams.isMaxProtection, dLineInfo, effectiveThrowingVariant, scriptParams.targetPlayer, effectiveRunVariant, game.difficulty, netSuccessBoost, wasLastPass30Plus, wasLastPassJSNOver10, lastPlayRes, nextGame);
    }
  } else {
    result = buildScriptedResult(scriptParams, offensePlay, defensePlay, offTeam, defTeam, distanceToGoal, isClashMode);
  }

  if (effectiveThrowingVariant) {
    result.throwingVariant = effectiveThrowingVariant;
  }
  if (effectiveRunVariant) {
    result.runVariant = effectiveRunVariant;
  }
  if (scriptParams.playVariant) {
    result.playVariant = scriptParams.playVariant;
  }

  // Apply netSuccessBoost to yardage under Hard Mode
  if (game.difficulty === 'Hard' && netSuccessBoost !== 0) {
    if (result.yardsGained > 0) {
      result.yardsGained = Math.max(1, Math.round(result.yardsGained * (1 + netSuccessBoost)));
    } else if (result.yardsGained < 0) {
      // make loss more or less severe
      result.yardsGained = Math.round(result.yardsGained * (1 - netSuccessBoost));
    }
  }

  // Apply Team Overall Play Failure Chance (100 - Team OVR % chance to fail, halving yards with realistic broadcast breakdowns)
  // In Hard mode, failure rate is base + 10 (unless that would be a higher chance to fail than 2x, in which case it is 2x)
  result = applyPlayFailureChance(result, offTeam, defTeam, offensePlay, game.distance, game.difficulty, netSuccessBoost);

  // In Hard Mode, force TD scripting is banned
  if (game.difficulty === 'Hard' && result.isTouchdown) {
    result.isTouchdown = false;
    result.yardsGained = Math.min(result.yardsGained, Math.max(1, distanceToGoal - 1));
    result.commentary = result.commentary.replace(/TOUCHDOWN.*!/i, `stopped inside the 1-yard line!`);
  }

  if (scriptParams.drawnPath) {
    result.drawnPath = scriptParams.drawnPath;
    result.isDrawnPlay = true;
  }

  // Update momentum factor based on play results for the next play
  if (game.difficulty === 'Hard' && hardModeFactorsUpdate) {
    let nextMomentum = hardModeFactorsUpdate.momentum;
    if (result.isTouchdown) {
      nextMomentum = 0.3;
    } else if (result.yardsGained >= 15) {
      nextMomentum = Math.min(0.3, nextMomentum + 0.15);
    } else if (result.isTurnover) {
      nextMomentum = Math.max(-0.3, nextMomentum - 0.25);
    } else if (result.outcomeType === 'Sack') {
      nextMomentum = Math.max(-0.3, nextMomentum - 0.15);
    } else {
      // decay towards 0
      nextMomentum = nextMomentum * 0.8;
    }
    hardModeFactorsUpdate.momentum = parseFloat(nextMomentum.toFixed(3));
    nextGame.hardModeFactors = hardModeFactorsUpdate;
  }

  // Trigger Sound Effects based on outcome
  if (result.isTouchdown) {
    playSound.touchdown();
    playSound.crowdCheer();
  } else if (result.outcomeType === 'FieldGoalGood') {
    playSound.kick();
    setTimeout(() => playSound.crowdCheer(), 500);
  } else if (result.isTurnover) {
    playSound.hit();
    playSound.whistle();
  } else if (result.outcomeType === 'Sack') {
    playSound.hit();
    playSound.whistle();
  } else {
    playSound.whistle();
  }

  // Update Game Clock
  let newClockSeconds: number;
  if (scriptParams.clockMode === 'remaining' && typeof scriptParams.clockValue === 'number') {
    newClockSeconds = Math.max(0, scriptParams.clockValue);
    result.clockElapsedSeconds = Math.max(0, nextGame.quarterTimeSeconds - newClockSeconds);
  } else if (scriptParams.clockMode === 'elapsed' && typeof scriptParams.clockValue === 'number') {
    result.clockElapsedSeconds = Math.max(0, scriptParams.clockValue);
    newClockSeconds = Math.max(0, nextGame.quarterTimeSeconds - result.clockElapsedSeconds);
  } else {
    newClockSeconds = Math.max(0, nextGame.quarterTimeSeconds - result.clockElapsedSeconds);
  }
  let newQuarter = nextGame.quarter;

  if (newClockSeconds === 0) {
    playSound.buzzer();
    if (newQuarter === 2) {
      // 2nd Quarter Halftime end: Home team receives ball to start 2nd half at the 25
      newQuarter = 3;
      newClockSeconds = nextGame.quarterLengthMinutes * 60;
      nextGame.possession = 'home';
      nextGame.yardLine = 25;
      nextGame.down = 1;
      nextGame.distance = 10;
      nextGame.driveStartYardLine = 25;
    } else if (newQuarter < 4) {
      newQuarter += 1;
      newClockSeconds = nextGame.quarterLengthMinutes * 60;
    } else {
      // 4th Quarter ended
      if (nextGame.homeScore === nextGame.awayScore) {
        // Overtime!
        newQuarter = 5;
        newClockSeconds = nextGame.quarterLengthMinutes * 60;
      } else {
        nextGame.isGameOver = true;
      }
    }
  }

  nextGame.quarter = newQuarter;
  nextGame.quarterTimeSeconds = newClockSeconds;
  nextGame.playClockSeconds = 40;

  // Track Stats
  const activeStats = isHomePoss ? nextGame.homeStats : nextGame.awayStats;
  if (offensePlay.category === 'Run') {
    activeStats.rushingYards += result.yardsGained;
  } else if (offensePlay.category === 'Pass' || offensePlay.category === 'PlayAction' || offensePlay.category === 'Screen') {
    if (!result.outcomeType.includes('Incomplete') && result.yardsGained > 0) {
      activeStats.passingYards += result.yardsGained;
    }
  }
  activeStats.totalYards = activeStats.passingYards + activeStats.rushingYards;
  if (result.outcomeType === 'Sack') {
    (isHomePoss ? nextGame.awayStats : nextGame.homeStats).sacks += 1;
  }
  if (result.isTurnover) {
    activeStats.turnovers += 1;
  }
  if (result.isFirstDown) {
    activeStats.firstDowns += 1;
  }
  if (nextGame.down === 3) {
    activeStats.thirdDownAttempts += 1;
    if (result.isFirstDown || result.isTouchdown) {
      activeStats.thirdDownConverted += 1;
    }
  }

  // Score & Field Position resolution
  if (result.isTouchdown) {
    // Award 7 points (touchdown + automatic extra point in sim, or 6 if pick-6/defense)
    if (result.outcomeType === 'PickSix') {
      if (isHomePoss) {
        nextGame.awayScore += 7;
      } else {
        nextGame.homeScore += 7;
      }
      // After pick six, other team receives kickoff at their 25
      nextGame.possession = isHomePoss ? 'home' : 'away';
      nextGame.yardLine = 25;
      nextGame.down = 1;
      nextGame.distance = 10;
    } else {
      if (isHomePoss) {
        nextGame.homeScore += 7;
      } else {
        nextGame.awayScore += 7;
      }
      // Opponent gets kickoff at their 25
      nextGame.possession = isHomePoss ? 'away' : 'home';
      nextGame.yardLine = 25;
      nextGame.down = 1;
      nextGame.distance = 10;
    }
  } else if (result.outcomeType === 'FieldGoalGood') {
    if (isHomePoss) {
      nextGame.homeScore += 3;
    } else {
      nextGame.awayScore += 3;
    }
    // Opponent gets ball at 25
    nextGame.possession = isHomePoss ? 'away' : 'home';
    nextGame.yardLine = 25;
    nextGame.down = 1;
    nextGame.distance = 10;
  } else if (result.outcomeType === 'FieldGoalMiss') {
    // Opponent gets ball at spot of kick (or 20 whichever is greater)
    nextGame.possession = isHomePoss ? 'away' : 'home';
    nextGame.yardLine = Math.max(20, 100 - (game.yardLine - 7));
    nextGame.down = 1;
    nextGame.distance = 10;
  } else if (result.outcomeType === 'FieldGoalBlocked') {
    // Defending team gets the ball around the line of scrimmage
    nextGame.possession = isHomePoss ? 'away' : 'home';
    const kickSpot = Math.max(7, game.yardLine - 7);
    nextGame.yardLine = Math.max(5, Math.min(95, 100 - kickSpot));
    nextGame.down = 1;
    nextGame.distance = 10;
  } else if (result.outcomeType === 'Punt') {
    nextGame.possession = isHomePoss ? 'away' : 'home';
    const hasMcAfee1YardLine = isClashMode && (isPatMcAfee1YardLineEquipped() || result.keyPlayer === 'Pat McAfee');
    if (hasMcAfee1YardLine) {
      nextGame.yardLine = 1; // Pinned directly at the 1 yard line!
    } else {
      const puntDistance = Math.min(distanceToGoal - 5, 45 + Math.floor(Math.random() * 8));
      const landing = currentYardLine + puntDistance;
      nextGame.yardLine = landing >= 100 ? 20 : Math.max(5, 100 - landing);
    }
    nextGame.down = 1;
    nextGame.distance = 10;
  } else if (result.outcomeType === 'PuntBlocked') {
    // Blocked inside the backfield
    nextGame.possession = isHomePoss ? 'away' : 'home';
    const blockSpot = Math.max(1, currentYardLine - 10);
    nextGame.yardLine = Math.max(5, Math.min(95, 100 - blockSpot));
    nextGame.down = 1;
    nextGame.distance = 10;
  } else if (result.isSafety) {
    if (isHomePoss) {
      nextGame.awayScore += 2;
    } else {
      nextGame.homeScore += 2;
    }
    // Team that scored safety gets free kick at 35
    nextGame.possession = isHomePoss ? 'away' : 'home';
    nextGame.yardLine = 35;
    nextGame.down = 1;
    nextGame.distance = 10;
  } else if (result.isTurnover) {
    // Possession flips to defense
    nextGame.possession = isHomePoss ? 'away' : 'home';
    const spot = Math.min(99, Math.max(1, currentYardLine + result.yardsGained));
    nextGame.yardLine = Math.max(5, Math.min(95, 100 - spot));
    nextGame.down = 1;
    nextGame.distance = 10;
  } else {
    // Normal play advance
    let newYardLine = currentYardLine + result.yardsGained;

    // Boundary clamps
    if (newYardLine <= 0) {
      // Safety!
      result.isSafety = true;
      result.commentary += ' SAFETY! Tackled in the endzone for 2 points!';
      if (isHomePoss) nextGame.awayScore += 2;
      else nextGame.homeScore += 2;
      nextGame.possession = isHomePoss ? 'away' : 'home';
      nextGame.yardLine = 35;
      nextGame.down = 1;
      nextGame.distance = 10;
    } else if (newYardLine >= 100) {
      // Touchdown!
      result.isTouchdown = true;
      result.commentary += ' TOUCHDOWN!';
      if (isHomePoss) nextGame.homeScore += 7;
      else nextGame.awayScore += 7;
      nextGame.possession = isHomePoss ? 'away' : 'home';
      nextGame.yardLine = 25;
      nextGame.down = 1;
      nextGame.distance = 10;
    } else {
      nextGame.yardLine = newYardLine;

      if (result.yardsGained >= nextGame.distance) {
        // 1st Down converted!
        result.isFirstDown = true;
        nextGame.down = 1;
        nextGame.distance = Math.min(10, 100 - newYardLine);
      } else {
        // Did not make first down
        if (nextGame.down < 4) {
          nextGame.down += 1;
          nextGame.distance = Math.max(1, nextGame.distance - result.yardsGained);
        } else {
          // Turnover on Downs
          result.isTurnover = true;
          result.turnoverType = 'Downs';
          result.commentary += ' Turned over on downs!';
          nextGame.possession = isHomePoss ? 'away' : 'home';
          nextGame.yardLine = 100 - newYardLine;
          nextGame.down = 1;
          nextGame.distance = 10;
        }
      }
    }
  }

  // Format time remaining for drive log
  const mins = Math.floor(nextGame.quarterTimeSeconds / 60);
  const secs = nextGame.quarterTimeSeconds % 60;
  const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  result.playCategory = offensePlay.category;

  nextGame.lastPlayResult = result;
  nextGame.playLog.unshift({
    possession: game.possession,
    offenseTeamId: offTeam.id,
    down: game.down,
    distance: game.distance,
    yardLine: game.yardLine,
    offensePlay: offensePlay.name,
    defensePlay: defensePlay.name,
    result,
    quarter: game.quarter,
    timeRemaining: timeStr,
    score: { home: nextGame.homeScore, away: nextGame.awayScore },
  });

  return { updatedGame: nextGame, result };
}

function buildScriptedResult(
  params: ScriptExecutionParams,
  offPlay: Play,
  defPlay: Play,
  offTeam: NFLTeam,
  defTeam: NFLTeam,
  distanceToGoal: number,
  isClashMode: boolean = false
): PlayResult {
  const targetInfo = getPlayPrimaryTarget(offPlay, offTeam, params.targetPlayer);
  const qb = offTeam.starQB;
  const wr = targetInfo.name;
  const rb = offTeam.starRB;
  const defStar = defTeam.starDef;
  const isPass = offPlay.category !== 'Run';

  const isQbPlay = offPlay.assignments?.some(
    (a) => (a.position === 'QB' || a.id === 'qb') && (a.isPrimary || !!a.runGap)
  );
  const isPlayNameQbRun = /qb|keeper|sneak|option|scramble|draw/i.test(offPlay.name || '') && !isPass;
  const isTargetQb =
    params.targetPlayer &&
    (params.targetPlayer.toLowerCase() === qb.toLowerCase() ||
      params.targetPlayer.toLowerCase().includes(qb.toLowerCase()) ||
      params.targetPlayer.toLowerCase().includes('qb') ||
      params.targetPlayer === 'QB1' ||
      params.targetPlayer === 'QB');
  const isQbRun = !isPass && (isQbPlay || isPlayNameQbRun || isTargetQb || targetInfo.position === 'QB');
  const runner = isQbRun
    ? qb
    : params.targetPlayer &&
      !params.targetPlayer.includes('1st Read') &&
      !params.targetPlayer.includes('Primary')
    ? params.targetPlayer
    : rb;
  const ballCarrier = isPass ? wr : runner;

  switch (params.outcomeType) {
    case 'Touchdown': {
      const yards = distanceToGoal;
      const commentary = isPass
        ? `${qb} drops back, unleashes a strike to ${wr} in stride... TOUCHDOWN ${offTeam.name.toUpperCase()}!`
        : isQbRun
        ? `${qb} fakes the handoff, keeps it on the read option, accelerates down the sideline and dives across the pylon... TOUCHDOWN ${offTeam.name.toUpperCase()}!`
        : `${runner} hits the cutback lane, breaks away into the secondary and sprints into the endzone... TOUCHDOWN!`;
      return {
        outcomeType: 'Touchdown',
        yardsGained: yards,
        commentary,
        isTouchdown: true,
        isTurnover: false,
        isSafety: false,
        isFirstDown: true,
        keyPlayer: ballCarrier,
        clockElapsedSeconds: 24,
        stoppedClock: true,
      };
    }

    case 'BigGain': {
      const yards = Math.min(distanceToGoal - 2, 22 + Math.floor(Math.random() * 18));
      const commentary = isPass
        ? `${qb} steps up into the pocket and fires a ${yards}-yard laser downfield to ${wr}, who secures it across midfield!`
        : isQbRun
        ? `${qb} keeps the ball on the designed run, sidesteps an edge rusher with an elusive cut, and turns on the jets for an electric ${yards}-yard QB gain!`
        : `${runner} breaks through the defensive line, cuts outside with a dynamic stiff-arm, and explodes down the sideline for a ${yards}-yard run!`;
      return {
        outcomeType: 'BigGain',
        yardsGained: yards,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: true,
        keyPlayer: ballCarrier,
        clockElapsedSeconds: 30,
        stoppedClock: false,
      };
    }

    case 'FirstDown': {
      const yards = Math.min(distanceToGoal - 1, 11 + Math.floor(Math.random() * 5));
      const commentary = isPass
        ? `${qb} connects with ${wr} on an out route for a clean first down pickup of ${yards} yards!`
        : isQbRun
        ? `${qb} tucks the football and drives forward behind his blockers, churning his legs for ${yards} yards and a huge QB FIRST DOWN!`
        : `${runner} powers forward behind the guard, churning legs for ${yards} yards and a FIRST DOWN!`;
      return {
        outcomeType: 'FirstDown',
        yardsGained: yards,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: true,
        keyPlayer: ballCarrier,
        clockElapsedSeconds: 28,
        stoppedClock: false,
      };
    }

    case 'ShortGain': {
      const yards = 3 + Math.floor(Math.random() * 3);
      const commentary = isPass
        ? `${qb} checks down into the flat to ${wr}, brought down after a quick pickup of ${yards} yards.`
        : isQbRun
        ? `${qb} scrambles forward on the designed keeper, picking up ${yards} hard-earned yards on the ground.`
        : `${runner} pushes into the line of scrimmage, picking up ${yards} hard-earned yards on the carry.`;
      return {
        outcomeType: 'ShortGain',
        yardsGained: yards,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        keyPlayer: ballCarrier,
        clockElapsedSeconds: 32,
        stoppedClock: false,
      };
    }

    case 'NoGain': {
      const commentary = isPass
        ? `${qb} is forced to check it down to ${runner} in the flat, but ${defStar} reacts instantly and stops him for no gain!`
        : isQbRun
        ? `${defStar} sniffs out the QB keeper immediately and wraps up ${qb} right at the line of scrimmage for no gain!`
        : `${defStar} knifes into the backfield instantly and meets ${runner} right at the line of scrimmage. No gain!`;
      return {
        outcomeType: 'NoGain',
        yardsGained: 0,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        keyPlayer: defStar,
        clockElapsedSeconds: 25,
        stoppedClock: false,
      };
    }

    case 'TackleForLoss': {
      const yards = -(2 + Math.floor(Math.random() * 3));
      const commentary = isPass
        ? `${qb} drops back and attempts a quick screen to ${wr}, but ${defStar} sniffs it out and wraps him up for a loss of ${Math.abs(yards)} yards!`
        : isQbRun
        ? `BLITZ! ${defStar} reads the QB run instantly, penetrates the backfield, and tackles ${qb} for a loss of ${Math.abs(yards)} yards!`
        : `BLITZ! ${defStar} diagnoses the handoff instantly, blows past the block, and wraps up ${runner} for a loss of ${Math.abs(yards)} yards!`;
      return {
        outcomeType: 'TackleForLoss',
        yardsGained: yards,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        keyPlayer: defStar,
        clockElapsedSeconds: 27,
        stoppedClock: false,
      };
    }

    case 'Sack': {
      const yards = -(6 + Math.floor(Math.random() * 5));
      const commentary = isPass
        ? `SACKED! ${defStar} explodes off the edge unblocked and brings ${qb} crashing down for a ${Math.abs(yards)}-yard sack!`
        : isQbRun
        ? `BLOWN UP! ${defStar} swarms through the gap untouched and takes down ${qb} before he can escape for a loss of ${Math.abs(yards)} yards on the keeper!`
        : `BLOWN UP! ${defStar} fires through the gap instantly and drops ${runner} in the backfield for a loss of ${Math.abs(yards)} yards on the run play!`;
      return {
        outcomeType: 'Sack',
        yardsGained: yards,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        keyPlayer: defStar,
        clockElapsedSeconds: 28,
        stoppedClock: false,
      };
    }

    case 'Incomplete': {
      const commentary = isPass
        ? `${qb} targets ${wr} down the sideline, but the coverage is suffocating. Incomplete pass!`
        : isQbRun
        ? `ABORTED PLAY! ${qb} fakes the handoff but is hemmed in by the defense and throws the ball away out of bounds. Incomplete!`
        : `ABORTED PLAY! The handoff exchange between ${qb} and ${runner} is bobbled, and ${qb} has to throw a desperate pass into the turf to avoid a turnover. Incomplete!`;
      return {
        outcomeType: 'Incomplete',
        yardsGained: 0,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        clockElapsedSeconds: 8,
        stoppedClock: true,
      };
    }

    case 'Interception': {
      const commentary = isPass
        ? `INTERCEPTED! ${qb}'s pass is underthrown and picked off by ${defTeam.name}'s secondary!`
        : isQbRun
        ? `FUMBLE RECOVERY! ${qb} fights for extra yardage on the scramble, but ${defStar} strips the ball loose and recovers for the defense!`
        : `FUMBLE RECOVERY! ${runner} takes the handoff but is stripped of the football! ${defStar} recovers the loose ball for the defensive turnover!`;
      return {
        outcomeType: 'Interception',
        yardsGained: 15,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: true,
        turnoverType: isPass ? 'Interception' : 'Fumble',
        isSafety: false,
        isFirstDown: false,
        keyPlayer: defStar,
        clockElapsedSeconds: 15,
        stoppedClock: true,
      };
    }

    case 'PickSix': {
      const commentary = isPass
        ? `PICK SIX! ${defStar} jumps the route, snatches the football, and races 65 yards down the sideline for a DEFENSIVE TOUCHDOWN!`
        : isQbRun
        ? `SCOOP AND SCORE! ${qb} loses control of the ball on a heavy hit, and ${defStar} scoops up the live football, racing 45 yards for a DEFENSIVE TOUCHDOWN!`
        : `SCOOP AND SCORE! ${runner} fumbles the handoff, and ${defStar} scoops up the live ball in stride, racing 45 yards down the sideline for a DEFENSIVE TOUCHDOWN!`;
      return {
        outcomeType: 'PickSix',
        yardsGained: 0,
        commentary: params.customCommentary || commentary,
        isTouchdown: true,
        isTurnover: true,
        turnoverType: isPass ? 'Interception' : 'Fumble',
        isSafety: false,
        isFirstDown: false,
        keyPlayer: defStar,
        clockElapsedSeconds: 18,
        stoppedClock: true,
      };
    }

    case 'FumbleDefense': {
      const commentary = isQbRun
        ? `FUMBLE! ${qb} is hit hard while fighting for extra yards, coughing up the football, and ${defStar} recovers it for the turnover!`
        : `FUMBLE! The football is stripped loose on the hit, and ${defStar} pounces on it! Turnover!`;
      return {
        outcomeType: 'FumbleDefense',
        yardsGained: 2,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: true,
        turnoverType: 'Fumble',
        isSafety: false,
        isFirstDown: false,
        keyPlayer: defStar,
        clockElapsedSeconds: 20,
        stoppedClock: true,
      };
    }

    case 'PenaltyDefense': {
      const yards = 15;
      const commentary = isPass
        ? `FLAG ON THE PLAY! Defensive Pass Interference on ${defTeam.name}. Automatic 1st down, 15 yard penalty!`
        : `FLAG ON THE PLAY! Face Mask penalty against ${defTeam.name}'s defensive line. Automatic 1st down, 15 yard penalty!`;
      return {
        outcomeType: 'PenaltyDefense',
        yardsGained: yards,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: true,
        penaltyYards: 15,
        penaltyName: isPass ? 'Pass Interference' : 'Face Mask',
        clockElapsedSeconds: 10,
        stoppedClock: true,
      };
    }

    case 'PenaltyOffense': {
      const yards = -10;
      const commentary = `FLAG ON THE PLAY! Offensive Holding on the left tackle. 10 yard penalty, replay the down.`;
      return {
        outcomeType: 'PenaltyOffense',
        yardsGained: yards,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        penaltyYards: -10,
        penaltyName: 'Holding',
        clockElapsedSeconds: 12,
        stoppedClock: true,
      };
    }

    case 'FieldGoalGood': {
      const distance = 100 - distanceToGoal + 17; // field goal distance is spot + 17
      const commentary = `The snap is good, hold is clean, kick is up... and IT IS GOOD from ${distance} yards out! 3 Points!`;
      return {
        outcomeType: 'FieldGoalGood',
        yardsGained: 0,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        clockElapsedSeconds: 8,
        stoppedClock: true,
      };
    }

    case 'FieldGoalMiss': {
      const commentary = `The kick has the distance... but pushes wide right! No good!`;
      return {
        outcomeType: 'FieldGoalMiss',
        yardsGained: 0,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        clockElapsedSeconds: 8,
        stoppedClock: true,
      };
    }

    case 'Punt': {
      const isMcAfee = isClashMode && isPatMcAfee1YardLineEquipped();
      const commentary = isMcAfee
        ? `⚡ [GAME BREAKER: 1 YARD LINE • PAT MCAFEE] Pat McAfee unleashes an absolute coffin-corner rainbow! It bounces right before the goal line and dies gracefully at the 1-YARD LINE! Opponent is pinned deep!`
        : `High spiral punt fair caught down inside the red zone.`;
      return {
        outcomeType: 'Punt',
        yardsGained: 0,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        keyPlayer: isMcAfee ? 'Pat McAfee' : undefined,
        clockElapsedSeconds: 12,
        stoppedClock: true,
      };
    }

    case 'FieldGoalBlocked': {
      const commentary = `The kick is up... and IT IS BLOCKED! The rush gets through and swats the ball right off his foot! The defense recovers the live ball!`;
      return {
        outcomeType: 'FieldGoalBlocked',
        yardsGained: 0,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: true,
        turnoverType: 'Fumble',
        isSafety: false,
        isFirstDown: false,
        clockElapsedSeconds: 8,
        stoppedClock: true,
      };
    }

    case 'PuntBlocked': {
      const commentary = `The punter takes the snap... BLOCKED! The edge rush destroys the blocking schemes and bats the ball straight down! The defense recovers in the backfield!`;
      return {
        outcomeType: 'PuntBlocked',
        yardsGained: -15,
        commentary: params.customCommentary || commentary,
        isTouchdown: false,
        isTurnover: true,
        turnoverType: 'Fumble',
        isSafety: false,
        isFirstDown: false,
        clockElapsedSeconds: 8,
        stoppedClock: true,
      };
    }

    case 'CustomYards': {
      const yards = params.customYards ?? 10;
      const isTD = yards >= distanceToGoal;
      const player = params.targetPlayer || (offPlay.category === 'Run' ? runner : wr);
      const customComm = params.customCommentary || (isTD
        ? `${player} bursts clear for a ${yards}-yard play... TOUCHDOWN!`
        : `${player} picks up ${yards} yards on the play.`);

      return {
        outcomeType: 'CustomYards',
        yardsGained: isTD ? distanceToGoal : yards,
        commentary: customComm,
        isTouchdown: isTD,
        isTurnover: params.customEvent === 'turnover',
        isSafety: params.customEvent === 'safety',
        isFirstDown: yards >= 10 || isTD,
        keyPlayer: player,
        clockElapsedSeconds: 26,
        stoppedClock: params.customEvent === 'out_of_bounds' || isTD,
      };
    }

    default:
      return {
        outcomeType: 'ShortGain',
        yardsGained: 4,
        commentary: isPass
          ? `${qb} passes to ${wr} for a short gain of 4 yards.`
          : isQbRun
          ? `${qb} scrambles forward on the designed run for 4 yards.`
          : `${runner} gains 4 yards on the carry.`,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        keyPlayer: ballCarrier,
        clockElapsedSeconds: 30,
        stoppedClock: false,
      };
  }
}

export interface PlayerCardStats {
  speed: number;
  strength: number;
  agility: number;
  awareness: number;
  ovr: number;
}

export function getPlayerCardStats(team: NFLTeam, playerNameOrDesc: string): PlayerCardStats {
  const base = team.ovr || 75;
  const defaultStats: PlayerCardStats = {
    speed: base,
    strength: base,
    agility: base,
    awareness: base,
    ovr: base,
  };

  if (!playerNameOrDesc) return defaultStats;

  // 1. Check team roster if present
  if (team.roster && team.roster.length > 0) {
    const cleanSearch = playerNameOrDesc.toLowerCase();
    const found = team.roster.find((p) => {
      const pName = p.name.toLowerCase();
      return cleanSearch.includes(pName) || pName.includes(cleanSearch);
    });
    if (found) {
      return {
        speed: found.speed ?? found.ovr ?? base,
        strength: found.strength ?? found.ovr ?? base,
        agility: found.agility ?? found.ovr ?? base,
        awareness: found.awareness ?? found.ovr ?? base,
        ovr: found.ovr ?? base,
      };
    }
  }

  // 2. Extract OVR from strings like "Caleb Williams (80)" or "Practice Dummy (45)"
  const ovrMatch = playerNameOrDesc.match(/\((\d{2,3})\)/);
  if (ovrMatch) {
    const parsedOvr = parseInt(ovrMatch[1], 10);
    return {
      speed: parsedOvr,
      strength: parsedOvr,
      agility: parsedOvr,
      awareness: parsedOvr,
      ovr: parsedOvr,
    };
  }

  return defaultStats;
}

export function getTeamFailChancePercent(
  teamOvr: number,
  difficulty?: 'Script' | 'Hard',
  netSuccessBoost?: number,
  defTeamOvr?: number
): number {
  // Tutorial teams (OVR <= 45) should fail almost every play
  if (teamOvr <= 45) {
    return 95;
  }
  // Playing against tutorial / 45 OVR defense: offense executes cleanly
  if (defTeamOvr && defTeamOvr <= 45) {
    return 5;
  }

  const ovr = Math.min(99, Math.max(45, teamOvr || 75));
  let baseFailChancePercent = 100 - ovr; // e.g. 100 - 85 = 15%

  // Team overall differential has a strong effect on execution
  if (typeof defTeamOvr === 'number') {
    const ovrDiff = ovr - defTeamOvr;
    baseFailChancePercent = Math.max(5, Math.min(95, baseFailChancePercent - (ovrDiff * 0.45)));
  }

  let failChancePercent = baseFailChancePercent;

  if (difficulty === 'Hard') {
    // Normal failure rate plus 10, unless (base + 10) would be a higher chance to fail than (base * 2), in which case it is times 2
    if (baseFailChancePercent + 10 > baseFailChancePercent * 2) {
      failChancePercent = baseFailChancePercent * 2;
    } else {
      failChancePercent = baseFailChancePercent + 10;
    }
  }
  failChancePercent = Math.min(100, Math.max(3, failChancePercent));

  // Apply hidden dynamic factors boost/penalty to fail chance in Hard Mode
  if (difficulty === 'Hard' && typeof netSuccessBoost === 'number') {
    failChancePercent = Math.min(100, Math.max(0, failChancePercent - (netSuccessBoost * 100)));
  }
  return Math.round(failChancePercent);
}

export function createExecutionBreakdownResult(
  offTeam: NFLTeam,
  defTeam: NFLTeam,
  offensePlay: Play,
  distanceToGoal: number,
  targetDistance: number,
  failChancePercent: number,
  targetPlayer?: string
): PlayResult {
  const isPass = offensePlay.category !== 'Run';
  const ballCarrier = targetPlayer || (isPass ? offTeam.starWR : offTeam.starRB);
  const qb = offTeam.starQB;
  const defStar = defTeam.starDef;

  const halvedYards = Math.min(distanceToGoal - 1, Math.max(1, Math.floor(1 + Math.random() * 3)));

  const breakdownVariants = [
    {
      reason: 'Slipped on turf',
      text: `${ballCarrier} made a sudden cut but lost his footing and slipped down on the turf! Stumbles down early, cutting the gain in half to ${halvedYards} yards.`,
    },
    {
      reason: 'Ankle tackle',
      text: `${defStar} lunged with a diving shoestring tackle, tripping up ${ballCarrier} just as a wide open lane was developing (${halvedYards} yd gain).`,
    },
    {
      reason: 'Swarmed by defense',
      text: `${defTeam.name}'s defense swarmed to the football in numbers, converging to gang-tackle ${ballCarrier} and halving the pickup to ${halvedYards} yards.`,
    },
    {
      reason: 'Fell in open field',
      text: `${ballCarrier} tripped over his own feet in the secondary and tumbled to the grass, stopped short after ${halvedYards} yards.`,
    },
    {
      reason: 'Lineman collision',
      text: `${ballCarrier} collided with his own pulling guard in the gap, stumbling forward to salvage only ${halvedYards} yards.`,
    },
    {
      reason: 'Off-balance throw',
      text: `${qb} was pressured and forced to throw off-platform; ${ballCarrier} had to stop his stride and dive backward for an awkward ${halvedYards}-yard catch before being downed.`,
    },
    {
      reason: 'Bobbled reception',
      text: `${ballCarrier} bobbled the pass off his hands before securing it, allowing ${defStar} to immediately wrap him up after ${halvedYards} yards.`,
    },
    {
      reason: 'Blown blocking assignment',
      text: `A missed blocking assignment allowed ${defStar} to knife through untouched, slowing down ${ballCarrier} for a reduced ${halvedYards}-yard gain.`,
    },
    {
      reason: 'Heavy pocket collapse',
      text: `Pass rush broke the pocket instantly; ${qb} threw a desperate checkdown to ${ballCarrier}, who was tackled for ${halvedYards} yards.`,
    },
  ];

  const chosen = breakdownVariants[Math.floor(Math.random() * breakdownVariants.length)];

  return {
    outcomeType: halvedYards >= targetDistance ? 'FirstDown' : 'ShortGain',
    yardsGained: halvedYards,
    commentary: `[EXECUTION BREAKDOWN • ${failChancePercent}% FAIL CHANCE] ${chosen.text}`,
    isTouchdown: false,
    isTurnover: false,
    isSafety: false,
    isFirstDown: halvedYards >= targetDistance,
    isFailedPlay: true,
    failureReason: chosen.reason,
    keyPlayer: ballCarrier,
    clockElapsedSeconds: 24,
    stoppedClock: false,
    skipFailureCheck: true,
  };
}

function simulateOrganicPlay(
  offPlay: Play,
  defPlay: Play,
  offTeam: NFLTeam,
  defTeam: NFLTeam,
  down: number,
  distance: number,
  distanceToGoal: number,
  isDoubleTeamed?: boolean,
  isMaxProtection?: boolean,
  dLineInfo?: { oLineMath: number; dLineMath: number; highestDLine: number; lowestDLine: number; isDLineSuperior: boolean; boost: number },
  throwingVariant?: QBThrowingVariant,
  targetPlayer?: string,
  runVariant?: RunStyleVariant,
  difficulty?: 'Script' | 'Hard',
  netSuccessBoost?: number,
  wasLastPass30Plus?: boolean,
  wasLastPassJSNOver10?: boolean,
  lastPlayRes?: PlayResult | null,
  activeGameObj?: ActiveGame
): PlayResult {
  const isRun = offPlay.category === 'Run';
  const isBlitz = defPlay.category === 'Blitz';
  const roll = Math.random();

  const failChancePercent = getTeamFailChancePercent(offTeam.ovr, difficulty, netSuccessBoost, defTeam.ovr);
  const failChance = failChancePercent / 100;

  const isSuperior = dLineInfo?.isDLineSuperior;
  const isProtected = isDoubleTeamed || isMaxProtection;

  const isClashMode = !!activeGameObj?.clashGameContext;
  const qb = offTeam.starQB;
  const hasAndrewLuckComposure = isClashMode && (isAndrewLuckComposureEquipped() || qb.toLowerCase().includes('andrew luck'));
  const passTargetInfo = !isRun ? getPlayPrimaryTarget(offPlay, offTeam, targetPlayer) : null;
  const primaryTarget = passTargetInfo ? passTargetInfo.name : (offTeam.starWR || 'Receiver');
  const isQbPlay = offPlay.assignments?.some(
    (a) => (a.position === 'QB' || a.id === 'qb') && (a.isPrimary || !!a.runGap)
  );
  const isPlayNameQbRun = /qb|keeper|sneak|option|scramble|draw/i.test(offPlay.name || '') && isRun;
  const isTargetQb =
    targetPlayer &&
    (targetPlayer.toLowerCase() === qb.toLowerCase() ||
      targetPlayer.toLowerCase().includes(qb.toLowerCase()) ||
      targetPlayer.toLowerCase().includes('qb') ||
      targetPlayer === 'QB1' ||
      targetPlayer === 'QB');
  const targetInfo = isRun ? getPlayPrimaryTarget(offPlay, offTeam, targetPlayer) : null;
  const isQbRun = isRun && (isQbPlay || isPlayNameQbRun || isTargetQb || targetInfo?.position === 'QB');
  const runner = isQbRun
    ? qb
    : targetPlayer && targetPlayer !== 'FIRST_READ'
    ? targetPlayer
    : offTeam.starRB;

  const runnerStats = getPlayerCardStats(offTeam, runner);
  const qbStats = getPlayerCardStats(offTeam, qb);
  const targetStats = getPlayerCardStats(offTeam, primaryTarget);

  // 45 OVR Practice Dummy Squad: Massive failure rate (fails almost every play)
  if (offTeam.ovr <= 50) {
    const dummyRoll = Math.random();
    if (dummyRoll < 0.45) {
      // 45% Sack or TFL
      const loss = isRun ? -(2 + Math.floor(Math.random() * 4)) : -(4 + Math.floor(Math.random() * 6));
      return {
        outcomeType: isRun ? 'TackleForLoss' : 'Sack',
        yardsGained: loss,
        commentary: `🤖 [45 OVR PRACTICE DUMMY] The dummy O-line folds immediately! ${defTeam.starDef} barrels through untouched for a ${Math.abs(loss)}-yard loss!`,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        keyPlayer: defTeam.starDef,
        clockElapsedSeconds: 20,
        stoppedClock: false,
        skipFailureCheck: true,
      };
    } else if (dummyRoll < 0.70) {
      // 25% Turnover (fumble or interception)
      if (isRun || Math.random() < 0.4) {
        return {
          outcomeType: 'FumbleDefense',
          yardsGained: 0,
          commentary: `🤖 [45 OVR PRACTICE DUMMY] Practice Dummy loses control of the football! FUMBLE recovered by ${defTeam.starDef}!`,
          isTouchdown: false,
          isTurnover: true,
          turnoverType: 'Fumble',
          isSafety: false,
          isFirstDown: false,
          keyPlayer: defTeam.starDef,
          clockElapsedSeconds: 16,
          stoppedClock: true,
          skipFailureCheck: true,
        };
      } else {
        return {
          outcomeType: 'Interception',
          yardsGained: 14,
          commentary: `🤖 [45 OVR PRACTICE DUMMY] Practice Dummy QB throws an erratic pass right into the waiting arms of ${defTeam.starDef} for an INTERCEPTION!`,
          isTouchdown: false,
          isTurnover: true,
          turnoverType: 'Interception',
          isSafety: false,
          isFirstDown: false,
          keyPlayer: defTeam.starDef,
          clockElapsedSeconds: 18,
          stoppedClock: true,
          skipFailureCheck: true,
        };
      }
    } else if (dummyRoll < 0.90) {
      // 20% Incomplete or no gain
      if (!isRun) {
        return {
          outcomeType: 'Incomplete',
          yardsGained: 0,
          commentary: `🤖 [45 OVR PRACTICE DUMMY] Practice Dummy QB throws a wobbly pass that hits the dirt 8 yards short. Incomplete.`,
          isTouchdown: false,
          isTurnover: false,
          isSafety: false,
          isFirstDown: false,
          keyPlayer: qb,
          clockElapsedSeconds: 8,
          stoppedClock: true,
          skipFailureCheck: true,
        };
      } else {
        return {
          outcomeType: 'NoGain',
          yardsGained: 0,
          commentary: `🤖 [45 OVR PRACTICE DUMMY] Practice Dummy runner trips over his own lineman's foot, stopped at the line of scrimmage for no gain.`,
          isTouchdown: false,
          isTurnover: false,
          isSafety: false,
          isFirstDown: false,
          keyPlayer: runner,
          clockElapsedSeconds: 22,
          stoppedClock: false,
          skipFailureCheck: true,
        };
      }
    }
  }

  // High probability of TFL/Sack when D-Line math is higher than O-line and NOT double-teamed!
  if (isSuperior && !isProtected && roll < 0.48) {
    const rusher = defTeam.starDef || 'Myles Garrett';
    const lossYards = isRun ? -3 : -(4 + Math.floor(Math.random() * 5));
    const tacklee = isRun ? runner : qb;

    // Andrew Luck Composure: Never get sacked, instead complete pass or throw away
    if (!isRun && hasAndrewLuckComposure) {
      const luckEvadeRoll = Math.random();
      if (luckEvadeRoll < 0.65) {
        // Completion
        const yards = Math.min(distanceToGoal, Math.floor(4 + Math.random() * 8));
        const is1st = yards >= distance;
        return {
          outcomeType: is1st ? 'FirstDown' : 'ShortGain',
          yardsGained: yards,
          commentary: `⚡ [GAME BREAKER: COMPOSURE • ANDREW LUCK] ${rusher} explodes into the backfield, but Andrew Luck stands firm in the face of the rush and delivers a strike to ${primaryTarget} while being hit for ${yards} yards!`,
          isTouchdown: yards >= distanceToGoal,
          isTurnover: false,
          isSafety: false,
          isFirstDown: is1st,
          keyPlayer: primaryTarget,
          clockElapsedSeconds: 24,
          stoppedClock: false,
          skipFailureCheck: true,
        };
      } else {
        // Throw away
        return {
          outcomeType: 'Incomplete',
          yardsGained: 0,
          commentary: `⚡ [GAME BREAKER: COMPOSURE • ANDREW LUCK] ${rusher} is draped all over Andrew Luck, but Luck's composure is unmatched as he manages to throw the ball away safely! Incomplete.`,
          isTouchdown: false,
          isTurnover: false,
          isSafety: false,
          isFirstDown: false,
          keyPlayer: qb,
          clockElapsedSeconds: 8,
          stoppedClock: true,
          skipFailureCheck: true,
        };
      }
    }

    return {
      outcomeType: isRun ? 'TackleForLoss' : 'Sack',
      yardsGained: lossYards,
      commentary: `⚡ [D-LINE DOMINANCE • +20 STAT BOOST] ${rusher} overpowers the O-Line and drops ${tacklee} for a ${Math.abs(lossYards)}-yard loss!`,
      isTouchdown: false,
      isTurnover: false,
      isSafety: false,
      isFirstDown: false,
      keyPlayer: rusher,
      clockElapsedSeconds: 24,
      stoppedClock: false,
      skipFailureCheck: true,
    };
  }

  const dtText = isProtected ? ` 🛡️ [Double Teamed ${defTeam.starDef || 'Myles Garrett'}]` : '';
  const offOvr = offTeam.ovr || offTeam.off || 75;
  const defOvr = defTeam.ovr || defTeam.def || 75;
  const ovrAdvantage = offOvr - defOvr;
  const offRatingAdvantage = ovrAdvantage * 0.015;

  if (isRun) {
    // Christian McCaffrey Game Breaker: Not Lost Yet (gains rush worth a first down if current down is 4th and last rush was < 3 yards) - Gridiron Clash only
    const hasNotLostYet = isClashMode && (isChristianMcCaffreyNotLostYetEquipped() || runner === 'Christian McCaffrey') && down === 4 && lastPlayRes && !lastPlayRes.isTurnover && lastPlayRes.yardsGained < 3;
    if (hasNotLostYet) {
      const yards = Math.min(distanceToGoal, Math.max(distance, Math.floor(distance + Math.random() * 3)));
      const isTD = yards >= distanceToGoal;
      return {
        outcomeType: isTD ? 'Touchdown' : 'FirstDown',
        yardsGained: yards,
        commentary: `🔥 [GAME BREAKER: NOT LOST YET • CHRISTIAN MCCAFFREY] Facing 4th down after a stuffed prior run, Christian McCaffrey slips through the arm tackles with lightning quickness, bursting for ${yards} yards and a massive FIRST DOWN!${dtText}`,
        isTouchdown: isTD,
        isTurnover: false,
        isSafety: false,
        isFirstDown: true,
        keyPlayer: runner,
        clockElapsedSeconds: 28,
        stoppedClock: isTD,
        skipFailureCheck: true,
      };
    }

    // -------------------------------------------------------------
    // RUN PLAY SPECIAL VARIANTS (Power, Speed, Patience)
    // Formula: Mess Ups = Backfires + Mess Up Chance (added together).
    // Normal Play Chance = 100% - Big Plays - Total Mess Ups.
    // -------------------------------------------------------------
    if (runVariant === 'power') {
      const hasHomeWrecker = isClashMode && runner === 'Wayne Garrett';

      if (hasHomeWrecker) {
        // Wayne Garrett Home Wrecker (Power Run Only, Unlimited Uses when runner is Wayne Garrett): 75% Best Outcome (Big Run/TD), 25% OK Outcome (3-9 yd gain)
        const wgRoll = Math.random();
        if (wgRoll < 0.75) {
          const yards = Math.min(distanceToGoal, Math.max(10, Math.floor(10 + Math.random() * 16)));
          const isTD = yards >= distanceToGoal;
          const commText = isTD
            ? `🔥 [GAME BREAKER ACTIVATED: HOME WRECKER • WAYNE GARRETT] [75% BEST OUTCOME • POWER TOUCHDOWN!] Wayne Garrett lowers his helmet, barrels through 3 arm tackles, and punches it in for a TOUCHDOWN!${dtText}`
            : `🔥 [GAME BREAKER ACTIVATED: HOME WRECKER • WAYNE GARRETT] [75% BEST OUTCOME • POWER BIG RUN] Wayne Garrett truck-sticks the linebacker and bursts into the secondary for a violent ${yards}-yard power run!${dtText}`;
          return {
            outcomeType: isTD ? 'Touchdown' : 'BigGain',
            yardsGained: yards,
            commentary: commText,
            isTouchdown: isTD,
            isTurnover: false,
            isSafety: false,
            isFirstDown: true,
            keyPlayer: 'Wayne Garrett',
            clockElapsedSeconds: 26,
            stoppedClock: isTD,
            skipFailureCheck: true,
          };
        } else {
          // 25% OK Outcome: Solid Push (3 to 9 yards)
          const yards = Math.min(distanceToGoal, Math.max(3, Math.floor(3 + Math.random() * 7)));
          const is1st = yards >= distance;
          return {
            outcomeType: is1st ? 'FirstDown' : 'ShortGain',
            yardsGained: yards,
            commentary: `💥 [GAME BREAKER ACTIVATED: HOME WRECKER • WAYNE GARRETT] [25% OK OUTCOME] Wayne Garrett plows forward behind his guards, churning his legs for a solid ${yards}-yard pickup.${dtText}`,
            isTouchdown: yards >= distanceToGoal,
            isTurnover: false,
            isSafety: false,
            isFirstDown: is1st,
            keyPlayer: 'Wayne Garrett',
            clockElapsedSeconds: 28,
            stoppedClock: false,
            skipFailureCheck: true,
          };
        }
      }

      // Generic Power Run (Non-Wayne Garrett): 25% 1st Down, 25% Fumble, failChance% Execution Breakdown, remaining Normal Run
      const bigPlayChance = 0.25;
      const fumbleChance = 0.25;
      const powerRoll = Math.random();
      if (powerRoll < bigPlayChance) {
        // Guaranteed 1st Down / Big Play
        const yards = Math.min(distanceToGoal, Math.max(distance, Math.floor(3 + Math.random() * 5)));
        const isTD = yards >= distanceToGoal;
        const commText = isTD
          ? isQbRun
            ? `💥 [QB POWER RUN • TOUCHDOWN!] ${qb} drops his shoulder, barrels into the endzone and punches it in for a TOUCHDOWN!${dtText}`
            : `💥 [POWER RUN • TOUCHDOWN!] ${runner} lowers his shoulder, barrels through the pile at the goal line and punches it in for a TOUCHDOWN!${dtText}`
          : isQbRun
          ? `💥 [QB POWER RUN • GUARANTEED 1ST DOWN] ${qb} lowers his helmet, trucks a linebacker for ${yards} yards and secures a punishing FIRST DOWN!${dtText}`
          : `💥 [POWER RUN • GUARANTEED 1ST DOWN] ${runner} lowers his helmet, trucks a linebacker for ${yards} yards and secures a punishing FIRST DOWN!${dtText}`;
        return {
          outcomeType: isTD ? 'Touchdown' : 'FirstDown',
          yardsGained: yards,
          commentary: commText,
          isTouchdown: isTD,
          isTurnover: false,
          isSafety: false,
          isFirstDown: true,
          keyPlayer: runner,
          clockElapsedSeconds: 28,
          stoppedClock: isTD,
          skipFailureCheck: true,
        };
      } else if (powerRoll < bigPlayChance + fumbleChance) {
        // Fumble (Backfire Mess Up)
        const commText = isQbRun
          ? `💥 [QB RUN • FUMBLE!] ${qb} carries into the teeth of the defense... ${defTeam.starDef} puts a helmet on the football and POPS IT LOOSE! FUMBLE recovered by the defense!`
          : `💥 [POWER RUN • FUMBLE!] ${runner} collides into the teeth of the defense... ${defTeam.starDef} puts a helmet on the football and POPS IT LOOSE! FUMBLE recovered by the defense!`;
        return {
          outcomeType: 'FumbleDefense',
          yardsGained: 1,
          commentary: commText,
          isTouchdown: false,
          isTurnover: true,
          turnoverType: 'Fumble',
          isSafety: false,
          isFirstDown: false,
          keyPlayer: defTeam.starDef,
          clockElapsedSeconds: 20,
          stoppedClock: true,
          skipFailureCheck: true,
        };
      } else if (powerRoll < bigPlayChance + fumbleChance + failChance) {
        // Mess Up Play Chance: Execution breakdown
        return createExecutionBreakdownResult(offTeam, defTeam, offPlay, distanceToGoal, distance, failChancePercent, runner);
      }
      // Remaining: Falls through to standard normal organic run play
    } else if (runVariant === 'speed') {
      // Generic Speed Run: 25% Big Play, 25% Tackled for Loss, failChance% Execution Breakdown, remaining Normal Run
      const speedRoll = Math.random();
      if (speedRoll < 0.25) {
        // 25% Big Play
        const yards = Math.min(distanceToGoal, Math.floor(18 + Math.random() * 16));
        const isTD = yards >= distanceToGoal;
        const commText = isTD
          ? isQbRun
            ? `⚡ [QB SPEED RUN • TOUCHDOWN!] ${qb} hits the edge with blazing 4.4 speed, outruns the pursuit angle, and sprints ${yards} yards into the endzone for a TOUCHDOWN!${dtText}`
            : `⚡ [SPEED RUN • TOUCHDOWN!] ${runner} hits the edge with blazing acceleration, outruns the pursuit angle, and sprints ${yards} yards into the endzone for a TOUCHDOWN!${dtText}`
          : isQbRun
          ? `⚡ [QB SPEED RUN • BIG PLAY] ${qb} turns the corner on the keeper with electric burst, racing past the secondary for a huge ${yards}-yard breakaway gain!${dtText}`
          : `⚡ [SPEED RUN • BIG PLAY] ${runner} turns the corner with electric burst, racing past the secondary for a huge ${yards}-yard breakaway gain!${dtText}`;
        return {
          outcomeType: isTD ? 'Touchdown' : 'BigGain',
          yardsGained: yards,
          commentary: commText,
          isTouchdown: isTD,
          isTurnover: false,
          isSafety: false,
          isFirstDown: true,
          keyPlayer: runner,
          clockElapsedSeconds: 22,
          stoppedClock: isTD,
          skipFailureCheck: true,
        };
      } else if (speedRoll < 0.50) {
        // 25% Hit and tackled for loss (Backfire Mess Up)
        const tflLoss = -(2 + Math.floor(Math.random() * 3));
        const commText = isQbRun
          ? `⚡ [QB RUN • TACKLED FOR LOSS] ${qb} bounces outside looking for daylight, but ${defTeam.starDef} tracks down the quarterback behind the line for a ${Math.abs(tflLoss)}-yard loss!`
          : `⚡ [SPEED RUN • TACKLED FOR LOSS] ${runner} bounces outside looking for daylight, but ${defTeam.starDef} tracks down the runner behind the line for a ${Math.abs(tflLoss)}-yard loss!`;
        return {
          outcomeType: 'TackleForLoss',
          yardsGained: tflLoss,
          commentary: commText,
          isTouchdown: false,
          isTurnover: false,
          isSafety: false,
          isFirstDown: false,
          keyPlayer: defTeam.starDef,
          clockElapsedSeconds: 26,
          stoppedClock: false,
          skipFailureCheck: true,
        };
      } else if (speedRoll < 0.50 + failChance) {
        // Mess Up Play Chance: Execution breakdown
        return createExecutionBreakdownResult(offTeam, defTeam, offPlay, distanceToGoal, distance, failChancePercent, runner);
      }
      // Remaining (50% - failChance%): Falls through to standard normal organic run play
    } else if (runVariant === 'patience') {
      // Generic Patience Run: 15% Touchdown, 30% Loss of 10 Yards, failChance% Execution Breakdown, remaining Normal Run
      const patienceRoll = Math.random();
      if (patienceRoll < 0.15) {
        // 15% Touchdown (Big Play)
        const commText = isQbRun
          ? `🧘 [PATIENT QB RUN • TOUCHDOWN!] ${qb} hesitates behind the offensive line, waits for the pulling guard's block to seal the edge, cuts through the crease and goes ALL THE WAY FOR A TOUCHDOWN!${dtText}`
          : `🧘 [PATIENT RUN • TOUCHDOWN!] ${runner} hesitates behind the offensive line, waits for the pulling guard's block to seal the edge, cuts through the crease and goes ALL THE WAY FOR A TOUCHDOWN!${dtText}`;
        return {
          outcomeType: 'Touchdown',
          yardsGained: distanceToGoal,
          commentary: commText,
          isTouchdown: true,
          isTurnover: false,
          isSafety: false,
          isFirstDown: true,
          keyPlayer: runner,
          clockElapsedSeconds: 26,
          stoppedClock: true,
          skipFailureCheck: true,
        };
      } else if (patienceRoll < 0.45) {
        // 30% Loss of 10 yards (Backfire Mess Up)
        const commText = isQbRun
          ? `🧘 [PATIENT QB RUN • -10 YARD LOSS] ${qb} stops and waits behind the line for a lane to open, but the defense swarms the backfield for a crushing 10-YARD LOSS!`
          : `🧘 [PATIENT RUN • -10 YARD LOSS] ${runner} stops and waits behind the line for a lane to open, but the defense swarms the backfield for a crushing 10-YARD LOSS!`;
        return {
          outcomeType: 'TackleForLoss',
          yardsGained: -10,
          commentary: commText,
          isTouchdown: false,
          isTurnover: false,
          isSafety: false,
          isFirstDown: false,
          keyPlayer: defTeam.starDef,
          clockElapsedSeconds: 28,
          stoppedClock: false,
          skipFailureCheck: true,
        };
      } else if (patienceRoll < 0.45 + failChance) {
        // Mess Up Play Chance: Execution breakdown
        return createExecutionBreakdownResult(offTeam, defTeam, offPlay, distanceToGoal, distance, failChancePercent, runner);
      }
      // Remaining (55% - failChance%): Falls through to standard normal organic run play
    }

    if (isBlitz && roll < 0.2) {
      // Blitz stuffed run
      return {
        outcomeType: 'TackleForLoss',
        yardsGained: -2,
        commentary: `${defTeam.starDef} reads the blitz gap and drops ${runner} for a 2-yard loss!${dtText}`,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        keyPlayer: defTeam.starDef,
        clockElapsedSeconds: 28,
        stoppedClock: false,
        skipFailureCheck: !!runVariant,
      };
    }
    if (roll < 0.05 + offRatingAdvantage && distanceToGoal <= 25) {
      // Breakaway TD run
      const commText = isQbRun
        ? `${qb} keeps it around the edge, outruns the angle and dives into the pylon... TOUCHDOWN!${dtText}`
        : `${runner} bounces outside, outruns the angle and dives into the pylon... TOUCHDOWN!${dtText}`;
      return {
        outcomeType: 'Touchdown',
        yardsGained: distanceToGoal,
        commentary: commText,
        isTouchdown: true,
        isTurnover: false,
        isSafety: false,
        isFirstDown: true,
        keyPlayer: runner,
        clockElapsedSeconds: 22,
        stoppedClock: true,
        skipFailureCheck: !!runVariant,
      };
    }
    // Standard run gain enhanced by card stats (Speed, Agility, Strength) & team overall
    let runBonus = 0;
    let runCommentaryFlair = '';

    // Speed bonus
    if (runnerStats.speed > 75) {
      const spdBonus = Math.floor((runnerStats.speed - 75) * 0.25);
      runBonus += spdBonus;
      if (runnerStats.speed >= 80 && Math.random() < 0.30) {
        runBonus += 3;
        runCommentaryFlair += ` ⚡ [${runnerStats.speed} SPD BURST]`;
      }
    } else if (runnerStats.speed <= 50) {
      runBonus -= 2;
    }

    // Agility bonus
    if (runnerStats.agility >= 80 && Math.random() < 0.28) {
      runBonus += 3;
      runCommentaryFlair += ` 🎯 [${runnerStats.agility} AGI CUT]`;
    }

    // Strength short yardage conversion
    if (down >= 3 && distance <= 3 && runnerStats.strength >= 78 && Math.random() < 0.85) {
      runBonus += distance;
      runCommentaryFlair += ` 💪 [${runnerStats.strength} STR TRUCK]`;
    }

    // Team Overall advantage bonus (e.g. against 45 OVR practice dummies)
    if (defOvr <= 50) {
      runBonus += 6; // dominant blocking against 45 OVR squad
    } else if (ovrAdvantage > 5) {
      runBonus += Math.min(6, Math.floor(ovrAdvantage * 0.2));
    }

    const yards = Math.min(distanceToGoal, Math.max(1, Math.floor(2 + Math.random() * 8) + runBonus));
    const is1st = yards >= distance;
    const commText = isQbRun
      ? `${qb} keeps it on the designed run and plows forward for ${yards} yards${is1st ? ' and a FIRST DOWN!' : '.'}${runCommentaryFlair}${dtText}`
      : `${runner} takes the handoff and plows forward for ${yards} yards${is1st ? ' and a FIRST DOWN!' : '.'}${runCommentaryFlair}${dtText}`;
    return {
      outcomeType: is1st ? 'FirstDown' : 'ShortGain',
      yardsGained: yards,
      commentary: commText,
      isTouchdown: yards >= distanceToGoal,
      isTurnover: false,
      isSafety: false,
      isFirstDown: is1st,
      keyPlayer: runner,
      clockElapsedSeconds: 32,
      stoppedClock: false,
      skipFailureCheck: !!runVariant,
    };
  } else {
    // -------------------------------------------------------------
    // PASS PLAY SPECIAL VARIANTS (Lob Pass, In Stride, Straight To Them)
    // Formula: Mess Ups = Backfires + Mess Up Chance (added together).
    // Normal Play Chance = 100% - Big Plays - Total Mess Ups.
    // -------------------------------------------------------------
    const targetInfo = getPlayPrimaryTarget(offPlay, offTeam);
    const primaryTarget = targetPlayer && targetPlayer !== 'FIRST_READ' ? targetPlayer : targetInfo.name;

    // Check Cam Newton's Game Breaker: "Ignore the odds"
    // "after throwing for a 30+ yard play, his next pass has a 100% chance to do the big play" - Gridiron Clash only
    const hasCamNewtonIgnoreOdds = isClashMode && (isCamNewtonEquipped() || offTeam.starQB === 'Cam Newton') && !!wasLastPass30Plus;
    if (hasCamNewtonIgnoreOdds) {
      const bigYards = Math.min(distanceToGoal, Math.floor(32 + Math.random() * 22));
      const isTD = bigYards >= distanceToGoal;
      return {
        outcomeType: isTD ? 'Touchdown' : 'BigGain',
        yardsGained: bigYards,
        commentary: isTD
          ? `⚡ [GAME BREAKER: IGNORE THE ODDS • CAM NEWTON] 100% Big Play Activated! Cam Newton launches a 60-yard rocket to ${primaryTarget} for an incredible TOUCHDOWN!${dtText}`
          : `⚡ [GAME BREAKER: IGNORE THE ODDS • CAM NEWTON] 100% Big Play Activated! Cam Newton uncorks a deep missile to ${primaryTarget} for a massive ${bigYards}-yard explosive gain!${dtText}`,
        isTouchdown: isTD,
        isTurnover: false,
        isSafety: false,
        isFirstDown: true,
        keyPlayer: 'Cam Newton',
        clockElapsedSeconds: 20,
        stoppedClock: isTD,
        skipFailureCheck: true,
      };
    }

    // Check Jaxon Smith-Njigba's Game Breaker: "Emerald City Route Artist"
    // "If JSN catches a pass over 10 yards, he has a 60 percent chance to be completly wide open next play." - Gridiron Clash only
    const hasJSNRouteArtist = isClashMode && (isJSNRouteArtistEquipped() || offTeam.starWR === 'Jaxon Smith-Njigba' || offTeam.id === 'SEA') && !!wasLastPassJSNOver10;
    if (hasJSNRouteArtist && Math.random() < 0.60) {
      const jsnYards = Math.min(distanceToGoal, Math.floor(22 + Math.random() * 26));
      const isTD = jsnYards >= distanceToGoal;
      return {
        outcomeType: isTD ? 'Touchdown' : 'BigGain',
        yardsGained: jsnYards,
        commentary: isTD
          ? `⚡ [GAME BREAKER: EMERALD CITY ROUTE ARTIST • JAXON SMITH-NJIGBA] 60% Wide Open Activated! JSN breaks his defender's ankles with an electric cut, breaking completely wide open for an electrifying ${jsnYards}-yard TOUCHDOWN!${dtText}`
          : `⚡ [GAME BREAKER: EMERALD CITY ROUTE ARTIST • JAXON SMITH-NJIGBA] 60% Wide Open Activated! JSN leaves the coverage in the dust with surgical route running, hauling in a wide-open ${jsnYards}-yard laser!${dtText}`,
        isTouchdown: isTD,
        isTurnover: false,
        isSafety: false,
        isFirstDown: true,
        keyPlayer: 'Jaxon Smith-Njigba',
        clockElapsedSeconds: 18,
        stoppedClock: isTD,
        skipFailureCheck: true,
      };
    }

    // 1. Lob Pass (50/50 Ball: 50% completed, 25% intercepted, 25% incomplete)
    // All mess ups added together = 25% INT + 25% Incomplete = 50% Mess Ups
    if (throwingVariant === 'lob_pass') {
      let lobRoll = Math.random();
      const isKelceAbilityActive = isClashMode &&
        primaryTarget === 'Travis Kelce' &&
        offTeam.starQB.toLowerCase().includes('patrick mahomes') &&
        isTravisKelceJumpBallEquipped();
      
      let intThreshold = 0.25;
      let incThreshold = 0.50;
      
      if (isKelceAbilityActive) {
          intThreshold = 0.125;
          incThreshold = 0.25;
      }

      if (lobRoll < intThreshold) {
        // 25% (or 12.5% if Kelce active) chance to be intercepted (Backfire Mess Up)
        return {
          outcomeType: 'Interception',
          yardsGained: 10,
          commentary: `🏈 [50/50 LOB PASS • INTERCEPTED] ${offTeam.starQB} lofts a high 50/50 jump ball for ${primaryTarget}, but ${defTeam.starDef} out-jumps the receiver at the apex for the INTERCEPTION!`,
          isTouchdown: false,
          isTurnover: true,
          turnoverType: 'Interception',
          isSafety: false,
          isFirstDown: false,
          keyPlayer: defTeam.starDef,
          clockElapsedSeconds: 16,
          stoppedClock: true,
          skipFailureCheck: true,
        };
      } else if (lobRoll < incThreshold) {
        // 25% (or 12.5% if Kelce active) chance to be incomplete (Backfire Mess Up)
        return {
          outcomeType: 'Incomplete',
          yardsGained: 0,
          commentary: `🏈 [50/50 LOB PASS • INCOMPLETE] ${offTeam.starQB} puts air under the 50/50 ball for ${primaryTarget}, but ${defTeam.starDef} contests the jump ball and bats it incomplete!`,
          isTouchdown: false,
          isTurnover: false,
          isSafety: false,
          isFirstDown: false,
          keyPlayer: primaryTarget,
          clockElapsedSeconds: 8,
          stoppedClock: true,
          skipFailureCheck: true,
        };
      } else {
        // 50% (or 75% if Kelce active) chance to be completed (big 50/50 contested grab) - affected by mess up breakdown
        if (Math.random() < failChance) {
          return createExecutionBreakdownResult(offTeam, defTeam, offPlay, distanceToGoal, distance, failChancePercent, primaryTarget);
        }
        const yards = Math.min(distanceToGoal, Math.floor(18 + Math.random() * 18));
        const isTD = yards >= distanceToGoal;
        const is1st = yards >= distance;
        return {
          outcomeType: isTD ? 'Touchdown' : (is1st ? 'BigGain' : 'FirstDown'),
          yardsGained: yards,
          commentary: isTD
            ? `🏈 [50/50 LOB PASS • TOUCHDOWN!] ${offTeam.starQB} lofts a 50/50 rainbow into the endzone... ${primaryTarget} climbs the ladder, mosses the defensive back, and pulls down the TOUCHDOWN!`
            : `🏈 [50/50 LOB PASS • 50/50 RECEPTION] ${offTeam.starQB} lofts a high-arching 50/50 ball into coverage... ${primaryTarget} wins the aerial battle for a sensational ${yards}-yard contested catch!`,
          isTouchdown: isTD,
          isTurnover: false,
          isSafety: false,
          isFirstDown: is1st || isTD,
          keyPlayer: primaryTarget,
          clockElapsedSeconds: 22,
          stoppedClock: isTD,
          skipFailureCheck: true,
        };
      }
    }

    // 2. In Stride: 10% Big Play, 10% Incomplete, failChance% Execution Breakdown, remaining Normal Pass
    if (throwingVariant === 'in_stride') {
      const isDarnoldAtQB = isDarnoldStartingQB() || !!(offTeam.starQB && offTeam.starQB.toLowerCase().includes('darnold'));
      const isJSNPresent = isJSNRouteArtistEquipped() ||
        !!(offTeam.starWR && (offTeam.starWR.toLowerCase().includes('smith-njigba') || offTeam.starWR.toLowerCase().includes('jsn'))) ||
        offTeam.id === 'SEA' ||
        primaryTarget.toLowerCase().includes('smith-njigba') ||
        primaryTarget.toLowerCase().includes('jaxon') ||
        primaryTarget.toLowerCase().includes('jsn');

      if (isDarnoldAtQB && isJSNPresent && Math.random() < 0.50) {
        const yards = Math.min(distanceToGoal, Math.max(10, Math.floor(10 + Math.random() * 16)));
        const isTD = yards >= distanceToGoal;
        const is1st = yards >= distance || isTD;
        return {
          outcomeType: isTD ? 'Touchdown' : (yards >= 20 ? 'BigGain' : 'FirstDown'),
          yardsGained: yards,
          commentary: isTD
            ? `⚡ ${offTeam.starQB || 'Sam Darnold'} hits Jaxon Smith-Njigba perfectly in stride, slicing through the secondary for a spectacular ${yards}-yard TOUCHDOWN!`
            : `⚡ ${offTeam.starQB || 'Sam Darnold'} delivers a strike in full stride to Jaxon Smith-Njigba, who secures the ball on the run for a ${yards}-yard catch!`,
          isTouchdown: isTD,
          isTurnover: false,
          isSafety: false,
          isFirstDown: is1st,
          keyPlayer: 'Jaxon Smith-Njigba',
          clockElapsedSeconds: isTD ? 18 : 22,
          stoppedClock: isTD,
          skipFailureCheck: true,
        };
      }

      const strideRoll = Math.random();
      if (strideRoll < 0.10) {
        // 10% Big Play
        const yards = Math.min(distanceToGoal, Math.floor(20 + Math.random() * 18));
        const isTD = yards >= distanceToGoal;
        return {
          outcomeType: isTD ? 'Touchdown' : 'BigGain',
          yardsGained: yards,
          commentary: isTD
            ? `⚡ [IN STRIDE • TOUCHDOWN!] ${offTeam.starQB} delivers a beauty in full stride to ${primaryTarget}... he outruns the angles for a ${yards}-yard TOUCHDOWN!`
            : `⚡ [IN STRIDE • BIG PLAY] ${offTeam.starQB} hits ${primaryTarget} perfectly in stride downfield for an explosive ${yards}-yard RAC chunk gain!`,
          isTouchdown: isTD,
          isTurnover: false,
          isSafety: false,
          isFirstDown: true,
          keyPlayer: primaryTarget,
          clockElapsedSeconds: 22,
          stoppedClock: isTD,
          skipFailureCheck: true,
        };
      } else if (strideRoll < 0.20) {
        // 10% Incomplete (Backfire Mess Up)
        return {
          outcomeType: 'Incomplete',
          yardsGained: 0,
          commentary: `💨 [IN STRIDE • INCOMPLETE] ${offTeam.starQB} tries to lead ${primaryTarget} in stride down the seam, but overshoots him just beyond fingertips. Incomplete pass!`,
          isTouchdown: false,
          isTurnover: false,
          isSafety: false,
          isFirstDown: false,
          keyPlayer: primaryTarget,
          clockElapsedSeconds: 8,
          stoppedClock: true,
          skipFailureCheck: true,
        };
      } else if (strideRoll < 0.20 + failChance) {
        // Mess Up Play Chance: Execution breakdown
        return createExecutionBreakdownResult(offTeam, defTeam, offPlay, distanceToGoal, distance, failChancePercent, primaryTarget);
      }
      // Remaining (80% - failChance%): Falls through to standard normal organic pass play
    }

    // 3. Straight To Them: 10% Guaranteed Completed / 1st Down, 10% Intercepted, failChance% Execution Breakdown, remaining Normal Pass
    if (throwingVariant === 'straight_to_them') {
      const straightRoll = Math.random();
      if (straightRoll < 0.10) {
        // 10% Guaranteed completion / 1st Down
        const yards = Math.min(distanceToGoal, Math.max(distance, Math.floor(6 + Math.random() * 8)));
        const isTD = yards >= distanceToGoal;
        return {
          outcomeType: isTD ? 'Touchdown' : 'FirstDown',
          yardsGained: yards,
          commentary: isTD
            ? `🎯 [STRAIGHT TO NUMBERS • TOUCHDOWN!] ${offTeam.starQB} fires a laser directly into ${primaryTarget}'s numbers across the goal line for a TOUCHDOWN!`
            : `🎯 [STRAIGHT TO NUMBERS • COMPLETED] ${offTeam.starQB} fires a strike straight to ${primaryTarget}'s numbers for a reliable ${yards}-yard completion and a FIRST DOWN!`,
          isTouchdown: isTD,
          isTurnover: false,
          isSafety: false,
          isFirstDown: true,
          keyPlayer: primaryTarget,
          clockElapsedSeconds: 18,
          stoppedClock: isTD,
          skipFailureCheck: true,
        };
      } else if (straightRoll < 0.20) {
        // 10% Intercepted (Backfire Mess Up)
        return {
          outcomeType: 'Interception',
          yardsGained: 10,
          commentary: `🎯 [STRAIGHT TO NUMBERS • INTERCEPTED] ${offTeam.starQB} stares down ${primaryTarget} and throws straight on a line... but ${defTeam.starDef} reads the delivery and jumps the route for the INTERCEPTION!`,
          isTouchdown: false,
          isTurnover: true,
          turnoverType: 'Interception',
          isSafety: false,
          isFirstDown: false,
          keyPlayer: defTeam.starDef,
          clockElapsedSeconds: 16,
          stoppedClock: true,
          skipFailureCheck: true,
        };
      } else if (straightRoll < 0.20 + failChance) {
        // Mess Up Play Chance: Execution breakdown
        return createExecutionBreakdownResult(offTeam, defTeam, offPlay, distanceToGoal, distance, failChancePercent, primaryTarget);
      }
      // Remaining (80% - failChance%): Falls through to standard normal organic pass play
    }

    if (isBlitz && roll < 0.18) {
      // Andrew Luck Composure: Never get sacked, instead complete pass or throw away
      if (hasAndrewLuckComposure) {
        const luckEvadeRoll = Math.random();
        if (luckEvadeRoll < 0.65) {
          // Completion
          const yards = Math.min(distanceToGoal, Math.floor(4 + Math.random() * 8));
          const is1st = yards >= distance;
          return {
            outcomeType: is1st ? 'FirstDown' : 'ShortGain',
            yardsGained: yards,
            commentary: `⚡ [GAME BREAKER: COMPOSURE • ANDREW LUCK] The blitz is home! Andrew Luck takes the hit but somehow finds ${primaryTarget} for a ${yards}-yard completion while being driven into the turf!`,
            isTouchdown: yards >= distanceToGoal,
            isTurnover: false,
            isSafety: false,
            isFirstDown: is1st,
            keyPlayer: primaryTarget,
            clockElapsedSeconds: 24,
            stoppedClock: false,
            skipFailureCheck: true,
          };
        } else {
          // Throw away
          return {
            outcomeType: 'Incomplete',
            yardsGained: 0,
            commentary: `⚡ [GAME BREAKER: COMPOSURE • ANDREW LUCK] The defense sends the house, but Andrew Luck shows elite composure, throwing the ball out of bounds just before being taken down! Incomplete.`,
            isTouchdown: false,
            isTurnover: false,
            isSafety: false,
            isFirstDown: false,
            keyPlayer: qb,
            clockElapsedSeconds: 8,
            stoppedClock: true,
            skipFailureCheck: true,
          };
        }
      }

      // Sack
      const sackYards = -(5 + Math.floor(Math.random() * 4));
      return {
        outcomeType: 'Sack',
        yardsGained: sackYards,
        commentary: `Defensive pressure gets home! ${defTeam.starDef} wraps up ${offTeam.starQB} for a sack!${dtText}`,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        keyPlayer: defTeam.starDef,
        clockElapsedSeconds: 26,
        stoppedClock: false,
      };
    }

    // Baseline chances for standard normal pass play:
    const qbAwaDiscount = qbStats.awareness >= 80 ? 0.025 : (qbStats.awareness <= 50 ? -0.08 : 0);
    const targetAgiDiscount = targetStats.agility >= 80 ? 0.06 : 0;
    const weakDefBonus = defOvr <= 50 ? 0.18 : 0;

    let interceptionThreshold = Math.max(0.01, 0.04 - offRatingAdvantage - qbAwaDiscount);
    let incompleteThreshold = Math.max(0.10, 0.35 - offRatingAdvantage - targetAgiDiscount - weakDefBonus);
    let bigPlayThreshold = Math.max(0.60, 0.90 - offRatingAdvantage - (defOvr <= 50 ? 0.25 : 0));

    if (roll < interceptionThreshold) {
      // Interception
      return {
        outcomeType: 'Interception',
        yardsGained: 10,
        commentary: `${offTeam.starQB} forces a pass into tight coverage and it is INTERCEPTED!`,
        isTouchdown: false,
        isTurnover: true,
        turnoverType: 'Interception',
        isSafety: false,
        isFirstDown: false,
        keyPlayer: defTeam.starDef,
        clockElapsedSeconds: 15,
        stoppedClock: true,
      };
    }

    if (roll < incompleteThreshold) {
      // Incomplete
      return {
        outcomeType: 'Incomplete',
        yardsGained: 0,
        commentary: `${offTeam.starQB}'s throw to ${primaryTarget} falls incomplete off the fingertips.`,
        isTouchdown: false,
        isTurnover: false,
        isSafety: false,
        isFirstDown: false,
        keyPlayer: primaryTarget,
        clockElapsedSeconds: 7,
        stoppedClock: true,
      };
    }

    if (roll > bigPlayThreshold && distanceToGoal <= 40) {
      // Touchdown pass
      return {
        outcomeType: 'Touchdown',
        yardsGained: distanceToGoal,
        commentary: `${offTeam.starQB} launches deep to ${primaryTarget}... CAUGHT IN THE ENDZONE! TOUCHDOWN!`,
        isTouchdown: true,
        isTurnover: false,
        isSafety: false,
        isFirstDown: true,
        keyPlayer: primaryTarget,
        clockElapsedSeconds: 20,
        stoppedClock: true,
      };
    }

    // Completion enhanced by card stats (Speed, Agility, Strength) & team overall
    let passBonus = 0;
    let passCommentaryFlair = '';

    // Card Stats Effects:
    if (targetStats.speed > 75) {
      const spdBonus = Math.floor((targetStats.speed - 75) * 0.25);
      passBonus += spdBonus;
      if (targetStats.speed >= 80 && Math.random() < 0.30) {
        passBonus += 4;
        passCommentaryFlair += ` ⚡ [${targetStats.speed} SPD RAC]`;
      }
    } else if (targetStats.speed <= 50) {
      passBonus -= 2;
    }

    if (targetStats.agility >= 80 && Math.random() < 0.25) {
      passBonus += 3;
      passCommentaryFlair += ` 🎯 [${targetStats.agility} AGI ROUTE]`;
    }

    if (targetStats.strength >= 80 && Math.random() < 0.25) {
      passBonus += 2;
      passCommentaryFlair += ` 💪 [${targetStats.strength} STR CONTESTED]`;
    }

    if (defOvr <= 50) {
      passBonus += 8;
    } else if (ovrAdvantage > 5) {
      passBonus += Math.min(8, Math.floor(ovrAdvantage * 0.25));
    }

    const yards = Math.min(distanceToGoal, Math.max(2, Math.floor(7 + Math.random() * 15) + passBonus));
    const is1st = yards >= distance;
    return {
      outcomeType: is1st ? 'FirstDown' : 'ShortGain',
      yardsGained: yards,
      commentary: `${offTeam.starQB} connects with ${primaryTarget} for a completion of ${yards} yards${is1st ? ' and a FIRST DOWN!' : '.'}${passCommentaryFlair}`,
      isTouchdown: yards >= distanceToGoal,
      isTurnover: false,
      isSafety: false,
      isFirstDown: is1st,
      keyPlayer: primaryTarget,
      clockElapsedSeconds: 24,
      stoppedClock: false,
      skipFailureCheck: !!throwingVariant,
    };
  }
}

/**
 * Calculates whether a play execution suffers a breakdown based on the team's overall rating.
 * Formula: failChance = (100 - team.ovr) %
 * If failed: Yards gained are halved, touchdown is negated (stopped short), and varied AI breakdown commentary is triggered.
 */
function applyPlayFailureChance(
  result: PlayResult,
  offTeam: NFLTeam,
  defTeam: NFLTeam,
  offensePlay: Play,
  targetDistance: number,
  difficulty?: 'Script' | 'Hard',
  netSuccessBoost?: number
): PlayResult {
  // Special kicking plays, turnovers, pre-snap penalties, or plays that already factored in failure check
  if (
    result.outcomeType === 'FieldGoalGood' ||
    result.outcomeType === 'FieldGoalMiss' ||
    result.outcomeType === 'FieldGoalBlocked' ||
    result.outcomeType === 'Punt' ||
    result.outcomeType === 'PuntBlocked' ||
    result.outcomeType === 'PenaltyDefense' ||
    result.outcomeType === 'PenaltyOffense' ||
    result.isTurnover ||
    result.isSafety ||
    result.isFailedPlay ||
    result.skipFailureCheck
  ) {
    return result;
  }

  const failChancePercent = getTeamFailChancePercent(offTeam.ovr, difficulty, netSuccessBoost, defTeam.ovr);
  let failChance = failChancePercent / 100;

  const isPass = offensePlay.category !== 'Run';
  const ballCarrier = result.keyPlayer || (isPass ? offTeam.starWR : offTeam.starRB);
  const ballCarrierStats = getPlayerCardStats(offTeam, ballCarrier);

  // Player awareness provides protection against breakdowns
  if (ballCarrierStats.awareness >= 80) {
    failChance = Math.max(0.02, failChance - 0.10);
  } else if (ballCarrierStats.awareness <= 50) {
    failChance = Math.min(0.98, failChance + 0.15);
  }

  if (Math.random() < failChance) {
    const origYards = result.yardsGained;
    // Halve the yards gained
    const halvedYards = origYards > 0 ? Math.max(1, Math.floor(origYards / 2)) : origYards;

    const isPass = offensePlay.category !== 'Run';
    const ballCarrier = result.keyPlayer || (isPass ? offTeam.starWR : offTeam.starRB);
    const qb = offTeam.starQB;
    const defStar = defTeam.starDef;

    // AI Announcement variants for failed plays (falling down, getting tackled, swarmed, collisions, etc.)
    const breakdownVariants = [
      {
        reason: 'Slipped on turf',
        text: `${ballCarrier} made a sudden cut but lost his footing and slipped down on the turf! Stumbles down early, cutting the gain in half to ${halvedYards} yards.`,
      },
      {
        reason: 'Ankle tackle',
        text: `${defStar} lunged with a diving shoestring tackle, tripping up ${ballCarrier} just as a wide open lane was developing (${halvedYards} yd gain).`,
      },
      {
        reason: 'Swarmed by defense',
        text: `${defTeam.name}'s defense swarmed to the football in numbers, converging to gang-tackle ${ballCarrier} and halving the pickup to ${halvedYards} yards.`,
      },
      {
        reason: 'Fell in open field',
        text: `${ballCarrier} tripped over his own feet in the secondary and tumbled to the grass, stopped short after ${halvedYards} yards.`,
      },
      {
        reason: 'Lineman collision',
        text: `${ballCarrier} collided with his own pulling guard in the gap, stumbling forward to salvage only ${halvedYards} yards.`,
      },
      {
        reason: 'Off-balance throw',
        text: `${qb} was pressured and forced to throw off-platform; ${ballCarrier} had to stop his stride and dive backward for an awkward ${halvedYards}-yard catch before being downed.`,
      },
      {
        reason: 'Bobbled reception',
        text: `${ballCarrier} bobbled the pass off his hands before securing it, allowing ${defStar} to immediately wrap him up after ${halvedYards} yards.`,
      },
      {
        reason: 'Blown blocking assignment',
        text: `A missed blocking assignment allowed ${defStar} to knife through untouched, slowing down ${ballCarrier} for a reduced ${halvedYards}-yard gain.`,
      },
      {
        reason: 'Heavy pocket collapse',
        text: `Pass rush broke the pocket instantly; ${qb} threw a desperate checkdown to ${ballCarrier}, who was tackled for ${halvedYards} yards.`,
      },
    ];

    const chosen = breakdownVariants[Math.floor(Math.random() * breakdownVariants.length)];

    return {
      ...result,
      isFailedPlay: true,
      failureReason: chosen.reason,
      yardsGained: halvedYards,
      isTouchdown: false, // Halved/failed play cannot score touchdown
      isFirstDown: halvedYards >= targetDistance,
      commentary: `[EXECUTION BREAKDOWN • ${failChancePercent}% FAIL CHANCE] ${chosen.text}`,
    };
  }

  return result;
}

/**
 * Opponent AI Offensive Play Calling Logic:
 * - NEVER punt on any down besides 4th.
 * - NEVER punt if they only have 40 yards to go to the endzone where they can score (distanceToGoal <= 40).
 * - Kick a field goal if the down is 4th, distance to endzone <= 40 yards, and yards to go are 5 or more (game.distance >= 5).
 * - If 4th down inside 40 yards and yards to go are less than 5 (< 5), go for the 1st down with a standard offensive play (never punt).
 * - If 4th down and more than 40 yards to go to the endzone (distanceToGoal > 40), punt to flip field position (or go for it on 4th & very short).
 */
export function selectAIOffensivePlay(
  game: ActiveGame,
  availablePlays: Play[] = DEFAULT_PLAYS
): Play {
  const allPlays = availablePlays && availablePlays.length > 0 ? availablePlays : DEFAULT_PLAYS;

  // Filter out any SpecialTeams (punts and field goals) to get pure offensive plays (pass/run)
  const standardOffensivePlays = allPlays.filter(
    (p) =>
      p.type === 'Offense' &&
      p.category !== 'SpecialTeams' &&
      p.id !== 'st-punt' &&
      p.id !== 'st-field-goal'
  );

  const safeOffense = standardOffensivePlays.length > 0
    ? standardOffensivePlays
    : allPlays.filter((p) => p.id !== 'st-punt' && p.category !== 'SpecialTeams');

  const fallbackPlay = safeOffense.length > 0 ? safeOffense : allPlays;

  const fieldGoalPlay =
    allPlays.find((p) => p.id === 'st-field-goal') ||
    DEFAULT_PLAYS.find((p) => p.id === 'st-field-goal') ||
    fallbackPlay[0];

  const puntPlay =
    allPlays.find((p) => p.id === 'st-punt') ||
    DEFAULT_PLAYS.find((p) => p.id === 'st-punt') ||
    fallbackPlay[0];

  const distanceToGoal = 100 - game.yardLine;

  // RULE 1: NEVER punt on any down besides 4th!
  // On 1st, 2nd, and 3rd down, opponent AI must always run standard offense
  if (game.down !== 4) {
    return fallbackPlay[Math.floor(Math.random() * fallbackPlay.length)];
  }

  // IT IS 4TH DOWN:
  // RULE 2: NEVER punt if they only have 40 yards to go to the endzone where they can score!
  if (distanceToGoal <= 40) {
    // RULE 3: Kick a field goal if the down is 4th, and the yards to go are 5 or more!
    if (game.distance >= 5) {
      return fieldGoalPlay;
    }

    // Yards to go are less than 5 on 4th down within 40 yards (< 5 yds to go):
    // They go for the 1st down with a standard offensive play (never punt!)
    return fallbackPlay[Math.floor(Math.random() * fallbackPlay.length)];
  }

  // 4TH DOWN WITH MORE THAN 40 YARDS TO GO (distanceToGoal > 40):
  // Outside the 40-yard line, punt on 4th down if 3+ yards to go to flip field position
  if (game.distance >= 3) {
    return puntPlay;
  }

  // 4th and 1-2 outside 40: mostly punt, small chance to go for it
  if (Math.random() < 0.7) {
    return puntPlay;
  }
  return fallbackPlay[Math.floor(Math.random() * fallbackPlay.length)];
}
