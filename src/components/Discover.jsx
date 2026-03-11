import { useState } from 'react'
import { db } from '../firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

const AGE_RANGES = [
  { label: 'Any age', min: 0, max: 999 },
  { label: '18-24', min: 18, max: 24 },
  { label: '25-34', min: 25, max: 34 },
  { label: '35-44', min: 35, max: 44 },
  { label: '45+', min: 45, max: 999 },
]

function Discover({ currentUser, userData, onSelectUser, onClose }) {
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [skipped, setSkipped] = useState([])
  const [showFilters, setShowFilters] = useState(true)

  const [locationFilter, setLocationFilter] = useState('worldwide')
  const [languageFilter, setLanguageFilter] = useState('any')
  const [ageRange, setAgeRange] = useState(AGE_RANGES[0])

  const getAvatar = (name) => name?.charAt(0).toUpperCase()
  const colors = ['#7c6aff', '#ff6b9d', '#4ecdc4', '#ffa726', '#66bb6a', '#ef5350']
  const getColor = (name) => colors[name?.charCodeAt(0) % colors.length]

  const findMatch = async () => {
    setLoading(true)
    setNotFound(false)
    setMatch(null)
    setShowFilters(false)

    try {
      const interests = userData?.interests || []
      const q = query(
        collection(db, 'users'),
        where('interests', 'array-contains-any', interests)
      )
      const snapshot = await getDocs(q)
      let results = snapshot.docs
        .map((doc) => doc.data())
        .filter((u) => {
          if (u.uid === currentUser.uid) return false
          if (skipped.includes(u.uid)) return false
          if (!u.onboarded) return false

          // Language filter
          if (languageFilter !== 'any') {
            const theirLangs = u.languages || []
            if (!theirLangs.includes(languageFilter)) return false
          } else {
            // At least 1 shared language
            const myLangs = userData?.languages || []
            const theirLangs = u.languages || []
            const sharedLangs = myLangs.filter((l) => theirLangs.includes(l))
            if (sharedLangs.length === 0) return false
          }

          // Location filter
          if (locationFilter === 'country') {
            if (u.country !== userData?.country) return false
          }

          // Age filter
          const theirAge = u.age || 0
          if (theirAge < ageRange.min || theirAge > ageRange.max) return false

          return true
        })

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

  const handleReset = () => {
    setMatch(null)
    setNotFound(false)
    setShowFilters(true)
    setSkipped([])
  }

  // Shared languages between me and match
  const sharedLanguages = match
    ? (userData?.languages || []).filter((l) => (match.languages || []).includes(l))
    : []

  const sharedInterests = match
    ? (userData?.interests || []).filter((i) => (match.interests || []).includes(i))
    : []

  return (
    <div className="discover-overlay">
      <div className="discover-box">
        <div className="discover-header">
          <h2>🌍 Discover</h2>
          <button className="close-discover-btn" onClick={onClose}>✕</button>
        </div>

        {showFilters && (
          <>
            <p className="discover-subtitle">Find people who match your vibe!</p>

            <div className="discover-filters">

              <div className="filter-group">
                <label>📍 Location</label>
                <div className="filter-options">
                  {[
                    { value: 'worldwide', label: '🌍 Worldwide' },
                    { value: 'country', label: '🗺️ My Country' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      className={`filter-btn ${locationFilter === opt.value ? 'active' : ''}`}
                      onClick={() => setLocationFilter(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <label>🗣️ Language</label>
                <div className="filter-options">
                  <button
                    className={`filter-btn ${languageFilter === 'any' ? 'active' : ''}`}
                    onClick={() => setLanguageFilter('any')}
                  >
                    Any (shared)
                  </button>
                  {(userData?.languages || []).map((lang) => (
                    <button
                      key={lang}
                      className={`filter-btn ${languageFilter === lang ? 'active' : ''}`}
                      onClick={() => setLanguageFilter(lang)}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <label>🎂 Age Range</label>
                <div className="filter-options">
                  {AGE_RANGES.map((range) => (
                    <button
                      key={range.label}
                      className={`filter-btn ${ageRange.label === range.label ? 'active' : ''}`}
                      onClick={() => setAgeRange(range)}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            <button className="find-btn" onClick={findMatch}>
              Find Someone 🎲
            </button>
          </>
        )}

        {loading && (
          <div className="discover-loading">
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
            <p>Finding a match...</p>
          </div>
        )}

        {notFound && (
          <div className="no-match">
            <p>😔 No matches found!</p>
            <p>Try different filters or add more interests</p>
            <button className="find-btn" style={{ marginTop: '12px' }} onClick={handleReset}>
              Change Filters
            </button>
          </div>
        )}

        {match && (
          <div className="match-card">
            <div className="match-avatar" style={{ background: `linear-gradient(135deg, ${getColor(match.displayUsername)}, #302b63)` }}>
              {getAvatar(match.displayUsername)}
            </div>
            <h3>{match.displayUsername}</h3>
            <p className="match-appid">{match.appId}</p>
            {match.country && <p className="match-country">📍 {match.country}</p>}
            {match.age && <p className="match-age">🎂 {match.age} years old</p>}

            {sharedInterests.length > 0 && (
              <div className="match-shared">
                <p className="shared-label">🎯 Shared interests</p>
                <div className="match-interests">
                  {sharedInterests.map((i) => (
                    <span key={i} className="interest-tag">{i}</span>
                  ))}
                </div>
              </div>
            )}

            {sharedLanguages.length > 0 && (
              <div className="match-shared">
                <p className="shared-label">🗣️ Shared languages</p>
                <div className="match-interests">
                  {sharedLanguages.map((l) => (
                    <span key={l} className="interest-tag">{l}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="match-actions">
              <button className="skip-btn" onClick={handleSkip}>⏭️ Skip</button>
              <button className="chat-btn" onClick={handleChat}>💬 Chat</button>
            </div>
            <button className="change-filters-btn" onClick={handleReset}>⚙️ Change Filters</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Discover