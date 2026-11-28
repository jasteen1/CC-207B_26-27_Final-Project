// 17–25E, 28–28E, 34A–35I: campus map, building card, floor plans, blueprints, outlines, start picker, pin, route walk, process stops.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core.dart';
import 'directory.dart' show procStops, nextOf, stopState, shortOf;
import 'ui.dart';

String _startText(WFState s) => s.start == null ? 'Choose a starting point' : s.start!.kind == 'gps' ? 'Your location · ±18 m' : s.start!.kind == 'pin' ? 'Point on the map' : s.start!.label;
Offset? _startPt(WFState s) { final st = s.start; if (st == null) return null; if (st.pt != null) return st.pt; final sh = s.data.shapeBy(st.shape); return sh == null ? null : Offset(sh.cx, sh.cy); }
String _routeHref(Map r, [String? state]) => '/map/route?from=${r['from']}&to=${r['to']}${state != null ? '&walk=$state' : ''}';
void _tapShape(BuildContext context, String name) { final id = context.d.placeByShape(name); if (id != null) { context.push('/map/place/$id'); } else { context.wf.showToast('**$name** · no details recorded yet'); } }

/// Map screen frame: map, floating top bar, bottom sheet, tabs when signed in.
class _MapFrame extends StatelessWidget {
  const _MapFrame({required this.map, this.top, this.sheet, this.sheetMax = .66});
  final Widget map; final Widget? top, sheet; final double sheetMax;
  @override
  Widget build(BuildContext context) => Screen(tab: context.wf.signed ? Tab4.map : null, child: LayoutBuilder(builder: (_, c) => Stack(children: [
        Positioned.fill(child: map),
        if (top != null) Positioned(left: 12, right: 12, top: 12, child: top!),
        if (sheet != null) Positioned(left: 0, right: 0, bottom: 0, child: ConstrainedBox(constraints: BoxConstraints(maxHeight: c.maxHeight * sheetMax),
          child: TweenAnimationBuilder<double>(tween: Tween(begin: 1, end: 0), duration: const Duration(milliseconds: 460), curve: Curves.easeOutQuart, builder: (_, v, child) => FractionalTranslation(translation: Offset(0, v * .6), child: child),
            child: Container(decoration: const BoxDecoration(color: C.cream, borderRadius: BorderRadius.vertical(top: Radius.circular(26)), boxShadow: [BoxShadow(color: Color(0x293C2800), blurRadius: 30, offset: Offset(0, -10))]),
              child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(20, 10, 20, 20), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [const Grab(), sheet!])))))),
      ])));
}
Widget backPill(BuildContext context, String label, {String? to}) => Material(color: C.cream, elevation: 4, shadowColor: const Color(0x3C3C2800), borderRadius: BorderRadius.circular(12),
    child: InkWell(borderRadius: BorderRadius.circular(12), onTap: () => to != null ? context.go(to) : goBack(context, '/map'), child: Padding(padding: const EdgeInsets.fromLTRB(6, 10, 14, 10),
      child: Row(mainAxisSize: MainAxisSize.min, children: [const Icon(Ic.back, color: C.navy2), Text(label, style: const TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 15, color: C.navy2))]))));

/* ---------- 18–19 campus map + search ---------- */
class MapHomeScreen extends StatefulWidget { const MapHomeScreen({super.key, this.q = '', this.guest = false, this.focus = false}); final String q; final bool guest, focus; @override State<MapHomeScreen> createState() => _MapHomeState(); }
class _MapHomeState extends State<MapHomeScreen> {
  late final tc = TextEditingController(text: widget.q);
  @override void initState() { super.initState(); if (widget.guest) context.wfr.signed = false; }
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data, q = widget.q.trim().toLowerCase();
    final results = <(String, String, String)>[];
    if (q.isNotEmpty) {
      d.places.forEach((id, pl) => results.add((pl['name'] as String, (pl['floors'] as List).isNotEmpty ? '${(pl['floors'] as List).length} floor${(pl['floors'] as List).length > 1 ? 's' : ''}' : 'Building', '/map/place/$id')));
      d.offices.forEach((id, o) => results.add((o['name'] as String, d.where(o as Map), '/map/place/${o['place']}?office=$id')));
      d.places.forEach((pid, pl) => (pl['rooms'] as Map? ?? {}).forEach((k, r) { if (r['floor'] != null && r['kind'] != 'facility') results.add(((r['name'] ?? k) as String, '${pl['name']} · Floor ${r['floor']}${r['confirmed'] == true && r['rect'] != null ? '' : ' · location to confirm'}', '/map/place/$pid?room=${enc(k as String)}')); }));
    }
    final hits = results.where((r) => r.$1.toLowerCase().contains(q) || r.$1.toLowerCase().replaceAll(' ', '').contains(q.replaceAll(' ', ''))).take(14).toList();
    return _MapFrame(map: CampusMap(startPt: _startPt(s), startShape: s.start?.shape, onTapShape: (n) => _tapShape(context, n)),
      top: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (!s.signed) ...[Row(children: [backPill(context, 'Welcome', to: '/login'), const Spacer(), Btn('Sign in', small: true, onTap: () => context.go('/google'))]), const SizedBox(height: 8)],
        Material(elevation: 6, shadowColor: const Color(0x3C3C2800), borderRadius: BorderRadius.circular(16), child: TextField(controller: tc, autofocus: widget.focus, textInputAction: TextInputAction.search,
          onSubmitted: (v) => context.replace('/map?q=${enc(v)}'), decoration: fieldDeco('Search buildings, rooms, offices', prefix: const Icon(Ic.search, color: C.navy2)).copyWith(enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none)))),
        if (q.isNotEmpty) ...[const SizedBox(height: 8), ConstrainedBox(constraints: const BoxConstraints(maxHeight: 460), child: SingleChildScrollView(child: ListBox(hits.isEmpty
          ? [Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('No place called “${widget.q}” yet', style: T.h3), const Text('Try a building name, a room like QH 1, or an office like Registrar.', style: T.small)]))]
          : [for (final h in hits) Row2(title: h.$1, sub: h.$2, to: h.$3)])))],
      ]),
      sheet: q.isNotEmpty ? null : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Explore campus', style: T.h2), const SizedBox(height: 4), const Text('Tap a building, or search for a room or office.', style: T.small), const SizedBox(height: 12),
        Wrap(spacing: 8, children: [Pill('Quezon Hall', kind: PK.navy, onTap: () => context.push('/map/place/quezon-hall')), Pill('CICT Building', onTap: () => context.push('/map/place/cict-building')), Pill('Administration', onTap: () => context.push('/map/place/administration'))])]),
    );
  }
}

