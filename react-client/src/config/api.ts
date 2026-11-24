import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "/api";

/** An ngrok-tunnelled API answers browsers with a warning page unless this header is sent. */
export const API_HEADERS: Record<string, string> = /\.ngrok(-free)?\.(app|dev|io)/.test(API_URL)
  ? { "ngrok-skip-browser-warning": "1" }
  : {};
Object.assign(axios.defaults.headers.common, API_HEADERS);
