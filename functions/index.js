const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const admin = require('firebase-admin')

admin.initializeApp()

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