<template>
  <div class="scope-editor" data-testid="scope-editor">
    <div class="scope-toolbar">
      <span>条件组之间</span>
      <select v-model="draft.connector" :disabled="disabled || !draft.groups.length" @change="emitTree">
        <option value="AND">并且（AND）</option>
        <option value="OR">或者（OR）</option>
      </select>
      <button type="button" data-testid="add-condition-group" :disabled="disabled" @click="addGroup">＋ 添加条件组</button>
    </div>

    <div v-if="!draft.groups.length" class="scope-empty">未配置 WHERE 条件，将执行全表比对</div>
    <div v-for="(group, groupIndex) in draft.groups" :key="groupIndex" class="condition-group">
      <div class="group-bracket" aria-hidden="true">(</div>
      <div class="group-content">
        <header>
          <strong>条件组 {{ groupIndex + 1 }}</strong>
          <label>组内关系
            <select v-model="group.connector" :disabled="disabled" @change="emitTree">
              <option value="AND">并且（AND）</option>
              <option value="OR">或者（OR）</option>
            </select>
          </label>
          <button type="button" :disabled="disabled" @click="removeGroup(groupIndex)">删除组</button>
        </header>
        <div v-for="(condition, conditionIndex) in group.conditions" :key="conditionIndex" class="condition-row">
          <select
            v-model="condition.columnName"
            :data-testid="`condition-column-${groupIndex}-${conditionIndex}`"
            :class="{ missing: isMissing(condition.columnName) }"
            :disabled="disabled"
            @change="changeColumn(condition)"
          >
            <option value="">选择字段</option>
            <option v-if="isMissing(condition.columnName)" :value="condition.columnName">{{ condition.columnName }}（母库不存在）</option>
            <option v-for="column in columns" :key="column.columnName" :value="column.columnName">
              {{ column.columnName }}{{ column.columnComment ? ` / ${column.columnComment}` : '' }}
            </option>
          </select>
          <select
            v-model="condition.operator"
            :data-testid="`condition-operator-${groupIndex}-${conditionIndex}`"
            :disabled="disabled"
            @change="changeOperator(condition)"
          >
            <option v-for="operator in conditionOperators(condition)" :key="operator" :value="operator">{{ operatorLabels[operator] }}</option>
          </select>
          <template v-if="condition.operator === 'BETWEEN'">
            <input :value="condition.values[0] || ''" :disabled="disabled" placeholder="起始值" @input="setValue(condition, 0, $event.target.value)" />
            <input :value="condition.values[1] || ''" :disabled="disabled" placeholder="结束值" @input="setValue(condition, 1, $event.target.value)" />
          </template>
          <input
            v-else-if="!['IS_NULL', 'IS_NOT_NULL'].includes(condition.operator)"
            :data-testid="`condition-value-${groupIndex}-${conditionIndex}`"
            :value="condition.operator === 'IN' ? condition.inputValue : (condition.values[0] || '')"
            :disabled="disabled"
            :placeholder="condition.operator === 'IN' ? '多个值用逗号或空格分隔' : '条件值'"
            @input="setScalarValue(condition, $event.target.value)"
          />
          <button type="button" :disabled="disabled" @click="removeCondition(groupIndex, conditionIndex)">移除</button>
          <span
            v-if="isMissing(condition.columnName)"
            class="condition-error"
            :data-testid="`missing-condition-field-${groupIndex}-${conditionIndex}`"
          >条件字段母库中不存在</span>
        </div>
        <button type="button" class="add-condition" :disabled="disabled" @click="addCondition(groupIndex)">＋ 添加条件</button>
      </div>
      <div class="group-bracket" aria-hidden="true">)</div>
    </div>

    <div class="limit-row">
      <label for="compare-limit">比对条数</label>
      <input id="compare-limit" data-testid="compare-limit" type="number" min="1" max="10000000" :value="compareLimit ?? ''" :disabled="disabled" placeholder="不填写则全表比对" @input="changeLimit" />
      <span>设置后按数据库主键顺序执行 ORDER BY，再 LIMIT</span>
    </div>

    <div v-if="displayErrors.length" class="scope-errors" role="alert">
      <span v-for="(error, index) in displayErrors" :key="`${error.path}-${index}`">{{ error.reason }}</span>
    </div>
    <pre data-testid="scope-preview" class="scope-preview">{{ preview }}</pre>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import {
  buildScopePreview,
  emptyConditionTree,
  normalizeConditionTree,
  operatorsForDataType,
  validateScopeDraft,
} from './replayDatabaseComparisonScope.js'

const props = defineProps({
  modelValue: { type: Object, default: null },
  compareLimit: { type: Number, default: null },
  columns: { type: Array, default: () => [] },
  primaryKeyColumns: { type: Array, default: () => [] },
  disabled: Boolean,
  errors: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'update:compareLimit'])

const cloneTree = tree => {
  const cloned = JSON.parse(JSON.stringify(normalizeConditionTree(tree) || emptyConditionTree()))
  cloned.groups.forEach(group => group.conditions.forEach(condition => {
    condition.inputValue = condition.values.join(', ')
  }))
  return cloned
}
const draft = reactive(cloneTree(props.modelValue))

watch(() => props.modelValue, value => {
  if (JSON.stringify(normalizeConditionTree(value)) === JSON.stringify(normalizeConditionTree(draft))) return
  Object.assign(draft, cloneTree(value))
}, { deep: true })

