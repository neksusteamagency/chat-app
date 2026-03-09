import { useState, useEffect } from 'react'
import { auth, db } from '../firebase'
import { collection, onSnapshot, doc, updateDoc, query, where, orderBy  } from 'firebase/firestore'
import Sidebar from '../components/Sidebar'
import ChatWindow from '../components/ChatWindow'
import '../styles/chat.css'

function Chat() {
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [unreadCounts, setUnreadCounts] = useState({})
  const [lastMessages, setLastMessages] = useState({})
  const currentUser = auth.currentUser

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs
        .map((doc) => doc.data())
        .filter((u) => u.uid !== currentUser.uid)
      setUsers(allUsers)
    })

    updateDoc(doc(db, 'users', currentUser.uid), { online: true })

    const handleOffline = () => {
      updateDoc(doc(db, 'users', currentUser.uid), { online: false })
    }
    window.addEventListener('beforeunload', handleOffline)

    return () => {
      unsubscribe()
      window.removeEventListener('beforeunload', handleOffline)
    }
  }, [])

  // Track unread messages for each user
  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      where('receiverId', '==', currentUser.uid),
      where('read', '==', false)
    )

    

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts = {}
      snapshot.docs.forEach((doc) => {
        const senderId = doc.data().senderId
        counts[senderId] = (counts[senderId] || 0) + 1
      })
      setUnreadCounts(counts)
    })

    return () => unsubscribe()
  }, [])

useEffect(() => {
  if (users.length === 0) return

  const unsubscribes = users.map((user) => {
    const chatId = [currentUser.uid, user.uid].sort().join('_')
    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId),
      orderBy('createdAt', 'desc')
    )

    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const last = snapshot.docs[0].data()
        setLastMessages((prev) => ({
          ...prev,
          [user.uid]: last
        }))
      } else {
        setLastMessages((prev) => ({
          ...prev,
          [user.uid]: null
        }))
      }
    })
  })

  return () => unsubscribes.forEach((unsub) => unsub())
}, [users])

  return (
    <div className="chat-container">
      <Sidebar
        currentUser={currentUser}
        users={users}
        selectedUser={selectedUser}
        onSelectUser={setSelectedUser}
        unreadCounts={unreadCounts}
        lastMessages={lastMessages}
      />
      <ChatWindow
        currentUser={currentUser}
        selectedUser={selectedUser}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  )
}

export default Chat