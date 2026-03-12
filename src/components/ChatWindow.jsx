import { useState, useEffect, useRef } from 'react'
import { db, messaging, onMessage } from '../firebase'
import {
  collection, addDoc, query, orderBy,
  onSnapshot, serverTimestamp, where,
  updateDoc, doc, setDoc, getDocs, deleteDoc, getDoc
} from 'firebase/firestore'
import Message from './Message'
import EmojiPicker from 'emoji-picker-react'

function ChatWindow({ currentUser, userData, selectedUser, onClose, className, onBlockUser, pinnedChats, onPinChat }) {
    const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [friendStatus, setFriendStatus] = useState('none')
  const [friendLoading, setFriendLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [deletedAt, setDeletedAt] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [reportSuccess, setReportSuccess] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const bottomRef = useRef(null)
  const typingTimeout = useRef(null)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)

  const getAvatar = (name) => name?.charAt(0).toUpperCase()
  const colors = ['#7c6aff', '#ff6b9d', '#4ecdc4', '#ffa726', '#66bb6a', '#ef5350']
  const getColor = (name) => colors[name?.charCodeAt(0) % colors.length]

  // Shared interests & languages
  const sharedInterests = (currentUser?.interests || []).filter(i => selectedUser?.interests?.includes(i))
  const sharedLanguages = (currentUser?.languages || []).filter(l => selectedUser?.languages?.includes(l))


  const [showReportDialog, setShowReportDialog] = useState(false)
const [reportReason, setReportReason] = useState('')
const [reportOther, setReportOther] = useState('')
  // Check friend status
  useEffect(() => {
    if (!selectedUser) return
    const checkFriendStatus = async () => {
      const [snap1, snap2] = await Promise.all([
        getDocs(query(collection(db, 'friends'), where('senderId', '==', currentUser.uid), where('receiverId', '==', selectedUser.uid))),
        getDocs(query(collection(db, 'friends'), where('senderId', '==', selectedUser.uid), where('receiverId', '==', currentUser.uid)))
      ])
      const all = [...snap1.docs, ...snap2.docs]
      if (all.length === 0) {
        setFriendStatus('none')
      } else {
        const accepted = all.find((d) => d.data().status === 'accepted')
        setFriendStatus(accepted ? 'accepted' : 'pending')
      }
    }
    checkFriendStatus()
  }, [selectedUser])

  useEffect(() => {
  const unsubscribe = onMessage(messaging, (payload) => {
    const { title, body } = payload.notification
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
      })
    }
  })
  return () => unsubscribe()
}, [])

  // Load deletedAt timestamp for this chat
  useEffect(() => {
    if (!selectedUser) return
    const chatId = [currentUser.uid, selectedUser.uid].sort().join('_')
    const loadDeletedAt = async () => {
      const snap = await getDoc(doc(db, 'deletedChats', `${currentUser.uid}_${chatId}`))
      if (snap.exists()) {
        const raw = snap.data().deletedAt
        setDeletedAt(raw?.toDate ? raw.toDate() : new Date(raw))
      } else {
        setDeletedAt(null)
      }
    }
    loadDeletedAt()
  }, [selectedUser])

  // Messages listener
  useEffect(() => {
    if (!selectedUser) return
    const chatId = [currentUser.uid, selectedUser.uid].sort().join('_')
    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId),
      orderBy('createdAt', 'asc')
    )
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const allMessages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      const filtered = deletedAt
        ? allMessages.filter((m) => {
            const msgDate = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt)
            return msgDate > deletedAt
          })
        : allMessages
      setMessages(filtered)

      const unreadMessages = snapshot.docs.filter(
        (d) => d.data().read === false && d.data().senderId === selectedUser.uid
      )
      unreadMessages.forEach(async (message) => {
        await updateDoc(doc(db, 'messages', message.id), { read: true })
      })
    })
    return () => unsubscribe()
  }, [selectedUser, deletedAt])

  // Typing listener
  useEffect(() => {
    if (!selectedUser) return
    const typingRef = doc(db, 'typing', `${selectedUser.uid}_${currentUser.uid}`)
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
      setIsTyping(snapshot.exists() ? snapshot.data().typing : false)
    })
    return () => unsubscribe()
  }, [selectedUser])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleTyping = (e) => {
    setInput(e.target.value)
    const typingRef = doc(db, 'typing', `${currentUser.uid}_${selectedUser.uid}`)
    setDoc(typingRef, { typing: true })
    clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      setDoc(typingRef, { typing: false })
    }, 1500)
  }

