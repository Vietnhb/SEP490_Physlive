import { resetServerState } from "../api/queryClient";
import { create } from "zustand";
import type { User } from "./types";

type SessionState = { user: User | null; setUser: (user: User | null) => void };

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  setUser: (user) => set(previous => {
    const scope = (value: User | null) => JSON.stringify(value && [value.id, value.role, value.schoolId,
      [...(value.permissions ?? [])].sort(), value.active, value.accountStatus, value.suspensionScope, value.mustChangePassword]);
    if (scope(previous.user) !== scope(user)) resetServerState();
    return { user };
  }),
}));