<template>
  <!-- 导入 SQL 池 Excel 弹窗：与 DiiTaskTriggerModal 同款骨架
       v-model:open 双向绑定父级控制开关 -->
  <div v-if="open" class="dii-modal-mask" @click.self="onMaskClick">
    <div class="dii-modal" role="dialog" @keydown.esc="onCancel">
      <div class="dii-modal-header">
        <h3>导入 SQL 池（Excel）</h3>
        <button class="dii-modal-close" @click="onCancel" aria-label="关闭">×</button>
      </div>

      <div class="dii-modal-body">
        <div class="dii-form-tip">
          工程名（dept-bcc / loan-bcc / sett-bcc / comm-bcc / other）由后端按命名 SQL 前缀自动识别，无需填写。
        </div>

        <div class="dii-form-row">
          <label class="dii-form-label">环境</label>
          <select v-model="env" class="dii-form-input" :disabled="submitting">
            <option value="">（可选）</option>
            <option value="dev">dev</option>
            <option value="sit">sit</option>
            <option value="uat">uat</option>
            <option value="prod">prod</option>
          </select>
        </div>

        <div class="dii-form-row">
          <label class="dii-form-label">文件</label>
          <input
            ref="fileInputRef"
            type="file"
            class="dii-form-input dii-file-input"
            accept=".xlsx"
            :disabled="submitting"
            @change="onFileChange"
          />
        </div>
        <div v-if="fileName" class="dii-file-hint">已选：{{ fileName }}</div>

        <div class="dii-form-row">
          <label class="dii-form-label">口令</label>
          <input
            ref="tokenInputRef"
            v-model="token"
            type="password"
            class="dii-form-input"
            placeholder="请输入触发口令"
            autocomplete="off"
            :disabled="submitting"
            @keyup.enter="onSubmit"
          />
        </div>

        <div v-if="errorMsg" class="dii-form-error">{{ errorMsg }}</div>
        <div v-if="resultText" class="dii-form-success">{{ resultText }}</div>
      </div>

      <div class="dii-modal-footer">
        <button class="dii-btn dii-btn-ghost" @click="onCancel" :disabled="submitting">
          关闭
        </button>
        <button
          class="dii-btn dii-btn-primary"
          :disabled="!canSubmit || submitting"
          @click="onSubmit"
        >
          {{ submitting ? '导入中...' : '导入' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { uploadSqlPoolExcel } from '../../../api/daoIndex.js'

/**
 * Props:
 *   open  - boolean,    控制显示
 *   defaultEnv - string,  打开时回填的默认 env
 * Emits:
 *   update:open  - 关闭弹窗
 *   imported     - 导入成功，payload = 后端返回的统计 map
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  defaultEnv: { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'imported'])

const env = ref(props.defaultEnv || '')
const token = ref('')
const file = ref(null)
const fileName = ref('')
const errorMsg = ref('')
const resultText = ref('')
const submitting = ref(false)
const fileInputRef = ref(null)
const tokenInputRef = ref(null)

const canSubmit = computed(() => token.value && file.value)

// 打开时重置状态
watch(
  () => props.open,
  async (v) => {
    if (v) {
      env.value = props.defaultEnv || ''
      token.value = ''
      file.value = null
      fileName.value = ''
      errorMsg.value = ''
      resultText.value = ''
      await nextTick()
    }
  },
)

function onFileChange(e) {
  const f = e?.target?.files?.[0]
  if (!f) {
    file.value = null
    fileName.value = ''
    return
  }
  file.value = f
  fileName.value = `${f.name} (${(f.size / 1024).toFixed(1)} KB)`
  errorMsg.value = ''
}

function onCancel() {
  if (submitting.value) return
  emit('update:open', false)
}

function onMaskClick() {
  if (submitting.value) return
  emit('update:open', false)
}

async function onSubmit() {
  if (!canSubmit.value || submitting.value) return
  errorMsg.value = ''
  resultText.value = ''
  submitting.value = true
  try {
    const stats = await uploadSqlPoolExcel(
      file.value,
      env.value || undefined,
      token.value,
    )
    resultText.value = formatStats(stats)
    emit('imported', stats)
  } catch (e) {
    if (e?.code === 'TOKEN_INVALID' || e?.message === '口令错误') {
      errorMsg.value = '口令错误，请重新输入'
      token.value = ''
      await nextTick()
      tokenInputRef.value?.focus()
    } else {
      errorMsg.value = `导入失败：${e?.message || e}`
    }
  } finally {
    submitting.value = false
  }
}

function formatStats(s) {
  if (!s) return '导入完成'
  const proj = s.byProject
    ? ' · ' + Object.entries(s.byProject)
        .map(([k, v]) => `${k}:${v}`)
        .join(' / ')
    : ''
  return (
    `导入完成：新增 ${s.inserted ?? 0} / ` +
    `更新 ${s.updated ?? 0} / ` +
    `未变 ${s.unchanged ?? 0} / ` +
    `批内重复 ${s.duplicatedInBatch ?? 0} / ` +
    `Entity 跳过 ${s.skippedEntity ?? 0} / ` +
    `格式错 ${s.skippedMalformed ?? 0}` +
    (s.skippedOversize ? ` / 超长 ${s.skippedOversize}` : '') +
    `（扫描 ${s.totalRowsScanned ?? 0} 行）` +
    proj
  )
}
</script>

<style scoped>
/* 与 DiiTaskTriggerModal 同款骨架 + 主题 token；
   所有颜色经 CSS 变量，自动跟 light/dark 切。 */
.dii-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dii-modal {
  width: 480px;
  max-width: 92vw;
  background: var(--bg-card, #fff);
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}
.dii-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-subtle, #ebeef2);
}
.dii-modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #14171c);
}
.dii-modal-close {
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-secondary, #5a6172);
}
.dii-modal-close:hover { color: var(--text-primary, #14171c); }

.dii-modal-body { padding: 18px 20px; }
.dii-form-tip {
  margin: 0 0 12px;
  padding: 8px 10px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-secondary, #5a6172);
  background: var(--bg-domain-hover, #f5f7fa);
  border: 1px solid var(--border-subtle, #ebeef2);
  border-radius: 4px;
}
[data-theme="dark"] .dii-form-tip {
  background: var(--bg-card-dark, #1f2733);
  border-color: var(--border-subtle-dark, #2a3340);
}
.dii-form-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}
.dii-form-label {
  width: 60px;
  font-size: 13px;
  color: var(--text-secondary, #5a6172);
}
.dii-form-input {
  flex: 1;
  padding: 7px 10px;
  font-size: 13.5px;
  background: var(--bg-input, #fff);
  color: var(--text-primary, #14171c);
  border: 1px solid var(--border, #d4d8dd);
  border-radius: 4px;
  outline: none;
}
.dii-form-input:focus {
  border-color: var(--text-link, #2563eb);
}
.dii-file-input {
  padding: 4px 6px;
}
.dii-file-hint {
  margin: -4px 0 12px 72px;
  font-size: 12px;
  color: var(--text-secondary, #5a6172);
}
.dii-form-error {
  margin-top: 6px;
  padding: 8px 10px;
  background: var(--bg-error-soft, #fff1f0);
  color: var(--text-error, #cf1124);
  border: 1px solid var(--border-error, #ffccc7);
  border-radius: 4px;
  font-size: 12.5px;
}
.dii-form-success {
  margin-top: 6px;
  padding: 8px 10px;
  background: var(--bg-success-soft, #f6ffed);
  color: var(--text-success, #137333);
  border: 1px solid var(--border-success, #b7eb8f);
  border-radius: 4px;
  font-size: 12.5px;
  line-height: 1.6;
}

.dii-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px 16px;
  border-top: 1px solid var(--border-subtle, #ebeef2);
}
.dii-btn {
  padding: 6px 16px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
}
.dii-btn-ghost {
  background: transparent;
  border-color: var(--border, #d4d8dd);
  color: var(--text-secondary, #5a6172);
}
.dii-btn-ghost:hover:not(:disabled) {
  background: var(--bg-domain-hover, #f5f7fa);
}
.dii-btn-primary {
  background: var(--text-link, #2563eb);
  color: #fff;
}
.dii-btn-primary:hover:not(:disabled) {
  background: var(--text-link-hover, #1d4ed8);
}
.dii-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* dark 主题：状态色亮一档，遮罩稍透明 */
[data-theme="dark"] .dii-modal-mask {
  background: rgba(0, 0, 0, 0.6);
}
[data-theme="dark"] .dii-form-error {
  background: var(--bg-error-soft-dark, #3d1f1f);
  border-color: var(--border-error-dark, #6b3030);
  color: var(--text-error-dark, #ff7a7e);
}
[data-theme="dark"] .dii-form-success {
  background: var(--bg-success-soft-dark, #1e3320);
  border-color: var(--border-success-dark, #2f5a32);
  color: var(--text-success-dark, #6ec78a);
}
[data-theme="dark"] .dii-btn-primary {
  background: var(--text-link-dark, #60a5fa);
  color: #0b1220;
}
[data-theme="dark"] .dii-btn-primary:hover:not(:disabled) {
  background: var(--text-link-hover-dark, #93bbfd);
}
</style>
