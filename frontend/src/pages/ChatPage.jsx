import { useState, useRef, useEffect } from 'react'
import { sendQuestion, uploadFile, getHistory, clearHistory, deleteDoc, streamQuestion, getDocs, isFileAllowed, ALLOWED_FILE_TYPES } from '../api/chat'
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
  const bottomRef = useRef(null)
  const isMobile  = useIsMobile()

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

  // ── Mobile bottom tab bar ──────────────────────────────────────────────────
  const MobileTabBar = () => (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: '60px',
      background: '#0a0a18',
      borderTop: '1px solid #1e1e3a',
      display: 'flex',
      zIndex: 100,
    }}>
      {[
        { id: 'history', icon: <History size={20} />, label: 'History' },
        { id: 'chat',    icon: <MessageSquare size={20} />, label: 'Chat' },
        { id: 'docs',    icon: <FileText size={20} />, label: 'Docs' },
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
            fontSize: '10px', fontWeight: '600',
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )

  // ── Chat panel (shared between mobile and desktop) ─────────────────────────
  const ChatPanel = () => (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      paddingBottom: isMobile ? '60px' : '0'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1e1e3a',
        background: 'rgba(8,8,18,0.95)',
        display: 'flex', alignItems: 'center', gap: '10px'
      }}>
        <Sparkles size={18} color="#a78bfa" />
        <span style={{ fontSize: '16px', fontWeight: '700', color: '#f0f0f0' }}>
          Multi-Document Knowledge Base
        </span>
        <span style={{
          background: '#1e1e3a', color: '#a78bfa',
          fontSize: '11px', padding: '3px 10px',
          borderRadius: '20px', border: '1px solid #2a2a4a',
          fontWeight: '600'
        }}>
          RAG
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧠</div>
            <p style={{ fontSize: '22px', fontWeight: '700', color: '#f0f0f0', marginBottom: '8px' }}>
              Ask anything about your documents
            </p>
            <p style={{ fontSize: '14px', color: '#444', marginBottom: '32px' }}>
              Upload PDF, Word, TXT, CSV, Excel, PowerPoint or Markdown and start chatting
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
        padding: '16px 24px',
        borderTop: '1px solid #1e1e3a',
        background: 'rgba(8,8,18,0.95)'
      }}>
        {docs.length > 0 && (
          <div style={{
            display: 'flex', gap: '6px',
            marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center'
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
                fontSize: '11px', fontWeight: '500', transition: 'all 0.2s'
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
                  borderRadius: '20px', padding: '4px 12px',
                  cursor: 'pointer',
                  color: isSelected ? '#a78bfa' : '#888',
                  fontSize: '11px', fontWeight: '500',
                  maxWidth: '160px', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}>
                  {getDocIcon(doc.name)} {doc.name}
                </button>
              )
            })}
          </div>
        )}

        {messages.length === 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => setInput(s)} style={{
                background: 'transparent', border: '1px solid #2a2a4a',
                color: '#a78bfa', padding: '6px 14px',
                borderRadius: '20px', cursor: 'pointer',
                fontSize: '12px', fontWeight: '500'
              }}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div style={{
          display: 'flex', gap: '12px',
          background: '#0f0f1f', border: '1px solid #2a2a4a',
          borderRadius: '14px', padding: '8px 8px 8px 16px',
          boxShadow: '0 0 30px rgba(124,58,237,0.1)'
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything about your documents..."
            rows={2}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: '#f0f0f0', fontSize: '14px', resize: 'none',
              outline: 'none', fontFamily: 'Inter, sans-serif',
              lineHeight: '1.6', paddingTop: '6px'
            }}
          />
          <button onClick={handleSend} disabled={loading} style={{
            background: loading ? '#2a2a4a' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
            border: 'none', borderRadius: '10px',
            padding: '0 20px', cursor: loading ? 'not-allowed' : 'pointer',
            color: 'white', display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '14px', fontWeight: '500',
            minWidth: '90px', justifyContent: 'center'
          }}>
            <Send size={15} /> Send
          </button>
        </div>
        <p style={{ fontSize: '11px', color: '#333', marginTop: '8px', textAlign: 'center' }}>
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ height: '100vh', background: '#080812', overflow: 'hidden' }}>
        {mobileTab === 'history' && (
          <div style={{ height: '100vh', paddingBottom: '60px', overflowY: 'auto' }}>
            <Sidebar
              history={history}
              onNewChat={handleNewChat}
              onClear={handleClear}
              onSelectChat={handleSelectChat}
              activeSession={sessionId}
            />
          </div>
        )}
        {mobileTab === 'chat' && <ChatPanel />}
        {mobileTab === 'docs' && (
          <div style={{ height: '100vh', paddingBottom: '60px', overflowY: 'auto' }}>
            <DocsPanel
              docs={docs}
              onUpload={handleUpload}
              uploading={uploading}
              onDelete={handleDelete}
            />
          </div>
        )}
        <MobileTabBar />
      </div>
    )
  }

  // ── Desktop layout (unchanged) ─────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080812' }}>
      <Sidebar
        history={history}
        onNewChat={handleNewChat}
        onClear={handleClear}
        onSelectChat={handleSelectChat}
        activeSession={sessionId}
      />
      <ChatPanel />
      <DocsPanel
        docs={docs}
        onUpload={handleUpload}
        uploading={uploading}
        onDelete={handleDelete}
      />
    </div>
  )
}