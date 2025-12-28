# Git Commands to Push to Main

## Quick Push (If you're already on main)

```bash
# 1. Check current branch
git status

# 2. If you're on main, just push:
git add .
git commit -m "Your commit message"
git push origin main
```

## Full Workflow (From Any Branch)

```bash
# 1. Check current branch and status
git status

# 2. Switch to main branch
git checkout main

# 3. Pull latest changes (if working with others)
git pull origin main

# 4. Stage your changes
git add .

# OR stage specific files:
git add file1.ts file2.ts

# 5. Commit your changes
git commit -m "Your commit message describing changes"

# 6. Push to main (this triggers Vercel + Amplify deployments!)
git push origin main
```

## If You Have Uncommitted Changes on Another Branch

```bash
# Option 1: Commit changes to current branch first
git add .
git commit -m "Changes"
git push origin your-branch-name

# Then merge to main:
git checkout main
git pull origin main
git merge your-branch-name
git push origin main

# Option 2: Stash changes, switch to main, then apply
git stash
git checkout main
git pull origin main
git stash pop
git add .
git commit -m "Your commit message"
git push origin main
```

## Common Commands Reference

```bash
# See current branch
git branch

# See what files changed
git status

# See what will be committed
git diff --staged

# Stage all changes
git add .

# Stage specific file
git add path/to/file.ts

# Commit with message
git commit -m "Description of changes"

# Push to main
git push origin main

# If push is rejected (someone else pushed), pull first:
git pull origin main
# Resolve conflicts if any, then:
git push origin main
```

## After Pushing

Once you run `git push origin main`:

1. ✅ **Vercel** will automatically deploy (check dashboard)
2. ✅ **Amplify** will automatically build and deploy (check console)
3. ✅ Both will deploy to production

## Quick Copy-Paste Version

```bash
git checkout main
git pull origin main
git add .
git commit -m "Your changes"
git push origin main
```

That's it! 🚀

