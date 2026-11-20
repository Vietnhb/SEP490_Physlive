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
};

export function StudentClassOverview({ studentName, schoolName, classes, loading, pendingAssignments, completedAssignments, totalAssignments, expiredAssignments, assignmentsLoading, assignmentsError, classesError, onRetryClasses, onAssignments, onExplore, upNext, results }: Readonly<Props>) {
  const reducedMotion = useReducedMotion();
  const givenName = studentName.trim().split(/\s+/).at(-1) || studentName;
  const message = assignmentsLoading ? "Đang cập nhật tình hình bài tập của bạn…" : assignmentsError ? "Chưa tải được tình hình bài tập. Hãy thử làm mới danh sách bên dưới." : pendingAssignments > 0
    ? `Bạn có ${pendingAssignments} bài tập cần hoàn thành.`
    : expiredAssignments > 0 ? "Không còn bài đang mở cần làm. Bạn có bài đã hết hạn; hãy kiểm tra lại kết quả bên dưới." : completedAssignments > 0 ? `Bạn đã nộp ${completedAssignments} bài tập. Xem lại điểm và nhận xét của giáo viên bên dưới.` : totalAssignments > 0 ? "Không còn bài tập đang mở cần làm. Bạn có thể xem lại danh sách bài tập." : "Chưa có bài tập được giao. Bạn có thể khám phá kho mô phỏng trong lúc chờ.";
  const assignmentCount = (value: number) => assignmentsLoading || assignmentsError ? "—" : value;
  const stats = [
    { label: "Cần làm / làm lại", value: assignmentCount(pendingAssignments), icon: "edit", tone: "primary" },
    { label: "Đã nộp", value: assignmentCount(completedAssignments), icon: "check", tone: "success" },
    { label: "Lớp học", value: loading || classesError ? "—" : classes.length, icon: "users", tone: "secondary" },
    { label: "Tổng bài tập", value: assignmentCount(totalAssignments), icon: "book", tone: "neutral" },
  ] as const;
  const progress = totalAssignments > 0 ? Math.round(completedAssignments / totalAssignments * 100) : 0;
  return <motion.div className="student-dashboard" initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }}>
    <section className="student-hero" aria-label="Tổng quan học tập">
      <div className="student-dashboard-welcome">
        <div className="student-hero-copy">
          <span className="student-hero-school"><LearningIcon name="book" />{schoolName || "Không gian học tập"}</span>
          <h1>Xin chào, {givenName}</h1>
          <p>{message}</p>
        </div>
        <Button onClick={onAssignments} className="student-hero-cta"><LearningIcon name="book" />Xem bài tập<LearningIcon name="arrow" /></Button>
      </div>
      <dl className="student-hero-stats">
        {stats.map(stat => <div key={stat.label} className={"student-dashboard-stat student-dashboard-stat--" + stat.tone}>
          <dt><span className="student-dashboard-stat-icon"><LearningIcon name={stat.icon} /></span>{stat.label}</dt><dd>{stat.value}</dd>
        </div>)}
      </dl>
    </section>
    <div className="student-dashboard-grid">
      <div className="student-dashboard-main">{upNext}{results}</div>
      <aside className="student-dashboard-aside" aria-label="Lớp học và tài nguyên">
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
        {!assignmentsLoading && !assignmentsError && totalAssignments > 0 && <section className="student-dashboard-progress" aria-label="Tiến độ nộp bài">
          <div><Heading as="h2" size="3">Tiến độ nộp bài</Heading><span>{progress}%</span></div>
          <progress value={completedAssignments} max={totalAssignments} aria-label="Số bài đã nộp" />
          <Text as="p" size="2">Đã nộp {completedAssignments} trên {totalAssignments} bài được giao</Text>
        </section>}
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
