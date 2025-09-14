<template>
  <div class="pref-template-directory">
    <h4>Document Merge Templates</h4>

    <compound>
      <template #head>
        <h6 class="title">Template Directory:</h6>
      </template>
      <template #children>
        <div class="template-directory-setting">
          <div class="form-row">
            <label>Path to Templates:</label>
            <el-input
              v-model="templateDirectory"
              placeholder="Path to directory containing header_footer_portrait.docx and header_footer_landscape.docx"
              size="small"
              @change="updateTemplateDirectory"
            />
            <el-button
              size="small"
              @click="selectTemplateDirectory"
              icon="el-icon-folder"
            >
              Browse
            </el-button>
          </div>

          <div class="template-status">
            <div v-if="localTemplateDirectory" class="status-item">
              <span class="status-label">Directory:</span>
              <span :class="['status-value', { 'status-valid': templateDirectoryExists, 'status-invalid': !templateDirectoryExists }]">
                {{ templateDirectoryExists ? 'Found' : 'Not Found' }}
              </span>
            </div>

            <div v-if="localTemplateDirectory && templateDirectoryExists" class="status-item">
              <span class="status-label">Portrait Template:</span>
              <span :class="['status-value', { 'status-valid': portraitTemplateExists, 'status-invalid': !portraitTemplateExists }]">
                {{ portraitTemplateExists ? 'Found' : 'Not Found' }}
              </span>
            </div>

            <div v-if="localTemplateDirectory && templateDirectoryExists" class="status-item">
              <span class="status-label">Landscape Template:</span>
              <span :class="['status-value', { 'status-valid': landscapeTemplateExists, 'status-invalid': !landscapeTemplateExists }]">
                {{ landscapeTemplateExists ? 'Found' : 'Not Found' }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">Template Requirements:</h6>
      </template>
      <template #children>
        <div class="help-text">
          <p><strong>Required Files:</strong></p>
          <ul>
            <li><code>portrait.docx</code> - Template for portrait-oriented pages</li>
            <li><code>landscape.docx</code> - Template for landscape-oriented pages</li>
          </ul>

          <p><strong>Template Placeholders:</strong></p>
          <ul>
            <li><code>{page_title}</code> - Will be replaced with the current page title</li>
            <li><code>{page_number}</code> - Will be replaced with the current page number</li>
            <li><code>{page_total}</code> - Will be replaced with the total number of pages</li>
          </ul>

          <p><strong>Note:</strong> Templates should be DOCX files with placeholders using curly braces (e.g., {page_title}). The placeholders will be automatically replaced during the merge process and the document will be converted to PDF.</p>
        </div>
      </template>
    </compound>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import Compound from '../common/compound'
import { ipcRenderer } from 'electron'
import fs from 'fs'
import path from 'path'

export default {
  components: {
    Compound
  },
  data () {
    return {
    }
  },
  computed: {
    ...mapState({
      templateDirectory: state => state.preferences.templateDirectory || ''
    }),
    templateDirectoryExists () {
      return this.templateDirectory && fs.existsSync(this.templateDirectory)
    },
    portraitTemplateExists () {
      if (!this.templateDirectoryExists) return false
      const portraitPath = path.join(this.templateDirectory, 'header_footer_portrait.docx')
      return fs.existsSync(portraitPath)
    },
    landscapeTemplateExists () {
      if (!this.templateDirectoryExists) return false
      const landscapePath = path.join(this.templateDirectory, 'header_footer_landscape.docx')
      return fs.existsSync(landscapePath)
    }
  },
  watch: {
  },
  methods: {
    selectTemplateDirectory () {
      ipcRenderer.invoke('mt::dialog-select-directory')
        .then(result => {
          if (result && !result.canceled && result.filePaths && result.filePaths[0]) {
            this.updateTemplateDirectory(result.filePaths[0])
          }
        })
        .catch(err => {
          console.error('Error selecting directory:', err)
        })
    },
    updateTemplateDirectory (value) {
      const directoryPath = value || this.templateDirectory
      this.$store.dispatch('SET_SINGLE_PREFERENCE', {
        type: 'templateDirectory',
        value: directoryPath
      })
    }
  }
}
</script>

<style scoped>
.pref-template-directory {
  & .template-directory-setting {
    & .form-row {
      display: flex;
      align-items: center;
      margin-bottom: 16px;

      & label {
        min-width: 120px;
        margin-right: 8px;
        font-size: 12px;
        color: var(--editorColor80);
      }

      & .el-input {
        flex: 1;
      }

      & .el-button {
        margin-left: 8px;
      }
    }

    & .template-status {
      margin-top: 16px;

      & .status-item {
        display: flex;
        align-items: center;
        margin-bottom: 8px;

        & .status-label {
          min-width: 140px;
          font-size: 12px;
          color: var(--editorColor80);
        }

        & .status-value {
          font-size: 12px;
          font-weight: 500;

          &.status-valid {
            color: #67c23a;
          }

          &.status-invalid {
            color: #f56c6c;
          }
        }
      }
    }
  }

  & .help-text {
    & p {
      margin: 8px 0;
      font-size: 13px;
      color: var(--editorColor80);
    }

    & ul {
      margin: 8px 0;
      padding-left: 20px;
    }

    & li {
      margin: 4px 0;
      font-size: 13px;
      color: var(--editorColor80);
    }

    & code {
      background: var(--itemBgColor);
      padding: 2px 4px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 12px;
      color: var(--editorColor);
    }
  }
}
</style>
