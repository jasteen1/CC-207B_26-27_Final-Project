// 05–16, 06A–06D, 33: Home, scan → review → save, schedule, class, notifications, lock screen, class reminder.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core.dart';
import 'ui.dart';

/* ---------- class reminder banner (slides in from the top) ---------- */
class PushHost extends StatefulWidget { const PushHost({super.key, required this.child, required this.go}); final Widget child; final void Function(String) go; @override State<PushHost> createState() => _PushHostState(); }
class _PushHostState extends State<PushHost> {
  int seen = 0; bool show = false; Timer? t;
  @override void dispose() { t?.cancel(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final s = context.wf;
    if (s.pushStamp != 0 && s.pushStamp != seen) { seen = s.pushStamp; show = true; t?.cancel(); t = Timer(const Duration(seconds: 12), () { if (mounted) setState(() => show = false); }); }
    final r = s.data.reminder, x = s.saved?.where((c) => c.code == r['code']).firstOrNull;
    final m = x?.m[r['meeting'] as int], b = m == null ? null : s.data.places[buildingOf(m.room)];
    void go(String to) { setState(() => show = false); widget.go(to); }
    return Stack(children: [widget.child,
      if (x != null && m != null) AnimatedPositioned(duration: const Duration(milliseconds: 600), curve: show ? Curves.easeOutBack : Curves.easeIn, left: 10, right: 10, top: show ? MediaQuery.of(context).padding.top + 10 : -220,
        child: GestureDetector(onVerticalDragEnd: (e) { if ((e.primaryVelocity ?? 0) < -100) setState(() => show = false); },
          child: Material(color: const Color(0xEBFFFDF8), elevation: 12, shadowColor: const Color(0x73101432), borderRadius: BorderRadius.circular(22), child: Padding(padding: const EdgeInsets.all(14), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 40, height: 40, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(11), boxShadow: const [BoxShadow(color: Color(0x1F000000), blurRadius: 4)]), padding: const EdgeInsets.all(4), child: Image.asset('assets/wf/logo.png')),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Row(children: [Text('WayFinder', style: TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 12.5, color: C.ink)), Spacer(), Text('now', style: TextStyle(fontFamily: T.ui, fontSize: 12.5, color: C.muted))]),
              Text('${x.code} in 15 min', style: const TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 15, color: C.ink)),
              rich('Moved to **${m.room}**, ${b?['name'] ?? ''}.', style: const TextStyle(fontFamily: T.ui, fontSize: 14, height: 1.35, color: C.body)),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: Btn('Show on map', icon: Ic.map, small: true, onTap: () => go('/map/route?from=${r['from']}&to=${buildingOf(m.room)}&room=${enc(r['room'] as String)}'))), const SizedBox(width: 8),
                Expanded(child: Btn('View class', kind: BK.ghost, small: true, onTap: () => go('/class/${enc(x.code)}/${r['meeting']}'))),
              ]),
            ])),
            IconBtn(Ic.close, label: 'Dismiss', color: C.muted, onTap: () => setState(() => show = false)),
          ]))))),
    ]);
  }
}

