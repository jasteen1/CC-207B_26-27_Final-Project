// WayFinder redesign core (design source: ~/Downloads/WayFinder-SVGs, made from the clickable prototype).
// Tokens match src/wf/app.css in the web app; data comes from assets/wf/wayfinder.json (the prototype's data.js,
// campus.js, buildings.js and floors.js).
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/* ---------- tokens ---------- */
class C {
  static const gold = Color(0xFFF3B53A), goldSoft = Color(0xFFFCEBC4), goldDeep = Color(0xFFB87900), goldLine = Color(0xFFE9B24A);
  static const navy = Color(0xFF132D6B), navy2 = Color(0xFF1B3C8A), blue = Color(0xFF2E6FB8), sky = Color(0xFF3F8FD2), blueSoft = Color(0xFFE6EEF9);
  static const cream = Color(0xFFFFFBF3), paper = Colors.white, sand = Color(0xFFF5EDDC), line = Color(0xFFE6DCC8), line2 = Color(0xFFD5C8AE);
  static const ink = Color(0xFF132D6B), body = Color(0xFF3B4760), muted = Color(0xFF5A6476), google = Color(0xFF131314);
  static const ok = Color(0xFF13703F), okSoft = Color(0xFFE2F3E8), warn = Color(0xFF7A4E00), warnSoft = Color(0xFFFFF1D2), err = Color(0xFFA3261C);
  static const night = Color(0xFF0C1C47), mapBg = Color(0xFFF2EADB), home2 = Color(0xFFFBF8F1);
}

class T {
  static const display = 'Signika', ui = 'Fira Sans';
  static TextStyle h1([double size = 30]) => TextStyle(fontFamily: display, fontWeight: FontWeight.w600, fontSize: size, height: 1.1, color: C.ink, letterSpacing: -0.3);
  static const h2 = TextStyle(fontFamily: display, fontWeight: FontWeight.w600, fontSize: 21, height: 1.2, color: C.ink);
  static const h3 = TextStyle(fontFamily: ui, fontWeight: FontWeight.w700, fontSize: 16, height: 1.3, color: C.ink);
  static const body = TextStyle(fontFamily: ui, fontSize: 16, height: 1.5, color: C.body);
  static const small = TextStyle(fontFamily: ui, fontSize: 14, height: 1.45, color: C.muted);
  static const label = TextStyle(fontFamily: ui, fontSize: 13, fontWeight: FontWeight.w700, color: C.muted);
  static TextStyle room([double size = 34]) => TextStyle(fontFamily: display, fontWeight: FontWeight.w700, fontSize: size, height: 1, color: C.navy, letterSpacing: -0.3);
  static const eyebrow = TextStyle(fontFamily: ui, fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.4, color: C.blue);
}

ThemeData wfTheme() => ThemeData(
      useMaterial3: true,
      fontFamily: T.ui,
      scaffoldBackgroundColor: C.cream,
      colorScheme: ColorScheme.fromSeed(seedColor: C.navy2, primary: C.navy2, secondary: C.gold, surface: C.cream),
      textSelectionTheme: const TextSelectionThemeData(cursorColor: C.navy2),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      }),
    );

/* ---------- data ---------- */
class WFData {
  WFData(this.wf, this.campus);
  final Map<String, dynamic> wf;
  final Map<String, dynamic> campus;
  late final List<CampusShape> shapes = [for (final s in campus['shapes'] as List) CampusShape.fromJson(s as Map<String, dynamic>)];

  Map<String, dynamic> get places => wf['places'] as Map<String, dynamic>;
  Map<String, dynamic> get offices => wf['offices'] as Map<String, dynamic>;
  Map<String, dynamic> get processes => wf['processes'] as Map<String, dynamic>;
  Map<String, dynamic> get routes => wf['routes'] as Map<String, dynamic>;
  List get schedule => wf['schedule'] as List;
  List get starts => wf['starts'] as List;
  List<String> get labelled => (wf['labelled'] as List).cast<String>();
  int get todayDay => wf['today']['day'] as int;
  int get todayMinutes => wf['today']['minutes'] as int;
  Map<String, dynamic> get reminder => wf['reminderDemo'] as Map<String, dynamic>;
  String day(int d) => (wf['days'] as List)[d] as String;

