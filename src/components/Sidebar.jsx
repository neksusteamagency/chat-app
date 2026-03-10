import { auth, db } from '../firebase'
import { signOut } from 'firebase/auth'
import { useState } from 'react'
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'
function Sidebar({ currentUser, userData, users, selectedUser, onSelectUser, unreadCounts, lastMessages, onDiscoverOpen, className }) {
      const [search, setSearch] = useState('')
const [searchResult, setSearchResult] = useState(null)
const [notFound, setNotFound] = useState(false)
  const handleLogout = async () => {
    await setDoc(doc(db, 'users', currentUser.uid), { online: false }, { merge: true })
    await signOut(auth)
  }

  const getAvatar = (name) => name?.charAt(0).toUpperCase()
  const colors = ['#7c6aff', '#ff6b9d', '#4ecdc4', '#ffa726', '#66bb6a', '#ef5350']
  const getColor = (name) => colors[name?.charCodeAt(0) % colors.length]

  const handleSearch = async (e) => {
  const value = e.target.value
  setSearch(value)
  setSearchResult(null)
  setNotFound(false)

  if (value.startsWith('#') && value.length >= 4) {
    const q = query(collection(db, 'users'), where('appId', '==', value.trim()))
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      const found = snapshot.docs[0].data()
      if (found.uid !== currentUser.uid) {
        setSearchResult(found)
      }
    } else {
      setNotFound(true)
    }
  }
}

  return (
<div className={`sidebar ${className || ''}`}>
        <div className="sidebar-header">
        <h2>💬 ChatApp</h2>
        <button className="discover-btn" onClick={() => onDiscoverOpen()}>🌍</button>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>

<div className="sidebar-profile" onClick={() => window.location.href = '/profile'} style={{ cursor: 'pointer' }}>
  <div className="avatar" style={{ background: `linear-gradient(135deg, ${getColor(userData?.displayUsername)}, #302b63)` }}>
    {getAvatar(userData?.displayUsername)}
  </div>
  <div className="profile-info">
    <h4>{userData?.displayUsername}</h4>
    <p>Online</p>
  </div>
  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>→</span>
</div>

<div className="users-list">
  <div className="search-box">
    <input
      type="text"
      placeholder="🔍 Search or enter #appId..."
      value={search}
      onChange={handleSearch}
    />
  </div>
  {searchResult && (
    <div className="search-result">
      <h3>Search Result</h3>
      <div
        className="user-item"
        onClick={() => { onSelectUser(searchResult); setSearch(''); setSearchResult(null) }}
      >
        <div className="user-avatar-wrap">
          <div className="avatar" style={{ background: `linear-gradient(135deg, ${getColor(searchResult.displayUsername)}, #302b63)` }}>
            {getAvatar(searchResult.displayUsername)}
          </div>
          {searchResult.online && <div className="online-dot" />}
        </div>
        <div className="user-info">
          <h4>{searchResult.displayUsername}</h4>
          <p>{searchResult.appId}</p>
        </div>
      </div>
    </div>
  )}
  {notFound && <p className="not-found">No user found with that App ID!</p>}
  {!searchResult && !notFound && (
    <>
      <h3>All Users</h3>
      {users
        .filter((user) => user?.displayUsername?.toLowerCase().includes(search.toLowerCase()))
        .map((user) => (
          <div
            key={user.uid}
            className={`user-item ${selectedUser?.uid === user.uid ? 'active' : ''}`}
            onClick={() => onSelectUser(user)}
          >
            <div className="user-avatar-wrap">
              <div className="avatar" style={{ background: `linear-gradient(135deg, ${getColor(user.displayUsername)}, #302b63)` }}>
                {getAvatar(user.displayUsername)}
              </div>
              {user.online && <div className="online-dot" />}
            </div>
            <div className="user-info">
              <h4>{user.displayUsername}</h4>
              <p className="last-message">
                {lastMessages[user.uid]
                  ? lastMessages[user.uid].senderId === currentUser.uid
                    ? `You: ${lastMessages[user.uid].text}`
                    : lastMessages[user.uid].text
                  : user.online ? 'Online' : 'Offline'}
              </p>
            </div>
            {unreadCounts[user.uid] > 0 && (
              <div className="badge">{unreadCounts[user.uid]}</div>
            )}
          </div>
        ))}
    </>
  )}
</div>
    </div>
  )
}

export default Sidebar