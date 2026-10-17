import React from 'react';
import { Trophy, Calendar, BookOpen, ArrowRight, Swords, UserPlus, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from 'firebase/auth';

interface MainMenuProps {
  onSelectTab: (tab: 'exhibition' | 'season' | 'playbook' | 'game' | 'clash') => void;
  hasActiveGame: boolean;
  user?: User | null;
  onLogin?: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onSelectTab, hasActiveGame, user, onLogin }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-14 space-y-10">
      {/* Visual Title / Hero Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 font-display">
          SCRIPT THE <span className="text-emerald-700">GRIDIRON</span>
        </h1>
        <p className="text-slate-500 text-sm md:text-base max-w-lg mx-auto font-medium">
          Command real NFL teams, build custom playbooks, and lead your franchise to victory.
        </p>
      </div>

      {/* Auth Call to Action Banner (If not signed in) */}
      {!user && onLogin && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-emerald-900 to-emerald-800 border-2 border-emerald-700/60 rounded-3xl p-6 md:p-8 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center space-x-5">
            <div className="w-14 h-14 rounded-2xl bg-white text-emerald-900 flex items-center justify-center shrink-0 shadow-md">
              <Sparkles className="w-7 h-7 text-emerald-700" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight font-display">
                Create Your Dynasty Profile
              </h2>
              <p className="text-emerald-100 text-sm font-medium max-w-md">
                Sign in to save your progress to the cloud, trade in the Auction House, and build your ultimate franchise.
              </p>
            </div>
          </div>
          <button
            onClick={onLogin}
            className="flex items-center space-x-2 px-7 py-3.5 bg-white text-emerald-950 font-black rounded-xl uppercase tracking-wider shadow hover:bg-emerald-50 hover:scale-105 transition-all cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4 text-emerald-700" />
            <span>Sign In / Sign Up</span>
          </button>
        </motion.div>
      )}

      {/* Primary Navigation Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Exhibition Mode Card */}
        <motion.div
          whileHover={{ y: -4, borderColor: 'var(--color-emerald-500)' }}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
          onClick={() => onSelectTab('exhibition')}
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-display uppercase tracking-wide">
                Exhibition Mode
              </h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Play a single-game matchup with customizable weather, stadiums, and jersey selections.
              </p>
            </div>
          </div>
          <div className="pt-6 flex items-center text-emerald-700 font-bold text-xs group-hover:translate-x-1 transition-transform">
            <span>KICKOFF GAME</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </div>
        </motion.div>

        {/* Season Mode Card */}
        <motion.div
          whileHover={{ y: -4, borderColor: 'var(--color-emerald-500)' }}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
          onClick={() => onSelectTab('season')}
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-display uppercase tracking-wide">
                Franchise Campaign
              </h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Choose a franchise to manage roster transfers, play weekly games, and chase the championship.
              </p>
            </div>
          </div>
          <div className="pt-6 flex items-center text-emerald-700 font-bold text-xs group-hover:translate-x-1 transition-transform">
            <span>START SEASON</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </div>
        </motion.div>

        {/* Playbook Editor Card */}
        <motion.div
          whileHover={{ y: -4, borderColor: 'var(--color-emerald-500)' }}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
          onClick={() => onSelectTab('playbook')}
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-display uppercase tracking-wide">
                Tactical Playbook
              </h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Design custom offensive and defensive chalkboards to build a lethal playbook library.
              </p>
            </div>
          </div>
          <div className="pt-6 flex items-center text-emerald-700 font-bold text-xs group-hover:translate-x-1 transition-transform">
            <span>EDIT PLAYS</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </div>
        </motion.div>

        {/* Gridiron Clash Card */}
        <motion.div
          whileHover={{ y: -4, borderColor: 'var(--color-emerald-500)' }}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
          onClick={() => onSelectTab('clash')}
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Swords className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-display uppercase tracking-wide">
                Gridiron Clash
              </h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Collect cards, challenge AI opponents, trade in the Auction House, and build your dynasty.
              </p>
            </div>
          </div>
          <div className="pt-6 flex items-center text-emerald-700 font-bold text-xs group-hover:translate-x-1 transition-transform">
            <span>ENTER CLASH</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </div>
        </motion.div>
      </div>

      {/* Active Game Resume Quick-Launch Banner (If game exists) */}
      {hasActiveGame && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5 text-emerald-800 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
              <span>Match In Progress</span>
            </div>
            <p className="text-slate-700 text-sm">
              You have a live game active. Resume your matchup now.
            </p>
          </div>
          <button
            onClick={() => onSelectTab('game')}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl uppercase tracking-wider shadow-sm hover:shadow-md transition-all shrink-0 cursor-pointer"
          >
            RESUME PLAYING
          </button>
        </motion.div>
      )}
    </div>
  );
};

