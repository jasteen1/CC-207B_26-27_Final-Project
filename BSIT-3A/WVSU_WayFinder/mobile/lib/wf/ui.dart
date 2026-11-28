// Shared WayFinder widgets. Sizes, radii and colours follow src/wf/app.css (the prototype stylesheet).
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core.dart';

/* ---------- icons (Material equivalents of the prototype's stroke icons) ---------- */
class Ic {
  static const home = Icons.home_outlined, cal = Icons.calendar_today_outlined, map = Icons.map_outlined, bldg = Icons.apartment_outlined;
  static const ask = Icons.chat_bubble_outline, search = Icons.search, back = Icons.chevron_left, chev = Icons.chevron_right, arrow = Icons.arrow_forward;
  static const pin = Icons.place_outlined, camera = Icons.photo_camera_outlined, photo = Icons.image_outlined, check = Icons.check, close = Icons.close;
  static const edit = Icons.edit_outlined, undo = Icons.undo, gps = Icons.my_location, flag = Icons.flag_outlined, target = Icons.adjust;
  static const info = Icons.info_outline, alert = Icons.warning_amber_rounded, user = Icons.person_outline, route = Icons.route_outlined;
  static const ext = Icons.open_in_new, list = Icons.format_list_bulleted, bell = Icons.notifications_none, lock = Icons.lock_outline;
  static const minus = Icons.remove, plus = Icons.add, logout = Icons.logout, phone = Icons.phone_outlined, caret = Icons.expand_more;
}

/* ---------- buttons ---------- */
enum BK { primary, gold, outline, google, ghost, danger }
class Btn extends StatelessWidget {
  const Btn(this.label, {super.key, this.kind = BK.primary, this.icon, this.onTap, this.to, this.wide = false, this.small = false, this.leading});
  final String label; final BK kind; final IconData? icon; final VoidCallback? onTap; final String? to; final bool wide, small; final Widget? leading;
  @override
  Widget build(BuildContext context) {
    final bg = switch (kind) { BK.primary => C.navy2, BK.gold => C.gold, BK.google => C.google, BK.ghost => Colors.white, BK.danger => Colors.white, BK.outline => Colors.transparent };
    final fg = switch (kind) { BK.primary || BK.google => Colors.white, BK.gold => C.navy, BK.danger => C.err, _ => C.navy2 };
    final side = switch (kind) { BK.outline => const BorderSide(color: C.navy2, width: 1.5), BK.ghost => const BorderSide(color: C.line2), BK.danger => const BorderSide(color: Color(0xFFF1C4BF)), _ => BorderSide.none };
    final h = small ? 44.0 : kind == BK.google ? 58.0 : 52.0;
    final tap = onTap ?? (to != null ? () => context.push(to!) : null);
    final child = Row(mainAxisSize: wide ? MainAxisSize.max : MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
      if (leading != null) ...[leading!, const SizedBox(width: 10)],
      if (icon != null) ...[Icon(icon, size: 20, color: fg), const SizedBox(width: 10)],
      Flexible(child: Text(label, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: small ? 15 : 16.5, color: fg, height: 1.15))),
    ]);
    return Opacity(opacity: tap == null ? .5 : 1, child: Material(color: bg, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(small ? 12 : 16), side: side),
      child: InkWell(onTap: tap, borderRadius: BorderRadius.circular(small ? 12 : 16),
        child: ConstrainedBox(constraints: BoxConstraints(minHeight: h, minWidth: wide ? double.infinity : 0), child: Padding(padding: EdgeInsets.symmetric(horizontal: small ? 14 : 20), child: Center(widthFactor: 1, child: child))))));
  }
}
class LinkBtn extends StatelessWidget {
  const LinkBtn(this.label, {super.key, this.onTap, this.to, this.icon});
  final String label; final VoidCallback? onTap; final String? to; final IconData? icon;
  @override
  Widget build(BuildContext context) => TextButton(onPressed: onTap ?? (to != null ? () => context.push(to!) : null),
      style: TextButton.styleFrom(foregroundColor: C.navy2, minimumSize: const Size(44, 44), textStyle: const TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 16)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 6)], Text(label)]));
}
class IconBtn extends StatelessWidget {
  const IconBtn(this.icon, {super.key, required this.label, this.onTap, this.color = C.navy2});
  final IconData icon; final String label; final VoidCallback? onTap; final Color color;
  @override
  Widget build(BuildContext context) => IconButton(onPressed: onTap, tooltip: label, icon: Icon(icon, color: color), style: IconButton.styleFrom(minimumSize: const Size(44, 44)));
}