/* ---------- 20 / 21 / 28 place ---------- */
class PlaceScreen extends StatelessWidget {
  const PlaceScreen({super.key, required this.id, required this.qp}); final String id; final Map<String, String> qp;
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data, pl = d.places[id] as Map?;
    if (pl == null) return const MapHomeScreen();
    final room = qp['room'], oid = qp['office'], office = oid == null ? null : d.offices[oid] as Map?, from = qp['from'];
    final fromRoute = from == 'route', fromProcess = from == 'process' && qp['pid'] != null, fromOffice = from == 'office' && office != null, fromStops = from == 'stops' && qp['pid'] != null;
    final route = d.routeFor(s.start?.id, id);
    final backTo = fromStops ? '/map/stops?pid=${qp['pid']}' : fromProcess ? '/directory/process/${qp['pid']}?step=${qp['step'] ?? 0}' : fromOffice ? '/directory/office/$oid' : fromRoute ? _routeHref({'from': 'cict-building', 'to': id}, 'done') : null;
    final backLabel = fromStops ? 'All stops' : fromProcess ? 'Back to ${d.processes[qp['pid']]['short']} steps' : fromOffice ? office['name'] as String : fromRoute ? 'Route' : from == 'class' ? 'Class' : from == 'ask' ? 'Answer' : 'Map';
    final floors = (pl['floors'] as List).cast<int>(), shape = pl['shape'] as String?;
    final map = CampusMap(focus: shape, sel: shape, startPt: _startPt(s), startShape: s.start?.shape, entrance: pl['entrance'] == 'approximate' && id == 'quezon-hall' ? Offset((d.campus['points']['qhEntrance'][0] as num).toDouble(), (d.campus['points']['qhEntrance'][1] as num).toDouble()) : null, onTapShape: (n) => _tapShape(context, n));
    final top = Row(children: [backPill(context, backLabel, to: backTo)]);

