import { db } from '../firebase'
import { useState, useEffect } from 'react'
import { doc, setDoc, collection, query, where, getDocs, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore'

// At the top of the component, add pinnedChats and onPinChat to props:
function Sidebar({ currentUser, userData, users, selectedUser, onSelectUser, unreadCounts, lastMessages, onDiscoverOpen, className, pinnedChats, onPinChat }) {
    const [search, setSearch] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [friends, setFriends] = useState([])
  const [friendRequests, setFriendRequests] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [requestUserData, setRequestUserData] = useState({})

  const getAvatar = (name) => name?.charAt(0).toUpperCase()
  const colors = ['#7c6aff', '#ff6b9d', '#4ecdc4', '#ffa726', '#66bb6a', '#ef5350']
  const getColor = (name) => colors[name?.charCodeAt(0) % colors.length]

  // Listen to accepted friends
  useEffect(() => {
    if (!currentUser) return
    const q1 = query(collection(db, 'friends'), where('senderId', '==', currentUser.uid), where('status', '==', 'accepted'))
    const q2 = query(collection(db, 'friends'), where('receiverId', '==', currentUser.uid), where('status', '==', 'accepted'))

    const unsub1 = onSnapshot(q1, (snap) => {
      const ids = snap.docs.map((d) => d.data().receiverId)
      setFriends((prev) => {
        const filtered = prev.filter((f) => !ids.includes(f) && snap.docs.some((d) => d.data().senderId === currentUser.uid))
        return [...new Set([...prev.filter((f) => !snap.docs.map(d => d.data().receiverId).includes(f)), ...ids])]
      })
    })

    const unsub2 = onSnapshot(q2, (snap) => {
      const ids = snap.docs.map((d) => d.data().senderId)
      setFriends((prev) => [...new Set([...prev, ...ids])])
    })

    return () => { unsub1(); unsub2() }
  }, [currentUser])

  // Listen to incoming friend requests
  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'friends'), where('receiverId', '==', currentUser.uid), where('status', '==', 'pending'))
    const unsub = onSnapshot(q, async (snap) => {
      const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setFriendRequests(requests)

      // Fetch sender user data for each request
      const userData = {}
      for (const req of requests) {
        const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', req.senderId)))
        if (!userSnap.empty) userData[req.senderId] = userSnap.docs[0].data()
      }
      setRequestUserData(userData)
    })
    return () => unsub()
  }, [currentUser])

  const handleAccept = async (request) => {
    await updateDoc(doc(db, 'friends', request.id), { status: 'accepted' })
    // Also create reverse doc so both sides can query
    await setDoc(doc(db, 'friends', `${request.senderId}_${currentUser.uid}_accepted`), {
      senderId: request.senderId,
      receiverId: currentUser.uid,
      status: 'accepted',
    })
  }

  const handleDecline = async (request) => {
    await deleteDoc(doc(db, 'friends', request.id))
  }



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
        if (found.uid !== currentUser.uid) setSearchResult(found)
      } else {
        setNotFound(true)
      }
    }
  }

  // Get friend user objects from users list
  const friendUsers = users.filter((u) => friends.includes(u.uid))
  const filteredFriends = friendUsers.filter((u) =>
    u?.displayUsername?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={`sidebar ${className || ''}`}>

      {/* Header */}
      <div className="sidebar-header">
        <h2>💬 ChatApp</h2>
        <div className="header-btns">
          <button className="discover-btn" onClick={() => onDiscoverOpen()}>🌍</button>

          {/* Bell */}
          <button className="notif-btn" onClick={() => setShowNotifs(!showNotifs)}>
            🔔
            {friendRequests.length > 0 && (
              <span className="notif-badge">{friendRequests.length}</span>
            )}
          </button>

        </div>
      </div>

      {/* Notifications Panel */}
      {showNotifs && (
        <div className="notif-panel">
          <h4 className="notif-title">Friend Requests</h4>
          {friendRequests.length === 0 ? (
            <p className="notif-empty">No pending requests</p>
          ) : (
            friendRequests.map((req) => {
              const sender = requestUserData[req.senderId]
              return (
                <div key={req.id} className="notif-item">
                  <div className="avatar notif-avatar" style={{ background: `linear-gradient(135deg, ${getColor(sender?.displayUsername)}, #302b63)` }}>
                    {getAvatar(sender?.displayUsername)}
                  </div>
                  <div className="notif-info">
                    <p><strong>{sender?.displayUsername || '...'}</strong> wants to be your friend</p>
                  </div>
                  <div className="notif-actions">
                    <button className="accept-btn" onClick={() => handleAccept(req)}>✓</button>
                    <button className="decline-btn" onClick={() => handleDecline(req)}>✕</button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Profile */}
      <div className="sidebar-profile" onClick={() => window.location.href = '/profile'}>
        <div className="avatar" style={{ background: `linear-gradient(135deg, ${getColor(userData?.displayUsername)}, #302b63)` }}>
          {getAvatar(userData?.displayUsername)}
        </div>
        <div className="profile-info">
          <h4>{userData?.displayUsername}</h4>
          <p>Online</p>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>→</span>
      </div>

      {/* Users list */}
      <div className="users-list">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search or enter #appId..."
            value={search}
            onChange={handleSearch}
          />
        </div>

        {/* Search result */}
        {searchResult && (
          <div className="search-result">
            <h3>Search Result</h3>
            <div className="user-item" onClick={() => { onSelectUser(searchResult); setSearch(''); setSearchResult(null) }}>
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

        {/* Friends list */}
{!searchResult && !notFound && (
  <>
    {/* Pinned chats */}
    {pinnedChats.length > 0 && (
      <>
        <h3>📌 Pinned</h3>
        {users
          .filter((u) => pinnedChats.includes(u.uid))
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

    {/* Friends list */}
    <h3>Friends {friendUsers.length > 0 ? `(${friendUsers.length})` : ''}</h3>
    {filteredFriends.length === 0 ? (
      <div className="no-friends">
        <p>💬</p>
        <p>No friends yet!</p>
        <p>Use 🌍 Discover or search by #AppID</p>
      </div>
    ) : (
      filteredFriends
        .filter((u) => !pinnedChats.includes(u.uid))
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
        ))
    )}
  </>
)}
      </div>
    </div>
  )
}

export default Sidebar