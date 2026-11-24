import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/theme.dart';
import 'plan_image.dart';
import '../data/building_repository.dart';
import '../data/campus.dart' show FloorPlan, RoomSpot;
import 'common.dart';

/// Loading state of the card's verified record.
sealed class DetailsState {
  const DetailsState();
}

class DetailsLoading extends DetailsState {
  const DetailsLoading();
}

class DetailsFailed extends DetailsState {
  const DetailsFailed();
}

class DetailsLoaded extends DetailsState {
  const DetailsLoaded(this.details);
  final BuildingDetails? details;
}

/// The building's photo. Until a real photo exists (places.photo_url), a labeled placeholder.
/// To add photos later, set `photo_url` on the verified place record; nothing in the UI changes.
class BuildingPhoto extends StatelessWidget {
  const BuildingPhoto({super.key, this.url, required this.name});
  final String? url;
  final String name;

  @override
  Widget build(BuildContext context) {
    final placeholder = Semantics(
      label: 'Building photo coming soon',
      image: true,
      child: Container(
        decoration: BoxDecoration(color: blueSoft, borderRadius: BorderRadius.circular(12), border: Border.all(color: line)),
        child: const Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.apartment_rounded, color: wayBlue, size: 32),
            SizedBox(height: 6),
            Text('Building photo coming soon', style: TextStyle(color: muted, fontWeight: FontWeight.w600)),
          ]),
        ),
      ),
    );
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: url == null
          ? placeholder
          : ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(url!, fit: BoxFit.cover, semanticLabel: 'Photo of $name', errorBuilder: (_, __, ___) => placeholder),
            ),
    );
  }
}

/// Google Maps-style place card: a draggable bottom sheet on phones, a side card on wide screens.
class BuildingCard extends StatefulWidget {
  const BuildingCard({
    super.key,
    required this.name,
    required this.state,
    required this.sheet,
    required this.expanded,
    required this.onExpandedChanged,
    required this.onClose,
    required this.onDirections,
    required this.onRetry,
  });

  final String name;
  final DetailsState state;
  final bool sheet;
  final bool expanded;
  final ValueChanged<bool> onExpandedChanged;
  final VoidCallback onClose;
  final ValueChanged<String> onDirections;
  final VoidCallback onRetry;

  @override
  State<BuildingCard> createState() => _BuildingCardState();
}

class _BuildingCardState extends State<BuildingCard> {
  double _dragDy = 0;