  CampusShape? shapeBy(String? name) {
    if (name == null) return null;
    for (final s in shapes) { if (!s.line && s.name == name) return s; }
    return null;
  }

  String? placeByShape(String name) { for (final e in places.entries) { if (e.value['shape'] == name) return e.key; } return null; }
  String where(Map o) => '${places[o['place']]['name']} · ${o['floor'] != null ? 'Floor ${o['floor']}' : 'floor not confirmed'}';
  Map? roomOf(Map pl, String? key) { final rooms = pl['rooms'] as Map?; final r = key == null || rooms == null ? null : rooms[key]; return r != null && r['confirmed'] == true && r['rect'] != null ? r as Map : null; }
  Map? routeFor(String? from, String? to) {
    if (from == null) return null;
    final direct = routes['$from>$to']; if (direct != null) return direct as Map;
    for (final r in routes.values) { if (r['from'] == from && ((r['also'] as List?) ?? []).contains(to)) return r as Map; }
    return null;
  }

  static Future<WFData> load([AssetBundle? bundle]) async {
    final j = jsonDecode(await (bundle ?? rootBundle).loadString('assets/wf/wayfinder.json')) as Map<String, dynamic>;
    final wf = j['WF'] as Map<String, dynamic>, places = wf['places'] as Map<String, dynamic>;
    // Same merge as the prototype: building photos and blueprints, then checked floor plans and their rooms.
    for (final b in j['BUILDINGS'] as List) {
      final pl = places.putIfAbsent(b['id'], () => {'name': b['name'], 'shape': b['shape'], 'kind': 'Building', 'floors': [], 'about': null, 'entrance': 'none', 'rooms': {}}) as Map;
      pl['photo'] = b['photo']; pl['blueprints'] = b['blueprints']; if (b['note'] != null) pl['note'] = b['note'];
    }
    (j['FLOORS'] as Map).forEach((id, fp) {
      final pl = places[id]; if (pl == null) return;
      final before = Map<String, dynamic>.from(pl['rooms'] ?? {});
      pl['plans'] = fp['plans'];
      pl['floors'] = ((fp['plans'] as Map).keys.map((k) => int.parse(k as String)).toList()..sort());
      final rooms = <String, dynamic>{};
      (fp['rooms'] as Map).forEach((k, r) => rooms[k] = {...r as Map, 'verified': r['confirmed'], 'where': 'Floor ${r['floor']}'});
      before.forEach((k, r) => rooms[k] = {...(rooms[k] as Map? ?? {}), ...r as Map, 'confirmed': true});
      pl['rooms'] = rooms;
    });
    (wf['officeRooms'] as Map).forEach((oid, key) {
      final o = wf['offices'][oid], pl = o == null ? null : places[o['place']], r = pl == null ? null : (pl['rooms'] as Map?)?[key];
      if (r != null && r['confirmed'] == true) { o['room'] = key; o['floor'] = r['floor']; }
    });
    return WFData(wf, j['CAMPUS'] as Map<String, dynamic>);
  }
}

/// A campus outline from the team's MapTiler dataset. Paths are straight segments (M/L/Z).
class CampusShape {
  CampusShape(this.name, this.line, this.d, this.cx, this.cy);
  final String name; final bool line; final String d; final double cx, cy;
  late final List<Offset> pts = parsePoints(d);
  late final Path path = toPath(d);
  factory CampusShape.fromJson(Map<String, dynamic> j) => CampusShape(j['name'] as String, j['line'] == true, j['d'] as String, (j['cx'] as num).toDouble(), (j['cy'] as num).toDouble());
  static List<Offset> parsePoints(String d) {
    final n = RegExp(r'-?\d+(\.\d+)?').allMatches(d).map((m) => double.parse(m.group(0)!)).toList();
    return [for (var i = 0; i + 1 < n.length; i += 2) Offset(n[i], n[i + 1])];
  }
  static Path toPath(String d) {
    final p = Path(); final tok = RegExp(r'([MLZ])|(-?\d+(?:\.\d+)?)').allMatches(d).map((m) => m.group(0)!).toList();
    var i = 0, cmd = 'M';
    while (i < tok.length) {
      final t = tok[i];
      if (t == 'M' || t == 'L') { cmd = t; i++; continue; }
      if (t == 'Z') { p.close(); i++; continue; }
      final x = double.parse(tok[i]), y = double.parse(tok[i + 1]); i += 2;
      if (cmd == 'M') { p.moveTo(x, y); cmd = 'L'; } else { p.lineTo(x, y); }
    }
    return p;
  }
}

