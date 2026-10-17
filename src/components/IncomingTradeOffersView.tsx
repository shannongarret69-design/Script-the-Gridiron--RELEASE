import React from 'react';
import { FranchiseSeasonState, IncomingTradeOffer, FranchisePlayer } from '../types/franchise';
import { NFLTeam } from '../types/game';
import { getTeamById } from '../data/teams';
import {
  isTradeDeadlinePassed,
  isTradeWindowOpen,
} from '../utils/tradeEngine';
import {
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Inbox,
} from 'lucide-react';

interface IncomingTradeOffersViewProps {
  season: FranchiseSeasonState;
  userTeam: NFLTeam;
  onApproveOffer: (offerId: string) => void;
  onDeclineOffer: (offerId: string) => void;
  onCounterOffer: (offer: IncomingTradeOffer) => void;
}

export const IncomingTradeOffersView: React.FC<IncomingTradeOffersViewProps> = ({
  season,
  userTeam,
  onApproveOffer,
  onDeclineOffer,
  onCounterOffer,
}) => {
  const offers = season.incomingTradeOffers || [];
  const pendingOffers = offers.filter((o) => o.status === 'pending');
  const pastOffers = offers.filter((o) => o.status !== 'pending');

  const deadlinePassed = isTradeDeadlinePassed(season.currentWeek, season.stage);
  const tradeWindowActive = isTradeWindowOpen(season.currentWeek, season.stage);
  const availableCap = season.salaryCap - season.usedCap;

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-display font-black text-sm text-white uppercase tracking-wide">
              GM APPROVAL REQUIRED FOR INCOMING PROPOSALS
            </h4>
            <p className="text-xs text-slate-400">
              Other NFL teams target your roster based on their lowest-rated positions and player performance ratings. All trades require your official GM approval before taking effect.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-xs font-mono font-bold text-slate-400">CAP ROOM:</span>
          <span
            className={`font-display font-black text-sm ${
              availableCap >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            ${availableCap.toFixed(1)}M
          </span>
        </div>
      </div>

      {/* Deadline Warning if passed */}
      {deadlinePassed && (
        <div className="bg-rose-950/70 border border-rose-500/50 rounded-2xl p-4 flex items-center space-x-3 text-rose-200 text-xs">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <strong className="block font-bold text-rose-300">
              TRADE DEADLINE HAS PASSED (WEEK 9 DEADLINE EXPIRED)
            </strong>
            <span>
              Pending offers can no longer be approved as the mid-season trade deadline has concluded.
            </span>
          </div>
        </div>
      )}

      {/* Pending Proposals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-black text-lg text-white flex items-center space-x-2">
            <span>PENDING OFFERS FOR YOUR APPROVAL</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-mono">
              {pendingOffers.length} PENDING
            </span>
          </h3>
        </div>

        {pendingOffers.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
              <Inbox className="w-7 h-7" />
            </div>
            <h4 className="font-display font-black text-base text-white">
              NO PENDING TRADE INQUIRIES
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              {tradeWindowActive
                ? `You have reviewed all incoming offers for Week ${season.currentWeek}. As other NFL franchises reassess their positional holes and ratings, new offers will appear here when advancing weeks!`
                : 'The mid-season trade window operates from Week 4 to Week 9. During this window, other franchises actively submit trade offers.'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {pendingOffers.map((offer) => {
              const offeringTeam = getTeamById(offer.offeringTeamId);
              const capAfterTrade = availableCap - offer.netCapChange;
              const capExceeded = capAfterTrade < 0;

              return (
                <div
                  key={offer.id}
                  className="bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden"
                >
                  {/* Top Accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: offer.offeringTeamColor }}
                  />

                  {/* Header Row: Offering Team & Badges */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center font-display font-black text-lg text-white shadow-lg"
                        style={{
                          backgroundColor: offer.offeringTeamColor,
                          color: offeringTeam.textColor || '#ffffff',
                        }}
                      >
                        {offeringTeam.abbr}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold text-amber-400">
                            WEEK {offer.week} PROPOSAL
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-xs text-slate-400 font-mono">
                            {offeringTeam.conference} {offeringTeam.division} ({offeringTeam.ovr} OVR)
                          </span>
                        </div>
                        <h4 className="font-display font-black text-lg text-white">
                          {offer.offeringTeamCity.toUpperCase()} {offer.offeringTeamName.toUpperCase()}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-center">
                        <span className="text-[10px] text-slate-400 block font-mono">INTEREST</span>
                        <span className="font-display font-black text-sm text-emerald-400">
                          {offer.interestScore}/100
                        </span>
                      </div>
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-center">
                        <span className="text-[10px] text-slate-400 block font-mono">NET CAP</span>
                        <span
                          className={`font-display font-black text-sm ${
                            offer.netCapChange > 0 ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {offer.netCapChange > 0 ? '+' : ''}${offer.netCapChange.toFixed(1)}M
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Front Office Scouting Reasoning */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-start space-x-3 text-xs">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0">
                      GM
                    </div>
                    <div className="space-y-1">
                      <h5 className="font-display font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                        {offer.offeringTeamCity} Front Office Trade Rationale:
                      </h5>
                      <p className="text-slate-200 italic font-medium leading-relaxed">
                        "{offer.reasoning}"
                      </p>
                    </div>
                  </div>

                  {/* Dual Player Exchange Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* What You Receive */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-mono font-bold text-emerald-400 uppercase flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>PLAYERS YOU RECEIVE</span>
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          Total Value: {offer.tradeValueOffered} pts
                        </span>
                      </div>

                      <div className="space-y-2">
                        {offer.offeredPlayers.map((player) => (
                          <div
                            key={player.id}
                            className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-display font-black text-sm text-emerald-300">
                                {player.ovr}
                              </div>
                              <div>
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-display font-black text-sm text-white">
                                    {player.name}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-amber-300 font-bold">
                                    {player.position}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  Age {player.age} • {player.archetype} • ${player.salary}M/yr
                                </span>
                              </div>
                            </div>

                            <div className="text-right text-[11px] font-mono">
                              <span className="text-slate-400 block">SPD {player.speed} | AGI {player.agility}</span>
                              <span className="text-emerald-400 font-bold">Pot: {player.potential}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* What You Send */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-mono font-bold text-rose-400 uppercase flex items-center space-x-1.5">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>PLAYERS YOU SEND</span>
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          Total Value: {offer.tradeValueRequested} pts
                        </span>
                      </div>

                      <div className="space-y-2">
                        {offer.requestedPlayers.map((player) => (
                          <div
                            key={player.id}
                            className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-display font-black text-sm text-amber-300">
                                {player.ovr}
                              </div>
                              <div>
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-display font-black text-sm text-white">
                                    {player.name}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-cyan-300 font-bold">
                                    {player.position}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  Age {player.age} • {player.archetype} • ${player.salary}M/yr
                                </span>
                              </div>
                            </div>

                            <div className="text-right text-[11px] font-mono">
                              <span className="text-slate-400 block">SPD {player.speed} | AGI {player.agility}</span>
                              <span className="text-cyan-400 font-bold">Pot: {player.potential}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Warning if Cap Exceeded */}
                  {capExceeded && (
                    <div className="bg-rose-950/80 border border-rose-500/50 rounded-2xl p-3 flex items-center space-x-2 text-rose-300 text-xs font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>
                        INSUFFICIENT SALARY CAP: Accepting this deal requires ${offer.netCapChange.toFixed(1)}M, but you only have ${availableCap.toFixed(1)}M available.
                      </span>
                    </div>
                  )}

                  {/* GM Action Controls */}
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => onCounterOffer(offer)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-display font-bold text-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      <span>COUNTER IN TRADE CENTER</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeclineOffer(offer.id)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-display font-bold text-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>DECLINE OFFER</span>
                    </button>

                    <button
                      type="button"
                      disabled={deadlinePassed || capExceeded}
                      onClick={() => onApproveOffer(offer.id)}
                      className={`w-full sm:w-auto px-7 py-2.5 rounded-xl font-display font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center space-x-2 ${
                        !deadlinePassed && !capExceeded
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 ring-2 ring-emerald-400/50 cursor-pointer scale-102'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>APPROVE TRADE (GM SIGNATURE)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History of Past Inquiries */}
      {pastOffers.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-slate-800">
          <h4 className="font-display font-bold text-sm text-slate-400 uppercase tracking-wider">
            RESOLVED INQUIRIES ({pastOffers.length})
          </h4>
          <div className="space-y-2">
            {pastOffers.map((offer) => (
              <div
                key={offer.id}
                className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      offer.status === 'accepted'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {offer.status}
                  </span>
                  <span className="font-bold text-white">
                    Week {offer.week}: {offer.offeringTeamCity} {offer.offeringTeamName}
                  </span>
                  <span className="text-slate-400 hidden sm:inline">
                    Offered {offer.offeredPlayers.map((p) => p.name).join(', ')} for {offer.requestedPlayers.map((p) => p.name).join(', ')}
                  </span>
                </div>
                <span className="text-slate-500 font-mono text-[11px]">
                  Interest: {offer.interestScore}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
