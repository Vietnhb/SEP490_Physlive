import "./StudentClassOverview.css";
import { StudentStudyArt } from "./StudentLearningInsights";
import { Badge, Button, Callout, Heading, Text } from "@radix-ui/themes";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import type { StudentClassSummary } from "../../school/api/schoolApi";
import LearningIcon from "../../../shared/ui/LearningIcon";
import { CardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";

type Props = {
  studentName: string;
  schoolName?: string | null;
  classes: StudentClassSummary[];
  loading: boolean;
  pendingAssignments: number;
  completedAssignments: number;
  totalAssignments: number;
  expiredAssignments: number;
  assignmentsLoading: boolean;
  assignmentsError: string;
  classesError: string;
  onRetryClasses: () => void;
  onAssignments: () => void;
  onExplore: () => void;
  /** Rendered between the greeting and the class list: what the student should do next. */
  upNext?: ReactNode;
  results?: ReactNode;
  learningResults?: ReactNode;
};

export function StudentClassOverview({ classes, loading, pendingAssignments, completedAssignments, totalAssignments, assignmentsLoading, assignmentsError, classesError, onRetryClasses, onExplore, onAssignments, upNext, results, learningResults }: Readonly<Props>) {
  const reducedMotion = useReducedMotion();
  const assignmentCount = (value: number) => assignmentsLoading || assignmentsError ? "—" : value;
  const stats = [
    { label: "Cần làm / làm lại", value: assignmentCount(pendingAssignments), icon: "edit", tone: "primary" },
    { label: "Đã nộp", value: assignmentCount(completedAssignments), icon: "check", tone: "success" },
    { label: "Lớp học", value: loading || classesError ? "—" : classes.length, icon: "users", tone: "secondary" },
    { label: "Tổng bài tập", value: assignmentCount(totalAssignments), icon: "book", tone: "neutral" },
  ] as const;

  return <motion.div className="student-dashboard" data-analytics="dashboard" data-dashboard-role="student" data-student-design="study" initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }}>
    <section className="student-study-banner"><div><h2>Học tập qua mô phỏng</h2><p>Dự đoán, quan sát và khám phá các hiện tượng vật lý.</p></div><Button variant="soft" onClick={onAssignments}>Xem bài tập<LearningIcon name="arrow" /></Button><StudentStudyArt /></section>
    <section className="student-hero" aria-label="Tổng quan học tập">

      <dl data-kpis className="student-hero-stats">
        {stats.map(stat => <div data-kpi key={stat.label} className={"student-dashboard-stat student-dashboard-stat--" + stat.tone}>
          <dt><span className="student-dashboard-stat-icon"><LearningIcon name={stat.icon} /></span>{stat.label}</dt><dd>{stat.value}</dd>
        </div>)}
      </dl>
    </section>
    <div className="student-dashboard-grid">
      <div className="student-dashboard-main">{upNext}{results}</div>
      <aside className="student-dashboard-aside" aria-label="Lớp học và tài nguyên">{learningResults}
        <section className="student-classes" aria-labelledby="student-classes-title">
          <div className="student-section-title"><Heading as="h2" size="4" id="student-classes-title">Lớp của tôi</Heading><span className="student-dashboard-section-icon"><LearningIcon name="users" /></span></div>
          {loading ? <CardLoadingSkeleton cards={1} label="Đang tải thông tin lớp…" /> : classesError ? <Callout.Root color="red"><Callout.Text>{classesError}</Callout.Text><Button variant="ghost" color="red" onClick={onRetryClasses}>Thử lại</Button></Callout.Root> : classes.length === 0 ? <div className="student-quiet-state"><Text color="gray">Chưa được xếp vào lớp học.</Text></div> :
            <div className="student-class-list">{classes.map(item => <article className="student-class-card" key={item.id}>
              <div className="student-class-title"><Badge color="indigo" variant="soft" size="2">Khối {item.gradeLevel}</Badge><Text size="1" color="gray">{item.schoolYear}</Text></div>
              <Heading as="h3" size="4">{item.name}</Heading>
              <Text as="p" size="2" color="gray">{item.subject || "Chưa cập nhật môn học"} · {item.classmateCount} bạn cùng lớp</Text>
              <div className="student-class-teacher"><span className="student-dashboard-teacher-icon"><LearningIcon name="users" /></span><div><Text as="p" size="1" color="gray">Giáo viên phụ trách</Text>{item.teachers.length ? <ul>{item.teachers.map(teacher => <li key={teacher.id}><Text size="2">{teacher.fullName}</Text></li>)}</ul> : <Text size="2">Chưa phân công giáo viên</Text>}</div></div>
            </article>)}</div>}
        </section>

        <section className="student-dashboard-explore" aria-labelledby="student-explore-title">
          <span className="student-dashboard-explore-icon"><LearningIcon name="atom" /></span>
          <Heading as="h2" size="4" id="student-explore-title">Học qua khám phá</Heading>
          <Text as="p" size="2">Quan sát hiện tượng và thử những ý tưởng mới trong kho mô phỏng.</Text>
          <Button variant="soft" onClick={onExplore}>Khám phá mô phỏng<LearningIcon name="arrow" /></Button>
        </section>
      </aside>
    </div>
  </motion.div>;
}
