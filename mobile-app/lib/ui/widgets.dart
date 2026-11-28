import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../core/api.dart';
import 'theme.dart';

enum Tone { neutral, accent, success, warning, danger, info }

/// The canvas illustrations (drawn for the redesign; rendered from its SVGs).
abstract final class Art {
  static const assign = 'assets/illustrations/assign.png';
  static const notebook = 'assets/illustrations/notebook.png';
  static const school = 'assets/illustrations/school.png';
  static const ops = 'assets/illustrations/ops.png';
  static const community = 'assets/illustrations/community.png';
  static const empty = 'assets/illustrations/empty.png';
  static const web = 'assets/illustrations/web.png';
  static const success = 'assets/illustrations/success.png';
  static const classes = 'assets/illustrations/classes.png';
  static const billing = 'assets/illustrations/billing.png';
  static const users = 'assets/illustrations/users.png';
  static const complaint = 'assets/illustrations/complaint.png';
  static const library = 'assets/illustrations/library.png';
  static const validate = 'assets/illustrations/validate.png';
  static const orbit = 'assets/illustrations/orbit.png';
  static const projectile = 'assets/illustrations/sim_projectile.png';
  static const pendulum = 'assets/illustrations/sim_pendulum.png';
  static const spring = 'assets/illustrations/sim_spring.png';
  static const circuit = 'assets/illustrations/sim_circuit.png';

  /// The canvas picture for a simulation, from its topic code or its title.
  static String forSimulation(String? topic, String title) {
    final text = '${topic ?? ''} $title'.toLowerCase();
    bool has(List<String> words) => words.any(text.contains);
    if (has([
      'electr',
      'circuit',
      'current',
      'magnet',
      'điện',
      'mạch',
      'ohm',
      'từ trường',
    ]))
      return circuit;
    if (has(['oscill', 'pendul', 'wave', 'con lắc', 'dao động', 'sóng']))
      return pendulum;
    if (has([
      'spring',
      'elastic',
      'lò xo',
      'đàn hồi',
      'dynamic',
      'force',
      'lực',
    ]))
      return spring;
    if (has([
      'kinemat',
      'project',
      'motion',
      'ném',
      'rơi',
      'chuyển động',
      'free fall',
      'vận tốc',
      'gia tốc',
      'phanh',
      'quãng đường',
    ])) {
      return projectile;
    }
    return orbit;
  }
}

/// A canvas illustration. In the dark theme its lightness is flipped while its hues stay, so the navy strokes
/// read as light lines and the teal stays teal.
class ArtImage extends StatelessWidget {
  const ArtImage(
    this.path, {
    super.key,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
  });
  final String path;
  final double? width, height;
  final BoxFit fit;

  // invert, then turn the hue half way round: lightness flips, colours keep their hue
  static const _darkMatrix = <double>[
    0.574,
    -1.43,
    -0.144,
    0,
    255,
    -0.426,
    -0.43,
    -0.144,
    0,
    255,
    -0.426,
    -1.43,
    0.856,
    0,
    255,
    0,
    0,
    0,
    1,
    0,
  ];

  @override
  Widget build(BuildContext context) {
    final image = Image.asset(path, width: width, height: height, fit: fit);
    return Theme.of(context).brightness == Brightness.dark
        ? ColorFiltered(
            colorFilter: const ColorFilter.matrix(_darkMatrix),
            child: image,
          )
        : image;
  }
}

/// Tone → the foreground and soft background of its family.
({Color fg, Color bg}) toneColors(BuildContext context, Tone tone) {
  final p = context.palette;
  return switch (tone) {
    Tone.neutral => (fg: p.muted, bg: p.surface2),
    Tone.accent => (fg: p.accent, bg: p.accentSoft),
    Tone.success => (fg: p.success, bg: p.successSoft),
    Tone.warning => (fg: p.warning, bg: p.warningSoft),
    Tone.danger => (fg: p.danger, bg: p.dangerSoft),
    Tone.info => (fg: p.info, bg: p.infoSoft),
  };
}

