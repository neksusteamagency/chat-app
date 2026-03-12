import { useState, useEffect } from 'react'
import { auth, db } from '../firebase'
import { collection, onSnapshot, doc, query, where, orderBy, setDoc, getDocs, deleteDoc } from 'firebase/firestore'
import Sidebar from '../components/Sidebar'
import ChatWindow from '../components/ChatWindow'
import '../styles/chat.css'
import Discover from '../components/Discover'

function Chat({ userData }) {
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [unreadCounts, setUnreadCounts] = useState({})
  const [lastMessages, setLastMessages] = useState({})
  const [showDiscover, setShowDiscover] = useState(false)
  const [pinnedChats, setPinnedChats] = useState([])
  const [blockedUsers, setBlockedUsers] = useState([])
  const [blockedByUsers, setBlockedByUsers] = useState([])
  const currentUser = auth.currentUser

  // Load users
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs
        .map((doc) => doc.data())
        .filter((u) => u.uid !== currentUser.uid)
      setUsers(allUsers)
    })

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

  // Load pinned chats
  useEffect(() => {
    const userDoc = doc(db, 'users', currentUser.uid)
    const unsub = onSnapshot(userDoc, (snap) => {
      if (snap.exists()) {
        setPinnedChats(snap.data().pinnedChats || [])
      }
    })
    return () => unsub()
  }, [])

  // Load users I blocked
  useEffect(() => {
    const q = query(collection(db, 'blocks'), where('blockerId', '==', currentUser.uid))
    const unsub = onSnapshot(q, (snap) => {
      setBlockedUsers(snap.docs.map((d) => d.data().blockedId))
    })
    return () => unsub()
  }, [])

  // Load users who blocked me
  useEffect(() => {
    const q = query(collection(db, 'blocks'), where('blockedId', '==', currentUser.uid))
    const unsub = onSnapshot(q, (snap) => {
      setBlockedByUsers(snap.docs.map((d) => d.data().blockerId))
    })
    return () => unsub()
  }, [])

  // Auto-close chat if block happens
  useEffect(() => {
    if (!selectedUser) return
    if (blockedUsers.includes(selectedUser.uid) || blockedByUsers.includes(selectedUser.uid)) {
      setSelectedUser(null)
    }
  }, [blockedUsers, blockedByUsers, selectedUser])

  // Unread counts
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

  // Last messages
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
        setLastMessages((prev) => ({
          ...prev,
          [user.uid]: snapshot.empty ? null : snapshot.docs[0].data()
        }))
      })
    })
    return () => unsubscribes.forEach((unsub) => unsub())
  }, [users])

  const handlePinChat = async (uid) => {
    let newPinned
    if (pinnedChats.includes(uid)) {
      newPinned = pinnedChats.filter((id) => id !== uid)
    } else {
      if (pinnedChats.length >= 3) return alert('You can only pin up to 3 chats!')
      newPinned = [...pinnedChats, uid]
    }
    setPinnedChats(newPinned)
    await setDoc(doc(db, 'users', currentUser.uid), { pinnedChats: newPinned }, { merge: true })
  }

const handleBlockUser = async (uid) => {
  await setDoc(doc(db, 'blocks', `${currentUser.uid}_${uid}`), {
    blockerId: currentUser.uid,
    blockedId: uid,
    createdAt: new Date(),
  })
  setSelectedUser(null)
}

  return (
    <div className="chat-container">
      <Sidebar
        currentUser={currentUser}
        userData={userData}
        users={users.filter((u) => !blockedUsers.includes(u.uid) && !blockedByUsers.includes(u.uid))}
        selectedUser={selectedUser}
        onSelectUser={setSelectedUser}
        unreadCounts={unreadCounts}
        lastMessages={lastMessages}
        onDiscoverOpen={() => setShowDiscover(true)}
        className={selectedUser ? 'hidden' : ''}
        pinnedChats={pinnedChats}
        onPinChat={handlePinChat}
      />
      <ChatWindow
        currentUser={currentUser}
        userData={userData}
        selectedUser={selectedUser}
        onClose={() => setSelectedUser(null)}
        className={selectedUser ? 'visible' : ''}
        onBlockUser={handleBlockUser}
        pinnedChats={pinnedChats}
        onPinChat={handlePinChat}
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