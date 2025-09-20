// Utility functions for file conversion operations
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const { exec } = require('child_process')
const execAsync = promisify(exec)

/**
 * Convert a file:// URL to a file path
 * @param {string} fileUrl - URL starting with file://
 * @returns {string} - Local file path
 */
function convertFileUrlToPath (fileUrl) {
  // Handle file:// URLs and convert to file system paths
  if (fileUrl.startsWith('file://')) {
    // Remove the file:// protocol
    let filePath = fileUrl.substring(7) // Remove 'file://'

    // Handle Windows drive letters (e.g., /C:/path -> C:/path)
    if (filePath.startsWith('/') && filePath.length > 2 && filePath[2] === ':') {
      filePath = filePath.substring(1)
    }

    // Decode URL-encoded characters
    filePath = decodeURIComponent(filePath)

    return filePath
  }

  // If it's already a regular path, return as-is
  return fileUrl
}

/**
 * Find an appropriate conversion tool for a file
 * @param {string} filePath - Path to the file
 * @param {Array} tools - List of conversion tools
 * @returns {Object|null} - Selected conversion tool or null
 */
function findConversionTool (filePath, tools) {
  // Convert file URL to path if needed
  const localPath = convertFileUrlToPath(filePath)
  const ext = path.extname(localPath).toLowerCase().slice(1)

  console.log(`Looking for conversion tool for extension: '${ext}'`)
  console.log(`Available tools: ${tools}`)

  if (!Array.isArray(tools)) {
    console.error('Tools is not an array:', tools)
    return null
  }

  for (const tool of tools) {
    console.log(`Checking tool: ${tool.name}, enabled: ${tool.enabled}, extensions: ${tool.extensions}`)
    if (tool.enabled && tool.extensions.includes(ext)) {
      console.log(`Found matching tool: ${tool.name}`)
      return tool
    }
  }

  console.log(`No conversion tool found for extension: ${ext}`)
  return null
}

/**
 * Convert a file to PDF format
 * @param {string} inputPath - Path to input file
 * @param {Object} tool - Conversion tool to use
 * @param {string} outputDir - Output directory for the PDF
 * @param {string} outDir - Alternative output directory
 * @returns {Promise<string>} - Path to the created PDF
 */
async function convertToPdf (inputPath, tool, outputDir, outDir) {
  // Convert file URL to path if needed
  const filePath = convertFileUrlToPath(inputPath)
  const fileName = path.basename(filePath, path.extname(filePath))
  const outputPath = path.join(outputDir, `${fileName}.pdf`)

  // Normalize paths for Windows
  const normalizedFilePath = path.resolve(filePath)
  const normalizedOutputDir = path.resolve(outputDir)
  const normalizedInputDir = path.dirname(normalizedFilePath)

  // Normalize tool path for command line
  const normalizedToolPath = path.resolve(tool.path).replace(/\\/g, '/')

  // console.log(`Converting ${filePath} to ${outputPath}`)
  console.log(`Using tool: ${tool.name}`)
  // console.log(`Original tool path: ${tool.path}`)
  // console.log(`Normalized tool path: ${normalizedToolPath}`)
  // console.log(`Tool arguments template: ${tool.arguments}`)
  // console.log(`Input file exists: ${fs.existsSync(filePath)}`)
  // console.log(`Output directory exists: ${fs.existsSync(outputDir)}`)

  // Check if output file exists and is newer than input
  if (fs.existsSync(outputPath)) {
    const inputStat = fs.statSync(filePath)
    const outputStat = fs.statSync(outputPath)

    if (outputStat.mtime >= inputStat.mtime) {
      console.log(`Output file ${outputPath} is up to date, skipping conversion`)
      return outputPath // Skip conversion
    } else {
      console.log(`Output file ${outputPath} is older than input, will overwrite`)
      // Delete the stale file so we can detect conversion failures
      fs.unlinkSync(outputPath)
      console.log(`Deleted stale output file: ${outputPath}`)
    }
  }

  // console.log(`Normalized input path: ${normalizedFilePath}`)
  // console.log(`Normalized output dir: ${normalizedOutputDir}`)
  // console.log(`Normalized input dir: ${normalizedInputDir}`)
  // console.log(`Normalized tool path: ${normalizedToolPath}`)

  // Build command with normalized paths
  let command = tool.arguments
    .replace('%input', `"${normalizedFilePath}"`)
    .replace('%output', `"${outputPath}"`)
    .replace('%inputFile', `"${normalizedFilePath}"`)
    .replace('%outputDir', `"${normalizedOutputDir}"`)
    .replace('%inputDir', `"${normalizedInputDir}"`)
    .replace('%outputFile', `"${outputPath}"`)
    .replace('%outdir', `"${outDir || outputDir}"`)

  const fullCommand = `"${normalizedToolPath}" ${command}`

  // console.log(`Command template after replacement: ${command}`)
  console.log(`Final command: ${fullCommand}`)
  // console.log('Executing conversion command...')
  const result = await execAsync(fullCommand, { maxBuffer: 1024 * 1024 })
  console.log('Command execution result:', result)

  // Check if output file was actually created
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath)
    console.log(`✅ Output file created successfully: ${outputPath} (${stats.size} bytes)`)
    return outputPath
  } else {
    console.error(`❌ Conversion failed, output file not found: ${outputPath}`)
    throw new Error(`Conversion to PDF failed for ${filePath}`)
  }
}

module.exports = {
  convertFileUrlToPath,
  findConversionTool,
  convertToPdf
}
