import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Copy, ThumbsUp, ThumbsDown, Check } from 'lucide-react'

export default function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState(null) // 'up' | 'down' | null

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const time = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '20px'
    }}>
      {/* Timestamp */}
      <span style={{
        fontSize: '10px', color: '#444',
        marginBottom: '4px',
        marginLeft: isUser ? '0' : '4px',
        marginRight: isUser ? '4px' : '0',
      }}>
        {isUser ? 'You' : 'Assistant'} · {time}
      </span>

      <div style={{
        maxWidth: '75%',
        padding: '14px 18px',
        borderRadius: '18px',
        background: isUser ? '#7c3aed' : '#1a1a2e',
        color: '#f0f0f0',
        fontSize: '14px',
        lineHeight: '1.8',
        border: isUser ? 'none' : '1px solid #2a2a4a',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
      }}>
        {isUser ? (
          <p style={{ margin: 0 }}>{msg.content}</p>
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p style={{ marginBottom: '8px', color: '#d1d5db' }}>{children}</p>,
              strong: ({ children }) => <strong style={{ color: '#ffffff', fontWeight: '700' }}>{children}</strong>,
              em: ({ children }) => <em style={{ color: '#a78bfa', fontStyle: 'italic' }}>{children}</em>,
              ul: ({ children }) => <ul style={{ paddingLeft: '20px', marginBottom: '8px', color: '#d1d5db' }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ paddingLeft: '20px', marginBottom: '8px', color: '#d1d5db' }}>{children}</ol>,
              li: ({ children }) => <li style={{ marginBottom: '6px', color: '#d1d5db' }}>{children}</li>,
              h1: ({ children }) => <h1 style={{ color: '#a78bfa', fontSize: '20px', marginBottom: '12px', marginTop: '16px', fontWeight: '800', borderBottom: '2px solid #7c3aed', paddingBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>{children}</h1>,
              h2: ({ children }) => <h2 style={{ 
  color: '#ffffff', 
  fontSize: '15px', 
  marginBottom: '8px', 
  marginTop: '14px', 
  fontWeight: '800', 
  borderLeft: '3px solid #7c3aed', 
  paddingLeft: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.8px'
}}>{children}</h2>,
              h3: ({ children }) => <h3 style={{ 
  color: '#e2e8f0', 
  fontSize: '13px', 
  marginBottom: '6px', 
  marginTop: '10px', 
  fontWeight: '800', 
  textTransform: 'uppercase', 
  letterSpacing: '0.8px',
  borderBottom: '1px solid #1e1e3a',
  paddingBottom: '3px'
}}>{children}</h3>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
        
        {/* Blinking cursor while streaming */}
        {msg.streaming && (
          <span style={{
            display: 'inline-block',
            width: '8px', height: '16px',
            background: '#a78bfa',
            marginLeft: '2px',
            animation: 'blink 1s step-end infinite',
            verticalAlign: 'text-bottom',
            borderRadius: '2px'
          }} />
        )}
        <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

        

        {/* Sources */}
        {msg.sources && msg.sources.length > 0 && (
          <div style={{ marginTop: '12px', borderTop: '1px solid #2a2a4a', paddingTop: '10px' }}>
            <p style={{ fontSize: '11px', color: '#666', marginBottom: '6px' }}>📎 Sources:</p>
            {[...new Set(msg.sources)].map((s, i) => (
              <span key={i} style={{
                display: 'inline-block', background: '#12122a', color: '#a78bfa',
                fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                marginRight: '6px', marginBottom: '4px', border: '1px solid #2a2a4a'
              }}>
                📄 {s.split('\\').pop().split('/').pop()}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons — only for bot */}
      {!isUser && (
        <div style={{
          display: 'flex', gap: '6px',
          marginTop: '6px', marginLeft: '4px'
        }}>
          {/* Copy */}
          <button
            onClick={handleCopy}
            title="Copy"
            style={{
              background: copied ? '#1a2a1a' : 'transparent',
              border: '1px solid #2a2a4a',
              borderRadius: '8px', padding: '4px 8px',
              cursor: 'pointer', color: copied ? '#4ade80' : '#666',
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', transition: 'all 0.2s'
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>

          {/* Thumbs Up */}
          <button
            onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
            title="Good response"
            style={{
              background: feedback === 'up' ? '#1a2a3a' : 'transparent',
              border: `1px solid ${feedback === 'up' ? '#7c3aed' : '#2a2a4a'}`,
              borderRadius: '8px', padding: '4px 8px',
              cursor: 'pointer',
              color: feedback === 'up' ? '#a78bfa' : '#666',
              display: 'flex', alignItems: 'center',
              transition: 'all 0.2s'
            }}
          >
            <ThumbsUp size={12} />
          </button>

          {/* Thumbs Down */}
          <button
            onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
            title="Bad response"
            style={{
              background: feedback === 'down' ? '#2a1a1a' : 'transparent',
              border: `1px solid ${feedback === 'down' ? '#ef4444' : '#2a2a4a'}`,
              borderRadius: '8px', padding: '4px 8px',
              cursor: 'pointer',
              color: feedback === 'down' ? '#f87171' : '#666',
              display: 'flex', alignItems: 'center',
              transition: 'all 0.2s'
            }}
          >
            <ThumbsDown size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
