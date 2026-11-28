import 'package:flutter/material.dart';

import 'wf/app.dart';

/// WVSU WayFinder. The redesigned app (lib/wf/) follows the WayFinder-SVGs design.
/// The previous app (lib/app.dart, WayFinderApp) is kept for its tests and live-data code.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(await WFApp.boot());
}
