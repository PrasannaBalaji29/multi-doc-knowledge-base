import { useState } from 'react'
import { MessageSquare, Trash2, Plus, Search } from 'lucide-react'

export default function Sidebar({ history, onNewChat, onClear, onSelectChat, activeSession }) {
  const [search, setSearch] = useState('')

  const filteredHistory = history.filter(item =>
    (item.title || item.question).toLowerCase().includes(search.toLowerCase())
  )

  const groupByDate = (items) => {
  const groups = { Today: [], Yesterday: [], Older: [] }

  items.forEach(item => {
    // Parse timestamp treating it as IST (UTC+5:30)
    const raw = item.timestamp // e.g. "2026-05-20 01:05:00"
    const date = new Date(raw + '+05:30') // Force IST

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
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

  return (
    <div style={{
      width: '100%',
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

      {/* New Chat button */}
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
                fontSize: '11px', color: '#444',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                marginBottom: '6px', padding: '0 4px'
              }}>
                {label}
              </p>
              {items.map((item, i) => (
                <div key={i}
                  onClick={() => onSelectChat(item.session_id)}
                  style={{
                    padding: '8px 10px', borderRadius: '8px',
                    cursor: 'pointer', marginBottom: '2px',
                    background: activeSession === item.session_id ? '#1e1e3a' : 'transparent',
                    border: activeSession === item.session_id ? '1px solid #2a2a4a' : '1px solid transparent'
                  }}>
                  <p style={{
                    fontSize: '12px', color: '#d1d5db',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.question}
                  </p>
                </div>
              ))}
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
