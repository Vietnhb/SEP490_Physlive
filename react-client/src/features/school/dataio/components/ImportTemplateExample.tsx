import type { ImportKind } from "../api/importApi";
import s from "./SchoolBulkImport.module.css";
export default function ImportTemplateExample({ kind }: { kind: ImportKind }) {
  const date = new Date();
  const year = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  const schoolYear = `${year}-${year + 1}`;
  const sample = kind === "USERS" ? {
    headers: ["Họ và tên", "Ngày sinh", "Email", "Mật khẩu ban đầu", "Vai trò", "Quyền trong trường"],
    keys: ["fullName", "dateOfBirth", "email", "initialPassword", "role", "permissions"],
    rows: [["Nguyễn Minh An", "2010-09-15", "minhan@example.edu.vn", "ChangeMe2026!", "STUDENT", ""], ["Trần Thu Hà", "1988-04-23", "thuha@example.edu.vn", "ChangeMe2026!", "STAFF", "TEACH"]],
  } : kind === "CLASSES" ? {
    headers: ["Mã lớp", "Khối", "Năm học", "Môn học"], keys: ["classCode", "gradeLevel", "schoolYear", "subject"],
    rows: [["10A1", "10", schoolYear, "Vật lý"], ["11A1", "11", schoolYear, "Vật lý"]],
  } : {
    headers: [kind === "ENROLLMENTS" ? "Email học sinh" : "Email giáo viên", "Mã lớp", "Năm học"],
    keys: [kind === "ENROLLMENTS" ? "studentEmail" : "teacherEmail", "classCode", "schoolYear"],
    rows: [[kind === "ENROLLMENTS" ? "minhan@example.edu.vn" : "giaovien@example.edu.vn", "10A1", schoolYear]],
  };
  return <section className={s.templateExample} aria-label="Ví dụ cấu trúc CSV"><h3>Cấu trúc tệp CSV mẫu</h3><p>Dữ liệu minh họa. Tải CSV mẫu để có đầy đủ các cột được hỗ trợ.</p><div className={s.sampleScroll}><table><thead><tr>{sample.headers.map((header,i) => <th key={header}>{header}<small>{sample.keys[i]}</small></th>)}</tr></thead><tbody>{sample.rows.map((row,i) => <tr key={i}>{row.map((value,j) => <td key={j}>{value || <span className={s.sampleMuted}>trống</span>}</td>)}</tr>)}</tbody></table></div></section>;
}
