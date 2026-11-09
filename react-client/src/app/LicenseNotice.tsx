import { useResource } from "../shared/hooks/operationsData";
import { useState } from "react";
import { type LicenseStatus } from "../features/account/api/userApi";
import { useSessionStore } from "../shared/auth/sessionStore";
import { isAccountSuspended } from "../shared/auth/permissions";

export default function LicenseNotice() {
  const user = useSessionStore(state => state.user);
  const suspended = isAccountSuspended(user);
  const { data: license } = useResource<LicenseStatus>("/user/me/license", Boolean(user?.schoolId) && !suspended);
  const [dismissedLicenseNoticeKey, setDismissedLicenseNoticeKey] = useState("");
  const effectiveLicense = user?.schoolId && !suspended ? license : null;
  const licenseNoticeKey = effectiveLicense
    ? `${user?.id}:${user?.schoolId}:${effectiveLicense.canPerformWriteOperations ? `renewal:${effectiveLicense.daysUntilExpiry}` : "inactive"}`
    : "";

  return <>      {user?.schoolId && effectiveLicense && (!effectiveLicense.canPerformWriteOperations || effectiveLicense.showRenewalBanner) && licenseNoticeKey !== dismissedLicenseNoticeKey &&
        <div role="status" className="license-notice">
          <p>
            {!effectiveLicense.canPerformWriteOperations
              ? "Trường chưa có license hiệu lực. Bạn có thể xem dữ liệu, vui lòng liên hệ quản lý trường để gia hạn."
              : `License của trường còn ${effectiveLicense.daysUntilExpiry} ngày.`}
          </p>
          <button
            type="button"
            aria-label="Đóng thông báo license"
            title="Đóng thông báo"
            onClick={() => setDismissedLicenseNoticeKey(licenseNoticeKey)}
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" focusable="false">
              <path d="M3.5 3.5l9 9m0-9-9 9" />
            </svg>
          </button>
        </div>}
</>;
}
