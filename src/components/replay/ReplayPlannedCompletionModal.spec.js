import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReplayPlannedCompletionModal from './ReplayPlannedCompletionModal.vue'
import replayPlannedCompletionModalSource from './ReplayPlannedCompletionModal.vue?raw'
import {
  getReplayCompletionDashboard,
  getReplayCompletionDatePoints,
  getReplayCompletionIssues,
} from '../../api/replayIssues.js'
import {
  buildCompletionSnapshotFilename,
  createCompletionSnapshotBlob,
  downloadAndCopyCompletionSnapshot,
} from './completionSnapshot.js'

vi.mock('../../api/replayIssues.js', () => ({
  getReplayCompletionDashboard: vi.fn(),
  getReplayCompletionDatePoints: vi.fn(),
  getReplayCompletionIssues: vi.fn(),
}))

vi.mock('./completionSnapshot.js', () => ({
  buildCompletionSnapshotFilename: vi.fn(),
  createCompletionSnapshotBlob: vi.fn(),
  downloadAndCopyCompletionSnapshot: vi.fn(),
}))

const datePoints = [
  { date: '2026-08-20', plannedCount: 4 },
  { date: '2026-08-22', plannedCount: 9 },
  { date: '2026-08-25', plannedCount: 6 },
  { date: '2026-08-27', plannedCount: 12 },
  { date: '2026-08-29', plannedCount: 3 },
]

function createGroup(groupName, matchedDeveloper, plannedTotal = 6) {
  return {
    groupName,
    plannedTotal,
    onTimeFixedCount: 2,
    lateFixedCount: 1,
    unfinishedCount: 2,
    overdueUnfinishedCount: 1,
    completionRate: 50,
    developers: [{
      matchedDeveloper,
      plannedTotal,
      onTimeFixedCount: 2,
      lateFixedCount: 1,
      unfinishedCount: 2,
      overdueUnfinishedCount: 1,
      completionRate: 50,
    }],
  }
}

const dashboard = {
  effectiveStartDate: '2026-08-25',
  effectiveEndDate: '2026-08-29',
  today: '2026-08-27',
  summary: {
    plannedTotal: 21, onTimeFixedCount: 8, lateFixedCount: 3,
    unfinishedCount: 6, overdueUnfinishedCount: 4, completionRate: 52.38,
  },
  groups: [
    createGroup('公共组', '公共负责人'),
    {
      ...createGroup('存款组', '存款负责人', 29),
      developers: [
        { ...createGroup('存款组', 'D负责人', 3).developers[0], matchedDeveloper: 'D负责人' },
        { ...createGroup('存款组', 'C负责人', 7).developers[0], matchedDeveloper: 'C负责人' },
        { ...createGroup('存款组', 'A负责人', 12).developers[0], matchedDeveloper: 'A负责人' },
        { ...createGroup('存款组', 'B负责人', 7).developers[0], matchedDeveloper: 'B负责人' },
      ],
    },
    {
      ...createGroup('贷款组', '张三、李四', 21),
      onTimeFixedCount: 8,
      lateFixedCount: 3,
      unfinishedCount: 6,
      overdueUnfinishedCount: 4,
      completionRate: 52.38,
      developers: [{
        matchedDeveloper: '张三、李四', plannedTotal: 11, onTimeFixedCount: 5,
        lateFixedCount: 2, unfinishedCount: 3, overdueUnfinishedCount: 1, completionRate: 63.64,
      }],
    },
    createGroup('结算组', '结算负责人'),
  ],
}

async function finishCameraEffect() {
  await vi.advanceTimersByTimeAsync(400)
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  buildCompletionSnapshotFilename.mockReturnValue('计划完成情况-存款组-2026-08-25至2026-08-29.png')
  createCompletionSnapshotBlob.mockResolvedValue(new Blob(['snapshot'], { type: 'image/png' }))
  downloadAndCopyCompletionSnapshot.mockResolvedValue({ copied: true })
  getReplayCompletionDatePoints.mockResolvedValue({
    datePoints,
    defaultStartDate: '2026-08-25',
    defaultEndDate: '2026-08-29',
  })
  getReplayCompletionDashboard.mockResolvedValue(dashboard)
  getReplayCompletionIssues.mockResolvedValue({
    total: 1,
    limit: 20,
    offset: 0,
    items: [{
      id: 7, issueId: 'ISSUE-007', transactionCode: '6208', transactionName: '贷款查询',
      issueStatus: '打开', plannedCompletionDate: '2026-08-27', defectRepairDate: null,
      matchedDeveloper: '张三、李四', issueKey: 'TRAN|6208|响应码',
    }],
  })
})

