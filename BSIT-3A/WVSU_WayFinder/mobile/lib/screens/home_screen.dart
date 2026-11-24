import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/app_scope.dart';
import '../core/theme.dart';
import '../core/time.dart';
import '../data/schedule.dart';

class SearchField extends StatefulWidget {
  const SearchField({super.key, this.initial = '', this.autofocus = false});
  final String initial;
  final bool autofocus;

  @override
  State<SearchField> createState() => _SearchFieldState();
}

class _SearchFieldState extends State<SearchField> {
  late final _controller = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit(String value) {
    final q = value.trim();
    if (q.isNotEmpty) context.go('/search?q=${Uri.encodeQueryComponent(q)}');
  }

  @override
  Widget build(BuildContext context) => TextField(
        controller: _controller,
        autofocus: widget.autofocus,
        textInputAction: TextInputAction.search,
        onSubmitted: _submit,
        decoration: InputDecoration(
          hintText: 'Search rooms, offices, buildings',
          prefixIcon: const Icon(Icons.search),
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: line)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: line)),
        ),
      );
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final quick = [
      ('Campus Map', Icons.map_outlined, '/map'),
      ('Process Documents', Icons.description_outlined, '/processes'),
      ('Find a Teacher', Icons.apartment_outlined, '/directory'),
      ('Ask WayFinder', Icons.chat_bubble_outline, '/guide'),
    ];
    return ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 16), children: [
      const Text('WVSU WAYFINDER', style: TextStyle(fontSize: 12, letterSpacing: 1.4, color: wayBlue, fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      Text('Hi! Where do you need to go?', style: TextStyle(fontSize: MediaQuery.sizeOf(context).width < 360 ? 20 : 26, fontWeight: FontWeight.w800, height: 1.15)),
      const SizedBox(height: 12),
      // The student's next step comes first: Add my schedule, or the next class with Find room.
      const NextClassCard(),
      const SizedBox(height: 8),
      const SearchField(),
      const SizedBox(height: 8),
      const SizedBox(height: 10),
      const Text('QUICK ACTIONS', style: TextStyle(fontSize: 11, letterSpacing: 1.2, color: muted, fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      // Two per row, sized by their content (prototype: icon above a short label). No fixed aspect
      // ratio, so larger text grows the card instead of overflowing it, and wide phones get no dead space.
      for (var r = 0; r < quick.length; r += 2)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (final (k, (label, icon, route)) in quick.sublist(r, r + 2).indexed) ...[
                if (k > 0) const SizedBox(width: 10),
                Expanded(
                  child: Card(
                    margin: EdgeInsets.zero,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => context.go(route),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                          Container(width: 34, height: 34, decoration: BoxDecoration(color: wayBlue, borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: Colors.white, size: 19)),
                          const SizedBox(height: 8),
                          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
                        ]),
                      ),
                    ),
                  ),
                ),
              ],
            ]),
          ),
        ),
    ]);
  }
}

/// When, what, who, which room, and where to tap — the first thing on Home.
class NextClassCard extends StatefulWidget {
  const NextClassCard({super.key, this.now});
  final DateTime Function()? now;

  @override
  State<NextClassCard> createState() => _NextClassCardState();
}

class _NextClassCardState extends State<NextClassCard> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 30), (_) => mounted ? setState(() {}) : null);
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = AppScope.of(context).schedule;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final now = (widget.now ?? appClock)();
        final next = nextClass(store.classes, now);
        if (next == null) {
          return Card(
            color: blueSoft,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Compact so the main action fits on a small phone's first screen.
                const Text('See your next class here', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                const Text('Add your classes once to get the next room and directions.', style: TextStyle(color: muted)),
                const SizedBox(height: 10),
                SizedBox(width: double.infinity, child: FilledButton(onPressed: () => context.go('/schedule/new'), child: const Text('Add my schedule'))),
              ]),
            ),
          );
        }
        final s = next.session;
        return Card(
          key: const ValueKey('next-class'),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Compact: subject, day, time, professor, room and Find room fit a small phone's first screen.
              Builder(builder: (context) {
                final label = _Label(Icons.calendar_today_outlined, 'NEXT CLASS · ${weekdays[s.weekday - 1].toUpperCase()}');
                final link = TextButton(
                  style: TextButton.styleFrom(visualDensity: VisualDensity.compact, padding: const EdgeInsets.symmetric(horizontal: 8)),
                  onPressed: () => context.go('/schedule'),
                  child: const Text('My Schedule'),
                );
                // Very large text: the label gets its own line instead of being squeezed by the link.
                return MediaQuery.textScalerOf(context).scale(10) > 15
                    ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [label, link])
                    : Row(children: [Expanded(child: label), link]);
              }),
              Text(s.subject, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, height: 1.2)),
              const SizedBox(height: 6),
              Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, runSpacing: 4, children: [
                const Icon(Icons.schedule, size: 16, color: muted),
                Text('${formatClock(s.start)}–${formatClock(s.end)}', style: const TextStyle(fontWeight: FontWeight.w700)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                  decoration: BoxDecoration(color: goldSoft, borderRadius: BorderRadius.circular(99), border: Border.all(color: gold)),
                  child: Text(relativeStart(next.start, next.end, now), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              ]),
              if (s.professor != null) ...[
                const SizedBox(height: 4),
                Row(children: [const Icon(Icons.person_outline, size: 16, color: muted), const SizedBox(width: 6), Expanded(child: Text(s.professor!, maxLines: 1, overflow: TextOverflow.ellipsis))]),
              ],
              const SizedBox(height: 8),
              // The room and the action that finds it: side by side, or stacked when the text is very large.
              Builder(builder: (context) {
                final stacked = MediaQuery.textScalerOf(context).scale(10) > 15;
                return Flex(
                  direction: stacked ? Axis.vertical : Axis.horizontal,
                  crossAxisAlignment: stacked ? CrossAxisAlignment.stretch : CrossAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: blueSoft, borderRadius: BorderRadius.circular(12)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      const Text('ROOM', style: TextStyle(fontSize: 10, letterSpacing: 1.2, color: muted, fontWeight: FontWeight.w700)),
                      Text(s.roomCodeRaw, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: navy)),
                    ]),
                  ),
                ),
                const SizedBox(width: 8, height: 8),
                FilledButton.icon(
                  onPressed: () => context.go(s.roomPlaceId != null ? '/map?to=${Uri.encodeQueryComponent(s.roomPlaceId!)}' : '/search?q=${Uri.encodeQueryComponent(s.roomCodeRaw)}'),
                  icon: const Icon(Icons.place_outlined, size: 18),
                  label: const Text('Find room'),
                ),
                ]);
              }),
              if (s.roomPlaceId == null) ...[const SizedBox(height: 8), const Unconfirmed('Room location unconfirmed')],
            ]),
          ),
        );
      },
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.icon, this.text);
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Row(children: [
        Icon(icon, size: 15, color: wayBlue),
        const SizedBox(width: 6),
        Flexible(child: Text(text, style: const TextStyle(fontSize: 11, letterSpacing: .8, color: wayBlue, fontWeight: FontWeight.w700))),
      ]);
}

/// Gold dashed-style note for unconfirmed locations.
class Unconfirmed extends StatelessWidget {
  const Unconfirmed(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: goldSoft, borderRadius: BorderRadius.circular(12), border: Border.all(color: gold)),
        child: Text(text, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      );
}
