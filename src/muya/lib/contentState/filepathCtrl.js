const filepathCtrl = ContentState => {
  /**
   * insert filepath tag at the end of the current line.
   */
  ContentState.prototype.insertFilepath = function (filePath) {
    const { start } = this.cursor
    const { key } = start
    const block = this.getBlock(key)

    if (
      block.type === 'span' &&
      (
        block.functionType === 'codeContent' ||
        block.functionType === 'languageInput' ||
        block.functionType === 'thematicBreakLine'
      )
    ) {
      // You can not insert filepath into code block or language input...
      return
    }

    const { text } = block
    const filepathTag = `<filepath>${filePath}</filepath>`

    // Insert at the end of the current line
    block.text = text + filepathTag

    // Set cursor after the inserted tag
    const newOffset = text.length + filepathTag.length
    this.cursor = {
      start: { key, offset: newOffset },
      end: { key, offset: newOffset }
    }

    this.partialRender()
    this.muya.dispatchChange()
  }
}

export default filepathCtrl
