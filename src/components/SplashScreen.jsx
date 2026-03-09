import { useEffect, useState } from 'react'

function SplashScreen() {
  const [fade, setFade] = useState(false)

  useEffect(() => {
    setTimeout(() => setFade(true), 1500)
  }, [])

  return (
    <div className={`splash ${fade ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <div className="splash-logo">💬</div>
        <h1>ChatApp</h1>
        <p>Connect with anyone, anywhere</p>
        <div className="splash-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  )
}

export default SplashScreen