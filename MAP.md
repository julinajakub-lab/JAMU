# Memory map

`#map` is a static illustrated stage with interactive HTML buttons over inline SVG.
No runtime map library, tiles, zoom controls or boundary requests remain.
`map-shape.js` contains public-domain Natural Earth boundaries obtained once from
world-atlas 2.0.2 countries-50m (country ids 203/703), projected at cos(49.5°),
then simplified to 0.65 SVG units. Its exported `project(lat,lng)` is shared by
country geometry, town labels, routes, and points.

## Why the first version could look empty

The original renderer discarded all trips without valid numeric coordinates.
The repository's Dyje place text, “Dyje, ze Znojma do Hevlína”, returns an empty
Nominatim search result (verified during implementation). It describes an itinerary,
not a single searchable address. An unsuccessful backfill was persisted and skipped
on later renders; with no homes set there were no markers left to show.
This diagnosis uses repository data and an actual public geocoder response;
the private production database was not accessed.

Dyje now has four explicit documented town stops in `relics.js.mapRoute`, separate
from its existing narrative `route` object. The map can show these immediately,
including in demo mode. Live backfill also persists the coordinates and route,
even when a previous failed search was already recorded. It preserves concurrent
edits. Every trip appears in date order below the illustration regardless of
coordinates, and its organiser can open the existing trip sheet to fix the place.
An entirely empty stage includes a Czech explanation and an add-my-town action.

## Interaction and data

Mouse hover and keyboard focus open a memory card; a short leave delay bridges
the point and card. Click/Enter opens the trip. Touch opens the card, whose link
opens the trip. Escape/outside tap dismisses it. Cards use captain's picks or
uploaded photos, actual attendees and the first quote/story sentence. Photos only
take space after loading; failures leave no placeholder. Close points fan out;
homes in the same town overlap quietly, without numbered clusters. Filters fade
layers and remove hidden controls from keyboard interaction. Reduced motion
disables arrival/pulse animations. Existing theme tokens handle light/dark modes.

Town sheets, `homes` records, confirmed geocoding on save, cached searches,
application-wide request serialization and sequential live backfill remain.
Nominatim is called only on save/backfill, at most once per second with caching;
see https://operations.osmfoundation.org/policies/nominatim/.
`config.js` and its keys are unchanged. Iva is excluded from map markers.

## Verification

With Playwright installed separately and Microsoft Edge available, run
`node tests/map.cjs` (or set `JAMU_PLAYWRIGHT` to its module path).
Tests mock the geocoder and database; they never mutate production data.
They cover hover retention, keyboard navigation/Escape, filters, town confirmation,
Dyje route/photo/attendees/quote, unknown/empty states, 375px touch/dark/reduced
motion, live route persistence/backfill caching, and absence of tile/library
requests and uncaught browser errors. Screenshots go to ignored `.qa/`.
Also run `node --check app.js`, `node --check map-shape.js`, and `git diff --check`.
