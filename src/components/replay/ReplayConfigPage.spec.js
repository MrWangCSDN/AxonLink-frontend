import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ReplayConfigPage from './ReplayConfigPage.vue'
import {
  batchDeleteMessageSequenceIgnores,
  batchReviewMessageSequenceIgnores,
  batchCreateReplayConfigs,
  batchDeleteReplayConfigs,
  batchReviewReplayConfigs,
  createReplayConfig,
  createMessageSequenceIgnores,
  createOneSideErrorCodeIgnores,
  deleteMessageSequenceIgnore,
  deleteReplayConfig,
  exportReviewedMessageSequenceIgnores,
  exportReviewedReplayConfigs,
  importReplayConfigReasons,
  importReplayConfigChineseNames,
  listReplayConfigDomains,
  listReplayConfigOperations,
  listReplayConfigs,
  reviewReplayConfig,
  reviewMessageSequenceIgnore,
  updateMessageSequenceIgnore,
  updateReplayConfig,
  exportReviewedOneSideErrorCodeIgnores,
} from '../../api/replayConfigs.js'

vi.mock('../../api/replayConfigs.js', () => ({
  listReplayConfigs: vi.fn(),
  createReplayConfig: vi.fn(),
  updateReplayConfig: vi.fn(),
  deleteReplayConfig: vi.fn(),
  batchCreateReplayConfigs: vi.fn(),
  batchDeleteReplayConfigs: vi.fn(),
  batchReviewReplayConfigs: vi.fn(),
  listReplayConfigOperations: vi.fn(),
  reviewReplayConfig: vi.fn(),
  listReplayConfigDomains: vi.fn(),
  exportReviewedReplayConfigs: vi.fn(),
  importReplayConfigReasons: vi.fn(),
  importReplayConfigChineseNames: vi.fn(),
  createMessageSequenceIgnores: vi.fn(),
  createOneSideErrorCodeIgnores: vi.fn(),
  updateOneSideErrorCodeIgnore: vi.fn(),
  reviewOneSideErrorCodeIgnore: vi.fn(),
  batchReviewOneSideErrorCodeIgnores: vi.fn(),
  deleteOneSideErrorCodeIgnore: vi.fn(),
  batchDeleteOneSideErrorCodeIgnores: vi.fn(),
  updateMessageSequenceIgnore: vi.fn(),
  reviewMessageSequenceIgnore: vi.fn(),
  batchReviewMessageSequenceIgnores: vi.fn(),
  deleteMessageSequenceIgnore: vi.fn(),
  batchDeleteMessageSequenceIgnores: vi.fn(),
  exportReviewedMessageSequenceIgnores: vi.fn(),
  exportReviewedOneSideErrorCodeIgnores: vi.fn(),
}))

function arrangeApi() {
  listReplayConfigs.mockResolvedValue({
    total: 2,
    items: [
      { id: 1, tranCode: 'S1&sop', fieldName: 'accountNo', fieldChineseName: '账号', ignoreReason: '完整原因', version: 0 },
      { id: 2, tranCode: 'S2&soap', fieldName: 'status', fieldChineseName: '状态', ignoreReason: '状态原因', version: 1 },
    ],
  })
  createReplayConfig.mockResolvedValue({ id: 3, version: 0 })
  listReplayConfigDomains.mockResolvedValue(['公共', '贷款'])
  listReplayConfigOperations.mockResolvedValue({
    total: 1,
    items: [
      {
        id: 9,
        operationType: 'CREATE',
        operatorUsername: 'zhangs3',
        operatorRealName: '张三',
        operationSource: 'MANUAL',
        createdAt: '2026-09-11T10:20:30',
        changes: [
          { field: 'tran_code', label: '服务码', oldValue: null, newValue: 'S1&sop' },
          { field: 'review_status', label: '审核状态', oldValue: '0', newValue: '1' },
        ],
      },
    ],
  })
}

