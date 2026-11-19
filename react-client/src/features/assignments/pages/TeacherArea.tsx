import { useResource } from "../../../shared/hooks/operationsData";
import FallbackHeading from "../../../shared/layout/FallbackHeading";
import { type ComponentProps, type ReactNode } from "react";
import { Theme } from "@radix-ui/themes";
import { useEffectiveTheme } from "../../../shared/theme/themeStore";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import LearningHeader from "../../../shared/layout/LearningHeader";
import LearningIcon from "../../../shared/ui/LearningIcon";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { isDepartmentHead } from "../../../shared/auth/permissions";
import type { SimulationComplaint } from "../../support/api/supportApi";
import "../../support/styles/complaints.css";
import "../../simulation/styles/learning.css";
import "../../simulation/styles/lab.css";
export { default as TeacherComplaintsPage } from "./TeacherComplaintsPage";

const complaintsOnly = (items: SimulationComplaint[]) =>
  items.filter((item) => item.kind === "COMPLAINT");

type RailItem = {
  to: string;
  label: string;
  icon: ComponentProps<typeof LearningIcon>["name"];
  end?: boolean;
  badge?: number;
};

/**
 * Teacher management area. It keeps the workspace header (Mô phỏng / Giao bài / Quản lý) and adds
 * a narrow rail for the pages that are not authoring: submissions, complaints and resources.
 */
export default function TeacherAreaLayout() {
  const user = useSessionStore((state) => state.user);
  // A reply can come from Manager or Reviewer; referral alone is not a reply.
  const supportResource = useResource<SimulationComplaint[]>("/support/mine");
  const answered = complaintsOnly(supportResource.data ?? []).filter(item => item.status === "READ" && item.adminResponse?.trim()).length;

  const { pathname } = useLocation();
  // the rail lists only the pages of the section chosen in the header, so each page has one way in
  const inLibrary = pathname.startsWith("/lab/library") || pathname.startsWith("/lab/community");
  const groups: { label: string; items: RailItem[] }[] = inLibrary ? [
    {
      label: "Thư viện",
      items: [
        { to: "/lab/library", label: "Mô phỏng của tôi", icon: "folder" },
        { to: "/lab/community", label: "Kho cộng đồng", icon: "users" },
      ],
    },
  ] : [
    {
      label: "Bài tập",
      items: [
        { to: "/lab/classes", label: "Lớp phụ trách", icon: "users" },
        { to: "/lab", label: "Tất cả bài đã giao", icon: "chart", end: true },
        { to: "/assignments/workspace", label: "Giao bài mới", icon: "plus" },
      ],
    },
    {
      label: "Hỗ trợ",
      items: [
        {
          to: "/lab/complaints",
          label: "Khiếu nại đã gửi",
          icon: "message",
          badge: answered,
        },
        ...(isDepartmentHead(user) && user?.schoolId
          ? [
              {
                to: "/lab/department",
                label: "Tổ bộ môn",
                icon: "shield" as const,
              },
            ]
          : []),
      ],
    },
  ];
  const currentLabel = groups.flatMap(group => group.items)
    .filter(item => item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]?.label ?? "Bài tập";
  return (
    <div className="learning-app lab-page">
      <LearningHeader />
      <div className="teacher-area">
        <nav className="teacher-rail" aria-label="Khu quản lý của giáo viên">
          {groups.map((group) => (
            <div className="teacher-rail__group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className="teacher-rail__item"
                >
                  <LearningIcon name={item.icon} />
                  <span>{item.label}</span>
                  {Boolean(item.badge) && (
                    <em aria-label={`${item.badge} phản hồi mới`}>
                      {item.badge}
                    </em>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="teacher-area__content">
          <FallbackHeading title={currentLabel} />
          <Outlet />
        </div>
      </div>
    </div>
  );
}

/** Pages built with Radix Themes need its variables; teacher pages are otherwise plain CSS. */
export function TeacherThemed({ children }: Readonly<{ children: ReactNode }>) {
  const appearance = useEffectiveTheme();
  return (
    <Theme
      appearance={appearance}
      accentColor="indigo"
      grayColor="slate"
      radius="large"
      scaling="100%"
      hasBackground={false}
    >
      {children}
    </Theme>
  );
}