describe('ReplayPlannedCompletionModal', () => {
  it('closes only when the explicit close button is clicked', async () => {
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    await wrapper.get('.replay-completion-mask').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.get('.replay-completion-close').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('shows four fixed group buttons, defaults to deposit, and renders only the selected group', async () => {
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    const tabs = wrapper.findAll('[data-testid="completion-group-tab"]')
    expect(tabs.map(tab => tab.text())).toEqual([
      '存款组/开发负责人',
      '贷款组/开发负责人',
      '公共组/开发负责人',
      '结算组/开发负责人',
    ])
    expect(tabs.map(tab => tab.attributes('data-active'))).toEqual(['true', 'false', 'false', 'false'])
    expect(wrapper.findAll('[data-testid="completion-group-row"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="completion-group-row"]').text()).toContain('存款组')
    expect(wrapper.get('[data-testid="completion-developer-row"]').text()).toContain('A负责人')

    await tabs[3].trigger('click')

    expect(wrapper.findAll('[data-testid="completion-group-tab"]')[3].attributes('data-active')).toBe('true')
    expect(wrapper.get('[data-testid="completion-group-row"]').text()).toContain('结算组')
    expect(wrapper.get('[data-testid="completion-developer-row"]').text()).toContain('结算负责人')
  })

  it('replaces the latest-three hint with the synchronized grouping switch and shows six issue-domain tabs', async () => {
    getReplayCompletionDashboard.mockResolvedValueOnce({
      ...dashboard,
      groups: [...dashboard.groups, createGroup('迁移组', '迁移负责人'), createGroup('平台组', '平台负责人')],
    })
    const wrapper = mount(ReplayPlannedCompletionModal, {
      props: { open: true, groupBy: 'issueDomain' },
    })
    await flushPromises()

    expect(wrapper.text()).not.toContain('默认显示最新 3 个计划日期')
    expect(wrapper.get('[data-testid="completion-grouping-switch"]').text()).toBe('领域问题所属领域')
    expect(wrapper.get('[data-testid="completion-grouping-issue-domain"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('[data-testid="completion-group-tab"]').map(tab => tab.text())).toEqual([
      '存款组/开发负责人', '贷款组/开发负责人', '公共组/开发负责人',
      '结算组/开发负责人', '迁移组/开发负责人', '平台组/开发负责人',
    ])
    expect(getReplayCompletionDashboard).toHaveBeenCalledWith({
      startDate: '2026-08-25', endDate: '2026-08-29', groupBy: 'issueDomain',
    })

    await wrapper.get('[data-testid="completion-grouping-domain"]').trigger('click')
    expect(wrapper.emitted('update:groupBy')).toEqual([['domain']])
  })

  it('renders every developer without pagination and sorts planned totals descending with a stable name tie-break', async () => {
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    const developerRows = wrapper.findAll('[data-testid="completion-developer-row"]')
    expect(developerRows).toHaveLength(4)
    expect(developerRows.map(row => row.find('th').text())).toEqual([
      'A负责人',
      'B负责人',
      'C负责人',
      'D负责人',
    ])
    expect(developerRows.map(row => row.findAll('td')[0].text())).toEqual(['12', '7', '7', '3'])
    expect(wrapper.find('[data-testid="completion-issue-drawer"]').exists()).toBe(false)
    expect(wrapper.get('.replay-completion-table-wrap').classes()).toContain('replay-completion-table-wrap')
  })

  it('captures the effective date range, current group total, and every sorted developer', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
      await flushPromises()

      const snapshot = wrapper.get('[data-testid="completion-snapshot"]')
      expect(snapshot.text()).toBe('拍摄快照')
      await snapshot.trigger('click')
      await finishCameraEffect()

      expect(createCompletionSnapshotBlob).toHaveBeenCalledWith({
        group: expect.objectContaining({ groupName: '存款组', plannedTotal: 29 }),
        developers: expect.arrayContaining([
          expect.objectContaining({ matchedDeveloper: 'A负责人' }),
          expect.objectContaining({ matchedDeveloper: 'B负责人' }),
          expect.objectContaining({ matchedDeveloper: 'C负责人' }),
          expect.objectContaining({ matchedDeveloper: 'D负责人' }),
        ]),
        startDate: '2026-08-25',
        endDate: '2026-08-29',
      })
      expect(createCompletionSnapshotBlob.mock.calls[0][0].developers.map(row => row.matchedDeveloper))
        .toEqual(['A负责人', 'B负责人', 'C负责人', 'D负责人'])
      expect(buildCompletionSnapshotFilename).toHaveBeenCalledWith({
        groupName: '存款组',
        startDate: '2026-08-25',
        endDate: '2026-08-29',
      })
      expect(downloadAndCopyCompletionSnapshot).toHaveBeenCalledWith(
        expect.any(Blob),
        '计划完成情况-存款组-2026-08-25至2026-08-29.png',
      )
      expect(wrapper.get('[data-testid="completion-snapshot-message"]').text()).toBe('快照已经复制')
      expect(wrapper.find('[data-testid="completion-snapshot-preview"]').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('plays one camera effect, prevents duplicate capture, and fades copied success away', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
      await flushPromises()

      const snapshot = wrapper.get('[data-testid="completion-snapshot"]')
      await snapshot.trigger('click')

      const effect = wrapper.get('[data-testid="completion-table-stage"] [data-testid="completion-snapshot-effect"]')
      expect(effect.classes()).toContain('is-active')
      expect(effect.attributes('aria-hidden')).toBe('true')
      expect(snapshot.attributes('disabled')).toBeDefined()

      await snapshot.trigger('click')
      expect(createCompletionSnapshotBlob).toHaveBeenCalledTimes(1)

      await finishCameraEffect()

      expect(createCompletionSnapshotBlob).toHaveBeenCalledTimes(1)
      const message = wrapper.get('[data-testid="completion-snapshot-message"]')
      expect(message.text()).toBe('快照已经复制')
      expect(message.attributes('role')).toBe('status')
      expect(message.attributes('aria-live')).toBe('polite')

      await vi.advanceTimersByTimeAsync(1500)
      await wrapper.vm.$nextTick()
      expect(wrapper.get('[data-testid="completion-snapshot-message"]').classes()).toContain('is-leaving')

      await vi.advanceTimersByTimeAsync(600)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="completion-snapshot-message"]').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('defines reduced-motion behavior for camera feedback', () => {
    expect(replayPlannedCompletionModalSource).toContain('@media(prefers-reduced-motion:reduce)')
    expect(replayPlannedCompletionModalSource).toContain('.replay-completion-snapshot-flash')
    expect(replayPlannedCompletionModalSource).toContain('.replay-completion-snapshot-shutter')
  })

  it('uses a compact timeline so the summary remains visible in the default upper pane', () => {
    expect(replayPlannedCompletionModalSource).toContain('height:120px')
    expect(replayPlannedCompletionModalSource).toContain('grid-template-rows:90px 10px 20px')
    expect(replayPlannedCompletionModalSource).toContain('* 70))')
  })

  it('anchors camera feedback to the actual visible table viewport', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
      await flushPromises()

      await wrapper.get('[data-testid="completion-snapshot"]').trigger('click')

      const stage = wrapper.get('[data-testid="completion-table-stage"]')
      expect(stage.get('.replay-completion-table-wrap').exists()).toBe(true)
      expect(stage.get('[data-testid="completion-snapshot-effect"]').exists()).toBe(true)
      expect(replayPlannedCompletionModalSource).toContain('.replay-completion-snapshot-shutter{position:absolute;top:50%;left:50%')
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens the downloaded image preview when browser image copying is unavailable and closes only from X', async () => {
    vi.useFakeTimers()
    try {
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL')
      downloadAndCopyCompletionSnapshot.mockResolvedValueOnce({ copied: false, previewUrl: 'blob:http-preview' })
      const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
      await flushPromises()

      await wrapper.get('[data-testid="completion-snapshot"]').trigger('click')
      await finishCameraEffect()

      expect(wrapper.get('[data-testid="completion-snapshot-message"]').text()).toBe('快照已保存，请右键复制图片')
      expect(wrapper.text()).not.toContain('快照已经复制')
      expect(wrapper.get('[data-testid="completion-snapshot-message"]').classes()).toContain('is-warning')
      const preview = wrapper.get('[data-testid="completion-snapshot-preview"]')
      expect(preview.get('h3').text()).toBe('快照预览')
      expect(preview.text()).toContain('请在图片上点击右键，选择“复制图片”')
      expect(preview.get('img').attributes('src')).toBe('blob:http-preview')

      await preview.trigger('click')
      expect(wrapper.find('[data-testid="completion-snapshot-preview"]').exists()).toBe(true)
      expect(revokeObjectURL).not.toHaveBeenCalled()

      await wrapper.get('[data-testid="completion-snapshot-preview-close"]').trigger('click')
      expect(wrapper.find('[data-testid="completion-snapshot-preview"]').exists()).toBe(false)
      expect(revokeObjectURL).toHaveBeenCalledOnce()
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:http-preview')
    } finally {
      vi.useRealTimers()
    }
  })

  it('releases an open snapshot preview when the parent modal closes', async () => {
    vi.useFakeTimers()
    try {
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL')
      downloadAndCopyCompletionSnapshot.mockResolvedValueOnce({ copied: false, previewUrl: 'blob:parent-close' })
      const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
      await flushPromises()

      await wrapper.get('[data-testid="completion-snapshot"]').trigger('click')
      await finishCameraEffect()
      expect(wrapper.find('[data-testid="completion-snapshot-preview"]').exists()).toBe(true)

      await wrapper.setProps({ open: false })
      await flushPromises()

      expect(revokeObjectURL).toHaveBeenCalledWith('blob:parent-close')
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a snapshot generation failure without claiming that the image was saved', async () => {
    vi.useFakeTimers()
    try {
      createCompletionSnapshotBlob.mockRejectedValueOnce(new Error('canvas failed'))
      const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
      await flushPromises()

      await wrapper.get('[data-testid="completion-snapshot"]').trigger('click')
      await finishCameraEffect()

      expect(downloadAndCopyCompletionSnapshot).not.toHaveBeenCalled()
      expect(wrapper.get('[data-testid="completion-snapshot-message"]').text()).toBe('快照生成失败，请重试')
      expect(wrapper.text()).not.toContain('快照已经复制')
      expect(wrapper.get('[data-testid="completion-snapshot-message"]').classes()).toContain('is-error')
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the selected group when dates change and resets it only after the modal reopens', async () => {
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    await wrapper.findAll('[data-testid="completion-group-tab"]')[3].trigger('click')
    const startHandle = wrapper.get('[data-testid="timeline-start-handle"]')
    await startHandle.setValue('3')
    await startHandle.trigger('change')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="completion-group-tab"]')[3].attributes('data-active')).toBe('true')
    expect(wrapper.get('[data-testid="completion-group-row"]').text()).toContain('结算组')

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()

    expect(wrapper.findAll('[data-testid="completion-group-tab"]')[0].attributes('data-active')).toBe('true')
    expect(wrapper.get('[data-testid="completion-group-row"]').text()).toContain('存款组')
  })

  it('loads the server-provided default range and lets sparse uniformly blue bars fill the viewport', async () => {
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    expect(getReplayCompletionDashboard).toHaveBeenCalledWith({
      startDate: '2026-08-25',
      endDate: '2026-08-29',
      groupBy: 'domain',
    })
    const columns = wrapper.findAll('[data-testid="timeline-column"]')
    expect(columns).toHaveLength(5)
    const timelineStyle = wrapper.get('.replay-completion-timeline').attributes('style')
    expect(timelineStyle).toContain('min-width: 480px')
    expect(timelineStyle).toContain('--timeline-count: 5')
    expect(timelineStyle).not.toMatch(/(^|;)\s*width:\s*480px/)
    expect(wrapper.findAll('[data-testid="timeline-bar"]').every(bar => bar.classes('replay-completion-bar'))).toBe(true)
    expect(wrapper.findAll('[data-testid="timeline-count"]').map(node => node.text())).toEqual(['4', '9', '6', '12', '3'])
    expect(wrapper.findAll('[data-testid="timeline-date"]').map(node => node.text())).toEqual(datePoints.map(point => point.date))
    expect(wrapper.findAll('[data-testid="timeline-column"].is-selected')).toHaveLength(3)
    expect(wrapper.findAll('[data-testid="timeline-column"].is-outside')).toHaveLength(2)
  })

  it('queries server today without adding a zero-count timeline point when today has no data', async () => {
    getReplayCompletionDatePoints.mockResolvedValueOnce({
      datePoints,
      defaultStartDate: '2026-08-31',
      defaultEndDate: '2026-08-31',
    })
    getReplayCompletionDashboard.mockResolvedValueOnce({
      effectiveStartDate: '2026-08-31',
      effectiveEndDate: '2026-08-31',
      today: '2026-08-31',
      summary: {
        plannedTotal: 0, onTimeFixedCount: 0, lateFixedCount: 0,
        unfinishedCount: 0, overdueUnfinishedCount: 0, completionRate: null,
      },
      groups: [],
    })

    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    expect(getReplayCompletionDashboard).toHaveBeenCalledWith({
      startDate: '2026-08-31',
      endDate: '2026-08-31',
      groupBy: 'domain',
    })
    expect(wrapper.get('[data-testid="completion-start-date"]').element.value).toBe('2026-08-31')
    expect(wrapper.get('[data-testid="completion-end-date"]').element.value).toBe('2026-08-31')
    expect(wrapper.get('[data-testid="completion-start-date"]').findAll('option').map(option => option.text()))
      .toEqual([...datePoints.map(point => point.date), '2026-08-31'])
    expect(wrapper.findAll('[data-testid="timeline-column"]')).toHaveLength(datePoints.length)
    expect(wrapper.findAll('[data-testid="timeline-column"].is-selected')).toHaveLength(0)
    expect(wrapper.text()).toContain('计划问题数0')
  })

  it('loads the server-today empty dashboard even when there are no real date points', async () => {
    getReplayCompletionDatePoints.mockResolvedValueOnce({
      datePoints: [],
      defaultStartDate: '2026-08-31',
      defaultEndDate: '2026-08-31',
    })
    getReplayCompletionDashboard.mockResolvedValueOnce({
      effectiveStartDate: '2026-08-31',
      effectiveEndDate: '2026-08-31',
      today: '2026-08-31',
      summary: {
        plannedTotal: 0, onTimeFixedCount: 0, lateFixedCount: 0,
        unfinishedCount: 0, overdueUnfinishedCount: 0, completionRate: null,
      },
      groups: [],
    })

    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    expect(getReplayCompletionDashboard).toHaveBeenCalledWith({
      startDate: '2026-08-31',
      endDate: '2026-08-31',
      groupBy: 'domain',
    })
    expect(wrapper.text()).toContain('暂无已填写计划验证日期的问题')
  })

  it('keeps every planned count directly above its own bar instead of in a fixed top row', async () => {
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    const columns = wrapper.findAll('[data-testid="timeline-column"]')
    expect(columns).toHaveLength(datePoints.length)
    columns.forEach((column) => {
      const stack = column.get('.replay-completion-bar-stack')
      expect(stack.element.children[0].getAttribute('data-testid')).toBe('timeline-count')
      expect(stack.element.children[1].getAttribute('data-testid')).toBe('timeline-bar')
    })
  })

  it('moves range handles one real date at a time and keeps date selects synchronized', async () => {
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    const startHandle = wrapper.get('[data-testid="timeline-start-handle"]')
    expect(startHandle.attributes('step')).toBe('1')
    await startHandle.setValue('3')
    await startHandle.trigger('change')
    await flushPromises()

    expect(wrapper.get('[data-testid="completion-start-date"]').element.value).toBe('2026-08-27')
    expect(getReplayCompletionDashboard).toHaveBeenLastCalledWith({
      startDate: '2026-08-27',
      endDate: '2026-08-29',
      groupBy: 'domain',
    })

    getReplayCompletionDashboard.mockResolvedValueOnce({
      ...dashboard,
      effectiveStartDate: '2026-08-22',
      effectiveEndDate: '2026-08-29',
    })
    await wrapper.get('[data-testid="completion-start-date"]').setValue('2026-08-22')
    await wrapper.get('[data-testid="apply-completion-range"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="completion-start-date"]').element.value).toBe('2026-08-22')
  })

  it('queries one date immediately when its timeline column is clicked or activated by keyboard', async () => {
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    const columns = wrapper.findAll('[data-testid="timeline-column"]')
    await columns[1].trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="completion-start-date"]').element.value).toBe('2026-08-22')
    expect(wrapper.get('[data-testid="completion-end-date"]').element.value).toBe('2026-08-22')
    expect(getReplayCompletionDashboard).toHaveBeenLastCalledWith({
      startDate: '2026-08-22', endDate: '2026-08-22', groupBy: 'domain',
    })

    await columns[3].trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.get('[data-testid="completion-start-date"]').element.value).toBe('2026-08-27')
    expect(wrapper.get('[data-testid="completion-end-date"]').element.value).toBe('2026-08-27')
    expect(getReplayCompletionDashboard).toHaveBeenLastCalledWith({
      startDate: '2026-08-27', endDate: '2026-08-27', groupBy: 'domain',
    })
  })

  it('smoothly centers a directly selected date without moving the timeline for dropdown queries', async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    try {
      await flushPromises()
      scrollIntoView.mockClear()

      await wrapper.findAll('[data-testid="timeline-column"]').at(-1).trigger('click')
      await flushPromises()

      expect(wrapper.findAll('[data-testid="timeline-center-gutter"]')).toHaveLength(2)
      expect(scrollIntoView).toHaveBeenLastCalledWith({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })

      scrollIntoView.mockClear()
      await wrapper.get('[data-testid="apply-completion-range"]').trigger('click')
      await flushPromises()
      expect(scrollIntoView).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
      if (originalScrollIntoView) HTMLElement.prototype.scrollIntoView = originalScrollIntoView
      else delete HTMLElement.prototype.scrollIntoView
    }
  })

  it('drags an overlapped date point left to move only the start date and queries on release', async () => {
    getReplayCompletionDatePoints.mockResolvedValueOnce({
      datePoints,
      defaultStartDate: '2026-08-25',
      defaultEndDate: '2026-08-25',
    })
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    const shell = wrapper.get('.replay-completion-slider-shell')
    shell.element.getBoundingClientRect = () => ({ left: 100, width: 400 })
    const handle = wrapper.get('[data-testid="timeline-overlap-handle"]')
    await handle.trigger('pointerdown', { pointerId: 71, clientX: 300 })
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 71, clientX: 200 }))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 71, clientX: 200 }))
    await flushPromises()

    expect(wrapper.get('[data-testid="completion-start-date"]').element.value).toBe('2026-08-22')
    expect(wrapper.get('[data-testid="completion-end-date"]').element.value).toBe('2026-08-25')
    expect(getReplayCompletionDashboard).toHaveBeenCalledTimes(2)
    expect(getReplayCompletionDashboard).toHaveBeenLastCalledWith({
      startDate: '2026-08-22', endDate: '2026-08-25', groupBy: 'domain',
    })
  })

  it('drags an overlapped date point right to move only the end date', async () => {
    getReplayCompletionDatePoints.mockResolvedValueOnce({
      datePoints,
      defaultStartDate: '2026-08-25',
      defaultEndDate: '2026-08-25',
    })
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    const shell = wrapper.get('.replay-completion-slider-shell')
    shell.element.getBoundingClientRect = () => ({ left: 100, width: 400 })
    const handle = wrapper.get('[data-testid="timeline-overlap-handle"]')
    await handle.trigger('pointerdown', { pointerId: 72, clientX: 300 })
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 72, clientX: 400 }))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 72, clientX: 400 }))
    await flushPromises()

    expect(wrapper.get('[data-testid="completion-start-date"]').element.value).toBe('2026-08-25')
    expect(wrapper.get('[data-testid="completion-end-date"]').element.value).toBe('2026-08-27')
    expect(getReplayCompletionDashboard).toHaveBeenLastCalledWith({
      startDate: '2026-08-25', endDate: '2026-08-27', groupBy: 'domain',
    })
  })

  it('does not query again when an overlapped handle is pressed and released without moving', async () => {
    getReplayCompletionDatePoints.mockResolvedValueOnce({
      datePoints,
      defaultStartDate: '2026-08-25',
      defaultEndDate: '2026-08-25',
    })
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    const handle = wrapper.get('[data-testid="timeline-overlap-handle"]')
    await handle.trigger('pointerdown', { pointerId: 73, clientX: 300 })
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 73, clientX: 300 }))
    await flushPromises()

    expect(getReplayCompletionDashboard).toHaveBeenCalledTimes(1)
  })

  it('offers only real dates and blocks an inverted range without changing results or the selected group', async () => {
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    const startDate = wrapper.get('[data-testid="completion-start-date"]')
    const endDate = wrapper.get('[data-testid="completion-end-date"]')
    expect(startDate.element.tagName).toBe('SELECT')
    expect(endDate.element.tagName).toBe('SELECT')
    expect(startDate.findAll('option').map(option => option.text())).toEqual(datePoints.map(point => point.date))
    expect(endDate.findAll('option').map(option => option.text())).toEqual(datePoints.map(point => point.date))

    await wrapper.findAll('[data-testid="completion-group-tab"]')[3].trigger('click')
    const resultBeforeQuery = wrapper.get('[data-testid="completion-group-row"]').text()
    await startDate.setValue('2026-08-29')
    await endDate.setValue('2026-08-25')
    await wrapper.get('[data-testid="apply-completion-range"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('.replay-completion-error').text()).toBe('开始日期不能晚于结束日期，请重新选择')
    expect(getReplayCompletionDashboard).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('[data-testid="completion-group-tab"]')[3].attributes('data-active')).toBe('true')
    expect(wrapper.get('[data-testid="completion-group-row"]').text()).toBe(resultBeforeQuery)
  })

  it('brings the selected end date into view after the default range loads', async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    try {
      mount(ReplayPlannedCompletionModal, { props: { open: true } })
      await flushPromises()

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'end' })
    } finally {
      if (originalScrollIntoView) HTMLElement.prototype.scrollIntoView = originalScrollIntoView
      else delete HTMLElement.prototype.scrollIntoView
    }
  })

  it('renders group and developer rows and drills an exact count into a paged right drawer', async () => {
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    await wrapper.findAll('[data-testid="completion-group-tab"]')[1].trigger('click')
    expect(wrapper.get('[data-testid="completion-group-row"]').text()).toContain('贷款组')
    expect(wrapper.get('[data-testid="completion-developer-row"]').text()).toContain('张三、李四')

    await wrapper.get('[data-testid="developer-OVERDUE_UNFINISHED-张三、李四"]').trigger('click')
    await flushPromises()

    expect(getReplayCompletionIssues).toHaveBeenCalledWith({
      startDate: '2026-08-25',
      endDate: '2026-08-29',
      groupBy: 'domain',
      groupName: '贷款组',
      matchedDeveloper: '张三、李四',
      category: 'OVERDUE_UNFINISHED',
      limit: 20,
      offset: 0,
    })
    const drawer = wrapper.get('[data-testid="completion-issue-drawer"]')
    expect(drawer.text()).toContain('ISSUE-007')
    expect(drawer.text()).toContain('TRAN|6208|响应码')
    expect(drawer.text()).toContain('第 1 / 1 页')
  })

  it('shows late-fixed days from defect repair date with only the number emphasized in red', async () => {
    getReplayCompletionIssues.mockResolvedValueOnce({
      total: 1,
      limit: 20,
      offset: 0,
      today: '2026-08-31',
      items: [{
        id: 8, issueId: 'ISSUE-008', transactionCode: '6209', transactionName: '贷款还款',
        issueStatus: '已修复', plannedCompletionDate: '2026-08-27', defectRepairDate: '2026-08-30',
        matchedDeveloper: '张三、李四', issueKey: 'TRAN|6209|金额',
      }],
    })
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    await wrapper.findAll('[data-testid="completion-group-tab"]')[1].trigger('click')
    await wrapper.get('[data-testid="developer-LATE_FIXED-张三、李四"]').trigger('click')
    await flushPromises()

    const issueHeader = wrapper.get('.replay-completion-issue-card h4')
    const overdue = issueHeader.get('[data-testid="completion-overdue-days"]')
    expect(overdue.text()).toBe('逾期 3 天')
    expect(overdue.get('[data-testid="completion-overdue-number"]').text()).toBe('3')
    expect(overdue.get('[data-testid="completion-overdue-number"]').classes()).toContain('replay-completion-overdue-number')
    expect(wrapper.findAll('.replay-completion-issue-card dt').map(node => node.text())).not.toContain('逾期天数')
  })

  it('shows overdue-unfinished days from the response today instead of the browser date', async () => {
    getReplayCompletionIssues.mockResolvedValueOnce({
      total: 1,
      limit: 20,
      offset: 0,
      today: '2026-08-31',
      items: [{
        id: 9, issueId: 'ISSUE-009', transactionCode: '6210', transactionName: '贷款试算',
        issueStatus: '打开', plannedCompletionDate: '2026-08-27', defectRepairDate: null,
        matchedDeveloper: '张三、李四', issueKey: 'TRAN|6210|响应码',
      }],
    })
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    await wrapper.findAll('[data-testid="completion-group-tab"]')[1].trigger('click')
    await wrapper.get('[data-testid="developer-OVERDUE_UNFINISHED-张三、李四"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('.replay-completion-issue-card h4 [data-testid="completion-overdue-days"]').text()).toBe('逾期 4 天')
  })

  it('renders a fixed-header two-pane layout', async () => {
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()

    expect(wrapper.get('[data-testid="completion-upper-pane"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="completion-splitter"]').attributes('role')).toBe('separator')
    expect(wrapper.get('[data-testid="completion-splitter"]').attributes('aria-orientation')).toBe('horizontal')
    expect(wrapper.get('[data-testid="completion-lower-pane"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="completion-split-layout"]').attributes('style'))
      .toContain('--completion-top-height:')
  })

  it('collapses to a summary and restores the previous height', async () => {
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()
    const before = wrapper.get('[data-testid="completion-split-layout"]').attributes('style')

    await wrapper.get('[data-testid="completion-collapse-upper"]').trigger('click')

    expect(wrapper.find('[data-testid="completion-upper-pane"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="completion-collapsed-summary"]').text()).toContain('2026-08-25 至 2026-08-29')
    expect(wrapper.get('[data-testid="completion-collapsed-summary"]').text()).toContain('计划问题数 21')

    await wrapper.get('[data-testid="completion-collapse-upper"]').trigger('click')

    expect(wrapper.get('[data-testid="completion-upper-pane"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="completion-split-layout"]').attributes('style')).toBe(before)
  })

  it('clamps a dragged separator to both pane minimums', async () => {
    globalThis.PointerEvent ||= MouseEvent
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()
    const layout = wrapper.get('[data-testid="completion-split-layout"]')
    layout.element.getBoundingClientRect = () => ({ top: 100, height: 800 })

    await wrapper.get('.replay-completion-splitter-grip').trigger('pointerdown', { pointerId: 1, clientY: 120 })
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: 890 }))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
    await wrapper.vm.$nextTick()

    expect(layout.attributes('style')).toContain('--completion-top-height: 540px')
  })

  it('keeps the split through queries and resets it only after reopen', async () => {
    globalThis.PointerEvent ||= MouseEvent
    const wrapper = mount(ReplayPlannedCompletionModal, { props: { open: true } })
    await flushPromises()
    const layout = wrapper.get('[data-testid="completion-split-layout"]')
    layout.element.getBoundingClientRect = () => ({ top: 100, height: 800 })
    await wrapper.get('.replay-completion-splitter-grip').trigger('pointerdown', { pointerId: 2, clientY: 500 })
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientY: 500 }))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }))
    await wrapper.vm.$nextTick()
    const draggedStyle = layout.attributes('style')

    await wrapper.get('[data-testid="apply-completion-range"]').trigger('click')
    await flushPromises()
    expect(layout.attributes('style')).toBe(draggedStyle)

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()

    expect(wrapper.get('[data-testid="completion-split-layout"]').attributes('style')).not.toBe(draggedStyle)
  })
})
