$env:PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION = 'yes reset the dev database'
cd "C:\Users\senti\OneDrive\Desktop\mcp-registry\backend"
npx prisma migrate reset --force
