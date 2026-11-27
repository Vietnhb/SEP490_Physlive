/// The JSON the PhysLive API returns, read defensively: a missing or mistyped
/// field becomes null or a neutral default instead of a crash.
library;

typedef Json = Map<String, dynamic>;

Json asJson(Object? value) => value is Map ? value.cast<String, dynamic>() : <String, dynamic>{};
List<Json> asJsonList(Object? value) => value is List ? value.map(asJson).toList() : const [];
String? asString(Object? value) => value?.toString();
double? asDouble(Object? value) => value is num ? value.toDouble() : double.tryParse('${value ?? ''}');
int? asInt(Object? value) => value is num ? value.toInt() : int.tryParse('${value ?? ''}');
bool asBool(Object? value) => value == true;
DateTime? asDate(Object? value) => value == null ? null : DateTime.tryParse(value.toString())?.toLocal();

class User {
  User(this.json);
  final Json json;

  int get id => asInt(json['id']) ?? 0;
  String get email => asString(json['email']) ?? '';
  String get fullName => (asString(json['fullName']) ?? '').trim().isEmpty ? email : json['fullName'].toString();
  String get role => asString(json['role']) ?? '';
  String? get schoolName => asString(json['schoolName']);
  String? get schoolId => asString(json['schoolId']);
  String? get avatarUrl => asString(json['avatarUrl']);
  List<String> get permissions => (json['permissions'] is List) ? (json['permissions'] as List).map((e) => '$e').toList() : const [];
  bool get mustChangePassword => asBool(json['mustChangePassword']);
  bool get suspended => json['active'] == false || json['accountStatus'] == 'SUSPENDED_READ_ONLY';

  bool get isStudent => role == 'STUDENT';
  bool get isTeacher => role == 'STAFF' && permissions.contains('TEACH');
  bool get isManager => role == 'MANAGER';
  bool get isSchool => role == 'SCHOOL';
  bool get isAdmin => role == 'ADMIN';
  bool get isReviewer => role == 'REVIEWER';

  /// The accounts the app is made for; staff who only run a department work from the web.
  bool get usesApp => isStudent || isTeacher || isManager || isSchool || isAdmin || isReviewer;

  String get roleLabel => switch (role) {
        'STUDENT' => 'Học sinh',
        'STAFF' => isTeacher ? 'Giáo viên' : 'Cán bộ trường',
        'SCHOOL' => 'Quản trị trường',
        'MANAGER' => 'Vận hành',
        'REVIEWER' => 'Kiểm duyệt',
        'ADMIN' => 'Quản trị hệ thống',
        _ => role,
      };

  String get initials {
    final words = fullName.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '?';
    return (words.length == 1 ? words.first[0] : words.first[0] + words.last[0]).toUpperCase();
  }
}

enum ActivityType { predictObserveExplain, measurement, parameterInvestigation, freeExploration }

class Measurement {
  Measurement(Json json)
      : seriesLabel = asString(json['seriesLabel']) ?? '',
        unit = asString(json['unit']) ?? '',
        sampleTime = asDouble(json['sampleTime']) ?? 0,
        tolerance = asDouble(json['tolerance']) ?? 0;
  final String seriesLabel;
  final String unit;
  final double sampleTime;
  final double tolerance;
}

class Investigation {
  Investigation(Json json)
      : parameterKey = asString(json['parameterKey']) ?? '',
        parameterLabel = asString(json['parameterLabel']) ?? '',
        outcomeLabel = asString(json['outcomeLabel']);
  final String parameterKey;
  final String parameterLabel;
  final String? outcomeLabel;
}

class Assignment {
  Assignment(this.json);
  final Json json;

