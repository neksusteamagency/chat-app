import { useState } from 'react'
import { db } from '../firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

function Discover({ currentUser, userData, onSelectUser, onClose }) {
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [skipped, setSkipped] = useState([])

  const getAvatar = (name) => name?.charAt(0).toUpperCase()
  const colors = ['#7c6aff', '#ff6b9d', '#4ecdc4', '#ffa726', '#66bb6a', '#ef5350']
  const getColor = (name) => colors[name?.charCodeAt(0) % colors.length]

  const findMatch = async () => {
    setLoading(true)
    setNotFound(false)
    setMatch(null)

    try {
      const interests = userData?.interests || []
      const q = query(
        collection(db, 'users'),
        where('interests', 'array-contains-any', interests)
      )
      const snapshot = await getDocs(q)
      const results = snapshot.docs
        .map((doc) => doc.data())
        .filter((u) => u.uid !== currentUser.uid && !skipped.includes(u.uid))

      if (results.length === 0) {
        setNotFound(true)
      } else {
        const random = results[Math.floor(Math.random() * results.length)]
        setMatch(random)
      }
    } catch (_) {
      setNotFound(true)
    }
    setLoading(false)
  }

  const handleSkip = () => {
    if (match) {
      setSkipped([...skipped, match.uid])
      setMatch(null)
      findMatch()
    }
  }

  const handleChat = () => {
    if (match) {
      onSelectUser(match)
      onClose()
    }
  }

  return (
    <div className="discover-overlay">
      <div className="discover-box">
        <div className="discover-header">
          <h2>🌍 Discover</h2>
          <button className="close-discover-btn" onClick={onClose}>✕</button>
        </div>

        <p className="discover-subtitle">Find people who share your interests!</p>

        <div className="your-interests">
          {userData?.interests?.map((interest) => (
            <span key={interest} className="interest-tag">{interest}</span>
          ))}
        </div>

        {!match && !loading && !notFound && (
          <button className="find-btn" onClick={findMatch}>
            Find Someone 🎲
          </button>
        )}

        {loading && (
          <div className="discover-loading">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>Finding a match...</p>
          </div>
        )}

        {notFound && (
          <div className="no-match">
            <p>😔 No matches found!</p>
            <p>Try again later or add more interests</p>
            <button className="find-btn" onClick={findMatch}>Try Again</button>
          </div>
        )}

        {match && (
          <div className="match-card">
            <div className="match-avatar" style={{ background: `linear-gradient(135deg, ${getColor(match.displayUsername)}, #302b63)` }}>
              {getAvatar(match.displayUsername)}
            </div>
            <h3>{match.displayUsername}</h3>
            <p className="match-appid">{match.appId}</p>
            <div className="match-interests">
              {match.interests?.map((interest) => (
                <span key={interest} className="interest-tag">{interest}</span>
              ))}
            </div>
            <div className="match-actions">
              <button className="skip-btn" onClick={handleSkip}>⏭️ Skip</button>
              <button className="chat-btn" onClick={handleChat}>💬 Chat</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Discover