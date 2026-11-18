import 'package:flutter/material.dart';

/// The web's design tokens (styles/tokens.css): cool neutrals, one blue accent
/// and three status families, in a light and a dark set.
class Palette extends ThemeExtension<Palette> {
  const Palette({
    required this.ink, required this.muted, required this.line, required this.surface, required this.surface2,
    required this.background, required this.accent, required this.accentSoft, required this.success,
    required this.successSoft, required this.warning, required this.warningSoft, required this.danger,
    required this.dangerSoft,
  });

  final Color ink, muted, line, surface, surface2, background, accent, accentSoft;
  final Color success, successSoft, warning, warningSoft, danger, dangerSoft;

  static const light = Palette(
    ink: Color(0xFF172033), muted: Color(0xFF626D7E), line: Color(0xFFE4E8EE), surface: Color(0xFFFFFFFF),
    surface2: Color(0xFFF8FAFC), background: Color(0xFFF5F7FA), accent: Color(0xFF2563EB),
    accentSoft: Color(0xFFEEF4FF), success: Color(0xFF067A57), successSoft: Color(0xFFE8F6F0),
    warning: Color(0xFFB25E09), warningSoft: Color(0xFFFFF5E6), danger: Color(0xFFC4320A),
    dangerSoft: Color(0xFFFEF0EC),
  );

  static const dark = Palette(
    ink: Color(0xFFE6EBF3), muted: Color(0xFF98A4B8), line: Color(0xFF263247), surface: Color(0xFF111A2B),
    surface2: Color(0xFF162036), background: Color(0xFF0B1220), accent: Color(0xFF6EA0FF),
    accentSoft: Color(0xFF16264A), success: Color(0xFF4ADE9F), successSoft: Color(0xFF0F2B22),
    warning: Color(0xFFF6B356), warningSoft: Color(0xFF2E2210), danger: Color(0xFFFF8A6B),
    dangerSoft: Color(0xFF341A14),
  );

  @override
  Palette copyWith() => this;

  @override
  Palette lerp(ThemeExtension<Palette>? other, double t) => t < 0.5 ? this : (other as Palette? ?? this);
}

extension PaletteOf on BuildContext {
  Palette get palette => Theme.of(this).extension<Palette>()!;
}

ThemeData buildTheme(Brightness brightness) {
  final p = brightness == Brightness.light ? Palette.light : Palette.dark;
  final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB), brightness: brightness).copyWith(
    primary: p.accent,
    onPrimary: brightness == Brightness.light ? Colors.white : const Color(0xFF0B1220),
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
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: brightness);
  final text = base.textTheme.apply(bodyColor: p.ink, displayColor: p.ink);
  return base.copyWith(
    scaffoldBackgroundColor: p.background,
    extensions: [p],
    textTheme: text.copyWith(
      titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.2),
      titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      titleSmall: text.titleSmall?.copyWith(fontWeight: FontWeight.w600),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: p.background,
      foregroundColor: p.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, fontSize: 20),
    ),
    cardTheme: CardThemeData(
      color: p.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: p.line)),
    ),
    dividerTheme: DividerThemeData(color: p.line, space: 1, thickness: 1),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: p.surface,
      indicatorColor: p.accentSoft,
      surfaceTintColor: Colors.transparent,
      height: 66,
      labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? p.accent : p.muted,
          )),
      iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(color: states.contains(WidgetState.selected) ? p.accent : p.muted)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: p.line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: p.line)),
      focusedBorder:
          OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: p.accent, width: 1.6)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 44),
        side: BorderSide(color: p.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        selectedBackgroundColor: p.accentSoft,
        selectedForegroundColor: p.accent,
        side: BorderSide(color: p.line),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(side: BorderSide(color: p.line), backgroundColor: p.surface),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
