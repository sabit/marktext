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
import fs from 'fs'
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
        editor.setOptions({ spellcheckEnabled: value })

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
        this.editor.setOptions({ spellcheckEnabled: !value })
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
        console.log('🔔 Bus event merge-documents received, calling handleDocumentMerge')
        this.handleDocumentMerge()
      })

      this.editor.on('change', changes => {
        // WORKAROUND: "id: 'muya'"
        this.$store.dispatch('LISTEN_FOR_CONTENT_CHANGE', Object.assign(changes, { id: 'muya' }))
      })

      this.editor.on('format-click', ({ event, formatType, data }) => {
        const ctrlOrMeta = (isOsx && event.metaKey) || (!isOsx && event.ctrlKey)
        if (formatType === 'link' && ctrlOrMeta) {
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
      console.log('🔄 handleDocumentMerge called')

      // Check if document is saved
      const { currentFile } = this
      if (!currentFile.isSaved) {
        throw new Error('Please save the document before merging.')
      }

      // Emit merge started event
      bus.$emit('merge-started')

      // Put document into readonly mode
      this.editor.setOptions({ readOnly: true })

      try {
        // Get markdown content
        const markdown = this.editor.getMarkdown()

        // Parse ordered lists and extract file links
        const sections = this.parseDocumentSections(markdown)

        if (sections.length === 0) {
          throw new Error('No ordered lists with file links found in the document. Make sure your document contains ordered lists with file:// links.')
        }

        // Debug output as per requirements
        console.log('Parsed sections:', sections)

        // Convert and merge documents
        const mergedPdfPath = await this.convertAndMergeDocuments(sections, currentFile.pathname)

        // Show success message
        console.log('✅ Merge completed successfully, showing notification')
        notice.notify({
          title: 'Document merge completed',
          message: `Merged PDF saved to: ${mergedPdfPath}`,
          showConfirm: true,
          time: 0 // Don't auto-hide success messages
        })

        // Open the merged PDF
        // shell.openPath(mergedPdfPath)
      } catch (error) {
        console.error('❌ Document merge failed:', error)
        notice.notify({
          title: 'Document merge failed',
          type: 'error',
          message: error.message || 'An unexpected error occurred during document merge.',
          time: 0 // Don't auto-hide error messages
        })
      } finally {
        // Restore readonly mode
        this.editor.setOptions({ readOnly: false })

        // Emit merge completed event
        bus.$emit('merge-completed')
      }
    },

    parseDocumentSections (markdown) {
      const lines = markdown.split('\n')
      const sections = []
      let currentSection = null
      let inOrderedList = false

      for (let i = 0; i < lines.length; i++) {
        const originalLine = lines[i]
        const line = originalLine.trim()

        console.log(`Processing line ${i + 1}: "${originalLine}" (trimmed: "${line}")`)

        // Check for ordered list items FIRST
        const orderedListMatch = line.match(/^(\d+)\.\s+(.+)$/)
        if (orderedListMatch) {
          console.log(`Found ordered list item: ${orderedListMatch[0]}`)
          const [, , content] = orderedListMatch
          inOrderedList = true

          // Check if this is a new section (heading)
          if (content.startsWith('#')) {
            if (currentSection) {
              sections.push(currentSection)
            }
            currentSection = {
              title: content.replace(/^#+\s*/, ''),
              docs: []
            }
          } else {
            // Check for file links
            const fileLinkMatch = content.match(/\[([^\]]+)\]\((file:\/\/[^)]+)\)/)
            if (fileLinkMatch) {
              if (!currentSection) {
                currentSection = {
                  title: `Section ${sections.length + 1}`,
                  docs: []
                }
              }
              currentSection.docs.push(fileLinkMatch[2])
            } else {
              // Ordered list item without file link - show error as per requirements
              throw new Error('Some sections have missing document')
            }
          }
        } else {
          // Only check for file links outside ordered lists if we're not in an ordered list
          // and the line is not empty and not a heading
          if (!inOrderedList && line.trim() !== '' && !line.startsWith('#')) {
            const fileLinkMatch = line.match(/\[([^\]]+)\]\((file:\/\/[^)]+)\)/)
            if (fileLinkMatch) {
              throw new Error(`File links must be inside ordered list items. Found link outside ordered list: "${line}"`)
            }
          }

          // Check for end of ordered list (empty line)
          if (line.trim() === '' && inOrderedList) {
            inOrderedList = false
          }
        }
      }

      // Add the last section
      if (currentSection) {
        sections.push(currentSection)
      }

      return sections
    },

    async convertAndMergeDocuments (sections, basePath) {
      const { PDFDocument } = require('pdf-lib')
      const path = require('path')
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)

      const baseDir = path.dirname(basePath)
      const outputDir = baseDir
      const mergedPdfPath = path.join(outputDir, 'merged_document.pdf')

      // Get conversion tools from preferences
      const conversionTools = this.$store.state.preferences.conversionTools || []

      // Process each section
      const mergeList = []

      for (const section of sections) {
        const sectionPdfs = []

        for (const docPath of section.docs) {
          // Convert file:// URL to file system path
          const filePath = this.convertFileUrlToPath(docPath)
          let pdfPath = filePath

          console.log(`Processing file: ${filePath}`)

          // If not already a PDF, convert it
          if (!filePath.toLowerCase().endsWith('.pdf')) {
            console.log(`File is not PDF, attempting conversion: ${filePath}`)
            const tool = this.findConversionTool(filePath, conversionTools)

            if (!tool) {
              console.error(`No conversion tool found for file: ${filePath}`)
              console.log('Available conversion tools:', conversionTools)
              throw new Error(`No conversion tool found for file: ${filePath}`)
            }

            console.log(`Found conversion tool: ${tool.name} for ${filePath}`)
            pdfPath = await this.convertToPdf(filePath, tool, outputDir, execAsync)
            console.log(`Converted to PDF: ${pdfPath}`)
          } else {
            console.log(`File is already PDF: ${filePath}`)
            // Copy PDF if it's not in the output directory
            const fileName = path.basename(filePath, '.pdf') + '.pdf'
            const destPath = path.join(outputDir, fileName)

            // Check if source file exists
            if (!fs.existsSync(filePath)) {
              throw new Error(`Source PDF file does not exist: ${filePath}`)
            }

            if (filePath !== destPath) {
              // Check if destination is newer
              const srcStat = fs.statSync(filePath)
              const destExists = fs.existsSync(destPath)

              if (!destExists || srcStat.mtime > fs.statSync(destPath).mtime) {
                fs.copyFileSync(filePath, destPath)
              }
            }
            pdfPath = destPath
          }

          sectionPdfs.push(pdfPath)
        }

        mergeList.push({
          title: section.title,
          pdfs: sectionPdfs
        })
      }

      // Debug output as per requirements
      console.log('Merge list:', mergeList)

      // Merge all PDFs
      const finalDoc = await PDFDocument.create()

      for (const section of mergeList) {
        for (const pdfPath of section.pdfs) {
          // Check if PDF file exists before trying to read it
          if (!fs.existsSync(pdfPath)) {
            throw new Error(`PDF file does not exist for merging: ${pdfPath}`)
          }

          const pdfBytes = fs.readFileSync(pdfPath)
          const pdfDoc = await PDFDocument.load(pdfBytes)
          const pages = await finalDoc.copyPages(pdfDoc, pdfDoc.getPageIndices())

          pages.forEach(page => finalDoc.addPage(page))
        }
      }

      const mergedBytes = await finalDoc.save()
      fs.writeFileSync(mergedPdfPath, mergedBytes)

      return mergedPdfPath
    },

    convertFileUrlToPath (fileUrl) {
      // Handle file:// URLs and convert to file system paths
      if (fileUrl.startsWith('file://')) {
        // Remove the file:// protocol
        let filePath = fileUrl.substring(7) // Remove 'file://'

        // Handle Windows drive letters (e.g., /C:/path -> C:/path)
        if (filePath.startsWith('/') && filePath.length > 2 && filePath[2] === ':') {
          filePath = filePath.substring(1)
        }

        // Decode URL-encoded characters
        filePath = decodeURIComponent(filePath)

        return filePath
      }

      // If it's already a regular path, return as-is
      return fileUrl
    },

    findConversionTool (filePath, tools) {
      // Convert file URL to path if needed
      const localPath = this.convertFileUrlToPath(filePath)
      const ext = path.extname(localPath).toLowerCase().slice(1)

      console.log(`Looking for conversion tool for extension: '${ext}'`)
      console.log(`Available tools: ${tools}`)

      for (const tool of tools) {
        console.log(`Checking tool: ${tool.name}, enabled: ${tool.enabled}, extensions: ${tool.extensions}`)
        if (tool.enabled && tool.extensions.includes(ext)) {
          console.log(`Found matching tool: ${tool.name}`)
          return tool
        }
      }

      console.log(`No conversion tool found for extension: ${ext}`)
      return null
    },

    async convertToPdf (inputPath, tool, outputDir, execAsync) {
      // Convert file URL to path if needed
      const filePath = this.convertFileUrlToPath(inputPath)
      const fileName = path.basename(filePath, path.extname(filePath))
      const outputPath = path.join(outputDir, `${fileName}.pdf`)

      // Normalize paths for Windows
      const normalizedFilePath = path.resolve(filePath)
      const normalizedOutputDir = path.resolve(outputDir)
      const normalizedInputDir = path.dirname(normalizedFilePath)

      // Normalize tool path for command line
      const normalizedToolPath = path.resolve(tool.path).replace(/\\/g, '/')

      console.log(`Converting ${filePath} to ${outputPath}`)
      console.log(`Using tool: ${tool.name}`)
      console.log(`Original tool path: ${tool.path}`)
      console.log(`Normalized tool path: ${normalizedToolPath}`)
      console.log(`Tool arguments template: ${tool.arguments}`)
      console.log(`Input file exists: ${fs.existsSync(filePath)}`)
      console.log(`Output directory exists: ${fs.existsSync(outputDir)}`)

      // Check if output file exists and is newer than input
      if (fs.existsSync(outputPath)) {
        const inputStat = fs.statSync(filePath)
        const outputStat = fs.statSync(outputPath)

        if (outputStat.mtime >= inputStat.mtime) {
          console.log(`Output file ${outputPath} is up to date, skipping conversion`)
          return outputPath // Skip conversion
        } else {
          console.log(`Output file ${outputPath} is older than input, will overwrite`)
          // Delete the stale file so we can detect conversion failures
          fs.unlinkSync(outputPath)
          console.log(`Deleted stale output file: ${outputPath}`)
        }
      }

      console.log(`Normalized input path: ${normalizedFilePath}`)
      console.log(`Normalized output dir: ${normalizedOutputDir}`)
      console.log(`Normalized input dir: ${normalizedInputDir}`)
      console.log(`Normalized tool path: ${normalizedToolPath}`)

      // Build command with normalized paths
      let command = tool.arguments
        .replace('%input', `"${normalizedFilePath}"`)
        .replace('%output', `"${outputPath}"`)
        .replace('%inputFile', `"${normalizedFilePath}"`)
        .replace('%outputDir', `"${normalizedOutputDir}"`)
        .replace('%inputDir', `"${normalizedInputDir}"`)
        .replace('%outputFile', `"${outputPath}"`)

      const fullCommand = `"${normalizedToolPath}" ${command}`

      console.log(`Command template after replacement: ${command}`)
      console.log(`Final command: ${fullCommand}`)

      try {
        console.log('Executing conversion command...')
        const result = await execAsync(fullCommand, { maxBuffer: 1024 * 1024 })
        console.log('Command execution result:', result)

        // Check if output file was actually created
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath)
          console.log(`✅ Output file created successfully: ${outputPath} (${stats.size} bytes)`)
          return outputPath
        } else {
          console.error('❌ Command executed but expected output file was not found')
          console.log('Expected output path:', outputPath)

          // Check what files were actually created in the output directory
          const outputDir = path.dirname(outputPath)
          console.log('Checking output directory:', outputDir)

          if (fs.existsSync(outputDir)) {
            const files = fs.readdirSync(outputDir)
            const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'))
            console.log('PDF files found in output directory:', pdfFiles)

            // Look for a file with similar name
            const expectedBaseName = path.basename(outputPath, '.pdf').toLowerCase()
            const matchingFiles = pdfFiles.filter(f =>
              f.toLowerCase().includes(expectedBaseName) ||
              expectedBaseName.includes(f.toLowerCase().replace('.pdf', ''))
            )

            if (matchingFiles.length > 0) {
              const actualOutputPath = path.join(outputDir, matchingFiles[0])
              console.log(`✅ Found matching PDF file: ${actualOutputPath}`)
              return actualOutputPath
            }
          } else {
            console.error('Output directory does not exist:', outputDir)
          }

          throw new Error(`LibreOffice completed but expected output file not found: ${outputPath}`)
        }
      } catch (error) {
        console.error('❌ Conversion command failed:', error.message)
        console.error('Failed command:', fullCommand)
        console.error('Tool path used:', normalizedToolPath)

        // Even if command failed, check if a PDF was created
        if (fs.existsSync(outputPath)) {
          console.log('⚠️  Output file exists despite command failure - partial success?')
          return outputPath
        }

        throw new Error(`Conversion failed for ${filePath}: ${error.message}`)
      }
    },

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
