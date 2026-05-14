<template>
  <div ref="wrapRef" class="td-wrap">
    <button type="button" class="td-trigger" :class="{ open }" :style="triggerStyle" @click="open = !open">
      <component :is="meta.icon" class="td-t-ico" :style="{ color: selectedItem ? meta.color : '#BFBFBF' }" />
      <span class="td-txt" :class="{ mono: !!selectedItem }">{{ selectedItem ? selectedItem.id : `选择${meta.label.replace('分析', '')}…` }}</span>
      <span v-if="selectedItem" class="td-pill" :style="{ color: meta.color, background: meta.bg, borderColor: meta.border }">已选</span>
      <svg class="td-chev" :class="{ flip: open }" width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M3 5.5l4 4 4-4" stroke="#BFBFBF" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>

    <div v-if="open" class="td-panel">
      <div class="td-search-wrap">
        <svg class="td-search-ico" width="13" height="13" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="#BFBFBF" stroke-width="1.5" />
          <path d="M10.5 10.5L14 14" stroke="#BFBFBF" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <input
          ref="inputRef"
          v-model="search"
          type="text"
          class="td-input"
          :placeholder="meta.placeholder"
          :style="inputStyle"
        />
        <button v-if="search" type="button" class="td-clear" @click.stop="search = ''">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="#BFBFBF" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <div class="td-count">
        <span class="td-muted">{{ search ? `找到 ${filtered.length} / ${items.length} 条` : `共 ${items.length} 条` }}</span>
        <span v-if="selectedId" class="td-sel-hint" :style="{ color: meta.color }">· 已选 {{ selectedId }}</span>
      </div>
      <div class="td-list">
        <div v-if="filtered.length === 0" class="td-empty">未找到「{{ search }}」相关结果</div>
        <div
          v-for="item in filtered"
          :key="item.id"
          class="td-item"
          :class="{ active: item.id === selectedId }"
          :style="item.id === selectedId ? { background: meta.color + '10', borderColor: meta.color + '40' } : {}"
          @click="pick(item.id)"
        >
          <div class="td-dot" :style="dotStyle(item)" />
          <div class="td-item-mid">
            <div class="td-row">
              <span class="td-id mono" v-html="highlight(item.id, search, meta.color, true)" />
              <span
                v-if="item.domainId && domainShort[item.domainId]"
                class="td-dom"
                :style="domStyle(item.domainId)"
              >{{ domainShort[item.domainId] }}</span>
            </div>
            <div class="td-name" v-html="highlight(item.name || '', search, meta.color, false)" />
          </div>
          <span v-if="item.id === selectedId" class="td-check" :style="{ color: meta.color }">✓</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { DOMAIN_COLORS } from './constants.js'

const props = defineProps({
  items: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
  meta: { type: Object, required: true },
})

const emit = defineEmits(['select'])

const open = ref(false)
const search = ref('')
const wrapRef = ref(null)
const inputRef = ref(null)

const domainShort = {
  common: '公共',
  loan: '贷款',
  deposit: '存款',
  settlement: '结算',
  public: '公共',
  ap: '平台',
  platform: '平台',
  dept: '机构',
  unvr: '通用',
  stmt: '账单',
  medu: '介质',
  inbu: '内部',
  aggr: '聚合',
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_\-\s]+/g, '')
}

function highlight(text, query, color, isId) {
  const t = text || ''
  const q = (query || '').trim()
  if (!q) return escapeHtml(t)
  const idx = t.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return escapeHtml(t)
  const w = t.slice(idx, idx + q.length)
  const cls = isId ? 'td-hl td-hl-id' : 'td-hl'
  return (
    escapeHtml(t.slice(0, idx)) +
    `<span class="${cls}" style="color:${color};font-weight:700;background:${color}18;border-radius:2px;padding:0 1px">${escapeHtml(w)}</span>` +
    escapeHtml(t.slice(idx + q.length))
  )
}

function domStyle(id) {
  const c = DOMAIN_COLORS[id] || '#8C8C8C'
  return { color: c, background: c + '18', borderColor: c + '30' }
}

function dotStyle(item) {
  const on = item.id === props.selectedId
  return {
    background: on ? props.meta.color : 'transparent',
    border: on ? 'none' : '1px solid #E0E0E0',
  }
}

