<template>
  <!--
    轻量 SQL/DDL 展示：等宽字体 + 可复制 + 可折叠。
    MVP 阶段不接 Monaco，纯 <pre> 已经够用，后续需要再升级。
  -->
  <div class="dii-sql-pre" :class="{ collapsed: collapsed }">
    <div v-if="label || copyable" class="dii-sql-pre-hd">
      <span v-if="label" class="dii-sql-pre-lbl">{{ label }}</span>
      <div class="dii-sql-pre-actions">
        <button v-if="collapsible" class="dii-icon-btn" :title="collapsed ? '展开' : '折叠'" @click="collapsed = !collapsed">
          {{ collapsed ? '展开' : '折叠' }}
        </button>
        <button v-if="copyable" class="dii-icon-btn" :title="copied ? '已复制' : '复制'" @click="doCopy">
          {{ copied ? '✓ 已复制' : '复制' }}
        </button>
      </div>
    </div>
    <pre v-show="!collapsed" class="dii-sql-pre-body"><code>{{ text }}</code></pre>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { copyToClipboard } from '../../../utils/daoIndex.js'

const props = defineProps({
  text: { type: String, default: '' },
  label: { type: String, default: '' },
  copyable: { type: Boolean, default: true },
  collapsible: { type: Boolean, default: false },
  defaultCollapsed: { type: Boolean, default: false },
})

const collapsed = ref(props.defaultCollapsed)
const copied = ref(false)

async function doCopy() {
  const ok = await copyToClipboard(props.text)
  if (!ok) return
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}
</script>

<style scoped>
.dii-sql-pre {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--code-body-bg);
  overflow: hidden;
}

.dii-sql-pre-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--code-header-bg);
  border-bottom: 1px solid var(--code-header-bd);
  font-size: 12px;
}

.dii-sql-pre-lbl {
  color: var(--text-muted);
  font-weight: 500;
}

.dii-sql-pre-actions {
  display: inline-flex;
  gap: 6px;
}

.dii-icon-btn {
  padding: 2px 8px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.dii-icon-btn:hover {
  background: var(--code-copy-hover);
  color: var(--text-primary);
}

.dii-sql-pre-body {
  margin: 0;
  padding: 12px 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--code-text);
  background: var(--code-body-bg);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
}

.dii-sql-pre-body code {
  font-family: inherit;
}
</style>
