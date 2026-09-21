import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/replayDatabaseComparison.js', () => ({
  createRegistration: vi.fn(),
  deleteRegistration: vi.fn(),
  generateVersion: vi.fn(),
  loadAuditDetails: vi.fn(),
  loadBaseColumns: vi.fn(),
  loadHeaderFilterOptions: vi.fn(),
  loadOptions: vi.fn(),
  loadLatestVersion: vi.fn(),
  loadVersions: vi.fn(),
  loadVersionHeaderFilterOptions: vi.fn(),
  importInitialExcel: vi.fn(),
  loadRegistration: vi.fn(),
  loadRegistrationAudits: vi.fn(),
  reregisterRegistration: vi.fn(),
  searchAudits: vi.fn(),
  searchGroupedAudits: vi.fn(),
  searchBaseTables: vi.fn(),
  searchRegistrations: vi.fn(),
  searchVersionSnapshot: vi.fn(),
  synchronizePrimaryKeys: vi.fn(),
  updateRegistration: vi.fn(),
  updateRegistrationPartitioning: vi.fn(),
}))

vi.mock('./initialImportErrorWorkbook.js', () => ({
  exportInitialImportErrors: vi.fn(),
}))

import * as comparisonApi from '../../api/replayDatabaseComparison.js'
import { exportInitialImportErrors } from './initialImportErrorWorkbook.js'
import ReplayDatabaseComparisonPage from './ReplayDatabaseComparisonPage.vue'
import ReplayDatabaseComparisonEditor from './ReplayDatabaseComparisonEditor.vue'

