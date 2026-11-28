import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wvsu_wayfinder/core/config.dart';
import 'package:wvsu_wayfinder/core/time.dart';
import 'package:wvsu_wayfinder/data/guide_client.dart';
import 'package:wvsu_wayfinder/data/location_service.dart';
import 'package:wvsu_wayfinder/data/models.dart';
import 'package:wvsu_wayfinder/data/places_repository.dart';
import 'package:wvsu_wayfinder/screens/import_schedule_screen.dart';
import 'package:wvsu_wayfinder/data/schedule_import.dart';

import 'helpers.dart';

const live = AppConfig(supabaseUrl: 'https://x.supabase.co', supabasePublishableKey: 'sb_publishable_x');
const tall = Size(390, 2600); // ListView builds only on-screen items; a tall test window keeps lower cards built
final monday8am = DateTime.utc(2026, 11, 23, 0, 0); // Monday 08:00 Asia/Manila

class FlakyRepo implements PlacesRepository {
  bool failing = true;
  @override
  bool get isDemo => false;
  @override
  Future<List<PlaceView>> search(String q) async => failing ? throw PlacesException('HTTP 500') : [];
  @override
  Future<PlaceView?> getPlace(String id) async => null;
  @override
  Future<List<PlaceView>> list() async => [];
}

Future<void> fillClass(WidgetTester t, {required String subject, required String room, String? prof, String start = '13:30', String end = '15:00'}) async {
  await t.enterText(find.byKey(const Key('subject')), subject);
  await t.enterText(find.byKey(const Key('start')), start);
  await t.enterText(find.byKey(const Key('end')), end);
  await t.enterText(find.byKey(const Key('room')), room);
  if (prof != null) await t.enterText(find.byKey(const Key('prof')), prof);
  await tapText(t, 'Save class');
}

