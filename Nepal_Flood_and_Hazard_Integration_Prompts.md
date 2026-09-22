# Nepal Flood and Hazard Integration Prompts

These prompts are designed for extending the existing **NER Authority Command Dashboard** and its companion field/mobile app. The dashboard currently uses React, TypeScript, Vite, MapLibre GL, REST APIs, and Socket.IO. It already contains fleet tracking, hazard geofences, route planning, SOS alerts, connectivity monitoring, field reporting, and an audit ledger.

## Shared implementation rules

Use a shared backend contract between the app and dashboard. Do not implement the app and dashboard as two disconnected demos. A route created in the app must be visible in the dashboard, and an SOS raised by a truck driver must appear in the dashboard in near real time.

Represent Nepal hazards using GeoJSON and include at least the following metadata: `id`, `country`, `type`, `name`, `geometry`, `severity`, `risk_score`, `source`, `observed_at`, `valid_until`, `confidence`, `status`, and `is_demo`. Clearly distinguish verified external data from simulated demonstration events.

For live external data, use a backend proxy/normalization layer rather than calling third-party feeds directly from the browser. Cache the latest successful response, include `lastUpdated`, handle timeouts and rate limits, validate the response schema, and fall back to a clearly labelled Nepal demo fixture when the external feed is unavailable. Never silently present old or simulated data as current verified data.

The official GDACS page currently exposes Nepal flood-related products and public feeds, including RSS, KML, common feed, and CAP endpoints. Candidate feed URLs include `https://www.gdacs.org/xml/rss.xml`, `https://www.gdacs.org/xml/gdacs.kml`, `https://www.gdacs.org/feed_reference.aspx`, and `https://www.gdacs.org/xml/gdacs_cap.xml`.[1] Use the source that is technically compatible with the existing backend, and document the exact fields and refresh interval in the code.

# Prompt 1: Dashboard implementation

You are extending the existing NER Authority Command Dashboard. Work directly from the current codebase; first inspect the existing components, API helpers, TypeScript types, Socket.IO events, MapLibre map layers, route planner, alert feed, connectivity panel, and ledger panel. Preserve the current design and existing functionality. Do not replace the dashboard with a new application.

Implement a Nepal flood-response operating mode that supports both a real-time demonstration and future production data integration.

## 1. Nepal operating mode

Add a country/region selector or operating-mode control with at least `North-East India` and `Nepal Flood Response`. When Nepal is selected, update the map view to Nepal, load Nepal hazards and routes, update labels and statistics, and make the active scenario obvious in the UI. Keep the existing Guwahati-to-Tawang scenario working.

Add a Nepal demo scenario with configurable cities such as Kathmandu, Pokhara, Biratnagar, Bharatpur, Nepalgunj, and Janakpur. The operator must be able to select an origin city and destination city, or choose map points, and request a route.

## 2. Nepal flood-data integration

Create a backend data adapter named something similar to `nepalHazardsProvider`. It should fetch and normalize available public Nepal flood/disaster data, prioritizing official or humanitarian sources. Start with the GDACS public RSS/KML/CAP feeds and make the provider interface extensible for ICIMOD/SERVIR-HKH, Nepal Department of Hydrology and Meteorology, Copernicus EMS, or other approved sources.

Normalize every record into GeoJSON Feature or FeatureCollection objects. Filter records to Nepal using country metadata or a Nepal bounding box, deduplicate by stable source ID, and preserve the original source URL. Add source attribution in the dashboard. If live data cannot be fetched, load a small deterministic demo fixture containing at least three Nepal flood zones and one road-closure or landslide zone, with `is_demo: true` and a visible “Demo data” label.

Refresh the provider on a sensible interval, such as five minutes for external feeds, while keeping the browser-to-backend connection real time for internal events. Do not claim that a road is flooded unless the incoming source or an explicitly labelled demo event says so.

## 3. Map visualization

Add separate MapLibre layers for flood polygons, river/road hazard lines, closed roads, landslide zones, and emergency/SOS locations. Use a clear severity palette: low, moderate, high, and critical. Add opacity and outlines so vehicle markers remain visible.

Each hazard popup or side panel must show the hazard name, type, severity, source, observed time, validity, confidence, and whether it is verified or demo data. Add a legend and a “last updated” indicator. Add a refresh/error state if the feed is stale or unavailable.

## 4. Hazard-aware routing

