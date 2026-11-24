// Main Gate → Quezon Hall → QH 1 on the LOCAL rehearsal records (see quezon_hall_trip_test.dart):
// 1. arriving: a GPS circle that covers Quezon Hall AND Hometel must not silently skip the walk;
// 2. once the route survey is imported, choosing "Entrance (Main Gate)" must give the walking route.
// The surveyed rows in (2) are SYNTHETIC test coordinates (a straight line gate → Quezon Hall), shaped
// exactly like scripts/route_survey_to_sql.py output. They are not survey data and must never be imported.
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart' show PolylineLayer;
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:wvsu_wayfinder/core/trip.dart';
import 'package:wvsu_wayfinder/data/campus.dart' show distanceM;
import 'package:wvsu_wayfinder/data/campus_outlines.dart';
import 'package:wvsu_wayfinder/data/location_service.dart';
import 'package:wvsu_wayfinder/data/models.dart';

import 'helpers.dart';
import 'quezon_hall_trip_test.dart' show expectQh1Selected, fixInside, inCard, leg, legIcon, legText, local, outlines, pumpLocal, shape;

const qh1 = '/map?to=room-quezon-hall-f1-qh1';
const atQh = 'You’re at Quezon Hall. Go straight to the floor plan.';
String startLine(WidgetTester t) => t.widget<Text>(find.byKey(const Key('start-line'))).data!;

LatLng centroid(String name) {
  final ring = shape(name).polygons.first;
  return LatLng(ring.map((p) => p.latitude).reduce((a, b) => a + b) / ring.length, ring.map((p) => p.longitude).reduce((a, b) => a + b) / ring.length);
}

/// The local fixture plus a SYNTHETIC verified gate → Quezon Hall route (importer row shapes and IDs).
Map<String, dynamic> surveyed() {
  final gate = centroid('Entrance (Main Gate)'), qh = centroid('Quezon Hall');
  LatLng at(double t) => LatLng(gate.latitude + (qh.latitude - gate.latitude) * t, gate.longitude + (qh.longitude - gate.longitude) * t);
  // The "door": the first point on the line 2 m outside Quezon Hall's outline.
  var door = 1.0;
  for (var t = 0.5; t <= 1; t += 0.005) {
    if (shape('Quezon Hall').distanceToM(at(t)) < 2) break;
    door = t;
  }
  final pts = {'gate-main': at(0), 'j-1': at(door / 3), 'j-2': at(door * 2 / 3), 'qh-entrance-main': at(door)};
  final ids = pts.keys.toList();
  Map<String, dynamic> node(String id) => {'id': 'n-$id', 'lng': pts[id]!.longitude, 'lat': pts[id]!.latitude, 'status': 'verified'};
  return {
    ...local,
    'places': [
      ...local['places'] as List,
      {'id': 'landmark-entrance-main-gate', 'kind': 'landmark', 'name': 'Entrance (Main Gate)', 'short_name': null, 'room_code': null, 'room_label': null, 'floor': null, 'parent_id': null, 'lng': gate.longitude, 'lat': gate.latitude, 'status': 'verified'},
    ],
    'building_features': [...local['building_features'] as List, {'feature_id': 41, 'place_id': 'landmark-entrance-main-gate', 'status': 'verified'}],
    'walk_nodes': [for (final id in ids) node(id)],
    'walk_edges': [
      for (var i = 0; i + 1 < ids.length; i++)
        {
          'id': 'w-${ids[i]}--${ids[i + 1]}', 'from_node': 'n-${ids[i]}', 'to_node': 'n-${ids[i + 1]}', 'status': 'verified',
          'length_m': distanceM(pts[ids[i]]!.longitude, pts[ids[i]]!.latitude, pts[ids[i + 1]]!.longitude, pts[ids[i + 1]]!.latitude),
        },
    ],
    'entrances': [
      {'id': 'ent-qh-entrance-main', 'building_id': 'bldg-quezon-hall', 'name': 'Quezon Hall main entrance', 'lng': pts['qh-entrance-main']!.longitude, 'lat': pts['qh-entrance-main']!.latitude, 'node_id': 'n-qh-entrance-main', 'status': 'verified'},
      {'id': 'ent-gate-main', 'building_id': 'landmark-entrance-main-gate', 'name': 'Main Gate (inside the gate)', 'lng': gate.longitude, 'lat': gate.latitude, 'node_id': 'n-gate-main', 'status': 'verified'},
    ],
  };
}

