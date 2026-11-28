// 26–32: Directory page, office page, process page, Ask WayFinder.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/services.dart';

import 'core.dart';
import 'ui.dart';

/* ---------- process helpers ---------- */
/// The buildings a process sends you to, in walking order (consecutive steps in one building share a stop).
List<({String place, List<int> steps, List<String> offices})> procStops(Map pr) {
  final out = <({String place, List<int> steps, List<String> offices})>[];
  final steps = pr['steps'] as List;
  for (var i = 0; i < steps.length; i++) {
    final st = steps[i]; if (st['place'] == null) continue;
    if (out.isNotEmpty && out.last.place == st['place']) { out.last.steps.add(i + 1); } else { out.add((place: st['place'] as String, steps: [i + 1], offices: <String>[])); }
    if (st['office'] != null) out.last.offices.add(st['office'] as String);
  }
  return out;
}
int? nextOf(Map pr, List<int> done) { for (var k = 1; k <= (pr['steps'] as List).length; k++) { if (!done.contains(k)) return k; } return null; }
String stopState(({String place, List<int> steps, List<String> offices}) stp, List<int> done, int? next) => stp.steps.every(done.contains) ? 'done' : stp.steps.contains(next) ? 'now' : 'todo';
String shortOf(WFData d, String oid) => (d.offices[oid]['short'] ?? d.offices[oid]['name']) as String;

class _ProcCard extends StatelessWidget {
  const _ProcCard(this.id, this.pr); final String id; final Map pr;
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data, done = (s.procDone[id] ?? []).length, n = (pr['steps'] as List).length, stops = procStops(pr);
    final sub = pr['order'] != null ? 'Start online, then ${(pr['order'] as List).skip(1).map((o) => o[0]).join(' → ')}.' : '${stops.length} buildings: ${stops.map((x) => d.places[x.place]['name']).join(' → ')}.';
    return CardBox(pad: const EdgeInsets.fromLTRB(16, 14, 14, 14), shadow: true, onTap: () => context.push('/directory/process/$id'), child: Row(children: [
      Container(width: 40, height: 40, decoration: BoxDecoration(color: C.blueSoft, borderRadius: BorderRadius.circular(12)), child: const Icon(Ic.list, color: C.navy2)), const SizedBox(width: 14),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(pr['title'] as String, style: T.h3), const SizedBox(height: 3), Text(sub, style: T.small), const SizedBox(height: 6),
        Row(children: [Expanded(child: ProgressBar(done, n, h: 6)), const SizedBox(width: 10), Text(done > 0 ? '$done of $n done' : '$n steps', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: C.muted))])])),
      const Icon(Ic.chev, color: C.navy2)]));
  }
}
/// Official WVSU links: the app has no browser plugin, so the link is copied for the student to open.
Future<void> openUrl(BuildContext context, String url) async {
  final s = context.wf;
  await Clipboard.setData(ClipboardData(text: url.replaceFirst('tel:', '')));
  s.showToast(url.startsWith('tel:') ? 'Number copied: **${url.substring(4)}**' : 'Link copied. Paste it in your browser.');
}