const filtered = computed(() => {
  const rawQuery = search.value.trim()
  if (!rawQuery) return props.items

  const plainQuery = rawQuery.toLowerCase()
  const normalizedQuery = normalizeSearchText(rawQuery)

  return props.items.filter((item) => {
    const candidates = [
      item.id,
      item.name,
      item.longname,
      item.desc,
      item.projectName,
    ].filter(Boolean)

    return candidates.some((candidate) => {
      const text = String(candidate)
      return text.toLowerCase().includes(plainQuery)
        || normalizeSearchText(text).includes(normalizedQuery)
    })
  })
})

const selectedItem = computed(() => props.items.find((i) => i.id === props.selectedId))

const triggerStyle = computed(() => ({
  borderColor: open.value ? props.meta.color : '#D9D9D9',
  boxShadow: open.value ? `0 0 0 2px ${props.meta.color}20` : 'none',
  background: open.value ? '#fff' : '#FAFAFA',
}))

const inputStyle = computed(() => ({
  borderColor: search.value ? props.meta.color : '#E0E0E0',
  boxShadow: search.value ? `0 0 0 2px ${props.meta.color}18` : 'none',
}))

function pick(id) {
  emit('select', id)
  open.value = false
  search.value = ''
}

function onDocDown(e) {
  if (wrapRef.value && !wrapRef.value.contains(e.target)) {
    open.value = false
    search.value = ''
  }
}

watch(open, (v) => {
  if (v) nextTick(() => inputRef.value?.focus())
})

onMounted(() => document.addEventListener('mousedown', onDocDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocDown))
</script>

<style scoped>
.td-wrap {
  position: relative;
  flex-shrink: 0;
}

.td-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px 0 12px;
  min-width: 440px;
  max-width: 600px;
  border: 1px solid #d9d9d9;
  border-radius: 7px;
  cursor: pointer;
  outline: none;
  font-family: inherit;
  transition: all 0.15s;
}

.td-t-ico {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.td-txt {
  flex: 1;
  text-align: left;
  font-size: 13px;
  color: #1a1a1a;
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-txt.mono {
  font-weight: 600;
  font-family: ui-monospace, monospace;
}

.td-pill {
  font-size: 10px;
  border: 1px solid;
  border-radius: 10px;
  padding: 0 6px;
  line-height: 16px;
  font-weight: 600;
  flex-shrink: 0;
}

.td-chev {
  flex-shrink: 0;
  transition: transform 0.2s;
}

.td-chev.flip {
  transform: rotate(180deg);
}

.td-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 999;
  width: 600px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

[data-theme='dark'] .td-panel {
  background: var(--bg-card);
  border-color: var(--border);
}

.td-search-wrap {
  position: relative;
  padding: 10px 10px 6px;
  border-bottom: 1px solid #f5f5f5;
  background: #fafafa;
}

.td-search-ico {
  position: absolute;
  left: 19px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.td-input {
  width: 100%;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  padding-left: 30px;
  padding-right: 28px;
  font-size: 12px;
  color: #262626;
  outline: none;
  box-sizing: border-box;
  background: #fff;
  transition: all 0.15s;
}

.td-clear {
  position: absolute;
  right: 17px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
}

.td-count {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  padding: 0 12px 8px;
}

.td-muted {
  font-size: 11px;
  color: #bfbfbf;
}

.td-sel-hint {
  font-size: 10px;
  font-weight: 600;
}

.td-list {
  max-height: 320px;
  overflow-y: auto;
  padding: 4px 6px 6px;
}

.td-empty {
  padding: 24px 8px;
  text-align: center;
  color: #bfbfbf;
  font-size: 12px;
}

.td-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 7px;
  margin-bottom: 1px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.12s;
}

.td-item:hover:not(.active) {
  background: #f5f7fa;
}

.td-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.td-item-mid {
  flex: 1;
  min-width: 0;
}

.td-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.td-id {
  font-size: 12px;
  color: #262626;
  font-weight: 500;
}

.td-id :deep(.td-hl-id) {
  font-family: ui-monospace, monospace;
}

.td-item.active .td-id {
  color: inherit;
  font-weight: 700;
}

.mono {
  font-family: ui-monospace, monospace;
}

.td-name {
  font-size: 11px;
  color: #8c8c8c;
  margin-top: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-dom {
  font-size: 9px;
  border: 1px solid;
  border-radius: 3px;
  padding: 0 4px;
  line-height: 15px;
  flex-shrink: 0;
}

.td-check {
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}
</style>
