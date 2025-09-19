// Utility functions for PDF document processing
const fs = require('fs')
const path = require('path')
const { PDFDocument, rgb } = require('pdf-lib')

/**
 * Merge PDFs with templates
 * @param {Array} mergeList - List of sections and their PDFs to merge
 * @param {string} baseDir - Base directory for output
 * @param {string} templateDirectory - Directory containing templates
 * @returns {Promise<string>} - Path to the merged PDF
 */
async function mergeWithTemplates (mergeList, baseDir, templateDirectory) {
  console.log('mergeWithTemplates called with templateDirectory:', templateDirectory)

  const mergedPdfPath = path.join(baseDir, 'merged_document.pdf')

  // First pass: calculate total pages and collect section info for ToC
  let totalPages = 0
  // Count how many blank pages we'll insert (one per main section)
  let blankPagesCount = 0

  for (const section of mergeList) {
    // Check if this is a main section (not a subsection)
    const isMainSection = /^\d+\.\s+/.test(section.title)
    if (isMainSection) {
      blankPagesCount++
    }

    for (const pdf of section.pdfs) {
      if (fs.existsSync(pdf.path)) {
        const contentBytes = fs.readFileSync(pdf.path)
        const doc = await PDFDocument.load(contentBytes)
        totalPages += doc.getPageCount()
      }
    }
  }

  console.log(`Will insert ${blankPagesCount} blank pages (one before each main section)`)
  totalPages += blankPagesCount // Add blank pages to total page count

  console.log(`Total content pages to merge: ${totalPages}`)

  const finalDoc = await PDFDocument.create()

  // Generate Table of Contents (now supports multi-page)
  const tocPageCount = await generateTableOfContents(mergeList, finalDoc)
  console.log(`Generated ${tocPageCount} ToC pages`)

  // Emit progress update after ToC generation
  // Note: bus.$emit calls need to be handled by the component

  // Track the current page number in the document (starting after ToC pages)
  // Content pages always start from page 1
  let currentPageIndex = tocPageCount

  for (const section of mergeList) {
    console.log(`Processing section: ${section.title}`)

    // Check if this is a main section (not a subsection)
    // Main sections have format "1." or "2." with a dot after a single number
    const isMainSection = /^\d+\.\s+/.test(section.title)

    // Insert a blank page before each main section
    if (isMainSection) {
      console.log(`Inserting blank page before main section: ${section.title}`)
      // A4 dimensions in points (72 DPI): 595.28 x 841.89
      finalDoc.addPage([595.28, 841.89])
      currentPageIndex++
    }

    for (const pdf of section.pdfs) {
      if (!fs.existsSync(pdf.path)) {
        console.warn(`PDF file does not exist, skipping: ${pdf.path}`)
        continue
      }

      console.log(`Processing PDF: ${pdf.path}`)
      const contentBytes = fs.readFileSync(pdf.path)
      const contentDoc = await PDFDocument.load(contentBytes)

      // Simple approach: copy all pages at once
      const sourcePages = contentDoc.getPages()
      const copiedPages = await finalDoc.copyPages(contentDoc, sourcePages.map((_, i) => i))
      console.log(`Copied ${copiedPages.length} pages from ${pdf.path}`)

      // Add the copied pages to the final document
      for (const page of copiedPages) {
        finalDoc.addPage(page)
      }

      // Keep track of page number for template positioning
      currentPageIndex += sourcePages.length
      console.log(`Current document now has ${currentPageIndex} pages total (including ToC and blank pages)`)
    }
  }

  const mergedBytes = await finalDoc.save()
  fs.writeFileSync(mergedPdfPath, mergedBytes)

  console.log(`Merged PDF created: ${mergedPdfPath} (Total content pages: ${totalPages})`)
  return mergedPdfPath
}

/**
 * Generate a table of contents for the PDF
 * @param {Array} mergeList - List of sections and their PDFs
 * @param {Object} finalDoc - The PDF document to add ToC to
 * @returns {Promise<number>} - Number of ToC pages created
 */
