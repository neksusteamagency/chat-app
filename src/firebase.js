import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyAoW5NGQtLu9eIVyEXyTTuBgfedBCiZ67o",
  authDomain: "chat-app-d9285.firebaseapp.com",
  projectId: "chat-app-d9285",
  storageBucket: "chat-app-d9285.firebasestorage.app",
  messagingSenderId: "33585420361",
  appId: "1:33585420361:web:4f3e233ebad3a7a455c798"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)