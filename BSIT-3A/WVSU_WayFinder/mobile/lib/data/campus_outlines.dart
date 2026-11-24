import 'dart:convert';
import 'dart:math' as math;

import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

/// The team's custom MapTiler style for the Campus Map (same style the web app loads).
const campusStyleId = '01a20291-e8a8-7646-9d78-2ffaf09b58b2';

/// The "Wayfinder" GeoJSON dataset that the custom style draws as WVSU building outlines.
/// MapTiler doesn't serve this custom style as raster tiles to our key, and flutter_map draws raster
/// tiles only, so mobile draws these same polygons itself on top of the streets basemap.
const campusOutlinesDatasetId = '01a202a4-e7ef-7779-876d-014e0ffe2b35';

/// One tappable building (or other drawn place: gate, field, parking) from the dataset.
/// Same rules as the web app's `src/features/map/buildings.ts`.
class CampusBuilding {
  CampusBuilding({required this.key, required this.name, required this.featureIds, required this.polygons});

  /// `map:<place_id>` (lowest polygon ID), or `map:f:<feature id>` when the polygon has no place_id.
  String key;
  final String name;

  /// Dataset `place_id` of every polygon drawn for this building. Links via public.building_features.
  final List<int> featureIds;

  /// Outer rings (holes are not used by the dataset).
  final List<List<LatLng>> polygons;

  ({double west, double south, double east, double north}) get bbox {
    var w = double.infinity, s = double.infinity, e = -double.infinity, n = -double.infinity;
    for (final p in polygons) {
      for (final c in p) {
        w = math.min(w, c.longitude);
        e = math.max(e, c.longitude);
        s = math.min(s, c.latitude);
        n = math.max(n, c.latitude);
      }
    }
    return (west: w, south: s, east: e, north: n);
  }

  bool contains(LatLng p) => polygons.any((ring) => _inRing(p.longitude, p.latitude, ring));

  /// Metres from [p] to the nearest edge of the outline; 0 when [p] is inside it.
  double distanceToM(LatLng p) {
    if (contains(p)) return 0;
    // Local flat projection around p: fine at campus scale (a few hundred metres).
    const mPerDeg = 6371000.0 * math.pi / 180;
    final kx = mPerDeg * math.cos(p.latitude * math.pi / 180);
    var best = double.infinity;
    for (final ring in polygons) {
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        final ax = (ring[j].longitude - p.longitude) * kx, ay = (ring[j].latitude - p.latitude) * mPerDeg;
        final bx = (ring[i].longitude - p.longitude) * kx, by = (ring[i].latitude - p.latitude) * mPerDeg;
        final dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
        final t = len2 == 0 ? 0.0 : (-(ax * dx + ay * dy) / len2).clamp(0.0, 1.0);
        final ex = ax + t * dx, ey = ay + t * dy;
        best = math.min(best, math.sqrt(ex * ex + ey * ey));
      }
    }
    return best;
  }
}

/// Every outline a GPS accuracy circle (centre [p], radius [radiusM]) reaches, nearest first.
List<CampusBuilding> buildingsWithin(List<CampusBuilding> list, LatLng p, double radiusM) {
  final hits = [for (final b in list) (b, b.distanceToM(p))].where((h) => h.$2 <= radiusM).toList()..sort((a, b) => a.$2.compareTo(b.$2));
  return [for (final h in hits) h.$1];
}

bool _inRing(double x, double y, List<LatLng> ring) {
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    final xi = ring[i].longitude, yi = ring[i].latitude, xj = ring[j].longitude, yj = ring[j].latitude;
    if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/// `name:en` when present, `name` as fallback; the dataset's trailing spaces are trimmed.
String buildingName(Map<String, dynamic>? props) {
  String? pick(Object? v) => v is String && v.trim().isNotEmpty ? v.trim() : null;
  return pick(props?['name:en']) ?? pick(props?['name']) ?? 'Unnamed building';
}

int? featureIdOf(Map<String, dynamic>? props) {
  final raw = props?['place_id'];
  final n = raw is String ? int.tryParse(raw) : (raw is num && raw == raw.roundToDouble() ? raw.toInt() : null);
  return n != null && n > 0 ? n : null;
}

/// Polygons only. Polygons that share a name are one building (e.g. a hall drawn as two wings).
List<CampusBuilding> parseCampusBuildings(Map<String, dynamic> fc) {
  final byName = <String, CampusBuilding>{};
  for (final f in (fc['features'] as List? ?? const []).cast<Map<String, dynamic>>()) {
    final g = f['geometry'] as Map<String, dynamic>?;
    final type = g?['type'];
    if (type != 'Polygon' && type != 'MultiPolygon') continue;
    final polys = type == 'Polygon' ? [g!['coordinates'] as List] : (g!['coordinates'] as List).cast<List>();
    final rings = [
      for (final p in polys)
        [for (final c in (p.first as List).cast<List>()) LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble())],
    ];
    final props = f['properties'] as Map<String, dynamic>?;
    final name = buildingName(props);
    final fid = featureIdOf(props);
    final existing = byName[name];
    if (existing != null) {
      existing.polygons.addAll(rings);
      if (fid != null) existing.featureIds.add(fid);
      continue;
    }
    byName[name] = CampusBuilding(
      key: fid != null ? 'map:$fid' : 'map:f:${f['id'] ?? name}',
      name: name,
      featureIds: [if (fid != null) fid],
      polygons: rings,
    );
  }
  for (final b in byName.values) {
    b.featureIds.sort();
    if (b.featureIds.isNotEmpty) b.key = 'map:${b.featureIds.first}';
  }
  return byName.values.toList();
}

CampusBuilding? buildingAt(List<CampusBuilding> list, LatLng p) {
  for (final b in list) {
    if (b.contains(p)) return b;
  }
  return null;
}

/// Smallest pan (screen px) that brings [box] inside the part of the map not covered by the card.
/// (0, 0) when already visible; a box larger than the free area is centred in it.
(double, double) panToReveal(
  ({double left, double top, double right, double bottom}) box,
  ({double width, double height}) view, {
  double insetBottom = 0,
  double margin = 16,
}) {
  double axis(double lo, double hi, double min, double max) {
    if (hi - lo > max - min) return (lo + hi) / 2 - (min + max) / 2;
    if (lo < min) return lo - min;
    if (hi > max) return hi - max;
    return 0;
  }

  return (
    axis(box.left, box.right, margin, view.width - margin).roundToDouble(),
    axis(box.top, box.bottom, margin, view.height - insetBottom - margin).roundToDouble(),
  );
}

/// Loads the building polygons. Empty on any failure, without logging the URL (it carries the key).
Future<List<CampusBuilding>> loadCampusBuildings(String mapTilerKey, {http.Client? client}) async {
  if (mapTilerKey.isEmpty) return const [];
  final c = client ?? http.Client();
  try {
    final res = await c
        .get(Uri.https('api.maptiler.com', '/data/$campusOutlinesDatasetId/features.json', {'key': mapTilerKey}))
        .timeout(const Duration(seconds: 10));
    if (res.statusCode != 200) return const [];
    return parseCampusBuildings(jsonDecode(res.body) as Map<String, dynamic>);
  } catch (_) {
    return const [];
  } finally {
    if (client == null) c.close();
  }
}
