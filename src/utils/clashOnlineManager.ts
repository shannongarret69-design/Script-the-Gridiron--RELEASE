import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  deleteDoc,
  increment,
  arrayUnion,
  updateDoc,
  deleteField,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ClashUserData, ClashCard, AuctionListing, ClashTransaction } from '../types/clash';
import { STARTER_SLOTS, generateAuctionListings } from './clashManager';
import { QBThrowingVariant, RunStyleVariant } from '../types/game';
import { 
  isFirestoreQuotaExceeded, 
  markFirestoreQuotaExceeded, 
  resetFirestoreQuotaCircuitBreaker,
  isQuotaError 
} from './quotaManager';

/**
 * Safely parses any timestamp type (number, Firestore Timestamp object, ISO string) into milliseconds
 */
export function parseTimestampMs(ts: any): number {
  if (typeof ts === 'number') return ts;
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts && typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    if (!isNaN(parsed)) return parsed;
  }
  return Date.now();
}

const syncCooldowns = new Map<string, number>();

export function calculateAccurateRosterOvr(userData: ClashUserData): number {
  if (!userData || !userData.roster || !Array.isArray(userData.roster) || userData.roster.length === 0) return 60;

  try {
    const startingCards = (STARTER_SLOTS || []).map((slot) => {
      const cardId = userData.startingLineup?.[slot.id];
      const card = userData.roster.find((c) => c && c.id === cardId);
      return card && typeof card.ovr === 'number' ? card.ovr : 60;
    });

    const validOvrValues = startingCards.filter((v) => typeof v === 'number' && !isNaN(v));
    if (validOvrValues.length === 0) return 60;

    const avg = Math.round(validOvrValues.reduce((acc, v) => acc + v, 0) / validOvrValues.length);
    return avg || 60;
  } catch (e) {
    return 60;
  }
}

export interface PlayerLockStatus {
  isLocked: boolean;
  userId?: string;
  lockedAt?: number;
}

export interface PlayersLockedMap {
  host?: PlayerLockStatus;
  guest?: PlayerLockStatus;
  [userId: string]: PlayerLockStatus | undefined;
}

export interface SubmittedPlayCall {
  userId: string;
  playId: string;
  playName: string;
  playType: 'Offense' | 'Defense';
  category: string;
  submittedAt: number;
  throwingVariant?: QBThrowingVariant;
  runVariant?: RunStyleVariant;
  targetPlayer?: string;
  preSnapMotion?: boolean;
  isMaxProtection?: boolean;
}

export interface OnlineMatchSyncData {
  turnNumber: number;
  possessionUserId: string; // hostUserId or guestUserId
  down: number;
  distance: number;
  yardLine: number;
  homeScore: number;
  awayScore: number;
  quarter: number;
  quarterTimeSeconds: number;
  hostSubmittedPlay?: SubmittedPlayCall | null;
  guestSubmittedPlay?: SubmittedPlayCall | null;
  playersLocked?: PlayersLockedMap;
  lastPlayResult?: {
    description: string;
    gainYards: number;
    resultType: string;
    turnover: boolean;
    touchdown: boolean;
    executedAt: number;
    offensePlayName: string;
    defensePlayName: string;
  } | null;
  isGameOver?: boolean;
}

export interface OnlineRoom {
  id: string;
  hostUserId: string;
  hostTeamName: string;
  hostOvr: number;
  hostStarPlayer: string;
  guestUserId?: string;
  guestTeamName?: string;
  guestOvr?: number;
  guestStarPlayer?: string;
  status: 'waiting' | 'in_progress' | 'completed';
  createdAt: number;
  hostKickoffRole?: 'offense' | 'defense';
  matchSync?: OnlineMatchSyncData;
  forfeitedBy?: string;
}

export interface OnlineLeaderboardEntry {
  userId: string;
  teamName: string;
  userOvr: number;
  wins: number;
  losses: number;
  gridIrons: number;
  starPlayer: string;
  updatedAt: number;
}

