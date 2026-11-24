// Main Gate → Quezon Hall → QH 1 on the LOCAL rehearsal records (test/fixtures/local-quezon-hall.json:
// migrations + QH 1 pilot + bulk blueprint draft, published locally) through the LIVE repositories,
// answered by a small fake of Supabase REST. No walkway or entrance has been surveyed, so the app must
// keep QH 1 and its floor plan and say exactly which part of the route is missing.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart' show PolylineLayer;
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wvsu_wayfinder/core/config.dart';
import 'package:wvsu_wayfinder/core/trip.dart';
import 'package:wvsu_wayfinder/data/building_repository.dart';
import 'package:wvsu_wayfinder/data/campus.dart';
import 'package:wvsu_wayfinder/data/campus_outlines.dart';
import 'package:wvsu_wayfinder/data/location_service.dart';
import 'package:wvsu_wayfinder/data/places_repository.dart';

import 'helpers.dart';

final local = jsonDecode(File('test/fixtures/local-quezon-hall.json').readAsStringSync()) as Map<String, dynamic>;
const cfg = AppConfig(supabaseUrl: 'https://local.test', supabasePublishableKey: 'sb_publishable_test');
const tall = Size(390, 2600);

/// Just enough PostgREST for the app's queries: eq / in / ilike / or filters and the parent embed.
MockClient fakeRest() => MockClient((req) async {
      final seg = req.url.pathSegments;
      if (seg.length < 3 || seg[0] != 'rest') return http.Response('{}', 404);
      final rows = ((local[seg[2]] as List?) ?? (throw StateError('table ${seg[2]}'))).cast<Map<String, dynamic>>();
      bool test(Map<String, dynamic> r, String col, String opv) {
        final i = opv.indexOf('.');
        final op = opv.substring(0, i), v = opv.substring(i + 1), x = r[col]?.toString();
        return switch (op) {
          'eq' => x == v,
          'in' => v.replaceAll(RegExp(r'^\(|\)$'), '').split(',').contains(x),
          'ilike' => x != null && RegExp('^${RegExp.escape(v).replaceAll(r'\*', '.*')}\$', caseSensitive: false).hasMatch(x),
          _ => throw StateError('op $op'),
        };
      }
      var out = rows.where((r) {
        for (final e in req.url.queryParametersAll.entries) {
          if (['select', 'order', 'limit'].contains(e.key)) continue;
          for (final v in e.value) {
            if (e.key == 'or') {
              final parts = v.replaceAll(RegExp(r'^\(|\)$'), '').split(',');
              if (!parts.any((p) { final d = p.indexOf('.'); return test(r, p.substring(0, d), p.substring(d + 1)); })) return false;
            } else if (!test(r, e.key, v)) {
              return false;
            }
          }
        }
        return true;
      }).map((r) => {...r}).toList();
      // As real PostgREST does for this self-reference: `parent:parent_id(*)` = the row parent_id points to;
      // `parent:places!parent_id(*)` = the row's children, as a list (the live bug found when QH 1 was published).
      final sel = req.url.queryParameters['select'] ?? '';
      final places = (local['places'] as List).cast<Map<String, dynamic>>();
      if (sel.contains('parent:parent_id(')) {
        for (final r in out) {
          r['parent'] = places.where((p) => p['id'] == r['parent_id']).firstOrNull;
        }
      } else if (sel.contains('parent:places!parent_id(')) {
        for (final r in out) {
          r['parent'] = places.where((p) => p['parent_id'] == r['id']).toList();
        }
      }
      final limit = int.tryParse(req.url.queryParameters['limit'] ?? '');
      if (limit != null && out.length > limit) out = out.sublist(0, limit);
      return http.Response(jsonEncode(out), 200, headers: {'content-type': 'application/json; charset=utf-8'});
    });

List<CampusBuilding> outlines() => parseCampusBuildings(local['features'] as Map<String, dynamic>);
CampusBuilding shape(String name) => outlines().firstWhere((b) => b.name == name);

/// A point inside a building's outline (its vertex average; Quezon Hall is convex enough).
LocationFix fixInside(String name, {double accuracy = 8}) {
  final ring = shape(name).polygons.first;
  final lat = ring.map((p) => p.latitude).reduce((a, b) => a + b) / ring.length;
  final lng = ring.map((p) => p.longitude).reduce((a, b) => a + b) / ring.length;
  return LocationFix(lat: lat, lng: lng, accuracyMeters: accuracy);
}

Future<void> pumpLocal(WidgetTester t, String initial, {LocationService? location}) async {
  final client = fakeRest();
  await t.pumpWidget(const SizedBox()); // a fresh app each time (otherwise the router keeps its old location)
  await pumpApp(t,
      size: tall,
      initial: initial,
      config: cfg,
      places: LivePlacesRepository(cfg, client: client),
      campus: LiveCampusRepository(cfg, client: client),
      buildings: LiveBuildingRepository(cfg, client: client),
      campusShapes: outlines(),
      location: location);
}

