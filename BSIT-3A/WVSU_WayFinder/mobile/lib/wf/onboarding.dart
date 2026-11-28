// 00A–04: splash → three intro slides → sign-in → profile setup. Google sign-in is simulated, as in the prototype.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core.dart';
import 'ui.dart';

const _navyBg = RadialGradient(center: Alignment(0, -.16), radius: .9, colors: [Color(0xFF1E4497), C.navy, C.night], stops: [0, .48, 1]);
Widget lockup({double emblem = 82, double wm = 70}) => Row(mainAxisSize: MainAxisSize.min, children: [
      Image.asset('assets/wf/emblem-white-flat.png', height: emblem),
      Container(width: 1.5, height: emblem * .78, margin: const EdgeInsets.symmetric(horizontal: 16), decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Color(0x8CFFFFFF), Colors.transparent]))),
      Image.asset('assets/wf/logo-lockup-white.png', height: wm, semanticLabel: 'WVSU WayFinder'),
    ]);

/* ---------- 00A splash ---------- */
class SplashScreen extends StatefulWidget { const SplashScreen({super.key, this.signing = false}); final bool signing; @override State<SplashScreen> createState() => _SplashState(); }
class _SplashState extends State<SplashScreen> {
  Timer? t;
  @override
  void initState() {
    super.initState();
    if (widget.signing) {
      t = Timer(const Duration(milliseconds: 1100), () { final s = context.wfr; s.update(() { s.signed = true; if (!s.firstTime) s.saved ??= s.copySchedule(); s.toast = 'Signed in as **${s.data.wf['student']['email']}**'; }); context.go(s.profile != null ? '/home' : '/profile'); });
    } else {
      t = Timer(const Duration(milliseconds: 2300), () { if (mounted) context.go('/intro'); });
    }
  }
  @override void dispose() { t?.cancel(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Scaffold(body: GestureDetector(onTap: widget.signing ? null : () => context.go('/intro'),
      child: Container(decoration: const BoxDecoration(gradient: _navyBg), child: Stack(alignment: Alignment.center, children: [
        TweenAnimationBuilder<double>(tween: Tween(begin: 0, end: 1), duration: const Duration(milliseconds: 900), curve: Curves.easeOutQuart,
            builder: (_, v, child) => Opacity(opacity: v, child: Transform.scale(scale: .72 + .28 * v, child: child)), child: FittedBox(child: lockup())),
        if (widget.signing) Positioned(top: MediaQuery.of(context).size.height * .62, child: const Column(children: [
          SizedBox(width: 30, height: 30, child: CircularProgressIndicator(color: C.gold, strokeWidth: 3)), SizedBox(height: 14),
          Text('Signing you in', style: TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: 20, color: Colors.white)),
          Text('Checking your WVSU account…', style: TextStyle(fontFamily: T.ui, fontSize: 14, color: Color(0xB3FFFFFF))),
        ]))
        else const Positioned(bottom: 44, child: Text('WEST VISAYAS STATE UNIVERSITY', style: TextStyle(fontFamily: T.ui, fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1.9, color: Color(0x9EFFFFFF)))),
      ]))));
}

/* ---------- 00B–00D intro ---------- */
class IntroScreen extends StatefulWidget { const IntroScreen({super.key}); @override State<IntroScreen> createState() => _IntroState(); }
class _IntroState extends State<IntroScreen> {
  final pc = PageController(); int i = 0;
  static const slides = [
    ('Your next class, at a glance.', 'See when it starts and which room it’s in the moment you open the app.'),
    ('Walk there, turn by turn.', 'Preview the path across campus before you set off.'),
    ('Scan your timetable once.', 'WayFinder reads your WVSU schedule. You check every class before it’s saved.'),
  ];
  @override
  Widget build(BuildContext context) => Scaffold(backgroundColor: C.cream, body: SafeArea(child: Column(children: [
        SizedBox(height: 60, child: Padding(padding: const EdgeInsets.only(left: 22, right: 12), child: Row(children: [
          Text('${i + 1} of 3', style: const TextStyle(fontFamily: T.ui, fontSize: 13, fontWeight: FontWeight.w700, color: C.muted)), const Spacer(),
          TextButton(onPressed: () => context.go('/login'), child: const Text('Skip', style: TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 15.5, color: C.navy2)))]))),
        Expanded(child: PageView(controller: pc, onPageChanged: (k) => setState(() => i = k), children: [
          for (var k = 0; k < 3; k++) Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Center(child: Stack(alignment: Alignment.center, children: [
              Container(width: 300, height: 300, decoration: const BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [Color(0x38F3B53A), Color(0x1A3F8FD2), Colors.transparent], stops: [0, .55, .7]))),
              _IntroArt(k, on: k == i)]))),
            Text(slides[k].$1, style: const TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: 32, height: 1.06, letterSpacing: -.6, color: C.navy)),
            const SizedBox(height: 10), Text(slides[k].$2, style: T.body), const SizedBox(height: 4),
          ]))])),
        Padding(padding: const EdgeInsets.fromLTRB(24, 18, 24, 26), child: Row(children: [
          for (var k = 0; k < 3; k++) GestureDetector(onTap: () => pc.animateToPage(k, duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic),
              child: AnimatedContainer(duration: const Duration(milliseconds: 350), width: k == i ? 26 : 8, height: 8, margin: const EdgeInsets.only(right: 6), decoration: BoxDecoration(color: k == i ? C.gold : C.line2, borderRadius: BorderRadius.circular(4)))),
          const Spacer(),
          Semantics(button: true, label: i == 2 ? 'Get started' : 'Next', child: GestureDetector(onTap: () => i == 2 ? context.go('/login') : pc.nextPage(duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic),
            child: AnimatedContainer(duration: const Duration(milliseconds: 400), curve: Curves.easeOutQuart, height: 56, padding: EdgeInsets.symmetric(horizontal: i == 2 ? 24 : 16),
              decoration: BoxDecoration(color: C.navy2, borderRadius: BorderRadius.circular(28), boxShadow: const [BoxShadow(color: Color(0x8C132D6B), blurRadius: 22, offset: Offset(0, 10), spreadRadius: -8)]),
              child: Row(mainAxisSize: MainAxisSize.min, children: [if (i == 2) ...[const Text('Get started', style: TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 16.5, color: Colors.white)), const SizedBox(width: 10)], const Icon(Ic.arrow, color: Colors.white)])))),
        ])),
      ])));
}
class _IntroArt extends StatelessWidget {
  const _IntroArt(this.k, {required this.on}); final int k; final bool on;
  @override
  Widget build(BuildContext context) {
    if (k == 0) {
      return SizedBox(width: 300, child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: const [BoxShadow(color: Color(0x59132D6B), blurRadius: 24, offset: Offset(0, 10), spreadRadius: -10)]),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [Needle(size: 14), SizedBox(width: 6), Text('Starts in 20 min', style: TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 13.5, color: C.navy))])),
        const SizedBox(height: 10),
        Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: const [BoxShadow(color: Color(0x66132D6B), blurRadius: 44, offset: Offset(0, 22), spreadRadius: -18)]),
            child: const Row(children: [Dial(value: 20, frac: .67, unit: 'min', size: 92), SizedBox(width: 14), Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('CIT 213', style: TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: 24, color: C.navy)), Text('Wed · 7:00–10:00 AM', style: T.small)])])),
        const SizedBox(height: 10),
        Align(alignment: Alignment.centerRight, child: Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10), decoration: BoxDecoration(color: C.goldSoft, borderRadius: BorderRadius.circular(16), border: Border.all(color: C.goldLine)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [const Text('ROOM', style: T.label), Text('ICT 306', style: T.room(30))]))),
      ]));
    }
    if (k == 1) {
      return Container(width: 320, height: 278, decoration: BoxDecoration(borderRadius: BorderRadius.circular(26), boxShadow: const [BoxShadow(color: Color(0x59132D6B), blurRadius: 44, offset: Offset(0, 22), spreadRadius: -18)]), clipBehavior: Clip.antiAlias,
          child: on ? TweenAnimationBuilder<double>(tween: Tween(begin: 0, end: 1), duration: const Duration(milliseconds: 2600), curve: Curves.easeInOut, builder: (_, v, __) => MiniRoute(progress: math.max(.01, v), head: true)) : const MiniRoute(progress: 1, head: true));
    }
    return SizedBox(width: 300, child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(height: 254, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: const [BoxShadow(color: Color(0x59132D6B), blurRadius: 44, offset: Offset(0, 22), spreadRadius: -18)]), clipBehavior: Clip.antiAlias,
          child: Image.asset('assets/wf/schedule.png', fit: BoxFit.cover, alignment: Alignment.topCenter, width: 300)),
      Transform.translate(offset: const Offset(0, -18), child: Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10), decoration: BoxDecoration(color: C.navy, borderRadius: BorderRadius.circular(16)),
          child: const Row(mainAxisSize: MainAxisSize.min, children: [Icon(Ic.check, color: C.gold, size: 18), SizedBox(width: 8), Text('7 of 7 subjects read', style: TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 14, color: Colors.white))]))),
    ]));
  }
}