const operatorLabels = {
  EQ: '等于', NE: '不等于', GT: '大于', GE: '大于等于', LT: '小于', LE: '小于等于',
  LIKE: '包含（LIKE）', IN: '属于（IN）', BETWEEN: '区间（BETWEEN）',
  IS_NULL: '为空', IS_NOT_NULL: '不为空',
}
const columnByName = computed(() => new Map(props.columns.map(column => [column.columnName.toLowerCase(), column])))
const currentColumn = condition => columnByName.value.get(String(condition.columnName || '').toLowerCase())
const isMissing = name => Boolean(name && !columnByName.value.has(String(name).toLowerCase()))
const conditionOperators = condition => operatorsForDataType(currentColumn(condition)?.dataType)
const preview = computed(() => buildScopePreview(draft, props.columns, props.compareLimit, props.primaryKeyColumns))
const displayErrors = computed(() => [
  ...validateScopeDraft(draft, props.compareLimit, props.columns),
  ...props.errors,
])

const emitTree = () => emit('update:modelValue', normalizeConditionTree(draft))
const defaultCondition = () => ({
  columnName: '',
  operator: 'EQ',
  values: [''],
  inputValue: '',
})
const addGroup = () => {
  draft.groups.push({ connector: 'AND', conditions: [defaultCondition()] })
}
const removeGroup = index => {
  draft.groups.splice(index, 1)
  emitTree()
}
const addCondition = groupIndex => {
  draft.groups[groupIndex].conditions.push(defaultCondition())
}
const removeCondition = (groupIndex, conditionIndex) => {
  draft.groups[groupIndex].conditions.splice(conditionIndex, 1)
  if (!draft.groups[groupIndex].conditions.length) draft.groups.splice(groupIndex, 1)
  emitTree()
}
const changeColumn = condition => {
  const operators = conditionOperators(condition)
  if (!operators.includes(condition.operator)) condition.operator = operators[0]
  changeOperator(condition)
}
const changeOperator = condition => {
  if (['IS_NULL', 'IS_NOT_NULL'].includes(condition.operator)) condition.values = []
  else if (condition.operator === 'BETWEEN') condition.values = [condition.values[0] || '', condition.values[1] || '']
  else if (condition.operator === 'IN') condition.inputValue = condition.values.join(', ')
  else condition.values = [condition.values[0] || '']
  emitTree()
}
const setValue = (condition, index, value) => {
  condition.values[index] = value
  emitTree()
}
const setScalarValue = (condition, value) => {
  if (condition.operator === 'IN') {
    const normalized = value.replace(/[，\s]+/g, ',').replace(/,+/g, ',').replace(/^,/, '')
    condition.inputValue = normalized
    condition.values = normalized.split(',').map(item => item.trim()).filter(Boolean)
  } else {
    condition.values = [value]
  }
  emitTree()
}
const changeLimit = event => {
  const value = event.target.value
  emit('update:compareLimit', value === '' ? null : Number(value))
}
</script>

<style scoped>
.scope-editor { display: grid; gap: 10px; color: #405160; }
.scope-toolbar { display: flex; align-items: center; gap: 8px; }
.scope-toolbar button { margin-left: auto; }
.scope-toolbar select, .condition-row select, .condition-row input, .limit-row input { min-height: 32px; padding: 5px 8px; border: 1px solid #cbd6de; border-radius: 4px; background: #fff; }
.scope-empty { padding: 14px; border: 1px dashed #cbd6de; color: #7b8995; background: #f8fafb; text-align: center; }
.condition-group { display: grid; grid-template-columns: 18px minmax(0, 1fr) 18px; gap: 6px; padding: 8px 0; border-top: 1px solid #e3e9ed; }
.group-bracket { display: grid; place-items: center; color: #168478; font: 38px/1 Georgia, serif; }
.group-content { min-width: 0; }
.group-content header { display: flex; align-items: center; gap: 10px; margin-bottom: 7px; }
.group-content header strong { color: #176f74; }
.group-content header label { display: flex; align-items: center; gap: 6px; margin-left: auto; font-size: 12px; }
.condition-row { display: grid; grid-template-columns: minmax(190px, 1.2fr) 145px minmax(150px, 1fr) auto; gap: 7px; align-items: center; margin-bottom: 7px; }
.condition-row select.missing { border-color: #d9534f; background: #fff2f1; }
.condition-error { grid-column: 1 / -1; color: #c43f3a; font-size: 11px; }
.add-condition { color: #167e76; border: 0; background: transparent; }
.limit-row { display: grid; grid-template-columns: auto minmax(180px, 280px) 1fr; align-items: center; gap: 10px; padding-top: 10px; border-top: 1px solid #e3e9ed; }
.limit-row span { color: #7b8995; font-size: 12px; }
.scope-errors { display: grid; gap: 3px; color: #c43f3a; font-size: 11px; }
.scope-preview { min-height: 48px; margin: 0; padding: 9px 11px; overflow: auto; border-left: 3px solid #168478; color: #304451; background: #f2f7f7; white-space: pre-wrap; }
button { padding: 6px 9px; border: 1px solid #c8d3da; border-radius: 4px; background: #fff; cursor: pointer; }
button:disabled, input:disabled, select:disabled { opacity: .55; cursor: not-allowed; }
@media (max-width: 900px) { .condition-row { grid-template-columns: 1fr; }.limit-row { grid-template-columns: 1fr; } }
</style>
