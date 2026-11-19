import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../account/account_screens.dart';
import '../library/library_screen.dart';
import '../manager/manager_overview_screen.dart';
import '../manager/manager_support_screen.dart';
import '../school/school_overview_screen.dart';
import '../student/student_assignments_screen.dart';
import '../teacher/teacher_assignments_screen.dart';

/// The signed-in app: three tabs, the first one depending on the account.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final user = SessionScope.of(context).user!;
    if (user.isManager) return _managerShell();
    if (user.isSchool) return _schoolShell();
    final pages = [
      user.isStudent ? const StudentAssignmentsScreen() : const TeacherAssignmentsScreen(),
      const LibraryScreen(),
      const AccountScreen(),
    ];
    return Scaffold(
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() => _tab = index),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.assignment_outlined),
            selectedIcon: const Icon(Icons.assignment_rounded),
            label: user.isStudent ? 'Bài tập' : 'Bài đã giao',
          ),
          const NavigationDestination(
            icon: Icon(Icons.science_outlined),
            selectedIcon: Icon(Icons.science_rounded),
            label: 'Thư viện',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Tài khoản',
          ),
        ],
      ),
    );
  }

  /// School accounts: the school at a glance; managing people, classes and billing stays on the web.
  Widget _schoolShell() {
    return Scaffold(
      body: IndexedStack(index: _tab, children: const [SchoolOverviewScreen(), AccountScreen()]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() => _tab = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.apartment_outlined), selectedIcon: Icon(Icons.apartment_rounded), label: 'Trường'),
          NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Tài khoản'),
        ],
      ),
    );
  }

  /// Operations accounts: what needs attention now, and the support inbox. Everything else stays on the web.
  Widget _managerShell() {
    return Scaffold(
      body: IndexedStack(index: _tab, children: [
        ManagerOverviewScreen(onOpenSupport: () => setState(() => _tab = 1)),
        const ManagerSupportScreen(),
        const AccountScreen(),
      ]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() => _tab = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard_rounded), label: 'Tổng quan'),
          NavigationDestination(icon: Icon(Icons.support_agent_outlined), selectedIcon: Icon(Icons.support_agent_rounded), label: 'Hỗ trợ'),
          NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Tài khoản'),
        ],
      ),
    );
  }
}
