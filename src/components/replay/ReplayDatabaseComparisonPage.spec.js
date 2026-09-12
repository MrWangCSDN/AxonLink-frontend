import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ReplayDatabaseComparisonPage from './ReplayDatabaseComparisonPage.vue'

describe('ReplayDatabaseComparisonPage', () => {
  it('renders replay-style header filters and table-level mock registrations', () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)

    expect(wrapper.get('h2').text()).toBe('回放数据库比对字段登记')
    expect(wrapper.find('[data-testid="database-comparison-separate-filter-form"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="database-comparison-table-head"]').classes()).toContain('is-sticky')
    const filterButtons = wrapper.findAll('[data-testid="database-comparison-header-filter"]')
    expect(filterButtons).toHaveLength(6)
    expect(filterButtons.every(button => button.classes().includes('replay-header-filter-button'))).toBe(true)
    expect(filterButtons.every(button => button.find('i').exists())).toBe(true)
    const headers = wrapper.findAll('thead th')
    expect(headers[0].text()).toContain('表英文名 / 中文名')
    expect(headers[0].classes()).toContain('primary-column')
    expect(headers.some(header => header.text() === '序号')).toBe(false)
    expect(wrapper.text()).toContain('kdpa_cb_acct_fzn_cntl_inf')
    expect(wrapper.text()).toContain('fzn_cntl_id(冻结控制编号)')
    expect(wrapper.text()).toContain('lglpern_cd')
    expect(wrapper.text()).not.toContain('lglpern_cd()')
    expect(wrapper.text()).toContain('共 200 张表')
    expect(wrapper.findAll('[data-testid="registration-row"]')).toHaveLength(50)
    expect(wrapper.classes()).toContain('is-fixed-page')
    expect(wrapper.get('[data-testid="table-viewport"]').classes()).toContain('is-scroll-viewport')
    expect(wrapper.get('[data-testid="fixed-pager"]').classes()).toContain('is-fixed-pager')
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

    expect(wrapper.findAll('[data-testid="domain-cell"]')
      .every(cell => cell.text() === '贷款')).toBe(true)
    expect(wrapper.get('[data-testid="page-summary"]').text()).toContain('共 50 条')

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
      expect(panel.find('[aria-label="查询筛选选项"]').exists()).toBe(true)
      expect(panel.find('[data-testid="header-filter-resize-handle"]').exists()).toBe(true)
      expect(wrapper.findAll('[data-testid="header-filter-option"]').length).toBeGreaterThan(0)
      await wrapper.get('[aria-label="关闭筛选"]').trigger('click')
    }
  })
})
