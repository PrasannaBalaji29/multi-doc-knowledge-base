import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Trash2, Plus, Search, Pin, PinOff, Pencil, X, Check } from 'lucide-react'
import { pinSession, renameSession, deleteSession } from '../api/chat'

export default function Sidebar({ history, onNewChat, onClear, onSelectChat, activeSession, onHistoryChange }) {
  const [search, setSearch]           = useState('')
  const [menuOpenId, setMenuOpenId]   = useState(null)
  const [renamingId, setRenamingId]   = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const menuRef                       = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredHistory = history.filter(item =>
    (item.custom_title || item.title || item.question).toLowerCase().includes(search.toLowerCase())
  )

  const groupByDate = (items) => {
    const pinned = items.filter(i => i.is_pinned)
    const unpinned = items.filter(i => !i.is_pinned)

    const groups = { Pinned: pinned, Today: [], Yesterday: [], Older: [] }

    unpinned.forEach(item => {
      const raw  = item.timestamp
      const date = new Date(raw + '+05:30')
      const now  = new Date()
      const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

      if (itemDay.getTime() === today.getTime()) {
        groups.Today.push(item)
      } else if (itemDay.getTime() === yesterday.getTime()) {
        groups.Yesterday.push(item)
      } else {
        groups.Older.push(item)
      }
    })
    return groups
  }

  const grouped = groupByDate(filteredHistory)

  const handlePin = async (e, item) => {
    e.stopPropagation()
    setMenuOpenId(null)
    const newVal = !item.is_pinned
    await pinSession(item.session_id, newVal)
    onHistoryChange()
  }

  const handleRenameStart = (e, item) => {
    e.stopPropagation()
    setMenuOpenId(null)
    setRenamingId(item.session_id)
    setRenameValue(item.custom_title || item.title || item.question)
  }

  const handleRenameSubmit = async (session_id) => {
    if (renameValue.trim()) {
      await renameSession(session_id, renameValue.trim())
      onHistoryChange()
    }
    setRenamingId(null)
  }

  const handleDelete = async (e, item) => {
    e.stopPropagation()
    setMenuOpenId(null)
    if (!window.confirm('Delete this chat?')) return
    await deleteSession(item.session_id)
    onHistoryChange()
  }

  const renderChatItem = (item, i) => {
    const displayTitle = item.custom_title || item.title || item.question
    const isActive     = activeSession === item.session_id
    const isMenuOpen   = menuOpenId === item.session_id
    const isRenaming   = renamingId === item.session_id

    return (
      <div
        key={i}
        onClick={() => !isRenaming && onSelectChat(item.session_id)}
        style={{
          padding: '8px 10px',
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: '2px',
          background: isActive ? '#1e1e3a' : 'transparent',
          border: isActive ? '1px solid #2a2a4a' : '1px solid transparent',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          group: 'item'
        }}
      >
        {/* Pin indicator */}
        {item.is_pinned && (
          <Pin size={10} color="#a78bfa" style={{ flexShrink: 0 }} />
        )}

        {/* Title or rename input */}
        {isRenaming ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}
            onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameSubmit(item.session_id)
                if (e.key === 'Escape') setRenamingId(null)
              }}
              style={{
                flex: 1,
                background: '#0a0a18',
                border: '1px solid #7c3aed',
                borderRadius: '4px',
                color: '#f0f0f0',
                fontSize: '12px',
                padding: '2px 6px',
                outline: 'none'
              }}
            />
            <button
              onClick={() => handleRenameSubmit(item.session_id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ade80', padding: '2px' }}
            >
              <Check size={13} />
            </button>
            <button
              onClick={() => setRenamingId(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: '2px' }}
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <p style={{
            fontSize: '12px',
            color: '#d1d5db',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0,
            flex: 1
          }}>
            {displayTitle}
          </p>
        )}

        {/* Three dots button */}
        {!isRenaming && (
          <button
            onClick={e => {
              e.stopPropagation()
              setMenuOpenId(isMenuOpen ? null : item.session_id)
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#555',
              padding: '2px 4px',
              borderRadius: '4px',
              fontSize: '14px',
              lineHeight: 1,
              flexShrink: 0
            }}
            onMouseOver={e => e.currentTarget.style.color = '#a78bfa'}
            onMouseOut={e => e.currentTarget.style.color = '#555'}
          >
            ···
          </button>
        )}

        {/* Context menu */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '28px',
              right: '0px',
              background: '#12122a',
              border: '1px solid #2a2a4a',
              borderRadius: '10px',
              padding: '6px',
              zIndex: 999,
              minWidth: '140px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}
          >
            {/* Pin / Unpin */}
            <button
              onClick={e => handlePin(e, item)}
              style={menuBtnStyle}
              onMouseOver={e => e.currentTarget.style.background = '#1e1e3a'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              {item.is_pinned
                ? <><PinOff size={13} /> Unpin</>
                : <><Pin size={13} /> Pin</>
              }
            </button>

            {/* Rename */}
            <button
              onClick={e => handleRenameStart(e, item)}
              style={menuBtnStyle}
              onMouseOver={e => e.currentTarget.style.background = '#1e1e3a'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <Pencil size={13} /> Rename
            </button>

            {/* Delete */}
            <button
              onClick={e => handleDelete(e, item)}
              style={{ ...menuBtnStyle, color: '#f87171' }}
              onMouseOver={e => e.currentTarget.style.background = '#2a1a1a'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      width: '260px',
      background: '#0a0a18',
      borderRight: '1px solid #1e1e3a',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 12px',
      gap: '12px'
    }}>

      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: '10px', padding: '4px 8px', marginBottom: '4px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          borderRadius: '10px', padding: '8px'
        }}>
          <MessageSquare size={16} color="white" />
        </div>
        <div>
          <p style={{ fontWeight: '700', fontSize: '14px', color: '#f0f0f0' }}>
            Multi-Document
          </p>
          <p style={{ fontSize: '11px', color: '#555' }}>Knowledge Base</p>
        </div>
      </div>

      {/* New Chat */}
      <button onClick={onNewChat} style={{
        background: 'transparent',
        border: '1px solid #2a2a4a',
        borderRadius: '10px', padding: '10px',
        color: '#a78bfa', cursor: 'pointer',
        fontSize: '13px', fontWeight: '500',
        display: 'flex', alignItems: 'center',
        gap: '8px', width: '100%'
      }}>
        <Plus size={15} /> New Chat
      </button>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: '#12122a', border: '1px solid #1e1e3a',
        borderRadius: '8px', padding: '8px 12px'
      }}>
        <Search size={13} color="#555" />
        <input
          placeholder="Search history..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'transparent', border: 'none',
            color: '#f0f0f0', fontSize: '12px',
            outline: 'none', width: '100%'
          }}
        />
      </div>

      {/* History */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {Object.entries(grouped).map(([label, items]) =>
          items.length > 0 && (
            <div key={label} style={{ marginBottom: '16px' }}>
              <p style={{
                fontSize: '11px', color: label === 'Pinned' ? '#a78bfa' : '#444',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                marginBottom: '6px', padding: '0 4px',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}>
                {label === 'Pinned' && <Pin size={10} />}
                {label}
              </p>
              {items.map((item, i) => renderChatItem(item, i))}
            </div>
          )
        )}

        {history.length === 0 && (
          <p style={{ fontSize: '12px', color: '#444', textAlign: 'center', marginTop: '20px' }}>
            No chat history yet
          </p>
        )}
        {history.length > 0 && filteredHistory.length === 0 && (
          <p style={{ fontSize: '12px', color: '#444', textAlign: 'center', marginTop: '20px' }}>
            No results for "{search}"
          </p>
        )}
      </div>

      {/* Clear History */}
      <button onClick={onClear} style={{
        background: 'transparent', border: '1px solid #1e1e3a',
        color: '#555', padding: '8px 12px', borderRadius: '8px',
        cursor: 'pointer', fontSize: '12px',
        display: 'flex', alignItems: 'center',
        gap: '6px', width: '100%'
      }}
        onMouseOver={e => e.currentTarget.style.borderColor = '#7c3aed'}
        onMouseOut={e => e.currentTarget.style.borderColor = '#1e1e3a'}
      >
        <Trash2 size={13} /> Clear History
      </button>
    </div>
  )
}

const menuBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  background: 'transparent',
  border: 'none',
  color: '#d1d5db',
  fontSize: '12px',
  padding: '8px 10px',
  borderRadius: '6px',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.15s'
}