/* ---------- formatting ---------- */
int mins(String t) {
  final parts = t.split(' '), hm = parts[0].split(':'); var h = int.parse(hm[0]); final m = hm.length > 1 ? int.parse(hm[1]) : 0;
  if (parts.length > 1 && parts[1] == 'PM' && h != 12) h += 12;
  if (parts.length > 1 && parts[1] == 'AM' && h == 12) h = 0;
  return h * 60 + m;
}
String range(String a, String b) { final x = a.split(' '), y = b.split(' '); return x.length > 1 && y.length > 1 && x[1] == y[1] ? '${x[0]}–${y[0]} ${y[1]}' : '$a–$b'; }
String fmtMin(int m) { var h = m ~/ 60; final mm = m % 60, ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 == 0 ? 12 : h % 12; return '$h${mm > 0 ? ':${mm.toString().padLeft(2, '0')}' : ''} $ap'; }
String fmtShort(int m) { var h = m ~/ 60; final mm = m % 60; h = h % 12 == 0 ? 12 : h % 12; return mm > 0 ? '$h:${mm.toString().padLeft(2, '0')}' : '$h'; }
String? buildingOf(String room) => RegExp(r'^ICT', caseSensitive: false).hasMatch(room) ? 'cict-building' : RegExp(r'^QH', caseSensitive: false).hasMatch(room) ? 'quezon-hall' : null;
String enc(String s) => Uri.encodeComponent(s);

/* ---------- schedule ---------- */
class Meeting { Meeting(this.day, this.start, this.end, this.room); int day; String start, end, room;
  List toJson() => [day, start, end, room]; static Meeting from(List m) => Meeting(m[0] as int, m[1] as String, m[2] as String, m[3] as String); Meeting copy() => Meeting(day, start, end, room); }
class Subject { Subject(this.code, this.title, this.row, this.m); final String code, title; final num? row; final List<Meeting> m;
  Map toJson() => {'code': code, 'title': title, 'row': row, 'm': [for (final x in m) x.toJson()]};
  static Subject from(Map j) => Subject(j['code'] as String, j['title'] as String, j['row'] as num?, [for (final x in j['m'] as List) Meeting.from(x as List)]);
  Subject copy() => Subject(code, title, row, [for (final x in m) x.copy()]); }
class Item { Item(this.x, this.si, this.mi, this.m); final Subject x; final int si, mi; final Meeting m; }

class Profile {
  Profile({this.role = 'student', this.first = '', this.mi = '', this.last = '', this.id = '', this.college = '', this.program = '', this.year = '', this.section = '', this.campus = '', this.consent = false});
  String role, first, mi, last, id, college, program, year, section, campus; bool consent;
  Map toJson() => {'role': role, 'first': first, 'mi': mi, 'last': last, 'id': id, 'college': college, 'program': program, 'year': year, 'section': section, 'campus': campus, 'consent': consent};
  static Profile from(Map j) => Profile(role: j['role'] ?? 'student', first: j['first'] ?? '', mi: j['mi'] ?? '', last: j['last'] ?? '', id: j['id'] ?? '', college: j['college'] ?? '', program: j['program'] ?? '', year: j['year'] ?? '', section: j['section'] ?? '', campus: j['campus'] ?? '', consent: j['consent'] == true);
  Profile copy() => from(toJson());
  String get name => [first, mi.isNotEmpty ? (mi.endsWith('.') ? mi : '$mi.') : '', last].where((s) => s.isNotEmpty).join(' ');
  String get initials { final a = first.trim(), b = last.trim(); final s = '${a.isNotEmpty ? a[0] : ''}${b.isNotEmpty ? b[0] : ''}'.toUpperCase(); return s.isEmpty ? '?' : s; }
  String get line => [program, year.isNotEmpty ? '$year year' : '', section.isNotEmpty ? 'Section $section' : ''].where((s) => s.isNotEmpty).join(', ');
}

