import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:http/http.dart' as http;

import '../core/config.dart';
import 'campus.dart' show FloorPlan;
import 'models.dart';

/// A VERIFIED place linked to a building polygon (public.building_features), with what's inside it.
class BuildingDetails {
  BuildingDetails({
    required this.place,
    this.description,
    this.photoUrl,
    required List<Place> children,
    required List<FloorPlan> floorPlans,
    required List<int> featureIds,
  })  : offices = (children.where((c) => c.kind == 'office').toList()..sort(_byLabel)),
        rooms = (children.where((c) => c.kind == 'room').toList()..sort(_byLabel)),
        floorPlans = ([...floorPlans]..sort((a, b) => a.floor.compareTo(b.floor))),
        floors = ({for (final c in children) if (c.floor != null) c.floor!, for (final f in floorPlans) f.floor}.toList()..sort()),
        featureIds = (featureIds.toSet().toList()..sort());

  final Place place;
  final String? description;

  /// Public photo URL. Null: the card shows "Building photo coming soon".
  final String? photoUrl;
  final List<Place> offices;
  final List<Place> rooms;
  final List<int> floors;

  /// Approved (verified) floor plans, e.g. Canva blueprint exports.
  final List<FloorPlan> floorPlans;
  final List<int> featureIds;

  bool get hasAny => (description?.isNotEmpty ?? false) || offices.isNotEmpty || rooms.isNotEmpty || floors.isNotEmpty || floorPlans.isNotEmpty;

  static int _byLabel(Place a, Place b) => (a.roomCode ?? a.name).compareTo(b.roomCode ?? b.name);
}

String? _text(Object? v) => v is String && v.trim().isNotEmpty ? v.trim() : null;

abstract class BuildingRepository {
  bool get isDemo;

  /// null = no verified record linked: the card still opens with the map's building name.
  Future<BuildingDetails?> lookup({List<int> featureIds = const [], String? placeId});
}

/// Same queries as the web app (verified rows only). A 404 (migration 0006 not applied yet) = no link.
class LiveBuildingRepository implements BuildingRepository {
  LiveBuildingRepository(this.config, {http.Client? client}) : _client = client ?? http.Client();
  final AppConfig config;
  final http.Client _client;

  @override
  bool get isDemo => false;

  Future<List<Map<String, dynamic>>?> _get(String path) async {
    final res = await _client.get(Uri.parse('${config.restBase}/$path'),
        headers: {'apikey': config.supabasePublishableKey, 'Accept': 'application/json'});
    if (res.statusCode == 404) return null;
    if (res.statusCode != 200) throw Exception('HTTP ${res.statusCode}');
    return (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
  }

  @override
  Future<BuildingDetails?> lookup({List<int> featureIds = const [], String? placeId}) async {
    const v = 'status=eq.verified';
    var id = placeId;
    if (id == null) {
      final ids = featureIds.where((n) => n > 0).toList();
      if (ids.isEmpty) return null;
      final link = await _get('building_features?select=place_id&feature_id=in.(${ids.join(',')})&$v&order=feature_id.asc&limit=1');
      if (link == null || link.isEmpty) return null;
      id = link.first['place_id'] as String;
    }
    final e = Uri.encodeQueryComponent(id);
    final r = await Future.wait([
      _get('places?select=*&id=eq.$e&kind=eq.building&$v&limit=1'),
      _get('places?select=*&parent_id=eq.$e&$v&order=name.asc&limit=500'),
      _get('floor_plans?select=id,building_id,floor,label,image_url&building_id=eq.$e&$v&order=floor.asc'),
      _get('building_features?select=feature_id&place_id=eq.$e&$v'),
    ]);
    final row = r[0]?.firstOrNull;
    if (row == null) return null;
    return BuildingDetails(
      place: Place.fromRow(row),
      description: _text(row['description']),
      photoUrl: _text(row['photo_url']),
      children: [for (final c in r[1] ?? const <Map<String, dynamic>>[]) Place.fromRow(c)],
      floorPlans: [for (final f in r[2] ?? const <Map<String, dynamic>>[]) FloorPlan(f['id'], f['building_id'], f['floor'] as int, f['label'], config.storageUrl(f['image_url'] as String))],
      featureIds: [for (final l in r[3] ?? const <Map<String, dynamic>>[]) (l['feature_id'] as num).toInt()],
    );
  }
}

/// DEMO links (assets/demo/building_links.json, a copy of the web fixture). Only when Supabase is
/// not configured; the records are labeled demo placeholders.
class DemoBuildingRepository implements BuildingRepository {
  DemoBuildingRepository({Future<String> Function()? places, Future<String> Function()? links, Future<String> Function()? campus})
      : _places = places ?? (() => rootBundle.loadString('assets/demo/places.json')),
        _links = links ?? (() => rootBundle.loadString('assets/demo/building_links.json')),
        _campus = campus ?? (() => rootBundle.loadString('assets/demo/campus.json'));
  final Future<String> Function() _places, _links, _campus;

  @override
  bool get isDemo => true;

  @override
  Future<BuildingDetails?> lookup({List<int> featureIds = const [], String? placeId}) async {
    final links = ((jsonDecode(await _links()) as Map)['links'] as List).cast<Map<String, dynamic>>();
    final id = placeId ?? links.where((l) => featureIds.contains(l['featureId'])).firstOrNull?['placeId'] as String?;
    if (id == null) return null;
    final raw = ((jsonDecode(await _places()) as Map)['places'] as List).cast<Map<String, dynamic>>();
    final row = raw.where((p) => p['id'] == id && p['kind'] == 'building').firstOrNull;
    if (row == null) return null;
    final plans = ((jsonDecode(await _campus()) as Map)['floorPlans'] as List).cast<Map<String, dynamic>>();
    return BuildingDetails(
      place: Place.fromFixture(row),
      description: _text(row['description']),
      photoUrl: _text(row['photoUrl']),
      children: [for (final p in raw) if (p['parentId'] == id) Place.fromFixture(p)],
      floorPlans: [for (final f in plans) if (f['buildingId'] == id) FloorPlan(f['id'], f['buildingId'], f['floor'] as int, f['label'], f['imageUrl'])],
      featureIds: [for (final l in links) if (l['placeId'] == id) l['featureId'] as int],
    );
  }
}

BuildingRepository createBuildingRepository(AppConfig config) =>
    config.isLive ? LiveBuildingRepository(config) : DemoBuildingRepository();