Extend the existing route API and route planner so an operator can enter `city A` to `city B` for Nepal. Geocode or resolve supported cities, request a route, and return both a direct route and a recommended safer route. The recommended route must be checked against active flood, landslide, and road-closure geometries.

For each route alternative, return distance, estimated duration, safety score, intersected hazards, avoided hazards, route status, and GeoJSON geometry. If a route intersects a critical hazard or closed road, mark it blocked or unsafe and recommend a detour. The UI must explain the reason in plain language, for example: “Recommended detour avoids the Koshi flood zone.” Do not invent a route if the routing service fails; show a controlled error and retain the last valid route.

If no real routing provider is available, implement a deterministic demo routing adapter using the existing route geometry and city coordinates, but label it as demo routing. Keep the routing-provider interface replaceable.

## 5. Synchronized trip events

Add a shared trip model with fields such as `tripId`, `vehicleId`, `origin`, `destination`, `route`, `selectedAlternative`, `hazardsConsidered`, `createdAt`, `updatedAt`, and `status`.

Expose or extend events similar to:

- `trip:created`
- `trip:route_updated`
- `trip:hazard_changed`
- `trip:status_changed`
- `emergency:alert`
- `fleet:update`

When an app user creates a route, the dashboard must show the trip and route. When a new flood hazard invalidates or affects a trip, recompute the route, emit `trip:hazard_changed`, update the map, and show a visible rerouting alert.

## 6. Truck stuck and SOS handling

Preserve the existing SOS handling but make it Nepal-aware. Add a scenario/test control that can simulate a truck becoming stuck in floodwater or another hazard. The event must include `incidentId`, `tripId`, `vehicleId`, registration, latitude, longitude, hazard ID, message, channel, severity, and timestamp.

When received, the dashboard must place an animated SOS marker on the Nepal map, focus the map on the incident, highlight the associated hazard, add an alert-feed item, update the truck status to SOS, and show the incident in the right-side operations panel. If the truck is inside a flood or landslide polygon, explicitly display that relationship.

Persist the incident to the existing audit/trust ledger and verify the chain as the current dashboard already does. Add acknowledgement and resolution states without deleting the original event.

## 7. Testing and acceptance criteria

Add tests or reproducible manual checks for the following: Kathmandu-to-Pokhara route creation; route rerouting after a flood polygon is activated; dashboard display of a verified external hazard; dashboard display of labelled demo data when the feed is unavailable; an app-created trip appearing in the dashboard; a truck SOS appearing within the expected realtime interval; an SOS marker being associated with the correct hazard; stale-feed and API-error handling; and preservation of the existing India scenario.

Finish by documenting changed files, environment variables, API endpoints, event payloads, demo controls, data-source attribution, and how to run the Nepal scenario locally.

# Prompt 2: Companion app implementation

You are extending the companion field/mobile app that works with the NER Authority Command Dashboard. First inspect the app’s existing navigation, map implementation, authentication, API client, route planner, report form, location permissions, and SOS workflow. Preserve its current behavior and visual language. Do not create a disconnected mockup.

Implement a Nepal flood-response mode that lets a driver or field worker plan a trip, receive hazard-aware route guidance, report a hazard, and send an SOS when the truck is stuck.

## 1. Nepal trip planning

Add a region selector or scenario selector with `North-East India` and `Nepal Flood Response`. In Nepal mode, allow the user to enter an origin city and destination city, select from supported Nepal cities, or choose map locations. At minimum support Kathmandu, Pokhara, Biratnagar, Bharatpur, Nepalgunj, and Janakpur, while keeping the city list extensible.

When the user submits the trip, call the shared route API with the user’s origin, destination, vehicle ID, and current location if available. Display the direct route and recommended safer route, including distance, estimated duration, safety score, active hazards, avoided hazards, and a clear explanation of why a detour is recommended.

The selected route must be persisted as a shared `tripId`. Show route status states such as `clear`, `at_risk`, `rerouted`, `blocked`, and `completed`. If the route later changes because of a new flood or landslide alert, update the app and require a clear user acknowledgement before navigation continues on the new route.

## 2. Hazard map and live updates

Use the existing MapLibre implementation if present. Add Nepal flood polygons, road closures, landslide zones, and hazard markers with severity-based styling. Keep the current user/vehicle marker visible above hazard layers.

