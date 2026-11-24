import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../data/campus.dart';

/// A blueprint with an optional room highlight. The highlight is painted in a layer that is exactly
/// the image's size (Positioned.fill over the image in one Stack), from the spot's 0-1 fractions,
/// so it stays on the room when the plan is zoomed or panned, or the phone rotates.
class PlanImage extends StatelessWidget {
  const PlanImage({super.key, required this.plan, this.spot, required this.title});
  final FloorPlan plan;
  final RoomSpot? spot;
  final String title;

  @override
  Widget build(BuildContext context) {
    final image = plan.imageUrl.startsWith('/demo/')
        ? Image.asset('assets/demo/${plan.imageUrl.split('/').last.replaceAll('.svg', '.png')}', semanticLabel: title, fit: BoxFit.fitWidth, width: double.infinity)
        : Image.network(plan.imageUrl, semanticLabel: title, fit: BoxFit.fitWidth, width: double.infinity,
            errorBuilder: (_, __, ___) => const Text('Floor plan image could not be loaded.'));
    final s = spot;
    // With a known size, reserve the box before the image loads so the overlay never jumps.
    final sized = plan.width != null && plan.height != null ? AspectRatio(aspectRatio: plan.width! / plan.height!, child: image) : image;
    if (s == null) return sized;
    return Stack(children: [
      sized,
      Positioned.fill(
        child: Semantics(
          key: const Key('room-highlight'),
          // Its own node (not merged into the surrounding card), positioned over the plan.
          container: true,
          label: '${s.label} highlighted on the floor plan',
          image: true,
          child: IgnorePointer(child: CustomPaint(painter: SpotPainter(s))),
        ),
      ),
    ]);
  }
}

/// Paints one RoomSpot onto a canvas the size of the blueprint image.
class SpotPainter extends CustomPainter {
  const SpotPainter(this.spot);
  final RoomSpot spot;

  /// The spot's outline in canvas pixels (exposed so tests can check the alignment).
  static Path outline(RoomSpot s, Size size) {
    switch (s.shape) {
      case 'rect':
        return Path()..addRect(Rect.fromLTWH(s.x * size.width, s.y * size.height, (s.w ?? 0) * size.width, (s.h ?? 0) * size.height));
      case 'polygon':
        return Path()..addPolygon([for (final (x, y) in s.points) Offset(x * size.width, y * size.height)], true);
      default:
        return Path()..addOval(Rect.fromCircle(center: Offset(s.x * size.width, s.y * size.height), radius: 9));
    }
  }

  @override
  void paint(Canvas canvas, Size size) {
    final path = outline(spot, size);
    canvas.drawPath(path, Paint()..color = gold.withValues(alpha: spot.shape == 'marker' ? 1 : .28));
    canvas.drawPath(path, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..color = spot.shape == 'marker' ? Colors.white : const Color(0xFFE0A019));
    if (spot.shape == 'marker') return;
    final b = path.getBounds();
    final tp = TextPainter(
      text: TextSpan(text: spot.label, style: const TextStyle(color: ink, fontSize: 12, fontWeight: FontWeight.w800)),
      textDirection: TextDirection.ltr,
    )..layout();
    // Always inside the room, just below its top edge: it never covers a neighbouring room (rooms are often
    // stacked directly above each other) and never gets clipped at the image edge.
    final cy = b.top + tp.height / 2 + 6;
    final tag = Rect.fromCenter(center: Offset(b.center.dx, cy), width: tp.width + 14, height: tp.height + 6);
    canvas.drawRRect(RRect.fromRectAndRadius(tag, const Radius.circular(99)), Paint()..color = gold);
    tp.paint(canvas, Offset(tag.left + 7, tag.top + 3));
  }

  @override
  bool shouldRepaint(SpotPainter old) => old.spot != spot;
}