Finder inCard(String key, Finder f) => find.descendant(of: find.byKey(Key(key)), matching: f);
Finder leg(String key) => find.byKey(Key('leg-$key'));
String legText(WidgetTester t, String key) =>
    t.widgetList<RichText>(find.descendant(of: leg(key), matching: find.byType(RichText))).map((r) => r.text.toPlainText()).join(' ');
Icon legIcon(WidgetTester t, String key) => t.widget<Icon>(find.descendant(of: leg(key), matching: find.byType(Icon)));

void expectQh1Selected(WidgetTester t) {
  expect(inCard('dest-card', find.text('Quezon Hall')), findsOneWidget);
  expect(inCard('inside-card', find.text('Room QH 1')), findsOneWidget);
  expect(inCard('inside-card', find.text('Floor 1')), findsOneWidget);
  expect(inCard('inside-card', find.textContaining('QH 1 highlighted')), findsOneWidget);
  expect(inCard('inside-card', find.byKey(const Key('room-highlight'))), findsOneWidget);
}

void main() {
  test('fixture is the local rehearsal data: QH 1 on floor 1 with a highlight; no surveyed walkway or entrance', () {
    final places = (local['places'] as List).cast<Map<String, dynamic>>();
    final qh1 = places.singleWhere((p) => p['room_code'] == 'QH1');
    expect(qh1['floor'], 1);
    expect(qh1['parent_id'], 'bldg-quezon-hall');
    expect((local['floor_plan_rooms'] as List).where((s) => s['place_id'] == qh1['id']), hasLength(1));
    expect(local['walk_edges'], isEmpty);
    expect(local['entrances'], isEmpty);
  });

  testWidgets('search QH 1 → Show on Map → start at Entrance (Main Gate): QH 1 stays, legs say exactly what is missing, no straight line', (t) async {
    await pumpLocal(t, '/search?q=QH 1');
    await tapText(t, 'Show on Map');
    expectQh1Selected(t);
    expect(find.text('Walk to this building, then go inside to QH 1.'), findsOneWidget);

    await tapText(t, 'Choose starting point');
    expect(find.byKey(const Key('mapped-starts')), findsOneWidget);
    // The list is long (buildings, gates, rooms): typing narrows it.
    await t.enterText(find.byKey(const Key('start-filter')), 'gate');
    await t.pumpAndSettle();
    expect(find.text('Entrance (Main Gate)'), findsOneWidget);
    expect(find.text('Hometel'), findsNothing);
    expect(find.text('Room 1'), findsNothing);
    await tapText(t, 'Entrance (Main Gate)', last: true);

    expect(find.byKey(const Key('start-line')), findsOneWidget);
    expect(t.widget<Text>(find.byKey(const Key('start-line'))).data, 'Entrance (Main Gate) (map only)');
    expect(find.text('No verified entrance is recorded for Quezon Hall yet, so walking directions are unavailable.'), findsOneWidget);
    expect(legText(t, 'start'), contains('Entrance (Main Gate) is drawn on the campus map, but no walkway point there has been surveyed yet.'));
    expect(legText(t, 'walkway'), contains('Not surveyed yet: no verified walkway leads to Quezon Hall.'));
    expect(legText(t, 'entrance'), contains('Quezon Hall entrance: '));
    expect(legText(t, 'entrance'), contains('Not surveyed yet'));
    expect(legText(t, 'inside'), contains('Floor 1: QH 1 highlighted on the floor plan.'));
    expect(legIcon(t, 'inside').icon, Icons.check_circle);
    for (final k in ['start', 'walkway', 'entrance']) {
      expect(legIcon(t, k).icon, Icons.block, reason: k);
    }
    expect(find.byType(PolylineLayer), findsNothing, reason: 'a straight line to a building centre is not a walking route');
    expectQh1Selected(t);
  });

  testWidgets('denied GPS → choose a start → a late GPS result keeps the manual choice; changing start keeps QH 1', (t) async {
    final gps = FakeLocation(const LocationOutcome.failed(LocationFailure.denied));
    await pumpLocal(t, '/map?to=room-quezon-hall-f1-qh1', location: gps);
    await tapText(t, 'Use my location');
    expect(gps.calls, 1);
    expectQh1Selected(t);
    expect(legText(t, 'start'), contains('Your location isn’t available. Choose a starting point.'));
    expect(find.text('Choose starting point'), findsOneWidget);

    await tapText(t, 'Choose starting point');
    await tapText(t, 'Hometel', last: true);
    expect(t.widget<Text>(find.byKey(const Key('start-line'))).data, 'Hometel');
    expect(legText(t, 'start'), contains('Hometel: no surveyed entrance or walkway point yet.'));
    expectQh1Selected(t);

    // Use my location again, but the answer arrives only after the student picks Main Gate by hand.
    final late = PendingLocation();
    await pumpLocal(t, '/map?to=room-quezon-hall-f1-qh1&from=bldg-hometel', location: late);
    await tapText(t, 'Use my location');
    await tapText(t, 'Choose starting point');
    await tapText(t, 'Entrance (Main Gate)', last: true);
    late.complete(LocationOutcome.fix(fixInside('Quezon Hall')));
    await t.pumpAndSettle();
    expect(t.widget<Text>(find.byKey(const Key('start-line'))).data, 'Entrance (Main Gate) (map only)', reason: 'late GPS ignored');
    expectQh1Selected(t);
  });

  testWidgets('already at Quezon Hall (GPS inside its outline, or picked as start) → straight to the QH 1 floor plan', (t) async {
    await pumpLocal(t, '/map?to=room-quezon-hall-f1-qh1', location: FakeLocation(LocationOutcome.fix(fixInside('Quezon Hall'))));
    await tapText(t, 'Use my location');
    expect(find.text('You’re at Quezon Hall. Go straight to the floor plan.'), findsOneWidget);
    expect(inCard('inside-card', find.text('· Indoor step')), findsOneWidget);
    expect(legIcon(t, 'walkway').icon, Icons.remove_circle_outline);
    expect(find.byKey(const Key('leg-entrance')), findsNothing);
    // The floor plan was scrolled into view.
    final card = t.getRect(find.byKey(const Key('inside-card')));
    expect(card.top, lessThan(t.view.physicalSize.height));
    expect(card.top, greaterThanOrEqualTo(0));
    expectQh1Selected(t);

    // Poor GPS inside the building isn't trusted as "you're here".
    await pumpLocal(t, '/map?to=room-quezon-hall-f1-qh1', location: FakeLocation(LocationOutcome.fix(fixInside('Quezon Hall', accuracy: 80))));
    await tapText(t, 'Use my location');
    expect(find.text('You’re at Quezon Hall. Go straight to the floor plan.'), findsNothing);
    expect(find.textContaining('GPS accuracy is poor'), findsOneWidget);

    // Picking Quezon Hall itself as the start does the same.
    await pumpLocal(t, '/map?to=room-quezon-hall-f1-qh1&from=bldg-quezon-hall');
    expect(find.text('You’re already in this building. Go straight to the floor plan.'), findsOneWidget);
    expectQh1Selected(t);
  });

  testWidgets('floor plan viewer: QH 1 highlighted; zoom keeps it in view; QH 2 moves the highlight', (t) async {
    await pumpLocal(t, '/map?to=room-quezon-hall-f1-qh1');
    await tapText(t, 'Open floor plan');
    final dialog = find.byType(Dialog);
    Finder hl() => find.descendant(of: dialog, matching: find.byKey(const Key('room-highlight')));
    expect(hl(), findsOneWidget);
    expect(find.descendant(of: dialog, matching: find.bySemanticsLabel('QH 1 highlighted on the floor plan')), findsOneWidget);
    final viewport = t.getRect(find.descendant(of: dialog, matching: find.byType(InteractiveViewer)));
    for (var i = 0; i < 2; i++) {
      await t.tap(find.byTooltip('Zoom in'));
      await t.pumpAndSettle();
    }
    // The highlighted room's centre stays inside the visible viewer.
    final spot = (local['floor_plan_rooms'] as List).cast<Map<String, dynamic>>().firstWhere((s) => s['label'] == 'QH 1');
    final img = t.getRect(find.descendant(of: dialog, matching: find.byType(Image)));
    final c = Offset(img.left + img.width * ((spot['x'] as num) + (spot['w'] as num) / 2), img.top + img.height * ((spot['y'] as num) + (spot['h'] as num) / 2));
    expect(viewport.contains(c), isTrue, reason: 'QH 1 centre $c inside viewer $viewport after zoom');
    await tapText(t, 'Show whole floor');
    Navigator.of(t.element(dialog)).pop();
    await t.pumpAndSettle();

    // Switch to QH 2: same floor plan, the highlight moves; QH 1 is no longer highlighted.
    await pumpLocal(t, '/map?to=room-quezon-hall-f1-qh2');
    expect(inCard('inside-card', find.text('Room QH 2')), findsOneWidget);
    expect(inCard('inside-card', find.textContaining('QH 2 highlighted')), findsOneWidget);
    expect(find.bySemanticsLabel('QH 1 highlighted on the floor plan'), findsNothing);
    expect(find.bySemanticsLabel('QH 2 highlighted on the floor plan'), findsOneWidget);
  });

  test('live search embeds the parent building as one record (regression: published QH 1 failed to load)', () async {
    final hits = await LivePlacesRepository(cfg, client: fakeRest()).search('QH 1');
    expect(hits.single.place.roomLabel, 'QH 1');
    expect(hits.single.parent?.name, 'Quezon Hall');
  });

  test('trip legs never treat a building centre as a walkway or entrance', () async {
    final paths = await LiveCampusRepository(cfg, client: fakeRest()).load();
    final places = await LivePlacesRepository(cfg, client: fakeRest()).search('QH1');
    final trip = planTrip(PlaceDest(places.single), const MappedStart('Entrance (Main Gate)'), paths);
    expect(trip.status, TripStatus.noEntrance);
    expect(trip.route, isNull);
    final legs = tripLegs(trip, const MappedStart('Entrance (Main Gate)'), paths);
    expect([for (final l in legs) (l.key, l.state)], [
      ('start', LegState.unavailable),
      ('walkway', LegState.unavailable),
      ('entrance', LegState.unavailable),
      ('inside', LegState.ok),
    ]);
  });
}
