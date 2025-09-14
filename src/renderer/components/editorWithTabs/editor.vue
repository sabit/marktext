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
        throw new Error('Please save the document before merging.')
      }

      // Emit merge started event
      bus.$emit('merge-started')

      // Put document into readonly mode
      console.log('Setting editor to readonly mode')
      if (this.editor) {
        this.editor.setOptions({ readOnly: true })
        console.log('Editor set to readonly mode successfully')
      } else {
        console.warn('Editor is null, cannot set readonly mode')
      }

      try {
        // Get markdown content
        if (!this.editor) {
          throw new Error('Editor is not available')
        }
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
        notice.notify({
          title: 'Document merge completed',
          message: `Merged PDF saved to: ${mergedPdfPath}`,
          showConfirm: true,
          time: 0 // Don't auto-hide success messages
        })

        // Open the merged PDF
        // shell.openPath(mergedPdfPath)
      } catch (error) {
        console.error('Document merge failed:', error)
        notice.notify({
          title: 'Document merge failed',
          type: 'error',
          message: error.message || 'An unexpected error occurred during document merge.',
          time: 0 // Don't auto-hide error messages
        })
      } finally {
        // Restore readonly mode
        console.log('Restoring editor readonly mode')
        if (this.editor) {
          this.editor.setOptions({ readOnly: false })
          console.log('Editor readonly mode restored successfully')
        } else {
          console.warn('Editor is null, cannot restore readonly mode')
        }

        // Emit merge completed event
        bus.$emit('merge-completed')
      }
    },

    parseDocumentSections (markdown) {
      const lines = markdown.split('\n')
      const sections = []
      let currentSection = null
      let inOrderedList = false
      let levelCounters = [0] // Counters for each nesting level

      for (let i = 0; i < lines.length; i++) {
        const originalLine = lines[i]
        const trimmedLine = originalLine.trim()

        console.log(`Processing line ${i + 1}: "${originalLine}" (trimmed: "${trimmedLine}")`)

        // Check for ordered list items with nesting support - use original line to preserve indentation
        const orderedListMatch = originalLine.match(/^(\s*)(.+)$/)
        if (orderedListMatch && trimmedLine.match(/^\d+(?:\.\d+)*\.\s+.+/)) {
          console.log(`Found ordered list item: ${orderedListMatch[0]}`)
          const [, indent, content] = orderedListMatch
          inOrderedList = true

          // Calculate nesting level based on indentation (3 spaces per level for MarkText)
          const indentLength = indent.length
          let nestingLevel = 0

          if (indentLength >= 3) {
            nestingLevel = Math.floor(indentLength / 3)
          }

          console.log(`Nesting level: ${nestingLevel}, indent length: ${indentLength}`)

          // Ensure we have counters for all levels up to the current nesting level
          while (levelCounters.length <= nestingLevel) {
            levelCounters.push(0)
          }

          // Increment the counter for this level
          levelCounters[nestingLevel]++

          // Reset counters for deeper levels
          for (let j = nestingLevel + 1; j < levelCounters.length; j++) {
            levelCounters[j] = 0
          }

          // Generate hierarchical numbering from counters
          const nestedNumber = levelCounters.slice(0, nestingLevel + 1).join('.')
          console.log(`Generated nested number: ${nestedNumber} (counters: ${levelCounters.join(',')})`)

          // Extract text content without the original numbering
          let cleanContent = content

          // Remove the original numbering from the content (e.g., "1.1 Background" -> "Background")
          cleanContent = cleanContent.replace(/^\d+(?:\.\d+)*\.\s+/, '').trim()

          // Remove file links from content
          cleanContent = cleanContent.replace(/\[([^\]]+)\]\((file:\/\/[^)]+)\)/g, '').trim()

          // Remove trailing whitespace and any remaining brackets
          cleanContent = cleanContent.replace(/\s*\[.*\]\(.*\)\s*$/, '').trim()

          console.log(`Clean content: "${cleanContent}"`)

          // Check if this is a new section (heading or content)
          if (cleanContent.startsWith('#')) {
            if (currentSection) {
              sections.push(currentSection)
            }
            currentSection = {
              title: cleanContent.replace(/^#+\s*/, ''),
              docs: []
            }
          } else if (cleanContent) {
            // This is a regular bullet item - create section with nested numbering
            if (currentSection) {
              sections.push(currentSection)
            }
            currentSection = {
              title: `${nestedNumber} ${cleanContent}`,
              docs: []
            }

            // Check for file links in the original content
            const fileLinkMatch = content.match(/\[([^\]]+)\]\((file:\/\/[^)]+)\)/)
            if (fileLinkMatch) {
              currentSection.docs.push(fileLinkMatch[2])
            } else {
              // Ordered list item without file link - show error as per requirements
              throw new Error(`Section "${nestedNumber} ${cleanContent}" has missing document link`)
            }
          }
        } else {
          // Only check for file links outside ordered lists if we're not in an ordered list
          // and the line is not empty and not a heading
          if (!inOrderedList && trimmedLine !== '' && !trimmedLine.startsWith('#')) {
            const fileLinkMatch = trimmedLine.match(/\[([^\]]+)\]\((file:\/\/[^)]+)\)/)
            if (fileLinkMatch) {
              throw new Error(`File links must be inside ordered list items. Found link outside ordered list: "${trimmedLine}"`)
            }
          }

          // Check for end of ordered list (empty line)
          if (trimmedLine === '' && inOrderedList) {
            inOrderedList = false
          }
        }
      }

      // Add the last section
      if (currentSection) {
        sections.push(currentSection)
      }

      console.log('Parsed sections:', sections)
      return sections
    },

    async convertAndMergeDocuments (sections, basePath) {
      const path = require('path')
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)

      const baseDir = path.dirname(basePath)
      const outputDir = baseDir

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

      // Get template directory from preferences
      const templateDirectory = this.$store.state.preferences.templateDirectory || ''

      // Merge all PDFs with header/footer overlay
      const mergedPdfPath = await this.mergeWithTemplates(mergeList, baseDir, templateDirectory)

      return mergedPdfPath
    },

    async mergeWithTemplates (mergeList, baseDir, templateDirectory) {
      const { PDFDocument } = require('pdf-lib')
      const path = require('path')
      const fs = require('fs')

      console.log('mergeWithTemplates called with templateDirectory:', templateDirectory)

      const mergedPdfPath = path.join(baseDir, 'merged_document.pdf')

      // First pass: calculate total pages
      let totalPages = 0
      for (const section of mergeList) {
        for (const pdfPath of section.pdfs) {
          if (fs.existsSync(pdfPath)) {
            const contentBytes = fs.readFileSync(pdfPath)
            const doc = await PDFDocument.load(contentBytes)
            totalPages += doc.getPageCount()
          }
        }
      }

      console.log(`Total pages to merge: ${totalPages}`)

      const finalDoc = await PDFDocument.create()
      let globalPageCounter = 1

      // Load header/footer templates if available (moved here after finalDoc creation)
      let templatePortraitPath = null
      let templateLandscapePath = null

      if (templateDirectory && fs.existsSync(templateDirectory)) {
        console.log('Template directory exists:', templateDirectory)

        // List all files in template directory for debugging
        try {
          const templateFiles = fs.readdirSync(templateDirectory)
          console.log('Files in template directory:', templateFiles)
        } catch (listError) {
          console.warn('Could not list template directory files:', listError.message)
        }

        const portraitTemplatePath = path.join(templateDirectory, 'header_footer_portrait.docx')
        const landscapeTemplatePath = path.join(templateDirectory, 'header_footer_landscape.docx')

        console.log('Portrait template path:', portraitTemplatePath)
        console.log('Landscape template path:', landscapeTemplatePath)

        if (fs.existsSync(portraitTemplatePath)) {
          console.log('Portrait DOCX template found:', portraitTemplatePath)
          const portraitStats = fs.statSync(portraitTemplatePath)
          console.log(`Portrait template size: ${portraitStats.size} bytes`)
          templatePortraitPath = portraitTemplatePath
        } else {
          console.log('Portrait template not found:', portraitTemplatePath)
        }

        if (fs.existsSync(landscapeTemplatePath)) {
          console.log('Landscape DOCX template found:', landscapeTemplatePath)
          const landscapeStats = fs.statSync(landscapeTemplatePath)
          console.log(`Landscape template size: ${landscapeStats.size} bytes`)
          templateLandscapePath = landscapeTemplatePath
        } else {
          console.log('Landscape template not found:', landscapeTemplatePath)
        }
      } else {
        console.log('No template directory specified or directory does not exist')
      }

      for (const section of mergeList) {
        console.log(`Processing section: ${section.title}`)

        for (const pdfPath of section.pdfs) {
          if (!fs.existsSync(pdfPath)) {
            console.warn(`PDF file does not exist, skipping: ${pdfPath}`)
            continue
          }

          console.log(`Processing PDF: ${pdfPath}`)
          const contentBytes = fs.readFileSync(pdfPath)
          const contentDoc = await PDFDocument.load(contentBytes)

          // Process each page: resize content and overlay on A4 page
          const sourcePages = contentDoc.getPages()
          for (let i = 0; i < sourcePages.length; i++) {
            const sourcePage = sourcePages[i]
            const pageNumber = globalPageCounter + i

            // Resize the source page content to fit within A4
            this.resizePageToA4(sourcePage, pageNumber)

            // Create A4 page with resized content overlaid
            const a4Page = await this.createA4PageWithContent(sourcePage, pageNumber, finalDoc)
            console.log(`Created A4 page ${pageNumber} with overlaid content`)

            // Verify the A4 page was created correctly
            if (a4Page) {
              const { width: a4Width, height: a4Height } = a4Page.getSize()
              console.log(`A4 page ${pageNumber} final size: ${a4Width}x${a4Height} points`)
            } else {
              console.error(`Failed to create A4 page ${pageNumber}`)
            }

            // Apply template overlay to the A4 page if available
            if (templatePortraitPath || templateLandscapePath) {
              const { width, height } = a4Page.getSize()
              const orientation = width > height ? 'landscape' : 'portrait'

              // Select appropriate template
              const templatePath = orientation === 'portrait' ? templatePortraitPath : templateLandscapePath

              console.log(`Page ${pageNumber} orientation: ${orientation}`)
              console.log('Template path:', templatePath)

              if (templatePath) {
                try {
                  // Patch the DOCX template with current page data
                  const patchedDocxPath = await this.patchDocxTemplate(
                    templatePath,
                    section.title,
                    pageNumber,
                    totalPages
                  )

                  // Convert patched DOCX to PDF
                  const { exec } = require('child_process')
                  const { promisify } = require('util')
                  const execAsync = promisify(exec)

                  const conversionTools = this.$store.state.preferences.conversionTools || []
                  const docxTool = this.findConversionTool(patchedDocxPath, conversionTools)

                  if (!docxTool) {
                    console.warn(`No conversion tool found for DOCX file: ${patchedDocxPath}`)
                  } else {
                    const tempDir = require('os').tmpdir()
                    const pdfOutputPath = await this.convertToPdf(patchedDocxPath, docxTool, tempDir, execAsync)

                    // Load the converted PDF and apply as overlay
                    if (fs.existsSync(pdfOutputPath)) {
                      const overlayBytes = fs.readFileSync(pdfOutputPath)
                      console.log('Overlay PDF loaded, size: ' + overlayBytes.length + ' bytes')

                      try {
                        const overlayDoc = await PDFDocument.load(overlayBytes)

                        // Check if overlay document has pages
                        const overlayPageCount = overlayDoc.getPageCount()
                        console.log(`Overlay PDF has ${overlayPageCount} pages`)

                        if (overlayPageCount > 0) {
                          try {
                            const copiedPages = await finalDoc.copyPages(overlayDoc, [0])
                            console.log('Copied pages result:', copiedPages)
                            console.log('Copied pages length:', copiedPages?.length)
                            console.log('First page type:', copiedPages?.[0]?.constructor?.name)
                            console.log('First page object:', copiedPages?.[0])

                            // Try using embedPage on the overlay page directly
                            console.log('Trying embedPage approach...')
                            try {
                              const overlayPageFromDoc = overlayDoc.getPages()[0]
                              console.log('Overlay page from doc:', overlayPageFromDoc)
                              console.log('Overlay page from doc type:', overlayPageFromDoc?.constructor?.name)

                              const embeddedPage = await finalDoc.embedPage(overlayPageFromDoc)
                              console.log('Embedded page result:', embeddedPage)
                              console.log('Embedded page type:', embeddedPage?.constructor?.name)

                              // Use the embedded page instead
                              copiedPages[0] = embeddedPage
                              console.log('Replaced copied page with properly embedded page')
                            } catch (embedError) {
                              console.warn('embedPage failed, continuing with copyPages result:', embedError.message)
                            }

                            if (copiedPages && copiedPages.length > 0 && copiedPages[0] != null) {
                              const overlayPage = copiedPages[0]

                              // Verify the overlay page is valid and not null/undefined
                              if (overlayPage && typeof overlayPage === 'object' &&
                                  overlayPage != null &&
                                  (overlayPage.constructor.name === 'PDFEmbeddedPage' || overlayPage.constructor.name === 'PDFPage')) {
                                // Draw overlay on top of the A4 page
                                console.log(`About to draw overlay page ${pageNumber}, overlayPage type: ${overlayPage.constructor.name}`)
                                console.log('Overlay page before drawPage:', overlayPage)
                                console.log(`Overlay page is NaN check: ${isNaN(overlayPage)}`)
                                console.log(`Overlay page == null check: ${overlayPage == null}`)
                                try {
                                  a4Page.drawPage(overlayPage)
                                  console.log(`Successfully applied DOCX template overlay to page ${pageNumber}`)
                                } catch (drawError) {
                                  console.error(`Error drawing overlay page for page ${pageNumber}:`, drawError.message)
                                  console.error('Draw error details:', drawError)
                                  console.error('Overlay page object:', overlayPage)
                                  console.error('Overlay page constructor:', overlayPage?.constructor?.name)
                                  console.error('A4 page object being drawn on:', a4Page)
                                  console.error('A4 page constructor:', a4Page?.constructor?.name)
                                  // Don't rethrow - continue with next page
                                }
                              } else {
                                console.warn(`Invalid overlay page object for page ${pageNumber}, type: ${typeof overlayPage}, constructor: ${overlayPage?.constructor?.name}, isNull: ${overlayPage == null}`)
                              }
                            } else {
                              console.warn(`copyPages returned empty array or null for page ${pageNumber}`)
                            }
                          } catch (copyError) {
                            console.error(`Error copying overlay page for page ${pageNumber}:`, copyError.message)
                            console.error('Copy error details:', copyError)
                          }
                        } else {
                          console.warn(`Overlay PDF has no pages, skipping overlay for page ${pageNumber}`)
                        }
                      } catch (loadError) {
                        console.error(`Error loading overlay PDF for page ${pageNumber}:`, loadError.message)
                        console.error('Load error details:', loadError)
                      }

                      // Clean up temporary files immediately after use
                      try {
                        if (fs.existsSync(patchedDocxPath)) {
                          fs.unlinkSync(patchedDocxPath)
                        }
                        if (fs.existsSync(pdfOutputPath)) {
                          fs.unlinkSync(pdfOutputPath)
                        }
                        console.log('Temporary files cleaned up')
                      } catch (cleanupError) {
                        console.warn('Could not clean up temporary files:', cleanupError.message)
                      }
                    } else {
                      console.warn(`Converted PDF not found: ${pdfOutputPath}`)
                    }
                  }
                } catch (overlayError) {
                  console.error(`Error applying template overlay to page ${pageNumber}:`, overlayError.message)
                }
              } else {
                console.log(`Skipping template overlay for page ${pageNumber} - template not available for ${orientation}`)
                console.log(`Available templates - Portrait: ${!!templatePortraitPath}, Landscape: ${!!templateLandscapePath}`)
              }
            } else {
              console.log(`No template available for page ${pageNumber}`)
            }

            globalPageCounter++
          }
        }
      }

      const mergedBytes = await finalDoc.save()
      fs.writeFileSync(mergedPdfPath, mergedBytes)

      console.log(`Merged PDF created: ${mergedPdfPath} (Total pages: ${totalPages})`)
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
    },

    // Resize PDF page to A4 format while maintaining aspect ratio
    resizePageToA4 (page, pageNumber) {
      // Check if resizing is enabled in preferences
      const resizeEnabled = this.$store.state.preferences.resizePagesToA4 !== false // Default to true
      if (!resizeEnabled) {
        console.log(`Page ${pageNumber} resizing disabled in preferences, keeping original size`)
        return false
      }

      const { width, height } = page.getSize()
      console.log(`Page ${pageNumber} original size: ${width}x${height} points`)

      // A4 dimensions in points (72 DPI): 595.28 x 841.89
      const A4_WIDTH = 595.28
      const A4_HEIGHT = 841.89

      // Check if page needs resizing (with small tolerance for rounding)
      const tolerance = 5 // points
      const needsResize = Math.abs(width - A4_WIDTH) > tolerance || Math.abs(height - A4_HEIGHT) > tolerance

      if (!needsResize) {
        console.log(`Page ${pageNumber} is already A4 sized, no resizing needed`)
        return false
      }

      console.log(`Page ${pageNumber} needs resizing to A4 format`)

      try {
        // Always target A4 dimensions regardless of original orientation
        // This ensures all pages are exactly the same size for consistent overlay positioning
        const targetWidth = A4_WIDTH
        const targetHeight = A4_HEIGHT

        // Calculate scale factors for both dimensions
        const scaleX = targetWidth / width
        const scaleY = targetHeight / height

        // Use the smaller scale to ensure content fits within A4 bounds
        const scale = Math.min(scaleX, scaleY)

        // Calculate new dimensions
        const newWidth = width * scale
        const newHeight = height * scale

        console.log(`Scaling page ${pageNumber} by factor ${scale.toFixed(3)} to ${newWidth.toFixed(2)}x${newHeight.toFixed(2)} points`)
        console.log(`Target A4 dimensions: ${targetWidth}x${targetHeight} points`)

        // Resize the page to the scaled dimensions
        page.setSize(newWidth, newHeight)
        console.log(`Successfully resized page ${pageNumber} to fit within A4 format`)
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

    // DOCX template patching using docxtemplater
    async patchDocxTemplate (templatePath, sectionTitle, pageNumber, totalPages) {
      const fs = require('fs')
      const path = require('path')
      const PizZip = require('pizzip')
      const Docxtemplater = require('docxtemplater')

      try {
        console.log('Processing template for page: ' + pageNumber + '/' + totalPages)

        // Read the template file
        console.log(`Reading original template file: ${templatePath}`)

        if (!fs.existsSync(templatePath)) {
          throw new Error(`Template file does not exist: ${templatePath}`)
        }

        const content = fs.readFileSync(templatePath)
        console.log(`Content loaded into memory, size: ${content.length} bytes`)

        // Validate that we have content
        if (!content || content.length === 0) {
          throw new Error(`Template file is empty: ${templatePath}`)
        }

        console.log('File loaded successfully')

        // Create a copy of the content to ensure we don't modify the original
        const contentCopy = Buffer.from(content)
        console.log('Created content copy for processing')

        let zip
        try {
          zip = new PizZip(contentCopy)
          console.log('Successfully created PizZip object')
        } catch (zipError) {
          console.error('Failed to create PizZip object:', zipError)
          console.error('Content length:', content.length)
          console.error('Content starts with:', content.subarray(0, 10).toString('hex'))
          console.error('Content ends with:', content.subarray(Math.max(0, content.length - 10)).toString('hex'))

          // Try to provide more specific error information
          if (zipError.message.includes('central dir')) {
            console.error('This appears to be a corrupted ZIP file with issues in the central directory')
            console.error('The file may be:')
            console.error('- A corrupted DOCX file')
            console.error('- Not a valid DOCX file')
            console.error('- A file that was partially downloaded or saved incorrectly')
          }

          throw new Error(`Failed to parse DOCX file as ZIP archive: ${zipError.message}`)
        }

        // Create docxtemplater instance with minimal configuration to preserve styling
        const doc = new Docxtemplater(zip)

        // Set template variables
        doc.setData({
          section_title: sectionTitle || '',
          page_number: pageNumber || '',
          total_pages: totalPages || '',
          page_number_total: `${pageNumber || ''} of ${totalPages || ''}`
        })

        // Render the document
        console.log('Rendering document with docxtemplater...')
        doc.render()
        console.log('Document rendered successfully')

        // Generate the patched document
        console.log('Generating patched document...')
        const patchedContent = doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE'
        })

        // Create temporary file path and write immediately for conversion
        const tempDir = require('os').tmpdir()
        const templateName = path.basename(templatePath, '.docx')
        const patchedPath = path.join(tempDir, `${templateName}_patched_${pageNumber}.docx`)

        // Write and use immediately, then clean up
        fs.writeFileSync(patchedPath, patchedContent)

        console.log('Using temporary DOCX for conversion')
        return patchedPath
      } catch (error) {
        console.error('Error patching DOCX template:', error)
        throw new Error(`Failed to patch DOCX template: ${error.message}`)
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