class Note { Note(this.id, this.kind, this.at, this.title, this.body, {this.map, this.cls, this.room, this.read = false}); final String id, kind, at, title, body; final String? map, cls, room; bool read;
  Map toJson() => {'id': id, 'kind': kind, 'at': at, 'title': title, 'body': body, 'map': map, 'cls': cls, 'room': room, 'read': read};
  static Note from(Map j) => Note(j['id'], j['kind'], j['at'], j['title'], j['body'], map: j['map'], cls: j['cls'], room: j['room'], read: j['read'] == true); }

class Start { Start(this.kind, this.label, {this.id, this.shape, this.pt}); final String kind, label; final String? id, shape; final Offset? pt;
  Map toJson() => {'kind': kind, 'label': label, 'id': id, 'shape': shape, 'pt': pt == null ? null : [pt!.dx, pt!.dy]};
  static Start from(Map j) => Start(j['kind'], j['label'], id: j['id'], shape: j['shape'], pt: j['pt'] == null ? null : Offset((j['pt'][0] as num).toDouble(), (j['pt'][1] as num).toDouble())); }

/* ---------- app state (persisted on the device) ---------- */
class WFState extends ChangeNotifier {
  WFState(this.data, {SharedPreferences? prefs}) : _prefs = prefs { now = data.todayMinutes; weekDay = data.todayDay; _restore(); }
  final WFData data; final SharedPreferences? _prefs;
  bool signed = false, firstTime = false, notified = false, introPlayed = false, orgOpen = false;
  List<Subject>? saved, draft;
  ({String key, Meeting prev, String label})? lastEdit;
  List<int> openSubj = [];
  Start? start; Offset? pinPt;
  String view = 'today'; late int weekDay; late int now;
  List<String> ask = [];
  Profile? profile;
  List<Note> notes = [];
  ({String code, int mi, String from, String to})? moved;
  Map<String, List<int>> procDone = {};
  String? toast; int pushStamp = 0;

  List<Subject> copySchedule() => [for (final s in data.schedule) Subject.from(s as Map)];
  void update(void Function() fn) { fn(); _persist(); notifyListeners(); }
  void reset() { signed = false; firstTime = false; notified = false; saved = null; draft = null; lastEdit = null; openSubj = []; start = null; pinPt = null; ask = []; profile = null; notes = []; moved = null; procDone = {}; toast = null; pushStamp = 0; now = data.todayMinutes; _persist(); notifyListeners(); }
  void showToast(String t) => update(() => toast = t);

  List<Item> upcoming() {
    final s = saved; if (s == null) return [];
    final out = <Item>[];
    for (var si = 0; si < s.length; si++) { for (var mi = 0; mi < s[si].m.length; mi++) { if (s[si].m[mi].day == data.todayDay) out.add(Item(s[si], si, mi, s[si].m[mi])); } }
    out.sort((a, b) => mins(a.m.start) - mins(b.m.start));
    return out;
  }
  ({String code, int mi, String from, String to})? movedNote(String code, int mi) => moved != null && moved!.code == code && moved!.mi == mi ? moved : null;
  int get unread => notes.where((n) => !n.read).length;
  Profile get me => profile ?? Profile(first: data.wf['student']['first'], last: data.wf['student']['last'], campus: (data.wf['campuses'] as List).first);

  /// The sample same-day room change carried by the class reminder: today's CIT 251 meets in QH 1.
  Subject? applyRoomChange() {
    final r = data.reminder, s = saved; if (s == null) return null;
    final x = s.where((c) => c.code == r['code']).firstOrNull; if (x == null) return null;
    final m = x.m[r['meeting'] as int];
    moved ??= (code: r['code'] as String, mi: r['meeting'] as int, from: m.room, to: r['room'] as String);
    m.room = moved!.to; return x;
  }
  Note? reminderNote() {
    final r = data.reminder, x = applyRoomChange(); if (x == null) return null;
    final m = x.m[r['meeting'] as int], b = data.places[buildingOf(m.room)];
    return Note('remind', 'class', fmtMin(r['at'] as int), '${x.code} in 15 min', 'Moved to ${m.room}, ${b?['name'] ?? ''}.',
        map: '/map/route?from=${r['from']}&to=${buildingOf(m.room)}&room=${enc(m.room)}', cls: '/class/${enc(x.code)}/${r['meeting']}', room: m.room);
  }
  void addNote(Note n) { notes = [n, ...notes.where((x) => x.id != n.id)]; }
  void sendReminder({bool force = false}) {
    if (!signed || saved == null) return;
    if (!force && notified) return;
    update(() { notified = true; now = data.reminder['at'] as int; final n = reminderNote(); if (n != null) addNote(n); pushStamp = DateTime.now().millisecondsSinceEpoch; });
  }
  List<Subject> draftOf() => draft ??= copySchedule();

