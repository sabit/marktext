<template>
  <div class="pref-conversion-tools">
    <h4>Conversion Tools</h4>

    <compound>
      <template #head>
        <h6 class="title">Document Conversion Tools:</h6>
      </template>
      <template #children>
        <div class="conversion-tools-list">
          <div
            v-for="(tool, index) in localTools"
            :key="index"
            class="tool-item"
          >
            <div class="tool-header">
              <h6>{{ tool.name }}</h6>
              <el-button
                size="mini"
                type="danger"
                @click="removeTool(index)"
                icon="el-icon-delete"
              >
                Remove
              </el-button>
            </div>
            <div class="tool-details">
              <div class="form-row">
                <label>Extensions:</label>
                <el-input
                  v-model="tool.extensions"
                  placeholder="e.g. docx, doc"
                  size="small"
                  @change="updateTools"
                />
              </div>
              <div class="form-row">
                <label>Path:</label>
                <el-input
                  v-model="tool.path"
                  placeholder="Path to executable"
                  size="small"
                  @change="updateTools"
                />
                <el-button
                  size="small"
                  @click="selectToolPath(index)"
                  icon="el-icon-folder"
                >
                  Browse
                </el-button>
              </div>
              <div class="form-row">
                <label>Arguments:</label>
                <el-input
                  v-model="tool.arguments"
                  placeholder="Command arguments (use %input and %output)"
                  size="small"
                  @change="updateTools"
                />
              </div>
              <div class="form-row">
                <el-checkbox
                  v-model="tool.enabled"
                  @change="updateTools"
                >
                  Enabled
                </el-checkbox>
              </div>
            </div>
          </div>

          <div v-if="localTools.length === 0" class="no-tools">
            No conversion tools configured.
          </div>

          <el-button
            type="primary"
            size="small"
            @click="addTool"
            icon="el-icon-plus"
          >
            Add Tool
          </el-button>
        </div>
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">Help:</h6>
      </template>
      <template #children>
        <div class="help-text">
          <p><strong>Extensions:</strong> Comma-separated list of file extensions this tool can convert (e.g. "docx, doc")</p>
          <p><strong>Path:</strong> Full path to the conversion tool executable</p>
          <p><strong>Arguments:</strong> Command line arguments. Use %input for input file and %output or %inputDirfor output file</p>
          <p><strong>Example:</strong> For LibreOffice: <code>soffice.exe --headless --convert-to pdf %input --outdir %inputDir</code></p>
        </div>
      </template>
    </compound>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import Compound from '../common/compound'
import { ipcRenderer } from 'electron'

export default {
  components: {
    Compound
  },
  data () {
    return {
      localTools: []
    }
  },
  computed: {
    ...mapState({
      conversionTools: state => state.preferences.conversionTools || []
    })
  },
  watch: {
    conversionTools: {
      handler (newTools) {
        this.localTools = JSON.parse(JSON.stringify(newTools))
      },
      immediate: true
    }
  },
  methods: {
    addTool () {
      const newTool = {
        name: 'New Tool',
        extensions: '',
        path: '',
        arguments: '%input %output',
        enabled: true
      }
      this.localTools.push(newTool)
      this.updateTools()
    },
    removeTool (index) {
      this.localTools.splice(index, 1)
      this.updateTools()
    },
    selectToolPath (index) {
      ipcRenderer.invoke('mt::dialog-select-file')
        .then(result => {
          if (result && !result.canceled && result.filePaths && result.filePaths[0]) {
            this.localTools[index].path = result.filePaths[0]
            this.updateTools()
          }
        })
        .catch(err => {
          console.error('Error selecting file:', err)
        })
    },
    updateTools () {
      // Convert extensions string to array
      const tools = this.localTools.map(tool => ({
        ...tool,
        extensions: typeof tool.extensions === 'string'
          ? tool.extensions.split(',').map(ext => ext.trim()).filter(ext => ext)
          : tool.extensions
      }))

      this.$store.dispatch('SET_SINGLE_PREFERENCE', {
        type: 'conversionTools',
        value: tools
      })
    }
  }
}
</script>

<style scoped>
.pref-conversion-tools {
  & .conversion-tools-list {
    & .tool-item {
      border: 1px solid var(--itemBgColor);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 12px;
      background: var(--editorBgColor);

      & .tool-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        & h6 {
          margin: 0;
          color: var(--editorColor);
        }
      }

      & .tool-details {
        & .form-row {
          display: flex;
          align-items: center;
          margin-bottom: 8px;

          & label {
            min-width: 80px;
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
      }
    }

    & .no-tools {
      text-align: center;
      color: var(--editorColor60);
      padding: 20px;
      font-style: italic;
    }
  }

  & .help-text {
    & p {
      margin: 8px 0;
      font-size: 13px;
      color: var(--editorColor80);
    }

    & code {
      background: var(--itemBgColor);
      padding: 2px 4px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 12px;
    }
  }
}
</style>