/// A small status label (Đã nộp, Quá hạn …) in one of the status families, with a dot as on the canvas.
class Pill extends StatelessWidget {
  const Pill(this.label, {super.key, this.tone = Tone.neutral, this.icon});
  final String label;
  final Tone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = toneColors(context, tone);
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 4, 10, 4),
      decoration: BoxDecoration(
        color: c.bg,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: c.fg.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null)
            Icon(icon, size: 13, color: c.fg)
          else
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: c.fg, shape: BoxShape.circle),
            ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: c.fg,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

/// The canvas header for a tab's first screen: a large title, a line under it and the illustration on the right.
class HeroBar extends StatelessWidget implements PreferredSizeWidget {
  const HeroBar({
    super.key,
    required this.title,
    this.subtitle,
    this.art = Art.orbit,
    this.actions = const [],
  });
  final String title;
  final String? subtitle;
  final String art;
  final List<Widget> actions;

  @override
  Size get preferredSize => const Size.fromHeight(112);

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final canPop = Navigator.of(context).canPop();
    return Material(
      color: p.surface,
      child: SafeArea(
        bottom: false,
        child: Container(
          height: 112,
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: p.line)),
          ),
          child: Stack(
            children: [
              Positioned(
                right: 4,
                top: 6,
                bottom: 6,
                child: ArtImage(art, width: 136),
              ),
              if (canPop)
                Positioned(
                  left: 4,
                  top: 2,
                  child: IconButton(
                    tooltip: 'Quay lại',
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: Icon(Icons.arrow_back_rounded, color: p.ink),
                  ),
                ),
              Positioned(
                left: 20,
                right: 128,
                bottom: 14,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: p.muted,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(
                        context,
                      ).textTheme.headlineMedium?.copyWith(fontSize: 26),
                    ),
                  ],
                ),
              ),
              if (actions.isNotEmpty)
                Positioned(
                  top: 4,
                  right: 4,
                  child: Row(mainAxisSize: MainAxisSize.min, children: actions),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A search box that reports what is typed after a short pause.
class SearchBox extends StatefulWidget {
  const SearchBox({
    super.key,
    required this.hint,
    required this.onChanged,
    this.initial = '',
  });
  final String hint;
  final ValueChanged<String> onChanged;
  final String initial;

  @override
  State<SearchBox> createState() => _SearchBoxState();
}

class _SearchBoxState extends State<SearchBox> with WidgetsBindingObserver {
  late final _controller = TextEditingController(text: widget.initial);
  final _focus = FocusNode();
  double _inset = 0;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  /// Closing the keyboard ends the search's focus, so a sheet or page closing later does not bring the keyboard back.
  @override
  void didChangeMetrics() {
    final inset =
        WidgetsBinding
            .instance
            .platformDispatcher
            .views
            .firstOrNull
            ?.viewInsets
            .bottom ??
        0;
    // only on the way down: the keyboard was open and now it is gone
    if (_inset > 0 && inset == 0 && _focus.hasFocus) _focus.unfocus();
    _inset = inset;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _debounce?.cancel();
    _focus.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _changed(String value) {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(
      const Duration(milliseconds: 280),
      () => widget.onChanged(value.trim()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return TextField(
      controller: _controller,
      focusNode: _focus,
      onChanged: _changed,
      textInputAction: TextInputAction.search,
      onTapOutside: (_) => FocusScope.of(context).unfocus(),
      decoration: InputDecoration(
        hintText: widget.hint,
        isDense: true,
        fillColor: p.surface,
        prefixIcon: Icon(Icons.search_rounded, color: p.muted),
        suffixIcon: _controller.text.isEmpty
            ? null
            : IconButton(
                tooltip: 'Xoá',
                icon: const Icon(Icons.close_rounded, size: 20),
                onPressed: () {
                  _controller.clear();
                  _changed('');
                },
              ),
      ),
    );
  }
}

/// One choice out of a few, as a row of chips that scrolls sideways; each may carry a count.
class ChoiceRow<T> extends StatelessWidget {
  const ChoiceRow({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
  });
  final List<(T value, String label, int? count)> options;
  final T selected;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Align(
      alignment: Alignment.centerLeft,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final (value, label, count) in options) ...[
              ChoiceChip(
                showCheckmark: false,
                selected: value == selected,
                onSelected: (_) => onSelected(value),
                side: BorderSide(
                  color: value == selected
                      ? p.accent.withValues(alpha: 0.4)
                      : p.line,
                ),
                label: Text(count == null ? label : '$label  $count'),
                labelStyle: TextStyle(
                  color: value == selected ? p.accent : p.ink,
                  fontWeight: value == selected
                      ? FontWeight.w700
                      : FontWeight.w500,
                  fontSize: 13,
                ),
              ),
              const SizedBox(width: 8),
            ],
          ],
        ),
      ),
    );
  }
}

