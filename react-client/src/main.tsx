import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./shared/api/queryClient";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import "./styles/global.css";
import "./shared/theme/themeStore";
import { markAndroidApp } from "./shared/lib/appShell";

markAndroidApp();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);