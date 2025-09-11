#!/usr/bin/env node
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'

// CLI args: header/footer templates + output file
const headerTemplatePortraitPath = process.argv[2]
const headerTemplateLandscapePath = process.argv[3]
const outputFile = process.argv[4]

// Section map
const sections = [
  {
    title: '1. Introduction',
    pdfs: ['intro1.pdf', 'intro2.pdf']
  },
  {
    title: '2. Technical Spec',
    pdfs: ['dell.pdf', 'hp.pdf']
  }
]

async function mergeWithReusableTemplates () {
  // Load header/footer templates **once**
  const templatePortraitBytes = fs.readFileSync(headerTemplatePortraitPath)
  const templateLandscapeBytes = fs.readFileSync(headerTemplateLandscapePath)

  const templatePortraitDoc = await PDFDocument.load(templatePortraitBytes)
  const templateLandscapeDoc = await PDFDocument.load(templateLandscapeBytes)

  const templatePortraitPage = (await templatePortraitDoc.copyPages(templatePortraitDoc, [0]))[0]
  const templateLandscapePage = (await templateLandscapeDoc.copyPages(templateLandscapeDoc, [0]))[0]

  // First pass: calculate total pages
  let totalPages = 0
  for (const section of sections) {
    for (const pdfFile of section.pdfs) {
      const contentBytes = fs.readFileSync(pdfFile)
      const doc = await PDFDocument.load(contentBytes)
      totalPages += doc.getPageCount()
    }
  }

  const finalDoc = await PDFDocument.create()
  let globalPageCounter = 1

  for (const section of sections) {
    for (const pdfFile of section.pdfs) {
      const contentBytes = fs.readFileSync(pdfFile)
      const contentDoc = await PDFDocument.load(contentBytes)
      const pages = await finalDoc.copyPages(contentDoc, contentDoc.getPageIndices())

      for (const page of pages) {
        finalDoc.addPage(page)

        const { width, height } = page.getSize()
        const orientation = width > height ? 'landscape' : 'portrait'

        // Select template page
        const templatePageToDraw = orientation === 'portrait' ? templatePortraitPage : templateLandscapePage

        page.drawPage(templatePageToDraw)

        // Fill AcroForm fields
        const templateDoc = orientation === 'portrait' ? templatePortraitDoc : templateLandscapeDoc
        const form = templateDoc.getForm()

        try {
          const sectionField = form.getTextField('SECTION_FIELD')
          const pageField = form.getTextField('PAGE_NUMBER_FIELD')

          sectionField.setText(section.title)
          pageField.setText(`Page ${globalPageCounter} of ${totalPages}`)

          form.flatten()
        } catch (err) {
          console.warn(`Could not fill form fields on page ${globalPageCounter}:`, err)
        }

        globalPageCounter++
      }
    }
  }

  const mergedBytes = await finalDoc.save()
  fs.writeFileSync(outputFile, mergedBytes)
  console.log(`Merged PDF created: ${outputFile} (Total pages: ${totalPages})`)
}

// Run
mergeWithReusableTemplates().catch(console.error)

/**
 *
  How to run:
  node merge-cli.js \
  header_footer_portrait.pdf \
  header_footer_landscape.pdf \
  final_report.pdf

 */
