const fs = require('fs')
const text = fs.readFileSync('app/chat/page.tsx', 'utf8')

const stack = []
let inString = null
let escape = false
let inLineComment = false
let inBlockComment = false
let line = 1

for (let i = 0; i < text.length; i++) {
  const ch = text[i]
  const next = text[i + 1]

  if (ch === '\n') {
    line++
    inLineComment = false
    continue
  }

  if (inLineComment) continue
  if (inBlockComment) {
    if (ch === '*' && next === '/') {
      inBlockComment = false
      i++
    }
    continue
  }

  if (inString) {
    if (escape) {
      escape = false
    } else if (ch === '\\\\') {
      escape = true
    } else if (ch === inString) {
      inString = null
    }
    continue
  }

  if (ch === '\'' || ch === '"' || ch === '`') {
    inString = ch
    continue
  }

  if (ch === '/' && next === '/') {
    inLineComment = true
    i++
    continue
  }
  if (ch === '/' && next === '*') {
    inBlockComment = true
    i++
    continue
  }

  if (ch === '{') {
    stack.push({ line })
  } else if (ch === '}') {
    stack.pop()
  }
}

console.log('remaining open braces:', stack.length)
stack.forEach((entry, idx) => {
  console.log(`#${idx + 1} line ${entry.line}`)
})


