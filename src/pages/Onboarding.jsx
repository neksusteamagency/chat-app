import { useState } from 'react'
import { auth, db } from '../firebase'
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'
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
  { emoji: '🎭', label: 'Theater' },
  { emoji: '🎤', label: 'Singing' },
  { emoji: '🎸', label: 'Instruments' },
  { emoji: '🏄', label: 'Surfing' },
  { emoji: '🧘', label: 'Meditation' },
  { emoji: '🍳', label: 'Cooking' },
  { emoji: '🌿', label: 'Nature' },
  { emoji: '🐾', label: 'Animals' },
  { emoji: '💄', label: 'Fashion' },
  { emoji: '🏠', label: 'Interior Design' },
  { emoji: '📱', label: 'Technology' },
  { emoji: '💰', label: 'Finance' },
  { emoji: '🧠', label: 'Psychology' },
  { emoji: '🌍', label: 'Culture' },
  { emoji: '✍️', label: 'Writing' },
  { emoji: '🎲', label: 'Board Games' },
  { emoji: '🚗', label: 'Cars' },
  { emoji: '⚡', label: 'Anime' },
  { emoji: '🏔️', label: 'Hiking' },
  { emoji: '🎯', label: 'Self Improvement' },
  { emoji: '🌙', label: 'Astrology' },
  { emoji: '🤝', label: 'Volunteering' },
  { emoji: '🎪', label: 'Entertainment' },
]

const LANGUAGES = [
  { emoji: '🇬🇧', label: 'English' },
  { emoji: '🇫🇷', label: 'French' },
  { emoji: '🇸🇦', label: 'Arabic' },
  { emoji: '🇪🇸', label: 'Spanish' },
  { emoji: '🇩🇪', label: 'German' },
  { emoji: '🇨🇳', label: 'Chinese' },
  { emoji: '🇯🇵', label: 'Japanese' },
  { emoji: '🇰🇷', label: 'Korean' },
  { emoji: '🇧🇷', label: 'Portuguese' },
  { emoji: '🇷🇺', label: 'Russian' },
  { emoji: '🇮🇳', label: 'Hindi' },
  { emoji: '🇮🇹', label: 'Italian' },
  { emoji: '🇹🇷', label: 'Turkish' },
  { emoji: '🇳🇱', label: 'Dutch' },
  { emoji: '🇵🇱', label: 'Polish' },
  { emoji: '🇸🇪', label: 'Swedish' },
  { emoji: '🇬🇷', label: 'Greek' },
  { emoji: '🇮🇷', label: 'Persian' },
]

const COUNTRIES = [
  '🇱🇧 Lebanon', '🇺🇸 United States', '🇬🇧 United Kingdom', '🇫🇷 France',
  '🇩🇪 Germany', '🇸🇦 Saudi Arabia', '🇦🇪 UAE', '🇪🇬 Egypt',
  '🇯🇴 Jordan', '🇸🇾 Syria', '🇮🇶 Iraq', '🇲🇦 Morocco',
  '🇹🇳 Tunisia', '🇩🇿 Algeria', '🇹🇷 Turkey', '🇯🇵 Japan',
  '🇰🇷 Korea', '🇨🇳 China', '🇮🇳 India', '🇧🇷 Brazil',
  '🇨🇦 Canada', '🇦🇺 Australia', '🇮🇹 Italy', '🇪🇸 Spain',
  '🇵🇹 Portugal', '🇷🇺 Russia', '🇳🇱 Netherlands', '🇸🇪 Sweden',
  '🇳🇴 Norway', '🇨🇭 Switzerland', '🇲🇽 Mexico', '🇦🇷 Argentina',
  '🇿🇦 South Africa', '🇳🇬 Nigeria', '🇰🇪 Kenya', '🇮🇩 Indonesia',
  '🇵🇰 Pakistan', '🇧🇩 Bangladesh', '🇵🇭 Philippines', '🇹🇭 Thailand',
]

const STEPS = ['profile', 'interests', 'languages', 'location', 'age']

