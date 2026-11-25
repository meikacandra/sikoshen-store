type CsvValue = string | number

export function downloadCsv(filename: string, headers: readonly string[], rows: readonly (readonly CsvValue[])[]) {
  function escape(value: CsvValue) {
    // Lindungi pengguna spreadsheet bila data impor kelak memuat formula.
    const text = typeof value === 'string' && (/^[=+\-@]/.test(value.trimStart()) || /^[\t\r\n]/.test(value))
      ? `'${value}` : String(value)
    return `"${text.replace(/"/g, '""')}"`
  }

  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
