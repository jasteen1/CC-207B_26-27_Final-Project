import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../core/app_scope.dart';
import '../core/resolve.dart';
import '../core/search.dart';
import '../core/theme.dart';
import '../core/config.dart';
import '../core/trip.dart';
import '../data/campus.dart';
import '../data/campus_outlines.dart';
import '../data/location_service.dart';
import '../data/models.dart';
import '../widgets/building_card.dart';
import '../widgets/common.dart';
import '../widgets/plan_image.dart';
import 'home_screen.dart' show SearchField, Unconfirmed;

// WVSU Main Campus, La Paz, Iloilo City: the extent of the building outlines in the team's
// MapTiler "Wayfinder" dataset (same bounds as the web app). The centre is the middle of it.
final campusBounds = LatLngBounds(const LatLng(10.71194, 122.55932), const LatLng(10.71531, 122.56441));
const campusCenter = LatLng((10.71194 + 10.71531) / 2, (122.55932 + 122.56441) / 2);
// Fill and outline colours of the custom style's "Wayfinder" layer: hsla(201, 70%, 43%, 0.8), black.
const _outlineFill = Color(0xCC2185BA);

/// `map:<polygon id>` (or `map:f:<feature>`) = a building drawn on the campus map, not a record ID.
bool isMapKey(String id) => id.startsWith('map:');
LatLng centerOf(CampusBuilding b) {
  final bb = b.bbox;
  return LatLng((bb.south + bb.north) / 2, (bb.west + bb.east) / 2);
}

class MapScreen extends StatefulWidget {
  const MapScreen({super.key, this.to = '', this.from = '', this.code = ''});
  final String to;
  final String from;

  /// A room code typed in search whose room isn't confirmed (only its prefix is known).
  final String code;
  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  PlaceView? _dest, _start;
  /// Map buildings named by `to`/`from` (`map:` keys); their linked record, if any, is in _dest/_start.
  CampusBuilding? _destShape, _startShape;
  List<RoomPrefix> _prefixes = const [];
  Future<List<CampusBuilding>>? _shapes;
  LocationFailure? _locFailure;
  CampusPaths? _paths;
  List<PlaceView> _all = const [];
  bool _loading = true, _destFailed = false, _pathsFailed = false, _tilesFailed = false, _locating = false;
  LocationFix? _fix;
  /// The building record whose outline contains the GPS fix (null if none, or not linked).
  String? _fixInside;
  /// Every outline the fix's accuracy circle reaches (with its linked record id, if any).
  List<({String name, String? placeId})> _fixNear = const [];
  String? _locProblem;
  /// The trip status the inside card was last scrolled into view for (same building → floor plan first).
  TripStatus? _revealedFor;
  final _insideKey = GlobalKey();
  bool _init = false;

