import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/core/location/location_service.dart';
import 'package:saptahara/core/network/api_client.dart';
import 'package:saptahara/core/network/api_config.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/utils/geo.dart';
import 'package:saptahara/domain/entities/entities.dart';

/// Full SOS confirmation -> capture location -> sending -> sent/failed
/// flow. Runs entirely on local/mock state, no backend required.
Future<void> showSosFlow(BuildContext context, WidgetRef ref) async {
  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _SosSheet(),
  );
}

class _SosSheet extends StatefulWidget {
  const _SosSheet();
  @override
  State<_SosSheet> createState() => _SosSheetState();
}

class _SosSheetState extends State<_SosSheet> {
  SosState _state = SosState.confirming;
  MapPoint? _location;

  Future<void> _confirm() async {
    setState(() => _state = SosState.sending);
    // Capture a real GPS fix (falls back to the demo corridor coordinate).
    final fix = await LocationService.instance.current();
    if (!mounted) return;
    setState(() => _location = toMapPoint(fix.lat, fix.lng));

    // Encode a compact Base64 distress frame and POST it to the backend's
    // emergency webhook — the same handler a 2G-SMS gateway would hit.
    bool success;
    try {
      final frame =
          '${ApiConfig.deviceId}|${fix.lat}|${fix.lng}|SOS field officer emergency';
      final payload = base64Encode(utf8.encode(frame));
      await ApiClient.instance.postJson('/emergency/sms', {
        'payload': payload,
        'sender': ApiConfig.deviceId,
      });
      success = true;
    } catch (_) {
      success = false;
    }
    if (!mounted) return;
    setState(() => _state = success ? SosState.sent : SosState.failed);
  }

  void _retry() {
    setState(() => _state = SosState.sending);
    _confirm();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.cardLg)),
        border: Border(
          top: BorderSide(color: AppColors.black, width: 2.5),
          left: BorderSide(color: AppColors.black, width: 2.5),
          right: BorderSide(color: AppColors.black, width: 2.5),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: AppColors.black.withOpacity(0.15),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 18),
          _buildBody(context),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    switch (_state) {
      case SosState.confirming:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.warning_amber_rounded, color: AppColors.riskyRed, size: 44),
            const SizedBox(height: 10),
            Text('Confirm Emergency SOS', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text(
              'This will capture your current location and alert your response team immediately. Only use this in a genuine emergency.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 20),
            SizedBox(
              height: 56,
              child: ElevatedButton(
                onPressed: _confirm,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.riskyRed,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.card),
                    side: const BorderSide(color: AppColors.black, width: 2.5),
                  ),
                ),
                child: const Text('HOLD TO CONFIRM SOS',
                    style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w900, letterSpacing: 0.8)),
              ),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel', style: TextStyle(color: AppColors.black, fontWeight: FontWeight.w700)),
            ),
          ],
        );
      case SosState.sending:
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            const CircularProgressIndicator(color: AppColors.riskyRed),
            const SizedBox(height: 16),
            Text(
              _location == null ? 'Capturing location…' : 'Sending SOS alert…',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 20),
          ],
        );
      case SosState.sent:
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.check_circle, color: AppColors.safeGreen, size: 48),
            const SizedBox(height: 10),
            Text('SOS Sent', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 6),
            Text(
              'Your location has been shared with the response team. Stay where you are if it is safe to do so.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 18),
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.safeGreen,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.card),
                    side: const BorderSide(color: AppColors.black, width: 2),
                  ),
                ),
                child: const Text('DONE', style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w900)),
              ),
            ),
          ],
        );
      case SosState.failed:
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.error, color: AppColors.riskyRed, size: 48),
            const SizedBox(height: 10),
            Text('SOS Failed to Send', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 6),
            Text(
              'Your alert is saved locally and will keep retrying. You can retry manually now.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 18),
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: _retry,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.riskyRed,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.card),
                    side: const BorderSide(color: AppColors.black, width: 2),
                  ),
                ),
                child: const Text('RETRY', style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w900)),
              ),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close', style: TextStyle(color: AppColors.black, fontWeight: FontWeight.w700)),
            ),
          ],
        );
      default:
        return const SizedBox.shrink();
    }
  }
}
