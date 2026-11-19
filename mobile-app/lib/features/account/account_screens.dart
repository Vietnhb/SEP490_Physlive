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
      appBar: AppBar(title: const Text('Tài khoản')),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: p.accentSoft,
                child: Text(user.initials, style: TextStyle(color: p.accent, fontWeight: FontWeight.w700, fontSize: 18)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(user.fullName, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 2),
                  Text(user.email, style: TextStyle(color: p.muted, fontSize: 13)),
                  const SizedBox(height: 8),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    Pill(user.roleLabel, tone: Tone.accent),
                    if (user.schoolName != null) Pill(user.schoolName!),
                  ]),
                ]),
              ),
            ]),
          ),
        ),
        if (user.suspended) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: p.warningSoft, borderRadius: BorderRadius.circular(12)),
            child: Text('Tài khoản đang bị tạm khoá ở chế độ chỉ xem.', style: TextStyle(color: p.warning)),
          ),
        ],
        const SizedBox(height: 16),
        Card(
          clipBehavior: Clip.antiAlias,
          child: Column(children: [
            ListTile(
              leading: const Icon(Icons.lock_reset_rounded),
              title: const Text('Đổi mật khẩu'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => const ChangePasswordScreen())),
            ),
            const Divider(indent: 16, endIndent: 16),
            ListTile(
              leading: Icon(Icons.logout_rounded, color: p.danger),
              title: Text('Đăng xuất', style: TextStyle(color: p.danger)),
              onTap: () => _signOut(context),
            ),
          ]),
        ),
        const SizedBox(height: 20),
        Text(
          user.isManager
              ? 'Quản lý trường, tài khoản, gói, thanh toán và chương trình học trên bản web.'
              : user.isSchool
                  ? 'Quản lý tài khoản, lớp học, nhập dữ liệu và gia hạn gói trên bản web.'
                  : user.isTeacher
                      ? 'Tạo mô phỏng bằng AI, giao bài mới và báo cáo dùng trên bản web.'
                      : 'Một số chức năng chỉ có trên bản web.',
          textAlign: TextAlign.center,
          style: TextStyle(color: p.muted, fontSize: 12),
        ),
      ]),
    );
  }
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
          icon: Icons.desktop_windows_outlined,
          title: 'Tài khoản ${user.roleLabel.toLowerCase()} dùng trên bản web',
          message: 'Ứng dụng di động dành cho học sinh và giáo viên. '
              'Hãy mở PhysLive trên trình duyệt máy tính để quản lý.',
          action: OutlinedButton(onPressed: session.signOut, child: const Text('Đăng xuất')),
        ),
      ),
    );
  }
}
