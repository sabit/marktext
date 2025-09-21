<template>
  <div>
    <div
      class="title-bar-editor-bg"
      :class="{ 'tabs-visible': showTabBar }"
    ></div>
    <div
      class="title-bar"
      :class="[{ 'active': active }, { 'tabs-visible': showTabBar }, { 'frameless': titleBarStyle === 'custom' }, { 'isOsx': isOsx }]"
    >
      <div class="title" @dblclick.stop="toggleMaxmizeOnMacOS">
        <span v-if="!filename">MarkText</span>
        <span v-else>
          <span
            v-for="(path, index) of paths"
            :key="index"
          >
            {{ path }}
            <svg class="icon" aria-hidden="true">
              <use xlink:href="#icon-arrow-right"></use>
            </svg>
          </span>
          <span
            class="filename"
            :class="{'isOsx': platform === 'darwin'}"
            @click="rename"
          >
            {{ filename }}
          </span>
          <span class="save-dot" :class="{'show': !isSaved}"></span>
        </span>
      </div>
      <div :class="showCustomTitleBar ? 'left-toolbar title-no-drag' : 'right-toolbar'">
        <div
          v-if="showCustomTitleBar"
          class="frameless-titlebar-menu title-no-drag"
          @click.stop="handleMenuClick"
        >
          <span class="text-center-vertical">&#9776;</span>
        </div>

        <!-- Draft Mode Toggle (Bool) -->
        <el-tooltip
          class="item"
          content="Draft Mode (disable overlays)"
          placement="bottom-end"
        >
          <div class="titlebar-bool title-no-drag">
            <Bool
              description="Draft"
              :bool="isDraftMode"
              :onChange="onDraftChange"
            />
          </div>
        </el-tooltip>

        <!-- Merge Progress Indicator -->
        <el-tooltip
          v-if="mergeInProgress"
          class="item"
          :content="mergeProgressText"
          placement="bottom-end"
        >
          <div class="merge-indicator">
            <div class="merge-spinner"></div>
            <div class="merge-progress-container">
              <div
                class="merge-progress-bar"
                :style="{ width: mergeProgressPercent }"
              ></div>
            </div>
          </div>
        </el-tooltip>
      </div>
      <div
        v-if="titleBarStyle === 'custom' && !isFullScreen && !isOsx"
        class="right-toolbar"
        :class="[{ 'title-no-drag': titleBarStyle === 'custom' }]"
      >
        <div class="frameless-titlebar-button frameless-titlebar-close" @click.stop="handleCloseClick">
          <div>
            <svg width="10" height="10">
              <path :d="windowIconClose" />
            </svg>
          </div>
        </div>
        <div class="frameless-titlebar-button frameless-titlebar-toggle" @click.stop="handleMaximizeClick">
          <div>
            <svg width="10" height="10">
              <path v-show="!isMaximized" :d="windowIconMaximize" />
              <path v-show="isMaximized" :d="windowIconRestore" />
            </svg>
          </div>
        </div>
        <div class="frameless-titlebar-button frameless-titlebar-minimize" @click.stop="handleMinimizeClick">
          <div>
            <svg width="10" height="10">
              <path :d="windowIconMinimize" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import bus from '@/bus'
import Bool from '@/prefComponents/common/bool'
import { isOsx } from '@/util'
import { getCurrentWindow, Menu as RemoteMenu } from '@electron/remote'
import { ipcRenderer } from 'electron'
import { mapState } from 'vuex'
import { closePath, maximizePath, minimizePath, restorePath } from '../../assets/window-controls.js'
import { PATH_SEPARATOR } from '../../config'

