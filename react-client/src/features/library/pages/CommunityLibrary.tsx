import { useMemo } from "react";
import { ResourceDiscovery } from "../components/ResourceDiscovery";
import { useCommunityLibrary } from "../hooks/useCommunityLibrary";
import PageContainer from "../../../shared/layout/PageContainer";
import DotField from "../../../shared/effects/DotField";
import { SplitWords } from "../../../shared/effects/Motion";
import CountUp from "../../../shared/effects/reactbits/CountUp";
import styles from "./CommunityLibrary.module.css";
import "../../assignments/styles/assignment-flow.css";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { canTeach } from "../../../shared/auth/permissions";

/** inApp: inside a signed-in area, where the page is a working list and not a showcase. */
export default function CommunityLibrary({ inApp = false }: Readonly<{ inApp?: boolean }>) {
  const library = useCommunityLibrary();
  const user = useSessionStore(state => state.user);
  // Real numbers from what is currently shared; nothing here is a marketing figure.
  const stats = useMemo(() => [
    { label: "mô phỏng", value: library.items.length },
    { label: "giáo viên chia sẻ", value: new Set(library.items.map(item => item.sharedById ?? item.sharedByName).filter(Boolean)).size },
    { label: "bài học có mô phỏng", value: new Set(library.items.map(item => item.lessonId).filter(Boolean)).size },
  ], [library.items]);
  return (
    <PageContainer className={`community-library-page ${styles.page}${inApp ? ` ${styles.workspacePage}` : ""}`}>
      <header className={inApp ? `${styles.hero} ${styles.workspaceHero}` : styles.hero}>
        <DotField gap={22} radius={120} activeColor="var(--accent)" />
        <div className={styles.heroCopy}>
          <h1>{inApp ? "Kho cộng đồng" : <SplitWords text="Kho cộng đồng" stagger={0.06} />}</h1>
          <p>{inApp ? "Tìm mô phỏng theo bài học, xem thử và lưu về thư viện của bạn." : "Mô phỏng giáo viên chia sẻ, đã được duyệt. Mở ra là chạy được ngay."}</p>
        </div>
        {(library.loading || library.items.length > 0) && <dl className={styles.stats}>
          {stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{library.loading ? "—" : inApp ? stat.value : <CountUp to={stat.value} duration={1.2} />}</dd></div>)}
        </dl>}
      </header>
      <ResourceDiscovery
        headingLevel="h2"
        titleHidden={inApp}
        catalogSidebar={inApp}
        {...library}
        allowSchoolScope={Boolean(user)}
        canClone={canTeach(user)}
        onRetry={() => void library.load()}
        vectors={{
          grid: true,
          trajectory: true,
          velocity: true,
          acceleration: false,
        }}
        onOpen={(item) => void library.open(item)}
        onClose={library.close}
        onTogglePlaying={library.togglePlaying}
        onReset={library.reset}
        onFrameChange={library.seek}
        onTimeChange={library.updateTime}
        onPlaybackEnd={library.stop}
      />
    </PageContainer>
  );
}
