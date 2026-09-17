// Emails are compared for equality across auth, editors, and
// access_requests, so every entry point needs to normalize the same way
// before it ever reaches the database.
export function normalizeEmail(email) {
  return (email || '').trim().toLowerCase()
}
