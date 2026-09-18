import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReplayDatabaseComparisonScopeEditor from './ReplayDatabaseComparisonScopeEditor.vue'

const columns = [
  { columnName: 'status', columnComment: '状态', dataType: 'character varying' },
  { columnName: 'amount', columnComment: '金额', dataType: 'numeric' },
]

describe('ReplayDatabaseComparisonScopeEditor', () => {
  it('adds groups and conditions and emits a normalized condition tree', async () => {
    const wrapper = mount(ReplayDatabaseComparisonScopeEditor, {
      props: { modelValue: null, compareLimit: null, columns, primaryKeyColumns: ['id'] },
    })

    await wrapper.get('[data-testid="add-condition-group"]').trigger('click')
    await wrapper.get('[data-testid="condition-column-0-0"]').setValue('status')
    await wrapper.get('[data-testid="condition-operator-0-0"]').setValue('IN')
    await wrapper.get('[data-testid="condition-value-0-0"]').setValue('1, 2')

    const emitted = wrapper.emitted('update:modelValue').at(-1)[0]
    expect(emitted.groups[0].conditions[0]).toEqual({
      columnName: 'status', operator: 'IN', values: ['1', '2'],
    })
    expect(wrapper.get('[data-testid="scope-preview"]').text()).toContain("status in ('1', '2')")
  })

  it('splits IN values entered with Chinese commas', async () => {
    const wrapper = mount(ReplayDatabaseComparisonScopeEditor, {
      props: { modelValue: null, compareLimit: null, columns, primaryKeyColumns: ['id'] },
    })

    await wrapper.get('[data-testid="add-condition-group"]').trigger('click')
    await wrapper.get('[data-testid="condition-column-0-0"]').setValue('status')
    await wrapper.get('[data-testid="condition-operator-0-0"]').setValue('IN')
    const input = wrapper.get('[data-testid="condition-value-0-0"]')
    await input.setValue('1，2 3, 4')

    const emitted = wrapper.emitted('update:modelValue').at(-1)[0]
    expect(emitted.groups[0].conditions[0].values).toEqual(['1', '2', '3', '4'])
    expect(input.element.value).toBe('1,2,3,4')
    expect(wrapper.get('[data-testid="scope-preview"]').text())
      .toContain("status in ('1', '2', '3', '4')")
  })

  it('keeps typed separators and splits IN values entered with spaces', async () => {
    const wrapper = mount(ReplayDatabaseComparisonScopeEditor, {
      props: { modelValue: null, compareLimit: null, columns, primaryKeyColumns: ['id'] },
    })

    await wrapper.get('[data-testid="add-condition-group"]').trigger('click')
    await wrapper.get('[data-testid="condition-column-0-0"]').setValue('status')
    await wrapper.get('[data-testid="condition-operator-0-0"]').setValue('IN')
    const input = wrapper.get('[data-testid="condition-value-0-0"]')
    await input.setValue('1 ')

    expect(input.element.value).toBe('1,')

    await input.setValue(`${input.element.value}2 3 4`)
    const emitted = wrapper.emitted('update:modelValue').at(-1)[0]
    expect(emitted.groups[0].conditions[0].values).toEqual(['1', '2', '3', '4'])
    expect(wrapper.get('[data-testid="scope-preview"]').text())
      .toContain("status in ('1', '2', '3', '4')")
  })

  it('allows trailing separators to be removed with backspace', async () => {
    const wrapper = mount(ReplayDatabaseComparisonScopeEditor, {
      props: { modelValue: null, compareLimit: null, columns, primaryKeyColumns: ['id'] },
    })

    await wrapper.get('[data-testid="add-condition-group"]').trigger('click')
    await wrapper.get('[data-testid="condition-column-0-0"]').setValue('status')
    await wrapper.get('[data-testid="condition-operator-0-0"]').setValue('IN')
    const input = wrapper.get('[data-testid="condition-value-0-0"]')
    await input.setValue('ni,')
    expect(input.element.value).toBe('ni,')

    await input.setValue('ni')
    expect(input.element.value).toBe('ni')
    const emitted = wrapper.emitted('update:modelValue').at(-1)[0]
    expect(emitted.groups[0].conditions[0].values).toEqual(['ni'])
    expect(wrapper.get('[data-testid="scope-preview"]').text()).toContain("status in ('ni')")
    expect(wrapper.get('[data-testid="scope-preview"]').text()).not.toContain("''")
  })

  it('marks missing fields and accepts an optional comparison limit', async () => {
    const wrapper = mount(ReplayDatabaseComparisonScopeEditor, {
      props: {
        modelValue: {
          connector: 'AND',
          groups: [{ connector: 'AND', conditions: [
            { columnName: 'legacy_status', operator: 'EQ', values: ['1'] },
          ] }],
        },
        compareLimit: null,
        columns,
        primaryKeyColumns: ['id'],
      },
    })

    expect(wrapper.get('[data-testid="missing-condition-field-0-0"]').text())
      .toContain('条件字段母库中不存在')
    await wrapper.get('[data-testid="compare-limit"]').setValue('1000')
    expect(wrapper.emitted('update:compareLimit').at(-1)[0]).toBe(1000)
  })

  it('keeps a newly added optional group blank without emitting an invalid condition', async () => {
    const wrapper = mount(ReplayDatabaseComparisonScopeEditor, {
      props: { modelValue: null, compareLimit: null, columns, primaryKeyColumns: ['id'] },
    })

    await wrapper.get('[data-testid="add-condition-group"]').trigger('click')

    expect(wrapper.get('[data-testid="condition-column-0-0"]').element.value).toBe('')
    expect(wrapper.find('.scope-errors').exists()).toBe(false)
    expect(wrapper.get('[data-testid="scope-preview"]').text()).toBe('全表比对')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