/// A number with its label on a bright tint, for the top of an overview.
class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.tint,
    this.detail,
    this.onTap,
  });
  final String label, value;
  final String? detail;
  final IconData icon;
  final Tint tint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Material(
      color: tint.bg,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: p.surface.withValues(alpha: 0.75),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 18, color: tint.fg),
                  ),
                  const Spacer(),
                  if (onTap != null)
                    Icon(Icons.arrow_forward_rounded, size: 18, color: tint.fg),
                ],
              ),
              const SizedBox(height: 12),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  value,
                  style: TextStyle(
                    color: p.ink,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  color: tint.fg,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (detail != null) ...[
                const SizedBox(height: 2),
                Text(
                  detail!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: p.muted, fontSize: 12),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Two widgets side by side with a gap, for pairs of stat tiles.
class Pair extends StatelessWidget {
  const Pair(this.left, this.right, {super.key});
  final Widget left, right;

  @override
  Widget build(BuildContext context) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(child: left),
        const SizedBox(width: 12),
        Expanded(child: right),
      ],
    ),
  );
}

/// A person's initials (or photo) on a colour picked from their role or name.
class Avatar extends StatelessWidget {
  const Avatar({
    super.key,
    required this.name,
    this.url,
    this.size = 40,
    this.tint,
  });
  final String name;
  final String? url;
  final double size;
  final Tint? tint;

  static String initialsOf(String name) {
    final all = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .toList();
    // words that start with a letter: "Học sinh Test 10A1 04" → S T, not 1 0
    final words = all
        .where((w) => RegExp(r'^\p{L}', unicode: true).hasMatch(w))
        .toList();
    if (words.isEmpty) return all.isEmpty ? '?' : all.last.characters.first;
    return (words.length == 1
            ? words.first.characters.first
            : words[words.length - 2].characters.first +
                  words.last.characters.first)
        .toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final t = tint ?? p.tints[name.hashCode.abs() % p.tints.length];
    final initials = Text(
      initialsOf(name),
      style: TextStyle(
        color: t.fg,
        fontWeight: FontWeight.w700,
        fontSize: size * 0.36,
        height: 1,
      ),
    );
    Widget child = initials;
    final src = url?.trim();
    if (src != null && src.isNotEmpty) {
      if (src.startsWith('data:image/')) {
        final comma = src.indexOf(',');
        if (comma > 0) {
          try {
            final Uint8List bytes = base64Decode(src.substring(comma + 1));
            child = Image.memory(
              bytes,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => initials,
            );
          } catch (_) {
            child = initials;
          }
        }
      } else {
        child = Image.network(
          src,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => initials,
        );
      }
    }
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: t.bg, shape: BoxShape.circle),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: child,
    );
  }
}

/// The colour of a role, the same everywhere a role is shown.
Tint roleTint(BuildContext context, String role) {
  final p = context.palette;
  return switch (role) {
    'STUDENT' => p.blue,
    'STAFF' => p.teal,
    'SCHOOL' => p.amber,
    'MANAGER' => p.violet,
    'REVIEWER' => p.green,
    'ADMIN' => p.rose,
    _ => p.teal,
  };
}

String roleName(String role) => switch (role) {
  'STUDENT' => 'Học sinh',
  'STAFF' => 'Giáo viên',
  'SCHOOL' => 'Quản lý trường',
  'MANAGER' => 'Vận hành',
  'REVIEWER' => 'Kiểm duyệt',
  'ADMIN' => 'Quản trị hệ thống',
  _ => role,
};

/// A titled block of a detail screen.
class Section extends StatelessWidget {
  const Section({
    super.key,
    required this.title,
    required this.child,
    this.trailing,
    this.icon,
  });
  final String title;
  final Widget child;
  final Widget? trailing;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                if (icon != null) ...[
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: p.accentSoft,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, size: 16, color: p.accent),
                  ),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                ?trailing,
              ],
            ),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}

/// A label and a value on one line, inside a section.
class InfoRow extends StatelessWidget {
  const InfoRow({
    super.key,
    required this.label,
    required this.value,
    this.strong = true,
  });
  final String label, value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 116,
            child: Text(label, style: TextStyle(color: p.muted)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontWeight: strong ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A tappable card with a leading picture, a title, a line under it and anything on the right.
class ListCard extends StatelessWidget {
  const ListCard({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.footer,
    this.onTap,
  });
  final String title;
  final String? subtitle;
  final Widget? leading, trailing, footer;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (leading != null) ...[leading!, const SizedBox(width: 12)],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontSize: 15, height: 1.3),
                        ),
                        if (subtitle != null && subtitle!.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            subtitle!,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: p.muted,
                              fontSize: 13,
                              height: 1.3,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (trailing != null) ...[
                    const SizedBox(width: 8),
                    trailing!,
                  ],
                ],
              ),
              if (footer != null) ...[const SizedBox(height: 10), footer!],
            ],
          ),
        ),
      ),
    );
  }
}

/// A small icon and text, for the meta line at the bottom of a card.
class MetaLine extends StatelessWidget {
  const MetaLine({
    super.key,
    required this.icon,
    required this.text,
    this.color,
    this.trailing,
  });
  final IconData icon;
  final String text;
  final Color? color;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.palette.muted;
    return Row(
      children: [
        Icon(icon, size: 15, color: c),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: c, fontSize: 13),
          ),
        ),
        ?trailing,
      ],
    );
  }
}

/// Shown where a list is empty or a screen has nothing yet: a canvas illustration, a title and a line.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    this.icon,
    required this.title,
    this.message,
    this.action,
    this.art,
  });
  final IconData? icon;
  final String title;
  final String? message;
  final Widget? action;
  final String? art;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (art != null || icon == null)
              ArtImage(art ?? Art.empty, width: 180)
            else
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: p.accentSoft,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: p.accent, size: 30),
              ),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (message != null) ...[
              const SizedBox(height: 6),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: TextStyle(color: p.muted, height: 1.4),
              ),
            ],
            if (action != null) ...[const SizedBox(height: 16), action!],
          ],
        ),
      ),
    );
  }
}

/// A grey placeholder that breathes while the real content loads.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.width, this.height = 14, this.radius = 8});
  final double? width;
  final double height, radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton>
    with SingleTickerProviderStateMixin {
  late final _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return FadeTransition(
      opacity: Tween(
        begin: 0.45,
        end: 1.0,
      ).animate(CurvedAnimation(parent: _pulse, curve: Curves.easeInOut)),
      child: Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: p.line,
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      ),
    );
  }
}

/// The shape of a list of cards, while it loads.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 5, this.withStats = false});
  final int count;
  final bool withStats;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    Widget card() => Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: p.line),
      ),
      child: const Row(
        children: [
          Skeleton(width: 44, height: 44, radius: 12),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Skeleton(width: 190, height: 14),
                SizedBox(height: 8),
                Skeleton(width: 120, height: 11),
                SizedBox(height: 12),
                Skeleton(height: 10),
              ],
            ),
          ),
        ],
      ),
    );
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        if (withStats) ...[
          const Pair(
            Skeleton(height: 112, radius: 18),
            Skeleton(height: 112, radius: 18),
          ),
          const SizedBox(height: 12),
        ],
        for (var i = 0; i < count; i++) ...[card(), const SizedBox(height: 10)],
      ],
    );
  }
}

