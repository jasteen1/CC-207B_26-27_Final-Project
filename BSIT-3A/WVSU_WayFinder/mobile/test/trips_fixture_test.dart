// Runs the 50 shared sample trips (../src/data/fixtures/trips, also run by the web suite) through
// search → destination → trip plan with the Flutter implementation. Both clients must agree.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:wvsu_wayfinder/core/resolve.dart';
import 'package:wvsu_wayfinder/core/search.dart';
import 'package:wvsu_wayfinder/core/trip.dart';
import 'package:wvsu_wayfinder/data/campus.dart';
import 'package:wvsu_wayfinder/data/location_service.dart';
import 'package:wvsu_wayfinder/data/models.dart';

Map<String, dynamic> _json(String path) => jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

void main() {
  final campusFile = _json('../src/data/fixtures/trips/campus.fixture.json');
  final trips = (_json('../src/data/fixtures/trips/trips.fixture.json')['trips'] as List).cast<Map<String, dynamic>>();
  final prefixes = RoomPrefix.parse(File('../src/data/room-prefixes.json').readAsStringSync());
  final places = [for (final p in (campusFile['places'] as List).cast<Map<String, dynamic>>()) Place.fromFixture(p)];
  final byId = {for (final p in places) p.id: p};
  PlaceView view(Place p) => PlaceView(p, p.parentId == null ? null : byId[p.parentId]);
  final map = [
    for (final b in (campusFile['mapBuildings'] as List).cast<Map<String, dynamic>>())
      MapBuildingRef(b['key'] as String, b['name'] as String, (b['featureIds'] as List).cast<int>()),
  ];
  final links = {for (final l in (campusFile['links'] as List).cast<Map<String, dynamic>>()) l['featureId'] as int: l['placeId'] as String};
  final campus = CampusPaths.fromFixture(campusFile['campus'] as Map<String, dynamic>);

  /// Same matching as the app's record search (DemoPlacesRepository / live REST).
  List<PlaceView> recordSearch(String q) {
    final code = parseRoomCode(q);
    if (code != null) return [for (final p in places) if (p.roomCode == code.code) view(p)];
    final n = q.trim().toLowerCase();
    return [for (final p in places) if (p.name.toLowerCase().contains(n) || p.shortName?.toLowerCase() == n) view(p)];
  }

  String hitKey(SearchHit h) => switch (h) {
        PlaceHit(:final view) => 'place:${view.place.id}',
        MappedHit(:final building) => 'mapped:${building.key}',
        PrefixHit(:final prefix) => 'prefix:$prefix',
        PrefixUnmappedHit(:final prefix) => 'prefix-unmapped:$prefix',
      };
  String hitKind(SearchHit? h) => switch (h) {
        null => 'none',
        PlaceHit() => 'place',
        MappedHit() => 'mapped',
        PrefixHit() => 'prefix',
        PrefixUnmappedHit() => 'prefix-unmapped',
      };
  TripDest destOfBuilding(MapBuildingRef b) {
    final linked = b.featureIds.map((id) => links[id]).whereType<String>().firstOrNull;
    return linked != null ? PlaceDest(view(byId[linked]!)) : MappedDest(b.name);
  }

  TripStart startOf(Map<String, dynamic>? s) {
    if (s == null) return const NoStart();
    if (s['place'] != null) return PlaceStart(view(byId[s['place']]!));
    if (s['mapped'] != null) return MappedStart(s['mapped'] as String);
    if (s['gps'] != null) {
      final g = s['gps'] as Map<String, dynamic>;
      return GpsStart(LocationFix(lat: (g['lat'] as num).toDouble(), lng: (g['lng'] as num).toDouble(), accuracyMeters: (g['accuracy'] as num).toDouble()));
    }
    if (s['gpsFailure'] != null) return GpsStart(null, LocationFailure.values.byName(s['gpsFailure'] as String));
    return const GpsStart(null);
  }

  test('50 trips, every category', () {
    expect(trips, hasLength(50));
    expect({for (final t in trips) t['id']}, hasLength(50));
    expect({for (final t in trips) t['category']}, {'building-to-building', 'classroom-code', 'office', 'same-building', 'gps', 'missing-path'});
  });

  test('the bundled room-prefix list is identical to the web app\'s', () {
    expect(File('assets/room_prefixes.json').readAsStringSync(), File('../src/data/room-prefixes.json').readAsStringSync());
  });

  for (final t in trips) {
    test(t['id'] as String, () {
      final e = t['expect'] as Map<String, dynamic>;
      TripDest? dest;
      if (t['query'] != null) {
        final q = t['query'] as String;
        final hits = resolveSearch(q, recordSearch(q), map, prefixes);
        final keys = hits.map(hitKey).toList();
        for (final k in (e['alsoHits'] as List? ?? const [])) {
          expect(keys, contains(k));
        }
        for (final k in (e['notHits'] as List? ?? const [])) {
          expect(keys, isNot(contains(k)));
        }
        for (final entry in (e['hitNote'] as Map<String, dynamic>? ?? const {}).entries) {
          final h = hits.where((x) => hitKey(x) == entry.key).firstOrNull;
          expect(h is MappedHit ? h.note : null, contains(entry.value));
        }
        final pick = (t['pick'] as Map<String, dynamic>?)?['place'];
        final hit = pick != null ? hits.whereType<PlaceHit>().where((h) => h.view.place.id == pick).firstOrNull : hits.firstOrNull;
        expect(hitKind(hit), e['hit']);
        if (e['hitMessage'] != null) {
          expect(switch (hit) { PrefixHit(:final message) => message, PrefixUnmappedHit(:final message) => message, _ => null }, e['hitMessage']);
        }
        dest = switch (hit) {
          PlaceHit(:final view) => PlaceDest(view),
          MappedHit(:final building) => destOfBuilding(building),
          PrefixHit(:final building) when building != null => destOfBuilding(building),
          _ => null,
        };
      } else if (t['to'] != null) {
        dest = PlaceDest(view(byId[t['to']]!));
      }

      if (e['dest'] == null) {
        expect(dest, isNull);
        return;
      }
      expect(dest, isNotNull);
      if ((e['dest'] as String).startsWith('mapped:')) {
        expect(dest, isA<MappedDest>());
        expect((dest as MappedDest).name, map.firstWhere((b) => 'mapped:${b.key}' == e['dest']).name);
      } else {
        expect((dest as PlaceDest).view.place.id, e['dest']);
      }

      final trip = planTrip(dest!, startOf(t['start'] as Map<String, dynamic>?), campus);
      expect(tripStatusName(trip.status), e['status']);
      if (e.containsKey('building')) expect(trip.destBuilding?.id, e['building']);
      if (e.containsKey('entrance')) expect(trip.entrance?.id, e['entrance']);
      if (e['path'] != null) expect(trip.route?.nodeIds, e['path']);
      if (e['status'] == 'route') {
        expect(trip.route!.minutes, greaterThanOrEqualTo(1));
      } else {
        expect(trip.route, isNull);
      }
      if (e['message'] != null) expect(trip.message, contains(e['message']));
      if (e['noIndoor'] == true) expect(trip.indoor, isNull);
      if (e.containsKey('label')) expect(trip.indoor?.label, e['label']);
      if (e.containsKey('floor')) expect(trip.indoor?.floor, e['floor']);
      if (e.containsKey('plan')) expect(trip.indoor?.plan?.id, e['plan']);
      if (e.containsKey('spot')) expect(trip.indoor?.spot?.label, e['spot']);
      if (e['note'] != null) expect(trip.indoor?.note, contains(e['note']));
      if (trip.indoor?.spot != null) expect(trip.indoor!.spot!.floorPlanId, trip.indoor!.plan?.id);
    });
  }
}
