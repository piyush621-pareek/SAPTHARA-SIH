import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/domain/entities/entities.dart';
import 'package:saptahara/presentation/widgets/mock_map.dart' show MapStyle;

/// Real OpenStreetMap tile view (flutter_map) rendering backend-driven routes,
/// hazard geofences, live hazard markers, and the current position.
///
/// Drop-in replacement for the legacy MockMap: same constructor shape. Route
/// and geofence geometry now carry real coordinates (MapPoint.x = longitude,
/// MapPoint.y = latitude), so they plot on the actual map.
/// Nepal Trishuli Corridor crisis zones — August 2026.
class _NepalZone {
  final String name;
  final String event;
  final String severity;
  final List<LatLng> polygon;
  const _NepalZone(this.name, this.event, this.severity, this.polygon);
}

const _nepalCrisisZones = <_NepalZone>[
  _NepalZone('Rasuwa', 'Glacier collapse / flash flood', 'critical', [LatLng(28.05,85.1),LatLng(28.05,85.5),LatLng(28.35,85.5),LatLng(28.35,85.1)]),
  _NepalZone('Nuwakot', 'Flash flood / debris flow', 'high', [LatLng(27.85,85.0),LatLng(27.85,85.35),LatLng(28.1,85.35),LatLng(28.1,85.0)]),
  _NepalZone('Dhading', 'Landslide / flood', 'high', [LatLng(27.7,84.7),LatLng(27.7,85.1),LatLng(28.0,85.1),LatLng(28.0,84.7)]),
  _NepalZone('Gorkha', 'Landslide', 'moderate', [LatLng(27.9,84.4),LatLng(27.9,84.8),LatLng(28.2,84.8),LatLng(28.2,84.4)]),
  _NepalZone('Tanahun', 'Flood / inundation', 'moderate', [LatLng(27.8,83.9),LatLng(27.8,84.4),LatLng(28.1,84.4),LatLng(28.1,83.9)]),
  _NepalZone('Nawalparasi', 'River overflow', 'moderate', [LatLng(27.4,83.6),LatLng(27.4,84.0),LatLng(27.75,84.0),LatLng(27.75,83.6)]),
  _NepalZone('Chitwan', 'Flood / displacement', 'high', [LatLng(27.3,83.9),LatLng(27.3,84.6),LatLng(27.7,84.6),LatLng(27.7,83.9)]),
];

Color _severityColor(String s) => switch (s) {
  'critical' => const Color(0xFFDC2626),
  'high' => const Color(0xFFEA580C),
  _ => const Color(0xFFD97706),
};

/// MOSDAC rainfall data point for the map overlay.
class RainfallPoint {
  final double lat;
  final double lng;
  final double rainfallMm;
  const RainfallPoint(this.lat, this.lng, this.rainfallMm);
}

/// NER rainfall grid (~0.5° spacing) for the MOSDAC overlay.
/// In production this comes from the backend; here we seed realistic values.
List<RainfallPoint> _nerRainfallGrid() {
  final points = <RainfallPoint>[];
  // NER bounding box: 22°-29°N, 88°-97°E
  for (double lat = 22.0; lat <= 29.0; lat += 0.5) {
    for (double lng = 88.0; lng <= 97.0; lng += 0.5) {
      final month = DateTime.now().month;
      final monsoon = month >= 5 && month <= 9;
      final base = monsoon ? 140.0 : 35.0;
      final orographic = lat >= 25 && lng >= 90 ? 1.35 : 1.0;
      final jitter = ((lat * 12.9898 + lng * 78.233).abs() % 43);
      final rainfall = base * orographic + jitter;
      if (rainfall > 5) points.add(RainfallPoint(lat, lng, rainfall));
    }
  }
  return points;
}

