I want to implement additional configration/preference pane (liek the keybinding preferences):
- Section name: Conversion Tools
    User should be able to add multiple of the following:
      Name: Name of the tool (e.g. DOCX to PDF using Libreoffice)
      Extensions: file extensions that are applicable (e.g. docx, doc)
      Path: Path to the installed tool (e.g. c:\program files\libreoffice\librewriter.exe)
      Arguments: cli arguments (e.g. --headless %inputFile %outputDir)
      Status: enabled/disabled


I want to implement a command under File->Export that will do the following:
- check if document is saved, show error otherwise
- put document into "readonly" mode so user cannot type
- check if there is an ordered list in the current document
- collect the corresponding file:// link(s) and create a data structure. It is given in sample-runner.js named sections
- if there are links outside ordered list lines show error (unless it's an empty/whitespace line)
- if there are ordered list items without file:// links show error
- for debugging purposes, output the dictionary in the console
- iterate over the sections data structure and create a new data structure (e.g sample-runner.js -> mergeList)
  - set the directory of the current active editor's file as working directory; all copy operations are destined here
  - if source (docs) is already PDF, just copy
  - convert the non-PDF documents to PDF using the tools in Conversion Tools preferences. Preserve the original document names in the filename
  - do not convert/copy if output file already exists and newer than source
- iterate over the mergeList and merge all the PDFs maintaining the order in the ordered list. Use pdf-lib for PDF handling. The algorithm is given in sample-runner.js (don't use the existing export system, it is not appropriate. This one is standalone.)


## PDF Page Resizing Feature

The document merge system now includes automatic PDF page resizing functionality:

### How it works:
- When processing PDF documents during merge operations, each page is checked for size
- If a page is not A4 sized (595.28 x 841.89 points at 72 DPI), it gets automatically resized
- The resizing maintains the original aspect ratio while fitting the content within A4 dimensions
- Both portrait and landscape orientations are supported

### Configuration:
- The feature is controlled by a preference setting: `resizePagesToA4`
- Default value: `true` (enabled)
- When disabled, pages keep their original sizes
- Can be configured in the preferences pane

### Technical Details:
- Uses pdf-lib's `page.setSize()` method for resizing
- A4 dimensions: 595.28 x 841.89 points (210mm x 297mm at 72 DPI)
- Tolerance of 5 points for determining if resizing is needed
- Scaling factor is calculated to fit content entirely within A4 bounds
- Error handling ensures merge continues even if individual page resizing fails

### Benefits:
- Ensures consistent document formatting across different source PDFs
- Prevents layout issues when applying templates or overlays
- Maintains readability by preserving aspect ratios
- Optional feature that can be disabled if original sizes are preferred

