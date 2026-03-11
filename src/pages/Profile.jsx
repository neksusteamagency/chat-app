import { useState } from 'react'
import { auth, db } from '../firebase'
import { doc, setDoc, collection, query, where, getDocs, deleteDoc  } from 'firebase/firestore'
import { updatePassword, deleteUser, reauthenticateWithCredential, EmailAuthProvider, signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import '../styles/profile.css'

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

const ACCENT_COLORS = [
  { label: 'Purple', value: '#7c6aff' },
  { label: 'Pink', value: '#ff6b9d' },
  { label: 'Teal', value: '#4ecdc4' },
  { label: 'Orange', value: '#ffa726' },
  { label: 'Green', value: '#66bb6a' },
  { label: 'Red', value: '#ef5350' },
]

const BACKGROUNDS = [
  { label: 'Deep Space', value: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
  { label: 'Ocean', value: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' },
  { label: 'Forest', value: 'linear-gradient(135deg, #0a3d0a, #1a5c1a, #0d3b0d)' },
  { label: 'Sunset', value: 'linear-gradient(135deg, #2d1b69, #11998e, #38ef7d)' },
  { label: 'Midnight', value: 'linear-gradient(135deg, #000000, #0a0a0a, #1a1a2e)' },
  { label: 'Galaxy', value: 'linear-gradient(135deg, #1a0533, #2d1b69, #11998e)' },
]

const handleLogout = async () => {
  await setDoc(doc(db, 'users', currentUser.uid), { online: false }, { merge: true })
  await signOut(auth)
  window.location.href = '/login'
}

function Section({ title, children }) {
  return (
    <div className="settings-section">
      <h3 className="section-title">{title}</h3>
      <div className="section-content">{children}</div>
    </div>
  )
}

function Profile({ userData, onUpdateUserData }) {
  const [username, setUsername] = useState(userData?.displayUsername || '')
  const [bio, setBio] = useState(userData?.bio || '')
  const [selectedInterests, setSelectedInterests] = useState(userData?.interests || [])
  const [selectedLanguages, setSelectedLanguages] = useState(userData?.languages || [])
  const [country, setCountry] = useState(userData?.countryFull || userData?.country || '')
  const [age, setAge] = useState(userData?.age || '')
  const [editingProfile, setEditingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [deletePassword, setDeletePassword] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [onlineStatus, setOnlineStatus] = useState(userData?.showOnline ?? true)
  const [lastSeen, setLastSeen] = useState(userData?.showLastSeen ?? true)
  const [findByAppId, setFindByAppId] = useState(userData?.findByAppId ?? true)

  const [accentColor, setAccentColor] = useState(userData?.accentColor || '#7c6aff')
  const [background, setBackground] = useState(userData?.background || BACKGROUNDS[0].value)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const currentUser = auth.currentUser

  const getAvatar = (name) => name?.charAt(0).toUpperCase()
  const colors = ['#7c6aff', '#ff6b9d', '#4ecdc4', '#ffa726', '#66bb6a', '#ef5350']
  const getColor = (name) => colors[name?.charCodeAt(0) % colors.length]

  const showSuccess = (msg) => { setSuccess(msg); setError(''); setTimeout(() => setSuccess(''), 3000) }
  const showError = (msg) => { setError(msg); setSuccess('') }

  const toggleInterest = (label) => {
    if (selectedInterests.includes(label)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== label))
    } else {
      if (selectedInterests.length >= 10) return showError('Max 10 interests!')
      setSelectedInterests([...selectedInterests, label])
    }
    setError('')
  }

  const toggleLanguage = (label) => {
    if (selectedLanguages.includes(label)) {
      setSelectedLanguages(selectedLanguages.filter((l) => l !== label))
    } else {
      if (selectedLanguages.length >= 5) return showError('Max 5 languages!')
      setSelectedLanguages([...selectedLanguages, label])
    }
    setError('')
  }

  const handleSaveProfile = async () => {
    setError('')
    if (username.trim() === '') return showError('Username cannot be empty!')
    if (username.length < 3) return showError('Username must be at least 3 characters!')
    if (selectedInterests.length === 0) return showError('Pick at least 1 interest!')
    if (selectedLanguages.length === 0) return showError('Pick at least 1 language!')
    if (!country) return showError('Please select your country!')
    if (!age || parseInt(age) < 13 || parseInt(age) > 100) return showError('Please enter a valid age (13-100)!')
    setLoading(true)
    try {
      if (username.toLowerCase() !== userData?.username) {
        const q = query(collection(db, 'users'), where('username', '==', username.trim().toLowerCase()))
        const existing = await getDocs(q)
        if (!existing.empty) { setLoading(false); return showError('Username already taken!') }
      }
      const countryName = country.includes(' ') ? country.split(' ').slice(1).join(' ') : country
      await setDoc(doc(db, 'users', currentUser.uid), {
        username: username.trim().toLowerCase(),
        displayUsername: username.trim(),
        bio: bio.trim(),
        interests: selectedInterests,
        languages: selectedLanguages,
        country: countryName,
        countryFull: country,
        age: parseInt(age),
      }, { merge: true })
      onUpdateUserData({
        ...userData,
        username: username.trim().toLowerCase(),
        displayUsername: username.trim(),
        bio: bio.trim(),
        interests: selectedInterests,
        languages: selectedLanguages,
        country: countryName,
        countryFull: country,
        age: parseInt(age),
      })
      setEditingProfile(false)
      showSuccess('Profile updated successfully!')
    } catch (_) {
      showError('Something went wrong!')
    }
    setLoading(false)
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) return showError('All fields are required!')
    if (newPassword !== confirmPassword) return showError('Passwords do not match!')
    if (newPassword.length < 6) return showError('Password must be at least 6 characters!')
    setLoading(true)
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword)
      await reauthenticateWithCredential(currentUser, credential)
      await updatePassword(currentUser, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showSuccess('Password changed successfully!')
    } catch (_) {
      showError('Current password is incorrect!')
    }
    setLoading(false)
  }

  const handleDeleteAccount = async () => {
    if (!deletePassword) return showError('Enter your password to confirm!')
    setLoading(true)
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, deletePassword)
      await reauthenticateWithCredential(currentUser, credential)
      await deleteDoc(doc(db, 'users', currentUser.uid))
      await deleteUser(currentUser)
      window.location.href = '/login'
    } catch (_) {
      showError('Incorrect password!')
    }
    setLoading(false)
  }

  const handleSavePrivacy = async () => {
    setLoading(true)
    try {
      await setDoc(doc(db, 'users', currentUser.uid), {
        showOnline: onlineStatus,
        showLastSeen: lastSeen,
        findByAppId,
      }, { merge: true })
      onUpdateUserData({ ...userData, showOnline: onlineStatus, showLastSeen: lastSeen, findByAppId })
      showSuccess('Privacy settings saved!')
    } catch (_) {
      showError('Something went wrong!')
    }
    setLoading(false)
  }

  const handleSaveAppearance = async () => {
    setLoading(true)
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { accentColor, background }, { merge: true })
      onUpdateUserData({ ...userData, accentColor, background })
      document.body.style.background = background
      showSuccess('Appearance saved!')
    } catch (_) {
      showError('Something went wrong!')
    }
    setLoading(false)
  }

  const formatDate = (date) => {
    if (!date) return ''
    const d = date.toDate ? date.toDate() : new Date(date)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <div className="profile-page" style={{ background: userData?.background || BACKGROUNDS[0].value }}>
      <div className="profile-wrapper">

        <div className="profile-topbar">
          <button className="back-btn" onClick={() => navigate('/chat')}>← Back</button>
          <h2>Profile & Settings</h2>
          <div />
        </div>

        {success && <div className="feedback-msg success">{success}</div>}
        {error && <div className="feedback-msg error">{error}</div>}

        {/* Avatar */}
        <div className="profile-avatar-section">
          <div className="profile-avatar" style={{ background: `linear-gradient(135deg, ${getColor(userData?.displayUsername)}, #302b63)` }}>
            {getAvatar(userData?.displayUsername)}
          </div>
          <h1>{userData?.displayUsername}</h1>
          <p className="profile-appid">{userData?.appId}</p>
          {userData?.bio && <p className="profile-bio">"{userData.bio}"</p>}
          <div className="profile-meta">
            {userData?.country && <span>📍 {userData.country}</span>}
            {userData?.age && <span>🎂 {userData.age} years old</span>}
          </div>
          <p className="profile-since">Member since {formatDate(userData?.createdAt)}</p>
        </div>

        {/* Edit Profile */}
        <Section title="👤 Edit Profile">
          {!editingProfile ? (
            <>
              <div className="info-row">
                <span>Username</span>
                <span>{userData?.displayUsername}</span>
              </div>
              <div className="info-row">
                <span>Bio</span>
                <span>{userData?.bio || '—'}</span>
              </div>
              <div className="info-row">
                <span>Age</span>
                <span>{userData?.age || '—'}</span>
              </div>
              <div className="info-row">
                <span>Country</span>
                <span>{userData?.countryFull || userData?.country || '—'}</span>
              </div>
              <div className="info-row">
                <span>Languages</span>
                <div className="mini-interests">
                  {userData?.languages?.map((l) => <span key={l} className="interest-tag">{l}</span>)}
                </div>
              </div>
              <div className="info-row">
                <span>Interests</span>
                <div className="mini-interests">
                  {userData?.interests?.map((i) => <span key={i} className="interest-tag">{i}</span>)}
                </div>
              </div>
              <button className="settings-btn" onClick={() => setEditingProfile(true)}>✏️ Edit Profile</button>
            </>
          ) : (
            <>
              <div className="input-group">
                <span>👤</span>
                <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>

              <div className="input-group">
                <span>✍️</span>
                <input
                  type="text"
                  placeholder="Short bio (max 150 chars)"
                  value={bio}
                  maxLength={150}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
              <p className="bio-counter">{bio.length}/150</p>

              <div className="input-group">
                <span>🎂</span>
                <input type="number" placeholder="Age" value={age} min="18" max="65" onChange={(e) => setAge(e.target.value)} />
              </div>

              <div className="input-group">
                <span>🌍</span>
                <select value={country} onChange={(e) => setCountry(e.target.value)} className="country-select">
                  <option value="">Select your country...</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <p className="interests-label">Languages <span>(max 5)</span></p>
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

              <p className="interests-label">Interests <span>(max 10)</span></p>
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

              <div className="btn-row">
                <button className="cancel-btn" onClick={() => setEditingProfile(false)}>Cancel</button>
                <button className="save-btn" onClick={handleSaveProfile} disabled={loading}>Save</button>
              </div>
            </>
          )}
        </Section>

        {/* Account */}
        <Section title="🔒 Account">
          <p className="section-label">Change Password</p>
          <div className="input-group">
            <span>🔒</span>
            <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="input-group">
            <span>🔑</span>
            <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="input-group">
            <span>🔑</span>
            <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <button className="settings-btn" onClick={handleChangePassword} disabled={loading}>Update Password</button>

          <div className="divider-line" />

          <p className="section-label danger">Danger Zone</p>
          {!showDeleteConfirm ? (
            <button className="danger-btn" onClick={() => setShowDeleteConfirm(true)}>🗑️ Delete Account</button>
          ) : (
            <>
              <p className="delete-warning">This action is irreversible! Enter your password to confirm.</p>
              <div className="input-group">
                <span>🔒</span>
                <input type="password" placeholder="Your password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
              </div>
              <div className="btn-row">
                <button className="cancel-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button className="danger-btn" onClick={handleDeleteAccount} disabled={loading}>Delete Forever</button>
              </div>
            </>
          )}
<button className="logout-btn-settings" onClick={handleLogout}>
  🚪 Logout
</button>
        </Section>

        {/* Privacy */}
        <Section title="🛡️ Privacy">
          <div className="toggle-row">
            <div>
              <p>Show online status</p>
              <span>Let others see when you're online</span>
            </div>
            <div className={`toggle ${onlineStatus ? 'on' : ''}`} onClick={() => setOnlineStatus(!onlineStatus)}>
              <div className="toggle-thumb" />
            </div>
          </div>
          <div className="toggle-row">
            <div>
              <p>Show last seen</p>
              <span>Let others see when you were last active</span>
            </div>
            <div className={`toggle ${lastSeen ? 'on' : ''}`} onClick={() => setLastSeen(!lastSeen)}>
              <div className="toggle-thumb" />
            </div>
          </div>
          <div className="toggle-row">
            <div>
              <p>Find me by App ID</p>
              <span>Allow others to find you using your App ID</span>
            </div>
            <div className={`toggle ${findByAppId ? 'on' : ''}`} onClick={() => setFindByAppId(!findByAppId)}>
              <div className="toggle-thumb" />
            </div>
          </div>
          <button className="settings-btn" onClick={handleSavePrivacy} disabled={loading}>Save Privacy Settings</button>
        </Section>

        {/* Appearance */}
        <Section title="🎨 Appearance">
          <p className="section-label">Accent Color</p>
          <div className="color-grid">
            {ACCENT_COLORS.map((color) => (
              <div key={color.value} className={`color-dot ${accentColor === color.value ? 'selected' : ''}`} style={{ background: color.value }} onClick={() => setAccentColor(color.value)} />
            ))}
          </div>
          <p className="section-label">Background</p>
          <div className="bg-grid">
            {BACKGROUNDS.map((bg) => (
              <div key={bg.value} className={`bg-option ${background === bg.value ? 'selected' : ''}`} style={{ background: bg.value }} onClick={() => setBackground(bg.value)}>
                <span>{bg.label}</span>
              </div>
            ))}
          </div>
          <button className="settings-btn" onClick={handleSaveAppearance} disabled={loading}>Save Appearance</button>
        </Section>

        {/* About */}
        <Section title="ℹ️ About">
          <div className="info-row">
            <span>App Version</span>
            <span>1.0.0</span>
          </div>
          <div className="info-row">
            <span>Made with</span>
            <span>love for nasriiiiiii</span>
          </div>
          <div className="about-links">
            <button className="about-link">Terms of Service</button>
            <button className="about-link">Privacy Policy</button>
          </div>
        </Section>

      </div>
    </div>
  )
}

export default Profile