import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { Card, Heading, Text } from "@radix-ui/themes";
import api from "../../../shared/api/client";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import AppSidebarLayout, { type SidebarGroup } from "../../../shared/layout/AppSidebar";
import { reviewerAccess, type ReviewerAccess, type ReviewerView } from "../model/reviewerAccess";
import { ReviewerIcon } from "../components/ReviewerKit";
import { ReviewerOverview } from "../components/ReviewerOverview";
const ContentModeration = lazy(() => import("../components/ContentModeration").then(module => ({ default: module.ContentModeration })));
const TopicsWorkspace = lazy(() => import("../components/TopicsWorkspace").then(module => ({ default: module.TopicsWorkspace })));
const LawGapsDesk = lazy(() => import("../components/LawGapsDesk").then(module => ({ default: module.LawGapsDesk })));
const ComplaintsDesk = lazy(() => import("../components/ComplaintsDesk").then(module => ({ default: module.ComplaintsDesk })));
import { complaintsForReview } from "../../support/api/supportApi";
import "../styles/reviewer.css";
import "../../support/styles/complaints.css";

/** Older links used ?view= / ?tab=; send them to the matching route. */
const LEGACY: Record<string, string> = { overview: "", moderation: "moderation", library: "moderation", topics: "topics", schemas: "topics", modules: "topics", benchmarks: "", gaps: "gaps" };
const pathOf = (view: ReviewerView) =>
  view === "overview" ? "/reviewer" : `/reviewer/${view}`;

type ReviewerContext = { access: ReviewerAccess };
const useReviewer = () => useOutletContext<ReviewerContext>();

/** REVIEWER area (also open to MANAGER). The sidebar shows only what the account was granted. */
export default function ReviewerLayout() {
  const user = useSessionStore(state => state.user);
  const [params] = useSearchParams();
  const access = reviewerAccess(user);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (!access.canReview) return;
    let active = true;
    const load = () => void api.get<unknown[]>("/reviewer/library", { params: { status: "PENDING" } }).then(response => { if (active) setPending(response.data.length); }).catch(() => undefined);
    load(); const timer = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [access.canReview]);

  // Complaints are open to every reviewer account, whichever permission it holds.
  const canHandleComplaints = !access.isManager && (access.canEdit || access.canReview);
  const [openComplaints, setOpenComplaints] = useState(0);
  useEffect(() => {
    if (!canHandleComplaints) return;
    let active = true;
    const load = () => void complaintsForReview().then(items => { if (active) setOpenComplaints(items.filter(item => item.status !== "RESOLVED").length); }).catch(() => undefined);
    load(); const timer = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [canHandleComplaints]);

  const [openGaps, setOpenGaps] = useState(0);
  useEffect(() => {
    if (!access.canEdit) return;
    let active = true;
    const load = () => void api.get<unknown[]>("/reviewer/law-gaps", { params: { status: "OPEN" } }).then(response => { if (active) setOpenGaps(response.data.length); }).catch(() => undefined);
    load(); const timer = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [access.canEdit]);

  const legacy = params.get("view") ?? params.get("tab");
  if (legacy !== null && legacy in LEGACY) return <Navigate to={`/reviewer${LEGACY[legacy] ? `/${LEGACY[legacy]}` : ""}`} replace />;

  const groups: SidebarGroup[] = [{ items: [{ to: "/reviewer", label: "Việc cần làm", icon: "grid", end: true }] }];
  if (access.canReview) groups.push({ label: "Kiểm duyệt nội dung", items: [{ to: "/reviewer/moderation", label: "Mô phỏng chờ duyệt", icon: "shield", badge: pending }] });
  if (canHandleComplaints) groups.push({ label: "Hỗ trợ giáo viên", items: [{ to: "/reviewer/complaints", label: "Khiếu nại mô phỏng", icon: "message", badge: openComplaints }] });
  if (access.canEdit) groups.push({ label: "Biên soạn dữ liệu chuẩn", items: [
    { to: "/reviewer/topics", label: "Chủ đề vật lý", icon: "atom" },
    { to: "/reviewer/gaps", label: "Định luật còn thiếu", icon: "chart", badge: openGaps },
  ] });
  if (access.isManager) groups.push({ label: "Vận hành", items: [{ to: "/manager", label: "Về trang vận hành", icon: "back" }] });

  return <AppSidebarLayout id="reviewer" subtitle="Kiểm duyệt" home="/reviewer" groups={groups} contentClassName="reviewer-academic reviewer-page" accountPlacement="topbar">
    {!access.canEdit && !access.canReview
      ? <div className="reviewer-blocked"><Card size="4"><span className="reviewer-empty-icon"><ReviewerIcon name="lock" size={28} /></span>
          <Heading as="h1" size="5" mt="3">Tài khoản chưa được cấp quyền</Heading>
          <Text as="p" color="gray" mt="2">Tài khoản kiểm duyệt cần ít nhất một quyền: <strong>kiểm duyệt nội dung</strong> hoặc <strong>biên soạn dữ liệu chuẩn</strong>. Hãy liên hệ bộ phận vận hành (Manager) để được cấp quyền.</Text>
        </Card></div>
      : <Outlet context={{ access } satisfies ReviewerContext} />}
  </AppSidebarLayout>;
}

export function ReviewerHomePage() {
  const { access } = useReviewer();
  const navigate = useNavigate();
  const name = useSessionStore(state => state.user?.fullName);
  return <ReviewerOverview access={access} name={name} onOpen={view => navigate(pathOf(view))} />;
}

export function ReviewerModerationPage() {
  const { access } = useReviewer();
  return access.canReview ? <Suspense fallback={<p role="status">Đang tải…</p>}><ContentModeration /></Suspense> : <Navigate to="/reviewer" replace />;
}

export function ReviewerTopicsPage() {
  const { access } = useReviewer();
  const { section } = useParams();
  if (!access.canEdit) return <Navigate to="/reviewer" replace />;
  if (section) return <Navigate to="/reviewer/topics" replace />;
  return <Suspense fallback={<p role="status">Đang tải…</p>}><TopicsWorkspace /></Suspense>;
}

export function ReviewerComplaintsPage() {
  const { access } = useReviewer();
  if (access.isManager) return <Navigate to="/manager/support?kind=COMPLAINT" replace />;
  return access.canEdit || access.canReview ? <Suspense fallback={<p role="status">Đang tải…</p>}><ComplaintsDesk /></Suspense> : <Navigate to="/reviewer" replace />;
}

export function ReviewerGapsPage() {
  const { access } = useReviewer();
  return access.canEdit ? <Suspense fallback={<p role="status">Đang tải…</p>}><LawGapsDesk /></Suspense> : <Navigate to="/reviewer" replace />;
}
