import 'package:saptahara/domain/entities/entities.dart';

/// Abstracted map service interface. Ships with a custom-painted mock map
/// that needs no API key. Swap for a Mapbox-backed implementation later by
/// only touching this service — no screen changes.
abstract class MapService {
  List<RouteOption> get demoRoutes;
  MapPoint get currentPosition;
}

class MockMapService implements MapService {
  @override
  MapPoint get currentPosition => const MapPoint(0.08, 0.85);

  @override
  List<RouteOption> get demoRoutes => const [];
}
