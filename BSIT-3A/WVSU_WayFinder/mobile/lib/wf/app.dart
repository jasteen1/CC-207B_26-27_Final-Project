// WVSU WayFinder (redesign): routes match the web app and the WayFinder-SVGs screens.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core.dart';
import 'directory.dart';
import 'map.dart';
import 'onboarding.dart';
import 'schedule.dart';

/// Deep links into signed-in screens act signed in, like the prototype.
Widget _signed(BuildContext c, Widget w) { final s = c.wf; if (!s.signed) s.signed = true; return w; }

GoRouter buildWFRouter(WFState s, {String? initial}) {
  Map<String, String> q(GoRouterState st) => st.uri.queryParameters;
  return GoRouter(initialLocation: initial ?? (s.signed ? '/home' : '/welcome'), routes: [
    GoRoute(path: '/', redirect: (_, __) => s.signed ? '/home' : '/welcome'),
    GoRoute(path: '/welcome', builder: (_, __) => const SplashScreen()),
    GoRoute(path: '/intro', builder: (_, __) => const IntroScreen()),
    GoRoute(path: '/login', builder: (_, st) => LoginScreen(state: q(st)['state'])),
    GoRoute(path: '/google', builder: (_, __) => const LoginScreen(google: true)),
    GoRoute(path: '/signing-in', builder: (_, __) => const SplashScreen(signing: true)),
    GoRoute(path: '/wrong-account', builder: (_, __) => const LoginScreen(wrong: true)),
    GoRoute(path: '/profile', builder: (c, st) => _signed(c, ProfileScreen(key: ValueKey(st.uri.toString()), step: (int.tryParse(q(st)['step'] ?? '1') ?? 1).clamp(1, 3), edit: q(st)['edit'] != null, logout: q(st)['logout'] != null))),
    GoRoute(path: '/home', builder: (c, st) => _signed(c, HomeScreen(returning: q(st)['returning'] != null, first: q(st)['first'] != null))),
    GoRoute(path: '/notifications', builder: (c, __) => _signed(c, const NotificationsScreen())),
    GoRoute(path: '/lock', builder: (c, __) => _signed(c, const LockScreen())),
    GoRoute(path: '/scan', builder: (c, __) => _signed(c, const ScanScreen())),
    GoRoute(path: '/scan/reading', builder: (c, __) => _signed(c, const ReadingScreen())),
    GoRoute(path: '/scan/review', builder: (c, __) => _signed(c, const ReviewScreen())),
    GoRoute(path: '/manual', builder: (c, __) => _signed(c, const ManualScreen())),
    GoRoute(path: '/schedule', builder: (c, st) => _signed(c, ScheduleScreen(view: q(st)['view'], day: int.tryParse(q(st)['day'] ?? ''), saved: q(st)['saved'] != null))),
    GoRoute(path: '/class/:code/:mi', builder: (c, st) => _signed(c, ClassScreen(code: st.pathParameters['code']!, mi: int.tryParse(st.pathParameters['mi']!) ?? 0, flash: q(st)['flash'] == '1'))),
    GoRoute(path: '/map', builder: (_, st) => MapHomeScreen(key: ValueKey(st.uri.toString()), q: q(st)['q'] ?? '', guest: q(st)['guest'] != null, focus: q(st)['focus'] != null)),
    GoRoute(path: '/map/place/:id', builder: (_, st) => PlaceScreen(key: ValueKey(st.uri.toString()), id: st.pathParameters['id']!, qp: q(st))),
    GoRoute(path: '/map/floor/:id', builder: (_, st) => FloorViewScreen(id: st.pathParameters['id']!, qp: q(st))),
    GoRoute(path: '/map/blueprint/:id', builder: (_, st) => BlueprintScreen(id: st.pathParameters['id']!, qp: q(st))),
    GoRoute(path: '/map/start', builder: (_, st) => StartScreen(qp: q(st))),
    GoRoute(path: '/map/pin', builder: (_, st) => PinScreen(qp: q(st))),
    GoRoute(path: '/map/route', builder: (_, st) => RouteScreen(key: ValueKey('${q(st)['from']}>${q(st)['to']}'), qp: q(st))),
    GoRoute(path: '/map/stops', builder: (_, st) => StopsScreen(pid: q(st)['pid'])),
    GoRoute(path: '/directory', builder: (_, st) => DirectoryScreen(key: ValueKey(st.uri.toString()), tab: q(st)['tab'] ?? 'offices', q: q(st)['q'] ?? '')),
    GoRoute(path: '/directory/office/:id', builder: (_, st) => OfficeScreen(id: st.pathParameters['id']!)),
    GoRoute(path: '/directory/process/:id', builder: (_, st) => ProcessScreen(id: st.pathParameters['id']!, step: int.tryParse(q(st)['step'] ?? '') ?? 0)),
  ]);
}

class WFApp extends StatefulWidget {
  const WFApp({super.key, required this.state, this.initial});
  final WFState state; final String? initial;
  /// Loads the design data and the saved state, then runs the app.
  static Future<Widget> boot({String? initial, bool persist = true}) async {
    final data = await WFData.load();
    final prefs = persist ? await SharedPreferences.getInstance() : null;
    return WFApp(state: WFState(data, prefs: prefs), initial: initial);
  }
  @override State<WFApp> createState() => _WFAppState();
}
class _WFAppState extends State<WFApp> {
  late final router = buildWFRouter(widget.state, initial: widget.initial);
  @override void initState() { super.initState(); registerAsk(); }
  @override
  Widget build(BuildContext context) => WF(state: widget.state, child: MaterialApp.router(
        title: 'WayFinder — WVSU', debugShowCheckedModeBanner: false, theme: wfTheme(), routerConfig: router,
        // The reminder banner sits above the navigator, so it gets its own Overlay (for button tooltips).
        builder: (context, child) => Overlay(initialEntries: [OverlayEntry(builder: (_) => PushHost(go: (to) => router.push(to), child: child ?? const SizedBox()))]),
      ));
}
