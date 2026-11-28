/// Numbers, units and dates as the web shows them, so both read the same.
library;

const _superscript = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

/// Significant digits, scientific form for very large or small values; values
/// negligible against [scale] (rounding noise at zero) print as 0.
String formatNumber(double? value, {int significant = 4, double scale = 0}) {
  if (value == null || !value.isFinite) return '—';
  if (value == 0 || value.abs() < (scale > 0 ? scale * 1e-9 : 1e-300)) return '0';
  final magnitude = value.abs();
  if (magnitude >= 1e5 || magnitude < 1e-3) {
    final parts = value.toStringAsExponential(2).split('e');
    final exponent = parts[1].replaceAll('+', '').split('').map((c) => _superscript[c] ?? c).join();
    return '${parts[0].replaceAll('-', '−')}×10$exponent';
  }
  var text = double.parse(value.toStringAsPrecision(significant)).toString();
  if (text.endsWith('.0')) text = text.substring(0, text.length - 2);
  return text.replaceAll('-', '−');
}

/// SI unit strings from the schema in display form (m/s^2 → m/s², degC → °C, ohm → Ω).
String prettyUnit(String unit) {
  if (unit.trim() == '1') return '';
  return unit
      .replaceAll(RegExp(r'\bdegC\b'), '°C')
      .replaceAll(RegExp(r'\bdegF\b'), '°F')
      .replaceAll(RegExp(r'\bohm\b'), 'Ω')
      .replaceAllMapped(RegExp(r'\^2|(?<=[a-zA-Z])2(?![0-9])'), (_) => '²')
      .replaceAllMapped(RegExp(r'\^3|(?<=[a-zA-Z])3(?![0-9])'), (_) => '³')
      .replaceAll('*', '·');
}

const _timeUnits = <(double, String)>[
  (31557600, 'năm'), (86400, 'ngày'), (3600, 'h'), (60, 'min'), (1, 's'), (1e-3, 'ms'), (1e-6, 'µs'), (1e-9, 'ns'),
];

/// A time in the unit that suits the whole run (6000 s → h, 1.3e-7 s → ns).
String formatTime(double seconds, double duration, {int digits = 2}) {
  final unit = _timeUnits.firstWhere((u) => duration / u.$1 >= 1, orElse: () => _timeUnits.last);
  final value = double.parse((seconds / unit.$1).toStringAsFixed(digits));
  var text = value.toString();
  if (text.endsWith('.0')) text = text.substring(0, text.length - 2);
  return '$text ${unit.$2}';
}

/// 1250000 → "1.250.000".
String formatInt(num? value) {
  if (value == null) return '—';
  final digits = value.round().abs().toString();
  final grouped = digits.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => '.');
  return '${value < 0 ? '−' : ''}$grouped';
}

/// 1250000 → "1.250.000 ₫".
String formatVnd(num? value) {
  if (value == null) return '—';
  return '${formatInt(value)} ₫';
}

String sentenceCase(String text) => text.isEmpty ? text : text[0].toUpperCase() + text.substring(1);

String _two(int value) => value.toString().padLeft(2, '0');

/// 17/11 · 14:30 (the year only when it is not this year).
String formatDateTime(DateTime? value) {
  if (value == null) return '—';
  final year = value.year == DateTime.now().year ? '' : '/${value.year}';
  return '${_two(value.day)}/${_two(value.month)}$year · ${_two(value.hour)}:${_two(value.minute)}';
}

/// "còn 2 ngày", "còn 5 giờ", "quá hạn 1 ngày".
String formatDue(DateTime due) {
  final difference = due.difference(DateTime.now());
  final late = difference.isNegative;
  final span = difference.abs();
  final text = span.inDays >= 1
      ? '${span.inDays} ngày'
      : span.inHours >= 1
          ? '${span.inHours} giờ'
          : '${span.inMinutes.clamp(1, 59)} phút';
  return late ? 'Quá hạn $text' : 'Còn $text';
}

String formatScore(double value) => value == value.roundToDouble() ? value.toInt().toString() : value.toStringAsFixed(1);