  String get id => asString(json['id']) ?? '';
  String get title => asString(json['title']) ?? 'Bài tập';
  String? get description => asString(json['description']);
  String? get className => asString(json['className']);
  String? get assignedByName => asString(json['assignedByName']);
  String? get libraryItemTitle => asString(json['libraryItemTitle']);
  String get status => asString(json['status']) ?? '';
  bool get closed => status == 'CLOSED';
  DateTime? get assignedAt => asDate(json['assignedAt']);
  DateTime? get dueAt => asDate(json['dueAt']);
  DateTime? get completedAt => asDate(json['completedAt']);
  bool get predictionSubmitted => asBool(json['predictionSubmitted']);
  bool get submissionCompleted => asBool(json['submissionCompleted']);
  bool get retryAllowed => asBool(json['retryAllowed']);
  double get maxScore => asDouble(json['maxScore']) ?? 10;
  double? get score => asDouble(json['score']);
  String? get feedback => asString(json['feedback']);
  String? get gradingStatus => asString(json['gradingStatus']);
  int get studentCount => json['studentIds'] is List ? (json['studentIds'] as List).length : 0;
  Json get predictions => asJson(json['predictions']);

  Json get _questions => json['questions'] is Map ? asJson(json['questions']) : const {};
  String get prompt => asString(_questions['prompt']) ?? (json['questions'] is String ? json['questions'] as String : '');
  ActivityType get activity => switch (_questions['activityType']) {
        'MEASUREMENT' => ActivityType.measurement,
        'PARAMETER_INVESTIGATION' => ActivityType.parameterInvestigation,
        'FREE_EXPLORATION' => ActivityType.freeExploration,
        _ => ActivityType.predictObserveExplain,
      };
  Measurement? get measurement => _questions['measurement'] is Map ? Measurement(asJson(_questions['measurement'])) : null;
  Investigation? get investigation =>
      _questions['investigation'] is Map ? Investigation(asJson(_questions['investigation'])) : null;

  /// Handed in and not sent back for another try.
  bool get done => submissionCompleted && !retryAllowed;
  bool get overdue => !done && dueAt != null && dueAt!.isBefore(DateTime.now());
  bool get needsPrediction => activity == ActivityType.predictObserveExplain && !(predictionSubmitted && !retryAllowed);

  Assignment copyWith(Json changes) => Assignment({...json, ...changes});
}

class Submission {
  Submission(this.json);
  final Json json;

  String get id => asString(json['id']) ?? '';
  String get studentName => asString(json['studentName']) ?? 'Học sinh';
  DateTime? get submittedAt => asDate(json['submittedAt']);
  DateTime? get completedAt => asDate(json['completedAt']);
  double? get score => asDouble(json['score']);
  double get maxScore => asDouble(json['maxScore']) ?? 10;
  String? get feedback => asString(json['feedback']);
  String? get gradingStatus => asString(json['gradingStatus']);
  bool get retryAllowed => asBool(json['retryAllowed']);
  bool get completed => completedAt != null;
  Json get predictions => asJson(json['predictions']);
}

class LibraryItem {
  LibraryItem(this.json);
  final Json json;

  String get id => asString(json['id']) ?? '';
  String get simulationId => asString(json['simulationId']) ?? '';
  String get title => asString(json['title']) ?? 'Mô phỏng';
  String? get topic => asString(json['topic']);
  String get visibility => asString(json['visibility']) ?? 'PERSONAL';
  String? get sharedByName => asString(json['sharedByName']);
  String? get schoolName => asString(json['schoolName']);
  DateTime? get createdAt => asDate(json['createdAt']);
  String get validationStatus => asString(json['validationStatus']) ?? '';
}

/// A support request (feedback, message or simulation complaint) as the operations team sees it.
class SupportItem {
  SupportItem(this.json);
  final Json json;

  String get id => asString(json['id']) ?? '';
  String get kind => asString(json['kind']) ?? '';
  String get senderName => (asString(json['senderName']) ?? '').trim().isEmpty ? senderEmail : json['senderName'].toString();
  String get senderEmail => asString(json['senderEmail']) ?? '';
  String get subject => asString(json['subject']) ?? '';
  String get content => asString(json['content']) ?? '';
  String get status => asString(json['status']) ?? 'OPEN';
  String? get response => asString(json['adminResponse']);
  String? get responderName => asString(json['responderName']);
  DateTime? get createdAt => asDate(json['createdAt']);
  DateTime? get respondedAt => asDate(json['respondedAt']);

