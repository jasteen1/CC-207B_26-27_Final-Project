// One trip: start → walking route to the destination building's verified entrance → indoor step
// (floor, blueprint, highlighted room). Same rules and wording as the web app's lib/trip/plan.ts.
import '../data/campus.dart';
import '../data/location_service.dart';
import '../data/models.dart';
import 'search.dart';

const poorAccuracyM = 50.0;
const campusCenterLng = (122.55932 + 122.56441) / 2, campusCenterLat = (10.71194 + 10.71531) / 2;
const campusRadiusM = 900.0;

sealed class TripStart {
  const TripStart();
}

class NoStart extends TripStart {
  const NoStart();
}

/// A building, room or office record.
class PlaceStart extends TripStart {
  const PlaceStart(this.view);
  final PlaceView view;
}

/// A building drawn on the map with no linked record (so no entrance can be known).
class MappedStart extends TripStart {
  const MappedStart(this.name);
  final String name;
}

/// "Use my location": the fix, or why there isn't one (no fix + no failure = still locating).
class GpsStart extends TripStart {
  const GpsStart(this.fix, [this.failure, this.insideBuildingId]);
  final LocationFix? fix;
  final LocationFailure? failure;

  /// The building record whose map outline contains the fix (polygon test, not a walking route).
  final String? insideBuildingId;
}

sealed class TripDest {
  const TripDest();
}

class PlaceDest extends TripDest {
  const PlaceDest(this.view);
  final PlaceView view;
}

class MappedDest extends TripDest {
  const MappedDest(this.name);
  final String name;
}

enum TripStatus { route, sameBuilding, needsStart, noBuilding, noEntrance, noPath, startNoEntrance, gpsLocating, gpsFailed, gpsPoor, gpsOffCampus, gpsOffWalkway }

/// The fixture/web spelling of each status ("same-building", "gps-poor", ...).
String tripStatusName(TripStatus s) => s.name.replaceAllMapped(RegExp(r'[A-Z]'), (m) => '-${m[0]!.toLowerCase()}');

class Indoor {
  const Indoor({required this.label, this.floor, this.plans = const [], this.plan, this.spot, this.note});

  /// Door label (or name, for an office).
  final String label;

  /// Only from the record; never guessed from a room number.
  final int? floor;
  final List<FloorPlan> plans;

  /// The blueprint to open first: the one the room is marked on.
  final FloorPlan? plan;
  final RoomSpot? spot;
  final String? note;
}

class Trip {
  const Trip(this.status, {this.message, this.route, this.entrance, this.destBuilding, this.startBuilding, this.indoor});
  final TripStatus status;

  /// Shown under "Walking route". Null when a location notice already explains it.
  final String? message;
  final WalkRoute? route;
  final Entrance? entrance;
  final Place? destBuilding, startBuilding;
  final Indoor? indoor;
}

/// Where a place is reached from outside: a building (or a landmark such as a gate) itself, else its parent.
Place? _anchor(Place? p) => p != null && (p.kind == 'building' || p.kind == 'landmark') ? p : null;
Place? tripBuildingOf(PlaceView v) => _anchor(v.place) ?? _anchor(v.parent);

Indoor? indoorStep(PlaceView dest, Place? building, CampusPaths? campus) {
  final p = dest.place;
  if (p.kind == 'building' || p.kind == 'landmark') return null;
  final label = p.kind == 'room' ? roomDisplay(roomLabel: p.roomLabel, roomCode: p.roomCode, name: p.name) : p.name;
  if (p.floor == null) return Indoor(label: label, note: 'Floor not recorded yet.');
  if (campus == null || building == null) return Indoor(label: label, floor: p.floor);
  final plans = campus.floorPlans.where((f) => f.buildingId == building.id && f.floor == p.floor).toList();
  if (plans.isEmpty) return Indoor(label: label, floor: p.floor, plans: plans, note: 'No floor plan is available for this floor.');
  final spot = campus.roomSpots.where((s) => s.placeId == p.id && plans.any((f) => f.id == s.floorPlanId)).firstOrNull;
  final plan = spot != null ? plans.firstWhere((f) => f.id == spot.floorPlanId) : plans.first;
  return Indoor(label: label, floor: p.floor, plans: plans, plan: plan, spot: spot, note: spot != null ? null : '$label isn’t marked on this floor plan yet.');
}