/* ---------- Home ---------- */
class HomeScreen extends StatefulWidget { const HomeScreen({super.key, this.returning = false, this.first = false}); final bool returning, first; @override State<HomeScreen> createState() => _HomeState(); }
class _HomeState extends State<HomeScreen> {
  Timer? t; final suite = PageController(viewportFraction: .72); int card = 0;
  @override
  void initState() {
    super.initState(); final s = context.wfr;
    if (widget.returning) { s.signed = true; s.saved ??= s.copySchedule(); }
    if (widget.first) { s.firstTime = true; s.saved = null; }
    if (!s.notified && s.saved != null) t = Timer(const Duration(milliseconds: 3500), () { if (mounted) s.sendReminder(); });
  }
  @override void dispose() { t?.cancel(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data, list = s.upcoming(), now = s.now;
    final next = list.where((it) => mins(it.m.start) > now).firstOrNull, current = list.where((it) => mins(it.m.start) <= now && mins(it.m.end) > now).firstOrNull;
    final startsIn = next == null ? 0 : mins(next.m.start) - now, moved = next == null ? null : s.movedNote(next.x.code, next.mi);
    final hour = now ~/ 60, greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    var free = 0; List<int>? freeAt; for (var i = 1; i < list.length; i++) { final g = mins(list[i].m.start) - mins(list[i - 1].m.end); if (g > 0) { free += g; freeAt ??= [mins(list[i - 1].m.end), mins(list[i].m.start)]; } }
    final week = s.saved?.fold<int>(0, (a, x) => a + x.m.length) ?? 0, b = next == null ? null : d.places[buildingOf(next.m.room)], me = s.me;
    final nextCard = next != null ? Container(margin: const EdgeInsets.only(top: 14), padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: const [BoxShadow(color: Color(0x47132D6B), blurRadius: 40, offset: Offset(0, 18), spreadRadius: -12)]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [const Tag('NEXT CLASS', gold: true, leading: Needle(size: 14)), const Spacer(), TextButton(onPressed: () => context.go('/schedule'), child: const Row(children: [Text('My schedule', style: TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 14.5, color: C.navy2)), Icon(Ic.chev, size: 18, color: C.navy2)]))]),
        const SizedBox(height: 8),
        Row(children: [Dial(value: startsIn, frac: (1 - startsIn / 60).clamp(.06, 1)), const SizedBox(width: 14), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(next.x.code, style: const TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: 24, color: C.navy)), const SizedBox(height: 4),
          Text(next.x.title, style: const TextStyle(fontFamily: T.ui, fontSize: 14.5, height: 1.3, color: C.body)), const SizedBox(height: 8),
          Text('${d.day(next.m.day)} · ${range(next.m.start, next.m.end)}', style: const TextStyle(fontFamily: T.ui, fontSize: 14, fontWeight: FontWeight.w700, color: C.blue))]))]),
        if (moved != null) ...[const SizedBox(height: 12), NoteBox(rich('Moved today from **${moved.from}** to **${moved.to}**', style: const TextStyle(fontFamily: T.ui, fontSize: 14, color: Color(0xFF5C3A00))), kind: NK.warn, icon: Ic.alert)],
        const SizedBox(height: 14),
        Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12), decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), gradient: const LinearGradient(colors: [C.goldSoft, Color(0xFFFFF6E2)]), border: Border.all(color: C.goldLine)),
          child: IntrinsicHeight(child: Row(children: [Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [const Text('ROOM', style: T.label), Text(next.m.room, style: T.room())]),
            const VerticalDivider(color: C.goldLine, width: 32), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [const Text('BUILDING', style: T.label), Text(b?['name'] ?? 'Not recorded', style: T.h3),
              Text(b != null && (b['rooms'] as Map)[next.m.room] != null ? 'Floor ${b['rooms'][next.m.room]['floor']}' : 'Floor not confirmed', style: T.small)]))]))),
        const SizedBox(height: 14),
        Btn('Find classroom', icon: Ic.pin, wide: true, to: '/class/${enc(next.x.code)}/${next.mi}'),
        if (moved != null) ...[const SizedBox(height: 10), Btn('Show the way from CICT', kind: BK.outline, icon: Ic.route, wide: true, to: '/map/route?from=${d.reminder['from']}&to=${buildingOf(next.m.room)}&room=${enc(next.m.room)}')],
      ]))
      : Container(margin: const EdgeInsets.only(top: 14), padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: const [BoxShadow(color: Color(0x47132D6B), blurRadius: 40, offset: Offset(0, 18), spreadRadius: -12)]),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Tag('GET STARTED', icon: Ic.cal), const SizedBox(height: 12), const Text('Add your class schedule', style: T.h2), const SizedBox(height: 6),
          const Text('Scan your timetable once. WayFinder shows your next class and where it meets.', style: T.body), const SizedBox(height: 16),
          Btn('Scan timetable', icon: Ic.camera, wide: true, to: '/scan'), Center(child: LinkBtn('Add a class by hand', to: '/manual'))]));
    return Screen(tab: Tab4.home, bg: C.home2, child: ListView(padding: const EdgeInsets.only(bottom: 110), children: [
      Container(margin: const EdgeInsets.fromLTRB(10, 10, 10, 0), padding: const EdgeInsets.fromLTRB(16, 14, 16, 16), decoration: BoxDecoration(borderRadius: BorderRadius.circular(30),
          gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.white, Color(0xFFF2F6FD)]), border: Border.all(color: const Color(0x0F132D6B))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [Image.asset('assets/wf/logo-lockup.png', height: 36), const Spacer(),
            Stack(clipBehavior: Clip.none, children: [IconBtn(Ic.bell, label: 'Notifications${s.unread > 0 ? ', ${s.unread} new' : ''}', onTap: () => context.push('/notifications')),
              if (s.unread > 0) Positioned(right: 6, top: 6, child: Container(width: 16, height: 16, alignment: Alignment.center, decoration: const BoxDecoration(color: C.err, shape: BoxShape.circle), child: Text('${s.unread}', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700))))]),
            const SizedBox(width: 6),
            Semantics(button: true, label: 'Your profile, ${me.name}', child: GestureDetector(onTap: () => context.push('/profile?step=3&edit=1'), child: Container(width: 40, height: 40, alignment: Alignment.center,
              decoration: const BoxDecoration(color: C.navy, shape: BoxShape.circle, boxShadow: [BoxShadow(color: Colors.white, spreadRadius: 3), BoxShadow(color: C.gold, spreadRadius: 4.5)]), child: Text(me.initials, style: const TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 14, color: Colors.white)))))]),
          const SizedBox(height: 18),
          Text('${d.day(d.todayDay).toUpperCase()} · ${fmtMin(now)}', style: T.eyebrow), const SizedBox(height: 6),
          Text('$greet, ${me.first}.', style: const TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: 34, height: 1.04, letterSpacing: -.7, color: C.navy)), const SizedBox(height: 8),
          rich(current != null && next != null ? '${current.x.code} is on now in ${current.m.room}. Next: **${next.x.code} in $startsIn minutes**.' : next != null ? '${list.length} classes today. The first starts in **$startsIn minutes**.' : 'Let’s get your classes in one place.', style: const TextStyle(fontFamily: T.ui, fontSize: 16, height: 1.45, color: C.body), bold: const TextStyle(color: C.navy, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          InkWell(onTap: () => context.push('/map?focus=search'), borderRadius: BorderRadius.circular(16), child: Container(height: 50, padding: const EdgeInsets.symmetric(horizontal: 16), decoration: BoxDecoration(color: const Color(0xE6FFFFFF), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0x14132D6B))),
            child: const Row(children: [Icon(Ic.search, color: C.navy2), SizedBox(width: 10), Text('Search buildings, rooms, offices', style: TextStyle(fontFamily: T.ui, fontSize: 15.5, color: Color(0xFF6B7488)))]))),
          nextCard,
        ])),
      if (next != null) ...[
        const SizedBox(height: 22),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Row(children: [
          _Stat('${list.length}', 'classes today'), const SizedBox(width: 10),
          _Stat(free >= 60 ? '${(free / 60).round()}h' : '${free}m', freeAt != null ? 'free ${fmtMin(freeAt[0]).replaceAll(RegExp(r' (AM|PM)'), '')}–${fmtMin(freeAt[1])}' : 'no gaps'), const SizedBox(width: 10),
          _Stat('$week', 'meetings this week')])),
        const SizedBox(height: 22),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Row(children: [const Text('Today', style: T.h2), const Spacer(), TextButton(onPressed: () => context.go('/schedule?view=week&day=${d.todayDay}'), child: const Text('Week view ›', style: TextStyle(fontWeight: FontWeight.w700, color: C.navy2)))])),
        _Today(items: list.where((it) => mins(it.m.end) > now).toList(), next: next),
      ],
      const SizedBox(height: 22),
      const Padding(padding: EdgeInsets.symmetric(horizontal: 20), child: Text('Get around campus', style: T.h2)), const SizedBox(height: 10),
      SizedBox(height: 262, child: PageView(controller: suite, padEnds: false, onPageChanged: (i) => setState(() => card = i), children: [
        _Suite(title: 'Walk to Quezon Hall', sub: 'Preview the path from CICT, turn by turn.', tag: 'WALK', to: '/map/route?from=cict-building&to=quezon-hall', preview: const MiniRoute()),
        _Suite(title: 'Directory', sub: 'Find an office and see which building and floor.', tag: 'FIND', to: '/directory', preview: Container(color: const Color(0xFFEEF3FC), padding: const EdgeInsets.all(12), child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          _ScRow('Registrar', 'Admin · F1', first: true), SizedBox(height: 6), _ScRow('Admission Office', 'Admin · F1'), SizedBox(height: 6), _ScRow('CAS-SC Office', 'Student’s Center · F2')]))),
        _Suite(title: 'Ask WayFinder', sub: 'Ask where and when your classes meet.', tag: 'ASK', onTap: () => openAsk(context), preview: Container(color: const Color(0xFFEEF3FC), padding: const EdgeInsets.all(12), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Align(alignment: Alignment.centerRight, child: Container(padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8), decoration: const BoxDecoration(color: C.navy2, borderRadius: BorderRadius.only(topLeft: Radius.circular(14), topRight: Radius.circular(14), bottomLeft: Radius.circular(14), bottomRight: Radius.circular(4))),
            child: const Text('Where is my Wednesday CIT 213 class?', style: TextStyle(fontSize: 12, color: Colors.white)))),
          const SizedBox(height: 8),
          Align(alignment: Alignment.centerLeft, child: Container(padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8), decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.only(topLeft: Radius.circular(14), topRight: Radius.circular(14), bottomRight: Radius.circular(14), bottomLeft: Radius.circular(4))),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [Needle(size: 12), SizedBox(width: 6), Text('ICT 306 · 7:00 AM', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: C.navy))]))),
        ]))),
      ])),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [for (var i = 0; i < 3; i++) AnimatedContainer(duration: const Duration(milliseconds: 300), width: i == card ? 22 : 8, height: 8, margin: const EdgeInsets.all(3), decoration: BoxDecoration(color: i == card ? C.gold : C.line2, borderRadius: BorderRadius.circular(4)))]),
      if (s.saved != null) ...[const SizedBox(height: 22), Container(margin: const EdgeInsets.symmetric(horizontal: 12), padding: const EdgeInsets.all(14), decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), gradient: const LinearGradient(colors: [Color(0xFFEAF1FC), Color(0xFFF6F1E6)]), border: Border.all(color: const Color(0x292E6FB8))),
        child: Row(children: [Container(width: 44, height: 44, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)), child: const Icon(Ic.cal, color: C.navy2)), const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('SY 2026–2027 · 1ST SEMESTER', style: TextStyle(fontFamily: T.ui, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: C.blue)), Text('${s.saved!.length} subjects saved', style: T.h3), const Text('Read from your timetable photo.', style: T.small)])),
          Btn('Rescan', kind: BK.outline, small: true, to: '/scan')]))],
    ]));
  }
}
class _Today extends StatelessWidget {
  const _Today({required this.items, required this.next}); final List<Item> items; final Item? next;
  @override
  Widget build(BuildContext context) {
    Widget row(Item it) {
      final isNext = it == next;
      final dot = Container(width: 10, height: 10, margin: const EdgeInsets.symmetric(horizontal: 8),
          decoration: BoxDecoration(shape: BoxShape.circle, color: isNext ? C.gold : Colors.white, border: Border.all(color: isNext ? C.gold : C.line2, width: 2.5)));
      final code = Row(children: [
        Text(it.x.code, style: const TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 15.5, color: C.ink)),
        if (isNext) ...[const SizedBox(width: 6), const Tag('Next', gold: true)],
      ]);
      return InkWell(
        onTap: () => context.push('/class/${enc(it.x.code)}/${it.mi}'),
        child: Container(
          constraints: const BoxConstraints(minHeight: 62),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: isNext ? const BoxDecoration(gradient: LinearGradient(colors: [Color(0x29F3B53A), Colors.transparent], stops: [0, .8])) : null,
          child: Row(children: [
            SizedBox(width: 62, child: Text(it.m.start, style: TextStyle(fontFamily: T.ui, fontSize: 13, fontWeight: FontWeight.w700, color: isNext ? C.warn : C.muted))),
            dot,
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [code, Text(it.x.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small)])),
            Text(it.m.room, style: T.room(22)),
          ]),
        ),
      );
    }
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12), padding: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0x12132D6B))),
      child: Column(children: [for (final it in items) row(it)]),
    );
  }
}
class _Stat extends StatelessWidget {
  const _Stat(this.n, this.l); final String n, l;
  @override
  Widget build(BuildContext context) => Expanded(child: Container(padding: const EdgeInsets.fromLTRB(10, 14, 10, 12), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0x0F132D6B)), boxShadow: const [BoxShadow(color: Color(0x59132D6B), blurRadius: 24, offset: Offset(0, 10), spreadRadius: -14)]),
      child: Column(children: [Text(n, style: const TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: 30, height: 1, color: C.blue)), const SizedBox(height: 6), Text(l, textAlign: TextAlign.center, style: const TextStyle(fontFamily: T.ui, fontSize: 12, fontWeight: FontWeight.w600, color: C.muted))])));
}
class _ScRow extends StatelessWidget {
  const _ScRow(this.a, this.b, {this.first = false}); final String a, b; final bool first;
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: first ? Border.all(color: C.goldLine, width: 1.5) : null),
      child: Row(children: [Text(a, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: C.ink)), const Spacer(), Text(b, style: const TextStyle(fontSize: 12, color: C.muted))]));
}
class _Suite extends StatelessWidget {
  const _Suite({required this.title, required this.sub, required this.tag, required this.preview, this.to, this.onTap}); final String title, sub, tag; final Widget preview; final String? to; final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.fromLTRB(12, 4, 0, 14), child: Material(color: Colors.white, borderRadius: BorderRadius.circular(22), clipBehavior: Clip.antiAlias, elevation: 0,
      child: InkWell(onTap: onTap ?? () => context.push(to!), child: Container(decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: const Color(0x12132D6B))), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(height: 124, width: double.infinity, child: preview),
        Padding(padding: const EdgeInsets.fromLTRB(16, 14, 16, 16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Text(title, style: const TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: 18, color: C.navy)), const Icon(Ic.chev, size: 18, color: C.navy)]),
          const SizedBox(height: 6), Text(sub, style: T.small, maxLines: 2), const SizedBox(height: 8), Tag(tag)])),
      ])))));
}

