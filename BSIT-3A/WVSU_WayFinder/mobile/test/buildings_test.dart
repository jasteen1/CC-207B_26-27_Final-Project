// Tappable campus buildings, tapped through on the rendered map (widget test, no network).
// Polygons: a real excerpt of the team's MapTiler dataset (shared with the web tests).
// Place records: DEMO fixtures. Location: a fake GPS fix next to Rizal Hall.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:wvsu_wayfinder/core/theme.dart';
import 'package:wvsu_wayfinder/data/campus_outlines.dart';
import 'package:wvsu_wayfinder/data/location_service.dart';

import 'helpers.dart';

List<CampusBuilding> sample() => parseCampusBuildings(jsonDecode(File('../src/features/map/wayfinder-sample.json').readAsStringSync()) as Map<String, dynamic>);

const tall = Size(390, 1200);
final gpsNearRizal = FakeLocation(const LocationOutcome.fix(LocationFix(lat: 10.71379, lng: 122.56143, accuracyMeters: 8)));

Finder get polygonLayer => find.byType(PolygonLayer<String>);

/// Screen position (global) of a coordinate on the rendered map.
Offset onScreen(WidgetTester t, LatLng p) {
  final camera = MapCamera.of(t.element(polygonLayer));
  return t.getTopLeft(find.byType(FlutterMap)) + camera.latLngToScreenOffset(p);
}

/// Which buildings currently have the gold selection outline.
Set<String?> goldOutlined(WidgetTester t) =>
    t.widget<PolygonLayer<String>>(polygonLayer).polygons.where((p) => p.borderColor == gold).map((p) => p.hitValue).toSet();

/// A point inside the building's outline, away from the middle (where the label is).
LatLng insideAwayFromLabel(CampusBuilding b) {
  final ring = b.polygons.first;
  final c = LatLng(ring.map((p) => p.latitude).reduce((a, x) => a + x) / ring.length, ring.map((p) => p.longitude).reduce((a, x) => a + x) / ring.length);
  for (final v in ring) {
    final p = LatLng(c.latitude + (v.latitude - c.latitude) * .7, c.longitude + (v.longitude - c.longitude) * .7);
    if (b.contains(p)) return p;
  }
  return c;
}

Future<void> openMapWithGpsStart(WidgetTester t, {Size size = tall}) async {
  await pumpApp(t, size: size, initial: '/map', location: gpsNearRizal, campusShapes: sample());
  await tapText(t, 'Use my location');
  expect(find.textContaining('You are here · accuracy'), findsOneWidget);
  // The map re-centres on the fix (a reused map controller once kept the old camera).
  final camera = MapCamera.of(t.element(polygonLayer));
  expect(camera.zoom, 18);
  expect(camera.center, const LatLng(10.71379, 122.56143));
}

