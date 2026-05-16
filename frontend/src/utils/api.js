import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  timeout: 15000,
})

// Persons
export const personApi = {
  list:   ()           => api.get('/persons'),
  get:    (id)         => api.get(`/persons/${id}`),
  create: (data)       => api.post('/persons', data),
  delete: (id)         => api.delete(`/persons/${id}`),
  enrollFace: (id, formData) => api.post(`/faces/enroll/${id}`, formData,
                                { headers: { 'Content-Type': 'multipart/form-data' }}),
}

// Memory / LLM
export const memoryApi = {
  recall: (personContext, snippet) =>
    api.post('/memory/recall', { person_context: personContext, conversation_snippet: snippet }),
}

export default api
