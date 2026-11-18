import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { Link, useLocation } from "react-router-dom";

/** Shown for an address no page answers, instead of silently opening another page. */
export default function NotFoundPage({ home, homeLabel = "Về trang chính" }: { home: string; homeLabel?: string }) {
  const { pathname } = useLocation();
  return <main className="route-not-found" style={{ display: "grid", placeItems: "center", minHeight: "50vh", padding: 16 }}>
    <Card size="4" style={{ maxWidth: 520, width: "100%" }}>
      <Flex direction="column" gap="3" align="start">
        <Heading as="h1" size="6">Không tìm thấy trang</Heading>
        <Text as="p" color="gray">
          Địa chỉ <Text as="span" weight="medium" style={{ wordBreak: "break-all" }}>{pathname}</Text> không tồn tại hoặc đã được đổi.
          Hãy kiểm tra lại đường dẫn, hoặc quay về trang chính của bạn.
        </Text>
        <Button asChild size="3"><Link to={home}>{homeLabel}</Link></Button>
      </Flex>
    </Card>
  </main>;
}
