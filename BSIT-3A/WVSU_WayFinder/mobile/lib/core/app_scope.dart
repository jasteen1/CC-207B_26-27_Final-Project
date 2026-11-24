import 'package:flutter/widgets.dart';

import '../data/building_repository.dart';
import '../data/campus.dart';
import '../data/campus_outlines.dart';
import '../data/faculty_repository.dart';
import '../data/guide_client.dart';
import '../data/location_service.dart';
import '../data/places_repository.dart';
import '../data/processes_repository.dart';
import '../data/schedule.dart';
import 'config.dart';

/// Hands the config and services to screens (and lets tests swap in fakes).
class AppScope extends InheritedWidget {
  const AppScope({
    super.key,
    required this.config,
    required this.places,
    required this.faculty,
    required this.processes,
    required this.campus,
    required this.guide,
    required this.schedule,
    required this.progress,
    required this.location,
    required this.buildings,
    required this.campusShapes,
    required super.child,
  });

  final AppConfig config;
  final PlacesRepository places;
  final FacultyRepository faculty;
  final ProcessesRepository processes;
  final CampusRepository campus;
  final GuideClient guide;
  final ScheduleStore schedule;
  final ProgressStore progress;
  final LocationService location;

  /// Verified place records linked to tapped map buildings.
  final BuildingRepository buildings;

  /// Loads the tappable building polygons (the MapTiler "Wayfinder" dataset).
  final Future<List<CampusBuilding>> Function() campusShapes;

  static AppScope of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!;

  @override
  bool updateShouldNotify(AppScope old) => false;
}
