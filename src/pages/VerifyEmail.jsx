import { useState, useEffect } from 'react'
import { auth } from '../firebase'
import { sendEmailVerification, reload } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import '../styles/auth.css'

function VerifyEmail() {
  const [resent, setResent] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const interval = setInterval(async () => {
      if (auth.currentUser) {
        await reload(auth.currentUser)
        if (auth.currentUser.emailVerified) {
          clearInterval(interval)
window.location.href = '/onboarding'
        }
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleResend = async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser)
      }
      setResent(true)
    } catch (_) {
      setResent(true)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <div className="auth-logo">📧</div>
          <h1>Verify your email</h1>
          <p>We sent a verification link to your email. Click it and you'll be redirected automatically!</p>
        </div>
        <div className="auth-form">
          {resent && (
            <div className="error-msg" style={{ background: 'rgba(76, 175, 80, 0.12)', borderColor: 'rgba(76, 175, 80, 0.3)', color: '#4caf50' }}>
              Verification email resent!
            </div>
          )}
          <div className="error-msg" style={{ background: 'rgba(124, 106, 255, 0.12)', borderColor: 'rgba(124, 106, 255, 0.3)', color: '#7c6aff' }}>
            ⏳ Waiting for verification... App will open automatically!
          </div>
          <button onClick={handleResend} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            Resend Email
          </button>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmail