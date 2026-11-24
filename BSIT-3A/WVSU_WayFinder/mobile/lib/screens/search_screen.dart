import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/app_scope.dart';
import '../core/resolve.dart';
import '../core/theme.dart';
import '../data/models.dart';
import '../widgets/common.dart';
import 'home_screen.dart';

class SearchScreen extends StatelessWidget {
  const SearchScreen({super.key, required this.query});
  final String query;

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final q = query.trim();
    return ListView(padding: const EdgeInsets.all(16), children: [
      const Text('Search', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      // keyed so the box always shows exactly what the student typed
      SearchField(key: ValueKey(query), initial: query, autofocus: q.isEmpty),
      if (q.isEmpty)
        const Padding(padding: EdgeInsets.only(top: 12), child: Text('Type a room code like ICT 201, or an office or building name.', style: TextStyle(color: muted)))
      else
        Loader<List<SearchHit>>(
          loadKey: q,
          what: 'search results',
          load: () async {
            final records = await scope.places.search(q); // a failed live request shows Retry
            // Map polygons and prefixes only add context; if they can't load, records still show.
            final shapes = await scope.campusShapes().catchError((_) => const <Never>[]);
            final prefixes = await loadRoomPrefixes();
            return resolveSearch(q, records, [for (final b in shapes) MapBuildingRef(b.key, b.name, b.featureIds)], prefixes);
          },
          builder: (context, results) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (scope.places.isDemo) const Notice('Supabase is not configured. Showing DEMO records, not official WVSU information.'),
            if (results.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('No match for “$query”', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text(
                      'We don’t have ${scope.places.isDemo ? 'a demo record' : 'a verified place'} or a mapped building with that code or name. Check the spelling, or try another search above.',
                      style: const TextStyle(color: muted),
                    ),
                  ]),
                ),
              ),
            for (final h in results) _HitCard(hit: h),
          ]),
        ),
    ]);
  }
}

class _HitCard extends StatelessWidget {
  const _HitCard({required this.hit});
  final SearchHit hit;

  @override
  Widget build(BuildContext context) {
    const kind = TextStyle(fontSize: 11, letterSpacing: .8, color: wayBlue, fontWeight: FontWeight.w700);
    Widget card(String label, String title, List<Widget> body, {Widget? badge}) => Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: kind), if (badge != null) badge]),
              const SizedBox(height: 6),
              Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              ...body,
            ]),
          ),
        );
    return switch (hit) {
      PlaceHit(:final view) => PlaceCard(view: view),
      PrefixHit(:final label, :final message, :final building, :final buildingName, :final code) => card('ROOM CODE', label, [
          Unconfirmed(message),
          if (building != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: OutlinedButton.icon(
                onPressed: () => context.go(Uri(path: '/map', queryParameters: {'to': building.key, 'code': code}).toString()),
                icon: const Icon(Icons.place_outlined, size: 18),
                label: Text('Show $buildingName on Map'),
              ),
            ),
        ], badge: const _NotConfirmed()),
      PrefixUnmappedHit(:final label, :final message) => card('ROOM CODE', label, [Unconfirmed(message)], badge: const _NotConfirmed()),
      MappedHit(:final building, :final note) => card('CAMPUS MAP', building.name, [
          if (note != null) Text(note, style: const TextStyle(fontSize: 13, color: muted)),
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: OutlinedButton.icon(
              onPressed: () => context.go(Uri(path: '/map', queryParameters: {'to': building.key}).toString()),
              icon: const Icon(Icons.place_outlined, size: 18),
              label: const Text('Show on Map'),
            ),
          ),
        ]),
    };
  }
}

class _NotConfirmed extends StatelessWidget {
  const _NotConfirmed();
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(color: goldSoft, borderRadius: BorderRadius.circular(99)),
        child: const Text('Not confirmed', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF8A5A00))),
      );
}

class PlaceCard extends StatelessWidget {
  const PlaceCard({super.key, required this.view});
  final PlaceView view;

  @override
  Widget build(BuildContext context) {
    final p = view.place;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(p.kind.toUpperCase(), style: const TextStyle(fontSize: 11, letterSpacing: .8, color: wayBlue, fontWeight: FontWeight.w700)),
            StatusBadge(p.status),
          ]),
          const SizedBox(height: 6),
          Text(p.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          PlaceFacts(view),
          const SizedBox(height: 10),
          Wrap(spacing: 10, runSpacing: 8, children: [
            FilledButton(onPressed: () => context.go('/place/${p.id}'), child: const Text('View details')),
            OutlinedButton.icon(
              onPressed: () => context.go('/map?place=${p.id}'),
              icon: const Icon(Icons.place_outlined, size: 18),
              label: const Text('Show on Map'),
            ),
          ]),
        ]),
      ),
    );
  }
}
