import 'dart:async';
import 'package:flutter/material.dart';
import 'package:saptahara/core/theme/app_theme.dart';
import 'package:saptahara/domain/entities/entities.dart';

/// Shows a transient top toast for a live socket alert. Colour + icon reflect
/// severity; it auto-dismisses after a few seconds (longer for critical) and
/// can be swiped/tapped away.
void showAlertToast(BuildContext context, HazardAlert alert, {VoidCallback? onTap}) {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return;
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (_) => _AlertToast(
      alert: alert,
      onTap: onTap,
      onDismiss: () {
        if (entry.mounted) entry.remove();
      },
    ),
  );
  overlay.insert(entry);
}

class _AlertToast extends StatefulWidget {
  final HazardAlert alert;
  final VoidCallback onDismiss;
  final VoidCallback? onTap;
  const _AlertToast({required this.alert, required this.onDismiss, this.onTap});

  @override
  State<_AlertToast> createState() => _AlertToastState();
}

class _AlertToastState extends State<_AlertToast>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  );
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _c.forward();
    final ms = widget.alert.severity == AlertSeverity.critical ? 6000 : 4000;
    _timer = Timer(Duration(milliseconds: ms), _close);
  }

  Future<void> _close() async {
    _timer?.cancel();
    if (!mounted) return;
    await _c.reverse();
    widget.onDismiss();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _c.dispose();
    super.dispose();
  }

  ({Color color, IconData icon, String tag}) get _style {
    switch (widget.alert.severity) {
      case AlertSeverity.critical:
        return (color: AppColors.riskyRed, icon: Icons.sos_rounded, tag: 'CRITICAL');
      case AlertSeverity.warning:
        return (
          color: AppColors.moderateOrange,
          icon: Icons.warning_amber_rounded,
          tag: 'WARNING'
        );
      case AlertSeverity.info:
        return (color: AppColors.purpleTrust, icon: Icons.info_rounded, tag: 'INFO');
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _style;
    final slide = Tween<Offset>(begin: const Offset(0, -1), end: Offset.zero)
        .animate(CurvedAnimation(parent: _c, curve: Curves.easeOutBack));
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        child: SlideTransition(
          position: slide,
          child: FadeTransition(
            opacity: _c,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: Material(
                color: Colors.transparent,
                child: GestureDetector(
                  onTap: () {
                    widget.onTap?.call();
                    _close();
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                      border: Border.all(color: AppColors.black, width: 2.5),
                      boxShadow: const [
                        BoxShadow(color: Colors.black26, blurRadius: 12, offset: Offset(0, 4)),
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(color: s.color, shape: BoxShape.circle),
                          child: Icon(s.icon, color: AppColors.white, size: 22),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    s.tag,
                                    style: TextStyle(
                                      color: s.color,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 10,
                                      letterSpacing: 0.6,
                                    ),
                                  ),
                                  const Spacer(),
                                  const Text('LIVE',
                                      style: TextStyle(
                                        color: AppColors.safeGreen,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 9,
                                      )),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                widget.alert.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: AppColors.black,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14,
                                ),
                              ),
                              Text(
                                widget.alert.detail,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: AppColors.black,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (widget.onTap != null)
                          const Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.place_rounded, color: AppColors.black, size: 20),
                              Text('LOCATE',
                                  style: TextStyle(
                                      fontSize: 8, fontWeight: FontWeight.w900)),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