void main() {
  testWidgets('Rizal Hall (inside) → Library (label) → close: name + gold outline each time; GPS start survives; map still pans', (t) async {
    await openMapWithGpsStart(t);
    final buildings = sample();
    final rizal = buildings.firstWhere((b) => b.name == 'Rizal Hall'), library = buildings.firstWhere((b) => b.name == 'Library');

    await t.tapAt(onScreen(t, insideAwayFromLabel(rizal)));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('building-name')), findsOneWidget);
    expect(t.widget<Text>(find.byKey(const Key('building-name'))).data, 'Rizal Hall');
    expect(goldOutlined(t), {'map:20'});
    await tapText(t, 'Details');
    expect(find.text('Building details coming soon.'), findsOneWidget);
    expect(find.text('Building photo coming soon'), findsOneWidget);
    expect(find.textContaining('You are here · accuracy'), findsOneWidget);

    // Pans normally with the card open, and a drag selects nothing.
    final before = MapCamera.of(t.element(polygonLayer)).center;
    await t.drag(find.byType(FlutterMap), const Offset(-60, 30));
    await t.pumpAndSettle();
    expect(MapCamera.of(t.element(polygonLayer)).center, isNot(before));
    expect(t.widget<Text>(find.byKey(const Key('building-name'))).data, 'Rizal Hall');

    // Tap the Library's label (drawn at its polylabel point).
    final labelAt = Polygon(points: library.polygons.first, labelPlacementCalculator: const PolygonLabelPlacementCalculator.polylabel()).labelPosition;
    await t.tapAt(onScreen(t, labelAt));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('building-card')), findsOneWidget);
    expect(t.widget<Text>(find.byKey(const Key('building-name'))).data, 'Library');
    expect(goldOutlined(t), {'map:21'});

    await t.tap(find.byTooltip('Close'));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('building-card')), findsNothing);
    expect(goldOutlined(t), isEmpty);
    expect(find.textContaining('You are here · accuracy'), findsOneWidget);
  });

  testWidgets('linked verified record: description, floor, offices, rooms, zoomable floor plan; Directions keeps the start', (t) async {
    await openMapWithGpsStart(t);
    final library = sample().firstWhere((b) => b.name == 'Library');
    await t.tapAt(onScreen(t, insideAwayFromLabel(library)));
    await t.pumpAndSettle();
    // Drag the sheet's handle up slowly (no flick) to expand it.
    await t.drag(find.byKey(const Key('sheet-handle')), const Offset(0, -120));
    await t.pumpAndSettle();
    expect(find.textContaining('DEMO: placeholder description'), findsOneWidget);
    expect(find.textContaining('Demo Office of Student Affairs'), findsOneWidget);
    expect(find.text('LIB1'), findsOneWidget);

    await tapText(t, 'View floor plan');
    expect(find.text('Demo Library floor 1 blueprint'), findsOneWidget);
    expect(t.widget<Text>(find.byKey(const Key('plan-zoom'))).data, '100%');
    await t.tap(find.byTooltip('Zoom in'));
    await t.pumpAndSettle();
    expect(t.widget<Text>(find.byKey(const Key('plan-zoom'))).data, '150%');
    await tapText(t, 'Close', last: true);

    await tapText(t, 'Directions');
    expect(find.byKey(const Key('building-card')), findsNothing);
    expect(find.descendant(of: find.byKey(const Key('dest-card')), matching: find.text('Demo Library')), findsOneWidget);
    expect(find.textContaining('You are here · accuracy'), findsOneWidget);
  });

  testWidgets('wide screen: side card (no sheet handle), map stays visible', (t) async {
    await openMapWithGpsStart(t, size: const Size(1280, 1000));
    final rizal = sample().firstWhere((b) => b.name == 'Rizal Hall');
    await t.tapAt(onScreen(t, insideAwayFromLabel(rizal)));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('building-card')), findsOneWidget);
    expect(find.byKey(const Key('sheet-handle')), findsNothing);
    expect(find.text('Building details coming soon.'), findsOneWidget);
    expect(t.getTopLeft(find.byKey(const Key('building-card'))).dx, greaterThan(t.getTopRight(find.byType(FlutterMap)).dx));
  });

  test('parse: polygons only, two-polygon building is one, name:en preferred, key = lowest place_id', () {
    final list = sample();
    final coc = list.firstWhere((b) => b.name == 'College of Communication');
    expect(coc.featureIds, [33, 34]);
    expect(coc.key, 'map:33');
    expect(list.firstWhere((b) => b.name.startsWith('ROTC')).key, startsWith('map:f:'));
    expect(buildingName({'name': 'Bulwagan Rizal', 'name:en': 'Rizal Hall'}), 'Rizal Hall');
    expect(buildingName({'name': 'Parking Lot '}), 'Parking Lot');
    expect(panToReveal((left: 100, top: 300, right: 200, bottom: 420), (width: 400, height: 600), insetBottom: 250), (0.0, 86.0));
  });
}
