import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { auth, db } from './firebase'
import { onAuthStateChanged, reload } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Chat from './pages/Chat'
import SplashScreen from './components/SplashScreen'
import VerifyEmail from './pages/VerifyEmail'
import Onboarding from './pages/Onboarding'
import Profile from './pages/Profile'

function App() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSplash, setShowSplash] = useState(true)
  const [onboarded, setOnboarded] = useState(false)

  const handleUpdateUserData = (newData) => {
    setUserData(newData)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await reload(currentUser)
        setUser({ ...currentUser })
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
        if (userDoc.exists()) {
          setUserData(userDoc.data())
          setOnboarded(userDoc.data().onboarded || false)
        }
      } else {
        setUser(null)
        setUserData(null)
        setOnboarded(false)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    setTimeout(() => setShowSplash(false), 2500)
  }, [])

  useEffect(() => {
    if (userData?.background) {
      document.body.style.background = userData.background
    }
  }, [userData])

  if (showSplash) return <SplashScreen />
  if (loading) return <div className="loading">Loading...</div>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user && user.emailVerified ? onboarded ? <Navigate to="/chat" /> : <Navigate to="/onboarding" /> : <Navigate to="/login" />} />
        <Route path="/login" element={!user || !user.emailVerified ? <Login /> : onboarded ? <Navigate to="/chat" /> : <Navigate to="/onboarding" />} />
        <Route path="/signup" element={!user || !user.emailVerified ? <Signup /> : <Navigate to="/onboarding" />} />
        <Route path="/verify-email" element={!user ? <Navigate to="/login" /> : user.emailVerified ? <Navigate to="/onboarding" /> : <VerifyEmail />} />
        <Route path="/onboarding" element={user && user.emailVerified ? !onboarded ? <Onboarding /> : <Navigate to="/chat" /> : <Navigate to="/login" />} />
        <Route path="/chat" element={user && user.emailVerified && onboarded ? <Chat userData={userData} /> : <Navigate to="/login" />} />
        <Route path="/profile" element={user && user.emailVerified && onboarded ? <Profile userData={userData} onUpdateUserData={handleUpdateUserData} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App