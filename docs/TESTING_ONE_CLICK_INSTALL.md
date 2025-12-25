# Testing Guide: One-Click Installation Feature

This guide walks you through testing the newly implemented one-click installation feature for Cursor and Claude Desktop.

## Prerequisites

1. **Backend running** on `http://localhost:3001`
2. **Frontend running** on `http://localhost:3000`
3. **At least one MCP server** registered in the registry (with a `command` field)
4. **Browser** with clipboard access permissions
5. **Cursor installed** (optional, for testing deep-links)

## Quick Start

### 1. Start the Backend

```bash
cd backend
npm install  # if not already done
npm start
```

Backend should be running at `http://localhost:3001`

### 2. Start the Frontend

```bash
# From project root
pnpm install  # if not already done
NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm dev
```

Frontend should be running at `http://localhost:3000`

### 3. Navigate to Registry

Open your browser and go to:
```
http://localhost:3000/registry
```

## Test Cases

### Test Case 1: Cursor Deep-Link Installation ✅

**Objective:** Verify that clicking "Install in Cursor" triggers a deep-link navigation.

**Steps:**
1. Find a server card in the registry that has a `command` field (e.g., "Nano Banana MCP" or any STDIO server)
2. Click the **"Install"** button on the server card
3. Select **"Install in Cursor"** from the dropdown menu
4. A permissions dialog should appear showing the server's capabilities and tools
5. Click **"Confirm"** in the permissions dialog

**Expected Results:**
- ✅ Permissions dialog appears and shows server permissions
- ✅ After confirming, the browser attempts to navigate to a `cursor://mcp/install?config=...` URI
- ✅ A toast notification appears saying: **"Opening Cursor"** with description **"Attempting to install server in Cursor..."**
- ✅ If Cursor is installed, it should open and prompt to install the server
- ✅ If Cursor is not installed, the browser may show an error or do nothing (this is expected)

**How to Verify:**
- Check the browser's address bar - it should briefly show the `cursor://` URI
- Check browser console for any errors
- Look for the toast notification in the top-right corner
- If Cursor is installed, verify it opens and shows the installation prompt

---

### Test Case 2: Claude Desktop Clipboard Copy ✅

**Objective:** Verify that clicking "Install in Claude Desktop" copies the config to clipboard.

**Steps:**
1. Find a server card in the registry that has a `command` field
2. Click the **"Install"** button on the server card
3. Select **"Install in Claude Desktop"** from the dropdown menu
4. A permissions dialog should appear
5. Click **"Confirm"** in the permissions dialog

**Expected Results:**
- ✅ Permissions dialog appears
- ✅ After confirming, a toast notification appears: **"Config copied to clipboard!"** with description **"Paste it into your Claude Desktop config file."**
- ✅ The clipboard now contains valid JSON

**How to Verify:**
1. **Check the toast notification** - should appear in top-right corner
2. **Paste the clipboard** (Ctrl+V or Cmd+V) into a text editor
3. **Verify the JSON structure:**
   ```json
   {
     "mcpServers": {
       "server-id-here": {
         "command": "npx",
         "args": ["-y", "package-name"],
         "env": {}
       }
     }
   }
   ```
4. **Validate JSON** - paste into a JSON validator or check it's valid JSON

**Manual Clipboard Check:**
```bash
# On Windows (PowerShell)
Get-Clipboard

# On macOS/Linux
pbpaste
```

---

### Test Case 3: Missing Command Validation ❌

**Objective:** Verify that servers without a `command` field show an error.

**Steps:**
1. Find or create a server that **does NOT have a `command` field** (or temporarily remove it)
2. Click the **"Install"** button on that server card
3. Select either **"Install in Cursor"** or **"Install in Claude Desktop"**
4. Confirm the permissions dialog

**Expected Results:**
- ✅ Permissions dialog appears normally
- ✅ After confirming, a **red error toast** appears
- ✅ Toast title: **"Cannot install"**
- ✅ Toast description: **"Server configuration is missing a command."**
- ✅ No deep-link navigation occurs (for Cursor)
- ✅ Nothing is copied to clipboard (for Claude Desktop)