const sendMessage = async () => {
  if (input.trim() === '') return
  const chatId = [currentUser.uid, selectedUser.uid].sort().join('_')
  await addDoc(collection(db, 'messages'), {
    chatId,
    text: input,
    senderId: currentUser.uid,
    receiverId: selectedUser.uid,
    createdAt: serverTimestamp(),
    read: false
  })

  // Save notification for receiver
  await addDoc(collection(db, 'notifications'), {
    type: 'new_message',
    fromUid: currentUser.uid,
    fromUsername: userData?.displayUsername || '',
    toUid: selectedUser.uid,
    message: input.length > 50 ? input.substring(0, 50) + '...' : input,
    read: false,
    createdAt: serverTimestamp(),
  })

  setInput('')
  const typingRef = doc(db, 'typing', `${currentUser.uid}_${selectedUser.uid}`)
  setDoc(typingRef, { typing: false })
}

  const handleAddFriend = async () => {
    setFriendLoading(true)
    try {
      await setDoc(doc(db, 'friends', `${currentUser.uid}_${selectedUser.uid}`), {
        senderId: currentUser.uid,
        receiverId: selectedUser.uid,
        status: 'pending',
        createdAt: serverTimestamp(),
      })
      await addDoc(collection(db, 'notifications'), {
        type: 'friend_request',
        fromUid: currentUser.uid,
        toUid: selectedUser.uid,
        read: false,
        createdAt: serverTimestamp(),
      })
      setFriendStatus('pending')
    } catch (_) {}
    setFriendLoading(false)
  }

  const handleUnfriend = async () => {
    try {
      const q1 = query(collection(db, 'friends'), where('senderId', '==', currentUser.uid), where('receiverId', '==', selectedUser.uid))
      const q2 = query(collection(db, 'friends'), where('senderId', '==', selectedUser.uid), where('receiverId', '==', currentUser.uid))
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])
      snap1.forEach(async (d) => await deleteDoc(doc(db, 'friends', d.id)))
      snap2.forEach(async (d) => await deleteDoc(doc(db, 'friends', d.id)))
      onClose()
    } catch (_) {}
  }

const handleReport = async () => {
  if (!reportReason) return
  try {
    await addDoc(collection(db, 'reports'), {
      reporterId: currentUser.uid,
      reporterUsername: currentUser.displayName || '',
      reportedId: selectedUser.uid,
      reportedUsername: selectedUser.displayUsername,
      reason: reportReason,
      details: reportReason === 'Other' ? reportOther.trim() : '',
      createdAt: serverTimestamp(),
      status: 'pending',
    })
    setReportSuccess(true)
    setShowReportDialog(false)
    setReportReason('')
    setReportOther('')
    setTimeout(() => setReportSuccess(false), 3000)
  } catch (_) {}
}

  const handleDeleteChat = async () => {
    const chatId = [currentUser.uid, selectedUser.uid].sort().join('_')
    const now = new Date()
    await setDoc(doc(db, 'deletedChats', `${currentUser.uid}_${chatId}`), {
      deletedAt: now,
      userId: currentUser.uid,
      chatId,
    })
    setDeletedAt(now)
    setMessages([])
    setShowDeleteConfirm(false)
    setShowMenu(false)
  }

  const getFriendBtn = () => {
    if (friendStatus === 'accepted') return (
      <button className="friend-btn friends" disabled>✅ Friends</button>
    )
    if (friendStatus === 'pending') return (
      <button className="friend-btn pending" disabled>⏳ Pending</button>
    )
    return (
      <button className="friend-btn add" onClick={handleAddFriend} disabled={friendLoading}>
        {friendLoading ? '...' : '➕ Add Friend'}
      </button>
    )
  }

  if (!selectedUser) {
    return (
      <div className="chat-window">
        <div className="no-chat">
          <span>💬</span>
          <p>Select a friend to start chatting!</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`chat-window ${className || ''}`}>
      <div className="chat-header">
        {/* Clickable header area */}
        <div className="chat-header-left" onClick={() => setShowProfile(true)}>
          <div className="user-avatar-wrap">
            <div className="avatar" style={{ background: `linear-gradient(135deg, ${getColor(selectedUser.displayUsername)}, #302b63)` }}>
              {getAvatar(selectedUser.displayUsername)}
            </div>
            {selectedUser.online && <div className="online-dot" />}
          </div>
          <div className="chat-header-info">
            <h3>{selectedUser.displayUsername}</h3>
            <p>{selectedUser.online ? 'Online' : 'Offline'}</p>
          </div>
        </div>

        <div className="chat-header-actions">
          {getFriendBtn()}
          <div className="chat-menu-wrap">
            <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>⋮</button>
            {showMenu && (
              <div className="chat-menu">
                <button onClick={() => { onPinChat && onPinChat(selectedUser.uid); setShowMenu(false) }}>
                  📌 {pinnedChats?.includes(selectedUser.uid) ? 'Unpin Chat' : 'Pin Chat'}
                </button>
                {friendStatus === 'accepted' && (
                  <button onClick={() => { handleUnfriend(); setShowMenu(false) }}>
                    💔 Unfriend
                  </button>
                )}
                <button onClick={() => { setShowDeleteConfirm(true); setShowMenu(false) }}>
                  🗑️ Delete Chat
                </button>
<button onClick={() => { setShowReportDialog(true); setShowMenu(false) }}>
  🚩 Report
</button>
<button className="danger-menu-item" onClick={() => { setShowBlockConfirm(true); setShowMenu(false) }}>
  🚫 Block
</button>
              </div>
            )}
          </div>
          <button className="close-chat-btn" onClick={() => onClose()}>✕</button>
        </div>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <Message key={message.id} message={message} currentUser={currentUser} />
        ))}
        {isTyping && (
          <div className="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="message-input-row">
        <div className="emoji-wrapper">
          <button className="emoji-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>😊</button>
          {showEmojiPicker && (
            <div className="emoji-picker-container">
              <EmojiPicker
                onEmojiClick={(emojiData) => setInput((prev) => prev + emojiData.emoji)}
                theme="dark"
                height={400}
                width={320}
              />
            </div>
          )}
        </div>
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={handleTyping}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              sendMessage()
              setShowEmojiPicker(false)
            }
          }}
        />
        <button className="send-btn" onClick={() => { sendMessage(); setShowEmojiPicker(false) }}>➤</button>
      </div>

      {reportSuccess && (
        <div className="report-toast">🚩 User reported successfully!</div>
      )}

      {showDeleteConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h3>🗑️ Delete Chat</h3>
            <p>This will clear the chat history only for you. The other person will still see it.</p>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="confirm-delete" onClick={handleDeleteChat}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showBlockConfirm && (
  <div className="confirm-overlay">
    <div className="confirm-box">
      <h3>🚫 Block User</h3>
      <p>This will hide your chat with <strong>{selectedUser.displayUsername}</strong>. You can retrieve it by unblocking them in Settings.</p>
      <div className="confirm-actions">
        <button className="confirm-cancel" onClick={() => setShowBlockConfirm(false)}>Cancel</button>
        <button className="confirm-delete" onClick={() => { onBlockUser(selectedUser.uid); setShowBlockConfirm(false) }}>Block</button>
      </div>
    </div>
  </div>
)}

