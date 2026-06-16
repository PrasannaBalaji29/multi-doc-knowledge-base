import { useState, useRef, useEffect } from 'react'
import { uploadFile, getHistory, clearHistory, deleteDoc, streamQuestion, getDocs, isFileAllowed, ALLOWED_FILE_TYPES } from '../api/chat'
import Sidebar from '../components/Sidebar'
import MessageBubble from '../components/MessageBubble'
import DocsPanel from '../components/DocsPanel'
import { Send, Sparkles, MessageSquare, History, FileText } from 'lucide-react'

const makeSessionId = () => 'user-' + Math.random().toString(36).slice(2, 9)

const getDocIcon = (filename) => {
  const ext = '.' + filename.split('.').pop().toLowerCase()
  const icons = {
    '.pdf':  '📕',
    '.docx': '📘',
    '.txt':  '📄',
    '.md':   '📝',
    '.csv':  '📊',
    '.xlsx': '📊',
    '.pptx': '📊',
  }
  return icons[ext] || '📄'
}

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

// ── Mobile Tab Bar ─────────────────────────────────────────────────────────
const MobileTabBar = ({ mobileTab, setMobileTab }) => (
  <div style={{
    position: 'fixed', bottom: 0, left: 0, right: 0,
    height: '60px',
    background: '#0a0a18',
    borderTop: '1px solid #1e1e3a',
    display: 'flex',
    zIndex: 100,
  }}>
    {[
      { id: 'history', icon: <History size={22} />, label: 'History' },
      { id: 'chat',    icon: <MessageSquare size={22} />, label: 'Chat' },
      { id: 'docs',    icon: <FileText size={22} />, label: 'Docs' },
    ].map(tab => (
      <button
        key={tab.id}
        onClick={() => setMobileTab(tab.id)}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          color: mobileTab === tab.id ? '#a78bfa' : '#555',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '4px', cursor: 'pointer',
          borderTop: mobileTab === tab.id ? '2px solid #7c3aed' : '2px solid transparent',
          fontSize: '11px', fontWeight: '600',
          transition: 'all 0.2s'
        }}
      >
        {tab.icon}
        {tab.label}
      </button>
    ))}
  </div>
)

