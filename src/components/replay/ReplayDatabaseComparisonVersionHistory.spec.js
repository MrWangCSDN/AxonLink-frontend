import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/replayDatabaseComparison.js', () => ({
  downloadVersionConfigScript: vi.fn(),
  generateVersionConfigScript: vi.fn(),
  loadVersionConfigScriptStatus: vi.fn(),
  loadVersions: vi.fn(),
  searchVersionSnapshot: vi.fn(),
  loadVersionHeaderFilterOptions: vi.fn(),
}))

import * as comparisonApi from '../../api/replayDatabaseComparison.js'
import ReplayDatabaseComparisonVersionHistory from './ReplayDatabaseComparisonVersionHistory.vue'

describe('ReplayDatabaseComparisonVersionHistory', () => {
  beforeEach(() => {
    Object.values(comparisonApi).forEach(value => value.mockReset())
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

    expect(comparisonApi.generateVersionConfigScript).toHaveBeenCalledWith('20260914-150101')
    expect(wrapper.get('[data-testid="config-script-action"]').text()).toContain('下载配置脚本')

    await wrapper.get('[data-testid="config-script-action"]').trigger('click')
    await flushPromises()
    expect(comparisonApi.downloadVersionConfigScript).toHaveBeenCalledWith('20260914-150101')
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
