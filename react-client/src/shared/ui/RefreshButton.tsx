import { Button } from "@radix-ui/themes";
import { ReloadIcon } from "@radix-ui/react-icons";

/** The one "Làm mới" button every list and dashboard uses, so it looks the same everywhere. */
export default function RefreshButton({ onClick, disabled }: Readonly<{ onClick: () => void; disabled?: boolean }>) {
  return <Button type="button" variant="soft" color="gray" disabled={disabled} onClick={onClick}><ReloadIcon />Làm mới</Button>;
}
