<template>
  <div
    class="editor-wrapper"
    :class="[{ 'typewriter': typewriter, 'focus': focus, 'source': sourceCode }]"
    :style="{ 'lineHeight': lineHeight, 'fontSize': `${fontSize}px`,
    'font-family': editorFontFamily ? `${editorFontFamily}, ${defaultFontFamily}` : `${defaultFontFamily}` }"
    :dir="textDirection"
  >
    <div
      ref="editor"
      class="editor-component"
    ></div>
    <div
      class="image-viewer"
      v-show="imageViewerVisible"
    >
      <span class="icon-close" @click="setImageViewerVisible(false)">
        <svg :viewBox="CloseIcon.viewBox">
          <use :xlink:href="CloseIcon.url"></use>
        </svg>
      </span>
      <div
        ref="imageViewer"
      >
      </div>
    </div>
    <el-dialog
      :visible.sync="dialogTableVisible"
      :show-close="isShowClose"
      :modal="true"
      custom-class="ag-dialog-table"
      width="454px"
      center
      dir='ltr'
    >
      <div slot="title" class="dialog-title">
        Insert Table
      </div>
      <el-form :model="tableChecker" :inline="true">
        <el-form-item label="Rows">
          <el-input-number
            ref="rowInput"
            size="mini"
            v-model="tableChecker.rows"
            controls-position="right"
            :min="1"
            :max="30"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="Columns">
          <el-input-number
            size="mini"
            v-model="tableChecker.columns"
            controls-position="right"
            :min="1"
            :max="20"
          ></el-input-number>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogTableVisible = false">
          Cancel
        </el-button>
        <el-button type="primary" @click="handleDialogTableConfirm">
          OK
        </el-button>
      </div>
    </el-dialog>
    <search
      v-if="!sourceCode"
    ></search>
  </div>
</template>

<script>
import { shell } from 'electron'
import log from 'electron-log'
import path from 'path'
import { mapState } from 'vuex'
// import ViewImage from 'view-image'
import bus from '@/bus'
import { SpellcheckerLanguageCommand } from '@/commands'
import { DEFAULT_EDITOR_FONT_FAMILY } from '@/config'
import notice from '@/services/notification'
import Printer from '@/services/printService'
import { SpellChecker } from '@/spellchecker'
import { animatedScrollTo, isOsx } from '@/util'
import { guessClipboardFilePath } from '@/util/clipboard'
import { moveImageToFolder, moveToRelativeFolder, uploadImage } from '@/util/fileSystem'
import { getCssForOptions, getHtmlToc } from '@/util/pdf'
import { addCommonStyle, setEditorWidth } from '@/util/theme'
import { isChildOfDirectory } from 'common/filesystem/paths'
import { mergeWithTemplates } from '../../utils/pdfProcessing'
import { convertFileUrlToPath, findConversionTool, convertToPdf } from '../../utils/fileConversion'
import { parseDocumentSections } from '../../utils/documentParser'
import Muya from 'muya/lib'
import CodePicker from 'muya/lib/ui/codePicker'
import EmojiPicker from 'muya/lib/ui/emojiPicker'
import FootnoteTool from 'muya/lib/ui/footnoteTool'
import FormatPicker from 'muya/lib/ui/formatPicker'
import FrontMenu from 'muya/lib/ui/frontMenu'
import ImagePathPicker from 'muya/lib/ui/imagePicker'
import ImageSelector from 'muya/lib/ui/imageSelector'
import ImageToolbar from 'muya/lib/ui/imageToolbar'
import LinkTools from 'muya/lib/ui/linkTools'
import QuickInsert from 'muya/lib/ui/quickInsert'
import TablePicker from 'muya/lib/ui/tablePicker'
import TableBarTools from 'muya/lib/ui/tableTools'
import Transformer from 'muya/lib/ui/transformer'
import Search from '../search'

import '@/assets/themes/codemirror/one-dark.css'
import 'muya/themes/default.css'
// import 'view-image/lib/imgViewer.css'
import CloseIcon from '@/assets/icons/close.svg'

const STANDAR_Y = 320

