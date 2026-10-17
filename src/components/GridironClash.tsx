import React, { useState, useEffect, useMemo } from 'react';
import {
  Swords,
  Search,
  Filter,
  ArrowUpDown,
  ShoppingBag,
  Users,
  Shield,
  Zap,
  Sparkles,
  Trophy,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Award,
  ChevronRight,
  ArrowRightLeft,
  X,
  Flame,
  Star,
  Layers,
  Play,
  Crosshair,
  Gamepad2,
  Coins,
  Pencil,
  Globe,
  Wifi,
  UserPlus,
  Radio,
  Copy,
  Check,
  RotateCcw,
  Target,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  ClashCard,
  ClashPosition,
  CardTier,
  AuctionListing,
  AIOpponentTeam,
  ClashUserData,
  ClashTransaction,
} from '../types/clash';
import {
  STARTER_SLOTS,
  getCardTier,
  getTierColor,
  sanitizeLineupUniquePlayers,
  equipCardUniquePlayer,
  loadClashUserData,
  saveClashUserData,
  resetClashUserData,
  generateAuctionListings,
  AI_OPPONENT_TEAMS,
  getCurrentAIBosses,
  createClashUserNFLTeam,
  createAIOpponentNFLTeam,
  openCardPack,
  redeemLockerCode,
  calculateQuickSellPrice,
  calculateAuctionPriceInGridIrons,
  TUTORIAL_AI_BOSS,
  getTutorialRewardChoices,
  checkAndResetMissions,
  generateDailyMissions,
  GlobalMissionsDoc,
  subscribeGlobalMissions,
  syncUserDataWithGlobalMissions,
  resetGlobalDailyMissionsInFirestore,
} from '../utils/clashManager';
import { useAuth } from '../hooks/useAuth';
import {
  createOnlineLobby,
  joinOnlineLobby,
  findQuickMatch,
  leaveOnlineLobby,
  listenToLobby,
  listenToActiveLobbies,
  fetchActiveLobbies,
  publishLeaderboardStats,
  fetchGlobalLeaderboard,
  getOnlineUserId,
  initializeOnlineMatchSync,
  updateRoomHostKickoffRole,
  OnlineRoom,
  OnlineLeaderboardEntry,
  fetchOnlineAuctions,
  subscribeToOnlineAuctions,
  postPlayerToOnlineAuction,
  buyPlayerFromOnlineAuction,
  cancelOnlineAuction,
  checkAndReclaimExpiredUserAuctions,
  subscribeToUserSales,
} from '../utils/clashOnlineManager';
import { NFLTeam } from '../types/game';
import { LogIn } from 'lucide-react';

interface GridironClashProps {
  onStartClashMatch?: (
    userTeam: NFLTeam,
    aiTeam: NFLTeam,
    starPlayer: string,
    starOvr: number,
    startOnOffense?: boolean,
    onlineMatchRoomId?: string,
    onlineMatchIsHost?: boolean
  ) => void;
}

