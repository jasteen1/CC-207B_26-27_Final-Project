import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../core/app_scope.dart';
import '../core/search.dart';
import '../core/theme.dart';
import '../core/time.dart';
import '../data/schedule.dart';
import '../widgets/common.dart';
import 'home_screen.dart' show Unconfirmed;

class ScheduleScreen extends StatelessWidget {
  const ScheduleScreen({super.key});

  /// Tests replace the photo picker.
  static Future<XFile?> Function()? debugPicker;

  Future<void> _upload(BuildContext context) async {
    final store = AppScope.of(context).schedule;
    final messenger = ScaffoldMessenger.of(context);
    try {
      final file = await (debugPicker ?? () => ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1400, imageQuality: 80))();
      if (file == null) return;
      await store.setImage(base64Encode(await file.readAsBytes()));
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('The image couldn’t be opened. Try another photo.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = AppScope.of(context).schedule;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final classes = store.classes;
        return ListView(padding: const EdgeInsets.all(16), children: [
          TextButton.icon(onPressed: () => context.go('/'), icon: const Icon(Icons.arrow_back, size: 18), label: const Text('Home')),
          const Text('My Schedule', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
          const Notice('Private: your timetable and classes are saved on this device only. Times use Asia/Manila.', info: true),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('TIMETABLE IMAGE', style: TextStyle(fontSize: 11, letterSpacing: .8, color: wayBlue, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                if (store.imageBase64 != null) ...[
                  ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.memory(base64Decode(store.imageBase64!), semanticLabel: 'Your uploaded timetable', height: 220, fit: BoxFit.contain)),
                  const SizedBox(height: 6),
                  const Text('Use it as a reference while you enter or confirm each class. WayFinder doesn’t read the image automatically.', style: TextStyle(fontSize: 12, color: muted)),
                  const SizedBox(height: 8),
                  Wrap(spacing: 8, children: [
                    OutlinedButton(onPressed: () => _upload(context), child: const Text('Replace image')),
                    OutlinedButton(onPressed: () => store.setImage(null), child: const Text('Remove image')),
                  ]),
                ] else ...[
                  const Text('Upload a photo or screenshot of your class schedule, then confirm each class.', style: TextStyle(color: muted)),
                  const SizedBox(height: 10),
                  FilledButton.icon(onPressed: () => _upload(context), icon: const Icon(Icons.upload, size: 18), label: const Text('Upload timetable')),
                ],
              ]),
            ),
          ),
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Text('Reminders appear while WayFinder is open. Background notifications need the notifications plugin on a phone (not set up yet).', style: TextStyle(fontSize: 13, color: muted)),
            ),
          ),
          Row(children: [
            const Expanded(child: Text('WEEKLY CLASSES', style: TextStyle(fontSize: 11, letterSpacing: 1, color: muted, fontWeight: FontWeight.w700))),
            FilledButton(onPressed: () => context.go('/schedule/new'), child: const Text('Add class')),
          ]),
          if (classes.isEmpty) const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('No classes yet', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)))),
          for (var d = 1; d <= 7; d++)
            if (classes.any((c) => c.weekday == d)) ...[
              Padding(padding: const EdgeInsets.only(top: 12, bottom: 4), child: Text(weekdays[d - 1], style: const TextStyle(fontWeight: FontWeight.w700, color: navy))),
              for (final c in classes.where((c) => c.weekday == d).toList()..sort((a, b) => a.start.compareTo(b.start)))
                Card(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => context.go('/schedule/${c.id}'),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(c.subject, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                            Text('${formatClock(c.start)}–${formatClock(c.end)}${c.professor != null ? ' · ${c.professor}' : ''}', style: const TextStyle(color: muted, fontSize: 13)),
                            if (c.roomPlaceId == null) const Padding(padding: EdgeInsets.only(top: 6), child: Unconfirmed('Room location unconfirmed')),
                          ]),
                        ),
                        const SizedBox(width: 8),
                        Text(c.roomCodeRaw, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: navy)),
                      ]),
                    ),
                  ),
                ),
            ],
        ]);
      },
    );
  }
}

class ClassFormScreen extends StatefulWidget {
  const ClassFormScreen({super.key, this.classId});
  final String? classId;

  @override
  State<ClassFormScreen> createState() => _ClassFormScreenState();
}

