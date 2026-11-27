import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  Future<void> _signOut(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Đăng xuất?'),
        content: const Text('Bạn sẽ cần đăng nhập lại để dùng ứng dụng.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Huỷ')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Đăng xuất')),
        ],
      ),
    );
    if (confirmed == true && context.mounted) await SessionScope.of(context).signOut();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final session = SessionScope.of(context);
    final user = session.user!;
    return Scaffold(
      appBar: const HeroBar(title: 'Tài khoản', subtitle: 'Hồ sơ và cài đặt', art: Art.users),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 28), children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [p.teal.bg, p.violet.bg]),
          ),
          child: Row(children: [
            Container(
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: p.surface, width: 3)),
              child: Avatar(name: user.fullName, url: user.avatarUrl, size: 64, tint: roleTint(context, user.role)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(user.fullName, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 2),
                Text(user.email, style: TextStyle(color: p.muted, fontSize: 13)),
                const SizedBox(height: 8),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  Pill(user.roleLabel, tone: Tone.accent),
                  if (user.schoolName != null) Pill(user.schoolName!, icon: Icons.apartment_rounded),
                ]),
              ]),
            ),
          ]),
        ),
        if (user.suspended) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: p.warningSoft, borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              Icon(Icons.lock_clock_rounded, color: p.warning),
              const SizedBox(width: 10),
              Expanded(child: Text('Tài khoản đang bị tạm khoá ở chế độ chỉ xem.', style: TextStyle(color: p.warning))),
            ]),
          ),
        ],
        const GroupLabel('Giao diện'),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: ValueListenableBuilder<ThemeMode>(
              valueListenable: appTheme,
              builder: (context, mode, _) => SegmentedButton<ThemeMode>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_rounded), label: Text('Sáng')),
                  ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_rounded), label: Text('Tối')),
                  ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.phone_android_rounded), label: Text('Theo máy')),
                ],
                selected: {mode},
                onSelectionChanged: (value) => appTheme.set(value.first),
              ),
            ),
          ),
        ),
        const GroupLabel('Bảo mật'),
        Card(
          clipBehavior: Clip.antiAlias,
          child: Column(children: [
            ListTile(
              leading: _IconBox(icon: Icons.lock_reset_rounded, tint: p.blue),
              title: const Text('Đổi mật khẩu'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ChangePasswordScreen())),
            ),
            const Divider(indent: 64),
            ListTile(
              leading: _IconBox(icon: Icons.dns_rounded, tint: p.teal),
              title: const Text('Máy chủ'),
              subtitle: Text(session.config.apiUrl.host, style: TextStyle(color: p.muted, fontSize: 12)),
            ),
            const Divider(indent: 64),
            ListTile(
              leading: _IconBox(icon: Icons.logout_rounded, tint: p.rose),
              title: Text('Đăng xuất', style: TextStyle(color: p.danger, fontWeight: FontWeight.w600)),
              onTap: () => _signOut(context),
            ),
          ]),
        ),
        const SizedBox(height: 20),
        Center(child: Image.asset('assets/brand/logo.png', width: 44, height: 44)),
        const SizedBox(height: 6),
        Text(
          user.isReviewer
              ? 'Biên soạn chủ đề và định luật, trả lời khiếu nại chi tiết trên bản web.'
              : user.isManager || user.isAdmin
              ? 'Gói dịch vụ, chương trình học và kiểm định chi tiết dùng trên bản web.'
              : user.isSchool
                  ? 'Thêm tài khoản, nhập dữ liệu và gia hạn gói trên bản web.'
                  : user.isTeacher
                      ? 'Tạo mô phỏng bằng AI, giao bài mới và báo cáo dùng trên bản web.'
                      : 'PhysLive · Vật lý, nhìn thấy được.',
          textAlign: TextAlign.center,
          style: TextStyle(color: p.muted, fontSize: 12),
        ),
      ]),
    );
  }
}

class _IconBox extends StatelessWidget {
  const _IconBox({required this.icon, required this.tint});
  final IconData icon;
  final Tint tint;

  @override
  Widget build(BuildContext context) => Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(color: tint.bg, borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, color: tint.fg, size: 20),
      );
}

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key, this.forced = false});
  final bool forced;

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _again = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _again.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final session = SessionScope.of(context);
    try {
      await session.changePassword(_current.text, _next.text);
      if (!mounted) return;
      showMessage(context, 'Đã đổi mật khẩu.');
      if (!widget.forced) Navigator.of(context).pop();
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
      appBar: AppBar(
        title: const Text('Đổi mật khẩu'),
        automaticallyImplyLeading: !widget.forced,
        actions: [
          if (widget.forced)
            TextButton(onPressed: () => SessionScope.of(context).signOut(), child: const Text('Đăng xuất')),
        ],
      ),
      body: Form(
        key: _form,
        child: ListView(padding: const EdgeInsets.all(20), children: [
          if (widget.forced) ...[
            Text('Hãy đặt mật khẩu mới trước khi tiếp tục.', style: TextStyle(color: p.muted)),
            const SizedBox(height: 16),
          ],
          TextFormField(
            controller: _current,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Mật khẩu hiện tại'),
            validator: (v) => v == null || v.isEmpty ? 'Nhập mật khẩu hiện tại.' : null,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _next,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Mật khẩu mới', helperText: 'Ít nhất 8 ký tự.'),
            validator: (v) => v == null || v.length < 8 ? 'Mật khẩu mới cần ít nhất 8 ký tự.' : null,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _again,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Nhập lại mật khẩu mới'),
            validator: (v) => v != _next.text ? 'Hai mật khẩu chưa khớp.' : null,
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: p.danger)),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: _busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                : const Text('Lưu mật khẩu'),
          ),
        ]),
      ),
    );
  }
}

/// Accounts that run a school or the platform work from the web, where their tools are.
class WebOnlyScreen extends StatelessWidget {
  const WebOnlyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final user = session.user!;
    return Scaffold(
      body: SafeArea(
        child: EmptyState(
          art: Art.web,
          title: 'Tài khoản ${user.roleLabel.toLowerCase()} dùng trên bản web',
          message: 'Công cụ của vai trò này cần màn hình lớn. '
              'Hãy mở PhysLive trên trình duyệt máy tính.',
          action: OutlinedButton(onPressed: session.signOut, child: const Text('Đăng xuất')),
        ),
      ),
    );
  }
}
