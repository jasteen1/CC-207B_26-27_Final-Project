/// "cb 203", "CB-203", " cb203 " -> "CB203" (same rule as the web app).
String normalizeRoomCode(String input) => input.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

/// Letters followed by digits (optionally one trailing letter), e.g. CB203, LIB1, LAB2A.
bool looksLikeRoomCode(String input) =>
    RegExp(r'^[A-Z]{1,5}\d{1,4}[A-Z]?$').hasMatch(normalizeRoomCode(input));

/// "ICT 201", "ICT-201", "ict201" -> (code: ICT201, prefix: ICT, number: 201). null if not a room code.
({String code, String prefix, String number})? parseRoomCode(String input) {
  final code = normalizeRoomCode(input);
  final m = RegExp(r'^([A-Z]{1,5})(\d{1,4}[A-Z]?)$').firstMatch(code);
  return m == null ? null : (code: code, prefix: m.group(1)!, number: m.group(2)!);
}

/// What students see for a room: the label printed on the door, else the code, else the name.
String roomDisplay({String? roomLabel, String? roomCode, required String name}) => roomLabel ?? roomCode ?? name;
