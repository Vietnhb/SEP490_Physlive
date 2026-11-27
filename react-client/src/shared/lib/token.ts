import { resetServerState } from "../api/queryClient";

const KEY = "token";
const EMAIL_KEY = "physlive.rememberedEmail";

/** Storage can be blocked (private windows, strict settings); the session then simply lasts for this page. */
const read = (storage: Storage, key: string) => { try { return storage.getItem(key); } catch { return null; } };
const write = (storage: Storage, key: string, value: string | null) => {
    try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); } catch { /* not available */ }
};

/**
 * Keeps the session token. Remembered, it survives closing the browser (localStorage); otherwise it lasts only
 * until the browser closes (sessionStorage). Only one copy exists at a time.
 */
export const setToken = (token: string, remember = true) => {
    if (getToken() !== token) resetServerState();
    write(remember ? localStorage : sessionStorage, KEY, token);
    write(remember ? sessionStorage : localStorage, KEY, null);
}
export const getToken = () => {
    return read(localStorage, KEY) ?? read(sessionStorage, KEY);
}
export const clearToken = () => {
    resetServerState();
    write(localStorage, KEY, null);
    write(sessionStorage, KEY, null);
}

/** The email "Ghi nhớ đăng nhập" kept, to fill the sign-in form next time. */
export const getRememberedEmail = () => read(localStorage, EMAIL_KEY) ?? "";
export const setRememberedEmail = (email: string | null) => write(localStorage, EMAIL_KEY, email);