/* ---------- small parts ---------- */
enum PK { plain, gold, ok, navy }
class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.kind = PK.plain, this.icon, this.leading, this.onTap});
  final String text; final PK kind; final IconData? icon; final Widget? leading; final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (kind) { PK.gold => (C.goldSoft, C.warn), PK.ok => (C.okSoft, C.ok), PK.navy => (C.navy, Colors.white), PK.plain => (C.sand, C.body) };
    final w = Container(height: 28, padding: const EdgeInsets.symmetric(horizontal: 10), decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: kind == PK.gold ? Border.all(color: C.goldLine) : null),
      child: Row(mainAxisSize: MainAxisSize.min, children: [if (leading != null) ...[leading!, const SizedBox(width: 6)], if (icon != null) ...[Icon(icon, size: 15, color: fg), const SizedBox(width: 4)], Text(text, style: TextStyle(fontFamily: T.ui, fontSize: 13, fontWeight: FontWeight.w700, color: fg))]));
    return onTap == null ? w : GestureDetector(onTap: onTap, child: w);
  }
}
class Tag extends StatelessWidget {
  const Tag(this.text, {super.key, this.gold = false, this.icon, this.leading, this.off = false});
  final String text; final bool gold, off; final IconData? icon; final Widget? leading;
  @override
  Widget build(BuildContext context) => Container(height: 24, padding: const EdgeInsets.symmetric(horizontal: 9),
      decoration: BoxDecoration(color: off ? C.sand : gold ? C.goldSoft : C.blueSoft, borderRadius: BorderRadius.circular(8), border: gold ? Border.all(color: C.goldLine) : null),
      child: Row(mainAxisSize: MainAxisSize.min, children: [if (leading != null) ...[leading!, const SizedBox(width: 6)], if (icon != null) ...[Icon(icon, size: 14, color: gold ? C.warn : C.navy2), const SizedBox(width: 6)],
        Text(text, style: TextStyle(fontFamily: T.ui, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: .9, color: off ? C.muted : gold ? C.warn : C.navy2))]));
}
enum NK { warn, info, ok, sand }
class NoteBox extends StatelessWidget {
  const NoteBox(this.child, {super.key, this.kind = NK.info, this.icon = Ic.info, this.trailing});
  final Widget child; final NK kind; final IconData icon; final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = switch (kind) { NK.warn => (C.warnSoft, const Color(0xFF5C3A00), C.goldLine), NK.info => (C.blueSoft, C.navy, null), NK.ok => (C.okSoft, const Color(0xFF0E5730), null), NK.sand => (C.sand, C.body, null) };
    return Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12), decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: border == null ? null : Border.all(color: border)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(icon, size: 20, color: fg), const SizedBox(width: 10), Expanded(child: DefaultTextStyle(style: TextStyle(fontFamily: T.ui, fontSize: 14.5, height: 1.45, color: fg), child: child)), if (trailing != null) trailing!]));
  }
}
BoxDecoration cardDeco({Color color = C.paper, Color border = C.line, double r = 20, bool shadow = false}) => BoxDecoration(color: color, borderRadius: BorderRadius.circular(r), border: Border.all(color: border),
    boxShadow: shadow ? [const BoxShadow(color: Color(0x47132D6B), blurRadius: 30, offset: Offset(0, 14), spreadRadius: -16)] : null);