async function generateTableOfContents (mergeList, finalDoc) {
  // A4 dimensions in points (72 DPI): 595.28 x 841.89
  const A4_WIDTH = 595.28
  const A4_HEIGHT = 841.89

  // Page layout constants
  const TOP_MARGIN = 50
  const BOTTOM_MARGIN = 50
  const LINE_HEIGHT = 20

  let currentPageIndex = 0
  let currentY = A4_HEIGHT - TOP_MARGIN
  let tocPages = []
  let tocEntries = []

  // Track all pages (including blank pages) for calculating correct page numbers
  const sectionPageInfo = [] // Will store page number info for each section
  let currentPage = 1 // Start from page 1 (after TOC)

  // First, identify all main sections that will get blank pages
  const mainSections = mergeList.map(section => /^\d+\.\s+/.test(section.title))

  // DEBUG: Print which sections are main sections
  console.log('Main sections:', mainSections.map((isMain, index) =>
    `${index}. ${mergeList[index].title}: ${isMain ? 'YES' : 'no'}`).join('\n'))

  // Calculate section page numbers with precise tracking of blank pages
  for (let i = 0; i < mergeList.length; i++) {
    const section = mergeList[i]
    const isMainSection = mainSections[i]

    // Count actual content pages in this section
    let sectionPageCount = 0
    for (const pdf of section.pdfs) {
      if (fs.existsSync(pdf.path)) {
        const contentBytes = fs.readFileSync(pdf.path)
        const doc = await PDFDocument.load(contentBytes)
        sectionPageCount += doc.getPageCount()
      }
    }

    if (isMainSection) {
      // Main sections have a blank page before their content
      const pageInfo = {
        title: section.title,
        isMain: true,
        startPage: currentPage, // First page (blank page)
        contentPage: currentPage + 1, // Content starts after blank page
        endPage: currentPage + sectionPageCount, // Last content page
        pageCount: sectionPageCount
      }

      sectionPageInfo.push(pageInfo)

      // Log the page range for this section
      console.log(`Page range for ${section.title}: blank=${pageInfo.startPage}, content=${pageInfo.contentPage}-${pageInfo.endPage}`)

      // Move to the next section's starting page
      currentPage += sectionPageCount + 1 // Content pages + blank page
    } else {
      // Subsections don't have blank pages
      const pageInfo = {
        title: section.title,
        isMain: false,
        startPage: currentPage, // First page (content starts immediately)
        contentPage: currentPage, // Same as startPage (no blank page)
        endPage: currentPage + sectionPageCount - 1, // Last content page
        pageCount: sectionPageCount
      }

      sectionPageInfo.push(pageInfo)

      // Log the page range for this section
      console.log(`Page range for ${section.title}: content=${pageInfo.startPage}-${pageInfo.endPage}`)

      // Move to the next section's starting page
      currentPage += sectionPageCount // Just content pages
    }
  }

  // Print comprehensive page info for verification
  console.log('Full section page info:', JSON.stringify(sectionPageInfo, null, 2))

  // First pass: collect all entries and calculate layout
  for (let i = 0; i < mergeList.length; i++) {
    const section = mergeList[i]
    const pageInfo = sectionPageInfo[i]

    // Extract the section number (formats: "1. Title" or "3.1 Title")
    // The regex handles both formats with and without trailing dots
    const numberMatch = section.title.match(/^(\d+(?:\.\d+)*)\.?\s+/)
    const level = numberMatch ? numberMatch[1].split('.').length - 1 : 0
    const indent = level * 20

    // Ensure we have at least one page before creating entries
    if (tocPages.length === 0) {
      let firstTocPage
      try {
        firstTocPage = finalDoc.addPage([A4_WIDTH, A4_HEIGHT])
        console.log('Created first ToC page for entries')
      } catch (pageError) {
        console.error('Failed to create first ToC page:', pageError.message)
        throw new Error('Unable to create ToC page: ' + pageError.message)
      }

      tocPages.push(firstTocPage)

      // Add title to first page
      firstTocPage.drawText('Table of Contents', {
        x: 50,
        y: A4_HEIGHT - TOP_MARGIN,
        size: 24,
        font: await finalDoc.embedFont('Helvetica-Bold')
      })
      currentY = A4_HEIGHT - TOP_MARGIN - 40
      currentPageIndex = 1
    }

    // Check if we need a new page for this entry
    if (currentY - LINE_HEIGHT < BOTTOM_MARGIN) {
      // Create new ToC page
      let newTocPage
      try {
        newTocPage = finalDoc.insertPage(currentPageIndex, [A4_WIDTH, A4_HEIGHT])
        console.log('Inserted ToC page at index ' + currentPageIndex)
      } catch (pageError) {
        console.error(`Failed to create ToC page at index ${currentPageIndex}:`, pageError.message)
        // Fallback: try addPage
        try {
          newTocPage = finalDoc.addPage([A4_WIDTH, A4_HEIGHT])
          console.log('Fallback: added ToC page using addPage()')
        } catch (fallbackError) {
          console.error('Fallback page creation also failed:', fallbackError.message)
          throw new Error(`Unable to create ToC page: ${fallbackError.message}`)
        }
      }

      tocPages.push(newTocPage)

      // Add "Table of Contents (Continued)" title for subsequent pages
      newTocPage.drawText('Table of Contents (Continued)', {
        x: 50,
        y: A4_HEIGHT - TOP_MARGIN,
        size: 18,
        font: await finalDoc.embedFont('Helvetica-Bold')
      })
      currentY = A4_HEIGHT - TOP_MARGIN - 30
      currentPageIndex++
    }

    // Use the pre-calculated page numbers from sectionPageInfo
    // We already have pageInfo from earlier

    // For display in the TOC, we show the page where the section starts
    // For main sections, that's the blank page
    // For subsections, that's the content page
    const displayPageNumber = pageInfo.startPage

    // For links, we want to point to the start of the section (including blank pages)
    // This ensures links go to blank pages for main sections
    const linkPageNumber = pageInfo.startPage

    // Format the title for the TOC - keep the hierarchical numbering format
    console.log(`Adding TOC entry: "${section.title}" at level ${level} with indent ${indent}px`)
    console.log(`Display page number: ${displayPageNumber}, Link target page: ${linkPageNumber}`)

    tocEntries.push({
      title: section.title,
      pageNumber: displayPageNumber, // For displaying in TOC
      linkPageNumber: linkPageNumber, // For link targets (skips blank pages)
      level: level,
      indent: indent,
      tocPageIndex: tocPages.length - 1,
      yPosition: currentY
    })

    currentY -= LINE_HEIGHT

    // The page counting is now handled in the first loop where we calculate sectionPageInfo
    // We don't need to count pages again here
  }

  // Second pass: draw entries on their respective pages
  for (const entry of tocEntries) {
    const tocPage = tocPages[entry.tocPageIndex]

    if (!tocPage) {
      console.error('ToC page is undefined for entry:', entry)
      continue
    }

    try {
      // Draw dot leaders across the entire line
      const dotsPerLine = Math.floor((A4_WIDTH - 100) / 3) // Approximate dots that fit
      const fullDotLine = '.'.repeat(dotsPerLine)

      tocPage.drawText(fullDotLine, {
        x: 50,
        y: entry.yPosition,
        size: 12,
        font: await finalDoc.embedFont('Helvetica')
      })

      // Draw section title with white background to overlay dots
      const titleFont = await finalDoc.embedFont('Helvetica')
      const titleWidth = entry.title.length * 6 // Approximate width

      // White rectangle behind title
      tocPage.drawRectangle({
        x: 50 - 2,
        y: entry.yPosition - 2,
        width: entry.indent + titleWidth + 6,
        height: 14,
        color: rgb(1, 1, 1), // White background
        borderWidth: 0
      })

      // Make sure title is displayed correctly with formatting
      tocPage.drawText(entry.title, {
        x: 50 + entry.indent,
        y: entry.yPosition,
        size: 12,
        font: titleFont,
        color: rgb(0, 0, 0) // Black text
      })

      // Draw page number with white background to overlay dots
      const pageNumText = entry.pageNumber.toString()
      const pageNumWidth = pageNumText.length * 6
      const pageNumX = A4_WIDTH - 50 - pageNumWidth

      // White rectangle behind page number
      tocPage.drawRectangle({
        x: pageNumX - 2,
        y: entry.yPosition - 2,
        width: A4_WIDTH - (pageNumX - 2),
        height: 14,
        color: rgb(1, 1, 1), // White background
        borderWidth: 0
      })

      tocPage.drawText(pageNumText, {
        x: pageNumX,
        y: entry.yPosition,
        size: 12,
        font: await finalDoc.embedFont('Helvetica'),
        color: rgb(0, 0, 0) // Black text
      })

      // Create clickable link rectangle over the title
      const linkRect = {
        x: 50 + entry.indent,
        y: entry.yPosition - 5,
        width: titleWidth,
        height: 15
      }

      // Try to create clickable link annotation
      try {
        // Links point to content pages (TOC pages + target page)
        // entry.linkPageNumber accounts for blank pages and skips them for main sections
        const targetPageNumber = tocPages.length + entry.linkPageNumber - 1
        console.log(`Link target for "${entry.title}": page ${targetPageNumber} (TOC pages: ${tocPages.length}, including blank page: ${entry.linkPageNumber})`)
        const linkAnnotation = finalDoc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [linkRect.x, linkRect.y, linkRect.x + linkRect.width, linkRect.y + linkRect.height],
          Border: [0, 0, 0],
          A: finalDoc.context.obj({
            Type: 'Action',
            S: 'GoTo',
            D: [targetPageNumber, 'XYZ', null, null, null]
          })
        })

        // Add the annotation to the page
        tocPage.node.addAnnot(linkAnnotation)
        console.log(`Successfully created clickable link for "${entry.title}" to page ${targetPageNumber}`)
      } catch (linkError) {
        console.warn(`Failed to create clickable link for "${entry.title}":`, linkError.message)
        console.log('Continuing with text-only ToC entries')
      }

      // Try to create PDF bookmark
      try {
        if (typeof finalDoc.addOutline === 'function') {
          // entry.linkPageNumber accounts for blank pages and skips them for main sections
          const targetPageNumber = tocPages.length + entry.linkPageNumber - 1
          finalDoc.addOutline(entry.title, [targetPageNumber])
          console.log(`Successfully created bookmark for "${entry.title}" to page ${targetPageNumber}`)
        } else {
          console.log('PDF-lib addOutline method not available, skipping bookmarks')
        }
      } catch (outlineError) {
        console.warn(`Failed to create bookmark for "${entry.title}":`, outlineError.message)
      }
    } catch (drawError) {
      console.error('Failed to draw ToC entry:', entry.title, drawError.message)
    }
  }

  // All entries should now have valid page indices
  console.log(`Generated ${tocPages.length} ToC pages with ${tocEntries.length} entries`)
  return tocPages.length // Return number of ToC pages for page numbering adjustment
}

module.exports = {
  mergeWithTemplates,
  generateTableOfContents
}
