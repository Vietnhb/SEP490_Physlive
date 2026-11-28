import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../account/account_screens.dart';
import '../library/library_screen.dart';
import '../simulation/player.dart';
import '../simulation/scene.dart';

/// MTeacherComposer — Giao bài mô phỏng mới (POST /assignments).
class TeacherComposerScreen extends StatefulWidget {
  const TeacherComposerScreen({super.key, this.initialClass});
  final TeacherClass? initialClass;

  @override
  State<TeacherComposerScreen> createState() => _TeacherComposerScreenState();
}

class _ComposerSource {
  _ComposerSource(this.simulations, this.classes);
  final List<LibraryItem> simulations;
  final List<TeacherClass> classes;
}

class _TeacherComposerScreenState extends State<TeacherComposerScreen> {
  final _title = TextEditingController();
  final _prompt = TextEditingController();
  final _note = TextEditingController();

  LibraryItem? _selectedSim;
  TeacherClass? _selectedClass;
  bool _allStudents = true;
  final Set<int> _selectedStudentIds = {};
  DateTime? _dueAt;
  bool _allowLate = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _prompt.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<_ComposerSource> _load() async {
    final api = SessionScope.api(context);
    final results = await Future.wait([
      api.get('/library/mine').then<Object?>((v) => v, onError: (_) => null),
      api.get('/library').then<Object?>((v) => v, onError: (_) => null),
      api.get('/library/community').then<Object?>((v) => v, onError: (_) => null),
      api.get('/assignments/mine/teacher/classes').then<Object?>((v) => v, onError: (_) => null),
    ]);
    final seen = <String>{};
    final sims = <LibraryItem>[];
    for (var i = 0; i < 3; i++) {
      for (final raw in asJsonList(results[i])) {
        final item = LibraryItem(raw);
        if (item.id.isNotEmpty && seen.add(item.id)) sims.add(item);
      }
    }
    final classes = asJsonList(results[3]).map(TeacherClass.new).toList()
      ..sort((a, b) => a.name.compareTo(b.name));

    if (_selectedSim == null && sims.isNotEmpty) {
      _selectedSim = sims.first;
      if (_title.text.isEmpty) _title.text = sims.first.title;
    }
    if (_selectedClass == null && classes.isNotEmpty) {
      _selectedClass = widget.initialClass == null
          ? classes.first
          : classes.firstWhere((c) => c.id == widget.initialClass!.id, orElse: () => classes.first);
    }
    return _ComposerSource(sims, classes);
  }

