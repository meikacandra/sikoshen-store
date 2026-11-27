export function SummaryCard({
  label,
  value,
  subtext,
}: {
  label: string
  value: string
  subtext: string
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E3E6E8',
        borderRadius: '12px',
        padding: '20px 24px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <span style={{ color: '#5B6670', fontSize: '13px', fontWeight: 500 }}>{label}</span>
      <span className="dc-kpi-num">{value}</span>
      <span style={{ color: '#5B6670', fontSize: '13px' }}>{subtext}</span>
    </div>
  )
}
