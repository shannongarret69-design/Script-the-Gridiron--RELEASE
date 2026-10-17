import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  Firestore, 
  enableMultiTabIndexedDbPersistence,
  disableNetwork,
  enableNetwork,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  isFirestoreQuotaExceeded, 
  markFirestoreQuotaExceeded, 
  registerNetworkDisconnector, 
  isQuotaError 
} from './quotaManager';

let app: FirebaseApp;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
  console.warn('Firebase initializeApp notice:', e);
  app = getApps()[0];
}

function initFirestore(): Firestore {
  try {
    let dbInstance: Firestore;
    if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
      try {
        dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
      } catch (err) {
        console.warn(`Could not connect to Firestore with databaseId "${firebaseConfig.firestoreDatabaseId}", falling back to default db:`, err);
        dbInstance = getFirestore(app);
      }
    } else {
      dbInstance = getFirestore(app);
    }

    // Suppress internal SDK verbose retry logs for quota exhausted warnings
    try {
      setLogLevel('silent');
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      // Register disconnector so quotaManager can disable network immediately on quota hit
      registerNetworkDisconnector(
        () => {
          disableNetwork(dbInstance).catch(() => {});
        },
        () => {
          enableNetwork(dbInstance).catch(() => {});
        }
      );

      // If quota was already exceeded in this or previous session, disable network right away
      if (isFirestoreQuotaExceeded()) {
        disableNetwork(dbInstance).catch(() => {});
      } else {
        // Enable persistence to save on READ quota
        enableMultiTabIndexedDbPersistence(dbInstance).catch((err) => {
          if (err.code === 'failed-precondition') {
            console.warn('Firestore persistence notice: Multiple tabs open');
          } else if (err.code === 'unimplemented') {
            console.warn('Firestore persistence notice: Browser not supported');
          }
        });
      }

      // Suppress unhandled promise rejections related to quota exhaustion
      window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && isQuotaError(event.reason)) {
          event.preventDefault();
          markFirestoreQuotaExceeded();
        }
      });
    }
    
    return dbInstance;
  } catch (err) {
    console.warn('Failed to initialize Firestore instance:', err);
    return null as unknown as Firestore;
  }
}

function initAuth(): Auth {
  try {
    return getAuth(app);
  } catch (err) {
    console.warn('Failed to initialize Auth instance:', err);
    return null as unknown as Auth;
  }
}

export const db = initFirestore();
export const auth = initAuth();

// Test server connection on startup
export async function testFirestoreConnection(): Promise<boolean> {
  if (!db || isFirestoreQuotaExceeded()) return false;
  try {
    await getDocFromServer(doc(db, 'players', 'connection_test'));
    return true;
  } catch (error) {
    if (isQuotaError(error)) {
      markFirestoreQuotaExceeded();
      return false;
    }
    return false;
  }
}

