import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../auth/login_screen.dart';
import '../auth/server_screen.dart';
import '../library/simulation_screen.dart';

/// Public 3-tab shell shown before sign-in: Khám phá, Cộng đồng, Đăng nhập.
class PublicShell extends StatefulWidget {
  const PublicShell({super.key, this.initialTab = 0});
  final int initialTab;

  @override
  State<PublicShell> createState() => _PublicShellState();
}

class _PublicShellState extends State<PublicShell> {
  late int _tab = widget.initialTab;

  void _go(int index) => setState(() => _tab = index);

  @override
  Widget build(BuildContext context) {
    final pages = [
      PublicLandingScreen(
        onExploreCommunity: () => _go(1),
        onOpenLogin: () => _go(2),
      ),
      const PublicCommunityScreen(),
      LoginScreen(
        embedded: true,
        onBackToLanding: () => _go(0),
        onOpenPlans: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const PublicPlansScreen()),
        ),
      ),
    ];

    return Scaffold(
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: _go,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view_rounded),
            label: 'Khám phá',
          ),
          NavigationDestination(
            icon: Icon(Icons.science_outlined),
            selectedIcon: Icon(Icons.science_rounded),
            label: 'Cộng đồng',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Đăng nhập',
          ),
        ],
      ),
    );
  }
}

/// Shared public top bar matching PhysLive Mobile Canvas `.topbar`.
class PublicTopBar extends StatelessWidget implements PreferredSizeWidget {
  const PublicTopBar({super.key, this.onBack});
  final VoidCallback? onBack;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final session = SessionScope.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: p.surface,
      child: SafeArea(
        bottom: false,
        child: Container(
          height: 64,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: p.line)),
          ),
          child: Row(
            children: [
              if (onBack != null) ...[
                IconButton(
                  tooltip: 'Quay lại',
                  onPressed: onBack,
                  icon: const Icon(Icons.chevron_left_rounded, size: 26),
                ),
                const SizedBox(width: 2),
              ],
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: p.line),
                ),
                clipBehavior: Clip.antiAlias,
                child: Image.asset('assets/brand/logo.png', fit: BoxFit.cover),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PhysLive',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.4,
                        height: 1.15,
                      ),
                    ),
                    Text(
                      'Khám phá PhysLive',
                      style: TextStyle(color: p.muted, fontSize: 11, height: 1.2),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: isDark ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối',
                onPressed: () => appTheme.set(isDark ? ThemeMode.light : ThemeMode.dark),
                icon: Icon(
                  isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                  color: p.muted,
                  size: 21,
                ),
              ),
              IconButton(
                tooltip: 'Máy chủ API (${session.config.apiUrl.host})',
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ServerScreen(current: session.config.apiUrl),
                  ),
                ),
                icon: Icon(Icons.dns_outlined, color: p.muted, size: 21),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Heading block matching `.heading` in PhysLive Mobile Canvas.
class _CanvasHeading extends StatelessWidget {
  const _CanvasHeading({
    required this.title,
    required this.subtitle,
    this.art,
  });
  final String title;
  final String subtitle;
  final String? art;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontSize: 25,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.7,
                  height: 1.22,
                  color: p.brand,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                subtitle,
                style: TextStyle(color: p.muted, fontSize: 13, height: 1.5),
              ),
            ],
          ),
        ),
        if (art != null) ...[
          const SizedBox(width: 10),
          ArtImage(art!, width: 90, height: 78),
        ],
      ],
    );
  }
}

/// MLanding — Giới thiệu PhysLive.
class PublicLandingScreen extends StatelessWidget {
  const PublicLandingScreen({
    super.key,
    required this.onExploreCommunity,
    required this.onOpenLogin,
  });
  final VoidCallback onExploreCommunity;
  final VoidCallback onOpenLogin;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const PublicTopBar(),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 22, 18, 32),
        children: [
          const _CanvasHeading(
            title: 'Vật lý, thử nghiệm được.',
            subtitle: 'Từ đề bài đến mô phỏng tương tác.',
            art: Art.orbit,
          ),
          const SizedBox(height: 18),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'HỌC QUA KHÁM PHÁ',
                    style: TextStyle(
                      color: p.accent,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.4,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    'Nhìn thấy điều bạn đang học',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    'Dự đoán, quan sát và giải thích các hiện tượng vật lý ngay trên điện thoại.',
                    style: TextStyle(color: p.muted, fontSize: 12.5, height: 1.55),
                  ),
                  const SizedBox(height: 12),
                  Center(child: ArtImage(Art.pendulum, height: 146)),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      FilledButton.icon(
                        onPressed: onExploreCommunity,
                        icon: const Icon(Icons.play_arrow_rounded, size: 20),
                        label: const Text('Thử mô phỏng'),
                      ),
                      OutlinedButton(
                        onPressed: onOpenLogin,
                        child: const Text('Đăng nhập'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Dành cho nhà trường',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 14),
                  _FeatureRow(
                    icon: Icons.groups_outlined,
                    title: 'Quản lý lớp và tài khoản',
                    subtitle: 'Một nơi để theo dõi việc học bằng mô phỏng',
                  ),
                  Divider(height: 24, color: p.line),
                  _FeatureRow(
                    icon: Icons.verified_user_outlined,
                    title: 'Giấy phép theo quy mô',
                    subtitle: 'Hạn mức học sinh và AI minh bạch',
                  ),
                  const SizedBox(height: 16),
                  FilledButton.tonalIcon(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const PublicPlansScreen()),
                    ),
                    icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                    label: const Text('Xem gói dịch vụ'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });
  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: p.blue.bg,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: p.blue.fg, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontSize: 14),
              ),
              const SizedBox(height: 2),
              Text(subtitle, style: TextStyle(color: p.muted, fontSize: 12)),
            ],
          ),
        ),
      ],
    );
  }
}

