// Configuration for Conversion Tools preferences
// This file can be used for any configuration options specific to conversion tools

export const defaultConversionTools = [
  {
    name: 'LibreOffice DOCX to PDF',
    extensions: ['docx', 'doc'],
    path: '',
    arguments: '--headless --convert-to pdf %input --outdir %output',
    enabled: false
  },
  {
    name: 'Pandoc DOCX to PDF',
    extensions: ['docx', 'doc'],
    path: '',
    arguments: '%input -o %output',
    enabled: false
  }
]
