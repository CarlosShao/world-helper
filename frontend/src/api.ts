import axios from 'axios'

const api = axios.create({
  baseURL: '/api'
})

export interface Word {
  id: number
  english: string
  part_of_speech: string
  chinese: string
}

export const wordApi = {
  importFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/import', formData)
  },
  
  getWords: (page: number = 1, pageSize: number = 20, search: string = '') => {
    return api.get('/words', { params: { page, pageSize, search } })
  },
  
  addErrorWord: (wordId: number) => {
    return api.post('/error-words', { wordId })
  },
  
  removeErrorWord: (wordId: number) => {
    return api.delete(`/error-words/${wordId}`)
  },
  
  getErrorWords: () => {
    return api.get('/error-words')
  },
  
  getObservationWords: () => {
    return api.get('/observation-words')
  },
  
  markObservationCorrect: (wordId: number) => {
    return api.post(`/observation-words/${wordId}/correct`)
  },
  
  markObservationError: (wordId: number) => {
    return api.post(`/observation-words/${wordId}/error`)
  },
  
  getYesterdayErrors: () => {
    return api.get('/yesterday-errors')
  },
  
  getSetting: (key: string) => {
    return api.get(`/settings/${key}`)
  },
  
  saveSetting: (key: string, value: any) => {
    return api.post(`/settings/${key}`, { value })
  }
}