Trip planTrip(TripDest dest, TripStart start, CampusPaths? campus) {
  if (dest is MappedDest) {
    return Trip(TripStatus.noBuilding, message: '${dest.name} isn’t linked to a WayFinder building record yet, so no verified entrance or walking route is known.');
  }
  final view = (dest as PlaceDest).view;
  final destB = tripBuildingOf(view);
  final indoor = indoorStep(view, destB, campus);
  Trip t(TripStatus s, {String? message, WalkRoute? route, Entrance? entrance, Place? startB}) =>
      Trip(s, message: message, route: route, entrance: entrance, destBuilding: destB, startBuilding: startB, indoor: indoor);
  const noPath = 'Walking directions are unavailable: no verified walkway connects these places yet.';

  if (destB == null) return t(TripStatus.noBuilding, message: 'This place isn’t linked to a building with a recorded location yet, so no walking route can be drawn.');
  // Same building: skip walking and go straight to the indoor step.
  if (start is PlaceStart && tripBuildingOf(start.view)?.id == destB.id) {
    return t(TripStatus.sameBuilding, startB: destB, message: 'You’re already in this building. Go straight to the floor plan.');
  }
  // A usable GPS fix inside the destination building's outline: same as starting there.
  if (start is GpsStart && start.failure == null && start.fix != null && start.fix!.accuracyMeters <= poorAccuracyM && start.insideBuildingId == destB.id) {
    return t(TripStatus.sameBuilding, startB: destB, message: 'You’re at ${destB.name}. Go straight to the floor plan.');
  }
  if (campus == null) return t(TripStatus.needsStart);
  if (entrancesOf(campus, destB.id).isEmpty) {
    return t(TripStatus.noEntrance, message: 'No verified entrance is recorded for ${destB.name} yet, so walking directions are unavailable.');
  }
  switch (start) {
    case NoStart():
      return t(TripStatus.needsStart, message: 'Choose where you’re starting from to get walking directions.');
    case MappedStart(:final name):
      return t(TripStatus.startNoEntrance, message: '$name isn’t linked to a WayFinder building record yet, so walking directions from it are unavailable. Choose another starting point.');
    case GpsStart(:final fix, :final failure):
      if (failure != null) return t(TripStatus.gpsFailed); // the location notice explains it
      if (fix == null) return t(TripStatus.gpsLocating, message: 'Tap “Use my location” again, or choose a starting point.');
      if (fix.accuracyMeters > poorAccuracyM) return t(TripStatus.gpsPoor);
      if (distanceM(fix.lng, fix.lat, campusCenterLng, campusCenterLat) > campusRadiusM) return t(TripStatus.gpsOffCampus);
      final node = snapToNode(campus, fix.lng, fix.lat);
      if (node == null) return t(TripStatus.gpsOffWalkway, message: 'You’re not near a verified walkway. Choose a starting building or room instead.');
      final r = routeBetween(campus, fromNodeId: node.id, toBuildingId: destB.id);
      return r == null ? t(TripStatus.noPath, message: noPath) : t(TripStatus.route, route: r.route, entrance: r.entrance);
    case PlaceStart(:final view):
      final sb = tripBuildingOf(view);
      if (sb == null) return t(TripStatus.startNoEntrance, message: 'This starting point isn’t linked to a building yet. Choose another starting point.');
      if (entrancesOf(campus, sb.id).isEmpty) {
        return t(TripStatus.startNoEntrance, startB: sb, message: 'No verified entrance is recorded for ${sb.name} yet, so walking directions from it are unavailable.');
      }
      final r = routeBetween(campus, fromBuildingId: sb.id, toBuildingId: destB.id);
      return r == null ? t(TripStatus.noPath, startB: sb, message: noPath) : t(TripStatus.route, startB: sb, route: r.route, entrance: r.entrance);
  }
}

// ---- Which part of the trip is available -----------------------------------------------------
enum LegState { ok, unavailable, choose, notNeeded }