/* ---------- 07 scan ---------- */
class ScanScreen extends StatelessWidget {
  const ScanScreen({super.key});
  @override
  Widget build(BuildContext context) => Screen(child: Column(children: [const TopBar(title: 'Scan timetable', backLabel: 'Home', back: '/home'),
        Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 28), children: [
          Text('Scan your timetable', style: T.h1()), const SizedBox(height: 16),
          const Text('Use a photo or screenshot of your WVSU class schedule. You’ll check every class before anything is saved.', style: T.body), const SizedBox(height: 16),
          if (context.wf.saved != null) ...[const NoteBox(Text('Your saved classes stay as they are unless you save a new scan.')), const SizedBox(height: 16)],
          CardBox(pad: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('WORKS BEST WITH', style: T.label), const SizedBox(height: 8),
            for (final t in ['The whole timetable in the frame', 'The subject table and the weekly grid', 'A screenshot from the student portal']) Padding(padding: const EdgeInsets.only(bottom: 6), child: Row(children: [const Icon(Ic.check, size: 18, color: C.ok), const SizedBox(width: 8), Text(t, style: const TextStyle(fontSize: 14.5, color: C.body))]))])),
          const SizedBox(height: 16),
          const Btn('Choose timetable photo', icon: Ic.photo, wide: true, to: '/scan/reading'), const SizedBox(height: 12),
          const Btn('Take a photo', kind: BK.outline, icon: Ic.camera, wide: true, to: '/scan/reading?src=camera'),
          const Center(child: LinkBtn('Add classes by hand instead', to: '/manual')),
        ]))]));
}

