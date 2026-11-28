import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

/// The team's custom MapTiler style for the Campus Map (same style the web app loads).
const campusStyleId = '01a20291-e8a8-7646-9d78-2ffaf09b58b2';

/// The "Wayfinder" GeoJSON dataset that the custom style draws as WVSU building outlines.
/// MapTiler doesn't serve this custom style as raster tiles to our key, and flutter_map draws raster
/// tiles only, so mobile draws these same outlines itself on top of the streets basemap.
const campusOutlinesDatasetId = '01a202a4-e7ef-7779-876d-014e0ffe2b35';

class CampusOutline {
  const CampusOutline(this.name, this.points);
  final String name;
  final List<LatLng> points;
}

/// Loads the building outlines. Returns an empty list on any failure, without logging the URL
/// (it carries the MapTiler key).
Future<List<CampusOutline>> loadCampusOutlines(String mapTilerKey, {http.Client? client}) async {
  if (mapTilerKey.isEmpty) return const [];
  final c = client ?? http.Client();
  try {
    final res = await c
        .get(Uri.https('api.maptiler.com', '/data/$campusOutlinesDatasetId/features.json', {'key': mapTilerKey}))
        .timeout(const Duration(seconds: 10));
    if (res.statusCode != 200) return const [];
    final features = (jsonDecode(res.body) as Map<String, dynamic>)['features'] as List<dynamic>? ?? const [];
    final out = <CampusOutline>[];
    for (final f in features.cast<Map<String, dynamic>>()) {
      final g = f['geometry'] as Map<String, dynamic>?;
      if (g == null || g['type'] != 'Polygon') continue;
      final ring = (g['coordinates'] as List<dynamic>).first as List<dynamic>;
      out.add(CampusOutline(
        ((f['properties'] as Map<String, dynamic>?)?['name'] as String? ?? '').trim(),
        [for (final p in ring.cast<List<dynamic>>()) LatLng((p[1] as num).toDouble(), (p[0] as num).toDouble())],
      ));
    }
    return out;
  } catch (_) {
    return const [];
  } finally {
    if (client == null) c.close();
  }
}
