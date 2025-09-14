// Configuration for Conversion Tools preferences
// This file can be used for any configuration options specific to conversion tools

export const defaultConversionTools = [
  {
    name: 'LibreOffice',
    extensions: ['docx', 'doc', 'xlsx', 'xls'],
    path: 'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    arguments: '--headless --convert-to pdf %input --outdir %inputDir',
    enabled: true
  },
  {
    name: 'Pandoc DOCX to PDF',
    extensions: ['docx', 'doc'],
    path: '',
    arguments: '%input -o %output',
    enabled: false
  }
]