/* ---------- 08 reading: a scan line reveals each class row ---------- */
class ReadingScreen extends StatefulWidget { const ReadingScreen({super.key}); @override State<ReadingScreen> createState() => _ReadingState(); }
class _ReadingState extends State<ReadingScreen> with SingleTickerProviderStateMixin {
  late final a = AnimationController(vsync: this, duration: const Duration(milliseconds: 2600))..forward();
  @override void dispose() { a.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final sched = context.wf.copySchedule();
    return Screen(child: Column(children: [const TopBar(title: 'Reading timetable', backLabel: 'Cancel', back: '/scan'),
      Expanded(child: AnimatedBuilder(animation: a, builder: (_, __) {
        final x = a.value, pct = x * x * (3 - 2 * x), y = pct * 245, found = sched.where((s) => y >= (s.row ?? 0)).toList(), done = a.isCompleted;
        return ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 28), children: [
          Container(height: 245, decoration: cardDeco(r: 18), clipBehavior: Clip.antiAlias, child: Stack(children: [
            Positioned.fill(child: Image.asset('assets/wf/schedule.png', fit: BoxFit.cover, alignment: Alignment.topCenter)),
            for (final r in found) Positioned(left: 6, right: 6, top: (r.row ?? 0) - 6.0, height: 13, child: Container(decoration: BoxDecoration(color: const Color(0x38F3B53A), borderRadius: BorderRadius.circular(4), border: Border.all(color: C.goldLine, width: 1.5)))),
            if (!done) Positioned(left: 0, right: 0, top: y, child: Column(children: [Container(height: 46, transform: Matrix4.translationValues(0, -46, 0), decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Color(0x472E6FB8), Color(0x002E6FB8)]))),
              Container(height: 3, transform: Matrix4.translationValues(0, -46, 0), color: C.gold)])),
          ])),
          const SizedBox(height: 16),
          Row(children: [Expanded(child: Text(done ? 'All 7 subjects read · 15 meetings' : 'Reading your timetable…', style: T.h3)), Pill('${found.length} of 7 subjects read')]),
          const SizedBox(height: 8),
          ClipRRect(borderRadius: BorderRadius.circular(3), child: LinearProgressIndicator(value: found.length / 7, minHeight: 6, color: C.navy2, backgroundColor: C.sand)),
          const SizedBox(height: 16),
          if (found.isNotEmpty) ListBox([for (final r in found) Row2(title: r.code, sub: r.title, minH: 52, trailing: Pill('${r.m.length} meetings'))]),
          const SizedBox(height: 16),
          Visibility(visible: done, maintainSize: true, maintainAnimation: true, maintainState: true, child: const Btn('Review 7 subjects', wide: true, to: '/scan/review')),
        ]);
      }))]));
  }
}

