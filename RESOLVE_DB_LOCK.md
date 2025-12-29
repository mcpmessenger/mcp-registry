# Resolve Database Lock Issue

The `backend/prisma/dev.db` file is locked and blocking the merge. Here's how to fix it:

## Quick Fix

### Option 1: Close Database-Locking Processes (Recommended)

1. **Stop any running backend servers**:
   ```powershell
   # Check if backend is running
   Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.Path -like "*backend*"}
   
   # Stop it if running
   # Or just close the terminal/server running the backend
   ```

2. **Then run**:
   ```powershell
   git checkout -- backend/prisma/dev.db
   git merge test/my-feature
   git push origin main
   ```

### Option 2: Force Exclude Database File

```powershell
# Stash everything except the db file
git stash push -k -m "Stash changes except db"

# Now merge
git merge test/my-feature

# Push
git push origin main

# Reapply stashed changes (if needed)
git stash pop
```

### Option 3: Skip the Database File Entirely

Since `dev.db` should be in `.gitignore` and is a local database file:

```powershell
# Remove it from git tracking temporarily
git rm --cached backend/prisma/dev.db

# Merge
git merge test/my-feature

# Push
git push origin main
```

## Recommended Steps:

1. **Close any backend servers** (most important!)
2. **Run these commands**:
   ```powershell
   git checkout -- backend/prisma/dev.db
   git merge test/my-feature
   git push origin main
   ```

The database file is just a local SQLite file and shouldn't block your deployment! 🚀

