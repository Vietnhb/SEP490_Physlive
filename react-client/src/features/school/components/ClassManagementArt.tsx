/** Local SVG artwork; no external asset request. */
export default function ClassManagementArt({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 320 160" fill="none" aria-hidden="true">
    <ellipse cx="164" cy="143" rx="130" ry="9" fill="#CEE4E7" />
    <circle cx="205" cy="71" r="62" fill="#E3EFF5" />
    <circle cx="64" cy="51" r="29" fill="#E4E7FA" />
    <rect x="91" y="19" width="178" height="111" rx="12" fill="white" stroke="#B5D5DA" strokeWidth="2" />
    <rect x="103" y="31" width="154" height="72" rx="6" fill="#DCEFF0" />
    <path d="M116 45h65M116 56h44M116 67h56" stroke="#6BAAB0" strokeWidth="4" strokeLinecap="round" />
    <rect x="211" y="47" width="11" height="40" rx="3" fill="#82B5C1" />
    <rect x="228" y="60" width="11" height="27" rx="3" fill="#A5A8D9" />
    <path d="M145 141l7-11h56l7 11M135 142h90" stroke="#9FC5CD" strokeWidth="4" strokeLinecap="round" />
    <circle cx="66" cy="95" r="14" fill="#E7BB97" />
    <path d="M52 94c-3-20 30-24 29 0l-10-7-19 7Z" fill="#183A58" />
    <path d="M42 140v-18c0-12 11-18 24-18s24 6 24 18v18" fill="#668FBF" />
    <path d="M54 113l12 9 12-9" stroke="#D3E4F4" strokeWidth="3" />
    <rect x="248" y="91" width="46" height="48" rx="8" fill="#FAE7C5" stroke="#E6CB9B" />
    <path d="M258 104h26M258 112h17M258 120h23" stroke="#C6A368" strokeWidth="3" strokeLinecap="round" />
    <path d="M41 30v12M35 36h12M287 63v10M282 68h10" stroke="#8CBAC2" strokeWidth="3" strokeLinecap="round" />
    <circle cx="281" cy="29" r="5" fill="#C1BCE5" />
  </svg>;
}
