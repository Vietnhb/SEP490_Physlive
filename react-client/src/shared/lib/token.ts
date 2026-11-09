import { resetServerState } from "../api/queryClient";
export const setToken = (token: string) => {
    if (localStorage.getItem("token") !== token) resetServerState();
    localStorage.setItem("token", token);
}
export const getToken = () => {
    return localStorage.getItem("token");
}
export const clearToken = () => {
    resetServerState();
    localStorage.removeItem("token");
}