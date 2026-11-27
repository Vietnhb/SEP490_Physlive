import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../account/account_screens.dart';
import '../admin/ops_overview_screen.dart';
import '../admin/payments_screen.dart';
import '../admin/schools_screen.dart';
import '../admin/users_screen.dart';
import '../library/library_screen.dart';
import '../manager/manager_support_screen.dart';
import '../reviewer/reviewer_screens.dart';
import '../school/school_classes_screen.dart';
import '../school/school_overview_screen.dart';
import '../student/student_assignments_screen.dart';
import '../teacher/teacher_assignments_screen.dart';
import '../teacher/teacher_classes_screen.dart';

typedef _Tab = ({String label, IconData icon, IconData selected, Widget page});

/// The signed-in app: the tabs each kind of account works in.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;

  void _go(int index) => setState(() => _tab = index);

  List<_Tab> _tabs() {
    final user = SessionScope.of(context).user;
    // signing out rebuilds this once more before the gate swaps it for the sign-in screen
    if (user == null) return const [];
    const account = (label: 'Tài khoản', icon: Icons.person_outline_rounded, selected: Icons.person_rounded, page: AccountScreen());
    if (user.isAdmin) {
      return [
        (label: 'Tổng quan', icon: Icons.space_dashboard_outlined, selected: Icons.space_dashboard_rounded,
            page: OpsOverviewScreen(onOpenUsers: () => _go(1))),
        (label: 'Người dùng', icon: Icons.people_alt_outlined, selected: Icons.people_alt_rounded, page: const UsersScreen()),
        (label: 'Thanh toán', icon: Icons.receipt_long_outlined, selected: Icons.receipt_long_rounded, page: const PaymentsScreen(asTab: true)),
        account,
      ];
    }
    if (user.isReviewer) {
      return [
        (label: 'Việc cần làm', icon: Icons.task_alt_outlined, selected: Icons.task_alt_rounded,
            page: ReviewerHomeScreen(onOpenModeration: () => _go(1), onOpenComplaints: () => _go(2))),
        (label: 'Duyệt', icon: Icons.fact_check_outlined, selected: Icons.fact_check_rounded, page: const ModerationScreen()),
        (label: 'Khiếu nại', icon: Icons.report_outlined, selected: Icons.report_rounded, page: const ComplaintsScreen()),
        account,
      ];
    }
    if (user.isManager) {
      return [
        (label: 'Tổng quan', icon: Icons.space_dashboard_outlined, selected: Icons.space_dashboard_rounded,
            page: OpsOverviewScreen(onOpenSupport: () => _go(3), onOpenUsers: () => _go(2), onOpenSchools: () => _go(1))),
        (label: 'Trường', icon: Icons.apartment_outlined, selected: Icons.apartment_rounded, page: const SchoolsScreen()),
        (label: 'Người dùng', icon: Icons.people_alt_outlined, selected: Icons.people_alt_rounded, page: const UsersScreen()),
        (label: 'Hỗ trợ', icon: Icons.support_agent_outlined, selected: Icons.support_agent_rounded, page: const ManagerSupportScreen()),
        account,
      ];
    }
    if (user.isSchool) {
      return [
        (label: 'Trường', icon: Icons.apartment_outlined, selected: Icons.apartment_rounded, page: const SchoolOverviewScreen()),
        (label: 'Lớp học', icon: Icons.class_outlined, selected: Icons.class_rounded, page: const SchoolClassesScreen()),
        (label: 'Tài khoản', icon: Icons.people_alt_outlined, selected: Icons.people_alt_rounded,
            page: UsersScreen(schoolId: user.schoolId)),
        (label: 'Cá nhân', icon: Icons.person_outline_rounded, selected: Icons.person_rounded, page: const AccountScreen()),
      ];
    }
    if (user.isTeacher) {
      return [
        (label: 'Bài đã giao', icon: Icons.assignment_outlined, selected: Icons.assignment_rounded, page: const TeacherAssignmentsScreen()),
        (label: 'Lớp học', icon: Icons.groups_outlined, selected: Icons.groups_rounded, page: const TeacherClassesScreen()),
        (label: 'Thư viện', icon: Icons.science_outlined, selected: Icons.science_rounded, page: const LibraryScreen()),
        account,
      ];
    }
    return [
      (label: 'Bài tập', icon: Icons.assignment_outlined, selected: Icons.assignment_rounded, page: const StudentAssignmentsScreen()),
      (label: 'Thư viện', icon: Icons.science_outlined, selected: Icons.science_rounded, page: const LibraryScreen()),
      account,
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
