import { ipcRenderer } from 'electron'
import path from 'path'
import { h, patch } from '../../parser/render/snabbdom'
import BaseFloat from '../baseFloat'
import icons from './config'

import './index.css'

const defaultOptions = {
  placement: 'bottom',
  modifiers: {
    offset: {
      offset: '0, 5'
    }
  },
  showArrow: false
}

class LinkTools extends BaseFloat {
  static pluginName = 'linkTools'

  constructor (muya, options = {}) {
    const name = 'ag-link-tools'
    const opts = Object.assign({}, defaultOptions, options)
    super(muya, name, opts)
    this.oldVnode = null
    this.linkInfo = null
    this.options = opts
    this.icons = icons
    this.hideTimer = null
    const linkContainer = this.linkContainer = document.createElement('div')
    this.container.appendChild(linkContainer)
    this.listen()
  }

  listen () {
    const { eventCenter } = this.muya
    super.listen()
    eventCenter.subscribe('muya-link-tools', ({ reference, linkInfo }) => {
      if (reference) {
        this.linkInfo = linkInfo
        setTimeout(() => {
          this.show(reference)
          this.render()
        }, 0)
      } else {
        if (this.hideTimer) {
          clearTimeout(this.hideTimer)
        }
        this.hideTimer = setTimeout(() => {
          this.hide()
        }, 500)
      }
    })

    const mouseOverHandler = () => {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer)
      }
    }

    const mouseOutHandler = () => {
      this.hide()
    }

    eventCenter.attachDOMEvent(this.container, 'mouseover', mouseOverHandler)
    eventCenter.attachDOMEvent(this.container, 'mouseleave', mouseOutHandler)
  }

  render () {
    const { icons, oldVnode, linkContainer } = this
    const children = icons.map(i => {
      let icon
      let iconWrapperSelector
      if (typeof i.icon === 'string') {
        // SVG symbol icon
        iconWrapperSelector = 'div.icon-wrapper'
        icon = h('svg.icon', { attrs: { 'aria-hidden': 'true' } }, h('use', { attrs: { 'xlink:href': `#${i.icon}` } }))
      } else if (i.icon) {
        // PNG icon Asset
        iconWrapperSelector = 'div.icon-wrapper'
        icon = h('i.icon', h('i.icon-inner', {
          style: {
            background: `url(${i.icon}) no-repeat`,
            'background-size': '100%'
          }
        }, ''))
      }
      const iconWrapper = h(iconWrapperSelector, icon)
      let itemSelector = `li.item.${i.type}`

      return h(itemSelector, {
        on: {
          click: event => {
            this.selectItem(event, i)
          }
        }
      }, iconWrapper)
    })

    const vnode = h('ul', children)

    if (oldVnode) {
      patch(oldVnode, vnode)
    } else {
      patch(linkContainer, vnode)
    }
    this.oldVnode = vnode
  }

  selectItem (event, item) {
    event.preventDefault()
    event.stopPropagation()
    switch (item.type) {
      case 'jump':
        this.options.jumpClick(this.linkInfo)
        this.hide()
        break
      case 'reveal':
        this.revealInExplorer(this.linkInfo)
        this.hide()
        break
    }
  }

  revealInExplorer (linkInfo) {
    console.log('revealInExplorer called with:', linkInfo)
    const { href } = linkInfo
    if (href && href.startsWith('file://')) {
      console.log('Processing file:// URL:', href)
      let filePath = href.substring(7) // Remove 'file://' prefix
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.substring(1) // Remove leading slash on Windows
      }
      const absPath = path.resolve(filePath)
      console.log('Resolved path:', absPath)
      // Send IPC message to main process to reveal in explorer
      ipcRenderer.send('mt::reveal-in-explorer', absPath)
      console.log('IPC message sent')
    } else {
      console.log('Not a file:// URL or href is empty:', href)
    }
  }
}

export default LinkTools