Color _rainfallColor(double mm) {
  if (mm > 200) return const Color(0xCC8B0000); // dark red
  if (mm > 150) return const Color(0xAADC2626); // red
  if (mm > 100) return const Color(0x99EA580C); // orange
  if (mm > 50) return const Color(0x77F59E0B);  // yellow
  if (mm > 20) return const Color(0x5522C55E);  // green
  return const Color(0x333B82F6);                 // blue (light rain)
}

class LiveMap extends StatefulWidget {
  final List<RouteOption> routes;
  final String? highlightedRouteId;
  final List<HazardAlert> hazards;
  final Geofence? geofence;
  final MapStyle style;
  final bool showNepalCrisis;
  final bool showRainfall;

  /// Deep-link focus target: when [focusNonce] changes the map flies to
  /// (focusLat, focusLng) and drops a highlight marker.
  final double? focusLat;
  final double? focusLng;
  final int focusNonce;

  const LiveMap({
    super.key,
    required this.routes,
    this.highlightedRouteId,
    this.hazards = const [],
    this.geofence,
    this.style = MapStyle.standard,
    this.showNepalCrisis = false,
    this.showRainfall = false,
    this.focusLat,
    this.focusLng,
    this.focusNonce = 0,
  });

  @override
  State<LiveMap> createState() => _LiveMapState();
}

class _LiveMapState extends State<LiveMap> {
  final MapController _controller = MapController();

  LatLng _toLatLng(MapPoint p) => LatLng(p.y, p.x);

  List<LatLng> _allPoints() {
    final pts = <LatLng>[];
    for (final r in widget.routes) {
      pts.addAll(r.geometry.map(_toLatLng));
    }
    if (widget.geofence != null) {
      pts.addAll(widget.geofence!.polygon.map(_toLatLng));
    }
    return pts;
  }