describe('ReplayConfigPage（忽略清单）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    arrangeApi()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each([
    ['unconditional-ignores', ['服务码', '忽略字段', '忽略原因']],
    ['conditional-ignores', ['服务码', '忽略字段', '字段索引', '忽略原因']],
    ['sort-fields', ['服务码', '对象/数组名称', '排序字段', '排序原因']],
    ['error-code-ignores', ['服务码', '老核心错误码', '新核心错误码', '忽略原因']],
  ])('shows the import format for %s', async (tab, columns) => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()
    await wrapper.get(`[data-testid="tab-${tab}"]`).trigger('click')
    const button = wrapper.get('[data-testid="import-empty-reasons"]')
    expect(button.text()).toBe('忽略原因为空数据导入')
    await button.trigger('click')
    const dialog = wrapper.get('[data-testid="reason-import-dialog"]')
    expect(dialog.text()).toContain('第一行直接填写数据')
    expect(dialog.findAll('li').map(row => row.text())).toEqual(columns)
    wrapper.unmount()
  })

  it('imports missing Chinese names using the current tab match columns', async () => {
    importReplayConfigChineseNames.mockResolvedValue({
      updatedRows: 2, skippedExistingNameRows: 1, unmatchedRows: 0, ambiguousRows: 0,
    })
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()
    await wrapper.get('[data-testid="tab-conditional-ignores"]').trigger('click')
    await wrapper.get('[data-testid="import-empty-chinese-names"]').trigger('click')
    const dialog = wrapper.get('[data-testid="reason-import-dialog"]')
    expect(dialog.text()).toContain('第一行直接填写数据')
    expect(dialog.findAll('li').map(row => row.text()))
      .toEqual(['服务码', '忽略字段', '字段索引', '忽略字段中文名称'])
    const input = dialog.get('input[type="file"]')
    const file = new File(['workbook'], 'names.xlsx')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await dialog.trigger('submit')
    await flushPromises()
    expect(importReplayConfigChineseNames).toHaveBeenCalledWith('conditional-ignores', file)
    expect(importReplayConfigReasons).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="toast"]').text()).toContain('已有中文名称 1 条')
    await wrapper.get('[data-testid="tab-error-code-ignores"]').trigger('click')
    expect(wrapper.find('[data-testid="import-empty-chinese-names"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('imports an Excel file for the selected tab and reports the outcome', async () => {
    importReplayConfigReasons.mockResolvedValue({
      updatedRows: 2, skippedExistingReasonRows: 1, unmatchedRows: 3, ambiguousRows: 1,
    })
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()
    await wrapper.get('[data-testid="tab-error-code-ignores"]').trigger('click')
    await wrapper.get('[data-testid="import-empty-reasons"]').trigger('click')
    const input = wrapper.get('input[type="file"]')
    const file = new File(['workbook'], 'reasons.xlsx')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await wrapper.get('[data-testid="reason-import-dialog"]').trigger('submit')
    await flushPromises()
    expect(importReplayConfigReasons).toHaveBeenCalledWith('error-code-ignores', file)
    expect(wrapper.get('[data-testid="toast"]').text()).toContain('补充 2 条')
    expect(wrapper.find('[data-testid="reason-import-dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('exports the reviewed configs through the toolbar button', async () => {
    exportReviewedReplayConfigs.mockResolvedValue(undefined)
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="export-excel"]').trigger('click')
    await flushPromises()

    expect(exportReviewedReplayConfigs).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="toast"]').text()).toContain('导出成功')
  })

  it('shows an error toast when the export fails', async () => {
    exportReviewedReplayConfigs.mockRejectedValue(new Error('mock 模式不支持导出 Excel'))
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="export-excel"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="toast"]').text()).toContain('导出失败')
  })

  it('shows the sixth one-side error code tab and creates split codes', async () => {
    createReplayConfig.mockResolvedValue([{ id: 11 }, { id: 12 }])
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()
    await wrapper.find('[data-testid="tab-one-side-error-code-ignores"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-serviceCode"]').setValue('S1&sop')
    await wrapper.find('[data-testid="form-category"]').setValue('QUERY')
    await wrapper.find('[data-testid="form-ownership"]').setValue('528')
    await wrapper.find('[data-testid="form-errorCodes"]').setValue('E001,E002')
    await wrapper.find('[data-testid="form-ignoreReason"]').setValue('原因')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()
    expect(createOneSideErrorCodeIgnores).toHaveBeenCalledWith({
      serviceCode: 'S1&sop', category: 'QUERY', ownership: '528', errorCodes: 'E001,E002', ignoreReason: '原因',
    })
  })

  it('does not expose the unconditional reason import entry', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="open-reason-import"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="reason-import-modal"]').exists()).toBe(false)
  })

  it('shows all five reason columns as one-line ellipsis with full hover text', async () => {
    const fullReason = '第一行\n第二行很长的完整原因'
    listReplayConfigs.mockImplementation(async (type) => ({
      total: 1,
      items: [{
        id: 1,
        tranCode: 'S1&sop', origTrcd: 'S1&sop', serviceCode: 'S1&sop',
        fieldName: 'a', fieldRmoveName: 'a', origArryName: 'A', origFieldName: 'B',
        oldRespCode: 'E1', newRespCode: 'N1', messageSequence: 'seq1', category: 'QUERY',
        fieldChineseName: '中文名', ignoreReason: fullReason, version: 0,
      }],
    }))
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    for (const tab of ['unconditional-ignores', 'conditional-ignores', 'error-code-ignores', 'sort-fields', 'message-sequence-ignores']) {
      if (tab !== 'unconditional-ignores') {
        await wrapper.find(`[data-testid="tab-${tab}"]`).trigger('click')
        await flushPromises()
      }
      const reasonCell = wrapper.find('td.replay-cell-ellipsis')
      expect(reasonCell.exists()).toBe(true)
      expect(reasonCell.attributes('title')).toBe(fullReason)
    }
  })

  it('shows 领域 as the first data column and filters by it', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    expect(listReplayConfigDomains).toHaveBeenCalled()
    const headers = wrapper.findAll('thead th').map(cell => cell.text())
    expect(headers[1]).toBe('领域')
    // 种子行没有领域映射时按空值显示
    expect(wrapper.findAll('tbody tr')[0].findAll('td')[1].text()).toBe('-')

    const filter = wrapper.find('[data-testid="filter-domain"]')
    expect(filter.element.tagName).toBe('SELECT')
    expect(filter.findAll('option').map(option => option.text())).toEqual(['全部', '公共', '贷款'])

    await filter.setValue('贷款')
    await wrapper.find('form.replay-filters').trigger('submit')
    await flushPromises()

    expect(listReplayConfigs).toHaveBeenLastCalledWith('unconditional-ignores', {
      limit: 10, offset: 0, domain: '贷款',
    })
  })

  it('explains the reviewer requirement from the bank owner column header', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    const help = wrapper.find('[data-testid="bank-owner-help"]')
    const message = '未找到行方负责人时，该条记录不可审核，请联系敬恒杰维护清单。'
    expect(help.exists()).toBe(true)
    expect(help.attributes('aria-label')).toBe(message)
    expect(help.attributes('data-tooltip')).toBe(message)

    await help.trigger('focus')
    const tooltip = wrapper.find('[data-testid="bank-owner-tooltip"]')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.text()).toBe(message)
  })

  it('loads the first tab with default 10 per page', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    expect(listReplayConfigs).toHaveBeenCalledWith('unconditional-ignores', { limit: 10, offset: 0 })
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('S1&sop')
    // 四个 tab 都在
    expect(wrapper.find('[data-testid="tab-unconditional-ignores"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-conditional-ignores"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-error-code-ignores"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-sort-fields"]').exists()).toBe(true)
  })

  it('combines empty ignore reason with my responsibility and other filters', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="filter-domain"]').setValue('贷款')
    await wrapper.find('[data-testid="filter-reviewable-by-me"]').setValue(true)
    await wrapper.find('[data-testid="filter-reason-empty"]').setValue(true)
    await wrapper.find('form.replay-filters').trigger('submit')
    await flushPromises()

    expect(listReplayConfigs).toHaveBeenLastCalledWith('unconditional-ignores', {
      limit: 10,
      offset: 0,
      domain: '贷款',
      reviewableByMe: 'true',
      reasonEmpty: 'true',
    })
  })

  it('combines an empty field Chinese name with empty reason and developer filters', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    const checkbox = wrapper.get('[data-testid="filter-field-chinese-name-empty"]')
    expect(checkbox.element.checked).toBe(false)
    const callsBeforeSelection = listReplayConfigs.mock.calls.length
    await checkbox.setValue(true)
    await wrapper.get('[data-testid="filter-reason-empty"]').setValue(true)
    await wrapper.get('[data-testid="filter-developed-by-me"]').setValue(true)
    expect(listReplayConfigs).toHaveBeenCalledTimes(callsBeforeSelection)
    await wrapper.get('form.replay-filters').trigger('submit')
    await flushPromises()

    expect(listReplayConfigs).toHaveBeenLastCalledWith('unconditional-ignores', {
      limit: 10,
      offset: 0,
      developedByMe: 'true',
      reasonEmpty: 'true',
      fieldChineseNameEmpty: 'true',
    })

    await wrapper.get('[data-testid="reset"]').trigger('click')
    await flushPromises()
    expect(checkbox.element.checked).toBe(false)
    expect(listReplayConfigs).toHaveBeenLastCalledWith('unconditional-ignores', { limit: 10, offset: 0 })
  })

  it('only shows the empty field Chinese name filter on tabs with that column', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()
    const selector = '[data-testid="filter-field-chinese-name-empty"]'
    await wrapper.get(selector).setValue(true)

    for (const tab of ['conditional-ignores', 'sort-fields']) {
      await wrapper.get(`[data-testid="tab-${tab}"]`).trigger('click')
      await flushPromises()
      expect(wrapper.get(selector).element.checked).toBe(false)
      expect(listReplayConfigs).toHaveBeenLastCalledWith(tab, { limit: 10, offset: 0 })
      await wrapper.get(selector).setValue(true)
      await wrapper.get('form.replay-filters').trigger('submit')
      await flushPromises()
      expect(listReplayConfigs).toHaveBeenLastCalledWith(tab, { limit: 10, offset: 0, fieldChineseNameEmpty: 'true' })
    }

    for (const tab of ['error-code-ignores', 'message-sequence-ignores', 'one-side-error-code-ignores']) {
      await wrapper.get(`[data-testid="tab-${tab}"]`).trigger('click')
      await flushPromises()
      expect(wrapper.find(selector).exists()).toBe(false)
      expect(listReplayConfigs).toHaveBeenLastCalledWith(tab, { limit: 10, offset: 0 })
    }
  })

  it('uses the sorting reason label on the sort field tab', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="filter-reason-empty-label"]').text()).toBe('仅看忽略原因为空')

    await wrapper.find('[data-testid="tab-sort-fields"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="filter-reason-empty-label"]').text()).toBe('仅看排序原因为空')
  })

  it('switches tab and reloads with the new resource type', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="tab-conditional-ignores"]').trigger('click')
    await flushPromises()

    expect(listReplayConfigs).toHaveBeenLastCalledWith('conditional-ignores', { limit: 10, offset: 0 })
    expect(wrapper.text()).toContain('字段索引')
  })

  it('creates rows via the multi-row modal and shows a toast', async () => {
    batchCreateReplayConfigs.mockResolvedValue([{ id: 3 }])
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="create-config"]').trigger('click')
    // 三行独立录入
    expect(wrapper.find('[data-testid="form-0-tranCode"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="form-2-tranCode"]').exists()).toBe(true)

    await wrapper.find('[data-testid="form-0-tranCode"]').setValue('S3&sop')
    await wrapper.find('[data-testid="form-0-fieldName"]').setValue('accountNumber')
    await wrapper.find('[data-testid="form-0-fieldChineseName"]').setValue('账号')
    await wrapper.find('[data-testid="form-0-ignoreReason"]').setValue('测试原因')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(batchCreateReplayConfigs).toHaveBeenCalledWith('unconditional-ignores', [
      { tranCode: 'S3&sop', fieldName: 'accountNumber', fieldChineseName: '账号', ignoreReason: '测试原因' },
    ])
    expect(wrapper.find('[data-testid="toast"]').text()).toContain('新增成功（1 条）')
  })

  it('shows one reviewer mapping warning after creating an unmapped service code', async () => {
    batchCreateReplayConfigs.mockResolvedValue([{
      id: 3,
      tranCode: 'S3&sop',
      canReview: false,
      reviewDisabledReason: '无审核人',
    }])
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-0-tranCode"]').setValue('S3&sop')
    await wrapper.find('[data-testid="form-0-fieldName"]').setValue('accountNumber')
    await wrapper.find('[data-testid="form-0-fieldChineseName"]').setValue('账号')
    await wrapper.find('[data-testid="form-0-ignoreReason"]').setValue('测试原因')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    const warning = wrapper.find('[data-testid="reviewer-mapping-warning"]')
    expect(warning.exists()).toBe(true)
    expect(warning.text()).toContain('新增成功，但暂不可审核')
    expect(warning.text()).toContain('服务码 S3&sop 尚未映射到全量交易人员')
    expect(warning.text()).toContain('请联系敬恒杰维护清单')
  })

  it('groups all unmapped service codes into one warning after batch create', async () => {
    batchCreateReplayConfigs.mockResolvedValue([
      { id: 3, tranCode: 'S3&sop', canReview: false, reviewDisabledReason: '无审核人' },
      { id: 4, tranCode: 'S3&bzjson', canReview: false, reviewDisabledReason: '无审核人' },
    ])
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-0-tranCode"]').setValue('S3&sop')
    await wrapper.find('[data-testid="form-0-fieldName"]').setValue('a1')
    await wrapper.find('[data-testid="form-0-fieldChineseName"]').setValue('字段一')
    await wrapper.find('[data-testid="form-0-ignoreReason"]').setValue('原因一')
    await wrapper.find('[data-testid="form-1-tranCode"]').setValue('S3&bzjson')
    await wrapper.find('[data-testid="form-1-fieldName"]').setValue('a2')
    await wrapper.find('[data-testid="form-1-fieldChineseName"]').setValue('字段二')
    await wrapper.find('[data-testid="form-1-ignoreReason"]').setValue('原因二')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    const warnings = wrapper.findAll('[data-testid="reviewer-mapping-warning"]')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].text()).toContain('S3&sop')
    expect(warnings[0].text()).toContain('S3&bzjson')
    expect(warnings[0].text()).toContain('请联系敬恒杰维护清单')
  })

  it('batch creates only the rows that were filled', async () => {
    batchCreateReplayConfigs.mockResolvedValue([{ id: 3 }, { id: 4 }])
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-0-tranCode"]').setValue('S3&sop')
    await wrapper.find('[data-testid="form-0-fieldName"]').setValue('a1')
    await wrapper.find('[data-testid="form-0-fieldChineseName"]').setValue('字段一')
    await wrapper.find('[data-testid="form-0-ignoreReason"]').setValue('原因一')
    await wrapper.find('[data-testid="form-2-tranCode"]').setValue('S3&bzjson')
    await wrapper.find('[data-testid="form-2-fieldName"]').setValue('a2')
    await wrapper.find('[data-testid="form-2-fieldChineseName"]').setValue('字段二')
    await wrapper.find('[data-testid="form-2-ignoreReason"]').setValue('原因二')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(batchCreateReplayConfigs).toHaveBeenCalledWith('unconditional-ignores', [
      { tranCode: 'S3&sop', fieldName: 'a1', fieldChineseName: '字段一', ignoreReason: '原因一' },
      { tranCode: 'S3&bzjson', fieldName: 'a2', fieldChineseName: '字段二', ignoreReason: '原因二' },
    ])
  })

  it('skips conditional rows that only carry the default field flag', async () => {
    batchCreateReplayConfigs.mockResolvedValue([{ id: 3 }])
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="tab-conditional-ignores"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="create-config"]').trigger('click')

    await wrapper.find('[data-testid="form-0-origTrcd"]').setValue('S3&sop')
    await wrapper.find('[data-testid="form-0-fieldRmoveName"]').setValue('a.b')
    await wrapper.find('[data-testid="form-0-fieldChineseName"]').setValue('账号')
    await wrapper.find('[data-testid="form-0-ignoreReason"]').setValue('条件原因')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(batchCreateReplayConfigs).toHaveBeenCalledWith('conditional-ignores', [
      {
        origTrcd: 'S3&sop',
        fieldRmoveName: 'a.b',
        fieldChineseName: '账号',
        fieldFileFlag: 1,
        origFieldCond: '',
        destFieldCond: '',
        ignoreReason: '条件原因',
      },
    ])
  })

  it('renders the ignore reason as a resizable textarea with a 512 limit', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="create-config"]').trigger('click')
    const createField = wrapper.find('[data-testid="form-0-ignoreReason"]')
    expect(createField.element.tagName).toBe('TEXTAREA')
    expect(createField.attributes('maxlength')).toBe('512')
    expect(wrapper.find('[data-testid="form-0-fieldChineseName"]').attributes('maxlength')).toBe('256')

    await wrapper.find('[data-testid="close-edit"]').trigger('click')
    await wrapper.find('[data-testid="edit-1"]').trigger('click')
    const editField = wrapper.find('[data-testid="form-ignoreReason"]')
    expect(editField.element.tagName).toBe('TEXTAREA')
    expect(wrapper.find('[data-testid="form-fieldChineseName"]').element.value).toBe('账号')
  })

  it('requires a chinese name and sends it on update', async () => {
    updateReplayConfig.mockResolvedValue({ id: 1, version: 1 })
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="edit-1"]').trigger('click')
    await wrapper.find('[data-testid="form-fieldChineseName"]').setValue('')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    expect(wrapper.find('[data-testid="form-error"]').text()).toContain('忽略字段中文名称不能为空')

    await wrapper.find('[data-testid="form-fieldChineseName"]').setValue('客户账号')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()
    expect(updateReplayConfig).toHaveBeenCalledWith('unconditional-ignores', 1, {
      tranCode: 'S1&sop', fieldName: 'accountNo', fieldChineseName: '客户账号',
      ignoreReason: '完整原因', version: 0,
    })
  })

  it('rejects invalid service code before calling API', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-0-tranCode"]').setValue('bad-code')
    await wrapper.find('[data-testid="form-0-fieldName"]').setValue('accountNo')
    await wrapper.find('[data-testid="form-0-fieldChineseName"]').setValue('账号')
    await wrapper.find('[data-testid="form-0-ignoreReason"]').setValue('原因')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(batchCreateReplayConfigs).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="form-error"]').text()).toContain('格式不正确')
  })

  it('warns when a row has fields but no service code', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-0-fieldName"]').setValue('accountNo')
    await wrapper.find('[data-testid="form-0-fieldChineseName"]').setValue('账号')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(batchCreateReplayConfigs).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="form-error"]').text()).toContain('请先填写服务码')
  })

  it('requires the ignore reason for every submitted row', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-0-tranCode"]').setValue('S3&sop')
    await wrapper.find('[data-testid="form-0-fieldName"]').setValue('accountNo')
    await wrapper.find('[data-testid="form-0-fieldChineseName"]').setValue('账号')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(batchCreateReplayConfigs).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="form-error"]').text()).toContain('忽略原因不能为空')
  })

  it('requires the chinese name for every submitted field row', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-0-tranCode"]').setValue('S3&sop')
    await wrapper.find('[data-testid="form-0-fieldName"]').setValue('accountNo')
    await wrapper.find('[data-testid="form-0-ignoreReason"]').setValue('原因')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(batchCreateReplayConfigs).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="form-error"]').text()).toContain('忽略字段中文名称不能为空')
  })

  it('creates sort fields from the triple form and reports three rows', async () => {
    createReplayConfig.mockResolvedValue([{ id: 11 }, { id: 12 }, { id: 13 }])
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="tab-sort-fields"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-tranCode"]').setValue('6208')
    await wrapper.find('[data-testid="form-oldSortField"]').setValue('accounts.accountNo')
    await wrapper.find('[data-testid="form-oldSortFieldChineseName"]').setValue('老核心账号')
    await wrapper.find('[data-testid="form-newSortField"]').setValue('loans(loanNo,loanType)')
    await wrapper.find('[data-testid="form-newSortFieldChineseName"]').setValue('新核心贷款属性')
    await wrapper.find('[data-testid="form-ignoreReason"]').setValue('排序忽略原因')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(createReplayConfig).toHaveBeenCalledWith('sort-fields', {
      tranCode: '6208',
      oldSortField: 'accounts.accountNo',
      oldSortFieldChineseName: '老核心账号',
      newSortField: 'loans(loanNo,loanType)',
      newSortFieldChineseName: '新核心贷款属性',
      ignoreReason: '排序忽略原因',
    })
    expect(wrapper.find('[data-testid="toast"]').text()).toContain('新增成功（3 条）')
  })

  it('uses sorting-specific labels and explains single versus multiple sort properties', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="tab-sort-fields"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="create-config"]').trigger('click')

    expect(wrapper.find('[data-testid="form-oldSortField"]').attributes('placeholder'))
      .toBe('单个属性：A.B；多个属性：A(B,C)')
    expect(wrapper.find('[data-testid="form-newSortField"]').attributes('placeholder'))
      .toBe('单个属性：A.B；多个属性：A(B,C)')
    expect(wrapper.find('[data-testid="form-ignoreReason"]').element.parentElement.textContent)
      .toContain('排序原因')
    expect(wrapper.find('[data-testid="form-ignoreReason"]').element.parentElement.textContent)
      .not.toContain('忽略原因')
    expect(wrapper.find('.replay-hint').text()).toContain('按 A 对象的单个属性 B 排序时填写 A.B')
    expect(wrapper.find('.replay-hint').text()).toContain('按 A 对象的多个属性 B、C 排序时填写 A(B,C)')
  })

  it('rejects a malformed sort field before calling API', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="tab-sort-fields"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-tranCode"]').setValue('6208')
    await wrapper.find('[data-testid="form-oldSortField"]').setValue('accounts')
    await wrapper.find('[data-testid="form-oldSortFieldChineseName"]').setValue('老核心字段')
    await wrapper.find('[data-testid="form-newSortField"]').setValue('loans.loanNo')
    await wrapper.find('[data-testid="form-newSortFieldChineseName"]').setValue('新核心字段')
    await wrapper.find('[data-testid="form-ignoreReason"]').setValue('测试原因')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(createReplayConfig).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="form-error"]').text()).toContain('格式不正确')
  })

  it('reviews a row when permission allows', async () => {
    listReplayConfigs.mockResolvedValue({
      total: 1,
      items: [{
        id: 1, tranCode: 'S1&sop', fieldName: 'accountNo', version: 0, reviewStatus: 0,
        oldTransactionCode: 'Y444', developer: '张三', bankOwner: '李四',
        canReview: true, reviewDisabledReason: null,
      }],
    })
    reviewReplayConfig.mockResolvedValue({ id: 1, reviewStatus: 1 })
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    const button = wrapper.find('[data-testid="review-1"]')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    const modal = wrapper.find('[data-testid="confirm-modal"]')
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain('服务码')
    expect(modal.text()).toContain('S1&sop')
    expect(modal.text()).toContain('accountNo')
    expect(reviewReplayConfig).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="confirm-ok"]').trigger('click')
    await flushPromises()

    expect(reviewReplayConfig).toHaveBeenCalledWith('unconditional-ignores', 1, 0)
    expect(wrapper.find('[data-testid="toast"]').text()).toContain('审核通过')
    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(false)
  })

  it('cancels the review confirmation without calling API', async () => {
    listReplayConfigs.mockResolvedValue({
      total: 1,
      items: [{
        id: 1, tranCode: 'S1&sop', fieldName: 'accountNo', version: 0, reviewStatus: 0,
        canReview: true, reviewDisabledReason: null,
      }],
    })
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="review-1"]').trigger('click')
    await wrapper.find('[data-testid="confirm-cancel"]').trigger('click')
    await flushPromises()

    expect(reviewReplayConfig).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(false)
  })

  it('deletes a row through the centered confirm modal', async () => {
    deleteReplayConfig.mockResolvedValue(undefined)
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="delete-1"]').trigger('click')
    const modal = wrapper.find('[data-testid="confirm-modal"]')
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain('此操作不可恢复')
    expect(modal.text()).toContain('S1&sop')
    expect(deleteReplayConfig).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="confirm-ok"]').trigger('click')
    await flushPromises()

    expect(deleteReplayConfig).toHaveBeenCalledWith('unconditional-ignores', 1, 0)
    expect(wrapper.find('[data-testid="toast"]').text()).toContain('删除成功')
    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(false)
  })

  it('batch deletes through the centered confirm modal', async () => {
    batchDeleteReplayConfigs.mockResolvedValue({ deletedCount: 2 })
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="select-1"]').setValue(true)
    await wrapper.find('[data-testid="select-2"]').setValue(true)
    await wrapper.find('[data-testid="batch-delete"]').trigger('click')

    const modal = wrapper.find('[data-testid="confirm-modal"]')
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain('已选')
    expect(modal.text()).toContain('2 条')
    expect(batchDeleteReplayConfigs).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="confirm-ok"]').trigger('click')
    await flushPromises()

    expect(batchDeleteReplayConfigs).toHaveBeenCalledWith('unconditional-ignores', [
      { id: 1, version: 0 },
      { id: 2, version: 1 },
    ])
    expect(wrapper.find('[data-testid="toast"]').text()).toContain('删除成功：2 条')
  })

  it('cancels the delete confirmation without calling API', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="delete-1"]').trigger('click')
    await wrapper.find('[data-testid="confirm-cancel"]').trigger('click')
    await flushPromises()

    expect(deleteReplayConfig).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(false)
  })

  it('disables review button without permission', async () => {
    listReplayConfigs.mockResolvedValue({
      total: 1,
      items: [{
        id: 1, tranCode: 'S1&sop', fieldName: 'accountNo', version: 0, reviewStatus: 0,
        canReview: false, reviewDisabledReason: '没有权限，请联系李四进行审核',
      }],
    })
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    const button = wrapper.find('[data-testid="review-1"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('title')).toBe('没有权限，请联系李四进行审核')
  })

  it('explains the missing reviewer mapping on a disabled review button', async () => {
    listReplayConfigs.mockResolvedValue({
      total: 1,
      items: [{
        id: 1, tranCode: 'S3&sop', fieldName: 'accountNo', version: 0, reviewStatus: 0,
        canReview: false, reviewDisabledReason: '无审核人',
      }],
    })
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    const button = wrapper.find('[data-testid="review-1"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('title')).toContain('服务码 S3&sop 尚未映射到全量交易人员，请联系敬恒杰维护清单')
  })

  it('sends the reviewStatus filter to the list API', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="filter-reviewStatus"]').setValue('1')
    await wrapper.find('form.replay-filters').trigger('submit')
    await flushPromises()

    expect(listReplayConfigs).toHaveBeenLastCalledWith('unconditional-ignores', {
      limit: 10, offset: 0, reviewStatus: '1',
    })
  })

  it('sends reviewableByMe when 仅我可以审核 is checked', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="filter-reviewable-by-me-label"]').text()).toBe('仅我可以审核')
    await wrapper.find('[data-testid="filter-reviewable-by-me"]').setValue(true)
    await wrapper.find('form.replay-filters').trigger('submit')
    await flushPromises()

    expect(listReplayConfigs).toHaveBeenLastCalledWith('unconditional-ignores', {
      limit: 10, offset: 0, reviewableByMe: 'true',
    })
  })

  it('sends developedByMe together with empty reason when 仅看我开发的 is checked', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="filter-developed-by-me"]').setValue(true)
    await wrapper.find('[data-testid="filter-reason-empty"]').setValue(true)
    await wrapper.find('form.replay-filters').trigger('submit')
    await flushPromises()

    expect(listReplayConfigs).toHaveBeenLastCalledWith('unconditional-ignores', {
      limit: 10,
      offset: 0,
      developedByMe: 'true',
      reasonEmpty: 'true',
    })
  })

  it('batch reviews selected rows and reports approved/skipped', async () => {
    listReplayConfigs.mockResolvedValue({
      total: 2,
      items: [
        { id: 1, tranCode: 'S1&sop', fieldName: 'a', version: 0, reviewStatus: 0, canReview: true },
        {
          id: 2, tranCode: 'S2&soap', fieldName: 'b', version: 0, reviewStatus: 0,
          canReview: false, reviewDisabledReason: '没有权限，请联系李四进行审核',
        },
      ],
    })
    batchReviewReplayConfigs.mockResolvedValue({ approvedCount: 1, skippedCount: 1 })
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="select-1"]').setValue(true)
    await wrapper.find('[data-testid="select-2"]').setValue(true)
    await wrapper.find('[data-testid="batch-review"]').trigger('click')

    const modal = wrapper.find('[data-testid="confirm-modal"]')
    expect(modal.text()).toContain('可审核')
    await wrapper.find('[data-testid="confirm-ok"]').trigger('click')
    await flushPromises()

    expect(batchReviewReplayConfigs).toHaveBeenCalledWith('unconditional-ignores', [
      { id: 1, version: 0 },
      { id: 2, version: 0 },
    ])
    expect(wrapper.find('[data-testid="toast"]').text()).toContain('审核通过 1 条，跳过 1 条')
  })

  it('only closes the create/edit modal via buttons, not the mask', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('.replay-modal-mask').trigger('click')
    await flushPromises()
    expect(wrapper.find('.replay-edit-modal').exists()).toBe(true)

    await wrapper.find('[data-testid="close-edit"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('.replay-edit-modal').exists()).toBe(false)

    await wrapper.find('[data-testid="edit-1"]').trigger('click')
    await wrapper.find('.replay-modal-mask').trigger('click')
    await flushPromises()
    expect(wrapper.find('.replay-edit-modal').exists()).toBe(true)

    await wrapper.findAll('button').find((b) => b.text() === '取消').trigger('click')
    await flushPromises()
    expect(wrapper.find('.replay-edit-modal').exists()).toBe(false)
  })

  it('opens history drawer and renders changes', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="history-1"]').trigger('click')
    await flushPromises()

    expect(listReplayConfigOperations).toHaveBeenCalledWith('unconditional-ignores', 1, { limit: 100, offset: 0 })
    const drawer = wrapper.find('[data-testid="history-drawer"]')
    expect(drawer.text()).toContain('张三')
    expect(drawer.text()).toContain('服务码')
    expect(drawer.text()).toContain('未审核')
    expect(drawer.text()).toContain('已审核')
  })

  it('distinguishes Excel imports from manual edits in operation history', async () => {
    const update = {
      operationType: 'UPDATE',
      operatorUsername: 'zhangs3',
      operatorRealName: '张三',
      createdAt: '2026-09-11T10:20:30',
      changes: [{ field: 'ignore_reason', label: '忽略原因', oldValue: null, newValue: '补充原因' }],
    }
    listReplayConfigOperations.mockResolvedValueOnce({
      total: 2,
      items: [
        { ...update, id: 2, operationSource: 'EXCEL' },
        { ...update, id: 1, operationSource: 'MANUAL' },
      ],
    })
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()
    await wrapper.get('[data-testid="history-1"]').trigger('click')
    await flushPromises()

    const drawer = wrapper.get('[data-testid="history-drawer"]')
    expect(drawer.findAll('.replay-history-type').map(label => label.text())).toEqual(['导入', '修改'])
    wrapper.unmount()
  })

  it('creates message sequence ignores from the fifth tab', async () => {
    createMessageSequenceIgnores.mockResolvedValue([])
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()
    const tab = wrapper.find('[data-testid="tab-message-sequence-ignores"]')
    expect(tab.text()).toBe('流水号忽略')
    await tab.trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-serviceCode"]').setValue('S1&sop')
    await wrapper.find('[data-testid="form-category"]').setValue('QUERY')
    await wrapper.find('[data-testid="form-messageSequences"]').setValue('seq1,seq2')
    await wrapper.find('[data-testid="form-ignoreReason"]').setValue('多行\n原因')
    await wrapper.find('[data-testid="submit-config"]').trigger('submit')
    await flushPromises()
    expect(createMessageSequenceIgnores).toHaveBeenCalledWith({
      serviceCode: 'S1&sop', category: 'QUERY', messageSequences: 'seq1,seq2', ignoreReason: '多行\n原因',
    })
  })

  it('rejects more than 100 message sequences before sending', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()
    await wrapper.find('[data-testid="tab-message-sequence-ignores"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-serviceCode"]').setValue('S1&sop')
    await wrapper.find('[data-testid="form-messageSequences"]').setValue(Array.from({ length: 101 }, (_, i) => `s${i}`).join(','))
    await wrapper.find('[data-testid="form-ignoreReason"]').setValue('原因')
    await wrapper.find('[data-testid="submit-config"]').trigger('submit')
    expect(wrapper.find('[data-testid="form-error"]').text()).toContain('最多新增 100 个')
    expect(createMessageSequenceIgnores).not.toHaveBeenCalled()
  })

  it('combines message sequence filters and uses the txt export', async () => {
    exportReviewedMessageSequenceIgnores.mockResolvedValue(undefined)
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()
    await wrapper.find('[data-testid="tab-message-sequence-ignores"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="filter-category"]').setValue('ACCOUNTING')
    await wrapper.find('[data-testid="filter-messageSequence"]').setValue('seq')
    await wrapper.find('[data-testid="filter-reviewable-by-me"]').setValue(true)
    await wrapper.find('[data-testid="filter-developed-by-me"]').setValue(true)
    await wrapper.find('[data-testid="filter-reason-empty"]').setValue(true)
    await wrapper.find('form.replay-filters').trigger('submit')
    await flushPromises()
    expect(listReplayConfigs).toHaveBeenLastCalledWith('message-sequence-ignores', {
      limit: 10, offset: 0, category: 'ACCOUNTING', messageSequence: 'seq',
      reviewableByMe: 'true', developedByMe: 'true', reasonEmpty: 'true',
    })
    await wrapper.find('[data-testid="export-message-sequences"]').trigger('click')
    await flushPromises()
    expect(exportReviewedMessageSequenceIgnores).toHaveBeenCalledTimes(1)
    expect(exportReviewedReplayConfigs).not.toHaveBeenCalled()
  })
})
