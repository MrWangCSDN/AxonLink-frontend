import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const workbook = vi.hoisted(() => ({ exportVersionDetails: vi.fn() }))

vi.mock('./versionDetailWorkbook.js', () => workbook)

vi.mock('../../api/replayDatabaseComparison.js', () => ({
  downloadVersionConfigScript: vi.fn(),
  generateVersionConfigScript: vi.fn(),
  loadVersionConfigScriptStatus: vi.fn(),
  loadVersions: vi.fn(),
  searchVersionSnapshot: vi.fn(),
  loadVersionHeaderFilterOptions: vi.fn(),
  listScriptConfigurations: vi.fn(), getScriptConfiguration: vi.fn(), createScriptConfiguration: vi.fn(),
  updateScriptConfiguration: vi.fn(), importScriptConfigurationTables: vi.fn(), downloadScriptConfiguration: vi.fn(), previewScriptConfigurationMetadata: vi.fn(),
}))

import * as comparisonApi from '../../api/replayDatabaseComparison.js'
import ReplayDatabaseComparisonVersionHistory from './ReplayDatabaseComparisonVersionHistory.vue'

describe('ReplayDatabaseComparisonVersionHistory', () => {
  beforeEach(() => {
    workbook.exportVersionDetails.mockReset().mockResolvedValue(undefined)
    Object.values(comparisonApi).forEach(value => value.mockReset())
    comparisonApi.listScriptConfigurations.mockResolvedValue({ items: [] })
    comparisonApi.loadVersions.mockResolvedValue({
      items: [
        { versionNo: '20260914-150101', generatedName: '张三', generatedAt: '2026-09-14T15:01:01', tableCount: 2, fieldCount: 4, latest: true },
        { versionNo: '20260913-120000', generatedName: '李四', generatedAt: '2026-09-13T12:00:00', tableCount: 1, fieldCount: 1, latest: false },
      ],
      page: 0, size: 20, total: 2,
    })
    comparisonApi.searchVersionSnapshot.mockResolvedValue({
      items: [{
        sourceRegistrationId: 7,
        sourceRegistrationVersion: 3,
        tableName: 'acct_master',
        tableComment: '账户主表',
        domainName: '存款组',
        reviserEmpNo: '001',
        reviserUsername: 'c-zhangsan',
        reviserName: '张三',
        groupOwnerEmpNo: '101',
        groupOwnerUsername: 'c-lijingli',
        groupOwnerName: '李经理',
        registeredDate: '2026-09-14',
        whereSql: "(status = '1')",
        compareLimit: 1000,
        fields: [
          { columnName: 'acct_no', columnComment: '账号', primaryKey: true, primaryKeyOrder: 1, comparisonOrder: 1 },
          { columnName: 'customer_no', columnComment: '客户号', primaryKey: false, comparisonOrder: 2 },
        ],
      }],
      page: 0, size: 50, total: 1,
    })
    comparisonApi.loadVersionHeaderFilterOptions.mockResolvedValue({
      options: [{ value: '存款组', label: '存款组', count: 1 }],
      matchedRegistrationCount: 1,
    })
    comparisonApi.loadVersionConfigScriptStatus.mockResolvedValue({ generated: false })
    comparisonApi.generateVersionConfigScript.mockResolvedValue({
      fileName: 'replay-db-compare-config-20260914-150101.sql',
    })
    comparisonApi.downloadVersionConfigScript.mockResolvedValue({
      fileName: 'replay-db-compare-config-20260914-150101.sql',
    })
  })

  it('offers independent named scripts and management even when there are no historical versions', async () => {
    comparisonApi.loadVersions.mockResolvedValue({ items: [] })
    comparisonApi.listScriptConfigurations.mockResolvedValue({ items: [{ id: 7, name: '平台全量', revision: 3, tableCount: 2, fieldCount: 8 }] })
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    const picker = wrapper.get('[data-testid="config-script-target"]')
    expect(picker.findAll('option').map(option => [option.element.value, option.text()])).toEqual([
      ['NEW', '新版本（_new 表）'], ['profile:7', '平台全量'],
    ])
    expect(picker.element.value).toBe('NEW')
    expect(wrapper.get('[data-testid="config-script-action"]').attributes('disabled')).toBeDefined()
    await picker.setValue('profile:7')
    expect(wrapper.get('[data-testid="config-script-action"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-testid="config-script-action"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.downloadScriptConfiguration).toHaveBeenCalledWith(7, 3)
    expect(comparisonApi.generateVersionConfigScript).not.toHaveBeenCalled()
    expect(comparisonApi.downloadVersionConfigScript).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="open-script-manager"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[aria-label="脚本管理"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('downloads named configurations independently of builtin status and history search filters', async () => {
    comparisonApi.loadVersionConfigScriptStatus.mockReturnValue(new Promise(() => {}))
    comparisonApi.listScriptConfigurations.mockResolvedValue({ items: [{ id: 7, name: '平台全量', revision: 3 }] })
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    await wrapper.get('[data-testid="history-domain"]').setValue('存款组')
    await wrapper.get('[data-testid="apply-history-filters"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="config-script-target"]').setValue('profile:7')
    await wrapper.get('[data-testid="config-script-action"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.downloadScriptConfiguration).toHaveBeenCalledExactlyOnceWith(7, 3)
    wrapper.unmount()
  })

  it('refreshes and selects a newly saved named configuration without requiring a historical version', async () => {
    let profiles = []
    comparisonApi.loadVersions.mockResolvedValue({ items: [] })
    comparisonApi.listScriptConfigurations.mockImplementation(async () => ({ items: profiles }))
    comparisonApi.importScriptConfigurationTables.mockResolvedValue({ tables: [{ tableName: 'acct', tableComment: '账户', domainName: '平台组', ownerName: '负责人文字', maxPartitionNum: 64, ignoredFields: [], fields: [{ columnName: 'id', primaryKey: true }] }] })
    comparisonApi.createScriptConfiguration.mockImplementation(async () => {
      const saved = { id: 8, name: '新增方案', revision: 1, tableCount: 1, fieldCount: 1 }
      profiles = [saved]
      return saved
    })
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    await wrapper.get('[data-testid="open-script-manager"]').trigger('click'); await flushPromises()
    await wrapper.get('[data-testid="script-connection-mode"]').setValue('BASE')
    await wrapper.get('[data-testid="script-config-name"]').setValue('新增方案')
    const input = wrapper.get('[data-testid="script-tables-file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['tables'], 'tables.xlsx')] })
    await input.trigger('change')
    await wrapper.get('[data-testid="preview-script-tables"]').trigger('click'); await flushPromises()
    await wrapper.get('[data-testid="save-script-config"]').trigger('click'); await flushPromises()
    expect(wrapper.find('[aria-label="脚本管理"]').exists()).toBe(false)
    const picker = wrapper.get('[data-testid="config-script-target"]')
    const selected = picker.findAll('option').find(option => option.element.selected)
    expect(selected.text()).toContain('本次保存 · 修订 1 · 新增方案')
    await wrapper.get('[data-testid="config-script-action"]').trigger('click'); await flushPromises()
    expect(comparisonApi.downloadScriptConfiguration).toHaveBeenCalledWith(8, 1)
    wrapper.unmount()
  })

  it.each([4, 5])('requests the exact saved migration revision when the list reports revision %s', async currentRevision => {
    const migration = { id: 7, name: '迁移比对', revision: 3, tableCount: 1, fieldCount: 1 }
    const saved = { ...migration, revision: 4 }
    const current = { ...saved, revision: currentRevision }
    comparisonApi.downloadScriptConfiguration.mockImplementation(async (_id, revision) => {
      if (revision !== currentRevision) throw Object.assign(new Error('配置修订已更新，请重新选择'), { status: 409 })
    })
    comparisonApi.loadVersions.mockResolvedValue({ items: [] })
    comparisonApi.listScriptConfigurations.mockResolvedValueOnce({ items: [migration] }).mockResolvedValueOnce({ items: [migration] }).mockResolvedValueOnce({ items: [current] })
    comparisonApi.getScriptConfiguration.mockResolvedValue({
      ...migration, connection: null, tables: [{ tableName: 'acct', tableComment: '账户', domainName: '平台组', ownerName: '负责人', maxPartitionNum: 64, ignoredFields: [], fields: [{ columnName: 'id', primaryKey: true }] }],
    })
    comparisonApi.updateScriptConfiguration.mockResolvedValue(saved)
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    await wrapper.get('[data-testid="open-script-manager"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="script-profile-7"]').trigger('click')
    await flushPromises()

    const connection = { mode: 'CUSTOM', host: 'migration.example.test', port: 5432, database: 'migration', schema: 'public', username: 'reader', password: 'test-password' }
    for (const field of ['mode', 'host', 'database', 'username', 'password']) {
      await wrapper.get(`[data-testid="script-connection-${field}"]`).setValue(connection[field])
    }
    await wrapper.get('[data-testid="save-script-config"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.updateScriptConfiguration).toHaveBeenCalledExactlyOnceWith(7, expect.objectContaining({ connection, revision: 3 }))
    const picker = wrapper.get('[data-testid="config-script-target"]')
    const action = wrapper.get('[data-testid="config-script-action"]')
    await action.trigger('click')
    await flushPromises()
    expect(comparisonApi.downloadScriptConfiguration).toHaveBeenCalledExactlyOnceWith(7, 4)
    expect(picker.findAll('option').find(option => option.element.selected).text()).toContain('本次保存 · 修订 4')
    if (currentRevision === 5) {
      expect(wrapper.get('[data-testid="config-script-errors"]').text()).toContain('配置修订已更新')
      expect(picker.get('option[value="profile:7"]').text()).toContain('当前修订 5')
      await picker.setValue('profile:7')
      await action.trigger('click')
      await flushPromises()
      expect(comparisonApi.downloadScriptConfiguration).toHaveBeenLastCalledWith(7, 5)
      expect(wrapper.find('[data-testid="config-script-errors"]').exists()).toBe(false)
    }
    expect(comparisonApi.generateVersionConfigScript).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('locks named downloads against duplicate clicks and shows revision conflicts without a legacy fallback', async () => {
    let rejectDownload
    comparisonApi.downloadScriptConfiguration.mockReturnValue(new Promise((_, reject) => { rejectDownload = reject }))
    comparisonApi.listScriptConfigurations.mockResolvedValue({ items: [{ id: 7, name: '平台全量', revision: 3 }] })
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    await wrapper.get('[data-testid="config-script-target"]').setValue('profile:7')
    const action = wrapper.get('[data-testid="config-script-action"]')
    await action.trigger('click'); await action.trigger('click')
    expect(comparisonApi.downloadScriptConfiguration).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="config-script-target"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="close-version-history"]').attributes('disabled')).toBeDefined()
    rejectDownload(new Error('配置修订已更新，请重新选择'))
    await flushPromises()
    expect(wrapper.get('[data-testid="config-script-errors"]').text()).toContain('配置修订已更新')
    expect(comparisonApi.downloadVersionConfigScript).not.toHaveBeenCalled()
    expect(action.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows frozen custom SQL, source, result keys and separate registration counts', async () => {
    comparisonApi.loadVersions.mockResolvedValue({ items: [{ versionNo: 'V1', tableCount: 3, customSqlCount: 2, fieldCount: 5, latest: true }] })
    comparisonApi.searchVersionSnapshot.mockResolvedValue({ items: [{ sourceRegistrationId: 11, tableName: 'sql_one', tableComment: '汇总金额',
      customSql: { sql: 'select currency, sum(amount) as total_amt from acct group by currency', sourceTableName: 'acct', resultColumns: [] },
      comparisonKey: { indexType: 'RESULT_KEY', indexName: 'SQL_RESULT_KEY', columnNames: ['currency'] },
      fields: [{ columnName: 'currency' }, { columnName: 'total_amt' }], compareLimit: 10 }], total: 1 })
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    expect(wrapper.get('[data-testid="version-item-V1"]').text()).toContain('普通表登记 1')
    expect(wrapper.get('[data-testid="version-item-V1"]').text()).toContain('SQL 登记 2')
    expect(wrapper.get('[data-testid="version-item-V1"]').text()).toContain('3 个比对项')
    expect(wrapper.get('[data-testid="version-snapshot-table"]').text()).toContain('汇总金额')
    expect(wrapper.get('[data-testid="version-snapshot-table"]').text()).toContain('acct')
    expect(wrapper.get('[data-testid="version-snapshot-table"] tbody tr td strong').text()).toBe('acct')
    expect(wrapper.get('[data-testid="version-snapshot-table"]').text()).not.toContain('sql_one')
    expect(wrapper.get('[data-testid="history-comparison-key-sql_one"]').text()).toBe('结果比对键 · currency')
    expect(wrapper.get('[data-testid="history-query-condition-sql_one"]').text()).toContain('select currency, sum(amount) as total_amt from acct group by currency')
    expect(wrapper.get('[data-testid="history-query-condition-sql_one"]').text()).not.toContain('WHERE select')
    wrapper.unmount()
  })

  it('shows the immutable selected unique index and orders limited snapshots by its complete key', async () => {
    comparisonApi.searchVersionSnapshot.mockResolvedValue({ items: [{
      sourceRegistrationId: 7, tableName: 'acct', compareLimit: 3,
      comparisonKey: { indexName: 'saved_uq', indexType: 'UNIQUE_INDEX', columnNames: ['code', 'tenant'] },
      fields: [{ columnName: 'id', primaryKey: true }, { columnName: 'tenant' }, { columnName: 'code' }],
    }], page: 0, size: 50, total: 1 })
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    expect(wrapper.get('[data-testid="history-comparison-key-acct"]').text()).toBe('唯一索引 · saved_uq · code、tenant')
    expect(wrapper.get('[data-testid="history-query-condition-acct"]').text()).toBe('ORDER BY code, tenant LIMIT 3')
    expect(wrapper.findAll('.comparison-key-badge')).toHaveLength(2)
    expect(wrapper.get('[data-testid="version-snapshot-table"]').text()).not.toContain('比对键')
    expect(wrapper.get('[data-testid="version-snapshot-table"]').text()).not.toContain('主键')
    wrapper.unmount()
  })

  it('displays each selected version sample limit without the legacy partition count', async () => {
    comparisonApi.searchVersionSnapshot.mockImplementation(async versionNo => ({
      items: [{ sourceRegistrationId: 7, tableName: 'acct_master', partitionNum: versionNo === '20260914-150101' ? 16 : 4, sampleLimit: versionNo === '20260914-150101' ? 2500 : 0, maxPartitionNum: versionNo === '20260914-150101' ? 100 : 256, fields: [] }],
      page: 0, size: 50, total: 1,
    }))
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    const headers = wrapper.findAll('thead th').map(header => header.text())
    expect(headers.indexOf('分区数')).toBe(-1)
    expect(headers[headers.indexOf('查询条件') + 1]).toBe('样本数')
    expect(headers[headers.indexOf('样本数') + 1]).toBe('最大hash分区数')
    expect(wrapper.get('[data-testid="history-sample-limit-acct_master"]').text()).toBe('2500')
    expect(wrapper.get('[data-testid="history-max-partition-num-acct_master"]').text()).toBe('100')
    expect(wrapper.get('[data-testid="version-snapshot-table"]').find('input').exists()).toBe(false)
    await wrapper.get('[data-testid="version-item-20260913-120000"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="history-sample-limit-acct_master"]').text()).toBe('0')
    expect(wrapper.get('[data-testid="history-max-partition-num-acct_master"]').text()).toBe('256')
    wrapper.unmount()
  })

  it.each([undefined, null])('defaults missing legacy snapshot sample limit to 100 (%s)', async sampleLimit => {
    comparisonApi.searchVersionSnapshot.mockResolvedValue({
      items: [{ sourceRegistrationId: 7, tableName: 'legacy_table', sampleLimit, maxPartitionNum: sampleLimit, fields: [] }],
      page: 0, size: 50, total: 1,
    })
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    expect(wrapper.get('[data-testid="history-sample-limit-legacy_table"]').text()).toBe('100')
    expect(wrapper.get('[data-testid="history-max-partition-num-legacy_table"]').text()).toBe('64')
    wrapper.unmount()
  })

  it('displays all differences from the frozen version snapshot', async () => {
    comparisonApi.searchVersionSnapshot.mockResolvedValue({
      items: [{ sourceRegistrationId: 7, tableName: 'acct_master', sampleLimit: -1, fields: [] }],
      page: 0, size: 50, total: 1,
    })
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    expect(wrapper.get('[data-testid="history-sample-limit-acct_master"]').text()).toBe('全量')
    wrapper.unmount()
  })

  it('loads newest versions and renders the selected immutable snapshot', async () => {
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()

    expect(comparisonApi.loadVersions).toHaveBeenCalledWith(0, 20)
    expect(comparisonApi.searchVersionSnapshot).toHaveBeenCalledWith(
      '20260914-150101', expect.objectContaining({ page: 0, size: 50 }),
    )
    expect(comparisonApi.loadVersionHeaderFilterOptions).toHaveBeenCalledWith(
      '20260914-150101', expect.objectContaining({ targetColumn: 'domainName' }),
    )
    expect(wrapper.get('[data-testid="version-history-list"]').text()).toContain('最新')
    expect(wrapper.get('[data-testid="version-snapshot-table"]').text()).toContain('acct_master')
    expect(wrapper.get('[data-testid="version-snapshot-table"]').text()).toContain('acct_no(账号)')
    expect(wrapper.get('[data-testid="version-snapshot-table"]').text()).toContain('主键')
    expect(wrapper.get('[data-testid="version-snapshot-table"]').text()).toContain('张三(c-zhangsan)')
    expect(wrapper.get('[data-testid="version-snapshot-table"]').text()).toContain('李经理(c-lijingli)')
    expect(wrapper.get('[data-testid="version-snapshot-table"] thead').text()).toContain('查询条件')
    expect(wrapper.get('[data-testid="history-query-condition-acct_master"]').text())
      .toBe("WHERE (status = '1') ORDER BY acct_no LIMIT 1000")
    expect(wrapper.get('[data-testid="version-snapshot-table"] .field-cell').text()).not.toContain('已配置条件')
    expect(wrapper.get('[data-testid="version-snapshot-table"] .field-cell').text()).not.toContain('限1000条')
    expect(wrapper.text()).not.toContain('母库表已删除')
    expect(wrapper.find('[data-testid^="edit-registration-"]').exists()).toBe(false)
  })

  it('renders full-table text when the version snapshot has no query scope', async () => {
    comparisonApi.searchVersionSnapshot.mockResolvedValueOnce({
      items: [{
        sourceRegistrationId: 8,
        sourceRegistrationVersion: 1,
        tableName: 'full_table_snapshot',
        tableComment: '全表快照',
        domainName: '公共组',
        registeredDate: '2026-09-14',
        fields: [{ columnName: 'id', primaryKey: true, primaryKeyOrder: 1, comparisonOrder: 1 }],
      }],
      page: 0,
      size: 50,
      total: 1,
    })

    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()

    expect(wrapper.get('[data-testid="history-query-condition-full_table_snapshot"]').text()).toBe('全表')
  })

  it('switches version without mutating the current registration page', async () => {
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()

    await wrapper.get('[data-testid="version-item-20260913-120000"]').trigger('click')
    await flushPromises()

    expect(comparisonApi.searchVersionSnapshot).toHaveBeenLastCalledWith(
      '20260913-120000', expect.objectContaining({ page: 0 }),
    )
  })

  it('applies snapshot filters and paginates only inside history', async () => {
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()

    await wrapper.get('[data-testid="history-table-keyword"]').setValue('acct')
    await wrapper.get('[data-testid="history-domain"]').setValue('存款组')
    await wrapper.get('[data-testid="history-reviser"]').setValue('001')
    await wrapper.get('[data-testid="history-group-owner"]').setValue('101')
    await wrapper.get('[data-testid="history-registered-date"]').setValue('2026-09-14')
    await wrapper.get('[data-testid="apply-history-filters"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.searchVersionSnapshot).toHaveBeenLastCalledWith(
      '20260914-150101', expect.objectContaining({
        tableKeyword: 'acct',
        domains: ['存款组'],
        reviserEmpNos: ['001'],
        groupOwnerEmpNos: ['101'],
        registeredDateFrom: '2026-09-14',
        registeredDateTo: '2026-09-14',
        page: 0,
      }),
    )

    comparisonApi.searchVersionSnapshot.mockResolvedValueOnce({ items: [], page: 1, size: 50, total: 60 })
    await wrapper.get('[data-testid="history-next-page"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.searchVersionSnapshot).toHaveBeenLastCalledWith(
      '20260914-150101', expect.objectContaining({ page: 1 }),
    )
  })

  it('closes through the explicit close control', async () => {
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()

    await wrapper.get('[data-testid="close-version-history"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('places detail export beside the script action and disables it without a selected version', async () => {
    comparisonApi.loadVersions.mockResolvedValue({ items: [], page: 0, size: 20, total: 0 })
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()

    const action = wrapper.get('[data-testid="export-details-action"]')
    expect(action.text()).toBe('导出明细')
    expect(action.element.nextElementSibling.dataset.testid).toBe('config-script-action')
    expect(action.attributes('disabled')).toBeDefined()
    await action.trigger('click')
    expect(workbook.exportVersionDetails).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('exports the selected version with captured applied filters across pagination and later edits', async () => {
    let finishExport
    workbook.exportVersionDetails.mockReturnValue(new Promise(resolve => { finishExport = resolve }))
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    await wrapper.get('[data-testid="history-table-keyword"]').setValue('acct')
    await wrapper.get('[data-testid="history-field-keyword"]').setValue('account_no')
    await wrapper.get('[data-testid="history-domain"]').setValue('存款组')
    await wrapper.get('[data-testid="history-reviser"]').setValue('001')
    await wrapper.get('[data-testid="history-group-owner"]').setValue('101')
    await wrapper.get('[data-testid="history-registered-date"]').setValue('2026-09-14')
    await wrapper.get('[data-testid="apply-history-filters"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="history-next-page"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="history-table-keyword"]').setValue('unsubmitted')
    await wrapper.get('[data-testid="history-domain"]').setValue('贷款组')

    await wrapper.get('[data-testid="export-details-action"]').trigger('click')
    expect(workbook.exportVersionDetails).toHaveBeenCalledWith('20260914-150101', {
      tableKeyword: 'acct',
      fieldKeyword: 'account_no',
      domains: ['存款组'],
      reviserEmpNos: ['001'],
      groupOwnerEmpNos: ['101'],
      registeredDateFrom: '2026-09-14',
      registeredDateTo: '2026-09-14',
    })
    const capturedCriteria = workbook.exportVersionDetails.mock.calls[0][1]

    await wrapper.get('[data-testid="apply-history-filters"]').trigger('click')
    await wrapper.get('[data-testid="version-item-20260913-120000"]').trigger('click')
    await flushPromises()
    expect(capturedCriteria.domains).toEqual(['存款组'])
    expect(capturedCriteria.tableKeyword).toBe('acct')
    expect(workbook.exportVersionDetails).toHaveBeenCalledTimes(1)

    finishExport()
    await flushPromises()
    wrapper.unmount()
  })

  it('blocks repeated detail exports while leaving script download available', async () => {
    let finishExport
    workbook.exportVersionDetails.mockReturnValue(new Promise(resolve => { finishExport = resolve }))
    comparisonApi.loadVersionConfigScriptStatus.mockResolvedValue({ generated: true })
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()

    const action = wrapper.get('[data-testid="export-details-action"]')
    await action.trigger('click')
    await action.trigger('click')
    expect(workbook.exportVersionDetails).toHaveBeenCalledTimes(1)
    expect(action.attributes('disabled')).toBeDefined()
    expect(action.text()).toBe('导出中…')
    expect(wrapper.get('[data-testid="config-script-action"]').attributes('disabled')).toBeUndefined()

    finishExport()
    await flushPromises()
    expect(action.attributes('disabled')).toBeUndefined()
    expect(action.text()).toBe('导出明细')
    wrapper.unmount()
  })

  it('isolates applied search filters from nested export criteria changes', async () => {
    workbook.exportVersionDetails.mockImplementation(async (_, criteria) => {
      criteria.domains.push('导出内部条件')
    })
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    await wrapper.get('[data-testid="history-domain"]').setValue('存款组')
    await wrapper.get('[data-testid="apply-history-filters"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="export-details-action"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="history-next-page"]').trigger('click')
    await flushPromises()

    expect(comparisonApi.searchVersionSnapshot).toHaveBeenLastCalledWith('20260914-150101',
      expect.objectContaining({ domains: ['存款组'], page: 1 }))
    wrapper.unmount()
  })

  it('shows detail export failures and allows retry without clearing the snapshot', async () => {
    workbook.exportVersionDetails.mockRejectedValueOnce(new Error('明细数据加载失败'))
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()

    await wrapper.get('[data-testid="export-details-action"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="export-details-errors"]').text()).toContain('明细数据加载失败')
    expect(wrapper.get('[data-testid="version-snapshot-table"]').text()).toContain('acct_master')
    expect(wrapper.get('[data-testid="export-details-action"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-testid="export-details-action"]').trigger('click')
    await flushPromises()
    expect(workbook.exportVersionDetails).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="export-details-errors"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('clears export errors on a version switch and ignores failures after selection changes', async () => {
    let failExport
    workbook.exportVersionDetails.mockRejectedValueOnce(new Error('首次导出失败'))
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    await wrapper.get('[data-testid="export-details-action"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="export-details-errors"]').exists()).toBe(true)

    await wrapper.get('[data-testid="version-item-20260913-120000"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="export-details-errors"]').exists()).toBe(false)
    workbook.exportVersionDetails.mockReturnValueOnce(new Promise((_, reject) => { failExport = reject }))
    await wrapper.get('[data-testid="export-details-action"]').trigger('click')
    await wrapper.get('[data-testid="version-item-20260914-150101"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="version-item-20260913-120000"]').trigger('click')
    await flushPromises()
    failExport(new Error('旧版本导出失败'))
    await flushPromises()
    expect(wrapper.find('[data-testid="export-details-errors"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="export-details-action"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('loads script status whenever the selected version changes', async () => {
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()

    expect(comparisonApi.loadVersionConfigScriptStatus).toHaveBeenCalledWith('20260914-150101')

    await wrapper.get('[data-testid="version-item-20260913-120000"]').trigger('click')
    await flushPromises()

    expect(comparisonApi.loadVersionConfigScriptStatus).toHaveBeenLastCalledWith('20260913-120000')
  })

  it('generates from only the selected version and switches to stored download', async () => {
    comparisonApi.loadVersionConfigScriptStatus
      .mockResolvedValueOnce({ generated: false })
      .mockResolvedValueOnce({
        generated: true,
        fileName: 'replay-db-compare-config-20260914-150101.sql',
        sha256: 'a'.repeat(64),
      })
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    await wrapper.get('[data-testid="history-table-keyword"]').setValue('acct')
    await wrapper.get('[data-testid="apply-history-filters"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="config-script-action"]').trigger('click')
    await flushPromises()

    expect(comparisonApi.generateVersionConfigScript).toHaveBeenCalledWith('20260914-150101', 'NEW')
    expect(wrapper.get('[data-testid="config-script-action"]').text()).toContain('下载配置脚本')

    await wrapper.get('[data-testid="config-script-action"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.downloadVersionConfigScript).toHaveBeenCalledWith('20260914-150101', 'NEW')
  })

  it('downloads new table configuration when the new version is selected', async () => {
    comparisonApi.loadVersionConfigScriptStatus.mockResolvedValue({ generated: true })
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()
    await wrapper.get('[data-testid="config-script-target"]').setValue('NEW')
    await wrapper.get('[data-testid="config-script-action"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.downloadVersionConfigScript).toHaveBeenCalledWith('20260914-150101', 'NEW')
  })

  it('blocks duplicate clicks while script generation is running', async () => {
    let finishGeneration
    comparisonApi.generateVersionConfigScript.mockReturnValue(new Promise(resolve => {
      finishGeneration = resolve
    }))
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()

    const action = wrapper.get('[data-testid="config-script-action"]')
    await action.trigger('click')
    await action.trigger('click')

    expect(comparisonApi.generateVersionConfigScript).toHaveBeenCalledTimes(1)
    expect(action.attributes('disabled')).toBeDefined()
    expect(action.text()).toContain('生成中')

    finishGeneration({ fileName: 'replay-db-compare-config-20260914-150101.sql' })
    await flushPromises()
  })

  it('shows every backend script validation error without clearing the snapshot', async () => {
    const error = new Error('2 项配置无法生成生产脚本')
    error.code = 'CONFIG_SCRIPT_VALIDATION_FAILED'
    error.data = {
      errors: [
        { tableName: 'bad-table', fieldName: null, reason: '表英文名不是合法数据库标识符' },
        { tableName: 'acct_master', fieldName: 'bad field', reason: '字段英文名不是合法数据库标识符' },
      ],
    }
    comparisonApi.generateVersionConfigScript.mockRejectedValue(error)
    const wrapper = mount(ReplayDatabaseComparisonVersionHistory, { props: { open: true } })
    await flushPromises()

    await wrapper.get('[data-testid="config-script-action"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="config-script-errors"]').text()).toContain('bad-table')
    expect(wrapper.get('[data-testid="config-script-errors"]').text()).toContain('bad field')
    expect(wrapper.get('[data-testid="version-snapshot-table"]').text()).toContain('acct_master')
  })
})
