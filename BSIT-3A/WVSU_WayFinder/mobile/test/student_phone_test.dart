// A student's phone: Back button, timetable upload (synthetic COR image), one class from add to delete,
// and small screens with large text and the keyboard open. DEMO places; no network.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:wvsu_wayfinder/core/config.dart';
import 'package:wvsu_wayfinder/core/time.dart';
import 'package:wvsu_wayfinder/data/schedule.dart';
import 'package:wvsu_wayfinder/screens/schedule_screens.dart';
import 'package:wvsu_wayfinder/screens/shell.dart';

import 'helpers.dart';

final monday8am = DateTime.utc(2026, 11, 23, 0, 0); // Monday 08:00 Asia/Manila
const small = Size(320, 568); // smallest common phone
/// A student's build is configured (no DEMO banner); records still come from the demo repositories here.
const studentConfig = AppConfig(supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'sb_publishable_test');
const tall = Size(390, 1600);
Finder get card => find.byKey(const ValueKey('next-class'));
Finder inCard(String text) => find.descendant(of: card, matching: find.text(text));

Future<void> fill(WidgetTester t, {String? subject, String? start, String? end, String? room, String? prof}) async {
  for (final (k, v) in [('subject', subject), ('start', start), ('end', end), ('room', room), ('prof', prof)]) {
    if (v == null) continue;
    final f = find.byKey(Key(k));
    await t.scrollUntilVisible(f, 150, scrollable: find.byType(Scrollable).first);
    await t.enterText(f, v);
  }
  // As on a phone: Done closes the keyboard, then scroll to Save and tap it. A tap that would land on
  // something else (e.g. the tab bar) fails the test (hitTestWarningShouldBeFatal below).
  await t.testTextInput.receiveAction(TextInputAction.done);
  FocusManager.instance.primaryFocus?.unfocus();
  await t.pumpAndSettle();
  final save = find.text('Save class');
  // The form is a lazy list: scroll down to Save like a student would (it may not be built yet).
  await t.scrollUntilVisible(save, 150, scrollable: find.byType(Scrollable).first);
  await t.ensureVisible(save);
  await t.pumpAndSettle();
  await t.tap(save);
  await t.pumpAndSettle();
}

Future<bool> back(WidgetTester t) async {
  final handled = await t.binding.handlePopRoute();
  await t.pumpAndSettle();
  return handled;
}