  // ---- Tappable buildings -------------------------------------------------------------------
  List<CampusBuilding> _buildings = const [];
  CampusBuilding? _sel;
  DetailsState _details = const DetailsLoading();
  bool _expanded = false;
  int _detailsRequest = 0;
  // One controller per map instance: the map is rebuilt (new key) when the route, destination or start
  // changes so it re-centres; a reused controller would keep the old camera.
  MapController _mapController = MapController();
  String? _mapInstance;
  final LayerHitNotifier<String> _polygonHit = ValueNotifier(null);
  final _mapBoxKey = GlobalKey(), _sheetKey = GlobalKey();
  List<Polygon<String>> _labelled = const [];
  static const _labelStyle = TextStyle(color: navy, fontSize: 11, fontWeight: FontWeight.w700, shadows: [
    Shadow(color: Colors.white, blurRadius: 2),
    Shadow(color: Colors.white, blurRadius: 2),
  ]);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_init) {
      _init = true;
      _shapes = AppScope.of(context).campusShapes().catchError((_) => const <CampusBuilding>[]);
      _shapes!.then((b) { if (mounted) setState(() => _buildings = b); });
      loadRoomPrefixes().then((p) { if (mounted) setState(() => _prefixes = p); });
      _load();
    }
  }

  @override
  void didUpdateWidget(MapScreen old) {
    super.didUpdateWidget(old);
    if (old.to != widget.to || old.from != widget.from) _load();
  }

  Future<void> _load() async {
    final s = AppScope.of(context);
    setState(() { _loading = true; _destFailed = false; _pathsFailed = false; });
    Future<T?> safe<T>(Future<T> f, void Function() onFail) async {
      try { return await f; } catch (_) { onFail(); return null; }
    }
    // A map building resolves to its linked building record when there is one.
    Future<(CampusBuilding?, PlaceView?)> resolve(String id, void Function() onFail) async {
      if (id.isEmpty || id == 'gps') return (null, null);
      if (!isMapKey(id)) return (null, await safe(s.places.getPlace(id), onFail));
      final shape = (await _shapes!).where((b) => b.key == id).firstOrNull;
      if (shape == null) return (null, null);
      final linked = await safe(s.buildings.lookup(featureIds: shape.featureIds), () {});
      return (shape, linked == null ? null : PlaceView(linked.place));
    }

    final (destShape, dest) = await resolve(widget.to, () => _destFailed = true);
    final (startShape, start) = await resolve(widget.from, () {});
    final paths = await safe(s.campus.load(), () => _pathsFailed = true);
    final all = await safe(s.places.list(), () {}) ?? const <PlaceView>[];
    if (!mounted) return;
    setState(() { _dest = dest; _destShape = destShape; _start = start; _startShape = startShape; _paths = paths; _all = all; _loading = false; });
  }

  /// Open (or switch) the building card. Never touches `to` or `from`.
  Future<void> _select(CampusBuilding b) async {
    final id = ++_detailsRequest;
    setState(() { _sel = b; _expanded = false; _details = const DetailsLoading(); });
    _revealSoon();
    final repo = AppScope.of(context).buildings;
    DetailsState next;
    try {
      next = DetailsLoaded(await repo.lookup(featureIds: b.featureIds));
    } catch (_) {
      next = const DetailsFailed();
    }
    if (mounted && id == _detailsRequest) setState(() => _details = next);
  }

  void _closeCard() {
    _detailsRequest++;
    setState(() { _sel = null; _expanded = false; });
  }

  void _setExpanded(bool v) {
    setState(() => _expanded = v);
    _revealSoon();
  }

  /// Directions: the building becomes the destination; the start (GPS or manual) is kept.
  void _directionsTo(String placeId) {
    _closeCard();
    context.go(Uri(path: '/map', queryParameters: {'to': placeId, if (widget.from.isNotEmpty) 'from': widget.from}).toString());
  }

  /// A tap on a drawn polygon (via the PolygonLayer's hit notifier).
  void _onPolygonTap() {
    final key = _polygonHit.value?.hitValues.firstOrNull;
    final b = key == null ? null : _buildings.where((x) => x.key == key).firstOrNull;
    if (b != null) _select(b);
  }

  /// A tap elsewhere on the map: on a building's label (which can stick out of a thin building),
  /// or inside a polygon the layer didn't report.
  void _onMapTap(TapPosition tap, LatLng at) {
    final camera = _mapController.camera;
    for (final p in _labelled) {
      final tp = TextPainter(text: TextSpan(text: p.label, style: _labelStyle), textDirection: TextDirection.ltr)..layout();
      final pts = p.points.map(camera.latLngToScreenOffset).toList();
      final minX = pts.map((o) => o.dx).reduce((a, b) => a < b ? a : b), maxX = pts.map((o) => o.dx).reduce((a, b) => a > b ? a : b);
      if (maxX - minX <= tp.width) continue; // flutter_map doesn't draw a label that doesn't fit
      final c = camera.latLngToScreenOffset(p.labelPosition);
      final rect = Rect.fromCenter(center: c, width: tp.width + 12, height: tp.height + 12);
      if (rect.contains(tap.relative ?? Offset.infinite)) {
        final b = _buildings.where((x) => x.key == p.hitValue).firstOrNull;
        if (b != null) {
          _select(b);
          return;
        }
      }
    }
    final b = buildingAt(_buildings, at);
    if (b != null) _select(b);
  }

  /// After the card lays out, pan just enough that the building sits above the sheet.
  void _revealSoon() => WidgetsBinding.instance.addPostFrameCallback((_) => _reveal());
  void _reveal() {
    final b = _sel;
    final mapBox = _mapBoxKey.currentContext?.findRenderObject() as RenderBox?;
    if (b == null || mapBox == null || !mapBox.attached) return;
    final MapCamera camera;
    try { camera = _mapController.camera; } catch (_) { return; }
    final mapRect = mapBox.localToGlobal(Offset.zero) & mapBox.size;
    final sheetBox = _sheetKey.currentContext?.findRenderObject() as RenderBox?;
    final inset = sheetBox != null && sheetBox.attached ? (mapRect.bottom - sheetBox.localToGlobal(Offset.zero).dy).clamp(0.0, mapRect.height) : 0.0;
    final bb = b.bbox;
    final a = camera.latLngToScreenOffset(LatLng(bb.north, bb.west)), c = camera.latLngToScreenOffset(LatLng(bb.south, bb.east));
    final (dx, dy) = panToReveal(
      (left: a.dx < c.dx ? a.dx : c.dx, right: a.dx > c.dx ? a.dx : c.dx, top: a.dy < c.dy ? a.dy : c.dy, bottom: a.dy > c.dy ? a.dy : c.dy),
      (width: mapRect.width, height: mapRect.height),
      insetBottom: inset.toDouble(),
    );
    if (dx == 0 && dy == 0) return;
    final size = camera.nonRotatedSize;
    _mapController.move(camera.screenOffsetToLatLng(Offset(size.width / 2 + dx, size.height / 2 + dy)), camera.zoom);
  }

  /// Destination stays in the URL; switching the start only changes `from`.
  void _setFrom(String from) => context.go(Uri(path: '/map', queryParameters: {if (widget.to.isNotEmpty) 'to': widget.to, if (from.isNotEmpty) 'from': from}).toString());

  /// Each GPS request gets an id. A manual pick or leaving the screen bumps it, so a late GPS
  /// result is ignored and never replaces the student's manual choice.
  int _locRequest = 0;

  @override
  void dispose() {
    _locRequest++;
    _polygonHit.dispose();
    _mapController.dispose();
    super.dispose();
  }

  Future<void> _useMyLocation() async {
    final id = ++_locRequest;
    setState(() => _locating = true);
    final scope = AppScope.of(context);
    final out = await scope.location.current();
    if (!mounted || id != _locRequest) return;
    // Which building outline the fix falls in, and every outline its accuracy circle reaches
    // (locates the student; never used as a walkway point). A poor fix isn't trusted, so only its centre counts.
    String? inside;
    final near = <({String name, String? placeId})>[];
    final f = out.fix;
    final at = f == null ? null : LatLng(f.lat, f.lng);
    final shapes = at == null
        ? const <CampusBuilding>[]
        : f!.accuracyMeters <= poorAccuracyM ? buildingsWithin(_buildings, at, f.accuracyMeters) : [?buildingAt(_buildings, at)];
    for (final shape in shapes) {
      String? placeId;
      try { placeId = (await scope.buildings.lookup(featureIds: shape.featureIds))?.place.id; } catch (_) {}
      if (!mounted || id != _locRequest) return;
      near.add((name: shape.name, placeId: placeId));
      if (shape.contains(at!)) inside ??= placeId;
    }
    setState(() {
      _locating = false;
      _fixInside = inside;
      _fixNear = near;
      _fix = out.fix;
      _locFailure = out.failure;
      _locProblem = out.failure == null ? null : describeFailure(out.failure!);
    });
    if (out.fix != null) _setFrom('gps');
  }

  Future<void> _chooseStart() async {
    final options = _all.where((v) => ['building', 'room', 'office'].contains(v.place.kind) && (v.hasPoint || v.place.kind == 'building')).toList();
    // Any building drawn on the campus map can be a start too (picked as its `map:` key).
    final recordNames = {for (final v in _all) if (v.place.kind == 'building') v.place.name.trim().toLowerCase()};
    final mapped = _buildings.where((b) => !recordNames.contains(b.name.toLowerCase())).toList()..sort((a, b) => a.name.compareTo(b.name));
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        var q = '';
        // Typing narrows every section (buildings, campus-map places such as gates, rooms and offices).
        bool hit(String s) => q.isEmpty || s.toLowerCase().contains(q.toLowerCase().trim());
        return StatefulBuilder(builder: (ctx, setSheet) {
          final bs = options.where((v) => v.place.kind == 'building' && hit(v.place.name)).toList();
          final ms = mapped.where((b) => hit(b.name)).toList();
          final rs = options.where((v) => v.place.kind != 'building' && hit('${v.place.roomLabel ?? ''} ${v.place.roomCode ?? ''} ${v.place.name} ${v.parent?.name ?? ''}')).toList();
          return Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
            child: SafeArea(
              child: SizedBox(
                height: MediaQuery.of(ctx).size.height * .6,
                child: options.isEmpty && mapped.isEmpty
                    ? const Padding(padding: EdgeInsets.all(20), child: Text('No building or room with a recorded location is available yet.'))
                    : ListView(children: [
                        const Padding(padding: EdgeInsets.fromLTRB(16, 16, 16, 8), child: Text('Choose starting point', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17))),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                          child: TextField(
                            key: const Key('start-filter'),
                            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Filter: building, gate or room', isDense: true, border: OutlineInputBorder()),
                            onChanged: (v) => setSheet(() => q = v),
                          ),
                        ),
                        if (bs.isEmpty && ms.isEmpty && rs.isEmpty) Padding(padding: const EdgeInsets.all(16), child: Text('Nothing matches “$q”.')),
                        // Buildings and campus-map places (gates) first; rooms and offices after them.
                        for (final v in bs)
                          ListTile(
                            title: Text(v.place.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: const Text('building'),
                            onTap: () => Navigator.pop(ctx, v.place.id),
                          ),
                        if (ms.isNotEmpty)
                          const Padding(
                            padding: EdgeInsets.fromLTRB(16, 16, 16, 4),
                            child: Text('ON THE CAMPUS MAP', key: Key('mapped-starts'), style: TextStyle(fontSize: 11, letterSpacing: .8, color: muted, fontWeight: FontWeight.w700)),
                          ),
                        for (final b in ms)
                          ListTile(
                            title: Text(b.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: const Text('campus map'),
                            onTap: () => Navigator.pop(ctx, b.key),
                          ),
                        if (rs.isNotEmpty)
                          const Padding(
                            padding: EdgeInsets.fromLTRB(16, 16, 16, 4),
                            child: Text('ROOMS AND OFFICES', style: TextStyle(fontSize: 11, letterSpacing: .8, color: muted, fontWeight: FontWeight.w700)),
                          ),
                        for (final v in rs)
                          ListTile(
                            title: Text(v.place.roomCode != null ? roomDisplay(roomLabel: v.place.roomLabel, roomCode: v.place.roomCode, name: v.place.name) : v.place.name,
                                style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Text([v.place.roomCode != null ? v.place.name : v.place.kind, v.parent?.name].whereType<String>().join(' · ')),
                            onTap: () => Navigator.pop(ctx, v.place.id),
                          ),
                      ]),
              ),
            ),
          );
        });
      },
    );
    if (picked != null && mounted) _startAt(picked);
  }

  /// A start chosen by the student (picker or "I'm at …"): any pending or earlier GPS fix is dropped.
  void _startAt(String from) {
    _locRequest++;
    setState(() { _fix = null; _fixInside = null; _fixNear = const []; _locProblem = null; _locFailure = null; _locating = false; });
    _setFrom(from);
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final cfg = scope.config;
    final dest = _dest, paths = _paths;
    final fix = _fix;
    final gpsPoor = fix != null && fix.accuracyMeters > poorAccuracyM;
    final offCampus = fix != null && distanceM(fix.lng, fix.lat, campusCenterLng, campusCenterLat) > campusRadiusM;
    // A map building with no linked record: still a visible destination, but nothing to route to.
    final destMapped = dest == null && !_loading ? _destShape : null;
    final startMapped = _start == null && !_loading ? _startShape : null;
    final TripDest? tripDest = dest != null ? PlaceDest(dest) : destMapped != null ? MappedDest(destMapped.name) : null;
    final TripStart tripStart = widget.from == 'gps'
        ? GpsStart(fix, _locFailure, _fixInside, _fixNear)
        : _start != null ? PlaceStart(_start!) : startMapped != null ? MappedStart(startMapped.name) : const NoStart();
    final trip = tripDest == null || _loading ? null : planTrip(tripDest, tripStart, paths);
    // Already in the destination building: bring the floor plan into view (once per arrival).
    if (trip?.status != _revealedFor) {
      _revealedFor = trip?.status;
      if (trip?.status == TripStatus.sameBuilding) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          final c = _insideKey.currentContext;
          if (c != null && c.mounted) Scrollable.ensureVisible(c, duration: const Duration(milliseconds: 300));
        });
      }
    }
    final legs = trip == null || trip.status == TripStatus.route ? const <TripLeg>[] : tripLegs(trip, tripStart is NoStart && _locFailure != null ? GpsStart(null, _locFailure) : tripStart, paths);
    final destB = trip?.destBuilding;
    final destPoint = dest != null && dest.hasPoint ? LatLng(dest.lat!, dest.lng!) : _destShape != null ? centerOf(_destShape!) : null;
    final plan = trip?.route != null && trip?.entrance != null ? (route: trip!.route!, entrance: trip.entrance!) : null;
    final problem = trip != null && plan == null ? trip.message : null;
    final startPoint = widget.from == 'gps' && fix != null
        ? LatLng(fix.lat, fix.lng)
        : (_start != null && _start!.hasPoint ? LatLng(_start!.lat!, _start!.lng!) : _startShape != null ? centerOf(_startShape!) : null);
    final routePts = plan?.route.points.map((p) => LatLng(p.$2, p.$1)).toList();

    // Selected building last so its gold outline draws over its neighbours.
    final ordered = [..._buildings.where((b) => b.key != _sel?.key), ..._buildings.where((b) => b.key == _sel?.key)];
    final polygons = <Polygon<String>>[
      for (final b in ordered)
        for (var i = 0; i < b.polygons.length; i++)
          Polygon<String>(
            points: b.polygons[i],
            hitValue: b.key,
            color: _outlineFill,
            borderColor: b.key == _sel?.key ? gold : Colors.black,
            borderStrokeWidth: b.key == _sel?.key ? 4 : 1,
            label: i == 0 ? b.name : null,
            labelStyle: _labelStyle,
            labelPlacementCalculator: const PolygonLabelPlacementCalculator.polylabel(),
          ),
    ];
    _labelled = polygons.where((p) => p.label != null).toList();

    return LayoutBuilder(builder: (context, box) {
      final wide = box.maxWidth >= 1024;
      final card = _sel == null
          ? null
          : BuildingCard(
              name: _sel!.name,
              state: _details,
              sheet: !wide,
              expanded: _expanded,
              onExpandedChanged: _setExpanded,
              onClose: _closeCard,
              onDirections: _directionsTo,
              onRetry: () => _select(_sel!),
            );
      final list = _content(context, scope, cfg, dest, destB, destPoint, startPoint, routePts, paths, plan, problem, trip, fix, gpsPoor, offCampus, polygons, legs,
          bottomPad: card != null && !wide ? MediaQuery.of(context).size.height * .34 : 0);
      if (card == null) return list;
      if (wide) {
        return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: list),
          SizedBox(width: 380, child: Padding(padding: const EdgeInsets.fromLTRB(0, 16, 16, 16), child: SingleChildScrollView(child: card))),
        ]);
      }
      return Stack(children: [
        list,
        Positioned(left: 0, right: 0, bottom: 0, child: KeyedSubtree(key: _sheetKey, child: card)),
      ]);
    });
  }

  Widget _content(BuildContext context, AppScope scope, AppConfig cfg, PlaceView? dest, Place? destB, LatLng? destPoint, LatLng? startPoint, List<LatLng>? routePts,
      CampusPaths? paths, ({WalkRoute route, Entrance entrance})? plan, String? problem, Trip? trip, LocationFix? fix, bool gpsPoor, bool offCampus,
      List<Polygon<String>> polygons, List<TripLeg> legs, {double bottomPad = 0}) {
    return ListView(padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottomPad), children: [
      const Text('Campus Map', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
      // Same as the web Map: students search for a room or building right here.
      const Padding(padding: EdgeInsets.only(top: 8), child: SearchField()),
      if (scope.places.isDemo) const Notice('Supabase is not configured. Showing DEMO places and walkways, not official WVSU information.'),
      if (!cfg.hasMapTiler) const Notice('No MapTiler key set. Showing the campus overlay only.', info: true),
      if (cfg.hasMapTiler && _tilesFailed) const Notice('MapTiler basemap unavailable. Showing the campus overlay only.', info: true),
      if (_destFailed) LoadError(what: 'this destination', onRetry: _load),
      if (_pathsFailed) LoadError(what: 'walking paths', onRetry: _load),
      const SizedBox(height: 8),
      ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SizedBox(
          key: _mapBoxKey,
          height: 300,
          child: LayoutBuilder(builder: (context, box) {
          // A new map (and controller) when the route, destination, start or WIDTH changes, so it
          // re-centres and the campus fit uses the real size (on the web the first layout is narrow).
          final mapInstance = '${destPoint ?? ''}|${routePts?.length}|$startPoint|${box.maxWidth.round()}';
          if (_mapInstance != null && _mapInstance != mapInstance) {
            final old = _mapController;
            WidgetsBinding.instance.addPostFrameCallback((_) => old.dispose());
            _mapController = MapController();
          }
          _mapInstance = mapInstance;
          return FlutterMap(
            key: ValueKey(mapInstance),
            mapController: _mapController,
            options: MapOptions(
              onTap: _onMapTap,
              initialCenter: routePts?.isNotEmpty == true ? routePts![routePts.length ~/ 2] : (destPoint ?? startPoint ?? campusCenter),
              initialZoom: destPoint == null && startPoint == null ? 16.5 : 18,
              // Nothing selected yet: open straight onto the campus, framed by the building outlines.
              initialCameraFit: routePts == null && destPoint == null && startPoint == null
                  ? CameraFit.bounds(bounds: campusBounds, padding: const EdgeInsets.all(16))
                  : null,
              backgroundColor: const Color(0xFFE6EDF7),
            ),
            children: [
              if (cfg.hasMapTiler && !_tilesFailed)
                TileLayer(
                  urlTemplate: 'https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${cfg.mapTilerKey}',
                  userAgentPackageName: 'ph.edu.wvsu.wayfinder',
                  errorTileCallback: (tile, error, stack) { if (!_tilesFailed && mounted) setState(() => _tilesFailed = true); },
                ),
              if (polygons.isNotEmpty)
                // Taps inside a drawn building open its card (hitValue = the building key).
                MouseRegion(
                  hitTestBehavior: HitTestBehavior.deferToChild,
                  cursor: SystemMouseCursors.click,
                  child: GestureDetector(
                    onTap: _onPolygonTap,
                    child: PolygonLayer<String>(polygons: polygons, hitNotifier: _polygonHit, drawLabelsLast: true),
                  ),
                ),
              if (routePts != null) PolylineLayer(polylines: [Polyline(points: routePts, strokeWidth: 6, color: navy)]),
              MarkerLayer(markers: [
                for (final v in _all)
                  if (v.place.kind == 'building' && v.place.hasPoint && v.place.id != destB?.id)
                    Marker(point: LatLng(v.place.lat!, v.place.lng!), width: 18, height: 18, child: Container(decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(4), border: Border.all(color: wayBlue, width: 3)))),
                if (paths != null && destB != null)
                  for (final e in entrancesOf(paths, destB.id))
                    Marker(point: LatLng(e.lat, e.lng), width: 14, height: 14, child: Container(decoration: BoxDecoration(color: gold, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)))),
                if (destPoint != null) Marker(point: destPoint, width: 44, height: 44, alignment: Alignment.topCenter, child: const Icon(Icons.location_on, color: navy, size: 44, semanticLabel: 'Destination')),
                if (startPoint != null && widget.from == 'gps')
                  Marker(point: startPoint, width: 120, height: 70, alignment: const Alignment(0, 0.71), child: const IgnorePointer(child: _YouAreHere())) // taps reach the building underneath
                else if (startPoint != null)
                  Marker(point: startPoint, width: 26, height: 26, child: const Icon(Icons.my_location, color: wayBlue, semanticLabel: 'Start')),
              ]),
            ],
          );
          }),
        ),
      ),
      if (_loading) const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator())),
      if (widget.to.isEmpty)
        Card(
          key: const Key('my-location-card'),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Search for a room or building to get directions.', style: TextStyle(color: muted)),
              if (widget.from == 'gps' && fix != null)
                Padding(padding: const EdgeInsets.only(top: 8), child: Text('You are here · accuracy ±${fix.accuracyMeters.round()} m (${fix.accuracyLabel})', style: const TextStyle(fontWeight: FontWeight.w700))),
              if (_locProblem != null) Notice(_locProblem!),
              if (offCampus && !gpsPoor) const Notice('You appear to be outside the campus.'),
              const SizedBox(height: 8),
              FilledButton.icon(onPressed: _locating ? null : _useMyLocation, icon: const Icon(Icons.my_location, size: 18), label: Text(_locating ? 'Locating…' : 'Use my location')),
            ]),
          ),
        ),
      if (!_loading && widget.to.isNotEmpty && !isMapKey(widget.to) && dest == null && !_destFailed)
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Text('No place has the ID “${widget.to}”.'))),
      if (!_loading && isMapKey(widget.to) && _destShape == null)
        const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('That building isn’t on the campus map right now.'))),
      if (!_loading && (dest != null || _destShape != null)) ...[
        Card(
          key: const Key('dest-card'),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                const Text('DESTINATION', style: TextStyle(fontSize: 11, letterSpacing: .8, color: wayBlue, fontWeight: FontWeight.w700)),
                if (dest != null) StatusBadge(dest.place.status) else const Text('Map only', style: TextStyle(fontSize: 12, color: muted, fontWeight: FontWeight.w700)),
              ]),
              const SizedBox(height: 4),
              Text(destB?.name ?? dest?.place.name ?? _destShape!.name, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
              if (widget.code.isNotEmpty && _destShape != null)
                switch (prefixPointer(widget.code, [for (final b in _buildings) MapBuildingRef(b.key, b.name, b.featureIds)], _prefixes)) {
                  PrefixHit(:final message) || PrefixUnmappedHit(:final message) => Padding(padding: const EdgeInsets.only(top: 6), child: Unconfirmed(message)),
                  _ => const SizedBox.shrink(),
                },
              if (trip?.indoor != null && destB != null)
                Text('Walk to this building, then go inside to ${trip!.indoor!.label}.', style: const TextStyle(fontSize: 13, color: muted)),
              if (plan != null) Text('Enter at: ${plan.entrance.name}', style: const TextStyle(fontSize: 13)),
              if (destPoint == null) const Padding(padding: EdgeInsets.only(top: 6), child: Unconfirmed('Location unconfirmed')),
            ]),
          ),
        ),
        if (dest != null && trip?.indoor != null) _insideCard(dest, trip!, destB, paths),
        Card(
          key: const Key('route-card'),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('WALKING ROUTE', style: TextStyle(fontSize: 11, letterSpacing: .8, color: wayBlue, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              if (plan != null)
                Text.rich(TextSpan(children: [
                  TextSpan(text: '${plan.route.minutes} min', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  TextSpan(text: ' walk · ${plan.route.meters.round()} m  '),
                  const TextSpan(text: '(≈ estimate, verified walkways only)', style: TextStyle(fontSize: 12, color: muted)),
                ]))
              else if (problem != null)
                Text(problem, style: const TextStyle(color: muted)),
              if (trip?.status == TripStatus.gpsConfirm && destB != null) _confirmArrival(destB),
              if (legs.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: _TripLegs(legs)),
              const SizedBox(height: 10),
              const Text('STARTING FROM', style: TextStyle(fontSize: 11, letterSpacing: .8, color: muted, fontWeight: FontWeight.w700)),
              Text(
                widget.from == 'gps' && fix != null
                    ? 'You are here · accuracy ±${fix.accuracyMeters.round()} m (${fix.accuracyLabel})'
                    : _start != null
                        ? '${_start!.place.kind == 'room' ? roomDisplay(roomLabel: _start!.place.roomLabel, roomCode: _start!.place.roomCode, name: _start!.place.name) : _start!.place.name}${_start!.parent != null ? ' · ${_start!.parent!.name}' : ''}'
                        : _startShape != null ? '${_startShape!.name} (map only)' : 'Not set',
                key: const Key('start-line'),
              ),
              if (_locProblem != null) Notice('$_locProblem Choose a starting building or room instead.'),
              if (gpsPoor) Notice('GPS accuracy is poor (±${fix!.accuracyMeters.round()} m). Choose a starting building or room for reliable directions.'),
              if (offCampus && !gpsPoor) const Notice('You appear to be outside the campus. Choose a starting building or room.'),
              const SizedBox(height: 8),
              Wrap(spacing: 10, runSpacing: 8, children: [
                FilledButton.icon(onPressed: _locating ? null : _useMyLocation, icon: const Icon(Icons.my_location, size: 18), label: Text(_locating ? 'Locating…' : 'Use my location')),
                OutlinedButton(onPressed: _chooseStart, child: const Text('Choose starting point')),
              ]),
            ]),
          ),
        ),
      ],
    ]);
  }
}

