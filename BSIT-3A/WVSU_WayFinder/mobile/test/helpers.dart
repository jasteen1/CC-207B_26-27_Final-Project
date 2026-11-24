import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:wvsu_wayfinder/app.dart';
import 'package:wvsu_wayfinder/core/config.dart';
import 'package:wvsu_wayfinder/data/building_repository.dart';
import 'package:wvsu_wayfinder/data/campus.dart';
import 'package:wvsu_wayfinder/data/campus_outlines.dart';
import 'package:wvsu_wayfinder/data/faculty_repository.dart';
import 'package:wvsu_wayfinder/data/guide_client.dart';
import 'package:wvsu_wayfinder/data/location_service.dart';
import 'package:wvsu_wayfinder/data/places_repository.dart';
import 'package:wvsu_wayfinder/data/processes_repository.dart';
import 'package:wvsu_wayfinder/data/schedule.dart';

// Fixtures are read once, synchronously: real file IO never completes inside the test clock.
String fixture(String name) => File('assets/demo/$name').readAsStringSync();
final _places = fixture('places.json'), _processes = fixture('processes.json'), _campus = fixture('campus.json'), _faculty = fixture('faculty.json'), _links = fixture('building_links.json');

DemoBuildingRepository demoBuildings() => DemoBuildingRepository(places: () async => _places, links: () async => _links, campus: () async => _campus);

class FakeLocation implements LocationService {
  FakeLocation(this.outcome);
  LocationOutcome outcome;
  int calls = 0;
  @override
  Future<LocationOutcome> current() async {
    calls++;
    return outcome;
  }
}

/// A GPS request that stays pending until the test calls [complete] (late-result cases).
class PendingLocation implements LocationService {
  final _c = Completer<LocationOutcome>();
  void complete(LocationOutcome o) => _c.complete(o);
  @override
  Future<LocationOutcome> current() => _c.future;
}

Future<ScheduleStore> pumpApp(
  WidgetTester t, {
  String initial = '/',
  AppConfig config = const AppConfig(),
  PlacesRepository? places,
  FacultyRepository? faculty,
  ProcessesRepository? processes,
  CampusRepository? campus,
  GuideClient? guide,
  BuildingRepository? buildings,
  List<CampusBuilding>? campusShapes,
  LocationService? location,
  ScheduleStore? schedule,
  DateTime Function()? now,
  Size size = const Size(390, 844),
}) async {
  SharedPreferences.setMockInitialValues({});
  t.view.physicalSize = size;
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.reset);
  final store = schedule ?? ScheduleStore();
  await t.pumpWidget(WayFinderApp(
    config: config,
    places: places ?? DemoPlacesRepository(loader: () async => _places),
    faculty: faculty ?? DemoFacultyRepository(loader: () async => _faculty),
    processes: processes ?? DemoProcessesRepository(loader: () async => _processes),
    campus: campus ?? DemoCampusRepository(loader: () async => _campus),
    guide: guide ?? GuideClient(config),
    buildings: buildings ?? demoBuildings(),
    campusShapes: () async => campusShapes ?? const [],
    location: location ?? FakeLocation(const LocationOutcome.failed(LocationFailure.unavailable)),
    schedule: store,
    initialLocation: initial,
    now: now,
  ));
  await t.pumpAndSettle();
  return store;
}

Future<void> tapText(WidgetTester t, String text, {bool last = false}) async {
  final f = last ? find.text(text).last : find.text(text).first;
  await t.ensureVisible(f);
  await t.pumpAndSettle();
  await t.tap(f);
  await t.pumpAndSettle();
}

Finder navTab(String label) => find.descendant(of: find.byType(NavigationBar), matching: find.text(label));
