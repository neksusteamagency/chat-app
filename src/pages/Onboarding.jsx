import { useState } from 'react'
import { auth, db } from '../firebase'
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import '../styles/auth.css'
import '../styles/onboarding.css'

const INTERESTS = [
  { emoji: '💻', label: 'Coding' },
  { emoji: '🎮', label: 'Gaming' },
  { emoji: '🎵', label: 'Music' },
  { emoji: '⚽', label: 'Sports' },
  { emoji: '🎨', label: 'Art' },
  { emoji: '✈️', label: 'Travel' },
  { emoji: '🎬', label: 'Movies' },
  { emoji: '📚', label: 'Reading' },
  { emoji: '🏋️', label: 'Fitness' },
  { emoji: '🍕', label: 'Food' },
  { emoji: '📸', label: 'Photography' },
  { emoji: '🚀', label: 'Science' },
]

function Onboarding() {
  const [username, setUsername] = useState('')
  const [selectedInterests, setSelectedInterests] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const currentUser = auth.currentUser

  const generateAppId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let id = '#'
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)]
    }
    return id
  }

  const toggleInterest = (label) => {
    if (selectedInterests.includes(label)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== label))
    } else {
      if (selectedInterests.length >= 5) return setError('Max 5 interests!')
      setSelectedInterests([...selectedInterests, label])
    }
    setError('')
  }

  const handleContinue = async () => {
    setError('')
    if (username.trim() === '') return setError('Please choose a username!')
    if (username.length < 3) return setError('Username must be at least 3 characters!')
    if (selectedInterests.length === 0) return setError('Please select at least 1 interest!')
    setLoading(true)

    try {
      // Check if username is taken
      const q = query(collection(db, 'users'), where('username', '==', username.trim().toLowerCase()))
      const existing = await getDocs(q)
      if (!existing.empty) {
        setError('Username already taken!')
        setLoading(false)
        return
      }

      const appId = generateAppId()

      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        email: currentUser.email,
        username: username.trim().toLowerCase(),
        displayUsername: username.trim(),
        appId,
        interests: selectedInterests,
        onboarded: true,
        online: true,
        createdAt: new Date()
      }, { merge: true })

      window.location.href = '/chat'
    } catch (_) {
      setError('Something went wrong, try again!')
    }
    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-box onboarding-box">
        <div className="auth-header">
          <div className="auth-logo">✨</div>
          <h1>Set up your profile</h1>
          <p>This is how others will see you!</p>
        </div>

        <div className="auth-form">
          {error && <div className="error-msg">{error}</div>}

          <div className="input-group">
            <span>👤</span>
            <input
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="interests-section">
            <p className="interests-label">Pick your interests <span>(max 5)</span></p>
            <div className="interests-grid">
              {INTERESTS.map((interest) => (
                <button
                  key={interest.label}
                  className={`interest-btn ${selectedInterests.includes(interest.label) ? 'selected' : ''}`}
                  onClick={() => toggleInterest(interest.label)}
                >
                  {interest.emoji} {interest.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleContinue} disabled={loading}>
            {loading ? 'Setting up...' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Onboarding