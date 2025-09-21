// Utility functions for document section parsing

/**
 * Parse markdown content to extract document sections with file links
 * @param {string} markdown - Markdown content to parse
 * @returns {Array} - Array of section objects with title and document links
 */
function parseDocumentSections (markdown) {
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
      // Log the structure for debugging
      console.log(`Creating section with nesting level ${nestingLevel}, will be numbered as "${nestedNumber}"`)

      // Extract text content without the original numbering
      let cleanContent = content

      // Extract original content - need to handle multiple formats:
      // Format 1: "1. Introduction" -> "Introduction"
      // Format 2: "2.1 Hardware Specs" -> "Hardware Specs"
      // Format 3: "1.2.3. Section Title" -> "Section Title"
      cleanContent = content.replace(/^\s*\d+(?:\.\d+)*\.?\s+/, '')

      // Handle the case where there might be a second section number
      // e.g. "3.1 1. Software" -> "Software"
      cleanContent = cleanContent.replace(/^\d+(?:\.\d+)*\.?\s+/, '')

      console.log(`After removing section numbers, content: "${cleanContent}"`)

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
        // Format the section number with proper hierarchical numbering
        // Main sections (depth 0) get a dot after the number: 1., 2., 3., 4.
        // Subsections do not get a dot: 3.1, 3.2, 3.1.1
        const formattedNumber = nestingLevel === 0 ? `${nestedNumber}.` : nestedNumber
        console.log(`Formatting section number: nestingLevel=${nestingLevel}, raw=${nestedNumber}, formatted=${formattedNumber}`)
        currentSection = {
          title: `${formattedNumber} ${cleanContent}`,
          docs: []
        }

        // Log the created section title for debugging
        console.log(`Created section with title: "${currentSection.title}"`)

        // Check for file links in the original content
        const fileLinkMatch = content.match(/\[([^\]]+)\]\((file:\/\/[^)]+)\)/)
        if (fileLinkMatch) {
          const linkText = fileLinkMatch[1]
          const fileUrl = fileLinkMatch[2]
          const fitToPage = linkText.includes('🔍')
          if (fitToPage) {
            console.log(`Found file link: text="${linkText}", url="${fileUrl}", fitToPage=${fitToPage}`)
          }
          currentSection.docs.push({
            url: fileUrl,
            fitToPage: fitToPage
          })
        } else {
          // Only throw an error if it's a nested item (not a main section)
          if (nestingLevel > 0) {
            // Ordered list item without file link - show error as per requirements
            throw new Error(`Section "${nestedNumber} ${cleanContent}" has missing document link`)
          }
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
}

module.exports = {
  parseDocumentSections
}
