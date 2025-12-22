const normalizeDatabaseUrl = () => {
  const rawUrl = process.env.DATABASE_URL || ''
  if (!rawUrl) return

  const trimmed = rawUrl.trim()
  if (trimmed.includes('/cloudsql/') && trimmed.includes('@/')) {
    process.env.DATABASE_URL = trimmed.replace('@/', '@localhost/')
  } else {
    process.env.DATABASE_URL = trimmed
  }
}

normalizeDatabaseUrl()
