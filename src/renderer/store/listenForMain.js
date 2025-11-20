import { ipcRenderer } from 'electron'
import bus from '../bus'

const state = {}

const getters = {}

const mutations = {}

const actions = {
  LISTEN_FOR_EDIT ({ commit }) {
    ipcRenderer.on('mt::editor-edit-action', (e, type) => {
      if (type === 'findInFolder') {
        commit('SET_LAYOUT', {
          rightColumn: 'search',
          showSideBar: true
        })
      }
      console.log('Renderer received mt::editor-edit-action', type)
      bus.$emit(type, type)
    })
  },

  LISTEN_FOR_SHOW_DIALOG ({ commit }) {
    ipcRenderer.on('mt::about-dialog', e => {
      console.log('Renderer received mt::about-dialog')
      bus.$emit('aboutDialog')
    })
    ipcRenderer.on('mt::show-export-dialog', (e, type) => {
      console.log('Renderer received mt::show-export-dialog', type)
      bus.$emit('showExportDialog', type)
    })
  },

  LISTEN_FOR_PARAGRAPH_INLINE_STYLE () {
    ipcRenderer.on('mt::editor-paragraph-action', (e, { type }) => {
      console.log('Renderer received mt::editor-paragraph-action', type)
      bus.$emit('paragraph', type)
    })
    ipcRenderer.on('mt::editor-format-action', (e, { type }) => {
      console.log('Renderer received mt::editor-format-action', type)
      bus.$emit('format', type)
    })
    ipcRenderer.on('mt::editor-insert-filepath', () => {
      console.log('Renderer received mt::editor-insert-filepath')
      bus.$emit('insert-filepath')
    })
    ipcRenderer.on('mt::merge-documents', () => {
      console.log('Renderer received mt::merge-documents')
      bus.$emit('merge-documents')
    })
    ipcRenderer.on('mt::export-source-zip', () => {
      console.log('Renderer received mt::export-source-zip')
      bus.$emit('export-source-zip')
    })
  }
}

const listenForMain = { state, getters, mutations, actions }

export default listenForMain
