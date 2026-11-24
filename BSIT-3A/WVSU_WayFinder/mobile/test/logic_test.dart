import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:wvsu_wayfinder/core/config.dart';
import 'package:wvsu_wayfinder/core/time.dart';
import 'package:wvsu_wayfinder/data/campus.dart';
import 'package:wvsu_wayfinder/data/schedule.dart';

import 'helpers.dart';

const c1 = ClassSession(id: 'c1', subject: 'CIT 210', weekday: 1, start: '13:30', end: '15:00', roomCodeRaw: 'CB 203', remindMinutes: 15);

class FakeTimer implements Timer {
  FakeTimer(this.at, this.fn);
  final DateTime at;
  final void Function() fn;
  bool active = true;
  @override
  void cancel() => active = false;
  @override
  bool get isActive => active;
  @override
  int get tick => 0;
}

void main() {
  group('Asia/Manila times (same results as the web app)', () {
    test('Monday 13:30 class asked Monday 08:30 Manila', () {
      expect(nextOccurrence(1, '13:30', '15:00', DateTime.utc(2026, 11, 23, 0, 30)).start, DateTime.utc(2026, 11, 23, 5, 30));
    });
    test('in progress until it ends, then next week', () {
      expect(nextOccurrence(1, '08:00', '09:30', DateTime.utc(2026, 11, 23, 0, 45)).start, DateTime.utc(2026, 11, 23, 0, 0));
      expect(nextOccurrence(1, '08:00', '09:30', DateTime.utc(2026, 11, 23, 1, 31)).start, DateTime.utc(2026, 11, 30, 0, 0));
    });
    test('formatting', () => expect(formatClock('13:30'), '1:30 PM'));
  });

  group('reminders', () {
    late DateTime now;
    late List<FakeTimer> timers;
    late List<String> fired;
    late ReminderScheduler s;
    setUp(() {
      now = DateTime.utc(2026, 11, 23, 0, 0); // Monday 08:00 Manila
      timers = [];
      fired = [];
      s = ReminderScheduler(now: () => now, timer: (d, fn) { final t = FakeTimer(now.add(d), fn); timers.add(t); return t; }, notify: (c) => fired.add(c.id));
    });

    test('15 min before 1:30 PM Manila = 05:15Z', () {
      s.sync([c1]);
      expect(s.pending['c1'], DateTime.utc(2026, 11, 23, 5, 15));
    });

    test('rescheduling cancels the old reminder', () {
      s.sync([c1]);
      final old = timers.single;
      s.sync([const ClassSession(id: 'c1', subject: 'CIT 210', weekday: 1, start: '16:00', end: '17:00', roomCodeRaw: 'CB 203', remindMinutes: 15)]);
      expect(old.isActive, isFalse);
      expect(s.pending['c1'], DateTime.utc(2026, 11, 23, 7, 45));
      expect(timers.where((t) => t.isActive), hasLength(1));
    });

    test('deleting a class cancels its reminder', () {
      s.sync([c1]);
      s.sync([]);
      expect(timers.single.isActive, isFalse);
      expect(s.pending, isEmpty);
    });

    test('firing re-arms for next week', () {
      s.sync([c1]);
      now = DateTime.utc(2026, 11, 23, 5, 15, 1);
      timers.single.fn();
      expect(fired, ['c1']);
      expect(s.pending['c1'], DateTime.utc(2026, 11, 30, 5, 15));
    });
  });

  group('routing over the demo walkways (same graph as web)', () {
    late CampusPaths paths;
    setUp(() async => paths = await DemoCampusRepository(loader: () async => fixture('campus.json')).load());

    test('building to building through entrances', () {
      final r = routeBetween(paths, fromBuildingId: 'bldg-demo-admin', toBuildingId: 'bldg-demo-cb')!;
      expect(r.entrance.id, 'ent-demo-cb-main');
      expect(r.route.nodeIds, ['n-admin', 'j-west', 'n-cb']);
      expect(r.route.minutes, greaterThanOrEqualTo(1));
    });
    test('no entrance → no route; far GPS → no snap', () {
      expect(routeBetween(paths, fromBuildingId: 'bldg-demo-admin', toBuildingId: 'nope'), isNull);
      expect(snapToNode(paths, 122.57, 10.72), isNull);
      expect(snapToNode(paths, 122.5613, 10.71614)?.id, 'j-west');
    });
  });

  test('mobile demo fixtures are exact copies of the web fixtures (shared IDs)', () {
    for (final f in ['places.json', 'processes.json', 'campus.json', 'faculty.json', 'building_links.json']) {
      expect(jsonDecode(fixture(f)), equals(jsonDecode(File('../src/data/demo/$f').readAsStringSync())), reason: f);
    }
  });
  test('floor plan image URL: full URL and /demo/ kept; Storage path resolves against the project', () {
    const c = AppConfig(supabaseUrl: 'https://proj.example.co/', supabasePublishableKey: 'k');
    expect(c.storageUrl('https://cdn.example.org/a.png'), 'https://cdn.example.org/a.png');
    expect(c.storageUrl('/demo/floorplan-cict-2.svg'), '/demo/floorplan-cict-2.svg');
    expect(c.storageUrl('floor-plans/quezon-hall-floor-1.png'), 'https://proj.example.co/storage/v1/object/public/floor-plans/quezon-hall-floor-1.png');
  });
}