  Future<void> _pickDueDate() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _dueAt ?? now.add(const Duration(days: 3)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_dueAt ?? DateTime(date.year, date.month, date.day, 23, 59)),
    );
    if (!mounted) return;
    setState(() {
      _dueAt = DateTime(date.year, date.month, date.day, time?.hour ?? 23, time?.minute ?? 59);
    });
  }

  Future<void> _submit() async {
    final sim = _selectedSim;
    final cls = _selectedClass;
    if (sim == null) {
      setState(() => _error = 'Chọn một mô phỏng để giao bài.');
      return;
    }
    if (cls == null) {
      setState(() => _error = 'Chọn lớp nhận bài.');
      return;
    }
    final title = _title.text.trim().isEmpty ? sim.title : _title.text.trim();
    final studentIds = _allStudents
        ? cls.students.map((s) => asInt(s['id'])).whereType<int>().toList()
        : _selectedStudentIds.toList();
    if (studentIds.isEmpty) {
      setState(() => _error = 'Chọn ít nhất một học sinh nhận bài.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.api(context).post('/assignments', {
        'libraryItemId': sim.id,
        'classId': cls.id,
        'title': title,
        'description': _note.text.trim().isEmpty ? null : _note.text.trim(),
        'questions': {
          'activityType': 'PREDICT_OBSERVE_EXPLAIN',
          'prompt': _prompt.text.trim().isEmpty
              ? 'Quan sát mô phỏng, đưa ra dự đoán và giải thích hiện tượng vật lý.'
              : _prompt.text.trim(),
        },
        'studentIds': studentIds,
        if (_dueAt != null) 'dueAt': _dueAt!.toUtc().toIso8601String(),
        'maxScore': 10,
        'autoGrade': false,
        'allowLateSubmission': _allowLate,
      });
      if (!mounted) return;
      showMessage(context, 'Đã giao bài cho lớp ${cls.name}.');
      Navigator.of(context).pop(true);
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
      appBar: const RoleTopBar(subtitle: 'Giảng dạy', showBack: true),
      body: Loader<_ComposerSource>(
        load: _load,
        builder: (context, data, reload) {
          if (data.simulations.isEmpty || data.classes.isEmpty) {
            return EmptyState(
              art: Art.assign,
              title: data.classes.isEmpty ? 'Chưa có lớp phụ trách' : 'Chưa có mô phỏng để giao',
              message: data.classes.isEmpty
                  ? 'Bạn cần được phân công ít nhất một lớp trước khi giao bài.'
                  : 'Hãy tạo hoặc lưu một mô phỏng vào thư viện trước.',
            );
          }

          final cls = _selectedClass ?? data.classes.first;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
            children: [
              Text(
                'Giao bài mô phỏng',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: p.brand,
                ),
              ),
              const SizedBox(height: 4),
              Text('Nội dung, lớp nhận bài và hạn nộp.', style: TextStyle(color: p.muted, fontSize: 13)),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      DropdownButtonFormField<LibraryItem>(
                        initialValue: _selectedSim,
                        isExpanded: true,
                        borderRadius: BorderRadius.circular(14),
                        dropdownColor: p.surface,
                        elevation: 4,
                        menuMaxHeight: 320,
                        decoration: const InputDecoration(labelText: 'Mô phỏng dùng cho bài'),
                        items: [
                          for (final s in data.simulations)
                            DropdownMenuItem(
                              value: s,
                              child: Text(s.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                            ),
                        ],
                        onChanged: _busy
                            ? null
                            : (v) {
                                setState(() {
                                  _selectedSim = v;
                                  if (v != null && _title.text.trim().isEmpty) _title.text = v.title;
                                });
                              },
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _title,
                        enabled: !_busy,
                        decoration: const InputDecoration(labelText: 'Tiêu đề bài tập'),
                      ),
                      const SizedBox(height: 14),
                      DropdownButtonFormField<TeacherClass>(
                        initialValue: cls,
                        isExpanded: true,
                        borderRadius: BorderRadius.circular(14),
                        dropdownColor: p.surface,
                        elevation: 4,
                        menuMaxHeight: 320,
                        decoration: const InputDecoration(labelText: 'Lớp nhận bài'),
                        items: [
                          for (final c in data.classes)
                            DropdownMenuItem(
                              value: c,
                              child: Text('${c.name} (${c.students.length} học sinh)'),
                            ),
                        ],
                        onChanged: _busy
                            ? null
                            : (v) {
                                setState(() {
                                  _selectedClass = v;
                                  _selectedStudentIds.clear();
                                });
                              },
                      ),
                      const SizedBox(height: 14),
                      DropdownButtonFormField<bool>(
                        initialValue: _allStudents,
                        borderRadius: BorderRadius.circular(14),
                        dropdownColor: p.surface,
                        elevation: 4,
                        decoration: const InputDecoration(labelText: 'Học sinh nhận bài'),
                        items: const [
                          DropdownMenuItem(value: true, child: Text('Tất cả học sinh trong lớp')),
                          DropdownMenuItem(value: false, child: Text('Chọn học sinh cụ thể')),
                        ],
                        onChanged: _busy ? null : (v) => setState(() => _allStudents = v ?? true),
                      ),
                      if (!_allStudents) ...[
                        const SizedBox(height: 10),
                        Container(
                          constraints: const BoxConstraints(maxHeight: 200),
                          decoration: BoxDecoration(
                            border: Border.all(color: p.line),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: ListView(
                            shrinkWrap: true,
                            children: [
                              for (final s in cls.students)
                                CheckboxListTile(
                                  dense: true,
                                  value: _selectedStudentIds.contains(asInt(s['id'])),
                                  title: Text(asString(s['fullName']) ?? 'Học sinh'),
                                  onChanged: _busy
                                      ? null
                                      : (checked) {
                                          final id = asInt(s['id']);
                                          if (id == null) return;
                                          setState(() {
                                            if (checked == true) {
                                              _selectedStudentIds.add(id);
                                            } else {
                                              _selectedStudentIds.remove(id);
                                            }
                                          });
                                        },
                                ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 14),
                      InkWell(
                        onTap: _busy ? null : _pickDueDate,
                        borderRadius: BorderRadius.circular(12),
                        child: InputDecorator(
                          decoration: const InputDecoration(
                            labelText: 'Hạn nộp',
                            suffixIcon: Icon(Icons.calendar_today_outlined, size: 18),
                          ),
                          child: Text(
                            _dueAt == null ? 'Không giới hạn (chạm để chọn)' : formatDateTime(_dueAt),
                            style: TextStyle(color: _dueAt == null ? p.muted : p.ink),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Cho phép nộp trễ', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        subtitle: Text(
                          'Nếu tắt, bài chưa nộp khi quá hạn được ghi nhận 0 điểm.',
                          style: TextStyle(color: p.muted, fontSize: 12),
                        ),
                        value: _allowLate,
                        onChanged: _busy ? null : (v) => setState(() => _allowLate = v),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _prompt,
                        enabled: !_busy,
                        minLines: 2,
                        maxLines: 4,
                        decoration: const InputDecoration(
                          labelText: 'Câu hỏi / Yêu cầu thực hành',
                          hintText: 'Ví dụ: Dự đoán quãng đường vật đi được trước khi chạy mô phỏng...',
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _note,
                        enabled: !_busy,
                        minLines: 2,
                        maxLines: 4,
                        decoration: const InputDecoration(
                          labelText: 'Lời dặn thêm',
                          hintText: 'Không bắt buộc',
                        ),
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(_error!, style: TextStyle(color: p.danger, fontSize: 13)),
                      ],
                      const SizedBox(height: 18),
                      FilledButton(
                        onPressed: _busy ? null : _submit,
                        child: _busy
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                            : const Text('Giao bài ngay'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// MTeacherLab + MTeacherConfirm + MTeacherSimulation — Tạo mô phỏng vật lý 3 bước.
class TeacherLabScreen extends StatefulWidget {
  const TeacherLabScreen({super.key});

  @override
  State<TeacherLabScreen> createState() => _TeacherLabScreenState();
}

class _TeacherLabScreenState extends State<TeacherLabScreen> {
  final _desc = TextEditingController();
  int _step = 0; // 0 = Mô tả, 1 = Xác nhận, 2 = Mô phỏng
  bool _busy = false;
  String? _error;

  Json? _understood;
  Json? _generated;
  SimulationScene? _scene;
  bool _saving = false;

  @override
  void dispose() {
    _desc.dispose();
    super.dispose();
  }

  Future<void> _understand() async {
    final text = _desc.text.trim();
    if (text.isEmpty) {
      setState(() => _error = 'Nhập mô tả tình huống vật lý.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = asJson(await SessionScope.api(context).post(
        '/simulation/understand',
        {'description': text},
        const Duration(seconds: 60),
      ));
      if (!mounted) return;
      setState(() {
        _understood = res;
        _step = 1;
      });
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _generate() async {
    final intent = _understood;
    if (intent == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = asJson(await SessionScope.api(context).post(
        '/simulation/generate',
        intent,
        const Duration(seconds: 90),
      ));
      if (!mounted) return;
      final scene = SimulationScene(res);
      setState(() {
        _generated = res;
        _scene = scene;
        _step = 2;
      });
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _saveToLibrary() async {
    final gen = _generated;
    if (gen == null) return;
    setState(() => _saving = true);
    try {
      final title = asString(gen['title']) ?? _desc.text.trim();
      await SessionScope.api(context).post('/simulation/saved', {
        'title': title.length > 100 ? title.substring(0, 100) : title,
        'description': _desc.text.trim(),
        'generated': gen,
      });
      if (!mounted) return;
      showMessage(context, 'Đã lưu mô phỏng vào Thư viện của tôi.');
    } catch (error) {
      if (mounted) showMessage(context, errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Scaffold(
      appBar: RoleTopBar(
        subtitle: 'Giảng dạy',
        extraAction: IconButton(
          tooltip: 'Thư viện mô phỏng',
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const LibraryScreen()),
          ),
          icon: Icon(Icons.collections_bookmark_outlined, color: p.ink, size: 22),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Tạo mô phỏng vật lý',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: p.brand,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text('Bắt đầu từ đề bài vật lý bằng tiếng Việt.', style: TextStyle(color: p.muted, fontSize: 13)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(width: 64, height: 54, child: ArtImage(Art.library)),
            ],
          ),
          const SizedBox(height: 14),

          // Stepper chips
          Row(
            children: [
              _StepChip(label: '1. Mô tả', active: _step == 0, done: _step > 0),
              const SizedBox(width: 6),
              _StepChip(label: '2. Xác nhận', active: _step == 1, done: _step > 1),
              const SizedBox(width: 6),
              _StepChip(label: '3. Mô phỏng', active: _step == 2, done: false),
            ],
          ),
          const SizedBox(height: 14),

          if (_step == 0) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: _desc,
                      enabled: !_busy,
                      minLines: 4,
                      maxLines: 8,
                      decoration: const InputDecoration(
                        labelText: 'Mô tả tình huống',
                        hintText: 'Ví dụ: Ném một vật từ độ cao 20 m theo phương ngang với vận tốc 15 m/s...',
                        alignLabelWithHint: true,
                      ),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 10),
                      Text(_error!, style: TextStyle(color: p.danger, fontSize: 13)),
                    ],
                    const SizedBox(height: 14),
                    FilledButton.icon(
                      onPressed: _busy ? null : _understand,
                      icon: _busy
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
                          : const Icon(Icons.arrow_forward_rounded, size: 18),
                      label: Text(_busy ? 'Đang nhận diện đề bài...' : 'Tiếp tục'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Thử một ví dụ', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ActionChip(
                          avatar: Icon(Icons.science_outlined, size: 16, color: p.accent),
                          label: const Text('Ném ngang từ độ cao 20 m'),
                          onPressed: _busy
                              ? null
                              : () => setState(() {
                                    _desc.text = 'Ném một vật từ độ cao 20 m theo phương ngang với vận tốc ban đầu 15 m/s, lấy g = 9.8 m/s².';
                                  }),
                        ),
                        ActionChip(
                          avatar: Icon(Icons.science_outlined, size: 16, color: p.accent),
                          label: const Text('Con lắc đơn dài 1 m'),
                          onPressed: _busy
                              ? null
                              : () => setState(() {
                                    _desc.text = 'Một con lắc đơn có chiều dài dây 1 m dao động điều hòa với biên độ góc 10 độ, lấy g = 9.8 m/s².';
                                  }),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Bạn sẽ xem lại nội dung đã nhận diện ở bước 2 trước khi dựng mô phỏng.',
                      style: TextStyle(color: p.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
          ] else if (_step == 1) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Xác nhận đề bài', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    if (asString(_understood?['topic']) != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Pill(asString(_understood?['topic'])!, tone: Tone.accent),
                        ),
                      ),
                    Text(
                      asString(_understood?['summary']) ??
                          asString(_understood?['recognizedText']) ??
                          _desc.text.trim(),
                      style: const TextStyle(height: 1.45),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 10),
                      Text(_error!, style: TextStyle(color: p.danger, fontSize: 13)),
                    ],
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _busy ? null : () => setState(() => _step = 0),
                            child: const Text('Sửa đề bài'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton(
                            onPressed: _busy ? null : _generate,
                            child: _busy
                                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
                                : const Text('Dựng mô phỏng'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ] else if (_scene != null) ...[
            SimulationPlayer(scene: _scene!),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _saving
                        ? null
                        : () => setState(() {
                              _step = 0;
                              _scene = null;
                              _generated = null;
                            }),
                    child: const Text('Tạo mô phỏng mới'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _saving ? null : _saveToLibrary,
                    icon: _saving
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
                        : const Icon(Icons.bookmark_add_outlined, size: 18),
                    label: const Text('Lưu thư viện'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _StepChip extends StatelessWidget {
  const _StepChip({required this.label, required this.active, required this.done});
  final String label;
  final bool active, done;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? p.brand : done ? p.teal.bg : p.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: active ? p.brand : done ? p.teal.bg : p.line),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: active ? Colors.white : done ? p.teal.fg : p.muted,
          ),
        ),
      ),
    );
  }
}