    if (room == null && office == null && qp['floor'] == null) {
      final plans = pl['plans'] != null, bps = (pl['blueprints'] as List? ?? []);
      final planHref = plans ? (id == 'quezon-hall' ? '/map/place/$id?floor=1&room=QH%201' : '/map/place/$id?floor=${floors.first}') : bps.isNotEmpty || shape != null ? '/map/blueprint/$id' : null;
      final offices = d.offices.values.where((o) => o['place'] == id).length;
      return _MapFrame(map: map, top: top, sheetMax: .78, sheet: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (pl['photo'] != null) ...[ClipRRect(borderRadius: BorderRadius.circular(18), child: AspectRatio(aspectRatio: 16 / 8, child: Image.asset(asset(pl['photo']['src'] as String), fit: BoxFit.cover))), const SizedBox(height: 12)],
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('BUILDING', style: T.label), Text(pl['name'] as String, style: T.h1(26)), const SizedBox(height: 3),
          Text((pl['about'] ?? (offices > 0 ? '$offices offices' : pl['note'] ?? 'No details recorded yet.')) as String, maxLines: 2, overflow: TextOverflow.ellipsis, style: T.small)])), const Pill('Selected', kind: PK.gold, leading: Needle(size: 16))]),
        if (s.start != null) ...[const SizedBox(height: 12), route != null
          ? Material(color: C.blueSoft, borderRadius: BorderRadius.circular(14), child: InkWell(borderRadius: BorderRadius.circular(14), onTap: () => context.push(_routeHref(route)), child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [
              Container(width: 12, height: 12, decoration: const BoxDecoration(color: C.blue, shape: BoxShape.circle)), const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('From ${_startText(s)}', style: const TextStyle(fontWeight: FontWeight.w700, color: C.navy)), const Text('Route preview ready', style: T.small)])), const Icon(Ic.chev, color: C.navy2)]))))
          : rich('**From ${_startText(s)}.** Walkway not surveyed${pl['entrance'] == 'approximate' ? ' · head for the approximate entrance' : ''}.', style: T.small)],
        const SizedBox(height: 14),
        Row(children: [Expanded(child: Btn('Directions', icon: Ic.route, to: '/map/start?for=$id')), const SizedBox(width: 10),
          Expanded(child: planHref != null ? Btn(plans || bps.isNotEmpty ? 'View floor plan' : 'View outline', kind: BK.outline, to: planHref) : const Btn('No floor plan yet', kind: BK.outline))]),
      ]));
    }

    final r0 = room != null ? (pl['rooms'] as Map)[room] as Map? : null, r = room != null ? d.roomOf(pl, room) : office?['room'] != null ? d.roomOf(pl, office!['room'] as String) : null;
    final hlName = room ?? (office != null ? (office['short'] ?? office['name']) as String : '');
    final floor = int.tryParse(qp['floor'] ?? '') ?? (r?['floor'] as int? ?? r0?['floor'] as int? ?? (office?['floor'] as int?) ?? (floors.isNotEmpty ? floors.first : 0));
    final sel = r == null || r['floor'] != floor ? qp['sel'] : null, selR = sel != null ? d.roomOf(pl, sel) : null;
    final hlR = r != null && r['floor'] == floor ? r : selR != null && selR['floor'] == floor ? selR : null, isDest = r != null && hlR == r;
    final keep = '${room != null ? '&room=${enc(room)}' : ''}${oid != null ? '&office=$oid' : ''}${fromRoute ? '&from=route' : ''}';
    final plan = (pl['plans'] as Map?)?['$floor'] as Map?, unconfirmed = room != null && r == null, picked = qp['pick'] == '1';
    final hereCard = !fromRoute && s.start == null && id != 'cict-building' && d.routeFor('cict-building', id) != null && (fromProcess || fromStops || fromOffice || office != null || id == 'administration');
    final onFloor = (pl['rooms'] as Map).entries.where((e) => e.value['floor'] == floor).map((e) => MapEntry(e.key as String, e.value as Map)).toList();
    final ok = onFloor.where((e) => e.value['confirmed'] == true && e.value['rect'] != null).toList(), todo = onFloor.where((e) => !(e.value['confirmed'] == true && e.value['rect'] != null)).toList();
    String label(String? k) => k == null ? '' : ((pl['rooms'] as Map)[k]?['name'] ?? k) as String;
    void go(String to) => context.replace(to);
    final base = '/map/place/$id?floor=$floor$keep';
    return _MapFrame(map: map, top: top, sheetMax: s.signed ? .66 : .72, sheet: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(office != null ? 'OFFICE' : room != null ? (pl['name'] as String).toUpperCase() : 'BUILDING', style: T.label), const SizedBox(height: 4),
        Text.rich(TextSpan(text: room ?? (office?['name'] ?? pl['name']) as String, style: room != null ? T.room() : T.h1(26), children: [if (office != null) TextSpan(text: ' · ${office['floor'] != null ? 'Floor ${office['floor']}' : 'floor not confirmed'}', style: const TextStyle(fontSize: 18, color: C.muted, fontWeight: FontWeight.w600))])),
        const SizedBox(height: 4),
        unconfirmed ? Row(children: [const Icon(Ic.check, size: 18, color: C.ok), const SizedBox(width: 6), Text('${pl['name']} · confirmed', style: const TextStyle(fontWeight: FontWeight.w700, color: C.ok))])
          : Text(room != null ? 'Floor ${r!['floor']}${(r['where'] as String? ?? '').contains(',') ? ' · ${(r['where'] as String).replaceFirst(RegExp(r'^Floor \d+, '), '')}' : ' · ${pl['name']}'}' : office != null ? pl['name'] as String : (pl['about'] ?? 'No details recorded yet.') as String, style: T.small),
      ])), if (room != null || office != null) const Pill('Destination', kind: PK.gold, leading: Needle(size: 16))]),
      if (unconfirmed) ...[const SizedBox(height: 12), NoteBox(Text(r0?['floor'] != null ? '$room is on Floor ${r0!['floor']} of ${pl['name']}. Its outline on the plan still needs confirming, so it isn’t highlighted.${pl['plans'] != null ? ' Browse the floors below.' : ''}' : '$room is in ${pl['name']}. Its floor hasn’t been confirmed.'), kind: NK.warn)],
      if ((!unconfirmed || pl['plans'] != null) && floors.length > 1) ...[const SizedBox(height: 12), Seg([for (final f in floors) 'Floor $f'], selected: floors.indexOf(floor), onTap: (i) => go('/map/place/$id?floor=${floors[i]}$keep'))],
      if (!unconfirmed && r != null && r['floor'] != floor) ...[const SizedBox(height: 12), Container(padding: const EdgeInsets.fromLTRB(12, 8, 8, 8), decoration: BoxDecoration(color: C.goldSoft, borderRadius: BorderRadius.circular(14), border: Border.all(color: C.goldLine)),
        child: Row(children: [Expanded(child: rich('**$hlName** is on Floor ${r['floor']}', style: T.small)), Btn('Return to Floor ${r['floor']}', small: true, icon: Ic.back, onTap: () => go('/map/place/$id?floor=${r['floor']}$keep'))]))],
      const SizedBox(height: 12),
      if (!(unconfirmed && pl['plans'] == null)) ...[
        if (plan != null) ...[
          FloorPlan(plan: plan, rooms: ok, hl: hlR, hlLabel: isDest ? hlName : label(sel), picked: picked, onTapRoom: (k) => go('$base&sel=${enc(k)}'), onTapHl: () => go(isDest ? '$base&pick=1' : '$base&sel=${enc(sel ?? '')}')),
          const SizedBox(height: 8),
          Row(children: [Expanded(child: rich(hlR != null ? (isDest ? (picked ? '**$hlName** · Floor $floor' : '**$hlName** is outlined in gold · checked on the floor plan') : '**${label(sel)}** · Floor $floor. Tap another room, or pick a floor.') : 'Floor $floor plan · tap a room to highlight it', style: T.small)),
            Btn('Enlarge', kind: BK.ghost, small: true, icon: Ic.plus, to: '/map/floor/$id?floor=$floor$keep${sel != null ? '&sel=${enc(sel)}' : ''}')]),
          const SizedBox(height: 8),
          Theme(data: Theme.of(context).copyWith(dividerColor: Colors.transparent), child: Container(decoration: cardDeco(r: 14), child: ExpansionTile(title: Text('Rooms on Floor $floor (${ok.length}${todo.isNotEmpty ? ' · ${todo.length} to confirm' : ''})', style: T.h3.copyWith(fontSize: 15)),
            childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12), children: [Wrap(spacing: 6, runSpacing: 6, children: [
              for (final e in ok) ChoiceChip(label: Text(label(e.key)), selected: e.value == hlR, onSelected: (_) => go('$base&sel=${enc(e.key)}'), selectedColor: C.goldSoft),
              for (final e in todo) Chip(label: Text('${label(e.key)} · to confirm', style: const TextStyle(color: C.muted))),
            ])]))),
        ] else if ((pl['blueprints'] as List? ?? []).isNotEmpty) CardBox(pad: const EdgeInsets.all(12), onTap: () => context.push('/map/blueprint/$id${oid != null ? '?office=$oid' : ''}'), child: Row(children: [
          ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.asset(asset(pl['blueprints'][0]['src'] as String), width: 64, height: 48, fit: BoxFit.cover)), const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Building blueprint', style: T.h3), Text('${office != null ? '${office['name']}: ${office['floor'] != null ? 'Floor ${office['floor']}' : 'floor not confirmed'}. ' : ''}${(pl['blueprints'] as List).length} sheet${(pl['blueprints'] as List).length > 1 ? 's' : ''}', style: T.small)])), const Icon(Ic.chev, color: C.navy2)]))
        else if (floors.isNotEmpty) Container(padding: const EdgeInsets.all(14), decoration: cardDeco(color: C.sand, border: C.line2), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Floor plan not published yet', style: T.h3), Text(office != null ? (office['floor'] != null ? '${office['name']} is on Floor ${office['floor']}.' : '${office['name']} is in ${pl['name']}. Its floor isn’t confirmed yet.') : 'Rooms will appear here once the plan is checked.', style: T.small)])),
      ],
      if (office != null) ...[const SizedBox(height: 12), ListBox([for (final e in d.offices.entries.where((e) => e.value['place'] == id && (e.value['floor'] == floor || e.value['floor'] == null))) Row2(title: e.value['name'] as String, minH: 52, to: '/directory/office/${e.key}', trailing: e.key == oid ? const Pill('Here', kind: PK.gold) : null)])],
      if (hereCard) ...[const SizedBox(height: 12), CardBox(color: C.blueSoft, border: const Color(0x292E6FB8), pad: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [Container(width: 12, height: 12, decoration: const BoxDecoration(color: C.blue, shape: BoxShape.circle)), const SizedBox(width: 10), const Expanded(child: Text('You are here in CICT. Find your route.', style: TextStyle(fontWeight: FontWeight.w700, color: C.navy)))]),
        const SizedBox(height: 12), Btn('Find your route', icon: Ic.route, wide: true, to: '/map/route?from=cict-building&to=$id${oid != null ? '&office=$oid' : ''}')]))],
      if (!(fromRoute || hereCard) && (room != null || id == 'quezon-hall' || office != null)) ...[const SizedBox(height: 12), CardBox(pad: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [const Icon(Ic.target, color: C.blue), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('STARTING FROM', style: T.label), Text(_startText(s), style: T.h3)])),
          Btn(s.start != null ? 'Change' : 'Choose', kind: BK.outline, small: true, to: '/map/start?for=$id${room != null ? '&room=${enc(room)}' : ''}${oid != null ? '&office=$oid' : ''}')]),
        if (s.start != null && s.start!.id == id) ...[const SizedBox(height: 10), Text('You’re starting at ${pl['name']}.', style: T.small)]
        else if (s.start != null) ...[const SizedBox(height: 12), route != null ? Btn('Show route from ${_startText(s)}', icon: Ic.route, wide: true, to: _routeHref(route))
          : NoteBox(rich('**Walkway not surveyed.** We can’t draw a walking route yet. ${pl['entrance'] == 'approximate' ? 'Head for the approximate entrance shown on the map.' : 'Head for ${pl['name']}.'}', style: const TextStyle(fontSize: 14.5, color: C.body)), kind: NK.sand)],
      ]))],
    ]));
  }
}

