import api from "../../../shared/api/client";
import { saveFile } from "../../../shared/lib/saveFile";

export type GradeAssignment = { id: string; title: string; status: string; maxScore: number; assignedBy: string; dueAt?: string | null };
export type GradeCell = { submissionId?: string | null; assignmentId: string; state: string; score: number | null; maxScore: number; feedback?: string | null; gradedBy?: string | null; gradedAt?: string | null; completedAt?: string | null };
export type GradeStudent = { id: number; fullName: string; email: string; current: boolean; cells: GradeCell[] };
export type ClassGradebook = { classId: string; className: string; schoolYear: string; assignments: GradeAssignment[]; students: GradeStudent[] };

export const classGradebook = (schoolId: string, classId: string, signal?: AbortSignal) =>
  api.get<ClassGradebook>(`/schools/${schoolId}/classes/${classId}/grades`, { signal }).then(r => r.data);

export async function downloadClassGrades(schoolId: string, classId: string, name: string) {
  const response = await api.get<Blob>(`/schools/${schoolId}/classes/${classId}/grades.csv`, { responseType: "blob" });
  saveFile(`bang-diem-${name.replaceAll(/[^\p{L}\p{N}._-]/gu, "-")}.csv`, response.data);
}
