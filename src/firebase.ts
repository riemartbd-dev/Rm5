import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
let app: any = null;
try {
  app = initializeApp(firebaseConfig);
} catch (err) {
  console.warn("[RIEMART Firebase Setup] initializeApp failed or restricted in sandbox:", err);
}

let _dbInstance: any = null;
export const db = new Proxy({} as any, {
  get(target, prop, receiver) {
    if (!app) {
      console.warn("[RIEMART Firebase Setup] Firebase App not initialized, returning mock db property:", String(prop));
      return undefined;
    }
    if (!_dbInstance) {
      try {
        _dbInstance = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
      } catch (err) {
        console.warn("[RIEMART Firebase Setup] getFirestore failed or restricted in sandbox:", err);
        return undefined;
      }
    }
    try {
      const val = Reflect.get(_dbInstance, prop, receiver);
      if (typeof val === 'function') {
        return val.bind(_dbInstance);
      }
      return val;
    } catch (e) {
      return undefined;
    }
  },
  set(target, prop, value, receiver) {
    if (!app) {
      console.warn("[RIEMART Firebase Setup] Firebase App not initialized, cannot set db property:", String(prop));
      return true;
    }
    if (!_dbInstance) {
      try {
        _dbInstance = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
      } catch (err) {
        console.warn("[RIEMART Firebase Setup] getFirestore failed or restricted in sandbox:", err);
        return true;
      }
    }
    try {
      return Reflect.set(_dbInstance, prop, value, receiver);
    } catch (e) {
      return true;
    }
  }
}) as any; /* CRITICAL: The app will break without this line */

let _authInstance: any = null;
export const auth = new Proxy({} as any, {
  get(target, prop, receiver) {
    if (!app) {
      console.warn("[RIEMART Firebase Setup] Firebase App not initialized, returning mock auth property:", String(prop));
      if (prop === 'currentUser') return null;
      return undefined;
    }
    if (!_authInstance) {
      try {
        _authInstance = getAuth(app);
      } catch (err) {
        console.warn("[RIEMART Firebase Setup] getAuth failed or restricted in sandbox:", err);
        if (prop === 'currentUser') return null;
        return undefined;
      }
    }
    try {
      const val = Reflect.get(_authInstance, prop, receiver);
      if (typeof val === 'function') {
        return val.bind(_authInstance);
      }
      return val;
    } catch (e) {
      if (prop === 'currentUser') return null;
      return undefined;
    }
  }
}) as any;

// Operation Types as defined in guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// Firestore Error Info Interface
export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// Firestore Error Handler Wrapper
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