/* ---------- 01–04 sign-in ---------- */
class _Trail extends CustomPainter {
  _Trail(this.t); final double t;
  static const pts = [[-0.05, 0.86], [0.15, 0.86], [0.24, 0.69], [0.39, 0.71], [0.55, 0.74], [0.61, 0.95], [0.77, 0.83], [0.92, 0.73], [0.86, 0.48], [0.93, 0.30]];
  @override
  void paint(Canvas c, Size s) {
    Offset p(int i) => Offset(pts[i][0] * s.width, pts[i][1] * s.height);
    final path = Path()..moveTo(p(0).dx, p(0).dy)..cubicTo(p(1).dx, p(1).dy, p(2).dx, p(2).dy, p(3).dx, p(3).dy)..cubicTo(p(4).dx, p(4).dy, p(5).dx, p(5).dy, p(6).dx, p(6).dy)..cubicTo(p(7).dx, p(7).dy, p(8).dx, p(8).dy, p(9).dx, p(9).dy);
    final m = path.computeMetrics().first;
    for (var d = 0.0; d < m.length; d += 9) { c.drawPath(m.extractPath(d, d + 2), Paint()..color = const Color(0x1AFFFFFF)..strokeWidth = 2..style = PaintingStyle.stroke..strokeCap = StrokeCap.round); }
    c.drawPath(m.extractPath(0, m.length * t), Paint()..color = C.gold..strokeWidth = 2.5..style = PaintingStyle.stroke..strokeCap = StrokeCap.round);
    final tan = m.getTangentForOffset(math.max(.01, m.length * t)); if (tan == null) return;
    c.save(); c.translate(tan.position.dx, tan.position.dy); c.rotate(-tan.angle);
    c.drawPath(Path()..moveTo(15, 0)..lineTo(-14, -13)..lineTo(-7, 0)..close(), Paint()..color = Colors.white);
    c.drawPath(Path()..moveTo(15, 0)..lineTo(-7, 0)..lineTo(-14, 13)..close(), Paint()..color = C.gold); c.restore();
  }
  @override bool shouldRepaint(_Trail o) => o.t != t;
}
class _Hero extends StatelessWidget {
  const _Hero({required this.play}); final bool play;
  @override
  Widget build(BuildContext context) => Container(decoration: const BoxDecoration(gradient: RadialGradient(center: Alignment(0, -.2), radius: .85, colors: [Color(0xFF1E4497), C.navy, C.night], stops: [0, .5, 1])),
      child: Stack(fit: StackFit.expand, children: [
        TweenAnimationBuilder<double>(tween: Tween(begin: play ? 0 : 1, end: 1), duration: Duration(milliseconds: play ? 1900 : 1), curve: const Interval(.2, 1, curve: Curves.easeOutCubic), builder: (_, v, __) => CustomPaint(painter: _Trail(math.max(.001, v)))),
        Padding(padding: const EdgeInsets.only(bottom: 26), child: Center(child: FittedBox(child: lockup(emblem: 74, wm: 64)))),
      ]));
}
class LoginScreen extends StatefulWidget { const LoginScreen({super.key, this.google = false, this.wrong = false, this.state}); final bool google, wrong; final String? state; @override State<LoginScreen> createState() => _LoginState(); }
class _LoginState extends State<LoginScreen> {
  Timer? t; late final bool play;
  @override
  void initState() {
    super.initState(); final s = context.wfr; play = !s.introPlayed && !widget.google && !widget.wrong; if (!s.introPlayed) s.introPlayed = true;
    if (widget.google) t = Timer(const Duration(milliseconds: 1600), () { if (mounted) context.go('/signing-in'); });
  }
  @override void dispose() { t?.cancel(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final d = context.d, out = GoRouterState.of(context).uri.queryParameters['out'] != null;
    final googleBtn = Btn(widget.wrong ? 'Choose another account' : 'Continue with Google', kind: BK.google, wide: true, onTap: () => context.go('/google'),
        leading: Container(width: 36, height: 36, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle), alignment: Alignment.center, child: const Text('G', style: TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 20, color: Color(0xFF4285F4)))));
    final or = Row(children: [const Expanded(child: Divider(color: C.line)), const Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('or', style: TextStyle(fontFamily: T.ui, fontSize: 13, fontWeight: FontWeight.w600, color: C.muted))), const Expanded(child: Divider(color: C.line))]);
    final sheet = Container(width: double.infinity, padding: const EdgeInsets.fromLTRB(24, 30, 24, 18), decoration: const BoxDecoration(color: C.cream, borderRadius: BorderRadius.vertical(top: Radius.circular(28)), boxShadow: [BoxShadow(color: Color(0x59050E28), blurRadius: 30, offset: Offset(0, -12))]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        if (out) ...[const Row(children: [Icon(Ic.check, color: C.ok, size: 18), SizedBox(width: 6), Text('You’re logged out.', style: TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, color: C.ok))]), const SizedBox(height: 10)],
        if (widget.wrong) ...[const Tag('Not a WVSU account', gold: true, icon: Ic.user), const SizedBox(height: 12)],
        Text(widget.wrong ? 'Use your WVSU account' : 'Find your next class.', style: const TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: 32, height: 1.05, letterSpacing: -.6, color: C.navy)),
        const SizedBox(height: 10),
        widget.wrong ? rich('**${d.wf['student']['personal']}** is a personal Google account. WayFinder works with your **@wvsu.edu.ph** account.') : rich('Use your **@wvsu.edu.ph** account to see your schedule and find your room.'),
        const SizedBox(height: 22), googleBtn,
        if (widget.state == 'cancelled') ...[const SizedBox(height: 8), const Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(Ic.alert, color: C.err, size: 18), SizedBox(width: 8), Expanded(child: Text('Sign-in cancelled. Nothing changed. You can try again.', style: TextStyle(fontFamily: T.ui, fontSize: 14, fontWeight: FontWeight.w600, color: C.err)))])],
        const SizedBox(height: 12), or, const SizedBox(height: 12),
        Btn('Explore campus map', kind: BK.outline, icon: Ic.map, wide: true, onTap: () => context.go('/map?guest=1')),
        const SizedBox(height: 14),
        if (widget.wrong) Center(child: LinkBtn('Back to start', onTap: () => context.go('/login')))
        else const Center(child: Text('Only WVSU Google accounts can sign in. WayFinder never posts to your account.', textAlign: TextAlign.center, style: TextStyle(fontFamily: T.ui, fontSize: 12.5, height: 1.4, color: C.muted))),
      ]));
    return Scaffold(backgroundColor: C.night, body: Stack(children: [
      Column(children: [Expanded(child: _Hero(play: play)), Transform.translate(offset: const Offset(0, 0), child: sheet)]),
      if (widget.google) ...[
        const Positioned.fill(child: ColoredBox(color: Color(0x6B131728))),
        Positioned(left: 0, right: 0, bottom: 0, child: Container(padding: const EdgeInsets.fromLTRB(20, 10, 20, 24), decoration: const BoxDecoration(color: C.cream, borderRadius: BorderRadius.vertical(top: Radius.circular(26))),
          child: Column(mainAxisSize: MainAxisSize.min, children: [const Grab(), const SizedBox(width: 40, height: 40, child: CircularProgressIndicator(color: C.navy2, backgroundColor: C.blueSoft, strokeWidth: 4)), const SizedBox(height: 12),
            const Text('Continue in Google', style: T.h2), const SizedBox(height: 6), rich('Choose your **@wvsu.edu.ph** account in the Google window.'), const SizedBox(height: 18),
            Btn('Cancel', kind: BK.outline, wide: true, onTap: () => context.go('/login?state=cancelled'))]))),
      ],
    ]));
  }
}

