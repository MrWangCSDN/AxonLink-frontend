import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/replayDatabaseComparison.js', () => ({
  loadBaseColumns: vi.fn(),
  searchBaseTables: vi.fn(),
  searchTechnologyOwners: vi.fn(),
}))

import * as comparisonApi from '../../api/replayDatabaseComparison.js'
import { metadataColumns, metadataTables } from './replayDatabaseComparison.spec-fixtures.js'
import ReplayDatabaseComparisonEditor from './ReplayDatabaseComparisonEditor.vue'
import ReplayDatabaseComparisonScopeEditor from './ReplayDatabaseComparisonScopeEditor.vue'

const registrations = [{
  id: 12,
  version: 3,
  tableName: 'kdpa_cb_acct_fzn_cntl_inf',
  tableComment: '对公存款账户冻结控制信息',
  fields: [
    { name: 'fzn_cntl_id', comment: '冻结控制编号' },
    { name: 'currency_cd', comment: '币种' },
  ],
  domain: '存款组',
  owner: '周皓',
  groupOwnerUsername: 'sunhy1',
  groupOwner: '孙海英(sunhy1)',
  date: '2026-09-07',
}]

const waitForTableSearch = async (wrapper, keyword) => {
  await wrapper.get('[data-testid="table-search-input"]').setValue(keyword)
  await new Promise(resolve => setTimeout(resolve, 275))
  await Promise.resolve()
}

const selectedNames = wrapper => wrapper.findAll('[data-testid="selected-field-row"]')
  .map(row => row.get('strong').text().replace(/^\d+\.\s*/, ''))

