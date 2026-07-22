import axios from 'axios'
import { supabase } from './supabase'


const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  timeout: 15000,
})

// Attach the current user's JWT to every request
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  if (data.session?.access_token) {
    config.headers.Authorization = `Bearer ${data.session.access_token}`
  }
  return config
})

// Persons
export const personApi = {
  list:       ()              => api.get('/persons'),
  get:        (id)            => api.get(`/persons/${id}`),
  create:     (data)          => api.post('/persons', data),
  update:     (id, data)      => api.patch(`/persons/${id}`, data),
  delete:     (id)            => api.delete(`/persons/${id}`),
  enrollFace: (id, formData)  => api.post(`/faces/enroll/${id}`, formData,
                                  { headers: { 'Content-Type': 'multipart/form-data' }}),
}

// Faces (live identification)
export const facesApi = {
  identify: (formData) => api.post('/faces/identify', formData,
                            { headers: { 'Content-Type': 'multipart/form-data' }}),
}

// Memory / LLM
// export const memoryApi = {
//   recall: (personContext, snippet) =>
//     api.post('/memory/recall', { person_context: personContext, conversation_snippet: snippet }),
// }
export const memoryApi = {
  recall: (personId, conversationSnippet = null) =>
    api.post("/memory/recall", { person_id: personId, conversation_snippet: conversationSnippet }),
};

// Speech
export const speechApi = {
  transcribe:  (formData)                => api.post('/speech/transcribe', formData,
                                             { headers: { 'Content-Type': 'multipart/form-data' }}),
  getSession:  (sessionId)               => api.get(`/speech/sessions/${sessionId}`),
  summarize:   (sessionId, personId)     => api.post('/speech/summarize', {
                                            session_id: sessionId,
                                            person_id: personId,},
                                            {timeout: 60000,}
),
}

//Navigation
export { navigationApi } from './navigationApi';

// Settings
export const settingsApi = {
  get:        ()        => api.get('/settings'),
  update:     (data)    => api.patch('/settings', data),
  stats:      ()        => api.get('/settings/stats'),
  deleteAll:  ()         => api.delete('/settings/data'),
}

export default api