void main() {
  test('accuracy circle: which outlines a fix reaches (Hometel is ~12 m from Quezon Hall)', () {
    final all = outlines();
    final qh = centroid('Quezon Hall');
    expect(shape('Quezon Hall').distanceToM(qh), 0);
    expect([for (final b in buildingsWithin(all, qh, 8)) b.name], ['Quezon Hall']);
    expect([for (final b in buildingsWithin(all, qh, 30)) b.name], ['Quezon Hall', 'Hometel']);
    final hometelGap = shape('Hometel').distanceToM(qh);
    expect(hometelGap, inInclusiveRange(20, 30));
  });

  test('planTrip: inside Quezon Hall but the circle also reaches Hometel → confirm, never skip', () {
    final view = PlaceDestFor.qh1();
    final fix = fixInside('Quezon Hall', accuracy: 30);
    const both = [(name: 'Quezon Hall', placeId: 'bldg-quezon-hall'), (name: 'Hometel', placeId: 'bldg-hometel')];
    final trip = planTrip(view, GpsStart(fix, null, 'bldg-quezon-hall', both), null);
    expect(trip.status, TripStatus.gpsConfirm);
    expect(trip.message, 'Your location (±30 m) could be Quezon Hall or Hometel. Are you at Quezon Hall?');
    // Centre in Hometel, circle reaching Quezon Hall: also ask (they may be at the door).
    expect(planTrip(view, GpsStart(fix, null, 'bldg-hometel', both), null).status, TripStatus.gpsConfirm);
    // Only Quezon Hall in the circle: skip as before.
    expect(planTrip(view, GpsStart(fixInside('Quezon Hall'), null, 'bldg-quezon-hall', const [(name: 'Quezon Hall', placeId: 'bldg-quezon-hall')]), null).status,
        TripStatus.sameBuilding);
    // Poor fix: never confirm, never skip.
    final poor = planTrip(view, GpsStart(fixInside('Quezon Hall', accuracy: 80), null, 'bldg-quezon-hall', both), null);
    expect(poor.status, isNot(anyOf(TripStatus.gpsConfirm, TripStatus.sameBuilding)));
  });

  testWidgets('±30 m inside Quezon Hall (circle covers Hometel): the student confirms; QH 1 stays through every choice', (t) async {
    Future<void> arrive() async {
      await pumpLocal(t, qh1, location: FakeLocation(LocationOutcome.fix(fixInside('Quezon Hall', accuracy: 30))));
      await tapText(t, 'Use my location');
    }

    await arrive();
    expect(find.text(atQh), findsNothing, reason: 'the walk is not skipped on an ambiguous fix');
    expect(find.text('Your location (±30 m) could be Quezon Hall or Hometel. Are you at Quezon Hall?'), findsOneWidget);
    expect(inCard('inside-card', find.text('· Indoor step')), findsNothing);
    expect(legIcon(t, 'start').icon, Icons.radio_button_unchecked);
    expect(legText(t, 'walkway'), contains('Not needed if you’re already in Quezon Hall.'));
    expectQh1Selected(t);

    // "I'm at Quezon Hall" → straight to the floor plan, as a confirmed start.
    await tapText(t, 'I’m at Quezon Hall');
    expect(find.text('You’re already in this building. Go straight to the floor plan.'), findsOneWidget);
    expect(startLine(t), 'Quezon Hall');
    expect(find.byKey(const Key('confirm-arrival')), findsNothing);
    expectQh1Selected(t);

    // "I'm at Hometel" → Hometel becomes the start; the walk is still needed.
    await arrive();
    await tapText(t, 'I’m at Hometel');
    expect(startLine(t), 'Hometel');
    expect(find.text(atQh), findsNothing);
    expect(legText(t, 'start'), contains('Hometel: no surveyed entrance or walkway point yet.'));
    expectQh1Selected(t);

    // "Somewhere else" → the picker; Main Gate chosen; QH 1 still selected.
    await arrive();
    await tapText(t, 'Somewhere else');
    await t.enterText(find.byKey(const Key('start-filter')), 'gate');
    await t.pumpAndSettle();
    await tapText(t, 'Entrance (Main Gate)', last: true);
    expect(startLine(t), 'Entrance (Main Gate) (map only)');
    expectQh1Selected(t);
  });

  testWidgets('±8 m inside Quezon Hall (circle reaches no other building) still skips to the floor plan', (t) async {
    await pumpLocal(t, qh1, location: FakeLocation(LocationOutcome.fix(fixInside('Quezon Hall'))));
    await tapText(t, 'Use my location');
    expect(find.text(atQh), findsOneWidget);
    expect(find.byKey(const Key('confirm-arrival')), findsNothing);
  });

  testWidgets('after the survey is imported: Main Gate (picked by hand) → Quezon Hall → QH 1 is a walking route', (t) async {
    final data = surveyed();
    await pumpLocal(t, qh1, data: data);
    await tapText(t, 'Choose starting point');
    await t.enterText(find.byKey(const Key('start-filter')), 'gate');
    await t.pumpAndSettle();
    await tapText(t, 'Entrance (Main Gate)', last: true);
    expect(startLine(t), 'Entrance (Main Gate)', reason: 'the gate resolves to its landmark record, not "map only"');
    expect(find.text('Enter at: Quezon Hall main entrance'), findsOneWidget);
    expect(find.byType(PolylineLayer), findsOneWidget);
    expect(find.textContaining(' min'), findsWidgets);
    expect(leg('start'), findsNothing, reason: 'a full route needs no "what is missing" list');
    expectQh1Selected(t);

    // GPS at the gate (±8 m) → the same route from my location; QH 1 still selected.
    final gate = centroid('Entrance (Main Gate)');
    await pumpLocal(t, qh1, data: data, location: FakeLocation(LocationOutcome.fix(LocationFix(lat: gate.latitude, lng: gate.longitude, accuracyMeters: 8))));
    await tapText(t, 'Use my location');
    expect(find.text('Enter at: Quezon Hall main entrance'), findsOneWidget);
    expect(find.byType(PolylineLayer), findsOneWidget);
    expectQh1Selected(t);

    // GPS denied at the gate → pick Main Gate by hand → route; QH 1 kept throughout.
    await pumpLocal(t, qh1, data: data, location: FakeLocation(const LocationOutcome.failed(LocationFailure.deniedForever)));
    await tapText(t, 'Use my location');
    expect(find.textContaining('Location permission is blocked.'), findsOneWidget);
    expectQh1Selected(t);
    await tapText(t, 'Choose starting point');
    await t.enterText(find.byKey(const Key('start-filter')), 'gate');
    await t.pumpAndSettle();
    await tapText(t, 'Entrance (Main Gate)', last: true);
    expect(find.text('Enter at: Quezon Hall main entrance'), findsOneWidget);
    expect(find.textContaining('Location permission'), findsNothing, reason: 'the manual start clears the GPS notice');
    expectQh1Selected(t);
  });
}

/// The QH 1 destination built from the local fixture rows (no app needed).
extension PlaceDestFor on PlaceDest {
  static PlaceDest qh1() {
    final rows = (local['places'] as List).cast<Map<String, dynamic>>();
    final room = rows.singleWhere((p) => p['id'] == 'room-quezon-hall-f1-qh1');
    final hall = rows.singleWhere((p) => p['id'] == 'bldg-quezon-hall');
    return PlaceDest(PlaceView(Place.fromRow(room), Place.fromRow(hall)));
  }
}
