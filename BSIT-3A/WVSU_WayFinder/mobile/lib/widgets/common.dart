import 'package:flutter/material.dart';

import '../core/search.dart';
import '../core/theme.dart';
import '../data/models.dart';

/// Official logo, with the shared text placeholder if the asset can't load.
class WayFinderLogo extends StatelessWidget {
  const WayFinderLogo({super.key, this.height = 44});
  final double height;

  @override
  Widget build(BuildContext context) => Image.asset(
        'assets/wayfinder-logo.png',
        height: height,
        semanticLabel: 'WVSU WayFinder',
        errorBuilder: (_, __, ___) =>
            const Text('WVSU WayFinder', style: TextStyle(color: navy, fontWeight: FontWeight.w800, fontSize: 18)),
      );
}

class Notice extends StatelessWidget {
  const Notice(this.text, {super.key, this.info = false, this.action});
  final String text;
  final bool info;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: info ? blueSoft : goldSoft,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: info ? wayBlue : gold),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(text, style: const TextStyle(fontSize: 13)),
          if (action != null) Padding(padding: const EdgeInsets.only(top: 8), child: action),
        ]),
      );
}

/// Failed LIVE request: message + Retry. Never substitutes demo data.
class LoadError extends StatelessWidget {
  const LoadError({super.key, required this.what, required this.onRetry});
  final String what;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Semantics(
        liveRegion: true,
        child: Notice(
          'Couldn’t load $what. Check your connection and try again.',
          action: OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ),
      );
}

class StatusBadge extends StatelessWidget {
  const StatusBadge(this.status, {super.key});
  final DataStatus status;

  @override
  Widget build(BuildContext context) {
    final (label, bg, fg) = switch (status) {
      DataStatus.verified => ('Verified', const Color(0xFFDFF5E6), const Color(0xFF11663A)),
      DataStatus.demo => ('Demo', goldSoft, const Color(0xFF8A5A00)),
      DataStatus.unverified => ('Unverified', const Color(0xFFECEFF5), muted),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
      child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}

/// Room code, building and floor, only the ones we actually have.
class PlaceFacts extends StatelessWidget {
  const PlaceFacts(this.view, {super.key});
  final PlaceView view;

  @override
  Widget build(BuildContext context) {
    final p = view.place;
    final rows = <(String, String)>[
      if (p.roomCode != null) ('Room', roomDisplay(roomLabel: p.roomLabel, roomCode: p.roomCode, name: p.name)),
      if (view.parent != null) ('Building', view.parent!.name) else if (p.kind == 'building') ('Building', p.name),
      if (p.floor != null) ('Floor', '${p.floor}'),
    ];
    return Column(children: [
      for (final (k, v) in rows)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 76, child: Text(k.toUpperCase(), style: const TextStyle(fontSize: 11, color: muted, letterSpacing: .6))),
            Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600))), // wraps, never truncated
          ]),
        ),
    ]);
  }
}

/// Runs `load` and rebuilds on retry; ignores stale results when `loadKey` changes.
class Loader<T> extends StatefulWidget {
  const Loader({super.key, required this.loadKey, required this.load, required this.what, required this.builder});
  final String loadKey;
  final Future<T> Function() load;
  final String what;
  final Widget Function(BuildContext, T) builder;

  @override
  State<Loader<T>> createState() => _LoaderState<T>();
}

class _LoaderState<T> extends State<Loader<T>> {
  late Future<T> _future = widget.load();

  @override
  void didUpdateWidget(Loader<T> old) {
    super.didUpdateWidget(old);
    if (old.loadKey != widget.loadKey) _future = widget.load();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
        future: _future,
        builder: (context, snap) {
          if (snap.hasError) {
            return LoadError(what: widget.what, onRetry: () => setState(() {
              _future = widget.load();
            }));
          }
          if (!snap.hasData && snap.connectionState != ConnectionState.done) {
            return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
          }
          return widget.builder(context, snap.data as T);
        },
      );
}