/* ---------- 09–11 review ---------- */
class ReviewScreen extends StatefulWidget { const ReviewScreen({super.key}); @override State<ReviewScreen> createState() => _ReviewState(); }
class _ReviewState extends State<ReviewScreen> {
  String? editKey; final room = TextEditingController(), start = TextEditingController(), end = TextEditingController();
  @override
  Widget build(BuildContext context) {
    final s = context.wf, D = s.draftOf(), total = D.fold<int>(0, (a, x) => a + x.m.length), allOpen = s.openSubj.length == D.length;
    return Screen(child: Column(children: [const TopBar(title: 'Check your classes', backLabel: 'Retake', back: '/scan'),
      Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 20), children: [
        Text('7 subjects, $total meetings', style: T.h1()), const SizedBox(height: 8),
        Row(children: [const Expanded(child: Text('Open a subject to check its days, times and rooms.', style: T.small)), LinkBtn(allOpen ? 'Collapse all' : 'Show all $total', onTap: () => s.update(() => s.openSubj = allOpen ? [] : [for (var i = 0; i < D.length; i++) i]))]),
        for (var si = 0; si < D.length; si++) _subj(context, D, si),
      ])),
      Container(padding: const EdgeInsets.fromLTRB(20, 12, 20, 10), decoration: const BoxDecoration(color: C.cream, border: Border(top: BorderSide(color: C.line))), child: Column(children: [
        Btn('Save schedule', icon: Ic.check, wide: true, onTap: () { s.update(() { s.saved = s.draft ?? s.copySchedule(); s.draft = null; s.lastEdit = null; s.firstTime = false; }); context.go('/schedule?view=week&day=1&saved=1'); }),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [const LinkBtn('Retake photo', to: '/scan'), const Text('·', style: TextStyle(color: C.line2)),
          LinkBtn('Cancel', onTap: () { final had = s.saved != null; s.update(() { s.draft = null; s.lastEdit = null; s.toast = 'Scan cancelled. Your schedule didn’t change.'; }); context.go(had ? '/schedule' : '/home'); })]),
      ])),
    ]));
  }
  Widget _subj(BuildContext context, List<Subject> D, int si) {
    final s = context.wf, x = D[si], open = s.openSubj.contains(si), rooms = x.m.map((m) => m.room).toSet().join(', '), editedHere = s.lastEdit != null && s.lastEdit!.key.startsWith('$si-');
    return Padding(padding: const EdgeInsets.only(top: 12), child: Container(decoration: cardDeco(border: editedHere ? C.goldLine : C.line), clipBehavior: Clip.antiAlias, child: Column(children: [
      InkWell(onTap: () => s.update(() => open ? s.openSubj.remove(si) : s.openSubj.add(si)), child: Padding(padding: const EdgeInsets.fromLTRB(16, 14, 14, 14), child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [Text(x.code, style: T.h3), if (editedHere) ...[const SizedBox(width: 8), const Pill('Edited', kind: PK.gold)]]),
          Text(x.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small),
          const SizedBox(height: 2), Text('${x.m.map((m) => s.data.day(m.day).substring(0, 3)).join(' · ')}  |  $rooms', style: const TextStyle(fontFamily: T.ui, fontSize: 13, fontWeight: FontWeight.w700, color: C.navy2))])),
        Column(children: [Text('${x.m.length}', style: const TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: 20, color: C.navy)), Text('meeting${x.m.length > 1 ? 's' : ''}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: C.muted))]),
        const SizedBox(width: 10), AnimatedRotation(turns: open ? .5 : 0, duration: const Duration(milliseconds: 200), child: const Icon(Ic.caret, color: C.navy2)),
      ]))),
      if (open) Padding(padding: const EdgeInsets.fromLTRB(12, 0, 12, 12), child: Column(children: [for (var mi = 0; mi < x.m.length; mi++) _meeting(context, x, si, mi)])),
    ])));
  }
  Widget _meeting(BuildContext context, Subject x, int si, int mi) {
    final s = context.wf, m = x.m[mi], key = '$si-$mi', edited = s.lastEdit?.key == key, day = s.data.day(m.day);
    if (editKey == key) {
      return Container(margin: const EdgeInsets.only(top: 8), padding: const EdgeInsets.all(14), decoration: cardDeco(color: C.cream, border: C.navy2), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Edit ${x.code} · $day', style: T.h3), const SizedBox(height: 12),
        const Text('Room', style: T.label), const SizedBox(height: 6), TextField(controller: room, autofocus: true, decoration: fieldDeco('')), const SizedBox(height: 12),
        Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Starts', style: T.label), const SizedBox(height: 6), TextField(controller: start, decoration: fieldDeco(''))])), const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Ends', style: T.label), const SizedBox(height: 6), TextField(controller: end, decoration: fieldDeco(''))]))]),
        const SizedBox(height: 12),
        Row(children: [Expanded(child: Btn('Cancel', kind: BK.outline, small: true, onTap: () => setState(() => editKey = null))), const SizedBox(width: 10),
          Expanded(child: Btn('Save meeting', small: true, onTap: () { s.update(() { final prev = m.copy(); final D = s.draftOf(); D[si].m[mi] = Meeting(prev.day, start.text.trim().isEmpty ? prev.start : start.text.trim(), end.text.trim().isEmpty ? prev.end : end.text.trim(), room.text.trim().isEmpty ? prev.room : room.text.trim());
            s.lastEdit = (key: key, prev: prev, label: '${x.code} $day'); }); setState(() => editKey = null); }))]),
      ]));
    }
    return Column(children: [
      Container(margin: const EdgeInsets.only(top: 8), padding: const EdgeInsets.fromLTRB(14, 10, 4, 10), decoration: cardDeco(color: edited ? C.goldSoft : C.cream, border: edited ? C.goldLine : C.line, r: 14),
        child: Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(day, style: T.h3.copyWith(fontSize: 15)), Text(range(m.start, m.end), style: T.small)])), Text(m.room, style: T.room(22)),
          IconBtn(Ic.edit, label: 'Edit ${x.code} $day', onTap: () => setState(() { editKey = key; room.text = m.room; start.text = m.start; end.text = m.end; }))])),
      if (edited) Padding(padding: const EdgeInsets.only(top: 8), child: NoteBox(Text('Updated ${s.lastEdit!.label}.'), kind: NK.ok, icon: Ic.check,
          trailing: LinkBtn('Undo', icon: Ic.undo, onTap: () => s.update(() { s.draftOf()[si].m[mi] = s.lastEdit!.prev; s.lastEdit = null; })))),
    ]);
  }
}

/* ---------- 33 add a class by hand ---------- */
class ManualScreen extends StatefulWidget { const ManualScreen({super.key}); @override State<ManualScreen> createState() => _ManualState(); }
class _ManualState extends State<ManualScreen> {
  int d0 = 3; final subject = TextEditingController(), start = TextEditingController(), end = TextEditingController(), room = TextEditingController();
  @override
  Widget build(BuildContext context) {
    final s = context.wf;
    Widget f(String l, TextEditingController c, String ph) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(l, style: T.label), const SizedBox(height: 8), TextField(controller: c, decoration: fieldDeco(ph))]);
    return Screen(child: Column(children: [const TopBar(title: 'Add a class', back: '/home'),
      Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 28), children: [
        Text('Add a class', style: T.h1()), const SizedBox(height: 16),
        f('Subject', subject, 'e.g. CIT 213 Human Computer Interaction 2'), const SizedBox(height: 16),
        const Text('Day', style: T.label), const SizedBox(height: 8),
        Seg([for (var k = 1; k <= 6; k++) s.data.day(k).substring(0, 3)], selected: d0 - 1, onTap: (i) => setState(() => d0 = i + 1)), const SizedBox(height: 16),
        Row(children: [Expanded(child: f('Starts', start, '7:00 AM')), const SizedBox(width: 10), Expanded(child: f('Ends', end, '10:00 AM'))]), const SizedBox(height: 16),
        f('Room', room, 'e.g. ICT 306'), const SizedBox(height: 16),
        Btn('Save class', wide: true, onTap: () {
          s.update(() { s.saved ??= s.copySchedule(); s.signed = true;
            final subj = subject.text.trim(), r = room.text.trim();
            if (subj.isNotEmpty && r.isNotEmpty) { final parts = subj.split(RegExp(r'\s+(?=[A-Z][a-z])')); s.saved!.add(Subject(parts.first, parts.length > 1 ? parts.skip(1).join(' ') : subj, null, [Meeting(d0, start.text.isEmpty ? '7:00 AM' : start.text, end.text.isEmpty ? '8:00 AM' : end.text, r)])); }
            s.toast = 'Class saved'; });
          context.go('/schedule');
        }),
        const Center(child: LinkBtn('Cancel', to: '/home')),
      ]))]));
  }
}