/// Loads data once, shows a skeleton, then the content or a retryable error.
/// Pulling down reloads; [reloadKey] changes force a reload from the parent.
class Loader<T> extends StatefulWidget {
  const Loader({
    super.key,
    required this.load,
    required this.builder,
    this.reloadKey,
    this.skeleton,
  });
  final Future<T> Function() load;
  final Widget Function(
    BuildContext context,
    T data,
    Future<void> Function() reload,
  )
  builder;
  final Object? reloadKey;
  final Widget? skeleton;

  @override
  State<Loader<T>> createState() => _LoaderState<T>();
}

class _LoaderState<T> extends State<Loader<T>> {
  T? _data;
  String? _error;
  bool _loading = true;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void didUpdateWidget(covariant Loader<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reloadKey != widget.reloadKey) _reload();
  }

  Future<void> _reload() async {
    final request = ++_request;
    setState(() {
      _loading = _data == null;
      _error = null;
    });
    try {
      final data = await widget.load();
      if (!mounted || request != _request) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || request != _request) return;
      setState(() {
        _error = error is ApiException
            ? error.message
            : 'Không tải được dữ liệu.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final Widget child;
    if (_loading) {
      child = KeyedSubtree(
        key: const ValueKey('loading'),
        child: widget.skeleton ?? const SkeletonList(),
      );
    } else if (_data == null) {
      child = EmptyState(
        key: const ValueKey('error'),
        art: Art.web,
        title: 'Chưa tải được',
        message: _error,
        action: FilledButton.tonal(
          onPressed: _reload,
          child: const Text('Thử lại'),
        ),
      );
    } else {
      child = Column(
        key: const ValueKey('data'),
        children: [
          if (_error != null)
            MaterialBanner(
              content: Text(_error!),
              actions: [
                TextButton(onPressed: _reload, child: const Text('Thử lại')),
              ],
            ),
          Expanded(child: widget.builder(context, _data as T, _reload)),
        ],
      );
    }
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 220),
      child: child,
    );
  }
}

/// A heading between groups of a list.
class GroupLabel extends StatelessWidget {
  const GroupLabel(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(2, 8, 2, 8),
    child: Row(
      children: [
        Expanded(
          child: Text(
            text.toUpperCase(),
            style: TextStyle(
              color: context.palette.muted,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
            ),
          ),
        ),
        ?trailing,
      ],
    ),
  );
}

/// Asks before something that cannot be taken back; true when confirmed.
Future<bool> confirm(
  BuildContext context, {
  required String title,
  required String message,
  required String action,
  bool danger = false,
}) async {
  final p = context.palette;
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Huỷ'),
        ),
        FilledButton(
          style: danger
              ? FilledButton.styleFrom(
                  backgroundColor: p.danger,
                  foregroundColor: Colors.white,
                )
              : null,
          onPressed: () => Navigator.pop(context, true),
          child: Text(action),
        ),
      ],
    ),
  );
  return ok == true;
}

void showMessage(BuildContext context, String message, {bool error = false}) {
  final p = context.palette;
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              error ? Icons.error_outline_rounded : Icons.check_circle_rounded,
              color: Colors.white,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: error
            ? p.danger
            : (Theme.of(context).brightness == Brightness.light
                  ? p.brand
                  : null),
      ),
    );
}

String errorText(Object error) =>
    error is ApiException ? error.message : 'Có lỗi xảy ra. Hãy thử lại.';

/// "1.234" with Vietnamese grouping.
String groupDigits(num value) => value
    .round()
    .abs()
    .toString()
    .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => '.');

/// 5 050 000 000 → "5,05 tỷ ₫"; 36 000 000 → "36 tr ₫".
String compactVnd(num? value) {
  if (value == null) return '—';
  final v = value.abs();
  String trim(double x) {
    var t = x.toStringAsFixed(x >= 100 ? 0 : (x >= 10 ? 1 : 2));
    if (t.contains('.'))
      t = t.replaceAll(RegExp(r'0+$'), '').replaceAll(RegExp(r'\.$'), '');
    return t.replaceAll('.', ',');
  }

  if (v >= 1e9) return '${trim(v / 1e9)} tỷ ₫';
  if (v >= 1e6) return '${trim(v / 1e6)} tr ₫';
  return '${groupDigits(v)} ₫';
}