extension on _MapScreenState {
  /// The GPS circle reaches the destination and a neighbour: the student says where they are.
  /// "I’m at" the destination skips the walk; a linked neighbour becomes the start; anything else opens the picker.
  Widget _confirmArrival(Place destB) {
    final others = {for (final b in _fixNear) if (b.placeId != null && b.placeId != destB.id) b.placeId!: b.name};
    return Padding(
      key: const Key('confirm-arrival'),
      padding: const EdgeInsets.only(top: 8),
      child: Wrap(spacing: 8, runSpacing: 8, children: [
        FilledButton(key: const Key('confirm-at-dest'), onPressed: () => _startAt(destB.id), child: Text('I’m at ${destB.name}')),
        for (final e in others.entries) OutlinedButton(onPressed: () => _startAt(e.key), child: Text('I’m at ${e.value}')),
        TextButton(onPressed: _chooseStart, child: const Text('Somewhere else')),
      ]),
    );
  }

  /// Room/office: floor from the record (never guessed), the blueprint for that floor, the room highlighted.
  Widget _insideCard(PlaceView dest, Trip trip, Place? destB, CampusPaths? paths) {
    final indoor = trip.indoor!;
    final plan = indoor.plan;
    return KeyedSubtree(key: _insideKey, child: Card(
      key: const Key('inside-card'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Wrap(spacing: 8, children: [
            const Text('INSIDE THE BUILDING', style: TextStyle(fontSize: 11, letterSpacing: .8, color: wayBlue, fontWeight: FontWeight.w700)),
            if (trip.status == TripStatus.sameBuilding) const Text('· Indoor step', style: TextStyle(fontSize: 11, color: muted, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 6),
          if (dest.place.kind == 'room') Text('Room ${indoor.label}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: navy)),
          if (dest.place.kind != 'room') Text(dest.place.name, style: const TextStyle(fontWeight: FontWeight.w700)),
          Text('Floor ${indoor.floor ?? 'not recorded'}', style: const TextStyle(fontWeight: FontWeight.w600)),
          if (plan != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                ClipRRect(borderRadius: BorderRadius.circular(12), child: PlanImage(plan: plan, spot: indoor.spot, title: plan.label ?? 'Floor ${plan.floor} plan')),
                Text('${plan.label ?? 'Floor ${plan.floor}'}${indoor.spot != null ? ' · ${indoor.spot!.label} highlighted' : ''}', style: const TextStyle(fontSize: 12, color: muted)),
                const SizedBox(height: 6),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => showDialog<void>(
                      context: context,
                      builder: (_) => FloorPlanViewer(plans: indoor.plans, building: destB?.name ?? '', highlight: indoor.spot),
                    ),
                    child: const Text('Open floor plan'),
                  ),
                ),
              ]),
            ),
          if (indoor.note != null && (paths != null || indoor.plans.isEmpty))
            Padding(padding: const EdgeInsets.only(top: 6), child: Text(indoor.note!, style: const TextStyle(fontSize: 12, color: muted))),
        ]),
      ),
    ));
  }
}