/* ---------- 12–14 schedule ---------- */
class ScheduleScreen extends StatelessWidget {
  const ScheduleScreen({super.key, this.view, this.day, this.saved = false}); final String? view; final int? day; final bool saved;
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data; s.saved ??= s.copySchedule();
    final v = view ?? s.view, wd = day ?? s.weekDay; s.view = v; s.weekDay = wd;
    final sched = s.saved!, showDay = v == 'today' ? d.todayDay : wd, isToday = showDay == d.todayDay && v == 'today';
    final items = <Item>[]; for (var si = 0; si < sched.length; si++) { for (var mi = 0; mi < sched[si].m.length; mi++) { if (sched[si].m[mi].day == showDay) items.add(Item(sched[si], si, mi, sched[si].m[mi])); } }
    items.sort((a, b) => mins(a.m.start) - mins(b.m.start));
    final total = sched.fold<int>(0, (a, x) => a + x.m.length);
    final span = items.isNotEmpty ? '${items.length} class${items.length > 1 ? 'es' : ''}, ${items.first.m.start} to ${items.last.m.end}' : 'No classes';
    return Screen(tab: Tab4.schedule, child: Column(children: [const LockupBar(), Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 110), children: [
      if (saved) ...[NoteBox(rich('**Schedule saved.** ${sched.length} subjects · $total weekly meetings.', style: const TextStyle(fontFamily: T.ui, fontSize: 14.5, color: Color(0xFF0E5730)), bold: const TextStyle(fontWeight: FontWeight.w700)), kind: NK.ok, icon: Ic.check), const SizedBox(height: 16)],
      Row(children: [Expanded(child: Text('My schedule', style: T.h1())), Seg(const ['Today', 'Week'], small: true, selected: v == 'today' ? 0 : 1, onTap: (i) => context.go(i == 0 ? '/schedule?view=today' : '/schedule?view=week&day=$wd'))]),
      const SizedBox(height: 16),
      if (v == 'week') ...[Row(children: [for (var k = 1; k <= 6; k++) Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 3), child: _WeekDay(k, on: k == wd, ms: [for (final x in sched) ...x.m.where((m) => m.day == k)])))]), const SizedBox(height: 16)],
      Text(v == 'today' ? 'Today · ${d.day(d.todayDay)}' : d.day(wd), style: T.h2), Text(span, style: T.small), const SizedBox(height: 16),
      if (items.isNotEmpty) _Rail(items: items, isToday: isToday)
      else Container(padding: const EdgeInsets.all(18), decoration: cardDeco(color: C.sand, border: C.line2), child: Column(children: [Text('No classes on ${d.day(showDay)}', style: T.h3), const SizedBox(height: 4), const Text('Pick another day above to see its classes.', style: T.small)])),
      const Center(child: LinkBtn('Scan a new timetable', to: '/scan')),
    ]))]));
  }
}
class _WeekDay extends StatelessWidget {
  const _WeekDay(this.k, {required this.on, required this.ms}); final int k; final bool on; final List<Meeting> ms;
  @override
  Widget build(BuildContext context) {
    final d = context.d, today = k == d.todayDay; const s0 = 7 * 60, s1 = 18 * 60;
    return Semantics(selected: on, button: true, label: '${d.day(k)}, ${ms.length} classes', child: GestureDetector(onTap: () => context.go('/schedule?view=week&day=$k'), child: Container(padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(color: on ? C.navy2 : Colors.white, borderRadius: BorderRadius.circular(16), border: on ? null : Border.all(color: C.line)),
      child: Column(children: [Text(d.day(k).substring(0, 3), style: TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 13.5, color: on ? Colors.white : C.ink)),
        if (today) Container(width: 5, height: 5, margin: const EdgeInsets.only(top: 2), decoration: const BoxDecoration(color: C.gold, shape: BoxShape.circle)),
        const SizedBox(height: 6),
        Container(width: 14, height: 64, decoration: BoxDecoration(color: on ? const Color(0x2EFFFFFF) : C.sand, borderRadius: BorderRadius.circular(7)), clipBehavior: Clip.antiAlias,
          child: Stack(children: [for (final m in ms) Positioned(left: 2, right: 2, top: (mins(m.start) - s0) / (s1 - s0) * 64, height: ((mins(m.end) - mins(m.start)) / (s1 - s0) * 64).clamp(3, 64), child: Container(decoration: BoxDecoration(color: on ? C.gold : C.navy2, borderRadius: BorderRadius.circular(3))))])),
        const SizedBox(height: 6), Text(ms.isEmpty ? '–' : '${ms.length}', style: TextStyle(fontFamily: T.ui, fontSize: 12, fontWeight: FontWeight.w700, color: on ? const Color(0xFFD5DEF2) : C.muted))]))));
  }
}
class _Rail extends StatelessWidget {
  const _Rail({required this.items, required this.isToday}); final List<Item> items; final bool isToday;
  @override
  Widget build(BuildContext context) {
    final s = context.wf, now = s.now, first = mins(items.first.m.start), last = items.map((it) => mins(it.m.end)).reduce((a, b) => a > b ? a : b);
    final s0 = ((isToday && now < first ? now : first) ~/ 60) * 60, s1 = ((last + 59) ~/ 60) * 60; const k = 1.05;
    double y(int m) => (m - s0) * k;
    final next = isToday ? items.where((it) => mins(it.m.start) > now).firstOrNull : null;
    return SizedBox(height: (s1 - s0) * k + 8, child: Stack(clipBehavior: Clip.none, children: [
      for (var h = s0; h <= s1; h += 60) Positioned(left: 0, right: 0, top: y(h) - 8, child: Row(children: [SizedBox(width: 52, child: Text('${fmtShort(h)} ${h < 720 ? 'AM' : 'PM'}', style: const TextStyle(fontFamily: T.ui, fontSize: 11.5, fontWeight: FontWeight.w700, color: C.muted))),
        Expanded(child: Container(height: 1, color: C.line))])),
      for (var i = 1; i < items.length; i++) if (mins(items[i].m.start) - mins(items[i - 1].m.end) >= 30) Builder(builder: (_) { final a = mins(items[i - 1].m.end), b = mins(items[i].m.start), g = b - a;
        return Positioned(left: 52, right: 0, top: y(a), height: (b - a) * k - 6, child: Container(alignment: Alignment.center, decoration: BoxDecoration(color: const Color(0x1FD5C8AE), borderRadius: BorderRadius.circular(14), border: Border.all(color: C.line, width: 1.5)),
          child: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: C.cream, borderRadius: BorderRadius.circular(8)), child: Text('Free for ${g >= 60 ? '${g ~/ 60} h${g % 60 > 0 ? ' ${g % 60} min' : ''}' : '$g min'}', style: const TextStyle(fontFamily: T.ui, fontSize: 12.5, fontWeight: FontWeight.w700, color: C.muted))))); }),
      for (final it in items) Builder(builder: (_) { final a = mins(it.m.start), b = mins(it.m.end), isNext = it == next, past = isToday && b <= now, onNow = isToday && a <= now && b > now, mv = s.movedNote(it.x.code, it.mi);
        return Positioned(left: 52, right: 0, top: y(a), height: (b - a) * k - 6, child: Opacity(opacity: past ? .55 : 1, child: Material(borderRadius: BorderRadius.circular(16), clipBehavior: Clip.antiAlias, color: isNext ? C.goldSoft : Colors.white,
          child: InkWell(onTap: () => context.push('/class/${enc(it.x.code)}/${it.mi}'), child: Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10), decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: isNext ? C.gold : const Color(0x14132D6B), width: isNext ? 1.5 : 1)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${it.x.code}${isNext ? ' · next' : onNow ? ' · now' : ''}', style: const TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 15.5, color: C.ink)),
              if (mv != null) Text('Moved from ${mv.from} today', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: C.warn)),
              Flexible(child: Text(it.x.title, maxLines: b - a < 100 ? 1 : 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: T.ui, fontSize: 13.5, height: 1.3, color: C.body))),
              Text(range(it.m.start, it.m.end), style: TextStyle(fontFamily: T.ui, fontSize: 13, fontWeight: FontWeight.w700, color: isNext ? C.warn : C.blue))])),
              Text(it.m.room, style: T.room(22))])))))); }),
      if (isToday && now >= s0 && now <= s1) Positioned(left: 42, right: -4, top: y(now) - 1, child: Row(children: [Container(width: 10, height: 10, decoration: const BoxDecoration(color: C.gold, shape: BoxShape.circle)), Expanded(child: Container(height: 2, color: C.goldDeep)),
        Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2), decoration: BoxDecoration(color: C.goldDeep, borderRadius: BorderRadius.circular(8)), child: Text(fmtMin(now), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white)))])),
    ]));
  }
}

