// Regression: the live search for a published room (QH 1) failed with "Couldn't load search results".
// On this self-referencing table PostgREST answers `parent:places!parent_id(*)` with the row's CHILDREN
// (a list), not its parent. The app must ask with `parent:parent_id(*)` and never crash on a list.
// The fake below answers both forms the way real PostgREST does.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wvsu_wayfinder/core/config.dart';
import 'package:wvsu_wayfinder/data/places_repository.dart';

const cfg = AppConfig(supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'sb_publishable_test');
const building = {'id': 'bldg-quezon-hall', 'kind': 'building', 'name': 'Quezon Hall', 'parent_id': null, 'lng': 122.562676, 'lat': 10.71313, 'status': 'verified'};
const room = {'id': 'room-quezon-hall-f1-qh1', 'kind': 'room', 'name': 'QH 1', 'room_code': 'QH1', 'floor': 1, 'parent_id': 'bldg-quezon-hall', 'status': 'verified'};

/// Like PostgREST on public.places: `parent:parent_id(*)` = the row parent_id points to (object or null);
/// `parent:places!parent_id(*)` = rows whose parent_id is this row (a list).
MockClient postgrest(List<String> selects) => MockClient((req) async {
      final sel = req.url.queryParameters['select'] ?? '';
      selects.add(sel);
      final rows = [building, room].where((r) => req.url.queryParameters['room_code'] == null || r['room_code'] == 'QH1').map((r) => {...r}).toList();
      for (final r in rows) {
        if (sel.contains('parent:parent_id(')) r['parent'] = [building, room].where((p) => p['id'] == r['parent_id']).firstOrNull;
        if (sel.contains('parent:places!parent_id(')) r['parent'] = [building, room].where((p) => p['parent_id'] == r['id']).toList();
      }
      return http.Response(jsonEncode(rows), 200, headers: {'content-type': 'application/json'});
    });

void main() {
  test('search QH 1 asks for the parent with parent:parent_id(*) and gets Quezon Hall', () async {
    final selects = <String>[];
    final hits = await LivePlacesRepository(cfg, client: postgrest(selects)).search('QH 1');
    expect(selects.single, '*,parent:parent_id(*)');
    expect(hits.single.place.roomCode, 'QH1');
    expect(hits.single.parent?.name, 'Quezon Hall');
  });

  test('a list in "parent" (the old embed shape) is ignored instead of failing the search', () async {
    final client = MockClient((req) async => http.Response(jsonEncode([{...room, 'parent': []}]), 200, headers: {'content-type': 'application/json'}));
    final hits = await LivePlacesRepository(cfg, client: client).search('QH 1');
    expect(hits.single.place.name, 'QH 1');
    expect(hits.single.parent, isNull);
  });

  test('a building has no parent: null embed stays null', () async {
    final hits = await LivePlacesRepository(cfg, client: postgrest([])).list();
    expect(hits.firstWhere((v) => v.place.id == 'bldg-quezon-hall').parent, isNull);
    expect(hits.firstWhere((v) => v.place.id == 'room-quezon-hall-f1-qh1').parent?.id, 'bldg-quezon-hall');
  });
}
