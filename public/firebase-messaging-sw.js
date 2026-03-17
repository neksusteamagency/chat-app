importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyAoW5NGQtLu9eIVyEXyTTuBgfedBCiZ67o",
  authDomain: "chat-app-d9285.firebaseapp.com",
  projectId: "chat-app-d9285",
  storageBucket: "chat-app-d9285.firebasestorage.app",
  messagingSenderId: "33585420361",
  appId: "1:33585420361:web:4f3e233ebad3a7a455c798"
})

const messaging = firebase.messaging()

// ✅ Handles background messages for Android/desktop
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification
  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
  })
})

// ✅ Handles push events directly — required for iOS PWA
self.addEventListener('push', (event) => {
  let title = 'New message'
  let body = ''

  try {
    const data = event.data?.json()
    title = data?.notification?.title || data?.data?.title || title
    body = data?.notification?.body || data?.data?.body || body
  } catch (e) {
    body = event.data?.text() || ''
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    })
  )
})