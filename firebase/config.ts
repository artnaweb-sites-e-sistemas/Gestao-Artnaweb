import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAyYkkbKIm-d6YQcRL0a4KSsrlkDW_EsaY",
  authDomain: "gestao-artnaweb.firebaseapp.com",
  projectId: "gestao-artnaweb",
  storageBucket: "gestao-artnaweb.firebasestorage.app",
  messagingSenderId: "767809552080",
  appId: "1:767809552080:web:2f4ddd752bd2525708e8d5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;

