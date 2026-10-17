import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { ClashUserData } from '../types/clash';
import { getInitialClashUserData, loadClashUserData, saveClashUserData } from '../utils/clashManager';

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
  const errMessage = error instanceof Error ? error.message : String(error);
  const isQuota = (error as any)?.code === 'resource-exhausted' || errMessage.includes('quota') || errMessage.includes('resource-exhausted');
  if (isQuota) {
    console.warn('Firestore Quota Exceeded (handled gracefully):', errMessage);
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

interface AuthContextType {
  user: User | null;
  userData: ClashUserData | null;
  loading: boolean;
  isQuotaExceeded: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserData: (data: Partial<ClashUserData>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Improved deep equal helper
function isDeepEqual(a: any, b: any, ignoreKeys: string[] = []): boolean {
  if (a === b) return true;
  
  // Handle NaN
  if (typeof a === 'number' && typeof b === 'number' && isNaN(a) && isNaN(b)) return true;

  // Handle null/undefined cross-comparison (Firestore doesn't store undefined)
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;

  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  
  // Distinguish arrays from objects
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i], ignoreKeys)) return false;
    }
    return true;
  }

  // Handle Firestore Timestamps (duck typing)
  const isATimestamp = a && typeof a === 'object' && 'seconds' in a && 'nanoseconds' in a;
  const isBTimestamp = b && typeof b === 'object' && 'seconds' in b && 'nanoseconds' in b;
  
  if (isATimestamp && isBTimestamp) {
    return a.seconds === b.seconds && a.nanoseconds === b.nanoseconds;
  }

  // Handle number vs Timestamp (Duck typing)
  if (typeof a === 'number' && isBTimestamp) {
    return Math.floor(a / 1000) === b.seconds;
  }
  if (isATimestamp && typeof b === 'number') {
    return a.seconds === Math.floor(b / 1000);
  }

  const keysA = Object.keys(a).filter(k => !ignoreKeys.includes(k) && a[k] !== undefined);
  const keysB = Object.keys(b).filter(k => !ignoreKeys.includes(k) && b[k] !== undefined);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key) || !isDeepEqual(a[key], b[key], ignoreKeys)) return false;
  }
  return true;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<ClashUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const userDataRef = useRef<ClashUserData | null>(null);
  
  // Quota Circuit Breaker
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const quotaExceededRef = useRef(false);

  // Debounce queue for writes
  const pendingUpdatesRef = useRef<Partial<ClashUserData>>({});
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isWritingRef = useRef<boolean>(false);
  const lastWriteTimeRef = useRef<number>(0);
  const writeCountInWindowRef = useRef<number>(0);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'players', 'connection_test'));
      } catch (error) {
        if (error instanceof Error && (error.message.includes('quota') || error.message.includes('resource-exhausted'))) {
          quotaExceededRef.current = true;
          setIsQuotaExceeded(true);
        }
      }
    }
    testConnection();

    let unsubscribeData: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (unsubscribeData) {
        unsubscribeData();
        unsubscribeData = null;
      }

      if (currentUser) {
        if (quotaExceededRef.current) {
          const localData = loadClashUserData();
          userDataRef.current = localData;
          setUserData(localData);
          setLoading(false);
          return;
        }

        const userDocRef = doc(db, 'users', currentUser.uid);
        
        try {
          const docSnap = await getDoc(userDocRef);
          if (!docSnap.exists()) {
            const initialData = getInitialClashUserData();
            if (currentUser.displayName) {
              initialData.teamName = `${currentUser.displayName.split(' ')[0]}'s Dynasty`;
            }
            await setDoc(userDocRef, initialData);
          }
        } catch (err: any) {
          if (err?.code === 'resource-exhausted' || err?.message?.includes('quota') || err?.message?.includes('resource-exhausted')) {
            quotaExceededRef.current = true;
            setIsQuotaExceeded(true);
            const localData = loadClashUserData();
            userDataRef.current = localData;
            setUserData(localData);
            setLoading(false);
            return;
          }
          handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
          const localData = loadClashUserData();
          userDataRef.current = localData;
          setUserData(localData);
          setLoading(false);
          return;
        }

        unsubscribeData = onSnapshot(userDocRef, (snapshot) => {
          if (snapshot.exists()) {
            const rawData = snapshot.data() as ClashUserData;
            
            // Normalize data to ensure new fields exist for old accounts
            const newData: ClashUserData = {
              ...rawData,
              defeatedBossIds: rawData.defeatedBossIds || [],
              currentBossTier: rawData.currentBossTier || 1,
            };

            // Ignore updatedAt when comparing to local state to avoid loops from serverTimestamp()
            if (!isDeepEqual(userDataRef.current, newData, ['updatedAt'])) {
              userDataRef.current = newData;
              setTimeout(() => {
                setUserData(newData);
                setLoading(false);
              }, 0);
            } else {
              setTimeout(() => {
                setLoading(false);
              }, 0);
            }
          } else {
            setTimeout(() => {
              setLoading(false);
            }, 0);
          }
        }, (err: any) => {
          if (err?.code === 'resource-exhausted' || err?.message?.includes('quota') || err?.message?.includes('resource-exhausted')) {
            quotaExceededRef.current = true;
            setIsQuotaExceeded(true);
          }
          handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
          const localData = loadClashUserData();
          userDataRef.current = localData;
          setTimeout(() => {
            setUserData(localData);
            setLoading(false);
          }, 0);
        });
      } else {
        // Even if not logged in via Google Auth, load local save data so the user can play!
        const localData = loadClashUserData();
        userDataRef.current = localData;
        setUserData(localData);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeData) {
        const unsub = unsubscribeData;
        setTimeout(() => {
          try { unsub(); } catch (e) {}
        }, 0);
      }
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        // User closed the popup, ignore gracefully
        return;
      }
      console.error('Login error:', err);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const executeBatchUpdate = async () => {
    if (!auth.currentUser || quotaExceededRef.current || isWritingRef.current) return;
    
    // Check write budget (max 10 writes per minute)
    const now = Date.now();
    if (now - lastWriteTimeRef.current < 60000) {
      if (writeCountInWindowRef.current >= 10) {
        console.warn('Write budget exceeded. Postponing update.');
        debounceTimerRef.current = setTimeout(executeBatchUpdate, 5000);
        return;
      }
    } else {
      writeCountInWindowRef.current = 0;
      lastWriteTimeRef.current = now;
    }

    const dataToSave = { ...pendingUpdatesRef.current };
    if (Object.keys(dataToSave).length === 0) {
      debounceTimerRef.current = null;
      return;
    }

    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    isWritingRef.current = true;
    
    try {
      await updateDoc(userDocRef, dataToSave);
      console.log('Firestore write successful:', Object.keys(dataToSave));
      writeCountInWindowRef.current++;
      
      // Success: clear only the keys we just saved
      Object.keys(dataToSave).forEach(key => {
        if (JSON.stringify(pendingUpdatesRef.current[key as keyof ClashUserData]) === JSON.stringify(dataToSave[key as keyof ClashUserData])) {
          delete pendingUpdatesRef.current[key as keyof ClashUserData];
        }
      });
      debounceTimerRef.current = null;
    } catch (err: any) {
      if (err?.code === 'resource-exhausted' || err?.message?.includes('quota') || err?.message?.includes('resource-exhausted')) {
        console.error('Firestore Quota Exceeded. Disabling further writes and falling back to localStorage.');
        quotaExceededRef.current = true;
        setIsQuotaExceeded(true);
        if (userDataRef.current) {
          saveClashUserData(userDataRef.current);
        }
      }
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}`);
      debounceTimerRef.current = null;
    } finally {
      isWritingRef.current = false;
      // If new updates came in during the write, schedule another check
      if (Object.keys(pendingUpdatesRef.current).length > 0) {
        debounceTimerRef.current = setTimeout(executeBatchUpdate, 3000);
      }
    }
  };

  const updateUserData = async (data: Partial<ClashUserData>) => {
    // If quota is exceeded, update local state & localStorage immediately
    if (quotaExceededRef.current) {
      if (userDataRef.current) {
        const updated = { ...userDataRef.current, ...data };
        userDataRef.current = updated;
        setUserData(updated);
        saveClashUserData(updated);
      }
      return;
    }

    if (!auth.currentUser) {
      // Also update local storage if not authenticated
      if (userDataRef.current) {
        const updated = { ...userDataRef.current, ...data };
        userDataRef.current = updated;
        setUserData(updated);
        saveClashUserData(updated);
      }
      return;
    }
    
    // 1. Check if the partial data would actually change anything in our current state
    if (userDataRef.current) {
      const hasChanges = Object.entries(data).some(([key, value]) => {
        return !isDeepEqual(userDataRef.current![key as keyof ClashUserData], value, ['updatedAt']);
      });
      if (!hasChanges) return;
    }

    // 2. Queue the update
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...data };
    
    // Also update local storage immediately for responsive offline feel
    if (userDataRef.current) {
      const updated = { ...userDataRef.current, ...data };
      userDataRef.current = updated;
      setUserData(updated);
      saveClashUserData(updated);
    }

    // 3. Debounce the actual Firestore write (3 second batching)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(executeBatchUpdate, 3000);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, isQuotaExceeded, login, logout, updateUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
