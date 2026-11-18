import { AlertDialog, Button, Flex } from "@radix-ui/themes";
import { useCallback, useState, type ReactNode } from "react";

export type ConfirmOptions = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (confirmed: boolean) => void };

/**
 * Asks the user before an action that cannot simply be undone, in the application's own dialog instead of the
 * browser's. `confirm` resolves true when the action is confirmed; render `dialog` once in the component.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => setPending({ ...options, resolve })), []);
  const finish = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };
  const dialog = <AlertDialog.Root open={pending !== null} onOpenChange={open => { if (!open) finish(false); }}>
    <AlertDialog.Content maxWidth="460px">
      <AlertDialog.Title>{pending?.title}</AlertDialog.Title>
      <AlertDialog.Description size="2">{pending?.message}</AlertDialog.Description>
      <Flex gap="3" mt="4" justify="end">
        <AlertDialog.Cancel><Button variant="soft" color="gray">{pending?.cancelLabel ?? "Hủy"}</Button></AlertDialog.Cancel>
        <AlertDialog.Action><Button color={pending?.danger ? "red" : undefined} onClick={() => finish(true)}>{pending?.confirmLabel}</Button></AlertDialog.Action>
      </Flex>
    </AlertDialog.Content>
  </AlertDialog.Root>;
  return [confirm, dialog];
}
