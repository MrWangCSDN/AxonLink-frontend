import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReplayReportMailAttachments from './ReplayReportMailAttachments.vue'
import { getReplayReportAttachmentOptions } from '../../api/replayIssues.js'

vi.mock('../../api/replayIssues.js', () => ({
  getReplayReportAttachmentOptions: vi.fn(),
}))

const current = {
  fileName: 'RPT20260915-01日报.xlsx', size: 1024,
  source: 'CURRENT_REPORT', batchNo: 'RPT20260915-01', period: 'DAILY', endBatchNo: 'RPT20260915-01',
}

describe('ReplayReportMailAttachments', () => {
  beforeEach(() => {
    getReplayReportAttachmentOptions.mockReset()
    getReplayReportAttachmentOptions.mockResolvedValue({
      items: [
        { batchNo: 'RPT20260915-01', endBatchNo: 'RPT20260915-01', period: 'DAILY', family: 'RPT', fileName: '当前日报.xlsx', fileSize: 1024 },
        { batchNo: 'DZ20260914-01', endBatchNo: 'DZ20260914-01', period: 'DAILY', family: 'DZ', fileName: '账务日报.xlsx', fileSize: 2048 },
      ], page: 0, size: 20, total: 2,
    })
  })

  it('keeps the current report fixed and adds generated reports without duplicates', async () => {
    const wrapper = mount(ReplayReportMailAttachments, {
      props: { currentAttachment: current, selectedReports: [], localFiles: [] },
    })
    expect(wrapper.get('[data-testid="mail-current-attachment"]').text()).toContain('系统自动附加')
    expect(wrapper.find('[data-testid="mail-current-remove"]').exists()).toBe(false)

    await wrapper.get('[data-testid="mail-add-generated"]').trigger('click')
    await flushPromises()
    expect(getReplayReportAttachmentOptions).toHaveBeenCalledWith({
      keyword: '', family: 'ALL', period: 'ALL', page: 0, size: 20,
    })
    expect(wrapper.get('[data-testid="mail-generated-current-hint"]').text()).toContain('当前附件')
    await wrapper.get('[data-testid="mail-generated-option-DAILY||DZ20260914-01"]').trigger('click')
    expect(wrapper.emitted('update:selectedReports').at(-1)[0].map(item => item.batchNo))
      .toEqual(['DZ20260914-01'])
  })

  it('accepts multiple Excel files and reports invalid extensions', async () => {
    const wrapper = mount(ReplayReportMailAttachments, {
      props: { currentAttachment: current, selectedReports: [], localFiles: [] },
    })
    const input = wrapper.get('[data-testid="mail-local-files"]')
    expect(input.attributes('accept')).toBe('.xls,.xlsx')
    expect(input.attributes()).toHaveProperty('multiple')

    const good = new File(['excel'], '补充.xlsx')
    const bad = new File(['text'], '说明.txt')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [good, bad] })
    await input.trigger('change')

    expect(wrapper.emitted('update:localFiles').at(-1)[0]).toEqual([good])
    expect(wrapper.emitted('validation-change').at(-1)[0]).toMatchObject({
      valid: false, error: '附件仅支持 Excel：说明.txt',
    })
  })
})
