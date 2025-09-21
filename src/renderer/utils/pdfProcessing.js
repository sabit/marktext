// Utility functions for PDF document processing
const fs = require('fs')
const os = require('os')
const path = require('path')
const { PDFDocument, rgb } = require('pdf-lib')
const Docxtemplater = require('docxtemplater')
const PizZip = require('pizzip')
const { convertToPdf } = require('./fileConversion')

/**
 * Merge PDFs with templates
 * @param {Array} mergeList - List of sections and their PDFs to merge
 * @param {string} baseDir - Base directory for output
 * @param {string} templateDirectory - Directory containing templates
 * @returns {Promise<string>} - Path to the merged PDF
 */
async function mergeWithTemplates (mergeList, baseDir, templateDirectory, tools, draftMode, projectTitle) {
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
  const tocResult = await generateTableOfContents(mergeList, finalDoc)
  const tocPageCount = tocResult.pageCount
  const nestedSections = tocResult.nestedSections
  console.log(`Generated ${tocPageCount} ToC pages with nested sections`)
  console.log('Nested sections structure:', JSON.stringify(nestedSections, null, 2))

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
      const blankPage = finalDoc.addPage([595.28, 841.89])
      await drawOverlay(blankPage, tools, section.title, currentPageIndex, totalPages, nestedSections, true, templateDirectory, projectTitle)
      currentPageIndex++
    }

    // console.log('hai', section.pdfs)
    for (const pdf of section.pdfs) {
      if (!fs.existsSync(pdf.path)) {
        console.warn(`PDF file does not exist, skipping: ${pdf.path}`)
        continue
      }

      console.log(`Processing PDF: ${pdf.path}`)

      const contentBytes = fs.readFileSync(path.resolve(pdf.path))
      const contentDoc = await PDFDocument.load(contentBytes)

      // Simple approach: copy all pages at once
      const sourcePages = contentDoc.getPages()
      const copiedPages = await finalDoc.copyPages(contentDoc, sourcePages.map((_, i) => i))
      // console.log(`Copied ${copiedPages.length} pages from ${pdf.path}`)
      // console.log('hai2', pdf)
      // Add the copied pages to the final document
      for (const copiedPage of copiedPages) {
        // Create a new blank A4 page to draw onto. This gives us a clean canvas.
        const newPage = finalDoc.addPage([595.28, 841.89])

        // Embed the copied page to get a drawable object.
        const embeddedPage = await finalDoc.embedPage(copiedPage)

        if (pdf.fitToPage) {
          const { width, height } = copiedPage.getSize()
          const A4_WIDTH = 595.28
          const A4_HEIGHT = 841.89

          // Convert 2cm to points for margins
          const marginInPoints = 2 * (72 / 2.54)

          // Calculate the available width and height within the margins
          const availableWidth = A4_WIDTH
          const availableHeight = A4_HEIGHT - (2 * marginInPoints)

          // Calculate the scaling factor
          const scale = Math.min(availableWidth / width, availableHeight / height)

          // Calculate the dimensions of the page after scaling
          const scaledWidth = width * scale
          const scaledHeight = height * scale

          // Calculate the x and y coordinates to center the scaled page
          const x = (A4_WIDTH - scaledWidth) / 2
          const y = (A4_HEIGHT - scaledHeight) / 2

          // Draw the embedded page onto the new blank page with scaling and positioning
          newPage.drawPage(embeddedPage, {
            x,
            y,
            xScale: scale,
            yScale: scale
          })
        } else {
          // If not fitting, draw the embedded page directly onto the new page without scaling.
          newPage.drawPage(embeddedPage)
        }

        // 2. Now draw the overlay on the newly created and drawn-upon page unless draft mode is enabled.
        if (!draftMode) {
          await drawOverlay(newPage, tools, section.title, currentPageIndex, totalPages, nestedSections, false, templateDirectory, projectTitle)
        }
        currentPageIndex++
      }

      console.log(`Current document now has ${currentPageIndex} pages total (including ToC and blank pages)`)
    }
  }

  const mergedBytes = await finalDoc.save()
  fs.writeFileSync(mergedPdfPath, mergedBytes)

  console.log(`Merged PDF created: ${mergedPdfPath} (Total content pages: ${totalPages})`)
  return mergedPdfPath
}

