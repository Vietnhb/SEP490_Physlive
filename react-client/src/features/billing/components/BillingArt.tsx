export default function BillingArt({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 210 110" fill="none" aria-hidden="true">
    <ellipse cx="104" cy="65" rx="71" ry="34" fill="#DFEFF0" />
    <rect x="40" y="23" width="113" height="69" rx="9" fill="#E8F2F9" stroke="#5A829F" strokeWidth="1.5" />
    <path d="M40 43h113" stroke="#5A829F" strokeWidth="1.5" />
    <rect x="51" y="55" width="24" height="17" rx="3" fill="#3899A4" stroke="#2B798F" />
    <path d="M86 68h13m6 0h13M51 81h45" stroke="#97B7CA" strokeWidth="2" strokeLinecap="round" />
    <circle cx="165" cy="80" r="21" fill="#EEF6FB" stroke="#5A829F" strokeWidth="1.5" />
    <circle cx="165" cy="80" r="15" stroke="#85AABD" />
    <path d="M161 89V70h6a5 5 0 0 1 0 10h-9m0 4h12" stroke="#507C9F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="183" cy="38" r="4" fill="#23919A" />
    <path d="M29 49v8m-4-4h8M188 58v6m-3-3h6" stroke="#A5C5D0" strokeWidth="1.5" strokeLinecap="round" />
  </svg>;
}