  @override
  void didUpdateWidget(covariant LiveMap oldWidget) {
    super.didUpdateWidget(oldWidget);

    // Deep-link: a new focus target flies the camera to the alert location.
    if (widget.focusNonce != oldWidget.focusNonce &&
        widget.focusLat != null &&
        widget.focusLng != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        try {
          _controller.move(LatLng(widget.focusLat!, widget.focusLng!), 11);
        } catch (_) {/* controller not ready */}
      });
      return; // don't also re-fit to routes this frame
    }

    // Re-fit the camera only when the routes actually change (e.g. a reroute).
    if (oldWidget.routes != widget.routes) {
      final pts = _allPoints();
      if (pts.length >= 2) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          try {
            _controller.fitCamera(
              CameraFit.bounds(
                bounds: LatLngBounds.fromPoints(pts),
                padding: const EdgeInsets.all(28),
              ),
            );
          } catch (_) {/* controller not ready */}
        });
      }
    }
  }

  String get _tileUrl => widget.style == MapStyle.terrain
      ? 'https://tile.opentopomap.org/{z}/{x}/{y}.png'
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  @override
  Widget build(BuildContext context) {
    final pts = _allPoints();
    final center = pts.isNotEmpty
        ? pts[pts.length ~/ 2]
        : const LatLng(26.9, 92.3); // Guwahati–Tawang corridor

    return AspectRatio(
      aspectRatio: 16 / 11,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.card),
        child: FlutterMap(
          mapController: _controller,
          options: MapOptions(
            initialCenter: center,
            initialZoom: 8,
            minZoom: 4,
            maxZoom: 17,
            initialCameraFit: pts.length >= 2
                ? CameraFit.bounds(
                    bounds: LatLngBounds.fromPoints(pts),
                    padding: const EdgeInsets.all(28),
                  )
                : null,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag,
            ),
          ),
          children: [
            TileLayer(
              urlTemplate: _tileUrl,
              userAgentPackageName: 'com.ner.saptahara',
              maxZoom: 18,
            ),
            if (widget.showRainfall) _rainfallLayer(),
            if (widget.geofence != null) _geofenceLayer(widget.geofence!),
            if (widget.showNepalCrisis) _nepalCrisisLayer(),
            _routeLayer(),
            _markerLayer(),
          ],
        ),
      ),
    );
  }

  Widget _geofenceLayer(Geofence g) {
    return PolygonLayer(
      polygons: [
        Polygon(
          points: g.polygon.map(_toLatLng).toList(),
          color: AppColors.riskyRed.withValues(alpha: 0.18),
          borderColor: AppColors.riskyRed,
          borderStrokeWidth: 2,
        ),
      ],
    );
  }

  Widget _routeLayer() {
    // Draw non-highlighted first so the highlighted route sits on top.
    final ordered = [...widget.routes]..sort((a, b) {
        final ah = a.id == widget.highlightedRouteId ? 1 : 0;
        final bh = b.id == widget.highlightedRouteId ? 1 : 0;
        return ah - bh;
      });
    final lines = ordered.map((r) {
      final highlighted =
          widget.highlightedRouteId == null || r.id == widget.highlightedRouteId;
      return Polyline(
        points: r.geometry.map(_toLatLng).toList(),
        color: highlighted
            ? r.riskLevel.color
            : r.riskLevel.color.withValues(alpha: 0.4),
        strokeWidth: highlighted ? 6 : 4,
        borderColor: AppColors.black,
        borderStrokeWidth: highlighted ? 2 : 1,
      );
    }).toList();
    return PolylineLayer(polylines: lines);
  }

  Widget _markerLayer() {
    final markers = <Marker>[];

    // Current position = start of the first route.
    if (widget.routes.isNotEmpty && widget.routes.first.geometry.isNotEmpty) {
      markers.add(Marker(
        point: _toLatLng(widget.routes.first.geometry.first),
        width: 22,
        height: 22,
        child: const _Dot(color: AppColors.purpleTrust),
      ));
    }

    // Live hazard alerts (real lat/lng).
    for (final h in widget.hazards) {
      if (h.latitude == 0 && h.longitude == 0) continue;
      markers.add(Marker(
        point: LatLng(h.latitude, h.longitude),
        width: 26,
        height: 26,
        child: Icon(
          h.type == 'sos' ? Icons.sos_rounded : Icons.warning_amber_rounded,
          color: h.severity == AlertSeverity.critical
              ? AppColors.riskyRed
              : AppColors.moderateOrange,
          size: 24,
        ),
      ));
    }

    // Deep-link highlight ring at the focused alert location.
    if (widget.focusLat != null && widget.focusLng != null) {
      markers.add(Marker(
        point: LatLng(widget.focusLat!, widget.focusLng!),
        width: 44,
        height: 44,
        child: Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.riskyRed.withValues(alpha: 0.18),
            border: Border.all(color: AppColors.riskyRed, width: 3),
          ),
        ),
      ));
    }

    return MarkerLayer(markers: markers);
  }

  Widget _rainfallLayer() {
    final grid = _nerRainfallGrid();
    return CircleLayer(
      circles: grid.map((p) => CircleMarker(
        point: LatLng(p.lat, p.lng),
        radius: 18,
        color: _rainfallColor(p.rainfallMm),
        borderColor: Colors.transparent,
        borderStrokeWidth: 0,
      )).toList(),
    );
  }

  Widget _nepalCrisisLayer() {
    return PolygonLayer(
      polygons: _nepalCrisisZones.map((z) {
        final c = _severityColor(z.severity);
        return Polygon(
          points: z.polygon,
          color: c.withValues(alpha: 0.2),
          borderColor: c,
          borderStrokeWidth: 2,
          label: '⚠ ${z.name}\n${z.event}',
          labelStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF7C2D12)),
        );
      }).toList().cast<Polygon<Object>>(),
    );
  }
}

class _Dot extends StatelessWidget {
  final Color color;
  const _Dot({required this.color});
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.white, width: 3),
        boxShadow: const [
          BoxShadow(color: Colors.black45, blurRadius: 4, offset: Offset(0, 1)),
        ],
      ),
    );
  }
}