/* ---------- 21B full-screen floor plan ---------- */
class FloorViewScreen extends StatelessWidget {
  const FloorViewScreen({super.key, required this.id, required this.qp}); final String id; final Map<String, String> qp;
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data, pl = d.places[id] as Map;
    final room = qp['room'], oid = qp['office'], office = oid == null ? null : d.offices[oid] as Map?, floors = (pl['floors'] as List).cast<int>();
    final r0 = room != null ? (pl['rooms'] as Map)[room] as Map? : null, r = room != null ? d.roomOf(pl, room) : office?['room'] != null ? d.roomOf(pl, office!['room'] as String) : null;
    final hlName = room != null ? (r0?['name'] ?? room) as String : office != null ? (office['short'] ?? office['name']) as String : '';
    final floor = int.tryParse(qp['floor'] ?? '') ?? (r?['floor'] as int? ?? r0?['floor'] as int? ?? floors.first), plan = (pl['plans'] as Map)['$floor'] as Map;
    final keep = '${room != null ? '&room=${enc(room)}' : ''}${oid != null ? '&office=$oid' : ''}';
    final sel = r == null || r['floor'] != floor ? qp['sel'] : null, selR = sel != null ? d.roomOf(pl, sel) : null;
    final hlR = r != null && r['floor'] == floor ? r : selR != null && selR['floor'] == floor ? selR : null, isDest = r != null && hlR == r;
    final ok = (pl['rooms'] as Map).entries.where((e) => e.value['floor'] == floor && e.value['confirmed'] == true && e.value['rect'] != null).map((e) => MapEntry(e.key as String, e.value as Map)).toList();
    final base = '/map/floor/$id?floor=$floor$keep';
    return Screen(tab: s.signed ? Tab4.map : null, child: Column(children: [TopBar(title: 'Floor $floor', backLabel: pl['name'] as String, back: '/map/place/$id?floor=$floor$keep&settled=1'),
      Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 20), children: [
        if (floors.length > 1) ...[Seg([for (final f in floors) 'Floor $f'], selected: floors.indexOf(floor), onTap: (i) => context.replace('/map/floor/$id?floor=${floors[i]}$keep')), const SizedBox(height: 12)],
        Container(height: 360, decoration: cardDeco(r: 14), clipBehavior: Clip.antiAlias, child: InteractiveViewer(minScale: 1, maxScale: 4, constrained: false, boundaryMargin: const EdgeInsets.all(40),
          child: SizedBox(width: 360 * (plan['w'] as num) / (plan['h'] as num), height: 360, child: FloorPlan(plan: plan, rooms: ok, hl: hlR, hlLabel: isDest ? hlName : sel, picked: qp['pick'] == '1',
            onTapRoom: (k) => context.replace('$base&sel=${enc(k)}'), onTapHl: () => context.replace(isDest ? '$base&pick=1' : base))))),
        const SizedBox(height: 10), const Text('Pinch or drag to zoom and move the plan.', style: T.small), const SizedBox(height: 6),
        rich(hlR != null ? (isDest ? '**$hlName** is outlined in gold · checked on the floor plan' : '**${(pl['rooms'] as Map)[sel]?['name'] ?? sel}** · Floor $floor') : 'Floor $floor plan · tap a room to highlight it', style: T.small),
      ]))]));
  }
}

