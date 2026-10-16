import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

enableAutoUnmount(afterEach)
afterEach(() => vi.unstubAllEnvs())

vi.mock('../../api/replayDatabaseComparison.js', () => ({
  createRegistration: vi.fn(),
  deleteRegistration: vi.fn(),
  generateVersion: vi.fn(),
  loadAuditDetails: vi.fn(),
  loadBaseColumns: vi.fn(),
  loadBaseKeys: vi.fn(),
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
  searchTechnologyOwners: vi.fn(),
  searchRegistrations: vi.fn(),
  searchVersionSnapshot: vi.fn(),
  synchronizePrimaryKeys: vi.fn(),
  updateRegistration: vi.fn(),
}))

vi.mock('./initialImportErrorWorkbook.js', () => ({
  exportInitialImportErrors: vi.fn(),
}))

import * as comparisonApi from '../../api/replayDatabaseComparison.js'
import { exportInitialImportErrors } from './initialImportErrorWorkbook.js'
import ReplayDatabaseComparisonPage from './ReplayDatabaseComparisonPage.vue'
import ReplayDatabaseComparisonEditor from './ReplayDatabaseComparisonEditor.vue'

describe('ReplayDatabaseComparisonPage', () => {

  const useRealMode = (items = [], totals = {}) => {
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
    Object.values(comparisonApi).forEach(value => value?.mockReset?.())
    exportInitialImportErrors.mockReset()
    exportInitialImportErrors.mockResolvedValue(undefined)
    comparisonApi.loadLatestVersion.mockResolvedValue(null)
    comparisonApi.loadOptions.mockResolvedValue({ domains: ['存款组'], canImport: false })
    comparisonApi.searchRegistrations.mockResolvedValue({ items: [], page: 0, size: 50, total: 0 })
    comparisonApi.loadHeaderFilterOptions.mockResolvedValue({ options: [], matchedRegistrationCount: 0 })
    comparisonApi.synchronizePrimaryKeys.mockResolvedValue({})
    comparisonApi.searchTechnologyOwners.mockResolvedValue([])
    comparisonApi.loadBaseKeys.mockImplementation(async () => {
      const columns = await comparisonApi.loadBaseColumns.mock.results.at(-1)?.value || []
      const names = [...columns].filter(column => column.primaryKey)
        .sort((left, right) => (left.primaryKeyOrder ?? left.ordinalPosition ?? 0) - (right.primaryKeyOrder ?? right.ordinalPosition ?? 0))
        .map(column => column.columnName)
      return names.length ? [{ indexName: 'PRIMARY', indexType: 'PRIMARY_KEY', columnNames: names }] : []
    })
  })

  const registrationRow = { id: 3, tableName: 'acct', tableComment: '账户表', version: 7,
    domainName: '存款组', partitionNum: 16, sampleLimit: 0, fieldPreview: ['id(编号)'], fieldCount: 1 }

  it.each(['add', 'edit', 'reregister'])('passes the comparison key name through the %s save route', async mode => {
    useRealMode()
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    await wrapper.get('[data-testid="add-registration"]').trigger('click')
    wrapper.getComponent(ReplayDatabaseComparisonEditor).vm.$emit('save', {
      mode, id: 3, tableName: 'acct', comparisonKeyName: 'acct_uq', fieldNames: ['code', 'tenant'],
      domain: '存款组', groupOwnerUsername: '101',
    })
    await flushPromises()
    const api = mode === 'add' ? comparisonApi.createRegistration : mode === 'edit' ? comparisonApi.updateRegistration : comparisonApi.reregisterRegistration
    expect(api.mock.calls.at(-1).at(-1)).toMatchObject({ comparisonKeyName: 'acct_uq', fieldNames: ['code', 'tenant'] })
  })

  it('displays the saved comparison index and uses its ordered columns in the scope preview', async () => {
    const comparisonKey = { indexName: 'acct_uq', indexType: 'UNIQUE_INDEX', columnNames: ['code', 'tenant'] }
    const detail = { ...registrationRow, comparisonKey, compareLimit: 10, fields: [
      { columnName: 'id', primaryKey: true }, { columnName: 'tenant' }, { columnName: 'code' },
    ] }
    useRealMode([detail])
    comparisonApi.loadRegistration.mockResolvedValue(detail)
    comparisonApi.loadBaseColumns.mockResolvedValue(detail.fields)
    comparisonApi.loadBaseKeys.mockResolvedValue([comparisonKey])
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    await wrapper.get('[data-testid="view-registration-acct"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="detail-comparison-key"]').text()).toBe('唯一索引 · acct_uq · code、tenant')
    expect(wrapper.get('[data-testid="detail-field-code"]').text()).toContain('唯一索引')
    expect(wrapper.get('[data-testid="detail-field-id"]').text()).not.toContain('主键')
    expect(wrapper.get('[data-testid="detail-field-id"]').text()).not.toContain('比对键')
    expect(wrapper.get('[data-testid="query-condition-acct"] .query-condition-content').text()).toBe('order by code,tenant\nlimit 10')
    await wrapper.get('[data-testid="close-registration-detail"]').trigger('click')
    await wrapper.get('[data-testid="edit-registration-acct"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.loadBaseKeys).toHaveBeenCalledWith('acct')
    expect(wrapper.getComponent(ReplayDatabaseComparisonEditor).props('initialRegistration').comparisonKey).toEqual(comparisonKey)
  })

  it('shows a first-load backend failure without preview rows and clears it after a successful retry', async () => {
    useRealMode([registrationRow])
    comparisonApi.searchRegistrations.mockRejectedValueOnce(Object.assign(new Error('HTTP 503'), { code: 503 }))
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="page-api-error"]').text()).toBe('HTTP 503')
    expect(wrapper.get('[data-testid="page-api-error"]').attributes('role')).toBe('alert')
    expect(wrapper.findAll('[data-testid="registration-row"]')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Mock 数据')
    expect(wrapper.text()).not.toContain('kdpa_cb_acct_fzn_cntl_inf')

    await wrapper.get('[data-testid="reset-filters"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.searchRegistrations).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="page-api-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="registration-row"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="table-name-acct"]').text()).toContain('账户表')
  })

  it('clears stale filter candidates and blocks confirmation after a backend failure until retry succeeds', async () => {
    useRealMode([registrationRow])
    const options = { options: [{ value: '存款组', label: '存款组', count: 1 }], matchedRegistrationCount: 1 }
    comparisonApi.loadHeaderFilterOptions
      .mockResolvedValueOnce(options)
      .mockRejectedValueOnce(Object.assign(new Error('筛选服务不可用 HTTP 503'), { code: 503 }))
      .mockResolvedValueOnce(options)
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    await wrapper.get('[data-filter-key="domain"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="header-filter-option"] input').setValue(true)
    await wrapper.get('[data-testid="header-filter-search"]').setValue('存款')
    await wrapper.get('[aria-label="查询筛选选项"]').trigger('click')
    await flushPromises()

    const panel = wrapper.get('[data-testid="header-filter-panel"]')
    expect(panel.get('[role="alert"]').text()).toContain('HTTP 503')
    expect(wrapper.findAll('[data-testid="header-filter-option"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="apply-header-filter"]').element.disabled).toBe(true)
    await wrapper.get('[data-testid="apply-header-filter"]').trigger('click')
    expect(comparisonApi.searchRegistrations).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="table-name-acct"]').exists()).toBe(true)

    await wrapper.get('[aria-label="查询筛选选项"]').trigger('click')
    await flushPromises()
    expect(panel.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="apply-header-filter"]').element.disabled).toBe(false)
    expect(wrapper.findAll('[data-testid="header-filter-option"]')).toHaveLength(1)
    await wrapper.get('[data-testid="apply-header-filter"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.searchRegistrations).toHaveBeenLastCalledWith(expect.objectContaining({ domains: ['存款组'] }))
  })

  it.each(['view', 'edit'])('keeps a failed %s request closed and loads the saved registration on retry', async action => {
    useRealMode([registrationRow])
    comparisonApi.loadRegistration
      .mockRejectedValueOnce(Object.assign(new Error('登记详情 HTTP 503'), { code: 503 }))
      .mockResolvedValueOnce({
        ...registrationRow, groupOwnerEmpNo: '100101', groupOwnerName: '孙海英',
        fields: [{ columnName: 'id', columnComment: '编号', primaryKey: true, existsInBase: true }],
      })
    comparisonApi.loadBaseColumns.mockResolvedValue([{ columnName: 'id', columnComment: '编号', primaryKey: true }])
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    await wrapper.get(`[data-testid="${action}-registration-acct"]`).trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="page-api-error"]').text()).toContain('HTTP 503')
    expect(wrapper.find('[data-testid="registration-detail-dialog"]').exists()).toBe(false)
    expect(wrapper.findComponent(ReplayDatabaseComparisonEditor).exists()).toBe(false)
    expect(comparisonApi.createRegistration).not.toHaveBeenCalled()
    expect(comparisonApi.updateRegistration).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="table-name-acct"]').exists()).toBe(true)

    await wrapper.get(`[data-testid="${action}-registration-acct"]`).trigger('click')
    await flushPromises()
    expect(comparisonApi.loadRegistration).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="page-api-error"]').exists()).toBe(false)
    if (action === 'view') {
      expect(wrapper.get('[data-testid="registration-detail-dialog"]').text()).toContain('id(编号)')
    } else {
      const editor = wrapper.findComponent(ReplayDatabaseComparisonEditor)
      expect(editor.get('[data-testid="editor-title"]').text()).toBe('编辑登记')
      expect(editor.props('initialRegistration')).toMatchObject({ id: 3, version: 7, tableName: 'acct' })
    }
  })

  it('retains the row and deletion confirmation after rejection and reloads only after successful retry', async () => {
    useRealMode([registrationRow])
    comparisonApi.deleteRegistration
      .mockRejectedValueOnce(Object.assign(new Error('删除 HTTP 503'), { code: 503 }))
      .mockResolvedValueOnce({})
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    await wrapper.get('[data-testid="delete-registration-acct"]').trigger('click')
    await wrapper.get('[data-testid="confirm-list-delete"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="page-api-error"]').text()).toContain('HTTP 503')
    expect(wrapper.get('[data-testid="list-delete-confirmation"]').text()).toContain('删除 HTTP 503')
    expect(wrapper.get('[data-testid="table-name-acct"]').exists()).toBe(true)
    expect(comparisonApi.searchRegistrations).toHaveBeenCalledOnce()

    comparisonApi.searchRegistrations.mockResolvedValue({ items: [], page: 0, size: 50, total: 0 })
    await wrapper.get('[data-testid="confirm-list-delete"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.deleteRegistration).toHaveBeenCalledTimes(2)
    expect(comparisonApi.searchRegistrations).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="list-delete-confirmation"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="page-api-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-name-acct"]').exists()).toBe(false)
  })

  it('loads only API data even if the removed preview environment flag remains set', async () => {
    vi.stubEnv('VITE_REPLAY_DB_COMPARE_MOCK', 'true')
    useRealMode([registrationRow])
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    expect(comparisonApi.searchRegistrations).toHaveBeenCalledOnce()
    expect(wrapper.findAll('[data-testid="registration-row"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="table-name-acct"]').text()).toContain('账户表')
    expect(wrapper.text()).not.toContain('Mock 数据')
    expect(wrapper.text()).not.toContain('kdpa_cb_acct_fzn_cntl_inf')
    wrapper.unmount()
    vi.unstubAllEnvs()
  })

  it('requests server pages and resets the offset when page size changes', async () => {
    useRealMode([registrationRow])
    comparisonApi.searchRegistrations
      .mockResolvedValueOnce({ items: [registrationRow], page: 0, size: 50, total: 125 })
      .mockResolvedValueOnce({ items: [{ ...registrationRow, id: 4, tableName: 'loan' }], page: 1, size: 50, total: 125 })
      .mockResolvedValueOnce({ items: [registrationRow], page: 0, size: 100, total: 125 })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="page-summary"]').text()).toContain('第 1 / 3 页')
    await wrapper.get('[data-testid="next-page"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.searchRegistrations).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 50 }))
    expect(wrapper.find('[data-testid="table-name-acct"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="table-name-loan"]').exists()).toBe(true)

    await wrapper.get('[data-testid="page-size"]').setValue('100')
    await flushPromises()
    expect(comparisonApi.searchRegistrations).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, size: 100 }))
    expect(wrapper.get('[data-testid="page-summary"]').text()).toContain('第 1 / 2 页')
    wrapper.unmount()
  })

  it('confirms list deletion, sends the saved version, and reloads the backend result', async () => {
    useRealMode([registrationRow])
    comparisonApi.deleteRegistration.mockResolvedValue({})
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    await wrapper.get('[data-testid="delete-registration-acct"]').trigger('click')
    expect(wrapper.get('[data-testid="list-delete-confirmation"]').text()).toContain('acct')
    expect(comparisonApi.deleteRegistration).not.toHaveBeenCalled()
    comparisonApi.searchRegistrations.mockResolvedValue({ items: [], page: 0, size: 50, total: 0 })
    await wrapper.get('[data-testid="confirm-list-delete"]').trigger('click')
    await flushPromises()

    expect(comparisonApi.deleteRegistration).toHaveBeenCalledWith(3, expect.objectContaining({ version: 7 }))
    expect(comparisonApi.searchRegistrations).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="table-name-acct"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="page-summary"]').text()).toContain('共 0 条')
    wrapper.unmount()
  })

  it('shows backend metadata drift and preserves historical fields in the detail response', async () => {
    const missingFields = {
      ...registrationRow,
      metadataValidation: { status: 'MISSING_FIELDS', missingFieldNames: ['legacy'] },
      fieldPreview: ['id(编号)', 'legacy(历史字段)'],
    }
    const missingTable = {
      ...registrationRow, id: 4, tableName: 'removed_table',
      metadataValidation: { status: 'TABLE_MISSING', missingFieldNames: [] },
      fieldPreview: ['historical_id(历史主键)'],
    }
    useRealMode([missingFields, missingTable])
    comparisonApi.loadRegistration.mockResolvedValue({
      ...missingTable,
      fields: [{ columnName: 'historical_id', columnComment: '历史主键', primaryKey: true, existsInBase: false }],
    })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="table-name-acct"]').text()).toContain('比对字段母库中不存在')
    expect(wrapper.get('[data-testid="list-field-acct-legacy"]').classes()).toContain('is-missing-in-base-preview')
    expect(wrapper.get('[data-testid="table-name-removed_table"]').text()).toContain('母库表已删除')
    await wrapper.get('[data-testid="view-registration-removed_table"]').trigger('click')
    await flushPromises()
    const detail = wrapper.get('[data-testid="registration-detail-dialog"]')
    expect(detail.get('[data-testid="detail-table-missing-warning"]').text()).toContain('当前展示的是历史登记快照')
    expect(detail.text()).toContain('historical_id(历史主键)')
    expect(detail.findAll('.is-missing-in-base')).toHaveLength(0)
    wrapper.unmount()
  })
  it('shows sample limit after query condition and in details without partition controls', async () => {
    useRealMode([registrationRow])
    comparisonApi.loadRegistration.mockResolvedValue({ ...registrationRow, fields: [] })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    const headers = wrapper.findAll('thead th').map(h => h.text())
    expect(headers.indexOf('分区数')).toBe(-1)
    expect(headers.indexOf('样本数')).toBe(headers.indexOf('查询条件') + 1)
    expect(wrapper.get('[data-testid="sample-limit-acct"]').text()).toBe('0')
    await wrapper.get('[data-testid="view-registration-acct"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="detail-sample-limit"]').text()).toBe('0')
    wrapper.unmount()
  })

  it.each([false, true])('maps the existing permission to sample limit editing and ignores partition input (%s)', async allowed => {
    useRealMode([registrationRow])
    comparisonApi.loadOptions.mockResolvedValue({ canConfigurePartitions: allowed })
    comparisonApi.loadRegistration.mockResolvedValue({ ...registrationRow, fields: [{ columnName: 'id', primaryKey: true }], groupOwnerEmpNo: '101' })
    comparisonApi.loadBaseColumns.mockResolvedValue([{ columnName: 'id', primaryKey: true }])
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-registration-acct"]').trigger('click')
    await flushPromises()
    const editor = wrapper.findComponent(ReplayDatabaseComparisonEditor)
    expect(editor.props('canConfigureSampleLimit')).toBe(allowed)
    expect(editor.find('[data-testid="editor-partition-count"]').exists()).toBe(false)
    editor.vm.$emit('save', { mode: 'edit', id: 3, version: 7, tableName: 'acct', fieldNames: ['id'], domain: '存款组', groupOwnerEmpNo: '101', partitionNum: 32, sampleLimit: 500 })
    await flushPromises()
    const body = comparisonApi.updateRegistration.mock.calls[0][1]
    expect(body).not.toHaveProperty('partitionNum')
    if (allowed) expect(body.sampleLimit).toBe(500)
    else expect(body).not.toHaveProperty('sampleLimit')
    wrapper.unmount()
  })

  it.each(['add', 'reregister'])('submits sample limit for authorized %s requests', async mode => {
    useRealMode([])
    comparisonApi.loadOptions.mockResolvedValue({ canConfigurePartitions: true })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    await wrapper.get('[data-testid="add-registration"]').trigger('click')
    wrapper.findComponent(ReplayDatabaseComparisonEditor).vm.$emit('save', {
      mode, id: 3, tableName: 'acct', fieldNames: ['id'], domain: '存款组',
      groupOwnerEmpNo: '101', sampleLimit: 0,
    })
    await flushPromises()
    if (mode === 'add') expect(comparisonApi.createRegistration).toHaveBeenCalledWith(expect.objectContaining({ sampleLimit: 0 }))
    else expect(comparisonApi.reregisterRegistration).toHaveBeenCalledWith(3, expect.objectContaining({ sampleLimit: 0 }))
    wrapper.unmount()
  })

  it.each([undefined, false, true, 'true', 1])('omits the removed partition configuration action for every permission value (%s)', async permission => {
    useRealMode([registrationRow])
    comparisonApi.loadOptions.mockResolvedValue({ canConfigurePartitions: permission })
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await flushPromises()
    expect(wrapper.find('[data-testid="configure-partitions-acct"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('读取配置')
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

  it('loads the first real list without waiting for primary-key synchronization and refreshes after changes', async () => {
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
    comparisonApi.synchronizePrimaryKeys.mockRejectedValue(new Error('BASE unavailable'))
    comparisonApi.loadOptions.mockResolvedValue({ domains: ['存款组'], canImport: false })
    comparisonApi.searchRegistrations.mockResolvedValue({ items: [], page: 0, size: 50, total: 0 })

    mount(ReplayDatabaseComparisonPage)
    await flushPromises()

    expect(comparisonApi.searchRegistrations).toHaveBeenCalledOnce()
  })

  it('loads server pages and details through the backend API', async () => {
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

  it('keeps the initial import dialog open and renders the complete error list', async () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)
    await wrapper.get('[data-testid="open-initial-import"]').trigger('click')

    const dialog = wrapper.get('[data-testid="initial-import-dialog"]')
    expect(dialog.text()).toContain('存款、贷款、公共、结算')
    expect(dialog.text()).toContain('C 列：表英文名')
    expect(dialog.text()).toContain('E 列：字段英文名')
    expect(dialog.text()).toContain('领域和负责人以数据库表人员清单为准')

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

  it('maps the synthetic table option to metadata status for real searches', async () => {
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

  it('keeps the editor open and requires index reselection after the selected primary key changes', async () => {
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
      .map(row => row.get('strong').text().replace(/^\d+\.\s*/, ''))).toEqual(['a', 'd'])
    expect(editor.get('[data-testid="comparison-key-error"]').text()).toContain('已删除或发生变化')
    expect(editor.get('[data-testid="submit-registration"]').element.disabled).toBe(true)
    expect(editor.find('[data-testid="primary-key-drift-warning"]').exists()).toBe(false)
  })

  it('keeps the editor open and blocks saving after a missing-primary-key response', async () => {
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
      .toContain('该表没有主键或唯一索引，请联系 DBA 创建可用索引')
    expect(editor.findAll('[data-testid="selected-field-row"]')
      .map(row => row.get('strong').text().replace(/^\d+\.\s*/, ''))).toEqual(['acct_no', 'status'])
    expect(editor.get('[data-testid="submit-registration"]').attributes('disabled')).toBeDefined()
  })

})
