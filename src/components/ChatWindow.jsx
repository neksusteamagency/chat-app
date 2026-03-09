import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import {
  collection, addDoc, query, orderBy,
  onSnapshot, serverTimestamp, where,
  updateDoc, doc, setDoc
} from 'firebase/firestore'
import Message from './Message'
import EmojiPicker from 'emoji-picker-react'

function ChatWindow({ currentUser, selectedUser, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef(null)
  const typingTimeout = useRef(null)

  const getAvatar = (name) => name?.charAt(0).toUpperCase()
  const colors = ['#7c6aff', '#ff6b9d', '#4ecdc4', '#ffa726', '#66bb6a', '#ef5350']
  const getColor = (name) => colors[name?.charCodeAt(0) % colors.length]
const [showEmojiPicker, setShowEmojiPicker] = useState(false)

const handleEmojiClick = (emojiData) => {
  setInput((prev) => prev + emojiData.emoji)
}
  useEffect(() => {
    if (!selectedUser) return

    const chatId = [currentUser.uid, selectedUser.uid].sort().join('_')
    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId),
      orderBy('createdAt', 'asc')
    )

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))

      const unreadMessages = snapshot.docs.filter(
        (d) => d.data().read === false && d.data().senderId === selectedUser.uid
      )
      unreadMessages.forEach(async (message) => {
        await updateDoc(doc(db, 'messages', message.id), { read: true })
      })
    })

    return () => unsubscribe()
  }, [selectedUser])

  useEffect(() => {
    if (!selectedUser) return

    const typingRef = doc(db, 'typing', `${selectedUser.uid}_${currentUser.uid}`)

    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
        console.log('typing snapshot:', snapshot.exists(), snapshot.data())
      if (snapshot.exists()) {
        setIsTyping(snapshot.data().typing)
      } else {
        setIsTyping(false)
      }
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
    setInput('')
    const typingRef = doc(db, 'typing', `${currentUser.uid}_${selectedUser.uid}`)
    setDoc(typingRef, { typing: false })
  }

  if (!selectedUser) {
    return (
      <div className="chat-window">
        <div className="no-chat">
          <span>💬</span>
          <p>Select a user to start chatting!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="user-avatar-wrap">
          <div className="avatar" style={{ background: `linear-gradient(135deg, ${getColor(selectedUser.name)}, #302b63)` }}>
            {getAvatar(selectedUser.name)}
          </div>
          {selectedUser.online && <div className="online-dot" />}
        </div>
        <div className="chat-header-info">
          <h3>{selectedUser.name}</h3>
          <p>{selectedUser.online ? 'Online' : 'Offline'}</p>
        </div>
        <button className="close-chat-btn" onClick={() => onClose()}>✕</button>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <Message key={message.id} message={message} currentUser={currentUser} />
        ))}
        {isTyping && (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
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
          onEmojiClick={handleEmojiClick}
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
    </div>
  )
}

export default ChatWindow