/* ---------- 26E–26G blueprint, or the traced outline ---------- */
const _mPerUnit = 110600 / 70245.1;
class BlueprintScreen extends StatelessWidget {
  const BlueprintScreen({super.key, required this.id, required this.qp}); final String id; final Map<String, String> qp;
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data, pl = d.places[id] as Map, bps = pl['blueprints'] as List? ?? [], off = qp['office'] != null ? d.offices[qp['office']] as Map? : null;
    final back = off != null ? '/map/place/$id?office=${qp['office']}&settled=1' : '/map/place/$id?settled=1';
    final head = Row(children: [pl['photo'] != null ? ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.asset(asset(pl['photo']['src'] as String), width: 48, height: 48, fit: BoxFit.cover)) : Silhouette(pl['shape'] as String?, size: 48), const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(pl['name'] as String, style: T.h2), Text(bps.isEmpty ? 'No floor plan yet · outline from the campus map' : off != null ? '${off['name']} · ${off['floor'] != null ? 'Floor ${off['floor']}' : 'floor not confirmed'}' : '${bps.length} sheet${bps.length > 1 ? 's' : ''} from the team’s blueprints', style: T.small)]))]);
    final i = (int.tryParse(qp['i'] ?? '') ?? 0).clamp(0, math.max(0, bps.length - 1)).toInt();
    return Screen(tab: s.signed ? Tab4.map : null, child: Column(children: [TopBar(title: 'Floor plan', backLabel: off != null ? (off['short'] ?? off['name']) as String : pl['name'] as String, back: back),
      Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 20), children: [head, const SizedBox(height: 12),
        if (bps.isNotEmpty) ...[
          if (bps.length > 1) ...[Seg([for (var k = 0; k < bps.length; k++) (bps[k]['label'] ?? 'Sheet ${k + 1}') as String], selected: i, onTap: (k) => context.replace('/map/blueprint/$id?i=$k')), const SizedBox(height: 12)],
          Container(decoration: cardDeco(r: 14), clipBehavior: Clip.antiAlias, child: InteractiveViewer(maxScale: 4, child: Image.asset(asset(bps[i]['src'] as String)))),
          const SizedBox(height: 10), Text('Blueprint from the team’s records. Room positions on it haven’t been checked yet${(pl['rooms'] as Map?)?['QH 1'] != null ? ', except QH 1' : ''}.', style: T.small),
        ] else _Outline(pl: pl, back: back),
      ]))]));
  }
}
class _Outline extends StatelessWidget {
  const _Outline({required this.pl, required this.back}); final Map pl; final String back;
  @override
  Widget build(BuildContext context) {
    final sh = context.d.shapeBy(pl['shape'] as String?);
    if (sh == null) return Container(padding: const EdgeInsets.all(14), decoration: cardDeco(color: C.sand), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Not on the campus map yet', style: T.h3), Text((pl['note'] ?? 'This building has no outline or floor plan yet.') as String, style: T.small)]));
    final b = sh.path.getBounds(), pts = sh.pts;
    var area = 0.0; for (var k = 0; k < pts.length; k++) { final p = pts[k], q = pts[(k + 1) % pts.length]; area += p.dx * q.dy - q.dx * p.dy; }
    area = area.abs() / 2 * _mPerUnit * _mPerUnit;
    Widget fact(String l, String v) => Expanded(child: Container(padding: const EdgeInsets.all(12), decoration: cardDeco(r: 14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(l, style: T.label), Text(v, style: T.h3)])));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(height: 300, decoration: cardDeco(), child: CustomPaint(painter: _OutlineP(sh))), const SizedBox(height: 12),
      Row(children: [fact('Footprint', '≈ ${area.round()} m²'), const SizedBox(width: 8), fact('Size', '≈ ${(b.width * _mPerUnit).round()} × ${(b.height * _mPerUnit).round()} m'), const SizedBox(width: 8), fact('Corners', '${pts.length - 1}')]),
      const SizedBox(height: 12), Btn('Show on map', kind: BK.outline, icon: Ic.map, wide: true, onTap: () => context.go(back)), const SizedBox(height: 10),
      Text('Outline traced from the team’s MapTiler campus map. Sizes are approximate (±2 m). ${pl['note'] ?? 'Floors and rooms will appear here once a blueprint is added.'}', style: T.small),
    ]);
  }
}
class _OutlineP extends CustomPainter {
  _OutlineP(this.sh); final CampusShape sh;
  @override
  void paint(Canvas c, Size size) {
    final b = sh.path.getBounds(), pad = math.max(b.width, b.height) * .22, span = Rect.fromLTRB(b.left - pad, b.top - pad, b.right + pad, b.bottom + pad);
    final k = math.min(size.width / span.width, size.height / span.height);
    c.translate(size.width / 2, size.height / 2); c.scale(k); c.translate(-span.center.dx, -span.center.dy);
    final grid = Paint()..color = C.line..strokeWidth = .6 / k * 1.5;
    for (var gx = (span.left / 10).ceil() * 10.0; gx < span.right; gx += 10) { c.drawLine(Offset(gx, span.top), Offset(gx, span.bottom), grid); }
    for (var gy = (span.top / 10).ceil() * 10.0; gy < span.bottom; gy += 10) { c.drawLine(Offset(span.left, gy), Offset(span.right, gy), grid); }
    c.drawPath(sh.path, Paint()..color = C.goldSoft); c.drawPath(sh.path, Paint()..color = C.navy..style = PaintingStyle.stroke..strokeWidth = 2.2 / k..strokeJoin = StrokeJoin.round);
    for (final p in sh.pts) { c.drawCircle(p, 2.6 / k, Paint()..color = C.navy); }
  }
  @override bool shouldRepaint(_) => false;
}

/* ---------- 23 start picker ---------- */
class StartScreen extends StatefulWidget { const StartScreen({super.key, required this.qp}); final Map<String, String> qp; @override State<StartScreen> createState() => _StartState(); }
class _StartState extends State<StartScreen> {
  late bool open = widget.qp['places'] == '1' || context.wfr.start?.kind == 'named';
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data, forId = widget.qp['for'] ?? 'quezon-hall', pl = d.places[forId] as Map, room = widget.qp['room'], oid = widget.qp['office'];
    final ret = '/map/place/$forId?settled=1${room != null ? '&room=${enc(room)}' : ''}${oid != null ? '&office=$oid' : ''}';
    void pick(Start st, [String? toast]) { s.update(() { s.start = st; if (toast != null) s.toast = toast; }); final r = st.kind == 'named' ? d.routeFor(st.id, forId) : null; context.replace(r != null ? _routeHref(r) : ret); }
    return Screen(tab: s.signed ? Tab4.map : null, child: Stack(children: [
      Positioned.fill(child: CampusMap(focus: pl['shape'] as String?, sel: pl['shape'] as String?, startPt: _startPt(s), startShape: s.start?.shape)),
      Positioned.fill(child: GestureDetector(onTap: () => context.replace(ret), child: const ColoredBox(color: Color(0x6B131728)))),
      Positioned(left: 0, right: 0, bottom: 0, child: Container(constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * .8), padding: const EdgeInsets.fromLTRB(20, 10, 20, 24), decoration: const BoxDecoration(color: C.cream, borderRadius: BorderRadius.vertical(top: Radius.circular(26))),
        child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [const Grab(),
          Row(children: [const Expanded(child: Text('Directions', style: T.h2)), IconBtn(Ic.close, label: 'Close', onTap: () => context.replace(ret))]), const SizedBox(height: 10),
          Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10), decoration: BoxDecoration(color: C.goldSoft, borderRadius: BorderRadius.circular(14), border: Border.all(color: C.goldLine)), child: Row(children: [
            const Needle(), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('TO', style: T.label), Text(room != null ? '$room · ${pl['name']}' : pl['name'] as String, style: T.h3)])), const Pill('Destination', kind: PK.gold)])),
          const SizedBox(height: 14), const Text('WHERE ARE YOU STARTING?', style: T.label), const SizedBox(height: 8),
          ListBox([
            Row2(title: 'Use my location', sub: 'Uses your phone’s GPS once', leading: const Icon(Ic.gps, color: C.blue), trailing: const SizedBox(), onTap: () => pick(Start('gps', 'Your location', pt: const Offset(196, 300)), 'Using your location · ±18 m')),
            Row2(title: 'Choose a campus place', sub: s.start?.kind == 'named' ? 'Now: ${s.start!.label}' : 'CICT Building, Main Gate, Library…', leading: const Icon(Ic.flag, color: C.navy2), trailing: AnimatedRotation(turns: open ? .5 : 0, duration: const Duration(milliseconds: 200), child: const Icon(Ic.caret, color: C.navy2)), onTap: () => setState(() => open = !open)),
            if (open) Container(color: const Color(0xFFFFFDF8), child: Column(children: [for (final st in d.starts) Padding(padding: const EdgeInsets.only(left: 36), child: Row2(title: st['label'] as String, minH: 52, sub: d.routeFor(st['id'] as String, forId) != null ? 'Route preview available' : null,
              trailing: s.start?.id == st['id'] ? const Pill('Current', kind: PK.ok, icon: Ic.check) : null, onTap: () => pick(Start('named', st['label'] as String, id: st['id'] as String, shape: st['shape'] as String?, pt: st['pt'] == null ? null : Offset((st['pt'][0] as num).toDouble(), (st['pt'][1] as num).toDouble())))))])),
            Row2(title: 'Pick on map', sub: 'Drop a pin where you are', leading: const Icon(Ic.pin, color: C.navy2), to: '/map/pin?for=$forId${room != null ? '&room=${enc(room)}' : ''}'),
          ]),
        ])))),
    ]));
  }
}

