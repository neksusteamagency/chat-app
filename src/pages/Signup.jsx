import { useState } from 'react'
import { auth, db } from '../firebase'
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { useNavigate, Link } from 'react-router-dom'
import '../styles/auth.css'

function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSignup = async () => {
    setError('')
    if (email === '' || password === '') return setError('All fields are required!')
    if (password.length < 6) return setError('Password must be at least 6 characters!')
    setLoading(true)
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      await sendEmailVerification(result.user)
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email,
        createdAt: new Date(),
        online: false,
        onboarded: false
      })
      navigate('/verify-email')
    } catch (_) {
      setError('Email already in use!')
    }
    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <div className="auth-logo">✨</div>
          <h1>Create account</h1>
          <p>Join ChatApp today for free</p>
        </div>
        <div className="auth-form">
          {error && <div className="error-msg">{error}</div>}
          <div className="input-group">
            <span>📧</span>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="input-group">
            <span>🔒</span>
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
            />
          </div>
          <button onClick={handleSignup} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account →'}
          </button>
          <div className="divider"><span>or</span></div>
          <p className="auth-switch">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Signup