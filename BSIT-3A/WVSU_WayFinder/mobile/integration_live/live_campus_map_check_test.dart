// Manual live check (NOT part of `flutter test`): the Campus Map's building polygons come straight from
// the MapTiler Data endpoint, and the tap-through works on that live geometry.
//   flutter test --dart-define-from-file=env.json integration_live/live_campus_map_check_test.dart
// Prints only counts and distances, never the key or the keyed URL.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:wvsu_wayfinder/core/config.dart';
import 'package:wvsu_wayfinder/core/theme.dart';
import 'package:wvsu_wayfinder/data/campus_outlines.dart';

import '../test/helpers.dart';

void main() {
  final config = AppConfig.fromEnvironment();
  late Map<String, dynamic> raw; // the endpoint's own JSON, parsed independently of the app
  late List<CampusBuilding> live; // what the app's loader returns

  // Real network for these two fetches: the test binding otherwise answers every request with 400.
  setUpAll(() async {
    expect(config.mapTilerKey, isNotEmpty, reason: 'pass --dart-define-from-file=env.json');
    await HttpOverrides.runWithHttpOverrides(() async {
      final res = await http.get(Uri.https('api.maptiler.com', '/data/$campusOutlinesDatasetId/features.json', {'key': config.mapTilerKey}));
      expect(res.statusCode, 200);
      raw = jsonDecode(res.body) as Map<String, dynamic>;
      live = await loadCampusBuildings(config.mapTilerKey); // the app's own loader, same endpoint
    }, _RealNetwork());
    // ignore: avoid_print
    print('LIVE dataset -> HTTP 200; ${(raw['features'] as List).length} features; app loader parsed ${live.length} buildings');
  });

  List<LatLng> endpointRing(String name) {
    final f = (raw['features'] as List).cast<Map<String, dynamic>>().firstWhere((f) => (f['properties']['name'] as String).trim() == name);
    return [for (final c in ((f['geometry']['coordinates'] as List).first as List).cast<List>()) LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble())];
  }

  Finder polygonLayer() => find.byType(PolygonLayer<String>);
  Offset onScreen(WidgetTester t, LatLng p) => t.getTopLeft(find.byType(FlutterMap)) + MapCamera.of(t.element(polygonLayer())).latLngToScreenOffset(p);
  List<Polygon<String>> drawn(WidgetTester t) => t.widget<PolygonLayer<String>>(polygonLayer()).polygons;
  Set<String?> gold_(WidgetTester t) => drawn(t).where((p) => p.borderColor == gold).map((p) => p.hitValue).toSet();
  String? cardName(WidgetTester t) => t.widget<Text>(find.byKey(const Key('building-name'))).data;
  String? startLine(WidgetTester t) => t.widget<Text>(find.byKey(const Key('start-line'))).data;

  testWidgets('live dataset: rendered polygons = endpoint; Rizal Hall → Library → close keeps the starting point', (t) async {
    await pumpApp(t, size: const Size(390, 1400), initial: '/map?to=bldg-demo-cb&from=bldg-demo-admin', config: config, campusShapes: live);
    expect(startLine(t), 'Demo Administration Building');

    // Every endpoint polygon is drawn, vertex for vertex.
    final polys = (raw['features'] as List).where((f) => f['geometry']['type'] == 'Polygon').length;
    expect(drawn(t).length, polys);
    final byKey = {for (final b in live) b.key: b};
    for (final name in ['Rizal Hall', 'Library']) {
      final b = live.firstWhere((b) => b.name == name);
      final rendered = drawn(t).firstWhere((p) => p.hitValue == b.key).points;
      expect(rendered, endpointRing(name), reason: '$name vertices');
      // ignore: avoid_print
      print('$name (${b.key}): ${rendered.length} rendered vertices == endpoint, exact');
    }

    final camera = MapCamera.of(t.element(polygonLayer()));
    // Frame the two buildings so both are tappable at a realistic zoom.
    final both = [...endpointRing('Rizal Hall'), ...endpointRing('Library')];
    MapController.maybeOf(t.element(polygonLayer()))?.fitCamera(CameraFit.coordinates(coordinates: both, padding: const EdgeInsets.all(60)));
    await t.pumpAndSettle();
    // ignore: avoid_print
    print('camera zoom ${camera.zoom.toStringAsFixed(1)} -> ${MapCamera.of(t.element(polygonLayer())).zoom.toStringAsFixed(1)}');

    for (final name in ['Rizal Hall', 'Library']) {
      final b = live.firstWhere((b) => b.name == name);
      // Tap the centre of the endpoint's own ring (not the app's parsed copy).
      final r = endpointRing(name).sublist(1);
      final c = LatLng(r.map((p) => p.latitude).reduce((a, x) => a + x) / r.length, r.map((p) => p.longitude).reduce((a, x) => a + x) / r.length);
      await t.tapAt(onScreen(t, c));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('building-card')), findsOneWidget);
      expect(cardName(t), name);
      expect(gold_(t), {b.key});
      final goldPoly = drawn(t).lastWhere((p) => p.borderColor == gold);
      expect(goldPoly.points, endpointRing(name));
      expect(goldPoly.borderStrokeWidth, 4);
      expect(startLine(t), 'Demo Administration Building');
      // ignore: avoid_print
      print('tap $name -> card "${cardName(t)}", gold outline on ${gold_(t)} (${byKey[b.key]!.name}), start "${startLine(t)}"');
    }

    await t.tap(find.byTooltip('Close'));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('building-card')), findsNothing);
    expect(gold_(t), isEmpty);
    expect(startLine(t), 'Demo Administration Building');
    // ignore: avoid_print
    print('close -> no card, no gold outline, start "${startLine(t)}"');
  });

  testWidgets('live dataset: tapping Annex 1, Annex 3 and Roxas Hall each selects only that building', (t) async {
    await pumpApp(t, size: const Size(390, 1400), initial: '/map', config: config, campusShapes: live);
    final names = ['PSFW Building / College of Medicine (Annex 1)', 'College of Medicine - Annex 3', 'College of Medicine (Roxas Hall)'];
    MapController.maybeOf(t.element(polygonLayer()))?.fitCamera(CameraFit.coordinates(
        coordinates: [for (final n in names) ...endpointRing(n)], padding: const EdgeInsets.all(40)));
    await t.pumpAndSettle();
    for (final n in names) {
      final b = live.firstWhere((x) => x.name == n);
      final r = endpointRing(n).sublist(1);
      final c = LatLng(r.map((p) => p.latitude).reduce((a, x) => a + x) / r.length, r.map((p) => p.longitude).reduce((a, x) => a + x) / r.length);
      expect(b.contains(c), isTrue, reason: '$n: centroid lies inside its own outline');
      await t.tapAt(onScreen(t, c));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('building-card')), findsOneWidget, reason: n);
      expect(cardName(t), n);
      expect(gold_(t), {b.key}, reason: 'only $n has the gold outline');
      // ignore: avoid_print
      print('tap $n -> card "${cardName(t)}", gold on ${gold_(t)} (key ${b.key}, featureIds ${b.featureIds})');
      await t.tap(find.byTooltip('Close'));
      await t.pumpAndSettle();
    }
  });
}

class _RealNetwork extends HttpOverrides {}
