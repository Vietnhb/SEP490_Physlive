import { useEffect, useRef, useState } from "react";
import api from "../../../shared/api/client";
import { useResource } from "../../../shared/hooks/operationsData";
import s from "./AppealEvidence.module.css";

function Preview({ file }: Readonly<{ file: File }>) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={image} alt={file.name} />;
}

export function AppealEvidencePicker({ files, onChange, disabled }: Readonly<{ files: File[]; onChange: (files: File[]) => void; disabled?: boolean }>) {
  const [error, setError] = useState("");
  return <section className={s.picker} aria-label="Ảnh minh chứng">
    <label>Ảnh minh chứng (không bắt buộc)<span className={s.choose}>Chọn ảnh ({files.length}/3)</span><input type="file" accept="image/jpeg,image/png" multiple disabled={disabled} onChange={event => {
      const added = Array.from(event.target.files ?? []); event.target.value = "";
      if (files.length + added.length > 3) { setError("Chỉ được chọn tối đa 3 ảnh."); return; }
      if (added.some(file => !["image/jpeg", "image/png"].includes(file.type) || file.size === 0 || file.size > 2 * 1024 * 1024)) { setError("Chọn ảnh JPG/PNG, tối đa 2 MB mỗi ảnh."); return; }
      setError(""); onChange([...files, ...added]);
    }} /></label>
    <small>Tối đa 3 ảnh JPG/PNG · 2 MB mỗi ảnh. Chỉ người gửi và người có quyền xem đơn được mở ảnh.</small>
    {error && <p role="alert">{error}</p>}
    {files.length > 0 && <ul className={s.images}>{files.map((file, index) => <li key={index}><Preview file={file} /><span>{file.name}</span><button type="button" disabled={disabled} onClick={() => { setError(""); onChange(files.filter((_, i) => i !== index)); }} aria-label={`Gỡ ảnh ${file.name}`}>Gỡ ảnh</button></li>)}</ul>}
  </section>;
}

function ProtectedImage({ url, index }: Readonly<{ url: string; index: number }>) {
  const [image, setImage] = useState(""); const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = "";
    void api.get<Blob>(url, { responseType: "blob", signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(data); setImage(objectUrl);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  return <li>{image ? <a href={image} target="_blank" rel="noreferrer"><img src={image} alt={`Ảnh minh chứng ${index + 1}`} /><span>Mở ảnh {index + 1}</span></a> : <span>{error ? "Không tải được ảnh. Đóng và mở lại chi tiết để thử lại." : "Đang tải ảnh…"}</span>}</li>;
}

export function AppealEvidenceGallery({ appealId }: Readonly<{ appealId: string }>) {
  const resource = useResource<{ id: string; contentType: string }[]>(`/appeals/${appealId}/evidence`);
  if (resource.error) return <p role="alert">Không tải được ảnh minh chứng: {resource.error}</p>;
  if (resource.loading) return <p role="status">Đang kiểm tra ảnh minh chứng…</p>;
  if (!resource.data?.length) return null;
  return <section className={s.picker} aria-label="Ảnh minh chứng đã gửi"><h3>Ảnh minh chứng</h3><ul className={s.images}>{resource.data.map((item, index) => <ProtectedImage key={item.id} index={index} url={`/appeals/${appealId}/evidence/${item.id}`} />)}</ul></section>;
}
