I want to implement additional configration/preference pane (liek the keybinding preferences):
- Section name: Conversion Tools
    User should be able to add multiple of the following:
      Name: Name of the tool (e.g. DOCX to PDF using Libreoffice)
      Extensions: file extensions that are applicable (e.g. docx, doc)
      Path: Path to the installed tool (e.g. c:\program files\libreoffice\librewriter.exe)
      Arguments: cli arguments (e.g. --headless %inputfile %ooutputfile)
      Status: enabled/disabled


I want to implement a command under File->Export that will do the following:
- check if document is saved, show error otherwise
- put document into "readonly" mode so user cannot type
- check if there is an ordered list in the current document
- collect the corresponding file:// link(s) and create a data structure. It is given in sample-runner.js named sections
- if there are links outside ordered list lines show error
- if there are ordered list items without file:// links show error
- for debugging purposes, output the dictionary in the console
- iterate over the ordered list
  - convert all the non-PDF documents to PDF using the tools in Conversion Tools preferences
  - save them to the same folder as active document
  - do not convert if output file already exists and newer than source 
- merge all the PDFs maintaining the order in the ordered list. Use pdf-lib for PDF handling. A sample on how the algorithm is given in sample-runner.js