class CardBox extends StatelessWidget {
  const CardBox({super.key, required this.child, this.pad = const EdgeInsets.all(18), this.color = C.paper, this.border = C.line, this.onTap, this.r = 20, this.shadow = false});
  final Widget child; final EdgeInsets pad; final Color color, border; final VoidCallback? onTap; final double r; final bool shadow;
  @override
  Widget build(BuildContext context) => Container(decoration: cardDeco(color: color, border: border, r: r, shadow: shadow), clipBehavior: Clip.antiAlias,
      child: Material(type: MaterialType.transparency, child: InkWell(onTap: onTap, child: Padding(padding: pad, child: child))));
}
/// A list of rows in one rounded card, divided by hairlines.
class ListBox extends StatelessWidget {
  const ListBox(this.children, {super.key, this.color = C.paper});
  final List<Widget> children; final Color color;
  @override
  Widget build(BuildContext context) => Container(decoration: cardDeco(color: color), clipBehavior: Clip.antiAlias,
      child: Column(children: [for (var i = 0; i < children.length; i++) ...[if (i > 0) const Divider(height: 1, thickness: 1, color: C.line), children[i]]]));
}
class Row2 extends StatelessWidget {
  const Row2({super.key, required this.title, this.sub, this.leading, this.trailing, this.onTap, this.to, this.minH = 64});
  final String title; final String? sub; final Widget? leading, trailing; final VoidCallback? onTap; final String? to; final double minH;
  @override
  Widget build(BuildContext context) => Material(type: MaterialType.transparency, child: InkWell(onTap: onTap ?? (to != null ? () => context.push(to!) : null),
      child: ConstrainedBox(constraints: BoxConstraints(minHeight: minH), child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12), child: Row(children: [
        if (leading != null) ...[leading!, const SizedBox(width: 14)],
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: T.h3), if (sub != null) ...[const SizedBox(height: 3), Text(sub!, style: T.small)]])),
        trailing ?? ((onTap != null || to != null) ? const Icon(Ic.chev, color: C.navy2) : const SizedBox()),
      ])))));
}
class Seg extends StatelessWidget {
  const Seg(this.options, {super.key, required this.selected, required this.onTap, this.small = false});
  final List<String> options; final int selected; final ValueChanged<int> onTap; final bool small;
  @override
  Widget build(BuildContext context) => Container(padding: EdgeInsets.all(small ? 3 : 4), decoration: BoxDecoration(color: C.sand, borderRadius: BorderRadius.circular(small ? 14 : 16)),
      child: Row(mainAxisSize: small ? MainAxisSize.min : MainAxisSize.max, children: [for (var i = 0; i < options.length; i++) ...[
        if (i > 0) const SizedBox(width: 4),
        (small ? (Widget w) => w : (Widget w) => Expanded(child: w))(Semantics(selected: i == selected, button: true, child: Material(color: i == selected ? C.navy2 : Colors.transparent, borderRadius: BorderRadius.circular(small ? 11 : 12),
          child: InkWell(borderRadius: BorderRadius.circular(small ? 11 : 12), onTap: () => onTap(i), child: Container(height: small ? 40 : 44, padding: EdgeInsets.symmetric(horizontal: small ? 14 : 6), alignment: Alignment.center,
            child: Text(options[i], maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: small ? 14.5 : 15, color: i == selected ? Colors.white : C.navy2)))))))]]));
}
InputDecoration fieldDeco(String hint, {Widget? prefix, Widget? suffix, String? error}) => InputDecoration(
      hintText: hint, hintStyle: const TextStyle(color: Color(0xFF7A8496), fontSize: 16.5), filled: true, fillColor: C.paper, isDense: true, errorText: error,
      prefixIcon: prefix, suffixIcon: suffix, contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: C.line2, width: 1.5)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: C.navy2, width: 1.5)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: C.err, width: 1.5)),
      focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: C.err, width: 1.5)),
    );
class ProgressBar extends StatelessWidget {
  const ProgressBar(this.done, this.total, {super.key, this.h = 8});
  final int done, total; final double h;
  @override
  Widget build(BuildContext context) => Semantics(label: '$done of $total steps done', child: ClipRRect(borderRadius: BorderRadius.circular(h / 2), child: SizedBox(height: h, child: Stack(children: [
        Container(color: C.sand), FractionallySizedBox(widthFactor: total == 0 ? 0 : done / total, child: Container(decoration: const BoxDecoration(gradient: LinearGradient(colors: [C.navy2, C.blue])))),
      ]))));
}
class Grab extends StatelessWidget { const Grab({super.key}); @override Widget build(BuildContext context) => Center(child: Container(width: 44, height: 5, margin: const EdgeInsets.only(bottom: 12), decoration: BoxDecoration(color: C.line2, borderRadius: BorderRadius.circular(3)))); }

