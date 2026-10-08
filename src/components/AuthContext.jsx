import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';
import {
  auth,
  db,
  doc,
  onAuthStateChanged,
  getDoc,
  signOut,
  collection,
  query,
  where,
  getDocs,
} from '../firebase';

import {
  DEFAULT_ROLE,
  getRoleConfig,
} from '../config/roles';

/* =======================
   CONTEXT
======================= */

export const AuthContext = createContext();

/* =======================
   PROVIDER
======================= */

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(DEFAULT_ROLE);
  const [roleConfig, setRoleConfig] = useState(getRoleConfig(DEFAULT_ROLE));
  const [isLoading, setIsLoading] = useState(true);

  const logout = () => signOut(auth);

  /* =======================
     FETCH USER PROFILE
  ======================= */

  const fetchUserProfile = async (user) => {
    if (!user) {
      setUserRole(DEFAULT_ROLE);
      setRoleConfig(getRoleConfig(DEFAULT_ROLE));
      return;
    }

    const uid = user.uid;
    let userDocSnap = null;

    // 1️⃣ PRIMARY: users/{uid}
    const directRef = doc(db, 'users', uid);
    const directSnap = await getDoc(directRef);

    if (directSnap.exists()) {
      userDocSnap = directSnap;
    } else {
      // 2️⃣ FALLBACK: users where uid == user.uid
      const q = query(
        collection(db, 'users'),
        where('uid', '==', uid)
      );

      const qs = await getDocs(q);
      if (!qs.empty) {
        userDocSnap = qs.docs[0];
      }
    }

    // 3️⃣ ROLE RESOLUTION
    const resolvedRole =
      userDocSnap?.data()?.role || DEFAULT_ROLE;

    setUserRole(resolvedRole);
    setRoleConfig(getRoleConfig(resolvedRole));
  };

  /* =======================
     AUTH LISTENER
  ======================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      await fetchUserProfile(user);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* =======================
     DEBUG (SAFE)
  ======================= */

  useEffect(() => {
    console.log('🔥 AUTH DEBUG');
    console.log('currentUser:', currentUser);
    console.log('userRole:', userRole);
    console.log('roleConfig:', roleConfig);
  }, [currentUser, userRole, roleConfig]);

  /* =======================
     CONTEXT VALUE
  ======================= */

  const value = {
    currentUser,
    userRole,     // ✅ THIS IS WHAT COUPONS USE
    roleConfig,   // ✅ PRICING / MIN ORDER USE THIS
    isLoading,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

/* =======================
   HOOK
======================= */

export const useAuth = () => useContext(AuthContext);