  static const _key = 'wf-state-v1';
  void _persist() {
    final p = _prefs; if (p == null) return;
    p.setString(_key, jsonEncode({
      'signed': signed, 'firstTime': firstTime, 'notified': notified, 'introPlayed': introPlayed, 'orgOpen': orgOpen,
      'saved': saved?.map((s) => s.toJson()).toList(), 'start': start?.toJson(), 'view': view, 'weekDay': weekDay, 'now': now,
      'profile': profile?.toJson(), 'notes': [for (final n in notes) n.toJson()], 'procDone': procDone,
      'moved': moved == null ? null : {'code': moved!.code, 'mi': moved!.mi, 'from': moved!.from, 'to': moved!.to},
    }));
  }
  void _restore() {
    final raw = _prefs?.getString(_key); if (raw == null) return;
    try {
      final j = jsonDecode(raw) as Map;
      signed = j['signed'] == true; firstTime = j['firstTime'] == true; notified = j['notified'] == true; introPlayed = j['introPlayed'] == true; orgOpen = j['orgOpen'] == true;
      saved = (j['saved'] as List?)?.map((s) => Subject.from(s as Map)).toList();
      start = j['start'] == null ? null : Start.from(j['start'] as Map);
      view = j['view'] ?? 'today'; weekDay = j['weekDay'] ?? data.todayDay; now = j['now'] ?? data.todayMinutes;
      profile = j['profile'] == null ? null : Profile.from(j['profile'] as Map);
      notes = [for (final n in (j['notes'] as List? ?? [])) Note.from(n as Map)];
      procDone = {for (final e in (j['procDone'] as Map? ?? {}).entries) e.key as String: (e.value as List).cast<int>()};
      final mv = j['moved']; if (mv != null) moved = (code: mv['code'] as String, mi: mv['mi'] as int, from: mv['from'] as String, to: mv['to'] as String);
    } catch (_) {/* a bad saved state starts fresh */}
  }
}

/// Gives every screen the data and the state.
class WF extends InheritedNotifier<WFState> {
  const WF({super.key, required WFState state, required super.child}) : super(notifier: state);
  static WFState of(BuildContext c) => c.dependOnInheritedWidgetOfExactType<WF>()!.notifier!;
}
extension WFx on BuildContext {
  /// The state, rebuilding this widget when it changes. Use [wfr] in initState, dispose and callbacks.
  WFState get wf => WF.of(this);
  WFState get wfr => getInheritedWidgetOfExactType<WF>()!.notifier!;
  WFData get d => wfr.data;
}

/// Prototype asset paths ("assets/…") live under assets/wf/.
String asset(String src) => 'assets/wf/${src.replaceFirst(RegExp(r'^assets/'), '')}';

/// The campus map's whole-route viewBox helper: returns the scale and origin that fit [pts] into [size] with margins.
({double k, Offset o}) fitPoints(List<Offset> pts, Size size, EdgeInsets m) {
  final xs = pts.map((p) => p.dx), ys = pts.map((p) => p.dy);
  final x0 = xs.reduce((a, b) => a < b ? a : b), x1 = xs.reduce((a, b) => a > b ? a : b), y0 = ys.reduce((a, b) => a < b ? a : b), y1 = ys.reduce((a, b) => a > b ? a : b);
  final k = [(size.width - m.horizontal) / (x1 - x0 == 0 ? 1 : x1 - x0), (size.height - m.vertical) / (y1 - y0 == 0 ? 1 : y1 - y0)].reduce((a, b) => a < b ? a : b);
  final ax = m.left + (size.width - m.horizontal) / 2, ay = m.top + (size.height - m.vertical) / 2;
  return (k: k, o: Offset((x0 + x1) / 2 - ax / k, (y0 + y1) / 2 - ay / k));
}