/* ---------- 24 pick a point ---------- */
class PinScreen extends StatelessWidget {
  const PinScreen({super.key, required this.qp}); final Map<String, String> qp;
  @override
  Widget build(BuildContext context) {
    final s = context.wf, forId = qp['for'] ?? 'quezon-hall', ret = '/map/place/$forId?settled=1${qp['room'] != null ? '&room=${enc(qp['room']!)}' : ''}';
    return _MapFrame(map: CampusMap(pin: s.pinPt, sel: s.data.places[forId]['shape'] as String?, noNeedle: true, onTapMap: (p) => s.update(() => s.pinPt = p)),
      top: Row(children: [backPill(context, 'Cancel', to: ret)]),
      sheet: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Text(s.pinPt != null ? 'Is this where you are?' : 'Tap where you are', style: T.h2), const SizedBox(height: 4),
        Text(s.pinPt != null ? 'Tap again to move the pin.' : 'Tap the map to drop a pin.', style: T.small), const SizedBox(height: 14),
        Btn('Use this point', wide: true, onTap: s.pinPt == null ? null : () { s.update(() { s.start = Start('pin', 'Point on the map', pt: s.pinPt); s.toast = 'Starting from your pin'; }); context.replace(ret); })]));
  }
}

/* ---------- 25A–25E route walk ---------- */
class RouteScreen extends StatefulWidget { const RouteScreen({super.key, required this.qp}); final Map<String, String> qp; @override State<RouteScreen> createState() => _RouteState(); }
class _RouteState extends State<RouteScreen> with SingleTickerProviderStateMixin {
  late final Map r; late final List<Offset> pts; late final List<double> seg, cum; late final AnimationController a;
  String state = 'idle'; Offset pan = Offset.zero;
  @override
  void initState() {
    super.initState();
    final d = context.d; r = d.routeFor(widget.qp['from'], widget.qp['to']) ?? d.routes['cict-building>quezon-hall'] as Map;
    pts = [for (final q in r['pts'] as List) Offset((q[0] as num).toDouble(), (q[1] as num).toDouble())];
    seg = [for (var i = 0; i < pts.length - 1; i++) (pts[i + 1] - pts[i]).distance]; cum = [0]; for (final x in seg) { cum.add(cum.last + x); }
    a = AnimationController(vsync: this, duration: Duration(milliseconds: 400 + (cum.last * 23).round()))..addStatusListener((st) { if (st == AnimationStatus.completed) setState(() => state = 'done'); });
    if (widget.qp['walk'] == 'done') { state = 'done'; a.value = 1; }
    final st0 = d.starts.where((x) => x['id'] == r['from']).firstOrNull;
    if (st0 != null) { final s = context.wfr; s.start = Start('named', st0['label'] as String, id: st0['id'] as String, shape: st0['shape'] as String?, pt: st0['pt'] == null ? null : Offset((st0['pt'][0] as num).toDouble(), (st0['pt'][1] as num).toDouble())); }
  }
  @override void dispose() { a.dispose(); super.dispose(); }
  double get drawn => state == 'idle' ? cum.last : Curves.easeInOut.transform(a.value) * cum.last;
  int get passed { var i = 0; while (i < seg.length - 1 && drawn > cum[i + 1]) { i++; } return i; }
  String status() {
    final turns = seg.length - 1, p = passed, to = context.d.places[r['to']] as Map;
    if (state == 'idle') return 'Walking route from the team’s sketch · prototype data';
    if (state == 'done' || a.value >= 1) { final rm = r['room'] != null ? (to['rooms'] as Map)[r['room']] : null; return 'You’re at the ${r['toLabel']}.${r['room'] != null ? ' ${r['room']} is on Floor ${rm?['floor'] ?? 1}.' : r['note'] != null ? ' ${r['note']}' : ''}'; }
    if (a.value < .03) return 'Leaving ${r['fromLabel']}';
    if (r['zigzag'] == true && p < 2) return 'Zigzag out of CICT · turn ${p + 1} of $turns';
    return p < turns ? 'Turn ${p + 1} of $turns ahead' : 'Last stretch to the ${r['toLabel']}';
  }
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data, from = d.places[r['from']] as Map, to = d.places[r['to']] as Map, room = widget.qp['room'], oid = widget.qp['office'];
    final rOff = oid != null && d.offices[oid]?['place'] == r['to'] ? d.offices[oid] as Map : null;
    Widget arrival() {
      final rr = r['room'] != null ? (to['rooms'] as Map)[r['room']] as Map? : null;
      if (rOff != null) return Btn('Open Floor ${rOff['floor'] ?? 1}', to: '/map/place/${r['to']}?office=$oid&from=route');
      if (to['plans'] != null) { final f = rr?['floor'] ?? (to['floors'] as List).first; return Btn('Open Floor $f', to: '/map/place/${r['to']}?floor=$f${r['room'] != null ? '&room=${enc(r['room'] as String)}' : ''}&from=route'); }
      return Btn('View building', to: '/map/place/${r['to']}?settled=1&from=route');
    }
    return Screen(tab: s.signed ? Tab4.map : null, child: LayoutBuilder(builder: (_, c) {
      const sheetH = 214.0, topH = 70.0;
      final size = Size(c.maxWidth, c.maxHeight), f = fitPoints(pts, Size(size.width, size.height - sheetH - topH), const EdgeInsets.fromLTRB(70, 40, 44, 46));
      final vb = Rect.fromLTWH(f.o.dx - pan.dx / f.k, f.o.dy - topH / f.k - pan.dy / f.k, size.width / f.k, size.height / f.k);
      return Stack(children: [
        Positioned.fill(child: GestureDetector(onPanUpdate: state == 'play' ? null : (e) => setState(() => pan += e.delta), child: AnimatedBuilder(animation: a, builder: (_, __) => CampusMap(vb: vb, cover: false, sel: to['shape'] as String?, startShape: from['shape'] as String?, hide: [from['shape'] as String, to['shape'] as String], noNeedle: true,
          extra: (cv, k) => _paintRoute(cv, k))))),
        Positioned(left: 12, right: 12, top: 12, child: Row(children: [backPill(context, to['name'] as String, to: '/map/place/${r['to']}?settled=1'), const Spacer(),
          Container(height: 40, padding: const EdgeInsets.symmetric(horizontal: 12), decoration: BoxDecoration(color: C.goldSoft, borderRadius: BorderRadius.circular(20), border: Border.all(color: C.goldLine)),
            child: Row(children: [const Needle(size: 16), const SizedBox(width: 6), rich('To **${room ?? (rOff != null ? (rOff['short'] ?? rOff['name']) : to['name'])}**${room != null ? ', ${to['name']}' : ''}', style: const TextStyle(fontSize: 14, color: C.navy), bold: const TextStyle(fontWeight: FontWeight.w700))]))])),
        if (pan != Offset.zero) Positioned(right: 12, bottom: sheetH + 12, child: Material(color: C.cream, shape: const CircleBorder(), elevation: 4, child: IconBtn(Ic.target, label: 'Show the whole route', onTap: () => setState(() => pan = Offset.zero)))),
        Positioned(left: 0, right: 0, bottom: 0, child: Container(padding: const EdgeInsets.fromLTRB(18, 8, 18, 14), decoration: const BoxDecoration(color: C.cream, borderRadius: BorderRadius.vertical(top: Radius.circular(26)), boxShadow: [BoxShadow(color: Color(0x293C2800), blurRadius: 30, offset: Offset(0, -10))]),
          child: AnimatedBuilder(animation: a, builder: (_, __) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [const Grab(),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(flex: 4, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('FROM', style: T.label), Row(children: [Container(width: 12, height: 12, decoration: const BoxDecoration(color: C.blue, shape: BoxShape.circle)), const SizedBox(width: 7), Flexible(child: Text(r['fromLabel'] as String, style: T.h3.copyWith(fontSize: 15.5)))])])),
              const Padding(padding: EdgeInsets.only(top: 20, left: 6, right: 6), child: Icon(Ic.arrow, size: 20, color: C.muted)),
              Expanded(flex: 5, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('TO', style: T.label), Row(children: [Container(width: 12, height: 12, decoration: BoxDecoration(color: C.gold, shape: BoxShape.circle, border: Border.all(color: C.navy, width: 2))), const SizedBox(width: 7), Flexible(child: Text(r['toLabel'] as String, style: T.h3.copyWith(fontSize: 15.5)))])])),
            ]),
            Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: SizedBox(height: 38, child: Text(status(), maxLines: 2, style: TextStyle(fontFamily: T.ui, fontSize: 14, height: 1.3, color: state == 'idle' ? C.body : C.navy, fontWeight: state == 'idle' ? FontWeight.w400 : FontWeight.w700)))),
            if (state == 'play') Btn('Skip to entrance', kind: BK.outline, wide: true, onTap: () { a.value = 1; setState(() => state = 'done'); })
            else Row(children: state == 'done'
              ? [Expanded(flex: 4, child: Btn('Replay', kind: BK.outline, icon: Ic.undo, onTap: () { setState(() => state = 'play'); a.forward(from: 0); })), const SizedBox(width: 10), Expanded(flex: 5, child: arrival())]
              : [Expanded(flex: 5, child: Btn('Preview walk', icon: Ic.route, onTap: () { setState(() { state = 'play'; pan = Offset.zero; }); a.forward(from: 0); })), const SizedBox(width: 10), Expanded(flex: 4, child: Btn('Change start', kind: BK.outline, to: '/map/start?for=${r['to']}'))]),
          ])))),
      ]);
    }));
  }
  void _paintRoute(Canvas c, double k) {
    final path = Path()..moveTo(pts[0].dx, pts[0].dy); for (final p in pts.skip(1)) { path.lineTo(p.dx, p.dy); }
    final m = path.computeMetrics().first, part = m.extractPath(0, drawn.clamp(.01, m.length));
    c.drawPath(part, Paint()..color = C.cream..style = PaintingStyle.stroke..strokeWidth = 9 / k..strokeCap = StrokeCap.round..strokeJoin = StrokeJoin.round);
    c.drawPath(part, Paint()..color = const Color(0xFF123A9C)..style = PaintingStyle.stroke..strokeWidth = 5 / k..strokeCap = StrokeCap.round..strokeJoin = StrokeJoin.round);
    final s0 = pts.first, e0 = pts.last;
    c.drawCircle(s0, 14 / k, Paint()..color = C.blue.withValues(alpha: .18)); c.drawCircle(s0, 7.5 / k, Paint()..color = C.blue); c.drawCircle(s0, 7.5 / k, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 3 / k);
    c.drawCircle(e0, 10.5 / k, Paint()..color = C.gold); c.drawCircle(e0, 10.5 / k, Paint()..color = C.navy..style = PaintingStyle.stroke..strokeWidth = 2.5 / k);
    c.drawRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: e0, width: 6 / k, height: 9 / k), Radius.circular(1 / k)), Paint()..color = C.navy);
    final along = state == 'idle' ? 27 / k : drawn.clamp(27 / k, m.length - 22 / k), tan = m.getTangentForOffset(along);
    if (tan != null) { c.save(); c.translate(tan.position.dx, tan.position.dy); c.rotate(-tan.angle); c.scale(.27 / k); arrowhead(c); c.restore(); }
    _label(c, k, s0, r['fromLabel'] as String, 'Start', below: true);
    _label(c, k, e0, (r['toShort'] ?? context.d.places[r['to']]['name']) as String, 'entrance', left: e0.dx > s0.dx);
  }
  void _label(Canvas c, double k, Offset at, String l1, String l2, {bool below = false, bool left = false}) {
    final t1 = TextPainter(text: TextSpan(text: l1, style: TextStyle(fontFamily: T.ui, fontSize: 12.5 / k, fontWeight: FontWeight.w700, color: C.navy)), textDirection: TextDirection.ltr)..layout();
    final t2 = TextPainter(text: TextSpan(text: l2, style: TextStyle(fontFamily: T.ui, fontSize: 11 / k, fontWeight: FontWeight.w600, color: C.muted)), textDirection: TextDirection.ltr)..layout();
    final w = math.max(t1.width, t2.width) + 18 / k, h = 36 / k, ox = below ? -w / 2 : left ? -w + 6 / k : -6 / k, oy = below ? 16 / k : -h - 16 / k;
    final rect = Rect.fromLTWH(at.dx + ox, at.dy + oy, w, h);
    c.drawRRect(RRect.fromRectAndRadius(rect, Radius.circular(8 / k)), Paint()..color = C.cream);
    c.drawRRect(RRect.fromRectAndRadius(rect, Radius.circular(8 / k)), Paint()..color = C.navy.withValues(alpha: .18)..style = PaintingStyle.stroke..strokeWidth = 1 / k);
    t1.paint(c, rect.topLeft + Offset(9 / k, 4 / k)); t2.paint(c, rect.topLeft + Offset(9 / k, 19 / k));
  }
}

