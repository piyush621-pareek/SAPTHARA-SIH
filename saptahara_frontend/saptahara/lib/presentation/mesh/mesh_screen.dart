import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/i18n/i18n.dart';
import 'package:saptahara/services/mesh/ble_mesh_service.dart';
import 'package:saptahara/presentation/widgets/app_card.dart';

const _uuid = Uuid();

class MeshScreen extends ConsumerStatefulWidget {
  const MeshScreen({super.key});
  @override
  ConsumerState<MeshScreen> createState() => _MeshScreenState();
}

class _MeshScreenState extends ConsumerState<MeshScreen> {
  final _mesh = BleMeshService.instance;
  final List<MeshAlert> _received = [];
  StreamSubscription? _sub;
  bool _active = false;
  bool _broadcasting = false;

  @override
  void initState() {
    super.initState();
    _sub = _mesh.onAlert.listen((alert) {
      if (mounted) setState(() => _received.insert(0, alert));
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _toggleMesh() async {
    if (_active) {
      await _mesh.stopListening();
    } else {
      await _mesh.startListening();
    }
    if (mounted) setState(() => _active = !_active);
  }

  Future<void> _sendSos() async {
    setState(() => _broadcasting = true);
    await _mesh.broadcastAlert(
      id: _uuid.v4().substring(0, 8),
      type: 'SOS',
      message: 'HELP',
      senderName: 'Field',
    );
    if (mounted) {
      setState(() => _broadcasting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SOS broadcast sent via BLE mesh')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    return Scaffold(
      appBar: AppBar(title: Text(AppStrings.t('meshNetwork', lang))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppCard(
            color: _active ? AppColors.safeGreen.withValues(alpha: 0.15) : AppColors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Icon(
                      _active ? Icons.bluetooth_connected : Icons.bluetooth_disabled,
                      color: _active ? AppColors.safeGreen : AppColors.riskyRed,
                      size: 28,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _active ? 'Mesh Active' : 'Mesh Offline',
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                          ),
                          Text(
                            _active
                                ? '${_mesh.peerCount} device(s) nearby'
                                : 'Enable to relay alerts without internet',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      value: _active,
                      onChanged: (_) => _toggleMesh(),
                      activeColor: AppColors.safeGreen,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // How it works
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.panelBlue,
                    borderRadius: BorderRadius.circular(AppRadii.cardSm),
                    border: Border.all(color: AppColors.black, width: 1.4),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('How BLE Mesh Works', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                      SizedBox(height: 4),
                      Text(
                        '1. Your phone broadcasts alerts via Bluetooth\n'
                        '2. Nearby SAPTHARA devices pick them up (~100m)\n'
                        '3. Each device re-broadcasts to extend range\n'
                        '4. Alerts hop phone-to-phone until reaching network',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, height: 1.5),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _active && !_broadcasting ? _sendSos : null,
              icon: _broadcasting
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white))
                  : const Icon(Icons.sos, color: AppColors.white),
              label: const Text('Broadcast SOS via Mesh',
                  style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w900)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.riskyRed,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  side: const BorderSide(color: AppColors.black, width: 2.2),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text('Received Alerts (${_received.length})',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          if (_received.isEmpty)
            const AppCard(child: Text('No mesh alerts received yet. Enable mesh and wait for nearby broadcasts.'))
          else
            ..._received.map((a) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: AppCard(
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: a.type == 'SOS' ? AppColors.riskyRed : AppColors.moderateOrange,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.black, width: 1.6),
                          ),
                          child: Icon(
                            a.type == 'SOS' ? Icons.sos : Icons.warning,
                            color: AppColors.white,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${a.type} from ${a.senderName}',
                                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                              Text('${a.message} · ${a.hops} hop(s) · Signal: ${a.signalStrength}',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.panelBlue,
                            borderRadius: BorderRadius.circular(AppRadii.pill),
                            border: Border.all(color: AppColors.black, width: 1.2),
                          ),
                          child: Text('${a.rssi} dBm',
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11)),
                        ),
                      ],
                    ),
                  ),
                )),
        ],
      ),
    );
  }
}
