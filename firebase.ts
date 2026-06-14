import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  User, 
  setPersistence, 
  browserLocalPersistence, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocFromServer,
  increment,
  initializeFirestore,
  enableIndexedDbPersistence,
  writeBatch
} from 'firebase/firestore';

import firebaseConfig from './firebase-applet-config.json';

// ─────────────────────────────────────────────────────────────
// Firebase init
// experimentalForceLongPolling kept for AI Studio sandbox
// ─────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

console.log(`%c[Diagnostic] Initializing Firestore. Database: ${databaseId}`, 'color: blue; font-weight: bold;');

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, databaseId);

try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firebase] IndexedDB persistence unavailable: multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firebase] IndexedDB persistence not supported in this browser.');
    } else {
      console.warn('[Firebase] IndexedDB persistence error:', err);
    }
  });
} catch (err) {
  console.warn('[Firebase] IndexedDB persistence threw synchronously:', err);
}

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);
export const googleProvider = new GoogleAuthProvider();

console.log(`%c[Diagnostic] Firebase initialized for project: ${firebaseConfig.projectId}`, 'color: blue; font-weight: bold;');
console.log(`%c[Diagnostic] Targeted Database ID: ${databaseId}`, 'color: blue;');

if (databaseId !== '(default)') {
  console.log(`%c[Diagnostic] Warning: Using non-default database. Deployment targets must match this ID.`, 'color: orange;');
}

if (!(firebaseConfig as any).apiKey) {
  console.error("%c[Diagnostic] FATAL: API Key is missing in firebase-applet-config.json", 'color: red; font-size: 14px;');
}

// ─────────────────────────────────────────────────────────────
// Identity constants
// LOCATION_ID kept for backward compatibility with existing code
// BUSINESS_ID + SITE_ID used for Phase 2 multi-tenant structure
// BOOTSTRAP_ADMIN_EMAIL replaces hardcoded email in App.tsx
// ─────────────────────────────────────────────────────────────
export const LOCATION_ID           = 'loc_camden';       // Phase 1 — keep until Phase 2 migration
export const BUSINESS_ID           = 'biz_backbone';     // Phase 2 ready
export const SITE_ID               = 'site_camden';      // Phase 2 ready
export const BOOTSTRAP_ADMIN_EMAIL = 'saga00@gmail.com'; // Phase 4 — replaced by onboarding flow

// ─────────────────────────────────────────────────────────────
// Path helpers
// userPath = current Phase 1 structure
// sitePath = Phase 2 multi-tenant structure (not yet active)
// ─────────────────────────────────────────────────────────────
export const userPath = (userId: string, sub: string) =>
  `users/${userId}/${sub}`;

export const sitePath = (sub: string) =>
  `businesses/${BUSINESS_ID}/sites/${SITE_ID}/${sub}`;

// ─────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST   = 'list',
  GET    = 'get',
  WRITE  = 'write',
}

export interface FirestoreErrorInfo {
  error:         string;
  databaseId:    string;
  operationType: OperationType;
  path:          string | null;
  authInfo: {
    userId:        string | undefined;
    email:         string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous:   boolean | undefined;
    tenantId:      string | null | undefined;
    providerInfo: {
      providerId:  string;
      displayName: string | null;
      email:       string | null;
      photoUrl:    string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: any,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    databaseId: (db as any)._databaseId?.database || databaseId || 'unknown',
    authInfo: {
      userId:        auth.currentUser?.uid,
      email:         auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous:   auth.currentUser?.isAnonymous,
      tenantId:      auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider: any) => ({
          providerId:  provider.providerId,
          displayName: provider.displayName,
          email:       provider.email,
          photoUrl:    provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ─────────────────────────────────────────────────────────────
// Connection test
// ─────────────────────────────────────────────────────────────
export async function testConnection() {
  try {
    const testId  = `diag_${Date.now()}`;
    const testDoc = doc(db, 'diagnostics', testId);
    console.log(`[Diagnostic] Attempting WRITE to: ${testDoc.path} on database: ${(db as any)._databaseId?.database || databaseId}`);

    await setDoc(testDoc, {
      timestamp:  Date.now(),
      locationId: LOCATION_ID,
      userId:     auth.currentUser?.uid || 'anonymous',
    });
    console.log('[Diagnostic] Firestore WRITE SUCCESSFUL.');

    const snap = await getDocFromServer(testDoc);
    if (snap.exists()) {
      console.log('[Diagnostic] Firestore READ SUCCESSFUL.');
    } else {
      console.warn('[Diagnostic] Firestore READ returned empty document.');
    }

    await deleteDoc(testDoc);
    console.log('[Diagnostic] Firestore DELETE SUCCESSFUL.');
  } catch (error: any) {
    console.error('%c[Diagnostic] Firestore Connectivity Test FAILED:', 'color: red;', error);
    if (error.code === 'permission-denied') {
      console.error('[Diagnostic] Error: permission-denied. Current Auth UID:', auth.currentUser?.uid);
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Clean object — strips undefined before Firestore writes
// ─────────────────────────────────────────────────────────────
export function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => cleanObject(item));

  const result: any = {};
  Object.keys(obj).forEach((key) => {
    const val = obj[key];
    if (val !== undefined) {
      result[key] = cleanObject(val);
    }
  });
  return result;
}

// ─────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────
export {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  deleteDoc, onSnapshot, query, where, orderBy, limit,
  onAuthStateChanged, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail,
  signOut, increment, writeBatch,
};
export type { User };