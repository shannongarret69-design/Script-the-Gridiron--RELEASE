import React from 'react';
import { Volume2, VolumeX, Shield, Trophy, BookOpen, Play, Calendar, Home, Swords, LogIn, LogOut, UserPlus } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { useAuth } from '../hooks/useAuth';

interface NavbarProps {
  activeTab: 'menu' | 'exhibition' | 'season' | 'playbook' | 'game' | 'clash';
  setActiveTab: (tab: 'menu' | 'exhibition' | 'season' | 'playbook' | 'game' | 'clash') => void;
  hasActiveGame: boolean;
  soundEnabled: boolean;
  toggleSound: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  hasActiveGame,
  soundEnabled,
  toggleSound,
}) => {
  const { user, login, logout, loading: authLoading } = useAuth();

  return (
    <header className="bg-emerald-950 border-b border-emerald-800 sticky top-0 z-50 w-full text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2.5 flex items-center justify-between gap-4">
        {/* Zone 1: Brand / Wordmark */}
        <div className="flex items-center space-x-2.5 cursor-pointer shrink-0" onClick={() => setActiveTab('menu')}>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white flex items-center justify-center shadow-inner shrink-0 text-emerald-950">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 fill-emerald-800 text-emerald-800" />
          </div>
          <span className="font-display font-black text-lg sm:text-xl tracking-wider text-white">
            SCRIPT THE <span className="text-emerald-400">GRIDIRON</span>
          </span>
        </div>

        {/* Zone 2: Navigation Links / Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-1 scrollbar-none">
          <button
            id="nav-tab-menu"
            onClick={() => setActiveTab('menu')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'menu'
                ? 'bg-white text-emerald-950 shadow-sm'
                : 'text-emerald-100 hover:text-white hover:bg-emerald-800/60'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span className="font-display tracking-wide uppercase">Menu</span>
          </button>

          {hasActiveGame && (
            <button
              id="nav-tab-active-game"
              onClick={() => setActiveTab('game')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'game'
                  ? 'bg-emerald-500 text-white shadow-sm font-black'
                  : 'bg-emerald-800 text-emerald-100 hover:bg-emerald-700 animate-pulse'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="font-display tracking-wide uppercase">Live Game</span>
            </button>
          )}

          <button
            id="nav-tab-exhibition"
            onClick={() => setActiveTab('exhibition')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'exhibition'
                ? 'bg-white text-emerald-950 shadow-sm'
                : 'text-emerald-100 hover:text-white hover:bg-emerald-800/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="font-display tracking-wide uppercase">Exhibition</span>
          </button>

          <button
            id="nav-tab-season"
            onClick={() => setActiveTab('season')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'season'
                ? 'bg-white text-emerald-950 shadow-sm'
                : 'text-emerald-100 hover:text-white hover:bg-emerald-800/60'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span className="font-display tracking-wide uppercase">Season</span>
          </button>

          <button
            id="nav-tab-playbook"
            onClick={() => setActiveTab('playbook')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'playbook'
                ? 'bg-white text-emerald-950 shadow-sm'
                : 'text-emerald-100 hover:text-white hover:bg-emerald-800/60'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="font-display tracking-wide uppercase">Playbook</span>
          </button>

          <button
            id="nav-tab-clash"
            onClick={() => setActiveTab('clash')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'clash'
                ? 'bg-white text-emerald-950 shadow-sm font-black'
                : 'text-emerald-100 hover:text-white hover:bg-emerald-800/60'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span className="font-display tracking-wide uppercase">Gridiron Clash</span>
          </button>
        </nav>

        {/* Zone 3: Actions & Auth */}
        <div className="flex items-center space-x-2 shrink-0">
          {!authLoading && (
            <div className="flex items-center space-x-2">
              {user ? (
                <button
                  onClick={logout}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-emerald-100 hover:text-white border border-emerald-700 transition text-xs font-bold uppercase cursor-pointer"
                  title={`Signed in as ${user.displayName || user.email}. Click to Sign Out.`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={login}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white text-emerald-950 hover:bg-emerald-50 border border-white shadow transition text-xs font-black uppercase cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          )}

          <PWAInstallButton />
          <button
            id="btn-sound-toggle"
            onClick={toggleSound}
            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
            className="p-1.5 sm:p-2 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-emerald-100 hover:text-white border border-emerald-700 transition cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-300" /> : <VolumeX className="w-4 h-4 text-emerald-500" />}
          </button>
        </div>
      </div>
    </header>
  );
};