void main() {
  WidgetController.hitTestWarningShouldBeFatal = true;
  setUp(() => appClock = () => monday8am);
  tearDown(() {
    appClock = DateTime.now;
    ScheduleScreen.debugPicker = null;

  });

  group('phone Back button goes up one level (it used to close the app)', () {
    test('up-from table', () {
      expect(upFrom('/'), isNull, reason: 'Back on Home leaves the app');
      expect(upFrom('/schedule/new'), '/schedule');
      expect(upFrom('/schedule/abc'), '/schedule');
      expect(upFrom('/schedule'), '/');
      expect(upFrom('/processes/p1'), '/processes');
      expect(upFrom('/directory/faculty/7'), '/directory');
      expect(upFrom('/place/room-1'), '/directory');
      expect(upFrom('/map'), '/');
    });

    testWidgets('Home → Add my schedule → Back → My Schedule → Back → Home → Back leaves', (t) async {
      await pumpApp(t, size: tall);
      await tapText(t, 'Add my schedule');
      expect(find.text('Save class'), findsOneWidget);
      expect(await back(t), isTrue);
      expect(find.text('My Schedule'), findsWidgets);
      expect(find.text('Save class'), findsNothing);
      expect(await back(t), isTrue);
      expect(find.text('Hi! Where do you need to go?'), findsOneWidget);
      expect(await back(t), isFalse, reason: 'on Home, the system closes the app as usual');
    });

    testWidgets('Back closes an open dialog first, without leaving the screen', (t) async {
      await pumpApp(t, size: tall, initial: '/map?to=room-demo-ict-201&from=room-demo-ict-101');
      await tapText(t, 'Open floor plan');
      expect(find.byType(Dialog), findsOneWidget);
      await back(t);
      expect(find.byType(Dialog), findsNothing);
      expect(find.byKey(const Key('inside-card')), findsOneWidget);
    });
  });

  testWidgets('timetable upload (synthetic COR image): pick, preview, enter classes, save, reopen after restart, private', (t) async {
    final bytes = File('test/fixtures/synthetic-cor-timetable.png').readAsBytesSync();
    ScheduleScreen.debugPicker = () async => XFile.fromData(bytes, name: 'cor.png', mimeType: 'image/png');
    final store = await pumpApp(t, initial: '/schedule', size: tall);
    expect(find.textContaining('saved on this device only'), findsOneWidget);
    await tapText(t, 'Upload timetable');
    expect(find.bySemanticsLabel('Your uploaded timetable'), findsOneWidget);
    // Today: no automatic extraction. The image is a reference; the student types each class.
    expect(find.textContaining('doesn’t read the image automatically'), findsOneWidget);
    expect(store.classes, isEmpty);

    // Enter the first row of the image, with a typo, then correct it.
    await tapText(t, 'Add class');
    await fill(t, subject: 'CC 207 Aplications Development', start: '08:00', end: '09:30', room: 'ICT 201', prof: 'Demo Prof. A');
    await tapText(t, 'CC 207 Aplications Development');
    await fill(t, subject: 'CC 207 Applications Development');
    expect(find.text('CC 207 Applications Development'), findsOneWidget);
    expect(store.classes.single.roomCodeRaw, 'ICT 201');

    // "Restart": a fresh store reads only what was saved on the device, and the app shows it again.
    final reopened = ScheduleStore();
    await reopened.load();
    expect(reopened.classes.single.subject, 'CC 207 Applications Development');
    expect(reopened.imageBase64, isNotNull);
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getKeys();
    await pumpApp(t, initial: '/schedule', size: tall, schedule: reopened);
    expect(find.text('CC 207 Applications Development'), findsOneWidget);
    expect(find.bySemanticsLabel('Your uploaded timetable'), findsOneWidget);
    expect(saved.every((k) => k.startsWith('wf.')), isTrue, reason: 'stored only in this app\'s local preferences');
  });

  testWidgets('one class, whole lifecycle: add → Home + Find room → edit room/time → Home + Find room update → delete', (t) async {
    final store = await pumpApp(t, size: tall);
    await tapText(t, 'Add my schedule');
    await fill(t, subject: 'CC 207 Applications Development', start: '10:00', end: '11:30', room: 'ICT 201', prof: 'Demo Prof. A');
    await tapText(t, 'Home');
    for (final s in ['CC 207 Applications Development', '10:00 AM–11:30 AM', 'ICT 201', 'Demo Prof. A', 'in 2 h']) {
      expect(find.descendant(of: card, matching: find.textContaining(s)), findsWidgets, reason: s);
    }
    expect(find.descendant(of: card, matching: find.textContaining('MONDAY')), findsOneWidget);
    await tapText(t, 'Find room');
    expect(find.descendant(of: find.byKey(const Key('dest-card')), matching: find.text('Demo CICT Building')), findsOneWidget);
    expect(find.descendant(of: find.byKey(const Key('inside-card')), matching: find.text('Room ICT 201')), findsOneWidget);

    // Edit the room and time.
    await tapText(t, 'Home');
    await tapText(t, 'My Schedule');
    await tapText(t, 'CC 207 Applications Development');
    await fill(t, start: '13:30', end: '15:00', room: 'cb 203');
    expect(store.classes.single.roomCodeRaw, 'cb 203');
    await tapText(t, 'Home');
    expect(inCard('1:30 PM–3:00 PM'), findsOneWidget);
    expect(inCard('cb 203'), findsOneWidget);
    expect(inCard('ICT 201'), findsNothing);
    await tapText(t, 'Find room');
    expect(find.descendant(of: find.byKey(const Key('dest-card')), matching: find.text('Demo College Building')), findsOneWidget);

    // Delete it: Home goes back to the empty state with Add my schedule.
    await tapText(t, 'Home');
    await tapText(t, 'My Schedule');
    await tapText(t, 'CC 207 Applications Development');
    await tapText(t, 'Delete class');
    if (find.widgetWithText(TextButton, 'Delete').evaluate().isNotEmpty) await tapText(t, 'Delete', last: true);
    expect(store.classes, isEmpty);
    await tapText(t, 'Home');
    expect(find.text('Add my schedule'), findsOneWidget);
  });

  group('small phone (320×568)', () {
    testWidgets('empty Home: Add my schedule is on the first screen, above the tabs', (t) async {
      await pumpApp(t, size: small, config: studentConfig);
      final button = t.getRect(find.widgetWithText(FilledButton, 'Add my schedule'));
      final tabs = t.getRect(find.byType(NavigationBar));
      expect(button.bottom, lessThan(tabs.top), reason: 'visible without scrolling');
    });

    testWidgets('returning student: the next class, room and Find room fit on the first screen', (t) async {
      await pumpApp(t, size: small, config: studentConfig);
      await tapText(t, 'Add my schedule');
      await fill(t, subject: 'CC 207 Applications Development', start: '10:00', end: '11:30', room: 'ICT 201', prof: 'Demo Prof. A');
      await tapText(t, 'Home');
      final find0 = t.getRect(find.ancestor(of: find.text('Find room'), matching: find.byWidgetPredicate((w) => w is FilledButton)).first);
      expect(find0.bottom, lessThan(t.getRect(find.byType(NavigationBar)).top));
    });

    for (final scale in [1.3, 2.0]) {
      testWidgets('larger text ×$scale: Home, Schedule and the class form lay out without overflow; Save stays reachable with the keyboard open', (t) async {
        t.platformDispatcher.textScaleFactorTestValue = scale;
        addTearDown(t.platformDispatcher.clearTextScaleFactorTestValue);
        final store = await pumpApp(t, size: small); // any RenderFlex overflow fails the test
        await tapText(t, 'Add my schedule');
        t.view.viewInsets = const FakeViewPadding(bottom: 260); // on-screen keyboard
        addTearDown(t.view.resetViewInsets);
        await t.pumpAndSettle();
        await fill(t, subject: 'Bachelor of Science in Information Technology Capstone Project 2', start: '10:00', end: '11:30',
            room: 'College of Business and Management Conference Room 2', prof: 'Demo Professor With A Very Long Name');
        expect(store.classes.single.subject, contains('Capstone Project 2'), reason: 'Save worked with large text and the keyboard open');
        t.view.resetViewInsets();
        await tapText(t, 'Home');
        expect(card, findsOneWidget);
        expect(find.descendant(of: card, matching: find.textContaining('Conference Room 2')), findsOneWidget);
      });
    }
  });
}


