import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ReplayDatabaseComparisonEditor from './ReplayDatabaseComparisonEditor.vue'

const registrations = [{
  id: 12,
  version: 3,
  tableName: 'kdpa_cb_acct_fzn_cntl_inf',
  tableComment: '对公存款账户冻结控制信息',
  fields: [
    { name: 'fzn_cntl_id', comment: '冻结控制编号' },
    { name: 'currency_cd', comment: '币种' },
  ],
  domain: '存款',
  owner: '周皓',
  groupOwnerUsername: 'sunhy1',
  groupOwner: '孙海英(sunhy1)',
  date: '2026-09-07',
}]

describe('ReplayDatabaseComparisonEditor', () => {
  it('renders a large modal and searches tables only after clicking search', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: { registrations } })

    expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(wrapper.get('[data-testid="editor-title"]').text()).toBe('新增登记')
    await wrapper.get('[data-testid="table-search-input"]').setValue('冻结')
    expect(wrapper.findAll('[data-testid="table-search-result"]')).toHaveLength(0)

    await wrapper.get('[data-testid="table-search-button"]').trigger('click')

    expect(wrapper.findAll('[data-testid="table-search-result"]').length).toBeGreaterThan(0)
  })

  it('switches to edit mode and restores selected fields for an existing table', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: { registrations } })
    await wrapper.get('[data-testid="table-search-input"]').setValue('冻结控制信息')
    await wrapper.get('[data-testid="table-search-button"]').trigger('click')
    await wrapper.get('[data-testid="table-search-result"]').trigger('click')

    expect(wrapper.get('[data-testid="editor-title"]').text()).toBe('编辑登记')
    expect(wrapper.get('[data-testid="selected-table"]').text()).toContain('kdpa_cb_acct_fzn_cntl_inf')
    expect(wrapper.get('[data-testid="selected-fields"]').text()).toContain('fzn_cntl_id')
    expect(wrapper.get('[data-testid="selected-fields"]').text()).toContain('currency_cd')
    expect(wrapper.find('[data-testid="table-search-input"]').exists()).toBe(false)
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

  it('keeps only domain and a searchable group owner in registration information', async () => {
    const searchUsers = vi.fn().mockResolvedValue([
      { username: 'sunhy1', realName: '孙海英', displayName: '孙海英(sunhy1)' },
    ])
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations, searchUsers },
    })
    const fieldLabels = wrapper.findAll('.registration-form > label').map(label => label.text())

    expect(fieldLabels.some(label => label.startsWith('负责人'))).toBe(false)
    expect(fieldLabels.some(label => label.startsWith('登记日期'))).toBe(false)
    expect(fieldLabels.some(label => label.startsWith('备注'))).toBe(false)
    await wrapper.get('[data-testid="group-owner-search"]').setValue('孙')
    await wrapper.get('[data-testid="group-owner-search"]').trigger('input')

    expect(searchUsers).toHaveBeenCalledWith('孙')
    await wrapper.get('[data-testid="group-owner-option-sunhy1"]').trigger('click')
    expect(wrapper.get('[data-testid="group-owner-search"]').element.value).toBe('孙海英(sunhy1)')
  })

  it('filters, transfers and reorders primary-key-aware fields', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, { props: { registrations } })
    await wrapper.get('[data-testid="table-search-input"]').setValue('customer_ext')
    await wrapper.get('[data-testid="table-search-button"]').trigger('click')
    await wrapper.get('[data-testid="table-search-result"]').trigger('click')

    expect(wrapper.get('[data-testid="available-fields"]').text()).toContain('主键')
    await wrapper.get('[data-testid="field-filter-primary"]').trigger('click')
    expect(wrapper.findAll('[data-testid="available-field-row"]')).toHaveLength(1)
    await wrapper.get('[data-testid="field-filter-all"]').trigger('click')

    await wrapper.get('[data-testid="available-field-customer_no"]').setValue(true)
    await wrapper.get('[data-testid="move-fields-right"]').trigger('click')
    await wrapper.get('[data-testid="available-field-customer_type"]').setValue(true)
    await wrapper.get('[data-testid="move-fields-right"]').trigger('click')
    expect(wrapper.get('[data-testid="selected-fields"]').text()).toContain('customer_type')

    await wrapper.get('[data-testid="move-selected-up-customer_type"]').trigger('click')
    expect(wrapper.findAll('[data-testid="selected-field-row"]')[0].text()).toContain('customer_type')
  })

  it('requires explicit confirmation before deleting an edit with no selected fields', async () => {
    const wrapper = mount(ReplayDatabaseComparisonEditor, {
      props: { registrations, initialRegistration: registrations[0] },
    })
    for (const checkbox of wrapper.findAll('[data-testid="selected-field-row"] input[type="checkbox"]')) {
      await checkbox.setValue(true)
    }
    await wrapper.get('[data-testid="move-fields-left"]').trigger('click')

    expect(wrapper.get('[data-testid="submit-registration"]').text()).toBe('删除登记')
    await wrapper.get('[data-testid="submit-registration"]').trigger('click')
    expect(wrapper.get('[data-testid="delete-confirmation"]').text()).toContain('删除整张表的登记记录')
    expect(wrapper.emitted('delete')).toBeUndefined()

    await wrapper.get('[data-testid="confirm-delete-registration"]').trigger('click')
    expect(wrapper.emitted('delete')?.[0]?.[0]).toMatchObject({
      id: 12,
      version: 3,
      deleteWhenNoFields: true,
    })
  })
})
