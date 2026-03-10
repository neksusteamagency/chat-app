import { useState } from 'react'
import { auth , db} from '../firebase'
import { signInWithEmailAndPassword, reload } from 'firebase/auth'
import { useNavigate, } from 'react-router-dom'
import '../styles/auth.css'
import { doc, getDoc } from 'firebase/firestore'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

const handleLogin = async () => {
  setError('')
  setLoading(true)
  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    await reload(result.user)
    if (!result.user.emailVerified) {
      await auth.signOut()
      setError('Please verify your email first! Check your inbox.')
      setLoading(false)
      return
    }
    const userDoc = await getDoc(doc(db, 'users', result.user.uid))
    const isOnboarded = userDoc.exists() ? userDoc.data().onboarded : false
    window.location.href = isOnboarded ? '/chat' : '/onboarding'
  } catch (_) {
    setError('Invalid email or password!')
  }
  setLoading(false)
}

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <div className="auth-logo">💬</div>
          <h1>Welcome back!</h1>
          <p>Login to continue to ChatApp</p>
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
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div className="input-group">
            <span>🔒</span>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <button onClick={handleLogin} disabled={loading}>
            {loading ? 'Logging in...' : 'Login →'}
          </button>
          <div className="divider"><span>or</span></div>
          <p className="auth-switch">
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login