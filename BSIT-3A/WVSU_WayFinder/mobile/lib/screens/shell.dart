import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/app_scope.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

const _tabs = [
  ('/', 'Home', Icons.home_outlined, Icons.home),
  ('/map', 'Map', Icons.map_outlined, Icons.map),
  ('/processes', 'Processes', Icons.description_outlined, Icons.description),
  ('/directory', 'Directory', Icons.apartment_outlined, Icons.apartment),
  ('/guide', 'AI Guide', Icons.auto_awesome_outlined, Icons.auto_awesome),
];

int _indexFor(String path) {
  if (path.startsWith('/map')) return 1;
  if (path.startsWith('/processes')) return 2;
  if (path.startsWith('/directory')) return 3;
  if (path.startsWith('/guide')) return 4;
  return 0; // Home, schedule, search results and place details
}

/// Where the phone's Back button goes from [path]: one level up. Screens are opened with `go`, so there
/// is no page stack to pop, and without this Back would close the app from any screen. null = Home: let
/// the system handle it (leave the app).
String? upFrom(String path) {
  if (path == '/' || path.isEmpty) return null;
  if (path.startsWith('/schedule/')) return '/schedule';
  if (path.startsWith('/processes/')) return '/processes';
  if (path.startsWith('/directory/') || path.startsWith('/place/')) return '/directory';
  return '/';
}

class Shell extends StatelessWidget {
  const Shell({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    final live = AppScope.of(context).config.isLive;
    return BackButtonListener(
      onBackButtonPressed: () async {
        // A dialog or sheet on top closes first (normal Back behaviour).
        if (Navigator.of(context, rootNavigator: true).canPop()) return false;
        final up = upFrom(path);
        if (up == null) return false;
        context.go(up);
        return true;
      },
      child: Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        titleSpacing: 16,
        title: const Align(alignment: Alignment.centerLeft, child: WayFinderLogo()),
        toolbarHeight: 60,
        bottom: live
            ? null
            : PreferredSize(
                preferredSize: const Size.fromHeight(30),
                child: Container(
                  width: double.infinity,
                  color: goldSoft,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  // Fixed-height strip: one line, ellipsised, and not scaled past 1.3x so large text can't spill out.
                  child: MediaQuery.withClampedTextScaling(
                    maxScaleFactor: 1.3,
                    child: const Text.rich(TextSpan(children: [
                      TextSpan(text: 'DEMO DATA ', style: TextStyle(fontWeight: FontWeight.w800)),
                      TextSpan(text: '— placeholders, not official WVSU information.'),
                    ]), style: TextStyle(fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                ),
              ),
      ),
      body: SafeArea(child: child),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _indexFor(path),
        onDestinationSelected: (i) => context.go(_tabs[i].$1),
        destinations: [
          for (final t in _tabs) NavigationDestination(icon: Icon(t.$3), selectedIcon: Icon(t.$4, color: wayBlue), label: t.$2),
        ],
      ),
    ));
  }
}
