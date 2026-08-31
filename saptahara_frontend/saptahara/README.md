# SAPTHARA — SIH 2026 Frontend (NER Smart Logistics & Accessibility)

100% frontend Flutter app. Every screen runs on **mock repositories** and
local state — no backend, no API keys, fully demoable standalone. When
the backend is ready, only `data/repositories/*` need new
`Api*Repository` implementations; screens don't change.

## 1. Setup (one-time)

This zip ships the **Dart source only** (`lib/`, `pubspec.yaml`, tests) —
no `android/`, `ios/`, or `web/` platform folders, so the archive stays
small and clean. Generate them locally with the Flutter SDK:

```bash
# unzip, then from inside the project root:
flutter create . --project-name saptahara --org com.saptahara
```

`flutter create .` is safe to run on an existing Dart-only Flutter
project — it fills in the missing `android/`, `ios/`, `web/`, etc.
folders without touching your existing `lib/` or `pubspec.yaml` content
(it will just make sure the `pubspec.yaml` name matches; keep the
dependencies block that's already there).

Then:

```bash
flutter pub get
flutter run          # or: flutter run -d chrome  for a quick web demo
```

## 2. What's implemented

- **Theme** (`core/theme/app_theme.dart`) — all reference design tokens
  (panel blue, safe green, moderate orange, risky red, lime nav, purple
  trust, map neutral), 2.5px black outlines, 12–18px card radii.
- **Domain models** (`domain/entities/entities.dart`) — RouteOption,
  HazardAlert, FieldReport, SyncJob, Geofence, VerificationReceipt.
- **Repository interfaces** (`domain/repositories/repositories.dart`)
  and **Mock implementations** (`data/repositories/mock_repositories.dart`)
  — deterministic sample data, simulated latency and failure rates so
  every loading/error/empty/success state is reachable.
- **Riverpod state** (`app/providers.dart`) — routes, alerts (with a
  simulated live stream), reports, sync outbox, connectivity/offline
  toggle, settings.
- **Custom mock map** (`presentation/widgets/mock_map.dart`) — hand
  painted with `CustomPainter`, no API key required. Draws risk-colored
  route polylines, current position, hazard markers, and geofence
  overlays. Swap for Mapbox by writing a new `MapService`
  implementation only (`services/map/map_service.dart`).
- **5 screens**: Home, Route, Report, Settings, Profile — all wired to
  real state, all interactive elements functional (see Definition of
  Done below).
- **SOS flow**: confirmation sheet → capture mock location → sending →
  sent/failed → retry.
- **Offline-first**: Settings' Offline Mode toggle flips a shared
  connectivity state that Home/Route/Report all react to; reports save
  locally immediately and queue into an outbox with Pending → Syncing →
  Synced/Failed status, retryable via "Sync Now".
- **Verification receipt**: mock blockchain (Polygon-style) receipt with
  a detail sheet on Profile.

## 3. Folder structure

```
lib/
  app/            providers.dart (Riverpod wiring)
  core/
    theme/        design tokens + ThemeData
    connectivity/ simulated online/offline state machine
  data/
    repositories/ Mock*Repository implementations
  domain/
    entities/     RouteOption, HazardAlert, FieldReport, ...
    repositories/ repository interfaces (Mock today, Api later)
  presentation/
    navigation/   bottom nav shell (HOME/ROUTE/REPORT/SETTINGS/PROFILE)
    home/ route/ report/ settings/ profile/
    widgets/      AppCard, MockMap, SosButton + flow, AlertRow, badges
  services/
    map/          MapService interface (mock today, Mapbox-ready)
main.dart
```

## 4. Swapping in the real backend later

1. Implement `Api*Repository` classes against the FastAPI/WebSocket
   endpoints (see the spec's Section 7 API contract).
2. Change the `Provider` overrides in `app/providers.dart` from
   `Mock*Repository()` to `Api*Repository()`.
3. Implement a Mapbox-backed `MapService` and swap it in
   `services/map/map_service.dart`.

No screen or widget code needs to change.

## 5. Known gaps to fill before final submission

- Real photo picker (`image_picker`) in place of the tap-to-toggle mock
  attach control on the Report screen.
- Real GPS (`geolocator`) in place of manual lat/lng fields.
- `connectivity_plus` for real network detection instead of the
  Settings toggle.
- App icon / splash screen branding.
