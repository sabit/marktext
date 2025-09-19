// Utility class for caching PDF documents and metadata
const fs = require('fs')
const path = require('path')
const { PDFDocument } = require('pdf-lib')

class DocumentCache {
  constructor () {
    this.pdfCache = new Map() // Map<filepath, {doc, pageCount, lastModified}>
  }

  normalizePath (filepath) {
    return path.resolve(filepath)
  }

  async getPdfDocument (filepath) {
    const normalizedPath = this.normalizePath(filepath)
    const stats = fs.statSync(normalizedPath)
    if (this.pdfCache.has(normalizedPath)) {
      const cached = this.pdfCache.get(normalizedPath)
      if (cached.lastModified >= stats.mtimeMs) {
        return cached.doc
      }
    }
    const content = fs.readFileSync(normalizedPath)
    const doc = await PDFDocument.load(content)
    this.pdfCache.set(normalizedPath, {
      doc,
      pageCount: doc.getPageCount(),
      lastModified: stats.mtimeMs
    })
    return doc
  }

  getPageCount (filepath) {
    const normalizedPath = this.normalizePath(filepath)
    if (this.pdfCache.has(normalizedPath)) {
      return this.pdfCache.get(normalizedPath).pageCount
    }
    return null
  }
}

module.exports = DocumentCache