export const GridironClash: React.FC<GridironClashProps> = ({ onStartClashMatch }) => {
  const { user, userData: authUserData, loading: authLoading, login, logout, updateUserData } = useAuth();
  const [activeTab, setActiveTab] = useState<'battles' | 'online' | 'auctions' | 'roster' | 'binder' | 'packs'>('battles');
  const [lastOpenedCard, setLastOpenedCard] = useState<ClashCard | null>(null);
  const [lastOpenedCards, setLastOpenedCards] = useState<ClashCard[] | null>(null);

  // Use auth user data or fallback to a default structure if not yet synced
  const userData = useMemo(() => {
    return authUserData || {
      teamName: 'Apex Dynasty',
      gridIrons: 0,
      roster: [],
      startingLineup: {},
      auctionListings: [],
      transactions: [],
      aiBattlesWon: 0,
      aiBattlesPlayed: 0,
      wins: 0,
      losses: 0,
      userOvr: 60,
      defeatedBossIds: [],
      currentBossTier: 1,
      tutorialCompleted: false,
      tutorialWins: 0,
      missions: [],
      lastMissionReset: Date.now(),
    } as ClashUserData;
  }, [authUserData]);

  // Real-time ticking clock for timers & mission resets
  const [currentClockTime, setCurrentClockTime] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentClockTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Global Synchronized Daily Missions State & Firestore Subscription
  const [globalMissionsDoc, setGlobalMissionsDoc] = useState<GlobalMissionsDoc | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeGlobalMissions((globalData) => {
      setGlobalMissionsDoc(globalData);
    });
    return () => unsubscribe();
  }, []);

  // Sync user's active missions with global missions whenever global missions update or reset
  useEffect(() => {
    if (!globalMissionsDoc) return;
    const currentData = authUserData || userData;
    if (currentData) {
      const synced = syncUserDataWithGlobalMissions(currentData, globalMissionsDoc);
      if (synced.lastMissionReset !== currentData.lastMissionReset || JSON.stringify(synced.missions) !== JSON.stringify(currentData.missions)) {
        updateUserData(synced);
      }
    }
  }, [globalMissionsDoc, authUserData, userData, updateUserData]);

  // Admin Manual Reset: Updates global Firestore document, automatically broadcasting to ALL connected users
  const handleManualResetMissions = async () => {
    const freshGlobal = await resetGlobalDailyMissionsInFirestore();
    setGlobalMissionsDoc(freshGlobal);
    const currentData = authUserData || userData;
    if (currentData) {
      const synced = syncUserDataWithGlobalMissions(currentData, freshGlobal);
      updateUserData(synced);
    }
  };

  // Online Matchmaking & Leaderboard State
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoom | null>(null);
  const [joinRoomInput, setJoinRoomInput] = useState<string>('');
  const [isSearchingOnline, setIsSearchingOnline] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<OnlineLeaderboardEntry[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState<boolean>(false);
  const [onlineKickoffRole, setOnlineKickoffRole] = useState<'offense' | 'defense'>('offense');
  const [activeLobbies, setActiveLobbies] = useState<OnlineRoom[]>([]);
  const [isPollingLobbies, setIsPollingLobbies] = useState<boolean>(false);

  const IS_ONLINE_H2H_PAUSED = true;

  const hasAutoLaunchedRef = React.useRef(false);

  // Subscribe/poll active lobby rooms from Firebase Realtime / Firestore
  useEffect(() => {
    if (activeTab !== 'online' || IS_ONLINE_H2H_PAUSED) return;

    setIsPollingLobbies(true);
    const unsub = listenToActiveLobbies((rooms) => {
      setActiveLobbies(rooms);
      setIsPollingLobbies(false);
    });

    // Slower fallback polling interval every 10s (reduced from 3s)
    const pollTimer = setInterval(async () => {
      const fresh = await fetchActiveLobbies();
      if (fresh && fresh.length > 0) {
        setActiveLobbies(fresh);
      }
    }, 10000);

    return () => {
      unsub();
      clearInterval(pollTimer);
    };
  }, [activeTab]);

  const lastStatusRef = React.useRef<string | undefined>(onlineRoom?.status);

  // Subscribe to room updates when inside an online room
  useEffect(() => {
    if (!onlineRoom) {
      hasAutoLaunchedRef.current = false;
      lastStatusRef.current = undefined;
      return;
    }
    const unsub = listenToLobby(onlineRoom.id, (updated) => {
      if (updated) {
        const prevStatus = lastStatusRef.current;
        lastStatusRef.current = updated.status;
        
        setOnlineRoom(updated);
        
        if ((updated.status === 'in_progress' && updated.guestUserId) || updated.matchSync) {
          if (!hasAutoLaunchedRef.current) {
            hasAutoLaunchedRef.current = true;
            showToast('⚡ ONLINE OPPONENT MATCHED! Auto-starting kickoff...');
            try { confetti({ particleCount: 80, spread: 70 }); } catch (e) {}
            handleLaunchOnlineBattle(updated);
          }
        }
      }
    });
    return () => unsub();
  }, [onlineRoom?.id]);

  // Auction Filter & Search States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [binderSearchQuery, setBinderSearchQuery] = useState<string>('');
  const [posFilter, setPosFilter] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [sortOption, setSortOption] = useState<'ovr_desc' | 'ovr_asc' | 'price_asc' | 'price_desc' | 'name_asc'>('ovr_desc');

  // Shared Online Auction House State
  const [auctionSubTab, setAuctionSubTab] = useState<'standard' | 'online'>('standard');
  const [onlineAuctions, setOnlineAuctions] = useState<AuctionListing[]>([]);
  const [isAuctionsLoading, setIsAuctionsLoading] = useState<boolean>(false);
  const [cardToListOnAuction, setCardToListOnAuction] = useState<ClashCard | null>(null);
  const [auctionPriceInput, setAuctionPriceInput] = useState<string>('');
  const [auctionDurationMinutes, setAuctionDurationMinutes] = useState<number>(60);

  // Purchase Modal / Card Detail State
  const [selectedCardToBuy, setSelectedCardToBuy] = useState<AuctionListing | null>(null);
  const [inspectedCard, setInspectedCard] = useState<ClashCard | null>(null);
  const [swapModalSlot, setSwapModalSlot] = useState<{ id: string; label: string; position: ClashPosition } | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isEditingTeamName, setIsEditingTeamName] = useState<boolean>(false);
  const [teamNameInput, setTeamNameInput] = useState<string>(userData.teamName || 'Apex Dynasty');

  // Locker Code Redemption State
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState<boolean>(false);
  const [lockerCodeInput, setLockerCodeInput] = useState<string>('');
  const [isOpeningPack, setIsOpeningPack] = useState<boolean>(false);

  useEffect(() => {
    saveClashUserData(userData);
  }, [userData]);

  // Daily Mission 24-Hour Reset Timer Computation
  const lastReset = globalMissionsDoc?.lastMissionReset || userData.lastMissionReset || Date.now();
  const timeUntilReset = Math.max(0, (24 * 60 * 60 * 1000) - (currentClockTime - lastReset));
  const resetHours = Math.floor(timeUntilReset / (1000 * 60 * 60));
  const resetMinutes = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
  const resetSeconds = Math.floor((timeUntilReset % (1000 * 60)) / 1000);
  const formattedMissionResetTimer = `${resetHours.toString().padStart(2, '0')}h ${resetMinutes.toString().padStart(2, '0')}m ${resetSeconds.toString().padStart(2, '0')}s`;

  // Handle Escape key to dismiss modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectedCard) setInspectedCard(null);
        if (selectedCardToBuy) setSelectedCardToBuy(null);
        if (cardToListOnAuction) setCardToListOnAuction(null);
        if (swapModalSlot) setSwapModalSlot(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedCard, selectedCardToBuy, cardToListOnAuction, swapModalSlot]);

  // Compute Active Starting Lineup Cards and Team OVR
  const startingCards = useMemo(() => {
    const sanitizedLineup = sanitizeLineupUniquePlayers(userData.startingLineup, userData.roster);
    return STARTER_SLOTS.map((slot) => {
      const cardId = sanitizedLineup[slot.id];
      const card = userData.roster.find((c) => c.id === cardId) || {
        id: `fallback-${slot.id}`,
        name: `Starter ${slot.label}`,
        position: slot.position,
        ovr: 60,
        teamId: 'CLASH',
        teamName: 'Gridiron Clash',
        speed: 60,
        strength: 60,
        agility: 60,
        awareness: 60,
        archetype: 'Balanced',
        college: 'Gridiron Academy',
        age: 22,
        tier: 'bronze' as CardTier,
      };
      return { slot, card };
    });
  }, [userData.startingLineup, userData.roster]);

  const teamOvrStats = useMemo(() => {
    if (startingCards.length === 0) return { ovr: 60, off: 60, def: 60 };

    const offCards = startingCards.filter((s) => s.slot.group === 'OFF');
    const defCards = startingCards.filter((s) => s.slot.group === 'DEF');

    const avgOvr = Math.round(startingCards.reduce((acc, c) => acc + c.card.ovr, 0) / startingCards.length);
    const avgOff = Math.round(offCards.reduce((acc, c) => acc + c.card.ovr, 0) / (offCards.length || 1));
    const avgDef = Math.round(defCards.reduce((acc, c) => acc + c.card.ovr, 0) / (defCards.length || 1));

    return { ovr: avgOvr, off: avgOff, def: avgDef };
  }, [startingCards]);

  const auctionsPopulatedRef = React.useRef<boolean>(false);
  const lastLeaderboardOvrRef = React.useRef<number>(-1);

  // Load online leaderboard when switching to online tab
  useEffect(() => {
    if (activeTab === 'online') {
      const currentOvr = teamOvrStats.ovr;
      // Only fetch if tab switched OR OVR changed significantly
      if (lastLeaderboardOvrRef.current !== currentOvr) {
        lastLeaderboardOvrRef.current = currentOvr;
        setIsLeaderboardLoading(true);
        fetchGlobalLeaderboard({ ...userData, userOvr: currentOvr }).then((res) => {
          setGlobalLeaderboard(res);
          setIsLeaderboardLoading(false);
        });
      }
    }
  }, [activeTab, userData, teamOvrStats.ovr]);

  // Shared Online Auctions Live Subscription & Expired Cards Reclamation
  useEffect(() => {
    if (activeTab === 'auctions' && auctionSubTab === 'online') {
      setIsAuctionsLoading(true);
      const myUserId = getOnlineUserId();

      // Check and reclaim any expired auctions for the current player
      checkAndReclaimExpiredUserAuctions(myUserId).then((returnedCards) => {
        if (returnedCards.length > 0) {
          const updatedRoster = [...userData.roster, ...returnedCards];
          updateUserData({ roster: updatedRoster });
          showToast(`⏰ ${returnedCards.length} auction${returnedCards.length > 1 ? 's' : ''} expired — Card${returnedCards.length > 1 ? 's' : ''} safely returned to your Card Binder!`);
        }
      }).catch((e) => console.warn('Reclaim check error:', e));

      const unsub = subscribeToOnlineAuctions((auctions) => {
        setOnlineAuctions(auctions);
        setIsAuctionsLoading(false);
      });

      return () => unsub();
    }
  }, [activeTab, auctionSubTab]);

  // Real-time listener for when another user buys your card
  useEffect(() => {
    const myUserId = getOnlineUserId();
    if (!myUserId) return;
    const unsub = subscribeToUserSales(myUserId, (sale) => {
      fireConfetti();
      showToast(`💰 SOLD! Another player bought your ${sale.cardName} (${sale.cardOvr} OVR) on the Auction House for +${sale.price} Grid Irons!`);
    });
    return () => unsub();
  }, []);

  // Auto-populate standard auctions if empty
  useEffect(() => {
    if (user && !authLoading && !auctionsPopulatedRef.current) {
      const hasListings = userData.auctionListings && userData.auctionListings.length > 0;
      if (!hasListings) {
        auctionsPopulatedRef.current = true;
        const freshListings = generateAuctionListings();
        updateUserData({ auctionListings: freshListings });
      } else {
        auctionsPopulatedRef.current = true;
      }
    }
  }, [user, authLoading, userData.auctionListings?.length]);

  // Filtered Auction Listings (Dual Standard / Online)
  const filteredAuctions = useMemo(() => {
    const listingsPool = auctionSubTab === 'standard' ? (userData.auctionListings || []) : onlineAuctions;
    return listingsPool.filter((listing) => {
      const { card } = listing;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = card.name.toLowerCase().includes(q);
        const matchesTeam = card.teamName.toLowerCase().includes(q);
        const matchesPos = card.position.toLowerCase().includes(q);
        if (!matchesName && !matchesTeam && !matchesPos) return false;
      }

      if (posFilter !== 'ALL') {
        if (posFilter === 'OFFENSE') {
          if (!['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C'].includes(card.position)) return false;
        } else if (posFilter === 'DEFENSE') {
          if (!['EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS'].includes(card.position)) return false;
        } else if (posFilter === 'SPECIAL') {
          if (!['K', 'P'].includes(card.position)) return false;
        } else if (card.position !== posFilter) {
          return false;
        }
      }

      if (tierFilter !== 'ALL' && card.tier !== tierFilter) return false;
      if (teamFilter !== 'ALL' && card.teamId !== teamFilter) return false;

      return true;
    }).sort((a, b) => {
      if (sortOption === 'ovr_desc') return b.card.ovr - a.card.ovr;
      if (sortOption === 'ovr_asc') return a.card.ovr - b.card.ovr;
      if (sortOption === 'price_asc') return a.buyNowPrice - b.buyNowPrice;
      if (sortOption === 'price_desc') return b.buyNowPrice - a.buyNowPrice;
      if (sortOption === 'name_asc') return a.card.name.localeCompare(b.card.name);
      return 0;
    });
  }, [onlineAuctions, userData.auctionListings, auctionSubTab, searchQuery, posFilter, tierFilter, teamFilter, sortOption]);

  const filteredBinderCards = useMemo(() => {
    return userData.roster.filter((card) => {
      if (binderSearchQuery.trim()) {
        const q = binderSearchQuery.toLowerCase();
        const matchesName = card.name.toLowerCase().includes(q);
        const matchesTeam = card.teamName.toLowerCase().includes(q);
        const matchesPos = card.position.toLowerCase().includes(q);
        return matchesName || matchesTeam || matchesPos;
      }
      return true;
    }).sort((a, b) => b.ovr - a.ovr);
  }, [userData.roster, binderSearchQuery]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">Synchronizing Dynasty Data...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-8 animate-in fade-in slide-in-from-bottom-5">
        <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-emerald-950/20">
          <Shield className="w-12 h-12 text-white fill-white/20" />
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-black font-display uppercase tracking-wide text-slate-900">
            Gridiron Clash Login
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Please sign in with Google to build your dynasty, compete in online auctions, and climb the global leaderboards.
          </p>
        </div>
        <button
          onClick={login}
          className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-display font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl transition flex items-center justify-center space-x-3 cursor-pointer"
        >
          <LogIn className="w-5 h-5" />
          <span>Sign in with Google</span>
        </button>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          Secure cloud sync powered by Firebase
        </p>
      </div>
    );
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Redeem code handler
  const handleRedeemCode = async (codeToRedeem?: string) => {
    const code = codeToRedeem || lockerCodeInput;
    const res = redeemLockerCode(userData, code);
    if (res.success && res.updatedData) {
      await updateUserData(res.updatedData);
      fireConfetti();
      showToast(res.message);
      setIsRedeemModalOpen(false);
      setLockerCodeInput('');
    } else {
      showToast(res.message);
    }
  };

  // Trigger celebratory confetti
  const fireConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 75,
        origin: { y: 0.6 },
      });
    } catch (e) {}
  };

  // Compute Active Starting Lineup Cards and Team OVR

  // Buy a card from the Auction House using Grid Irons
  const handleBuyCard = async (listing: AuctionListing) => {
    if (userData.gridIrons < listing.buyNowPrice) {
      showToast('❌ Not enough Grid Irons to buy this card! Win AI battles to earn more.');
      return;
    }

    if (auctionSubTab === 'online') {
      const purchaseRes = await buyPlayerFromOnlineAuction(listing, getOnlineUserId());
      if (!purchaseRes.success) {
        showToast(`❌ ${purchaseRes.error || 'Failed to complete transaction.'}`);
        return;
      }
    }

    const boughtCard: ClashCard = {
      ...listing.card,
      acquiredAt: Date.now(),
    };

    const updatedGridIrons = userData.gridIrons - listing.buyNowPrice;
    const updatedRoster = [...userData.roster, boughtCard];

    const transaction: ClashTransaction = {
      id: `tx-${Date.now()}`,
      type: 'buy',
      description: `Bought ${boughtCard.name} (${boughtCard.ovr} OVR ${boughtCard.position})`,
      cardName: boughtCard.name,
      amount: -listing.buyNowPrice,
      timestamp: Date.now(),
    };

    // Check if we can automatically upgrade a lower-rated starter in this position
    const updatedLineup = { ...userData.startingLineup };
    const boughtName = boughtCard.name.trim().toLowerCase();
    const existingSlotEntry = Object.entries(updatedLineup).find(([sId, cId]) => {
      const c = updatedRoster.find((rc) => rc && rc.id === cId);
      return c && c.name.trim().toLowerCase() === boughtName;
    });

    if (existingSlotEntry) {
      const [existingSlotId, existingCardId] = existingSlotEntry;
      const existingCard = updatedRoster.find((rc) => rc && rc.id === existingCardId);
      if (existingCard && boughtCard.ovr > existingCard.ovr) {
        updatedLineup[existingSlotId] = boughtCard.id;
        boughtCard.isStarter = true;
        boughtCard.assignedSlot = existingSlotId;
      }
    } else {
      const matchingSlots = STARTER_SLOTS.filter((s) => s.position === boughtCard.position);
      for (const slot of matchingSlots) {
        const currentStarterId = updatedLineup[slot.id];
        const currentStarterCard = userData.roster.find((c) => c && c.id === currentStarterId);
        if (currentStarterCard && currentStarterCard.ovr < boughtCard.ovr) {
          updatedLineup[slot.id] = boughtCard.id;
          boughtCard.isStarter = true;
          boughtCard.assignedSlot = slot.id;
          break;
        }
      }
    }

    const nextUserData: Partial<ClashUserData> = {
      gridIrons: updatedGridIrons,
      roster: updatedRoster,
      startingLineup: updatedLineup,
      transactions: [transaction, ...userData.transactions],
    };

    if (auctionSubTab === 'standard') {
      nextUserData.auctionListings = userData.auctionListings.filter((a) => a.id !== listing.id);
    }

    await updateUserData(nextUserData);
    setSelectedCardToBuy(null);
    fireConfetti();
    showToast(`🎉 Purchased ${boughtCard.name} (${boughtCard.ovr} OVR) for ${listing.buyNowPrice} Grid Iron${listing.buyNowPrice > 1 ? 's' : ''}!`);
    
    if (auctionSubTab === 'online') {
      loadAuctions();
    }
  };

  // Open a Premium Card Pack (Cost: 10 Grid Irons) - 10 Players
  const handleOpenPack = async (
    packType: 'wayne_garrett' | 'cam_newton' | 'seattle' | 'colts_legends' | 'essentials' | 'kc_dynasty' | 'sf_hofers' = 'wayne_garrett'
  ) => {
    if (isOpeningPack) return; // Prevent double-triggering

    const cost = packType === 'essentials' ? 5 : 10;
    if (userData.gridIrons < cost) {
      showToast(`❌ Not enough Grid Irons! You need ${cost} Grid Irons to open this Pack. Win Hard Mode AI Battles or redeem codes to earn more.`);
      return;
    }

    setIsOpeningPack(true); // Indicate loading immediately

    // Simulate small delay for UI transition if necessary, 
    // or just execute directly.
    const { updatedUserData, pulledCards } = openCardPack(userData, packType);

    // Auto-equip any pulled card if better than current starter in position
    let updatedLineup = { ...updatedUserData.startingLineup };
    const rosterCopy = [...updatedUserData.roster];

    for (const pulledCard of pulledCards) {
      const pulledName = pulledCard.name.trim().toLowerCase();
      const existingSlotEntry = Object.entries(updatedLineup).find(([sId, cId]) => {
        const c = rosterCopy.find((rc) => rc && rc.id === cId);
        return c && c.name.trim().toLowerCase() === pulledName;
      });

      if (existingSlotEntry) {
        const [existingSlotId, existingCardId] = existingSlotEntry;
        const existingCard = rosterCopy.find((rc) => rc && rc.id === existingCardId);
        if (existingCard && pulledCard.ovr > existingCard.ovr) {
          updatedLineup[existingSlotId] = pulledCard.id;
          pulledCard.isStarter = true;
          pulledCard.assignedSlot = existingSlotId;
        }
      } else {
        const matchingSlots = STARTER_SLOTS.filter((s) => s.position === pulledCard.position);
        for (const slot of matchingSlots) {
          const currentStarterId = updatedLineup[slot.id];
          const currentStarterCard = rosterCopy.find((c) => c && c.id === currentStarterId);
          if (!currentStarterCard || currentStarterCard.ovr < pulledCard.ovr) {
            updatedLineup[slot.id] = pulledCard.id;
            pulledCard.isStarter = true;
            pulledCard.assignedSlot = slot.id;
            break;
          }
        }
      }
    }
    updatedLineup = sanitizeLineupUniquePlayers(updatedLineup, rosterCopy);

    const finalUserData = {
      gridIrons: updatedUserData.gridIrons,
      startingLineup: updatedLineup,
      roster: rosterCopy,
      transactions: updatedUserData.transactions,
    };

    await updateUserData(finalUserData);
    setLastOpenedCards(pulledCards);
    fireConfetti();
    
    setIsOpeningPack(false); // Reset loading

    const hasJSN = pulledCards.some((c) => c.name === 'Jaxon Smith-Njigba' && c.ovr === 99);
    const hasCam = pulledCards.some((c) => c.name === 'Cam Newton');
    const hasWayne = pulledCards.some((c) => c.name === 'Wayne Garrett');
    const hasLuck = pulledCards.some((c) => c.name === 'Andrew Luck');
    const hasMcAfee = pulledCards.some((c) => c.name.toLowerCase().includes('mcafee') || c.name.toLowerCase().includes('macafee'));
    const bestCard = pulledCards.reduce((best, c) => c.ovr > best.ovr ? c : best, pulledCards[0]);

    if (hasLuck) {
      showToast('⚡ LEGENDARY PULL! You unlocked Andrew Luck (99 OVR QB) with Game Breaker: Composure!');
    } else if (hasMcAfee) {
      showToast('⚡ LEGENDARY PULL! You unlocked Pat McAfee (99 OVR P) with Game Breaker: 1 Yard line!');
    } else if (hasJSN) {
      showToast('⚡ LEGENDARY PULL! You unlocked Jaxon Smith-Njigba (99 OVR) with Game Breaker: Emerald City Route Artist!');
    } else if (hasCam) {
      showToast('⚡ LEGENDARY PULL! You unlocked Cam Newton (99 OVR) with Game Breaker: Ignore the odds!');
    } else if (hasWayne) {
      showToast('🔥 LEGENDARY PULL! You unlocked Wayne Garrett (99 OVR) with Game Breaker: Home Wrecker!');
    } else if (bestCard.ovr === 89) {
      showToast(`💎 89 OVR BOSS SUMMON! You pulled ${bestCard.name} (${bestCard.position} • ${bestCard.teamName})! Added to binder.`);
    } else if (bestCard.ovr >= 75) {
      showToast(`⭐ Pack Opened! Pulled 10 players. Best: ${bestCard.name} (${bestCard.ovr} OVR).`);
    } else {
      showToast(`📦 Pack Opened! Pulled 10 players. Added to binder.`);
    }
  };

  const handleLeaveOnlineRoom = async () => {
    if (onlineRoom) {
      await leaveOnlineLobby(onlineRoom.id);
      setOnlineRoom(null);
      showToast('🚪 Left online lobby.');
    }
  };

  const handleStartQuickOnlineMatch = async () => {
    if (IS_ONLINE_H2H_PAUSED) {
      showToast('⏸️ Online H2H matchmaking is currently paused for maintenance and optimizations (WIP). Check back soon!');
      return;
    }
    setIsSearchingOnline(true);
    showToast('🔍 Searching online lobbies for open matchmaking...');
    const result = await findQuickMatch(userData);
    setIsSearchingOnline(false);
    setOnlineRoom(result.room);
    if (result.isHost) {
      showToast(`🎮 Created Quick Match Room ${result.room.id}! Waiting for opponent...`);
    } else {
      showToast(`⚡ Joined Match in Room ${result.room.id}! Auto-starting kickoff...`);
      if (!hasAutoLaunchedRef.current) {
        hasAutoLaunchedRef.current = true;
        handleLaunchOnlineBattle(result.room);
      }
    }
  };

  const handleCreatePrivateLobby = async () => {
    if (IS_ONLINE_H2H_PAUSED) {
      showToast('⏸️ Online H2H matchmaking is currently paused for maintenance and optimizations (WIP). Check back soon!');
      return;
    }
    setIsSearchingOnline(true);
    const room = await createOnlineLobby(userData);
    setIsSearchingOnline(false);
    setOnlineRoom(room);
    showToast(`🌐 Private Lobby Created! Room Code: ${room.id}`);
  };

  const handleRefreshLobbies = async () => {
    setIsPollingLobbies(true);
    const fresh = await fetchActiveLobbies();
    setActiveLobbies(fresh);
    setIsPollingLobbies(false);
    showToast('🔄 Refreshed active online lobbies!');
  };

  const handleJoinLobbyFromList = async (targetRoom: OnlineRoom) => {
    if (IS_ONLINE_H2H_PAUSED) {
      showToast('⏸️ Online H2H matchmaking is currently paused for maintenance and optimizations (WIP). Check back soon!');
      return;
    }
    if (isSearchingOnline) return;
    setIsSearchingOnline(true);
    showToast(`⚡ Connecting to lobby ${targetRoom.id}...`);
    try {
      const result = await joinOnlineLobby(targetRoom.id, userData);
      if (result.success && result.room) {
        setOnlineRoom(result.room);
        showToast(`⚡ Joined room ${result.room.id}! Auto-starting match...`);
        try { confetti({ particleCount: 60, spread: 60 }); } catch (e) {}
        if (!hasAutoLaunchedRef.current) {
          hasAutoLaunchedRef.current = true;
          handleLaunchOnlineBattle(result.room);
        }
      } else {
        showToast(`⚠️ ${result.error || 'Unable to join room'}`);
      }
    } catch (e: any) {
      showToast(`⚠️ ${e?.message || 'Failed to join room'}`);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleJoinPrivateLobby = async () => {
    if (IS_ONLINE_H2H_PAUSED) {
      showToast('⏸️ Online H2H matchmaking is currently paused for maintenance and optimizations (WIP). Check back soon!');
      return;
    }
    if (!joinRoomInput.trim()) {
      showToast('❌ Please enter a room code.');
      return;
    }
    setIsSearchingOnline(true);
    const res = await joinOnlineLobby(joinRoomInput, userData);
    setIsSearchingOnline(false);
    if (res.success && res.room) {
      setOnlineRoom(res.room);
      showToast(`⚡ Connected to Room ${res.room.id}! Auto-starting match...`);
      if (!hasAutoLaunchedRef.current) {
        hasAutoLaunchedRef.current = true;
        handleLaunchOnlineBattle(res.room);
      }
    } else {
      showToast(`❌ ${res.error || 'Could not join room.'}`);
    }
  };

  const handleLaunchOnlineBattle = async (room: OnlineRoom) => {
    const isHost = room.hostUserId === getOnlineUserId();
    const opponentTeamName = isHost ? room.guestTeamName || 'Online Opponent' : room.hostTeamName;
    const opponentOvr = isHost ? room.guestOvr || 75 : room.hostOvr;
    const opponentStar = isHost ? room.guestStarPlayer || 'Superstar' : room.hostStarPlayer;

    const onlineOpponentTeam = createAIOpponentNFLTeam({
      id: `ONLINE-${room.id}`,
      teamId: 'ONL',
      city: 'Online',
      name: opponentTeamName,
      abbr: opponentTeamName.substring(0, 3).toUpperCase(),
      primaryColor: '#0284c7',
      secondaryColor: '#38bdf8',
      starPlayer: {
        name: opponentStar.split(' (')[0] || 'Superstar',
        position: 'QB',
        ovr: 89,
        archetype: 'Online Game Breaker',
      },
      restRosterOvr: 70,
      teamOvr: opponentOvr,
      off: opponentOvr,
      def: opponentOvr,
      description: 'Online H2H Competitive Rival',
    });

    const userNFLTeam = createClashUserNFLTeam(userData, teamOvrStats);
    const hostRole = room.hostKickoffRole || onlineKickoffRole;
    const startOnOffense = isHost ? hostRole === 'offense' : hostRole === 'defense';

    if (isHost && !room.matchSync) {
      setTimeout(() => {
        initializeOnlineMatchSync(
          room.id,
          room.hostUserId,
          room.guestUserId || 'guest',
          hostRole === 'offense'
        );
      }, 0);
    }

    if (onStartClashMatch) {
      onStartClashMatch(
        userNFLTeam,
        onlineOpponentTeam,
        opponentStar,
        89,
        startOnOffense,
        room.id,
        isHost
      );
    }
  };

  // Launch Full Live Match against AI Team on Hard Mode
  const handleLaunchLiveBattle = (aiTeam: AIOpponentTeam) => {
    if (!onStartClashMatch) return;
    const userNFLTeam = createClashUserNFLTeam(userData, teamOvrStats);
    const aiNFLTeam = createAIOpponentNFLTeam(aiTeam);
    onStartClashMatch(userNFLTeam, aiNFLTeam, aiTeam.starPlayer.name, aiTeam.starPlayer.ovr);
  };

  // Quick sell a card from roster
  const handleQuickSell = async (card: ClashCard) => {
    const isEquipped = Object.values(userData.startingLineup).includes(card.id);
    if (isEquipped && userData.roster.filter((c) => c.position === card.position).length <= 1) {
      showToast(`⚠️ Cannot sell ${card.name}. You need at least one ${card.position} for your active lineup.`);
      return;
    }

    const sellReward = calculateQuickSellPrice(card);
    const updatedGridIrons = userData.gridIrons + sellReward;
    const updatedRoster = userData.roster.filter((c) => c.id !== card.id);

    const updatedLineup = { ...userData.startingLineup };
    Object.entries(updatedLineup).forEach(([slotId, cId]) => {
      if (cId === card.id) {
        const slotDef = STARTER_SLOTS.find((s) => s.id === slotId);
        if (slotDef) {
          const replacement = updatedRoster.find((c) => c.position === slotDef.position);
          if (replacement) {
            updatedLineup[slotId] = replacement.id;
          }
        }
      }
    });

    const transaction: ClashTransaction = {
      id: `tx-${Date.now()}`,
      type: 'sell',
      description: `Quick-sold ${card.name} (${card.ovr} OVR) for +${sellReward} Grid Iron${sellReward > 1 ? 's' : ''}`,
      amount: sellReward,
      timestamp: Date.now(),
    };

    await updateUserData({
      gridIrons: updatedGridIrons,
      roster: updatedRoster,
      startingLineup: updatedLineup,
      transactions: [transaction, ...userData.transactions],
    });
    setInspectedCard(null);
    showToast(`💰 Quick-sold ${card.name} (${card.ovr} OVR) for +${sellReward} Grid Iron${sellReward > 1 ? 's' : ''}!`);
  };

  // Equip a card into a starter slot, ensuring each player name is used ONCE across the entire depth chart
  const handleEquipStarter = async (slotId: string, cardId: string) => {
    const updatedLineup = equipCardUniquePlayer(userData.startingLineup, userData.roster, slotId, cardId);

    await updateUserData({
      startingLineup: updatedLineup,
    });
    setSwapModalSlot(null);
    const cardName = userData.roster.find((c) => c.id === cardId)?.name || 'Player';
    showToast(`✅ Lineup updated! ${cardName} equipped to ${slotId}.`);
  };

  const handleSelectTutorialReward = async (card: ClashCard) => {
    const transaction: ClashTransaction = {
      id: `tx-tutorial-reward-${Date.now()}`,
      type: 'starter',
      description: `Completed Tutorial! Chosen Reward: ${card.name} (${card.ovr} OVR)`,
      cardName: `${card.name} (${card.ovr} OVR)`,
      amount: 0,
      timestamp: Date.now(),
    };

    // Auto-equip the chosen card to its primary slot
    const updatedLineup = { ...userData.startingLineup };
    const slotDef = STARTER_SLOTS.find((s) => s.position === card.position);
    if (slotDef) {
      updatedLineup[slotDef.id] = card.id;
      card.isStarter = true;
      card.assignedSlot = slotDef.id;
    }

    await updateUserData({
      tutorialCompleted: true,
      roster: [...userData.roster, card],
      startingLineup: updatedLineup,
      transactions: [transaction, ...userData.transactions],
    });

    try {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
      });
    } catch (e) {}

    showToast(`🎁 Welcome to the Gridiron! You chose ${card.name}. AI Battles unlocked!`);
  };

  // Refresh auction listings pool depending on current sub-tab
  const handleRefreshAuctions = async () => {
    if (auctionSubTab === 'standard') {
      const freshListings = generateAuctionListings();
      await updateUserData({
        auctionListings: freshListings,
      });
      showToast(`🔄 Standard market restocked!`);
    } else {
      loadAuctions();
      showToast(`🔄 Online shared market refreshed!`);
    }
  };

  // Reset entire Clash data back to fresh 60 OVR roster
  const handleResetData = async () => {
    if (window.confirm('Reset your Gridiron Clash roster and currency to the initial 60 OVR squad and starter Grid Irons?')) {
      const reset = resetClashUserData();
      await updateUserData(reset);
      setTeamNameInput(reset.teamName);
      showToast('🔄 Gridiron Clash reset to default 60 OVR squad.');
    }
  };

  // Change and save team name
  const handleSaveTeamName = async () => {
    const trimmed = teamNameInput.trim();
    if (!trimmed) {
      showToast('⚠️ Team name cannot be blank.');
      return;
    }
    await updateUserData({
      teamName: trimmed,
    });
    setIsEditingTeamName(false);
    showToast(`✅ Dynasty team name updated to "${trimmed}"!`);
  };

  const loadAuctions = async () => {
    setIsAuctionsLoading(true);
    try {
      const res = await fetchOnlineAuctions();
      setOnlineAuctions(res);
    } catch (e) {
      console.error('Failed to load shared auctions:', e);
    } finally {
      setIsAuctionsLoading(false);
    }
  };

  const handleCancelAuction = async (listing: AuctionListing) => {
    try {
      await cancelOnlineAuction(listing.id);
      const updatedRoster = [...userData.roster, listing.card];
      await updateUserData({ roster: updatedRoster });
      showToast(`↩️ Auction cancelled. ${listing.card.name} returned to your Card Binder.`);
      loadAuctions();
    } catch (e) {
      showToast('❌ Failed to cancel auction listing.');
    }
  };

  const formatTimeRemaining = (expiresAt?: number, listedAt?: number, timeLeftMinutes?: number) => {
    const target = expiresAt || ((listedAt || Date.now()) + (timeLeftMinutes || 60) * 60 * 1000);
    const diffMs = target - currentClockTime;
    if (diffMs <= 0) {
      return { label: 'EXPIRED', isExpired: true, isUrgent: true };
    }
    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    if (hours > 0) {
      return { label: `${hours}h ${mins}m ${secs}s left`, isExpired: false, isUrgent: false };
    }
    if (mins > 0) {
      return { label: `${mins}m ${secs}s left`, isExpired: false, isUrgent: mins < 3 };
    }
    return { label: `${secs}s left`, isExpired: false, isUrgent: true };
  };

  const handlePostPlayerToAuction = async () => {
    if (!cardToListOnAuction) return;
    const price = parseInt(auctionPriceInput, 10);
    if (isNaN(price) || price <= 0) {
      showToast('❌ Please enter a valid Buy Now price of at least 1 Grid Iron.');
      return;
    }

    try {
      await postPlayerToOnlineAuction(cardToListOnAuction, price, userData.teamName, auctionDurationMinutes);
      
      // Remove card from roster and unequip from starting lineup if equipped
      const updatedRoster = userData.roster.filter((c) => c.id !== cardToListOnAuction.id);
      const updatedLineup = { ...userData.startingLineup };
      Object.entries(updatedLineup).forEach(([slot, cId]) => {
        if (cId === cardToListOnAuction.id) {
          delete updatedLineup[slot];
        }
      });

      const durationLabel = auctionDurationMinutes < 60 ? `${auctionDurationMinutes}m` : `${auctionDurationMinutes / 60}h`;
      const transaction: ClashTransaction = {
        id: `tx-auction-post-${Date.now()}`,
        type: 'sell',
        description: `Listed ${cardToListOnAuction.name} (${cardToListOnAuction.ovr} OVR) on auction house for ${price} GI (${durationLabel} timer)`,
        amount: 0,
        timestamp: Date.now(),
      };

      await updateUserData({
        roster: updatedRoster,
        startingLineup: updatedLineup,
        transactions: [transaction, ...userData.transactions],
      });

      const cardName = cardToListOnAuction.name;
      setCardToListOnAuction(null);
      setAuctionPriceInput('');
      showToast(`🎉 Listed ${cardName} for ${price} GI (${durationLabel} timer)!`);
      if (auctionSubTab === 'online') {
        loadAuctions();
      }
    } catch (e) {
      showToast('❌ Failed to post card to shared auction house.');
    }
  };

  // Filtered Auction Listings (Dual Standard / Online)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-amber-500/50 flex items-center space-x-3 animate-in fade-in slide-in-from-bottom-5">
          <Shield className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold tracking-wide">{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Grid Irons Currency Bar */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 rounded-3xl p-6 sm:p-8 text-white border border-emerald-700/60 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
              DYNASTY CLASH
            </span>
            <span className="text-xs text-emerald-200 font-medium">• Single-Player AI Battles & Card Market</span>
            <button
              onClick={() => {
                setTeamNameInput(userData.teamName);
                setIsEditingTeamName(true);
              }}
              className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-emerald-300 hover:text-white border border-emerald-600/40 text-xs font-bold transition cursor-pointer shadow-sm"
              title="Change your dynasty team name"
            >
              <Pencil className="w-3 h-3 text-emerald-400" />
              <span>Team: {userData.teamName}</span>
            </button>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black font-display tracking-wider uppercase text-white">
            GRIDIRON CLASH
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Defeat AI opponents to earn Grid Irons. Open packs, manage your lineup, and dominate the Auction House.
          </p>
        </div>

        {/* User Grid Irons Balance & Code Redeem */}
        <div className="flex items-center gap-3 shrink-0">
          {user.email === 'shannongarret69@gmail.com' && (
            <button
              onClick={() => setIsRedeemModalOpen(true)}
              className="px-3.5 py-3 rounded-2xl bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 border border-emerald-600 text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition cursor-pointer shadow-sm hover:scale-105"
              title="Redeem Locker Code for +2,000 Grid Irons"
            >
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>Redeem Code</span>
            </button>
          )}

          <div className="bg-slate-900/90 border-2 border-emerald-400/60 rounded-2xl px-5 py-3.5 flex items-center space-x-3.5 shadow-xl">
            <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 shadow-md">
              <Shield className="w-6 h-6 fill-slate-950" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-black text-emerald-400 tracking-wider">GRID IRONS</div>
              <div className="text-2xl sm:text-3xl font-black font-display text-white tracking-wide flex items-center space-x-1">
                <span>{userData.gridIrons}</span>
                <span className="text-xs text-emerald-300 font-sans font-bold">GI</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DAILY MISSIONS BAR */}
      {userData.missions && userData.missions.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg mb-6 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Target className="w-24 h-24 rotate-12 text-slate-100" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="font-display font-black text-xs text-white uppercase tracking-widest">Daily Missions</h3>
              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                24H Reset Cycle
              </span>
            </div>
            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] font-mono bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Resets in <strong className="text-white font-black">{formattedMissionResetTimer}</strong></span>
              </div>
              {user?.email?.toLowerCase() === 'shannongarret69@gmail.com' && (
                <button
                  onClick={handleManualResetMissions}
                  title="Reset Daily Missions & Restart 24-Hour Timer (Admin)"
                  className="flex items-center space-x-1.5 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 border border-amber-500/30 text-amber-400 hover:text-amber-300 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  <RefreshCw className="w-3 h-3 animate-spin-slow" />
                  <span>Reset Now</span>
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {userData.missions.map((mission) => {
              const progressPercent = Math.min(100, (mission.current / mission.target) * 100);
              const difficulty = mission.difficulty || (mission.reward >= 35 ? 'Hard' : mission.reward >= 15 ? 'Medium' : 'Easy');
              const diffColor = difficulty === 'Hard'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : difficulty === 'Medium'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

              return (
                <div key={mission.id} className={`p-3.5 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between ${mission.completed ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-900/10 shadow-md' : 'bg-slate-950/70 border-slate-800'}`}>
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${diffColor}`}>
                            {difficulty}
                          </span>
                          <span className={`text-[11px] font-black uppercase tracking-wide ${mission.completed ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {mission.title}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium leading-tight pt-0.5">
                          {mission.description}
                        </div>
                      </div>
                      {mission.completed ? (
                        <div className="flex items-center space-x-1 bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/30 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase">Done</span>
                        </div>
                      ) : (
                        <div className="text-right shrink-0">
                          <div className="text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg inline-flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>+{mission.reward} GI</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[10px] font-mono font-bold text-slate-400">
                      <span>Progress: <strong className="text-white">{mission.current}</strong> / {mission.target}</span>
                      <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden p-0.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${mission.completed ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-gradient-to-r from-amber-500 to-amber-300'}`} 
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="overflow-x-auto pb-2 scrollbar-none border-b border-slate-200">
        <div className="flex items-center justify-between gap-4 min-w-max pb-1">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('battles')}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-wide uppercase transition cursor-pointer shrink-0 ${
                activeTab === 'battles'
                  ? 'bg-emerald-700 text-white shadow-md font-extrabold'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Swords className="w-4 h-4 text-emerald-400" />
              <span>AI Battles (+1 Grid Iron)</span>
            </button>

            <button
              onClick={() => setActiveTab('online')}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-wide uppercase transition cursor-pointer shrink-0 ${
                activeTab === 'online'
                  ? 'bg-emerald-700 text-white shadow-md font-extrabold'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>Online (WIP)</span>
              <span className="px-1.5 py-0.5 text-[9px] bg-amber-400 text-slate-950 rounded font-black tracking-wide">PAUSED</span>
            </button>

            <button
              onClick={() => setActiveTab('auctions')}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-wide uppercase transition cursor-pointer shrink-0 ${
                activeTab === 'auctions'
                  ? 'bg-emerald-700 text-white shadow-md font-extrabold'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Auction House ({filteredAuctions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('roster')}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-wide uppercase transition cursor-pointer shrink-0 ${
                activeTab === 'roster'
                  ? 'bg-emerald-700 text-white shadow-md font-extrabold'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Active Lineup ({teamOvrStats.ovr} OVR)</span>
            </button>

            <button
              onClick={() => setActiveTab('binder')}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-wide uppercase transition cursor-pointer shrink-0 ${
                activeTab === 'binder'
                  ? 'bg-emerald-700 text-white shadow-md font-extrabold'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Card Binder ({userData.roster.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('packs')}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-wide uppercase transition cursor-pointer shrink-0 ${
                activeTab === 'packs'
                  ? 'bg-emerald-700 text-white shadow-md font-extrabold'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Card Packs (10 GI)</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {activeTab === 'auctions' && (
              <button
                onClick={handleRefreshAuctions}
                className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3 py-2 rounded-xl transition cursor-pointer font-semibold shadow-sm"
                title="Restock Auction Market"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Market</span>
              </button>
            )}

            <button
              onClick={handleResetData}
              className="text-[11px] text-slate-400 hover:text-rose-600 px-2 py-1 transition cursor-pointer font-medium"
              title="Reset to fresh 60 OVR squad"
            >
              Reset Starter Team
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AI BATTLES TAB (1 Star 89 OVR Player + 10 OVR Rest of Team)       */}
      {/* ========================================================================= */}
      {activeTab === 'battles' && (
        <div className="space-y-8">
          {!userData.tutorialCompleted ? (
            <div className="space-y-6">
              {userData.defeatedBossIds.includes('AI_TUTORIAL') ? (
                // Reward Choice Screen
                <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-8 text-center space-y-8 shadow-2xl">
                  <div className="space-y-3">
                    <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-400 border border-amber-500/40">
                      <Trophy className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black font-display text-white uppercase tracking-tight">TUTORIAL COMPLETE!</h2>
                    <p className="text-slate-400 max-w-lg mx-auto text-sm">
                      You've proven your skills! As a reward, choose one of these 80 OVR Elite players to lead your dynasty.
                      This choice will unlock full access to AI Battles and Boss Tiers!
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {getTutorialRewardChoices().map((card) => {
                      const tierStyles = getTierColor(card.tier);
                      return (
                        <div 
                          key={card.id}
                          className={`relative group bg-gradient-to-br ${tierStyles.bg} rounded-2xl p-5 border-2 ${tierStyles.border} shadow-lg transition hover:scale-105 flex flex-col justify-between h-full`}
                        >
                          <div className="space-y-4">
                            <div className="flex justify-between items-start">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${tierStyles.badge}`}>
                                ELITE REWARD
                              </span>
                              <div className="text-right">
                                <div className="text-2xl font-black text-white">{card.ovr}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{card.position}</div>
                              </div>
                            </div>

                            <div className="text-center space-y-1">
                              <div className="font-display font-black text-lg text-white uppercase leading-tight">{card.name}</div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{card.archetype}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                              <div className="bg-slate-950/50 p-1.5 rounded border border-slate-800 flex justify-between text-slate-400">
                                <span>SPD</span>
                                <span className="text-white">{card.speed}</span>
                              </div>
                              <div className="bg-slate-950/50 p-1.5 rounded border border-slate-800 flex justify-between text-slate-400">
                                <span>STR</span>
                                <span className="text-white">{card.strength}</span>
                              </div>
                              <div className="bg-slate-950/50 p-1.5 rounded border border-slate-800 flex justify-between text-slate-400">
                                <span>AGI</span>
                                <span className="text-white">{card.agility}</span>
                              </div>
                              <div className="bg-slate-950/50 p-1.5 rounded border border-slate-800 flex justify-between text-slate-400">
                                <span>AWA</span>
                                <span className="text-white">{card.awareness}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSelectTutorialReward(card)}
                            className="mt-6 w-full py-2.5 bg-white text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider hover:bg-emerald-400 transition cursor-pointer"
                          >
                            CHOOSE PLAYER
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Tutorial Match Launch
                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="w-full md:w-1/3 aspect-video bg-slate-900 rounded-2xl flex flex-col items-center justify-center p-6 text-center border border-slate-800 relative overflow-hidden">
                      <div className="absolute inset-0 opacity-10 pointer-events-none">
                        <Swords className="w-full h-full -rotate-12 scale-150" />
                      </div>
                      <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-slate-950 mb-4 shadow-lg">
                        <Play className="w-8 h-8 fill-current ml-1" />
                      </div>
                      <h3 className="text-xl font-black font-display text-white uppercase">THE FIRST TEST</h3>
                      <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Entry Match</p>
                    </div>

                    <div className="flex-1 space-y-4">
                      <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase">
                        <Sparkles className="w-3 h-3" />
                        <span>MANDATORY TUTORIAL MATCH</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-tight text-slate-900">
                        Defeat the Introductory Squad
                      </h2>
                      <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">
                        Welcome to Gridiron Clash. Before you can face the elite AI bosses and join the global market, 
                        you must prove your basic coordination. Defeat this 45 OVR practice squad to earn your first 
                        <strong> 10 Grid Irons</strong> and unlock an <strong>80 OVR Elite Superstar</strong> of your choice.
                      </p>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
                          <Shield className="w-4 h-4 text-slate-400" />
                          <div className="text-left">
                            <div className="text-[9px] font-black text-slate-400 uppercase leading-none">OPPONENT</div>
                            <div className="text-sm font-black text-slate-900 uppercase">45 OVR SQUAD</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100">
                          <Coins className="w-4 h-4 text-amber-500" />
                          <div className="text-left">
                            <div className="text-[9px] font-black text-amber-600 uppercase leading-none">REWARD</div>
                            <div className="text-sm font-black text-amber-700 uppercase">10 GRID IRONS</div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleLaunchLiveBattle(TUTORIAL_AI_BOSS)}
                        className="inline-flex items-center space-x-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black rounded-2xl uppercase tracking-wider shadow-lg transition hover:scale-105 cursor-pointer group"
                      >
                        <Swords className="w-5 h-5 group-hover:rotate-12 transition" />
                        <span>START TUTORIAL MATCH</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Full AI Battles (Unlocked)
            <div className="space-y-6">
              {/* Battles Overview Banner */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-black uppercase">
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                <span>TIER {userData.currentBossTier || 1} GAMEPLAY CHALLENGES</span>
              </div>
              <h2 className="text-2xl font-black font-display text-slate-900 uppercase">
                AI Boss Showdowns
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
                  {userData.currentBossTier === 2 ? (
                    <>
                      Tier 2: Beat these elites to earn <strong>5 Grid Irons</strong> and an <strong>80 OVR star card</strong>! All supporting players are <strong>80 OVR</strong>.
                    </>
                  ) : (
                    <>
                      Tier 1: Win on Hard Mode to earn <strong>1 Grid Iron</strong> and a <strong>75 OVR star card</strong>! Supporting players are <strong>70 OVR</strong>.
                    </>
                  )}
                </p>
                {(userData.tutorialWins || 0) < 3 && (
                  <button
                    onClick={() => handleLaunchLiveBattle(TUTORIAL_AI_BOSS)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg border border-slate-700 hover:bg-emerald-600 transition uppercase tracking-widest"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Replay Tutorial ({3 - (userData.tutorialWins || 0)} left)</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4 shrink-0">
              <div className="bg-slate-900 text-white p-4 rounded-2xl text-center min-w-[100px] shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">YOUR TEAM</div>
                <div className="text-2xl font-black font-display text-amber-400">{teamOvrStats.ovr} OVR</div>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center min-w-[125px]">
                <div className="text-[10px] uppercase font-bold text-emerald-800">WIN REWARDS</div>
                <div className="text-base font-black font-display text-emerald-700 leading-tight">
                  {userData.currentBossTier === 2 ? '80 OVR STAR' : '75 OVR STAR'}
                </div>
                <div className="text-[11px] font-bold text-amber-700">
                  +{userData.currentBossTier === 2 ? '5' : '1'} GRID IRONS
                </div>
              </div>
            </div>
          </div>

          {/* AI Opponents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {getCurrentAIBosses(userData).map((aiTeam) => {
              const hasOwnedStar = userData.roster.some(
                (c) => c.name.toLowerCase() === aiTeam.starPlayer.name.toLowerCase() && c.ovr >= (userData.currentBossTier === 2 ? 80 : 75)
              );
              const isBeaten = (userData.defeatedBossIds || []).includes(aiTeam.id);

              return (
                <div
                  key={aiTeam.id}
                  className={`bg-white border-2 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${isBeaten ? 'border-emerald-500/50 grayscale-[0.3]' : 'border-slate-200'}`}
                >
                  {/* Team Top Card */}
                  <div className="p-5 border-b border-slate-100 space-y-4" style={{ backgroundColor: `${aiTeam.primaryColor}10` }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center font-display font-black text-xs text-white shadow-sm"
                          style={{ backgroundColor: aiTeam.primaryColor }}
                        >
                          {aiTeam.abbr}
                        </div>
                        <div>
                          <h3 className="font-display font-black text-lg text-slate-900 uppercase">
                            {aiTeam.city} {aiTeam.name}
                          </h3>
                          <span className="text-[11px] text-slate-500 font-semibold">{aiTeam.teamOvr} OVR AI Squad</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {isBeaten && (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[9px] font-black shadow-sm flex items-center space-x-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>DEFEATED</span>
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black shadow-sm">
                          {userData.currentBossTier === 2 ? '80 OVR' : '75 OVR'}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-black shadow-sm">
                          +{userData.currentBossTier === 2 ? '5' : '1'} GI
                        </span>
                      </div>
                    </div>

                    {/* Star Player Badge */}
                    <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-amber-400/40 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/20 px-2 py-0.5 rounded">
                          BOSS SUPERSTAR
                        </span>
                        <span className="text-sm font-black text-amber-400">89 OVR</span>
                      </div>
                      <div className="font-display font-black text-base uppercase text-white">
                        {aiTeam.starPlayer.name} ({aiTeam.starPlayer.position})
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {aiTeam.starPlayer.archetype}
                      </div>

                      {/* Win Reward Callout */}
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/40 px-2.5 py-1 rounded-xl mt-2">
                        <span className="flex items-center space-x-1">
                          <Trophy className="w-3.5 h-3.5 text-amber-400" />
                          <span>Win Reward: {userData.currentBossTier === 2 ? '80' : '75'} OVR Card</span>
                        </span>
                        {hasOwnedStar ? (
                          <span className="text-[10px] text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded flex items-center space-x-0.5">
                            <CheckCircle2 className="w-3 h-3 text-amber-400" />
                            <span>In Roster</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded font-mono">
                            READY TO UNLOCK
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Supporting Squad Indicator */}
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-100 rounded-xl text-xs text-slate-600">
                      <span className="font-medium">Supporting Roster:</span>
                      <span className="font-black text-slate-900 bg-slate-200 px-2 py-0.5 rounded text-[11px]">
                        {aiTeam.restRosterOvr} OVR
                      </span>
                    </div>
                  </div>

                  {/* Battle Launch Action */}
                  <div className="p-4 bg-slate-50">
                    <button
                      onClick={() => handleLaunchLiveBattle(aiTeam)}
                      className={`w-full py-3 px-4 text-white font-display font-black text-xs rounded-xl uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center justify-center space-x-2 ${isBeaten ? 'bg-slate-700 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>{isBeaten ? 'REPLAY MATCH' : 'PLAY MATCH (HARD MODE)'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  )}

      {/* ========================================================================= */}
      {/* TAB: ONLINE MULTIPLAYER MATCHMAKING & LEADERBOARDS                       */}
      {/* ========================================================================= */}
      {activeTab === 'online' && (
        <div className="space-y-6">
          {!user ? (
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center space-y-6 shadow-sm">
              <div className="w-20 h-20 bg-cyan-50 rounded-full flex items-center justify-center mx-auto text-cyan-600">
                <Globe className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black font-display text-slate-900 uppercase">Online H2H Access Required</h3>
                <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                  Sign in to your dynasty account to challenge real players worldwide, earn global rankings, and sync your progress to the cloud.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={login}
                  className="px-8 py-3.5 bg-slate-900 text-white font-display font-black rounded-xl uppercase tracking-wider shadow-lg hover:bg-slate-800 transition cursor-pointer flex items-center space-x-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={login}
                  className="px-8 py-3.5 bg-cyan-600 text-white font-display font-black rounded-xl uppercase tracking-wider shadow-lg hover:bg-cyan-500 transition cursor-pointer flex items-center space-x-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Sign Up Free</span>
                </button>
              </div>
            </div>
          ) : (
            <>
          {/* Online Matchmaking Header Banner */}
          <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-cyan-950 rounded-3xl p-6 sm:p-8 text-white border-2 border-amber-500/50 shadow-xl space-y-6 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-black uppercase">
                  <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>ONLINE (WIP) • FEATURE PAUSED FOR MAINTENANCE</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-wide text-white flex items-center gap-3">
                  <span>Live Head-To-Head Arena</span>
                  <span className="text-xs px-2.5 py-1 bg-amber-500 text-slate-950 font-black rounded-lg uppercase">WIP / Paused</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                  Online H2H matchmaking and live cloud lobby rooms are currently <strong>paused for performance optimization and maintenance</strong>. Check back soon for upgraded matchmaking!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                <div className="bg-slate-900/90 border border-amber-400/40 p-4 rounded-2xl text-center min-w-[120px]">
                  <div className="text-[10px] uppercase font-black text-amber-300">SQUAD OVR</div>
                  <div className="text-2xl font-black font-display text-white">{teamOvrStats.ovr} OVR</div>
                </div>
                <button
                  onClick={handleStartQuickOnlineMatch}
                  className="py-4 px-6 rounded-2xl bg-slate-800 border border-amber-500/40 text-amber-300 hover:bg-slate-700 font-display font-black text-xs sm:text-sm uppercase tracking-wider transition shadow-lg cursor-pointer flex items-center space-x-2"
                >
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>FIND QUICK MATCH (PAUSED)</span>
                </button>
              </div>
            </div>

            {/* Sub-Banner Information Card */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 uppercase block mb-0.5">Online H2H Temporarily Offline (WIP)</span>
                Single-player features (AI Battles, Wave Bosses, Solo Card Packs, Roster Management, and the Auction House) remain 100% playable and fully active.
              </div>
            </div>
          </div>

          {/* Active Online Room Lobby Card (If Host or Joined) */}
          {onlineRoom ? (
            <div className="bg-slate-900 border-2 border-cyan-400 rounded-3xl p-6 sm:p-7 text-white shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-3">
                  <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping inline-block" />
                  <div>
                    <h3 className="text-xl font-black font-display text-cyan-300 uppercase flex items-center flex-wrap gap-2">
                      <span>QUICK MATCH LOBBY: {onlineRoom.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-mono ${onlineRoom.guestUserId ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                        {onlineRoom.guestUserId ? '2 / 2 PLAYERS IN LOBBY (READY)' : '1 / 2 PLAYERS IN LOBBY (WAITING FOR OPPONENT)'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      {onlineRoom.guestUserId ? 'Opponent connected! Click Kickoff to start the online battle.' : 'Searching for rival players via Quick Match... When another player clicks Quick Match or joins from the lobby list, they will enter your room.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(onlineRoom.id);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-bold flex items-center space-x-1.5 transition"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'COPIED CODE!' : 'COPY CODE'}</span>
                  </button>

                  <button
                    onClick={handleLeaveOnlineRoom}
                    className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold transition cursor-pointer"
                  >
                    LEAVE ROOM
                  </button>
                </div>
              </div>

              {/* SELECT KICKOFF POSSESSION ROLE (HOST-ONLY CONTROL) */}
              {(() => {
                const isLobbyHost = onlineRoom.hostUserId === getOnlineUserId();
                const hostRole = onlineRoom.hostKickoffRole || onlineKickoffRole;

                return (
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <div className="text-xs font-black uppercase text-slate-300 font-display flex items-center justify-between">
                      <span>KICKOFF POSSESSION ROLE:</span>
                      <span className="text-[10px] text-cyan-400 font-mono">
                        {isLobbyHost
                          ? hostRole === 'offense'
                            ? '🏈 HOST RECEIVES (OFFENSE FIRST)'
                            : '🛡️ HOST KICKS OFF (DEFENSE FIRST)'
                          : hostRole === 'offense'
                          ? '🛡️ HOST RECEIVES • YOU DEFEND FIRST'
                          : '🏈 HOST KICKS OFF • YOU RECEIVE FIRST'}
                      </span>
                    </div>

                    {isLobbyHost ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setOnlineKickoffRole('offense');
                            updateRoomHostKickoffRole(onlineRoom.id, 'offense');
                          }}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-black uppercase transition flex items-center justify-center space-x-2 cursor-pointer ${
                            hostRole === 'offense'
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-md'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span>🏈 RECEIVE (OFFENSE)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOnlineKickoffRole('defense');
                            updateRoomHostKickoffRole(onlineRoom.id, 'defense');
                          }}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-black uppercase transition flex items-center justify-center space-x-2 cursor-pointer ${
                            hostRole === 'defense'
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow-md'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span>🛡️ KICK OFF (DEFENSE)</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-center justify-between">
                        <span className="flex items-center space-x-2 font-mono">
                          <span className="text-slate-400">🔒 Lobby host choice:</span>
                          <strong className="text-cyan-300 uppercase">
                            {hostRole === 'offense' ? 'Host Receives (You Defend First)' : 'Host Kicks Off (You Receive First)'}
                          </strong>
                        </span>
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                          HOST DECISION
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Matchup Slots Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Host Player (Left) */}
                <div className="bg-slate-950 border border-cyan-500/40 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30">
                      👑 HOST PLAYER
                    </span>
                    <span className="text-sm font-black text-cyan-400">{onlineRoom.hostOvr} OVR</span>
                  </div>
                  <h4 className="text-lg font-black font-display text-white">{onlineRoom.hostTeamName}</h4>
                  <div className="text-xs text-slate-400 flex items-center space-x-1">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <span>Star: {onlineRoom.hostStarPlayer}</span>
                  </div>
                </div>

                {/* Guest Challenger (Right) */}
                <div className={`bg-slate-950 border rounded-2xl p-5 space-y-3 ${onlineRoom.guestUserId ? 'border-emerald-500/40' : 'border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${onlineRoom.guestUserId ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                      {onlineRoom.guestUserId ? 'CHALLENGER CONNECTED' : 'WAITING FOR GUEST'}
                    </span>
                    {onlineRoom.guestOvr && <span className="text-sm font-black text-emerald-400">{onlineRoom.guestOvr} OVR</span>}
                  </div>
                  <h4 className="text-lg font-black font-display text-white">
                    {onlineRoom.guestTeamName || 'Searching for online opponent...'}
                  </h4>
                  {onlineRoom.guestStarPlayer ? (
                    <div className="text-xs text-slate-400 flex items-center space-x-1">
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                      <span>Star: {onlineRoom.guestStarPlayer}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 animate-pulse">
                      Give room code <strong className="text-cyan-300">{onlineRoom.id}</strong> to a friend to connect.
                    </div>
                  )}
                </div>
              </div>

              {/* Launch Online Match Button */}
              <div className="pt-2">
                <button
                  onClick={() => handleLaunchOnlineBattle(onlineRoom)}
                  disabled={!onlineRoom.guestUserId}
                  className={`w-full py-4 rounded-2xl font-display font-black text-sm uppercase tracking-wider transition shadow-xl hover:scale-[1.01] flex items-center justify-center space-x-2 ${
                    onlineRoom.guestUserId 
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>{onlineRoom.guestUserId ? 'KICKOFF ONLINE HEAD-TO-HEAD BATTLE' : 'WAITING FOR OPPONENT TO KICKOFF'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* LIVE ACTIVE LOBBY ROOMS BROWSER (POLLING FIREBASE REALTIME / FIRESTORE) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 space-y-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 font-bold shrink-0">
                      <Globe className="w-5 h-5 animate-pulse text-cyan-600" />
                    </div>
                    <div>
                      <h3 className="font-display font-black text-lg text-slate-900 uppercase flex items-center flex-wrap gap-2">
                        <span>Live Active Match Lobbies</span>
                        <span className="text-[10px] bg-cyan-100 text-cyan-800 px-2.5 py-0.5 rounded-full font-mono border border-cyan-300 font-bold">
                          FIREBASE REALTIME POLL
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Real-time active room browser • Join open matches or host your own lobby
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={handleRefreshLobbies}
                      disabled={isPollingLobbies}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-mono transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isPollingLobbies ? 'animate-spin text-cyan-600' : ''}`} />
                      <span>{isPollingLobbies ? 'Polling...' : 'Refresh Lobbies'}</span>
                    </button>
                  </div>
                </div>

                {/* Active Lobbies Grid */}
                {activeLobbies.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-3">
                    <Wifi className="w-8 h-8 text-slate-400 mx-auto animate-bounce" />
                    <div className="space-y-1">
                      <h4 className="font-display font-black text-sm text-slate-800 uppercase">No Active Public Lobbies Right Now</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Click <strong>Find Quick Match</strong> or <strong>Host Private Room</strong> below to open a lobby for rivals to join!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeLobbies.map((room) => {
                      const isCurrentHost = room.hostUserId === getOnlineUserId();
                      const isCurrentGuest = room.guestUserId === getOnlineUserId();
                      const isUserInRoom = isCurrentHost || isCurrentGuest;
                      const isWaiting = room.status === 'waiting';

                      return (
                        <div
                          key={room.id}
                          className={`border-2 rounded-2xl p-4 flex flex-col justify-between space-y-4 transition-all shadow-sm ${
                            isWaiting
                              ? 'bg-slate-900 border-cyan-400/50 text-white hover:border-cyan-300'
                              : 'bg-slate-950 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="space-y-3">
                            {/* Header: Code & Status */}
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-black text-xs text-cyan-300 bg-cyan-950/80 border border-cyan-400/40 px-2.5 py-1 rounded-lg">
                                {room.id}
                              </span>

                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded font-mono ${
                                  isWaiting
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                {isWaiting ? '⏳ Waiting for Opponent' : '⚔️ Match In Progress'}
                              </span>
                            </div>

                            {/* Host Indicator */}
                            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-black text-amber-400 uppercase font-display flex items-center space-x-1">
                                  <span>👑 HOSTING:</span>
                                  <strong className="text-white ml-1">{room.hostTeamName}</strong>
                                </span>
                                <span className="font-mono font-bold text-cyan-400">{room.hostOvr} OVR</span>
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                                <Star className="w-3 h-3 text-amber-400" />
                                <span className="truncate">Star: {room.hostStarPlayer || 'Unspecified'}</span>
                              </div>
                            </div>

                            {/* Guest Status */}
                            <div className="px-3 py-2 bg-slate-900/60 rounded-xl text-xs flex items-center justify-between border border-slate-800/80">
                              <span className="text-slate-400">Challenger:</span>
                              <span className={`font-bold font-mono text-[11px] ${room.guestTeamName ? 'text-emerald-400' : 'text-slate-500 italic'}`}>
                                {room.guestTeamName ? `${room.guestTeamName} (${room.guestOvr} OVR)` : 'Open Spot (Waiting)'}
                              </span>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div>
                            {isUserInRoom ? (
                              <button
                                onClick={() => setOnlineRoom(room)}
                                className="w-full py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center justify-center space-x-1.5"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>RE-ENTER MY LOBBY</span>
                              </button>
                            ) : isWaiting ? (
                              <button
                                onClick={() => handleJoinLobbyFromList(room)}
                                disabled={isSearchingOnline}
                                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-display font-black text-xs uppercase tracking-wider transition shadow cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>JOIN MATCH NOW</span>
                              </button>
                            ) : (
                              <button
                                disabled
                                className="w-full py-2.5 px-3 rounded-xl bg-slate-800 text-slate-500 font-display font-black text-xs uppercase tracking-wider cursor-not-allowed text-center"
                              >
                                MATCH FULL
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Create or Join Friend Room Code Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center space-x-2 text-slate-900 font-display font-black text-lg uppercase">
                    <UserPlus className="w-5 h-5 text-cyan-600" />
                    <span>Host Private Room</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Generate a unique 6-character room code to host a private match against a friend or rival player.
                  </p>
                  <button
                    onClick={handleCreatePrivateLobby}
                    disabled={isSearchingOnline}
                    className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-display font-black text-xs uppercase tracking-wider transition shadow cursor-pointer"
                  >
                    CREATE PRIVATE ROOM
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center space-x-2 text-slate-900 font-display font-black text-lg uppercase">
                    <Radio className="w-5 h-5 text-cyan-600" />
                    <span>Join Friend Room Code</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Enter an existing room code shared by a friend to connect directly into their online lobby.
                  </p>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={joinRoomInput}
                      onChange={(e) => setJoinRoomInput(e.target.value.toUpperCase())}
                      placeholder="E.G. CLASH-8921"
                      maxLength={10}
                      className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-cyan-500 uppercase"
                    />
                    <button
                      onClick={handleJoinPrivateLobby}
                      disabled={isSearchingOnline}
                      className="py-3 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-display font-black text-xs uppercase tracking-wider transition shadow cursor-pointer"
                    >
                      CONNECT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Online Leaderboard */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className="font-display font-black text-lg text-slate-900 uppercase">
                  Global Online Leaderboard
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">FIRESTORE CLOUD SYNCHRONIZED</span>
            </div>

            {isLeaderboardLoading ? (
              <div className="py-12 text-center text-slate-400 font-mono text-xs flex items-center justify-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
                <span>Loading global rankings...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-mono uppercase text-[10px]">
                      <th className="py-2.5 px-3">RANK</th>
                      <th className="py-2.5 px-3">DYNASTY TEAM</th>
                      <th className="py-2.5 px-3">SQUAD OVR</th>
                      <th className="py-2.5 px-3">RECORD (W-L)</th>
                      <th className="py-2.5 px-3">STAR PLAYER</th>
                      <th className="py-2.5 px-3 text-right">GRID IRONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {globalLeaderboard.map((entry, idx) => (
                      <tr key={entry.userId || idx} className="hover:bg-slate-50 font-medium">
                        <td className="py-3.5 px-3">
                          <span className={`px-2 py-0.5 rounded font-mono font-black text-[11px] ${idx === 0 ? 'bg-amber-400 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : idx === 2 ? 'bg-amber-700/30 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-display font-black text-slate-900">{entry.teamName}</td>
                        <td className="py-3.5 px-3 font-mono font-bold text-cyan-600">{entry.userOvr} OVR</td>
                        <td className="py-3.5 px-3 font-mono text-slate-700">{entry.wins}W - {entry.losses}L</td>
                        <td className="py-3.5 px-3 text-slate-600">{entry.starPlayer}</td>
                        <td className="py-3.5 px-3 text-right font-mono font-black text-amber-600">{entry.gridIrons} GI</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AUCTION HOUSE TAB (Prices in Grid Irons)                           */}
      {/* ========================================================================= */}
      {activeTab === 'auctions' && (
        <div className="space-y-6">
          {/* Auction Pricing Rule Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-2.5">
              <Shield className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">Grid Iron Auction Pricing:</span> Cards cost 1 Grid Iron per 10 overall (e.g. 50-59 OVR = 5 GI, 60-69 OVR = 6 GI, 70-79 OVR = 7 GI, 80-88 OVR = 8 GI, <strong>89 OVR = 10 GI</strong>).
              </div>
            </div>
            <span className="font-mono font-bold text-amber-700 shrink-0 hidden sm:inline">
              Balance: {userData.gridIrons} GI
            </span>
          </div>

          {/* Auction Market Mode Subtabs */}
          <div className="flex bg-slate-100 rounded-2xl p-1 border border-slate-200 shadow-sm max-w-md">
            <button
              onClick={() => setAuctionSubTab('standard')}
              className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                auctionSubTab === 'standard'
                  ? 'bg-slate-900 text-white shadow-md font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => {
                setAuctionSubTab('online');
                loadAuctions();
              }}
              className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center space-x-1.5 ${
                auctionSubTab === 'online'
                  ? 'bg-slate-900 text-white shadow-md font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Online</span>
            </button>
          </div>

          {/* Auction Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search Bar */}
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search player, team, position..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Position Filter */}
              <div>
                <select
                  value={posFilter}
                  onChange={(e) => setPosFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">All Positions</option>
                  <option value="OFFENSE">All Offense</option>
                  <option value="DEFENSE">All Defense</option>
                  <option value="QB">QB - Quarterback</option>
                  <option value="RB">RB - Running Back</option>
                  <option value="WR">WR - Wide Receiver</option>
                  <option value="TE">TE - Tight End</option>
                  <option value="OT">OT - Offensive Tackle</option>
                  <option value="OG">OG - Offensive Guard</option>
                  <option value="C">C - Center</option>
                  <option value="EDGE">EDGE - Pass Rusher</option>
                  <option value="DT">DT - Defensive Tackle</option>
                  <option value="MLB">MLB - Middle Linebacker</option>
                  <option value="CB">CB - Cornerback</option>
                  <option value="FS">FS - Free Safety</option>
                  <option value="SS">SS - Strong Safety</option>
                  <option value="K">K - Kicker</option>
                </select>
              </div>

              {/* Tier Filter */}
              <div>
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">All Card Tiers</option>
                  <option value="diamond">💎 Diamond (88-89 OVR)</option>
                  <option value="elite">🔥 Elite (82-87 OVR)</option>
                  <option value="gold">⭐ Gold (76-81 OVR)</option>
                  <option value="silver">🥈 Silver (68-75 OVR)</option>
                  <option value="bronze">🥉 Bronze (&lt;68 OVR)</option>
                </select>
              </div>

              {/* Sort Option */}
              <div>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ovr_desc">Rating: Highest First</option>
                  <option value="ovr_asc">Rating: Lowest First</option>
                  <option value="price_asc">Price: Lowest First</option>
                  <option value="price_desc">Price: Highest First</option>
                  <option value="name_asc">Name: A to Z</option>
                </select>
              </div>
            </div>

            {/* Quick Position Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
              {['ALL', 'QB', 'RB', 'WR', 'TE', 'EDGE', 'DT', 'MLB', 'CB', 'FS', 'SS', 'K'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPosFilter(p)}
                  className={`px-3 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer shrink-0 ${
                    posFilter === p
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Auction Cards Grid */}
          {isAuctionsLoading ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-24 text-center space-y-4">
              <RefreshCw className="w-10 h-10 animate-spin text-emerald-600 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800 font-display uppercase">Loading Shared Market</h3>
                <p className="text-xs text-slate-500">
                  Connecting to Firestore live auctions database...
                </p>
              </div>
            </div>
          ) : filteredAuctions.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800 font-display uppercase">No Cards Found</h3>
                <p className="text-xs text-slate-500">
                  Try adjusting your search filters or click "Refresh Market" to generate fresh listings.
                </p>
              </div>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPosFilter('ALL');
                  setTierFilter('ALL');
                  setTeamFilter('ALL');
                }}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredAuctions.map((listing) => {
                const { card } = listing;
                const tierStyles = getTierColor(card.tier);
                const canAfford = userData.gridIrons >= listing.buyNowPrice;

                return (
                  <div
                    key={listing.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    {/* Visual Madden-Style Card Container */}
                    <div
                      onClick={() => setInspectedCard(card)}
                      className={`relative p-4 bg-gradient-to-br ${tierStyles.bg} text-white cursor-pointer border-b ${tierStyles.border}`}
                    >
                      {/* Top Bar: OVR & Position */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-black shadow ${tierStyles.badge}`}>
                            {card.ovr}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                            {card.position}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {auctionSubTab === 'online' && listing.sellerUserId === getOnlineUserId() && (
                            <span className="text-[9px] uppercase font-black tracking-wider text-amber-950 bg-amber-400 px-2 py-0.5 rounded-full shadow-xs">
                              YOUR LISTING
                            </span>
                          )}
                          <span className="text-[10px] uppercase font-bold text-slate-300 bg-black/40 px-2 py-0.5 rounded-full">
                            {card.teamId}
                          </span>
                        </div>
                      </div>

                      {/* Player Name & College */}
                      <div className="mt-6 mb-3 space-y-0.5">
                        <h4 className="font-display font-black text-base uppercase tracking-wide truncate text-white drop-shadow">
                          {card.name}
                        </h4>
                        {card.abilityName && (
                          <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black uppercase shadow-sm border border-amber-300">
                            <Zap className="w-3 h-3 fill-current" />
                            <span className="truncate">{card.abilityName}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-300 truncate font-medium">
                          {card.archetype} • {card.college}
                        </div>
                      </div>

                      {/* Stat Badges */}
                      <div className="grid grid-cols-4 gap-1 pt-2 border-t border-white/10 text-center">
                        <div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">SPD</div>
                          <div className="text-xs font-black">{card.speed}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">STR</div>
                          <div className="text-xs font-black">{card.strength}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">AGI</div>
                          <div className="text-xs font-black">{card.agility}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">AWR</div>
                          <div className="text-xs font-black">{card.awareness}</div>
                        </div>
                      </div>
                    </div>

                    {/* Auction Listing Info & Buy Action in Grid Irons */}
                    <div className="p-3.5 space-y-3 bg-slate-50 flex-1 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        {(() => {
                          const timerInfo = formatTimeRemaining(listing.expiresAt, listing.listedAt, listing.timeLeftMinutes);
                          return (
                            <span className={`flex items-center space-x-1 font-bold ${
                              timerInfo.isExpired 
                                ? 'text-rose-600 animate-pulse' 
                                : timerInfo.isUrgent 
                                ? 'text-amber-600 font-mono font-black' 
                                : 'text-slate-600 font-mono'
                            }`}>
                              <Clock className={`w-3.5 h-3.5 ${timerInfo.isUrgent ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
                              <span>{timerInfo.label}</span>
                            </span>
                          );
                        })()}
                        <span className="truncate max-w-[95px] text-slate-400 text-right">
                          {auctionSubTab === 'online' && listing.sellerUserId === getOnlineUserId() ? (
                            <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">You</span>
                          ) : (
                            listing.seller
                          )}
                        </span>
                      </div>

                      <div className="space-y-2 pt-1 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Price:</span>
                          <div className="flex items-center space-x-1 text-amber-700 font-black font-display text-sm">
                            <Shield className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                            <span>{listing.buyNowPrice} Grid Iron{listing.buyNowPrice > 1 ? 's' : ''}</span>
                          </div>
                        </div>

                        {auctionSubTab === 'online' && listing.sellerUserId === getOnlineUserId() ? (
                          <button
                            type="button"
                            onClick={() => handleCancelAuction(listing)}
                            className="w-full py-2 px-3 rounded-xl font-display font-black text-xs uppercase tracking-wider bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs active:scale-98"
                            title="Cancel this listing and reclaim player card"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>CANCEL &amp; RECLAIM</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (!user) {
                                showToast('⚠️ Please Sign In or Sign Up to buy cards from the Auction House!');
                                return;
                              }
                              const timerInfo = formatTimeRemaining(listing.expiresAt, listing.listedAt, listing.timeLeftMinutes);
                              if (timerInfo.isExpired) {
                                showToast('⏰ This auction timer has expired and is being removed.');
                                return;
                              }
                              setSelectedCardToBuy(listing);
                            }}
                            disabled={!canAfford}
                            className={`w-full py-2 px-3 rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                              canAfford
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>{canAfford ? 'BUY NOW' : 'NEED GRID IRONS'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ACTIVE ROSTER / STARTING LINEUP TAB (Full 60 OVR Starters)         */}
      {/* ========================================================================= */}
      {activeTab === 'roster' && (
        <div className="space-y-8">
          {/* Team Rating Header Banner */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
                  STARTING 24 SQUAD
                </span>
                <span className="text-xs text-slate-400">Foundation 60 OVR Lineup + Upgrades</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl sm:text-3xl font-black font-display text-slate-900 uppercase">
                  {userData.teamName} Lineup
                </h2>
                <button
                  onClick={() => {
                    setTeamNameInput(userData.teamName);
                    setIsEditingTeamName(true);
                  }}
                  className="px-3 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
                  title="Change team name"
                >
                  <Pencil className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Rename Team</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 max-w-xl">
                Click any position card to swap with players purchased from the Auction House.
              </p>
            </div>

            {/* Ratings Badges */}
            <div className="flex items-center space-x-4 shrink-0">
              <div className="p-4 rounded-2xl bg-slate-900 text-white text-center min-w-[90px] shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">TEAM OVR</div>
                <div className="text-3xl font-black font-display text-amber-400">{teamOvrStats.ovr}</div>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center min-w-[90px]">
                <div className="text-[10px] uppercase font-bold text-emerald-800">OFFENSE</div>
                <div className="text-3xl font-black font-display text-emerald-900">{teamOvrStats.off}</div>
              </div>
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-center min-w-[90px]">
                <div className="text-[10px] uppercase font-bold text-blue-800">DEFENSE</div>
                <div className="text-3xl font-black font-display text-blue-900">{teamOvrStats.def}</div>
              </div>
            </div>
          </div>

          {/* Group 1: Offense Starters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Flame className="w-5 h-5 text-emerald-600" />
                <h3 className="font-display font-extrabold text-lg text-slate-900 uppercase tracking-wide">
                  Starting Offense
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-400">11 Active Positions</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
              {startingCards
                .filter((s) => s.slot.group === 'OFF')
                .map(({ slot, card }) => {
                  const tierStyles = getTierColor(card.tier);
                  const availableUpgrades = userData.roster.filter(
                    (c) => c.position === slot.position && c.id !== card.id && c.ovr > card.ovr
                  );

                  return (
                    <div
                      key={slot.id}
                      onClick={() => setSwapModalSlot(slot)}
                      className={`relative rounded-2xl border p-3.5 flex flex-col justify-between transition-all cursor-pointer group bg-gradient-to-br ${
                        tierStyles.bg
                      } text-white ${tierStyles.border} shadow-sm hover:shadow-md hover:scale-[1.02]`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 bg-black/40 px-2 py-0.5 rounded">
                          {slot.id}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-black ${tierStyles.badge}`}>
                          {card.ovr} OVR
                        </span>
                      </div>

                      <div className="my-3 space-y-0.5">
                        <h4 className="font-display font-black text-sm uppercase truncate text-white">
                          {card.name}
                        </h4>
                        <div className="text-[10px] text-slate-300 truncate font-medium">
                          {card.teamName}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">SPD {card.speed} • STR {card.strength}</span>
                        {availableUpgrades.length > 0 ? (
                          <span className="text-amber-300 font-bold flex items-center space-x-0.5">
                            <Star className="w-3 h-3 fill-amber-300" />
                            <span>+{availableUpgrades[0].ovr - card.ovr}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 group-hover:text-white">Swap</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Group 2: Defense Starters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h3 className="font-display font-extrabold text-lg text-slate-900 uppercase tracking-wide">
                  Starting Defense
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-400">11 Active Positions</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
              {startingCards
                .filter((s) => s.slot.group === 'DEF')
                .map(({ slot, card }) => {
                  const tierStyles = getTierColor(card.tier);
                  const availableUpgrades = userData.roster.filter(
                    (c) => c.position === slot.position && c.id !== card.id && c.ovr > card.ovr
                  );

                  return (
                    <div
                      key={slot.id}
                      onClick={() => setSwapModalSlot(slot)}
                      className={`relative rounded-2xl border p-3.5 flex flex-col justify-between transition-all cursor-pointer group bg-gradient-to-br ${
                        tierStyles.bg
                      } text-white ${tierStyles.border} shadow-sm hover:shadow-md hover:scale-[1.02]`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 bg-black/40 px-2 py-0.5 rounded">
                          {slot.id}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-black ${tierStyles.badge}`}>
                          {card.ovr} OVR
                        </span>
                      </div>

                      <div className="my-3 space-y-0.5">
                        <h4 className="font-display font-black text-sm uppercase truncate text-white">
                          {card.name}
                        </h4>
                        <div className="text-[10px] text-slate-300 truncate font-medium">
                          {card.teamName}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">SPD {card.speed} • AWR {card.awareness}</span>
                        {availableUpgrades.length > 0 ? (
                          <span className="text-amber-300 font-bold flex items-center space-x-0.5">
                            <Star className="w-3 h-3 fill-amber-300" />
                            <span>+{availableUpgrades[0].ovr - card.ovr}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 group-hover:text-white">Swap</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Group 3: Special Teams Starters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="font-display font-extrabold text-lg text-slate-900 uppercase tracking-wide">
                  Special Teams
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-400">2 Active Positions</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
              {startingCards
                .filter((s) => s.slot.group === 'ST')
                .map(({ slot, card }) => {
                  const tierStyles = getTierColor(card.tier);
                  return (
                    <div
                      key={slot.id}
                      onClick={() => setSwapModalSlot(slot)}
                      className={`relative rounded-2xl border p-3.5 flex flex-col justify-between transition-all cursor-pointer group bg-gradient-to-br ${
                        tierStyles.bg
                      } text-white ${tierStyles.border} shadow-sm hover:shadow-md hover:scale-[1.02]`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 bg-black/40 px-2 py-0.5 rounded">
                          {slot.id}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-black ${tierStyles.badge}`}>
                          {card.ovr} OVR
                        </span>
                      </div>

                      <div className="my-3 space-y-0.5">
                        <h4 className="font-display font-black text-sm uppercase truncate text-white">
                          {card.name}
                        </h4>
                        <div className="text-[10px] text-slate-300 truncate font-medium">
                          {card.teamName}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">STR {card.strength}</span>
                        <span className="text-slate-400 group-hover:text-white">Swap</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CARD BINDER / INVENTORY COLLECTION                                 */}
      {/* ========================================================================= */}
      {activeTab === 'binder' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-display font-extrabold text-lg text-slate-900 uppercase">
                Card Collection Binder
              </h3>
              <p className="text-xs text-slate-500">
                All players owned in your club ({userData.roster.length} total cards).
              </p>
            </div>
            
            <div className="flex-1 max-w-sm relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search binder..."
                value={binderSearchQuery}
                onChange={(e) => setBinderSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="text-xs text-slate-500 text-right">
              Click any card to inspect or quick-sell.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredBinderCards
              .map((card) => {
                const isEquipped = Object.values(userData.startingLineup).includes(card.id);
                const tierStyles = getTierColor(card.tier);

                return (
                  <div
                    key={card.id}
                    onClick={() => setInspectedCard(card)}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                  >
                    <div className={`p-4 bg-gradient-to-br ${tierStyles.bg} text-white border-b ${tierStyles.border}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-black shadow ${tierStyles.badge}`}>
                            {card.ovr}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                            {card.position}
                          </span>
                        </div>
                        {isEquipped && (
                          <span className="text-[10px] uppercase font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full shadow">
                            STARTER
                          </span>
                        )}
                      </div>

                      <div className="mt-5 mb-2 space-y-0.5">
                        <h4 className="font-display font-black text-base uppercase tracking-wide truncate text-white">
                          {card.name}
                        </h4>
                        {card.abilityName && (
                          <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black uppercase shadow-sm border border-amber-300">
                            <Zap className="w-3 h-3 fill-current" />
                            <span className="truncate">{card.abilityName}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-300 truncate font-medium">
                          {card.teamName}
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1 pt-2 border-t border-white/10 text-center text-xs">
                        <div>
                          <div className="text-[8px] text-slate-400 font-bold uppercase">SPD</div>
                          <div className="font-bold">{card.speed}</div>
                        </div>
                        <div>
                          <div className="text-[8px] text-slate-400 font-bold uppercase">STR</div>
                          <div className="font-bold">{card.strength}</div>
                        </div>
                        <div>
                          <div className="text-[8px] text-slate-400 font-bold uppercase">AGI</div>
                          <div className="font-bold">{card.agility}</div>
                        </div>
                        <div>
                          <div className="text-[8px] text-slate-400 font-bold uppercase">AWR</div>
                          <div className="font-bold">{card.awareness}</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">
                        {card.ovr === 60 ? 'Default Starter' : 'Purchased Auction'}
                      </span>
                      <span className="text-emerald-700 font-bold group-hover:underline">
                        Details &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CARD PACKS SHOP (Wayne Garrett Pack & Cam Newton Pack)             */}
      {/* ========================================================================= */}
      {activeTab === 'packs' && (
        <div className="space-y-8">
          {/* Quick Code Claim Banner - Only visible to privileged account */}
          {user.email === 'shannongarret69@gmail.com' && (
            <div className="bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-cyan-500/15 border-2 border-amber-400/50 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow">
                  🎁
                </div>
                <div>
                  <h4 className="font-display font-black text-sm uppercase text-slate-900">
                    Locker Code Tester (+2,000 Grid Irons)
                  </h4>
                  <p className="text-xs text-slate-600">
                    Need extra currency for computer save testing? Enter code <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono font-bold text-slate-900">GRIDIRON2000</code> or claim instantly below!
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => handleRedeemCode('GRIDIRON2000')}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-display font-black text-xs uppercase tracking-wider rounded-xl shadow transition cursor-pointer border border-amber-300"
                >
                  +2,000 GI Quick Claim
                </button>
                <button
                  onClick={() => setIsRedeemModalOpen(true)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-display font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Enter Code
                </button>
              </div>
            </div>
          )}

          {/* PACKS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* PACK 1 (FEATURED AT TOP): Essentials Pack (Random 89 Bosses - Wave 1 & Wave 2) [TAKES UP 2 SPOTS] */}
            <div className="md:col-span-2 lg:col-span-2 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white border-2 border-emerald-400/60 shadow-2xl flex flex-col justify-between space-y-6 relative overflow-hidden ring-4 ring-emerald-500/20">
              <div className="absolute top-0 right-0 bg-emerald-400 text-slate-950 px-5 py-1.5 rounded-bl-3xl text-xs font-black font-mono tracking-wider shadow">
                ⭐ FEATURED PACK • WAVE 1 &amp; WAVE 2 89 BOSSES
              </div>

              <div className="space-y-3">
                <span className="px-3 py-1 rounded-lg bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black uppercase tracking-wider inline-block">
                  ALL-STAR ESSENTIALS (FEATURED)
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-wide text-white flex items-center space-x-2">
                  <span>Essentials Pack</span>
                  <span className="text-xs bg-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/40 font-mono">5 GI Only!</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Contains 10 players featuring chances at <strong className="text-emerald-300">ANY 89 OVR AI Battle Boss from Wave 1 &amp; Wave 2</strong> (Purdy, CeeDee, Henry, Kelce, Garrett, Hutchinson, Hurts, Adams, Diggs, Hall, Crosby, Mahomes, Allen, Jefferson, etc.), plus <strong className="text-emerald-300">75 OVR Starters</strong> and <strong className="text-emerald-300">65 OVR Backups</strong> at half the price!
                </p>

                {/* Drop Odds pill tags */}
                <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                  <div className="bg-emerald-400/10 border border-emerald-400/40 rounded-xl p-2.5">
                    <div className="text-emerald-300 font-bold">ALL 89 BOSSES</div>
                    <div className="text-white font-black truncate">Wave 1 &amp; Wave 2</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                    <div className="text-emerald-400 font-bold">20% CHANCE</div>
                    <div className="text-white font-black truncate">75 OVR Starters</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                    <div className="text-slate-400 font-bold">75% CHANCE</div>
                    <div className="text-white font-black truncate">65 OVR Backups</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-emerald-400/40 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-black text-emerald-300">FEATURED SPECIAL PRICE</div>
                  <div className="text-2xl font-black font-display text-white">5 GRID IRONS</div>
                </div>
                <button
                  onClick={() => handleOpenPack('essentials')}
                  disabled={userData.gridIrons < 5}
                  className={`py-3 px-8 rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider transition shadow-lg cursor-pointer ${
                    userData.gridIrons >= 5
                      ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 hover:scale-105'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {userData.gridIrons >= 5 ? 'OPEN ESSENTIALS (5 GI)' : 'NEED 5 GI'}
                </button>
              </div>
            </div>

            {/* PACK 2: San Fran Future HoFers Pack (Diamond 95 CMC + Diamond 90 Trent Williams) */}
            <div className="bg-gradient-to-br from-slate-950 via-[#AA0000]/40 to-slate-900 rounded-3xl p-6 sm:p-7 text-white border-2 border-red-500/60 shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-red-500 text-white px-4 py-1 rounded-bl-2xl text-[11px] font-black font-mono tracking-wider shadow">
                💎 95 CMC + 💎 90 TRENT
              </div>

              <div className="space-y-3">
                <span className="px-3 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-black uppercase tracking-wider inline-block">
                  SAN FRAN FUTURE HOFERS
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-wide text-white">
                  San Fran Future HoFers
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Contains 10 players featuring chances at <strong className="text-cyan-300 font-bold">Diamond 95 OVR RB Christian McCaffrey</strong> with <strong className="text-amber-300">Not Lost Yet</strong> (gains a rush worth a first down on 4th down if last rush was &lt; 3 yards) and <strong className="text-cyan-300 font-bold">Diamond 90 OVR LT Trent Williams</strong> with <strong className="text-amber-300">It Takes 2</strong> (doubles stats &amp; acts as double team against 90+ OVR D-linemen).
                </p>

                {/* Drop Odds pill tags */}
                <div className="grid grid-cols-4 gap-1 pt-2 text-center text-[9px]">
                  <div className="bg-red-500/15 border border-red-400/40 rounded-xl p-1.5">
                    <div className="text-red-300 font-bold">1.5%</div>
                    <div className="text-white font-black truncate">💎 95 CMC</div>
                  </div>
                  <div className="bg-amber-500/15 border border-amber-400/40 rounded-xl p-1.5">
                    <div className="text-amber-300 font-bold">2.0%</div>
                    <div className="text-white font-black truncate">💎 90 Trent</div>
                  </div>
                  <div className="bg-emerald-500/15 border border-emerald-400/40 rounded-xl p-1.5">
                    <div className="text-emerald-300 font-bold">20%</div>
                    <div className="text-white font-black truncate">75 Starters</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-1.5">
                    <div className="text-slate-300 font-bold">76.5%</div>
                    <div className="text-white font-black truncate">65 Backups</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-red-500/40 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-black text-red-300">PRICE</div>
                  <div className="text-2xl font-black font-display text-white">10 GRID IRONS</div>
                </div>
                <button
                  onClick={() => handleOpenPack('sf_hofers')}
                  disabled={userData.gridIrons < 10}
                  className={`py-3 px-5 rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider transition shadow-lg cursor-pointer ${
                    userData.gridIrons >= 10
                      ? 'bg-red-500 hover:bg-red-400 text-white hover:scale-105'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {userData.gridIrons >= 10 ? 'OPEN SF PACK (10 GI)' : 'NEED 10 GI'}
                </button>
              </div>
            </div>

            {/* PACK 3: 2010s Kansas City Dynasty Pack (RIGHT NEXT TO SAN FRAN PACK) */}
            <div className="bg-gradient-to-br from-[#E31837] via-slate-900 to-[#FFB81C]/20 rounded-3xl p-6 sm:p-7 text-white border-2 border-[#FFB81C]/60 shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#FFB81C] text-slate-950 px-4 py-1 rounded-bl-2xl text-[11px] font-black font-mono tracking-wider shadow">
                95 WR HILL + 90 TE KELCE
              </div>

              <div className="space-y-3">
                <span className="px-3 py-1 rounded-lg bg-[#FFB81C]/20 text-[#FFB81C] border border-[#FFB81C]/40 text-[10px] font-black uppercase tracking-wider inline-block">
                  KC DYNASTY LEGENDS
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-wide text-white">
                  KC Dynasty Pack
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Contains 10 players from the Chiefs Dynasty! Chance at <strong>95 Tyreek Hill</strong> (Too Fast!), <strong>90 Travis Kelce</strong> (Jump Ball), and <strong>90 Chris Jones</strong> (Double Me), plus <strong>75 OVR Chiefs</strong> and <strong>65 OVR Backups</strong>.
                </p>

                {/* Drop Odds pill tags */}
                <div className="grid grid-cols-4 gap-1 pt-2 text-center text-[9px]">
                  <div className="bg-[#FFB81C]/15 border border-[#FFB81C]/40 rounded-xl p-1.5">
                    <div className="text-[#FFB81C] font-bold">1.6%</div>
                    <div className="text-white font-black truncate">95 Hill</div>
                  </div>
                  <div className="bg-[#FFB81C]/15 border border-[#FFB81C]/40 rounded-xl p-1.5">
                    <div className="text-[#FFB81C] font-bold">1.6%</div>
                    <div className="text-white font-black truncate">90 Kelce</div>
                  </div>
                  <div className="bg-[#FFB81C]/15 border border-[#FFB81C]/40 rounded-xl p-1.5">
                    <div className="text-[#FFB81C] font-bold">1.6%</div>
                    <div className="text-white font-black truncate">90 Jones</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-1.5">
                    <div className="text-slate-300 font-bold">95.2%</div>
                    <div className="text-white font-black truncate">KC Roster</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-[#FFB81C]/40 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-black text-[#FFB81C]">PRICE</div>
                  <div className="text-2xl font-black font-display text-white">10 GRID IRONS</div>
                </div>
                <button
                  onClick={() => handleOpenPack('kc_dynasty')}
                  disabled={userData.gridIrons < 10}
                  className={`py-3 px-5 rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider transition shadow-lg cursor-pointer ${
                    userData.gridIrons >= 10
                      ? 'bg-[#FFB81C] hover:bg-[#ffc642] text-slate-950 hover:scale-105'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {userData.gridIrons >= 10 ? 'OPEN KC PACK (10 GI)' : 'NEED 10 GI'}
                </button>
              </div>
            </div>

            {/* PACK 4: Colts Legends Pack (99 Pat McAfee P + 99 Andrew Luck QB) */}
            <div className="bg-gradient-to-br from-slate-950 via-[#002C6C] to-indigo-950 rounded-3xl p-6 sm:p-7 text-white border-2 border-indigo-400/60 shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-indigo-400 text-slate-950 px-4 py-1 rounded-bl-2xl text-[11px] font-black font-mono tracking-wider shadow">
                99 P MCAFEE + 99 QB LUCK
              </div>

              <div className="space-y-3">
                <span className="px-3 py-1 rounded-lg bg-indigo-400/20 text-indigo-300 border border-indigo-400/40 text-[10px] font-black uppercase tracking-wider inline-block">
                  COLTS DUAL LEGENDS PACK
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-wide text-white">
                  Colts Legends Pack
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Contains 10 players featuring a chance at TWO 99 OVR Game Breakers: <strong className="text-blue-300">Pat McAfee (99 Punter)</strong> with <strong className="text-indigo-300">1 Yard line</strong> (punts always land at the 1 yard line) and <strong className="text-blue-300">Andrew Luck (99 QB)</strong> with <strong className="text-indigo-300">Composure</strong> (can never be sacked, always finds an open receiver or throws it away)!
                </p>

                {/* Drop Odds pill tags */}
                <div className="grid grid-cols-4 gap-1 pt-2 text-center text-[9px]">
                  <div className="bg-indigo-500/20 border border-indigo-400/40 rounded-xl p-1.5">
                    <div className="text-indigo-300 font-bold">1.25%</div>
                    <div className="text-white font-black truncate">99 McAfee</div>
                  </div>
                  <div className="bg-blue-500/20 border border-blue-400/40 rounded-xl p-1.5">
                    <div className="text-blue-300 font-bold">1.25%</div>
                    <div className="text-white font-black truncate">99 Luck</div>
                  </div>
                  <div className="bg-emerald-500/15 border border-emerald-400/40 rounded-xl p-1.5">
                    <div className="text-emerald-300 font-bold">20%</div>
                    <div className="text-white font-black truncate">75 Starters</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-1.5">
                    <div className="text-slate-300 font-bold">77.5%</div>
                    <div className="text-white font-black truncate">65 Backups</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-indigo-400/40 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-black text-indigo-300">PRICE</div>
                  <div className="text-2xl font-black font-display text-white">10 GRID IRONS</div>
                </div>
                <button
                  onClick={() => handleOpenPack('colts_legends')}
                  disabled={userData.gridIrons < 10}
                  className={`py-3 px-5 rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider transition shadow-lg cursor-pointer ${
                    userData.gridIrons >= 10
                      ? 'bg-indigo-400 hover:bg-indigo-300 text-slate-950 hover:scale-105'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {userData.gridIrons >= 10 ? 'OPEN COLTS (10 GI)' : 'NEED 10 GI'}
                </button>
              </div>
            </div>

            {/* PACK 5: Seattle Pack (100% Seahawks, 99 JSN, 85 Sam Darnold) */}
            <div className="bg-gradient-to-br from-slate-950 via-[#002244] to-[#69BE28]/30 rounded-3xl p-6 sm:p-7 text-white border-2 border-[#69BE28]/60 shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#69BE28] text-slate-950 px-4 py-1 rounded-bl-2xl text-[11px] font-black font-mono tracking-wider shadow">
                99 WR + 85 QB DARNOLD
              </div>

              <div className="space-y-3">
                <span className="px-3 py-1 rounded-lg bg-[#69BE28]/20 text-[#69BE28] border border-[#69BE28]/40 text-[10px] font-black uppercase tracking-wider inline-block">
                  ALL-SEAHAWKS PACK
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-wide text-white">
                  Seattle Pack
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Contains 10 <strong>Seattle Seahawks players only</strong>! Features a chance at <strong className="text-[#69BE28]">Jaxon Smith-Njigba (99 OVR)</strong> with the game-breaking <strong className="text-emerald-400">Emerald City Route Artist</strong> ability, <strong>85 OVR QB Sam Darnold</strong>, <strong>75 OVR Starters</strong>, and <strong>65 OVR Backups</strong>!
                </p>

                {/* Drop Odds pill tags */}
                <div className="grid grid-cols-4 gap-1 pt-2 text-center text-[9px]">
                  <div className="bg-[#69BE28]/15 border border-[#69BE28]/40 rounded-xl p-1.5">
                    <div className="text-[#69BE28] font-bold">2.5%</div>
                    <div className="text-white font-black truncate">99 JSN</div>
                  </div>
                  <div className="bg-cyan-500/15 border border-cyan-400/40 rounded-xl p-1.5">
                    <div className="text-cyan-300 font-bold">12.5%</div>
                    <div className="text-white font-black truncate">85 Darnold</div>
                  </div>
                  <div className="bg-emerald-500/15 border border-emerald-400/40 rounded-xl p-1.5">
                    <div className="text-emerald-300 font-bold">30%</div>
                    <div className="text-white font-black truncate">75 Starters</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-1.5">
                    <div className="text-slate-300 font-bold">55%</div>
                    <div className="text-white font-black truncate">65 Backups</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-[#69BE28]/40 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-black text-[#69BE28]">PRICE</div>
                  <div className="text-2xl font-black font-display text-white">10 GRID IRONS</div>
                </div>
                <button
                  onClick={() => handleOpenPack('seattle')}
                  disabled={userData.gridIrons < 10}
                  className={`py-3 px-5 rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider transition shadow-lg cursor-pointer ${
                    userData.gridIrons >= 10
                      ? 'bg-[#69BE28] hover:bg-[#78d630] text-slate-950 hover:scale-105'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {userData.gridIrons >= 10 ? 'OPEN SEATTLE (10 GI)' : 'NEED 10 GI'}
                </button>
              </div>
            </div>

            {/* PACK 6: Cam Newton Game Breaker Pack */}
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 rounded-3xl p-6 sm:p-7 text-white border-2 border-cyan-400/50 shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-cyan-400 text-slate-950 px-4 py-1 rounded-bl-2xl text-[11px] font-black font-mono tracking-wider">
                99 OVR QB GAME BREAKER
              </div>

              <div className="space-y-3">
                <span className="px-3 py-1 rounded-lg bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 text-[10px] font-black uppercase tracking-wider inline-block">
                  GAME BREAKER QB PACK
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-wide text-white">
                  Cam Newton Pack
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Contains 10 players featuring a 2.5% chance at <strong>Cam Newton (99 OVR)</strong> with the game-breaking <strong className="text-cyan-400">Ignore the odds</strong> ability (after a 30+ yard throw, next pass has 100% big play guarantee), plus <strong>Offensive &amp; Defensive Linemen</strong>.
                </p>

                {/* Drop Odds pill tags */}
                <div className="grid grid-cols-3 gap-1.5 pt-2 text-center text-[10px]">
                  <div className="bg-cyan-400/10 border border-cyan-400/30 rounded-xl p-2">
                    <div className="text-cyan-300 font-bold">2.5% CHANCE</div>
                    <div className="text-white font-black text-xs truncate">99 Cam Newton</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2">
                    <div className="text-emerald-400 font-bold">20% CHANCE</div>
                    <div className="text-white font-black text-xs truncate">75 OVR + OL/DL</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2">
                    <div className="text-slate-400 font-bold">77.5% CHANCE</div>
                    <div className="text-white font-black text-xs truncate">65 OVR Backups</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-cyan-400/40 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-black text-cyan-300">PRICE</div>
                  <div className="text-2xl font-black font-display text-white">10 GRID IRONS</div>
                </div>
                <button
                  onClick={() => handleOpenPack('cam_newton')}
                  disabled={userData.gridIrons < 10}
                  className={`py-3 px-5 rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider transition shadow-lg cursor-pointer ${
                    userData.gridIrons >= 10
                      ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 hover:scale-105'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {userData.gridIrons >= 10 ? 'OPEN CAM PACK (10 GI)' : 'NEED 10 GI'}
                </button>
              </div>
            </div>

            {/* PACK 7: Wayne Garrett Legends Pack */}
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 rounded-3xl p-6 sm:p-7 text-white border-2 border-amber-400/50 shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-amber-400 text-slate-950 px-4 py-1 rounded-bl-2xl text-[11px] font-black font-mono tracking-wider">
                99 OVR RB LEGEND
              </div>

              <div className="space-y-3">
                <span className="px-3 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black uppercase tracking-wider inline-block">
                  LEGENDS POWER PACK
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-wide text-white">
                  Wayne Garrett Pack
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Contains 10 players featuring a 2.5% chance at <strong>Wayne Garrett (99 OVR)</strong> with the game-breaking <strong className="text-amber-400">Home Wrecker</strong> ability (unlimited uses on Power Runs when Wayne Garrett carries: 75% best outcome / 25% ok outcome with 0% fumbles or losses), plus authentic <strong>Offensive &amp; Defensive Linemen</strong>.
                </p>

                {/* Drop Odds pill tags */}
                <div className="grid grid-cols-3 gap-1.5 pt-2 text-center text-[10px]">
                  <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-2">
                    <div className="text-amber-300 font-bold">2.5% CHANCE</div>
                    <div className="text-white font-black text-xs truncate">99 Wayne Garrett</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2">
                    <div className="text-emerald-400 font-bold">20% CHANCE</div>
                    <div className="text-white font-black text-xs truncate">75 OVR + OL/DL</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2">
                    <div className="text-slate-400 font-bold">77.5% CHANCE</div>
                    <div className="text-white font-black text-xs truncate">65 OVR Backups</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-amber-400/40 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-black text-amber-300">PRICE</div>
                  <div className="text-2xl font-black font-display text-white">10 GRID IRONS</div>
                </div>
                <button
                  onClick={() => handleOpenPack('wayne_garrett')}
                  disabled={userData.gridIrons < 10}
                  className={`py-3 px-5 rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider transition shadow-lg cursor-pointer ${
                    userData.gridIrons >= 10
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 hover:scale-105'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {userData.gridIrons >= 10 ? 'OPEN WAYNE (10 GI)' : 'NEED 10 GI'}
                </button>
              </div>
            </div>
          </div>

          {/* Linemen & Drop Rates Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white border-2 border-[#69BE28]/60 rounded-3xl p-5 shadow-md space-y-2.5 relative overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                🦅
              </div>
              <h3 className="font-display font-black text-base text-slate-900 uppercase">
                JSN (Route Artist)
              </h3>
              <p className="text-xs text-slate-600">
                99 OVR Diamond WR. <strong className="text-emerald-700">Emerald City Route Artist</strong>: After catching a 10+ yd pass, 60% chance to be wide open next play! Includes 85 OVR Sam Darnold.
              </p>
            </div>

            <div className="bg-white border-2 border-cyan-400/60 rounded-3xl p-5 shadow-md space-y-2.5 relative overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">
                ⚡
              </div>
              <h3 className="font-display font-black text-base text-slate-900 uppercase">
                Cam Newton (Game Breaker)
              </h3>
              <p className="text-xs text-slate-600">
                99 OVR Diamond Dual-Threat QB. <strong className="text-cyan-700">Ignore the odds</strong>: After throwing for 30+ yards, next pass has 100% big play guarantee!
              </p>
            </div>

            <div className="bg-white border-2 border-amber-400/60 rounded-3xl p-5 shadow-md space-y-2.5 relative overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                ⭐
              </div>
              <h3 className="font-display font-black text-base text-slate-900 uppercase">
                Wayne Garrett (Legendary)
              </h3>
              <p className="text-xs text-slate-600">
                99 OVR Diamond Power RB. <strong className="text-amber-700">Home Wrecker</strong>: Unlimited uses on Power Runs when Wayne Garrett carries — 75% best outcome / 25% ok outcome with 0% fumbles/losses.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-2.5 relative overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                🛡️
              </div>
              <h3 className="font-display font-black text-base text-slate-900 uppercase">
                Offensive &amp; Defensive Linemen
              </h3>
              <p className="text-xs text-slate-600">
                Top trenches stars: <strong>Trent Williams, Penei Sewell, Zack Martin, Creed Humphrey, Chris Jones, Myles Garrett, Nick Bosa</strong> and depth.
              </p>
            </div>

            <div className="bg-white border-2 border-emerald-400/60 rounded-3xl p-5 shadow-md space-y-2.5 relative overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                🌟
              </div>
              <h3 className="font-display font-black text-base text-slate-900 uppercase">
                89 OVR Wave 1 &amp; Wave 2 Bosses (Essentials)
              </h3>
              <p className="text-xs text-slate-600">
                Summon any 89 OVR AI Boss from Wave 1 &amp; Wave 2: <strong>Brock Purdy, CeeDee Lamb, Aidan Hutchinson, A.J. Brown, Davante Adams, Myles Garrett, Derrick Henry, Travis Kelce, Jalen Hurts, Breece Hall, Stefon Diggs, Maxx Crosby</strong>, plus Wave 1 stars (Mahomes, Allen, Lamar, McCaffrey, Jefferson, Sauce, T.J. Watt, Parsons).
              </p>
            </div>

            <div className="bg-white border-2 border-[#FFB81C]/60 rounded-3xl p-5 shadow-md space-y-2.5 relative overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-red-100 text-red-800 flex items-center justify-center font-bold">
                🏹
              </div>
              <h3 className="font-display font-black text-base text-slate-900 uppercase">
                Chiefs Dynasty (Legendary)
              </h3>
              <p className="text-xs text-slate-600">
                <strong>Too Fast!</strong> Hill (95 OVR), <strong>Jump Ball</strong> Kelce (90 OVR), and <strong>Double Me</strong> Chris Jones (90 OVR).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BUY CONFIRMATION IN GRID IRONS                                     */}
      {/* ========================================================================= */}
      {selectedCardToBuy && (
        <div 
          onClick={() => setSelectedCardToBuy(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden my-auto animate-in fade-in zoom-in-95"
          >
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-display font-extrabold text-sm sm:text-base text-slate-900 uppercase">
                Confirm Auction Purchase
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCardToBuy(null)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200"
                aria-label="Close"
              >
                <span>Close</span>
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 flex-1">
              {/* Card Preview */}
              <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${getTierColor(selectedCardToBuy.card.tier).bg} text-white border ${getTierColor(selectedCardToBuy.card.tier).border} shadow-lg space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-black ${getTierColor(selectedCardToBuy.card.tier).badge}`}>
                    {selectedCardToBuy.card.ovr} OVR
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {selectedCardToBuy.card.position} • {selectedCardToBuy.card.teamId}
                  </span>
                </div>
                <div>
                  <h4 className="font-display font-black text-xl uppercase tracking-wide">
                    {selectedCardToBuy.card.name}
                  </h4>
                  <p className="text-xs text-slate-300 font-medium">{selectedCardToBuy.card.archetype} • {selectedCardToBuy.card.college}</p>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/10 text-center text-xs">
                  <div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">SPD</div>
                    <div className="font-black text-sm">{selectedCardToBuy.card.speed}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">STR</div>
                    <div className="font-black text-sm">{selectedCardToBuy.card.strength}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">AGI</div>
                    <div className="font-black text-sm">{selectedCardToBuy.card.agility}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">AWR</div>
                    <div className="font-black text-sm">{selectedCardToBuy.card.awareness}</div>
                  </div>
                </div>
              </div>

              {/* Price & Balance Details in Grid Irons */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Price in Grid Irons:</span>
                  <span className="font-bold text-slate-900 font-display text-sm">
                    {selectedCardToBuy.buyNowPrice} Grid Iron{selectedCardToBuy.buyNowPrice > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Your Current Balance:</span>
                  <span className="font-bold text-slate-900 font-display text-sm">
                    {userData.gridIrons} Grid Iron{userData.gridIrons !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-amber-700 font-bold">
                  <span>Remaining Balance:</span>
                  <span>{userData.gridIrons - selectedCardToBuy.buyNowPrice} Grid Irons</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setSelectedCardToBuy(null)}
                className="flex-1 py-3 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl uppercase tracking-wider cursor-pointer border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleBuyCard(selectedCardToBuy)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-xs rounded-xl uppercase tracking-wider shadow-md cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>CONFIRM BUY</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SWAP / EQUIP STARTER FOR A POSITION                                */}
      {/* ========================================================================= */}
      {swapModalSlot && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-display font-extrabold text-lg text-slate-900 uppercase">
                  Equip Starter for {swapModalSlot.id}
                </h3>
                <p className="text-xs text-slate-500">Position: {swapModalSlot.position} ({swapModalSlot.label})</p>
              </div>
              <button
                onClick={() => setSwapModalSlot(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of matching cards in roster */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {userData.roster
                .filter((c) => c.position === swapModalSlot.position)
                .sort((a, b) => b.ovr - a.ovr)
                .map((card) => {
                  const isCurrent = userData.startingLineup[swapModalSlot.id] === card.id;
                  const assignedOtherSlot = Object.entries(userData.startingLineup).find(
                    ([sId, cId]) => {
                      if (sId === swapModalSlot.id) return false;
                      if (cId === card.id) return true;
                      const equippedCard = userData.roster.find((rc) => rc && rc.id === cId);
                      return equippedCard && equippedCard.name.trim().toLowerCase() === card.name.trim().toLowerCase();
                    }
                  )?.[0];
                  const tierStyles = getTierColor(card.tier);

                  return (
                    <div
                      key={card.id}
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                        isCurrent
                          ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/30'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black shadow ${tierStyles.badge}`}>
                          {card.ovr} OVR
                        </span>
                        <div>
                          <h4 className="font-display font-bold text-sm text-slate-900 uppercase">
                            {card.name}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {card.teamName} • SPD: {card.speed} • STR: {card.strength} • AWR: {card.awareness}
                          </p>
                          {assignedOtherSlot && (
                            <span className="text-[10px] text-amber-600 font-bold block mt-0.5">
                              ⚠️ {card.name} is assigned to {assignedOtherSlot} (will reassign)
                            </span>
                          )}
                        </div>
                      </div>

                      {isCurrent ? (
                        <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg uppercase">
                          ACTIVE
                        </span>
                      ) : (
                        <button
                          onClick={() => handleEquipStarter(swapModalSlot.id, card.id)}
                          className="px-4 py-1.5 bg-slate-900 hover:bg-emerald-600 text-white font-display font-bold text-xs rounded-xl uppercase tracking-wide transition cursor-pointer"
                        >
                          EQUIP
                        </button>
                      )}
                    </div>
                  );
                })}

              {userData.roster.filter((c) => c.position === swapModalSlot.position).length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No {swapModalSlot.position} cards found. Visit the Auction House to buy cards!
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSwapModalSlot(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INSPECT CARD DETAILS                                               */}
      {/* ========================================================================= */}
      {inspectedCard && (
        <div 
          onClick={() => setInspectedCard(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden my-auto animate-in fade-in zoom-in-95"
          >
            {/* Sticky Header with prominent, unmissable X button */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2 min-w-0">
                <span className={`px-2 py-0.5 rounded text-[11px] font-black shadow-xs ${getTierColor(inspectedCard.tier).badge}`}>
                  {inspectedCard.ovr} OVR
                </span>
                <h3 className="font-display font-extrabold text-sm sm:text-base text-slate-900 uppercase truncate">
                  {inspectedCard.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCard(null)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 hover:text-slate-900 text-xs font-bold transition cursor-pointer shadow-xs border border-slate-200 shrink-0 ml-2"
                aria-label="Close card dossier"
                title="Close (Esc)"
              >
                <span>Close</span>
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Scrollable Card Body (auto-fits vertically) */}
            <div className="overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-3 sm:space-y-3.5 flex-1">
              {/* High-fidelity Card Visual */}
              <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${getTierColor(inspectedCard.tier).bg} text-white border-2 ${getTierColor(inspectedCard.tier).border} shadow-xl space-y-3 sm:space-y-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className={`px-2.5 py-1 rounded-lg text-xs sm:text-sm font-black shadow-md ${getTierColor(inspectedCard.tier).badge}`}>
                      {inspectedCard.ovr} OVR
                    </span>
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-200 bg-black/40 px-2.5 py-1 rounded-lg">
                      {inspectedCard.position}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest bg-black/50 px-2.5 py-1 rounded-full text-slate-200">
                    {inspectedCard.teamId}
                  </span>
                </div>

                <div>
                  <h4 className="font-display font-black text-xl sm:text-2xl uppercase tracking-wide text-white drop-shadow">
                    {inspectedCard.name}
                  </h4>
                  <p className="text-xs text-slate-300 font-medium">{inspectedCard.teamName}</p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[11px] sm:text-xs bg-black/30 p-2.5 sm:p-3 rounded-xl">
                  <div><span className="text-slate-400">Archetype:</span> <span className="font-bold text-white">{inspectedCard.archetype}</span></div>
                  <div><span className="text-slate-400">College:</span> <span className="font-bold text-white">{inspectedCard.college}</span></div>
                  <div><span className="text-slate-400">Age:</span> <span className="font-bold text-white">{inspectedCard.age} yrs</span></div>
                  <div><span className="text-slate-400">Tier:</span> <span className="font-bold uppercase text-amber-300">{inspectedCard.tier}</span></div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 pt-1 border-t border-white/10 text-center">
                  <div className="bg-black/30 p-1.5 sm:p-2 rounded-xl">
                    <div className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase">SPD</div>
                    <div className="font-black text-sm sm:text-base">{inspectedCard.speed}</div>
                  </div>
                  <div className="bg-black/30 p-1.5 sm:p-2 rounded-xl">
                    <div className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase">STR</div>
                    <div className="font-black text-sm sm:text-base">{inspectedCard.strength}</div>
                  </div>
                  <div className="bg-black/30 p-1.5 sm:p-2 rounded-xl">
                    <div className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase">AGI</div>
                    <div className="font-black text-sm sm:text-base">{inspectedCard.agility}</div>
                  </div>
                  <div className="bg-black/30 p-1.5 sm:p-2 rounded-xl">
                    <div className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase">AWR</div>
                    <div className="font-black text-sm sm:text-base">{inspectedCard.awareness}</div>
                  </div>
                </div>

                {/* Game Breaker Ability Summary */}
                {inspectedCard.abilityName && (
                  <div className="pt-2 sm:pt-3 border-t border-white/10 space-y-1.5 sm:space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-1 sm:p-1.5 rounded-lg bg-amber-400 text-slate-900 shadow-sm">
                        <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                      </div>
                      <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-amber-300">
                        {inspectedCard.abilityTitle || 'Game Breaker'} Ability
                      </span>
                    </div>
                    <div className="bg-black/40 p-2.5 sm:p-3 rounded-2xl border border-amber-400/20">
                      <h5 className="text-xs sm:text-sm font-black text-white uppercase mb-0.5">
                        {inspectedCard.abilityName}
                      </h5>
                      <p className="text-[10px] sm:text-[11px] text-slate-300 leading-relaxed italic">
                        "{inspectedCard.abilityDescription}"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Anchored Bottom Actions Bar */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 shrink-0 space-y-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleQuickSell(inspectedCard)}
                  className={`flex-1 py-2.5 sm:py-3 border font-display font-black text-xs rounded-xl uppercase tracking-wider transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm active:scale-98 ${
                    calculateQuickSellPrice(inspectedCard) >= 200
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 border-amber-300 animate-pulse'
                      : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-500 text-amber-600" />
                  <span>
                    Quick-Sell (+{calculateQuickSellPrice(inspectedCard)} GI)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const isEquipped = Object.values(userData.startingLineup).includes(inspectedCard.id);
                    if (isEquipped) {
                      showToast('⚠️ Cannot auction an active starter! Please swap them with a backup first.');
                      return;
                    }
                    const isStarterOnly = inspectedCard.id.startsWith('starter-') || inspectedCard.ovr <= 60;
                    if (isStarterOnly) {
                      showToast('⚠️ Starter cards cannot be listed! Collect higher rated players from packs to auction.');
                      return;
                    }
                    setCardToListOnAuction(inspectedCard);
                    setAuctionPriceInput(String(calculateAuctionPriceInGridIrons(inspectedCard.ovr)));
                    setInspectedCard(null);
                  }}
                  className="flex-1 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-display font-black text-xs rounded-xl uppercase tracking-wider transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <span>Auction Player</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setInspectedCard(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-display font-bold text-xs rounded-xl uppercase tracking-wider cursor-pointer flex items-center justify-center space-x-1.5 transition"
              >
                <X className="w-4 h-4" />
                <span>Close Dossier</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PACK OPENING RESULT CELEBRATION (10 PLAYERS)                       */}
      {/* ========================================================================= */}
      {lastOpenedCards && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border-2 border-amber-400 text-white space-y-6 text-center max-h-[90vh] flex flex-col animate-in zoom-in-95">
            <div className="space-y-1 shrink-0">
              <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider">
                🎉 PREMIUM PACK OPENED (10 PLAYERS ACQUIRED!)
              </span>
              <h3 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-wide text-white">
                {lastOpenedCards.some(c => c.name === 'Wayne Garrett') ? '🔥 LEGENDARY WAYNE GARRETT PULL!' : 'Pack Pulled Successfully!'}
              </h3>
            </div>

            {/* Scrollable Grid of 10 Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 overflow-y-auto pr-1 flex-1 text-left">
              {lastOpenedCards.map((card, idx) => {
                const tierStyles = getTierColor(card.tier);
                return (
                  <div key={card.id || idx} className={`p-3 rounded-2xl bg-gradient-to-br ${tierStyles.bg} border ${tierStyles.border} shadow-lg space-y-2 flex flex-col justify-between`}>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-black uppercase tracking-wider text-slate-300 bg-black/40 px-1.5 py-0.5 rounded truncate max-w-[60px]">
                        {card.position}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded font-black ${tierStyles.badge}`}>
                        {card.ovr} OVR
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <h4 className="font-display font-black text-sm uppercase text-white truncate">
                        {card.name}
                      </h4>
                      {card.abilityName && (
                        <div className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-amber-500/35 text-amber-300 border border-amber-400/50 text-[8px] font-black uppercase">
                          <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
                          <span className="truncate">{card.abilityName}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-300 truncate">{card.teamName}</p>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-center pt-1 border-t border-white/10 text-[9px] font-mono">
                      <div className="bg-black/30 p-1 rounded">
                        <span className="text-slate-400 block text-[7px]">SPD</span>
                        <strong className="text-white font-black">{card.speed}</strong>
                      </div>
                      <div className="bg-black/30 p-1 rounded">
                        <span className="text-slate-400 block text-[7px]">STR</span>
                        <strong className="text-white font-black">{card.strength}</strong>
                      </div>
                      <div className="bg-black/30 p-1 rounded">
                        <span className="text-slate-400 block text-[7px]">AGI</span>
                        <strong className="text-white font-black">{card.agility}</strong>
                      </div>
                      <div className="bg-black/30 p-1 rounded">
                        <span className="text-slate-400 block text-[7px]">AWR</span>
                        <strong className="text-white font-black">{card.awareness}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setLastOpenedCards(null)}
              className="w-full py-3.5 px-6 bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-xs uppercase tracking-wider rounded-2xl cursor-pointer shadow-lg transition shrink-0"
            >
              CLAIM ALL 10 PLAYERS TO BINDER & LINEUP
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHANGE DYNASTY TEAM NAME                                           */}
      {/* ========================================================================= */}
      {isEditingTeamName && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center shadow-sm">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-slate-900 uppercase">
                    Rename Dynasty Team
                  </h3>
                  <p className="text-[11px] text-slate-400">Customize your Gridiron Clash club identity</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditingTeamName(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Team Name
              </label>
              <input
                type="text"
                value={teamNameInput}
                onChange={(e) => setTeamNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTeamName();
                  if (e.key === 'Escape') setIsEditingTeamName(false);
                }}
                maxLength={30}
                placeholder="e.g. Apex Dynasty, Seattle Surge, Iron Titans"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-bold font-display text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase tracking-wide"
                autoFocus
              />
              <p className="text-[11px] text-slate-400">
                This name updates across all Gridiron Clash matchups, active rosters, and in-game scoreboards.
              </p>
            </div>

            {/* Quick Suggestions */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Popular Suggestions:</span>
              <div className="flex flex-wrap gap-1.5">
                {['Apex Dynasty', 'Iron Titans', 'Gridiron Reapers', 'Metro Vandals', 'Solar Storm', 'Nightmare Blitz'].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setTeamNameInput(sug)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 text-slate-700 text-[11px] font-semibold transition cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center space-x-3">
              <button
                onClick={() => setIsEditingTeamName(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl uppercase tracking-wider transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTeamName}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-xs rounded-xl uppercase tracking-wider transition shadow-md cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Name</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REDEEM LOCKER CODE (+2,000 GRID IRONS TESTER)                      */}
      {/* ========================================================================= */}
      {isRedeemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-slate-900 uppercase">
                    Redeem Locker Code
                  </h3>
                  <p className="text-[11px] text-slate-400">Unlock Grid Irons for your computer save</p>
                </div>
              </div>
              <button
                onClick={() => setIsRedeemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Enter Promo / Locker Code
              </label>
              <input
                type="text"
                value={lockerCodeInput}
                onChange={(e) => setLockerCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRedeemCode();
                  if (e.key === 'Escape') setIsRedeemModalOpen(false);
                }}
                maxLength={30}
                placeholder="e.g. GRIDIRON2000"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase tracking-wider"
                autoFocus
              />
              <p className="text-[11px] text-slate-500">
                Instantly credit +2,000 Grid Irons to your save file balance.
              </p>
            </div>

            {/* Quick Code Buttons */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Available Codes (Click to auto-fill):</span>
              <div className="flex flex-wrap gap-1.5">
                {['GRIDIRON2000', 'SECRET2000', 'CAM99', 'SUPERBOWL2000'].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setLockerCodeInput(code);
                      handleRedeemCode(code);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 hover:text-amber-900 border border-amber-200 text-amber-800 text-[11px] font-mono font-bold transition cursor-pointer"
                  >
                    {code} (+2,000 GI)
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center space-x-3">
              <button
                onClick={() => setIsRedeemModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl uppercase tracking-wider transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRedeemCode()}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-display font-black text-xs rounded-xl uppercase tracking-wider transition shadow-md cursor-pointer flex items-center justify-center space-x-1.5 border border-amber-300"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Redeem +2,000 GI</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: POST CARD TO SHARED AUCTION HOUSE                                 */}
      {/* ========================================================================= */}
      {cardToListOnAuction && (
        <div 
          onClick={() => setCardToListOnAuction(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden my-auto animate-in fade-in zoom-in-95"
          >
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-display font-extrabold text-sm sm:text-base text-slate-900 uppercase">
                List Card on Global Auction House
              </h3>
              <button
                type="button"
                onClick={() => setCardToListOnAuction(null)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200"
                aria-label="Close"
              >
                <span>Close</span>
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 flex-1">
              {/* Card Preview */}
              <div className={`p-4 rounded-2xl bg-gradient-to-br ${getTierColor(cardToListOnAuction.tier).bg} text-white border ${getTierColor(cardToListOnAuction.tier).border} shadow-lg space-y-2`}>
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-black ${getTierColor(cardToListOnAuction.tier).badge}`}>
                    {cardToListOnAuction.ovr} OVR
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {cardToListOnAuction.position} • {cardToListOnAuction.teamId}
                  </span>
                </div>
                <div>
                  <h4 className="font-display font-black text-lg uppercase tracking-wide">
                    {cardToListOnAuction.name}
                  </h4>
                  <p className="text-[11px] text-slate-300 font-medium">{cardToListOnAuction.archetype} • {cardToListOnAuction.college}</p>
                </div>
              </div>

              {/* Price input in Grid Irons */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Set Buy Now Price (in Grid Irons):
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={auctionPriceInput}
                    onChange={(e) => setAuctionPriceInput(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-bold font-display text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-black text-slate-500 font-display">GI</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Recommended Price based on ratings: <strong className="text-emerald-700">{calculateAuctionPriceInGridIrons(cardToListOnAuction.ovr)} GI</strong>.
                </p>
              </div>

              {/* Auction Expiration Timer Selection */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Auction Duration / Expiration Timer:
                  </label>
                  <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                    {auctionDurationMinutes < 60 
                      ? `${auctionDurationMinutes} mins` 
                      : `${auctionDurationMinutes / 60} hour${auctionDurationMinutes > 60 ? 's' : ''}`}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  {[
                    { mins: 1, label: '⚡ 1m (test)' },
                    { mins: 5, label: '5m' },
                    { mins: 15, label: '15m' },
                    { mins: 30, label: '30m' },
                    { mins: 60, label: '1 hour' },
                    { mins: 180, label: '3 hours' },
                    { mins: 360, label: '6 hours' },
                    { mins: 1440, label: '24 hours' },
                  ].map((dur) => (
                    <button
                      key={dur.mins}
                      type="button"
                      onClick={() => setAuctionDurationMinutes(dur.mins)}
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold transition cursor-pointer border text-center ${
                        auctionDurationMinutes === dur.mins
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-emerald-500/40'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>

                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5 text-[11px] text-amber-900">
                  <div className="flex items-center space-x-1.5 font-bold text-amber-950">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Timer & Transaction Rules:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[10.5px] text-amber-800/90 pl-0.5 leading-relaxed">
                    <li>
                      <strong>If another user buys your card:</strong> You gain the <strong>{auctionPriceInput || calculateAuctionPriceInGridIrons(cardToListOnAuction.ovr)} GI</strong> and they receive the card.
                    </li>
                    <li>
                      <strong>If the timer runs out without a buyer:</strong> The listing is automatically deleted from the market and your card safely returns to your Card Binder.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setCardToListOnAuction(null)}
                className="flex-1 py-3 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl uppercase tracking-wider cursor-pointer border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePostPlayerToAuction}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-display font-black text-xs rounded-xl uppercase tracking-wider shadow-md cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>POST LISTING</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