/* ---------- 26–30 Directory ---------- */
class DirectoryScreen extends StatefulWidget { const DirectoryScreen({super.key, this.tab = 'offices', this.q = ''}); final String tab, q; @override State<DirectoryScreen> createState() => _DirState(); }
class _DirState extends State<DirectoryScreen> {
  late final tc = TextEditingController(text: widget.q);
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data, tab = widget.tab, raw = widget.q, q = raw.trim().toLowerCase();
    bool officeMatch(Map o) => q.isEmpty || [o['name'], d.places[o['place']]['name'], ...(d.places[o['place']]['aka'] as List? ?? []), ...(o['keywords'] as List? ?? [])].join(' ').toLowerCase().contains(q);
    bool procMatch(Map pr) => q.isEmpty || [pr['title'], ...(pr['keywords'] as List)].join(' ').toLowerCase().contains(q);
    Widget noResults(String kind) { final other = kind == 'office' ? 'buildings' : 'offices';
      return CardBox(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('No $kind called “$raw” yet', style: T.h3), const SizedBox(height: 6), const Text('The directory lists places with a confirmed record. Try a shorter name, or ask WayFinder.', style: T.small), const SizedBox(height: 12),
        Wrap(spacing: 8, children: [Btn('Search $other', kind: BK.outline, small: true, onTap: () => context.replace('/directory?tab=$other&q=${enc(q)}')), Btn('Ask WayFinder', kind: BK.outline, small: true, onTap: () => openAsk(context))])])); }
    final content = <Widget>[];
    if (tab == 'offices') {
      final hits = d.offices.entries.where((e) => officeMatch(e.value as Map)).toList(), procHits = q.isEmpty ? <MapEntry<String, dynamic>>[] : d.processes.entries.where((e) => procMatch(e.value as Map)).toList();
      final byPlace = <String, List<MapEntry<String, dynamic>>>{}; for (final e in hits) { byPlace.putIfAbsent(e.value['place'] as String, () => []).add(e); }
      if (hits.isEmpty) { content.add(noResults('office')); }
      byPlace.forEach((pid, list) { final pl = d.places[pid], fl = list.map((e) => e.value['floor']).whereType<int>().toSet().toList()..sort();
        content.add(Padding(padding: const EdgeInsets.only(bottom: 16), child: Container(decoration: cardDeco(r: 22), clipBehavior: Clip.antiAlias, child: Column(children: [
          Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14), decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFFFFF8E8), Colors.white], stops: [0, .7]), border: Border(bottom: BorderSide(color: C.line))),
            child: Row(children: [Silhouette(pl['shape'] as String?), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(pl['name'] as String, style: T.h3), Text('${list.length} office${list.length > 1 ? 's' : ''}${fl.isNotEmpty ? ', floor${fl.length > 1 ? 's' : ''} ${fl.join(' and ')}' : ''}', style: T.small)]))])),
          for (var i = 0; i < list.length; i++) ...[if (i > 0) const Divider(height: 1, color: C.line), Row2(title: list[i].value['name'] as String, sub: d.where(list[i].value as Map), minH: 62, to: '/directory/office/${list[i].key}')],
        ])))); });
      if (procHits.isNotEmpty) { content.add(Container(decoration: cardDeco(r: 22), clipBehavior: Clip.antiAlias, child: Column(children: [
        Container(padding: const EdgeInsets.all(14), color: const Color(0xFFFFF8E8), child: const Row(children: [Icon(Ic.list, color: C.navy2), SizedBox(width: 12), Text('Related process', style: T.h3)])),
        for (final e in procHits) Row2(title: e.value['title'] as String, sub: '${d.offices[e.value['office']]['name']} · ${(e.value['steps'] as List).length} steps', to: '/directory/process/${e.key}')]))); }
    }
    if (tab == 'processes') { final list = d.processes.entries.where((e) => procMatch(e.value as Map)).toList(); content.addAll(list.isEmpty ? [noResults('process')] : [for (final e in list) Padding(padding: const EdgeInsets.only(bottom: 12), child: _ProcCard(e.key, e.value as Map))]); }
    if (tab == 'buildings') {
      final rows = d.places.entries.where((e) => q.isEmpty || [e.value['name'], ...(e.value['aka'] as List? ?? [])].join(' ').toLowerCase().contains(q)).toList()
        ..sort((a, b) { final pa = a.value['photo'] != null ? 1 : 0, pb = b.value['photo'] != null ? 1 : 0; if (pa != pb) return pb - pa; final ba = (a.value['blueprints'] as List? ?? []).isNotEmpty ? 1 : 0, bb = (b.value['blueprints'] as List? ?? []).isNotEmpty ? 1 : 0; if (ba != bb) return bb - ba; return (a.value['name'] as String).compareTo(b.value['name'] as String); });
      if (rows.isEmpty) { content.add(noResults('building')); } else {
        content.add(Text('${rows.where((e) => e.value['photo'] != null).length} with photos · ${rows.where((e) => (e.value['blueprints'] as List? ?? []).isNotEmpty).length} with floor plans · the rest show their map outline', style: T.small));
        content.add(const SizedBox(height: 12));
        content.add(GridView.count(crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: .78, children: [for (final e in rows) Material(color: Colors.white, borderRadius: BorderRadius.circular(18), clipBehavior: Clip.antiAlias,
          child: InkWell(onTap: () => context.push('/map/place/${e.key}'), child: Container(decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: C.line)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: e.value['photo'] != null ? Image.asset(asset(e.value['photo']['src'] as String), width: double.infinity, fit: BoxFit.cover) : Container(width: double.infinity, color: C.sand, child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Silhouette(e.value['shape'] as String?, size: 46), const Text('No photo yet', style: T.small)]))),
            Padding(padding: const EdgeInsets.all(10), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(e.value['name'] as String, maxLines: 2, style: T.h3.copyWith(fontSize: 14.5)), const SizedBox(height: 4),
              (e.value['blueprints'] as List? ?? []).isNotEmpty || e.value['plans'] != null ? const Tag('Floor plan') : Tag(e.value['shape'] != null ? 'Outline only' : 'No floor plan', off: true)])),
          ]))))]));
      }
    }
    if (tab == 'people') {
      final ppl = (d.wf['people'] as List).where((x) => q.isEmpty || [x['name'], x['role'], x['unit']].join(' ').toLowerCase().contains(q)).toList();
      String ini(String n) { final w = n.replaceFirst(RegExp(r'^Ma\. '), 'M ').split(RegExp(r'\s+')).where((w) => RegExp(r'^[A-Z]').hasMatch(w) && !RegExp(r'^[A-Z]\.$').hasMatch(w) && !RegExp(r'^I+$').hasMatch(w)).map((w) => w[0]).toList(); return w.isEmpty ? '' : '${w.first}${w.last}'; }
      content.add(ppl.isEmpty ? noResults('person') : ListBox([for (final x in ppl) Padding(padding: const EdgeInsets.all(14), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CircleAvatar(radius: 20, backgroundColor: C.navy, child: Text(ini(x['name'] as String), style: const TextStyle(fontWeight: FontWeight.w700, color: C.gold, fontSize: 13))), const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text.rich(TextSpan(text: x['name'] as String, style: T.h3, children: [TextSpan(text: ', ${x['cred']}', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: C.muted))])),
          Text(x['role'] as String, style: const TextStyle(fontWeight: FontWeight.w700, color: C.navy2, fontSize: 14)), Text(x['unit'] as String, style: T.small), Text((x['phone'] ?? 'No phone listed') as String, style: const TextStyle(fontSize: 12.5, color: C.muted))])),
        if (x['tel'] != null) IconBtn(Ic.phone, label: 'Call ${x['name']}’s office', onTap: () => openUrl(context, 'tel:${x['tel']}'))]))]));
    }
    const chips = [('offices', 'Offices'), ('processes', 'Processes'), ('buildings', 'Buildings'), ('people', 'People')];
    return Screen(tab: s.signed ? Tab4.directory : null, child: Column(children: [
      s.signed ? const LockupBar() : const TopBar(title: 'Directory', backLabel: 'Welcome', back: '/login'),
      Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 110), children: [
        Text('Directory', style: T.h1()), const SizedBox(height: 16),
        TextField(controller: tc, textInputAction: TextInputAction.search, onSubmitted: (v) => context.replace('/directory?tab=$tab&q=${enc(v)}'), decoration: fieldDeco('Try “Registrar” or “transcript”', prefix: const Icon(Ic.search, color: C.navy2))),
        const SizedBox(height: 16),
        SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [for (final c in chips) Padding(padding: const EdgeInsets.only(right: 8), child: Semantics(selected: c.$1 == tab, button: true, child: Material(color: c.$1 == tab ? C.navy2 : Colors.white, shape: StadiumBorder(side: c.$1 == tab ? BorderSide.none : const BorderSide(color: C.line2)),
          child: InkWell(customBorder: const StadiumBorder(), onTap: () => context.replace('/directory?tab=${c.$1}${q.isNotEmpty ? '&q=${enc(q)}' : ''}'), child: Container(height: 40, padding: const EdgeInsets.symmetric(horizontal: 16), alignment: Alignment.center,
            child: Text(c.$2, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, color: c.$1 == tab ? Colors.white : C.navy2)))))))])),
        const SizedBox(height: 16), ...content,
      ]))]));
  }
}