/* ---------- 15–16 class ---------- */
class ClassScreen extends StatelessWidget {
  const ClassScreen({super.key, required this.code, required this.mi, this.flash = false, this.fromAnswer = false}); final String code; final int mi; final bool flash, fromAnswer;
  @override
  Widget build(BuildContext context) {
    final s = context.wf, d = s.data, list = s.saved ?? s.copySchedule(), x = list.where((c) => c.code == code).firstOrNull ?? list[1];
    final m = mi < x.m.length ? x.m[mi] : x.m.first, bid = buildingOf(m.room), b = d.places[bid], mv = s.movedNote(x.code, mi);
    Widget tile(String l, Widget v) => Expanded(child: TweenAnimationBuilder<Color?>(key: ValueKey('$mi$l'), tween: ColorTween(begin: flash ? C.goldSoft : Colors.white, end: Colors.white), duration: const Duration(milliseconds: 900),
        builder: (_, c, child) => Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14), decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(18), border: Border.all(color: C.line)), child: child),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(l, style: T.label), const SizedBox(height: 6), v])));
    return Screen(tab: Tab4.schedule, child: Column(children: [TopBar(title: x.code, backLabel: fromAnswer ? 'Answer' : 'Schedule', back: '/schedule'),
      Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 110), children: [
        Text(x.title, style: T.h1()), const SizedBox(height: 8), Text('${x.code} · ${x.m.length} meetings a week', style: T.small), const SizedBox(height: 16),
        Seg([for (final q in x.m) d.day(q.day)], selected: mi, onTap: (i) => context.replace('/class/${enc(x.code)}/$i?flash=1')), const SizedBox(height: 16),
        Row(children: [tile('TIME', Text(range(m.start, m.end), style: T.h2)), const SizedBox(width: 10), tile('ROOM', Text(m.room, style: T.room()))]),
        if (mv != null) ...[const SizedBox(height: 16), NoteBox(rich('Today only: moved from **${mv.from}** to **${mv.to}**.', style: const TextStyle(fontFamily: T.ui, fontSize: 14, color: Color(0xFF5C3A00))), kind: NK.warn, icon: Ic.alert)],
        const SizedBox(height: 16), Text('${b?['name'] ?? 'Building not recorded'} · ${d.day(m.day)}s', style: T.body), const SizedBox(height: 16),
        Btn('Find classroom', icon: Ic.pin, wide: true, to: bid != null ? '/map/place/$bid?room=${enc(m.room)}&from=class' : '/map?q=${enc(m.room)}'), const SizedBox(height: 12),
        Btn('Ask about this class', kind: BK.outline, wide: true, onTap: () => openAsk(context)),
      ]))]));
  }
}

