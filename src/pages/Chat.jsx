import { useState, useEffect } from 'react'
import { auth, db } from '../firebase'
import { collection, onSnapshot, doc, query, where, orderBy, setDoc } from 'firebase/firestore'
import Sidebar from '../components/Sidebar'
import ChatWindow from '../components/ChatWindow'
import '../styles/chat.css'
import Discover from '../components/Discover'

function Chat({ userData }) {
    const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [unreadCounts, setUnreadCounts] = useState({})
  const [lastMessages, setLastMessages] = useState({})
  const currentUser = auth.currentUser
  const [showDiscover, setShowDiscover] = useState(false)

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs
        .map((doc) => doc.data())
        .filter((u) => u.uid !== currentUser.uid)
      setUsers(allUsers)
    })

    // Set user as online
    setDoc(doc(db, 'users', currentUser.uid), { online: true }, { merge: true })

    const handleOffline = () => {
      setDoc(doc(db, 'users', currentUser.uid), { online: false }, { merge: true })
    }
    window.addEventListener('beforeunload', handleOffline)

    return () => {
      unsubscribe()
      window.removeEventListener('beforeunload', handleOffline)
    }
  }, [])

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
      userData={userData}
      users={users}
      selectedUser={selectedUser}
      onSelectUser={(user) => { setSelectedUser(user) }}
      unreadCounts={unreadCounts}
      lastMessages={lastMessages}
      onDiscoverOpen={() => setShowDiscover(true)}
      className={selectedUser ? 'hidden' : ''}
    />
    <ChatWindow
      currentUser={currentUser}
      selectedUser={selectedUser}
      onClose={() => setSelectedUser(null)}
      className={selectedUser ? 'visible' : ''}
    />
    {showDiscover && (
      <Discover
        currentUser={currentUser}
        userData={userData}
        onSelectUser={setSelectedUser}
        onClose={() => setShowDiscover(false)}
      />
    )}
  </div>
)
}

export default Chat