/* ---------- 27 office page ---------- */
class OfficeScreen extends StatelessWidget {
  const OfficeScreen({super.key, required this.id}); final String id;
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data, o = d.offices[id] as Map, pl = d.places[o['place']] as Map, chain = o['reportsTo'] as List?;
    return Screen(tab: s.signed ? Tab4.directory : null, child: Column(children: [TopBar(title: o['name'] as String, backLabel: 'Directory', back: '/directory'),
      Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 110), children: [
        if (pl['photo'] != null) ...[ClipRRect(borderRadius: BorderRadius.circular(20), child: Stack(children: [Image.asset(asset(pl['photo']['src'] as String), height: 170, width: double.infinity, fit: BoxFit.cover),
          Positioned(left: 10, bottom: 10, child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: const Color(0xCC132D6B), borderRadius: BorderRadius.circular(10)), child: Text(pl['name'] as String, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13))))])), const SizedBox(height: 20)],
        Row(children: [if (pl['photo'] == null) ...[Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: const Color(0xFFFFF6E2), borderRadius: BorderRadius.circular(16), border: Border.all(color: C.goldLine)), child: Silhouette(pl['shape'] as String?, size: 56)), const SizedBox(width: 14)],
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(o['name'] as String, style: T.h1()), const SizedBox(height: 6), Row(children: [const Icon(Ic.pin, size: 18, color: C.goldDeep), const SizedBox(width: 6), Expanded(child: Text(d.where(o), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: C.body)))])]))]),
        if (o['note'] != null) ...[const SizedBox(height: 16), NoteBox(Text(o['note'] as String))],
        const SizedBox(height: 20), Btn('Show on map', icon: Ic.map, wide: true, to: '/map/place/${o['place']}?office=$id&from=office'),
        if ((o['services'] as List? ?? []).isNotEmpty) ...[const SizedBox(height: 20), const Text('Services', style: T.h2), const SizedBox(height: 8), for (final sid in o['services'] as List) _ProcCard(sid as String, d.processes[sid] as Map)],
        if (chain != null) ...[const SizedBox(height: 20), Container(decoration: cardDeco(), clipBehavior: Clip.antiAlias, child: Column(children: [
          InkWell(onTap: () => s.update(() => s.orgOpen = !s.orgOpen), child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Office reporting structure', style: T.h3), Text('Who the ${o['name']} reports to', style: T.small)])),
            AnimatedRotation(turns: s.orgOpen ? .5 : 0, duration: const Duration(milliseconds: 200), child: const Icon(Ic.caret, color: C.navy2))]))),
          if (s.orgOpen) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (var i = 0; i < chain.length; i++) Container(margin: const EdgeInsets.only(bottom: 4), padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9), decoration: i == chain.length - 1 ? BoxDecoration(color: C.goldSoft, borderRadius: BorderRadius.circular(12), border: Border.all(color: C.goldLine)) : null,
              child: Row(children: [Container(width: 10, height: 10, decoration: BoxDecoration(shape: BoxShape.circle, color: i == chain.length - 1 ? C.gold : Colors.white, border: Border.all(color: i == chain.length - 1 ? C.goldDeep : C.navy2, width: 2.5))), const SizedBox(width: 10),
                Expanded(child: Text(chain[i] as String, style: TextStyle(fontSize: 14.5, fontWeight: i == chain.length - 1 ? FontWeight.w700 : FontWeight.w600, color: i == chain.length - 1 ? C.ink : C.body)))])),
            LinkBtn('View official chart', icon: Ic.ext, onTap: () => openUrl(context, d.wf['links']['orgchart'] as String)),
          ])),
        ]))],
      ]))]));
  }
}

