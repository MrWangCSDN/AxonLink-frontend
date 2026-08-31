const logicalWidth = 1400
const horizontalPadding = 48
const tableTop = 132
const tableHeaderHeight = 52
const tableRowHeight = 48
const bottomPadding = 36
const columnWidths = [404, 150, 150, 150, 150, 170, 130]
const tableHeaders = ['领域 / 开发负责人', '计划问题数', '已修复', '延期修复', '未完成', '延期未完成', '完成率']

function safeSegment(value) {
  return String(value || '').trim().replace(/[\\/:*?"<>|]/g, '_') || '未命名'
}

function numberLabel(value) {
  const number = Number(value)
  return Number.isFinite(number) ? String(number) : '0'
}

function rateLabel(value) {
  const number = Number(value)
  return `${Number.isFinite(number) ? number.toFixed(2) : '0.00'}%`
}

function fitText(context, value, maxWidth) {
  const source = String(value ?? '')
  if (context.measureText(source).width <= maxWidth) return source
  let result = source
  while (result && context.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1)
  return `${result}…`
}

function rowValues(row, label) {
  return [
    label,
    numberLabel(row.plannedTotal),
    numberLabel(row.onTimeFixedCount),
    numberLabel(row.lateFixedCount),
    numberLabel(row.unfinishedCount),
    numberLabel(row.overdueUnfinishedCount),
    rateLabel(row.completionRate),
  ]
}

function drawRow(context, values, y, background, bold = false) {
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0)
  context.fillStyle = background
  context.fillRect(horizontalPadding, y, tableWidth, tableRowHeight)
  context.font = `${bold ? '600' : '400'} 14px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif`
  context.textBaseline = 'middle'
  let x = horizontalPadding
  values.forEach((value, index) => {
    const width = columnWidths[index]
    context.fillStyle = index === 0 ? '#334e70' : '#172033'
    context.textAlign = index === 0 ? 'left' : 'center'
    const textX = index === 0 ? x + 16 : x + width / 2
    context.fillText(fitText(context, value, width - 28), textX, y + tableRowHeight / 2)
    context.fillStyle = '#dfe6ef'
    context.fillRect(x + width - 1, y, 1, tableRowHeight)
    x += width
  })
  context.fillStyle = '#dfe6ef'
  context.fillRect(horizontalPadding, y + tableRowHeight - 1, tableWidth, 1)
}

export function buildCompletionSnapshotFilename({ groupName, startDate, endDate }) {
  return `计划完成情况-${safeSegment(groupName)}-${safeSegment(startDate)}至${safeSegment(endDate)}.png`
}

export function createCompletionSnapshotBlob({ group, developers = [], startDate, endDate }, environment = {}) {
  const documentRef = environment.documentRef || globalThis.document
  const pixelRatio = Math.max(1, Number(environment.pixelRatio) || 2)
  const rows = [
    rowValues(group || {}, group?.groupName || '当前领域'),
    ...developers.map(developer => rowValues(developer, developer.matchedDeveloper || '未匹配负责人')),
  ]
  const logicalHeight = tableTop + tableHeaderHeight + rows.length * tableRowHeight + bottomPadding
  const canvas = documentRef?.createElement?.('canvas')
  const context = canvas?.getContext?.('2d')
  if (!canvas || !context) return Promise.reject(new Error('快照图片生成失败'))

  canvas.width = logicalWidth * pixelRatio
  canvas.height = logicalHeight * pixelRatio
  context.scale(pixelRatio, pixelRatio)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, logicalWidth, logicalHeight)

  context.textBaseline = 'middle'
  context.textAlign = 'left'
  context.fillStyle = '#172033'
  context.font = '700 30px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif'
  context.fillText('计划完成情况', horizontalPadding, 40)
  context.fillStyle = '#4d6380'
  context.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif'
  context.fillText(group?.groupName || '当前领域', horizontalPadding, 78)
  context.fillStyle = '#728096'
  context.font = '400 16px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif'
  context.fillText(`${startDate} 至 ${endDate}`, horizontalPadding + 180, 78)
  context.textAlign = 'right'
  context.fillText(`开发负责人 ${developers.length} 人`, logicalWidth - horizontalPadding, 78)

  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0)
  context.fillStyle = '#eaf1f8'
  context.fillRect(horizontalPadding, tableTop, tableWidth, tableHeaderHeight)
  context.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif'
  context.fillStyle = '#536176'
  let headerX = horizontalPadding
  tableHeaders.forEach((header, index) => {
    const width = columnWidths[index]
    context.textAlign = index === 0 ? 'left' : 'center'
    context.fillText(header, index === 0 ? headerX + 16 : headerX + width / 2, tableTop + tableHeaderHeight / 2)
    headerX += width
  })

  rows.forEach((row, index) => drawRow(
    context,
    row,
    tableTop + tableHeaderHeight + index * tableRowHeight,
    index === 0 ? '#f6f9fc' : index % 2 === 0 ? '#fbfcfe' : '#ffffff',
    index === 0,
  ))

  if (typeof canvas.toBlob !== 'function') return Promise.reject(new Error('快照图片生成失败'))
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('快照图片生成失败'))
    }, 'image/png')
  })
}

export async function downloadAndCopyCompletionSnapshot(blob, filename, environment = {}) {
  const documentRef = environment.documentRef || globalThis.document
  const urlApi = environment.urlApi || globalThis.URL
  const navigatorRef = environment.navigatorRef || globalThis.navigator
  const ClipboardItemCtor = environment.ClipboardItemCtor || globalThis.ClipboardItem
  const objectUrl = urlApi.createObjectURL(blob)
  let previewUrlTransferred = false
  try {
    const anchor = documentRef.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    anchor.style.display = 'none'
    documentRef.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    if (!ClipboardItemCtor || !navigatorRef?.clipboard?.write) {
      previewUrlTransferred = true
      return { copied: false, previewUrl: objectUrl }
    }
    try {
      await navigatorRef.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })])
      return { copied: true }
    } catch {
      previewUrlTransferred = true
      return { copied: false, previewUrl: objectUrl }
    }
  } finally {
    if (!previewUrlTransferred) urlApi.revokeObjectURL(objectUrl)
  }
}
