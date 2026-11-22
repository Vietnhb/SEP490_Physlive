import { Avatar } from "@radix-ui/themes";
import { PersonIcon } from "@radix-ui/react-icons";
import styles from "./StudentAvatar.module.css";

export default function StudentAvatar({ src }: Readonly<{ src?: string | null }>) {
  return <Avatar className={styles.avatar} size="3" radius="full" src={src || undefined} alt="" aria-hidden="true" fallback={<PersonIcon width="22" height="22" />} />;
}
