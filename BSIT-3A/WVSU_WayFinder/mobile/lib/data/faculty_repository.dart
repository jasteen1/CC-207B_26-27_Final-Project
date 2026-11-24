import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:http/http.dart' as http;

import '../core/config.dart';
import 'places_repository.dart' show PlacesException;

/// A row from public.faculty_directory (published + verified only).
class Faculty {
  const Faculty({required this.recordId, required this.fullName, this.collegeUnit, this.collegeCode, this.department, this.positionTitle, this.officePlaceId, this.isDemo = false});
  final String recordId;
  final String fullName;
  final String? collegeUnit, collegeCode, department, positionTitle;
  /// Only set when a VERIFIED office link exists. The live table has no office-link column yet.
  final String? officePlaceId;
  final bool isDemo;

  factory Faculty.fromRow(Map<String, dynamic> r) => Faculty(
        recordId: '${r['record_id']}',
        fullName: r['full_name'] as String,
        collegeUnit: r['college_unit'] as String?,
        collegeCode: r['college_code'] as String?,
        department: r['department'] as String?,
        positionTitle: r['position_title'] as String?,
      );
}

abstract class FacultyRepository {
  bool get isDemo;
  Future<List<Faculty>> search(String query);
  Future<Faculty?> get(String recordId);
}

/// Named columns only (never select=*); publication rule: is_published = true AND review_status = 'verified'.
class LiveFacultyRepository implements FacultyRepository {
  LiveFacultyRepository(this.config, {http.Client? client}) : _client = client ?? http.Client();
  final AppConfig config;
  final http.Client _client;
  static const columns = 'record_id,full_name,college_unit,college_code,department,position_title';
  static const published = 'is_published=eq.true&review_status=eq.verified';

  @override
  bool get isDemo => false;

  /// public.faculty (0002): the columns that migration grants to students. RLS returns verified rows only.
  static const columns0002 = 'id,full_name,department,college_id,office_id,official_email,office_hours,verified_at';

  Future<http.Response> _fetch(String pathAndQuery) async {
    try {
      return await _client.get(Uri.parse('${config.restBase}/$pathAndQuery'), headers: {'apikey': config.supabasePublishableKey, 'Accept': 'application/json'});
    } catch (_) {
      throw PlacesException('network error');
    }
  }

  List<Map<String, dynamic>> _rows(http.Response r) {
    if (r.statusCode != 200) throw PlacesException('HTTP ${r.statusCode}');
    return (jsonDecode(r.body) as List).cast<Map<String, dynamic>>();
  }

  /// faculty_directory when it exists; on 404 (table not in the schema, as in the live project) the
  /// migrations' public.faculty. "Show office on map" only from a VERIFIED office place; never from a college.
  Future<List<Faculty>> _get(String filter, {String? idFilter0002}) async {
    final dir = await _fetch('faculty_directory?select=$columns&$published$filter&order=full_name.asc&limit=100');
    if (dir.statusCode != 404) return _rows(dir).map(Faculty.fromRow).toList();
    final rows = _rows(await _fetch('faculty?select=$columns0002${idFilter0002 ?? filter}&order=full_name.asc&limit=100'));
    final ids = {for (final r in rows) ...[r['office_id'], r['college_id']]}.whereType<String>().toList();
    final visible = <String, Map<String, dynamic>>{};
    if (ids.isNotEmpty) {
      final list = ids.map((i) => '"${i.replaceAll(RegExp(r'[",()\\]'), '')}"').join(',');
      for (final p in _rows(await _fetch('places?select=id,kind,name,status&id=in.(${Uri.encodeQueryComponent(list)})&status=eq.verified'))) {
        visible[p['id'] as String] = p;
      }
    }
    return [
      for (final r in rows)
        Faculty(
          recordId: r['id'] as String,
          fullName: r['full_name'] as String,
          department: r['department'] as String?,
          collegeUnit: visible[r['college_id']]?['name'] as String?,
          officePlaceId: visible.containsKey(r['office_id']) ? r['office_id'] as String : null,
        ),
    ];
  }

  @override
  Future<List<Faculty>> search(String query) {
    final name = query.replaceAll(RegExp(r'[*,()\\]'), ' ').trim();
    return _get(name.isEmpty ? '' : '&full_name=ilike.*${Uri.encodeQueryComponent(name)}*');
  }

  @override
  Future<Faculty?> get(String recordId) async => (await _get('&record_id=eq.${Uri.encodeQueryComponent(recordId)}',
      idFilter0002: '&id=eq.${Uri.encodeQueryComponent(recordId)}')).firstOrNull;
}

/// DEMO teachers (copy of the web fixture), same publication rule. Only when Supabase is not configured.
class DemoFacultyRepository implements FacultyRepository {
  DemoFacultyRepository({Future<String> Function()? loader}) : _loader = loader ?? (() => rootBundle.loadString('assets/demo/faculty.json'));
  final Future<String> Function() _loader;

  @override
  bool get isDemo => true;

  Future<List<Faculty>> _visible() async => ((jsonDecode(await _loader()) as Map)['faculty'] as List)
      .cast<Map<String, dynamic>>()
      .where((f) => f['isPublished'] == true && f['reviewStatus'] == 'verified')
      .map((f) => Faculty(
            recordId: f['recordId'], fullName: f['fullName'], collegeUnit: f['collegeUnit'], collegeCode: f['collegeCode'],
            department: f['department'], positionTitle: f['positionTitle'], officePlaceId: f['officePlaceId'], isDemo: true,
          ))
      .toList();

  @override
  Future<List<Faculty>> search(String query) async {
    final q = query.trim().toLowerCase();
    return (await _visible()).where((f) => f.fullName.toLowerCase().contains(q)).toList();
  }

  @override
  Future<Faculty?> get(String recordId) async => (await _visible()).where((f) => f.recordId == recordId).firstOrNull;
}

FacultyRepository createFacultyRepository(AppConfig config) => config.isLive ? LiveFacultyRepository(config) : DemoFacultyRepository();
