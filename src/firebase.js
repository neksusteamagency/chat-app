import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getMessaging, getToken, onMessage } from "firebase/messaging"

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
export const messaging = getMessaging(app)

export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'BH2B1zU0SC3LsKH358o4CldR_F67G6z-QKaJTTHtAX-LGss5ni9A9P3Fm8I8bSZJXeXmwwRgIAbQ1lmj7lHbYZE'
      })
      return token
    }
  } catch (err) {
    console.error('Notification permission error:', err)
  }
  return null
}

export { onMessage }