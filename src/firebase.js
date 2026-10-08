import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  writeBatch, // Added for batch operations
  runTransaction, // Added for transactions
  orderBy, // This is the new import you need
  serverTimestamp,
  startAfter,
  limit,
  collectionGroup,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPhoneNumber,
  onAuthStateChanged,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  signInAnonymously,
} from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAXCBAzf3MA9dERbU3QsURgBh1ZEbH5QQE",
  authDomain: "kiyuziyu-7ca67.firebaseapp.com",
  projectId: "kiyuziyu-7ca67",
  storageBucket: "kiyuziyu-7ca67.firebasestorage.app",
  messagingSenderId: "703805908757",
  appId: "1:703805908757:web:b24134e6dedb1f77a96b1c",
  measurementId: "G-P3S47Z7P2N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Export all necessary services and functions
export {
  db,
  collection,
  getDocs,
  addDoc,
  getDoc,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  auth,
  signInWithPhoneNumber,
  onAuthStateChanged,
  RecaptchaVerifier,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  query,
  where,
  writeBatch,
  runTransaction,
  orderBy,
  serverTimestamp,
  signOut,  // Exporting the newly added function
  signInAnonymously,
  limit,
  startAfter,
  collectionGroup,
  getStorage,
};