class _ClassFormScreenState extends State<ClassFormScreen> {
  final _subject = TextEditingController(), _start = TextEditingController(text: '08:00'), _end = TextEditingController(text: '09:30');
  final _room = TextEditingController(), _prof = TextEditingController();
  int _weekday = 1;
  int? _remind = 15;
  String? _error;
  bool _saving = false, _init = false;
  ClassSession? _existing;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_init) return;
    _init = true;
    final c = widget.classId == null ? null : AppScope.of(context).schedule.byId(widget.classId!);
    _existing = c;
    if (c != null) {
      _subject.text = c.subject;
      _start.text = c.start;
      _end.text = c.end;
      _room.text = c.roomCodeRaw;
      _prof.text = c.professor ?? '';
      _weekday = c.weekday;
      _remind = c.remindMinutes;
    }
  }

  static final _hhmm = RegExp(r'^([01]\d|2[0-3]):[0-5]\d$');

  Future<void> _save() async {
    final scope = AppScope.of(context);
    setState(() => _error = null);
    if (_subject.text.trim().isEmpty) return setState(() => _error = 'Enter the subject.');
    if (_room.text.trim().isEmpty) return setState(() => _error = 'Enter the room code from your timetable.');
    if (!_hhmm.hasMatch(_start.text) || !_hhmm.hasMatch(_end.text)) return setState(() => _error = 'Use 24-hour times like 08:00 or 13:30.');
    if (toMinutes(_end.text) <= toMinutes(_start.text)) return setState(() => _error = 'End time must be after the start time.');
    setState(() => _saving = true);
    final raw = _room.text.trim();
    String? placeId;
    if (looksLikeRoomCode(raw)) {
      try {
        final hits = (await scope.places.search(raw)).where((v) => v.place.roomCode == normalizeRoomCode(raw)).toList();
        if (hits.length == 1) placeId = hits.first.place.id;
      } catch (_) {/* lookup failed: keep as unconfirmed */}
    }
    await scope.schedule.save(ClassSession(
      id: _existing?.id ?? '${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(1 << 32)}',
      subject: _subject.text.trim(),
      weekday: _weekday,
      start: _start.text,
      end: _end.text,
      roomCodeRaw: raw,
      roomPlaceId: placeId,
      professor: _prof.text.trim().isEmpty ? null : _prof.text.trim(),
      remindMinutes: _remind,
    ));
    if (mounted) context.go('/schedule');
  }

  InputDecoration _dec(String label, [String? hint]) => InputDecoration(labelText: label, hintText: hint, filled: true, fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)));

  @override
  Widget build(BuildContext context) {
    if (widget.classId != null && _existing == null) {
      return ListView(padding: const EdgeInsets.all(16), children: const [Text('Class not found', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800))]);
    }
    return ListView(padding: const EdgeInsets.all(16), children: [
      TextButton.icon(onPressed: () => context.go('/schedule'), icon: const Icon(Icons.arrow_back, size: 18), label: const Text('My Schedule')),
      Text(_existing == null ? 'Add class' : 'Edit class', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
      const SizedBox(height: 12),
      TextField(key: const Key('subject'), controller: _subject, decoration: _dec('Subject', 'e.g. CIT 210 Web Systems')),
      const SizedBox(height: 10),
      DropdownButtonFormField<int>(
        key: const Key('day'),
        isExpanded: true, // fit narrow phones and large text instead of overflowing
        initialValue: _weekday,
        decoration: _dec('Day'),
        items: [for (var i = 1; i <= 7; i++) DropdownMenuItem(value: i, child: Text(weekdays[i - 1]))],
        onChanged: (v) => setState(() => _weekday = v ?? 1),
      ),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(child: TextField(key: const Key('start'), controller: _start, decoration: _dec('Starts (24h)', '08:00'))),
        const SizedBox(width: 10),
        Expanded(child: TextField(key: const Key('end'), controller: _end, decoration: _dec('Ends (24h)', '09:30'))),
      ]),
      const SizedBox(height: 10),
      TextField(key: const Key('room'), controller: _room, decoration: _dec('Room code', 'As written on your timetable, e.g. CB 203')),
      const SizedBox(height: 10),
      TextField(key: const Key('prof'), controller: _prof, decoration: _dec('Professor', 'Optional')),
      const SizedBox(height: 10),
      DropdownButtonFormField<int?>(
        key: const Key('remind'),
        isExpanded: true,
        initialValue: _remind,
        decoration: _dec('Reminder'),
        items: const [
          DropdownMenuItem(value: null, child: Text('No reminder')),
          DropdownMenuItem(value: 5, child: Text('5 minutes before')),
          DropdownMenuItem(value: 10, child: Text('10 minutes before')),
          DropdownMenuItem(value: 15, child: Text('15 minutes before')),
          DropdownMenuItem(value: 30, child: Text('30 minutes before')),
        ],
        onChanged: (v) => setState(() => _remind = v),
      ),
      const SizedBox(height: 8),
      const Text('Times are Asia/Manila. If the room code isn’t in the campus records, it’s kept exactly as typed and marked “Room location unconfirmed”.', style: TextStyle(fontSize: 12, color: muted)),
      if (_error != null) Notice(_error!),
      const SizedBox(height: 12),
      FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Saving…' : 'Save class')),
      if (_existing != null) ...[
        const SizedBox(height: 8),
        OutlinedButton(
          style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFB42318)),
          onPressed: () async {
            await AppScope.of(context).schedule.remove(_existing!.id);
            if (context.mounted) context.go('/schedule');
          },
          child: const Text('Delete class'),
        ),
      ],
    ]);
  }
}
