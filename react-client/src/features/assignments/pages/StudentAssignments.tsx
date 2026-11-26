import { StudentRecentResults } from "../components/StudentRecentResults";
import { StudentLearningResults } from "../components/StudentLearningInsights";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { AssignmentList } from "../components/StudentAssignmentList";
import { StudentClassOverview } from "../components/StudentClassOverview";
import { StudentUpNext } from "../components/StudentUpNext";
import { usePageBreadcrumb } from "../../../shared/layout/PageBreadcrumbContext";
const AssignmentWorkbench = lazy(() => import("../components/StudentAssignmentWorkbench").then(module => ({ default: module.AssignmentWorkbench })));
const ResourceDiscovery = lazy(() => import("../../library/components/ResourceDiscovery").then(module => ({ default: module.ResourceDiscovery })));
import { useAssignmentPractice } from "../hooks/useAssignmentPractice";
import { useStudentResources } from "../hooks/useStudentResources";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import type { User } from "../../../shared/auth/types";
import AppSidebarLayout, { type SidebarGroup } from "../../../shared/layout/AppSidebar";
import "./student-workspace.css";
import "./student-dashboard.css";

type StudentContext = {
  user: User | null;
  practice: ReturnType<typeof useAssignmentPractice>;
  resources: ReturnType<typeof useStudentResources>;
};
const useStudent = () => useOutletContext<StudentContext>();

/** One data load for the whole student area; pages read it through the outlet context. */
function StudentArea({ user }: Readonly<{ user: User | null }>) {
  const practice = useAssignmentPractice(user?.id);
  const { pathname } = useLocation();
  const resources = useStudentResources(user?.id, pathname === "/student/community");
  const groups: SidebarGroup[] = [
    { items: [{ to: "/student", label: "Tổng quan", icon: "grid", end: true }] },
    { label: "Học tập", items: [
      { to: "/student/assignments", label: "Bài tập được giao", icon: "book", badge: practice.pending },
      { to: "/student/community", label: "Kho cộng đồng", icon: "atom" },
    ] },
  ];
  return <AppSidebarLayout id="student" subtitle="Học tập" home="/student" groups={groups} contentClassName="student-area">
    <Outlet context={{ user, practice, resources } satisfies StudentContext} />
  </AppSidebarLayout>;
}

export default function StudentLayout() {
  const user = useSessionStore(state => state.user);
  return <StudentArea key={user?.id ?? "guest"} user={user} />;
}

function StudentPage({ layout, children }: Readonly<{ layout: "assigned" | "library"; children: ReactNode }>) {
  return <div className={`main student-main student-workspace student-layout-${layout}`}><div className="modern-container">{children}</div></div>;
}

export function StudentHomePage() {
  const { user, practice, resources } = useStudent();
  const navigate = useNavigate();
  return <StudentPage layout="assigned">
    <StudentClassOverview
      studentName={user?.fullName || "bạn"}
      schoolName={resources.classes[0]?.schoolName ?? user?.schoolName}
      classes={resources.classes}
      loading={resources.classesLoading}
      pendingAssignments={practice.pending}
      completedAssignments={practice.completed}
      totalAssignments={practice.summary.total}
      expiredAssignments={practice.summary.expired}
      assignmentsLoading={practice.list.loading}
      assignmentsError={practice.list.error}
      classesError={resources.classesError}
      onRetryClasses={() => void resources.loadClasses()}
      onAssignments={() => navigate("/student/assignments")}
      onExplore={() => navigate("/student/community")}
      learningResults={<StudentLearningResults {...practice.list} onSelect={assignment => navigate(`/student/assignments?bai=${encodeURIComponent(assignment.id)}`)} />}
      results={<StudentRecentResults {...practice.list} onSelect={assignment => navigate(`/student/assignments?bai=${encodeURIComponent(assignment.id)}`)} />}
      upNext={<StudentUpNext {...practice.list} onSelect={assignment => navigate(`/student/assignments?bai=${encodeURIComponent(assignment.id)}`)} onAll={() => navigate("/student/assignments")} />}
    />
  </StudentPage>;
}

/**
 * The open assignment lives in the address (?bai=<id>): a reload keeps it open, the browser's back button
 * returns to the list and a link to one assignment can be shared or bookmarked.
 */
export function StudentAssignmentsPage() {
  const { practice } = useStudent();
  const [params, setParams] = useSearchParams();
  const wanted = params.get("bai");
  const openId = practice.workbench?.assignment.id ?? null;
  const { assignments, close, list } = practice;
  const select = list.onSelect;
  useEffect(() => {
    if (wanted === openId) return;
    if (!wanted) { if (openId) close(); return; }
    const item = assignments.find(assignment => assignment.id === wanted);
    if (item) select(item);
  }, [wanted, openId, assignments, close, select]);
  const missing = Boolean(wanted && !list.loading && !list.error && !assignments.some(assignment => assignment.id === wanted));
  useEffect(() => { if (missing) setParams({}, { replace: true }); }, [missing, setParams]);
  const workbench = practice.workbench && practice.workbench.assignment.id === wanted
    ? { ...practice.workbench, onBack: () => setParams({}) } : null;
  // the open assignment's title becomes the last breadcrumb, after "Bài tập được giao"
  const setBreadcrumb = usePageBreadcrumb();
  const openTitle = workbench?.assignment.title;
  useEffect(() => { setBreadcrumb(openTitle); }, [openTitle, setBreadcrumb]);
  useEffect(() => () => setBreadcrumb(undefined), [setBreadcrumb]);
  return <StudentPage layout="assigned">
    {workbench ? <Suspense fallback={<p role="status">Đang tải bài thực hành…</p>}><AssignmentWorkbench {...workbench} /></Suspense>
      : wanted && !missing ? <p role="status" className="student-route-loading">Đang mở bài tập…</p>
      : <AssignmentList {...list} onSelect={assignment => setParams({ bai: assignment.id })} />}
  </StudentPage>;
}

export function StudentCommunityPage() {
  const { practice, resources } = useStudent();
  return <StudentPage layout="library"><Suspense fallback={<p role="status">Đang tải kho cộng đồng…</p>}><ResourceDiscovery {...resources.discovery} studentDesign vectors={practice.vectors} /></Suspense></StudentPage>;
}
