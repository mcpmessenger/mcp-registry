/**
 * Script to fix duplicate models in Prisma schema
 * 
 * This script identifies and documents the duplicate models that need to be removed.
 * Run this before creating a migration.
 */

console.log('🔍 Schema Duplicate Fix Guide')
console.log('')
console.log('The Prisma schema has duplicate models:')
console.log('')
console.log('1. Conversation (lines 162-179 and 239-256)')
console.log('2. Message (lines 181-195 and 258-272)')
console.log('3. ToolInvocation (lines 197-214 and 274-290)')
console.log('4. Memory (lines 216-237 and 292-313)')
console.log('')
console.log('Action Required:')
console.log('1. Remove models at lines 162-237 (first set)')
console.log('2. Keep models at lines 239-313 (second set - more complete)')
console.log('3. Add unique constraint to Memory model:')
console.log('   @@unique([conversationId, key])')
console.log('   @@unique([userId, key])')
console.log('')
console.log('After fixing, run: npm run migrate')
