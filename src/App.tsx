import React, { useState, useEffect } from 'react';
import { ActiveGame, NFLTeam, GameSettings } from './types/game';
import { Navbar } from './components/Navbar';
import { MainMenu } from './components/MainMenu';
import { ExhibitionMode } from './components/ExhibitionMode';
import { SeasonMode } from './components/SeasonMode';
import { PlaybookEditor } from './components/PlaybookEditor';
import { GameView } from './components/GameView';
import { GridironClash } from './components/GridironClash';
import { syncFinishedGameToActiveSlot, getActiveSlotId, loadSaveSlot } from './utils/saveManager';

import { useAuth } from './hooks/useAuth';

export default function App() {
  const { user, login, isQuotaExceeded } = useAuth();
  const [activeTab, setActiveTab] = useState<'menu' | 'exhibition' | 'season' | 'playbook' | 'game' | 'clash'>('menu');
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Initialize fresh game state
  const createNewGame = (
    homeTeam: NFLTeam,
    awayTeam: NFLTeam,
    settings: GameSettings,
    seasonGameContext?: { week: number; isPlayoff: boolean; playoffRound?: string },
    userTeamId?: string
  ): ActiveGame => {
    return {
      id: `game-${Date.now()}`,
      homeTeam,
      awayTeam,
      userTeamId: userTeamId || homeTeam.id,
      homeScore: 0,
      awayScore: 0,
      quarter: 1,
      quarterTimeSeconds: settings.quarterLengthMinutes * 60,
      quarterLengthMinutes: settings.quarterLengthMinutes,
      possession: 'away', // Away team receives opening kickoff
      down: 1,
      distance: 10,
      yardLine: 25, // Touchback on 25
      driveStartYardLine: 25,
      isGameOver: false,
      isPlayInProgress: false,
      homeTimeouts: 3,
      awayTimeouts: 3,
      homeStats: {
        totalYards: 0,
        passingYards: 0,
        rushingYards: 0,
        turnovers: 0,
        firstDowns: 0,
        thirdDownAttempts: 0,
        thirdDownConverted: 0,
        sacks: 0,
        timeOfPossessionSeconds: 0,
      },
      awayStats: {
        totalYards: 0,
        passingYards: 0,
        rushingYards: 0,
        turnovers: 0,
        firstDowns: 0,
        thirdDownAttempts: 0,
        thirdDownConverted: 0,
        sacks: 0,
        timeOfPossessionSeconds: 0,
      },
      settings,
      playLog: [],
      seasonGameContext,
    };
  };

  // Launch Exhibition Game
  const handleStartExhibition = (homeTeam: NFLTeam, awayTeam: NFLTeam, settings: GameSettings) => {
    const game = createNewGame(homeTeam, awayTeam, settings, undefined, homeTeam.id);
    game.difficulty = settings.difficulty || 'Hard';
    setActiveGame(game);
    setActiveTab('game');
  };

  // Launch Season or Playoff Game
  const handlePlaySeasonGame = (
    homeTeam: NFLTeam,
    awayTeam: NFLTeam,
    week: number,
    isPlayoff: boolean,
    playoffRound?: string
  ) => {
    const settings: GameSettings = {
      quarterLengthMinutes: 3,
      weather: homeTeam.isDome ? 'Dome' : 'Sunny',
      homeJersey: 'Home',
      awayJersey: 'Away',
      scriptModeDefault: 'Scripted',
    };

    let difficulty: 'Script' | 'Hard' = 'Script';
    let userTeamId: string = homeTeam.id;
    try {
      const slotId = getActiveSlotId();
      const saved = loadSaveSlot(slotId);
      if (saved && saved.season) {
        if (saved.season.difficulty) {
          difficulty = saved.season.difficulty;
        }
        if (saved.season.userTeamId) {
          userTeamId = saved.season.userTeamId;
        }
      }
    } catch (e) {}

    const game = createNewGame(homeTeam, awayTeam, settings, {
      week,
      isPlayoff,
      playoffRound,
    }, userTeamId);
    game.difficulty = difficulty;

    setActiveGame(game);
    setActiveTab('game');
  };

  // Launch Gridiron Clash Battle Game (Hard Mode)
  const handleStartClashGame = (
    userTeam: NFLTeam,
    aiTeam: NFLTeam,
    starPlayer: string,
    starOvr: number,
    startOnOffense: boolean = true,
    onlineMatchRoomId?: string,
    onlineMatchIsHost?: boolean
  ) => {
    const settings: GameSettings = {
      quarterLengthMinutes: 5,
      weather: 'Night',
      homeJersey: 'Home',
      awayJersey: 'Away',
      scriptModeDefault: 'Organic',
      difficulty: 'Hard',
    };

    const game = createNewGame(userTeam, aiTeam, settings, undefined, userTeam.id);
    game.possession = startOnOffense ? 'home' : 'away';
    game.difficulty = 'Hard';
    game.clashGameContext = {
      aiTeamId: aiTeam.id,
      starPlayer,
      starOvr,
    };
    game.onlineMatchRoomId = onlineMatchRoomId;
    game.onlineMatchIsHost = onlineMatchIsHost;

    setActiveGame(game);
    setActiveTab('game');
  };

  // When season game is completed, sync back to stored SeasonState
  const handleFinishSeasonGame = (finishedGame: ActiveGame) => {
    if (!finishedGame.seasonGameContext) return;

    try {
      syncFinishedGameToActiveSlot(finishedGame);
    } catch (err) {
      console.error('Error finishing season game:', err);
    }
  };

  const handleExitGame = () => {
    if (activeGame?.clashGameContext) {
      setActiveGame(null);
      setActiveTab('clash');
    } else if (activeGame?.seasonGameContext) {
      setActiveGame(null);
      setActiveTab('season');
    } else {
      setActiveGame(null);
      setActiveTab('menu');
    }
  };

  const [dismissQuotaBanner, setDismissQuotaBanner] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-emerald-600 selection:text-white">
      {/* Quota Exceeded Global Alert */}
      {isQuotaExceeded && !dismissQuotaBanner && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold border-b border-amber-600 z-[100] shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <span className="text-base">⚠️</span>
              <span>
                <strong>Firestore Daily Write Quota Reached:</strong> The free tier write limit (20k/day) was reached and will reset tomorrow. All single-player modes (AI Battles Wave 1 & 2, Season, Exhibition, Essential Summons) remain 100% operational with offline local storage!
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a 
                href="https://console.firebase.google.com/project/kyodai-productions/firestore/databases/ai-studio-gridironscriptst-29c3e30b-be41-4c58-9983-c7b880491d62/data?openUpgradeDialog=true" 
                target="_blank" 
                rel="noreferrer"
                className="underline hover:text-white text-[11px] font-black uppercase tracking-wider"
              >
                Database Console
              </a>
              <span className="opacity-40">|</span>
              <a 
                href="https://firebase.google.com/pricing#cloud-firestore" 
                target="_blank" 
                rel="noreferrer"
                className="underline hover:text-white text-[11px] font-black uppercase tracking-wider"
              >
                Pricing Info
              </a>
              <button 
                onClick={() => setDismissQuotaBanner(true)}
                className="ml-2 bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded text-[10px] uppercase font-black"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Madden Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasActiveGame={activeGame !== null}
        soundEnabled={soundEnabled}
        toggleSound={() => setSoundEnabled(!soundEnabled)}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-12">
        {activeTab === 'menu' && (
          <MainMenu
            onSelectTab={setActiveTab}
            hasActiveGame={activeGame !== null}
            user={user}
            onLogin={login}
          />
        )}

        {activeTab === 'exhibition' && (
          <ExhibitionMode
            onStartGame={handleStartExhibition}
          />
        )}

        {activeTab === 'season' && (
          <SeasonMode onPlaySeasonGame={handlePlaySeasonGame} />
        )}

        {activeTab === 'playbook' && (
          <PlaybookEditor />
        )}

        {activeTab === 'clash' && (
          <GridironClash onStartClashMatch={handleStartClashGame} />
        )}

        {activeTab === 'game' && activeGame && (
          <GameView
            game={activeGame}
            setGame={setActiveGame}
            onExitGame={handleExitGame}
            onFinishSeasonGame={handleFinishSeasonGame}
          />
        )}
      </main>
    </div>
  );
}