  /// Simulation complaints belong to reviewers; the operations team only reads them.
  bool get isComplaint => kind == 'COMPLAINT';
  bool get resolved => status == 'RESOLVED';

  String get kindLabel => switch (kind) {
        'FEEDBACK' => 'Góp ý',
        'MESSAGE' => 'Tin nhắn',
        'COMPLAINT' => 'Báo lỗi mô phỏng',
        _ => kind,
      };
  String get statusLabel => switch (status) {
        'OPEN' => 'Mới',
        'READ' => 'Đang xử lý',
        'RESOLVED' => 'Đã xong',
        _ => status,
      };
}

/// An account as the operations team and administrators see it.
class ManagedUser {
  ManagedUser(this.json);
  final Json json;

  int get id => asInt(json['id']) ?? 0;
  String get email => asString(json['email']) ?? '';
  String get fullName => (asString(json['fullName']) ?? '').trim().isEmpty ? email : json['fullName'].toString().trim();
  String get role => asString(json['role']) ?? '';
  String? get schoolName => asString(json['schoolName']);
  String? get avatarUrl => asString(json['avatarUrl']);
  String? get institutionId => asString(json['institutionId']);
  DateTime? get lastLogin => asDate(json['lastLogin']);
  String? get suspensionReason => asString(json['suspensionReason']);
  bool get suspended => json['active'] == false || json['accountStatus'] == 'SUSPENDED_READ_ONLY';
  bool get warned => json['accountStatus'] == 'WARNED';
}

/// A school customer: its licence, plan and use.
class SchoolAccount {
  SchoolAccount(this.json);
  final Json json;

  String get id => asString(json['id']) ?? '';
  String get name => asString(json['name']) ?? 'Trường';
  String? get code => asString(json['code']);
  String? get province => asString(json['provinceCity']);
  String? get address => asString(json['address']);
  String? get phone => asString(json['phoneNumber']);
  String? get email => asString(json['contactEmail']);
  String? get planCode => asString(json['planCode']);
  DateTime? get licenseStart => asDate(json['licenseStart']);
  DateTime? get licenseEnd => asDate(json['licenseEnd']);
  bool get active => json['active'] != false;
  bool get licenseActive => asBool(json['licenseActive']);
  String get subscriptionStatus => asString(json['subscriptionStatus']) ?? '';
  int? get studentQuota => asInt(json['studentQuota']);
  int? get tokenQuota => asInt(json['monthlyTokenQuota']);
  int get usedTokens => asInt(json['usedTokens']) ?? 0;
  int? get annualPrice => asInt(json['annualPriceVnd']);
}

/// A payment a school made (or tried to make) for a plan.
class Payment {
  Payment(this.json);
  final Json json;

  String get id => asString(json['id']) ?? '';
  String get schoolName => asString(json['schoolName']) ?? 'Trường';
  String? get managerEmail => asString(json['managerEmail']);
  String get planCode => asString(json['planCode']) ?? '';
  String? get purpose => asString(json['purpose']);
  int get amount => asInt(json['amountVnd']) ?? 0;
  String get status => (asString(json['status']) ?? 'PENDING').toUpperCase();
  DateTime? get createdAt => asDate(json['createdAt']);
  DateTime? get paidAt => asDate(json['paidAt']);
  bool get paid => status == 'PAID';
  bool get failed => status == 'FAILED';
}

/// A class a teacher teaches, with its students.
class TeacherClass {
  TeacherClass(this.json);
  final Json json;

  String get id => asString(json['id']) ?? '';
  String get name => asString(json['name']) ?? 'Lớp';
  int? get gradeLevel => asInt(json['gradeLevel']);
  String? get schoolYear => asString(json['schoolYear']);
  String? get subject => asString(json['subject']);
  List<Json> get students => asJsonList(json['students']);
}