/// MPublicCommunity — Kho cộng đồng công khai (không cần đăng nhập).
class PublicCommunityScreen extends StatefulWidget {
  const PublicCommunityScreen({super.key});

  @override
  State<PublicCommunityScreen> createState() => _PublicCommunityScreenState();
}

class _PublicCommunityScreenState extends State<PublicCommunityScreen> {
  String _query = '';
  bool _featuredOnly = false;
  String? _topic;

  Future<List<LibraryItem>> _load() async => asJsonList(
    await SessionScope.api(context).get('/library/community'),
  ).map(LibraryItem.new).toList();

  void _openFilters(List<String> topics) {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Bộ lọc cộng đồng', style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Chỉ xem mô phỏng nổi bật'),
                value: _featuredOnly,
                onChanged: (v) {
                  setSheet(() => _featuredOnly = v);
                  setState(() => _featuredOnly = v);
                },
              ),
              if (topics.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text('Chủ đề', style: Theme.of(ctx).textTheme.titleSmall),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ChoiceChip(
                      label: const Text('Tất cả'),
                      selected: _topic == null,
                      onSelected: (_) {
                        setSheet(() => _topic = null);
                        setState(() => _topic = null);
                      },
                    ),
                    for (final t in topics)
                      ChoiceChip(
                        label: Text(t),
                        selected: _topic == t,
                        onSelected: (_) {
                          setSheet(() => _topic = t);
                          setState(() => _topic = t);
                        },
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Áp dụng'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: const PublicTopBar(),
      body: Loader<List<LibraryItem>>(
        load: _load,
        builder: (context, items, reload) {
          final topics = <String>{
            for (final i in items)
              if (i.topic != null && i.topic!.trim().isNotEmpty) i.topic!.trim(),
          }.toList()
            ..sort();

          final shown = items.where((item) {
            if (_featuredOnly && item.json['featured'] != true && item.json['status'] != 'FEATURED') {
              return false;
            }
            if (_topic != null && item.topic != _topic) return false;
            if (_query.isEmpty) return true;
            return '${item.title} ${item.topic ?? ''} ${item.sharedByName ?? ''} ${item.schoolName ?? ''}'
                .toLowerCase()
                .contains(_query);
          }).toList();

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 32),
              children: [
                const _CanvasHeading(
                  title: 'Kho cộng đồng',
                  subtitle: 'Khám phá những ý tưởng vật lý.',
                  art: Art.community,
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: SearchBox(
                        hint: 'Tìm mô phỏng...',
                        onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Material(
                      color: (_featuredOnly || _topic != null) ? p.accentSoft : p.surface,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(
                          color: (_featuredOnly || _topic != null) ? p.accent : p.line,
                        ),
                      ),
                      child: IconButton(
                        tooltip: 'Bộ lọc',
                        onPressed: () => _openFilters(topics),
                        icon: Icon(
                          Icons.tune_rounded,
                          color: (_featuredOnly || _topic != null) ? p.accent : p.ink,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (shown.isEmpty)
                  EmptyState(
                    art: Art.community,
                    title: _query.isEmpty ? 'Chưa có mô phỏng công khai' : 'Không tìm thấy mô phỏng phù hợp',
                    message: _query.isEmpty
                        ? 'Các mô phỏng giáo viên chia sẻ ra cộng đồng sẽ xuất hiện tại đây.'
                        : 'Thử từ khóa khác hoặc xóa bộ lọc.',
                  )
                else
                  for (final item in shown) ...[
                    _PublicSimCard(item: item),
                    const SizedBox(height: 14),
                  ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _PublicSimCard extends StatelessWidget {
  const _PublicSimCard({required this.item});
  final LibraryItem item;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final isFeatured = item.json['featured'] == true || item.json['status'] == 'FEATURED';
    final by = item.sharedByName ?? item.schoolName ?? 'Cộng đồng PhysLive';

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => SimulationScreen(item: item)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 152,
              color: p.surface2,
              padding: const EdgeInsets.all(14),
              child: Center(
                child: ArtImage(Art.forSimulation(item.topic, item.title), height: 124),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 15),
                        ),
                      ),
                      if (isFeatured) ...[
                        const SizedBox(width: 8),
                        const Pill('Nổi bật', tone: Tone.success),
                      ],
                    ],
                  ),
                  if (item.topic != null && item.topic!.trim().isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      item.topic!,
                      style: TextStyle(color: p.muted, fontSize: 12),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          by,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: p.muted, fontSize: 12),
                        ),
                      ),
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 36),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        ),
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => SimulationScreen(item: item)),
                        ),
                        icon: const Icon(Icons.play_arrow_rounded, size: 18),
                        label: const Text('Khám phá', style: TextStyle(fontSize: 12.5)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PublicPlan {
  _PublicPlan(this.raw);
  final Map<String, dynamic> raw;
  String get code => asString(raw['code']) ?? '';
  String get name => asString(raw['name']) ?? code;
  String get description => asString(raw['description']) ?? '';
  int get annualPriceVnd => asInt(raw['annualPriceVnd']) ?? 0;
  int get studentQuota => asInt(raw['studentQuota']) ?? 0;
  int? get monthlyTokenQuota => asInt(raw['monthlyTokenQuota']);
}

/// MPublicPlans — Chọn gói dịch vụ cho nhà trường (GET /api/auth/plans).
class PublicPlansScreen extends StatefulWidget {
  const PublicPlansScreen({super.key});

  @override
  State<PublicPlansScreen> createState() => _PublicPlansScreenState();
}

class _PublicPlansScreenState extends State<PublicPlansScreen> {
  String? _selectedCode;

  Future<List<_PublicPlan>> _load() async {
    final rows = asJsonList(await SessionScope.api(context).get('/auth/plans'));
    return rows.map(_PublicPlan.new).toList();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: PublicTopBar(onBack: () => Navigator.of(context).pop()),
      body: Loader<List<_PublicPlan>>(
        load: _load,
        builder: (context, plans, reload) {
          final activeCode = _selectedCode ??
              (plans.length > 1 ? plans[1].code : (plans.isNotEmpty ? plans.first.code : null));
          final selected = plans.where((item) => item.code == activeCode).firstOrNull;

          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 22, 18, 32),
              children: [
                const _CanvasHeading(
                  title: 'Chọn gói cho trường',
                  subtitle: 'Giấy phép theo năm, hạn mức AI theo tháng.',
                  art: Art.billing,
                ),
                const SizedBox(height: 18),
                if (plans.isEmpty)
                  const EmptyState(
                    art: Art.billing,
                    title: 'Chưa có gói dịch vụ khả dụng',
                    message: 'Vui lòng thử lại sau hoặc liên hệ PhysLive.',
                  )
                else ...[
                  for (final plan in plans) ...[
                    _PlanOptionCard(
                      plan: plan,
                      selected: plan.code == activeCode,
                      onTap: () => setState(() => _selectedCode = plan.code),
                    ),
                    const SizedBox(height: 12),
                  ],
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: selected == null
                        ? null
                        : () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => SchoolSignupScreen(plan: selected),
                              ),
                            ),
                    icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                    label: const Text('Đăng ký cho trường'),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Giáo viên và học sinh nhận tài khoản trực tiếp từ quản lý trường.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: p.muted, fontSize: 12),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _PlanOptionCard extends StatelessWidget {
  const _PlanOptionCard({
    required this.plan,
    required this.selected,
    required this.onTap,
  });
  final _PublicPlan plan;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final tokenText = plan.monthlyTokenQuota == null
        ? 'Không giới hạn token'
        : '${formatInt(plan.monthlyTokenQuota!)} token/tháng';
    return Material(
      color: selected ? p.accentSoft.withValues(alpha: 0.65) : p.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: selected ? p.accent : p.line,
          width: selected ? 2 : 1,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    selected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                    color: selected ? p.accent : p.muted,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      plan.name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                  if (selected) const Pill('Đang chọn', tone: Tone.accent),
                ],
              ),
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.only(left: 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${formatInt(plan.studentQuota)} học sinh · $tokenText',
                      style: TextStyle(color: p.muted, fontSize: 12.5),
                    ),
                    if (plan.description.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        plan.description,
                        style: TextStyle(color: p.muted, fontSize: 12),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: formatInt(plan.annualPriceVnd),
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.5,
                              color: p.ink,
                            ),
                          ),
                          TextSpan(
                            text: ' đ / năm',
                            style: TextStyle(color: p.muted, fontSize: 12.5),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// MSignup — Đăng ký trường mới (POST /api/auth/school-checkout).
class SchoolSignupScreen extends StatefulWidget {
  const SchoolSignupScreen({super.key, required this.plan});
  final _PublicPlan plan;

  @override
  State<SchoolSignupScreen> createState() => _SchoolSignupScreenState();
}

class _SchoolSignupScreenState extends State<SchoolSignupScreen> {
  final _form = GlobalKey<FormState>();
  final _schoolName = TextEditingController();
  final _schoolCode = TextEditingController();
  final _address = TextEditingController();
  final _fullName = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _accepted = false;
  bool _hidden = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _schoolName.dispose();
    _schoolCode.dispose();
    _address.dispose();
    _fullName.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (!_accepted) {
      setState(() => _error = 'Vui lòng đồng ý với điều khoản sử dụng PhysLive.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = asJson(
        await SessionScope.api(context).post('/auth/school-checkout', {
          'planCode': widget.plan.code,
          'schoolName': _schoolName.text.trim(),
          'schoolCode': _schoolCode.text.trim().toUpperCase(),
          'address': _address.text.trim(),
          'fullName': _fullName.text.trim(),
          'email': _email.text.trim(),
          'phoneNumber': _phone.text.trim(),
          'password': _password.text,
        }),
      );
      final paymentUrl = asString(result['paymentUrl']);
      if (!mounted) return;
      if (paymentUrl != null && paymentUrl.isNotEmpty) {
        final uri = Uri.tryParse(paymentUrl);
        if (uri != null) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã mở cổng thanh toán VNPay trên trình duyệt.')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đăng ký trường thành công! Bạn có thể đăng nhập ngay.')),
        );
      }
      Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Scaffold(
      appBar: PublicTopBar(onBack: () => Navigator.of(context).pop()),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 22, 18, 36),
          children: [
            const _CanvasHeading(
              title: 'Đưa PhysLive đến trường bạn',
              subtitle: 'Thông tin dùng để thiết lập tài khoản quản lý.',
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: p.accentSoft,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Icon(Icons.workspace_premium_outlined, color: p.accent, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Gói ${widget.plan.name} · ${formatInt(widget.plan.annualPriceVnd)} đ/năm',
                      style: TextStyle(color: p.ink, fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                  ),
                  TextButton(
                    onPressed: _busy ? null : () => Navigator.of(context).pop(),
                    child: const Text('Đổi gói'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: p.dangerSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(_error!, style: TextStyle(color: p.danger, fontSize: 13)),
              ),
              const SizedBox(height: 14),
            ],
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _schoolName,
                      enabled: !_busy,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Tên trường',
                        hintText: 'VD: THPT Nguyễn Du',
                      ),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Nhập tên trường.' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _schoolCode,
                      enabled: !_busy,
                      textCapitalization: TextCapitalization.characters,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Mã trường',
                        hintText: 'VD: THPT_NGUYENDU',
                      ),
                      validator: (v) => v == null || v.trim().length < 2 ? 'Nhập mã trường (tối thiểu 2 ký tự).' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _address,
                      enabled: !_busy,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Địa chỉ',
                        hintText: 'Quận/Huyện, Tỉnh/Thành phố',
                      ),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Nhập địa chỉ trường.' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _fullName,
                      enabled: !_busy,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Họ tên người phụ trách',
                        hintText: 'Nguyễn Văn A',
                      ),
                      validator: (v) => v == null || v.trim().isEmpty ? 'Nhập họ tên người phụ trách.' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _email,
                      enabled: !_busy,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Email liên hệ',
                        hintText: 'quanly@school.edu.vn',
                      ),
                      validator: (v) => v == null || !v.contains('@') ? 'Nhập email hợp lệ.' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _phone,
                      enabled: !_busy,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Số điện thoại',
                        hintText: '09xxxxxxxx',
                      ),
                      validator: (v) => v == null || v.trim().length < 9 ? 'Nhập số điện thoại hợp lệ.' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _password,
                      enabled: !_busy,
                      obscureText: _hidden,
                      textInputAction: TextInputAction.done,
                      decoration: InputDecoration(
                        labelText: 'Mật khẩu quản lý',
                        hintText: 'Từ 8 đến 72 ký tự',
                        suffixIcon: IconButton(
                          onPressed: () => setState(() => _hidden = !_hidden),
                          icon: Icon(
                            _hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (v) => v == null || v.length < 8 ? 'Mật khẩu tối thiểu 8 ký tự.' : null,
                    ),
                    const SizedBox(height: 12),
                    CheckboxListTile(
                      value: _accepted,
                      onChanged: _busy ? null : (v) => setState(() => _accepted = v ?? false),
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      title: const Text(
                        'Tôi đồng ý với điều khoản sử dụng PhysLive.',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                    const SizedBox(height: 10),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2.4),
                            )
                          : const Text('Tiếp tục thanh toán'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