/* ---------- 02B–02F profile setup: three short steps ---------- */
class ProfileScreen extends StatefulWidget { const ProfileScreen({super.key, required this.step, this.edit = false, this.logout = false}); final int step; final bool edit, logout; @override State<ProfileScreen> createState() => _ProfileState(); }
class _ProfileState extends State<ProfileScreen> {
  static Profile? draft;
  Map<String, String> err = {};
  late final Map<String, TextEditingController> tc;
  Profile get x => draft!;
  @override
  void initState() {
    super.initState();
    final s = context.wfr;
    draft ??= widget.edit ? ((s.profile?.copy() ?? s.me)..consent = true) : s.me.copy();
    if (x.campus.isEmpty) x.campus = (s.data.wf['campuses'] as List).first as String;
    tc = {for (final k in ['first', 'mi', 'last', 'id', 'section']) k: TextEditingController(text: (x.toJson()[k] ?? '') as String)};
  }
  void keep() { x.first = tc['first']!.text; x.mi = tc['mi']!.text; x.last = tc['last']!.text; x.id = tc['id']!.text; x.section = tc['section']!.text; }
  Map<String, String> check(int step) {
    final e = <String, String>{};
    if (step == 1) {
      if (x.first.trim().isEmpty) e['first'] = 'Enter your first name.';
      if (x.last.trim().isEmpty) e['last'] = 'Enter your last name.';
      if (x.id.trim().isEmpty) { e['id'] = x.role == 'student' ? 'Enter your student number. It’s on your WVSU ID.' : 'Enter your employee number.'; }
      else if (!RegExp(r'^[A-Za-z0-9-]{6,14}$').hasMatch(x.id.trim())) { e['id'] = 'Use 6 to 14 letters, numbers or hyphens, as printed on your ID.'; }
    }
    if (step == 2) {
      if (x.college.isEmpty) e['college'] = 'Choose your college.';
      if (x.role == 'student') { if (x.program.isEmpty) e['program'] = 'Choose your course.'; if (x.year.isEmpty) e['year'] = 'Choose your year level.'; if (x.section.trim().isEmpty) e['section'] = 'Enter your section, for example B.'; }
    }
    if (step == 3 && !x.consent) e['consent'] = 'Tick the box to agree before you finish.';
    return e;
  }
  void next() {
    keep(); final e = check(widget.edit && widget.step == 3 ? 0 : widget.step);
    if (e.isNotEmpty) { setState(() => err = e); return; }
    final q = widget.edit ? '&edit=1' : '';
    if (widget.step < 3) { context.push('/profile?step=${widget.step + 1}$q'); return; }
    final s = context.wf, p = x; draft = null;
    s.update(() { s.profile = p; s.toast = widget.edit ? 'Profile saved' : 'Welcome, **${p.first}**. Your profile is set up.'; });
    context.go('/home');
  }
  Widget field(String k, String label, {String? hint, String? ph}) => Padding(padding: const EdgeInsets.only(bottom: 16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: T.label), if (hint != null) Text(hint, style: const TextStyle(fontFamily: T.ui, fontSize: 12.5, color: C.muted)), const SizedBox(height: 6),
        TextField(controller: tc[k], decoration: fieldDeco(ph ?? '', error: err[k]), style: const TextStyle(fontFamily: T.ui, fontSize: 16.5, color: C.ink), onChanged: (_) { if (err.containsKey(k)) setState(() => err.remove(k)); })]));
  Widget select(String label, String value, List<(String, String)> opts, String ph, ValueChanged<String> on, String k) => Padding(padding: const EdgeInsets.only(bottom: 16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: T.label), const SizedBox(height: 6),
        DropdownButtonFormField<String>(initialValue: value.isEmpty ? null : value, isExpanded: true, decoration: fieldDeco(ph, error: err[k]), hint: Text(ph), items: [for (final o in opts) DropdownMenuItem(value: o.$1, child: Text(o.$2, overflow: TextOverflow.ellipsis))],
            onChanged: (v) => setState(() { on(v ?? ''); err.remove(k); }))]));
  @override
  Widget build(BuildContext context) {
    final d = context.d, step = widget.step, stu = x.role == 'student', edit = widget.edit;
    final colleges = d.wf['colleges'] as List, col = colleges.where((c) => c['id'] == x.college).firstOrNull;
    final titles = ['About you', stu ? 'Your course' : x.role == 'faculty' ? 'Where you teach' : 'Where you work', edit ? 'Your profile' : 'Check your details'];
    final subs = ['Your name came from your Google account. Fix it if it’s wrong.', stu ? 'WayFinder uses this to suggest your rooms and your college’s offices.' : 'WayFinder uses this to point you to your building and offices.', edit ? 'This is what WayFinder knows about you.' : 'Make sure everything is right before you start.'];
    final body = <Widget>[];
    if (step == 1) {
      body.addAll([
        const Text('I am a', style: T.label), const SizedBox(height: 6),
        Seg(const ['Student', 'Faculty', 'Staff'], selected: ['student', 'faculty', 'staff'].indexOf(x.role), onTap: (i) => setState(() => x.role = ['student', 'faculty', 'staff'][i])), const SizedBox(height: 16),
        field('first', 'First name'),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [SizedBox(width: 110, child: field('mi', 'M.I. (optional)')), const SizedBox(width: 10), Expanded(child: field('last', 'Last name'))]),
        field('id', stu ? 'Student number' : 'Employee number', hint: 'As printed on your WVSU ID', ph: 'e.g. 2023M0482'),
        const Text('WVSU email', style: T.label), const SizedBox(height: 6),
        Container(height: 52, padding: const EdgeInsets.symmetric(horizontal: 16), decoration: BoxDecoration(color: C.sand, borderRadius: BorderRadius.circular(16), border: Border.all(color: C.line2, width: 1.5)),
            child: Row(children: [const Text('G  ', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF4285F4))), Text(d.wf['student']['email'] as String, style: const TextStyle(fontFamily: T.ui, fontSize: 16, color: C.body))])),
      ]);
    } else if (step == 2) {
      body.addAll([
        select('College', x.college, [for (final c in colleges) (c['id'] as String, '${c['name']} (${c['short']})')], 'Choose your college', (v) { x.college = v; x.program = ''; }, 'college'),
        if (stu) ...[
          select('Course', x.program, [for (final p in (col?['programs'] as List? ?? [])) (p as String, p)], col != null ? 'Choose your course' : 'Choose your college first', (v) => x.program = v, 'program'),
          const Text('Year level', style: T.label), const SizedBox(height: 6),
          Seg(const ['1st', '2nd', '3rd', '4th', '5th'], selected: ['1st', '2nd', '3rd', '4th', '5th'].indexOf(x.year), onTap: (i) => setState(() { x.year = ['1st', '2nd', '3rd', '4th', '5th'][i]; err.remove('year'); })),
          if (err['year'] != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(err['year']!, style: const TextStyle(color: C.err, fontSize: 13))),
          const SizedBox(height: 16),
          field('section', 'Section', hint: 'The letter or number after your year, like 3-B', ph: 'e.g. B'),
        ],
        select('Campus', x.campus, [for (final c in d.wf['campuses'] as List) (c as String, c)], 'Choose your campus', (v) => x.campus = v, 'campus'),
      ]);
    } else {
      body.addAll([
        _IdCard(x), const SizedBox(height: 16),
        ListBox([
          Row2(title: '${x.name} · ${x.id}', sub: 'Name and ${stu ? 'student' : 'employee'} number', trailing: const Text('Edit', style: TextStyle(fontWeight: FontWeight.w700, color: C.navy2)), onTap: () => context.push('/profile?step=1${edit ? '&edit=1' : ''}')),
          Row2(title: x.line, sub: x.campus, trailing: const Text('Edit', style: TextStyle(fontWeight: FontWeight.w700, color: C.navy2)), onTap: () => context.push('/profile?step=2${edit ? '&edit=1' : ''}')),
        ]),
        if (!edit) ...[const SizedBox(height: 16), CardBox(border: err['consent'] != null ? C.err : C.line, pad: const EdgeInsets.all(14), onTap: () => setState(() { x.consent = !x.consent; err.remove('consent'); }),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Checkbox(value: x.consent, activeColor: C.navy2, onChanged: (v) => setState(() { x.consent = v == true; err.remove('consent'); })), const SizedBox(width: 6),
            const Expanded(child: Text('I agree that WayFinder may keep these details on this phone to show my schedule and directions, as allowed by the Data Privacy Act of 2012. I can change them anytime.', style: TextStyle(fontFamily: T.ui, fontSize: 14, height: 1.45, color: C.body)))])),
          if (err['consent'] != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(err['consent']!, style: const TextStyle(color: C.err, fontSize: 13)))],
      ]);
    }
    final label = step < 3 ? 'Continue' : edit ? 'Save changes' : 'Finish setup';
    return Scaffold(backgroundColor: C.cream, body: SafeArea(child: Stack(children: [Column(children: [
      SizedBox(height: 60, child: Padding(padding: const EdgeInsets.symmetric(horizontal: 14), child: Row(children: [
        step > 1 || edit ? TextButton.icon(onPressed: () => goBack(context, '/home'), icon: const Icon(Ic.back, color: C.navy2), label: const Text('Back', style: TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, color: C.navy2)))
          : Image.asset('assets/wf/logo-lockup.png', height: 36),
        const Spacer(), if (!edit) Text('Step $step of 3', style: const TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 13, color: C.muted))]))),
      if (!edit) Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Row(children: [for (var n = 1; n <= 3; n++) Expanded(child: Container(height: 5, margin: const EdgeInsets.symmetric(horizontal: 3), decoration: BoxDecoration(color: n < step ? C.navy2 : n == step ? C.gold : C.line, borderRadius: BorderRadius.circular(3))))])),
      Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 20, 20, 28), children: [
        Text(titles[step - 1], style: T.h1(32)), const SizedBox(height: 6), Text(subs[step - 1], style: T.body), const SizedBox(height: 20),
        ...body, const SizedBox(height: 20),
        Btn(label, wide: true, icon: step < 3 ? null : Ic.check, onTap: next),
        if (step == 1 && !edit) Center(child: LinkBtn('Not you? Use another account', onTap: () { draft = null; context.go('/login'); })),
        if (edit && step == 3) ...[const SizedBox(height: 12), Btn('Log out', kind: BK.danger, icon: Ic.logout, wide: true, onTap: () => context.push('/profile?step=3&edit=1&logout=1'))],
      ])),
    ]),
      if (widget.logout) ...[
        Positioned.fill(child: GestureDetector(onTap: () => context.pop(), child: const ColoredBox(color: Color(0x6B131728)))),
        Positioned(left: 0, right: 0, bottom: 0, child: Container(padding: const EdgeInsets.fromLTRB(20, 10, 20, 24), decoration: const BoxDecoration(color: C.cream, borderRadius: BorderRadius.vertical(top: Radius.circular(26))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [const Grab(), const Text('Log out of WayFinder?', style: T.h2), const SizedBox(height: 6), const Text('Sign back in with your WVSU Google account.', style: T.body), const SizedBox(height: 18),
            Btn('Log out', kind: BK.danger, wide: true, onTap: () { draft = null; context.wf.reset(); context.go('/login?out=1'); }), const SizedBox(height: 8),
            Btn('Cancel', kind: BK.outline, wide: true, onTap: () => context.pop())]))),
      ],
    ])));
  }
}
class _IdCard extends StatelessWidget {
  const _IdCard(this.x); final Profile x;
  @override
  Widget build(BuildContext context) {
    final col = (context.d.wf['colleges'] as List).where((c) => c['id'] == x.college).firstOrNull;
    const w = TextStyle(fontFamily: T.ui, color: Colors.white);
    return Container(decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [C.navy2, C.navy, C.night]),
        border: const Border(bottom: BorderSide(color: C.gold, width: 4)), boxShadow: const [BoxShadow(color: Color(0x66132D6B), blurRadius: 30, offset: Offset(0, 14), spreadRadius: -12)]),
      padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Image.asset('assets/wf/emblem-white-flat.png', width: 30), const SizedBox(width: 10), Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('West Visayas State University', style: w.copyWith(fontWeight: FontWeight.w700, fontSize: 13)), Text(x.campus, style: w.copyWith(fontSize: 11.5, color: const Color(0xB3FFFFFF)))])]),
        const SizedBox(height: 14),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(width: 54, height: 64, alignment: Alignment.center, decoration: BoxDecoration(color: const Color(0x26FFFFFF), borderRadius: BorderRadius.circular(10)), child: Text(x.initials, style: const TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: 22, color: C.gold))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: C.gold, borderRadius: BorderRadius.circular(6)), child: Text(x.role[0].toUpperCase() + x.role.substring(1), style: const TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w800, fontSize: 11, color: C.navy))),
            const SizedBox(height: 4), Text(x.name.isEmpty ? 'Your name' : x.name, style: const TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: 20, color: Colors.white)),
            Text(x.line.isEmpty ? 'Your course and year' : x.line, style: w.copyWith(fontWeight: FontWeight.w700, fontSize: 13.5)),
            if (col != null) Text(col['name'] as String, style: w.copyWith(fontSize: 12, color: const Color(0xCCFFFFFF))),
          ])),
        ]),
        const SizedBox(height: 14),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(x.role == 'student' ? 'Student no.' : 'Employee no.', style: w.copyWith(fontSize: 11, color: const Color(0xB3FFFFFF))), Text(x.id.isEmpty ? '—' : x.id, style: w.copyWith(fontWeight: FontWeight.w700, fontSize: 16, letterSpacing: 1))]),
          const Spacer(), Text(context.d.wf['student']['email'] as String, style: w.copyWith(fontSize: 11.5, color: const Color(0xCCFFFFFF))),
        ]),
      ]));
  }
}
