import axios from 'axios'

const BASE = 'https://prasannabalaji-multidoc-ai-backend.hf.space'

export const ALLOWED_FILE_TYPES = [
  '.pdf', '.txt', '.docx', '.csv', '.xlsx', '.pptx', '.md'
]
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/markdown',
]

export const isFileAllowed = (file) => {
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  return ALLOWED_FILE_TYPES.includes(ext)
}

export const sendQuestion = (question, session_id, selected_doc = 'all') =>
  axios.post(`${BASE}/query`, { question, session_id, selected_doc })

export const uploadFile = (file) => {
  if (!isFileAllowed(file)) {
    return Promise.reject(
      new Error(`Unsupported file type. Allowed: ${ALLOWED_FILE_TYPES.join(', ')}`)
    )
  }
  const form = new FormData()
  form.append('file', file)
  return axios.post(`${BASE}/upload`, form)
}

export const getDocs = () =>
  axios.get(`${BASE}/docs`)

export const getHistory = (session_id) =>
  axios.get(`${BASE}/history`, { params: { session_id } })

export const clearHistory = (session_id) =>
  axios.delete(`${BASE}/clear`, { params: { session_id } })

export const deleteDoc = (filename) =>
  axios.delete(`${BASE}/delete-doc`, { params: { filename } })

export const streamQuestion = (
  question,
  session_id,
  selected_doc = 'all',
  onToken,
  onDone
) => {
  fetch(`${BASE}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, session_id, selected_doc }),
  })
    .then((res) => {
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()

      const read = () => {
        reader.read().then(({ done, value }) => {
          if (done) return
          const text  = decoder.decode(value)
          const lines = text.split('\n').filter((l) => l.startsWith('data: '))
          lines.forEach((line) => {
            try {
              const json = JSON.parse(line.replace('data: ', ''))
              if (json.token) onToken(json.token)
              if (json.done)  onDone(json.sources || [])
              if (json.error) onDone([])
            } catch {}
          })
          read()
        })
      }
      read()
    })
    .catch(() => onDone([]))
}