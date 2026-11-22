import PageActionsProvider from "./shared/layout/PageActionsProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./shared/api/queryClient";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import "./styles/global.css";
import "./shared/ui/analytics-surfaces.css";
import "./shared/ui/role-dashboards.css";
import "./shared/ui/commercial-reports.css";
import "./shared/theme/themeStore";
import { markAndroidApp } from "./shared/lib/appShell";

markAndroidApp();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <PageActionsProvider><App /></PageActionsProvider>
    </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);