<template>
  <div class="deep-analysis-panel">
    <div class="dap-header">
      <span class="dap-title">深度分析</span>
      <span v-if="fallbackReason" class="dap-badge dap-badge-warn">已降级：{{ fallbackReason }}</span>
      <span v-else-if="model" class="dap-badge">{{ model }}</span>
      <button class="dap-close" @click="$emit('close')">收起</button>
    </div>

    <div class="dap-ask-row">
      <input
        v-model="question"
        class="dap-input"
        type="text"
        placeholder="想深入了解什么？（留空则整体解读该交易）"
        :disabled="running"
        @keyup.enter="start"
      />
      <button v-if="!running" class="dap-btn" @click="start">开始分析</button>
      <button v-else class="dap-btn dap-btn-stop" @click="stop">停止</button>
    </div>

    <div v-if="toolTimeline.length" class="dap-timeline">
      <div v-for="(t, i) in toolTimeline" :key="i" class="dap-timeline-item">
        <span class="dap-tool-name">{{ t.tool }}</span>
        <span class="dap-tool-status">{{ t.status }}</span>
      </div>
    </div>

    <div v-if="renderedHtml" class="dap-output" v-html="renderedHtml"></div>
    <div v-else-if="running" class="dap-output dap-output-waiting">模型正在探索代码仓库…</div>
    <div v-if="errorMessage" class="dap-error">{{ errorMessage }}</div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import MarkdownIt from 'markdown-it'
import { streamDeepAnalysis } from '../api/index.js'

// markdown-it 渲染器：html:false 禁用内联 HTML（防 XSS），linkify 自动识别链接文本，
// breaks 把单个换行转成 <br>。配置对齐 MonacoCodeViewer.vue 的智能解读渲染器。
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

const props = defineProps({
  txId: { type: String, required: true },
})
defineEmits(['close'])

const question = ref('')
const running = ref(false)
const model = ref('')
const fallbackReason = ref('')
const renderedHtml = ref('')
const toolTimeline = ref([])
const errorMessage = ref('')

// 流式累积的原始 markdown 文本 & 中断控制器：不直接喂给模板渲染，无需响应式包装
let contentBuffer = ''
let abortController = null

function reset() {
  model.value = ''
  fallbackReason.value = ''
  contentBuffer = ''
  renderedHtml.value = ''
  toolTimeline.value = []
  errorMessage.value = ''
}

async function start() {
  if (running.value) return
  reset()
  running.value = true
  abortController = new AbortController()

  try {
    await streamDeepAnalysis(props.txId, { question: question.value }, {
      signal: abortController.signal,
      onStart: (e) => {
        model.value = e.model || ''
      },
      onFallback: (e) => {
        fallbackReason.value = e.reason || '深度模式不可用'
      },
      onDelta: (e) => {
        contentBuffer += e.content || ''
        renderedHtml.value = md.render(contentBuffer)
      },
      onTool: (e) => {
        toolTimeline.value.push({ tool: e.tool || '?', status: e.status || '' })
      },
      onDone: (e) => {
        if (e.content) {
          contentBuffer = e.content
          renderedHtml.value = md.render(contentBuffer)
        }
        running.value = false
      },
      onError: (e) => {
        errorMessage.value = e.message || '深度分析失败'
        running.value = false
      },
    })
  } catch (error) {
    // streamDeepAnalysis 非 abort 错误时会先调用 onError（errorMessage/running 已在上面设好）
    // 再重新 throw；用户主动 stop() 触发的 abort 则不经过 onError，直接重新 throw 原始
    // AbortError。两种情况这里都统一吞掉——UI 状态已经在别处（onError 或 stop()）收尾，
    // 这个 catch 只是为了不让 promise rejection 冒到组件外面变成未捕获异常。
  } finally {
    running.value = false
  }
}

function stop() {
  abortController?.abort()
  running.value = false
}

onBeforeUnmount(() => {
  abortController?.abort()
})
</script>

<style scoped>
/* 全部颜色走 src/style.css 里的既有 CSS 变量（:root 定义 + [data-theme="dark"] 覆盖），
   本组件不写任何裸色值，也不新增组件级 dark 覆盖——双主题切换完全交给全局 token。 */

.deep-analysis-panel {
  padding: 16px;
  border-radius: 10px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
}

