const ts = require('typescript')
const fs = require('fs')

const text = fs.readFileSync('app/chat/page.tsx', 'utf8')
const source = ts.createSourceFile('page.tsx', text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
const diagnostics = source.parseDiagnostics

if (diagnostics.length === 0) {
  console.log('Parse OK - No syntax errors')
  process.exit(0)
} else {
  console.log('Parse errors found:')
  diagnostics.forEach(diag => {
    const {line, character} = source.getLineAndCharacterOfPosition(diag.start)
    console.log(`Line ${line+1}, col ${character+1}: ${diag.messageText}`)
  })
  process.exit(1)
}

