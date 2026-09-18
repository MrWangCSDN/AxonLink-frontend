const headers = ['Sheet', '行号', '表英文名', '字段英文名', '负责人', '原因']

const pad = value => String(value).padStart(2, '0')

const timestamp = date => [
  date.getFullYear(),
  pad(date.getMonth() + 1),
  pad(date.getDate()),
  '-',
  pad(date.getHours()),
  pad(date.getMinutes()),
  pad(date.getSeconds()),
].join('')

export const exportInitialImportErrors = async (errors, now = new Date()) => {
  const XLSX = await import('xlsx')
  const rows = errors.map(error => [
    error.sheetName || '',
    error.rowNumber ?? '',
    error.tableName || '',
    error.fieldName || '',
    error.reviserInput || '',
    error.reason || '',
  ])
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '错误清单')
  XLSX.writeFile(workbook, `初始化导入错误清单-${timestamp(now)}.xlsx`)
}
