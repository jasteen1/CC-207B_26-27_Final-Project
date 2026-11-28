import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wvsu_wayfinder/wf/app.dart';
import 'package:wvsu_wayfinder/wf/core.dart';

Future<void> open(WidgetTester t, String route) async {
  final data = await t.runAsync(() => WFData.load());
  await t.binding.setSurfaceSize(const Size(390, 844));
  await t.pumpWidget(WFApp(state: WFState(data!), initial: route));
  await t.pump(const Duration(milliseconds: 600));
}

Future<void> loadFonts() async {
  final fira = FontLoader('Fira Sans')..addFont(rootBundle.load('assets/wf/fonts/FiraSans-Regular.ttf'))..addFont(rootBundle.load('assets/wf/fonts/FiraSans-SemiBold.ttf'))..addFont(rootBundle.load('assets/wf/fonts/FiraSans-Bold.ttf'));
  final sig = FontLoader('Signika')..addFont(rootBundle.load('assets/wf/fonts/Signika.ttf'));
  await Future.wait([fira.load(), sig.load()]);
}

void main() {
  setUpAll(loadFonts);
  for (final r in ['/home?returning=1', '/scan/review', '/schedule?view=week&day=3', '/map/place/quezon-hall?floor=1&room=QH%201&settled=1', '/map/route?from=cict-building&to=quezon-hall&walk=done', '/directory/process/transcript', '/directory', '/notifications', '/map']) {
    testWidgets('renders $r', (t) async { await open(t, r); expect(t.takeException(), isNull);
      // Screens must fill the phone (regression: a collapsed Stack left every screen blank).
      expect(t.getSize(find.byType(Scaffold).last).height, greaterThan(400)); await t.pumpWidget(const SizedBox()); await t.pump(const Duration(seconds: 13)); });
  }
  testWidgets('class reminder banner shows over Home', (t) async {
    await open(t, '/home?returning=1');
    await t.pump(const Duration(seconds: 4));
    await t.pump(const Duration(milliseconds: 700));
    expect(t.takeException(), isNull);
    expect(find.text('CIT 251 in 15 min'), findsOneWidget);
    await t.pumpWidget(const SizedBox()); await t.pump(const Duration(seconds: 13));
  });
}