/* ---------- 27B / 28B / 28C process page ---------- */
class ProcessScreen extends StatefulWidget { const ProcessScreen({super.key, required this.id, this.step = 0}); final String id; final int step; @override State<ProcessScreen> createState() => _ProcState(); }
class _ProcState extends State<ProcessScreen> {
  final keys = <int, GlobalKey>{};
  @override
  void initState() { super.initState(); if (widget.step > 0) WidgetsBinding.instance.addPostFrameCallback((_) => _goStep(widget.step)); }
  void _goStep(int k) { final c = keys[k]?.currentContext; if (c != null) Scrollable.ensureVisible(c, duration: const Duration(milliseconds: 400), alignment: .3); }
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data, id = widget.id, pr = d.processes[id] as Map, o = d.offices[pr['office']] as Map, steps = pr['steps'] as List;
    final done = s.procDone[id] ?? [], n = steps.length, stops = procStops(pr), next = nextOf(pr, done);
    void toggle(int k) => s.update(() { final a = s.procDone.putIfAbsent(id, () => []); a.contains(k) ? a.remove(k) : a.add(k); });
    final orderIc = {'ticket': Icons.confirmation_number_outlined, 'door': Icons.door_front_door_outlined, 'pay': Icons.payments_outlined};
    return Screen(tab: s.signed ? Tab4.directory : null, child: Column(children: [TopBar(title: 'Process', backLabel: (o['short'] ?? o['name']) as String, back: '/directory/office/${pr['office']}'),
      Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 110), children: [
        Text(pr['title'] as String, style: T.h1()), const SizedBox(height: 8),
        pr['order'] != null ? Row(children: [const Icon(Ic.pin, size: 18, color: C.goldDeep), const SizedBox(width: 6), Expanded(child: Text('${o['name']}, ${d.where(o)}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: C.body)))]) : Text(pr['intro'] as String, style: T.body),
        if (pr['sample'] == true) ...[const SizedBox(height: 8), NoteBox(Text('Sample steps for the prototype. Confirm the order with ${o['short'] ?? o['name']}.'), kind: NK.warn)],
        const SizedBox(height: 20),
        Container(padding: const EdgeInsets.fromLTRB(16, 14, 16, 14), decoration: cardDeco(), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [Expanded(child: Text(done.length == n ? 'All steps done' : '${done.length} of $n steps done', style: T.h3)), if (next != null) TextButton(onPressed: () => _goStep(next), child: Text('Next: step $next', style: const TextStyle(fontWeight: FontWeight.w700, color: C.navy2)))]),
          const SizedBox(height: 10), ProgressBar(done.length, n)])),
        const SizedBox(height: 20),
        if (pr['order'] != null) Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: C.navy, borderRadius: BorderRadius.circular(22)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Start online. On campus, visit Registrar → Cashier → Registrar.', style: TextStyle(fontFamily: T.display, fontWeight: FontWeight.w600, fontSize: 19, height: 1.25, color: Colors.white)), const SizedBox(height: 14),
          Row(children: [for (var i = 0; i < (pr['order'] as List).length; i++) ...[
            if (i > 0) Expanded(child: Container(height: 2, margin: const EdgeInsets.only(bottom: 22), color: const Color(0xB3F3B53A))),
            Column(children: [Container(width: 40, height: 40, decoration: BoxDecoration(shape: BoxShape.circle, color: i == 0 ? C.gold : const Color(0x1FFFFFFF)), child: Icon(orderIc[pr['order'][i][1]], color: i == 0 ? C.navy : Colors.white, size: 20)), const SizedBox(height: 6),
              Text(pr['order'][i][0] as String, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFFDCE6F8)))])]]),
        ]))
        else Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [const Expanded(child: Text('Buildings to walk to', style: T.h2)), Text('${stops.length} stops', style: T.small)]), const SizedBox(height: 10),
          for (var i = 0; i < stops.length; i++) Builder(builder: (_) { final st = stopState(stops[i], done, next), pl = d.places[stops[i].place];
            return Container(margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.all(12), decoration: cardDeco(border: st == 'now' ? C.goldLine : C.line, color: st == 'now' ? const Color(0xFFFFFBEF) : Colors.white), child: Row(children: [
              Container(width: 30, height: 30, alignment: Alignment.center, decoration: BoxDecoration(shape: BoxShape.circle, color: st == 'done' ? C.ok : st == 'now' ? C.gold : Colors.white, border: Border.all(color: st == 'todo' ? C.navy2 : Colors.transparent, width: 2)),
                child: st == 'done' ? const Icon(Ic.check, size: 16, color: Colors.white) : Text('${i + 1}', style: TextStyle(fontWeight: FontWeight.w800, color: st == 'now' ? C.navy : C.navy2))),
              const SizedBox(width: 10), Silhouette(pl['shape'] as String?, size: 34), const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(pl['name'] as String, style: T.h3), Text('${stops[i].offices.isNotEmpty ? '${stops[i].offices.toSet().map((x) => shortOf(d, x)).join(', ')} · ' : ''}step${stops[i].steps.length > 1 ? 's' : ''} ${stops[i].steps.join(' and ')}', style: T.small)])),
              if (st == 'now') const Pill('Next stop', kind: PK.gold)])); }),
          const SizedBox(height: 4), Btn('Show all stops on map', icon: Ic.map, wide: true, to: '/map/stops?pid=$id'),
        ]),
        const SizedBox(height: 20), const Text('Checklist', style: T.h2), const SizedBox(height: 10),
        for (var i = 0; i < n; i++) Builder(builder: (_) { final k = i + 1, st = steps[i] as Map, isDone = done.contains(k), pl = st['place'] != null ? d.places[st['place']] : null, reading = widget.step == k;
          return Container(key: keys.putIfAbsent(k, () => GlobalKey()), padding: const EdgeInsets.only(bottom: 20), child: IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Column(children: [Semantics(button: true, label: 'Mark step $k ${isDone ? 'not done' : 'done'}', child: GestureDetector(onTap: () => toggle(k), child: Container(width: 44, height: 44, alignment: Alignment.center, decoration: BoxDecoration(shape: BoxShape.circle, color: isDone ? C.ok : Colors.white, border: isDone ? null : Border.all(color: C.navy2, width: 2)),
              child: isDone ? const Icon(Ic.check, color: Colors.white) : Text('$k', style: const TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: 19, color: C.navy))))),
              if (k < n) Expanded(child: Container(width: 2, color: C.line2))]),
            const SizedBox(width: 12),
            Expanded(child: Container(padding: const EdgeInsets.only(top: 10), decoration: reading ? BoxDecoration(color: const Color(0x29F3B53A), borderRadius: BorderRadius.circular(14)) : null, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text.rich(TextSpan(text: st['title'] as String, style: T.h3.copyWith(color: isDone ? C.ok : C.ink), children: [if (st['optional'] == true) const WidgetSpan(alignment: PlaceholderAlignment.middle, child: Padding(padding: EdgeInsets.only(left: 6), child: Tag('If needed')))])),
              if (pl != null && pr['order'] == null) Padding(padding: const EdgeInsets.only(top: 4), child: Row(children: [Silhouette(pl['shape'] as String?, size: 18), const SizedBox(width: 6), Text('${st['office'] != null ? '${shortOf(d, st['office'] as String)}, ' : ''}${pl['name']}', style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: C.body))])),
              const SizedBox(height: 6), Text(st['body'] as String, style: T.body.copyWith(fontSize: 15)),
              if (st['fields'] != null) Container(margin: const EdgeInsets.only(top: 6), padding: const EdgeInsets.fromLTRB(14, 10, 12, 10), width: double.infinity, decoration: cardDeco(r: 14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [for (final f in st['fields'] as List) Text('•  $f', style: const TextStyle(fontSize: 14.5, height: 1.6, color: C.ink))])),
              if (st['action'] == 'ticketon') Padding(padding: const EdgeInsets.only(top: 8), child: Btn('Open WVSU Ticketon', icon: Ic.ext, small: true, onTap: () => openUrl(context, d.wf['links']['ticketon'] as String))),
              if (st['action'] == 'map') Padding(padding: const EdgeInsets.only(top: 8), child: Btn('Show Registrar on map', kind: BK.outline, icon: Ic.map, small: true, to: '/map/place/${st['place']}?${st['office'] != null ? 'office=${st['office']}&' : ''}from=process&pid=$id&step=$k&settled=1')),
              if (pl != null && st['action'] == null && pr['order'] == null) LinkBtn('Show on map', icon: Ic.map, to: '/map/place/${st['place']}?${st['office'] != null ? 'office=${st['office']}&' : ''}from=process&pid=$id&step=$k&settled=1'),
            ]))),
          ]))); }),
        if (pr['order'] != null) ...[Btn('View official requirements', kind: BK.ghost, icon: Ic.ext, wide: true, onTap: () => openUrl(context, d.wf['links']['charter'] as String)), const SizedBox(height: 8),
          const Text('Fees and processing times are in the official requirements (WVSU Citizen’s Charter).', textAlign: TextAlign.center, style: T.small)],
      ]))]));
  }
}

