const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { onValueWritten } = require('firebase-functions/v2/database')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

admin.initializeApp()

// ---- Push notification on new message ----
// Sends to ALL devices the user is logged in on (iPhone + desktop etc.)
exports.sendMessageNotification = onDocumentCreated('notifications/{notifId}', async (event) => {
  const data = event.data?.data()
  if (!data || data.type !== 'new_message') return null

  const userDoc = await admin.firestore().collection('users').doc(data.toUid).get()
  if (!userDoc.exists) return null

  const userData = userDoc.data()

  // ✅ Support both old single token and new array of tokens
  let tokens = []
  if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
    tokens = userData.fcmTokens
  } else if (userData.fcmToken) {
    tokens = [userData.fcmToken]
  }

  if (tokens.length === 0) return null

  const notification = {
    title: data.fromUsername,
    body: data.message,
  }

  // Send to all tokens, collect invalid ones to clean up
  const invalidTokens = []
  await Promise.all(
    tokens.map(async (token) => {
      try {
        await admin.messaging().send({
          token,
          notification,
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        })
      } catch (err) {
        // Token is invalid or expired — mark for removal
        if (
          err.code === 'messaging/invalid-registration-token' ||
          err.code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(token)
        } else {
          console.error('Error sending to token:', token, err)
        }
      }
    })
  )

  // ✅ Clean up invalid tokens from Firestore
  if (invalidTokens.length > 0) {
    const validTokens = tokens.filter((t) => !invalidTokens.includes(t))
    await admin.firestore().collection('users').doc(data.toUid).update({
      fcmTokens: validTokens,
    })
    console.log(`Removed ${invalidTokens.length} invalid tokens for ${data.toUid}`)
  }

  return null
})

// ---- Mark message as delivered when created ----
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
exports.onUserOnline = onValueWritten('/status/{uid}', async (event) => {
  const after = event.data.after.val()

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