/* ---------- the navigation needle and the countdown dial ---------- */
class Needle extends StatelessWidget {
  const Needle({super.key, this.size = 18}); final double size;
  @override Widget build(BuildContext context) => CustomPaint(size: Size.square(size), painter: _NeedleP());
}
class _NeedleP extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    c.scale(s.width / 24);
    c.drawPath(Path()..moveTo(12, 2)..lineTo(5, 21)..lineTo(12, 17)..close(), Paint()..color = C.navy);
    c.drawPath(Path()..moveTo(12, 2)..lineTo(19, 21)..lineTo(12, 17)..close(), Paint()..color = C.sky);
    c.drawCircle(const Offset(12, 12.5), 2.6, Paint()..color = C.gold);
    c.drawCircle(const Offset(12, 12.5), 2.6, Paint()..color = C.navy..style = PaintingStyle.stroke..strokeWidth = 1);
  }
  @override bool shouldRepaint(_) => false;
}
class Dial extends StatelessWidget {
  const Dial({super.key, required this.value, required this.frac, this.unit = 'min to start', this.size = 104});
  final int value; final double frac; final String unit; final double size;
  @override
  Widget build(BuildContext context) => Semantics(label: 'Starts in $value minutes', child: TweenAnimationBuilder<double>(tween: Tween(begin: 0, end: frac), duration: const Duration(milliseconds: 1100), curve: Curves.easeOutQuart,
      builder: (_, f, __) => CustomPaint(size: Size.square(size), painter: _DialP(f), child: SizedBox.square(dimension: size, child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Text('$value', style: TextStyle(fontFamily: T.display, fontWeight: FontWeight.w700, fontSize: size * .33, height: .95, color: C.navy)),
        Text(unit, style: TextStyle(fontFamily: T.ui, fontSize: size < 100 ? 9.5 : 10.5, fontWeight: FontWeight.w700, color: C.muted)),
      ])))));
}
class _DialP extends CustomPainter {
  _DialP(this.f); final double f;
  @override
  void paint(Canvas c, Size s) {
    final r = s.width * .42, ctr = s.center(Offset.zero), w = s.width * .09;
    c.drawCircle(ctr, r, Paint()..color = C.blueSoft..style = PaintingStyle.stroke..strokeWidth = w);
    final rect = Rect.fromCircle(center: ctr, radius: r);
    c.drawArc(rect, -math.pi / 2, 2 * math.pi * f, false, Paint()..shader = const LinearGradient(colors: [C.sky, C.navy2]).createShader(rect)..style = PaintingStyle.stroke..strokeWidth = w..strokeCap = StrokeCap.round);
  }
  @override bool shouldRepaint(_DialP o) => o.f != f;
}

/* ---------- top bars ---------- */
class TopBar extends StatelessWidget {
  const TopBar({super.key, required this.title, this.backLabel = 'Back', this.back, this.onBack, this.right});
  final String title, backLabel; final String? back; final VoidCallback? onBack; final Widget? right;
  @override
  Widget build(BuildContext context) => SizedBox(height: 60, child: Row(children: [
        const SizedBox(width: 6),
        TextButton(onPressed: onBack ?? () => goBack(context, back ?? '/home'), style: TextButton.styleFrom(foregroundColor: C.navy2, minimumSize: const Size(44, 44), padding: const EdgeInsets.fromLTRB(4, 0, 10, 0)),
            child: Row(children: [const Icon(Ic.back, size: 26), Text(backLabel, style: const TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: 16))])),
        Expanded(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: T.display, fontWeight: FontWeight.w600, fontSize: 19, color: C.ink))),
        if (right != null) right!, const SizedBox(width: 8),
      ]));
}
void goBack(BuildContext context, String fallback) { if (context.canPop()) { context.pop(); } else { context.go(fallback); } }
class LockupBar extends StatelessWidget {
  const LockupBar({super.key, this.right});
  final Widget? right;
  @override
  Widget build(BuildContext context) => SizedBox(height: 60, child: Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Row(children: [
        Image.asset('assets/wf/logo-lockup.png', height: 42, semanticLabel: 'WVSU WayFinder'), const Spacer(), if (right != null) right!])));
}

