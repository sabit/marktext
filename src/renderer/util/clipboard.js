import { clipboard as remoteClipboard } from '@electron/remote'
import plist from 'plist'
import { isLinux, isOsx, isWindows } from './index'

const hasClipboardFiles = () => {
  return remoteClipboard.has('NSFilenamesPboardType')
}

const getClipboardFiles = () => {
  if (!hasClipboardFiles()) { return [] }
  return plist.parse(remoteClipboard.read('NSFilenamesPboardType'))
}

const readWindowsFilePath = () => {
  try {
    // Try to read as CF_HDROP format first (more reliable for Unicode)
    if (remoteClipboard.has('CF_HDROP')) {
      const buffer = remoteClipboard.readBuffer('CF_HDROP')
      if (buffer && buffer.length > 0) {
        // Parse CF_HDROP format
        // Skip the first 4 bytes (DROPFILES structure header)
        let offset = 4
        // Read file count (4 bytes)
        const fileCount = buffer.readUInt32LE(offset)
        offset += 4

        if (fileCount > 0) {
          // Skip wide char flag (2 bytes) and padding (2 bytes)
          offset += 4

          // Read the first file path (null-terminated UTF-16)
          let pathEnd = offset
          while (pathEnd < buffer.length - 1) {
            if (buffer.readUInt16LE(pathEnd) === 0) break
            pathEnd += 2
          }

          if (pathEnd > offset) {
            const pathBuffer = buffer.slice(offset, pathEnd)
            const filePath = pathBuffer.toString('utf16le')
            return filePath
          }
        }
      }
    }

    // Fallback to FileNameW
    if (remoteClipboard.has('FileNameW')) {
      const rawFilePath = remoteClipboard.read('FileNameW')
      if (rawFilePath && typeof rawFilePath === 'string') {
        const cleanedPath = rawFilePath.replace(/\0/g, '')
        if (cleanedPath) {
          return cleanedPath
        }
      }
    }

    // Final fallback to text clipboard
    const textPath = remoteClipboard.readText()
    if (textPath && typeof textPath === 'string') {
      const trimmedPath = textPath.trim()
      const pathRegex = /^[a-zA-Z]:[\\/].*/
      if (pathRegex.test(trimmedPath)) {
        return trimmedPath
      }
    }

    return ''
  } catch (error) {
    console.warn('Error reading Windows clipboard file path:', error)
    return ''
  }
}

export const guessClipboardFilePath = () => {
  if (isLinux) return ''
  if (isOsx) {
    const result = getClipboardFiles()
    return Array.isArray(result) && result.length ? result[0] : ''
  } else if (isWindows) {
    return readWindowsFilePath()
  } else {
    return ''
  }
}
