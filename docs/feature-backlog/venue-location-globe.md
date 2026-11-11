# Interactive conference location globe

Status: Implemented and browser-validated on the isolated candidate http://127.0.0.1:18081 (V160), 2026-11-04.

## Requested interaction

1. Make a confirmed conference location clickable on conference cards and detail pages.
2. On click, show a rotating globe with markers for the conference destination and the user's current location.
3. Give the destination marker a repeating ripple animation, especially in globe view: every few seconds, circles expand outward and fade. Keep the center marker continuously visible.
4. Draw a curved connection from the user's location toward the destination, following the globe's surface.
5. When the destination marker is clicked, animate the curved destination area flattening into a square map.
6. Center the square map on the conference location and show only a small surrounding area, rather than flattening the whole globe.

## Data and behavior boundaries

- Add an opt-in location switch in Settings, off by default. Enabling it requests browser/system geolocation permission; the switch does not bypass that permission.
- If location access is disabled, denied or unavailable, still show the conference destination; do not invent the user's origin. Disabling the switch stops location access.
- Use the verified venue address when available; if only a city is known, label and locate it at city precision.
- Keep unknown conference locations hidden, consistent with the current venue display policy.
- The globe-to-map transition should preserve the destination's position as the map center.
- Respect reduced-motion preferences: show a static destination marker instead of pulsing rings, and provide an immediate or reduced-motion map transition.

## Acceptance checks

- The same interaction is available from a conference card and its detail page.
- Origin/destination markers are distinguishable and the connection follows the globe surface.
- Clicking the destination opens a square local map centered on the same verified location.
- Location denial does not prevent viewing the destination.

Implementation: bundled Natural Earth land geometry with D3 spherical projection; destination geocoding via a cached, rate-limited Nominatim lookup; Leaflet local map with OpenStreetMap street tiles. Globe-to-map transition interpolates spherical projection and zooms only into the destination region. Browser location coordinates are held in memory, not sent to the server.

## Verification and limits

- Destination rings expand/fade every 3.8 seconds; the center stays visible. Both globe and local map honor reduced motion.
- 33 frontend and 5 location-service tests passed. Browser evidence: `plan/v160-location-browser.json`, `plan/v160-location-extra.json`, `plan/v160-ui-browser.json`.
- Real area lookup and all visible OSM map tiles loaded for Montreal; browser origin was simulated Shanghai. Actual user location still requires their browser permission.
- Confirmed city/area locations are shown at area precision. Unrelated businesses are rejected; unresolved places show a search fallback, never an invented venue address.
- Original18080 and manuscript content were not changed.

## Follow-up refinement (2026-11-04, accepted in V169)

- A Back to globe control is placed inside the local map at the upper right; returning resumes rotation unless reduced motion is active.
- Initial map zoom remains11, and the minus control now permits zoom0 for a global map view. Maximum detail remains zoom18.
- Conference dates and location labels use a calendar and map-pin icon, with accessible text and hover labels.

Real-browser follow-up: return control remains inside the visible map at1500×700 and700×800, zoom0 reached, rotation resumes. Evidence: `plan/v166-browser.json`; inherited unchanged in V169.
