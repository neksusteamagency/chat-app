import { auth , db} from '../firebase'
import { signOut } from 'firebase/auth'
import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'

function Sidebar({ currentUser, users, selectedUser, onSelectUser , unreadCounts , lastMessages }) {
const handleLogout = async () => {
  await updateDoc(doc(db, 'users', currentUser.uid), { online: false })
  await signOut(auth)
}
  const [search, setSearch] = useState('')

  const getAvatar = (name) => name?.charAt(0).toUpperCase()

  const colors = ['#7c6aff', '#ff6b9d', '#4ecdc4', '#ffa726', '#66bb6a', '#ef5350']
  const getColor = (name) => colors[name?.charCodeAt(0) % colors.length]

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>💬 ChatApp</h2>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>

      <div className="sidebar-profile">
        <div className="avatar" style={{ background: `linear-gradient(135deg, ${getColor(currentUser?.displayName)}, #302b63)` }}>
          {getAvatar(currentUser?.displayName)}
        </div>
        <div className="profile-info">
          <h4>{currentUser?.displayName}</h4>
          <p>Online</p>
        </div>
      </div>

<div className="users-list">
  <div className="search-box">
    <input
      type="text"
      placeholder="🔍 Search users..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  </div>
  <h3>All Users</h3>
  {users
    .filter((user) => user.name.toLowerCase().includes(search.toLowerCase()))
    .map((user) => (
      <div
        key={user.uid}
        className={`user-item ${selectedUser?.uid === user.uid ? 'active' : ''}`}
        onClick={() => onSelectUser(user)}
      >
        <div className="user-avatar-wrap">
          <div className="avatar" style={{ background: `linear-gradient(135deg, ${getColor(user.name)}, #302b63)` }}>
            {getAvatar(user.name)}
          </div>
          {user.online && <div className="online-dot" />}
        </div>
        <div className="user-info">
          <h4>{user.name}</h4>
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
</div>
    </div>
  )
}

export default Sidebar