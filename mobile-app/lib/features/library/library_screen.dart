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
      final rows = asJsonList(
        await SessionScope.api(context).get('/schemas/topic-names'),
      );
      rows.sort(
        (a, b) =>
            (b['lifecycleStatus'] == 'APPROVED' ? 1 : 0) -
            (a['lifecycleStatus'] == 'APPROVED' ? 1 : 0),
      );
      final names = <String, String>{};
      for (final row in rows) {
        final topic = asString(row['topic']), name = asString(row['name']);
        if (topic != null && name != null && name.trim().isNotEmpty)
          names.putIfAbsent(topic, () => name.trim());
      }
      if (mounted) setState(() => _topics = names);
    } catch (_) {
      // without names the cards simply leave the topic out
    }
  }

  @override
  Widget build(BuildContext context) {
    final teacher = SessionScope.of(context).user!.isTeacher;
    final shelves = <_Shelf>[
      if (teacher)
        (
          label: 'Của tôi',
          path: '/library/mine',
          empty: 'Mô phỏng bạn lưu trên bản web sẽ ở đây.',
        ),
      (
        label: 'Trường',
        path: '/library',
        empty: 'Trường chưa chia sẻ mô phỏng nào.',
      ),
      (
        label: 'Cộng đồng',
        path: '/library/community',
        empty: 'Chưa có mô phỏng cộng đồng.',
      ),
    ];
    return DefaultTabController(
      length: shelves.length,
      child: Scaffold(
        appBar: const HeroBar(
          title: 'Thư viện',
          subtitle: 'Mô phỏng đã kiểm chứng',
          art: Art.library,
        ),
        body: Column(
          children: [
            Container(
              color: context.palette.surface,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Column(
                children: [
                  SearchBox(
                    hint: 'Tìm mô phỏng theo tên hoặc chủ đề',
                    onChanged: (v) => setState(() => _query = v.toLowerCase()),
                  ),
                  TabBar(
                    tabs: [for (final shelf in shelves) Tab(text: shelf.label)],
                  ),
                ],
              ),
            ),
            Expanded(
              child: TabBarView(
                children: [
                  for (final shelf in shelves)
                    _ShelfView(
                      key: PageStorageKey(shelf.path),
                      shelf: shelf,
                      query: _query,
                      topics: _topics,
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

class _ShelfView extends StatefulWidget {
  const _ShelfView({
    super.key,
    required this.shelf,
    required this.query,
    required this.topics,
  });
  final _Shelf shelf;
  final String query;
  final Map<String, String> topics;

  @override
  State<_ShelfView> createState() => _ShelfViewState();
}

class _ShelfViewState extends State<_ShelfView>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  Future<List<LibraryItem>> _load() async => asJsonList(
    await SessionScope.api(context).get(widget.shelf.path),
  ).map(LibraryItem.new).toList();

  String? _topic;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Loader<List<LibraryItem>>(
      load: _load,
      builder: (context, items, reload) {
        final query = widget.query;
        final topicsHere =
            <String>{
              for (final i in items)
                if (i.topic != null && widget.topics[i.topic] != null) i.topic!,
            }.toList()..sort(
              (a, b) => widget.topics[a]!.compareTo(widget.topics[b]!),
            );
        final shown = items
            .where((i) => _topic == null || i.topic == _topic)
            .where(
              (i) =>
                  query.isEmpty ||
                  '${i.title} ${widget.topics[i.topic] ?? ''} ${i.sharedByName ?? ''}'
                      .toLowerCase()
                      .contains(query),
            )
            .toList();
        return RefreshIndicator(
          onRefresh: reload,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              if (topicsHere.length > 1) ...[
                ChoiceRow<String?>(
                  selected: _topic,
                  onSelected: (t) => setState(() => _topic = t),
                  options: [
                    (null, 'Tất cả', items.length),
                    for (final t in topicsHere)
                      (
                        t,
                        widget.topics[t]!,
                        items.where((i) => i.topic == t).length,
                      ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
              if (shown.isEmpty)
                EmptyState(
                  art: Art.library,
                  title: query.isEmpty
                      ? 'Chưa có mô phỏng'
                      : 'Không tìm thấy mô phỏng phù hợp',
                  message: query.isEmpty ? widget.shelf.empty : null,
                )
              else
                for (final item in shown) ...[
                  _ItemCard(item: item, topic: widget.topics[item.topic]),
                  const SizedBox(height: 12),
                ],
            ],
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
        onTap: () => Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => SimulationScreen(item: item))),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 108,
                color: p.surface2,
                padding: const EdgeInsets.all(8),
                child: Stack(
                  children: [
                    Center(
                      child: ArtImage(
                        Art.forSimulation(item.topic, item.title),
                      ),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: p.accent,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.play_arrow_rounded,
                          color: p.surface,
                          size: 18,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (topic != null)
                        Text(
                          topic!.toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: p.accent,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                          ),
                        ),
                      const SizedBox(height: 3),
                      Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontSize: 15,
                          height: 1.3,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          if (by != null) ...[
                            Avatar(name: by, size: 20),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                by,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: p.muted, fontSize: 12),
                              ),
                            ),
                          ] else
                            const Spacer(),
                          if (item.visibility == 'PERSONAL')
                            const Pill('Riêng tư'),
                        ],
                      ),
                      if (item.createdAt != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          formatDateTime(item.createdAt),
                          style: TextStyle(color: p.muted, fontSize: 11),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
