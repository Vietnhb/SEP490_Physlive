import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../account/account_screens.dart';
import '../library/library_screen.dart';
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
}
