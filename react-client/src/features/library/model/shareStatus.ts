import type { LibraryItem } from "../../../shared/types/physlive";

/** Short review state of a shared item, shown in the share menu and on the library row. */
export function shareStatus(item: LibraryItem) {
  if (item.visibility === "PERSONAL") return "Đang chọn";
  if (item.moderationStatus === "PENDING") return "Chờ duyệt";
  if (item.moderationStatus === "REJECTED") return "Bị từ chối";
  return "Đã duyệt";
}

export type ShareBadge = { state: "APPROVED" | "FEATURED" | "PENDING" | "REJECTED"; label: string; title: string };

/**
 * Who sees a shared item, as one short badge on its library row (the full sentence is the tooltip). An approved
 * item simply says where it is shared; only waiting and refused items speak of the review.
 */
export function shareBadge(item: LibraryItem): ShareBadge | null {
  if (item.visibility === "PERSONAL") return null;
  const where = item.visibility === "PUBLIC" ? "kho cộng đồng" : "giáo viên trong trường";
  if (item.moderationStatus === "PENDING") return { state: "PENDING", label: "Chờ duyệt", title: `Đang chờ duyệt để chia sẻ với ${where}` };
  if (item.moderationStatus === "REJECTED") return { state: "REJECTED", label: "Bị từ chối", title: `Chưa được chia sẻ với ${where}. Mở menu ••• để xem lý do` };
  if (item.moderationStatus === "FEATURED") return { state: "FEATURED", label: "Nổi bật", title: `Đã chia sẻ với ${where} và được chọn nổi bật` };
  return { state: "APPROVED", label: item.visibility === "PUBLIC" ? "Công khai" : "Trong trường", title: `Đã chia sẻ với ${where}` };
}