// ── Chat Panel ─────────────────────────────────────────────────────────────
const ChatPanel = ({
  mobile, messages, input, setInput, loading, docs, selectedDoc,
  setSelectedDoc, bottomRef, textareaRef, handleSend, handleKey, suggestions
}) => (
  <div style={{
    flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', height: '100%',
  }}>
    {/* Header */}
    <div style={{
      padding: mobile ? '12px 16px' : '16px 24px',
      borderBottom: '1px solid #1e1e3a',
      background: 'rgba(8,8,18,0.95)',
      display: 'flex', alignItems: 'center', gap: '8px',
      flexShrink: 0,
    }}>
      <Sparkles size={18} color="#a78bfa" />
      <span style={{
        fontSize: mobile ? '13px' : '16px',
        fontWeight: '700', color: '#f0f0f0',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}>
        {mobile ? 'MultiDoc AI' : 'Multi-Document Knowledge Base'}
      </span>
      <span style={{
        background: '#1e1e3a', color: '#a78bfa',
        fontSize: '11px', padding: '3px 10px',
        borderRadius: '20px', border: '1px solid #2a2a4a',
        fontWeight: '600', flexShrink: 0
      }}>
        RAG
      </span>
    </div>

    {/* Messages */}
    <div style={{
      flex: 1, overflowY: 'auto',
      padding: mobile ? '16px' : '24px',
      WebkitOverflowScrolling: 'touch',
    }}>
      {messages.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: mobile ? '30px' : '60px' }}>
          <div style={{ fontSize: mobile ? '36px' : '48px', marginBottom: '16px' }}>🧠</div>
          <p style={{
            fontSize: mobile ? '18px' : '22px',
            fontWeight: '700', color: '#f0f0f0', marginBottom: '8px'
          }}>
            Ask anything about your documents
          </p>
          <p style={{ fontSize: '13px', color: '#444', marginBottom: '24px' }}>
            Upload PDF, Word, TXT, CSV, Excel, PowerPoint or Markdown
          </p>
        </div>
      )}

      {messages.map((msg, i) => (
        <MessageBubble key={i} msg={msg} />
      ))}

      {loading && (
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: '10px', color: '#555', fontSize: '14px', padding: '8px 0'
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#7c3aed', animation: 'pulse 1s ease-in-out infinite'
          }} />
          <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
          Thinking...
        </div>
      )}
      <div ref={bottomRef} />
    </div>

    {/* Input Area */}
    <div style={{
      padding: mobile ? '10px 12px' : '16px 24px',
      borderTop: '1px solid #1e1e3a',
      background: 'rgba(8,8,18,0.95)',
      flexShrink: 0,
    }}>
      {/* Doc Selector */}
      {docs.length > 0 && (
        <div style={{
          display: 'flex', gap: '6px',
          marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: '11px', color: '#555' }}>Select:</span>
          <button
            onClick={() => setSelectedDoc('all')}
            style={{
              background: selectedDoc === 'all' ? '#7c3aed' : 'transparent',
              border: `1px solid ${selectedDoc === 'all' ? '#7c3aed' : '#2a2a4a'}`,
              borderRadius: '20px', padding: '4px 12px',
              cursor: 'pointer',
              color: selectedDoc === 'all' ? 'white' : '#888',
              fontSize: '11px', fontWeight: '500',
              transition: 'all 0.2s', flexShrink: 0,
            }}
          >
            🌐 All Docs
          </button>
          {docs.map((doc, i) => {
            const isSelected = selectedDoc === doc.name
            return (
              <button key={i} onClick={() => setSelectedDoc(isSelected ? 'all' : doc.name)} style={{
                background: isSelected ? '#1e1e3a' : 'transparent',
                border: `1px solid ${isSelected ? '#7c3aed' : '#2a2a4a'}`,
                borderRadius: '20px', padding: '4px 10px',
                cursor: 'pointer',
                color: isSelected ? '#a78bfa' : '#888',
                fontSize: '11px', fontWeight: '500',
                maxWidth: mobile ? '120px' : '160px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                transition: 'all 0.2s', flexShrink: 0,
              }}>
                {getDocIcon(doc.name)} {doc.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Suggestion chips */}
      {messages.length === 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setInput(s)} style={{
              background: 'transparent', border: '1px solid #2a2a4a',
              color: '#a78bfa', padding: mobile ? '5px 10px' : '6px 14px',
              borderRadius: '20px', cursor: 'pointer',
              fontSize: mobile ? '11px' : '12px', fontWeight: '500',
            }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Text input */}
      <div style={{
        display: 'flex', gap: '8px',
        background: '#0f0f1f', border: '1px solid #2a2a4a',
        borderRadius: '14px', padding: '8px 8px 8px 14px',
        boxShadow: '0 0 30px rgba(124,58,237,0.1)'
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything about your documents..."
          rows={mobile ? 1 : 2}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck="false"
          style={{
            flex: 1, background: 'transparent', border: 'none',
            color: '#f0f0f0', fontSize: '14px', resize: 'none',
            outline: 'none', fontFamily: 'Inter, sans-serif',
            lineHeight: '1.6', paddingTop: '4px',
            WebkitUserSelect: 'text',
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          style={{
            background: loading ? '#2a2a4a' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
            border: 'none', borderRadius: '10px',
            padding: mobile ? '0 14px' : '0 20px',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: 'white', display: 'flex', alignItems: 'center',
            gap: '6px', fontSize: '14px', fontWeight: '500',
            minWidth: mobile ? '60px' : '90px', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Send size={15} />
          {!mobile && 'Send'}
        </button>
      </div>
      {!mobile && (
        <p style={{ fontSize: '11px', color: '#333', marginTop: '8px', textAlign: 'center' }}>
          Press Enter to send · Shift+Enter for new line
        </p>
      )}
    </div>
  </div>
)

export default function ChatPage() {
  const [messages, setMessages]       = useState([])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [sessionId, setSessionId]     = useState(makeSessionId())
  const [history, setHistory]         = useState([])
  const [docs, setDocs]               = useState([])
  const [uploading, setUploading]     = useState(false)
  const [selectedDoc, setSelectedDoc] = useState('all')
  const [mobileTab, setMobileTab]     = useState('chat')
  const bottomRef   = useRef(null)
  const textareaRef = useRef(null)
  const isMobile    = useIsMobile()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    loadHistory()
    getDocs()
      .then(res => setDocs(res.data.docs || []))
      .catch(() => {})
  }, [])

  const loadHistory = async () => {
    try {
      const res = await getHistory()
      setHistory(res.data || [])
    } catch {}
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const question = input.trim()
    setInput('')

    setMessages(prev => [...prev, {
      role: 'user',
      content: question,
      timestamp: new Date().toISOString()
    }])

    setMessages(prev => [...prev, {
      role: 'bot',
      content: '',
      sources: [],
      timestamp: new Date().toISOString(),
      streaming: true
    }])

    setLoading(true)

    streamQuestion(
      question,
      sessionId,
      selectedDoc,
      (token) => {
        setMessages(prev => {
          const updated = [...prev]
          const last    = updated[updated.length - 1]
          if (last.role === 'bot') {
            updated[updated.length - 1] = { ...last, content: last.content + token }
          }
          return updated
        })
      },
      (sources) => {
        setMessages(prev => {
          const updated = [...prev]
          const last    = updated[updated.length - 1]
          if (last.role === 'bot') {
            updated[updated.length - 1] = { ...last, sources, streaming: false }
          }
          return updated
        })
        setLoading(false)
        loadHistory()
      }
    )
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!isFileAllowed(file)) {
      alert(`❌ Unsupported file type.\n\nAllowed: ${ALLOWED_FILE_TYPES.join(', ')}`)
      return
    }
    setUploading(true)
    try {
      await uploadFile(file)
      const res = await getDocs()
      setDocs(res.data.docs || [])
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Upload failed'
      alert(`❌ ${msg}`)
    }
    setUploading(false)
  }

  const handleDelete = async (filename) => {
    if (!window.confirm(`Delete "${filename}"?`)) return
    try {
      await deleteDoc(filename)
      setDocs(prev => prev.filter(d => d.name !== filename))
      if (selectedDoc === filename) setSelectedDoc('all')
    } catch {
      alert('Delete failed.')
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setSessionId(makeSessionId())
    if (isMobile) setMobileTab('chat')
  }

  const handleClear = async () => {
    await clearHistory()
    setMessages([])
    setHistory([])
  }

  const handleSelectChat = async (sid) => {
    try {
      const res  = await getHistory(sid)
      const msgs = []
      res.data.forEach(item => {
        msgs.push({ role: 'user', content: item.question, timestamp: item.timestamp })
        msgs.push({ role: 'bot',  content: item.answer,   sources: [], timestamp: item.timestamp })
      })
      setMessages(msgs.reverse())
      setSessionId(sid)
      if (isMobile) setMobileTab('chat')
    } catch {}
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const suggestions = [
    '📋 Summarize this document',
    '🔍 What are the main topics covered?',
    '💡 What are the key insights?',
    '🎯 What is the main purpose of this document?',
    '📊 Are there any statistics or data mentioned?',
  ]

  const chatPanelProps = {
    mobile: isMobile, messages, input, setInput, loading,
    docs, selectedDoc, setSelectedDoc, bottomRef, textareaRef,
    handleSend, handleKey, suggestions
  }

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ height: '100dvh', background: '#080812', overflow: 'hidden', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
        {mobileTab === 'history' && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '60px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <style>{`
              .mobile-sidebar > div:first-child { width: 100% !important; min-height: 100vh; }
              .mobile-docs > div:first-child { width: 100% !important; }
            `}</style>
            <div className="mobile-sidebar">
              <Sidebar
  history={history}
  onNewChat={handleNewChat}
  onClear={handleClear}
  onSelectChat={handleSelectChat}
  activeSession={sessionId}
  onHistoryChange={loadHistory}
/>
            </div>
          </div>
        )}
        {mobileTab === 'chat' && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '60px', display: 'flex', flexDirection: 'column' }}>
            <ChatPanel {...chatPanelProps} />
          </div>
        )}
        {mobileTab === 'docs' && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '60px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <style>{`.mobile-docs > div { width: 100% !important; }`}</style>
            <div className="mobile-docs" style={{ width: '100%' }}>
              <DocsPanel
                docs={docs}
                onUpload={handleUpload}
                uploading={uploading}
                onDelete={handleDelete}
              />
            </div>
          </div>
        )}
        <MobileTabBar mobileTab={mobileTab} setMobileTab={setMobileTab} />
      </div>
    )
  }

  // ── Desktop layout (100% unchanged) ───────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080812' }}>
      <Sidebar
  history={history}
  onNewChat={handleNewChat}
  onClear={handleClear}
  onSelectChat={handleSelectChat}
  activeSession={sessionId}
  onHistoryChange={loadHistory}
/>
      <ChatPanel {...chatPanelProps} mobile={false} />
      <DocsPanel
        docs={docs}
        onUpload={handleUpload}
        uploading={uploading}
        onDelete={handleDelete}
      />
    </div>
  )
}