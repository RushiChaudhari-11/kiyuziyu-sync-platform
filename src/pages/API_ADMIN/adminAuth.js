import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from '../../firebase';

/**
 * Get fresh Firebase ID token for currently signed-in user.
 */
export const getIdToken = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated.');
  return user.getIdToken(true);
};

/**
 * Fetch Admin Profile from Firestore adminUsers collection.
 */
export const getAdminProfile = async (uid) => {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'adminUsers', uid));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (err) {
    console.error('Error fetching admin profile:', err);
    return null;
  }
};

/**
 * Fetch Tenant Profile from Firestore apiUsers collection.
 */
export const getTenantProfile = async (uid) => {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'apiUsers', uid));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (err) {
    console.error('Error fetching tenant profile:', err);
    return null;
  }
};

/**
 * Get current user session type & profile from Firestore (checks adminUsers then apiUsers).
 */
export const getUserSession = async (uid) => {
  if (!uid) return null;
  try {
    const adminSnap = await getDoc(doc(db, 'adminUsers', uid));
    if (adminSnap.exists()) {
      const profile = adminSnap.data();
      if (
        profile.status === 'ACTIVE' &&
        (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN')
      ) {
        return { type: 'ADMIN', profile, redirect: '/admin/dashboard' };
      }
    }

    const tenantUserSnap = await getDoc(doc(db, 'apiUsers', uid));
    if (tenantUserSnap.exists()) {
      const profile = tenantUserSnap.data();
      if (
        profile.status === 'ACTIVE' &&
        ['OWNER', 'STORE_MANAGER', 'STAFF'].includes(profile.role)
      ) {
        return { type: 'TENANT', profile, redirect: '/tenant/dashboard' };
      }
    }
    return null;
  } catch (err) {
    console.error('Error fetching user session:', err);
    return null;
  }
};

/**
 * Unified Sign-In for Admin & Tenant Portal.
 * 1. Firebase Auth signInWithEmailAndPassword
 * 2. Get Firebase UID
 * 3. Check adminUsers/{uid}:
 *    - if found & active & ADMIN/SUPER_ADMIN -> redirect to /admin/dashboard
 * 4. Check apiUsers/{uid}:
 *    - if found & active & OWNER/STORE_MANAGER/STAFF -> redirect to /tenant/dashboard
 * 5. If found in neither:
 *    - sign out & throw error: "This account is not authorized for the Admin/Tenant Portal."
 */
export const unifiedSignIn = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // 1. Check adminUsers/{uid}
  const adminSnap = await getDoc(doc(db, 'adminUsers', user.uid));
  if (adminSnap.exists()) {
    const profile = adminSnap.data();
    if (profile.status !== 'ACTIVE') {
      await signOut(auth);
      throw new Error('Your admin account is inactive. Contact the system administrator.');
    }
    if (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN') {
      await signOut(auth);
      throw new Error('Access denied.');
    }
    return { type: 'ADMIN', user, profile, redirect: '/admin/dashboard' };
  }

  // 2. Check apiUsers/{uid}
  const tenantUserSnap = await getDoc(doc(db, 'apiUsers', user.uid));
  if (tenantUserSnap.exists()) {
    const profile = tenantUserSnap.data();
    if (profile.status !== 'ACTIVE') {
      await signOut(auth);
      throw new Error('Your tenant account is inactive. Contact system administrator.');
    }
    const allowedRoles = ['OWNER', 'STORE_MANAGER', 'STAFF'];
    if (!allowedRoles.includes(profile.role)) {
      await signOut(auth);
      throw new Error('Access denied.');
    }
    return { type: 'TENANT', user, profile, redirect: '/tenant/dashboard' };
  }

  // 3. User in neither collection
  await signOut(auth);
  throw new Error('This account is not authorized for the Admin/Tenant Portal.');
};

/**
 * Legacy adminSignIn for backwards compatibility.
 */
export const adminSignIn = async (email, password) => {
  const result = await unifiedSignIn(email, password);
  if (result.type !== 'ADMIN') {
    await signOut(auth);
    throw new Error('Access denied.');
  }
  return { user: result.user, profile: result.profile };
};

/**
 * Firebase Email/Password account creation for Admin Portal.
 */
export const adminSignUp = async (name, email, password) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  const userRef = doc(db, 'adminUsers', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    name: name,
    email: email,
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { user };
};

/**
 * Sign out from Firebase.
 */
export const adminSignOut = async () => {
  await signOut(auth);
};

/**
 * Get currently authenticated admin user and verified profile.
 */
export const getCurrentAdmin = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  const profile = await getAdminProfile(user.uid);
  if (
    !profile ||
    profile.status !== 'ACTIVE' ||
    (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')
  ) {
    return null;
  }
  return { user, profile };
};

/**
 * Map Firebase error codes and custom validation errors to clear friendly messages.
 */
export const friendlyAuthError = (err) => {
  const code = err.code || '';
  const msg = err.message || '';

  // Custom validation messages passed through directly
  if (
    msg === 'Admin account not found.' ||
    msg === 'Your admin account is inactive. Contact the system administrator.' ||
    msg === 'Your tenant account is inactive. Contact system administrator.' ||
    msg === 'This account is not authorized for the Admin/Tenant Portal.' ||
    msg === 'Access denied.'
  ) {
    return msg;
  }

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    msg.includes('invalid-credential') ||
    msg.includes('wrong-password')
  ) {
    return 'Invalid email or password. Please check your credentials.';
  }
  if (code === 'auth/user-not-found' || msg.includes('user-not-found')) {
    return 'Account not found. Please check your email address.';
  }
  if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
    return 'Too many failed attempts. Please wait a few minutes and try again.';
  }
  if (code === 'auth/email-already-in-use' || msg.includes('email-already-in-use')) {
    return 'Email already registered.';
  }
  if (code === 'auth/weak-password' || msg.includes('weak-password')) {
    return 'Password must be at least 6 characters.';
  }
  if (code === 'auth/invalid-email' || msg.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (
    code === 'auth/network-request-failed' ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('network-request-failed')
  ) {
    return 'Network error. Please check your internet connection.';
  }

  return msg || 'Authentication failed. Please try again.';
};

export const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:8080'
  : 'https://kiyuziyu-api-703805908757.asia-south1.run.app';

