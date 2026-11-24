enum DataStatus { demo, unverified, verified }

DataStatus _status(String? s) => switch (s) {
      'verified' => DataStatus.verified,
      'demo' => DataStatus.demo,
      _ => DataStatus.unverified,
    };

/// One shared place ID space (buildings, rooms, offices...), identical to the web app's `places` table.
class Place {
  const Place({
    required this.id,
    required this.kind,
    required this.name,
    this.shortName,
    this.roomCode,
    this.roomLabel,
    this.floor,
    this.parentId,
    this.lng,
    this.lat,
    required this.status,
  });

  final String id;
  final String kind;
  final String name;
  final String? shortName;
  final String? roomCode;

  /// The label exactly as printed on the classroom door ("ICT 201"); [roomCode] is the search key.
  final String? roomLabel;
  final int? floor;
  final String? parentId;
  final double? lng;
  final double? lat;
  final DataStatus status;

  bool get hasPoint => lng != null && lat != null;

  /// Parses the PostgREST row shape (snake_case) used by Supabase.
  factory Place.fromRow(Map<String, dynamic> r) => Place(
        id: r['id'] as String,
        kind: r['kind'] as String,
        name: r['name'] as String,
        shortName: r['short_name'] as String?,
        roomCode: r['room_code'] as String?,
        roomLabel: r['room_label'] as String?,
        floor: (r['floor'] as num?)?.toInt(),
        parentId: r['parent_id'] as String?,
        lng: (r['lng'] as num?)?.toDouble(),
        lat: (r['lat'] as num?)?.toDouble(),
        status: _status(r['status'] as String?),
      );

  /// Parses the web app's demo fixture shape (camelCase).
  factory Place.fromFixture(Map<String, dynamic> r) => Place(
        id: r['id'] as String,
        kind: r['kind'] as String,
        name: r['name'] as String,
        shortName: r['shortName'] as String?,
        roomCode: r['roomCode'] as String?,
        roomLabel: r['roomLabel'] as String?,
        floor: (r['floor'] as num?)?.toInt(),
        parentId: r['parentId'] as String?,
        lng: (r['lng'] as num?)?.toDouble(),
        lat: (r['lat'] as num?)?.toDouble(),
        status: _status(r['status'] as String?),
      );
}

/// A place together with its parent (a room's building).
class PlaceView {
  const PlaceView(this.place, [this.parent]);
  final Place place;
  final Place? parent;

  /// A room has no point of its own: its building's point is used (and the UI says so).
  double? get lng => place.lng ?? parent?.lng;
  double? get lat => place.lat ?? parent?.lat;
  bool get hasPoint => lng != null && lat != null;
  bool get pointIsBuilding => place.kind == 'room' && !place.hasPoint && parent?.hasPoint == true;
}

class PlacesResult {
  const PlacesResult(this.items, {required this.isDemo});
  final List<PlaceView> items;
  final bool isDemo;
}