  /// Drag the handle up to expand; down to collapse (or close when already collapsed).
  /// Distance or a quick flick both count, so a slow drag works too.
  void _dragEnd(DragEndDetails d) {
    final v = d.primaryVelocity ?? 0, dy = _dragDy;
    _dragDy = 0;
    if (dy < -24 || v < -300) widget.onExpandedChanged(true);
    if (dy > 24 || v > 300) widget.expanded ? widget.onExpandedChanged(false) : widget.onClose();
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.name, state = widget.state, sheet = widget.sheet, expanded = widget.expanded;
    final onExpandedChanged = widget.onExpandedChanged, onClose = widget.onClose, onDirections = widget.onDirections, onRetry = widget.onRetry;
    final details = state is DetailsLoaded ? state.details : null;
    final showBody = !sheet || expanded;
    final children = <Widget>[
      if (sheet)
        Semantics(
          button: true,
          label: expanded ? 'Collapse details' : 'Expand details',
          child: GestureDetector(
            key: const Key('sheet-handle'),
            behavior: HitTestBehavior.opaque,
            onTap: () => onExpandedChanged(!expanded),
            onVerticalDragStart: (_) => _dragDy = 0,
            onVerticalDragUpdate: (d) => _dragDy += d.delta.dy,
            onVerticalDragEnd: _dragEnd,
            child: Center(
              child: Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 24),
                child: Container(width: 40, height: 5, decoration: BoxDecoration(color: const Color(0xFFC5D2E6), borderRadius: BorderRadius.circular(99))),
              ),
            ),
          ),
        ),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, key: const Key('building-name'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: navy)),
            const SizedBox(height: 2),
            Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
              const Text('WVSU Main Campus', style: TextStyle(color: muted, fontSize: 13)),
              if (details != null) StatusBadge(details.place.status),
            ]),
          ]),
        ),
        IconButton.filledTonal(
          onPressed: onClose,
          tooltip: 'Close',
          icon: const Icon(Icons.close, color: navy),
          style: IconButton.styleFrom(backgroundColor: blueSoft),
        ),
      ]),
      const SizedBox(height: 10),
      Wrap(spacing: 8, runSpacing: 8, children: [
        FilledButton.icon(
          onPressed: details == null ? null : () => onDirections(details.place.id),
          icon: const Icon(Icons.directions, size: 18),
          label: const Text('Directions'),
        ),
        if (sheet && !expanded) OutlinedButton(onPressed: () => onExpandedChanged(true), child: const Text('Details')),
      ]),
      if (state is DetailsLoaded && details == null)
        const Padding(
          padding: EdgeInsets.only(top: 6),
          child: Text('Directions open once this building has a verified record.', style: TextStyle(color: muted, fontSize: 12)),
        ),
      if (showBody) ...[
        const SizedBox(height: 12),
        BuildingPhoto(url: details?.photoUrl, name: name),
        const SizedBox(height: 12),
        _Details(state: state, onRetry: onRetry, building: name),
      ],
    ];

    return Material(
      key: const Key('building-card'),
      color: Colors.white,
      elevation: 8,
      shadowColor: navy.withValues(alpha: .25),
      borderRadius: sheet ? const BorderRadius.vertical(top: Radius.circular(18)) : BorderRadius.circular(16),
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, sheet ? 8 : 14, 12, 16),
        child: sheet
            ? ConstrainedBox(
                constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * (expanded ? .62 : .32)),
                child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children)),
              )
            : Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
      ),
    );
  }
}

class _Details extends StatelessWidget {
  const _Details({required this.state, required this.onRetry, required this.building});
  final DetailsState state;
  final VoidCallback onRetry;
  final String building;

  @override
  Widget build(BuildContext context) {
    final s = state;
    if (s is DetailsLoading) return const Text('Loading building details…', style: TextStyle(color: muted));
    if (s is DetailsFailed) return LoadError(what: 'building details', onRetry: onRetry);
    final d = (s as DetailsLoaded).details;
    if (d == null || !d.hasAny) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: goldSoft, borderRadius: BorderRadius.circular(12), border: Border.all(color: gold)),
        child: const Text('Building details coming soon.', style: TextStyle(fontWeight: FontWeight.w600)),
      );
    }
    Widget fact(String label, Widget child) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label.toUpperCase(), style: const TextStyle(fontSize: 11, letterSpacing: .8, color: muted, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            child,
          ]),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (d.description != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(d.description!, style: const TextStyle(height: 1.45))),
      if (d.floors.isNotEmpty) fact(d.floors.length == 1 ? 'Floor' : 'Floors', Text(d.floors.join(', '))),
      if (d.offices.isNotEmpty)
        fact('Offices', Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (final o in d.offices) Text('• ${o.name}${o.floor != null ? ' · Floor ${o.floor}' : ''}'),
        ])),
      if (d.rooms.isNotEmpty)
        fact('Rooms', Wrap(spacing: 6, runSpacing: 6, children: [
          for (final r in d.rooms)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(color: goldSoft, borderRadius: BorderRadius.circular(8), border: Border.all(color: gold)),
              child: Text(r.roomCode ?? r.name, style: const TextStyle(fontWeight: FontWeight.w700, color: navy)),
            ),
        ])),
      if (d.floorPlans.isNotEmpty)
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: () => showDialog<void>(context: context, builder: (_) => FloorPlanViewer(plans: d.floorPlans, building: building)),
            child: const Text('View floor plan'),
          ),
        ),
    ]);
  }
}