/* ---------- screen scaffold: content, the four tabs, Ask, the toast ---------- */
enum Tab4 { home, schedule, map, directory }
class Screen extends StatelessWidget {
  const Screen({super.key, required this.child, this.tab, this.bg = C.cream, this.fab = true, this.overlay});
  final Widget child; final Tab4? tab; final Color bg; final bool fab; final List<Widget>? overlay;
  @override
  Widget build(BuildContext context) => Scaffold(backgroundColor: bg, body: SafeArea(bottom: false, child: Stack(fit: StackFit.expand, children: [
        Positioned.fill(bottom: tab != null ? 78 : 0, child: child),
        if (tab != null) Positioned(left: 0, right: 0, bottom: 0, child: TabsBar(on: tab!)),
        if (tab != null && tab != Tab4.map && fab) const Positioned(right: 16, bottom: 78 + 16, child: AskFab()),
        ...?overlay,
        const ToastHost(),
      ])));
}
class TabsBar extends StatelessWidget {
  const TabsBar({super.key, required this.on});
  final Tab4 on;
  static int? _prev;
  @override
  Widget build(BuildContext context) {
    final s = context.wf, idx = on.index, from = _prev ?? idx; _prev = idx;
    final tabs = [(Ic.home, 'Home', '/home'), (Ic.cal, 'Schedule', s.saved != null ? '/schedule' : '/scan'), (Ic.map, 'Map', '/map'), (Ic.bldg, 'Directory', '/directory')];
    return Container(height: 78, decoration: const BoxDecoration(color: C.paper, border: Border(top: BorderSide(color: C.line))), padding: const EdgeInsets.only(bottom: 12),
      child: LayoutBuilder(builder: (_, c) { final w = c.maxWidth / 4;
        return Stack(children: [
          TweenAnimationBuilder<double>(tween: Tween(begin: from.toDouble(), end: idx.toDouble()), duration: const Duration(milliseconds: 500), curve: Curves.easeOutBack,
            builder: (_, v, __) => Positioned(left: v * w + (w - 40) / 2, top: 7, child: Container(width: 40, height: 40, decoration: const BoxDecoration(color: C.gold, shape: BoxShape.circle, boxShadow: [BoxShadow(color: Color(0x8CB87900), blurRadius: 14, offset: Offset(0, 6), spreadRadius: -4)])))),
          Row(children: [for (var i = 0; i < 4; i++) Expanded(child: Semantics(selected: i == idx, button: true, label: tabs[i].$2, child: InkWell(onTap: () => context.go(tabs[i].$3), child: Padding(padding: const EdgeInsets.only(top: 7), child: Column(children: [
            SizedBox(height: 40, child: Icon(tabs[i].$1, size: 24, color: i == idx ? C.navy : C.muted)),
            Text(tabs[i].$2, style: TextStyle(fontFamily: T.ui, fontSize: 12, fontWeight: i == idx ? FontWeight.w800 : FontWeight.w600, color: i == idx ? C.navy : C.muted)),
          ])))))]),
        ]); }));
  }
}
class AskFab extends StatelessWidget {
  const AskFab({super.key});
  @override
  Widget build(BuildContext context) => Semantics(button: true, label: 'Ask WayFinder', child: GestureDetector(onTap: () => openAsk(context),
      child: Container(width: 58, height: 58, decoration: const BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(center: Alignment(-.4, -.5), colors: [Color(0xFF2A55B0), C.navy], stops: [0, .7]),
          boxShadow: [BoxShadow(color: C.cream, spreadRadius: 3), BoxShadow(color: C.gold, spreadRadius: 5), BoxShadow(color: Color(0x99132D6B), blurRadius: 28, offset: Offset(0, 14), spreadRadius: -8)]),
        child: const Icon(Ic.ask, color: Colors.white, size: 26))));
}
/// Set by the Ask screen module so Ask can open from any screen without a circular import.
void Function(BuildContext)? openAskHandler;
void openAsk(BuildContext c) => openAskHandler?.call(c);

class ToastHost extends StatefulWidget { const ToastHost({super.key}); @override State<ToastHost> createState() => _ToastHostState(); }
class _ToastHostState extends State<ToastHost> {
  String? shown;
  @override
  Widget build(BuildContext context) {
    final s = context.wf, t = s.toast;
    if (t != null && t != shown) { shown = t; Future.delayed(const Duration(milliseconds: 4200), () { if (mounted && s.toast == t) s.update(() => s.toast = null); }); }
    if (t == null) return const SizedBox.shrink();
    final box = Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: C.navy, borderRadius: BorderRadius.circular(16), boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 24, offset: Offset(0, 10))]),
        child: Row(children: [
          const Icon(Ic.check, color: C.gold, size: 20), const SizedBox(width: 12),
          Expanded(child: RichText(text: richText(t, const TextStyle(fontFamily: T.ui, color: Colors.white, fontSize: 14.5), const TextStyle(color: C.gold, fontWeight: FontWeight.w700)))),
        ]));
    return Positioned(left: 14, right: 14, top: 14, child: IgnorePointer(child: TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1), duration: const Duration(milliseconds: 300), curve: Curves.easeOut,
      builder: (_, v, child) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, (1 - v) * -20), child: child)),
      child: box)));
  }
}
/// "Text with **bold** parts" → spans.
TextSpan richText(String s, TextStyle base, TextStyle bold) {
  final parts = s.split('**');
  return TextSpan(style: base, children: [for (var i = 0; i < parts.length; i++) TextSpan(text: parts[i], style: i.isOdd ? bold : null)]);
}
Widget rich(String s, {TextStyle style = T.body, TextStyle bold = const TextStyle(color: C.ink, fontWeight: FontWeight.w700)}) => Text.rich(richText(s, style, bold));

/* ---------- campus map ---------- */
const mapLabel = {'Entrance (Main Gate)': 'Main Gate', 'Hometel': 'Student’s Center', 'Administration': 'Administration Building'};
typedef MapExtra = void Function(Canvas c, double k);

