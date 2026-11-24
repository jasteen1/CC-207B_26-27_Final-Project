import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/app_scope.dart';
import '../core/theme.dart';
import '../data/guide_client.dart';

sealed class _Msg {}
class _User extends _Msg { _User(this.text); final String text; }
class _Ai extends _Msg { _Ai(this.text, this.cites); final String text; final List<Citation> cites; }
class _Fallback extends _Msg { _Fallback(this.hits, {this.loading = false}); final List<_Hit> hits; final bool loading; }
class _Hit { _Hit(this.type, this.id, this.label, this.detail, this.demo); final String type, id, label; final String? detail; final bool demo; }

String _link(String type, String id) => switch (type) {
      'place' => '/map?to=${Uri.encodeQueryComponent(id)}',
      'process' => '/processes/${Uri.encodeComponent(id)}',
      _ => '/directory/faculty/${Uri.encodeComponent(id)}',
    };

class GuideScreen extends StatefulWidget {
  const GuideScreen({super.key});
  @override
  State<GuideScreen> createState() => _GuideScreenState();
}

class _GuideScreenState extends State<GuideScreen> {
  Lang _lang = Lang.en;
  final _msgs = <_Msg>[];
  final _input = TextEditingController();
  bool _busy = false, _aiDown = false;

  Future<List<_Hit>> _search(String q) async {
    final scope = AppScope.of(context);
    final code = RegExp(r'[A-Za-z]{1,5}[\s-]?\d{1,4}[A-Za-z]?').firstMatch(q)?.group(0);
    // With a room code in the question, its pieces ("qh", "99") are not separate search terms: they would
    // offer QH 1 for "Where is QH 99?".
    final codeKey = code?.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '') ?? '';
    final terms = [?code, ...keywords(q).where((k) => codeKey.isEmpty || !codeKey.contains(k))].take(4);
    final hits = <String, _Hit>{};
    for (final t in terms) {
      try { for (final v in await scope.places.search(t)) { hits['p:${v.place.id}'] = _Hit('place', v.place.id, v.place.name, v.parent?.name, scope.places.isDemo); } } catch (_) {}
      try { for (final p in await scope.processes.list(t)) { hits['r:${p.id}'] = _Hit('process', p.id, p.name, '${p.steps.length} steps', p.isDemo); } } catch (_) {}
      try { for (final f in await scope.faculty.search(t)) { hits['f:${f.recordId}'] = _Hit('faculty', f.recordId, f.fullName, f.department, f.isDemo); } } catch (_) {}
    }
    return hits.values.take(8).toList();
  }

  Future<void> _ask(String q) async {
    final text = q.trim();
    if (text.isEmpty || _busy) return;
    final s = guideStrings[_lang]!;
    _input.clear();
    setState(() { _msgs.add(_User(text)); _busy = true; });
    try {
      final a = await AppScope.of(context).guide.ask(text, _lang);
      setState(() { _aiDown = false; _msgs.add(_Ai(a.grounded && a.answer.isNotEmpty ? a.answer : s.noInfo, a.citations)); });
    } on GuideUnavailable {
      setState(() { _aiDown = true; _msgs.add(_Fallback(const [], loading: true)); });
      final hits = await _search(text);
      if (mounted) setState(() => _msgs[_msgs.length - 1] = _Fallback(hits));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = guideStrings[_lang]!;
    Widget bubble(Widget child, {bool user = false, bool dashed = false}) => Align(
          alignment: user ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            constraints: const BoxConstraints(maxWidth: 320),
            margin: const EdgeInsets.symmetric(vertical: 5),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: user ? wayBlue : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: user ? null : Border.all(color: dashed ? gold : line),
            ),
            child: DefaultTextStyle.merge(style: TextStyle(color: user ? Colors.white : ink), child: child),
          ),
        );
    Widget cite(String label, String to, {String? detail, bool demo = false}) => Padding(
          padding: const EdgeInsets.only(top: 6),
          child: InkWell(
            onTap: () => context.go(to),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: blueSoft, borderRadius: BorderRadius.circular(10)),
              child: Text.rich(TextSpan(children: [
                TextSpan(text: '$label ›', style: const TextStyle(fontWeight: FontWeight.w700, color: navy)),
                if (detail != null) TextSpan(text: '  $detail', style: const TextStyle(color: muted)),
                if (demo) const TextSpan(text: '  Demo', style: TextStyle(color: Color(0xFF8A5A00), fontWeight: FontWeight.w700)),
              ])),
            ),
          ),
        );

    return Column(children: [
      Expanded(
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Row(children: [
            Container(width: 46, height: 46, decoration: BoxDecoration(color: wayBlue, borderRadius: BorderRadius.circular(14)), child: const Icon(Icons.auto_awesome, color: gold)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('WayFinder AI', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              Text(_aiDown ? 'AI unavailable · showing directory and process search' : 'Answers from published campus records', style: const TextStyle(fontSize: 12, color: muted)),
            ])),
          ]),
          const SizedBox(height: 10),
          Wrap(spacing: 8, children: [
            for (final (l, label) in [(Lang.en, 'English'), (Lang.tl, 'Tagalog'), (Lang.hil, 'Hiligaynon')])
              ChoiceChip(label: Text(label), selected: _lang == l, onSelected: (_) => setState(() => _lang = l), selectedColor: wayBlue, labelStyle: TextStyle(color: _lang == l ? Colors.white : ink)),
          ]),
          const SizedBox(height: 8),
          bubble(Text(s.greeting)),
          for (final m in _msgs)
            switch (m) {
              _User(:final text) => bubble(Text(text), user: true),
              _Ai(:final text, :final cites) => bubble(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(text),
                  for (final c in cites) cite(c.label, _link(c.type, c.id)),
                ])),
              _Fallback(:final hits, :final loading) => bubble(dashed: true, Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: const Color(0xFFECEFF5), borderRadius: BorderRadius.circular(99)),
                      child: const Text('Search results · not an AI answer', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: muted))),
                  const SizedBox(height: 6),
                  Text(s.fallback),
                  if (loading) const Padding(padding: EdgeInsets.all(8), child: LinearProgressIndicator()),
                  if (!loading && hits.isEmpty) Text(s.none, style: const TextStyle(color: muted)),
                  for (final h in hits) cite(h.label, _link(h.type, h.id), detail: h.detail, demo: h.demo),
                ])),
            },
          if (_msgs.isEmpty) ...[
            const SizedBox(height: 12),
            const Text('SUGGESTED QUESTIONS', style: TextStyle(fontSize: 11, letterSpacing: 1, color: muted, fontWeight: FontWeight.w700)),
            for (final q in s.suggestions)
              Align(alignment: Alignment.centerLeft, child: Padding(padding: const EdgeInsets.only(top: 6), child: ActionChip(label: Text(q), onPressed: () => _ask(q), backgroundColor: Colors.white))),
          ],
        ]),
      ),
      Container(
        color: pageBg,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        child: Row(children: [
          Expanded(child: TextField(controller: _input, onSubmitted: _ask, textInputAction: TextInputAction.send,
              decoration: InputDecoration(hintText: s.placeholder, filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(14))))),
          const SizedBox(width: 8),
          FilledButton(onPressed: _busy ? null : () => _ask(_input.text), child: const Text('Send')),
        ]),
      ),
    ]);
  }
}