/// Approved floor plan (e.g. a Canva blueprint export) with zoom buttons; pinch and drag also work.
/// With [highlight], opens on the blueprint that room is marked on; the highlight zooms with it.
class FloorPlanViewer extends StatefulWidget {
  const FloorPlanViewer({super.key, required this.plans, required this.building, this.highlight});
  final List<FloorPlan> plans;
  final String building;
  final RoomSpot? highlight;
  @override
  State<FloorPlanViewer> createState() => _FloorPlanViewerState();
}

class _FloorPlanViewerState extends State<FloorPlanViewer> {
  final _t = TransformationController();
  late int _i = widget.highlight == null ? 0 : widget.plans.indexWhere((p) => p.id == widget.highlight!.floorPlanId).clamp(0, widget.plans.length - 1);
  double get _scale => _t.value.getMaxScaleOnAxis();

  /// Size of the plan's viewport, recorded at layout, so zoom can keep the highlighted room in view.
  Size _viewport = Size.zero;

  void _zoom(double factor) {
    final next = (_scale * factor).clamp(1.0, 4.0).toDouble();
    final p = widget.plans[_i];
    final spot = widget.highlight?.floorPlanId == p.id ? widget.highlight : null;
    if (_viewport != Size.zero) {
      // Zoom around the highlighted room (else the middle of the plan) instead of the top-left corner, so the
      // room stays on screen, and keep the plan's edges inside the viewport.
      final w = _viewport.width;
      final h = p.width != null && p.height != null ? w * p.height! / p.width! : _viewport.height;
      final fx = spot == null ? .5 : spot.x + (spot.w ?? 0) / 2, fy = spot == null ? .5 : spot.y + (spot.h ?? 0) / 2;
      final tx = (_viewport.width / 2 - next * fx * w).clamp(w - next * w, 0.0).toDouble();
      final hv = math.min(_viewport.height, h); // visible height: the plan is often shorter than the space it may use
      final ty = (hv / 2 - next * fy * h).clamp(math.min(0.0, hv - next * h), 0.0).toDouble();
      setState(() => _t.value = Matrix4.identity()..translateByDouble(tx, ty, 0, 1)..scaleByDouble(next, next, 1, 1));
      return;
    }
    setState(() => _t.value = Matrix4.diagonal3Values(next, next, 1));
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.plans[_i];
    final title = p.label ?? '${widget.building} floor ${p.floor}';
    final image = PlanImage(plan: p, spot: widget.highlight?.floorPlanId == p.id ? widget.highlight : null, title: title);
    return Dialog(
      insetPadding: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800))),
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
          ]),
          if (widget.plans.length > 1)
            Wrap(spacing: 8, children: [
              for (var i = 0; i < widget.plans.length; i++)
                ChoiceChip(label: Text('Floor ${widget.plans[i].floor}'), selected: i == _i, onSelected: (_) => setState(() { _i = i; _t.value = Matrix4.identity(); })),
            ]),
          const SizedBox(height: 8),
          Flexible(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: LayoutBuilder(builder: (context, box) {
                _viewport = Size(box.maxWidth, box.maxHeight.isFinite ? box.maxHeight : box.maxWidth);
                return InteractiveViewer(transformationController: _t, minScale: 1, maxScale: 4, onInteractionEnd: (_) => setState(() {}), child: image);
              }),
            ),
          ),
          const SizedBox(height: 8),
          // Wraps on narrow phones instead of overflowing.
          Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 0, runSpacing: 4, children: [
            IconButton.outlined(tooltip: 'Zoom out', onPressed: _scale <= 1.01 ? null : () => _zoom(1 / 1.5), icon: const Icon(Icons.remove)),
            SizedBox(width: 56, child: Text('${(_scale * 100).round()}%', key: const Key('plan-zoom'), textAlign: TextAlign.center, style: const TextStyle(color: muted))),
            IconButton.outlined(tooltip: 'Zoom in', onPressed: _scale >= 3.99 ? null : () => _zoom(1.5), icon: const Icon(Icons.add)),
            const SizedBox(width: 8),
            TextButton(onPressed: _scale <= 1.01 ? null : () => setState(() => _t.value = Matrix4.identity()), child: const Text('Show whole floor')),
          ]),
        ]),
      ),
    );
  }
}