describe('ReplayDatabaseComparisonPage', () => {
  it('does not show configured-scope badges in the table-name column', () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)

    expect(wrapper.get('[data-testid="table-name-kdpa_cb_acct_fzn_cntl_inf"]').text())
      .not.toContain('已配置条件')
    expect(wrapper.get('[data-testid="table-name-klna_ln_acct_base_info"]').text())
      .not.toContain('限1000条')
  })

  it('shows, copies, and filters by the complete comparison scope', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(ReplayDatabaseComparisonPage)

    expect(wrapper.get('[data-testid="query-condition-kdpa_cb_acct_fzn_cntl_inf"]').text())
      .toContain("where status_cd = '1'")
    expect(wrapper.get('[data-testid="query-condition-klna_ln_acct_base_info"]').text())
      .toContain('order by loan_acct_no')
    expect(wrapper.get('[data-testid="query-condition-klna_ln_acct_base_info"]').text())
      .toContain('limit 1000')

    await wrapper.get('[data-testid="expand-query-condition-klna_ln_acct_base_info"]').trigger('click')
    await wrapper.get('[data-testid="copy-query-condition-klna_ln_acct_base_info"]').trigger('click')
    expect(writeText).toHaveBeenCalledWith('order by loan_acct_no\nlimit 1000')

    await wrapper.get('[data-filter-key="queryCondition"]').trigger('click')
    const optionText = wrapper.findAll('[data-testid="header-filter-option"]')
      .map(option => option.text()).join('\n')
    expect(optionText).toContain('order by loan_acct_no')
    expect(optionText).toContain('limit 1000')
    wrapper.unmount()
  })

  const useRealMode = (items = [], totals = {}) => {
    vi.stubEnv('VITE_REPLAY_DB_COMPARE_MOCK', 'false')
    comparisonApi.synchronizePrimaryKeys.mockResolvedValue({})
    comparisonApi.loadOptions.mockResolvedValue({ domains: ['存款组'], canImport: false })
    comparisonApi.searchRegistrations.mockResolvedValue({
      items,
      page: 0,
      size: 50,
      total: items.length,
      globalTableCount: totals.globalTableCount ?? items.length,
      globalFieldCount: totals.globalFieldCount ?? items.reduce((count, item) => count + Number(item.fieldCount || 0), 0),
    })
  }

  beforeEach(() => {
    vi.stubEnv('VITE_REPLAY_DB_COMPARE_MOCK', 'true')
    Object.values(comparisonApi).forEach(value => value?.mockReset?.())
    exportInitialImportErrors.mockReset()
    exportInitialImportErrors.mockResolvedValue(undefined)
    comparisonApi.loadLatestVersion.mockResolvedValue(null)
  })

  const partitionRow = { id: 3, tableName: 'acct', tableComment: '账户表', version: 7,
    domainName: '存款组', partitionNum: 16, fieldPreview: ['id(编号)'], fieldCount: 1 }
  const openPartitioning = async (row = partitionRow) => {
    useRealMode([row])
    comparisonApi.loadOptions.mockResolvedValue({ canConfigurePartitions: true })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    await wrapper.get('[data-testid="configure-partitions-acct"]').trigger('click')
    return wrapper
  }

  it.each([undefined, false, 'true', 1])('hides all partition controls without explicit permission (%s)', async permission => {
    useRealMode([partitionRow])
    comparisonApi.loadOptions.mockResolvedValue({ canConfigurePartitions: permission })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    expect(wrapper.find('[data-testid="configure-partitions-acct"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('读取配置')
    expect(wrapper.find('[data-testid="partition-dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each([16, undefined])('opens a single count input using the current value or legacy default (%s)', async partitionNum => {
    const wrapper = await openPartitioning({ ...partitionRow, partitionNum })
    const dialog = wrapper.get('[data-testid="partition-dialog"]')
    expect(dialog.text()).toContain('acct')
    expect(dialog.findAll('input')).toHaveLength(1)
    expect(dialog.findAll('select')).toHaveLength(0)
    expect(dialog.get('input').element.value).toBe(String(partitionNum ?? 1))
    expect(dialog.text()).not.toContain('分区字段')
    expect(dialog.text()).not.toContain('分区策略')
    wrapper.unmount()
  })

  it.each(['', '0', '-1', '257', '1.5'])('rejects invalid partition count %s without submitting', async value => {
    const wrapper = await openPartitioning()
    await wrapper.get('[data-testid="partition-count"]').setValue(value)
    await wrapper.get('[data-testid="save-partitioning"]').trigger('click')
    expect(comparisonApi.updateRegistrationPartitioning).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="partition-error"]').text()).toContain('1 至 256')
    expect(wrapper.find('[data-testid="partition-dialog"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it.each([1, 256])('saves a bounded count %s with the row version then refreshes the list', async count => {
    const wrapper = await openPartitioning()
    comparisonApi.updateRegistrationPartitioning.mockResolvedValue({ ...partitionRow, partitionNum: count, version: 8 })
    comparisonApi.searchRegistrations.mockResolvedValue({ items: [{ ...partitionRow, partitionNum: count, version: 8 }], total: 1 })
    await wrapper.get('[data-testid="partition-count"]').setValue(String(count))
    await wrapper.get('[data-testid="save-partitioning"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.updateRegistrationPartitioning).toHaveBeenCalledWith(3, { version: 7, partitionNum: count })
    expect(comparisonApi.searchRegistrations).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="partition-dialog"]').exists()).toBe(false)
    await wrapper.get('[data-testid="configure-partitions-acct"]').trigger('click')
    expect(wrapper.get('[data-testid="partition-count"]').element.value).toBe(String(count))
    wrapper.unmount()
  })

  it('prevents repeated saves and closing while the request is pending', async () => {
    const wrapper = await openPartitioning()
    let finish
    comparisonApi.updateRegistrationPartitioning.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await wrapper.get('[data-testid="save-partitioning"]').trigger('click')
    expect(wrapper.get('[data-testid="save-partitioning"]').element.disabled).toBe(true)
    expect(wrapper.get('[data-testid="cancel-partitioning"]').element.disabled).toBe(true)
    await wrapper.get('[data-testid="save-partitioning"]').trigger('click')
    expect(comparisonApi.updateRegistrationPartitioning).toHaveBeenCalledTimes(1)
    finish({ ...partitionRow, version: 8 })
    await flushPromises()
    wrapper.unmount()
  })

  it.each([
    { status: 409, code: 'VERSION_CONFLICT', message: '版本冲突', hint: '重新加载' },
    { status: 403, code: 403, message: '无权限修改读取配置', hint: '无权限' },
    { status: 500, code: 500, message: '服务暂不可用', hint: '服务暂不可用' },
  ])('preserves input and reports a failed save ($status)', async failure => {
    const wrapper = await openPartitioning()
    comparisonApi.updateRegistrationPartitioning.mockRejectedValue(Object.assign(new Error(failure.message), failure))
    await wrapper.get('[data-testid="partition-count"]').setValue('32')
    await wrapper.get('[data-testid="save-partitioning"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="partition-count"]').element.value).toBe('32')
    expect(wrapper.get('[data-testid="partition-error"]').text()).toContain(failure.hint)
    expect(wrapper.get('[data-testid="save-partitioning"]').element.disabled).toBe(false)
    expect(comparisonApi.searchRegistrations).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('retries only the list refresh after a successful save when reloading fails', async () => {
    const wrapper = await openPartitioning()
    comparisonApi.updateRegistrationPartitioning.mockResolvedValue({ ...partitionRow, version: 8 })
    comparisonApi.searchRegistrations.mockRejectedValueOnce(new Error('网络异常'))
    await wrapper.get('[data-testid="save-partitioning"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="partition-error"]').text()).toContain('已保存')
    await wrapper.get('[data-testid="save-partitioning"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.updateRegistrationPartitioning).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="partition-dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps edited fields and shows a save failure instead of throwing the event handler error', async () => {
    const row = {
      id: 3, tableName: 'kapb_busi_log', tableComment: '业务日志', domainName: '平台组',
      groupOwnerEmpNo: '101', groupOwnerName: '负责人', version: 1, partitionNum: 32,
      fields: [{ columnName: 'id', columnComment: '编号', primaryKey: true, comparisonOrder: 1 }],
    }
    useRealMode([row])
    comparisonApi.loadRegistration.mockResolvedValue(row)
    comparisonApi.loadBaseColumns.mockResolvedValue([
      { columnName: 'id', columnComment: '编号', primaryKey: true, ordinalPosition: 1 },
    ])
    comparisonApi.updateRegistration.mockRejectedValue(Object.assign(new Error('用户未登录'), { code: 401 }))
    const errorHandler = vi.fn()
    const wrapper = mount(ReplayDatabaseComparisonPage, { global: { config: { errorHandler } } })
    await flushPromises()
    await wrapper.get('[data-testid="edit-registration-kapb_busi_log"]').trigger('click')
    await flushPromises()
    const editor = wrapper.findComponent(ReplayDatabaseComparisonEditor)
    editor.vm.$emit('save', { mode: 'edit', id: 3, version: 1, tableName: 'kapb_busi_log',
      fieldNames: ['id'], domain: '平台组', groupOwnerEmpNo: '101' })
    await flushPromises()
    expect(wrapper.findComponent(ReplayDatabaseComparisonEditor).exists()).toBe(true)
    expect(editor.get('[data-testid="registration-save-error"]').text()).toContain('用户未登录')
    expect(editor.findAll('[data-testid="selected-field-row"]')).toHaveLength(1)
    expect(editor.text()).not.toContain('读取分区数')
    expect(comparisonApi.updateRegistration.mock.calls[0][1]).not.toHaveProperty('partitionNum')
    expect(errorHandler).not.toHaveBeenCalled()
    comparisonApi.updateRegistration.mockResolvedValue(row)
    editor.vm.$emit('save', { mode: 'edit', id: 3, version: 1, tableName: 'kapb_busi_log',
      fieldNames: ['id'], domain: '平台组', groupOwnerEmpNo: '101' })
    await flushPromises()
    expect(wrapper.findComponent(ReplayDatabaseComparisonEditor).exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps scope state and maps complete 422 scope errors inside the editor', async () => {
    const row = {
      id: 3, tableName: 'kapb_busi_log', tableComment: '业务日志', domainName: '平台组',
      groupOwnerEmpNo: '101', groupOwnerName: '负责人', version: 1,
      whereCondition: { connector: 'AND', groups: [{ connector: 'AND', conditions: [
        { columnName: 'status', operator: 'EQ', values: ['1'] },
      ] }] },
      compareLimit: 1000,
      fields: [{ columnName: 'id', columnComment: '编号', primaryKey: true, comparisonOrder: 1 }],
    }
    useRealMode([row])
    comparisonApi.loadRegistration.mockResolvedValue(row)
    comparisonApi.loadBaseColumns.mockResolvedValue([
      { columnName: 'id', columnComment: '编号', dataType: 'bigint', primaryKey: true, primaryKeyOrder: 1, ordinalPosition: 1 },
      { columnName: 'status', columnComment: '状态', dataType: 'varchar', primaryKey: false, ordinalPosition: 2 },
    ])
    comparisonApi.updateRegistration.mockRejectedValue(Object.assign(new Error('比对范围配置存在问题'), {
      code: 'COMPARISON_SCOPE_INVALID',
      data: { errors: [
        { path: 'whereCondition.groups[0].conditions[0]', reason: '条件值无效' },
        { path: 'compareLimit', reason: '比对条数无效' },
      ] },
    }))
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-registration-kapb_busi_log"]').trigger('click')
    await flushPromises()
    wrapper.findComponent(ReplayDatabaseComparisonEditor).vm.$emit('save', {
      mode: 'edit', id: 3, version: 1, tableName: 'kapb_busi_log', fieldNames: ['id'],
      domain: '平台组', groupOwnerEmpNo: '101', whereCondition: row.whereCondition, compareLimit: 1000,
    })
    await flushPromises()

    expect(wrapper.findComponent(ReplayDatabaseComparisonEditor).exists()).toBe(true)
    expect(wrapper.get('[data-testid="scope-editor"]').text()).toContain('条件值无效')
    expect(wrapper.get('[data-testid="scope-editor"]').text()).toContain('比对条数无效')
  })

  it('keeps the editor and displays a failed delete without losing the registration', async () => {
    const row = {
      id: 3, tableName: 'kapb_busi_log', tableComment: '业务日志', domainName: '平台组',
      groupOwnerEmpNo: '101', groupOwnerName: '负责人', version: 1,
      fields: [{ columnName: 'id', columnComment: '编号', primaryKey: true, comparisonOrder: 1 }],
    }
    useRealMode([row])
    comparisonApi.loadRegistration.mockResolvedValue(row)
    comparisonApi.loadBaseColumns.mockResolvedValue([
      { columnName: 'id', columnComment: '编号', primaryKey: true, ordinalPosition: 1 },
    ])
    comparisonApi.deleteRegistration.mockRejectedValue(Object.assign(new Error('用户未登录'), { code: 401 }))
    const errorHandler = vi.fn()
    const wrapper = mount(ReplayDatabaseComparisonPage, { global: { config: { errorHandler } } })
    await flushPromises()
    await wrapper.get('[data-testid="edit-registration-kapb_busi_log"]').trigger('click')
    await flushPromises()
    const editor = wrapper.findComponent(ReplayDatabaseComparisonEditor)
    editor.vm.$emit('delete', { mode: 'edit', id: 3, version: 1, tableName: 'kapb_busi_log',
      fieldNames: ['id'], domain: '平台组', groupOwnerEmpNo: '101' })
    await flushPromises()
    expect(wrapper.findComponent(ReplayDatabaseComparisonEditor).exists()).toBe(true)
    expect(editor.get('[data-testid="registration-save-error"]').text()).toContain('用户未登录')
    expect(editor.findAll('[data-testid="selected-field-row"]')).toHaveLength(1)
    expect(errorHandler).not.toHaveBeenCalled()
    comparisonApi.deleteRegistration.mockResolvedValue(row)
    editor.vm.$emit('delete', { mode: 'edit', id: 3, version: 1, tableName: 'kapb_busi_log',
      fieldNames: ['id'], domain: '平台组', groupOwnerEmpNo: '101' })
    await flushPromises()
    expect(wrapper.findComponent(ReplayDatabaseComparisonEditor).exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the latest generated version in the page title', async () => {
    comparisonApi.loadLatestVersion.mockResolvedValue({ versionNo: '20260914-142530' })

    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    expect(wrapper.get('h2').text()).toBe('回放数据库比对字段登记（版本：20260914-142530）')
  })

  it('opens and closes immutable version history without changing the current page', async () => {
    comparisonApi.loadVersions.mockResolvedValue({
      items: [
        { versionNo: '20260914-150101', generatedName: '张三', generatedAt: '2026-09-14T15:01:01', tableCount: 2, fieldCount: 4, latest: true },
        { versionNo: '20260913-120000', generatedName: '李四', generatedAt: '2026-09-13T12:00:00', tableCount: 1, fieldCount: 1, latest: false },
      ],
      page: 0, size: 20, total: 2,
    })
    comparisonApi.searchVersionSnapshot.mockResolvedValue({ items: [], page: 0, size: 50, total: 0 })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    await wrapper.get('[data-testid="next-page"]').trigger('click')
    const currentPageSummary = wrapper.get('[data-testid="page-summary"]').text()

    await wrapper.get('[data-testid="open-version-history"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="version-item-20260913-120000"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="close-version-history"]').trigger('click')

    expect(wrapper.find('[data-testid="version-history-list"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="page-summary"]').text()).toBe(currentPageSummary)
  })

  it('generates a version through a password dialog and refreshes the title', async () => {
    useRealMode()
    comparisonApi.generateVersion.mockResolvedValue({
      versionNo: '20260914-150101', tableCount: 200, fieldCount: 1426,
    })

    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    await wrapper.get('[data-testid="generate-version"]').trigger('click')
    await wrapper.get('[data-testid="generation-token"]').setValue('secret')
    await wrapper.get('[data-testid="confirm-generate-version"]').trigger('click')
    await flushPromises()

    expect(comparisonApi.generateVersion).toHaveBeenCalledWith('secret')
    expect(wrapper.get('h2').text()).toContain('20260914-150101')
    expect(wrapper.text()).toContain('已生成版本，共 200 张表、1426 个字段')
    expect(wrapper.find('[data-testid="generation-dialog"]').exists()).toBe(false)
  })

  it('keeps registration writes available while version generation is pending', async () => {
    useRealMode([{
      id: 7, tableName: 'acct_master', tableComment: '账户主表', domainName: '存款组',
      fieldPreview: ['acct_no(账号)'], reviserName: '张三', groupOwnerName: '赵经理',
      registeredDate: '2026-09-12', version: 1,
    }])
    let finishGeneration
    comparisonApi.generateVersion.mockReturnValue(new Promise(resolve => { finishGeneration = resolve }))
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    await wrapper.get('[data-testid="generate-version"]').trigger('click')
    await wrapper.get('[data-testid="generation-token"]').setValue('secret')
    await wrapper.get('[data-testid="confirm-generate-version"]').trigger('click')

    expect(wrapper.get('[data-testid="add-registration"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="open-initial-import"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid^="edit-registration-"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid^="delete-registration-"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="global-audit-query"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="confirm-generate-version"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[aria-label="关闭生成版本"]').attributes('disabled')).toBeDefined()

    finishGeneration({ versionNo: '20260914-150101', tableCount: 1, fieldCount: 2 })
    await flushPromises()
  })

  it('keeps and displays the complete strict-gate failure list', async () => {
    useRealMode()
    const error = new Error('2 张表未通过版本生成门禁')
    error.code = 'VERSION_GATE_BLOCKED'
    error.data = { errors: [
      { tableName: 'acct_master', tableComment: '账户主表', reviserName: '张三', groupOwnerName: '李经理', status: 'MISSING_FIELDS', missingFieldNames: ['legacy_id'], reason: '比对字段母库中不存在：legacy_id' },
      { tableName: 'removed_table', tableComment: null, reviserName: null, groupOwnerName: null, status: 'TABLE_MISSING', missingFieldNames: [], reason: '母库表已删除' },
    ] }
    comparisonApi.generateVersion.mockRejectedValue(error)

    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    await wrapper.get('[data-testid="generate-version"]').trigger('click')
    await wrapper.get('[data-testid="generation-token"]').setValue('secret')
    await wrapper.get('[data-testid="confirm-generate-version"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="generation-gate-error-row"]')).toHaveLength(2)
    expect(wrapper.get('[data-testid="generation-gate-errors"]').text()).toContain('legacy_id')
    expect(wrapper.get('[data-testid="generation-gate-errors"]').text()).toContain('母库表已删除')
    expect(wrapper.get('[data-testid="generation-dialog"]').exists()).toBe(true)
  })

  it('runs the complete strict gate against local rows in mock mode', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    await wrapper.get('[data-testid="generate-version"]').trigger('click')
    await wrapper.get('[data-testid="generation-token"]').setValue('sunline300348')
    await wrapper.get('[data-testid="confirm-generate-version"]').trigger('click')
    await flushPromises()

    expect(comparisonApi.generateVersion).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="generation-gate-error-row"]')).toHaveLength(5)
    expect(wrapper.get('[data-testid="generation-gate-errors"]').text()).toContain('legacy_deleted_field')
    expect(wrapper.get('[data-testid="generation-gate-errors"]').text()).toContain('母库表已删除')
    expect(wrapper.get('[data-testid="generation-gate-errors"]').text()).toContain('母库校验暂不可用')
    expect(wrapper.get('[data-testid="generation-gate-errors"]').text()).toContain('排序主键已变更')
    expect(wrapper.get('[data-testid="generation-gate-errors"]').text()).toContain('原顺序：loan_acct_no')
    expect(wrapper.get('[data-testid="generation-gate-errors"]').text())
      .toContain('当前顺序：customer_no、loan_acct_no')
    expect(wrapper.get('[data-testid="generation-dialog"]').exists()).toBe(true)
  })

  it('loads the first real list without waiting for primary-key synchronization and refreshes after changes', async () => {
    vi.stubEnv('VITE_REPLAY_DB_COMPARE_MOCK', 'false')
    let finishSynchronization
    comparisonApi.synchronizePrimaryKeys.mockReturnValue(new Promise(resolve => { finishSynchronization = resolve }))
    comparisonApi.loadOptions.mockResolvedValue({ domains: ['存款组'], canImport: false })
    comparisonApi.searchRegistrations.mockResolvedValue({ items: [], page: 0, size: 50, total: 0 })

    mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    expect(comparisonApi.synchronizePrimaryKeys).toHaveBeenCalledOnce()
    expect(comparisonApi.searchRegistrations).toHaveBeenCalledOnce()

    finishSynchronization({ scannedCount: 1, updatedCount: 1, addedFieldCount: 1, conflictCount: 0 })
    await flushPromises()

    expect(comparisonApi.searchRegistrations).toHaveBeenCalledTimes(2)
  })

  it('does not refresh the real list when background primary-key synchronization finds no changes', async () => {
    useRealMode()
    comparisonApi.synchronizePrimaryKeys.mockResolvedValue({
      scannedCount: 166,
      updatedCount: 0,
      addedFieldCount: 0,
      conflictCount: 0,
    })

    mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    expect(comparisonApi.searchRegistrations).toHaveBeenCalledOnce()
  })

  it('still loads the real list when primary-key synchronization is unavailable', async () => {
    vi.stubEnv('VITE_REPLAY_DB_COMPARE_MOCK', 'false')
    comparisonApi.synchronizePrimaryKeys.mockRejectedValue(new Error('BASE unavailable'))
    comparisonApi.loadOptions.mockResolvedValue({ domains: ['存款组'], canImport: false })
    comparisonApi.searchRegistrations.mockResolvedValue({ items: [], page: 0, size: 50, total: 0 })

    mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    expect(comparisonApi.searchRegistrations).toHaveBeenCalledOnce()
  })

  it('loads real server pages and details when mock mode is disabled', async () => {
    vi.stubEnv('VITE_REPLAY_DB_COMPARE_MOCK', 'false')
    comparisonApi.loadOptions.mockResolvedValue({ domains: ['存款组'], canImport: false })
    comparisonApi.searchRegistrations.mockResolvedValue({
      items: [{
        id: 7, tableName: 'acct_master', tableComment: '账户主表', domainName: '存款组',
        fieldCount: 2, fieldPreview: ['acct_no(账号)', 'status_cd(状态)'], reviserEmpNo: '001',
        reviserName: '张三', groupOwnerEmpNo: '101', groupOwnerName: '赵经理',
        registeredDate: '2026-09-12', version: 3,
      }],
      page: 0, size: 50, total: 125, globalTableCount: 166, globalFieldCount: 271,
    })
    comparisonApi.loadRegistration.mockResolvedValue({
      id: 7, tableName: 'acct_master', tableComment: '账户主表', domainName: '存款组',
      reviserEmpNo: '001', reviserName: '张三', groupOwnerEmpNo: '101', groupOwnerName: '赵经理',
      registeredDate: '2026-09-12', version: 3,
      fields: [{ columnName: 'acct_no', columnComment: '账号', primaryKey: true, comparisonOrder: 1, existsInBase: true }],
      metadataValidation: { status: 'VALID', missingFieldNames: [] },
    })
    comparisonApi.loadBaseColumns.mockResolvedValue([{ columnName: 'acct_no', columnComment: '账号' }])

    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    expect(comparisonApi.searchRegistrations).toHaveBeenCalledWith(expect.objectContaining({ page: 0, size: 50 }))
    expect(wrapper.get('[data-testid="page-summary"]').text()).toContain('共 125 条')
    expect(wrapper.text()).toContain('共 166 张表 · 共 271 个比对字段')
    expect(wrapper.text()).not.toContain('当前页 2 个比对字段')
    expect(wrapper.text()).not.toContain('Mock 数据')
    await wrapper.get('[data-testid="view-registration-acct_master"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.loadRegistration).toHaveBeenCalledWith(7)
    expect(comparisonApi.loadBaseColumns).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="registration-detail-dialog"]').text()).toContain('acct_no(账号)')
  })

  it('shows combined table field and reviser labels while submitting stable filter values', async () => {
    useRealMode([{
      id: 7, tableName: 'acct_master', tableComment: '账户主表', domainName: '存款组',
      fieldCount: 1, fieldPreview: ['acct_no(账号)'], reviserEmpNo: '001',
      reviserUsername: 'c-zhangs', reviserName: '张三', groupOwnerEmpNo: '101', groupOwnerName: '赵经理',
      registeredDate: '2026-09-12', version: 3,
    }])
    comparisonApi.loadHeaderFilterOptions.mockImplementation(async ({ targetColumn }) => ({
      options: {
        tableName: [{ value: 'acct_master', label: 'acct_master(账户主表)', count: 1 }],
        fieldName: [{ value: 'acct_no', label: 'acct_no(账号)', count: 1 }],
        reviser: [{ value: '001', label: '张三(c-zhangs)', count: 1 }],
      }[targetColumn] || [],
      matchedRegistrationCount: 1,
    }))

    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="table-name-acct_master"]').text()).toContain('acct_master')
    expect(wrapper.get('[data-testid="table-name-acct_master"]').text()).toContain('账户主表')
    expect(wrapper.get('[data-testid="fields-acct_master"]').text()).toContain('acct_no(账号)')
    expect(wrapper.get('[data-testid="reviser-acct_master"]').text()).toContain('张三(c-zhangs)')

    await wrapper.get('[data-filter-key="tableName"]').trigger('click')
    await flushPromises()
    const tableOption = wrapper.get('[data-testid="header-filter-option"]')
    expect(tableOption.text()).toContain('acct_master(账户主表)')
    await tableOption.get('input').setValue(true)
    await wrapper.get('[data-testid="apply-header-filter"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.searchRegistrations).toHaveBeenLastCalledWith(expect.objectContaining({
      tableNames: ['acct_master'],
    }))

    await wrapper.get('[data-filter-key="fields"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="header-filter-option"]').text()).toContain('acct_no(账号)')
    await wrapper.get('[aria-label="关闭筛选"]').trigger('click')

    await wrapper.get('[data-filter-key="reviser"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="header-filter-option"]').text()).toContain('张三(c-zhangs)')
  })

  it('submits every selected value and searches labels including usernames and empty values', async () => {
    useRealMode()
    const options = {
      tableName: [
        { value: 'acct_master', label: 'acct_master(账户主表)', count: 1 },
        { value: 'loan_master', label: 'loan_master(贷款主表)', count: 1 },
      ],
      fieldName: [
        { value: 'acct_no', label: 'acct_no(账号)', count: 1 },
        { value: 'customer_no', label: 'customer_no(客户号)', count: 1 },
      ],
      whereCondition: [
        { value: '__FULL_TABLE__', label: '全表', count: 1 },
        { value: '{"connector":"AND","groups":[]}', label: "(status_cd = '1')", count: 1 },
      ],
      domainName: [
        { value: '存款组', label: '存款组', count: 1 },
        { value: '贷款组', label: '贷款组', count: 1 },
      ],
      reviser: [
        { value: '001', label: '张三(c-zhangs)', count: 1 },
        { value: '__EMPTY__', label: '空', count: 1 },
      ],
      groupOwner: [
        { value: '101', label: '李经理(c-lijingli)', count: 1 },
        { value: '__EMPTY__', label: '空', count: 1 },
      ],
      registeredDate: [
        { value: '2026-09-14', label: '2026-09-14', count: 1 },
        { value: '2026-09-15', label: '2026-09-15', count: 1 },
      ],
    }
    comparisonApi.loadHeaderFilterOptions.mockImplementation(async ({ targetColumn }) => ({
      options: options[targetColumn] || [], matchedRegistrationCount: 2,
    }))
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    const chooseAll = async key => {
      await wrapper.get(`[data-filter-key="${key}"]`).trigger('click')
      await flushPromises()
      for (const option of wrapper.findAll('[data-testid="header-filter-option"]')) {
        await option.get('input').setValue(true)
      }
      await wrapper.get('[data-testid="apply-header-filter"]').trigger('click')
      await flushPromises()
    }
    await chooseAll('tableName')
    await chooseAll('domain')
    await chooseAll('fields')
    await chooseAll('queryCondition')
    await chooseAll('reviser')
    await chooseAll('groupOwner')
    await chooseAll('date')

    expect(comparisonApi.searchRegistrations).toHaveBeenLastCalledWith(expect.objectContaining({
      tableNames: ['acct_master', 'loan_master'],
      fieldNames: ['acct_no', 'customer_no'],
      whereConditionValues: ['__FULL_TABLE__', '{"connector":"AND","groups":[]}'],
      domains: ['存款组', '贷款组'],
      reviserEmpNos: ['001', '__EMPTY__'],
      groupOwnerEmpNos: ['101', '__EMPTY__'],
      registeredDates: ['2026-09-14', '2026-09-15'],
    }))

    await wrapper.get('[data-filter-key="reviser"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="header-filter-search"]').setValue('c-zhang')
    await wrapper.get('[aria-label="查询筛选选项"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="header-filter-option"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="header-filter-option"]').text()).toContain('张三(c-zhangs)')
    expect(wrapper.get('[data-testid="header-filter-panel"]').html()).not.toContain('（')
    expect(wrapper.get('[data-testid="header-filter-panel"]').html()).not.toContain('）')
  })
  it('renders replay-style header filters and table-level mock registrations', () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)

    expect(wrapper.get('h2').text()).toBe('回放数据库比对字段登记（尚未生成版本）')
    expect(wrapper.get('[data-testid="global-audit-query"]').text()).toBe('审计日志查询')
    expect(wrapper.get('[data-testid="audit-registration-kdpa_cb_acct_fzn_cntl_inf"]').text())
      .toBe('审计日志')
    expect(wrapper.find('[data-testid="database-comparison-separate-filter-form"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="database-comparison-table-head"]').classes()).toContain('is-sticky')
    const filterButtons = wrapper.findAll('[data-testid="database-comparison-header-filter"]')
    expect(filterButtons).toHaveLength(7)
    expect(filterButtons.every(button => button.classes().includes('replay-header-filter-button'))).toBe(true)
    expect(filterButtons.every(button => button.find('i').exists())).toBe(true)
    const headers = wrapper.findAll('thead th')
    expect(headers[0].text()).toContain('表英文名 / 中文名')
    expect(headers[0].classes()).toContain('primary-column')
    expect(headers[0].attributes('style')).toContain('width: 127px')
    expect(headers[3].attributes('style')).toContain('width: 90px')
    expect(headers[4].attributes('style')).toContain('width: 90px')
    expect(headers[5].attributes('style')).toContain('width: 90px')
    expect(headers[6].attributes('style')).toContain('width: 51px')
    expect(headers.slice(0, -1).every(header => header.classes().includes('has-white-divider'))).toBe(true)
    expect(headers.some(header => header.text().includes('小组负责人'))).toBe(true)
    expect(headers.some(header => header.text().includes('归属小组'))).toBe(false)
    expect(headers.some(header => header.text().includes('归属大组'))).toBe(false)
    expect(headers.some(header => header.text() === '修订人')).toBe(true)
    expect(headers.some(header => header.text() === '负责人')).toBe(false)
    expect(headers.some(header => header.text().includes('登记日期'))).toBe(true)
    expect(headers.some(header => header.text() === '序号')).toBe(false)
    expect(wrapper.text()).toContain('kdpa_cb_acct_fzn_cntl_inf')
    expect(wrapper.text()).toContain('fzn_cntl_id(冻结控制编号)')
    expect(wrapper.text()).toContain('lglpern_cd')
    expect(wrapper.text()).not.toContain('lglpern_cd()')
    expect(wrapper.text()).toContain('共 200 张表 · 共 1483 个比对字段')
    expect(wrapper.text()).not.toContain('当前页')
    expect(wrapper.findAll('[data-testid="registration-row"]')).toHaveLength(50)
    expect(wrapper.classes()).toContain('is-fixed-page')
    expect(wrapper.get('[data-testid="table-viewport"]').classes()).toContain('is-scroll-viewport')
    expect(wrapper.get('[data-testid="fixed-pager"]').classes()).toContain('is-fixed-pager')
  })

  it('keeps the initial import dialog open and renders the complete error list', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await wrapper.get('[data-testid="open-initial-import"]').trigger('click')

    const dialog = wrapper.get('[data-testid="initial-import-dialog"]')
    expect(dialog.text()).toContain('存款、贷款、公共、结算')
    expect(dialog.text()).toContain('C 列：表英文名')
    expect(dialog.text()).toContain('E 列：字段英文名')
    expect(dialog.text()).toContain('G 列：负责人（修订人，可空）')

    await wrapper.get('[data-testid="initial-import-backdrop"]').trigger('click')
    expect(wrapper.find('[data-testid="initial-import-dialog"]').exists()).toBe(true)

    const file = new File(['excel'], '初始化.xlsx')
    const input = wrapper.get('[data-testid="initial-import-file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    await input.trigger('change')
    await wrapper.get('[data-testid="initial-import-token"]').setValue('secret')
    const errors = [
      { sheetName: '存款', rowNumber: 2, tableName: 'acct_master', fieldName: 'bad_field', reviserInput: '张三', reason: '字段不存在' },
      { sheetName: '贷款', rowNumber: 5, tableName: 'loan_master', fieldName: 'loan_no', reviserInput: '李四（c-lisi）', reason: '人员不存在' },
    ]
    const importError = Object.assign(new Error('初始化导入校验失败，未写入任何数据'), {
      code: 422,
      data: { errors },
    })
    comparisonApi.importInitialExcel.mockRejectedValue(importError)

    await wrapper.get('[data-testid="submit-initial-import"]').trigger('click')
    await flushPromises()

    expect(comparisonApi.importInitialExcel).toHaveBeenCalledWith(file, 'secret')
    expect(wrapper.find('[data-testid="initial-import-dialog"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="initial-import-error-header"]').map(header => header.text()))
      .toEqual(['Sheet', '行号', '表英文名', '字段英文名', '负责人', '原因'])
    expect(wrapper.findAll('[data-testid="initial-import-error-row"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="initial-import-error-row"]')[0].text())
      .toContain('存款2acct_masterbad_field张三字段不存在')
    await wrapper.get('[data-testid="export-initial-import-errors"]').trigger('click')
    await flushPromises()
    expect(exportInitialImportErrors).toHaveBeenCalledWith(errors)

    await wrapper.get('[data-testid="cancel-initial-import"]').trigger('click')
    expect(wrapper.find('[data-testid="initial-import-dialog"]').exists()).toBe(false)
  })

  it('opens the Excel chooser from the full-width upload control and shows the selected filename', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await wrapper.get('[data-testid="open-initial-import"]').trigger('click')
    const input = wrapper.get('[data-testid="initial-import-file"]')
    const click = vi.spyOn(input.element, 'click').mockImplementation(() => {})

    await wrapper.get('[data-testid="initial-import-file-trigger"]').trigger('click')

    expect(click).toHaveBeenCalledOnce()
    const file = new File(['excel'], '母库初始化登记.xlsx')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    await input.trigger('change')
    expect(wrapper.get('[data-testid="initial-import-file-name"]').text()).toBe('母库初始化登记.xlsx')
  })

  it('expands one row to show and copy every formatted field', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(ReplayDatabaseComparisonPage)

    await wrapper.get('[data-testid="expand-fields-kdpa_cb_acct_fzn_cntl_inf"]').trigger('click')

    const fieldCell = wrapper.get('[data-testid="fields-kdpa_cb_acct_fzn_cntl_inf"]')
    expect(fieldCell.text()).toContain('acct_status(账户状态)')
    expect(fieldCell.attributes('title')).toBe(
      'fzn_cntl_id(冻结控制编号)、fzn_new_pk(新增联合主键)、lglpern_cd、fzn_cntl_amt(冻结金额)、currency_cd(币种)、effective_dt(生效日期)、acct_status(账户状态)',
    )
    expect(wrapper.get('table').classes()).toContain('is-fixed-layout')
    expect(fieldCell.findAll('.field-item')).toHaveLength(7)
    expect(fieldCell.get('.field-list').text()).toContain('冻结控制编号)、fzn_new_pk(新增联合主键)、lglpern_cd')
    expect(fieldCell.text()).toContain('收起')
    expect(fieldCell.text()).toContain('复制全部字段')

    await wrapper.get('[data-testid="copy-fields-kdpa_cb_acct_fzn_cntl_inf"]').trigger('click')
    expect(writeText).toHaveBeenCalledWith(
      'fzn_cntl_id(冻结控制编号)、fzn_new_pk(新增联合主键)、lglpern_cd、fzn_cntl_amt(冻结金额)、currency_cd(币种)、effective_dt(生效日期)、acct_status(账户状态)',
    )
  })

  it('shows query conditions after comparison fields with matching width, expansion, and copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    const headers = wrapper.findAll('[data-testid="database-comparison-table-head"] th')
      .map(header => header.text().trim())

    expect(headers.slice(0, 5)).toEqual([
      '表英文名 / 中文名', '领域', '比对字段', '查询条件', '修订人',
    ])
    expect(wrapper.get('[data-testid="query-condition-header"]').attributes('style'))
      .toBe(wrapper.get('[data-column-key="reviser"]').attributes('style'))
    expect(wrapper.get('[data-testid="operation-header"]').attributes('style')).toContain('width: 130px')
    expect(wrapper.get('[data-filter-key="queryCondition"]').exists()).toBe(true)

    const tableName = 'kdpa_cb_acct_fzn_cntl_inf'
    const conditionCell = wrapper.get(`[data-testid="query-condition-${tableName}"]`)
    expect(conditionCell.text()).toContain("status_cd = '1'")
    expect(conditionCell.text()).toContain('展开')

    await wrapper.get(`[data-testid="expand-query-condition-${tableName}"]`).trigger('click')
    expect(conditionCell.classes()).toContain('is-expanded')
    expect(conditionCell.text()).toContain('收起')
    expect(conditionCell.text()).toContain('复制全部条件')

    await wrapper.get(`[data-testid="copy-query-condition-${tableName}"]`).trigger('click')
    expect(writeText).toHaveBeenCalledWith("where status_cd = '1'")
    expect(wrapper.get('[data-testid="query-condition-kdpl_cb_acct_fzn_cntl_oprn_detl"]').text())
      .toContain('全表')

    await wrapper.get('[data-filter-key="queryCondition"]').trigger('click')
    await wrapper.get('[data-testid="header-filter-search"]').setValue('status_cd')
    await wrapper.get('[aria-label="查询筛选选项"]').trigger('click')
    expect(wrapper.findAll('[data-testid="header-filter-option"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="header-filter-option"]').text()).toContain("status_cd = '1'")
    await wrapper.get('[aria-label="关闭筛选"]').trigger('click')

    await wrapper.get('[data-filter-key="queryCondition"]').trigger('click')
    await wrapper.get('[data-testid="header-filter-search"]').setValue('全表')
    await wrapper.get('[aria-label="查询筛选选项"]').trigger('click')
    expect(wrapper.findAll('[data-testid="header-filter-option"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="header-filter-option"]').text()).toContain('全表')
  })

  it('copies comparison fields through the legacy fallback when Clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
    const wrapper = mount(ReplayDatabaseComparisonPage)

    await wrapper.get('[data-testid="expand-fields-kdpa_cb_acct_fzn_cntl_inf"]').trigger('click')
    await wrapper.get('[data-testid="copy-fields-kdpa_cb_acct_fzn_cntl_inf"]').trigger('click')

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(wrapper.get('[data-testid="copy-fields-kdpa_cb_acct_fzn_cntl_inf"]').text()).toBe('已复制')
  })

  it('paginates all 200 mock registrations and changes page size', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    const firstTable = wrapper.findAll('[data-testid="registration-row"]')[0].text()

    expect(wrapper.get('[data-testid="page-summary"]').text()).toContain('第 1 / 4 页')
    await wrapper.get('[data-testid="next-page"]').trigger('click')
    expect(wrapper.get('[data-testid="page-summary"]').text()).toContain('第 2 / 4 页')
    expect(wrapper.findAll('[data-testid="registration-row"]')[0].text()).not.toBe(firstTable)

    await wrapper.get('[data-testid="page-size"]').setValue('100')
    expect(wrapper.findAll('[data-testid="registration-row"]')).toHaveLength(100)
    expect(wrapper.get('[data-testid="page-summary"]').text()).toContain('第 1 / 2 页')
    expect(wrapper.findAll('[data-testid="page-number"]')).toHaveLength(0)
  })

  it('applies header filters and resets the filtered result', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)

    await wrapper.get('[data-filter-key="domain"]').trigger('click')
    expect(wrapper.get('[data-testid="header-filter-panel"]').exists()).toBe(true)
    const loanOption = wrapper.findAll('[data-testid="header-filter-option"]')
      .find(option => option.text().includes('贷款'))
    await loanOption.get('input').setValue(true)
    await wrapper.get('[data-testid="apply-header-filter"]').trigger('click')

    expect(wrapper.findAll('[data-cell-role="domain-cell"]')
      .every(cell => cell.attributes('title') === '贷款组')).toBe(true)
    expect(wrapper.get('[data-testid="page-summary"]').text()).toContain('共 40 条')
    expect(wrapper.text()).toContain('共 200 张表 · 共 1483 个比对字段')

    await wrapper.get('[data-testid="reset-filters"]').trigger('click')
    expect(wrapper.get('[data-testid="page-summary"]').text()).toContain('共 200 条')
  })

  it('opens a working option panel for every filterable header', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)

    for (const button of wrapper.findAll('[data-testid="database-comparison-header-filter"]')) {
      await button.trigger('click')
      const panel = wrapper.get('[data-testid="header-filter-panel"]')
      expect(panel.classes()).toContain('replay-header-filter-panel')
      expect(panel.attributes('style')).toContain('left:')
      expect(panel.attributes('style')).toContain('top:')
      expect(panel.text()).toContain(`筛选 ${button.element.previousElementSibling.textContent}`)
      expect(panel.get('[aria-label="查询筛选选项"]').find('svg').exists()).toBe(true)
      expect(panel.find('[data-testid="header-filter-resize-handle"]').exists()).toBe(true)
      expect(panel.get('.replay-header-filter-clear').classes()).toContain('is-bordered')
      expect(wrapper.findAll('[data-testid="header-filter-option"]').length).toBeGreaterThan(0)
      await wrapper.get('[aria-label="关闭筛选"]').trigger('click')
    }
  })

  it('keeps the real-data filter panel anchored after loading options asynchronously', async () => {
    useRealMode()
    let finishLoading
    comparisonApi.loadHeaderFilterOptions.mockImplementation(() => new Promise(resolve => {
      finishLoading = () => resolve({ options: [], matchedRegistrationCount: 0 })
    }))
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    const filterButton = wrapper.get('[data-filter-key="tableName"]')
    vi.spyOn(filterButton.element, 'getBoundingClientRect').mockReturnValue({
      left: 420, right: 438, top: 100, bottom: 118, width: 18, height: 18,
    })

    await filterButton.trigger('click')

    const panelStyle = wrapper.get('[data-testid="header-filter-panel"]').attributes('style')
    expect(panelStyle).toContain('left: 420px')
    expect(panelStyle).toContain('top: 124px')
    finishLoading()
    await flushPromises()
  })

  it('does not search filter options until the search button is clicked', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await wrapper.get('[data-filter-key="tableName"]').trigger('click')
    const originalOptionCount = wrapper.findAll('[data-testid="header-filter-option"]').length

    await wrapper.get('[data-testid="header-filter-search"]').setValue('不存在的表')

    expect(wrapper.findAll('[data-testid="header-filter-option"]')).toHaveLength(originalOptionCount)
    await wrapper.get('[aria-label="查询筛选选项"]').trigger('click')
    expect(wrapper.findAll('[data-testid="header-filter-option"]')).toHaveLength(0)
  })

  it('opens the shared editor in add and edit modes', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)

    await wrapper.get('[data-testid="add-registration"]').trigger('click')
    expect(wrapper.findComponent(ReplayDatabaseComparisonEditor).exists()).toBe(true)
    expect(wrapper.get('[data-testid="editor-title"]').text()).toBe('新增登记')
    expect(wrapper.findComponent(ReplayDatabaseComparisonEditor).text()).not.toContain('固定 Schema：CCBS_BASE')
    await wrapper.get('[aria-label="关闭新增登记"]').trigger('click')

    await wrapper.get('[data-testid="edit-registration-kdpa_cb_acct_fzn_cntl_inf"]').trigger('click')
    expect(wrapper.get('[data-testid="editor-title"]').text()).toBe('编辑登记')
    expect(wrapper.get('[data-testid="selected-table"]').text()).toContain('kdpa_cb_acct_fzn_cntl_inf')
  })

  it('uses complete registration details when list preview contains only three fields', async () => {
    useRealMode([{
      id: 7, tableName: 'kapb_txn_log', tableComment: '交易日志表', domainName: '平台组',
      fieldCount: 5, fieldPreview: ['bkgrd_seqnum(后台流水号)', 'txn_dt(交易日期)', 'lglpern_cd(法人代码)'],
      reviserName: '王山河', groupOwnerEmpNo: 'c-wangsh8', groupOwnerName: '王山河',
      registeredDate: '2026-09-15', version: 1,
      metadataValidation: { status: 'VALID', primaryKeyChanged: false },
    }])
    const fields = [
      { columnName: 'bkgrd_seqnum', columnComment: '后台流水号', primaryKey: true, primaryKeyOrder: 1, comparisonOrder: 1 },
      { columnName: 'txn_dt', columnComment: '交易日期', primaryKey: true, primaryKeyOrder: 2, comparisonOrder: 2 },
      { columnName: 'lglpern_cd', columnComment: '法人代码', primaryKey: true, primaryKeyOrder: 3, comparisonOrder: 3 },
      { columnName: 'glbl_seqnum', columnComment: '全局流水号', primaryKey: false, comparisonOrder: 4 },
      { columnName: 'core_txn_cd', columnComment: '核心交易码', primaryKey: false, comparisonOrder: 5 },
    ]
    comparisonApi.loadRegistration.mockResolvedValue({
      id: 7, tableName: 'kapb_txn_log', tableComment: '交易日志表', domainName: '平台组',
      groupOwnerEmpNo: 'c-wangsh8', groupOwnerName: '王山河', version: 1, fields,
      metadataValidation: { status: 'VALID', primaryKeyChanged: false },
    })
    comparisonApi.loadBaseColumns.mockResolvedValue(fields)

    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-registration-kapb_txn_log"]').trigger('click')
    await flushPromises()

    expect(wrapper.findComponent(ReplayDatabaseComparisonEditor)
      .findAll('[data-testid="selected-field-row"]')).toHaveLength(5)
  })

  it('fills the current login as reviser and local system date when a registration is saved', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-12T16:30:00Z'))
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await wrapper.get('[data-testid="add-registration"]').trigger('click')

    wrapper.findComponent(ReplayDatabaseComparisonEditor).vm.$emit('save', {
      tableName: 'kpb_new_comparison_table',
      tableComment: '新增比对表',
      fields: [{ name: 'id', comment: '主键' }],
      domain: '公共组',
      groupOwnerUsername: 'sunhy1',
      groupOwnerName: '孙海英',
    })
    await wrapper.vm.$nextTick()

    const firstRow = wrapper.findAll('[data-testid="registration-row"]')[0].text()
    expect(firstRow).toContain('管理员')
    expect(wrapper.get('[data-testid="reviser-kpb_new_comparison_table"]').attributes('title')).toBe('管理员')
    expect(firstRow).toContain('孙海英(sunhy1)')
    expect(firstRow).toContain('2026-09-13')
    vi.useRealTimers()
  })

  it('keeps edit and delete available to every logged-in user and opens both audit entries', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    const tableName = 'kdpa_cb_acct_fzn_cntl_inf'

    for (const action of ['view', 'edit', 'delete', 'audit']) {
      const button = wrapper.get(`[data-testid="${action}-registration-${tableName}"]`)
      expect(button.classes()).toContain('operation-button')
      expect(button.attributes('disabled')).toBeUndefined()
    }
    await wrapper.get(`[data-testid="view-registration-${tableName}"]`).trigger('click')
    expect(wrapper.get('[data-testid="registration-detail-dialog"]').text()).toContain('对公存款账户冻结控制信息')
    await wrapper.get('[data-testid="close-registration-detail"]').trigger('click')
    await wrapper.get(`[data-testid="audit-registration-${tableName}"]`).trigger('click')
    expect(wrapper.get('[data-testid="audit-table-filter"]').element.value).toBe(tableName)
    await wrapper.get('[data-testid="close-audit-dialog"]').trigger('click')
    await wrapper.get('[data-testid="global-audit-query"]').trigger('click')
    expect(wrapper.get('[data-testid="registration-audit-dialog"]').text()).toContain('全局审计日志查询')
  })

  it('loads and pages global audit logs by table', async () => {
    useRealMode()
    comparisonApi.searchGroupedAudits.mockResolvedValue({
      content: [{
        schemaName: 'CCBS_BASE', tableName: 'acct_master', tableComment: '账户主表',
        matchedEventCount: 1, latestOperatorName: '张三', latestOperatedAt: '2026-09-15 10:00:00',
        events: [{ id: 1, tableName: 'acct_master', operation: 'CREATE', operatorName: '张三', operatedAt: '2026-09-15 10:00:00', changeCount: 1, details: [] }],
      }],
      page: 0, size: 20, totalElements: 21, totalPages: 2,
    })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    await wrapper.get('[data-testid="global-audit-query"]').trigger('click')
    await flushPromises()

    expect(comparisonApi.searchGroupedAudits).toHaveBeenCalledWith(expect.objectContaining({ page: 0, size: 20 }))
    expect(wrapper.text()).toContain('acct_master / 账户主表')
    await wrapper.get('[data-testid="audit-next-page"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.searchGroupedAudits).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 20 }))
  })

  it('keeps and highlights registered fields that no longer exist in BASE metadata', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    const tableName = 'kdpl_cb_acct_fzn_cntl_oprn_detl'

    await wrapper.get(`[data-testid="view-registration-${tableName}"]`).trigger('click')

    const detail = wrapper.get('[data-testid="registration-detail-dialog"]')
    expect(detail.get('[data-testid="detail-missing-fields-warning"]').text()).toContain('1 个字段已从母库删除')
    expect(detail.get('[data-testid="detail-field-legacy_deleted_field"]').classes()).toContain('is-missing-in-base')
    expect(detail.get('[data-testid="detail-field-legacy_deleted_field"]').text()).toContain('母库已删除')
    expect(detail.get('[data-testid="detail-field-fzn_cntl_oprn_sn"]').classes()).not.toContain('is-missing-in-base')
  })

  it('labels field drift and strikes through only missing comparison fields in the list', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    const tableName = 'kdpl_cb_acct_fzn_cntl_oprn_detl'

    const tableCell = wrapper.get(`[data-testid="table-name-${tableName}"]`)
    expect(tableCell.text()).toContain('比对字段母库中不存在')
    expect(tableCell.classes()).toContain('is-table-missing')
    expect(tableCell.get('.metadata-status').classes()).toContain('is-table-missing-status')
    expect(wrapper.get(`[data-testid="list-field-${tableName}-fzn_cntl_oprn_sn"]`).classes())
      .not.toContain('is-missing-in-base-preview')
    await wrapper.get(`[data-testid="expand-fields-${tableName}"]`).trigger('click')
    expect(wrapper.get(`[data-testid="list-field-${tableName}-legacy_deleted_field"]`).classes())
      .toContain('is-missing-in-base-preview')

    await wrapper.get('[data-testid="expand-fields-removed_base_table"]').trigger('click')
    expect(wrapper.get('[data-testid="table-name-removed_base_table"]').text())
      .not.toContain('比对字段母库中不存在')
    expect(wrapper.get('[data-testid="list-field-removed_base_table-historical_id"]').classes())
      .not.toContain('is-missing-in-base-preview')
  })

  it('does not expose primary-key drift in the list or detail', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    const tableName = 'kdpa_cb_acct_fzn_cntl_inf'

    const tableCell = wrapper.get(`[data-testid="table-name-${tableName}"]`)
    expect(tableCell.text()).not.toContain('比对字段母库中不存在')
    expect(tableCell.text()).not.toContain('母库主键已变更')
    expect(tableCell.find('[data-testid="primary-key-changed-status"]').exists()).toBe(false)

    await wrapper.get(`[data-testid="view-registration-${tableName}"]`).trigger('click')
    expect(wrapper.find('[data-testid="detail-primary-key-changed-warning"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="table-name-removed_base_table"]').text())
      .not.toContain('母库主键已变更')
    expect(wrapper.get('[data-testid="table-name-base_unavailable_table"]').text())
      .not.toContain('母库主键已变更')
  })

  it('actually inserts the mock newly added primary key into the editor', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    const tableName = 'kdpa_cb_acct_fzn_cntl_inf'

    await wrapper.get(`[data-testid="edit-registration-${tableName}"]`).trigger('click')

    const selectedFields = wrapper.findComponent(ReplayDatabaseComparisonEditor)
      .findAll('[data-testid="selected-field-row"]')
      .map(row => row.get('strong').text().replace(/^\d+\.\s*/, ''))
    expect(selectedFields).toContain('fzn_new_pk')
    expect(selectedFields.slice(0, 2)).toEqual(['fzn_cntl_id', 'fzn_new_pk'])
    expect(selectedFields).not.toContain('legacy_deleted_field')
    expect(wrapper.find('[data-testid="missing-fields-warning"]').exists()).toBe(false)
  })

  it('seamlessly keeps a former composite key as a normal comparison field', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    const tableName = 'klna_ln_acct_base_info'
    const tableCell = wrapper.get(`[data-testid="table-name-${tableName}"]`)

    expect(tableCell.text()).not.toContain('母库主键已变更')
    expect(tableCell.text()).not.toContain('比对字段母库中不存在')
    await wrapper.get(`[data-testid="edit-registration-${tableName}"]`).trigger('click')

    const editor = wrapper.findComponent(ReplayDatabaseComparisonEditor)
    const customerRow = editor.findAll('[data-testid="selected-field-row"]')
      .find(row => row.text().includes('customer_no'))
    expect(customerRow.text()).not.toContain('主键')
    expect(customerRow.get('input').attributes('disabled')).toBeUndefined()
    expect(editor.findAll('.primary-key-marker')).toHaveLength(1)
    expect(editor.find('[data-testid="primary-key-drift-warning"]').exists()).toBe(false)
    expect(editor.find('[data-testid="missing-fields-warning"]').exists()).toBe(false)
  })

  it('shows only the missing-field warning when a former composite key is deleted from BASE', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    const tableName = 'kpba_pb_product_parameter'
    const tableCell = wrapper.get(`[data-testid="table-name-${tableName}"]`)

    expect(tableCell.text()).not.toContain('母库主键已变更')
    expect(tableCell.text()).toContain('比对字段母库中不存在')
    await wrapper.get(`[data-testid="edit-registration-${tableName}"]`).trigger('click')

    const editor = wrapper.findComponent(ReplayDatabaseComparisonEditor)
    expect(editor.find('[data-testid="primary-key-drift-warning"]').exists()).toBe(false)
    expect(editor.get('[data-testid="missing-fields-warning"]').text()).toContain('1 个字段已从母库删除')
    const deletedKeyRow = editor.findAll('[data-testid="selected-field-row"]')
      .find(row => row.text().includes('legacy_partition_id'))
    expect(deletedKeyRow.classes()).toContain('is-missing-in-base')
    expect(deletedKeyRow.text()).toContain('主键')
    expect(deletedKeyRow.text()).toContain('母库已删除')
    expect(deletedKeyRow.get('input').attributes('disabled')).toBeUndefined()
  })

  it('filters mock registrations by the synthetic missing-field label', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await wrapper.get('[data-filter-key="tableName"]').trigger('click')
    await wrapper.get('[data-testid="header-filter-search"]').setValue('不存在')
    await wrapper.get('[aria-label="查询筛选选项"]').trigger('click')

    const option = wrapper.findAll('[data-testid="header-filter-option"]')
      .find(item => item.text().includes('比对字段母库中不存在'))
    expect(option).toBeTruthy()
    await option.get('input').setValue(true)
    await wrapper.get('[data-testid="apply-header-filter"]').trigger('click')

    expect(wrapper.findAll('[data-testid="registration-row"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="registration-row"]')
      .map(row => row.attributes('data-row-table'))).toEqual([
      'kdpl_cb_acct_fzn_cntl_oprn_detl',
      'kpba_pb_product_parameter',
    ])
  })

  it('filters mock registrations by the synthetic missing-table label', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await wrapper.get('[data-filter-key="tableName"]').trigger('click')
    await wrapper.get('[data-testid="header-filter-search"]').setValue('已删除')
    await wrapper.get('[aria-label="查询筛选选项"]').trigger('click')

    const option = wrapper.findAll('[data-testid="header-filter-option"]')
      .find(item => item.text().includes('母库表已删除'))
    expect(option).toBeTruthy()
    await option.get('input').setValue(true)
    await wrapper.get('[data-testid="apply-header-filter"]').trigger('click')

    expect(wrapper.findAll('[data-testid="registration-row"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="registration-row"]').attributes('data-row-table'))
      .toBe('removed_base_table')
  })

  it('filters mock registrations by the missing-condition-field label', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await wrapper.get('[data-filter-key="tableName"]').trigger('click')
    await wrapper.get('[data-testid="header-filter-search"]').setValue('条件字段')
    await wrapper.get('[aria-label="查询筛选选项"]').trigger('click')

    const option = wrapper.findAll('[data-testid="header-filter-option"]')
      .find(item => item.text().includes('条件字段母库中不存在'))
    expect(option).toBeTruthy()
    await option.get('input').setValue(true)
    await wrapper.get('[data-testid="apply-header-filter"]').trigger('click')

    expect(wrapper.findAll('[data-testid="registration-row"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="registration-row"]').attributes('data-row-table'))
      .toBe('kpba_pb_product_parameter')
  })

  it('does not offer a synthetic primary-key drift filter for mock registrations', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await wrapper.get('[data-filter-key="tableName"]').trigger('click')
    await wrapper.get('[data-testid="header-filter-search"]').setValue('主键')
    await wrapper.get('[aria-label="查询筛选选项"]').trigger('click')

    const option = wrapper.findAll('[data-testid="header-filter-option"]')
      .find(item => item.text().includes('母库主键已变更'))
    expect(option).toBeUndefined()
  })

  it('shows and filters the limited-comparison ordering primary-key drift label', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    const driftCell = wrapper.get('[data-testid="table-name-klna_ln_acct_base_info"]')
    expect(driftCell.text()).toContain('排序主键已变更')

    await wrapper.get('[data-filter-key="tableName"]').trigger('click')
    await wrapper.get('[data-testid="header-filter-search"]').setValue('排序主键')
    await wrapper.get('[aria-label="查询筛选选项"]').trigger('click')

    const option = wrapper.findAll('[data-testid="header-filter-option"]')
      .find(item => item.text().includes('排序主键已变更'))
    expect(option).toBeTruthy()
    await option.get('input').setValue(true)
    await wrapper.get('[data-testid="apply-header-filter"]').trigger('click')

    expect(wrapper.findAll('[data-testid="registration-row"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="registration-row"]').attributes('data-row-table'))
      .toBe('klna_ln_acct_base_info')
  })

  it('maps the synthetic table option to metadata status for real searches', async () => {
    vi.stubEnv('VITE_REPLAY_DB_COMPARE_MOCK', 'false')
    comparisonApi.loadOptions.mockResolvedValue({ domains: ['存款组'], canImport: false })
    comparisonApi.searchRegistrations.mockResolvedValue({ items: [], page: 0, size: 50, total: 0 })
    comparisonApi.loadHeaderFilterOptions.mockResolvedValue({
      options: [{
        value: '比对字段母库中不存在',
        label: '比对字段母库中不存在',
        count: 3,
        metadataStatus: 'MISSING_FIELDS',
      }],
      matchedRegistrationCount: 3,
    })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    await wrapper.get('[data-filter-key="tableName"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="header-filter-option"] input').setValue(true)
    await wrapper.get('[data-testid="apply-header-filter"]').trigger('click')
    await flushPromises()

    expect(comparisonApi.searchRegistrations).toHaveBeenLastCalledWith(expect.objectContaining({
      tableKeyword: '',
      metadataStatuses: ['MISSING_FIELDS'],
    }))
  })

  it('maps the missing-condition-field option to its independent metadata filter', async () => {
    vi.stubEnv('VITE_REPLAY_DB_COMPARE_MOCK', 'false')
    comparisonApi.loadOptions.mockResolvedValue({ domains: ['存款组'], canImport: false })
    comparisonApi.searchRegistrations.mockResolvedValue({ items: [], page: 0, size: 50, total: 0 })
    comparisonApi.loadHeaderFilterOptions.mockResolvedValue({
      options: [{
        value: '条件字段母库中不存在',
        label: '条件字段母库中不存在',
        count: 1,
        metadataStatus: 'MISSING_CONDITION_FIELDS',
      }],
      matchedRegistrationCount: 1,
    })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    await wrapper.get('[data-filter-key="tableName"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="header-filter-option"] input').setValue(true)
    await wrapper.get('[data-testid="apply-header-filter"]').trigger('click')
    await flushPromises()

    expect(comparisonApi.searchRegistrations).toHaveBeenLastCalledWith(expect.objectContaining({
      metadataStatuses: ['MISSING_CONDITION_FIELDS'],
    }))
  })

  it('maps the missing-table option to TABLE_MISSING for real searches', async () => {
    vi.stubEnv('VITE_REPLAY_DB_COMPARE_MOCK', 'false')
    comparisonApi.loadOptions.mockResolvedValue({ domains: ['存款组'], canImport: false })
    comparisonApi.searchRegistrations.mockResolvedValue({ items: [], page: 0, size: 50, total: 0 })
    comparisonApi.loadHeaderFilterOptions.mockResolvedValue({
      options: [{ value: '母库表已删除', label: '母库表已删除', count: 2, metadataStatus: 'TABLE_MISSING' }],
      matchedRegistrationCount: 2,
    })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    await wrapper.get('[data-filter-key="tableName"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="header-filter-option"] input').setValue(true)
    await wrapper.get('[data-testid="apply-header-filter"]').trigger('click')
    await flushPromises()

    expect(comparisonApi.searchRegistrations).toHaveBeenLastCalledWith(expect.objectContaining({
      tableKeyword: '',
      metadataStatuses: ['TABLE_MISSING'],
    }))
  })

  it('discards obsolete primary-key drift options returned by the server', async () => {
    vi.stubEnv('VITE_REPLAY_DB_COMPARE_MOCK', 'false')
    comparisonApi.loadOptions.mockResolvedValue({ domains: ['存款组'], canImport: false })
    comparisonApi.searchRegistrations.mockResolvedValue({ items: [], page: 0, size: 50, total: 0 })
    comparisonApi.loadHeaderFilterOptions.mockResolvedValue({
      options: [{ value: '母库主键已变更', label: '母库主键已变更', count: 2, metadataStatus: 'PRIMARY_KEY_CHANGED' }],
      matchedRegistrationCount: 2,
    })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    await wrapper.get('[data-filter-key="tableName"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="header-filter-option"]')
      .some(option => option.text().includes('母库主键已变更'))).toBe(false)
  })

  it('keeps the editor open and reloads keys after a required-primary-key response', async () => {
    vi.stubEnv('VITE_REPLAY_DB_COMPARE_MOCK', 'false')
    comparisonApi.loadOptions.mockResolvedValue({ domains: ['存款组'], canImport: false })
    comparisonApi.searchRegistrations.mockResolvedValue({
      items: [{
        id: 7, tableName: 'acct_master', tableComment: '账户主表', domainName: '存款组',
        fieldPreview: ['a(主键A)', 'd(普通字段D)'], reviserEmpNo: '001', reviserName: '张三',
        groupOwnerEmpNo: '101', groupOwnerName: '赵经理', registeredDate: '2026-09-12', version: 3,
        metadataValidation: { status: 'VALID', primaryKeyChanged: false },
      }],
      page: 0, size: 50, total: 1,
    })
    comparisonApi.loadRegistration.mockResolvedValue({
      id: 7, tableName: 'acct_master', tableComment: '账户主表', domainName: '存款组',
      groupOwnerEmpNo: '101', groupOwnerName: '赵经理', registeredDate: '2026-09-12', version: 3,
      fields: [
        { columnName: 'a', columnComment: '主键A', primaryKey: true, comparisonOrder: 1, existsInBase: true },
        { columnName: 'd', columnComment: '普通字段D', primaryKey: false, comparisonOrder: 2, existsInBase: true },
      ],
      metadataValidation: { status: 'VALID', primaryKeyChanged: false },
    })
    comparisonApi.loadBaseColumns
      .mockResolvedValueOnce([
        { columnName: 'a', columnComment: '主键A', primaryKey: true, primaryKeyOrder: 1, ordinalPosition: 1 },
        { columnName: 'd', columnComment: '普通字段D', primaryKey: false, ordinalPosition: 2 },
      ])
      .mockResolvedValue([
        { columnName: 'a', columnComment: '主键A', primaryKey: true, primaryKeyOrder: 1, ordinalPosition: 1 },
        { columnName: 'd', columnComment: '普通字段D', primaryKey: false, ordinalPosition: 2 },
        { columnName: 'f', columnComment: '新增主键F', primaryKey: true, primaryKeyOrder: 2, ordinalPosition: 3 },
      ])
    comparisonApi.updateRegistration.mockRejectedValue({
      code: 'BASE_PRIMARY_KEYS_REQUIRED',
      data: { missingPrimaryKeyNames: ['f'] },
    })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-registration-acct_master"]').trigger('click')
    await flushPromises()

    wrapper.findComponent(ReplayDatabaseComparisonEditor).vm.$emit('save', {
      mode: 'edit', id: 7, version: 3, tableName: 'acct_master', fieldNames: ['a', 'd'],
      domain: '存款组', groupOwnerUsername: '101', groupOwnerName: '赵经理',
    })
    await flushPromises()

    const editor = wrapper.findComponent(ReplayDatabaseComparisonEditor)
    expect(editor.exists()).toBe(true)
    expect(editor.findAll('[data-testid="selected-field-row"]')
      .map(row => row.get('strong').text().replace(/^\d+\.\s*/, ''))).toEqual(['a', 'f', 'd'])
    expect(editor.find('[data-testid="primary-key-drift-warning"]').exists()).toBe(false)
  })

  it('keeps the editor open and blocks saving after a missing-primary-key response', async () => {
    vi.stubEnv('VITE_REPLAY_DB_COMPARE_MOCK', 'false')
    comparisonApi.loadOptions.mockResolvedValue({ domains: ['存款组'], canImport: false })
    comparisonApi.searchRegistrations.mockResolvedValue({
      items: [{
        id: 7, tableName: 'acct_master', tableComment: '账户主表', domainName: '存款组',
        fieldPreview: ['acct_no(账号)', 'status(状态)'], reviserEmpNo: '001', reviserName: '张三',
        groupOwnerEmpNo: '101', groupOwnerName: '赵经理', registeredDate: '2026-09-12', version: 3,
        metadataValidation: { status: 'VALID', primaryKeyChanged: false },
      }],
      page: 0, size: 50, total: 1,
    })
    comparisonApi.loadRegistration.mockResolvedValue({
      id: 7, tableName: 'acct_master', tableComment: '账户主表', domainName: '存款组',
      groupOwnerEmpNo: '101', groupOwnerName: '赵经理', registeredDate: '2026-09-12', version: 3,
      fields: [
        { columnName: 'acct_no', columnComment: '账号', primaryKey: true, comparisonOrder: 1, existsInBase: true },
        { columnName: 'status', columnComment: '状态', primaryKey: false, comparisonOrder: 2, existsInBase: true },
      ],
      metadataValidation: { status: 'VALID', primaryKeyChanged: false },
    })
    comparisonApi.loadBaseColumns
      .mockResolvedValueOnce([
        { columnName: 'acct_no', columnComment: '账号', primaryKey: true, ordinalPosition: 1 },
        { columnName: 'status', columnComment: '状态', primaryKey: false, ordinalPosition: 2 },
      ])
      .mockResolvedValue([
        { columnName: 'acct_no', columnComment: '账号', primaryKey: false, ordinalPosition: 1 },
        { columnName: 'status', columnComment: '状态', primaryKey: false, ordinalPosition: 2 },
      ])
    comparisonApi.updateRegistration.mockRejectedValue({
      code: 'BASE_PRIMARY_KEY_MISSING', data: { tableName: 'acct_master' },
    })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-registration-acct_master"]').trigger('click')
    await flushPromises()

    wrapper.findComponent(ReplayDatabaseComparisonEditor).vm.$emit('save', {
      mode: 'edit', id: 7, version: 3, tableName: 'acct_master', fieldNames: ['acct_no', 'status'],
      domain: '存款组', groupOwnerUsername: '101', groupOwnerName: '赵经理',
    })
    await flushPromises()

    const editor = wrapper.findComponent(ReplayDatabaseComparisonEditor)
    expect(editor.exists()).toBe(true)
    expect(editor.get('[data-testid="primary-key-missing-warning"]').text())
      .toContain('该表没有主键，请联系 DBA 创建表主键')
    expect(editor.findAll('[data-testid="selected-field-row"]')
      .map(row => row.get('strong').text().replace(/^\d+\.\s*/, ''))).toEqual(['acct_no', 'status'])
    expect(editor.get('[data-testid="submit-registration"]').attributes('disabled')).toBeDefined()
  })

  it('highlights only confirmed missing BASE tables in the list', () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)

    const missingCell = wrapper.get('[data-testid="table-name-removed_base_table"]')
    expect(missingCell.classes()).toContain('is-table-missing')
    expect(missingCell.text()).toContain('母库表已删除')
    const unavailableCell = wrapper.get('[data-testid="table-name-base_unavailable_table"]')
    expect(unavailableCell.classes()).not.toContain('is-table-missing')
    expect(wrapper.get('[data-testid="metadata-unavailable-base_unavailable_table"]').text())
      .toContain('母库校验暂不可用')
    for (const action of ['view', 'edit', 'delete', 'audit']) {
      expect(wrapper.get(`[data-testid="${action}-registration-removed_base_table"]`).attributes('disabled'))
        .toBeUndefined()
    }
  })

  it('shows one table-level warning and keeps historical fields in detail', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)

    await wrapper.get('[data-testid="view-registration-removed_base_table"]').trigger('click')

    const dialog = wrapper.get('[data-testid="registration-detail-dialog"]')
    expect(dialog.get('[data-testid="detail-table-missing-warning"]').text())
      .toContain('当前展示的是历史登记快照')
    expect(dialog.findAll('.is-missing-in-base')).toHaveLength(0)
    expect(dialog.text()).toContain('historical_id(历史主键)')
    expect(dialog.text()).toContain('主键')
    expect(dialog.get('[data-testid="delete-missing-table-registration"]').exists()).toBe(true)
  })

  it('requires confirmation before deleting a registration from the list', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    const tableName = 'kdpa_cb_acct_fzn_cntl_inf'
    const originalCount = wrapper.findAll('[data-testid="registration-row"]').length

    await wrapper.get(`[data-testid="delete-registration-${tableName}"]`).trigger('click')
    expect(wrapper.get('[data-testid="list-delete-confirmation"]').text()).toContain(tableName)
    expect(wrapper.text()).toContain(tableName)
    await wrapper.get('[data-testid="confirm-list-delete"]').trigger('click')

    expect(wrapper.findAll('[data-testid="registration-row"]')).toHaveLength(originalCount)
    expect(wrapper.get('[data-testid="page-summary"]').text()).toContain('共 199 条')
    expect(wrapper.text()).not.toContain(tableName)
  })

  it('contains and copies every compact cell without wrapping after field expansion', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    const tableName = 'kdpa_cb_acct_fzn_cntl_inf'
    const compactCells = [
      [`table-name-${tableName}`, `${tableName} / 对公存款账户冻结控制信息`],
      [`domain-${tableName}`, '存款组'],
      [`reviser-${tableName}`, '周皓'],
      [`group-owner-${tableName}`, '孙海英(sunhy1)'],
      [`date-${tableName}`, '2026-09-07'],
    ]

    for (const [testId, fullValue] of compactCells) {
      const cell = wrapper.get(`[data-testid="${testId}"]`)
      expect(cell.classes()).toContain('compact-copy-cell')
      expect(cell.attributes('title')).toBe(fullValue)
      expect(cell.get('.compact-cell-content').text()).not.toBe('')
      await wrapper.get(`[data-testid="copy-${testId}"]`).trigger('click')
      expect(writeText).toHaveBeenLastCalledWith(fullValue)
    }

    await wrapper.get(`[data-testid="expand-fields-${tableName}"]`).trigger('click')
    expect(wrapper.get(`[data-row-table="${tableName}"]`).classes()).toContain('is-fields-expanded')
    expect(wrapper.findAll(`[data-row-table="${tableName}"] .compact-cell-content`)).toHaveLength(5)
  })
})