export default {
  components: { Bool },
  data () {
    this.isOsx = isOsx
    this.HASH = {
      word: {
        short: 'W',
        full: 'word'
      },
      character: {
        short: 'C',
        full: 'character'
      },
      paragraph: {
        short: 'P',
        full: 'paragraph'
      },
      all: {
        short: 'A',
        full: '(with space)character'
      }
    }
    this.windowIconMinimize = minimizePath
    this.windowIconRestore = restorePath
    this.windowIconMaximize = maximizePath
    this.windowIconClose = closePath
    return {
      isFullScreen: getCurrentWindow().isFullScreen(),
      isMaximized: getCurrentWindow().isMaximized(),
      show: 'word'
    }
  },
  created () {
    ipcRenderer.on('mt::window-maximize', this.onMaximize)
    ipcRenderer.on('mt::window-unmaximize', this.onUnmaximize)
    ipcRenderer.on('mt::window-enter-full-screen', this.onEnterFullScreen)
    ipcRenderer.on('mt::window-leave-full-screen', this.onLeaveFullScreen)
  },
  props: {
    project: Object,
    filename: String,
    pathname: String,
    active: Boolean,
    wordCount: Object,
    platform: String,
    isSaved: Boolean,
    mergeInProgress: {
      type: Boolean,
      default: false
    },
    mergeProgress: {
      type: Number,
      default: 0
    }
  },
  computed: {
    ...mapState({
      titleBarStyle: state => state.preferences.titleBarStyle,
      showTabBar: state => state.layout.showTabBar
    }),
    isDraftMode () {
      return this.$store.state.preferences.draftMode === true
    },
    paths () {
      if (!this.pathname) return []
      const pathnameToken = this.pathname.split(PATH_SEPARATOR).filter(i => i)
      return pathnameToken.slice(0, pathnameToken.length - 1).slice(-3)
    },
    showCustomTitleBar () {
      return this.titleBarStyle === 'custom' && !this.isOsx
    },
    mergeProgressText () {
      if (!this.mergeInProgress) return ''
      const percent = Math.round(this.mergeProgress * 100)
      return `Merging documents... ${percent}%`
    },
    mergeProgressPercent () {
      return `${Math.round(this.mergeProgress * 100)}%`
    }
  },
  watch: {
    filename: function (value) {
      // Set filename when hover on dock
      const hasOpenFolder = this.project && this.project.name
      let title = ''
      if (value) {
        title = hasOpenFolder ? `${value} - ${this.project.name}` : `${value} - MarkText`
      } else {
        title = hasOpenFolder ? this.project.name : 'MarkText'
      }

      document.title = title
    },
    mergeInProgress: function (newVal) {
      if (newVal) {
        // Start progress bar
        this.updateProgressBar(this.mergeProgress)
      } else {
        // Clear progress bar
        this.updateProgressBar(-1)
      }
    },
    mergeProgress: function (newVal) {
      if (this.mergeInProgress) {
        this.updateProgressBar(newVal)
      }
    }
  },
  methods: {
    onDraftChange (value) {
      const nextValue = !!value
      // Persist and broadcast
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type: 'draftMode', value: nextValue })
      this.$store.commit('SET_USER_PREFERENCE', { draftMode: nextValue })
      bus.$emit('toggle-draft-mode', nextValue)
    },
    handleWordClick () {
      const ITEMS = ['word', 'paragraph', 'character', 'all']
      const len = ITEMS.length
      let index = ITEMS.indexOf(this.show)
      index += 1
      if (index >= len) index = 0
      this.show = ITEMS[index]
    },

    updateProgressBar (progress) {
      try {
        const win = getCurrentWindow()
        if (progress >= 0 && progress <= 1) {
          // Set progress (0-1 for determinate progress)
          win.setProgressBar(progress)
        } else if (progress === -1) {
          // Clear progress bar
          win.setProgressBar(-1)
        }
      } catch (error) {
        console.warn('Failed to update progress bar:', error)
      }
    },

    handleCloseClick () {
      getCurrentWindow().close()
    },

    handleMaximizeClick () {
      const win = getCurrentWindow()
      if (win.isFullScreen()) {
        win.setFullScreen(false)
      } else if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
    },

    toggleMaxmizeOnMacOS () {
      if (this.isOsx) {
        this.handleMaximizeClick()
      }
    },

    handleMinimizeClick () {
      getCurrentWindow().minimize()
    },

    handleMenuClick () {
      const win = getCurrentWindow()
      RemoteMenu.getApplicationMenu().popup({ window: win, x: 23, y: 20 })
    },

    rename () {
      if (this.platform === 'darwin') {
        this.$store.dispatch('RESPONSE_FOR_RENAME')
      }
    },

    onMaximize () {
      this.isMaximized = true
    },
    onUnmaximize () {
      this.isMaximized = false
    },
    onEnterFullScreen () {
      this.isFullScreen = true
    },
    onLeaveFullScreen  () {
      this.isFullScreen = false
    }
  },
  beforeDestroy () {
    ipcRenderer.off('window-maximize', this.onMaximize)
    ipcRenderer.off('window-unmaximize', this.onUnmaximize)
    ipcRenderer.off('window-enter-full-screen', this.onEnterFullScreen)
    ipcRenderer.off('window-leave-full-screen', this.onLeaveFullScreen)
  }
}
</script>

