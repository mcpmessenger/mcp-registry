# Quick Fix: "No tools available" Error for Playwright

If you're seeing the error **"No tools available for agent Playwright MCP Server"**, this means the Playwright server in your database doesn't have its tools registered.

## Quick Fix

Run this command in the `backend/` directory:

```bash
npm run fix-playwright
```

Or directly:

```bash
cd backend
ts-node src/scripts/fix-playwright-tools.ts
```

This will:
1. Find the Playwright server in your registry
2. Update it with all 14+ browser automation tools
3. Verify the tools are saved

## What Tools Will Be Registered

- `browser_navigate` - Navigate to URLs
- `browser_snapshot` - Get accessibility snapshot
- `browser_take_screenshot` - Take screenshots
- `browser_click` - Click elements
- `browser_type` - Type text
- `browser_fill_form` - Fill forms
- `browser_evaluate` - Execute JavaScript
- `browser_wait_for` - Wait for conditions
- `browser_close` - Close browser
- `browser_select_option` - Select dropdown options
- `browser_hover` - Hover over elements
- `browser_press_key` - Press keys
- `browser_resize` - Resize window
- `browser_drag` - Drag and drop

## After Running

1. Restart your backend server (if running)
2. Refresh your frontend
3. Try using Playwright again - tools should now be available!

## Why This Happens

This can happen if:
- The registration script wasn't run after database reset
- The tools weren't saved properly during initial registration
- Database migration cleared the tools field

## Alternative: Re-register All Official Servers

If you want to re-register all official servers (Playwright + LangChain):

```bash
npm run register-official
```

This will register/update all official MCP servers with their proper configurations.
