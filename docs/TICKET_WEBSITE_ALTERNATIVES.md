# Alternative Ticket Websites for Automated Access

## Problem

Ticketmaster has strong bot detection that blocks automated browsers. Here are alternative ticket websites that may work better with Playwright.

## Recommended Alternatives

### 1. **StubHub** (Recommended)
- **URL**: https://www.stubhub.com
- **Best For**: Resale tickets, often better bot tolerance
- **Try**: `go to stubhub.com and look for LCD Soundsystem tickets`

### 2. **SeatGeek**
- **URL**: https://www.seatgeek.com
- **Best For**: Aggregated ticket listings, good search functionality
- **Try**: `go to seatgeek.com and search for LCD Soundsystem New York`

### 3. **Eventbrite**
- **URL**: https://www.eventbrite.com
- **Best For**: Smaller events, concerts, festivals
- **Bot Tolerance**: Generally more permissive
- **Try**: `go to eventbrite.com and find LCD Soundsystem events`

### 4. **AXS**
- **URL**: https://www.axs.com
- **Best For**: Official venue tickets, some major venues use this
- **Try**: `go to axs.com and search for concerts in New York`

### 5. **TicketWeb**
- **URL**: https://www.ticketweb.com
- **Best For**: Independent venues, smaller shows
- **Bot Tolerance**: Usually works well
- **Try**: `go to ticketweb.com`

## Usage Examples

### StubHub
```
go to stubhub.com and look for LCD Soundsystem tickets in New York
```

### SeatGeek
```
go to seatgeek.com and search for LCD Soundsystem concert dates
```

### Eventbrite
```
go to eventbrite.com and find LCD Soundsystem events
```

## Why These Might Work Better

1. **Less Aggressive Bot Detection**: Some sites have more lenient automated access policies
2. **Different Infrastructure**: Different CDN/security providers may have different detection rules
3. **Public Data**: Some sites display more information publicly without requiring sign-in

## Notes

- **Bot detection varies**: Even these sites may implement protections, but they're often less strict than Ticketmaster
- **Try multiple**: If one doesn't work, try another
- **Check official sites**: Some artists/venues have their own ticketing on their official websites
- **Use official APIs**: When available, official APIs are always preferred over scraping

## Native Orchestrator Integration

The native orchestrator now supports these ticket sites automatically. Just mention the site name:

- "go to stubhub.com"
- "check seatgeek.com for tickets"
- "look on eventbrite"

The system will automatically extract the domain and construct the correct URL.

