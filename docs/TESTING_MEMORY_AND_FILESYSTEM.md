# Testing Memory and Filesystem MCP Servers

## Memory MCP Server

### What It Does

The Memory MCP server provides **graph-based memory** for context persistence. It stores information as a knowledge graph with:

- **Entities**: Nodes representing things (people, places, concepts, etc.)
- **Relations**: Connections between entities (relationships, interactions)
- **Observations**: Facts or information about entities

This allows the AI to remember information about users, conversations, and context across sessions.

### Available Tools

1. **`create_entities`** - Create new entities in the knowledge graph
   - Input: Array of objects with `name`, `entityType`, and `observations[]`
   - Example: Create a person entity with observations about them

2. **`create_relations`** - Create relationships between entities
   - Input: Array of objects with `from`, `to`, and `relationType`
   - Example: Link "John" to "Company XYZ" with relation "works_at"

3. **`delete_relations`** - Remove relationships

4. **`read_graph`** - Get the entire knowledge graph

5. **`search_nodes`** - Search for entities by name, type, or observation content

6. **`open_nodes`** - Get specific entities by name

### How to Test Memory

**In the Chat:**

1. Select "Memory" from the agent dropdown or use `/memory` command

2. **Store Information:**
   ```
   Remember that my favorite programming language is TypeScript and I work at Acme Corp
   ```

3. **Create Entities Explicitly:**
   ```
   Create an entity for "John Doe" who is a "person" with observations "loves pizza" and "lives in New York"
   ```

4. **Query Memory:**
   ```
   What do you remember about me?
   ```
   or
   ```
   Search for entities related to "TypeScript"
   ```

5. **View Entire Graph:**
   ```
   Show me everything in your memory
   ```

**Note:** Memory doesn't require API keys or environment variables - it uses local storage.

---

## Filesystem MCP Server

### What It Does

The Filesystem MCP server provides **controlled file system access** for reading, writing, and managing files and directories. It's restricted to directories you specify at startup for security.

### Available Tools

1. **`read_file`** - Read contents of a file
   - Requires: `path` (string) - file path

2. **`read_multiple_files`** - Read multiple files at once

3. **`write_file`** - Create or overwrite a file
   - Requires: `path` (string), `content` (string)

4. **`edit_file`** - Make selective edits to a file using pattern matching

5. **`create_directory`** - Create a new directory

6. **`list_directory`** - List files and folders in a directory

7. **`move_file`** - Move or rename files/directories

8. **`search_files`** - Recursively search for files/directories

9. **`get_file_info`** - Get file metadata (size, modified date, etc.)

10. **`list_allowed_directories`** - See which directories are accessible

### How to Test Filesystem

**Important:** Filesystem MCP requires specifying allowed directories when starting the server. Since it's run via `npx`, you'll need to configure it.

**Configuration Note:**
The Filesystem server needs to be started with directory paths. In your registry configuration, you may need to add args like:
```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/directory"]
}
```

**In the Chat:**

1. Select "Filesystem" from the agent dropdown or use `/filesystem` command

2. **List Directory:**
   ```
   List the files in the current directory
   ```

3. **Read a File:**
   ```
   Read the file at path/to/file.txt
   ```

4. **Write a File:**
   ```
   Create a file called test.txt with content "Hello, World!"
   ```

5. **Search Files:**
   ```
   Search for all .js files in the current directory
   ```

6. **Get File Info:**
   ```
   Get information about package.json
   ```

**Testing Considerations:**

- Filesystem server requires directory paths to be specified
- The server is sandboxed to only access specified directories
- You'll need to update the server configuration in the registry to specify allowed directories

---

## Testing via Registry UI

1. Go to the **Registry** page
2. Find **Memory** or **Filesystem** in the list
3. Click **Test** button to verify tool discovery
4. Check that tools are listed correctly

## Testing via Chat

1. Go to the **Chat** page
2. Select **Memory** or **Filesystem** from the agent dropdown
3. Try the example queries above
4. Monitor the responses and any errors

## Troubleshooting

### Memory Issues
- **Error about `create_entities` arguments**: The tool requires an `entities` array parameter
- **No tools found**: Make sure tool discovery has run successfully

### Filesystem Issues
- **Permission denied**: Check that directory paths are correctly specified in server args
- **No tools found**: Tool discovery may have failed - try the Test button in registry
- **Path not found**: Ensure the directory exists and is accessible

## Example Memory Test Flow

```
User: Remember that I'm working on a project called "MyAwesomeApp" and my deadline is January 15th

AI: [Creates entities and stores the information]

User: What do you remember about my project?

AI: [Searches memory and retrieves the information about MyAwesomeApp and deadline]

User: Create a relation between me and "MyAwesomeApp" with relation type "working_on"

AI: [Creates the relation in the knowledge graph]
```

## Example Filesystem Test Flow

```
User: List the files in the backend directory

AI: [Lists directory contents]

User: Read the contents of backend/package.json

AI: [Reads and displays the file]

User: Create a new file called test-output.txt with the content "Test successful"

AI: [Creates the file]
```
