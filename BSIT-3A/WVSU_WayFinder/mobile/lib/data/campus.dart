import 'dart:convert';
import 'dart:math';

import 'package:flutter/services.dart' show rootBundle;
import 'package:http/http.dart' as http;

import '../core/config.dart';
import 'places_repository.dart' show PlacesException;

class Entrance {
  const Entrance(this.id, this.buildingId, this.name, this.lng, this.lat, this.nodeId);
  final String id, buildingId, name;
  final double lng, lat;
  final String? nodeId;
}

class WalkNode {
  const WalkNode(this.id, this.lng, this.lat);
  final String id;
  final double lng, lat;
}

class WalkEdge {
  const WalkEdge(this.id, this.from, this.to, [this.lengthM]);
  final String id, from, to;
  final double? lengthM;
}

class FloorPlan {
  const FloorPlan(this.id, this.buildingId, this.floor, this.label, this.imageUrl, {this.width, this.height});
  final String id, buildingId;
  final int floor;
  final String? label;
  final String imageUrl;

  /// Image size in pixels, when recorded with the room positions.
  final int? width, height;
}

/// Where a room or office sits on one specific blueprint. Every number is a fraction (0-1) of that
/// image's width (x) or height (y), so the highlight stays on the room at any zoom or screen size.
class RoomSpot {
  const RoomSpot({required this.id, required this.floorPlanId, required this.placeId, required this.label, required this.shape,
      required this.x, required this.y, this.w, this.h, this.points = const []});
  final String id, floorPlanId, placeId;

  /// Label as printed on the blueprint.
  final String label;

  /// 'rect' | 'polygon' | 'marker'
  final String shape;
  final double x, y;
  final double? w, h;
  final List<(double, double)> points;

  factory RoomSpot.fromJson(Map<String, dynamic> j, {bool snake = false}) {
    double d(dynamic v) => (v as num).toDouble();
    double? o(dynamic v) => (v as num?)?.toDouble();
    return RoomSpot(
      id: j['id'] as String,
      floorPlanId: j[snake ? 'floor_plan_id' : 'floorPlanId'] as String,
      placeId: j[snake ? 'place_id' : 'placeId'] as String,
      label: j['label'] as String,
      shape: j['shape'] as String,
      x: d(j['x']),
      y: d(j['y']),
      w: o(j['w']),
      h: o(j['h']),
      points: [for (final p in (j['points'] as List? ?? const [])) (d((p as List)[0]), d(p[1]))],
    );
  }
}

class CampusPaths {
  const CampusPaths(this.entrances, this.nodes, this.edges, this.floorPlans, [this.roomSpots = const []]);
  final List<Entrance> entrances;
  final List<WalkNode> nodes;
  final List<WalkEdge> edges;
  final List<FloorPlan> floorPlans;
  final List<RoomSpot> roomSpots;

  /// The fixture/demo JSON shape (camelCase), shared with the web app.
  factory CampusPaths.fromFixture(Map<String, dynamic> j) {
    double d(dynamic x) => (x as num).toDouble();
    List<Map<String, dynamic>> l(String k) => (j[k] as List? ?? const []).cast<Map<String, dynamic>>();
    return CampusPaths(
      [for (final e in l('entrances')) Entrance(e['id'], e['buildingId'], e['name'], d(e['lng']), d(e['lat']), e['nodeId'])],
      [for (final n in l('nodes')) WalkNode(n['id'], d(n['lng']), d(n['lat']))],
      [for (final e in l('edges')) WalkEdge(e['id'], e['from'], e['to'], (e['lengthM'] as num?)?.toDouble())],
      [
        for (final f in l('floorPlans'))
          FloorPlan(f['id'], f['buildingId'], f['floor'] as int, f['label'], f['imageUrl'], width: (f['width'] as num?)?.toInt(), height: (f['height'] as num?)?.toInt())
      ],
      [for (final s in l('roomSpots')) RoomSpot.fromJson(s)],
    );
  }
}

// ---- routing (same rules as the web app) --------------------------------------------------
const walkSpeedMps = 1.2;
const snapRadiusM = 40.0;

double distanceM(double lng1, double lat1, double lng2, double lat2) {
  const r = 6371000.0;
  final dLat = (lat2 - lat1) * pi / 180, dLng = (lng2 - lng1) * pi / 180;
  final s = pow(sin(dLat / 2), 2) + cos(lat1 * pi / 180) * cos(lat2 * pi / 180) * pow(sin(dLng / 2), 2);
  return 2 * r * asin(sqrt(s));
}

int etaMinutes(double m) => max(1, (m / walkSpeedMps / 60).ceil());

class WalkRoute {
  const WalkRoute(this.nodeIds, this.points, this.meters);
  final List<String> nodeIds;
  final List<(double lng, double lat)> points;
  final double meters;
  int get minutes => etaMinutes(meters);
}