// Generate random 6-character room code (e.g. CLASH-9412)
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CLASH-${result}`;
}

// Get or assign persistent per-tab/session online UID
export function getOnlineUserId(): string {
  // If user is authenticated, ALWAYS use their stable Auth UID
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }

  // Fallback to session-based ID for unauthenticated guests
  try {
    let sId = sessionStorage.getItem('gridiron_session_client_id');
    if (!sId) {
      sId = 'guest_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      sessionStorage.setItem('gridiron_session_client_id', sId);
    }
    return sId;
  } catch (e) {
    return 'guest_fallback_' + Math.random().toString(36).substring(2, 5);
  }
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isQuotaError(error)) {
    markFirestoreQuotaExceeded();
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.warn('Firestore Error Notice: ', JSON.stringify(errInfo));
}

/**
 * Helper to filter active lobbies and purge stale waiting rooms.
 * Lobbies waiting for more than 2 minutes without starting are considered stale and excluded.
 */
export function filterFreshActiveLobbies(rooms: OnlineRoom[]): OnlineRoom[] {
  const now = Date.now();
  const MAX_WAITING_AGE_MS = 15 * 60 * 1000; // 15 minutes max window for active waiting lobbies
  const fresh: OnlineRoom[] = [];

  for (const r of rooms) {
    if (!r || !r.id || !r.hostUserId) continue;

    if (r.status === 'waiting') {
      const createdAt = parseTimestampMs(r.createdAt);
      const age = now - createdAt;
      if (age <= MAX_WAITING_AGE_MS && age >= -120000) {
        fresh.push(r);
      } else if (age > MAX_WAITING_AGE_MS) {
        // Asynchronously purge stale waiting room from Firestore
        deleteDoc(doc(db, 'clash_rooms', r.id)).catch(() => {});
      }
    } else if (r.status === 'in_progress') {
      const createdAt = parseTimestampMs(r.createdAt);
      const age = now - createdAt;
      if (age <= 45 * 60 * 1000 && age >= -120000) {
        fresh.push(r);
      }
    }
  }

  return deduplicateUserLobbies(fresh);
}

/**
 * Leaves or cancels an online lobby room
 */
export async function leaveOnlineLobby(roomId: string): Promise<void> {
  if (!roomId || isFirestoreQuotaExceeded()) return;
  const userId = getOnlineUserId();
  try {
    const roomRef = doc(db, 'clash_rooms', roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;
    const room = snap.data() as OnlineRoom;
    if (room.hostUserId === userId) {
      // Host leaving -> delete the room document immediately
      await deleteDoc(roomRef);
    } else if (room.guestUserId === userId) {
      // Guest leaving -> clear guest fields and revert to waiting
      await updateDoc(roomRef, {
        guestUserId: deleteField(),
        guestTeamName: deleteField(),
        guestOvr: deleteField(),
        guestStarPlayer: deleteField(),
        status: 'waiting',
      });
    }
  } catch (e) {
    // Ignore error on leave
  }
}

/**
 * Helper to deduplicate rooms by hostUserId so that each user appears at most once in active lobby browser
 */
export function deduplicateUserLobbies(rooms: OnlineRoom[]): OnlineRoom[] {
  const seenHosts = new Set<string>();
  const uniqueRooms: OnlineRoom[] = [];

  // Sort descending by createdAt
  const sorted = [...rooms].sort((a, b) => parseTimestampMs(b.createdAt) - parseTimestampMs(a.createdAt));

  for (const r of sorted) {
    if (!r.hostUserId) continue;
    if (!seenHosts.has(r.hostUserId)) {
      seenHosts.add(r.hostUserId);
      uniqueRooms.push(r);
    }
  }
  return uniqueRooms;
}

/**
 * Creates a new online lobby room in Firestore
 */
export async function createOnlineLobby(userData: ClashUserData): Promise<OnlineRoom> {
  const roomId = generateRoomCode();
  const userId = getOnlineUserId();
  const userOvr = calculateAccurateRosterOvr(userData);

  // Clean up any prior open/waiting rooms created by this user so there's always only 1 active lobby per user
  if (!isFirestoreQuotaExceeded()) {
    try {
      const roomsRef = collection(db, 'clash_rooms');
      const qOld = query(roomsRef, where('hostUserId', '==', userId));
      const oldSnap = await getDocs(qOld);
      for (const d of oldSnap.docs) {
        const data = d.data() as OnlineRoom;
        if (data.status === 'waiting') {
          await deleteDoc(d.ref).catch(() => {});
        }
      }
    } catch (e) {
      // Ignore index warning
    }
  }

  // Find highest OVR card in roster as star player
  const starCard = userData.roster.reduce(
    (best, c) => (c.ovr > best.ovr ? c : best),
    userData.roster[0] || { name: 'Star Player', ovr: 60 }
  );

  const room: OnlineRoom = {
    id: roomId,
    hostUserId: userId,
    hostTeamName: userData.teamName || 'Gridiron Dynasty',
    hostOvr: userOvr,
    hostStarPlayer: `${starCard.name} (${starCard.ovr} OVR)`,
    hostKickoffRole: 'offense',
    status: 'waiting',
    createdAt: Date.now(),
  };

  if (isFirestoreQuotaExceeded()) {
    console.warn('[Online] Cannot create cloud room: Firestore daily write quota reached.');
    throw new Error('Firestore daily quota reached. Online room creation is temporarily paused until tomorrow.');
  }

  try {
    await setDoc(doc(db, 'clash_rooms', roomId), room);
  } catch (e) {
    if (isQuotaError(e)) {
      markFirestoreQuotaExceeded();
      throw new Error('Firestore daily quota reached. Online matchmaking is temporarily paused until tomorrow.');
    }
    handleFirestoreError(e, OperationType.WRITE, `clash_rooms/${roomId}`);
  }

  return room;
}

/**
 * Updates the host's kickoff role selection in Firestore
 */
export async function updateRoomHostKickoffRole(
  roomId: string,
  role: 'offense' | 'defense'
): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const roomRef = doc(db, 'clash_rooms', roomId);
  try {
    await updateDoc(roomRef, {
      hostKickoffRole: role,
    });
  } catch (e) {
    if (isQuotaError(e)) {
      markFirestoreQuotaExceeded();
      return;
    }
    console.warn('Failed to update host kickoff role:', e);
  }
}

/**
 * Joins an existing online lobby room
 */
export async function joinOnlineLobby(
  roomId: string,
  userData: ClashUserData
): Promise<{ success: boolean; room?: OnlineRoom; error?: string }> {
  if (isFirestoreQuotaExceeded()) {
    return { success: false, error: 'Firestore daily write quota reached. Online matchmaking is paused until tomorrow.' };
  }

  const userId = getOnlineUserId();
  const cleanRoomId = roomId.trim().toUpperCase();
  const userOvr = calculateAccurateRosterOvr(userData);

  try {
    const roomRef = doc(db, 'clash_rooms', cleanRoomId);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) {
      return { success: false, error: 'Room not found. Check room code and try again.' };
    }

    const roomData = { ...snap.data(), id: cleanRoomId } as OnlineRoom;

    if (roomData.hostUserId === userId || roomData.guestUserId === userId) {
      return { success: true, room: roomData };
    }

    if (roomData.guestUserId && roomData.guestUserId !== userId) {
      return { success: false, error: 'Room is full! Another opponent has already joined.' };
    }

    if (roomData.status === 'completed') {
      return { success: false, error: 'This match has already completed.' };
    }

    const starCard = userData.roster.reduce(
      (best, c) => (c.ovr > best.ovr ? c : best),
      userData.roster[0] || { name: 'Star Player', ovr: 60 }
    );

    await updateDoc(roomRef, {
      guestUserId: userId,
      guestTeamName: userData.teamName || 'Challenger FC',
      guestOvr: userOvr,
      guestStarPlayer: `${starCard.name} (${starCard.ovr} OVR)`,
      status: 'in_progress',
    });
    const updatedSnap = await getDoc(roomRef);
    return { success: true, room: updatedSnap.data() as OnlineRoom };
  } catch (e: any) {
    if (isQuotaError(e)) {
      markFirestoreQuotaExceeded();
      return { success: false, error: 'Firestore daily write quota reached. Online matchmaking is paused until tomorrow.' };
    }
    handleFirestoreError(e, OperationType.WRITE, `clash_rooms/${cleanRoomId}`);
    return { success: false, error: e?.message || 'Failed to join room.' };
  }
}

/**
 * Quick Matchmaking: Searches for an open waiting room, or creates one if none available
 */
export async function findQuickMatch(
  userData: ClashUserData
): Promise<{ room: OnlineRoom; isHost: boolean }> {
  const userId = getOnlineUserId();
  try {
    const roomsRef = collection(db, 'clash_rooms');
    const qWaiting = query(roomsRef, where('status', '==', 'waiting'), limit(30));

    const searchPromise = getDocs(qWaiting);
    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error('Matchmaking timeout')), 3500)
    );

    let snap;
    try {
      snap = await Promise.race([searchPromise, timeoutPromise]);
    } catch (err) {
      // Fallback query if index or query fails
      snap = await getDocs(query(roomsRef, limit(40)));
    }

    const fresh = filterFreshActiveLobbies(
      snap.docs.map((d: any) => ({ ...d.data(), id: d.id } as OnlineRoom))
    );
    const available = fresh.filter((r: OnlineRoom) => r.status === 'waiting' && r.hostUserId !== userId);

    if (available.length > 0) {
      // Prefer the most recently created waiting room
      available.sort((a, b) => parseTimestampMs(b.createdAt) - parseTimestampMs(a.createdAt));
      
      for (const chosen of available) {
        const joined = await joinOnlineLobby(chosen.id, userData);
        if (joined.success && joined.room) {
          return { room: joined.room, isHost: false };
        }
      }
    }
  } catch (e) {
    // Search timeout or error -> fallback to create own lobby
  }

  // Fallback: create own waiting room lobby
  const newRoom = await createOnlineLobby(userData);
  return { room: newRoom, isHost: true };
}

/**
 * Real-time listener for room status changes
 */
export function listenToLobby(
  roomId: string,
  onUpdate: (room: OnlineRoom | null) => void
): () => void {
  let isCancelled = false;
  try {
    const roomRef = doc(db, 'clash_rooms', roomId);
    const unsubscribe = onSnapshot(
      roomRef,
      (snap) => {
        if (isCancelled) return;
        const roomData = snap.exists() ? (snap.data() as OnlineRoom) : null;
        setTimeout(() => {
          if (!isCancelled) {
            onUpdate(roomData);
          }
        }, 0);
      },
      (err) => {
        if (isCancelled) return;
        const msg = err.message.toLowerCase();
        if (msg.includes('quota') || msg.includes('resource-exhausted')) {
          markFirestoreQuotaExceeded();
        } else {
          console.warn(`[Online] Listen to lobby ${roomId} notice:`, err.message);
        }
      }
    );
    return () => {
      isCancelled = true;
      setTimeout(() => {
        try {
          unsubscribe();
        } catch (e) {
          // Ignore unregister race
        }
      }, 0);
    };
  } catch (e) {
    return () => {};
  }
}

/**
 * Listens to active lobby rooms in Firestore in real-time
 */
export function listenToActiveLobbies(
  onUpdate: (rooms: OnlineRoom[]) => void
): () => void {
  let activeUnsub: (() => void) | null = null;
  let isCancelled = false;

  const startListening = (useOrderBy = true) => {
    if (isCancelled) return;
    
    try {
      const roomsRef = collection(db, 'clash_rooms');
      const q = useOrderBy 
        ? query(roomsRef, orderBy('createdAt', 'desc'), limit(40))
        : query(roomsRef, limit(40));

      activeUnsub = onSnapshot(
        q,
        (snap) => {
          if (isCancelled) return;
          resetFirestoreQuotaCircuitBreaker();
          const rooms: OnlineRoom[] = snap.docs
            .map((d) => ({ ...d.data(), id: d.id } as OnlineRoom))
            .filter((r) => r && (r.status === 'waiting' || r.status === 'in_progress'));
          const freshRooms = filterFreshActiveLobbies(rooms);
          setTimeout(() => {
            if (!isCancelled) {
              onUpdate(freshRooms);
            }
          }, 0);
        },
        (err) => {
          if (isCancelled) return;
          
          const msg = err.message.toLowerCase();
          if (useOrderBy && (msg.includes('index') || msg.includes('failed-precondition'))) {
            console.warn('[Online] Missing index for lobby sorting, falling back to unordered list.');
            if (activeUnsub) {
              const currentUnsub = activeUnsub;
              setTimeout(() => {
                try { currentUnsub(); } catch (e) {}
              }, 0);
            }
            startListening(false);
            return;
          }
          if (msg.includes('quota') || msg.includes('resource-exhausted')) {
            markFirestoreQuotaExceeded();
          } else {
            console.warn('[Online] Active lobbies listener notice:', err.message);
          }
        }
      );
    } catch (e) {
      if (!isCancelled) onUpdate([]);
    }
  };

  startListening(true);

  return () => {
    isCancelled = true;
    setTimeout(() => {
      if (activeUnsub) {
        try {
          activeUnsub();
        } catch (e) {
          // Ignore unregister race
        }
      }
    }, 0);
  };
}

/**
 * Fetches active lobby rooms from Firestore database (one-time poll or refresh)
 */
export async function fetchActiveLobbies(): Promise<OnlineRoom[]> {
  try {
    const roomsRef = collection(db, 'clash_rooms');
    let snap;
    
    try {
      const q = query(roomsRef, orderBy('createdAt', 'desc'), limit(40));
      snap = await getDocs(q);
    } catch (err: any) {
      const msg = err.message.toLowerCase();
      if (msg.includes('index') || msg.includes('failed-precondition')) {
        // Fallback to unordered query
        snap = await getDocs(query(roomsRef, limit(40)));
      } else {
        throw err;
      }
    }

    resetFirestoreQuotaCircuitBreaker();
    const rooms = snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as OnlineRoom))
      .filter((r) => r && (r.status === 'waiting' || r.status === 'in_progress'));
      
    return filterFreshActiveLobbies(rooms);
  } catch (e) {
    return [];
  }
}

let lastLeaderboardPublishTime = 0;

/**
 * Updates or publishes user online stats to global leaderboard
 */
export async function publishLeaderboardStats(
  userData: ClashUserData,
  isVictory: boolean
): Promise<void> {
  const userId = getOnlineUserId();
  if (!userId) return;

  // Global session throttle for leaderboard updates (max once per 60s)
  const now = Date.now();
  if (now - lastLeaderboardPublishTime < 60000) {
    return;
  }
  lastLeaderboardPublishTime = now;
  
  const leaderRef = doc(db, 'clash_leaderboard', userId);

  // Calculate latest OVR to ensure accuracy
  const userOvr = calculateAccurateRosterOvr(userData);

  const starCard = userData.roster.reduce(
    (best, c) => (c.ovr > best.ovr ? c : best),
    userData.roster[0] || { name: 'Star Player', ovr: 60 }
  );

  try {
    const starPlayerStr = `${starCard.name} (${starCard.ovr} OVR)`;
    
    // Use setDoc with merge and increment to avoid the getDoc read unit
    await setDoc(leaderRef, {
      userId,
      teamName: userData.teamName || 'Apex Dynasty',
      userOvr: userOvr,
      wins: increment(isVictory ? 1 : 0),
      losses: increment(isVictory ? 0 : 1),
      gridIrons: userData.gridIrons || 0,
      starPlayer: starPlayerStr,
      updatedAt: now,
    }, { merge: true });

  } catch (e) {
    console.warn('Publish leaderboard error:', e);
  }
}

export function getUserLeaderboardEntry(userData: ClashUserData): OnlineLeaderboardEntry {
  const userId = getOnlineUserId();
  const starCard = userData.roster.reduce(
    (best, c) => (c.ovr > best.ovr ? c : best),
    userData.roster[0] || { name: 'Star Player', ovr: 60 }
  );

  return {
    userId,
    teamName: userData.teamName || 'Gridiron Dynasty',
    userOvr: userData.userOvr || 60,
    wins: userData.wins || 0,
    losses: userData.losses || 0,
    gridIrons: userData.gridIrons || 0,
    starPlayer: `${starCard.name} (${starCard.ovr} OVR)`,
    updatedAt: Date.now(),
  };
}

/**
 * Fetches top online players for the global leaderboard
 */
export async function fetchGlobalLeaderboard(userData?: ClashUserData): Promise<OnlineLeaderboardEntry[]> {
  const userEntry = userData ? getUserLeaderboardEntry(userData) : null;

  try {
    const leaderRef = collection(db, 'clash_leaderboard');
    const q = query(leaderRef, orderBy('wins', 'desc'), limit(10));
    const snap = await getDocs(q);

    if (snap.empty) {
      return userEntry ? [userEntry] : [];
    }

    const entries = snap.docs.map((d) => d.data() as OnlineLeaderboardEntry);

    if (userEntry) {
      const exists = entries.some((e) => e.userId === userEntry.userId);
      if (!exists) {
        entries.push(userEntry);
      }
    }

    return entries;
  } catch (e) {
    return userEntry ? [userEntry] : [];
  }
}

/**
 * Initializes match sync state in Firestore room.
 * Throttled to prevent multiple rapid initializations.
 */
export async function initializeOnlineMatchSync(
  roomId: string,
  hostUserId: string,
  guestUserId: string,
  startOnOffense: boolean
): Promise<void> {
  const now = Date.now();
  if (now - (syncCooldowns.get(roomId) || 0) < 2000) {
    return;
  }
  syncCooldowns.set(roomId, now);

  const roomRef = doc(db, 'clash_rooms', roomId);
  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;

    const roomData = snap.data() as OnlineRoom;
    const initialSync: OnlineMatchSyncData = {
      turnNumber: 1,
      possessionUserId: startOnOffense ? hostUserId : (guestUserId || 'guest'),
      down: 1,
      distance: 10,
      yardLine: 25,
      homeScore: 0,
      awayScore: 0,
      quarter: 1,
      quarterTimeSeconds: 300, // 5 minutes per quarter
      hostSubmittedPlay: null,
      guestSubmittedPlay: null,
      playersLocked: {
        host: { isLocked: false, userId: hostUserId },
        guest: { isLocked: false, userId: guestUserId || 'guest' },
        [hostUserId]: { isLocked: false, userId: hostUserId },
        [(guestUserId || 'guest')]: { isLocked: false, userId: guestUserId || 'guest' },
      },
      lastPlayResult: null,
      isGameOver: false,
    };

    await updateDoc(roomRef, {
      status: 'in_progress',
      matchSync: initialSync,
    });
  } catch (e) {
    console.warn('Failed to initialize match sync:', e);
  }
}

/**
 * Handles early exit / leaving an online match.
 * Ensures only the first player to leave the game early gets a loss.
 */
export async function handlePlayerLeaveOnlineMatch(roomId: string, userData: ClashUserData): Promise<void> {
  const userId = getOnlineUserId();
  if (!roomId || !userId) return;

  const roomRef = doc(db, 'clash_rooms', roomId);
  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;
    const room = snap.data() as OnlineRoom;
    if (room.status === 'completed') return;

    if (!room.forfeitedBy) {
      // First player to leave early gets a loss
      await updateDoc(roomRef, {
        forfeitedBy: userId,
        status: 'completed',
        'matchSync.isGameOver': true,
      });
      await publishLeaderboardStats(userData, false);
    } else {
      // Second player to leave does not get an extra loss
      await updateDoc(roomRef, {
        status: 'completed',
        'matchSync.isGameOver': true,
      });
    }
  } catch (e) {
    console.warn('Error handling online match leave:', e);
  }
}

/**
 * Helper to strip any undefined keys recursively before sending to Firestore
 */
function stripUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        result[key] = stripUndefined(val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

/**
 * Submits a player's chosen play call to Firestore for the active turn.
 */
export async function submitOnlinePlayCall(
  roomId: string,
  isHost: boolean,
  playCall: SubmittedPlayCall
): Promise<{ success: boolean; error?: string }> {
  if (isFirestoreQuotaExceeded()) {
    return { success: false, error: 'Firestore write quota reached. Match synchronization paused.' };
  }

  const roomRef = doc(db, 'clash_rooms', roomId);
  const field = isHost ? 'hostSubmittedPlay' : 'guestSubmittedPlay';
  const roleKey = isHost ? 'host' : 'guest';
  const userId = playCall.userId;
  const cleanCall = stripUndefined(playCall);
  const lockStatus: PlayerLockStatus = {
    isLocked: true,
    userId,
    lockedAt: Date.now(),
  };

  console.log(`[Online] Submitting play as ${roleKey} (${userId}) to ${field}`, cleanCall);

  try {
    // 1. Try dot notation updateDoc
    await updateDoc(roomRef, {
      [`matchSync.${field}`]: cleanCall,
      [`matchSync.playersLocked.${roleKey}`]: lockStatus,
      [`matchSync.playersLocked.${userId}`]: lockStatus,
    });
    console.log(`[Online] Play submitted and locked successfully via updateDoc to ${field}`);
    return { success: true };
  } catch (e: any) {
    if (isQuotaError(e)) {
      markFirestoreQuotaExceeded();
      return { success: false, error: 'Firestore write quota reached. Match synchronization paused.' };
    }
    console.warn(`[Online] updateDoc failed on ${field}, trying setDoc fallback:`, e?.message);
    try {
      // 2. Resilient fallback using setDoc with merge
      await setDoc(roomRef, {
        matchSync: {
          [field]: cleanCall,
          playersLocked: {
            [roleKey]: lockStatus,
            [userId]: lockStatus,
          }
        }
      }, { merge: true });
      console.log(`[Online] Play submitted and locked successfully via setDoc fallback to ${field}`);
      return { success: true };
    } catch (fallbackErr: any) {
      if (isQuotaError(fallbackErr)) {
        markFirestoreQuotaExceeded();
      } else {
        console.error('[Online] Fatal: Failed to submit play call:', fallbackErr);
      }
      return { success: false, error: fallbackErr?.message || e?.message };
    }
  }
}

const lastSyncTurnCache = new Map<string, string>();

/**
 * Updates full match state after a play is executed.
 * Optimized to only update relevant matchSync fields using dot notation with setDoc fallback.
 */
export async function updateOnlineMatchSync(
  roomId: string,
  updatedSync: OnlineMatchSyncData
): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;

  // Deduplicate identical sync updates for the same room and turn/state to conserve writes
  const syncKey = `${roomId}_T${updatedSync.turnNumber}_${updatedSync.down}_${updatedSync.yardLine}_${updatedSync.homeScore}_${updatedSync.awayScore}_${updatedSync.hostSubmittedPlay ? 1 : 0}_${updatedSync.guestSubmittedPlay ? 1 : 0}`;
  if (lastSyncTurnCache.get(roomId) === syncKey) {
    console.log(`[Online] Deduplicated redundant match sync write for key: ${syncKey}`);
    return;
  }
  lastSyncTurnCache.set(roomId, syncKey);

  console.log(`[Online] Updating match sync for room ${roomId}`, updatedSync);
  const roomRef = doc(db, 'clash_rooms', roomId);
  const cleanLastResult = updatedSync.lastPlayResult ? stripUndefined(updatedSync.lastPlayResult) : null;
  const defaultResetLocked: PlayersLockedMap = updatedSync.playersLocked || {
    host: { isLocked: false },
    guest: { isLocked: false },
  };

  try {
    // Surgical update of matchSync fields
    await updateDoc(roomRef, {
      'matchSync.turnNumber': updatedSync.turnNumber,
      'matchSync.possessionUserId': updatedSync.possessionUserId,
      'matchSync.down': updatedSync.down,
      'matchSync.distance': updatedSync.distance,
      'matchSync.yardLine': updatedSync.yardLine,
      'matchSync.homeScore': updatedSync.homeScore,
      'matchSync.awayScore': updatedSync.awayScore,
      'matchSync.quarter': updatedSync.quarter,
      'matchSync.quarterTimeSeconds': updatedSync.quarterTimeSeconds,
      'matchSync.hostSubmittedPlay': updatedSync.hostSubmittedPlay ?? null,
      'matchSync.guestSubmittedPlay': updatedSync.guestSubmittedPlay ?? null,
      'matchSync.playersLocked': defaultResetLocked,
      'matchSync.lastPlayResult': cleanLastResult,
      'matchSync.isGameOver': updatedSync.isGameOver || false,
      'updatedAt': serverTimestamp()
    });
    console.log(`[Online] Match sync updated successfully for turn ${updatedSync.turnNumber}`);
  } catch (e: any) {
    if (isQuotaError(e)) {
      markFirestoreQuotaExceeded();
      return;
    }
    console.warn('[Online] updateOnlineMatchSync updateDoc failed, attempting setDoc merge fallback:', e);
    try {
      await setDoc(roomRef, {
        matchSync: {
          turnNumber: updatedSync.turnNumber,
          possessionUserId: updatedSync.possessionUserId,
          down: updatedSync.down,
          distance: updatedSync.distance,
          yardLine: updatedSync.yardLine,
          homeScore: updatedSync.homeScore,
          awayScore: updatedSync.awayScore,
          quarter: updatedSync.quarter,
          quarterTimeSeconds: updatedSync.quarterTimeSeconds,
          hostSubmittedPlay: updatedSync.hostSubmittedPlay ?? null,
          guestSubmittedPlay: updatedSync.guestSubmittedPlay ?? null,
          playersLocked: defaultResetLocked,
          lastPlayResult: cleanLastResult,
          isGameOver: updatedSync.isGameOver || false,
        }
      }, { merge: true });
      console.log(`[Online] Match sync updated via setDoc fallback for turn ${updatedSync.turnNumber}`);
    } catch (fallbackErr: any) {
      if (isQuotaError(fallbackErr)) {
        markFirestoreQuotaExceeded();
      } else {
        console.error('[Online] Fatal: Failed to update match sync:', fallbackErr);
      }
    }
  }
}

/**
 * Fetches all online shared auctions from Firestore.
 * Automatically removes any auctions whose timer has expired.
 */
export async function fetchOnlineAuctions(): Promise<AuctionListing[]> {
  if (isFirestoreQuotaExceeded()) {
    return [];
  }
  try {
    const auctionsRef = collection(db, 'clash_auctions');
    const snap = await getDocs(auctionsRef);

    if (snap.empty) {
      return [];
    }

    const now = Date.now();
    const active: AuctionListing[] = [];

    for (const d of snap.docs) {
      const data = d.data() as AuctionListing;
      if (!data.sellerUserId || data.sellerUserId === 'system') continue;

      const expiresAt = data.expiresAt || (data.listedAt + (data.timeLeftMinutes || 60) * 60 * 1000);
      if (now >= expiresAt) {
        // Auction timer has expired: auto-delete from Firestore
        deleteDoc(d.ref).catch(() => {});
      } else {
        const remainingMinutes = Math.max(1, Math.round((expiresAt - now) / 60000));
        active.push({
          ...data,
          expiresAt,
          timeLeftMinutes: remainingMinutes,
        });
      }
    }

    return active;
  } catch (e) {
    if (isQuotaError(e)) {
      markFirestoreQuotaExceeded();
      return [];
    }
    console.warn('Failed to fetch online auctions:', e);
    return [];
  }
}

/**
 * Subscribes to live online auctions from Firestore.
 * Cleans up expired auctions automatically in real time.
 */
export function subscribeToOnlineAuctions(
  callback: (auctions: AuctionListing[]) => void
): () => void {
  if (isFirestoreQuotaExceeded()) {
    return () => {};
  }

  try {
    const auctionsRef = collection(db, 'clash_auctions');
    return onSnapshot(auctionsRef, (snap) => {
      const now = Date.now();
      const active: AuctionListing[] = [];

      for (const d of snap.docs) {
        const data = d.data() as AuctionListing;
        if (!data.sellerUserId || data.sellerUserId === 'system') continue;

        const expiresAt = data.expiresAt || (data.listedAt + (data.timeLeftMinutes || 60) * 60 * 1000);
        if (now >= expiresAt) {
          // Timer expired: auto-delete from Firestore
          deleteDoc(d.ref).catch(() => {});
        } else {
          const remainingMinutes = Math.max(1, Math.round((expiresAt - now) / 60000));
          active.push({
            ...data,
            expiresAt,
            timeLeftMinutes: remainingMinutes,
          });
        }
      }

      callback(active);
    }, (err) => {
      if (isQuotaError(err)) markFirestoreQuotaExceeded();
      console.warn('Auctions subscription error:', err);
    });
  } catch (e) {
    if (isQuotaError(e)) markFirestoreQuotaExceeded();
    return () => {};
  }
}

/**
 * Checks for any expired auctions belonging to the user, deletes them from Firestore,
 * and returns the cards so they can safely return to the user's card binder.
 */
export async function checkAndReclaimExpiredUserAuctions(userId: string): Promise<ClashCard[]> {
  if (isFirestoreQuotaExceeded() || !userId) return [];
  try {
    const auctionsRef = collection(db, 'clash_auctions');
    const q = query(auctionsRef, where('sellerUserId', '==', userId));
    const snap = await getDocs(q);
    const now = Date.now();
    const returnedCards: ClashCard[] = [];

    for (const d of snap.docs) {
      const data = d.data() as AuctionListing;
      const expiresAt = data.expiresAt || (data.listedAt + (data.timeLeftMinutes || 60) * 60 * 1000);
      if (now >= expiresAt) {
        await deleteDoc(d.ref);
        if (data.card) {
          returnedCards.push(data.card);
        }
      }
    }

    return returnedCards;
  } catch (e) {
    if (isQuotaError(e)) markFirestoreQuotaExceeded();
    return [];
  }
}

/**
 * Cancels a user's own online auction and deletes it from Firestore.
 */
export async function cancelOnlineAuction(listingId: string): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) return false;
  try {
    await deleteDoc(doc(db, 'clash_auctions', listingId));
    return true;
  } catch (e) {
    if (isQuotaError(e)) markFirestoreQuotaExceeded();
    return false;
  }
}

/**
 * Removes all auctions created by the system.
 */
export async function clearSystemAuctions(): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  try {
    const auctionsRef = collection(db, 'clash_auctions');
    const q = query(auctionsRef, where('sellerUserId', '==', 'system'));
    const snap = await getDocs(q);
    
    for (const doc of snap.docs) {
      await deleteDoc(doc.ref);
    }
  } catch (e) {
    if (isQuotaError(e)) {
      markFirestoreQuotaExceeded();
      return;
    }
    console.error('Failed to clear system auctions:', e);
  }
}

/**
 * Posts a player card to the shared online Auction House in Firestore with a custom expiration timer.
 */
export async function postPlayerToOnlineAuction(
  card: ClashCard,
  buyNowPrice: number,
  sellerName: string,
  durationMinutes: number = 60
): Promise<AuctionListing> {
  const userId = getOnlineUserId();
  const now = Date.now();
  const listingId = `auc-user-${card.id}-${now}`;
  const expiresAt = now + durationMinutes * 60 * 1000;
  
  const listing: AuctionListing = {
    id: listingId,
    card,
    buyNowPrice,
    currentBid: Math.max(1, buyNowPrice - 1),
    seller: sellerName,
    sellerUserId: userId,
    timeLeftMinutes: durationMinutes,
    durationMinutes,
    expiresAt,
    listedAt: now,
  };

  if (isFirestoreQuotaExceeded()) {
    throw new Error('Firestore daily quota reached. Online auctions are paused until tomorrow.');
  }

  try {
    await setDoc(doc(db, 'clash_auctions', listingId), listing);
  } catch (e) {
    if (isQuotaError(e)) {
      markFirestoreQuotaExceeded();
      throw new Error('Firestore daily quota reached. Online auctions are paused until tomorrow.');
    }
    handleFirestoreError(e, OperationType.WRITE, `clash_auctions/${listingId}`);
  }

  return listing;
}

/**
 * Purchases a card from the shared online Auction House, removing it from Firestore
 * and crediting the seller's balance with the full purchase amount in Grid Irons.
 */
export async function buyPlayerFromOnlineAuction(
  listing: AuctionListing,
  buyerUserId: string
): Promise<{ success: boolean; error?: string }> {
  if (isFirestoreQuotaExceeded()) {
    return { success: false, error: 'Firestore daily quota reached. Online transactions paused until tomorrow.' };
  }

  try {
    const docRef = doc(db, 'clash_auctions', listing.id);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return { success: false, error: 'This player has already been sold or the auction timer expired.' };
    }

    // Check if listing has expired before allowing purchase
    const data = snap.data() as AuctionListing;
    const expiresAt = data.expiresAt || (data.listedAt + (data.timeLeftMinutes || 60) * 60 * 1000);
    if (Date.now() >= expiresAt) {
      await deleteDoc(docRef).catch(() => {});
      return { success: false, error: 'This auction has expired and is no longer available.' };
    }

    if (listing.sellerUserId === buyerUserId) {
      return { success: false, error: 'You cannot buy your own card from the auction house. You can cancel your listing to reclaim it.' };
    }

    // Delete listing from the shared market so nobody else can buy it
    await deleteDoc(docRef);

    // Credit seller in their user document and record sale notice
    const sellerId = listing.sellerUserId;
    if (sellerId && sellerId !== 'system' && sellerId !== buyerUserId) {
      try {
        // 1. Update Leaderboard (public stats)
        const leaderRef = doc(db, 'clash_leaderboard', sellerId);
        await updateDoc(leaderRef, {
          gridIrons: increment(listing.buyNowPrice),
          updatedAt: Date.now(),
        }).catch(() => {});

        // 2. Update Seller's persistent User document (real money update)
        const sellerUserRef = doc(db, 'users', sellerId);
        const transaction: ClashTransaction = {
          id: `tx-sale-${Date.now()}`,
          type: 'sell',
          description: `Sold ${listing.card.name} (${listing.card.ovr} OVR) on auction house`,
          cardName: listing.card.name,
          amount: listing.buyNowPrice,
          timestamp: Date.now(),
        };
        
        await setDoc(sellerUserRef, {
          gridIrons: increment(listing.buyNowPrice),
          transactions: arrayUnion(transaction),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // 3. Post a persistent sale notice so seller receives in-game celebration banner
        const saleRef = doc(db, 'clash_sales', `sale-${listing.id}`);
        await setDoc(saleRef, {
          id: `sale-${listing.id}`,
          sellerUserId: sellerId,
          buyerUserId,
          sellerName: listing.seller,
          cardName: listing.card.name,
          cardOvr: listing.card.ovr,
          cardPosition: listing.card.position,
          price: listing.buyNowPrice,
          timestamp: Date.now(),
          claimed: false,
        });
      } catch (err) {
        if (isQuotaError(err)) {
          markFirestoreQuotaExceeded();
        }
        console.warn('Failed to credit seller (may be offline or restricted):', err);
      }
    }

    return { success: true };
  } catch (e: any) {
    if (isQuotaError(e)) {
      markFirestoreQuotaExceeded();
      return { success: false, error: 'Firestore daily quota reached. Transaction completed locally.' };
    }
    handleFirestoreError(e, OperationType.DELETE, `clash_auctions/${listing.id}`);
    return { success: false, error: e?.message || 'Failed to complete online transaction.' };
  }
}

/**
 * Subscribes to real-time sale events for a seller, triggering a notification when another user purchases their card.
 */
export function subscribeToUserSales(
  userId: string,
  onSaleClaimed: (sale: { cardName: string; cardOvr: number; price: number }) => void
): () => void {
  if (isFirestoreQuotaExceeded() || !userId) return () => {};
  try {
    const q = query(
      collection(db, 'clash_sales'),
      where('sellerUserId', '==', userId),
      where('claimed', '==', false)
    );
    return onSnapshot(q, (snap) => {
      snap.docs.forEach((d) => {
        const saleData = d.data();
        updateDoc(d.ref, { claimed: true }).catch(() => {});
        onSaleClaimed({
          cardName: saleData.cardName,
          cardOvr: saleData.cardOvr,
          price: saleData.price,
        });
      });
    }, (err) => {
      if (isQuotaError(err)) markFirestoreQuotaExceeded();
    });
  } catch (e) {
    return () => {};
  }
}
