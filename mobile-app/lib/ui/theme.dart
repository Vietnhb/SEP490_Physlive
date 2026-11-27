import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// One colour family: a strong foreground and the soft background it sits on.
typedef Tint = ({Color fg, Color bg});

/// The PhysLive canvas tokens: the logo's teal and navy, cool neutrals, the
/// status families, and a few bright tints for numbers and categories.
class Palette extends ThemeExtension<Palette> {
  const Palette({
    required this.ink, required this.muted, required this.line, required this.surface, required this.surface2,
    required this.background, required this.accent, required this.accentSoft, required this.brand,
    required this.success, required this.successSoft, required this.warning, required this.warningSoft,
    required this.danger, required this.dangerSoft, required this.info, required this.infoSoft,
    required this.teal, required this.blue, required this.amber, required this.violet, required this.rose,
    required this.green,
  });

  /// Text, secondary text, hairlines, cards, sunken areas and the page.
  final Color ink, muted, line, surface, surface2, background;

  /// The logo's teal (actions, selection) and navy (titles, the brand).
  final Color accent, accentSoft, brand;
  final Color success, successSoft, warning, warningSoft, danger, dangerSoft, info, infoSoft;
  final Tint teal, blue, amber, violet, rose, green;

  List<Tint> get tints => [teal, blue, amber, violet, rose, green];

  static const light = Palette(
    ink: Color(0xFF14213D), muted: Color(0xFF5D6B7E), line: Color(0xFFE3E8EF), surface: Color(0xFFFFFFFF),
    surface2: Color(0xFFF3F6F9), background: Color(0xFFF6F8FB), accent: Color(0xFF23919A),
    accentSoft: Color(0xFFE3F4F5), brand: Color(0xFF0B3262), success: Color(0xFF15803D),
    successSoft: Color(0xFFE9F9EF), warning: Color(0xFFB45309), warningSoft: Color(0xFFFFF5E1),
    danger: Color(0xFFC0262D), dangerSoft: Color(0xFFFDEEEE), info: Color(0xFF1D4ED8), infoSoft: Color(0xFFEDF3FF),
    teal: (fg: Color(0xFF0E7C86), bg: Color(0xFFE0F4F5)),
    blue: (fg: Color(0xFF2457D6), bg: Color(0xFFE8EFFF)),
    amber: (fg: Color(0xFFB35F00), bg: Color(0xFFFFF1D9)),
    violet: (fg: Color(0xFF6A47D1), bg: Color(0xFFF0EBFF)),
    rose: (fg: Color(0xFFC23159), bg: Color(0xFFFFE9EF)),
    green: (fg: Color(0xFF1C8549), bg: Color(0xFFE5F7EC)),
  );

  static const dark = Palette(
    ink: Color(0xFFE7ECF4), muted: Color(0xFF9CA9BC), line: Color(0xFF243149), surface: Color(0xFF111A2B),
    surface2: Color(0xFF172238), background: Color(0xFF0B1220), accent: Color(0xFF52C4CC),
    accentSoft: Color(0xFF0F2F35), brand: Color(0xFFBFD6F5), success: Color(0xFF4ADE80),
    successSoft: Color(0xFF0E2A1B), warning: Color(0xFFF6B54E), warningSoft: Color(0xFF2E2210),
    danger: Color(0xFFFF8080), dangerSoft: Color(0xFF341619), info: Color(0xFF8AB4FF), infoSoft: Color(0xFF14213F),
    teal: (fg: Color(0xFF5FD3DB), bg: Color(0xFF0F2F35)),
    blue: (fg: Color(0xFF8DB2FF), bg: Color(0xFF15234A)),
    amber: (fg: Color(0xFFFFC266), bg: Color(0xFF33250D)),
    violet: (fg: Color(0xFFB9A3FF), bg: Color(0xFF241B45)),
    rose: (fg: Color(0xFFFF8FB0), bg: Color(0xFF3A1724)),
    green: (fg: Color(0xFF6EE7A0), bg: Color(0xFF0F2C1D)),
  );

  @override
  Palette copyWith() => this;

  @override
  Palette lerp(ThemeExtension<Palette>? other, double t) => t < 0.5 ? this : (other as Palette? ?? this);
}