function Onboarding() {
  const [step, setStep] = useState(0)
  const [username, setUsername] = useState('')
  const [selectedInterests, setSelectedInterests] = useState([])
  const [selectedLanguages, setSelectedLanguages] = useState([])
  const [country, setCountry] = useState('')
  const [age, setAge] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const currentUser = auth.currentUser

  const generateAppId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let id = '#'
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)]
    return id
  }

  const toggleInterest = (label) => {
    if (selectedInterests.includes(label)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== label))
    } else {
      if (selectedInterests.length >= 10) return setError('Max 10 interests!')
      setSelectedInterests([...selectedInterests, label])
    }
    setError('')
  }

  const toggleLanguage = (label) => {
    if (selectedLanguages.includes(label)) {
      setSelectedLanguages(selectedLanguages.filter((l) => l !== label))
    } else {
      if (selectedLanguages.length >= 5) return setError('Max 5 languages!')
      setSelectedLanguages([...selectedLanguages, label])
    }
    setError('')
  }

  const handleNext = async () => {
    setError('')

    if (step === 0) {
      if (username.trim() === '') return setError('Please choose a username!')
      if (username.length < 3) return setError('Username must be at least 3 characters!')
      setLoading(true)
      const q = query(collection(db, 'users'), where('username', '==', username.trim().toLowerCase()))
      const existing = await getDocs(q)
      setLoading(false)
      if (!existing.empty) return setError('Username already taken!')
      setStep(1)
    } else if (step === 1) {
      if (selectedInterests.length === 0) return setError('Pick at least 1 interest!')
      setStep(2)
    } else if (step === 2) {
      if (selectedLanguages.length === 0) return setError('Pick at least 1 language!')
      setStep(3)
    } else if (step === 3) {
      if (country === '') return setError('Please select your country!')
      setStep(4)
    } else if (step === 4) {
      if (age === '') return setError('Please enter your age!')
      const ageNum = parseInt(age)
      if (isNaN(ageNum) || ageNum < 13 || ageNum > 100) return setError('Please enter a valid age (13-100)!')
      await handleSubmit(ageNum)
    }
  }

  const handleSubmit = async (ageNum) => {
    setLoading(true)
    try {
      const appId = generateAppId()
      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        email: currentUser.email,
        username: username.trim().toLowerCase(),
        displayUsername: username.trim(),
        appId,
        interests: selectedInterests,
        languages: selectedLanguages,
        country: country.split(' ').slice(1).join(' '),
        countryFull: country,
        age: ageNum,
        onboarded: true,
        online: true,
        createdAt: new Date(),
      }, { merge: true })
      window.location.href = '/chat'
    } catch (_) {
      setError('Something went wrong, try again!')
    }
    setLoading(false)
  }

  const progressWidth = `${((step) / (STEPS.length - 1)) * 100}%`

  return (
    <div className="auth-container">
      <div className="auth-box onboarding-box">

        {/* Progress bar */}
        <div className="onboarding-progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: progressWidth }} />
          </div>
          <p className="progress-text">Step {step + 1} of {STEPS.length}</p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {/* Step 0: Username */}
        {step === 0 && (
          <div className="auth-form">
            <div className="auth-header">
              <div className="auth-logo">👤</div>
              <h1>Choose a username</h1>
              <p>This is how others will find you</p>
            </div>
            <div className="input-group">
              <span>👤</span>
              <input
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              />
            </div>
            <button onClick={handleNext} disabled={loading}>
              {loading ? 'Checking...' : 'Continue →'}
            </button>
          </div>
        )}

        {/* Step 1: Interests */}
        {step === 1 && (
          <div className="auth-form">
            <div className="auth-header">
              <div className="auth-logo">🎯</div>
              <h1>Your interests</h1>
              <p>Pick up to 10 things you love</p>
            </div>
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
            <div className="step-counter">{selectedInterests.length}/10 selected</div>
            <div className="onboarding-nav">
              <button className="back-step-btn" onClick={() => setStep(0)}>← Back</button>
              <button onClick={handleNext}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 2: Languages */}
        {step === 2 && (
          <div className="auth-form">
            <div className="auth-header">
              <div className="auth-logo">🗣️</div>
              <h1>Languages you speak</h1>
              <p>Pick up to 5 languages</p>
            </div>
            <div className="interests-grid">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.label}
                  className={`interest-btn ${selectedLanguages.includes(lang.label) ? 'selected' : ''}`}
                  onClick={() => toggleLanguage(lang.label)}
                >
                  {lang.emoji} {lang.label}
                </button>
              ))}
            </div>
            <div className="step-counter">{selectedLanguages.length}/5 selected</div>
            <div className="onboarding-nav">
              <button className="back-step-btn" onClick={() => setStep(1)}>← Back</button>
              <button onClick={handleNext}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3: Country */}
        {step === 3 && (
          <div className="auth-form">
            <div className="auth-header">
              <div className="auth-logo">🌍</div>
              <h1>Where are you from?</h1>
              <p>Used for Discover matching</p>
            </div>
            <div className="input-group">
              <span>🌍</span>
              <select
                value={country}
                onChange={(e) => { setCountry(e.target.value); setError('') }}
                className="country-select"
              >
                <option value="">Select your country...</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="onboarding-nav">
              <button className="back-step-btn" onClick={() => setStep(2)}>← Back</button>
              <button onClick={handleNext}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 4: Age */}
        {step === 4 && (
          <div className="auth-form">
            <div className="auth-header">
              <div className="auth-logo">🎂</div>
              <h1>How old are you?</h1>
              <p>Used to match you with people your age</p>
            </div>
            <div className="input-group">
              <span>🎂</span>
              <input
                type="number"
                placeholder="Your age"
                value={age}
                min="18"
                max="65"
                onChange={(e) => { setAge(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              />
            </div>
            <div className="onboarding-nav">
              <button className="back-step-btn" onClick={() => setStep(3)}>← Back</button>
              <button onClick={handleNext} disabled={loading}>
                {loading ? 'Setting up...' : "Let's go 🚀"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default Onboarding