/* ---------- 06D notifications ---------- */
class NotificationsScreen extends StatefulWidget { const NotificationsScreen({super.key}); @override State<NotificationsScreen> createState() => _NotesState(); }
class _NotesState extends State<NotificationsScreen> {
  bool on = true; late final WFState s;
  @override
  void initState() {
    super.initState(); s = context.wfr; s.saved ??= s.copySchedule();
    if (s.notes.isEmpty) { final n = s.reminderNote(); if (n != null) { s.addNote(Note('saved', 'info', '6:30 AM', 'Schedule saved', '7 subjects', read: true)); s.addNote(n); s.now = s.data.reminder['at'] as int; } }
  }
  @override void dispose() { for (final n in s.notes) { n.read = true; } super.dispose(); }
  @override
  Widget build(BuildContext context) => Screen(tab: Tab4.home, child: Column(children: [const TopBar(title: 'Notifications', backLabel: 'Home', back: '/home'),
        Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 110), children: [
          Text('Notifications', style: T.h1()), const SizedBox(height: 16),
          if (s.notes.isEmpty) Container(padding: const EdgeInsets.all(18), decoration: cardDeco(color: C.sand), child: const Column(children: [Text('You’re all caught up', style: T.h3), Text('Reminders show up here.', style: T.small)]))
          else ...[const Text('Today', style: T.label), const SizedBox(height: 10), for (final n in s.notes) Padding(padding: const EdgeInsets.only(bottom: 12), child: _noteCard(context, n))],
          CardBox(pad: const EdgeInsets.all(16), child: Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Class reminders', style: T.h3), Text(on ? '15 min before each class' : 'Off', style: T.small)])),
            Switch(value: on, activeTrackColor: C.ok, onChanged: (v) => setState(() => on = v))])),
        ]))]));
  Widget _noteCard(BuildContext context, Note n) {
    if (n.kind != 'class') {
      return CardBox(pad: const EdgeInsets.all(14), child: Row(children: [Container(width: 32, height: 32, decoration: const BoxDecoration(color: C.okSoft, shape: BoxShape.circle), child: const Icon(Ic.check, color: C.ok, size: 18)), const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(n.title, style: T.h3), Text(n.body, style: T.small)])), Text(n.at, style: T.small)]));
    }
    return Container(padding: const EdgeInsets.all(16), decoration: cardDeco(border: n.read ? C.line : C.goldLine, shadow: true), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Container(width: 34, height: 34, padding: const EdgeInsets.all(3), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(9), boxShadow: const [BoxShadow(color: Color(0x1F000000), blurRadius: 4)]), child: Image.asset('assets/wf/logo.png')),
        const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Class reminder', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: C.ink)), Text(n.at, style: const TextStyle(fontSize: 12, color: C.muted))])),
        if (!n.read) Container(width: 10, height: 10, decoration: const BoxDecoration(color: C.gold, shape: BoxShape.circle))]),
      const SizedBox(height: 10), Text(n.title, style: const TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: 20, color: C.navy)), const SizedBox(height: 4), Text(n.body, style: T.body), const SizedBox(height: 12),
      ClipRRect(borderRadius: BorderRadius.circular(14), child: SizedBox(height: 110, child: Stack(children: [const Positioned.fill(child: MiniRoute()), Positioned(left: 8, bottom: 8, child: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)), child: Text('CICT → ${n.room}', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: C.navy))))]))),
      const SizedBox(height: 14),
      Row(children: [Expanded(child: Btn('Show on map', icon: Ic.map, to: n.map)), const SizedBox(width: 10), Expanded(child: Btn('View class', kind: BK.outline, to: n.cls))]),
    ]));
  }
}

/* ---------- 06C lock screen ---------- */
class LockScreen extends StatefulWidget { const LockScreen({super.key}); @override State<LockScreen> createState() => _LockState(); }
class _LockState extends State<LockScreen> {
  @override
  void initState() { super.initState(); final s = context.wfr; s.saved ??= s.copySchedule(); if (!s.notes.any((n) => n.id == 'remind')) { final n = s.reminderNote(); if (n != null) s.addNote(n); } s.now = s.data.reminder['at'] as int; }
  @override
  Widget build(BuildContext context) {
    final s = context.wf, n = s.notes.where((x) => x.id == 'remind').firstOrNull, t = fmtMin(s.data.reminder['at'] as int).replaceAll(RegExp(r' (AM|PM)'), '');
    const w = TextStyle(fontFamily: T.ui, color: Colors.white);
    return Scaffold(body: Container(decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF1E4497), C.navy, C.night])), child: SafeArea(child: Column(children: [
      const SizedBox(height: 30), const Icon(Ic.lock, color: Colors.white, size: 18), const SizedBox(height: 6),
      Text(s.data.day(s.data.todayDay), style: w.copyWith(fontSize: 18, fontWeight: FontWeight.w600)),
      Text(t, style: const TextStyle(fontFamily: T.display, fontSize: 86, fontWeight: FontWeight.w700, height: 1, color: Colors.white)),
      const SizedBox(height: 28),
      if (n != null) Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: const Color(0xE6FFFDF8), borderRadius: BorderRadius.circular(22)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Container(width: 30, height: 30, padding: const EdgeInsets.all(3), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)), child: Image.asset('assets/wf/logo.png')), const SizedBox(width: 8), const Text('WayFinder', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: C.ink)), const Spacer(), const Text('now', style: TextStyle(fontSize: 12.5, color: C.muted))]),
        const SizedBox(height: 8), Text(n.title, style: const TextStyle(fontFamily: T.ui, fontSize: 16, fontWeight: FontWeight.w700, color: C.ink)), Text(n.body, style: const TextStyle(fontSize: 14.5, color: C.body)), const SizedBox(height: 10),
        ClipRRect(borderRadius: BorderRadius.circular(14), child: const SizedBox(height: 120, child: MiniRoute())), const SizedBox(height: 10),
        Row(children: [Expanded(child: Btn('Show on map', icon: Ic.map, small: true, to: n.map)), const SizedBox(width: 8), Expanded(child: Btn('View class', kind: BK.ghost, small: true, to: n.cls))]),
      ]))),
      const Spacer(), Text('Tap an action to open WayFinder', style: w.copyWith(fontSize: 12, color: const Color(0x99FFFFFF))), const SizedBox(height: 8),
      Container(width: 130, height: 5, margin: const EdgeInsets.only(bottom: 10), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(3))),
    ]))));
  }
}
