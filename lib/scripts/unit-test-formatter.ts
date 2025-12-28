import assert from 'assert'
import { parsePlaywrightSnapshot } from '../response-formatter'

async function run() {
  // Craft a sample Playwright YAML-like snapshot where UI has 'Favorite' button near a date
  const snapshot = `- h4 "May"
- h4 "14"
- p "2026"
- link "Favorite" [ref=1]:
  /url: /some/favorite
- link "Iration" [ref=2]:
  /url: /artist/iration
- p "See Tickets" [ref=3]:
  /url: /see-tickets`

  const parsed = parsePlaywrightSnapshot(snapshot)
  // Ensure Iration appears in events, and Favorite is not used as an event name
  const irationEvents = parsed.events?.filter(e => e.name && e.name.toLowerCase().includes('iration')) || []
  assert(irationEvents.length > 0, 'Expected Iration to be extracted as an event')

  const favoriteEvents = parsed.events?.filter(e => e.name && e.name.toLowerCase().includes('favorite')) || []
  assert(favoriteEvents.length === 0, 'Did not expect Favorite to be extracted as event name')

  console.log('✅ Formatter unit tests passed')
}

run().catch(err => {
  console.error('Formatter tests failed:', err)
  process.exit(1)
})
