import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReplayTrackingValue from './ReplayTrackingValue.vue'

function setOverflow(wrapper, { scrollWidth, clientWidth }) {
  const value = wrapper.get('[data-testid="tracking-value"]').element
  Object.defineProperty(value, 'scrollWidth', { configurable: true, value: scrollWidth })
  Object.defineProperty(value, 'clientWidth', { configurable: true, value: clientWidth })
  window.dispatchEvent(new Event('resize'))
}

describe('ReplayTrackingValue', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('does not open a popover when the value fits', async () => {
    const wrapper = mount(ReplayTrackingValue, { props: { value: '简短内容' } })
    setOverflow(wrapper, { scrollWidth: 80, clientWidth: 100 })

    await wrapper.get('[data-testid="tracking-value"]').trigger('mouseenter')

    expect(wrapper.find('[data-testid="tracking-value-popover"]').exists()).toBe(false)
  })

  it('shows the complete value in a popover only when truncated', async () => {
    const fullValue = '这是一个在单元格中展示不全的很长字段内容'
    const wrapper = mount(ReplayTrackingValue, { props: { value: fullValue } })
    setOverflow(wrapper, { scrollWidth: 240, clientWidth: 100 })

    await wrapper.get('[data-testid="tracking-value"]').trigger('mouseenter')

    expect(wrapper.get('[data-testid="tracking-value-popover"]').text()).toContain(fullValue)
    expect(wrapper.get('[data-testid="tracking-value-copy"]').attributes('aria-label')).toBe('复制完整内容')
  })

  it('copies the complete value and shows success feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const fullValue = '需要复制的完整字段内容'
    const wrapper = mount(ReplayTrackingValue, { props: { value: fullValue } })
    setOverflow(wrapper, { scrollWidth: 220, clientWidth: 80 })
    await wrapper.get('[data-testid="tracking-value"]').trigger('mouseenter')

    await wrapper.get('[data-testid="tracking-value-copy"]').trigger('click')

    expect(writeText).toHaveBeenCalledWith(fullValue)
    expect(wrapper.get('[data-testid="tracking-value-copy"]').attributes('aria-label')).toBe('复制成功')
    expect(wrapper.get('[data-testid="tracking-value-popover"]').text()).toContain('已复制')
  })

  it('does not report success when the legacy clipboard fallback fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn().mockReturnValue(false) })
    const wrapper = mount(ReplayTrackingValue, { props: { value: '无法复制的长字段内容' } })
    setOverflow(wrapper, { scrollWidth: 220, clientWidth: 80 })
    await wrapper.get('[data-testid="tracking-value"]').trigger('mouseenter')

    await wrapper.get('[data-testid="tracking-value-copy"]').trigger('click')

    expect(wrapper.get('[data-testid="tracking-value-copy"]').attributes('aria-label')).toBe('复制失败')
    expect(wrapper.get('[data-testid="tracking-value-popover"]').text()).toContain('复制失败')
  })

  it('keeps the popover open while the pointer moves into it', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ReplayTrackingValue, { props: { value: '需要完整查看的长字段' } })
    setOverflow(wrapper, { scrollWidth: 200, clientWidth: 80 })
    await wrapper.get('[data-testid="tracking-value"]').trigger('mouseenter')

    await wrapper.get('[data-testid="tracking-value"]').trigger('mouseleave')
    await wrapper.get('[data-testid="tracking-value-popover"]').trigger('mouseenter')
    vi.advanceTimersByTime(200)

    expect(wrapper.find('[data-testid="tracking-value-popover"]').exists()).toBe(true)
  })

  it('renders an empty placeholder without an interactive popover', async () => {
    const wrapper = mount(ReplayTrackingValue, { props: { value: '' } })

    expect(wrapper.get('[data-testid="tracking-value"]').text()).toBe('-')
    expect(wrapper.get('[data-testid="tracking-value"]').attributes('tabindex')).toBeUndefined()
    expect(wrapper.find('[data-testid="tracking-value-popover"]').exists()).toBe(false)
  })
})
