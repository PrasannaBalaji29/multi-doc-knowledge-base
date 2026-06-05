import { useState } from 'react'
import { FileText, X, Upload, Trash2 } from 'lucide-react'

// ── File type config ───────────────────────────────────────────────────────────
const FILE_TYPE_CONFIG = {
  '.pdf':  { color: '#7c1a1a', icon: '📕' },
  '.docx': { color: '#1a3a7c', icon: '📘' },
  '.txt':  { color: '#1a5c35', icon: '📄' },
  '.md':   { color: '#1a4a3a', icon: '📝' },
  '.csv':  { color: '#1a4a1a', icon: '📊' },
  '.xlsx': { color: '#1a4a1a', icon: '📊' },
  '.pptx': { color: '#5c2a1a', icon: '📊' },
}

const getFileConfig = (filename) => {
  const ext = '.' + filename.split('.').pop().toLowerCase()
  return FILE_TYPE_CONFIG[ext] || { color: '#2a2a4a', icon: '📄' }
}

export default function DocsPanel({ docs, onUpload, uploading, onDelete }) {
  const [showRagModal, setShowRagModal] = useState(false)
  const [dragOver, setDragOver]         = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onUpload({ target: { files: [file] } })
  }

  return (
    <div style={{
      width: '280px',
      background: '#0f0f1f',
      borderLeft: '1px solid #1e1e3a',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 16px',
      gap: '16px',
      overflowY: 'auto',
      position: 'relative'
    }}>

      {/* ── RAG Modal ── */}
      {showRagModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: '#0f0f1f',
            border: '1px solid #2a2a4a',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '420px',
            width: '90%',
            color: '#f0f0f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontWeight: '700', fontSize: '16px', margin: 0 }}>What is RAG?</p>
              <button onClick={() => setShowRagModal(false)} style={{
                background: 'transparent', border: 'none',
                cursor: 'pointer', color: '#666', padding: '4px'
              }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#aaa', lineHeight: '1.8', marginBottom: '12px' }}>
              <strong style={{ color: '#a78bfa' }}>Retrieval-Augmented Generation (RAG)</strong> enhances AI responses by grounding them in your own documents.
            </p>
            <ol style={{ fontSize: '13px', color: '#aaa', lineHeight: '2', paddingLeft: '20px', marginBottom: '12px' }}>
              <li>Indexes your uploaded documents</li>
              <li>Finds the most relevant chunks for your question</li>
              <li>Generates an answer based on that context</li>
            </ol>
            <p style={{ fontSize: '13px', color: '#aaa', lineHeight: '1.8' }}>
              Answers are accurate, sourced, and specific to your documents.
            </p>
            <button onClick={() => setShowRagModal(false)} style={{
              marginTop: '20px',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              border: 'none', borderRadius: '10px',
              padding: '8px 20px', color: 'white',
              cursor: 'pointer', fontSize: '13px', fontWeight: '500',
              width: '100%'
            }}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── Upload Area ── */}
      <div>
        <p style={{
          fontSize: '13px', fontWeight: '600',
          color: '#f0f0f0', textTransform: 'uppercase',
          letterSpacing: '0.5px', margin: '0 0 10px 0'
        }}>
          📤 Upload Document
        </p>

        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            border: `2px dashed ${dragOver ? '#a855f7' : '#2a2a4a'}`,
            borderRadius: '12px',
            padding: '20px 12px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            background: dragOver ? 'rgba(124,58,237,0.08)' : '#12122a',
            transition: 'all 0.2s',
            textAlign: 'center'
          }}
        >
          <input
            type="file"
            hidden
            onChange={onUpload}
            accept=".pdf,.txt,.docx,.csv,.xlsx,.pptx,.md"
            disabled={uploading}
          />
          <Upload size={22} color={dragOver ? '#a855f7' : '#444'} />
          <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
            {uploading ? 'Uploading...' : 'Click or drag & drop'}
          </p>
          <p style={{ fontSize: '11px', color: '#444', margin: 0 }}>
            PDF · DOCX · TXT · CSV · XLSX · PPTX · MD
          </p>
        </label>

        {/* Upload Progress Bar */}
        {uploading && (
          <div style={{ marginTop: '10px' }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: '8px', marginBottom: '6px'
            }}>
              <div style={{
                width: '12px', height: '12px',
                border: '2px solid #7c3aed',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                flexShrink: 0
              }} />
              <span style={{ fontSize: '12px', color: '#a78bfa' }}>
                Uploading & indexing...
              </span>
            </div>
            <div style={{
              height: '4px', background: '#1e1e3a',
              borderRadius: '4px', overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                borderRadius: '4px',
                animation: 'progress 1.5s ease-in-out infinite',
              }} />
            </div>
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
              @keyframes progress {
                0%   { width: 20%; margin-left: 0; }
                50%  { width: 60%; margin-left: 20%; }
                100% { width: 20%; margin-left: 80%; }
              }
            `}</style>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: '#1e1e3a' }} />

      {/* ── Uploaded Documents ── */}
      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: '13px', fontWeight: '600',
          color: '#f0f0f0', textTransform: 'uppercase',
          letterSpacing: '0.5px', margin: '0 0 10px 0'
        }}>
          📁 Uploaded Documents
          {docs.length > 0 && (
            <span style={{
              marginLeft: '8px',
              background: '#7c3aed', color: 'white',
              fontSize: '10px', padding: '2px 7px',
              borderRadius: '20px', fontWeight: '600'
            }}>
              {docs.length}
            </span>
          )}
        </p>

        {docs.length === 0 && !uploading && (
          <div style={{
            textAlign: 'center', padding: '20px',
            color: '#444', fontSize: '12px'
          }}>
            <FileText size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
            No documents yet
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {docs.map((doc, i) => {
            const cfg = getFileConfig(doc.name)
            return (
              <div key={i} style={{
                background: '#12122a',
                border: '1px solid #1e1e3a',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex', alignItems: 'flex-start', gap: '10px'
              }}>
                <div style={{
                  background: cfg.color,
                  borderRadius: '6px', padding: '6px', flexShrink: 0
                }}>
                  <FileText size={14} color="white" />
                </div>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <p style={{
                    fontSize: '12px', color: '#f0f0f0', fontWeight: '500',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', margin: 0
                  }}>
                    {cfg.icon} {doc.name}
                  </p>
                  <p style={{ fontSize: '11px', color: '#555', marginTop: '2px', marginBottom: 0 }}>
                    {doc.size} · {doc.date}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <div style={{
                    width: '8px', height: '8px',
                    borderRadius: '50%', background: '#4ade80'
                  }} />
                  <button
                    onClick={() => onDelete(doc.name)}
                    title="Delete document"
                    style={{
                      background: 'transparent', border: 'none',
                      cursor: 'pointer', color: '#444',
                      padding: '2px', display: 'flex',
                      alignItems: 'center', transition: 'color 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseOut={e => e.currentTarget.style.color = '#444'}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: '#1e1e3a' }} />

      {/* About RAG */}
      <div>
        <p style={{
          fontSize: '13px', fontWeight: '600', color: '#f0f0f0',
          marginBottom: '8px', textTransform: 'uppercase',
          letterSpacing: '0.5px', marginTop: 0
        }}>
          About
        </p>
        <p style={{ fontSize: '12px', color: '#555', lineHeight: '1.6', margin: 0 }}>
          This assistant uses RAG to answer questions based on your uploaded documents.
        </p>
        <p onClick={() => setShowRagModal(true)} style={{
          fontSize: '12px', color: '#7c3aed',
          marginTop: '8px', cursor: 'pointer',
          textDecoration: 'underline', marginBottom: 0
        }}>
          Learn more about RAG →
        </p>
      </div>

    </div>
  )
}
