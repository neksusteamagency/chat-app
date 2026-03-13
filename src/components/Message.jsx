import { db } from '../firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

function Message({ message, currentUser, onReply }) {
  const isSent = currentUser?.uid ? message.senderId === currentUser.uid : false
  const isPending = message.pending === true
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(message.text)
  const longPressTimer = useRef(null)
  const menuRef = useRef(null)
  const messageRef = useRef(null)

  if (!currentUser?.uid) return null

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const openMenu = (x, y) => {
    const menuWidth = 200
    const menuHeight = 280
    const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x
    const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y
    setMenuPos({ x: adjustedX, y: adjustedY })
    setShowMenu(true)
  }

  const handleTouchStart = (e) => {
    if (message.deleted || isPending) return
    const touch = e.touches[0]
    longPressTimer.current = setTimeout(() => {
      openMenu(touch.clientX, touch.clientY)
      if (navigator.vibrate) navigator.vibrate(50)
    }, 500)
  }

  const handleTouchEnd = () => clearTimeout(longPressTimer.current)
  const handleTouchMove = () => clearTimeout(longPressTimer.current)

  const handleContextMenu = (e) => {
    if (message.deleted || isPending) return
    e.preventDefault()
    openMenu(e.clientX, e.clientY)
  }

  useEffect(() => {
    if (!showMenu) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showMenu])

  const deleteMessage = async () => {
    setShowMenu(false)
    await updateDoc(doc(db, 'messages', message.id), { deleted: true, text: '' })
  }

  const handleReaction = async (emoji) => {
    if (message.deleted) return
    const reactions = message.reactions || {}
    const users = reactions[emoji] || []
    const updatedUsers = users.includes(currentUser.uid)
      ? users.filter((uid) => uid !== currentUser.uid)
      : [...users, currentUser.uid]
    const updatedReactions = { ...reactions, [emoji]: updatedUsers }
    await updateDoc(doc(db, 'messages', message.id), { reactions: updatedReactions })
    setShowMenu(false)
  }

  const handleEdit = async () => {
    if (editText.trim() === '') return
    if (editText === message.text) { setIsEditing(false); return }
    await updateDoc(doc(db, 'messages', message.id), { text: editText, edited: true })
    setIsEditing(false)
  }

  const getReactionSummary = () => {
    const reactions = message.reactions || {}
    return Object.entries(reactions).filter(([_, users]) => users.length > 0)
  }

  // Improved read receipt rendering
const renderFooter = () => (
  <div className="message-footer">
    {isPending ? '🕐' : formatTime(message.createdAt)}
    {isSent && !isPending && (
      <span className={`read-receipt ${message.read ? 'read' : 'sent'}`}>
        {message.read ? '✓✓' : '✓'}
      </span>
    )}
  </div>
)

if (message.deleted) {
  return (
    <div className={`message-row ${isSent ? 'sent' : 'received'}`}>
      <div className="message-bubble deleted-bubble">
        🚫 {isSent ? 'You deleted this message' : 'This message was deleted'}
        {renderFooter()}
      </div>
    </div>
  )
}

return (
  <>
    <div
      className={`message-row ${isSent ? 'sent' : 'received'}`}
      ref={messageRef}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {message.replyTo && (
        <div className="reply-preview">
          <div className="reply-author">{message.replyTo.senderName}</div>
          <div className="reply-text">{message.replyTo.text}</div>
        </div>
      )}

      {isEditing ? (
        <div className="edit-bubble">
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEdit()
              if (e.key === 'Escape') setIsEditing(false)
            }}
            autoFocus
          />
          <div className="edit-actions">
            <button className="edit-cancel" onClick={() => setIsEditing(false)}>Cancel</button>
            <button className="edit-save" onClick={handleEdit}>Save</button>
          </div>
        </div>
      ) : (
        <div className="message-bubble">
          <div className="message-text">
            {message.text}
            {message.edited && <span className="edited-tag"> (edited)</span>}
          </div>
          {renderFooter()}
        </div>
      )}

      {getReactionSummary().length > 0 && (
        <div className="reactions-display">
          {getReactionSummary().map(([emoji, users]) => (
            <span
              key={emoji}
              className={`reaction-badge ${users.includes(currentUser.uid) ? 'reacted' : ''}`}
              onClick={() => handleReaction(emoji)}
            >
              {emoji} {users.length}
            </span>
          ))}
        </div>
      )}
    </div>

    {showMenu && typeof document !== 'undefined' && createPortal(
      <div
        className="message-context-menu"
        ref={menuRef}
        style={{ left: `${menuPos.x}px`, top: `${menuPos.y}px` }}
      >
        <div className="context-reactions">
          {REACTIONS.map((emoji) => (
            <button key={emoji} onClick={() => handleReaction(emoji)}>
              {emoji}
            </button>
          ))}
        </div>

        <div className="context-divider"></div>

        <button className="context-action" onClick={() => { onReply && onReply(message); setShowMenu(false) }}>
          ↩️ Reply
        </button>
        {isSent && (
          <button className="context-action" onClick={() => { setIsEditing(true); setShowMenu(false) }}>
            ✏️ Edit
          </button>
        )}
        {isSent && (
          <button className="context-action danger" onClick={deleteMessage}>
            🗑️ Delete
          </button>
        )}
      </div>,
      document.body
    )}
  </>
)
}

export default Message
