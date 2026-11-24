import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:http/http.dart' as http;

import '../core/config.dart';
import '../core/search.dart';
import 'models.dart';

/// Thrown when a LIVE request fails. The UI shows an error with Retry; it never swaps in demo data.
class PlacesException implements Exception {
  PlacesException(this.message);
  final String message;
  @override
  String toString() => 'PlacesException: $message';
}

abstract class PlacesRepository {
  bool get isDemo;
  Future<List<PlaceView>> search(String query);
  Future<PlaceView?> getPlace(String id);
  Future<List<PlaceView>> list();
}

/// Reads verified rows through Supabase REST (PostgREST). Row-level security also enforces verified-only.
class LivePlacesRepository implements PlacesRepository {
  LivePlacesRepository(this.config, {http.Client? client}) : _client = client ?? http.Client();
  final AppConfig config;
  final http.Client _client;

  @override
  bool get isDemo => false;

  // Same query shape as the web app: verified only, parent building embedded.
  // `parent:parent_id(*)` embeds the row that parent_id points to (one object). The older
  // `parent:places!parent_id(*)` form makes PostgREST return the row's CHILDREN as a list instead.
  static const _select = 'select=*,parent:parent_id(*)';

  Future<List<PlaceView>> _fetch(String filter) async {
    final uri = Uri.parse('${config.restBase}/places?$_select&status=eq.verified&$filter');
    final http.Response res;
    try {
      res = await _client.get(uri, headers: {
        'apikey': config.supabasePublishableKey,
        'Accept': 'application/json',
      });
    } catch (_) {
      throw PlacesException('network error');
    }
    if (res.statusCode != 200) throw PlacesException('HTTP ${res.statusCode}');
    final rows = (jsonDecode(res.body) as List).cast<Map<String, dynamic>>();
    return rows
        .map((r) => PlaceView(
              Place.fromRow(r),
              r['parent'] is Map<String, dynamic> ? Place.fromRow(r['parent'] as Map<String, dynamic>) : null,
            ))
        .toList();
  }

  /// Characters with meaning inside a PostgREST filter value.
  static String _clean(String s) => s.replaceAll(RegExp(r'[*,()\\]'), ' ').trim();

  @override
  Future<List<PlaceView>> search(String query) {
    final q = query.trim();
    if (q.isEmpty) return Future.value([]);
    if (looksLikeRoomCode(q)) {
      return _fetch('room_code=eq.${Uri.encodeQueryComponent(normalizeRoomCode(q))}');
    }
    final n = Uri.encodeQueryComponent(_clean(q));
    return _fetch('or=(name.ilike.*$n*,short_name.ilike.$n)&limit=25');
  }

  @override
  Future<PlaceView?> getPlace(String id) async {
    final rows = await _fetch('id=eq.${Uri.encodeQueryComponent(id)}&limit=1');
    return rows.isEmpty ? null : rows.first;
  }

  @override
  Future<List<PlaceView>> list() => _fetch('order=name.asc&limit=200');
}

/// DEMO fixtures (a copy of the web app's src/data/demo/places.json). Used ONLY when Supabase
/// is not configured. These are invented placeholders, not WVSU information.
class DemoPlacesRepository implements PlacesRepository {
  DemoPlacesRepository({Future<String> Function()? loader})
      : _loader = loader ?? (() => rootBundle.loadString('assets/demo/places.json'));
  final Future<String> Function() _loader;
  List<Place>? _places;

  @override
  bool get isDemo => true;

  Future<List<Place>> _all() async => _places ??= ((jsonDecode(await _loader()) as Map)['places'] as List)
      .cast<Map<String, dynamic>>()
      .map(Place.fromFixture)
      .toList();

  PlaceView _view(Place p, List<Place> all) {
    Place? parent;
    for (final x in all) {
      if (x.id == p.parentId) parent = x;
    }
    return PlaceView(p, parent);
  }

  @override
  Future<List<PlaceView>> search(String query) async {
    final q = query.trim();
    if (q.isEmpty) return [];
    final all = await _all();
    final hits = looksLikeRoomCode(q)
        ? all.where((p) => p.roomCode == normalizeRoomCode(q))
        : all.where((p) => p.name.toLowerCase().contains(q.toLowerCase()) || p.shortName?.toLowerCase() == q.toLowerCase());
    return hits.map((p) => _view(p, all)).toList();
  }

  @override
  Future<PlaceView?> getPlace(String id) async {
    final all = await _all();
    for (final p in all) {
      if (p.id == id) return _view(p, all);
    }
    return null;
  }

  @override
  Future<List<PlaceView>> list() async {
    final all = await _all();
    return all.map((p) => _view(p, all)).toList();
  }
}

PlacesRepository createPlacesRepository(AppConfig config) =>
    config.isLive ? LivePlacesRepository(config) : DemoPlacesRepository();