export default {
  components: {
    Search
  },

  props: {
    markdown: String,
    cursor: Object,
    textDirection: {
      type: String,
      required: true
    },
    platform: String
  },

  computed: {
    ...mapState({
      preferences: state => state.preferences,
      preferLooseListItem: state => state.preferences.preferLooseListItem,
      autoPairBracket: state => state.preferences.autoPairBracket,
      autoPairMarkdownSyntax: state => state.preferences.autoPairMarkdownSyntax,
      autoPairQuote: state => state.preferences.autoPairQuote,
      bulletListMarker: state => state.preferences.bulletListMarker,
      orderListDelimiter: state => state.preferences.orderListDelimiter,
      tabSize: state => state.preferences.tabSize,
      listIndentation: state => state.preferences.listIndentation,
      frontmatterType: state => state.preferences.frontmatterType,
      superSubScript: state => state.preferences.superSubScript,
      footnote: state => state.preferences.footnote,
      isHtmlEnabled: state => state.preferences.isHtmlEnabled,
      isGitlabCompatibilityEnabled: state => state.preferences.isGitlabCompatibilityEnabled,
      lineHeight: state => state.preferences.lineHeight,
      fontSize: state => state.preferences.fontSize,
      codeFontSize: state => state.preferences.codeFontSize,
      codeFontFamily: state => state.preferences.codeFontFamily,
      codeBlockLineNumbers: state => state.preferences.codeBlockLineNumbers,
      trimUnnecessaryCodeBlockEmptyLines: state => state.preferences.trimUnnecessaryCodeBlockEmptyLines,
      editorFontFamily: state => state.preferences.editorFontFamily,
      hideQuickInsertHint: state => state.preferences.hideQuickInsertHint,
      hideLinkPopup: state => state.preferences.hideLinkPopup,
      autoCheck: state => state.preferences.autoCheck,
      editorLineWidth: state => state.preferences.editorLineWidth,
      imageInsertAction: state => state.preferences.imageInsertAction,
      imagePreferRelativeDirectory: state => state.preferences.imagePreferRelativeDirectory,
      imageRelativeDirectoryName: state => state.preferences.imageRelativeDirectoryName,
      imageFolderPath: state => state.preferences.imageFolderPath,
      theme: state => state.preferences.theme,
      sequenceTheme: state => state.preferences.sequenceTheme,
      hideScrollbar: state => state.preferences.hideScrollbar,
      spellcheckerEnabled: state => state.preferences.spellcheckerEnabled,
      spellcheckerNoUnderline: state => state.preferences.spellcheckerNoUnderline,
      spellcheckerLanguage: state => state.preferences.spellcheckerLanguage,

      currentFile: state => state.editor.currentFile,
      projectTree: state => state.project.projectTree,

      // edit modes
      typewriter: state => state.preferences.typewriter,
      focus: state => state.preferences.focus,
      sourceCode: state => state.preferences.sourceCode
    })
  },

  data () {
    this.defaultFontFamily = DEFAULT_EDITOR_FONT_FAMILY
    this.CloseIcon = CloseIcon

    return {
      selectionChange: null,
      editor: null,
      pathname: '',
      isShowClose: false,
      dialogTableVisible: false,
      imageViewerVisible: false,
      tableChecker: {
        rows: 4,
        columns: 3
      }
    }
  },

  watch: {
    typewriter: function (value) {
      if (value) {
        this.scrollToCursor()
      }
    },

    focus: function (value) {
      this.editor.setFocusMode(value)
    },

    fontSize: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setFont({ fontSize: value })
      }
    },

    lineHeight: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setFont({ lineHeight: value })
      }
    },

    preferLooseListItem: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({
          preferLooseListItem: value
        })
      }
    },

    tabSize: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setTabSize(value)
      }
    },

    theme: function (value, oldValue) {
      if (value !== oldValue && this.editor) {
        // Agreement：Any black series theme needs to contain dark `word`.
        if (/dark/i.test(value)) {
          this.editor.setOptions({
            mermaidTheme: 'dark',
            vegaTheme: 'dark'
          }, true)
        } else {
          this.editor.setOptions({
            mermaidTheme: 'default',
            vegaTheme: 'latimes'
          }, true)
        }
      }
    },

    sequenceTheme: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ sequenceTheme: value }, true)
      }
    },

    listIndentation: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setListIndentation(value)
      }
    },

    frontmatterType: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ frontmatterType: value })
      }
    },

    superSubScript: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ superSubScript: value }, true)
      }
    },

    footnote: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ footnote: value }, true)
      }
    },

    isHtmlEnabled: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ disableHtml: !value }, true)
      }
    },

    isGitlabCompatibilityEnabled: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ isGitlabCompatibilityEnabled: value }, true)
      }
    },

    hideQuickInsertHint: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ hideQuickInsertHint: value })
      }
    },

    editorLineWidth: function (value, oldValue) {
      if (value !== oldValue) {
        setEditorWidth(value)
      }
    },

    autoPairBracket: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ autoPairBracket: value })
      }
    },

    autoPairMarkdownSyntax: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ autoPairMarkdownSyntax: value })
      }
    },

    autoPairQuote: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ autoPairQuote: value })
      }
    },

    trimUnnecessaryCodeBlockEmptyLines: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ trimUnnecessaryCodeBlockEmptyLines: value })
      }
    },

    bulletListMarker: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ bulletListMarker: value })
      }
    },

    orderListDelimiter: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ orderListDelimiter: value })
      }
    },

    hideLinkPopup: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ hideLinkPopup: value })
      }
    },

    autoCheck: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ autoCheck: value })
      }
    },

    codeFontSize: function (value, oldValue) {
      if (value !== oldValue) {
        addCommonStyle({
          codeFontSize: value,
          codeFontFamily: this.codeFontFamily,
          hideScrollbar: this.hideScrollbar
        })
      }
    },

    codeBlockLineNumbers: function (value, oldValue) {
      const { editor } = this
      if (value !== oldValue && editor) {
        editor.setOptions({ codeBlockLineNumbers: value }, true)
      }
    },

    codeFontFamily: function (value, oldValue) {
      if (value !== oldValue) {
        addCommonStyle({
          codeFontSize: this.codeFontSize,
          codeFontFamily: value,
          hideScrollbar: this.hideScrollbar
        })
      }
    },

    hideScrollbar: function (value, oldValue) {
      if (value !== oldValue) {
        addCommonStyle({
          codeFontSize: this.codeFontSize,
          codeFontFamily: this.codeFontFamily,
          hideScrollbar: value
        })
      }
    },

    spellcheckerEnabled: function (value, oldValue) {
      if (value !== oldValue) {
        const { editor, spellchecker, spellcheckerLanguage } = this

        // Set Muya's spellcheck container attribute.
        if (editor) {
          editor.setOptions({ spellcheckEnabled: value })
        } else {
          console.warn('Editor is null in spellcheckerEnabled watch, cannot set spellcheck options')
        }

        // Disable native spell checker
        if (value) {
          spellchecker.activateSpellchecker(spellcheckerLanguage)
        } else {
          spellchecker.deactivateSpellchecker()
        }
      }
    },

    spellcheckerNoUnderline: function (value, oldValue) {
      if (value !== oldValue) {
        // Set Muya's spellcheck container attribute.
        if (this.editor) {
          this.editor.setOptions({ spellcheckEnabled: !value })
        } else {
          console.warn('Editor is null in spellcheckerNoUnderline watch, cannot set spellcheck options')
        }
      }
    },

    spellcheckerLanguage: function (value, oldValue) {
      if (value !== oldValue) {
        this.spellchecker.lang = value
      }
    },

    currentFile: function (value, oldValue) {
      if (value && value !== oldValue) {
        this.scrollToCursor(0)
        // Hide float tools if needed.
        this.editor && this.editor.hideAllFloatTools()
      }
    },

    sourceCode: function (value, oldValue) {
      if (value && value !== oldValue) {
        this.editor && this.editor.hideAllFloatTools()
      }
    }
  },

  created () {
    this.$nextTick(() => {
      this.printer = new Printer()
      const ele = this.$refs.editor
      const {
        focus: focusMode,
        markdown,
        preferLooseListItem,
        typewriter,
        autoPairBracket,
        autoPairMarkdownSyntax,
        autoPairQuote,
        trimUnnecessaryCodeBlockEmptyLines,
        bulletListMarker,
        orderListDelimiter,
        tabSize,
        fontSize,
        lineHeight,
        codeBlockLineNumbers,
        listIndentation,
        frontmatterType,
        superSubScript,
        footnote,
        isHtmlEnabled,
        isGitlabCompatibilityEnabled,
        hideQuickInsertHint,
        editorLineWidth,
        theme,
        sequenceTheme,
        spellcheckerEnabled,
        spellcheckerLanguage,
        hideLinkPopup,
        autoCheck
      } = this

      // use muya UI plugins
      Muya.use(TablePicker)
      Muya.use(QuickInsert)
      Muya.use(CodePicker)
      Muya.use(EmojiPicker)
      Muya.use(ImagePathPicker)
      Muya.use(ImageSelector, {
        unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY,
        photoCreatorClick: this.photoCreatorClick
      })
      Muya.use(Transformer)
      Muya.use(ImageToolbar)
      Muya.use(FormatPicker)
      Muya.use(FrontMenu)
      Muya.use(LinkTools, {
        jumpClick: this.jumpClick
      })
      Muya.use(FootnoteTool)
      Muya.use(TableBarTools)

      const options = {
        focusMode,
        markdown,
        preferLooseListItem,
        autoPairBracket,
        autoPairMarkdownSyntax,
        trimUnnecessaryCodeBlockEmptyLines,
        autoPairQuote,
        bulletListMarker,
        orderListDelimiter,
        tabSize,
        fontSize,
        lineHeight,
        codeBlockLineNumbers,
        listIndentation,
        frontmatterType,
        superSubScript,
        footnote,
        disableHtml: !isHtmlEnabled,
        isGitlabCompatibilityEnabled,
        hideQuickInsertHint,
        hideLinkPopup,
        autoCheck,
        sequenceTheme,
        spellcheckEnabled: spellcheckerEnabled,
        imageAction: this.imageAction.bind(this),
        imagePathPicker: this.imagePathPicker.bind(this),
        clipboardFilePath: guessClipboardFilePath,
        imagePathAutoComplete: this.imagePathAutoComplete.bind(this),
        notice
      }

      if (/dark/i.test(theme)) {
        Object.assign(options, {
          mermaidTheme: 'dark',
          vegaTheme: 'dark'
        })
      } else {
        Object.assign(options, {
          mermaidTheme: 'default',
          vegaTheme: 'latimes'
        })
      }

      const { container } = this.editor = new Muya(ele, options)

      // Create spell check wrapper and enable spell checking if preferred.
      this.spellchecker = new SpellChecker(spellcheckerEnabled, spellcheckerLanguage)

      // Register command palette entry for switching spellchecker language.
      this.switchLanguageCommand = new SpellcheckerLanguageCommand(this.spellchecker)
      setTimeout(() => bus.$emit('cmd::register-command', this.switchLanguageCommand), 100)

      if (typewriter) {
        this.scrollToCursor()
      }

      // listen for bus events.
      bus.$on('file-loaded', this.setMarkdownToEditor)
      bus.$on('invalidate-image-cache', this.handleInvalidateImageCache)
      bus.$on('undo', this.handleUndo)
      bus.$on('redo', this.handleRedo)
      bus.$on('selectAll', this.handleSelectAll)
      bus.$on('export', this.handleExport)
      bus.$on('print-service-clearup', this.handlePrintServiceClearup)
      bus.$on('paragraph', this.handleEditParagraph)
      bus.$on('format', this.handleInlineFormat)
      bus.$on('insert-filepath', this.handleInsertFilepath)
      bus.$on('searchValue', this.handleSearch)
      bus.$on('replaceValue', this.handReplace)
      bus.$on('find-action', this.handleFindAction)
      bus.$on('insert-image', this.insertImage)
      bus.$on('image-uploaded', this.handleUploadedImage)
      bus.$on('file-changed', this.handleFileChange)
      bus.$on('editor-blur', this.blurEditor)
      bus.$on('editor-focus', this.focusEditor)
      bus.$on('copyAsMarkdown', this.handleCopyPaste)
      bus.$on('copyAsHtml', this.handleCopyPaste)
      bus.$on('pasteAsPlainText', this.handleCopyPaste)
      bus.$on('pasteFilePath', this.handleCopyPaste)
      bus.$on('duplicate', this.handleParagraph)
      bus.$on('createParagraph', this.handleParagraph)
      bus.$on('deleteParagraph', this.handleParagraph)
      bus.$on('insertParagraph', this.handleInsertParagraph)
      bus.$on('scroll-to-header', this.scrollToHeader)
      bus.$on('screenshot-captured', this.handleScreenShot)
      bus.$on('switch-spellchecker-language', this.switchSpellcheckLanguage)
      bus.$on('open-command-spellchecker-switch-language', this.openSpellcheckerLanguageCommand)
      bus.$on('replace-misspelling', this.replaceMisspelling)
      bus.$on('merge-documents', () => {
        this.handleDocumentMerge()
      })

      this.editor.on('change', changes => {
        // WORKAROUND: "id: 'muya'"
        this.$store.dispatch('LISTEN_FOR_CONTENT_CHANGE', Object.assign(changes, { id: 'muya' }))
      })

      this.editor.on('format-click', ({ event, formatType, data }) => {
        const ctrlOrMeta = (isOsx && event.metaKey) || (!isOsx && event.ctrlKey)
        if (formatType === 'link' && ctrlOrMeta) {
          // Check if it's a file:// URL and reveal in explorer
          if (data.href && data.href.startsWith('file://')) {
            console.log('Ctrl+click on file:// URL, revealing in explorer:', data.href)
            // Send IPC message to main process to reveal in explorer
            const { ipcRenderer } = require('electron')
            const path = require('path')

            let filePath = data.href.substring(7) // Remove 'file://' prefix
            if (process.platform === 'win32' && filePath.startsWith('/')) {
              filePath = filePath.substring(1) // Remove leading slash on Windows
            }
            const absPath = path.resolve(filePath)
            ipcRenderer.send('mt::reveal-in-explorer', absPath)
            return // Don't continue with normal link click
          }

          this.$store.dispatch('FORMAT_LINK_CLICK', { data, dirname: window.DIRNAME })
        } else if (formatType === 'image' && ctrlOrMeta) {
          if (this.imageViewer) {
            this.imageViewer.destroy()
          }

          // Disabled due to #2120.
          // this.imageViewer = new ViewImage(this.$refs.imageViewer, {
          //   url: data,
          //   snapView: true
          // })

          this.setImageViewerVisible(true)
        }
      })

      // Disabled due to #2120.
      // this.editor.on('preview-image', ({ data }) => {
      //   if (this.imageViewer) {
      //     this.imageViewer.destroy()
      //   }
      //
      //   this.imageViewer = new ViewImage(this.$refs.imageViewer, {
      //     url: data,
      //     snapView: true
      //   })
      //
      //   this.setImageViewerVisible(true)
      // })

      this.editor.on('selectionChange', changes => {
        const { y } = changes.cursorCoords
        if (this.typewriter) {
          const startPosition = container.scrollTop
          const toPosition = startPosition + y - STANDAR_Y

          // Prevent micro shakes and unnecessary scrolling.
          if (Math.abs(startPosition - toPosition) > 2) {
            animatedScrollTo(container, toPosition, 100)
          }
        }

        // Used to fix #628: auto scroll cursor to visible if the cursor is too low.
        if (container.clientHeight - y < 100) {
          // editableHeight is the lowest cursor position(till to top) that editor allowed.
          const editableHeight = container.clientHeight - 100
          animatedScrollTo(container, container.scrollTop + (y - editableHeight), 0)
        }

        this.selectionChange = changes
        this.$store.dispatch('SELECTION_CHANGE', changes)
      })

      this.editor.on('selectionFormats', formats => {
        this.$store.dispatch('SELECTION_FORMATS', formats)
      })

      document.addEventListener('keyup', this.keyup)

      setEditorWidth(editorLineWidth)
    })
  },
  methods: {
    photoCreatorClick: (url) => {
      shell.openExternal(url)
    },

    jumpClick (linkInfo) {
      const { href } = linkInfo
      this.$store.dispatch('FORMAT_LINK_CLICK', { data: { href }, dirname: window.DIRNAME })
    },

    async imagePathAutoComplete (src) {
      const files = await this.$store.dispatch('ASK_FOR_IMAGE_AUTO_PATH', src)
      return files.map(f => {
        const iconClass = f.type === 'directory' ? 'icon-folder' : 'icon-image'
        return Object.assign(f, { iconClass, text: f.file + (f.type === 'directory' ? '/' : '') })
      })
    },

    async imageAction (image, id, alt = '') {
      // TODO(Refactor): Refactor this method.
      const {
        imageInsertAction,
        imageFolderPath,
        imagePreferRelativeDirectory,
        imageRelativeDirectoryName,
        preferences
      } = this
      const {
        filename,
        pathname
      } = this.currentFile

      // Save an image relative to the file if the relative image directory include the filename variable.
      // The image is save relative to the root folder without a variable.
      const saveRelativeToFile = () => {
        return /\${filename}/.test(imageRelativeDirectoryName)
      }

      // Figure out the current working directory.
      const isTabSavedOnDisk = !!pathname
      let relativeBasePath = isTabSavedOnDisk ? path.dirname(pathname) : null
      if (isTabSavedOnDisk && !saveRelativeToFile() && this.projectTree) {
        const { pathname: rootPath } = this.projectTree
        if (rootPath && isChildOfDirectory(rootPath, pathname)) {
          // Save assets relative to root directory.
          relativeBasePath = rootPath
        }
      }

      const getResolvedImagePath = imagePath => {
        const replacement = isTabSavedOnDisk
          // Filename w/o extension
          ? filename.replace(/\.[^/.]+$/, '')
          : ''
        return imagePath.replace(/\${filename}/g, replacement)
      }

      const resolvedImageFolderPath = getResolvedImagePath(imageFolderPath)
      const resolvedImageRelativeDirectoryName = getResolvedImagePath(imageRelativeDirectoryName)
      let destImagePath = ''
      switch (imageInsertAction) {
        case 'upload': {
          try {
            destImagePath = await uploadImage(pathname, image, preferences)
          } catch (err) {
            notice.notify({
              title: 'Upload Image',
              type: 'warning',
              message: err
            })
            destImagePath = await moveImageToFolder(pathname, image, resolvedImageFolderPath)
          }
          break
        }
        case 'folder': {
          destImagePath = await moveImageToFolder(pathname, image, resolvedImageFolderPath)
          if (isTabSavedOnDisk && imagePreferRelativeDirectory) {
            destImagePath = await moveToRelativeFolder(relativeBasePath, resolvedImageRelativeDirectoryName, pathname, destImagePath)
          }
          break
        }
        case 'path': {
          if (typeof image === 'string') {
            // Input is a local path.
            destImagePath = image
          } else {
            // Save and move image to image folder if input is binary.
            destImagePath = await moveImageToFolder(pathname, image, resolvedImageFolderPath)

            // Respect user preferences if tab exists on disk.
            if (isTabSavedOnDisk && imagePreferRelativeDirectory) {
              destImagePath = await moveToRelativeFolder(relativeBasePath, resolvedImageRelativeDirectoryName, pathname, destImagePath)
            }
          }
          break
        }
      }

      if (id && this.sourceCode) {
        bus.$emit('image-action', {
          id,
          result: destImagePath,
          alt
        })
      }
      return destImagePath
    },

    imagePathPicker () {
      return this.$store.dispatch('ASK_FOR_IMAGE_PATH')
    },

    keyup (event) {
      if (event.key === 'Escape') {
        this.setImageViewerVisible(false)
      }
    },

    setImageViewerVisible (status) {
      this.imageViewerVisible = status
    },

    switchSpellcheckLanguage (languageCode) {
      const { spellchecker } = this
      const { isEnabled } = spellchecker

      // This method is also called from bus, so validate state before continuing.
      if (!isEnabled) {
        throw new Error('Cannot switch language because spell checker is disabled!')
      }

      spellchecker.switchLanguage(languageCode)
        .then(langCode => {
          if (!langCode) {
            // Unable to switch language due to missing dictionary. The spell checker is now in an invalid state.
            notice.notify({
              title: 'Spelling',
              type: 'warning',
              message: `Unable to switch to language "${languageCode}". Requested language dictionary is missing.`
            })
          }
        })
        .catch(error => {
          log.error(`Error while switching to language "${languageCode}":`)
          log.error(error)

          notice.notify({
            title: 'Spelling',
            type: 'error',
            message: `Error while switching to "${languageCode}": ${error.message}`
          })
        })
    },

    handleInvalidateImageCache () {
      if (this.editor) {
        this.editor.invalidateImageCache()
      }
    },

    openSpellcheckerLanguageCommand () {
      if (!isOsx) {
        bus.$emit('show-command-palette', this.switchLanguageCommand)
      }
    },

    replaceMisspelling ({ word, replacement }) {
      if (this.editor) {
        this.editor._replaceCurrentWordInlineUnsafe(word, replacement)
      }
    },

    handleUndo () {
      if (this.editor) {
        this.editor.undo()
      }
    },

    handleRedo () {
      if (this.editor) {
        this.editor.redo()
      }
    },

    handleSelectAll () {
      if (this.sourceCode) {
        return
      }

      if (this.editor && (this.editor.hasFocus() || this.editor.contentState.selectedTableCells)) {
        this.editor.selectAll()
      } else {
        const activeElement = document.activeElement
        const nodeName = activeElement.nodeName
        if (nodeName === 'INPUT' || nodeName === 'TEXTAREA') {
          activeElement.select()
        }
      }
    },

    // Custom copyAsMarkdown copyAsHtml pasteAsPlainText
    handleCopyPaste (type) {
      if (this.editor) {
        this.editor[type]()
      }
    },

    insertImage (src) {
      if (!this.sourceCode) {
        this.editor && this.editor.insertImage({ src })
      }
    },

    handleSearch (value, opt) {
      const searchMatches = this.editor.search(value, opt)
      this.$store.dispatch('SEARCH', searchMatches)
      this.scrollToHighlight()
    },

    handReplace (value, opt) {
      const searchMatches = this.editor.replace(value, opt)
      this.$store.dispatch('SEARCH', searchMatches)
    },

    handleUploadedImage (url, deletionUrl) {
      this.insertImage(url)
      this.$store.dispatch('SHOW_IMAGE_DELETION_URL', deletionUrl)
    },

    scrollToCursor (duration = 300) {
      this.$nextTick(() => {
        const { container } = this.editor
        const { y } = this.editor.getSelection().cursorCoords
        animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, duration)
      })
    },

    scrollToHighlight () {
      return this.scrollToElement('.ag-highlight')
    },

    scrollToHeader (slug) {
      return this.scrollToElement(`#${slug}`)
    },

    scrollToElement (selector) {
      // Scroll to search highlight word
      const { container } = this.editor
      const anchor = document.querySelector(selector)
      if (anchor) {
        const { y } = anchor.getBoundingClientRect()
        const DURATION = 300
        animatedScrollTo(container, container.scrollTop + y - STANDAR_Y, DURATION)
      }
    },

    handleFindAction (action) {
      const searchMatches = this.editor.find(action)
      this.$store.dispatch('SEARCH', searchMatches)
      this.scrollToHighlight()
    },

    async handleExport (options) {
      const {
        type,
        header,
        footer,
        headerFooterStyled,
        htmlTitle
      } = options

      if (!/^pdf|print|styledHtml$/.test(type)) {
        throw new Error(`Invalid type to export: "${type}".`)
      }

      const extraCss = getCssForOptions(options)
      const htmlToc = getHtmlToc(this.editor.getTOC(), options)

      switch (type) {
        case 'styledHtml': {
          try {
            const content = await this.editor.exportStyledHTML({
              title: htmlTitle || '',
              printOptimization: false,
              extraCss,
              toc: htmlToc
            })
            this.$store.dispatch('EXPORT', { type, content })
          } catch (err) {
            log.error('Failed to export document:', err)
            notice.notify({
              title: `Printing/Exporting ${htmlTitle || 'html'} failed`,
              type: 'error',
              message: err.message || 'There is something wrong when exporting.'
            })
          }
          break
        }
        case 'pdf': {
          // NOTE: We need to set page size via Electron.
          try {
            const { pageSize, pageSizeWidth, pageSizeHeight, isLandscape } = options
            const pageOptions = {
              pageSize, pageSizeWidth, pageSizeHeight, isLandscape
            }

            const html = await this.editor.exportStyledHTML({
              title: '',
              printOptimization: true,
              extraCss,
              toc: htmlToc,
              header,
              footer,
              headerFooterStyled
            })
            this.printer.renderMarkdown(html, true)
            this.$store.dispatch('EXPORT', { type, pageOptions })
          } catch (err) {
            log.error('Failed to export document:', err)
            notice.notify({
              title: 'Printing/Exporting failed',
              type: 'error',
              message: `There is something wrong when export ${htmlTitle || 'PDF'}.`
            })
            this.handlePrintServiceClearup()
          }
          break
        }
        case 'print': {
          // NOTE: Print doesn't support page size or orientation.
          try {
            const html = await this.editor.exportStyledHTML({
              title: '',
              printOptimization: true,
              extraCss,
              toc: htmlToc,
              header,
              footer,
              headerFooterStyled
            })
            this.printer.renderMarkdown(html, true)
            this.$store.dispatch('PRINT_RESPONSE')
          } catch (err) {
            log.error('Failed to export document:', err)
            notice.notify({
              title: 'Printing/Exporting failed',
              type: 'error',
              message: `There is something wrong when print ${htmlTitle || ''}.`
            })
            this.handlePrintServiceClearup()
          }
          break
        }
      }
    },

    async handleDocumentMerge () {
      // Check if document is saved
      const { currentFile } = this
      if (!currentFile.isSaved) {
        notice.notify({
          title: 'Document Not Saved',
          type: 'warning',
          message: 'Please save the document before merging.',
          time: 0
        })
        return
      }
      bus.$emit('merge-started')
      if (this.editor) this.editor.setOptions({ readOnly: true })
      const DocumentCache = require('../../utils/DocumentCache')
      const ProgressManager = require('../../utils/ProgressManager')
      const { processSections } = require('../../utils/mergeHelpers')
      try {
        if (!this.editor) throw new Error('Editor is not available')
        const markdown = this.editor.getMarkdown()
        // Use imported parseDocumentSections function from documentParser.js
        const sections = parseDocumentSections(markdown)
        if (sections.length === 0) throw new Error('No ordered lists with file links found in the document. Make sure your document contains ordered lists with file:// links.')
        bus.$emit('merge-progress', { progress: 10, message: 'Document sections parsed' })
        // Setup utilities
        const cache = new DocumentCache()
        const progressManager = new ProgressManager()
        // Prepare tools object for mergeHelpers
        const tools = {
          findConversionTool, // Use imported function from fileConversion.js
          convertToPdf, // Use imported function from fileConversion.js
          conversionTools: this.$store.state.preferences.conversionTools || [],
          convertFileUrlToPath // Use imported function from fileConversion.js
        }
        // Use processSections to build mergeList
        const basePath = currentFile.pathname
        const path = require('path')
        const baseDir = path.dirname(basePath)
        const outputDir = path.join(baseDir, 'cache')
        if (!require('fs').existsSync(outputDir)) {
          require('fs').mkdirSync(outputDir, { recursive: true })
        }
        const mergeList = await processSections(
          sections,
          tools,
          outputDir,
          cache,
          progressManager,
          bus
        )
        // Merge all PDFs with header/footer overlay
        const templateDirectory = this.$store.state.preferences.templateDirectory || ''
        // Use imported mergeWithTemplates from pdfProcessing.js
        const mergedPdfPath = await mergeWithTemplates(mergeList, baseDir, templateDirectory)
        notice.notify({
          title: 'Document merge completed',
          message: `Merged PDF saved to: ${mergedPdfPath}`,
          showConfirm: true,
          time: 0
        })
      } catch (error) {
        console.error('Document merge failed:', error)
        notice.notify({
          title: 'Document merge failed',
          type: 'error',
          message: error.message || 'An unexpected error occurred during document merge.',
          time: 0
        })
      } finally {
        if (this.editor) this.editor.setOptions({ readOnly: false })
        bus.$emit('merge-completed')
      }
    },

    // parseDocumentSections has been moved to utils/documentParser.js

    // convertAndMergeDocuments is now handled by processSections and mergeWithTemplates
    // (see handleDocumentMerge)

    // mergeWithTemplates has been moved to utils/pdfProcessing.js

    // Generate clickable Table of Contents page (supports multi-page)
    // generateTableOfContents has been moved to utils/pdfProcessing.js

    // convertFileUrlToPath, findConversionTool, and convertToPdf have been moved to utils/fileConversion.js

    handlePrintServiceClearup () {
      this.printer.clearup()
    },

    handleEditParagraph (type) {
      if (type === 'table') {
        this.tableChecker = { rows: 4, columns: 3 }
        this.dialogTableVisible = true
        this.$nextTick(() => {
          this.$refs.rowInput.focus()
        })
      } else if (this.editor) {
        this.editor.updateParagraph(type)
      }
    },

    // handle `duplicate`, `delete`, `create paragraph below`
    handleParagraph (type) {
      const { editor } = this
      if (editor) {
        switch (type) {
          case 'duplicate': {
            return editor.duplicate()
          }
          case 'createParagraph': {
            return editor.insertParagraph('after', '', true)
          }
          case 'deleteParagraph': {
            return editor.deleteParagraph()
          }
          default:
            console.error(`unknow paragraph edit type: ${type}`)
        }
      }
    },

    handleInlineFormat (type) {
      this.editor && this.editor.format(type)
    },

    async handleInsertFilepath () {
      const filePath = await this.$store.dispatch('ASK_FOR_FILE_PATH')
      if (filePath) {
        // Insert the filepath tag at the end of the current line
        this.editor && this.editor.insertFilepath(filePath)
      }
    },

    handleDialogTableConfirm () {
      this.dialogTableVisible = false
      this.editor && this.editor.createTable(this.tableChecker)
    },

    // listen for `open-single-file` event, it will call this method only when open a new file.
    setMarkdownToEditor ({ id, markdown, cursor }) {
      const { editor } = this
      if (editor) {
        editor.clearHistory()
        if (cursor) {
          editor.setMarkdown(markdown, cursor, true)
        } else {
          editor.setMarkdown(markdown)
        }
      }
    },

    // listen for markdown change form source mode or change tabs etc
    handleFileChange ({ id, markdown, cursor, renderCursor, history }) {
      const { editor } = this
      this.$nextTick(() => {
        if (editor) {
          if (history) {
            editor.setHistory(history)
          }
          if (typeof markdown === 'string') {
            editor.setMarkdown(markdown, cursor, renderCursor)
          } else if (cursor) {
            editor.setCursor(cursor)
          }
          if (renderCursor) {
            this.scrollToCursor(0)
          }
        }
      })
    },

    handleInsertParagraph (location) {
      const { editor } = this
      editor && editor.insertParagraph(location)
    },

    blurEditor () {
      this.editor.blur(false, true)
    },

    focusEditor () {
      this.editor.focus()
    },

    handleScreenShot () {
      if (this.editor) {
        document.execCommand('paste')
      }
    },

    // Resize PDF page to A4 format while maintaining aspect ratio
    resizePageToA4 (page, pageNumber, fitToPage = false) {
      // Check if resizing is enabled in preferences
      const resizeEnabled = this.$store.state.preferences.resizePagesToA4 !== false
      if (!resizeEnabled) {
        console.log(`Page ${pageNumber} resizing disabled in preferences, keeping original size`)
        return false
      }

      const { width, height } = page.getSize()
      console.log(`Page ${pageNumber} original size: ${width}x${height} points`)

      // A4 dimensions in points (72 DPI): 595.28 x 841.89
      const A4_WIDTH = 595.28
      const A4_HEIGHT = 841.89

      // For fit-to-page documents, resize content to fit within header/footer margins
      if (fitToPage) {
        console.log(`Page ${pageNumber} is from fit-to-page document, resizing to fit within header/footer margins`)

        // Define header/footer margins with padding to prevent overlap
        // These margins should be larger than the actual overlay content to ensure no overlap
        const HEADER_MARGIN = 80 // points from top (increased from 60)
        const FOOTER_MARGIN = 80 // points from bottom (increased from 60)
        const SIDE_MARGIN = 30 // points from sides (increased from 20)
        const CONTENT_PADDING = 10 // additional padding between content and overlay areas

        const availableWidth = A4_WIDTH - (2 * SIDE_MARGIN) - (2 * CONTENT_PADDING)
        const availableHeight = A4_HEIGHT - HEADER_MARGIN - FOOTER_MARGIN - (2 * CONTENT_PADDING)

        console.log(`Page ${pageNumber} - Available space for content: ${availableWidth}x${availableHeight} points (with ${CONTENT_PADDING}pt padding)`)
        console.log(`Page ${pageNumber} - Header margin: ${HEADER_MARGIN}pt, Footer margin: ${FOOTER_MARGIN}pt, Side margins: ${SIDE_MARGIN}pt each`)

        // Calculate scale to fit content within available space
        const scaleX = availableWidth / width
        const scaleY = availableHeight / height
        const scale = Math.min(scaleX, scaleY, 1.0) // Don't scale up, only down if needed

        if (scale < 1.0) {
          console.log(`Page ${pageNumber} - Content needs scaling by ${scale.toFixed(3)} to fit within margins`)

          // Calculate new content dimensions
          const newWidth = width * scale
          const newHeight = height * scale

          // Calculate position to center content within available space with padding
          const xOffset = SIDE_MARGIN + CONTENT_PADDING + (availableWidth - newWidth) / 2
          const yOffset = HEADER_MARGIN + CONTENT_PADDING + (availableHeight - newHeight) / 2

          console.log(`Page ${pageNumber} - New content size: ${newWidth.toFixed(2)}x${newHeight.toFixed(2)} at (${xOffset.toFixed(2)}, ${yOffset.toFixed(2)})`)

          // Note: The actual content scaling needs to be done when drawing the page content
          // This is just calculating the target dimensions for later use
          return {
            fitToPage: true,
            originalSize: { width, height },
            targetSize: { width: newWidth, height: newHeight },
            position: { x: xOffset, y: yOffset },
            scale: scale
          }
        } else {
          console.log(`Page ${pageNumber} - Content already fits within margins, centering only`)

          // Calculate position to center content within available space with padding
          const xOffset = SIDE_MARGIN + CONTENT_PADDING + (availableWidth - width) / 2
          const yOffset = HEADER_MARGIN + CONTENT_PADDING + (availableHeight - height) / 2

          return {
            fitToPage: true,
            originalSize: { width, height },
            targetSize: { width, height },
            position: { x: xOffset, y: yOffset },
            scale: 1.0
          }
        }
      }

      // For regular documents, resize to full A4
      console.log(`Page ${pageNumber} is regular document, resizing to full A4`)

      // Check if page needs resizing (with small tolerance for rounding)
      const tolerance = 5 // points
      const needsResize = Math.abs(width - A4_WIDTH) > tolerance || Math.abs(height - A4_HEIGHT) > tolerance

      if (!needsResize) {
        console.log(`Page ${pageNumber} is already A4 sized, no resizing needed`)
        return false
      }

      console.log(`Page ${pageNumber} needs resizing to A4 format`)

      try {
        // Always set page size to A4 to ensure final document is A4
        page.setSize(A4_WIDTH, A4_HEIGHT)
        console.log(`Set page ${pageNumber} size to A4: ${A4_WIDTH}x${A4_HEIGHT} points`)
        return true
      } catch (resizeError) {
        console.error(`Error resizing page ${pageNumber}:`, resizeError.message)
        console.log(`Continuing with original page size for page ${pageNumber}`)
        return false
      }
    },

    // Create an A4 page with resized content overlaid
    async createA4PageWithContent (sourcePage, pageNumber, finalDoc) {
      try {
        // A4 dimensions in points (72 DPI): 595.28 x 841.89
        const A4_WIDTH = 595.28
        const A4_HEIGHT = 841.89

        // Create a new A4 page (but don't add it to document yet)
        const a4Page = finalDoc.addPage([A4_WIDTH, A4_HEIGHT])
        console.log(`Created new A4 page ${pageNumber} with dimensions: ${A4_WIDTH}x${A4_HEIGHT} points`)

        // Get the source page dimensions after resizing
        const { width: sourceWidth, height: sourceHeight } = sourcePage.getSize()
        console.log(`Source page ${pageNumber} dimensions: ${sourceWidth}x${sourceHeight} points`)

        // Calculate position to center the content on the A4 page
        const xOffset = (A4_WIDTH - sourceWidth) / 2
        const yOffset = (A4_HEIGHT - sourceHeight) / 2

        console.log(`Centering content at offset: (${xOffset.toFixed(2)}, ${yOffset.toFixed(2)})`)

        // Embed the source page into the final document before drawing
        console.log(`Embedding source page ${pageNumber} into final document...`)
        const embeddedSourcePage = await finalDoc.embedPage(sourcePage)
        console.log(`Successfully embedded source page ${pageNumber}`)

        // Draw the embedded source page content onto the A4 page
        a4Page.drawPage(embeddedSourcePage, {
          x: xOffset,
          y: yOffset,
          width: sourceWidth,
          height: sourceHeight
        })

        console.log(`Successfully overlaid content onto A4 page ${pageNumber}`)
        console.log(`A4 page now has content from source page ${pageNumber}`)

        // Verify the page was created successfully
        const finalPageCount = finalDoc.getPageCount()
        console.log(`Final document now has ${finalPageCount} pages after adding A4 page ${pageNumber}`)

        return a4Page
      } catch (error) {
        console.error(`Error creating A4 page with content for page ${pageNumber}:`, error.message)
        // Fallback: embed and add the source page as-is
        console.log(`Falling back to embedding and adding source page ${pageNumber} as-is`)
        try {
          // A4 dimensions in points (72 DPI): 595.28 x 841.89
          const A4_WIDTH = 595.28
          const A4_HEIGHT = 841.89

          // Get source page dimensions
          const { width: sourceWidth, height: sourceHeight } = sourcePage.getSize()

          const embeddedSourcePage = await finalDoc.embedPage(sourcePage)
          const fallbackPage = finalDoc.addPage([A4_WIDTH, A4_HEIGHT])
          fallbackPage.drawPage(embeddedSourcePage, {
            x: (A4_WIDTH - sourceWidth) / 2,
            y: (A4_HEIGHT - sourceHeight) / 2,
            width: sourceWidth,
            height: sourceHeight
          })
          return fallbackPage
        } catch (fallbackError) {
          console.error(`Fallback also failed for page ${pageNumber}:`, fallbackError.message)
          // Last resort: create an empty A4 page
          const A4_WIDTH = 595.28
          const A4_HEIGHT = 841.89
          return finalDoc.addPage([A4_WIDTH, A4_HEIGHT])
        }
      }
    },

    // Create a scaled A4 page for fit-to-page documents
    async createScaledA4Page (sourcePage, scalingInfo, finalDoc) {
      try {
        // A4 dimensions in points (72 DPI): 595.28 x 841.89
        const A4_WIDTH = 595.28
        const A4_HEIGHT = 841.89

        // Create a new A4 page (but don't add it to document yet - let the main loop handle adding)
        const a4Page = finalDoc.addPage([A4_WIDTH, A4_HEIGHT])
        console.log(`Created new scaled A4 page with dimensions: ${A4_WIDTH}x${A4_HEIGHT} points`)

        // Get scaling information
        const { targetSize, position, scale } = scalingInfo
        console.log(`Scaling content by ${scale.toFixed(3)} to ${targetSize.width.toFixed(2)}x${targetSize.height.toFixed(2)} at (${position.x.toFixed(2)}, ${position.y.toFixed(2)})`)

        // Embed the source page into the final document
        const embeddedSourcePage = await finalDoc.embedPage(sourcePage)
        console.log('Successfully embedded source page for scaling')

        // Draw the embedded source page content onto the A4 page with scaling
        a4Page.drawPage(embeddedSourcePage, {
          x: position.x,
          y: position.y,
          width: targetSize.width,
          height: targetSize.height
        })

        console.log('Successfully drew scaled content onto A4 page')
        return a4Page
      } catch (error) {
        console.error('Error creating scaled A4 page:', error.message)
        // Fallback: create regular A4 page
        const A4_WIDTH = 595.28
        const A4_HEIGHT = 841.89

        try {
          const embeddedSourcePage = await finalDoc.embedPage(sourcePage)
          const fallbackPage = finalDoc.addPage([A4_WIDTH, A4_HEIGHT])
          fallbackPage.drawPage(embeddedSourcePage, {
            x: 0,
            y: 0,
            width: A4_WIDTH,
            height: A4_HEIGHT
          })
          return fallbackPage
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError.message)
          // Last resort: create an empty A4 page
          return finalDoc.addPage([A4_WIDTH, A4_HEIGHT])
        }
      }
    },

    // Apply template overlays to pages using docxtemplater
    async applyTemplateOverlays (finalDoc, pages, mergeList, startPageNumber, totalPages, tocPageCount = 1, originalSizes = [], baseDir, fitToPage = false) {
      const fs = require('fs')
      const path = require('path')
      const os = require('os')
      const { exec } = require('child_process')
      const util = require('util')
      const execAsync = util.promisify(exec)

      try {
        const templateDir = this.$store.state.preferences.templateDirectory
        console.log(`Applying template overlays from directory: ${templateDir}`)

        // Look for portrait and landscape templates
        const portraitTemplatePath = path.join(templateDir, 'portrait.docx')
        const landscapeTemplatePath = path.join(templateDir, 'landscape.docx')

        if (!fs.existsSync(portraitTemplatePath) && !fs.existsSync(landscapeTemplatePath)) {
          console.log('No portrait.docx or landscape.docx templates found, skipping template overlays')
          return
        }

        // Check if conversion tools are configured
        const tools = this.$store.state.preferences.conversionTools || []
        if (tools.length === 0) {
          console.warn('No conversion tools configured. Template overlays require LibreOffice or another DOCX to PDF converter.')
          console.warn('Please configure conversion tools in MarkText preferences to use template overlays.')
          return
        }

        // Create temporary directory for processed templates
        const tempDir = path.join(os.tmpdir(), 'marktext-templates')
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true })
        }

        // Process each page
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i]
          const pageNumber = startPageNumber + i // Page numbering starts from startPageNumber
          const pageSize = page.getSize()

          // Determine if page is portrait or landscape
          const isLandscape = pageSize.width > pageSize.height
          const templatePath = isLandscape ? landscapeTemplatePath : portraitTemplatePath

          if (!fs.existsSync(templatePath)) {
            console.log(`No template for ${isLandscape ? 'landscape' : 'portrait'} orientation, skipping page ${pageNumber}`)
            continue
          }

          console.log(`Processing page ${pageNumber} (${isLandscape ? 'landscape' : 'portrait'}) - fitToPage: ${fitToPage}`)

          // Get page title from TOC
          const pageTitle = await this.getPageTitleFromToc(mergeList, pageNumber, tocPageCount)

          // Process template with docxtemplater
          const displayPageNumber = pageNumber - tocPageCount + 1 // Convert absolute position to display page number
          const processedDocxPath = await this.processDocxTemplate(templatePath, pageTitle, displayPageNumber, totalPages - tocPageCount, tempDir)

          // Convert to PDF
          const processedPdfPath = await this.convertDocxToPdf(processedDocxPath, tempDir, execAsync)

          // Apply as overlay with fit-to-page consideration
          await this.applyPdfOverlay(finalDoc, page, processedPdfPath, pageNumber, originalSizes[i], fitToPage)

          // Clean up temporary files
          try {
            fs.unlinkSync(processedDocxPath)
            fs.unlinkSync(processedPdfPath)
          } catch (cleanupError) {
            console.warn('Failed to clean up temporary files:', cleanupError.message)
          }
        }

        console.log('Successfully applied template overlays to all pages')
      } catch (error) {
        console.error('Error applying template overlays:', error.message)
        console.log('Continuing without template overlays')
      }
    },

    // Get page title from TOC based on page number (handles multi-page ToC)
    async getPageTitleFromToc (mergeList, pageNumber, tocPageCount = 1) {
      // Adjust page number to account for ToC pages
      const adjustedPageNumber = pageNumber - tocPageCount

      if (adjustedPageNumber < 0) {
        return 'Table of Contents'
      }

      let currentPage = 0 // Content sections start from page 0

      for (const section of mergeList) {
        const sectionTitle = section.title || 'Untitled Section'

        // Count pages in this section
        let sectionPageCount = 0
        for (const pdf of section.pdfs) {
          if (require('fs').existsSync(pdf.path)) {
            const contentBytes = require('fs').readFileSync(pdf.path)
            const doc = await require('pdf-lib').PDFDocument.load(contentBytes)
            sectionPageCount += doc.getPageCount()
          }
        }

        // Check if the target page is in this section
        if (adjustedPageNumber >= currentPage && adjustedPageNumber < currentPage + sectionPageCount) {
          return sectionTitle
        }

        currentPage += sectionPageCount
      }

      return 'Document'
    },

    // Process DOCX template with docxtemplater
    async processDocxTemplate (templatePath, pageTitle, pageNumber, totalPages, tempDir) {
      const fs = require('fs')
      const path = require('path')
      const PizZip = require('pizzip')
      const Docxtemplater = require('docxtemplater')

      try {
        // Read template
        const content = fs.readFileSync(templatePath)
        const zip = new PizZip(content)
        const doc = new Docxtemplater(zip)

        // Set template variables (use single braces in DOCX: {{page_title}}, {{page_number}}, {{page_total}})
        doc.setData({
          page_title: pageTitle,
          page_number: pageNumber,
          page_total: totalPages
        })

        // Render document
        doc.render()

        // Generate processed document
        const processedContent = doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE'
        })

        // Save to temporary file
        const outputPath = path.join(tempDir, `template_${pageNumber}_${Date.now()}.docx`)
        fs.writeFileSync(outputPath, processedContent)

        return outputPath
      } catch (error) {
        console.error('Error processing DOCX template:', error.message)
        throw error
      }
    },

    // Convert DOCX to PDF using LibreOffice
    async convertDocxToPdf (docxPath, outDir, execAsync) {
      const fs = require('fs')
      const path = require('path')

      try {
        // Find conversion tool
        const tools = this.$store.state.preferences.conversionTools || []
        const conversionTool = this.findConversionTool(docxPath, tools)

        if (!conversionTool) {
          const errorMsg = 'No suitable conversion tool found for DOCX to PDF conversion. ' +
            'Please configure LibreOffice or another DOCX to PDF conversion tool in MarkText preferences.'
          console.error(errorMsg)
          console.error('Available conversion tools:', tools.map(t => `${t.name} (${t.extensions.join(', ')})`).join(', '))
          console.error('Looking for tool that handles .docx files')
          throw new Error(errorMsg)
        }

        console.log(`Using conversion tool: ${conversionTool.name}`)
        console.log(`Tool path: ${conversionTool.path}`)
        console.log(`Tool arguments template: ${conversionTool.arguments}`)
        console.log(`Tool enabled: ${conversionTool.enabled}`)

        const outputPath = docxPath.replace('.docx', '.pdf')
        const outputDir = path.dirname(outputPath)
        const inputDir = path.dirname(docxPath)

        // Build command with all placeholders
        const normalizedDocxPath = path.resolve(docxPath).replace(/\\/g, '/')
        const normalizedOutputPath = path.resolve(outputPath).replace(/\\/g, '/')
        const normalizedOutputDir = path.resolve(outputDir).replace(/\\/g, '/')
        const normalizedInputDir = path.resolve(inputDir).replace(/\\/g, '/')
        const normalizedToolPath = path.resolve(conversionTool.path).replace(/\\/g, '/')

        let command = conversionTool.arguments
          .replace('%input', `"${normalizedDocxPath}"`)
          .replace('%output', `"${normalizedOutputPath}"`)
          .replace('%inputFile', `"${normalizedDocxPath}"`)
          .replace('%outputFile', `"${normalizedOutputPath}"`)
          .replace('%inputDir', `"${normalizedInputDir}"`)
          .replace('%outputDir', `"${normalizedOutputDir}"`)
          .replace('%outdir', `"${outDir}"`)

        // If the command still contains unreplaced placeholders, try common LibreOffice patterns
        if (command.includes('%')) {
          console.warn('Command still contains unreplaced placeholders, trying common LibreOffice pattern')
          command = `--headless --convert-to pdf --outdir "${normalizedOutputDir}" "${normalizedDocxPath}"`
        }

        const fullCommand = `"${normalizedToolPath}" ${command}`

        console.log(`Converting template: ${fullCommand}`)
        console.log(`Input file: ${docxPath}`)
        console.log(`Output file: ${outputPath}`)
        console.log(`Output directory: ${outputDir}`)

        await execAsync(fullCommand, { maxBuffer: 1024 * 1024 })

        if (!fs.existsSync(outputPath)) {
          console.error(`PDF conversion failed - output file not found: ${outputPath}`)

          // Try to find the PDF file in the output directory with a different name
          const files = fs.readdirSync(outputDir)
          const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'))
          console.log(`PDF files in output directory: ${pdfFiles.join(', ')}`)

          // Look for a file with similar name
          const baseName = path.basename(docxPath, '.docx').toLowerCase()
          const matchingFiles = pdfFiles.filter(f =>
            f.toLowerCase().includes(baseName) ||
            baseName.includes(f.toLowerCase().replace('.pdf', ''))
          )

          if (matchingFiles.length > 0) {
            const actualOutputPath = path.join(outputDir, matchingFiles[0])
            console.log(`Found matching PDF file: ${actualOutputPath}`)
            return actualOutputPath
          }

          throw new Error(`PDF conversion failed - output file not found: ${outputPath}`)
        }

        return outputPath
      } catch (error) {
        console.error('Error converting DOCX to PDF:', error.message)
        throw error
      }
    },

    // Apply PDF overlay to page
    async applyPdfOverlay (finalDoc, page, overlayPdfPath, pageNumber, originalSize = null, fitToPage = false) {
      const fs = require('fs')

      try {
        // Load overlay PDF
        const overlayBytes = fs.readFileSync(overlayPdfPath)
        const overlayDoc = await require('pdf-lib').PDFDocument.load(overlayBytes)

        if (overlayDoc.getPageCount() === 0) {
          console.log(`Overlay PDF has no pages for page ${pageNumber}, skipping`)
          return
        }

        // Get overlay page
        const overlayPage = overlayDoc.getPage(0)
        const overlaySize = overlayPage.getSize()
        const currentPageSize = page.getSize()

        console.log(`Page ${pageNumber} - Current page size: ${currentPageSize.width.toFixed(2)}x${currentPageSize.height.toFixed(2)}`)
        if (originalSize) {
          console.log(`Page ${pageNumber} - Original page size: ${originalSize.width.toFixed(2)}x${originalSize.height.toFixed(2)}`)
        }
        console.log(`Page ${pageNumber} - Overlay size: ${overlaySize.width.toFixed(2)}x${overlaySize.height.toFixed(2)}`)
        console.log(`Page ${pageNumber} - Fit to page: ${fitToPage}`)

        // A4 dimensions in points (72 DPI): 595.28 x 841.89
        const A4_WIDTH = 595.28
        const A4_HEIGHT = 841.89

        console.log(`Page ${pageNumber} - A4 dimensions: ${A4_WIDTH}x${A4_HEIGHT}`)

        // Define header/footer margins for fit-to-page documents
        // These should match the margins used in resizePageToA4 for consistency
        const HEADER_MARGIN = 80 // points from top (increased from 60)
        const FOOTER_MARGIN = 80 // points from bottom (increased from 60)
        const SIDE_MARGIN = 30 // points from sides (increased from 20)
        const CONTENT_PADDING = 10 // additional padding between content and overlay areas

        const availableHeight = A4_HEIGHT - HEADER_MARGIN - FOOTER_MARGIN - (2 * CONTENT_PADDING)
        const availableWidth = A4_WIDTH - (2 * SIDE_MARGIN) - (2 * CONTENT_PADDING)

        // Check if overlay is already A4 size (within tolerance)
        const tolerance = 10 // points - increased tolerance for better detection
        const widthDiff = Math.abs(overlaySize.width - A4_WIDTH)
        const heightDiff = Math.abs(overlaySize.height - A4_HEIGHT)
        const isOverlayA4 = widthDiff <= tolerance && heightDiff <= tolerance

        console.log(`Page ${pageNumber} - Size differences: width=${widthDiff.toFixed(2)}, height=${heightDiff.toFixed(2)}`)
        console.log(`Page ${pageNumber} - Is overlay A4 size: ${isOverlayA4}`)

        let scale, scaledWidth, scaledHeight, x, y

        if (isOverlayA4) {
          // Overlay is A4 size - apply at full A4 size since final document is A4
          console.log(`Page ${pageNumber} - Overlay is A4 size, applying at full A4 size`)
          scale = 1.0
          scaledWidth = A4_WIDTH
          scaledHeight = A4_HEIGHT
          x = 0
          y = 0
        } else {
          // Overlay is not A4 size - scale it to fit A4
          console.log(`Page ${pageNumber} - Overlay is not A4 size, scaling to A4`)
          const scaleX = A4_WIDTH / overlaySize.width
          const scaleY = A4_HEIGHT / overlaySize.height
          scale = Math.min(scaleX, scaleY)
          scaledWidth = overlaySize.width * scale
          scaledHeight = overlaySize.height * scale
          x = (A4_WIDTH - scaledWidth) / 2
          y = (A4_HEIGHT - scaledHeight) / 2
        }

        console.log(`Page ${pageNumber} - Scaling overlay by ${scale.toFixed(3)} to ${scaledWidth.toFixed(2)}x${scaledHeight.toFixed(2)}`)
        console.log(`Page ${pageNumber} - Positioning overlay at (${x.toFixed(2)}, ${y.toFixed(2)})`)

        // Embed and draw overlay
        const embeddedOverlay = await finalDoc.embedPage(overlayPage)
        page.drawPage(embeddedOverlay, {
          x: x,
          y: y,
          width: scaledWidth,
          height: scaledHeight
        })

        console.log(`Applied overlay to page ${pageNumber}`)

        // For fit-to-page documents, we need to scale the existing content to fit within header/footer margins
        if (fitToPage && originalSize) {
          console.log(`Page ${pageNumber} - Applying fit-to-page scaling for content`)

          // Get the current content that was already drawn on this page
          // We need to scale it to fit within the available space (excluding header/footer)
          const contentScaleX = availableWidth / originalSize.width
          const contentScaleY = availableHeight / originalSize.height
          const contentScale = Math.min(contentScaleX, contentScaleY, 1.0) // Don't scale up, only down

          if (contentScale < 1.0) {
            console.log(`Page ${pageNumber} - Content needs scaling by ${contentScale.toFixed(3)} to fit within margins`)

            // Calculate new content dimensions and position with padding
            const newContentWidth = originalSize.width * contentScale
            const newContentHeight = originalSize.height * contentScale
            const contentX = SIDE_MARGIN + CONTENT_PADDING + (availableWidth - newContentWidth) / 2
            const contentY = HEADER_MARGIN + CONTENT_PADDING + (availableHeight - newContentHeight) / 2

            console.log(`Page ${pageNumber} - New content dimensions: ${newContentWidth.toFixed(2)}x${newContentHeight.toFixed(2)} at (${contentX.toFixed(2)}, ${contentY.toFixed(2)})`)

            // Note: In a real implementation, we would need to redraw the content at the new scale and position
            // However, since the content is already embedded in the PDF, we would need to modify the page content
            // This is a complex operation that would require recreating the page with scaled content
            // For now, we'll log the scaling information for future implementation
          } else {
            console.log(`Page ${pageNumber} - Content already fits within margins, no scaling needed`)
          }
        }
      } catch (error) {
        console.error(`Error applying PDF overlay to page ${pageNumber}:`, error.message)
      }
    }
  },
  beforeDestroy () {
    bus.$off('file-loaded', this.setMarkdownToEditor)
    bus.$off('invalidate-image-cache', this.handleInvalidateImageCache)
    bus.$off('undo', this.handleUndo)
    bus.$off('redo', this.handleRedo)
    bus.$off('selectAll', this.handleSelectAll)
    bus.$off('export', this.handleExport)
    bus.$off('print-service-clearup', this.handlePrintServiceClearup)
    bus.$off('paragraph', this.handleEditParagraph)
    bus.$off('format', this.handleInlineFormat)
    bus.$off('insert-filepath', this.handleInsertFilepath)
    bus.$off('searchValue', this.handleSearch)
    bus.$off('replaceValue', this.handReplace)
    bus.$off('find-action', this.handleFindAction)
    bus.$off('insert-image', this.insertImage)
    bus.$off('image-uploaded', this.handleUploadedImage)
    bus.$off('file-changed', this.handleFileChange)
    bus.$off('editor-blur', this.blurEditor)
    bus.$off('editor-focus', this.focusEditor)
    bus.$off('copyAsMarkdown', this.handleCopyPaste)
    bus.$off('copyAsHtml', this.handleCopyPaste)
    bus.$off('pasteAsPlainText', this.handleCopyPaste)
    bus.$off('pasteFilePath', this.handleCopyPaste)
    bus.$off('duplicate', this.handleParagraph)
    bus.$off('createParagraph', this.handleParagraph)
    bus.$off('deleteParagraph', this.handleParagraph)
    bus.$off('insertParagraph', this.handleInsertParagraph)
    bus.$off('scroll-to-header', this.scrollToHeader)
    bus.$off('screenshot-captured', this.handleScreenShot)
    bus.$off('switch-spellchecker-language', this.switchSpellcheckLanguage)
    bus.$off('open-command-spellchecker-switch-language', this.openSpellcheckerLanguageCommand)
    bus.$off('replace-misspelling', this.replaceMisspelling)
    bus.$off('merge-documents', this.handleDocumentMerge)

    document.removeEventListener('keyup', this.keyup)

    this.editor.destroy()
    this.editor = null
  }
}
</script>