/// The campus map. [vb] is the visible map area in campus units; [cover] fills the box (slice), otherwise fits (meet).
class CampusMap extends StatelessWidget {
  const CampusMap({super.key, this.vb, this.focus, this.sel, this.startShape, this.startPt, this.pin, this.entrance, this.hide = const [], this.stopShapes = const [], this.noNeedle = false, this.cover = true, this.extra, this.onTapShape, this.onTapMap});
  final Rect? vb; final String? focus, sel, startShape; final Offset? startPt, pin, entrance; final List<String> hide, stopShapes; final bool noNeedle, cover; final MapExtra? extra;
  final ValueChanged<String>? onTapShape; final ValueChanged<Offset>? onTapMap;
  Rect viewBox(WFData d) { if (vb != null) return vb!; final s = d.shapeBy(focus); return s != null ? Rect.fromLTWH(s.cx - 80, s.cy - 70, 160, 346) : const Rect.fromLTWH(75, 84, 250, 541); }
  @override
  Widget build(BuildContext context) {
    final d = context.d, v = viewBox(d);
    return LayoutBuilder(builder: (_, c) {
      final size = Size(c.maxWidth, c.maxHeight);
      if (size.isEmpty || !size.isFinite) return const SizedBox.expand();
      final k = cover ? math.max(size.width / v.width, size.height / v.height) : math.min(size.width / v.width, size.height / v.height);
      final o = Offset(v.center.dx - size.width / 2 / k, v.center.dy - size.height / 2 / k);
      Offset toMap(Offset p) => p / k + o;
      return GestureDetector(
        onTapUp: (e) {
          final q = toMap(e.localPosition);
          if (onTapMap != null) { onTapMap!(q); return; }
          if (onTapShape != null) { for (final s in d.shapes.reversed) { if (!s.line && s.path.contains(q)) { onTapShape!(s.name); return; } } }
        },
        child: Semantics(label: 'WVSU Main Campus map', child: CustomPaint(size: size, painter: _MapP(d, k, o, this))),
      );
    });
  }
}
class _MapP extends CustomPainter {
  _MapP(this.d, this.k, this.o, this.m); final WFData d; final double k; final Offset o; final CampusMap m;
  @override
  void paint(Canvas c, Size size) {
    if (!k.isFinite || k <= 0) return;
    c.drawRect(Offset.zero & size, Paint()..color = C.mapBg);
    c.save(); c.scale(k); c.translate(-o.dx, -o.dy);
    final named = d.labelled.toSet();
    for (final s in d.shapes) {
      if (s.line) { _dashed(c, s.path, const Color(0xFFC9BB9F), 1 / k * 1.2); continue; }
      final isSel = s.name == m.sel, isStart = s.name == m.startShape, stop = m.stopShapes.contains(s.name);
      final fill = isSel ? C.gold : isStart ? const Color(0xFF9FC3E8) : stop ? const Color(0xFFFCEBC4) : named.contains(s.name) ? const Color(0xFFC9D5EA) : const Color(0xFFD9CFBC);
      final stroke = isSel ? C.goldDeep : isStart ? C.blue : stop ? C.goldDeep : named.contains(s.name) ? const Color(0xFF9DB1D4) : const Color(0xFFC2B49A);
      c.drawPath(s.path, Paint()..color = fill);
      c.drawPath(s.path, Paint()..color = stroke..style = PaintingStyle.stroke..strokeWidth = isSel ? 1.2 : .6);
    }
    for (final n in d.labelled) {
      if (m.hide.contains(n)) continue; final s = d.shapeBy(n); if (s == null) continue;
      _label(c, mapLabel[n] ?? n, Offset(s.cx, s.cy), 11 / k);
    }
    if (m.entrance != null) { c.drawCircle(m.entrance!, 9 / k, Paint()..color = Colors.white); c.drawCircle(m.entrance!, 9 / k, Paint()..color = C.navy..style = PaintingStyle.stroke..strokeWidth = 2.4 / k); }
    if (m.sel != null && !m.noNeedle) {
      final s = d.shapeBy(m.sel); if (s != null) { c.save(); c.translate(s.cx, s.cy - 14 / k); c.scale(1.5 / k);
        c.drawPath(Path()..moveTo(0, -14)..lineTo(-7, 6)..lineTo(0, 2)..close(), Paint()..color = C.navy); c.drawPath(Path()..moveTo(0, -14)..lineTo(7, 6)..lineTo(0, 2)..close(), Paint()..color = C.sky);
        c.drawCircle(const Offset(0, -2), 2.6, Paint()..color = C.gold); c.drawCircle(const Offset(0, -2), 2.6, Paint()..color = C.navy..style = PaintingStyle.stroke..strokeWidth = 1); c.restore(); }
    }
    if (m.startPt != null) { c.drawCircle(m.startPt!, 8 / k, Paint()..color = C.blue); c.drawCircle(m.startPt!, 8 / k, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2.5 / k); }
    if (m.pin != null) { c.save(); c.translate(m.pin!.dx, m.pin!.dy); c.scale(1.4 / k);
      final p = Path()..moveTo(0, 0)..cubicTo(-9, -10, -9, -22, 0, -24)..cubicTo(9, -22, 9, -10, 0, 0)..close();
      c.drawPath(p, Paint()..color = C.navy); c.drawPath(p, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 1.5); c.drawCircle(const Offset(0, -15), 3.5, Paint()..color = C.gold); c.restore(); }
    m.extra?.call(c, k);
    c.restore();
  }
  void _label(Canvas c, String t, Offset at, double fs) {
    final style = TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w700, fontSize: fs, color: C.navy);
    final halo = TextPainter(text: TextSpan(text: t, style: style.copyWith(foreground: Paint()..style = PaintingStyle.stroke..strokeWidth = fs * .22..color = C.mapBg)), textDirection: TextDirection.ltr)..layout();
    final tp = TextPainter(text: TextSpan(text: t, style: style), textDirection: TextDirection.ltr)..layout();
    final p = at - Offset(tp.width / 2, tp.height * .75); halo.paint(c, p); tp.paint(c, p);
  }
  void _dashed(Canvas c, Path p, Color col, double w) {
    final paint = Paint()..color = col..style = PaintingStyle.stroke..strokeWidth = w;
    for (final m in p.computeMetrics()) { var dd = 0.0; while (dd < m.length) { c.drawPath(m.extractPath(dd, dd + 3), paint); dd += 6; } }
  }
  @override bool shouldRepaint(_MapP o) => true;
}

