import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wvsu_wayfinder/core/config.dart';
import 'package:wvsu_wayfinder/data/faculty_repository.dart';
import 'package:wvsu_wayfinder/data/places_repository.dart';

import 'helpers.dart';

const live = AppConfig(supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'sb_publishable_test');

void main() {
  group('LiveFacultyRepository (HTTP mocked)', () {
    test('named columns, published + verified rule, record_id as identifier', () async {
      late http.Request seen;
      final repo = LiveFacultyRepository(live, client: MockClient((req) async {
        seen = req;
        return http.Response(jsonEncode([{'record_id': 7, 'full_name': 'Prof. Real', 'college_unit': 'College of ICT', 'college_code': 'CICT', 'department': 'Computing', 'position_title': 'Instructor I'}]), 200);
      }));
      final rows = await repo.search('real');
      final url = Uri.decodeFull(seen.url.toString());
      expect(url, contains('/rest/v1/faculty_directory?select=record_id,full_name,college_unit,college_code,department,position_title&is_published=eq.true&review_status=eq.verified'));
      expect(url, contains('full_name=ilike.*real*'));
      expect(url, isNot(contains('select=*')));
      expect(seen.headers['apikey'], 'sb_publishable_test');
      expect(rows.single.recordId, '7');
      expect(rows.single.positionTitle, 'Instructor I');
      expect(rows.single.officePlaceId, isNull, reason: 'the live table has no office link column');
    });

    test('faculty_directory 404 (live project) → public.faculty with granted columns; office only from a verified place', () async {
      final urls = <String>[];
      final repo = LiveFacultyRepository(live, client: MockClient((req) async {
        final u = Uri.decodeFull(req.url.toString());
        urls.add(u);
        if (u.contains('/faculty_directory?')) {
          return http.Response('{"code":"PGRST205","message":"Could not find the table \'public.faculty_directory\' in the schema cache"}', 404);
        }
        if (u.contains('/faculty?')) {
          return http.Response(jsonEncode([
            {'id': 'f-office', 'full_name': 'Ana Reyes', 'department': 'IT', 'college_id': 'college-cict', 'office_id': 'office-it'},
            {'id': 'f-college', 'full_name': 'Ben Cruz', 'department': 'Math', 'college_id': 'college-cict', 'office_id': null},
            {'id': 'f-hidden', 'full_name': 'Cora Diaz', 'department': 'Bio', 'college_id': null, 'office_id': 'office-hidden'},
          ]), 200);
        }
        // RLS: the unpublished office-hidden is not returned to students.
        return http.Response(jsonEncode([
          {'id': 'office-it', 'kind': 'office', 'name': 'IT Faculty Office', 'status': 'verified'},
          {'id': 'college-cict', 'kind': 'college', 'name': 'College of ICT', 'status': 'verified'},
        ]), 200);
      }));
      final rows = await repo.search('');
      final facultyUrl = urls.firstWhere((u) => u.contains('/faculty?'));
      expect(facultyUrl, contains('select=id,full_name,department,college_id,office_id,official_email,office_hours,verified_at'));
      expect(facultyUrl, isNot(contains('select=*')));
      expect({for (final f in rows) f.fullName: f.officePlaceId}, {'Ana Reyes': 'office-it', 'Ben Cruz': null, 'Cora Diaz': null},
          reason: 'a college affiliation alone, or an unpublished office, never enables Show office on map');
      expect(rows[1].collegeUnit, 'College of ICT');
    });

    test('HTTP error throws (no demo fallback in live mode)', () async {
      final repo = LiveFacultyRepository(live, client: MockClient((_) async => http.Response('{}', 404)));
      expect(repo.search(''), throwsA(isA<PlacesException>()));
    });
  });

  test('demo repository applies the same publication rule', () async {
    final repo = DemoFacultyRepository(loader: () async => fixture('faculty.json'));
    final names = (await repo.search('')).map((f) => f.fullName);
    expect(names, contains('Demo Prof. Maria Mapped'));
    expect(names.where((n) => n.contains('Hidden')), isEmpty);
    expect(await repo.get('demo-fd-5'), isNull);
  });
}
