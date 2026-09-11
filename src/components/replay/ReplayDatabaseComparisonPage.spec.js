import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReplayDatabaseComparisonPage from './ReplayDatabaseComparisonPage.vue'

describe('ReplayDatabaseComparisonPage', () => {
  it('renders replay-style header filters and table-level mock registrations', () => {
    const wrapper = mount(ReplayDatabaseComparisonPage)

    expect(wrapper.get('h2').text()).toBe('回放数据库比对字段登记')
    expect(wrapper.find('[data-testid="database-comparison-separate-filter-form"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="database-comparison-table-head"]').classes()).toContain('is-sticky')
    expect(wrapper.findAll('[data-testid="database-comparison-header-filter"]')).toHaveLength(6)
    expect(wrapper.text()).toContain('kdpa_cb_acct_fzn_cntl_inf')
    expect(wrapper.text()).toContain('fzn_cntl_id、lglpern_cd、fzn_cntl_amt…（6）')
    expect(wrapper.text()).toContain('共 327 张表 · 2,846 个比对字段')
  })
})