Each hazard detail view must show type, severity, source, observed time, validity, confidence, and a visible `Verified external data` or `Demo data` label. Show the feed’s `lastUpdated` time and a non-blocking warning when the data is stale. Do not present simulated data as live government data.

Subscribe to the shared realtime channel for `trip:hazard_changed`, `trip:route_updated`, `emergency:alert`, and relevant fleet events. Reconnect safely, avoid duplicate events, and show an offline state when the realtime connection is unavailable.

## 3. Truck stuck and SOS flow

Implement or enhance the SOS button for the Nepal scenario. It must be easy to find, accessible, and protected against accidental activation with a short confirmation step. The confirmation must not make the emergency workflow difficult.

When the driver selects SOS, collect the current GPS location, vehicle ID, registration, trip ID, selected hazard if known, communication channel, message, severity, and timestamp. If location permission is unavailable, allow the user to confirm or manually select the location and clearly mark the location source.

Send a structured event to the shared backend, for example:

```json
{
  "incidentId": "generated-client-or-server-id",
  "tripId": "trip-id",
  "vehicleId": "vehicle-id",
  "registration": "vehicle-registration",
  "country": "NP",
  "channel": "app",
  "message": "Truck stuck in floodwater",
  "severity": "critical",
  "location": { "latitude": 27.7172, "longitude": 85.3240 },
  "hazardId": "optional-active-hazard-id",
  "at": "ISO-8601 timestamp"
}
```

After submission, show a clear sent/queued/failed state. If offline, queue the SOS locally and retry when connectivity returns, without creating duplicates. Display the incident ID and time. Once the dashboard acknowledges the event, show an acknowledgement state to the driver.

The backend must publish the event to the dashboard through the existing realtime channel. The dashboard must focus on the incident, mark the truck as SOS, associate it with the active Nepal hazard, and add it to the audit ledger.

## 4. Field hazard reporting

Extend the existing hazard-report form for Nepal. Allow the user to select flood, waterlogging, landslide, road closure, bridge damage, stranded vehicle, or other hazard. Capture GPS, severity, description, optional photo if the current app supports media, and timestamp. Send the report to the shared `/reports`-style endpoint with country and trip context.

Show a submission receipt and report status. The dashboard should receive the report as a new hazard candidate or field alert, but it must be marked `field_report` and not automatically treated as verified until the configured validation workflow approves it.

## 5. Safety and usability

Make the experience usable with poor connectivity and on small screens. Cache the last valid route and hazard snapshot for read-only viewing. Never show an apparently current route when it is based on stale data; show the age of the snapshot. Use large touch targets, clear contrast, concise warning text, and accessible labels.

## 6. Testing and acceptance criteria

Verify the following end-to-end behavior: the user selects Kathmandu as origin and Pokhara as destination; the app displays a direct and safer route; a flood hazard causes a route update; the updated trip appears on the dashboard; the user reports a road closure; the dashboard receives the field report; the user triggers a simulated “truck stuck in flood” SOS; the dashboard receives and acknowledges it; duplicate SOS submissions are prevented; an offline SOS is queued and later delivered; stale external data is visibly labelled; and the existing India scenario still works.

Finish by documenting changed files, API endpoints, event payloads, local demo controls, location-permission behavior, offline queue behavior, and the exact steps to test the app and dashboard together.

## Recommended end-to-end demo script

For the presentation, use a clearly labelled Nepal scenario rather than claiming an unverified live incident. Start the app in Nepal mode, select Kathmandu to Pokhara, and show the initial route. Activate or load a Nepal flood polygon from the normalized feed or demo fixture. Show the recommended detour and the explanation of the avoided hazard. Then simulate a truck entering the flood zone and press SOS in the app. The dashboard should immediately focus on the truck, show the flood association, update the alert feed and status bar, and record the incident in the ledger.

## References

[1]: https://www.gdacs.org/ "Global Disaster Awareness and Coordination System official page"
[2]: https://www.gdacs.org/xml/rss.xml "GDACS public RSS feed"
[3]: https://www.gdacs.org/xml/gdacs.kml "GDACS public KML feed"
[4]: https://www.gdacs.org/xml/gdacs_cap.xml "GDACS public CAP feed"
[5]: https://servir.icimod.org/science-applications/flash-flood-prediction-tool-nepal/ "SERVIR-HKH Flash Flood Prediction Tool for Nepal"
[6]: https://rapidmapping.emergency.copernicus.eu/EMSR927/download "Copernicus EMS Nepal flood activation/download page"
