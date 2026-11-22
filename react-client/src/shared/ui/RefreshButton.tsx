import { Button } from "@radix-ui/themes";
import { ReloadIcon } from "@radix-ui/react-icons";
import PageActions from "../layout/PageActions";
/** Page refresh belongs in the top bar; dialogs opt in to a local button. */
export default function RefreshButton({ onClick, disabled, inline = false, "aria-label": label }: Readonly<{ onClick: () => void; disabled?: boolean; inline?: boolean; "aria-label"?: string }>) {
  const button = <Button type="button" variant="soft" color="gray" disabled={disabled} onClick={onClick} aria-label={label} data-page-refresh={inline ? undefined : "true"}><ReloadIcon />Làm mới</Button>;
  return inline ? button : <PageActions>{button}</PageActions>;
}
