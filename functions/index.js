const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { onValueWritten } = require('firebase-functions/v2/database')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

admin.initializeApp()

// ---- Push notification on new message ----
exports.sendMessageNotification = onDocumentCreated('notifications/{notifId}', async (event) => {
  const data = event.data?.data()
  if (!data || data.type !== 'new_message') return null

  const userDoc = await admin.firestore().collection('users').doc(data.toUid).get()
  if (!userDoc.exists) return null

  const fcmToken = userDoc.data().fcmToken
  if (!fcmToken) return null

  const message = {
    token: fcmToken,
    notification: {
      title: data.fromUsername,
      body: data.message,
    },
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  }

  try {
    await admin.messaging().send(message)
  } catch (err) {
    console.error('Error sending notification:', err)
  }

  return null
})

// ---- Mark message as delivered when created ----
// Triggers on every new message, checks if recipient is online in RTDB
// If online → mark delivered immediately
exports.onMessageCreated = onDocumentCreated('messages/{messageId}', async (event) => {
  const message = event.data?.data()
  if (!message) return null

  if (message.delivered === true) return null

  const receiverId = message.receiverId
  if (!receiverId) return null

  try {
    const statusSnap = await admin.database().ref(`status/${receiverId}`).get()
    const isOnline = statusSnap.exists() && statusSnap.val().online === true

    if (isOnline) {
      await event.data.ref.update({
        delivered: true,
        deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }
  } catch (err) {
    console.error('Error marking delivered:', err)
  }

  return null
})

// ---- When user comes online, mark all pending messages as delivered ----
// Handles the case where messages were sent while the recipient was offline
exports.onUserOnline = onValueWritten('/status/{uid}', async (event) => {
  const after = event.data.after.val()

  // Only trigger when user comes online
  if (!after || after.online !== true) return null

  const uid = event.params.uid

  try {
    const snapshot = await admin.firestore()
      .collection('messages')
      .where('receiverId', '==', uid)
      .where('delivered', '==', false)
      .get()

    if (snapshot.empty) return null

    const batch = admin.firestore().batch()
    const now = admin.firestore.FieldValue.serverTimestamp()

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        delivered: true,
        deliveredAt: now,
      })
    })

    await batch.commit()
    console.log(`Marked ${snapshot.docs.length} messages as delivered for ${uid}`)
  } catch (err) {
    console.error('Error in onUserOnline:', err)
  }

  return null
})

// ---- Mark all unread messages in a chat as read ----
// Called explicitly from the client when the recipient opens/focuses the chat
exports.markMessagesAsRead = onCall(async (request) => {
  const { chatId } = request.data
  const uid = request.auth?.uid

  if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in')
  if (!chatId) throw new HttpsError('invalid-argument', 'chatId is required')

  try {
    const snapshot = await admin.firestore()
      .collection('messages')
      .where('chatId', '==', chatId)
      .where('receiverId', '==', uid)
      .where('read', '==', false)
      .get()

    if (snapshot.empty) return { updated: 0 }

    const batch = admin.firestore().batch()
    const now = admin.firestore.FieldValue.serverTimestamp()

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        delivered: true,
        deliveredAt: now,
        read: true,
        readAt: now,
      })
    })

    await batch.commit()
    return { updated: snapshot.docs.length }
  } catch (err) {
    console.error('Error marking as read:', err)
    throw new HttpsError('internal', 'Failed to mark messages as read')
  }
})