/// The CICT → Quezon Hall walk in miniature (home card, reminders, intro slide).
class MiniRoute extends StatelessWidget {
  const MiniRoute({super.key, this.progress = 1, this.head = false});
  final double progress; final bool head;
  @override
  Widget build(BuildContext context) {
    final d = context.d, r = d.routes['cict-building>quezon-hall'], pts = [for (final q in r['pts'] as List) Offset((q[0] as num).toDouble(), (q[1] as num).toDouble())];
    return LayoutBuilder(builder: (_, c) => CustomPaint(size: Size(c.maxWidth, c.maxHeight), painter: _MiniP(d, pts, progress, head)));
  }
}
class _MiniP extends CustomPainter {
  _MiniP(this.d, this.pts, this.t, this.head); final WFData d; final List<Offset> pts; final double t; final bool head;
  @override
  void paint(Canvas c, Size size) {
    if (size.width < 60 || size.height < 40) return;
    final f = fitPoints(pts, size, const EdgeInsets.fromLTRB(24, 14, 24, 14)), k = f.k;
    c.drawRect(Offset.zero & size, Paint()..color = C.mapBg);
    c.save(); c.clipRect(Offset.zero & size); c.scale(k); c.translate(-f.o.dx, -f.o.dy);
    for (final s in d.shapes) { if (s.line) continue;
      c.drawPath(s.path, Paint()..color = s.name == 'Quezon Hall' ? C.gold : s.name == 'CICT Building' ? const Color(0xFF9FC3E8) : const Color(0xFFE1D7C3));
      c.drawPath(s.path, Paint()..color = s.name == 'Quezon Hall' ? C.goldDeep : const Color(0xFFCDBFA4)..style = PaintingStyle.stroke..strokeWidth = .5); }
    final path = Path()..moveTo(pts[0].dx, pts[0].dy); for (final p in pts.skip(1)) { path.lineTo(p.dx, p.dy); }
    c.drawPath(path, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 5..strokeJoin = StrokeJoin.round..strokeCap = StrokeCap.round);
    final m = path.computeMetrics().first, part = m.extractPath(0, m.length * t);
    c.drawPath(part, Paint()..color = const Color(0xFF123A9C)..style = PaintingStyle.stroke..strokeWidth = 2.6..strokeJoin = StrokeJoin.round..strokeCap = StrokeCap.round);
    c.drawCircle(pts.first, 3.6, Paint()..color = C.blue); c.drawCircle(pts.first, 3.6, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 1.4);
    c.drawCircle(pts.last, 4.2, Paint()..color = C.gold); c.drawCircle(pts.last, 4.2, Paint()..color = C.navy..style = PaintingStyle.stroke..strokeWidth = 1.2);
    if (head && t > 0) { final tan = m.getTangentForOffset(m.length * t); if (tan != null) { c.save(); c.translate(tan.position.dx, tan.position.dy); c.rotate(-tan.angle); c.scale(.1); arrowhead(c); c.restore(); } }
    c.restore();
  }
  @override bool shouldRepaint(_MiniP o) => o.t != t;
}
/// The folded arrowhead (navy + sky halves, cream outline), pointing along +x.
void arrowhead(Canvas c) {
  c.drawPath(Path()..moveTo(38, 0)..lineTo(-44, -44)..lineTo(-24, 0)..close(), Paint()..color = C.navy);
  c.drawPath(Path()..moveTo(38, 0)..lineTo(-24, 0)..lineTo(-44, 44)..close(), Paint()..color = C.sky);
  c.drawPath(Path()..moveTo(38, 0)..lineTo(-44, -44)..lineTo(-24, 0)..lineTo(-44, 44)..close(), Paint()..color = C.cream..style = PaintingStyle.stroke..strokeWidth = 8..strokeJoin = StrokeJoin.round);
}