async function drawOverlay (page, tools, sectionTitle, pageNumber, totalPages, nestedSections, isSeparator = false, templateDirectory, projectTitle = '') {
  // Placeholder function for drawing header/footer overlays
  console.log(`Drawing overlay for page ${pageNumber} of ${totalPages} -- ${sectionTitle} -- Separator: ${isSeparator} -- TemplateDir: ${templateDirectory}`)
  // implement docxtemplater overlay logic
  const templatePath = path.join(templateDirectory, isSeparator ? 'separator_template.docx' : 'portrait.docx')

  if (!fs.existsSync(templatePath)) {
    console.error(`Template file not found, skipping overlay: ${templatePath}`)
    return
  }

  const content = fs.readFileSync(templatePath, 'binary')
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
  const subSections = isSeparator && nestedSections
    ? nestedSections.find(sec => sec.title === sectionTitle)?.subSections || []
    : []

  // Render the document
  try {
    // Pass data directly to the render method to avoid using the deprecated setData
    doc.render({
      page_number: pageNumber,
      page_total: totalPages,
      section_title: sectionTitle,
      page_title: sectionTitle,
      sub_sections: subSections,
      project_title: projectTitle
    })
  } catch (error) {
    console.error('Error rendering document:', error)
    // If rendering fails, we can't create an overlay, so we should exit.
    return
  }

  // Get the output document
  const output = doc.getZip().generate({ type: 'nodebuffer' })
  const tempDirectory = os.tmpdir()
  const tempDocxPath = path.join(tempDirectory, `output${pageNumber}.docx`)
  fs.writeFileSync(tempDocxPath, output)

  const tool = tools.findConversionTool(tempDocxPath, tools.conversionTools)
  if (!tool) {
    console.error(`No conversion tool found for .docx, skipping overlay for page ${pageNumber}`)
    return
  }
  await convertToPdf(tempDocxPath, tool, tempDirectory)

  // Now overlay the generated PDF page onto the existing PDF page
  const overlayPdfPath = path.join(tempDirectory, `output${pageNumber}.pdf`)
  if (fs.existsSync(overlayPdfPath)) {
    const overlayBytes = fs.readFileSync(overlayPdfPath)
    const overlayDoc = await PDFDocument.load(overlayBytes)
    // Use embedPage which is safer for drawing pages from another document.
    const [embeddedOverlayPage] = await page.doc.embedPdf(overlayDoc)
    page.drawPage(embeddedOverlayPage)
  } else {
    console.error(`Overlay PDF not found, skipping overlay for page ${pageNumber}: ${overlayPdfPath}`)
  }
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

    const pageInfo = {
      title: section.title,
      isMain: isMainSection,
      startPage: currentPage,
      contentPage: isMainSection ? currentPage + 1 : currentPage,
      endPage: currentPage + sectionPageCount - (isMainSection ? 0 : 1),
      pageCount: sectionPageCount
    }

    sectionPageInfo.push(pageInfo)

    // Process subsections
    if (section.subSections) {
      for (const subSection of section.subSections) {
        let subSectionPageCount = 0
        for (const pdf of subSection.pdfs) {
          if (fs.existsSync(pdf.path)) {
            const contentBytes = fs.readFileSync(pdf.path)
            const doc = await PDFDocument.load(contentBytes)
            subSectionPageCount += doc.getPageCount()
          }
        }

        const subPageInfo = {
          title: subSection.title,
          isMain: false,
          startPage: currentPage,
          contentPage: currentPage,
          endPage: currentPage + subSectionPageCount - 1,
          pageCount: subSectionPageCount
        }

        sectionPageInfo.push(subPageInfo)
        currentPage += subSectionPageCount
      }
    }

    currentPage += sectionPageCount + (isMainSection ? 1 : 0)
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

  // Collect nested section structure
  const nestedSections = mergeList.map((section, index) => {
    const pageInfo = sectionPageInfo[index]
    if (!pageInfo.isMain) {
      return null // Skip non-main sections
    }

    return {
      title: section.title,
      isMain: pageInfo.isMain,
      startPage: pageInfo.startPage,
      endPage: pageInfo.endPage,
      subSections: mergeList
        .filter(subSection =>
          subSection.title.startsWith(`${section.title.split('.')[0]}.`) &&
          subSection.title !== section.title
        )
        .map(subSection => {
          const subPageInfo = sectionPageInfo.find(info => info.title === subSection.title)
          return {
            title: subSection.title,
            startPage: subPageInfo?.startPage,
            endPage: subPageInfo?.endPage
          }
        })
    }
  }).filter(Boolean) // Remove null entries

  // Return both page count and nested section structure
  return {
    pageCount: tocPages.length,
    nestedSections
  }
}

module.exports = {
  mergeWithTemplates,
  generateTableOfContents
}
