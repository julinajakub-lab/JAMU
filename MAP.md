# Mapa

The Map entry sits between Timeline and Next Trip. Leaflet 1.9.4 and
MarkerCluster 1.5.3 load from cdnjs with SHA-384 integrity checks. Map
tiles use OpenStreetMap, the brief's fallback, with quiet color styling.
All map UI copy is in `i18n-cs.js`.

**Basemap change verified 2 November 2026:** CARTO now requires an API key
and returns HTTP 200 watermark images without one, so a `tileerror` fallback
cannot detect the problem. To preserve the explicit no-additional-key
requirement, the map uses OSM directly. See the
[official CARTO notice](https://www.carto.com/basemaps/apikey/index.html).

## Places and privacy

`homes` records contain `{ member, town, lat, lng, geocode_name, by }`.
The newest record for each member wins. Only active members are mapped;
the ghost member is excluded. Homes use a structured city search, never
a street search. Each member card opens the existing sheet to edit a town.
Trip records keep their coordinates plus `geocode_name`, `geocode_query`
and `geocode_status`. Changing a place invalidates the previous coordinates.

Saving first shows the found name. A second save confirms it; refine the
town/country or trip address if necessary. Unfindable trips can be saved
without a marker and their organiser can fix the place below the map.
An unavailable lookup leaves the sheet and its inputs open for retry.

## Geocoding

The group explicitly uses Nominatim under its
[usage policy](https://operations.osmfoundation.org/policies/nominatim/).
Requests are serialized, cached, identify the website through the browser
Referer, and leave at least 1.1 seconds between requests. The live site uses
a shared, expiring lock record (a reserved UUID in `records`) so devices
cannot look up places concurrently. Cache entries live in the private
`map_geocode_cache` collection as well as localStorage. A seven-day lifetime
on unsuccessful searches permits later OSM corrections. Successful results
are reused. No new table, SQL migration, API key or secret is required.
`JAMU_CONFIG.geocodingUrl` can override the search endpoint if the service
needs to change; the existing connection configuration is unchanged.

Trips search address first, then place, within Czechia and Slovakia. Homes
search within those countries first, then abroad. No autocomplete requests
are made. A logged-in live Map visit backfills old trips sequentially.
Failures are attempted once per visit; a saved unsuccessful result is not
repeated on every render. Compare-and-swap updates protect concurrent edits.
The backfill stops when leaving the map or logging out. Demo mode never
backfills; it looks up places only when explicitly saving a sheet.

Opening `index.html` using `file://` always selects demo mode, even when
the repository's public Supabase configuration is present. Demo records
and geocoding cache are browser-local. Network access is still required
for the CDN libraries, map tiles and explicit place lookup.

## Interaction

All is the default filter. Trip and home markers cluster separately and
coincident markers can be expanded. Markers work with Tab/Enter; Escape
closes popups. Desktop wheel zoom starts only after clicking the map and
stops on blur/mouse leave. Touchscreens keep one-finger page scrolling;
pinch and zoom buttons remain available. Initial bounds fit all available
points with maximum zoom 7, or Czechia and Slovakia if no point is saved.
Cards, controls and popups follow the site's light/dark theme.

## Verification

Run `node --check app.js`, `node --check i18n-cs.js`, and `git diff --check`.
With Playwright available separately (via `NODE_PATH` or `JAMU_PLAYWRIGHT`),
run `node tests/map.cjs`. The test uses installed Microsoft Edge headlessly;
it downloads the pinned CDN fixtures to ignored `.qa/` and verifies their
integrity. All geocoding and database traffic is mocked. No live group data
is read or changed. Screenshots and the results report also go to `.qa/`.
Tests cover demo saves, lookup confirmation and fallbacks, caching, old
trip backfill, concurrent edits, two live clients sharing the request limit,
clustering, keyboard popups, and the 375px dark touch layout.