/// A building's real outline from the campus map, drawn small.
class Silhouette extends StatelessWidget {
  const Silhouette(this.shape, {super.key, this.size = 40});
  final String? shape; final double size;
  @override
  Widget build(BuildContext context) {
    final s = context.d.shapeBy(shape); if (s == null) return SizedBox.square(dimension: size);
    return CustomPaint(size: Size.square(size), painter: _SiloP(s));
  }
}
class _SiloP extends CustomPainter {
  _SiloP(this.s); final CampusShape s;
  @override
  void paint(Canvas c, Size size) {
    final b = s.path.getBounds(), m = math.max(b.width, b.height) * .14, span = math.max(b.width, b.height) + 2 * m, k = size.width / span;
    c.scale(k); c.translate(-(b.center.dx - span / 2), -(b.center.dy - span / 2));
    c.drawPath(s.path, Paint()..color = C.gold); c.drawPath(s.path, Paint()..color = C.goldDeep..style = PaintingStyle.stroke..strokeWidth = math.max(b.width, b.height) / 30..strokeJoin = StrokeJoin.round);
  }
  @override bool shouldRepaint(_) => false;
}

/// A floor plan image with the gold room outline and tappable rooms (rects are fractions of the image).
class FloorPlan extends StatelessWidget {
  const FloorPlan({super.key, required this.plan, required this.rooms, this.hl, this.hlLabel, this.picked = false, this.onTapRoom, this.onTapHl});
  final Map plan; final List<MapEntry<String, Map>> rooms; final Map? hl; final String? hlLabel; final bool picked; final ValueChanged<String>? onTapRoom; final VoidCallback? onTapHl;
  @override
  Widget build(BuildContext context) => Container(decoration: cardDeco(r: 14), clipBehavior: Clip.antiAlias, child: AspectRatio(aspectRatio: (plan['w'] as num) / (plan['h'] as num),
      child: LayoutBuilder(builder: (_, c) {
        Rect at(Map r) { final q = (r['rect'] as List).map((v) => (v as num).toDouble()).toList(); return Rect.fromLTWH(q[0] * c.maxWidth, q[1] * c.maxHeight, q[2] * c.maxWidth, q[3] * c.maxHeight); }
        return Stack(clipBehavior: Clip.none, children: [
          Positioned.fill(child: Image.asset(asset(plan['src'] as String), fit: BoxFit.fill)),
          for (final e in rooms) if (e.value != hl) Positioned.fromRect(rect: at(e.value), child: GestureDetector(onTap: () => onTapRoom?.call(e.key), child: Semantics(button: true, label: (e.value['name'] ?? e.key) as String, child: const ColoredBox(color: Colors.transparent)))),
          if (hl != null) ...[
            Positioned.fromRect(rect: at(hl!), child: GestureDetector(onTap: onTapHl, child: Container(decoration: BoxDecoration(color: C.gold.withValues(alpha: picked ? .55 : .34), border: Border.all(color: picked ? C.navy : C.goldDeep, width: picked ? 3 : 2.5))))),
            Builder(builder: (_) { final r = at(hl!), below = (hl!['rect'][1] as num) < .14;
              return Positioned(left: (r.center.dx - 40).clamp(0.0, math.max(0.0, c.maxWidth - 80)), top: below ? r.bottom + 4 : r.top - 22, width: 80, child: Center(child: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: C.gold, borderRadius: BorderRadius.circular(10)),
                child: Text(hlLabel ?? '', maxLines: 1, style: const TextStyle(fontFamily: T.ui, fontWeight: FontWeight.w800, fontSize: 11, color: C.navy))))); }),
          ],
        ]);
      })));
}