**How to Verify:**
- Check for the error toast with red/destructive styling
- Verify the error message is clear and helpful
- Confirm no navigation or clipboard action occurred

**Note:** You may need to temporarily modify a server's data or create a test server without a command field to test this scenario.

---

### Test Case 4: Generic Install Dialog (Windsurf/CLI) 📋

**Objective:** Verify that other clients still use the generic install dialog.

**Steps:**
1. Find a server card in the registry
2. Click the **"Install"** button
3. Select **"Install in Windsurf"** or **"CLI Command"**
4. Confirm the permissions dialog

**Expected Results:**
- ✅ Permissions dialog appears
- ✅ After confirming, the **generic `InstallDialog`** opens (not bypassed)
- ✅ The dialog shows installation instructions and configuration
- ✅ Copy and Download buttons are available

**How to Verify:**
- Confirm the full install dialog appears (not just a toast)
- Verify you can copy the config from the dialog
- Verify you can download the config file

---

## Advanced Testing

### Testing Deep-Link Format

To inspect the Cursor deep-link format:

1. Open browser DevTools (F12)
2. Go to the **Network** tab
3. Perform Test Case 1 (Cursor installation)
4. Look for the navigation request - the URL should be visible
5. The format should be: `cursor://mcp/install?config=<base64-encoded-json>`

**Decode the config:**
```javascript
// In browser console, after the navigation:
// The config is base64 encoded, you can decode it:
const url = window.location.href; // if still on the page
// Or check the navigation in Network tab
// Then decode: atob(base64String)
```

### Testing Clipboard Content

To programmatically verify clipboard content:

1. Open browser DevTools Console
2. Run:
   ```javascript
   navigator.clipboard.readText().then(text => {
     console.log('Clipboard content:', text);
     const parsed = JSON.parse(text);
     console.log('Parsed JSON:', parsed);
     console.log('Has mcpServers?', 'mcpServers' in parsed);
   });
   ```

### Testing Error Handling

**Test permissions fetch failure:**
1. Stop the backend server
2. Try to install a server
3. Verify it still attempts installation for Cursor/Claude Desktop (graceful degradation)

**Test clipboard failure:**
- This is harder to test, but you can temporarily modify `copyToClipboard` to return `false` to see error handling

---

## Troubleshooting

### Issue: Toast notifications not appearing

**Solution:**
- Check that `Toaster` component is included in your layout
- Verify `hooks/use-toast.ts` is properly imported
- Check browser console for errors

### Issue: Clipboard copy not working

**Solution:**
- Ensure you're testing on `http://localhost` (clipboard API requires secure context)
- Check browser permissions for clipboard access
- Verify the fallback method works if clipboard API fails

### Issue: Deep-link not working

**Solution:**
- Verify Cursor is installed
- Check browser console for navigation errors
- Some browsers block `cursor://` protocol - this is expected behavior
- The feature should still show the toast notification

### Issue: Permissions dialog not appearing

**Solution:**
- Check backend is running and accessible
- Verify `/v0.1/servers/{serverId}/permissions` endpoint works
- Check browser console for API errors

---

## Checklist

Before marking as complete, verify:

- [ ] Cursor deep-link triggers navigation and shows toast
- [ ] Claude Desktop copies valid JSON to clipboard and shows toast
- [ ] Missing command shows error toast
- [ ] Windsurf/CLI still show generic dialog
- [ ] Permissions dialog appears for all clients
- [ ] Error handling works when backend is unavailable
- [ ] Toast notifications appear and dismiss correctly
- [ ] No console errors during testing

---

## Next Steps

After testing, document any issues found and:
1. Create GitHub issues for bugs
2. Update the implementation if needed
3. Proceed with the next task: **LangchainMCP `fromRegistry(url)` helper**

---

*Happy Testing! 🚀*