describe('ReplayDatabaseComparisonEditor', () => {
  beforeEach(() => {
    comparisonApi.searchTechnologyOwners.mockReset().mockResolvedValue([])
    comparisonApi.loadBaseColumns.mockReset().mockImplementation(metadataColumns)
    comparisonApi.searchBaseTables.mockReset().mockImplementation(keyword => metadataTables
      .filter(table => `${table.tableName} ${table.tableComment}`.toLowerCase().includes(keyword.toLowerCase()))
      .map(({ columns, ...table }) => ({
        ...table,
        registrationStatus: table.tableName === registrations[0].tableName ? 'ACTIVE' : 'UNREGISTERED',
        registrationId: table.tableName === registrations[0].tableName ? registrations[0].id : null,
      })))
  })

  it('uses the real metadata API functions by default', async () => {
    comparisonApi.searchBaseTables.mockResolvedValue([{
      tableName: registrations[0].tableName,
      tableComment: registrations[0].tableComment,
      registrationStatus: 'ACTIVE',
      registrationId: registrations[0].id,
    }])
    comparisonApi.loadBaseColumns.mockResolvedValue(metadataColumns(registrations[0].tableName))
    comparisonApi.searchTechnologyOwners.mockResolvedValue([
      { username: 'sunhy1', empNo: '100101', realName: '孙海英', displayName: '孙海英(100101)' },
    ])
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: { registrations } })
    try {
      await waitForTableSearch(wrapper, '冻结')
      expect(comparisonApi.searchBaseTables).toHaveBeenCalledWith('冻结', 20)
      await wrapper.get('[data-testid="table-search-result"]').trigger('click')
      await flushPromises()
      expect(comparisonApi.loadBaseColumns).toHaveBeenCalledWith(registrations[0].tableName)
    } finally {
      wrapper.unmount()
    }
  })

  it('omits manual registration information from the editor', () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: { registrations, initialRegistration: registrations[0] } })
    expect(wrapper.find('.registration-block').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('4. 登记信息')
    expect(wrapper.find('[data-testid="registration-domain"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-owner-search"]').exists()).toBe(false)
  })

  it.each([false, true])('restores sample limit and enforces permission (%s)', async allowed => {
    const registration = { ...registrations[0], sampleLimit: 2500 }
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: registration, registrations: [registration], canConfigureSampleLimit: allowed,
    } })
    const input = wrapper.get('[data-testid="editor-sample-limit"]')
    expect(input.element.value).toBe('2500')
    expect(input.element.disabled).toBe(!allowed)
    if (allowed) {
      for (const value of ['0', '10000']) {
        await input.setValue(value)
        await wrapper.get('[data-testid="submit-registration"]').trigger('click')
        expect(wrapper.emitted('save').at(-1)[0].sampleLimit).toBe(Number(value))
      }
      for (const value of ['', '-1', '10001', '1.5']) {
        await input.setValue(value)
        expect(wrapper.get('[data-testid="submit-registration"]').element.disabled).toBe(true)
      }
    } else {
      await wrapper.get('[data-testid="submit-registration"]').trigger('click')
      expect(wrapper.emitted('save')[0][0]).not.toHaveProperty('sampleLimit')
    }
    wrapper.unmount()
  })

  it.each([undefined, null])('defaults missing sample limit to 100 (%s)', value => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: { ...registrations[0], sampleLimit: value },
    } })
    expect(wrapper.get('[data-testid="editor-sample-limit"]').element.value).toBe('100')
    wrapper.unmount()
  })

  it('shows only the sample limit control for authorized users', () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: registrations[0], canConfigureSampleLimit: true,
    } })
    expect(wrapper.find('[data-testid="editor-partition-count"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="editor-sample-limit"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('searches tables automatically after typing and has no search button', async () => {
    const searchTables = vi.fn().mockReturnValue([{
      tableName: 'kdpa_cb_acct_fzn_cntl_inf',
      tableComment: '对公存款账户冻结控制信息',
      registrationStatus: 'ACTIVE',
    }])
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: { registrations, searchTables } })

    expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(wrapper.get('[data-testid="editor-title"]').text()).toBe('新增登记')
    expect(wrapper.find('[data-testid="table-search-button"]').exists()).toBe(false)
    await waitForTableSearch(wrapper, '冻')
    expect(searchTables).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="table-search-result"]')).toHaveLength(0)

    await waitForTableSearch(wrapper, '冻结')

    expect(searchTables).toHaveBeenCalledWith('冻结', registrations)
    expect(wrapper.findAll('[data-testid="table-search-result"]').length).toBeGreaterThan(0)
  })

  it('switches to edit mode and restores selected fields for an existing table', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: { registrations } })
    await waitForTableSearch(wrapper, '冻结控制信息')
    await wrapper.get('[data-testid="table-search-result"]').trigger('click')

    expect(wrapper.get('[data-testid="editor-title"]').text()).toBe('编辑登记')
    expect(wrapper.get('[data-testid="selected-table"]').text()).toContain('kdpa_cb_acct_fzn_cntl_inf')
    expect(wrapper.get('[data-testid="selected-fields"]').text()).toContain('fzn_cntl_id')
    expect(wrapper.get('[data-testid="selected-fields"]').text()).toContain('currency_cd')
    expect(wrapper.find('[data-testid="table-search-input"]').exists()).toBe(false)
    expect(wrapper.find('.selected-table .text-button').exists()).toBe(false)
  })

  it('restores every registered field that exists in the table metadata', () => {
    const registration = {
      ...registrations[0],
      fields: [
        { name: 'fzn_cntl_id', comment: '冻结控制编号' },
        { name: 'lglpern_cd', comment: '' },
        { name: 'fzn_cntl_amt', comment: '冻结金额' },
        { name: 'currency_cd', comment: '币种' },
        { name: 'effective_dt', comment: '生效日期' },
        { name: 'acct_status', comment: '账户状态' },
      ],
    }
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [registration], initialRegistration: registration },
    })

    expect(wrapper.findAll('[data-testid="selected-field-row"]')).toHaveLength(6)
    expect(wrapper.get('[data-testid="selected-fields"]').text()).toContain('acct_status')
  })

  it('filters selected fields by name or comment', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations, initialRegistration: registrations[0] },
    })

    await wrapper.get('[data-testid="selected-field-search"]').setValue('币种')
    expect(wrapper.findAll('[data-testid="selected-field-row"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="selected-fields"]').text()).toContain('currency_cd')
  })

  it('supports whole-row selection plus select-all and invert on both field panels', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations, initialRegistration: registrations[0] },
    })

    await wrapper.get('[data-testid="available-select-all"]').trigger('click')
    expect(wrapper.findAll('[data-testid="available-field-row"] input:checked').length).toBeGreaterThan(0)
    await wrapper.get('[data-testid="available-invert-selection"]').trigger('click')
    expect(wrapper.findAll('[data-testid="available-field-row"] input:checked')).toHaveLength(0)

    const selectedRow = wrapper.findAll('[data-testid="selected-field-row"]')[1]
    expect(selectedRow.get('input').element.checked).toBe(false)
    await selectedRow.trigger('click')
    expect(selectedRow.get('input').element.checked).toBe(true)
    await wrapper.get('[data-testid="selected-select-all"]').trigger('click')
    expect(wrapper.findAll('[data-testid="selected-field-row"] input:checked')).toHaveLength(1)
    await wrapper.get('[data-testid="selected-invert-selection"]').trigger('click')
    expect(wrapper.findAll('[data-testid="selected-field-row"] input:checked')).toHaveLength(0)
  })

  it('marks primary keys in red on available and selected fields', async () => {
    const selectedWrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations, initialRegistration: registrations[0] },
    })
    expect(selectedWrapper.get('[data-testid="selected-fields"] .primary-key-marker').text()).toBe('主键')

    const availableWrapper = mount(ReplayDatabaseComparisonEditor, { props: { registrations } })
    await waitForTableSearch(availableWrapper, 'customer_ext')
    await availableWrapper.get('[data-testid="table-search-result"]').trigger('click')
    expect(availableWrapper.get('[data-testid="selected-fields"] .primary-key-marker').text()).toBe('主键')
  })

  it('uses the same full-height scroll surface for available and selected fields', () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations, initialRegistration: registrations[0] },
    })

    expect(wrapper.get('[data-testid="available-fields"]').classes()).toContain('field-list-scroll')
    expect(wrapper.get('[data-testid="selected-fields-scroll"]').classes()).toContain('field-list-scroll')
  })

  it('keeps completed fields exact while fuzzy-searching the current segment on both sides', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations, initialRegistration: registrations[0] },
    })
    const hint = '单字段模糊搜索；顿号前精确匹配，最后一段模糊搜索'

    await wrapper.get('[data-testid="available-field-search"]').setValue('fzn_reason_cd、fz')
    expect(wrapper.findAll('[data-testid="available-field-row"]')).toHaveLength(4)
    expect(wrapper.get('[data-testid="available-fields"]').text()).toContain('fzn_reason_cd')
    expect(wrapper.get('[data-testid="available-fields"]').text()).toContain('fzn_new_pk')
    expect(wrapper.get('[data-testid="available-fields"]').text()).toContain('fzn_status')
    expect(wrapper.get('[data-testid="available-fields"]').text()).toContain('fzn_cntl_amt')

    await wrapper.get('[data-testid="available-field-search"]').setValue('fzn_reason_cd、')
    expect(wrapper.findAll('[data-testid="available-field-row"]')).toHaveLength(19)

    await wrapper.get('[data-testid="available-field-search"]').setValue('客户')
    expect(wrapper.findAll('[data-testid="available-field-row"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="available-fields"]').text()).toContain('customer_no')

    await wrapper.get('[data-testid="available-field-search"]').setValue('acct_no、客户')
    await wrapper.get('[data-testid="available-select-all"]').trigger('click')
    await wrapper.get('[data-testid="move-fields-right"]').trigger('click')
    await wrapper.get('[data-testid="selected-field-search"]').setValue('fzn_cntl_id、acct')
    expect(wrapper.findAll('[data-testid="selected-field-row"]')).toHaveLength(2)
    expect(wrapper.get('[data-testid="selected-fields-scroll"]').text()).toContain('fzn_cntl_id')
    expect(wrapper.get('[data-testid="selected-fields-scroll"]').text()).toContain('acct_no')
    expect(wrapper.get('[data-testid="available-field-search"]').attributes('placeholder')).toBe(hint)
    expect(wrapper.get('[data-testid="selected-field-search"]').attributes('placeholder')).toBe(hint)
  })

  it('preserves missing registered fields, highlights them and requires removal before save', async () => {
    const staleRegistration = {
      ...registrations[0],
      fields: [
        ...registrations[0].fields,
        { name: 'legacy_deleted_field', comment: '历史已删除字段' },
      ],
    }
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [staleRegistration], initialRegistration: staleRegistration },
    })

    expect(wrapper.get('[data-testid="missing-fields-warning"]').text()).toContain('1 个字段已从母库删除')
    const missingRow = wrapper.get('[data-missing-field="legacy_deleted_field"]')
    expect(missingRow.classes()).toContain('is-missing-in-base')
    expect(missingRow.text()).toContain('母库已删除')
    expect(missingRow.text()).toContain('历史已删除字段')
    expect(missingRow.findAll('button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.get('[data-testid="submit-registration"]').attributes('disabled')).toBeDefined()

    await missingRow.trigger('click')
    await wrapper.get('[data-testid="move-fields-left"]').trigger('click')

    expect(wrapper.find('[data-testid="missing-fields-warning"]').exists()).toBe(false)
    expect(wrapper.find('[data-missing-field="legacy_deleted_field"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="submit-registration"]').attributes('disabled')).toBeUndefined()
  })

  it('blocks a newly selected table when BASE metadata has no primary key', async () => {
    const noKeyColumns = [
      { columnName: 'customer_no', columnComment: '客户号', primaryKey: false, ordinalPosition: 1 },
      { columnName: 'status', columnComment: '状态', primaryKey: false, ordinalPosition: 2 },
    ]
    const searchTables = vi.fn().mockResolvedValue([{
      tableName: 'no_primary_key_new', tableComment: '无主键新表', registrationStatus: 'UNREGISTERED',
    }])
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { searchTables, loadColumns: () => noKeyColumns },
    })

    await waitForTableSearch(wrapper, 'no_primary')
    await wrapper.get('[data-testid="table-search-result"]').trigger('click')
    await Promise.resolve()

    expect(wrapper.get('[data-testid="primary-key-missing-warning"]').text())
      .toContain('该表没有主键或唯一索引，请联系 DBA 创建可用索引')
    expect(wrapper.get('[data-testid="available-field-search"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="selected-field-search"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="move-fields-right"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="submit-registration"]').attributes('disabled')).toBeDefined()
  })

  it('blocks editing an existing registration after its BASE primary key is removed', () => {
    const registration = {
      ...registrations[0],
      fields: [{ name: 'customer_no', comment: '客户号' }],
    }
    const noKeyColumns = [
      { columnName: 'customer_no', columnComment: '客户号', primaryKey: false, ordinalPosition: 1 },
    ]
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [registration], initialRegistration: registration, loadColumns: () => noKeyColumns },
    })

    expect(wrapper.get('[data-testid="primary-key-missing-warning"]').text())
      .toContain('该表没有主键或唯一索引，请联系 DBA 创建可用索引')
    expect(wrapper.get('[data-testid="selected-field-row"] input').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="move-selected-up-customer_no"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="move-selected-down-customer_no"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="submit-registration"]').attributes('disabled')).toBeDefined()
  })

  it('blocks save when the primary key disappears during final metadata recheck', async () => {
    const initialColumns = [
      { columnName: 'acct_no', columnComment: '账号', primaryKey: true, ordinalPosition: 1 },
      { columnName: 'status', columnComment: '状态', primaryKey: false, ordinalPosition: 2 },
    ]
    const noKeyColumns = [
      { columnName: 'acct_no', columnComment: '账号', primaryKey: false, ordinalPosition: 1 },
      { columnName: 'status', columnComment: '状态', primaryKey: false, ordinalPosition: 2 },
    ]
    const loadColumns = vi.fn()
      .mockReturnValueOnce(initialColumns)
      .mockReturnValueOnce(noKeyColumns)
    const registration = {
      ...registrations[0],
      fields: [
        { name: 'acct_no', comment: '账号' },
        { name: 'status', comment: '状态' },
      ],
    }
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [registration], initialRegistration: registration, loadColumns },
    })

    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    await Promise.resolve()

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(selectedNames(wrapper)).toEqual(['acct_no', 'status'])
    expect(wrapper.get('[data-testid="primary-key-missing-warning"]').text())
      .toContain('该表没有主键或唯一索引，请联系 DBA 创建可用索引')
    expect(wrapper.get('[data-testid="submit-registration"]').attributes('disabled')).toBeDefined()
  })

  it('revalidates BASE fields immediately before save and keeps newly missing fields visible', async () => {
    const currentColumns = [{
      columnName: 'fzn_cntl_id',
      columnComment: '冻结控制编号',
      dataType: 'VARCHAR(40)',
      primaryKey: true,
      ordinalPosition: 1,
    }]
    const loadColumns = vi.fn()
      .mockReturnValueOnce(currentColumns)
      .mockReturnValueOnce([])
    const registration = {
      ...registrations[0],
      fields: [{ name: 'fzn_cntl_id', comment: '冻结控制编号' }],
    }
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [registration], initialRegistration: registration, loadColumns },
    })

    expect(wrapper.find('[data-testid="missing-fields-warning"]').exists()).toBe(false)
    await wrapper.get('[data-testid="submit-registration"]').trigger('click')

    expect(loadColumns).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.get('[data-missing-field="fzn_cntl_id"]').text()).toContain('母库已删除')
  })

  it('opens a missing BASE table as a read-only historical cleanup view without loading columns', () => {
    const loadColumns = vi.fn()
    const missingTableRegistration = {
      ...registrations[0],
      metadataValidation: { status: 'TABLE_MISSING', missingFieldNames: [] },
      fields: [
        { name: 'historical_id', comment: '历史主键', primaryKey: true, existsInBase: false },
        { name: 'historical_status', comment: '历史状态', primaryKey: false, existsInBase: false },
      ],
    }
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [missingTableRegistration], initialRegistration: missingTableRegistration, loadColumns },
    })

    expect(loadColumns).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="table-missing-cleanup-warning"]').text())
      .toContain('只能查看历史登记并删除整表登记')
    expect(wrapper.get('[data-testid="selected-fields"]').text()).toContain('historical_id')
    expect(wrapper.get('[data-testid="selected-fields"] .primary-key-marker').text()).toBe('主键')
    expect(wrapper.findAll('[data-testid="selected-field-row"]')).toHaveLength(2)
    expect(wrapper.findAll('input, select, .field-filters button, .selection-tools button, .selection-actions button')
      .filter(control => control.attributes('data-testid') !== 'submit-registration')
      .every(control => control.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.get('[data-testid="submit-registration"]').text()).toBe('删除整表登记')
    expect(wrapper.get('[data-testid="submit-registration"]').attributes('disabled')).toBeUndefined()
  })

  it('deletes a missing BASE table registration with the cleanup audit reason', async () => {
    const missingTableRegistration = {
      ...registrations[0],
      metadataValidation: { status: 'TABLE_MISSING', missingFieldNames: [] },
    }
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [missingTableRegistration], initialRegistration: missingTableRegistration },
    })

    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    expect(wrapper.get('[data-testid="delete-confirmation"]').text()).toContain('母库表已删除')
    await wrapper.get('[data-testid="confirm-delete-registration"]').trigger('click')

    expect(wrapper.emitted('delete')?.[0]?.[0]).toMatchObject({
      id: 12,
      version: 3,
      tableName: 'kdpa_cb_acct_fzn_cntl_inf',
      reason: '母库表已删除，清理登记',
    })
  })

  it('filters, transfers and reorders primary-key-aware fields', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: { registrations } })
    await waitForTableSearch(wrapper, 'customer_ext')
    await wrapper.get('[data-testid="table-search-result"]').trigger('click')

    expect(wrapper.get('[data-testid="selected-fields"]').text()).toContain('主键')
    await wrapper.get('[data-testid="field-filter-primary"]').trigger('click')
    expect(wrapper.findAll('[data-testid="available-field-row"]')).toHaveLength(0)
    await wrapper.get('[data-testid="field-filter-all"]').trigger('click')

    await wrapper.get('[data-testid="available-field-customer_type"]').setValue(true)
    await wrapper.get('[data-testid="move-fields-right"]').trigger('click')
    expect(wrapper.get('[data-testid="selected-fields"]').text()).toContain('customer_type')

    await wrapper.get('[data-testid="move-selected-up-customer_type"]').trigger('click')
    expect(wrapper.findAll('[data-testid="selected-field-row"]')[0].text()).toContain('customer_type')
  })

  it('shows latest button reorder feedback without an original-position badge', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations, initialRegistration: registrations[0] },
    })

    await wrapper.get('[data-testid="move-selected-up-currency_cd"]').trigger('click')

    expect(wrapper.findAll('[data-testid="selected-field-row"]')[0].text()).toContain('currency_cd')
    expect(wrapper.find('[data-testid="field-order-origin-currency_cd"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="field-order-feedback"]').text())
      .toContain('已将 currency_cd 从第 2 位移至第 1 位')
    expect(wrapper.findAll('[data-testid="selected-field-row"]')[0].classes()).toContain('is-recently-moved')
  })

  it('shows only the latest operation after repeated moves', async () => {
    const registration = {
      ...registrations[0],
      fields: [
        { name: 'fzn_cntl_id', comment: '冻结控制编号' },
        { name: 'lglpern_cd', comment: '法人代码' },
        { name: 'currency_cd', comment: '币种' },
      ],
    }
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [registration], initialRegistration: registration },
    })

    await wrapper.get('[data-testid="move-selected-up-currency_cd"]').trigger('click')
    await wrapper.get('[data-testid="move-selected-up-currency_cd"]').trigger('click')

    expect(wrapper.find('[data-testid="field-order-origin-currency_cd"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="field-order-feedback"]').text())
      .toContain('已将 currency_cd 从第 2 位移至第 1 位')
  })

  it('does not offer undo after a field reorder', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations, initialRegistration: registrations[0] },
    })

    await wrapper.get('[data-testid="move-selected-up-currency_cd"]').trigger('click')

    expect(wrapper.find('[data-testid="undo-field-order"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="field-order-feedback"]').text())
      .toContain('已将 currency_cd 从第 2 位移至第 1 位')
  })

  it('uses the same feedback and save contract for drag reorder', async () => {
    const registration = {
      ...registrations[0],
      fields: [
        { name: 'fzn_cntl_id', comment: '冻结控制编号' },
        { name: 'lglpern_cd', comment: '法人代码' },
        { name: 'currency_cd', comment: '币种' },
      ],
    }
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [registration], initialRegistration: registration },
    })
    const rows = wrapper.findAll('[data-testid="selected-field-row"]')

    await rows[2].trigger('dragstart')
    await rows[0].trigger('drop')

    expect(wrapper.findAll('[data-testid="selected-field-row"]')[0].text()).toContain('currency_cd')
    expect(wrapper.find('[data-testid="field-order-origin-currency_cd"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="field-order-feedback"]').text())
      .toContain('已将 currency_cd 从第 3 位移至第 1 位')

    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    await Promise.resolve()
    expect(wrapper.emitted('save')?.at(-1)?.[0].fieldNames)
      .toEqual(['currency_cd', 'fzn_cntl_id', 'lglpern_cd'])
  })

  it('does not allow inline field removal to bypass the missing-primary-key gate', async () => {
    const noKeyColumns = registrations[0].fields.map((field, index) => ({
      columnName: field.name,
      columnComment: field.comment,
      dataType: 'VARCHAR',
      primaryKey: false,
      ordinalPosition: index + 1,
    }))
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations, initialRegistration: registrations[0], loadColumns: () => noKeyColumns },
    })
    expect(wrapper.get('[data-testid="primary-key-missing-warning"]').text())
      .toContain('该表没有主键或唯一索引，请联系 DBA 创建可用索引')
    expect(wrapper.findAll('[data-testid="selected-field-row"] input[type="checkbox"]')
      .every(checkbox => checkbox.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.get('[data-testid="move-fields-left"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="submit-registration"]').text()).toBe('保存')
    expect(wrapper.get('[data-testid="submit-registration"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-confirmation"]').exists()).toBe(false)
    expect(wrapper.emitted('delete')).toBeUndefined()
  })

  it('rebuilds the primary-key block without showing a drift warning', () => {
    const registration = {
      ...registrations[0],
      fields: ['a', 'b', 'c', 'd', 'e'].map(name => ({ name, comment: name.toUpperCase() })),
      metadataValidation: {
        status: 'VALID',
        primaryKeyChanged: true,
        missingPrimaryKeyNames: ['f'],
        formerPrimaryKeyNames: [],
      },
    }
    const columns = [
      { columnName: 'b', columnComment: 'B', primaryKey: true, primaryKeyOrder: 2, ordinalPosition: 1 },
      { columnName: 'd', columnComment: 'D', primaryKey: false, primaryKeyOrder: null, ordinalPosition: 2 },
      { columnName: 'a', columnComment: 'A', primaryKey: true, primaryKeyOrder: 1, ordinalPosition: 3 },
      { columnName: 'e', columnComment: 'E', primaryKey: false, primaryKeyOrder: null, ordinalPosition: 4 },
      { columnName: 'c', columnComment: 'C', primaryKey: true, primaryKeyOrder: 3, ordinalPosition: 5 },
      { columnName: 'f', columnComment: 'F', primaryKey: true, primaryKeyOrder: 4, ordinalPosition: 6 },
    ]
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [registration], initialRegistration: registration, loadColumns: () => columns },
    })

    expect(selectedNames(wrapper)).toEqual(['a', 'b', 'c', 'f', 'd', 'e'])
    expect(wrapper.find('[data-testid="primary-key-drift-warning"]').exists()).toBe(false)
  })

  it('downgrades an existing former composite key without requiring save', () => {
    const registration = {
      ...registrations[0],
      fields: [
        { name: 'a', comment: '主键A', primaryKey: true },
        { name: 'b', comment: '原主键B', primaryKey: true },
        { name: 'c', comment: '普通字段C', primaryKey: false },
        { name: 'd', comment: '普通字段D', primaryKey: false },
      ],
      metadataValidation: {
        status: 'VALID',
        primaryKeyChanged: false,
        missingPrimaryKeyNames: [],
        formerPrimaryKeyNames: [],
      },
    }
    const columns = [
      { columnName: 'a', columnComment: '主键A', primaryKey: true, primaryKeyOrder: 1, ordinalPosition: 1 },
      { columnName: 'b', columnComment: '原主键B', primaryKey: false, primaryKeyOrder: null, ordinalPosition: 2 },
      { columnName: 'c', columnComment: '普通字段C', primaryKey: false, primaryKeyOrder: null, ordinalPosition: 3 },
      { columnName: 'd', columnComment: '普通字段D', primaryKey: false, primaryKeyOrder: null, ordinalPosition: 4 },
    ]
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [registration], initialRegistration: registration, loadColumns: () => columns },
    })

    expect(selectedNames(wrapper)).toEqual(['a', 'b', 'c', 'd'])
    expect(wrapper.find('[data-testid="primary-key-drift-warning"]').exists()).toBe(false)
    const selectedRows = wrapper.findAll('[data-testid="selected-field-row"]')
    expect(selectedRows[0].get('input').attributes('disabled')).toBeDefined()
    expect(selectedRows[1].get('input').attributes('disabled')).toBeUndefined()
    expect(selectedRows[1].find('.primary-key-marker').exists()).toBe(false)
  })

  it('protects current BASE primary keys from removal but keeps them sortable', async () => {
    const registration = {
      ...registrations[0],
      fields: [
        { name: 'a', comment: '主键A', primaryKey: true },
        { name: 'd', comment: '普通字段D', primaryKey: false },
      ],
    }
    const columns = [
      { columnName: 'a', columnComment: '主键A', primaryKey: true, primaryKeyOrder: 1, ordinalPosition: 1 },
      { columnName: 'd', columnComment: '普通字段D', primaryKey: false, primaryKeyOrder: null, ordinalPosition: 2 },
    ]
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [registration], initialRegistration: registration, loadColumns: () => columns },
    })
    const keyRow = wrapper.findAll('[data-testid="selected-field-row"]')[0]

    expect(keyRow.get('input').attributes('disabled')).toBeDefined()
    expect(keyRow.get('input').attributes('title')).toBe('母库主键，不可移除')
    const downButton = wrapper.get('[data-testid="move-selected-down-a"]')
    expect(downButton.attributes('disabled')).toBeUndefined()
    await downButton.trigger('click')
    expect(selectedNames(wrapper)).toEqual(['d', 'a'])
    await wrapper.get('[data-testid="selected-select-all"]').trigger('click')
    expect(wrapper.findAll('[data-testid="selected-field-row"] input:checked')).toHaveLength(1)
    await wrapper.get('[data-testid="move-fields-left"]').trigger('click')
    expect(selectedNames(wrapper)).toEqual(['a'])
  })

  it('shows newly added BASE primary keys before allowing save', async () => {
    const registration = {
      ...registrations[0],
      fields: [
        { name: 'a', comment: '主键A', primaryKey: true },
        { name: 'd', comment: '普通字段D', primaryKey: false },
      ],
      metadataValidation: { status: 'VALID', primaryKeyChanged: false },
    }
    const initialColumns = [
      { columnName: 'a', columnComment: '主键A', primaryKey: true, primaryKeyOrder: 1, ordinalPosition: 1 },
      { columnName: 'd', columnComment: '普通字段D', primaryKey: false, primaryKeyOrder: null, ordinalPosition: 2 },
    ]
    const changedColumns = [
      ...initialColumns,
      { columnName: 'f', columnComment: '新增主键F', primaryKey: true, primaryKeyOrder: 2, ordinalPosition: 3 },
    ]
    const loadColumns = vi.fn()
      .mockReturnValueOnce(initialColumns)
      .mockReturnValue(changedColumns)
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [registration], initialRegistration: registration, loadColumns },
    })

    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    await Promise.resolve()

    expect(wrapper.emitted('save')).toBeUndefined()
    expect(selectedNames(wrapper)).toEqual(['a', 'f', 'd'])
    expect(wrapper.find('[data-testid="primary-key-drift-warning"]').exists()).toBe(false)

    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    await Promise.resolve()

    expect(wrapper.emitted('save')?.[0]?.[0].fieldNames).toEqual(['a', 'f', 'd'])
  })

  it('re-registers a deleted table without restoring historical fields', async () => {
    const searchTables = vi.fn().mockResolvedValue([{
      tableName: 'acct_master', tableComment: '账户主表', registrationStatus: 'DELETED',
      registrationId: 77, registrationVersion: 4,
    }])
    const loadRegistration = vi.fn().mockResolvedValue({
      id: 77, version: 4, tableName: 'acct_master', domain: '存款组',
      groupOwnerUsername: '101', groupOwnerName: '赵经理', partitionNum: 16, sampleLimit: 0,
      fields: [{ name: 'legacy_field', comment: '历史字段' }],
    })
    const loadColumns = vi.fn().mockResolvedValue([{
      columnName: 'acct_no', columnComment: '账号', primaryKey: true, ordinalPosition: 1,
    }])
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { searchTables, loadRegistration, loadColumns, canConfigureSampleLimit: true },
    })

    await waitForTableSearch(wrapper, 'acct')
    await wrapper.get('[data-testid="table-search-result"]').trigger('click')
    await Promise.resolve()

    expect(wrapper.get('[data-testid="editor-title"]').text()).toBe('重新登记')
    expect(wrapper.findAll('[data-testid="selected-field-row"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="selected-fields"]').text()).toContain('acct_no')
    expect(wrapper.text()).not.toContain('legacy_field')
    expect(wrapper.find('.selected-table .text-button').exists()).toBe(true)
    expect(loadRegistration).toHaveBeenCalledWith(77)
    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    await Promise.resolve()
    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      mode: 'reregister', id: 77, version: 4, fieldNames: ['acct_no'], sampleLimit: 0,
    })
  })

  it('loads and saves the structured comparison scope', async () => {
    const registration = {
      ...registrations[0],
      whereCondition: {
        connector: 'AND',
        groups: [{ connector: 'AND', conditions: [
          { columnName: 'status_cd', operator: 'EQ', values: ['1'] },
        ] }],
      },
      compareLimit: 1000,
    }
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [registration], initialRegistration: registration },
    })
    const scope = wrapper.findComponent(ReplayDatabaseComparisonScopeEditor)
    expect(scope.props('compareLimit')).toBe(1000)
    scope.vm.$emit('update:compareLimit', 2000)
    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    await Promise.resolve()

    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      whereCondition: registration.whereCondition,
      compareLimit: 2000,
    })
  })

  it('warns when the ordered primary keys used by a limited comparison changed', () => {
    const registration = {
      ...registrations[0],
      compareLimit: 1000,
      metadataValidation: {
        status: 'ORDERING_PRIMARY_KEY_CHANGED',
        orderingPrimaryKeyChanged: true,
        savedOrderingPrimaryKeyNames: ['acct_no', 'tenant_id'],
        currentOrderingPrimaryKeyNames: ['tenant_id', 'acct_no'],
      },
    }

    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations: [registration], initialRegistration: registration },
    })

    const warning = wrapper.get('[data-testid="ordering-primary-key-warning"]')
    expect(warning.text()).toContain('排序主键已变更')
    expect(warning.text()).toContain('原顺序：acct_no、tenant_id')
    expect(warning.text()).toContain('当前顺序：tenant_id、acct_no')
  })
  it.each(['rejection', 'throw'])('reports initial BASE metadata %s without treating the table as missing fields or lacking a primary key', async failureMode => {
    const fail = () => {
      const error = new Error('BASE 母库暂时不可用（503）')
      if (failureMode === 'throw') throw error
      return Promise.reject(error)
    }
    const loadColumns = vi.fn()
      .mockImplementationOnce(fail)
      .mockImplementation(metadataColumns)
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: registrations[0], registrations, loadColumns,
    } })
    try {
      await flushPromises()
      expect(wrapper.get('[data-testid="registration-metadata-error"]').text()).toContain('BASE 母库暂时不可用（503）')
      expect(wrapper.find('[data-testid="primary-key-missing-warning"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="missing-fields-warning"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="submit-registration"]').element.disabled).toBe(true)
      expect(wrapper.get('[data-testid="submit-registration"]').text()).toBe('保存')
      expect(wrapper.emitted('save')).toBeUndefined()
      expect(wrapper.emitted('delete')).toBeUndefined()

      await wrapper.get('[data-testid="retry-registration-metadata"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="registration-metadata-error"]').exists()).toBe(false)
      expect(selectedNames(wrapper)).toEqual(['fzn_cntl_id', 'currency_cd'])
      expect(wrapper.get('[data-testid="submit-registration"]').element.disabled).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('reports registration-detail failures and retries before allowing edits or deletion', async () => {
    const loadRegistration = vi.fn()
      .mockRejectedValueOnce(new Error('登记查询服务暂时不可用'))
      .mockResolvedValue(registrations[0])
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      searchTables: () => [{
        tableName: registrations[0].tableName, tableComment: registrations[0].tableComment,
        registrationStatus: 'ACTIVE', registrationId: registrations[0].id,
      }],
      loadRegistration,
    } })
    try {
      await waitForTableSearch(wrapper, '冻结')
      await wrapper.get('[data-testid="table-search-result"]').trigger('click')
      await flushPromises()
      expect(wrapper.get('[data-testid="registration-metadata-error"]').text()).toContain('登记查询服务暂时不可用')
      expect(wrapper.get('[data-testid="submit-registration"]').element.disabled).toBe(true)
      expect(wrapper.get('[data-testid="submit-registration"]').text()).toBe('保存')
      expect(comparisonApi.loadBaseColumns).not.toHaveBeenCalled()
      expect(wrapper.emitted('save')).toBeUndefined()
      expect(wrapper.emitted('delete')).toBeUndefined()

      await wrapper.get('[data-testid="retry-registration-metadata"]').trigger('click')
      await flushPromises()
      expect(loadRegistration).toHaveBeenCalledTimes(2)
      expect(wrapper.find('[data-testid="registration-metadata-error"]').exists()).toBe(false)
      expect(selectedNames(wrapper)).toEqual(['fzn_cntl_id', 'currency_cd'])
      expect(wrapper.get('[data-testid="submit-registration"]').element.disabled).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps the entire edited draft when the final BASE recheck fails and saves it after retry', async () => {
    const columns = metadataColumns(registrations[0].tableName)
    const loadColumns = vi.fn()
      .mockReturnValueOnce(columns)
      .mockRejectedValueOnce(new Error('母库连接超时，请稍后重试'))
      .mockResolvedValue(columns)
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: registrations[0], registrations, loadColumns, canConfigureSampleLimit: true,
    } })
    try {
      await wrapper.get('[data-testid="editor-sample-limit"]').setValue('13')
      await wrapper.get('[data-testid="move-selected-up-currency_cd"]').trigger('click')
      const condition = { connector: 'AND', groups: [{ connector: 'AND', conditions: [
        { columnName: 'currency_cd', operator: 'EQ', values: ['CNY'] },
      ] }] }
      const scope = wrapper.getComponent(ReplayDatabaseComparisonScopeEditor)
      scope.vm.$emit('update:modelValue', condition)
      scope.vm.$emit('update:compareLimit', 100)
      await flushPromises()
      await wrapper.get('[data-testid="submit-registration"]').trigger('click')
      await flushPromises()

      expect(wrapper.emitted('save')).toBeUndefined()
      expect(wrapper.get('[data-testid="registration-metadata-error"]').text()).toContain('母库连接超时，请稍后重试')
      expect(selectedNames(wrapper)).toEqual(['currency_cd', 'fzn_cntl_id'])
      expect(wrapper.get('[data-testid="editor-sample-limit"]').element.value).toBe('13')
      expect(scope.props('modelValue')).toEqual(condition)
      expect(scope.props('compareLimit')).toBe(100)
      expect(wrapper.find('[data-testid="primary-key-missing-warning"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="missing-fields-warning"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="submit-registration"]').element.disabled).toBe(false)

      await wrapper.get('[data-testid="retry-registration-metadata"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="registration-metadata-error"]').exists()).toBe(false)
      expect(wrapper.emitted('save')).toHaveLength(1)
      expect(wrapper.emitted('save')[0][0]).toMatchObject({
        fieldNames: ['currency_cd', 'fzn_cntl_id'],
        sampleLimit: 13, whereCondition: condition, compareLimit: 100,
      })
    } finally {
      wrapper.unmount()
    }
  })

  it('preserves selected fields when refreshing metadata after a server primary-key conflict fails', async () => {
    const columns = metadataColumns(registrations[0].tableName)
    const loadColumns = vi.fn()
      .mockReturnValueOnce(columns)
      .mockRejectedValueOnce(new Error('主键刷新时母库不可用'))
      .mockResolvedValue(columns)
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: registrations[0], registrations, loadColumns,
    } })
    try {
      await wrapper.setProps({ saveError: { type: 'PRIMARY_KEY_CHANGED' } })
      await flushPromises()
      expect(wrapper.get('[data-testid="registration-metadata-error"]').text()).toContain('主键刷新时母库不可用')
      expect(selectedNames(wrapper)).toEqual(['fzn_cntl_id', 'currency_cd'])
      expect(wrapper.find('[data-testid="primary-key-missing-warning"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="submit-registration"]').element.disabled).toBe(true)
      expect(wrapper.emitted('save')).toBeUndefined()

      await wrapper.get('[data-testid="retry-registration-metadata"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="registration-metadata-error"]').exists()).toBe(false)
      expect(selectedNames(wrapper)).toEqual(['fzn_cntl_id', 'fzn_new_pk', 'currency_cd'])
      expect(wrapper.get('[data-testid="submit-registration"]').element.disabled).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  const keyColumns = [
    { columnName: 'id', primaryKey: true, primaryKeyOrder: 1, ordinalPosition: 1 },
    { columnName: 'tenant', primaryKey: false, nullable: true, ordinalPosition: 2 },
    { columnName: 'code', primaryKey: false, nullable: true, ordinalPosition: 3 },
  ]
  const primary = { indexName: 'acct_pkey', indexType: 'PRIMARY_KEY', columnNames: ['id'] }
  const unique = { indexName: 'acct_uq', indexType: 'UNIQUE_INDEX', columnNames: ['code', 'tenant'] }
  const keyRegistration = { ...registrations[0], fields: [{ name: 'id' }] }

  it('defaults to the physical primary key and switches whole nullable unique indexes without changing primary metadata', async () => {
    const loadKeys = vi.fn().mockResolvedValue([unique, primary])
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: keyRegistration, loadColumns: () => keyColumns, loadKeys,
    } })
    await flushPromises()
    expect(wrapper.get('[data-testid="comparison-key-select"]').element.value).toBe('acct_pkey')
    expect(selectedNames(wrapper)).toEqual(['id'])
    expect(wrapper.get('[data-testid="comparison-key-select"]').text()).toContain('唯一索引 · acct_uq · code、tenant')
    await wrapper.get('[data-testid="comparison-key-select"]').setValue('acct_uq')
    expect(selectedNames(wrapper)).toEqual(['code', 'tenant'])
    const rows = wrapper.findAll('[data-testid="selected-field-row"]')
    expect(rows).toHaveLength(2)
    expect(rows.every(row => row.get('input').element.disabled)).toBe(true)
    expect(rows.every(row => row.text().includes('唯一索引') && !row.text().includes('比对键'))).toBe(true)
    expect(wrapper.findAll('[data-testid="selected-fields"] .primary-key-marker')).toHaveLength(0)
    wrapper.getComponent(ReplayDatabaseComparisonScopeEditor).vm.$emit('update:compareLimit', 5)
    await flushPromises()
    expect(wrapper.getComponent(ReplayDatabaseComparisonScopeEditor).props('primaryKeyColumns')).toEqual(['code', 'tenant'])
    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    await flushPromises()
    expect(loadKeys).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('save')[0][0]).toMatchObject({ comparisonKeyName: 'acct_uq', fieldNames: ['code', 'tenant'] })
    wrapper.unmount()
  })

  it('replaces only the old index fields when switching back and forth while retaining ordinary fields', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: { ...keyRegistration, fields: [{ name: 'id' }, { name: 'memo' }] },
      loadColumns: () => [...keyColumns, { columnName: 'memo', primaryKey: false, ordinalPosition: 4 }],
      loadKeys: () => [primary, unique],
    } })
    await flushPromises()
    expect(selectedNames(wrapper)).toEqual(['id', 'memo'])
    expect(wrapper.get('[data-testid="selected-field-row"]').text()).toContain('主键')
    await wrapper.get('[data-testid="comparison-key-select"]').setValue('acct_uq')
    expect(selectedNames(wrapper)).toEqual(['memo', 'code', 'tenant'])
    await wrapper.get('[data-testid="comparison-key-select"]').setValue('acct_pkey')
    expect(selectedNames(wrapper)).toEqual(['memo', 'id'])
    const selectedRows = wrapper.findAll('[data-testid="selected-field-row"]')
    expect(selectedRows[0].text()).not.toContain('唯一索引')
    expect(selectedRows[1].text()).toContain('主键')
    expect(selectedRows[1].get('input').element.disabled).toBe(true)
    wrapper.unmount()
  })

  it('restores a saved unique selection and supports tables with only unique indexes', async () => {
    const registration = { ...keyRegistration, comparisonKey: unique, fields: [{ name: 'tenant' }] }
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: registration, loadColumns: () => keyColumns.map(column => ({ ...column, primaryKey: false })),
      loadKeys: () => [unique, { ...unique, indexName: 'z_last' }],
    } })
    await flushPromises()
    expect(wrapper.get('[data-testid="comparison-key-select"]').element.value).toBe('acct_uq')
    expect(selectedNames(wrapper)).toEqual(['tenant', 'code'])
    expect(wrapper.find('[data-testid="primary-key-missing-warning"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="submit-registration"]').element.disabled).toBe(false)
    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('save')[0][0].comparisonKeyName).toBe('acct_uq')
    wrapper.unmount()
  })

  it('keeps every selected unique-index column locked even when its mother-table column is missing', async () => {
    const registration = {
      ...keyRegistration,
      comparisonKey: unique,
      fields: [{ name: 'code' }, { name: 'tenant' }, { name: 'id' }, { name: 'memo' }],
    }
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: registration,
      loadColumns: () => [...keyColumns.filter(column => column.columnName !== 'code'),
        { columnName: 'memo', primaryKey: false, ordinalPosition: 4 }],
      loadKeys: () => [primary, unique],
    } })
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="selected-field-row"]')
    expect(selectedNames(wrapper)).toEqual(['code', 'tenant', 'memo'])
    expect(rows[0].get('input').element.disabled).toBe(true)
    expect(rows[1].get('input').element.disabled).toBe(true)
    expect(rows[2].get('input').element.disabled).toBe(false)
    await wrapper.get('[data-testid="selected-select-all"]').trigger('click')
    expect(rows[0].get('input').element.checked).toBe(false)
    expect(rows[1].get('input').element.checked).toBe(false)
    expect(rows[2].get('input').element.checked).toBe(true)
    await wrapper.get('[data-testid="move-fields-left"]').trigger('click')
    expect(selectedNames(wrapper)).toEqual(['code', 'tenant'])
    wrapper.unmount()
  })

  it('uses the first unique index by stable name when there is no primary key or saved choice', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: keyRegistration,
      loadColumns: () => keyColumns.map(column => ({ ...column, primaryKey: false })),
      loadKeys: () => [{ ...unique, indexName: 'z_last' }, unique],
    } })
    await flushPromises()
    expect(wrapper.get('[data-testid="comparison-key-select"]').element.value).toBe('acct_uq')
    expect(selectedNames(wrapper)).toEqual(['id', 'code', 'tenant'])
    wrapper.unmount()
  })

  it.each([{ keys: [] }, { keys: [{ ...unique, columnNames: ['tenant', 'code'] }] }])('blocks saving a removed or changed selected index without silently falling back (%j)', async ({ keys: changedKeys }) => {
    const loadKeys = vi.fn().mockReturnValueOnce([primary, unique]).mockReturnValue([primary, ...changedKeys])
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: { ...keyRegistration, comparisonKey: unique }, loadColumns: () => keyColumns, loadKeys,
    } })
    await flushPromises()
    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.get('[data-testid="comparison-key-error"]').text()).toContain('已删除或发生变化')
    expect(wrapper.get('[data-testid="comparison-key-select"]').element.value).toBe('acct_uq')
    expect(wrapper.get('[data-testid="submit-registration"]').element.disabled).toBe(true)
    await wrapper.get('[data-testid="comparison-key-select"]').setValue('acct_pkey')
    expect(wrapper.find('[data-testid="comparison-key-error"]').exists()).toBe(false)
    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('save')[0][0].comparisonKeyName).toBe('acct_pkey')
    wrapper.unmount()
  })

  it('blocks a table with no primary or unique index even if physical column flags are present', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: keyRegistration, loadColumns: () => keyColumns, loadKeys: () => [],
    } })
    await flushPromises()
    expect(wrapper.get('[data-testid="primary-key-missing-warning"]').text()).toContain('没有主键或唯一索引')
    expect(wrapper.get('[data-testid="submit-registration"]').element.disabled).toBe(true)
    wrapper.unmount()
  })

  it.each(['UNREGISTERED', 'DELETED'])('defaults a table with only unique indexes to the complete first key (%s)', async registrationStatus => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      searchTables: () => [{ tableName: 'unique_only', registrationStatus }],
      loadColumns: () => keyColumns.map(column => ({ ...column, primaryKey: false })),
      loadKeys: () => [{ ...unique, indexName: 'z_last' }, unique],
    } })
    await waitForTableSearch(wrapper, 'unique')
    await wrapper.get('[data-testid="table-search-result"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="comparison-key-select"]').element.value).toBe('acct_uq')
    expect(selectedNames(wrapper)).toEqual(['code', 'tenant'])
    expect(wrapper.find('[data-testid="primary-key-missing-warning"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('isolates late index metadata when selecting another table', async () => {
    let finishFirst
    const firstKeys = new Promise(resolve => { finishFirst = resolve })
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      searchTables: () => ['first', 'second'].map(tableName => ({ tableName, registrationStatus: 'UNREGISTERED' })),
      loadColumns: () => keyColumns,
      loadKeys: tableName => tableName === 'first' ? firstKeys : [{ ...unique, indexName: 'second_uq' }],
    } })
    await waitForTableSearch(wrapper, 'table')
    await wrapper.findAll('[data-testid="table-search-result"]')[0].trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="selected-table"] .text-button').trigger('click')
    await wrapper.findAll('[data-testid="table-search-result"]')[1].trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="comparison-key-select"]').element.value).toBe('second_uq')
    finishFirst([primary])
    await flushPromises()
    expect(wrapper.get('[data-testid="selected-table"]').text()).toContain('second')
    expect(wrapper.get('[data-testid="comparison-key-select"]').element.value).toBe('second_uq')
    expect(selectedNames(wrapper)).toEqual(['code', 'tenant'])
    wrapper.unmount()
  })

  it('preserves a chosen index and the draft when key refresh fails and saves on retry', async () => {
    const loadKeys = vi.fn().mockResolvedValueOnce([primary, unique])
      .mockRejectedValueOnce(new Error('索引元数据不可用')).mockResolvedValue([primary, unique])
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: { ...keyRegistration, comparisonKey: unique }, loadColumns: () => keyColumns, loadKeys,
    } })
    await flushPromises()
    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.get('[data-testid="registration-metadata-error"]').text()).toContain('索引元数据不可用')
    expect(wrapper.get('[data-testid="comparison-key-select"]').element.value).toBe('acct_uq')
    expect(selectedNames(wrapper)).toEqual(['code', 'tenant'])
    await wrapper.get('[data-testid="retry-registration-metadata"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('save')[0][0]).toMatchObject({ comparisonKeyName: 'acct_uq', fieldNames: ['code', 'tenant'] })
    wrapper.unmount()
  })

  it('blocks saving when a selected index column disappears even if keys metadata still lists it', async () => {
    const loadColumns = vi.fn().mockReturnValueOnce(keyColumns).mockReturnValue(keyColumns.filter(column => column.columnName !== 'tenant'))
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: {
      initialRegistration: { ...keyRegistration, comparisonKey: unique }, loadColumns, loadKeys: () => [primary, unique],
    } })
    await flushPromises()
    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.get('[data-testid="comparison-key-error"]').text()).toContain('已删除或发生变化')
    expect(wrapper.get('[data-testid="submit-registration"]').element.disabled).toBe(true)
    wrapper.unmount()
  })

})