void main() {
  setUp(() => appClock = () => monday8am);
  tearDown(() {
    appClock = DateTime.now;
    ImportScheduleScreen.debugImport = null;
  });

  testWidgets('five tabs, Add my Schedule on Home, demo banner', (t) async {
    await pumpApp(t);
    for (final l in ['Home', 'Map', 'Processes', 'Directory', 'AI Guide']) {
      expect(navTab(l), findsOneWidget);
    }
    expect(find.text('Add my Schedule'), findsOneWidget);
    expect(find.textContaining('DEMO DATA'), findsOneWidget);
  });

  testWidgets('Home → Add my Schedule → Next class → Find room → building destination + room/floor', (t) async {
    await pumpApp(t, now: () => monday8am, size: tall);
    await tapText(t, 'Add my Schedule');
    await tapText(t, 'Add a class manually');
    await fillClass(t, subject: 'CIT 210 Web Systems', room: 'cb 203', prof: 'Demo Prof. Maria Mapped');
    expect(find.text('CIT 210 Web Systems'), findsOneWidget);
    await tapText(t, 'Home');
    final card = find.byKey(const ValueKey('next-class'));
    expect(find.descendant(of: card, matching: find.text('CIT 210 Web Systems')), findsOneWidget);
    expect(find.descendant(of: card, matching: find.text('cb 203')), findsOneWidget);
    expect(find.descendant(of: card, matching: find.text('1:30 PM–3:00 PM')), findsOneWidget);
    expect(find.descendant(of: card, matching: find.text('in 5 h 30 min')), findsOneWidget);
    expect(find.descendant(of: card, matching: find.text('Demo Prof. Maria Mapped')), findsOneWidget);
    expect(find.text('Room location unconfirmed'), findsNothing);
    await tapText(t, 'Find room');
    expect(find.descendant(of: find.byKey(const Key('dest-card')), matching: find.text('Demo College Building')), findsOneWidget);
    expect(find.descendant(of: find.byKey(const Key('inside-card')), matching: find.text('Room CB203')), findsOneWidget);
    expect(find.descendant(of: find.byKey(const Key('inside-card')), matching: find.text('Floor 2')), findsOneWidget);
  });

  testWidgets('unmatched room code is preserved and marked unconfirmed (schedule + Home)', (t) async {
    final store = await pumpApp(t, initial: '/schedule/new', size: tall);
    await fillClass(t, subject: 'PE 1', room: 'GYM-X 9');
    expect(find.text('GYM-X 9'), findsOneWidget);
    expect(find.text('Room location unconfirmed'), findsOneWidget);
    expect(store.classes.single.roomPlaceId, isNull);
    await tapText(t, 'Home');
    expect(find.text('Room location unconfirmed'), findsOneWidget);
  });

  testWidgets('edit then delete a class', (t) async {
    final store = await pumpApp(t, initial: '/schedule/new', size: tall);
    await fillClass(t, subject: 'Math 1', room: 'CB 101');
    await tapText(t, 'Math 1');
    await t.enterText(find.byKey(const Key('subject')), 'Math 2');
    await tapText(t, 'Save class');
    expect(find.text('Math 2'), findsOneWidget);
    expect(store.classes, hasLength(1));
    await tapText(t, 'Math 2');
    await tapText(t, 'Delete class');
    expect(store.classes, isEmpty);
    expect(find.text('No classes yet'), findsOneWidget);
  });

  testWidgets('import review fills classes, resolves rooms and avoids duplicate imports', (t) async {
    ImportScheduleScreen.debugImport = () async => parseScheduleText(
      'CIT 210 Web Systems | MWF | 1:30-3:00 PM | CB 203 | Professor: Maria Mapped');
    final store = await pumpApp(t, size: tall);
    await tapText(t, 'Add my Schedule');
    await tapText(t, 'Upload a photo, screenshot or PDF');
    expect(find.text('We found 3 classes on 3 days'), findsOneWidget);
    expect(store.classes, isEmpty);
    await tapText(t, 'Confirm 3 classes');
    expect(store.classes, hasLength(3));
    expect(store.classes.map((c) => c.weekday), [1, 3, 5]);
    expect(store.classes.every((c) => c.remindMinutes == 15), isTrue);
    expect(store.classes.every((c) => c.roomPlaceId == 'room-demo-cb-203'), isTrue);
    expect(store.classes.first.professor, 'Maria Mapped');
    await tapText(t, 'View my week');
    await tapText(t, 'Re-import');
    await tapText(t, 'Upload a photo, screenshot or PDF');
    await tapText(t, 'Confirm 3 classes');
    expect(store.classes, hasLength(3));
  });

  testWidgets('picker cancellation leaves schedule unchanged', (t) async {
    ImportScheduleScreen.debugImport = () async => null;
    final store = await pumpApp(t, initial: '/schedule/import', size: tall);
    await tapText(t, 'Upload a photo, screenshot or PDF');
    expect(store.classes, isEmpty);
    expect(find.byKey(const Key('save-import')), findsNothing);
  });

  testWidgets('missing room can be edited before saving', (t) async {
    ImportScheduleScreen.debugImport = () async => parseScheduleText('CC 207 Programming | M | 08:00-09:00');
    final store = await pumpApp(t, initial: '/schedule/import', size: tall);
    await tapText(t, 'Upload a photo, screenshot or PDF');
    expect(store.classes, isEmpty);
    await tapText(t, 'Edit');
    await t.enterText(find.widgetWithText(TextFormField, 'Room (optional)'), 'CB 203');
    await tapText(t, 'Apply');
    await tapText(t, 'Confirm 1 class');
    expect(store.classes.single.roomCodeRaw, 'CB 203');
  });

  testWidgets('zero detected classes can be recovered from corrected recognized text', (t) async {
    ImportScheduleScreen.debugImport = () async => const ScheduleImportResult(
      sessions: [], warnings: ['No complete meetings detected.'], rawText: 'WEB SYSTEMS\nMONDAY\nUnreadable time');
    final store = await pumpApp(t, initial: '/schedule/import', size: tall);
    await tapText(t, 'Upload a photo, screenshot or PDF');
    expect(find.text('We found 0 classes on 0 days'), findsOneWidget);
    await t.enterText(find.byKey(const Key('recognized-text')),
      'Subject | Day | Time | Room | Professor\nWeb Systems | Monday | 08:00-09:00 | CB203 | Maria Cruz');
    await tapText(t, 'Read these details');
    expect(find.text('We found 1 class on 1 day'), findsOneWidget);
    await tapText(t, 'Confirm 1 class');
    expect(store.classes.single.subject, 'Web Systems');
    expect(store.classes.single.roomCodeRaw, 'CB203');
    expect(store.classes.single.professor, 'Maria Cruz');
  });

  testWidgets('missing room can be saved as unconfirmed according to SQL', (t) async {
    ImportScheduleScreen.debugImport = () async => parseScheduleText('CC 207 Programming | M | 08:00-09:00');
    final store = await pumpApp(t, initial: '/schedule/import', size: tall);
    await tapText(t, 'Upload a photo, screenshot or PDF');
    await tapText(t, 'Confirm 1 class');
    expect(store.classes.single.roomCodeRaw, '');
    await tapText(t, 'View my week');
    expect(find.text('Room not specified'), findsOneWidget);
  });

  testWidgets('sample timetable can be corrected, confirmed and browsed by day', (t) async {
    final store = await pumpApp(t, initial:'/schedule/import');
    await tapText(t,'IUIS timetable screenshot');
    expect(find.text('We found 9 classes on 5 days'),findsOneWidget);
    await tapText(t,'Use CB203');
    await tapText(t,'Confirm 9 classes');
    expect(store.classes.length,9);
    expect(store.classes.where((s)=>s.roomCodeRaw=='C8203'),isEmpty);
    expect(find.text('Your schedule is saved'),findsOneWidget);
    await tapText(t,'View my week');
    await tapText(t,'SAT');
    expect(find.text('No classes on Saturday'),findsOneWidget);
    await tapText(t,'MON');
    expect(find.text('IT 311 Web Systems and Technologies'),findsOneWidget);
  });

  testWidgets('search: unknown code keeps what was typed', (t) async {
    await pumpApp(t, initial: '/search?q=XY%20999');
    expect(find.textContaining('No match for “XY 999”'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'XY 999'), findsOneWidget);
  });

  testWidgets('failed live request shows Retry (no demo data)', (t) async {
    final repo = FlakyRepo();
    await pumpApp(t, initial: '/search?q=cb%20203', places: repo, config: live);
    expect(find.textContaining('Couldn’t load search results'), findsOneWidget);
    repo.failing = false;
    await tapText(t, 'Retry');
    expect(find.textContaining('a verified place'), findsOneWidget);
  });

  testWidgets('Processes: list → detail → mark step complete → next step moves on', (t) async {
    await pumpApp(t, initial: '/processes', size: tall);
    expect(find.text('Demo Enrollment'), findsOneWidget);
    await tapText(t, 'Demo Enrollment');
    expect(find.text('BEFORE YOU START'), findsOneWidget);
    expect(find.text('Assessment form'), findsOneWidget);
    expect(find.text('0 of 3 steps completed'), findsOneWidget);
    expect(find.text('Take me there'), findsOneWidget);
    await t.tap(find.byKey(const Key('mark-next')));
    await t.pumpAndSettle();
    expect(find.text('1 of 3 steps completed'), findsOneWidget);
    expect((t.widget(find.byKey(const Key('next-step-title'))) as Text).data, 'Cashier');
  });

  testWidgets('Directory: Faculty filter, detail with verified office → Show on map; without → unconfirmed', (t) async {
    await pumpApp(t, initial: '/directory');
    expect(find.text('Demo Prof. Maria Mapped'), findsOneWidget);
    expect(find.textContaining('Hidden'), findsNothing);
    await tapText(t, 'Faculty');
    expect(find.text('BUILDINGS, ROOMS AND OFFICES'), findsNothing);
    await tapText(t, 'Demo Prof. Maria Mapped');
    expect(find.text('Demo Associate Professor'), findsOneWidget);
    expect(find.text('Show on map'), findsOneWidget);
    await tapText(t, 'Directory');
    await tapText(t, 'Demo Prof. Juan Unmapped');
    expect(find.text('Office location unconfirmed'), findsOneWidget);
    expect(find.text('Show on map'), findsNothing);
  });

  testWidgets('AI Guide: provider unavailable → labeled directory/process search', (t) async {
    await pumpApp(t, initial: '/guide');
    await tapText(t, 'How do I process my clearance?');
    expect(find.text('Search results · not an AI answer'), findsOneWidget);
    expect(find.textContaining('Demo Clearance'), findsOneWidget);
  });

  testWidgets('AI Guide: grounded Hiligaynon answer with a link to the cited place', (t) async {
    late http.Request seen;
    final guide = GuideClient(live, client: MockClient((req) async {
      seen = req;
      return http.Response(jsonEncode({'answer': 'Ara ini sa Admin Building.', 'lang': 'hil', 'grounded': true,
          'citations': [{'type': 'place', 'id': 'office-demo-registrar', 'label': 'Demo Office of the Registrar'}]}), 200);
    }));
    await pumpApp(t, initial: '/guide', guide: guide);
    await tapText(t, 'Hiligaynon');
    await tapText(t, 'Diin ang Registrar?');
    expect(find.text('Ara ini sa Admin Building.'), findsOneWidget);
    expect(find.textContaining('Demo Office of the Registrar'), findsOneWidget);
    expect(jsonDecode(seen.body), {'q': 'Diin ang Registrar?', 'lang': 'hil'});
    expect(seen.url.path, '/functions/v1/ai-guide');
  });

  group('Map + My Location', () {
    testWidgets('choose starting point → route with minutes; switching start keeps the destination', (t) async {
      await pumpApp(t, initial: '/map?to=room-demo-cb-203', size: tall);
      await tapText(t, 'Choose starting point');
      await tapText(t, 'Demo Administration Building', last: true);
      expect(find.textContaining(' min'), findsWidgets);
      expect(find.textContaining('Enter at: Demo CB main entrance'), findsOneWidget);
      expect(find.text('Demo Administration Building'), findsWidgets);
      await tapText(t, 'Choose starting point');
      await tapText(t, 'LIB1', last: true);
      expect(find.text('LIB1 · Demo Library'), findsOneWidget);
      expect(find.descendant(of: find.byKey(const Key('dest-card')), matching: find.text('Demo College Building')), findsOneWidget);
    });

    testWidgets('permission denied → explains, offers manual start', (t) async {
      await pumpApp(t, size: tall, initial: '/map?to=room-demo-cb-203', location: FakeLocation(const LocationOutcome.failed(LocationFailure.denied)));
      await tapText(t, 'Use my location');
      expect(find.textContaining('permission was not granted'), findsOneWidget);
      expect(find.text('Choose starting point'), findsOneWidget);
    });

    testWidgets('My Location flow: destination → deny permission → choose room manually → destination kept', (t) async {
      await pumpApp(t, size: tall, initial: '/map?to=room-demo-cb-203', location: FakeLocation(const LocationOutcome.failed(LocationFailure.denied)));
      await tapText(t, 'Use my location');
      expect(find.textContaining('permission was not granted'), findsOneWidget);
      expect(find.text('Not set'), findsOneWidget);
      await tapText(t, 'Choose starting point');
      await tapText(t, 'LIB1', last: true);
      expect(find.text('LIB1 · Demo Library'), findsOneWidget);
      expect(find.textContaining('permission was not granted'), findsNothing);
      expect(find.descendant(of: find.byKey(const Key('dest-card')), matching: find.text('Demo College Building')), findsOneWidget);
      expect(find.descendant(of: find.byKey(const Key('inside-card')), matching: find.text('Room CB203')), findsOneWidget);
    });

    testWidgets('GPS result arriving after a manual pick does not replace the manual start', (t) async {
      final gps = PendingLocation();
      await pumpApp(t, size: tall, initial: '/map?to=room-demo-cb-203', location: gps);
      await tapText(t, 'Use my location');
      expect(find.text('Locating…'), findsOneWidget);
      await tapText(t, 'Choose starting point');
      await tapText(t, 'LIB1', last: true);
      gps.complete(const LocationOutcome.fix(LocationFix(lat: 10.71614, lng: 122.5613, accuracyMeters: 8)));
      await t.pumpAndSettle();
      expect(find.text('LIB1 · Demo Library'), findsOneWidget);
      expect(find.textContaining('accuracy ±'), findsNothing);
      expect(find.text('Use my location'), findsOneWidget);
    });

    testWidgets('poor GPS accuracy → warns and asks for a manual start', (t) async {
      await pumpApp(t, size: tall, initial: '/map?to=room-demo-cb-203',
          location: FakeLocation(const LocationOutcome.fix(LocationFix(lat: 10.71614, lng: 122.5613, accuracyMeters: 120))));
      await tapText(t, 'Use my location');
      expect(find.textContaining('GPS accuracy is poor'), findsOneWidget);
      expect(find.textContaining('(Poor)'), findsOneWidget);
    });

    testWidgets('good GPS near a walkway → route from my location', (t) async {
      await pumpApp(t, size: tall, initial: '/map?to=room-demo-lib-1',
          location: FakeLocation(const LocationOutcome.fix(LocationFix(lat: 10.71614, lng: 122.5613, accuracyMeters: 8))));
      await tapText(t, 'Use my location');
      expect(find.textContaining('(Good)'), findsOneWidget);
      expect(find.textContaining(' min'), findsWidgets);
      expect(find.textContaining('You are here · accuracy'), findsOneWidget);
    });

    testWidgets('opening the Map never asks for location; Use my location shows You are here', (t) async {
      final gps = FakeLocation(const LocationOutcome.fix(LocationFix(lat: 10.71614, lng: 122.5613, accuracyMeters: 8)));
      await pumpApp(t, size: tall, initial: '/map', location: gps);
      expect(gps.calls, 0);
      await tapText(t, 'Use my location');
      expect(gps.calls, 1);
      expect(find.textContaining('You are here · accuracy ±8 m'), findsOneWidget);
      expect(find.text('You are here'), findsOneWidget);
    });
  });
}