/// The parts of the trip, each marked ready or not, so a student sees exactly what's missing.
class _TripLegs extends StatelessWidget {
  const _TripLegs(this.legs);
  final List<TripLeg> legs;
  @override
  Widget build(BuildContext context) => Column(key: const Key('trip-legs'), crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (final l in legs)
          Padding(
            key: Key('leg-${l.key}'),
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(
                switch (l.state) {
                  LegState.ok => Icons.check_circle,
                  LegState.unavailable => Icons.block,
                  LegState.choose => Icons.radio_button_unchecked,
                  LegState.notNeeded => Icons.remove_circle_outline,
                },
                size: 18,
                color: switch (l.state) { LegState.ok => const Color(0xFF1E7B3A), LegState.unavailable => const Color(0xFFB3261E), _ => muted },
                semanticLabel: switch (l.state) { LegState.ok => 'Ready', LegState.unavailable => 'Unavailable', LegState.choose => 'Needs your choice', LegState.notNeeded => 'Not needed' },
              ),
              const SizedBox(width: 8),
              Expanded(child: Text.rich(TextSpan(children: [
                TextSpan(text: '${l.title}: ', style: const TextStyle(fontWeight: FontWeight.w700)),
                TextSpan(text: l.detail),
              ]), style: const TextStyle(fontSize: 13))),
            ]),
          ),
      ]);
}

/// GPS position marker: a blue dot with a "You are here" label under it.
class _YouAreHere extends StatelessWidget {
  const _YouAreHere();
  @override
  Widget build(BuildContext context) => Semantics(
        label: 'You are here',
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(color: wayBlue, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 3), boxShadow: const [BoxShadow(color: Color(0x594A7FC1), spreadRadius: 4)]),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: navy, borderRadius: BorderRadius.circular(999)),
            child: const Text('You are here', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
          ),
        ]),
      );
}