/* ── 头部：标题 + 徽章 + 收起按钮 ── */
.dap-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}
.dap-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  flex-shrink: 0;
}
.dap-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: var(--bg-badge);
  color: var(--text-badge);
}
.dap-badge-warn {
  color: var(--c-rating-poor);
}
.dap-close {
  height: 28px;
  padding: 0 10px;
  margin-left: auto;
  flex-shrink: 0;
  border-radius: 6px;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.dap-close:hover {
  color: var(--text-active);
  border-color: var(--text-active);
  background: var(--bg-domain-active);
}

/* ── 提问行 ── */
.dap-ask-row {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.dap-input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
}
.dap-input::placeholder {
  color: var(--text-faint);
}
.dap-input:focus {
  outline: none;
  border-color: var(--text-active);
  box-shadow: 0 0 0 3px var(--bg-domain-active);
}
.dap-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.dap-btn {
  height: 34px;
  padding: 0 16px;
  flex-shrink: 0;
  border-radius: 6px;
  border: 1px solid var(--text-active);
  background: var(--text-active);
  color: var(--btn-primary-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.05s;
}
.dap-btn:hover {
  opacity: 0.92;
}
.dap-btn:active {
  transform: translateY(1px);
}
.dap-btn-stop {
  background: var(--bg-action-btn);
  color: var(--text-secondary);
  border-color: var(--border);
}
.dap-btn-stop:hover {
  background: var(--bg-domain-hover);
  opacity: 1;
}

/* ── 工具调用时间线 ── */
.dap-timeline {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.dap-timeline-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--layer-bg);
  border: 1px solid var(--layer-bd);
  font-size: 12px;
}
.dap-tool-name {
  color: var(--text-primary);
  font-weight: 600;
}
.dap-tool-status {
  color: var(--text-faint);
}

/* ── 输出区 ── */
.dap-output {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--layer-bg);
  border: 1px solid var(--layer-bd);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.7;
  overflow-x: auto;
}
.dap-output-waiting {
  color: var(--text-faint);
  font-style: italic;
  animation: dap-pulse 1.6s ease-in-out infinite;
}
@keyframes dap-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

/* ── 错误提示：token 组合对齐 Login.vue .form-error 的既有用法 ── */
.dap-error {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--c-rating-error);
  background: var(--build-sync-error-bg);
  border: 1px solid var(--build-sync-error-border);
}

/* ── markdown 渲染内容：v-html 注入的元素不带 scoped 编译出的 data-v 属性，
     普通 scoped 选择器打不中，必须用 :deep() 穿透 ── */
.dap-output :deep(h1),
.dap-output :deep(h2),
.dap-output :deep(h3) {
  margin: 14px 0 8px;
  color: var(--text-primary);
  font-weight: 700;
  line-height: 1.4;
}
.dap-output :deep(h1:first-child),
.dap-output :deep(h2:first-child),
.dap-output :deep(h3:first-child) {
  margin-top: 0;
}
.dap-output :deep(h1) { font-size: 18px; }
.dap-output :deep(h2) { font-size: 16px; }
.dap-output :deep(h3) { font-size: 14px; }
.dap-output :deep(p) {
  margin: 0 0 10px;
  color: var(--text-secondary);
}
.dap-output :deep(p:last-child) {
  margin-bottom: 0;
}
.dap-output :deep(ul),
.dap-output :deep(ol) {
  margin: 0 0 10px 20px;
  padding: 0;
  color: var(--text-secondary);
}
.dap-output :deep(li) {
  margin-bottom: 4px;
}
.dap-output :deep(strong) {
  color: var(--text-primary);
  font-weight: 700;
}
.dap-output :deep(a) {
  color: var(--text-active);
  text-decoration: underline;
}
.dap-output :deep(blockquote) {
  margin: 10px 0;
  padding: 8px 12px;
  border-left: 3px solid var(--text-active);
  background: var(--bg-card-secondary);
  color: var(--text-muted);
  border-radius: 0 6px 6px 0;
}
.dap-output :deep(pre) {
  margin: 10px 0;
  padding: 12px 14px;
  overflow-x: auto;
  border-radius: 8px;
  background: var(--bg-card-secondary);
  border: 1px solid var(--border);
}
.dap-output :deep(code) {
  font-family: 'Consolas', 'Cascadia Code', 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
}
.dap-output :deep(pre code) {
  padding: 0;
  background: transparent;
  color: var(--text-primary);
}
.dap-output :deep(:not(pre) > code) {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-card-secondary);
  color: var(--text-active);
}
.dap-output :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 12px;
}
.dap-output :deep(th),
.dap-output :deep(td) {
  padding: 6px 10px;
  border: 1px solid var(--border);
  text-align: left;
}
.dap-output :deep(th) {
  color: var(--text-primary);
  background: var(--bg-card-secondary);
}
.dap-output :deep(td) {
  color: var(--text-secondary);
}
</style>
