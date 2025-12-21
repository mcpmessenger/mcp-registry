/**
 * Tool Parameter Parser
 * 
 * Parses natural language user requests and extracts parameters
 * based on the tool's input schema.
 */

interface ToolInputSchema {
  type: 'object'
  properties: Record<string, {
    type: string
    description?: string
  }>
  required?: string[]
}

/**
 * Parse natural language and extract tool parameters
 */
export function parseToolParameters(
  userMessage: string,
  toolName: string,
  inputSchema: ToolInputSchema
): Record<string, any> {
  const params: Record<string, any> = {}
  const lowerMessage = userMessage.toLowerCase()

  // Handle browser_navigate tool
  if (toolName === 'browser_navigate' && inputSchema.properties.url) {
    // Extract URL from message
    const urlMatch = userMessage.match(/https?:\/\/[^\s]+/i) || 
                     userMessage.match(/(?:go to|navigate to|visit|open)\s+([^\s]+)/i)
    if (urlMatch) {
      let url = urlMatch[0]
      // If it's not a full URL, try to make it one
      if (!url.startsWith('http')) {
        url = urlMatch[1] || urlMatch[0]
        if (!url.startsWith('http')) {
          url = `https://${url}`
        }
      }
      params.url = url
    }
  }

  // Handle browser_take_screenshot tool
  if (toolName === 'browser_take_screenshot') {
    // Check if user wants a screenshot
    if (lowerMessage.includes('screenshot') || lowerMessage.includes('capture') || lowerMessage.includes('picture')) {
      params.type = 'png' // Default to PNG
      
      // Check for full page
      if (lowerMessage.includes('full page') || lowerMessage.includes('entire page')) {
        params.fullPage = true
      }
    }
  }

  // Handle browser_snapshot tool
  if (toolName === 'browser_snapshot') {
    // Snapshot is usually called implicitly, but we can detect it
    if (lowerMessage.includes('snapshot') || lowerMessage.includes('accessibility') || lowerMessage.includes('structure')) {
      // No parameters needed for snapshot
    }
  }

  // Handle browser_click tool
  if (toolName === 'browser_click') {
    // Extract element description
    const clickMatch = userMessage.match(/(?:click|press|tap)\s+(?:on\s+)?(.+?)(?:\s+and|\s+then|$)/i)
    if (clickMatch) {
      params.element = clickMatch[1].trim()
    }
  }

  // Handle browser_type tool
  if (toolName === 'browser_type') {
    // Extract text to type
    const typeMatch = userMessage.match(/(?:type|enter|input)\s+(?:text\s+)?["']?([^"']+)["']?/i)
    if (typeMatch) {
      params.text = typeMatch[1].trim()
    }
    
    // Extract element if mentioned
    const elementMatch = userMessage.match(/(?:in|into|on)\s+(?:the\s+)?(.+?)(?:\s+(?:and|then|$))/i)
    if (elementMatch) {
      params.element = elementMatch[1].trim()
    }
  }

  // Handle browser_fill_form tool
  if (toolName === 'browser_fill_form') {
    // Extract form fields (basic parsing)
    const fields: any[] = []
    
    // Look for field:value patterns
    const fieldMatches = userMessage.match(/(\w+):\s*["']?([^"']+)["']?/gi)
    if (fieldMatches) {
      fieldMatches.forEach(match => {
        const [field, value] = match.split(':').map(s => s.trim())
        fields.push({ name: field, value })
      })
    }
    
    if (fields.length > 0) {
      params.fields = fields
    }
  }

  // Handle browser_evaluate tool
  if (toolName === 'browser_evaluate') {
    // Extract JavaScript code
    const codeMatch = userMessage.match(/(?:run|execute|eval)(?:uate)?\s+(?:javascript|js|code)?\s*:?\s*["']?([^"']+)["']?/i)
    if (codeMatch) {
      params.function = codeMatch[1]
    }
  }

  // Generic parameter extraction for common patterns
  // Look for key:value pairs
  if (Object.keys(params).length === 0) {
    for (const [paramName, paramSchema] of Object.entries(inputSchema.properties)) {
      // Check if parameter name is mentioned
      if (lowerMessage.includes(paramName.toLowerCase())) {
        // Try to extract value after the parameter name
        const paramMatch = new RegExp(`${paramName}[\\s:]+["']?([^"']+)["']?`, 'i').exec(userMessage)
        if (paramMatch) {
          params[paramName] = paramMatch[1].trim()
        }
      }
    }
  }

  // Validate required parameters
  if (inputSchema.required) {
    for (const requiredParam of inputSchema.required) {
      if (!params[requiredParam]) {
        // Try to infer from context
        if (requiredParam === 'url' && !params.url) {
          // Last resort: use the whole message as URL if it looks like one
          const urlLike = userMessage.trim()
          if (urlLike.includes('.') && !urlLike.includes(' ')) {
            params.url = urlLike.startsWith('http') ? urlLike : `https://${urlLike}`
          }
        }
      }
    }
  }

  return params
}

/**
 * Determine which tool to call based on user message
 */
export function selectTool(userMessage: string, availableTools: Array<{ name: string; description: string }>): string | null {
  const lowerMessage = userMessage.toLowerCase()

  // Map keywords to tool names
  const toolKeywords: Record<string, string[]> = {
    'browser_navigate': ['navigate', 'go to', 'visit', 'open', 'browse'],
    'browser_take_screenshot': ['screenshot', 'capture', 'picture', 'photo'],
    'browser_snapshot': ['snapshot', 'accessibility', 'structure', 'content'],
    'browser_click': ['click', 'press', 'tap'],
    'browser_type': ['type', 'enter', 'input', 'write'],
    'browser_fill_form': ['fill', 'form', 'submit'],
    'browser_evaluate': ['javascript', 'js', 'code', 'eval', 'execute'],
  }

  // Find matching tool
  for (const [toolName, keywords] of Object.entries(toolKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      const tool = availableTools.find(t => t.name === toolName)
      if (tool) {
        return toolName
      }
    }
  }

  // Default to navigate if URL-like
  if (userMessage.match(/https?:\/\//i) || userMessage.match(/^(?:go to|navigate|visit|open)\s+/i)) {
    const navigateTool = availableTools.find(t => t.name === 'browser_navigate')
    if (navigateTool) {
      return 'browser_navigate'
    }
  }

  // Default to first tool if available
  return availableTools.length > 0 ? availableTools[0].name : null
}

