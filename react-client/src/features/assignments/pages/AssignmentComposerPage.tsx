import { lazy, Suspense } from "react";
import { Theme } from "@radix-ui/themes";
import { useEffectiveTheme } from "../../../shared/theme/themeStore";
import "../../simulation/styles/learning.css";

const Assignments = lazy(() => import("./Assignments"));

/**
 * "Giao bài mới" inside the teacher area: the same header and section rail as every other assignment page, with the
 * simulation picker and the form beside each other. The list of given assignments lives on its own page.
 */
export default function AssignmentComposerPage() {
  const appearance = useEffectiveTheme();
  return (
    <Suspense fallback={<main className="route-loading" aria-busy="true" />}>
      {/* the assignment studio is built with Radix Themes; the rest of the teacher area is plain CSS */}
      <Theme appearance={appearance} accentColor="indigo" grayColor="slate" radius="large" scaling="100%" hasBackground={false}
        className="assignment-theme assignment-theme--embedded">
        <Assignments workspaceLayout embedded />
      </Theme>
    </Suspense>
  );
}
