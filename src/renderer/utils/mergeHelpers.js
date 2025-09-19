// Helper functions for document merge process
const path = require('path')

// Centralized file conversion logic
async function processFile (filePath, tools, outputDir, cache, progressManager) {
  // Convert file URL to local path if needed
  const localPath = tools.convertFileUrlToPath ? tools.convertFileUrlToPath(filePath) : filePath
  const normalizedPath = cache.normalizePath(localPath)
  const ext = path.extname(normalizedPath).toLowerCase()
  if (ext === '.pdf') {
    return normalizedPath
  }
  // Find conversion tool (assume findConversionTool is available in context)
  const tool = tools && typeof tools.findConversionTool === 'function'
    ? tools.findConversionTool(normalizedPath, tools.conversionTools)
    : null
  if (!tool) {
    throw new Error(`No conversion tool found for file: ${normalizedPath}`)
  }
  // Convert file (assume convertToPdf is available in context)
  if (typeof tools.convertToPdf !== 'function') {
    throw new Error('convertToPdf function not provided in tools')
  }
  return tools.convertToPdf(normalizedPath, tool, outputDir)
}

// Process sections efficiently
async function processSections (sections, tools, outputDir, cache, progressManager, bus) {
  const mergeList = []
  const sectionProgressIndex = progressManager.addSection('Processing Sections', 40)
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const sectionPdfs = []
    const progress = (i / sections.length) * 100
    progressManager.updateSection(
      sectionProgressIndex,
      progress,
      `Processing section ${i + 1}/${sections.length}: ${section.title}`,
      bus
    )
    for (const doc of section.docs) {
      // Convert file URL to local path if needed
      const filePath = tools.convertFileUrlToPath ? tools.convertFileUrlToPath(doc.url) : doc.url
      const pdfPath = await processFile(filePath, tools, outputDir, cache, progressManager)
      sectionPdfs.push({
        path: pdfPath,
        fitToPage: doc.fitToPage
      })
    }
    mergeList.push({
      title: section.title,
      pdfs: sectionPdfs
    })
  }
  return mergeList
}

module.exports = {
  processFile,
  processSections
}
