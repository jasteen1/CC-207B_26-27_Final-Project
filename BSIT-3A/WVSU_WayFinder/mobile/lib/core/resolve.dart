// Turns what a student typed into destinations: confirmed place records first, then what the map and
// the room-code prefixes can honestly say. Same rules and wording as the web app's lib/campus/resolve.ts.
import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import '../data/models.dart';
import 'search.dart';

class RoomPrefix {
  const RoomPrefix(this.prefix, this.suppliedName, this.mapName, this.status, [this.note]);
  final String prefix, suppliedName, status;
  final String? mapName, note;

  static List<RoomPrefix> parse(String json) => [
        for (final p in ((jsonDecode(json) as Map<String, dynamic>)['prefixes'] as List).cast<Map<String, dynamic>>())
          RoomPrefix(p['prefix'] as String, p['suppliedName'] as String, p['mapName'] as String?, p['status'] as String, p['note'] as String?),
      ];
}

List<RoomPrefix>? _prefixes;

/// The team's prefix list (assets/room_prefixes.json, a copy of the web app's src/data/room-prefixes.json).
Future<List<RoomPrefix>> loadRoomPrefixes() async => _prefixes ??= RoomPrefix.parse(await rootBundle.loadString('assets/room_prefixes.json'));

/// A building polygon from the MapTiler dataset.
class MapBuildingRef {
  const MapBuildingRef(this.key, this.name, this.featureIds);
  final String key, name;
  final List<int> featureIds;
}

sealed class SearchHit {
  const SearchHit();
}

/// A confirmed (or demo) place record.
class PlaceHit extends SearchHit {
  const PlaceHit(this.view);
  final PlaceView view;
}

/// Only the prefix is known: points to a building; room not confirmed; never a floor.
/// [building] is the polygon when the map is loaded (null if it couldn't be loaded, e.g. offline).
class PrefixHit extends SearchHit {
  const PrefixHit({required this.code, required this.label, required this.prefix, required this.number, required this.buildingName, this.building, required this.message});
  final String code, label, prefix, number, buildingName, message;
  final MapBuildingRef? building;
}

/// The prefix is known but its building isn't on the map.
class PrefixUnmappedHit extends SearchHit {
  const PrefixUnmappedHit({required this.code, required this.label, required this.prefix, required this.message});
  final String code, label, prefix, message;
}

/// A building drawn on the campus map whose name matches.
class MappedHit extends SearchHit {
  const MappedHit(this.building, [this.note]);
  final MapBuildingRef building;
  final String? note;
}

String _norm(String s) => s.trim().replaceAll(RegExp(r'\s+'), ' ').toLowerCase();
List<String> _words(String s) => _norm(s).replaceAll(RegExp(r'[^a-z0-9 ]'), ' ').split(' ').where((w) => w.isNotEmpty).toList();

SearchHit? prefixPointer(String input, List<MapBuildingRef> map, List<RoomPrefix> prefixes) {
  final c = parseRoomCode(input);
  if (c == null) return null;
  final p = prefixes.where((x) => x.prefix == c.prefix).firstOrNull;
  if (p == null) return null;
  final label = '${c.prefix} ${c.number}';
  final building = p.mapName == null ? null : map.where((b) => _norm(b.name) == _norm(p.mapName!)).firstOrNull;
  // "Not on the map" only when the map actually loaded and the name is missing (or was never matched).
  if (p.mapName == null || (building == null && map.isNotEmpty)) {
    return PrefixUnmappedHit(code: c.code, label: label, prefix: c.prefix,
        message: '${c.prefix} is listed as ${p.suppliedName}, which isn’t on the campus map yet. Room ${c.number} hasn’t been confirmed yet.');
  }
  final name = building?.name ?? p.mapName!;
  return PrefixHit(code: c.code, label: label, prefix: c.prefix, number: c.number, buildingName: name, building: building,
      message: '${c.prefix} points to $name. Room ${c.number} hasn’t been confirmed yet.');
}

/// Same rules as the web app: a code with a record → that record; a code without one → the prefix
/// pointer; a name → records, then map buildings no record covers (affiliation ≠ office location).
List<SearchHit> resolveSearch(String query, List<PlaceView> records, List<MapBuildingRef> map, List<RoomPrefix> prefixes) {
  final q = query.trim();
  if (q.isEmpty) return const [];
  final code = parseRoomCode(q);
  if (code != null) {
    final exact = records.where((v) => v.place.roomCode == code.code).toList();
    if (exact.isNotEmpty) return [for (final v in exact) PlaceHit(v)];
    final ptr = prefixPointer(q, map, prefixes);
    if (ptr != null) return [ptr];
  }
  final hits = <SearchHit>[for (final v in records) PlaceHit(v)];
  final recordNames = {for (final v in records) _norm(v.place.name)};
  final officeRecords = records.any((v) => v.place.kind == 'office');
  final qw = _words(q).where((w) => w != 'office' && w != 'the' && w != 'of').toList();
  if (qw.isEmpty) return hits;
  for (final b in map) {
    final bw = _words(b.name);
    if (!qw.every((w) => bw.any((x) => x.startsWith(w)))) continue;
    if (recordNames.contains(_norm(b.name))) continue;
    hits.add(MappedHit(b, officeRecords ? null : 'Building on the campus map. No office inside it has been confirmed yet.'));
  }
  for (final p in prefixes) {
    if (p.mapName == null || !_norm(p.suppliedName).contains(_norm(q)) || _norm(p.mapName!).contains(_norm(q))) continue;
    final b = map.where((x) => _norm(x.name) == _norm(p.mapName!)).firstOrNull;
    if (b != null && !hits.any((h) => h is MappedHit && h.building.key == b.key)) {
      hits.add(MappedHit(b, 'Associated with $q (room prefix ${p.prefix}). This is not a confirmed office location.'));
    }
  }
  return hits;
}
