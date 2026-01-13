# Filesystem MCP Server Setup Guide

## Overview

The Filesystem MCP server provides controlled file system access for reading, writing, and managing files and directories. For security, it requires you to specify which directories it can access.

## Quick Setup

### Option 1: Use the Prepopulate Script (Recommended)

The script automatically configures the Filesystem server with your project root directory:

```bash
cd backend
npm run prepopulate-filesystem
```

This will:
- Configure the server to access your project root directory
- Update the server's args with the directory path
- Set up metadata for the allowed directories

### Option 2: Manual Configuration via UI

1. Go to the **Registry** page in your app
2. Find **Filesystem** in the server list
3. Click **Edit**
4. In the **Args** field, add directory paths after the package name:
   ```json
   ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory1", "/path/to/directory2"]
   ```
5. Click **Save**

### Option 3: Customize the Script

Edit `backend/src/scripts/prepopulate-filesystem.ts` to specify custom directories:

```typescript
const allowedDirectories = [
  '/path/to/your/project',      // Your project directory
  '/path/to/documents',          // Documents folder
  '/tmp',                        // Temporary files
  // Add more directories as needed
]
```

Then run:
```bash
cd backend
npm run prepopulate-filesystem
```

## Directory Path Format

### Windows
Use forward slashes or escaped backslashes:
```json
["-y", "@modelcontextprotocol/server-filesystem", "C:/Users/YourName/Projects", "D:/Documents"]
```

### Linux/Mac
Use absolute paths:
```json
["-y", "@modelcontextprotocol/server-filesystem", "/home/username/projects", "/tmp"]
```

### Paths with Spaces
If directory paths contain spaces, they should be properly quoted in the JSON:
```json
["-y", "@modelcontextprotocol/server-filesystem", "C:/Users/My Name/Projects"]
```

## Security Considerations

⚠️ **Important Security Notes:**

1. **Only grant access to directories you trust** - The Filesystem server can read, write, and delete files in allowed directories
2. **Use absolute paths** - Relative paths may not resolve correctly
3. **Start with minimal access** - Only add directories you actually need
4. **Avoid system directories** - Don't grant access to `/`, `C:\`, `/etc`, etc.

### Recommended Approach

Start with just your project directory:
```json
["-y", "@modelcontextprotocol/server-filesystem", "/path/to/your/project"]
```

Then add more directories as needed.

## Testing the Setup

After configuring, test the Filesystem server:

1. **Run tool discovery:**
   ```bash
   cd backend
   npm run integrate-top-20
   ```

2. **Test in Chat:**
   - Select "Filesystem" from the agent dropdown
   - Try: `List files in the current directory`
   - Try: `Read package.json`
   - Try: `Get information about README.md`

3. **Test in Registry:**
   - Go to Registry page
   - Find Filesystem server
   - Click "Test" button to verify tools are discovered

## Available Tools

Once configured, the Filesystem server provides these tools:

1. **`read_file`** - Read contents of a file
   - Requires: `path` (string)

2. **`read_multiple_files`** - Read multiple files at once
   - Requires: `paths` (array of strings)

3. **`write_file`** - Create or overwrite a file
   - Requires: `path` (string), `content` (string)

4. **`edit_file`** - Make selective edits using pattern matching
   - Requires: `path` (string), `edits` (array)

5. **`create_directory`** - Create a new directory
   - Requires: `path` (string)

6. **`list_directory`** - List files and folders
   - Requires: `path` (string)

7. **`move_file`** - Move or rename files/directories
   - Requires: `source` (string), `destination` (string)

8. **`search_files`** - Recursively search for files
   - Requires: `pattern` (string), `path` (string)

9. **`get_file_info`** - Get file metadata
   - Requires: `path` (string)

10. **`list_allowed_directories`** - See which directories are accessible
    - No arguments required

## Example Usage

### In Chat

```
/filesystem List files in the project root
/filesystem Read the contents of package.json
/filesystem Create a file called test.txt with content "Hello, World!"
/filesystem Search for all .ts files in the backend directory
/filesystem Show me what directories are allowed
```

### Common Tasks

**List directory contents:**
```
List all files in the backend/src directory
```

**Read a file:**
```
Read the file at backend/package.json
```

**Write a file:**
```
Create a file called notes.md with the content "# My Notes\n\nThese are my notes."
```

**Search for files:**
```
Find all TypeScript files in the project
```

**Get file information:**
```
Get information about the README.md file
```

## Troubleshooting

### "Permission denied" or "Path not found" errors

- **Check directory paths are correct** - Use absolute paths
- **Verify directories exist** - The directories must exist before the server starts
- **Check path format** - On Windows, use forward slashes or properly escaped backslashes
- **Verify permissions** - Ensure the process has read/write permissions to the directories

### "No tools found"

- **Run tool discovery:**
  ```bash
  cd backend
  npm run integrate-top-20
  ```
- **Check server configuration** - Verify args are correctly formatted in the database
- **Check server logs** - Look for errors when the server starts

### Server won't start

- **Verify package is available:**
  ```bash
  npx -y @modelcontextprotocol/server-filesystem --help
  ```
- **Check args format** - Ensure JSON is valid and paths are correct
- **Check for path issues** - Spaces in paths may need special handling

## Updating Directory Access

To add or remove directories:

1. **Edit the script** (`backend/src/scripts/prepopulate-filesystem.ts`)
2. **Update the `allowedDirectories` array**
3. **Run the script again:**
   ```bash
   npm run prepopulate-filesystem
   ```

Or edit directly in the Registry UI and update the Args field.

## Next Steps

After setup:
1. ✅ Run tool discovery: `npm run integrate-top-20`
2. ✅ Test in the chat interface
3. ✅ Try reading/writing files
4. ✅ Verify security by checking `list_allowed_directories`

For more information, see the [Filesystem MCP Server documentation](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem).
