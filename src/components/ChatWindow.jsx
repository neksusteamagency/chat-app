import { useState, useEffect, useRef } from 'react'
import { db, rtdb } from '../firebase'
import {
  collection, addDoc, query, orderBy,
  onSnapshot, serverTimestamp, where,
  updateDoc, doc, setDoc, getDocs, deleteDoc, getDoc,
  startAfter, limitToLast
} from 'firebase/firestore'
import { ref, onValue } from 'firebase/database'
import { getFunctions, httpsCallable } from 'firebase/functions'
import Message from './Message'
import EmojiPicker from 'emoji-picker-react'

const PAGE_SIZE = 30

// ✅ Fix 2: Cache helpers — store last messages per chat in localStorage
const getCachedMessages = (chatId) => {
  try {
    const raw = localStorage.getItem(`chat_cache_${chatId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const setCachedMessages = (chatId, messages) => {
  try {
    const toCache = messages
      .filter((m) => !m.pending)
      .slice(-30)
      .map((m) => ({
        ...m,
        createdAt: m.createdAt?.toDate ? m.createdAt.toDate().toISOString() : m.createdAt,
        readAt: m.readAt?.toDate ? m.readAt.toDate().toISOString() : m.readAt,
        deliveredAt: m.deliveredAt?.toDate ? m.deliveredAt.toDate().toISOString() : m.deliveredAt,
      }))
    localStorage.setItem(`chat_cache_${chatId}`, JSON.stringify(toCache))
  } catch {
    // localStorage might be full, silently fail
  }
}

function ChatWindow({ currentUser, userData, selectedUser, onClose, className, onBlockUser, pinnedChats, onPinChat }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [friendStatus, setFriendStatus] = useState(null)
  const [friendLoading, setFriendLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [deletedAt, setDeletedAt] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [reportSuccess, setReportSuccess] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportOther, setReportOther] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [firstDoc, setFirstDoc] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [mutualFriends, setMutualFriends] = useState([])
  const [showMutualFriends, setShowMutualFriends] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const [isOnline, setIsOnline] = useState(false)
  const [lastSeen, setLastSeen] = useState(null)

  const typingTimeout = useRef(null)
  const messagesContainerRef = useRef(null)
  const selectedUserRef = useRef(selectedUser)
  const isSending = useRef(false)
  const isActiveChat = useRef(true)
  const markAsReadFn = httpsCallable(getFunctions(), 'markMessagesAsRead')

  const getAvatar = (name) => name?.charAt(0).toUpperCase()
  const colors = ['#7c6aff', '#ff6b9d', '#4ecdc4', '#ffa726', '#66bb6a', '#ef5350']
  const getColor = (name) => colors[name?.charCodeAt(0) % colors.length]

  const sharedInterests = (currentUser?.interests || []).filter(i => selectedUser?.interests?.includes(i))
  const sharedLanguages = (currentUser?.languages || []).filter(l => selectedUser?.languages?.includes(l))

  const canShowOnline = selectedUser?.showOnline !== false
  const canShowLastSeen = selectedUser?.showLastSeen !== false
  const displayOnline = isOnline && canShowOnline
  const displayLastSeen = !isOnline && canShowLastSeen ? lastSeen : null

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Offline'
    const date = new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)
    if (diff < 60) return 'Last seen just now'
    if (diff < 3600) return `Last seen ${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `Last seen ${Math.floor(diff / 3600)}h ago`
    return `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
  }

  const getStatusText = () => {
    if (isTyping) return '✍️ typing...'
    if (displayOnline) return 'Online'
    if (displayLastSeen) return formatLastSeen(displayLastSeen)
    return 'Offline'
  }

  // Track whether the user is actively looking at this chat
  useEffect(() => {
    const onFocus = () => { isActiveChat.current = true }
    const onBlur = () => { isActiveChat.current = false }
    const onVisible = () => { isActiveChat.current = document.visibilityState === 'visible' }

    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Live presence from RTDB
  useEffect(() => {
    if (!selectedUser?.uid) return
    const statusRef = ref(rtdb, `status/${selectedUser.uid}`)
    const unsub = onValue(statusRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val()
        setIsOnline(data.online === true)
        setLastSeen(data.online === true ? null : data.lastSeen || null)
      } else {
        setIsOnline(false)
        setLastSeen(null)
      }
    })
    return () => unsub()
  }, [selectedUser?.uid])

  // ✅ Fix 2: Reset + load cache instantly on user change so UI is never blank
  useEffect(() => {
    if (!selectedUser?.uid) return
    selectedUserRef.current = selectedUser
    setIsLoading(true)
    setMessages([])
    setFirstDoc(null)
    setHasMore(false)
    setFriendStatus(null)
    setInput('')

    isSending.current = false

    const chatId = [currentUser.uid, selectedUser.uid].sort().join('_')
    const cached = getCachedMessages(chatId)
    if (cached.length > 0) {
      setMessages(cached)
      setIsLoading(false)
    }
  }, [selectedUser?.uid])

  // Mutual friends count
  useEffect(() => {
    if (!selectedUser) return
    const getMutualFriends = async () => {
      const [my1, my2] = await Promise.all([
        getDocs(query(collection(db, 'friends'), where('senderId', '==', currentUser.uid), where('status', '==', 'accepted'))),
        getDocs(query(collection(db, 'friends'), where('receiverId', '==', currentUser.uid), where('status', '==', 'accepted')))
      ])
      const myFriendUids = new Set([
        ...my1.docs.map(d => d.data().receiverId),
        ...my2.docs.map(d => d.data().senderId),
      ])
      const [their1, their2] = await Promise.all([
        getDocs(query(collection(db, 'friends'), where('senderId', '==', selectedUser.uid), where('status', '==', 'accepted'))),
        getDocs(query(collection(db, 'friends'), where('receiverId', '==', selectedUser.uid), where('status', '==', 'accepted')))
      ])
      const theirFriendUids = new Set([
        ...their1.docs.map(d => d.data().receiverId),
        ...their2.docs.map(d => d.data().senderId),
      ])

      // Collect mutual UIDs (exclude the selected user themselves)
      const mutualUids = []
      myFriendUids.forEach(uid => {
        if (uid !== selectedUser.uid && theirFriendUids.has(uid)) mutualUids.push(uid)
      })

      // Fetch user data for each mutual friend
      const userDocs = await Promise.all(
        mutualUids.map(uid => getDoc(doc(db, 'users', uid)))
      )
      const mutualUsers = userDocs
        .filter(d => d.exists())
        .map(d => ({ uid: d.id, ...d.data() }))

      setMutualFriends(mutualUsers)
    }
    getMutualFriends()
  }, [selectedUser?.uid])

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
  }, [selectedUser?.uid])

  // Load deletedAt
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
  }, [selectedUser?.uid])

  // Messages listener
  useEffect(() => {
    if (!selectedUser) return
    const chatId = [currentUser.uid, selectedUser.uid].sort().join('_')
    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId),
      orderBy('createdAt', 'asc'),
      limitToLast(PAGE_SIZE)
    )
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (selectedUserRef.current?.uid !== selectedUser.uid) return

      const allMessages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      const filtered = deletedAt
        ? allMessages.filter((m) => {
            const msgDate = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt)
            return msgDate > deletedAt
          })
        : allMessages

      setMessages((prev) => {
        const pendingMsgs = prev.filter((m) => m.pending)
        const stillPending = pendingMsgs.filter(
          (p) => !filtered.some((f) => f.text === p.text && f.senderId === p.senderId)
        )
        return [...filtered, ...stillPending]
      })

      // ✅ Fix 2: Update cache with fresh data from Firestore
      setCachedMessages(chatId, filtered)
      setIsLoading(false)

      if (snapshot.docs.length >= PAGE_SIZE) {
        setHasMore(true)
        setFirstDoc(snapshot.docs[0])
      } else {
        setHasMore(false)
      }

      // ✅ Delivered is now handled by the Cloud Function onMessageCreated
      // ✅ Mark as read via Cloud Function — only if user is actively in this chat
      if (isActiveChat.current) {
        const chatId = [currentUser.uid, selectedUser.uid].sort().join('_')
        const hasUnread = snapshot.docs.some(
          (d) => d.data().read === false && d.data().receiverId === currentUser.uid
        )
        if (hasUnread) {
          markAsReadFn({ chatId }).catch((err) => console.error('markAsRead error:', err))
        }
      }
    })
    return () => unsubscribe()
  }, [selectedUser?.uid, deletedAt])

  const loadMoreMessages = async () => {
    if (!firstDoc || loadingMore) return
    setLoadingMore(true)
    const chatId = [currentUser.uid, selectedUser.uid].sort().join('_')
    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId),
      orderBy('createdAt', 'asc'),
      limitToLast(PAGE_SIZE),
      startAfter(firstDoc)
    )
    const container = messagesContainerRef.current
    const prevScrollHeight = container?.scrollHeight || 0
    const snapshot = await getDocs(q)
    if (snapshot.empty) {
      setHasMore(false)
      setLoadingMore(false)
      return
    }
    const older = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    setMessages((prev) => [...older, ...prev])
    setFirstDoc(snapshot.docs[0])
    if (snapshot.docs.length < PAGE_SIZE) setHasMore(false)
    requestAnimationFrame(() => {
      if (container) container.scrollTop = container.scrollHeight - prevScrollHeight
    })
    setLoadingMore(false)
  }

  const handleScroll = () => {
    const container = messagesContainerRef.current
    if (!container) return
    if (container.scrollTop < 50 && hasMore && !loadingMore) loadMoreMessages()
  }

  // Typing indicator listener
  useEffect(() => {
    if (!selectedUser) return
    const typingRef = doc(db, 'typing', `${selectedUser.uid}_${currentUser.uid}`)
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
      setIsTyping(snapshot.exists() ? snapshot.data().typing : false)
    })
    return () => unsubscribe()
  }, [selectedUser?.uid])

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
    if (input.trim() === '' || isSending.current) return
    isSending.current = true
    const textToSend = input.trim()
    setInput('')

    const tempId = `temp_${Date.now()}`
    const tempMessage = {
      id: tempId,
      text: textToSend,
      senderId: currentUser.uid,
      receiverId: selectedUser.uid,
      createdAt: { toDate: () => new Date() },
      read: false,
      delivered: false,
      pending: true,
    }
    setMessages((prev) => [...prev, tempMessage])

    const chatId = [currentUser.uid, selectedUser.uid].sort().join('_')
    try {
      await addDoc(collection(db, 'messages'), {
        chatId,
        text: textToSend,
        senderId: currentUser.uid,
        receiverId: selectedUser.uid,
        createdAt: serverTimestamp(),
        read: false,
        delivered: false,
        ...(replyTo && {
          replyTo: {
            text: replyTo.text,
            senderId: replyTo.senderId,
            senderName: replyTo.senderId === currentUser.uid ? 'You' : selectedUser.displayUsername,
          }
        })
      })
      setReplyTo(null)
      await addDoc(collection(db, 'notifications'), {
        type: 'new_message',
        fromUid: currentUser.uid,
        fromUsername: userData?.displayUsername || '',
        toUid: selectedUser.uid,
        message: textToSend.length > 50 ? textToSend.substring(0, 50) + '...' : textToSend,
        read: false,
        createdAt: serverTimestamp(),
      })
      const typingRef = doc(db, 'typing', `${currentUser.uid}_${selectedUser.uid}`)
      setDoc(typingRef, { typing: false })
    } catch (_) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setInput(textToSend)
    }
    isSending.current = false
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
    if (friendStatus === null) return null
    if (friendStatus === 'accepted') return <button className="friend-btn friends" disabled>✅ Friends</button>
    if (friendStatus === 'pending') return <button className="friend-btn pending" disabled>⏳ Pending</button>
    return (
      <button className="friend-btn add" onClick={handleAddFriend} disabled={friendLoading}>
        {friendLoading ? '...' : '➕ Add Friend'}
      </button>
    )
  }

  if (!selectedUser) {
    return (
      <div className={`chat-window ${className}`}>
        <div className="no-chat">
          <span>💬</span>
          <p>Select a friend to start chatting!</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`chat-window ${className}`}>
      <div className="chat-header">
        <div className="chat-header-left" onClick={() => setShowProfile(true)}>
          <div className="user-avatar-wrap">
            <div className="avatar" style={{ background: getColor(selectedUser.displayUsername) }}>
              {getAvatar(selectedUser.displayUsername)}
            </div>
            {displayOnline && <div className="online-dot"></div>}
          </div>
          <div className="chat-header-info">
            <h3>{selectedUser.displayUsername}</h3>
            <p className={displayOnline ? 'status-online' : 'status-offline'}>
              {getStatusText()}
            </p>
          </div>
        </div>
        <div className="chat-header-actions">
          {getFriendBtn()}
          <div className="chat-menu-wrap">
            <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>⋮</button>
            {showMenu && (
              <div className="chat-menu">
                <button onClick={() => { setShowSearch(true); setShowMenu(false); setTimeout(() => searchInputRef.current?.focus(), 100) }}>
                  🔍 Search Messages
                </button>
                <button onClick={() => { onPinChat && onPinChat(selectedUser.uid); setShowMenu(false) }}>
                  📌 {pinnedChats?.includes(selectedUser.uid) ? 'Unpin Chat' : 'Pin Chat'}
                </button>
                {friendStatus === 'accepted' && (
                  <button onClick={() => { handleUnfriend(); setShowMenu(false) }}>💔 Unfriend</button>
                )}
                <button onClick={() => { setShowDeleteConfirm(true); setShowMenu(false) }}>🗑️ Delete Chat</button>
                <button onClick={() => { setShowReportDialog(true); setShowMenu(false) }}>🚩 Report</button>
                <button className="danger-menu-item" onClick={() => { setShowBlockConfirm(true); setShowMenu(false) }}>🚫 Block</button>
              </div>
            )}
          </div>
          <button className="close-chat-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="chat-search-bar">
          <span className="chat-search-icon">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="chat-search-input"
          />
          {searchQuery && (
            <span className="chat-search-count">
              {messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()) && !m.deleted).length} results
            </span>
          )}
          <button className="chat-search-close" onClick={() => { setShowSearch(false); setSearchQuery('') }}>✕</button>
        </div>
      )}

      <div
        className="messages-container"
        ref={messagesContainerRef}
        onScroll={handleScroll}
        style={{ display: 'flex', flexDirection: 'column-reverse', overflowY: 'auto' }}
      >
        {isLoading && messages.length === 0 ? (
          <div className="messages-skeleton">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`skeleton-row ${i % 2 === 0 ? 'sent' : 'received'}`}>
                <div className="skeleton-bubble" style={{ width: `${100 + (i * 40) % 120}px` }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {isTyping && (
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            )}
            {(() => {
              const filtered = searchQuery.trim()
                ? [...messages].filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()) && !m.deleted)
                : [...messages]

              if (searchQuery.trim() && filtered.length === 0) {
                return (
                  <div className="search-no-results">
                    <span>🔍</span>
                    <p>No messages found for "{searchQuery}"</p>
                  </div>
                )
              }

              const reversed = [...filtered].reverse()

              const getDateLabel = (timestamp) => {
                if (!timestamp) return null
                const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
                const now = new Date()
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                const yesterday = new Date(today)
                yesterday.setDate(yesterday.getDate() - 1)
                const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
                if (msgDay.getTime() === today.getTime()) return 'Today'
                if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday'
                return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
              }

              const isSameDay = (ts1, ts2) => {
                if (!ts1 || !ts2) return false
                const d1 = ts1?.toDate ? ts1.toDate() : new Date(ts1)
                const d2 = ts2?.toDate ? ts2.toDate() : new Date(ts2)
                return d1.getFullYear() === d2.getFullYear() &&
                  d1.getMonth() === d2.getMonth() &&
                  d1.getDate() === d2.getDate()
              }

              const items = []
              reversed.forEach((message, i) => {
                const nextMessage = reversed[i + 1]
                items.push(
                  <Message
                    key={message.id}
                    message={message}
                    currentUser={currentUser}
                    onReply={(msg) => setReplyTo(msg)}
                    searchQuery={searchQuery}
                  />
                )
                // In column-reverse, "next" visually is above — so insert separator after
                // when the next message is on a different day
                if (!nextMessage || !isSameDay(message.createdAt, nextMessage.createdAt)) {
                  const label = getDateLabel(message.createdAt)
                  if (label) {
                    items.push(
                      <div key={`date-${message.id}`} className="date-separator">
                        <span>{label}</span>
                      </div>
                    )
                  }
                }
              })

              return items
            })()}
            {loadingMore && (
              <div style={{ textAlign: 'center', padding: '10px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
            )}
          </>
        )}
      </div>

      {replyTo && (
        <div className="reply-bar">
          <div className="reply-bar-content">
            <div className="reply-bar-label">↩️ Replying to</div>
            <div className="reply-bar-text">{replyTo.text}</div>
          </div>
          <button className="reply-bar-close" onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

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
            if (e.key === 'Enter') { sendMessage(); setShowEmojiPicker(false) }
          }}
        />
        <button className="send-btn" onClick={() => { sendMessage(); setShowEmojiPicker(false) }}>➤</button>
      </div>

      {reportSuccess && <div className="report-toast">🚩 User reported successfully!</div>}

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
              <textarea
                className="report-other-input"
                placeholder="Please provide details..."
                value={reportOther}
                onChange={(e) => setReportOther(e.target.value)}
                rows={3}
              />
            )}
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => { setShowReportDialog(false); setReportReason(''); setReportOther('') }}>Cancel</button>
              <button className="confirm-delete" onClick={handleReport} disabled={!reportReason}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {showProfile && (
        <div className="profile-popup-overlay" onClick={() => setShowProfile(false)}>
          <div className="profile-popup" onClick={(e) => e.stopPropagation()}>
            <button className="profile-popup-close" onClick={() => setShowProfile(false)}>✕</button>
            <div className="profile-popup-avatar" style={{ background: getColor(selectedUser.displayUsername) }}>
              {getAvatar(selectedUser.displayUsername)}
            </div>
            <div className="profile-popup-name">{selectedUser.displayUsername}</div>
            <div className="profile-popup-appid">@{selectedUser.appId || selectedUser.uid.slice(0, 8)}</div>
            {selectedUser.bio && <div className="profile-popup-bio">{selectedUser.bio}</div>}
            <div className="profile-popup-status">
              <div className={`status-dot ${displayOnline ? 'online' : 'offline'}`}></div>
              {displayOnline ? 'Online' : displayLastSeen ? formatLastSeen(displayLastSeen) : 'Offline'}
            </div>
            <div className="profile-popup-meta">
              {selectedUser.country && <span>📍 {selectedUser.country}</span>}
              {selectedUser.age && <span>🎂 {selectedUser.age}</span>}
              <span
                className="mutual-friends-btn"
                onClick={(e) => { e.stopPropagation(); setShowMutualFriends(true) }}
              >
                👥 {mutualFriends.length > 0 ? `${mutualFriends.length} mutual friend${mutualFriends.length > 1 ? 's' : ''}` : 'No mutual friends'}
              </span>
            </div>
            {sharedInterests.length > 0 && (
              <div className="profile-popup-section">
                <div className="profile-popup-label">Shared Interests</div>
                <div className="profile-popup-tags">
                  {sharedInterests.map((interest) => (
                    <span key={interest} className="interest-tag">{interest}</span>
                  ))}
                </div>
              </div>
            )}
            {sharedLanguages.length > 0 && (
              <div className="profile-popup-section">
                <div className="profile-popup-label">Shared Languages</div>
                <div className="profile-popup-tags">
                  {sharedLanguages.map((lang) => (
                    <span key={lang} className="interest-tag">{lang}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mutual Friends Modal */}
      {showMutualFriends && (
        <div className="confirm-overlay" onClick={() => setShowMutualFriends(false)}>
          <div className="mutual-friends-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mutual-friends-header">
              <h3>👥 Mutual Friends</h3>
              <button className="profile-popup-close" onClick={() => setShowMutualFriends(false)}>✕</button>
            </div>
            {mutualFriends.length === 0 ? (
              <div className="mutual-friends-empty">
                <span>🤷</span>
                <p>No mutual friends yet</p>
              </div>
            ) : (
              <div className="mutual-friends-list">
                {mutualFriends.map((user) => (
                  <div key={user.uid} className="mutual-friend-item">
                    <div className="avatar" style={{ background: getColor(user.displayUsername), width: 40, height: 40, fontSize: 15 }}>
                      {getAvatar(user.displayUsername)}
                    </div>
                    <div className="mutual-friend-info">
                      <span className="mutual-friend-name">{user.displayUsername}</span>
                      {user.appId && <span className="mutual-friend-appid">@{user.appId}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatWindow