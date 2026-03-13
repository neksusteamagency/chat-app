import { db, rtdb } from '../firebase'
import { useState, useEffect } from 'react'
import { doc, setDoc, collection, query, where, getDocs, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore'
import { ref, onValue } from 'firebase/database'
import { useNavigate } from 'react-router-dom'

// ✅ Reads RTDB presence + respects showOnline privacy setting
function UserItem({ user, selectedUser, onSelectUser, currentUser, lastMessages, unreadCounts }) {
  const [isOnline, setIsOnline] = useState(false)

  const getAvatar = (name) => name?.charAt(0).toUpperCase()
  const colors = ['#7c6aff', '#ff6b9d', '#4ecdc4', '#ffa726', '#66bb6a', '#ef5350']
  const getColor = (name) => colors[name?.charCodeAt(0) % colors.length]

  useEffect(() => {
    if (!user?.uid) return
    const statusRef = ref(rtdb, `status/${user.uid}`)
    const unsub = onValue(statusRef, (snap) => {
      if (snap.exists()) {
        setIsOnline(snap.val().online === true)
      } else {
        setIsOnline(false)
      }
    })
    return () => unsub()
  }, [user?.uid])

  // ✅ Respect privacy: only show online dot if user allows it
  const showOnlineDot = isOnline && (user.showOnline !== false)

  return (
    <div
      key={user.uid}
      className={`user-item ${selectedUser?.uid === user.uid ? 'active' : ''}`}
      onClick={() => onSelectUser(user)}
    >
      <div className="user-avatar-wrap">
        <div className="avatar" style={{ background: `linear-gradient(135deg, ${getColor(user.displayUsername)}, #302b63)` }}>
          {getAvatar(user.displayUsername)}
        </div>
        {showOnlineDot && <div className="online-dot" />}
      </div>
      <div className="user-info">
        <h4>{user.displayUsername}</h4>
        <p className="last-message">
          {lastMessages[user.uid]
            ? lastMessages[user.uid].deleted
              ? '🚫 Message deleted'
              : lastMessages[user.uid].senderId === currentUser.uid
                ? `You: ${lastMessages[user.uid].text}`
                : lastMessages[user.uid].text
            : showOnlineDot ? 'Online' : 'Offline'}
        </p>
      </div>
      {unreadCounts[user.uid] > 0 && (
        <div className="badge">{unreadCounts[user.uid]}</div>
      )}
    </div>
  )
}

function Sidebar({ currentUser, userData, users, selectedUser, onSelectUser, unreadCounts, lastMessages, onDiscoverOpen, className, pinnedChats, onPinChat }) {
  const [search, setSearch] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [friends, setFriends] = useState([])
  const [friendRequests, setFriendRequests] = useState([])
  const [requestUserData, setRequestUserData] = useState({})
  const [activeTab, setActiveTab] = useState('friends')
  const [messageRequests, setMessageRequests] = useState([])
  const [acceptedChats, setAcceptedChats] = useState([])
  const navigate = useNavigate()

  const getAvatar = (name) => name?.charAt(0).toUpperCase()
  const colors = ['#7c6aff', '#ff6b9d', '#4ecdc4', '#ffa726', '#66bb6a', '#ef5350']
  const getColor = (name) => colors[name?.charCodeAt(0) % colors.length]

  useEffect(() => {
    if (!currentUser) return
    const q1 = query(collection(db, 'friends'), where('senderId', '==', currentUser.uid), where('status', '==', 'accepted'))
    const q2 = query(collection(db, 'friends'), where('receiverId', '==', currentUser.uid), where('status', '==', 'accepted'))
    const unsub1 = onSnapshot(q1, (snap) => {
      const ids = snap.docs.map((d) => d.data().receiverId)
      setFriends((prev) => [...new Set([...prev.filter((f) => !snap.docs.map(d => d.data().receiverId).includes(f)), ...ids])])
    })
    const unsub2 = onSnapshot(q2, (snap) => {
      const ids = snap.docs.map((d) => d.data().senderId)
      setFriends((prev) => [...new Set([...prev, ...ids])])
    })
    return () => { unsub1(); unsub2() }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'friends'), where('receiverId', '==', currentUser.uid), where('status', '==', 'pending'))
    const unsub = onSnapshot(q, async (snap) => {
      const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setFriendRequests(requests)
      const data = {}
      for (const req of requests) {
        const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', req.senderId)))
        if (!userSnap.empty) data[req.senderId] = userSnap.docs[0].data()
      }
      setRequestUserData(data)
    })
    return () => unsub()
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'messageRequests'), where('toUid', '==', currentUser.uid), where('status', '==', 'pending'))
    const unsub = onSnapshot(q, async (snap) => {
      const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setMessageRequests(requests)
    })
    return () => unsub()
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) return
    const q1 = query(collection(db, 'messageRequests'), where('toUid', '==', currentUser.uid), where('status', '==', 'accepted'))
    const q2 = query(collection(db, 'messageRequests'), where('fromUid', '==', currentUser.uid), where('status', '==', 'accepted'))
    const unsub1 = onSnapshot(q1, (snap) => {
      const ids = snap.docs.map((d) => d.data().fromUid)
      setAcceptedChats((prev) => [...new Set([...prev, ...ids])])
    })
    const unsub2 = onSnapshot(q2, (snap) => {
      const ids = snap.docs.map((d) => d.data().toUid)
      setAcceptedChats((prev) => [...new Set([...prev, ...ids])])
    })
    return () => { unsub1(); unsub2() }
  }, [currentUser])

  const handleAcceptFriend = async (request) => {
    await updateDoc(doc(db, 'friends', request.id), { status: 'accepted' })
    await setDoc(doc(db, 'friends', `${request.senderId}_${currentUser.uid}_accepted`), {
      senderId: request.senderId,
      receiverId: currentUser.uid,
      status: 'accepted',
    })
  }

  const handleDeclineFriend = async (request) => {
    await deleteDoc(doc(db, 'friends', request.id))
  }

  const handleAcceptMessage = async (request) => {
    await updateDoc(doc(db, 'messageRequests', request.id), { status: 'accepted' })
  }

  const handleDeclineMessage = async (request) => {
    await deleteDoc(doc(db, 'messageRequests', request.id))
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

  const friendUsers = users.filter((u) => friends.includes(u.uid))
  const filteredFriends = friendUsers.filter((u) =>
    u?.displayUsername?.toLowerCase().includes(search.toLowerCase())
  )
  const chatUsers = users.filter((u) => acceptedChats.includes(u.uid) && !friends.includes(u.uid))
  const totalRequests = friendRequests.length + messageRequests.length

  const renderUserItem = (user) => (
    <UserItem
      key={user.uid}
      user={user}
      selectedUser={selectedUser}
      onSelectUser={onSelectUser}
      currentUser={currentUser}
      lastMessages={lastMessages}
      unreadCounts={unreadCounts}
    />
  )

  return (
    <div className={`sidebar ${className || ''}`}>
      <div className="sidebar-header">
        <h2>💬 ChatApp</h2>
        <div className="header-btns">
          <button className="discover-btn" onClick={() => onDiscoverOpen()}>🌍</button>
        </div>
      </div>

      <div className="sidebar-profile" onClick={() => navigate('/profile')}>
        <div className="avatar" style={{ background: `linear-gradient(135deg, ${getColor(userData?.displayUsername)}, #302b63)` }}>
          {getAvatar(userData?.displayUsername)}
        </div>
        <div className="profile-info">
          <h4>{userData?.displayUsername}</h4>
          <p>Online</p>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>→</span>
      </div>

      <div className="sidebar-tabs">
        <button className={`sidebar-tab ${activeTab === 'friends' ? 'active' : ''}`} onClick={() => setActiveTab('friends')}>Friends</button>
        <button className={`sidebar-tab ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')}>Chats</button>
        <button className={`sidebar-tab ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
          Requests
          {totalRequests > 0 && <span className="tab-badge">{totalRequests}</span>}
        </button>
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
            <div className="user-item" onClick={() => { onSelectUser(searchResult); setSearch(''); setSearchResult(null) }}>
              <div className="user-avatar-wrap">
                <div className="avatar" style={{ background: `linear-gradient(135deg, ${getColor(searchResult.displayUsername)}, #302b63)` }}>
                  {getAvatar(searchResult.displayUsername)}
                </div>
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
            {activeTab === 'friends' && (
              <>
                {pinnedChats.length > 0 && (
                  <>
                    <h3>📌 Pinned</h3>
                    {users.filter((u) => pinnedChats.includes(u.uid)).map(renderUserItem)}
                  </>
                )}
                <h3>Friends {friendUsers.length > 0 ? `(${friendUsers.length})` : ''}</h3>
                {filteredFriends.length === 0 ? (
                  <div className="no-friends">
                    <p>💬</p>
                    <p>No friends yet!</p>
                    <p>Use 🌍 Discover or search by #AppID</p>
                  </div>
                ) : (
                  filteredFriends.filter((u) => !pinnedChats.includes(u.uid)).map(renderUserItem)
                )}
              </>
            )}

            {activeTab === 'chats' && (
              <>
                <h3>Chats {chatUsers.length > 0 ? `(${chatUsers.length})` : ''}</h3>
                {chatUsers.length === 0 ? (
                  <div className="no-friends">
                    <p>💬</p>
                    <p>No chats yet!</p>
                    <p>Accept message requests to start chatting</p>
                  </div>
                ) : (
                  chatUsers.map(renderUserItem)
                )}
              </>
            )}

            {activeTab === 'requests' && (
              <>
                {friendRequests.length > 0 && (
                  <>
                    <h3>Friend Requests ({friendRequests.length})</h3>
                    {friendRequests.map((req) => {
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
                            <button className="accept-btn" onClick={() => handleAcceptFriend(req)}>✓</button>
                            <button className="decline-btn" onClick={() => handleDeclineFriend(req)}>✕</button>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                {messageRequests.length > 0 && (
                  <>
                    <h3>Message Requests ({messageRequests.length})</h3>
                    {messageRequests.map((req) => {
                      const sender = users.find((u) => u.uid === req.fromUid)
                      return (
                        <div key={req.id} className="notif-item">
                          <div className="avatar notif-avatar" style={{ background: `linear-gradient(135deg, ${getColor(sender?.displayUsername)}, #302b63)` }}>
                            {getAvatar(sender?.displayUsername)}
                          </div>
                          <div className="notif-info">
                            <p><strong>{sender?.displayUsername || '...'}</strong> wants to chat with you</p>
                          </div>
                          <div className="notif-actions">
                            <button className="accept-btn" onClick={() => handleAcceptMessage(req)}>✓</button>
                            <button className="decline-btn" onClick={() => handleDeclineMessage(req)}>✕</button>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                {totalRequests === 0 && (
                  <div className="no-friends">
                    <p>🔔</p>
                    <p>No pending requests</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Sidebar