WalkRoute? shortestPath(CampusPaths p, String from, String to) {
  final nodes = {for (final n in p.nodes) n.id: n};
  if (!nodes.containsKey(from) || !nodes.containsKey(to)) return null;
  final adj = <String, List<(String, double)>>{};
  for (final e in p.edges) {
    final a = nodes[e.from], b = nodes[e.to];
    if (a == null || b == null) continue;
    final w = e.lengthM ?? distanceM(a.lng, a.lat, b.lng, b.lat);
    adj.putIfAbsent(e.from, () => []).add((e.to, w));
    adj.putIfAbsent(e.to, () => []).add((e.from, w));
  }
  final dist = <String, double>{from: 0};
  final prev = <String, String>{};
  final todo = nodes.keys.toSet();
  while (todo.isNotEmpty) {
    String? u;
    for (final n in todo) {
      if (dist.containsKey(n) && (u == null || dist[n]! < dist[u]!)) u = n;
    }
    if (u == null) break;
    todo.remove(u);
    if (u == to) break;
    for (final (v, w) in adj[u] ?? const <(String, double)>[]) {
      final alt = dist[u]! + w;
      if (alt < (dist[v] ?? double.infinity)) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }
  if (!dist.containsKey(to)) return null;
  final ids = [to];
  while (ids.first != from) {
    ids.insert(0, prev[ids.first]!);
  }
  return WalkRoute(ids, [for (final id in ids) (nodes[id]!.lng, nodes[id]!.lat)], dist[to]!);
}

List<Entrance> entrancesOf(CampusPaths p, String buildingId) =>
    p.entrances.where((e) => e.buildingId == buildingId && e.nodeId != null).toList();

WalkNode? snapToNode(CampusPaths p, double lng, double lat) {
  WalkNode? best;
  var bestM = double.infinity;
  for (final n in p.nodes) {
    final m = distanceM(lng, lat, n.lng, n.lat);
    if (m < bestM) {
      bestM = m;
      best = n;
    }
  }
  return bestM <= snapRadiusM ? best : null;
}

({WalkRoute route, Entrance entrance})? routeBetween(CampusPaths p, {String? fromBuildingId, String? fromNodeId, required String toBuildingId}) {
  final starts = fromNodeId != null ? [fromNodeId] : entrancesOf(p, fromBuildingId ?? '').map((e) => e.nodeId!).toList();
  ({WalkRoute route, Entrance entrance})? best;
  for (final s in starts) {
    for (final ent in entrancesOf(p, toBuildingId)) {
      final r = shortestPath(p, s, ent.nodeId!);
      if (r != null && (best == null || r.meters < best.route.meters)) best = (route: r, entrance: ent);
    }
  }
  return best;
}

// ---- repositories ----------------------------------------------------------------------------
abstract class CampusRepository {
  bool get isDemo;
  Future<CampusPaths> load();
}

class LiveCampusRepository implements CampusRepository {
  LiveCampusRepository(this.config, {http.Client? client}) : _client = client ?? http.Client();
  final AppConfig config;
  final http.Client _client;
  @override
  bool get isDemo => false;

  Future<List<Map<String, dynamic>>> _get(String path) async {
    final http.Response res;
    try {
      res = await _client.get(Uri.parse('${config.restBase}/$path&status=eq.verified'),
          headers: {'apikey': config.supabasePublishableKey, 'Accept': 'application/json'});
    } catch (_) {
      throw PlacesException('network error');
    }
    if (res.statusCode != 200) throw PlacesException('HTTP ${res.statusCode}');
    return (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
  }

  /// Room positions on blueprints (migration 0007). Before it is applied the table 404s: no spots yet.
  Future<List<Map<String, dynamic>>> _spots() async {
    try {
      return await _get('floor_plan_rooms?select=id,floor_plan_id,place_id,label,shape,x,y,w,h,points');
    } on PlacesException catch (e) {
      if (e.message == 'HTTP 404') return const [];
      rethrow;
    }
  }

  @override
  Future<CampusPaths> load() async {
    final r = await Future.wait([
      _get('entrances?select=id,building_id,name,lng,lat,node_id'),
      _get('walk_nodes?select=id,lng,lat'),
      _get('walk_edges?select=id,from_node,to_node,length_m'),
      // select=* so the 0007 width_px/height_px columns are picked up once they exist.
      _get('floor_plans?select=*'),
      _spots(),
    ]);
    double d(dynamic x) => (x as num).toDouble();
    return CampusPaths(
      [for (final e in r[0]) Entrance(e['id'], e['building_id'], e['name'], d(e['lng']), d(e['lat']), e['node_id'])],
      [for (final n in r[1]) WalkNode(n['id'], d(n['lng']), d(n['lat']))],
      [for (final e in r[2]) WalkEdge(e['id'], e['from_node'], e['to_node'], (e['length_m'] as num?)?.toDouble())],
      [
        for (final f in r[3])
          FloorPlan(f['id'], f['building_id'], f['floor'] as int, f['label'], config.storageUrl(f['image_url'] as String), width: (f['width_px'] as num?)?.toInt(), height: (f['height_px'] as num?)?.toInt())
      ],
      [for (final s in r[4]) RoomSpot.fromJson(s, snake: true)],
    );
  }
}

/// DEMO walkways (copy of the web fixture). Only when Supabase is not configured.
class DemoCampusRepository implements CampusRepository {
  DemoCampusRepository({Future<String> Function()? loader}) : _loader = loader ?? (() => rootBundle.loadString('assets/demo/campus.json'));
  final Future<String> Function() _loader;
  @override
  bool get isDemo => true;

  @override
  Future<CampusPaths> load() async => CampusPaths.fromFixture(jsonDecode(await _loader()) as Map<String, dynamic>);
}

CampusRepository createCampusRepository(AppConfig c) => c.isLive ? LiveCampusRepository(c) : DemoCampusRepository();
