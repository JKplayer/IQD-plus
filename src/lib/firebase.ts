import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use the databaseId provided in the config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app, firebaseConfig.storageBucket);
storage.maxUploadRetryTime = 5000; // 5 seconds
storage.maxOperationRetryTime = 5000; // 5 seconds
export const googleProvider = new GoogleAuthProvider();

// Connection Test
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error) {
    console.log("Firestore ready (standard ignore if no document)");
  }
}

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
export const logout = () => signOut(auth);

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

import { toast } from 'sonner';

export function handleFirestoreError(error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null): never {
  const authUser = auth.currentUser;
  const rawError = error.message || String(error);

  // Show user-friendly toast for common errors
  if (rawError.includes('permission-denied') || rawError.includes('Missing or insufficient permissions')) {
    toast.error("Security Protocol Violation: You do not have permission for this node.", {
      description: `Path: ${path || 'root'}`,
      duration: 5000,
    });
  } else if (rawError.includes('offline')) {
    toast.warning("Network Link Unstable: Synchronizing offline data.");
  } else {
    toast.error(`Protcol Error: ${operationType.toUpperCase()} failed.`, {
      description: rawError.slice(0, 50) + '...',
    });
  }

  const errorInfo: FirestoreErrorInfo = {
    error: rawError,
    operationType,
    path,
    authInfo: {
      userId: authUser?.uid || 'anonymous',
      email: authUser?.email || '',
      emailVerified: authUser?.emailVerified || false,
      isAnonymous: authUser?.isAnonymous || true,
      providerInfo: authUser?.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName || '',
        email: p.email || ''
      })) || []
    }
  };
  throw new Error(JSON.stringify(errorInfo));
}
