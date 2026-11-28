import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../account/account_screens.dart';
import '../admin/admin_overview_screen.dart';
import '../admin/ops_overview_screen.dart';
import '../admin/schools_screen.dart';
import '../admin/users_screen.dart';
import '../library/library_screen.dart';
import '../manager/manager_modules_screen.dart';
import '../manager/manager_support_screen.dart';
import '../reviewer/reviewer_screens.dart';
import '../reviewer/reviewer_topics_and_gaps_screen.dart';
import '../school/school_classes_screen.dart';
import '../school/school_overview_screen.dart';
import '../student/student_assignments_screen.dart';
import '../student/student_overview_screen.dart';
import '../teacher/teacher_classes_screen.dart';
import '../teacher/teacher_composer_and_lab_screen.dart';
import '../teacher/teacher_overview_screen.dart';

typedef _Tab = ({String label, IconData icon, IconData selected, Widget page});

/// The signed-in app: the tabs each kind of account works in.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;
  int? _syncedUserId;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final session = SessionScope.read(context);
    final uid = session.user?.id;
    if (uid != null && _syncedUserId != uid) {
      _syncedUserId = uid;
      syncNotifications(session);
    }
  }

  void _go(int index) => setState(() => _tab = index);

  List<_Tab> _tabs() {
    final user = SessionScope.of(context).user;
    // signing out rebuilds this once more before the gate swaps it for the sign-in screen
    if (user == null) return const [];
    if (user.isAdmin) {
      return [
        (label: 'Tổng quan', icon: Icons.grid_view_outlined, selected: Icons.grid_view_rounded,
            page: AdminOverviewScreen(onOpenUsers: () => _go(1))),
        (label: 'Tài khoản', icon: Icons.people_alt_outlined, selected: Icons.people_alt_rounded, page: const UsersScreen()),
        (label: 'Cá nhân', icon: Icons.person_outline_rounded, selected: Icons.person_rounded, page: const AccountScreen()),
      ];
    }
    if (user.isReviewer) {
      return [
        (label: 'Công việc', icon: Icons.grid_view_outlined, selected: Icons.grid_view_rounded,
            page: ReviewerHomeScreen(onOpenModeration: () => _go(1), onOpenComplaints: () => _go(2))),
        (label: 'Chờ duyệt', icon: Icons.fact_check_outlined, selected: Icons.fact_check_rounded, page: const ModerationScreen()),
        (label: 'Báo lỗi', icon: Icons.report_outlined, selected: Icons.report_rounded, page: const ComplaintsScreen()),
        (label: 'Thêm', icon: Icons.more_horiz_rounded, selected: Icons.more_horiz_rounded, page: const ReviewerMoreScreen()),
      ];
    }
    if (user.isManager) {
      return [
        (label: 'Tổng quan', icon: Icons.grid_view_outlined, selected: Icons.grid_view_rounded,
            page: OpsOverviewScreen(onOpenSupport: () => _go(2), onOpenSchools: () => _go(1))),
        (label: 'Trường', icon: Icons.apartment_outlined, selected: Icons.apartment_rounded, page: const SchoolsScreen()),
        (label: 'Hỗ trợ', icon: Icons.support_agent_outlined, selected: Icons.support_agent_rounded, page: const ManagerSupportScreen()),
        (label: 'Thêm', icon: Icons.more_horiz_rounded, selected: Icons.more_horiz_rounded, page: const ManagerMoreScreen()),
      ];
    }
    if (user.isSchool) {
      return [
        (label: 'Tổng quan', icon: Icons.grid_view_outlined, selected: Icons.grid_view_rounded,
            page: SchoolOverviewScreen(onOpenClasses: () => _go(1))),
        (label: 'Lớp học', icon: Icons.class_outlined, selected: Icons.class_rounded, page: const SchoolClassesScreen()),
        (label: 'Tài khoản', icon: Icons.people_alt_outlined, selected: Icons.people_alt_rounded,
            page: UsersScreen(schoolId: user.schoolId)),
        (label: 'Thêm', icon: Icons.more_horiz_rounded, selected: Icons.more_horiz_rounded, page: const SchoolMoreScreen()),
      ];
    }
    if (user.isDepartmentHeadOnly) {
      return [
        (label: 'Tổ bộ môn', icon: Icons.groups_2_outlined, selected: Icons.groups_2_rounded,
            page: const TeacherDepartmentScreen(embedded: true)),
        (label: 'Thư viện', icon: Icons.science_outlined, selected: Icons.science_rounded, page: const LibraryScreen()),
        (label: 'Cá nhân', icon: Icons.person_outline_rounded, selected: Icons.person_rounded, page: const AccountScreen()),
      ];
    }
    if (user.isTeacher) {
      return [
        (label: 'Tổng quan', icon: Icons.grid_view_outlined, selected: Icons.grid_view_rounded,
            page: TeacherOverviewScreen(onOpenClasses: () => _go(1), onOpenLab: () => _go(2))),
        (label: 'Lớp học', icon: Icons.groups_outlined, selected: Icons.groups_rounded, page: const TeacherClassesScreen()),
        (label: 'Mô phỏng', icon: Icons.science_outlined, selected: Icons.science_rounded, page: const TeacherLabScreen()),
        (label: 'Thêm', icon: Icons.more_horiz_rounded, selected: Icons.more_horiz_rounded,
            page: TeacherMoreScreen(onOpenClasses: () => _go(1))),
      ];
    }
    return [
      (label: 'Tổng quan', icon: Icons.grid_view_outlined, selected: Icons.grid_view_rounded,
          page: StudentOverviewScreen(onOpenAssignments: () => _go(1))),
      (label: 'Bài tập', icon: Icons.assignment_outlined, selected: Icons.assignment_rounded, page: const StudentAssignmentsScreen()),
      (label: 'Cộng đồng', icon: Icons.science_outlined, selected: Icons.science_rounded, page: const LibraryScreen()),
      (label: 'Cá nhân', icon: Icons.person_outline_rounded, selected: Icons.person_rounded, page: const AccountScreen()),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final tabs = _tabs();
    if (tabs.length < 2) return const Scaffold();
    final index = _tab.clamp(0, tabs.length - 1);
    return Scaffold(
      body: IndexedStack(index: index, children: [for (final t in tabs) t.page]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: _go,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: [
          for (final t in tabs) NavigationDestination(icon: Icon(t.icon), selectedIcon: Icon(t.selected), label: t.label),
        ],
      ),
    );
  }
}
