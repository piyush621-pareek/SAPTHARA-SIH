import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';
import 'package:intl/intl.dart';
import 'package:saptahara/app/providers.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/core/i18n/i18n.dart';
import 'package:saptahara/core/geo/places.dart';
import 'package:saptahara/core/connectivity/connectivity_provider.dart';
import 'package:saptahara/domain/entities/entities.dart';
import 'package:saptahara/presentation/widgets/app_card.dart';
import 'package:saptahara/presentation/widgets/status_badge.dart';
import 'package:saptahara/presentation/widgets/offline_banner.dart';

const _uuid = Uuid();

class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key});
  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  final _notesController = TextEditingController();
  final _picker = ImagePicker();
  ReportType _type = ReportType.landslide;
  Urgency _urgency = Urgency.medium;
  String? _photoPath; // local path to the captured/selected geo-tagged photo
  double _lat = 25.45;
  double _lng = 93.02;

  Future<void> _capturePhoto(ImageSource source) async {
    try {
      final file = await _picker.pickImage(
        source: source,
        maxWidth: 1600,
        imageQuality: 70,
      );
      if (file != null) setState(() => _photoPath = file.path);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not access camera/gallery')),
        );
      }
    }
  }

  void _choosePhotoSource() {
    showModalBottomSheet(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Take photo'),
              onTap: () {
                Navigator.pop(context);
                _capturePhoto(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Choose from gallery'),
              onTap: () {
                Navigator.pop(context);
                _capturePhoto(ImageSource.gallery);
              },
            ),
            if (_photoPath != null)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: AppColors.riskyRed),
                title: const Text('Remove photo'),
                onTap: () {
                  Navigator.pop(context);
                  setState(() => _photoPath = null);
                },
              ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  void _saveOffline() {
    final report = FieldReport(
      id: _uuid.v4(),
      type: _type,
      notes: _notesController.text.trim().isEmpty ? 'No additional notes.' : _notesController.text.trim(),
      mediaIds: _photoPath != null ? [_photoPath!] : [],
      latitude: _lat,
      longitude: _lng,
      urgency: _urgency,
      createdAt: DateTime.now(),
      syncStatus: SyncStatus.pending,
    );
    ref.read(reportsControllerProvider.notifier).add(report);
    ref.read(syncControllerProvider.notifier).enqueueReport(report.id);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Report saved locally — will sync when online')),
    );

    setState(() {
      _notesController.clear();
      _photoPath = null;
      _type = ReportType.landslide;
      _urgency = Urgency.medium;
    });

    final online = ref.read(connectivityProvider.notifier).isOnline;
    if (online) {
      ref.read(syncControllerProvider.notifier).flushAll();
    }
  }

  @override
  Widget build(BuildContext context) {
    final reports = ref.watch(reportsControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Report')),
      body: SafeArea(
        child: Column(
          children: [
            const OfflineBanner(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                children: [
                  Text(AppStrings.t('createReport', ref.watch(languageProvider)),
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 12),
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        InkWell(
                          onTap: _choosePhotoSource,
                          child: Container(
                            height: 150,
                            clipBehavior: Clip.antiAlias,
                            decoration: BoxDecoration(
                              color: AppColors.mapNeutral,
                              borderRadius: BorderRadius.circular(AppRadii.cardSm),
                              border: Border.all(color: AppColors.black, width: 2),
                            ),
                            child: _photoPath != null
                                ? Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      Image.file(File(_photoPath!), fit: BoxFit.cover),
                                      Positioned(
                                        right: 6,
                                        top: 6,
                                        child: Container(
                                          padding: const EdgeInsets.all(4),
                                          decoration: const BoxDecoration(
                                            color: AppColors.safeGreen,
                                            shape: BoxShape.circle,
                                          ),
                                          child: const Icon(Icons.check,
                                              size: 16, color: AppColors.white),
                                        ),
                                      ),
                                    ],
                                  )
                                : Center(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(Icons.camera_alt, size: 30, color: AppColors.black),
                                        const SizedBox(height: 6),
                                        Text(
                                          AppStrings.t('takePhoto', ref.watch(languageProvider)),
                                          style: const TextStyle(fontWeight: FontWeight.w800),
                                        ),
                                      ],
                                    ),
                                  ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text('Location', style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.safeGreen.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.black, width: 1.4),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.place, size: 18, color: AppColors.black),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(Places.name(_lat, _lng),
                                    style: const TextStyle(fontWeight: FontWeight.w800)),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                initialValue: _lat.toStringAsFixed(4),
                                decoration: _inputDecoration('Latitude'),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                                onChanged: (v) => _lat = double.tryParse(v) ?? _lat,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: TextFormField(
                                initialValue: _lng.toStringAsFixed(4),
                                decoration: _inputDecoration('Longitude'),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                                onChanged: (v) => _lng = double.tryParse(v) ?? _lng,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Text('Report Type', style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: ReportType.values.map((t) {
                            final selected = t == _type;
                            return ChoiceChip(
                              label: Text(t.label),
                              selected: selected,
                              onSelected: (_) => setState(() => _type = t),
                              selectedColor: AppColors.panelBlue,
                              backgroundColor: AppColors.white,
                              labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(AppRadii.pill),
                                side: const BorderSide(color: AppColors.black, width: 1.6),
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 14),
                        Text('Notes', style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _notesController,
                          maxLines: 3,
                          decoration: _inputDecoration('Describe what you observed…'),
                        ),
                        const SizedBox(height: 14),
                        Text('Urgency', style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: Urgency.values.map((u) {
                            final selected = u == _urgency;
                            return ChoiceChip(
                              label: Text(u.label),
                              selected: selected,
                              onSelected: (_) => setState(() => _urgency = u),
                              selectedColor: AppColors.moderateOrange,
                              backgroundColor: AppColors.white,
                              labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(AppRadii.pill),
                                side: const BorderSide(color: AppColors.black, width: 1.6),
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 18),
                        SizedBox(
                          height: 52,
                          child: ElevatedButton(
                            onPressed: _saveOffline,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.safeGreen,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(AppRadii.card),
                                side: const BorderSide(color: AppColors.black, width: 2.2),
                              ),
                            ),
                            child: const Text('SAVE OFFLINE',
                                style: TextStyle(color: AppColors.white, fontWeight: FontWeight.w900, letterSpacing: 0.6)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Offline Reports (${reports.length})', style: Theme.of(context).textTheme.titleLarge),
                      TextButton.icon(
                        onPressed: () => ref.read(syncControllerProvider.notifier).flushAll(),
                        icon: const Icon(Icons.sync, size: 18, color: AppColors.black),
                        label: const Text('Sync Now', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.black)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (reports.isEmpty)
                    const AppCard(child: Text('No reports yet. Create one above.'))
                  else
                    ...reports.map((r) => _ReportTile(report: r)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: AppColors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.cardSm),
        borderSide: const BorderSide(color: AppColors.black, width: 1.6),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.cardSm),
        borderSide: const BorderSide(color: AppColors.black, width: 1.6),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.cardSm),
        borderSide: const BorderSide(color: AppColors.black, width: 2.2),
      ),
    );
  }
}

class _ReportTile extends StatelessWidget {
  final FieldReport report;
  const _ReportTile({required this.report});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        onTap: () => _showDetail(context),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${report.type.label} · ${report.urgency.label}',
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                  const SizedBox(height: 3),
                  Text(
                    DateFormat('MMM d, HH:mm').format(report.createdAt),
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                  ),
                ],
              ),
            ),
            SyncStatusBadge(status: report.syncStatus),
          ],
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.cardLg)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${report.type.label} Report', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
            const SizedBox(height: 8),
            Text(report.notes),
            const SizedBox(height: 10),
            Text('Urgency: ${report.urgency.label}', style: const TextStyle(fontWeight: FontWeight.w700)),
            Text('Location: ${Places.name(report.latitude, report.longitude)}'),
            const SizedBox(height: 8),
            if (report.mediaIds.isEmpty)
              const Text('No photo attached')
            else
              _reportPhoto(report.mediaIds.first),
            const SizedBox(height: 10),
            SyncStatusBadge(status: report.syncStatus),
          ],
        ),
      ),
    );
  }

  Widget _reportPhoto(String mediaId) {
    final file = File(mediaId);
    if (!file.existsSync()) return const Text('Photo attached');
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.cardSm),
      child: Image.file(file, height: 160, width: double.infinity, fit: BoxFit.cover),
    );
  }
}
