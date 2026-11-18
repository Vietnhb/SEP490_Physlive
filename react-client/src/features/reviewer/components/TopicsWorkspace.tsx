import { Heading, Text } from "@radix-ui/themes";
import { VersionsTab } from "./VersionsTab";

/** One home for the physics catalogue: draft → approve to publish → new version when updating. */
export function TopicsWorkspace() {
  return <div className="reviewer-stack">
    <header className="reviewer-page-head"><div>
      <Heading as="h1" className="admin-content-title" size="6">Chủ đề vật lý</Heading>
      <Text as="p" size="2" color="gray" mt="1">Đối tượng, đại lượng và định luật của từng chủ đề. Bản đã duyệt không sửa được, hãy tạo phiên bản mới.</Text>
    </div></header>
    <VersionsTab />
  </div>;
}
