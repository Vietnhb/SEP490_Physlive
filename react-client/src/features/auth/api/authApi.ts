import axios from "axios";
import { API_URL } from "../../../config/api";
import type { LoginResponse } from "../../../shared/auth/types";
import axiosClient from "../../../shared/api/client";

/** A cold server can take a while to answer the first sign-in; the user can cancel sooner. */
export const LOGIN_TIMEOUT_SECONDS = 60;

export const logout = () => axiosClient.post<void>("/auth/logout");

export const login = async (
    email: string,
    password: string,
    signal?: AbortSignal
): Promise<LoginResponse> => {
    const res = await axios.post<LoginResponse>(`${API_URL}/auth/login`, { email, password }, {
        timeout: LOGIN_TIMEOUT_SECONDS * 1000,
        signal,
    });
    return res.data;
}