/* ---------- 31–32 Ask WayFinder: a sheet over the screen you were on ---------- */
const _q1 = 'Where is my Wednesday CIT 213 class?';
void registerAsk() => openAskHandler = (context) => showModalBottomSheet(context: context, isScrollControlled: true, backgroundColor: C.cream, barrierColor: const Color(0x6B131728),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))), builder: (_) => const AskSheet());
class AskSheet extends StatefulWidget { const AskSheet({super.key}); @override State<AskSheet> createState() => _AskState(); }
class _AskState extends State<AskSheet> {
  String? q; final tc = TextEditingController();
  ({String text, List<(String, String, bool)> actions, String src, String? time, String? room}) answer(WFState s, String q) {
    final sch = s.saved;
    if (sch == null) return (text: 'I can answer that once your timetable is saved.', actions: [('Scan timetable', '/scan', true)], src: '', time: null, room: null);
    if (RegExp('registrar', caseSensitive: false).hasMatch(q)) return (text: 'The Registrar’s Office is on Floor 1 of the Administration Building.', actions: [('Show on map', '/map/place/administration?office=registrar&from=ask', true), ('Open in Directory', '/directory/office/registrar', false)], src: 'From the campus directory', time: null, room: null);
    if (RegExp('monday', caseSensitive: false).hasMatch(q)) {
      final items = [for (final x in sch) for (final m in x.m) if (m.day == 1) '${x.code} · ${range(m.start, m.end)} · ${m.room}'], rooms = {for (final x in sch) for (final m in x.m) if (m.day == 1) m.room}.toList();
      return (text: 'On Monday you’re in ${rooms.length > 1 ? '${rooms.sublist(0, rooms.length - 1).join(', ')} and ${rooms.last}' : rooms.join()}:\n${items.join('\n')}', actions: [('Open Monday', '/schedule?view=week&day=1', true)], src: 'From your saved schedule', time: null, room: null);
    }
    final cit = sch.where((x) => x.code == 'CIT 213').firstOrNull ?? sch[1], m = cit.m.length > 1 ? cit.m[1] : cit.m.first;
    return (text: 'Your Wednesday CIT 213 class is ${range(m.start, m.end)} in ${m.room}, CICT Building.\nThe building is confirmed, but ${m.room}’s exact spot isn’t mapped yet, so the map opens on the CICT Building.',
      actions: [('Open CICT Building on map', '/map/place/cict-building?room=${enc(m.room)}&from=ask', true), ('View Wednesday meeting', '/class/CIT%20213/1', false)], src: 'From your saved schedule · CIT 213, Wednesday', time: range(m.start, m.end), room: m.room);
  }
  void go(String to) { Navigator.of(context).pop(); GoRouter.of(context).push(to); }
  @override
  Widget build(BuildContext context) {
    final s = context.wf;
    return Padding(padding: EdgeInsets.fromLTRB(20, 10, 20, 24 + MediaQuery.of(context).viewInsets.bottom), child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [const Grab(),
      if (q == null) ...[
        Row(children: [Container(width: 40, height: 40, decoration: const BoxDecoration(color: C.navy, shape: BoxShape.circle, boxShadow: [BoxShadow(color: C.gold, spreadRadius: 2)]), child: const Icon(Ic.ask, color: Colors.white, size: 20)), const SizedBox(width: 10),
          const Expanded(child: Text('Ask WayFinder', style: T.h2)), IconBtn(Ic.close, label: 'Close', onTap: () => Navigator.of(context).pop())]),
        const Padding(padding: EdgeInsets.fromLTRB(0, 2, 0, 14), child: Text('Answers come from your saved schedule and the campus records.', style: T.small)),
        for (final x in [_q1, 'Which rooms do I use on Monday?', 'Where is the Registrar?']) Padding(padding: const EdgeInsets.only(bottom: 8), child: Material(color: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: C.line)),
          child: InkWell(borderRadius: BorderRadius.circular(16), onTap: () => setState(() { q = x; s.ask.add(x); }), child: Padding(padding: const EdgeInsets.fromLTRB(16, 14, 14, 14), child: Row(children: [Expanded(child: Text(x, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: C.ink))), const Icon(Ic.arrow, color: C.navy2)]))))),
        const SizedBox(height: 6),
        TextField(controller: tc, textInputAction: TextInputAction.send, onSubmitted: (v) { if (v.trim().isNotEmpty) setState(() { q = v.trim(); s.ask.add(q!); }); },
          decoration: fieldDeco('Ask where a class or office is', suffix: IconBtn(Ic.arrow, label: 'Send', onTap: () { if (tc.text.trim().isNotEmpty) setState(() { q = tc.text.trim(); s.ask.add(q!); }); }))),
      ] else Builder(builder: (_) { final a = answer(s, q!);
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [TextButton.icon(onPressed: () => setState(() => q = null), icon: const Icon(Ic.back, color: C.navy2), label: const Text('Questions', style: TextStyle(fontWeight: FontWeight.w700, color: C.navy2))), const Spacer(), IconBtn(Ic.close, label: 'Close', onTap: () => Navigator.of(context).pop())]),
          Align(alignment: Alignment.centerRight, child: Container(constraints: const BoxConstraints(maxWidth: 300), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12), decoration: const BoxDecoration(color: C.navy2, borderRadius: BorderRadius.only(topLeft: Radius.circular(20), topRight: Radius.circular(20), bottomLeft: Radius.circular(20), bottomRight: Radius.circular(6))),
            child: Text(q!, style: const TextStyle(fontSize: 16, height: 1.45, color: Colors.white)))),
          const SizedBox(height: 12),
          Container(padding: const EdgeInsets.all(16), decoration: cardDeco(), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (a.src.isNotEmpty) ...[Row(children: [const Needle(size: 16), const SizedBox(width: 8), Expanded(child: Text(a.src, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: C.warn)))]), const SizedBox(height: 12)],
            if (a.room != null) ...[Row(children: [Expanded(child: Container(padding: const EdgeInsets.all(12), decoration: cardDeco(r: 18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Wednesday', style: T.label), const SizedBox(height: 6), Text(a.time!, style: T.h2.copyWith(fontSize: 18))]))), const SizedBox(width: 10),
              Expanded(child: Container(padding: const EdgeInsets.all(12), decoration: cardDeco(r: 18, color: C.goldSoft, border: C.goldLine), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Room', style: T.label), const SizedBox(height: 4), Text(a.room!, style: T.room(28))])))]), const SizedBox(height: 12)],
            Text(a.text, style: T.body), const SizedBox(height: 12),
            for (final act in a.actions) Padding(padding: const EdgeInsets.only(bottom: 8), child: Btn(act.$1, kind: act.$3 ? BK.primary : BK.outline, icon: act.$3 ? Ic.map : null, wide: true, onTap: () => go(act.$2))),
          ])),
          Center(child: LinkBtn('Ask something else', onTap: () => setState(() => q = null))),
        ]); }),
    ])));
  }
}
