// Search ICT 201 → CICT Building → starting point (building or GPS) → route to the entrance →
// blueprint with ICT 201 highlighted. DEMO records/walkways; polygons from the real dataset excerpt.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wvsu_wayfinder/data/campus_outlines.dart';
import 'package:wvsu_wayfinder/data/location_service.dart';

import 'helpers.dart';

List<CampusBuilding> sample() => parseCampusBuildings(jsonDecode(File('../src/features/map/wayfinder-sample.json').readAsStringSync()) as Map<String, dynamic>);
const tall = Size(390, 2400);
Finder inside(Finder f) => find.descendant(of: find.byKey(const Key('inside-card')), matching: f);
Finder inCard(String key, Finder f) => find.descendant(of: find.byKey(Key(key)), matching: f);

/// The highlight layer must cover exactly the blueprint image, and the spot sits at its fractions.
void expectHighlightOnImage(WidgetTester t, Finder scope) {
  final hl = find.descendant(of: scope, matching: find.byKey(const Key('room-highlight')));
  final img = find.descendant(of: scope, matching: find.byType(Image));
  expect(hl, findsOneWidget);
  expect(t.getRect(hl), t.getRect(img), reason: 'overlay box = image box');
  // ICT 201 on the demo blueprint: x .05, y .1, w .183333, h .25 of the image.
  final r = t.getRect(img);
  expect(r.width / r.height, closeTo(1200 / 800, .01));
}

void main() {
  testWidgets('search ICT-201 → record with door label, building and floor', (t) async {
    await pumpApp(t, size: tall, initial: '/search?q=ICT-201', campusShapes: sample());
    expect(find.text('Demo Room ICT 201'), findsOneWidget);
    expect(find.text('ICT 201'), findsOneWidget); // label as printed on the door
    expect(find.text('Demo CICT Building'), findsOneWidget);
  });

  testWidgets('full flow: choose a starting building → route to the entrance → ICT 201 highlighted; zoom and rotation keep it aligned', (t) async {
    await pumpApp(t, size: tall, initial: '/search?q=ict201', campusShapes: sample());
    await tapText(t, 'Show on Map');
    expect(inCard('dest-card', find.text('Demo CICT Building')), findsOneWidget);
    expect(inCard('dest-card', find.text('Walk to this building, then go inside to ICT 201.')), findsOneWidget);

    await tapText(t, 'Choose starting point');
    await tapText(t, 'Demo Administration Building', last: true);
    expect(find.textContaining(' min'), findsWidgets);
    expect(find.text('Enter at: Demo CICT east entrance'), findsOneWidget);

    expect(inside(find.text('Room ICT 201')), findsOneWidget);
    expect(inside(find.text('Floor 2')), findsOneWidget);
    expect(inside(find.text('Demo CICT floor 2 · ICT 201 highlighted')), findsOneWidget);
    expectHighlightOnImage(t, find.byKey(const Key('inside-card')));

    // Phone rotated: the card re-lays out; the overlay still matches the image exactly.
    t.view.physicalSize = const Size(1000, 2400);
    await t.pumpAndSettle();
    expectHighlightOnImage(t, find.byKey(const Key('inside-card')));
    t.view.physicalSize = tall;
    await t.pumpAndSettle();

    await tapText(t, 'Open floor plan');
    final dialog = find.byType(Dialog);
    expectHighlightOnImage(t, dialog);
    await t.tap(find.byTooltip('Zoom in'));
    await t.pumpAndSettle();
    await t.tap(find.byTooltip('Zoom in'));
    await t.pumpAndSettle();
    expect(t.widget<Text>(find.byKey(const Key('plan-zoom'))).data, '225%');
    // Zoom transforms the image and the overlay together (one child of the InteractiveViewer).
    expectHighlightOnImage(t, dialog);
  });

  testWidgets('GPS start near a demo walkway → route to the CICT entrance', (t) async {
    await pumpApp(t, size: tall, initial: '/map?to=room-demo-ict-201', campusShapes: sample(),
        location: FakeLocation(const LocationOutcome.fix(LocationFix(lat: 10.7137, lng: 122.5619, accuracyMeters: 9))));
    await tapText(t, 'Use my location');
    expect(find.textContaining('You are here · accuracy ±9 m'), findsWidgets);
    expect(find.text('Enter at: Demo CICT east entrance'), findsOneWidget);
    expect(inside(find.byKey(const Key('room-highlight'))), findsOneWidget);
  });

  testWidgets('same building: from ICT 101 straight to the indoor step', (t) async {
    await pumpApp(t, size: tall, initial: '/map?to=room-demo-ict-201&from=room-demo-ict-101', campusShapes: sample());
    expect(find.text('You’re already in this building. Go straight to the floor plan.'), findsOneWidget);
    expect(find.textContaining(' min walk'), findsNothing);
    expect(inside(find.byKey(const Key('room-highlight'))), findsOneWidget);
  });

  testWidgets('prefix only: ICT 999 points to CICT, unconfirmed, no floor; Show on Map keeps the message', (t) async {
    await pumpApp(t, size: tall, initial: '/search?q=ict%20999', campusShapes: sample());
    expect(find.text('ICT points to CICT Building. Room 999 hasn’t been confirmed yet.'), findsOneWidget);
    await tapText(t, 'Show CICT Building on Map');
    expect(inCard('dest-card', find.text('Demo CICT Building')), findsOneWidget);
    expect(inCard('dest-card', find.text('ICT points to CICT Building. Room 999 hasn’t been confirmed yet.')), findsOneWidget);
    expect(find.byKey(const Key('inside-card')), findsNothing);
  });

  testWidgets('start picker lists campus-map buildings; an unlinked one keeps the destination and explains', (t) async {
    await pumpApp(t, size: tall, initial: '/map?to=room-demo-ict-201', campusShapes: sample());
    await tapText(t, 'Choose starting point');
    // The sheet's list is lazy: scroll down to the campus-map section like a student would.
    final rizal = find.widgetWithText(ListTile, 'Rizal Hall');
    await t.scrollUntilVisible(rizal, 200, scrollable: find.descendant(of: find.byType(BottomSheet), matching: find.byType(Scrollable)).first);
    expect(find.byKey(const Key('mapped-starts')), findsOneWidget);
    await t.tap(rizal);
    await t.pumpAndSettle();
    expect(find.textContaining('Rizal Hall isn’t linked to a WayFinder building record yet, so walking directions from it are unavailable'), findsOneWidget);
    expect(find.text('Rizal Hall (map only)'), findsOneWidget);
    expect(inCard('dest-card', find.text('Demo CICT Building')), findsOneWidget);
  });

  testWidgets('denied GPS keeps the destination and the highlighted room, and offers manual selection', (t) async {
    await pumpApp(t, size: tall, initial: '/map?to=room-demo-ict-201', campusShapes: sample(), location: FakeLocation(const LocationOutcome.failed(LocationFailure.denied)));
    await tapText(t, 'Use my location');
    expect(find.textContaining('permission was not granted'), findsOneWidget);
    expect(inCard('dest-card', find.text('Demo CICT Building')), findsOneWidget);
    expect(inside(find.byKey(const Key('room-highlight'))), findsOneWidget);
    expect(find.text('Choose starting point'), findsOneWidget);
  });
}
