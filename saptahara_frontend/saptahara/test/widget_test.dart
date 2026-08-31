// Smoke test — verifies the app boots without throwing.
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:saptahara/main.dart';

void main() {
  testWidgets('SaptaharaApp builds', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: SaptaharaApp()));
    // First frame renders without exceptions.
    expect(find.byType(SaptaharaApp), findsOneWidget);
  });
}