{showReportDialog && (
  <div className="confirm-overlay">
    <div className="confirm-box report-box">
      <h3>🚩 Report User</h3>
      <p>Why are you reporting <strong>{selectedUser.displayUsername}</strong>?</p>
      <div className="report-reasons">
        {['Harassment or bullying', 'Inappropriate content', 'Spam', 'Fake account', 'Underage user', 'Other'].map((reason) => (
          <button
            key={reason}
            className={`reason-btn ${reportReason === reason ? 'selected' : ''}`}
            onClick={() => setReportReason(reason)}
          >
            {reason}
          </button>
        ))}
      </div>
      {reportReason === 'Other' && (
        <input
          className="report-other-input"
          type="text"
          placeholder="Please describe the issue..."
          value={reportOther}
          maxLength={200}
          onChange={(e) => setReportOther(e.target.value)}
        />
      )}
      <div className="confirm-actions">
        <button className="confirm-cancel" onClick={() => { setShowReportDialog(false); setReportReason(''); setReportOther('') }}>Cancel</button>
        <button className="confirm-delete" onClick={handleReport} disabled={!reportReason || (reportReason === 'Other' && !reportOther.trim())}>Submit</button>
      </div>
    </div>
  </div>
)}

      {/* User Profile Popup */}
      {showProfile && (
        <div className="profile-popup-overlay" onClick={() => setShowProfile(false)}>
          <div className="profile-popup" onClick={(e) => e.stopPropagation()}>
            <button className="profile-popup-close" onClick={() => setShowProfile(false)}>✕</button>

            <div className="profile-popup-avatar" style={{ background: `linear-gradient(135deg, ${getColor(selectedUser.displayUsername)}, #302b63)` }}>
              {getAvatar(selectedUser.displayUsername)}
            </div>

            <h3 className="profile-popup-name">{selectedUser.displayUsername}</h3>
            <p className="profile-popup-appid">{selectedUser.appId}</p>

            {selectedUser.bio && (
              <p className="profile-popup-bio">"{selectedUser.bio}"</p>
            )}

            <div className="profile-popup-meta">
              {selectedUser.country && <span>📍 {selectedUser.country}</span>}
              {selectedUser.age && <span>🎂 {selectedUser.age} years old</span>}
            </div>

            {sharedInterests.length > 0 && (
              <div className="profile-popup-section">
                <p className="profile-popup-label">Shared Interests</p>
                <div className="profile-popup-tags">
                  {sharedInterests.map(i => <span key={i} className="interest-tag">{i}</span>)}
                </div>
              </div>
            )}

            {sharedLanguages.length > 0 && (
              <div className="profile-popup-section">
                <p className="profile-popup-label">Shared Languages</p>
                <div className="profile-popup-tags">
                  {sharedLanguages.map(l => <span key={l} className="interest-tag">{l}</span>)}
                </div>
              </div>
            )}

            <div className="profile-popup-status">
              <span className={`status-dot ${selectedUser.online ? 'online' : 'offline'}`} />
              {selectedUser.online ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatWindow