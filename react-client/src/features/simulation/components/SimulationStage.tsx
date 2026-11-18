import { useState } from "react";
import Icon from "../../../shared/ui/LearningIcon";
import SimulationComplaintDialog from "../../support/components/SimulationComplaintDialog";
import SvgPixiScene from "./SvgPixiScene";
import ClarifyQuestion from "./ClarifyQuestion";
import { RecognitionDisplay, FormulaReview } from "./SimulationReview";
import { visualSource, type SimulationWorkspaceModel } from "../hooks/useSimulationWorkspace";

/** What a complaint about the simulation on screen should carry; absent for accounts that cannot file one. */
type ComplaintContext = { simulationId?: string; description?: string; parameters?: Record<string, number> };

export default function SimulationStage({ input, preview, complaint, readoutsTarget }: Readonly<Pick<SimulationWorkspaceModel, "input" | "preview"> & { complaint?: ComplaintContext; readoutsTarget?: HTMLElement | null }>) {
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [visualFeedback, setVisualFeedback] = useState("");
  const {
    text, setText, sourceFile, previewUrl, busy, error, acceptImage, removeImage,
    recognition, correction, setCorrection, editingRecognition, setEditingRecognition, recognitionLowConfidence,
    intent, revision, setRevision, normalize, handleRecognition, handleRevision, generate, reset,
  } = input;
  const { simulation, liveTimeline, presentation, runValues, sandboxKey, validation, renderError, setRenderError, restartPreview, recomputing } = preview;
  // "Báo lỗi" and "Dựng lại" live in the authored player's toolbar.
  const stageActions = <>
    {complaint && <button type="button" className="sim-action" title="Báo lỗi khi mô phỏng sai" onClick={() => setComplaintOpen(true)}><Icon name="message" />Báo lỗi</button>}
    <button type="button" className="sim-action" title="Dựng lại cảnh và phát từ đầu" onClick={restartPreview}><Icon name="reset" />Dựng lại</button>
    <button type="button" className="sim-action" title="Phóng to mô phỏng (Esc để thoát)" aria-label="Phóng to mô phỏng toàn màn hình"
      onClick={event => {
        // full screen is for this player only, never the whole page
        if (document.fullscreenElement) void document.exitFullscreen();
        else void event.currentTarget.closest<HTMLElement>(".sim-player")?.requestFullscreen();
      }}><Icon name="fullscreen" /></button>
  </>;
  return (
    <section className="learn-exploration" aria-label="Quan sát và khám phá">
      <section className="learn-stage" aria-label="Mô phỏng tương tác">
        {simulation ? (
          /* Layout giữa khi có mô phỏng: Canvas card + Header + Restart */
          <div className="simulation-stage-container">
            {complaintOpen && complaint && <SimulationComplaintDialog {...complaint} onClose={() => setComplaintOpen(false)} />}
            {liveTimeline && presentation ? (
              <div className="simulation-scene-frame" aria-busy={recomputing}>
              <SvgPixiScene
                key={sandboxKey}
                program={simulation.simulationSpec.visualProgram ?? { code: "" }}
                timeline={liveTimeline}
                presentation={presentation}
                parameters={runValues}
                parameterInfo={simulation.parameters}
                models={simulation.simulationSpec.physicsModels}
                fieldMeta={simulation.simulationSpec.solverFieldMeta as Record<string, { unit?: string; label?: string }> | undefined}
                observables={simulation.simulationSpec.observables}
                verificationStatus={validation?.status ?? "UNKNOWN"}
                onRenderError={setRenderError}
                toolbarActions={stageActions}
                readoutsTarget={readoutsTarget}
              />
              {recomputing && <div className="simulation-recomputing" role="status"><span className="simulation-recomputing__spinner" aria-hidden="true" />Đang tính lại với thông số mới…</div>}
              </div>
            ) : (
              <><div className="sim-player__actions">{stageActions}</div><p className="simulation-muted">Chưa có dữ liệu chuyển động để hiển thị. Hãy thử dựng lại mô phỏng.</p></>
            )}
            {renderError && <div className="simulation-warning" role="alert">
              <p>Hình minh họa chưa hiển thị được. Số liệu vật lý vẫn đúng; bạn có thể nhờ AI vẽ lại hình.</p>
              <button type="button" className="simulation-restart-button" disabled={busy}
                onClick={() => void generate({ code: visualSource(simulation), message: renderError + "\n" + visualFeedback })}>
                {busy ? "AI đang vẽ lại…" : "Vẽ lại hình minh họa"}
              </button>
            </div>}
            <p className="simulation-muted">
              Kéo thanh trượt để đổi thông số. Chuyển động, số liệu và đồ thị được tính từ mô hình vật lý; hình vẽ chỉ để minh họa.
            </p>
            {!renderError && <details className="simulation-visual-edit">
              <summary>Chưa ưng hình minh họa? Nhờ AI vẽ lại</summary>
              <label htmlFor="simulation-visual-feedback">Bạn muốn hình thay đổi thế nào?</label>
              <textarea id="simulation-visual-feedback" value={visualFeedback} disabled={busy} rows={2} maxLength={3000}
                placeholder="Ví dụ: vẽ rõ ròng rọc hơn, nhãn đang che vật, đổi sang bối cảnh phòng thí nghiệm…"
                onChange={event => setVisualFeedback(event.target.value)} />
              <button type="button" className="simulation-restart-button" disabled={busy || !visualFeedback.trim()} onClick={() => void generate({
                code: visualSource(simulation),
                message: visualFeedback,
              })}>{busy ? "AI đang vẽ lại…" : "Vẽ lại hình minh họa"}</button>
              <small className="simulation-muted">Chỉ hình vẽ thay đổi; số liệu vật lý giữ nguyên.</small>
            </details>}
            {error && <p className="simulation-error" role="alert">{error}</p>}
          </div>
        ) : (
          /* Layout giữa khi chưa có mô phỏng: mô tả, xác nhận, giải thích */
          <div className="simulation-stage-input-container">
            <ol className="simulation-steps" aria-label="Tiến trình dựng mô phỏng">
              <li className={!recognition && !intent ? "active" : "done"}>1. Mô tả tình huống</li>
              <li className={recognition ? "active" : intent ? "done" : ""}>2. Xác nhận</li>
              <li className={intent ? "active" : ""}>3. Dựng mô phỏng</li>
            </ol>

            {error && (
              <div className="simulation-error" role="alert">
                {error}
              </div>
            )}

            {!recognition && !intent && (
              <section className="simulation-card simulation-entry">
                <h2 id="simulation-entry-title">Bạn muốn mô phỏng tình huống nào?</h2>

                <form onSubmit={normalize}>
                  {/* one place for every kind of description: text, pasted LaTeX, or a photo with an optional note */}
                  <div className="simulation-composer">
                    {previewUrl && (
                      <figure className="simulation-composer__image">
                        <img src={previewUrl} alt="Ảnh đề bài đã thêm" />
                        <button type="button" aria-label="Bỏ ảnh" title="Bỏ ảnh" onClick={removeImage}><Icon name="close" /></button>
                      </figure>
                    )}
                    <textarea
                      id="simulation-input"
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      rows={sourceFile ? 2 : 4}
                      aria-labelledby="simulation-entry-title"
                      placeholder={sourceFile ? "Ghi chú thêm (không bắt buộc)" : "Nhập hoặc dán đề bài…"}
                    />
                    <div className="simulation-composer__bar">
                      <label className="simulation-composer__attach">
                        <Icon name="camera" />
                        {sourceFile ? "Đổi ảnh" : "Thêm ảnh"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) acceptImage(file);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="submit"
                        className="simulation-primary-button simulation-composer__send"
                        disabled={busy || (!sourceFile && !text.trim())}
                      >
                        {busy ? "Đang đọc…" : "Tiếp tục"}
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}

            {recognition && (
              <section className="simulation-card">
                <span className="simulation-eyebrow">Xác nhận</span>
                <h2>Hệ thống hiểu mô tả của bạn như sau, đúng chưa?</h2>
                {recognitionLowConfidence && (
                  <p className="simulation-warning" role="status">
                    Hệ thống chưa chắc chắn về kết quả nhận diện. Hãy sửa lại nội dung trước khi tiếp tục.
                  </p>
                )}
                {recognition.message && <p className="simulation-muted">{recognition.message}</p>}
                <RecognitionDisplay recognition={recognition} />
                {editingRecognition ? (
                  <div className="simulation-correction">
                    <label htmlFor="simulation-correction">Sửa nội dung đã nhận diện</label>
                    <textarea
                      id="simulation-correction"
                      rows={5}
                      value={correction}
                      onChange={(event) => setCorrection(event.target.value)}
                    />
                    <div className="simulation-actions">
                      <button
                        type="button"
                        className="simulation-primary-button"
                        disabled={busy || !correction.trim()}
                        onClick={() => void handleRecognition(false)}
                      >
                        {busy ? "Đang cập nhật…" : "Kiểm tra lại"}
                      </button>
                      {!recognitionLowConfidence && (
                        <button type="button" onClick={() => setEditingRecognition(false)}>
                          Huỷ sửa
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="simulation-actions">
                    <button
                      type="button"
                      className="simulation-primary-button"
                      disabled={busy || recognition.stage !== "RECOGNITION"}
                      onClick={() => void handleRecognition(true)}
                    >
                      {busy ? "Đang phân tích…" : "Đúng, tiếp tục"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingRecognition(true)}
                      disabled={busy}
                    >
                      Sửa lại
                    </button>
                    <button type="button" onClick={reset} disabled={busy}>
                      Làm lại từ đầu
                    </button>
                  </div>
                )}
              </section>
            )}

            {intent && !simulation && (
              <section className="simulation-card">
                <span className="simulation-eyebrow">Trước khi dựng</span>
                {intent.stage === "CLARIFY" && (
                  <>
                    <h2>Cần làm rõ một chút</h2>
                    <ClarifyQuestion question={intent.question || intent.message || ""} choices={intent.choices ?? []} answer={revision}
                      onAnswerChange={setRevision} onSubmit={handleRevision} busy={busy} />
                  </>
                )}
                {intent.stage === "UNSUPPORTED" && (
                  <>
                    <h2>Nội dung này chưa phải một tình huống vật lý</h2>
                    <p className="simulation-explanation">
                      {intent.message || intent.explanation}
                    </p>
                    <form onSubmit={handleRevision}>
                      <label htmlFor="simulation-revision">Mô tả lại tình huống</label>
                      <textarea
                        id="simulation-revision"
                        rows={3}
                        value={revision}
                        onChange={(event) => setRevision(event.target.value)}
                      />
                      <div className="simulation-actions">
                        <button
                          type="submit"
                          className="simulation-primary-button"
                          disabled={busy || !revision.trim()}
                        >
                          Gửi mô tả mới
                        </button>
                      </div>
                    </form>
                  </>
                )}
                {intent.stage === "EXPLAIN" && (
                  <>
                    <h2>Xem lại mô phỏng sẽ dựng</h2>
                    <p className="simulation-explanation">{intent.explanation}</p>
                    <FormulaReview intent={intent} />
                    <p className="simulation-muted">
                      Số liệu chính xác sẽ có sau khi mô phỏng được tính và kiểm tra theo định luật.
                    </p>
                    <div className="simulation-actions">
                      <button
                        type="button"
                        className="simulation-primary-button"
                        disabled={busy}
                        onClick={() => void generate()}
                      >
                        {busy ? "Đang dựng mô phỏng… (có thể mất 1–3 phút)" : "Dựng mô phỏng"}
                      </button>
                      <button type="button" onClick={reset} disabled={busy}>
                        Làm lại từ đầu
                      </button>
                    </div>
                    <form className="simulation-revision-form" onSubmit={handleRevision}>
                      <label htmlFor="simulation-change">Muốn chỉnh gì trước khi dựng? (không bắt buộc)</label>
                      <textarea
                        id="simulation-change"
                        rows={2}
                        value={revision}
                        onChange={(event) => setRevision(event.target.value)}
                      />
                      <button type="submit" disabled={busy || !revision.trim()}>Cập nhật</button>
                    </form>
                  </>
                )}
              </section>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
