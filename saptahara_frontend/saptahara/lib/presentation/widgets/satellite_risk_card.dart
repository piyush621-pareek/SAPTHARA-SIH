import 'package:flutter/material.dart';
import 'package:saptahara/core/location/location_service.dart';
import 'package:saptahara/core/network/api_client.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/presentation/widgets/app_card.dart';

/// Fetches the ISRO-fused (MOSDAC + CartoDEM + Bhuvan) landslide risk for the
/// current location from the backend's /geo/risk endpoint and displays it.
class SatelliteRiskCard extends StatefulWidget {
  const SatelliteRiskCard({super.key});
  @override
  State<SatelliteRiskCard> createState() => _SatelliteRiskCardState();
}

class _SatelliteRiskCardState extends State<SatelliteRiskCard> {
  bool _loading = true;
  Map<String, dynamic>? _data;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final fix = await LocationService.instance.current();
      final res = await ApiClient.instance
          .getJson('/geo/risk', query: {'lat': '${fix.lat}', 'lng': '${fix.lng}'});
      if (!mounted) return;
      setState(() {
        _data = (res is Map ? res['data'] as Map? : null)?.cast<String, dynamic>();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _error = 'Satellite feed unavailable'; _loading = false; });
    }
  }

  Color _riskColor(double v) => v >= 0.8
      ? AppColors.riskyRed
      : v >= 0.6
          ? const Color(0xFFFF6B35)
          : v >= 0.35
              ? AppColors.moderateOrange
              : AppColors.safeGreen;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('🛰', style: TextStyle(fontSize: 18)),
              const SizedBox(width: 8),
              const Expanded(
                child: Text('Satellite Landslide Risk (ISRO)',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
              ),
              IconButton(
                icon: const Icon(Icons.refresh_rounded, size: 20),
                onPressed: _loading ? null : _load,
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(12),
              child: Center(child: CircularProgressIndicator(color: AppColors.safeGreen)),
            )
          else if (_error != null)
            Text(_error!, style: const TextStyle(color: AppColors.riskyRed))
          else if (_data != null)
            _body(_data!),
        ],
      ),
    );
  }

  Widget _body(Map<String, dynamic> d) {
    final ctx = (d['context'] as Map?)?.cast<String, dynamic>() ?? {};
    final sources = (ctx['sources'] as Map?)?.cast<String, dynamic>() ?? {};
    final fused = (d['fused_risk'] as num?)?.toDouble() ?? 0;
    final action = (d['recommended_action'] ?? '').toString();
    final color = _riskColor(fused);
    String live(String key) {
      final v = (sources[key] ?? 'modelled').toString();
      return (v == 'modelled') ? 'modelled' : 'LIVE';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 58, height: 58,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: color, width: 3),
              ),
              child: Text('${(fused * 100).round()}%',
                  style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 16)),
            ),
            const SizedBox(width: 14),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(8)),
                  child: Text(action,
                      style: const TextStyle(color: AppColors.white, fontWeight: FontWeight.w900)),
                ),
                const SizedBox(height: 4),
                Text('Rain ${ctx['rainfall_mm']}mm · Slope ${ctx['slope_deg']}° · ${ctx['landslide_susceptibility']}',
                    style: const TextStyle(fontSize: 12, color: AppColors.black)),
              ],
            ),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(spacing: 6, children: [
          _tag('MOSDAC', live('rainfall')),
          _tag('CartoDEM', live('terrain')),
          _tag('Bhuvan', live('susceptibility')),
        ]),
      ],
    );
  }

  Widget _tag(String label, String state) {
    final isLive = state == 'LIVE';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: (isLive ? AppColors.safeGreen : AppColors.black).withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text('$label: $state',
          style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              color: isLive ? AppColors.safeGreen : AppColors.black)),
    );
  }
}
