/** Loading state of a canvas table: the real header and shimmering bars (the canvas's .sk), never a Radix table. */
export default function StudioTableSkeleton({ headers, rows = 5, label = "Đang tải…" }: Readonly<{ headers: readonly string[]; rows?: number; label?: string }>) {
  const widths = ["68%", "52%", "60%", "44%", "36%", "30%"];
  return <div role="status" aria-busy="true" aria-label={label}>
    <div className="table-scroll"><table className="table">
      <thead><tr>{headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead>
      <tbody>{Array.from({ length: rows }, (_, row) => <tr key={row}>{headers.map((header, column) =>
        <td key={header}><span className="sk" style={{ height: 12, width: widths[(column + row) % widths.length] }} /></td>)}</tr>)}</tbody>
    </table></div>
  </div>;
}
