// Helper functions for document merge process
const path = require('path')
const fs = require('fs')
const { PDFDocument } = require('pdf-lib')

// A4 dimensions in points (72 DPI)
const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

/**
 * Resizes a PDF to A4 format
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} outputDir - Directory for output
 * @returns {Promise<string>} - Path to the resized PDF
 */
async function resizePdfToA4 (pdfPath, outputDir) {
  try {
    // Create resized PDF filename
    const originalFileName = path.basename(pdfPath)
    const resizedPath = path.join(outputDir, `a4_${originalFileName}`)

    // Check if resized file already exists and is newer than the source
    if (fs.existsSync(resizedPath)) {
      const sourceStat = fs.statSync(pdfPath)
      const resizedStat = fs.statSync(resizedPath)

      if (resizedStat.mtime >= sourceStat.mtime) {
        console.log(`Resized file already up to date: ${resizedPath}`)
        return resizedPath
      }
    }

    // Load the PDF
    const pdfData = fs.readFileSync(pdfPath)
    const pdfDoc = await PDFDocument.load(pdfData)
    const pages = pdfDoc.getPages()

    // Check if resize is needed
    let needsResize = false
    for (const page of pages) {
      const { width, height } = page.getSize()
      // Use 5 point tolerance to account for floating point rounding
      if (Math.abs(width - A4_WIDTH) > 5 || Math.abs(height - A4_HEIGHT) > 5) {
        needsResize = true
        break
      }
    }

    // If no resize needed, return the original path
    if (!needsResize) {
      console.log(`PDF already A4 sized: ${pdfPath}`)
      return pdfPath
    }

    // Create a new document with A4 pages
    const newPdf = await PDFDocument.create()

    for (let i = 0; i < pages.length; i++) {
      const originalPage = pages[i]
      const originalSize = originalPage.getSize()

      // Create new A4 page
      const newPage = newPdf.addPage([A4_WIDTH, A4_HEIGHT])

      // Copy the original page content as an embedded page
      const embeddedPage = await newPdf.embedPage(originalPage)

      // Calculate scaling to fit content while maintaining aspect ratio
      const scaleX = A4_WIDTH / originalSize.width
      const scaleY = A4_HEIGHT / originalSize.height
      const scale = Math.min(scaleX, scaleY, 1.0) // Don't scale up, only down if needed

      // Calculate new dimensions
      const scaledWidth = originalSize.width * scale
      const scaledHeight = originalSize.height * scale

      // Calculate position to center on page
      const x = (A4_WIDTH - scaledWidth) / 2
      const y = (A4_HEIGHT - scaledHeight) / 2

      // Draw the embedded page on the new A4 page
      newPage.drawPage(embeddedPage, {
        x,
        y,
        width: scaledWidth,
        height: scaledHeight
      })

      console.log(`Resized page ${i + 1}: ${originalSize.width}x${originalSize.height} → ${scaledWidth}x${scaledHeight}`)
    }

    // Save the new PDF
    const newPdfData = await newPdf.save()
    fs.writeFileSync(resizedPath, newPdfData)

    console.log(`Resized PDF saved to: ${resizedPath}`)
    return resizedPath
  } catch (error) {
    console.error(`Error resizing PDF: ${error.message}`)
    // Return the original file if resizing fails
    return pdfPath
  }
}

// Centralized file conversion logic
async function processFile (filePath, tools, outputDir, cache, progressManager) {
  // Convert file URL to local path if needed
  const localPath = tools.convertFileUrlToPath ? tools.convertFileUrlToPath(filePath) : filePath
  const normalizedPath = cache.normalizePath(localPath)
  const ext = path.extname(normalizedPath).toLowerCase()
  if (ext === '.pdf') {
    // Check if the PDF needs to be resized to A4
    const resizedPath = await resizePdfToA4(normalizedPath, outputDir)
    return resizedPath
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
  processSections,
  resizePdfToA4
}
