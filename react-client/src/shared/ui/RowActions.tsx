import { Button, DropdownMenu, IconButton } from "@radix-ui/themes";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";

export type RowAction = {
  label: string;
  onSelect: () => void;
  /** Ends or removes something: shown in red, after the other actions. */
  danger?: boolean;
  disabled?: boolean;
};

/**
 * What can be done with one row of a table, the same in every table: a single action is a quiet text button; several
 * are gathered behind one "…" button, so rows stay calm and the column stays narrow.
 */
export default function RowActions({ subject, actions, disabled = false }: Readonly<{ subject: string; actions: RowAction[]; disabled?: boolean }>) {
  const shown = actions.filter(Boolean);
  if (shown.length === 0) return null;
  if (shown.length === 1) {
    const [only] = shown;
    return <Button type="button" size="2" variant="ghost" color={only.danger ? "red" : undefined} disabled={disabled || only.disabled}
      onClick={only.onSelect} aria-label={`${only.label}: ${subject}`}>{only.label}</Button>;
  }
  const ordered = [...shown.filter(action => !action.danger), ...shown.filter(action => action.danger)];
  const firstDanger = ordered.findIndex(action => action.danger);
  return <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      <IconButton type="button" variant="ghost" color="gray" disabled={disabled} aria-label={`Thao tác với ${subject}`}><DotsHorizontalIcon width="20" height="20" /></IconButton>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8}>
      {ordered.map((action, index) => <span key={action.label} style={{ display: "contents" }}>
        {index === firstDanger && index > 0 && <DropdownMenu.Separator />}
        <DropdownMenu.Item color={action.danger ? "red" : undefined} disabled={action.disabled} onSelect={action.onSelect}>{action.label}</DropdownMenu.Item>
      </span>)}
    </DropdownMenu.Content>
  </DropdownMenu.Root>;
}
