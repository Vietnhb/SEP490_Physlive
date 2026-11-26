import { Fragment, useState } from "react";
import { useResource } from "../../../shared/hooks/operationsData";
import { Button, Callout, Select, TextField } from "@radix-ui/themes";
import { ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { toggleCurriculum, type CurriculumTree, type CurriculumTopic, type CurriculumModule } from "../api/curriculumApi";
import { apiMessage } from "../../../shared/lib/apiError";
import { topicLabel } from "../../../shared/lib/topicLabel";
import type { LocalizedName } from "../../../shared/types/localization";
import { type CurriculumKind } from "../model/curriculumUtils";
import { extractGradeNumber, formatTopicCode, formatGradeCode, formatLessonCode } from "../model/curriculumCodeGenerator";
import { Loading, ErrorNotice } from "../../../shared/ui/ManagementUI";
import { compareCodeUnits } from "../../../shared/lib/compareText";
import RefreshButton from "../../../shared/ui/RefreshButton";
import LearningIcon from "../../../shared/ui/LearningIcon";
import CurriculumArt from "../components/CurriculumArt";
import s from "./CurriculumView.module.css";

const normalize = (value: string) =>
  value.toLocaleLowerCase("vi").normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "").replaceAll("đ", "d");

const matches = (query: string, ...values: (string | LocalizedName)[]) =>
  normalize(values.flatMap(value => (typeof value === "string" ? [value] : Object.values(value))).join(" ")).includes(query);

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.4 12.4 2.5 2.5 4.9-5.3" />
    </svg>
  );
}

function gradeRangeLabel(gradeNumbers: string[]): string {
  const nums = [...new Set(gradeNumbers.map(Number).filter(n => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
  if (nums.length === 0) return "";
  if (nums.length === 1) return `Lớp ${nums[0]}`;
  return `Lớp ${nums[0]}–${nums[nums.length - 1]}`;
}

function filterLevels(module: CurriculumModule, topic: CurriculumTopic, code: string, search: string, grade: string) {
  return module.levels
    .filter(level => grade === "ALL" || extractGradeNumber(level.name) === grade)
    .map(level => {
      const gradeCode = formatGradeCode(code, level.name);
      const parentMatch = matches(search, topic.name, code, module.name, level.name, gradeCode);
      const lessons = level.lessons
        .map((lesson, index) => ({ ...lesson, code: formatLessonCode(gradeCode, index + 1) }))
        .filter(lesson => parentMatch || matches(search, lesson.name, lesson.code));
      return { ...level, code: gradeCode, lessons };
    })
    .filter(level => !search || level.lessons.length > 0 || matches(search, topic.name, code, module.name, level.name, level.code));
}

function topicStats(topic: CurriculumTopic) {
  let lessons = 0;
  let activeLessons = 0;
  const grades: string[] = [];
  for (const mod of topic.modules) {
    for (const lvl of mod.levels) {
      grades.push(extractGradeNumber(lvl.name));
      for (const lesson of lvl.lessons) {
        lessons += 1;
        if (topic.enabled && mod.active && lvl.active && lesson.active) {
          activeLessons += 1;
        }
      }
    }
  }
  return { lessons, activeLessons, grades };
}

export function CurriculumView() {
  const [busy, setBusy] = useState(false);
  const [actionError, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("ALL");
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  const curriculumResource = useResource<CurriculumTree>("/admin/curriculum", true);
  const tree = curriculumResource.data ?? null;
  const setTree = curriculumResource.setData;
  const known = tree !== null;
  const loading = curriculumResource.loading && !known;
  const error = actionError || curriculumResource.error || "";
  const load = () => {
    setError("");
    return curriculumResource.refresh();
  };

  const toggle = async (type: CurriculumKind, id: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setTree(await toggleCurriculum(type, id));
      setNotice("Đã cập nhật trạng thái nội dung.");
    } catch (e) {
      setError(apiMessage(e, "Không thể cập nhật trạng thái chương trình học."));
    } finally {
      setBusy(false);
    }
  };

  const search = normalize(query.trim());
  const filtering = Boolean(search) || grade !== "ALL";
  const topics = (tree?.topics ?? []).map((topic, index) => ({
    topic,
    code: formatTopicCode(index + 1),
    stats: topicStats(topic),
  }));

  const grades = [
    ...new Set(topics.flatMap(({ stats }) => stats.grades).filter(Boolean)),
  ].sort(compareCodeUnits);

  const visibleTopics = topics.filter(({ topic, code }) =>
    topic.modules.some(
      module =>
        filterLevels(module, topic, code, search, grade).length > 0
        || (grade === "ALL" && matches(search, topic.name, code, module.name)),
    ) || (grade === "ALL" && matches(search, topic.name, code)),
  );

  // KPI calculations
  const totalTopics = topics.length;
  const hiddenTopics = topics.filter(({ topic }) => !topic.enabled).length;
  const totalModules = topics.reduce((sum, item) => sum + item.topic.modules.length, 0);
  const totalLessons = topics.reduce((sum, item) => sum + item.stats.lessons, 0);
  const activeLessons = topics.reduce((sum, item) => sum + item.stats.activeLessons, 0);
  const activePct = totalLessons > 0 ? Math.round((activeLessons / totalLessons) * 100) : 0;
  const overallGrades = gradeRangeLabel(grades) || "Lớp 10–12";

  // Right insight card: active coverage by topic
  const coverageRows = topics
    .map(({ topic, stats }) => ({
      id: topic.id,
      label: topicLabel(topic.name),
      pct: stats.lessons > 0 ? Math.round((stats.activeLessons / stats.lessons) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  const isTopicOpen = (id: string, index: number) => {
    if (filtering) return true;
    return openTopics[id] ?? index === 0;
  };

  const isModuleOpen = (id: string, topicIndex: number, modIndex: number) => {
    if (filtering) return true;
    return openModules[id] ?? (topicIndex === 0 && modIndex === 0);
  };

  const toggleTopicOpen = (id: string, current: boolean) =>
    setOpenTopics(prev => ({ ...prev, [id]: !current }));

  const toggleModuleOpen = (id: string, current: boolean) =>
    setOpenModules(prev => ({ ...prev, [id]: !current }));

  return (
    <div className={`admin-content ${s.page}`}>
      <RefreshButton onClick={() => void load()} disabled={curriculumResource.refreshing || busy} />

      <header className={s.heading}>
        <div className={s.headingText}>
          <h1>Chương trình học</h1>
          <p>Tra cứu và quản lý chủ đề, chương và bài học.</p>
        </div>
        <div className={s.artWrap}>
          <CurriculumArt />
        </div>
      </header>

      {error && <ErrorNotice error={error} onRetry={() => void load()} />}
      {notice && <Callout.Root color="green" role="status"><Callout.Text>{notice}</Callout.Text></Callout.Root>}

      <section className={s.stats} aria-label="Chỉ số chương trình học">
        <article className={`${s.stat} ${s.plum}`}>
          <span className={s.statIcon}><LearningIcon name="file" /></span>
          <span className={s.statLabel}>Chủ đề</span>
          <strong className={s.statValue}>{known ? totalTopics.toLocaleString("vi-VN") : "—"}</strong>
          <span className={s.statHint}>{known ? `${hiddenTopics.toLocaleString("vi-VN")} đang ẩn` : "Đang tải…"}</span>
        </article>

        <article className={`${s.stat} ${s.plum}`}>
          <span className={s.statIcon}><LearningIcon name="file" /></span>
          <span className={s.statLabel}>Chương</span>
          <strong className={s.statValue}>{known ? totalModules.toLocaleString("vi-VN") : "—"}</strong>
          <span className={s.statHint}>{overallGrades}</span>
        </article>

        <article className={`${s.stat} ${s.plum}`}>
          <span className={s.statIcon}><LearningIcon name="file" /></span>
          <span className={s.statLabel}>Bài học</span>
          <strong className={s.statValue}>{known ? totalLessons.toLocaleString("vi-VN") : "—"}</strong>
          <span className={s.statHint}>Theo chương trình THPT</span>
        </article>

        <article className={`${s.stat} ${s.mint}`}>
          <span className={s.statIcon}><LearningIcon name="atom" /></span>
          <span className={s.statLabel}>Đang áp dụng</span>
          <strong className={s.statValue}>{known ? activeLessons.toLocaleString("vi-VN") : "—"}</strong>
          <span className={s.statHint}>{known ? `${activePct}% bài học` : "Đang tải…"}</span>
          <svg className={s.spark} viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
            <path className={s.sparkArea} d="M0 29 C24 25 48 19 72 13 C92 9 108 6 120 5 L120 32 L0 32 Z" />
            <path className={s.sparkLine} d="M0 29 C24 25 48 19 72 13 C92 9 108 6 120 5" />
          </svg>
        </article>
      </section>

      <div className={s.split}>
        <section className={s.card} aria-label="Danh mục chương trình học" aria-busy={loading}>
          <div className={s.toolbar}>
            <TextField.Root
              size="3"
              type="search"
              className={s.searchField}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Tìm chủ đề, chương, bài học hoặc mã…"
              aria-label="Tìm trong chương trình học"
            >
              <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
            </TextField.Root>

            <Select.Root size="3" value={grade} onValueChange={setGrade}>
              <Select.Trigger aria-label="Lọc theo khối" />
              <Select.Content position="popper">
                <Select.Item value="ALL">Tất cả khối</Select.Item>
                {grades.map(value => (
                  <Select.Item key={value} value={value}>Khối {Number(value)}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>

          {loading ? (
            <Loading text="Đang tải chương trình học…" />
          ) : visibleTopics.length === 0 ? (
            <div className={s.empty}>
              <h2>{topics.length ? "Không tìm thấy nội dung" : "Chưa có chương trình học"}</h2>
              <p>{topics.length ? "Thử từ khóa khác hoặc bỏ bộ lọc để xem toàn bộ chương trình." : "Nội dung chương trình chưa được thiết lập."}</p>
              {topics.length > 0 && (
                <Button variant="soft" color="gray" onClick={() => { setQuery(""); setGrade("ALL"); }}>
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          ) : (
            <ul className={s.rows}>
              {visibleTopics.map(({ topic, code, stats }, topicIndex) => {
                const topicOpen = isTopicOpen(topic.id, topicIndex);
                const topicGrades = gradeRangeLabel(stats.grades);
                const visibleModules = topic.modules
                  .map(module => ({
                    module,
                    levels: filterLevels(module, topic, code, search, grade),
                  }))
                  .filter(
                    ({ module, levels }) =>
                      levels.length > 0
                      || (grade === "ALL" && (!search || matches(search, topic.name, code, module.name))),
                  );

                return (
                  <Fragment key={topic.id}>
                    <li className={s.row}>
                      <button
                        type="button"
                        className={s.rowTrigger}
                        aria-expanded={topicOpen}
                        onClick={() => toggleTopicOpen(topic.id, topicOpen)}
                      >
                        {topicOpen ? <ChevronDownIcon className={s.caret} /> : <ChevronRightIcon className={s.caret} />}
                        <span className={s.rowText}>
                          <span className={`${s.rowTitle} ${s.weightTopic}`}>{topicLabel(topic.name)}</span>
                          <span className={s.rowMeta}>
                            <span className={s.mono}>{code}</span>
                            {topicGrades ? ` · ${topicGrades}` : ""}
                            {` · ${topic.modules.length} chương`}
                          </span>
                        </span>
                      </button>

                      <span className={`${s.statusBadge} ${topic.enabled ? s.statusActive : s.statusHidden}`}>
                        {topic.enabled ? <CheckCircleIcon /> : <span className={s.statusDot} aria-hidden="true" />}
                        {topic.enabled ? "Áp dụng" : "Đã ẩn"}
                      </span>

                      <Button
                        type="button"
                        size="2"
                        variant="ghost"
                        color="gray"
                        className={s.toggleBtn}
                        disabled={busy}
                        onClick={() => void toggle("topic", topic.id)}
                      >
                        {topic.enabled ? "Ẩn" : "Áp dụng"}
                      </Button>
                    </li>

                    {topicOpen && visibleModules.map(({ module, levels }, modIndex) => {
                      const modOpen = isModuleOpen(module.id, topicIndex, modIndex);
                      const modGrades = gradeRangeLabel(module.levels.map(l => extractGradeNumber(l.name)));
                      const modLessonCount = module.levels.reduce((sum, lvl) => sum + lvl.lessons.length, 0);

                      return (
                        <Fragment key={module.id}>
                          <li className={`${s.row} ${s.depth1}`}>
                            <button
                              type="button"
                              className={s.rowTrigger}
                              aria-expanded={modOpen}
                              onClick={() => toggleModuleOpen(module.id, modOpen)}
                            >
                              {modOpen ? <ChevronDownIcon className={s.caret} /> : <ChevronRightIcon className={s.caret} />}
                              <span className={s.rowText}>
                                <span className={`${s.rowTitle} ${s.weightModule}`}>{module.name}</span>
                                <span className={s.rowMeta}>
                                  {modGrades ? `${modGrades} · ` : ""}
                                  {modLessonCount} bài học
                                </span>
                              </span>
                            </button>

                            <span className={`${s.statusBadge} ${module.active ? s.statusActive : s.statusHidden}`}>
                              {module.active ? <CheckCircleIcon /> : <span className={s.statusDot} aria-hidden="true" />}
                              {module.active ? "Áp dụng" : "Đã ẩn"}
                            </span>

                            <Button
                              type="button"
                              size="2"
                              variant="ghost"
                              color="gray"
                              className={s.toggleBtn}
                              disabled={busy}
                              onClick={() => void toggle("module", module.id)}
                            >
                              {module.active ? "Ẩn" : "Áp dụng"}
                            </Button>
                          </li>

                          {modOpen && levels.flatMap(level =>
                            level.lessons.map(lesson => (
                              <li key={lesson.id} className={`${s.row} ${s.depth2}`}>
                                <span className={s.rowStatic}>
                                  <span className={s.rowText}>
                                    <span className={`${s.rowTitle} ${s.weightLesson}`}>{lesson.name}</span>
                                    <span className={s.rowMeta}>
                                      <span className={s.mono}>{lesson.code}</span>
                                      {levels.length > 1 ? ` · ${level.name}` : ""}
                                    </span>
                                  </span>
                                </span>

                                <span className={`${s.statusBadge} ${lesson.active ? s.statusActive : s.statusHidden}`}>
                                  {lesson.active ? <CheckCircleIcon /> : <span className={s.statusDot} aria-hidden="true" />}
                                  {lesson.active ? "Áp dụng" : "Đã ẩn"}
                                </span>

                                <Button
                                  type="button"
                                  size="2"
                                  variant="ghost"
                                  color="gray"
                                  className={s.toggleBtn}
                                  disabled={busy}
                                  onClick={() => void toggle("lesson", lesson.id)}
                                >
                                  {lesson.active ? "Ẩn" : "Áp dụng"}
                                </Button>
                              </li>
                            )),
                          )}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
            </ul>
          )}
        </section>

        <aside className={s.insights}>
          <section className={s.card}>
            <div className={s.panelHead}>
              <h2>Bài học đang áp dụng</h2>
              <span>Theo chủ đề</span>
            </div>
            <div className={s.panelBody}>
              {coverageRows.length === 0 ? (
                <p className={s.panelEmpty}>Chưa có dữ liệu chủ đề.</p>
              ) : (
                coverageRows.map((row, index) => (
                  <div key={row.id} className={s.hrow}>
                    <div className={s.hrowHead}>
                      <span>{row.label}</span>
                      <strong>{row.pct}%</strong>
                    </div>
                    <span className={s.bar}>
                      <i
                        className={`${s.barFill} ${index === 0 ? s.barFillPrimary : ""}`}
                        style={{ width: `${Math.max(row.pct > 0 ? 4 : 2, row.pct)}%` }}
                      />
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
