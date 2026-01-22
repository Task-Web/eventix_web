# Eventix Clone

A fully functional Eventix clone built with vanilla HTML, CSS, and JavaScript (no frameworks). Features interactive seat selection, calendar picker, and Bruno Mars concert listings.


## Quick Start

Start the backend API:
```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

Start the frontend (in a second terminal):
```bash
cd frontend
npm install
npm run dev
```

Then open:
- `http://localhost:5173/`
- `http://localhost:5173/state-manage/`

## Features

### Homepage (index.html)
- Search bar with location, date range, and artist search
- Interactive calendar picker with dual-month view
- Location autocomplete from cities database
- Featured events carousel
- Responsive navigation bars

### Artist Listing Page (artist.html)
- Artist header with rating and category
- Concert listings with filters
- List/Calendar view toggle
- "Find Tickets" buttons for each concert
- Promoted hotel deals section

### Seat Selection Page (seats.html)
- **Interactive Canvas-based Seat Map**
  - Zoom in/out with mouse wheel or buttons
  - Pan by dragging
  - Schematic view (sections) at low zoom
  - Detailed view (individual seats) at high zoom
  - Click section to zoom in
  - Click seat to select
- **Hover Tooltips**
  - Show section, row, seat number
  - Display ticket type and price
  - Include fees notice
- **Mini-map** overview in corner
- **Ticket Panel** with:
  - Quantity selector
  - Price range slider
  - Lowest Price / Best Seats tabs
  - Ticket cards sorted by criteria

## File Structure

```
concert_tickets_2/
鈹溾攢鈹€ index.html                    # Homepage
鈹溾攢鈹€ artist.html                   # Concert listings
鈹溾攢鈹€ seats.html                    # Seat selection
鈹溾攢鈹€ state-manage/                 # Cookie-scoped state console
鈹溾攢鈹€ README.md                     # This file
鈹溾攢鈹€ css/
鈹?  鈹溾攢鈹€ common.css               # Shared styles
鈹?  鈹溾攢鈹€ homepage.css             # Homepage styles
鈹?  鈹溾攢鈹€ artist.css               # Artist page styles
鈹?  鈹斺攢鈹€ seats.css                # Seat selection styles
鈹溾攢鈹€ js/
鈹?  鈹溾攢鈹€ common.js                # Utility functions
鈹?  鈹溾攢鈹€ homepage.js              # Search & calendar
鈹?  鈹溾攢鈹€ artist.js                # Concert listings
鈹?  鈹溾攢鈹€ seats.js                 # Main controller
鈹?  鈹溾攢鈹€ seatmap-renderer.js      # Canvas rendering
鈹?  鈹溾攢鈹€ zoom-controller.js       # Zoom & pan
鈹?  鈹斺攢鈹€ tooltip-manager.js       # Seat tooltips
鈹溾攢鈹€ data/
鈹?  鈹溾攢鈹€ concerts.json            # Concert data
鈹?  鈹溾攢鈹€ venues.json              # Venue info
鈹?  鈹溾攢鈹€ dolby-live-seats.json    # Seat map data
鈹?  鈹斺攢鈹€ cities.json              # Location data
鈹溾攢鈹€ backend/                      # FastAPI state backend
鈹溾攢鈹€ docs/                         # API + state reference docs

в”њв”Ђв”Ђ frontend/                     # Vite + React frontend
鈹斺攢鈹€ assets/
    鈹溾攢鈹€ images/                  # Placeholder images
    鈹斺攢鈹€ icons/                   # Placeholder icons
```

## How to Run

1. Start the backend API (`uv run uvicorn app.main:app --reload --port 8000`).
2. Start the frontend (`npm install` then `npm run dev` inside `frontend/`).
3. Navigation flow:
   - Homepage -> Search for "Bruno Mars" -> Artist page
   - Artist page -> Click "Find Tickets" -> Seat selection page
   - Seat selection -> Zoom/pan to explore -> Click seats to select
4. Open `/state-manage/` to inspect and update per-user state.

## Docker

Run the full stack (same layout as basesite):
```bash
docker compose up --build
```

Then open `http://localhost:8001`.

## Technologies Used

- **HTML5** - Semantic markup, Canvas API
- **CSS3** - Grid, Flexbox, CSS Variables, Animations
- **JavaScript (ES6+)** - Modules, Async/Await, Arrow Functions
- **Canvas API** - For seat map rendering
- **No frameworks or libraries** - Pure vanilla JavaScript!

## Key Features Implemented

### Interactive Seat Map
- **Zoom**: Mouse wheel zoom towards cursor, zoom buttons, reset button
- **Pan**: Drag to move around the venue
- **View Switching**: Automatic switch between schematic (sections) and detailed (individual seats) based on zoom level
- **Tooltips**: Hover over seats to see details
- **Selection**: Click sections to zoom in, click seats to select

### Calendar Picker
- Dual-month view (Dec 2025 & Jan 2026)
- Date range selection (start/end dates)
- Date input fields with MM/DD/YYYY format
- Visual feedback for selected dates and ranges
- Reset, Cancel, Apply actions

### Search & Filtering
- Location autocomplete from 30+ US cities
- Artist/event search
- Date range filtering
- Price range slider
- Ticket quantity selection

### Data Structure
- JSON-based data files for concerts, venues, and seats
- Modular architecture for easy extension
- Pre-generated seat grids with randomized availability
- Dynamic pricing based on row proximity to stage

## Browser Compatibility

Tested and working on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Canvas rendering for 1000+ seats
- Efficient zoom/pan transforms
- Debounced mouse events
- Lazy seat grid generation

## Data Flow

1. **Homepage**: Load concerts.json 鈫?Display featured events 鈫?Search 鈫?Navigate to artist.html
2. **Artist Page**: Filter concerts by URL params 鈫?Display results 鈫?Navigate to seats.html
3. **Seat Selection**: Load concert + venue + seat data 鈫?Render canvas 鈫?Display tickets

## Customization

### Adding New Concerts
Edit `data/concerts.json`:
```json
{
  "id": "new-concert",
  "artistName": "Artist Name",
  "eventName": "Event Name",
  "venueId": "dolby-live",
  "date": "2025-12-31",
  "time": "20:00",
  ...
}
```

### Modifying Venue Layout
Edit `data/dolby-live-seats.json`:
```json
{
  "sections": [
    {
      "id": "FLOOR_101",
      "bounds": { "x": 350, "y": 450, "width": 150, "height": 200 },
      "rows": 15,
      "seatsPerRow": 12,
      ...
    }
  ]
}
```

## Known Limitations

- State is in-memory per cookie (resets on backend restart)
- No user authentication
- No actual payment processing
- Seat availability is randomized on page load

## Future Enhancements

- Shopping cart persistence
- Multi-seat selection
- Seat reservation timer
- 3D venue visualization
- Mobile-optimized layout
- Accessibility improvements (ARIA labels, keyboard navigation)

## License

This is a demonstration project. Not for commercial use.

## Credits

Inspired by Eventix.com. Built as an educational example of vanilla JavaScript web development.