/* ---------- 28D all stops of a process ---------- */
class StopsScreen extends StatelessWidget {
  const StopsScreen({super.key, required this.pid}); final String? pid;
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data, id = d.processes[pid] != null ? pid! : 'activity', pr = d.processes[id] as Map, stops = procStops(pr), done = s.procDone[id] ?? [], nextStep = nextOf(pr, done);
    final pts = [for (final stp in stops) Offset(d.shapeBy(d.places[stp.place]['shape'] as String)!.cx, d.shapeBy(d.places[stp.place]['shape'] as String)!.cy)];
    return Screen(tab: s.signed ? Tab4.map : null, child: LayoutBuilder(builder: (_, c) {
      const sheetH = 330.0; final f = fitPoints(pts, Size(c.maxWidth, c.maxHeight - sheetH - 70), const EdgeInsets.all(60)), k = math.min(f.k, 5.5);
      final vb = Rect.fromCenter(center: Offset((pts.map((p) => p.dx).reduce(math.min) + pts.map((p) => p.dx).reduce(math.max)) / 2, (pts.map((p) => p.dy).reduce(math.min) + pts.map((p) => p.dy).reduce(math.max)) / 2 + (sheetH - 70) / 2 / k), width: c.maxWidth / k, height: c.maxHeight / k);
      return Stack(children: [
        Positioned.fill(child: CampusMap(vb: vb, cover: false, noNeedle: true, hide: [for (final stp in stops) d.places[stp.place]['shape'] as String], stopShapes: [for (final stp in stops) d.places[stp.place]['shape'] as String], extra: (cv, kk) {
          for (var i = 1; i < pts.length; i++) { final p = Path()..moveTo(pts[i - 1].dx, pts[i - 1].dy)..lineTo(pts[i].dx, pts[i].dy); for (final m in p.computeMetrics()) { var x = 0.0; while (x < m.length) { cv.drawPath(m.extractPath(x, x + 7 / kk), Paint()..color = const Color(0xFF123A9C)..style = PaintingStyle.stroke..strokeWidth = 3 / kk..strokeCap = StrokeCap.round); x += 13 / kk; } } }
          for (var i = 0; i < pts.length; i++) { final st = stopState(stops[i], done, nextStep), fill = st == 'done' ? C.ok : st == 'now' ? C.gold : C.navy2;
            cv.drawCircle(pts[i], 19 / kk, Paint()..color = C.cream.withValues(alpha: .92)); cv.drawCircle(pts[i], 14 / kk, Paint()..color = fill); cv.drawCircle(pts[i], 14 / kk, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2.5 / kk);
            final tp = TextPainter(text: TextSpan(text: st == 'done' ? '✓' : '${i + 1}', style: TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w800, fontSize: 14 / kk, color: st == 'now' ? C.navy : Colors.white)), textDirection: TextDirection.ltr)..layout();
            tp.paint(cv, pts[i] - Offset(tp.width / 2, tp.height / 2)); }
        })),
        Positioned(left: 12, top: 12, child: backPill(context, 'Back to ${pr['short']} steps', to: '/directory/process/$id')),
        Positioned(left: 0, right: 0, bottom: 0, child: Container(constraints: const BoxConstraints(maxHeight: sheetH), padding: const EdgeInsets.fromLTRB(20, 10, 20, 16), decoration: const BoxDecoration(color: C.cream, borderRadius: BorderRadius.vertical(top: Radius.circular(26))),
          child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [const Grab(),
            Row(children: [const Expanded(child: Text('Buildings to walk to', style: T.h2)), Text('${done.length} of ${(pr['steps'] as List).length} steps done', style: T.small)]), const SizedBox(height: 10),
            ProgressBar(done.length, (pr['steps'] as List).length), const SizedBox(height: 10),
            for (var i = 0; i < stops.length; i++) _stopRow(context, stops[i], i, stopState(stops[i], done, nextStep), id),
            const SizedBox(height: 8), const Text('Dashed lines show the order of stops, not a surveyed walkway.', style: T.small),
          ])))),
      ]);
    }));
  }
}
Widget _stopRow(BuildContext context, ({String place, List<int> steps, List<String> offices}) stp, int i, String st, String pid) {
  final d = context.d, pl = d.places[stp.place] as Map;
  return InkWell(onTap: () => context.push('/map/place/${stp.place}?${stp.offices.isNotEmpty ? 'office=${stp.offices.first}&' : ''}from=stops&pid=$pid&settled=1'), child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(children: [
    Container(width: 30, height: 30, alignment: Alignment.center, decoration: BoxDecoration(shape: BoxShape.circle, color: st == 'done' ? C.ok : st == 'now' ? C.gold : Colors.white, border: Border.all(color: st == 'todo' ? C.navy2 : Colors.transparent, width: 2)),
      child: st == 'done' ? const Icon(Ic.check, size: 16, color: Colors.white) : Text('${i + 1}', style: TextStyle(fontWeight: FontWeight.w800, color: st == 'now' ? C.navy : C.navy2))),
    const SizedBox(width: 12),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(pl['name'] as String, style: T.h3), Text('Step${stp.steps.length > 1 ? 's' : ''} ${stp.steps.join(' and ')}${stp.offices.isNotEmpty ? ' · ${stp.offices.toSet().map((o) => shortOf(d, o)).join(', ')}' : ''}', style: T.small)])),
    st == 'now' ? const Pill('Next', kind: PK.gold) : const Icon(Ic.chev, color: C.navy2)])));
}
