import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, serverTimestamp, set, update } from "firebase/database";

function resolveDatabaseURL(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined") {
    return "https://nexel-ai-default-rtdb.firebaseio.com";
  }
  return raw.replace(/\/+$/, "");
}

const databaseURL = resolveDatabaseURL(import.meta.env.VITE_FIREBASE_DATABASE_URL);

const firebaseConfig = {
  apiKey: "AIzaSyAHr-hJxQ7unmRLW82qXEk-q9rM5X4i3NI",
  authDomain: "nexel-ai.firebaseapp.com",
  databaseURL,
  projectId: "nexel-ai",
  storageBucket: "nexel-ai.firebasestorage.app",
  messagingSenderId: "200268907780",
  appId: "1:200268907780:web:28f62ecaa4a97451b07c51",
  measurementId: "G-EGYM1CQB19",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app, databaseURL);

let analyticsPromise = Promise.resolve(null);

if (typeof window !== "undefined") {
  analyticsPromise = isSupported()
    .then((supported) => (supported ? getAnalytics(app) : null))
    .catch(() => null);
}

async function saveUserProfile(user, { isNewUser = false } = {}) {
  if (!user) {
    return;
  }

  const userRef = ref(db, `users/${user.uid}`);
  const payload = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    lastLoginAt: serverTimestamp(),
  };

  if (isNewUser) {
    await set(userRef, {
      ...payload,
      createdAt: serverTimestamp(),
    });
    return;
  }

  await update(userRef, payload);
}

export { app, auth, db, analyticsPromise, saveUserProfile };
