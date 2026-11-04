import { Heading, Text } from "@radix-ui/themes";
import { VersionsTab } from "./VersionsTab";

/** One home for the physics catalogue: draft → approve to publish → new version when updating. */
export function TopicsWorkspace() {
  return <div className="reviewer-stack">
    <header className="reviewer-page-head"><div>
      <Heading as="h1" size="6">Chủ đề vật lý</Heading>
      <Text as="p" size="2" color="gray" mt="1">Mỗi chủ đề khai báo đối tượng, đại lượng, đơn vị và các định luật kiểm chứng mô phỏng. Phiên bản đã phê duyệt được phát hành ngay cho giáo viên và không sửa trực tiếp — khi cần cập nhật, hãy tạo phiên bản mới.</Text>
    </div></header>
    <VersionsTab />
  </div>;
}
