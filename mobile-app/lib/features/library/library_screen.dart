import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import 'simulation_screen.dart';

typedef _Shelf = ({String label, String path, String empty});

/// Simulations to open and play: the teacher's own, the school's shared ones and the community's.
class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  final _search = TextEditingController();
  String _query = '';
  Map<String, String> _topics = const {};

  @override
  void initState() {
    super.initState();
    _loadTopics();
  }

  /// Topic codes (KINEMATICS) in the catalogue's own words, approved versions first, as the web shows them.
  Future<void> _loadTopics() async {
    try {
      final rows = asJsonList(await SessionScope.api(context).get('/schemas/topic-names'));
      rows.sort((a, b) => (b['lifecycleStatus'] == 'APPROVED' ? 1 : 0) - (a['lifecycleStatus'] == 'APPROVED' ? 1 : 0));
      final names = <String, String>{};
      for (final row in rows) {
        final topic = asString(row['topic']), name = asString(row['name']);
        if (topic != null && name != null && name.trim().isNotEmpty) names.putIfAbsent(topic, () => name.trim());
      }
      if (mounted) setState(() => _topics = names);
    } catch (_) {
      // without names the cards simply leave the topic out
    }
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final teacher = SessionScope.of(context).user!.isTeacher;
    final shelves = <_Shelf>[
      if (teacher) (label: 'Của tôi', path: '/library/mine', empty: 'Mô phỏng bạn lưu trên bản web sẽ ở đây.'),
      (label: 'Trường', path: '/library', empty: 'Trường chưa chia sẻ mô phỏng nào.'),
      (label: 'Cộng đồng', path: '/library/community', empty: 'Chưa có mô phỏng cộng đồng.'),
    ];
    return DefaultTabController(
      length: shelves.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Thư viện'),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(112),
            child: Column(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
                child: TextField(
                  controller: _search,
                  onChanged: (value) => setState(() => _query = value.trim().toLowerCase()),
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: 'Tìm mô phỏng',
                    prefixIcon: const Icon(Icons.search_rounded),
                    isDense: true,
                    suffixIcon: _query.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Xoá',
                            onPressed: () => setState(() {
                              _search.clear();
                              _query = '';
                            }),
                            icon: const Icon(Icons.close_rounded),
                          ),
                  ),
                ),
              ),
              TabBar(
                tabs: [for (final shelf in shelves) Tab(text: shelf.label)],
                dividerColor: context.palette.line,
              ),
            ]),
          ),
        ),
        body: TabBarView(children: [
          for (final shelf in shelves) _ShelfView(key: PageStorageKey(shelf.path), shelf: shelf, query: _query, topics: _topics),
        ]),
      ),
    );
  }
}

class _ShelfView extends StatefulWidget {
  const _ShelfView({super.key, required this.shelf, required this.query, required this.topics});
  final _Shelf shelf;
  final String query;
  final Map<String, String> topics;

  @override
  State<_ShelfView> createState() => _ShelfViewState();
}

class _ShelfViewState extends State<_ShelfView> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  Future<List<LibraryItem>> _load() async =>
      asJsonList(await SessionScope.api(context).get(widget.shelf.path)).map(LibraryItem.new).toList();

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Loader<List<LibraryItem>>(
      load: _load,
      builder: (context, items, reload) {
        final query = widget.query;
        final shown = query.isEmpty
            ? items
            : items.where((i) => '${i.title} ${widget.topics[i.topic] ?? ''}'.toLowerCase().contains(query)).toList();
        return RefreshIndicator(
          onRefresh: reload,
          child: shown.isEmpty
              ? ListView(children: [
                  const SizedBox(height: 60),
                  EmptyState(
                    icon: Icons.science_outlined,
                    title: query.isEmpty ? 'Chưa có mô phỏng' : 'Không tìm thấy mô phỏng phù hợp',
                    message: query.isEmpty ? widget.shelf.empty : null,
                  ),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  itemCount: shown.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) => _ItemCard(item: shown[index], topic: widget.topics[shown[index].topic]),
                ),
        );
      },
    );
  }
}

class _ItemCard extends StatelessWidget {
  const _ItemCard({required this.item, this.topic});
  final LibraryItem item;
  final String? topic;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final by = item.sharedByName ?? item.schoolName;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SimulationScreen(item: item))),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(color: p.accentSoft, borderRadius: BorderRadius.circular(12)),
              child: Icon(Icons.play_circle_outline_rounded, color: p.accent, size: 26),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(item.title, maxLines: 2, overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontSize: 15)),
                const SizedBox(height: 3),
                Text(
                  [?topic, ?by, if (item.createdAt != null) formatDateTime(item.createdAt)]
                      .join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: p.muted, fontSize: 12),
                ),
              ]),
            ),
            const SizedBox(width: 8),
            if (item.visibility == 'PERSONAL') const Pill('Riêng tư'),
            Icon(Icons.chevron_right_rounded, color: p.muted),
          ]),
        ),
      ),
    );
  }
}
