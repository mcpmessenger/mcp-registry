# Update .env File with New Password

## Current Issue
Authentication is still failing, which means the `.env` file still has the old password.

## Steps to Fix

### 1. Open backend/.env File

Open `backend/.env` in your editor.

### 2. Find the DATABASE_URL Line

Look for a line that starts with `DATABASE_URL=`

### 3. Update the Password

Replace the password part in the URL:

**Current format:**
```env
DATABASE_URL="postgresql://postgres:OLD_PASSWORD@34.56.74.73:5432/mcp_registry"
```

**New format (replace OLD_PASSWORD with your new password):**
```env
DATABASE_URL="postgresql://postgres:YOUR_NEW_PASSWORD@34.56.74.73:5432/mcp_registry"
```

### 4. Important: URL Encoding

If your password contains special characters, you may need to URL-encode them:

- `@` becomes `%40`
- `#` becomes `%23`
- `$` becomes `%24`
- `%` becomes `%25`
- `&` becomes `%26`
- `+` becomes `%2B`
- `=` becomes `%3D`
- `/` becomes `%2F`
- `?` becomes `%3F`
- ` ` (space) becomes `%20`

### 5. Save the File

Save the `.env` file after updating.

### 6. Run Migrations Again

```powershell
cd backend
npx prisma migrate deploy
```

## Example

If your new password is `MyNewPass123!`, the DATABASE_URL should be:
```env
DATABASE_URL="postgresql://postgres:MyNewPass123!@34.56.74.73:5432/mcp_registry"
```

If your password is `Pass@Word#123`, it should be:
```env
DATABASE_URL="postgresql://postgres:Pass%40Word%23123@34.56.74.73:5432/mcp_registry"
```

