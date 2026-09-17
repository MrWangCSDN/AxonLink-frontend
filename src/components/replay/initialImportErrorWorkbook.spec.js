import { describe, expect, it, vi } from 'vitest'

const xlsx = vi.hoisted(() => ({
  aoaToSheet: vi.fn(() => ({ ref: 'sheet' })),
  bookNew: vi.fn(() => ({ sheets: [] })),
  bookAppendSheet: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: xlsx.aoaToSheet,
    book_new: xlsx.bookNew,
    book_append_sheet: xlsx.bookAppendSheet,
  },
  writeFile: xlsx.writeFile,
}))

import { exportInitialImportErrors } from './initialImportErrorWorkbook.js'

describe('initial import error workbook', () => {
  it('exports every error with six columns and a timestamped xlsx filename', async () => {
    const errors = [
      {
        sheetName: '存款',
        rowNumber: 2,
        tableName: 'acct_master',
        fieldName: 'bad_field',
        reviserInput: '张三（c-zhangs）',
        reason: '字段不存在',
      },
      {
        sheetName: '贷款',
        rowNumber: 5,
        tableName: 'loan_master',
        fieldName: 'loan_no',
        reviserInput: '',
        reason: '表不存在',
      },
    ]

    await exportInitialImportErrors(errors, new Date(2026, 8, 15, 17, 6, 9))

    expect(xlsx.aoaToSheet).toHaveBeenCalledWith([
      ['Sheet', '行号', '表英文名', '字段英文名', '负责人', '原因'],
      ['存款', 2, 'acct_master', 'bad_field', '张三（c-zhangs）', '字段不存在'],
      ['贷款', 5, 'loan_master', 'loan_no', '', '表不存在'],
    ])
    expect(xlsx.bookAppendSheet).toHaveBeenCalledWith(
      { sheets: [] },
      { ref: 'sheet' },
      '错误清单',
    )
    expect(xlsx.writeFile).toHaveBeenCalledWith(
      { sheets: [] },
      '初始化导入错误清单-20260915-170609.xlsx',
    )
  })
})