<style>
  .editor-wrapper {
    height: 100%;
    position: relative;
    flex: 1;
    color: var(--editorColor);
    & .ag-dialog-table {
      & .el-button {
        font-size: 13px;
        width: 70px;
      }
    }
  }

  .editor-wrapper.source {
    position: absolute;
    z-index: -1;
    top: 0;
    left: 0;
    overflow: hidden;
  }

  .editor-component {
    height: 100%;
    overflow: auto;
    box-sizing: border-box;
    cursor: default;
  }

  .typewriter .editor-component {
    padding-top: calc(50vh - 136px);
    padding-bottom: calc(50vh - 54px);
  }

  .image-viewer {
    position: fixed;
    backdrop-filter: blur(5px);
    top: 0;
    right: 0;
    left: 0;
    bottom: 0;
    background: rgba(0, 0, 0, .8);
    z-index: 11;
    & .icon-close {
      z-index: 1000;
      width: 30px;
      height: 30px;
      position: absolute;
      top: 50px;
      left: 50px;
      display: block;
      & svg {
        fill: #efefef;
        width: 100%;
        height: 100%;
      }
    }
  }

  .iv-container {
    width: 100%;
    height: 100%;
  }

  .iv-snap-view {
    opacity: 1;
    bottom: 20px;
    right: 20px;
    top: auto;
    left: auto;
  }
</style>