/// One part of the trip ("Start", "Walkway", "Quezon Hall entrance", "Inside") and whether it's ready.
class TripLeg {
  const TripLeg(this.key, this.title, this.state, this.detail);
  final String key, title, detail;
  final LegState state;
}

/// Splits a trip into its parts so a student sees exactly which one is missing. A building's map
/// centre only locates it: it is never treated as a walkway point or an entrance.
List<TripLeg> tripLegs(Trip trip, TripStart start, CampusPaths? campus, {String? startName}) {
  final b = trip.destBuilding;
  final indoor = trip.indoor;
  final legs = <TripLeg>[];
  final destName = b?.name ?? 'the destination';
  if (trip.status == TripStatus.sameBuilding) {
    legs.add(TripLeg('start', 'Start', LegState.ok, 'You’re at $destName.'));
    legs.add(const TripLeg('walkway', 'Walkway', LegState.notNeeded, 'Not needed: you’re already in the building.'));
  } else {
    final noNetwork = campus == null || campus.edges.isEmpty;
    final (LegState, String) s = switch (start) {
      NoStart() => (LegState.choose, 'Not chosen yet. Use your location or choose a starting point.'),
      GpsStart(:final failure) when failure != null => (LegState.choose, 'Your location isn’t available. Choose a starting point.'),
      GpsStart(:final fix) when fix == null => (LegState.choose, 'Finding your location…'),
      GpsStart(:final fix) when fix!.accuracyMeters > poorAccuracyM => (LegState.choose, 'GPS too imprecise (±${fix.accuracyMeters.round()} m). Choose a starting point.'),
      GpsStart() when trip.status == TripStatus.gpsOffCampus => (LegState.unavailable, 'You appear to be outside the campus.'),
      GpsStart() when trip.status == TripStatus.gpsOffWalkway || noNetwork => (LegState.unavailable, 'Your location (no surveyed walkway near you yet).'),
      GpsStart(:final fix) => (LegState.ok, 'Your location (±${fix!.accuracyMeters.round()} m).'),
      MappedStart(:final name) => (LegState.unavailable, '$name is drawn on the campus map, but no walkway point there has been surveyed yet.'),
      PlaceStart(:final view) => () {
          final sb = tripBuildingOf(view);
          final n = startName ?? sb?.name ?? view.place.name;
          if (sb == null) return (LegState.unavailable, '$n isn’t linked to a building yet.');
          if (campus == null || entrancesOf(campus, sb.id).isEmpty) return (LegState.unavailable, '$n: no surveyed entrance or walkway point yet.');
          return (LegState.ok, '$n (${entrancesOf(campus, sb.id).first.name}).');
        }(),
    };
    legs.add(TripLeg('start', 'Start', s.$1, s.$2));
    final route = trip.route;
    legs.add(route != null
        ? TripLeg('walkway', 'Walkway', LegState.ok, '${route.meters.round()} m on verified walkways.')
        : TripLeg('walkway', 'Walkway', LegState.unavailable,
            noNetwork ? 'Not surveyed yet: no verified walkway leads to $destName.' : trip.status == TripStatus.noPath ? 'No verified walkway connects your start to $destName yet.' : 'Not available until the start and the entrance are both on a surveyed walkway.'));
  }
  if (b != null && trip.status != TripStatus.sameBuilding) {
    final ents = campus == null ? const <Entrance>[] : entrancesOf(campus, b.id);
    legs.add(ents.isEmpty
        ? TripLeg('entrance', '$destName entrance', LegState.unavailable, 'Not surveyed yet: the door students use has no verified position.')
        : TripLeg('entrance', '$destName entrance', LegState.ok, trip.entrance?.name ?? ents.first.name));
  }
  if (indoor != null) {
    final on = indoor.floor == null ? '' : 'Floor ${indoor.floor}: ';
    legs.add(indoor.spot != null
        ? TripLeg('inside', 'Inside', LegState.ok, '$on${indoor.label} highlighted on the floor plan.')
        : indoor.plan != null
            ? TripLeg('inside', 'Inside', LegState.unavailable, 'Floor plan available, but ${indoor.label} isn’t marked on it yet.')
            : TripLeg('inside', 'Inside', LegState.unavailable, indoor.note ?? 'No floor plan for this floor yet.'));
  }
  return legs;
}
