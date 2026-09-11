import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ReplayDatabaseComparisonPage from './ReplayDatabaseComparisonPage.vue'

describe('ReplayDatabaseComparisonPage', () => {
  it('renders replay-style header filters and table-level mock registrations', () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)

    expect(wrapper.get('h2').text()).toBe('回放数据库比对字段登记')
    expect(wrapper.find('[data-testid="database-comparison-separate-filter-form"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="database-comparison-table-head"]').classes()).toContain('is-sticky')
    expect(wrapper.findAll('[data-testid="database-comparison-header-filter"]')).toHaveLength(6)
    expect(wrapper.text()).toContain('kdpa_cb_acct_fzn_cntl_inf')
    expect(wrapper.text()).toContain('fzn_cntl_id(冻结控制编号)')
    expect(wrapper.text()).toContain('lglpern_cd')
    expect(wrapper.text()).not.toContain('lglpern_cd()')
    expect(wrapper.text()).toContain('共 327 张表 · 2,846 个比对字段')
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
      'fzn_cntl_id(冻结控制编号)、lglpern_cd、fzn_cntl_amt(冻结金额)、currency_cd(币种)、effective_dt(生效日期)、acct_status(账户状态)',
    )
    expect(wrapper.get('table').classes()).toContain('is-fixed-layout')
    expect(fieldCell.findAll('.field-item')).toHaveLength(6)
    expect(fieldCell.get('.field-list').text()).toContain('冻结控制编号)、lglpern_cd、fzn_cntl_amt')
    expect(fieldCell.text()).toContain('收起')
    expect(fieldCell.text()).toContain('复制全部字段')

    await wrapper.get('[data-testid="copy-fields-kdpa_cb_acct_fzn_cntl_inf"]').trigger('click')
    expect(writeText).toHaveBeenCalledWith(
      'fzn_cntl_id(冻结控制编号)、lglpern_cd、fzn_cntl_amt(冻结金额)、currency_cd(币种)、effective_dt(生效日期)、acct_status(账户状态)',
    )
  })
})