extension PaletteOf on BuildContext {
  Palette get palette => Theme.of(this).extension<Palette>()!;
}

/// Light, dark or the phone's setting, remembered on the device.
class ThemeController extends ValueNotifier<ThemeMode> {
  ThemeController() : super(ThemeMode.system);

  static const _key = 'physlive.theme';

  Future<void> load() async {
    final saved = (await SharedPreferences.getInstance()).getString(_key);
    value = ThemeMode.values.firstWhere((mode) => mode.name == saved, orElse: () => ThemeMode.system);
  }

  Future<void> set(ThemeMode mode) async {
    value = mode;
    await (await SharedPreferences.getInstance()).setString(_key, mode.name);
  }
}

/// The app's one theme setting.
final appTheme = ThemeController();

ThemeData buildTheme(Brightness brightness) {
  final p = brightness == Brightness.light ? Palette.light : Palette.dark;
  final onAccent = brightness == Brightness.light ? Colors.white : const Color(0xFF05242A);
  final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF23919A), brightness: brightness).copyWith(
    primary: p.accent,
    onPrimary: onAccent,
    primaryContainer: p.accentSoft,
    onPrimaryContainer: p.accent,
    secondaryContainer: p.accentSoft,
    onSecondaryContainer: p.accent,
    surface: p.surface,
    onSurface: p.ink,
    onSurfaceVariant: p.muted,
    outline: p.line,
    outlineVariant: p.line,
    error: p.danger,
    surfaceContainerLowest: p.surface,
    surfaceContainerLow: p.surface2,
    surfaceContainer: p.surface2,
    surfaceContainerHigh: p.surface2,
    surfaceContainerHighest: p.surface2,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: brightness);
  final text = base.textTheme.apply(bodyColor: p.ink, displayColor: p.ink);
  final radius = BorderRadius.circular(12);
  return base.copyWith(
    scaffoldBackgroundColor: p.background,
    extensions: [p],
    splashFactory: InkSparkle.splashFactory,
    textTheme: text.copyWith(
      headlineMedium: text.headlineMedium?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.6, color: p.brand),
      headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.4),
      titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.2),
      titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      titleSmall: text.titleSmall?.copyWith(fontWeight: FontWeight.w600),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: p.background,
      foregroundColor: p.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, fontSize: 19),
    ),
    cardTheme: CardThemeData(
      color: p.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: p.line)),
    ),
    dividerTheme: DividerThemeData(color: p.line, space: 1, thickness: 1),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: p.surface,
      indicatorColor: p.accentSoft,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      height: 68,
      labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? p.ink : p.muted,
          )),
      iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(color: states.contains(WidgetState.selected) ? p.accent : p.muted)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.surface,
      hintStyle: TextStyle(color: p.muted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: p.line)),
      enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: p.line)),
      focusedBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: p.accent, width: 1.6)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 48),
        shape: RoundedRectangleBorder(borderRadius: radius),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 46),
        foregroundColor: p.ink,
        side: BorderSide(color: p.line),
        shape: RoundedRectangleBorder(borderRadius: radius),
      ),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: p.accent)),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        selectedBackgroundColor: p.accentSoft,
        selectedForegroundColor: p.accent,
        side: BorderSide(color: p.line),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      side: BorderSide(color: p.line),
      backgroundColor: p.surface,
      selectedColor: p.accentSoft,
      labelStyle: TextStyle(color: p.ink, fontWeight: FontWeight.w500, fontSize: 13),
      secondaryLabelStyle: TextStyle(color: p.accent, fontWeight: FontWeight.w600, fontSize: 13),
      checkmarkColor: p.accent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(99)),
      padding: const EdgeInsets.symmetric(horizontal: 4),
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: p.ink,
      unselectedLabelColor: p.muted,
      indicatorColor: p.accent,
      dividerColor: p.line,
      labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
      unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: p.surface,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    ),
    dialogTheme: DialogThemeData(backgroundColor: p.surface, surfaceTintColor: Colors.transparent),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: p.accent, linearTrackColor: p.surface2),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: radius),
    ),
  );
}
