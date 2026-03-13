import { db } from '../firebase'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { useState } from 'react'

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

function Message({ message, currentUser }) {
  const isSent = currentUser?.uid ? message.senderId === currentUser.uid : false
  const isPending = message.pending === true
  const [showReactions, setShowReactions] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(message.text)

  if (!currentUser?.uid) return null

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = timestamp.toDate()
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const deleteMessage = async () => {
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
    setShowReactions(false)
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
  // Deleted message
  if (message.deleted) {
    return (
      <div className={`message-row ${isSent ? 'sent' : 'received'}`}>
        <div className="message-bubble deleted-bubble">
          🚫 {isSent ? 'You deleted this message' : 'This message was deleted'}
        </div>
<span className="message-time">
  {isPending ? '🕐' : formatTime(message.createdAt)}
</span>
      </div>
    )
  }

  return (
    <div
      className={`message-row ${isSent ? 'sent' : 'received'}`}
      onMouseEnter={() => !isEditing && setShowReactions(true)}
      onMouseLeave={() => !isEditing && setShowReactions(false)}
    >
      <div className="message-actions">
        {showReactions && (
          <div className={`reaction-picker ${isSent ? 'sent' : 'received'}`}>
            {REACTIONS.map((emoji) => (
              <button key={emoji} onClick={() => handleReaction(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}
        {showReactions && isSent && (
          <button className="edit-msg-btn" onClick={() => { setIsEditing(true); setShowReactions(false) }}>✏️</button>
        )}
        {showReactions && isSent && (
          <button className="delete-msg-btn" onClick={deleteMessage}>🗑️</button>
        )}
      </div>

      {isEditing ? (
        <div className="edit-bubble">
          <input
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
          {message.text}
          {message.edited && <span className="edited-tag"> (edited)</span>}
        </div>
      )}

      {getReactionSummary().length > 0 && (
        <div className="reactions-display">
          {getReactionSummary().map(([emoji, users]) => (
            <button
              key={emoji}
              className={`reaction-badge ${users.includes(currentUser.uid) ? 'reacted' : ''}`}
              onClick={() => handleReaction(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <span className="message-time">{formatTime(message.createdAt)}</span>
    </div>
  )
}

export default Message