<style scoped>
  .title-bar-editor-bg {
    height: var(--titleBarHeight);
    background: var(--editorBgColor);
    position: relative;
    left: 0;
    top: 0;
    right: 0;
  }
  .title-bar {
    -webkit-app-region: drag;
    user-select: none;
    background: transparent;
    height: var(--titleBarHeight);
    box-sizing: border-box;
    color: var(--editorColor50);
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    z-index: 2;
    transition: color .4s ease-in-out;
    cursor: default;
  }
  .active {
    color: var(--editorColor);
  }
  img {
    height: 90%;
    margin-top: 1px;
    vertical-align: top;
  }
  .title {
    padding: 0 142px;
    height: 100%;
    line-height: var(--titleBarHeight);
    font-size: 14px;
    text-align: center;
    transition: all .25s ease-in-out;
    & .filename {
      transition: all .25s ease-in-out;
    }
    &::after {
      content: '';
      position: absolute;
      top: 0;
      height: 1px;
      width: 100%;
      z-index: 1;
      -webkit-app-region: no-drag;
    }
  }
  div.title > span {
    /* Workaround for GH#339 */
    display: block;
    direction: rtl;
    overflow: hidden;
    text-overflow: clip;
    white-space: nowrap;
  }

  .title-bar .title .filename.isOsx:hover {
    color: var(--themeColor);
  }

  .active .save-dot {
    margin-left: 3px;
    width: 7px;
    height: 7px;
    display: inline-block;
    border-radius: 50%;
    background: var(--highlightThemeColor);
    opacity: .7;
    visibility: hidden;
  }
  .active .save-dot.show {
    visibility: visible;
  }
  .title:hover {
    color: var(sideBarTitleColor);
  }

  .left-toolbar {
    padding: 0 10px;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    width: 118px; /* + 2*10px padding*/
    display: flex;
    flex-direction: row;
  }
  .right-toolbar {
    height: 100%;
    position: absolute;
    top: 0;
    right: 0;
    width: 138px;
    display: flex;
    align-items: center;
    flex-direction: row-reverse;
    & .item {
      margin-right: 10px;
    }
  }

  .word-count {
    cursor: pointer;
    font-size: 14px;
    color: var(--editorColor30);
    text-align: center;
    line-height: 24px;
    padding: 0 5px;
    box-sizing: border-box;
    transition: all .25s ease-in-out;
    & > .text-center-vertical {
      padding: 2px 5px;
      border-radius: 3px;
    }
    &:hover > span {
      background: var(--sideBarBgColor);
      color: var(--sideBarTitleColor);
    }
  }

  .title-no-drag {
    -webkit-app-region: no-drag;
  }
  /* frameless window controls */
  .frameless-titlebar-button {
    position: relative;
    display: block;
    width: 46px;
    height: var(--titleBarHeight);
  }
  .frameless-titlebar-button > div {
    position: absolute;
    display: inline-flex;
    top: 50%;
    left: 50%;
    transform: translateX(-50%) translateY(-50%);
  }
  .frameless-titlebar-menu {
    color: var(--sideBarColor);
  }
  .frameless-titlebar-close:hover {
    background-color: rgb(228, 79, 79);
  }
  .frameless-titlebar-minimize:hover,
  .frameless-titlebar-toggle:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
  .frameless-titlebar-button svg {
    fill: #000000
  }
  .frameless-titlebar-close:hover svg {
    fill: #ffffff
  }

  .merge-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin-left: 5px;
    position: relative;
  }

  .merge-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--editorColor30);
    border-top: 2px solid var(--themeColor);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .merge-progress-container {
    position: absolute;
    bottom: -6px;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--editorColor20);
    border-radius: 2px;
    overflow: hidden;
  }

  .merge-progress-bar {
    height: 100%;
    background: var(--themeColor);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>

<style scoped>
/* Compact the Bool switch in the title bar */
.titlebar-bool .pref-switch-item {
  margin: 0;
  padding: 0 4px;
  min-height: unset;
  height: 28px;
  display: flex;
  align-items: center;
  font-size: 13px;
}
.titlebar-bool .pref-switch-item .description {
  margin-right: 6px;
  font-size: 13px;
  white-space: nowrap;
}
.titlebar-bool .el-switch {
  vertical-align: middle;
}
</style>

<style>
.title-item {
  height: 28px;
  line-height: 28px;
  & .front {
    opacity: .7;
  }
  & .text {
    margin-left: 10px;
  }
}
</style>
