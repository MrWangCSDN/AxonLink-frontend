<template>
  <!-- 触发巡检任务弹窗：受口令保护
       v-model:open 双向绑定：父控制开关 -->
  <div v-if="open" class="dii-modal-mask" @click.self="onMaskClick">
    <div class="dii-modal" role="dialog" @keydown.esc="onCancel">
      <div class="dii-modal-header">
        <h3>触发巡检任务</h3>
        <button class="dii-modal-close" @click="onCancel" aria-label="关闭">×</button>
      </div>

      <div class="dii-modal-body">
        <div class="dii-form-row">
          <label class="dii-form-label">环境</label>
          <select v-model="localEnv" class="dii-form-input">
            <option value="dev">dev</option>
            <option value="uat">uat</option>
            <option value="prod">prod</option>
          </select>
        </div>

        <div class="dii-form-row">
          <label class="dii-form-label">口令</label>
          <input
            ref="tokenInputRef"
            v-model="token"
            type="password"
            class="dii-form-input"
            placeholder="请输入触发口令"
            autocomplete="off"
            @keyup.enter="onSubmit"
          />
        </div>

        <div v-if="errorMsg" class="dii-form-error">{{ errorMsg }}</div>
      </div>

      <div class="dii-modal-footer">
        <button class="dii-btn dii-btn-ghost" @click="onCancel" :disabled="submitting">
          取消
        </button>
        <button
          class="dii-btn dii-btn-primary"
          :disabled="!token || submitting"
          @click="onSubmit"
        >
          {{ submitting ? '触发中...' : '触发' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { triggerDiiBatch } from '../../../api/daoIndex.js'

/**
 * Props:
 *   open  - boolean,    控制显示
 *   env   - string,     默认环境（点开时 prefill）
 * Emits:
 *   update:open - 关闭弹窗
 *   triggered  - 触发成功，payload = { taskId, env, ... }
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  env: { type: String, default: 'uat' },
})
const emit = defineEmits(['update:open', 'triggered'])

const localEnv = ref(props.env)
const token = ref('')
const errorMsg = ref('')
const submitting = ref(false)
const tokenInputRef = ref(null)

// 弹窗打开时同步 env、聚焦输入框、清空旧错误
watch(() => props.open, async (v) => {
  if (v) {
    localEnv.value = props.env
    token.value = ''
    errorMsg.value = ''
    await nextTick()
    tokenInputRef.value?.focus()
  }
})

function onCancel() {
  if (submitting.value) return
  emit('update:open', false)
}

// 弹窗外点击：仅在非 submitting 时关
function onMaskClick() {
  if (submitting.value) return
  emit('update:open', false)
}

async function onSubmit() {
  if (!token.value || submitting.value) return
  errorMsg.value = ''
  submitting.value = true
  try {
    const data = await triggerDiiBatch(localEnv.value, token.value)
    emit('triggered', data)
    emit('update:open', false)
  } catch (e) {
    // err.code === 'TOKEN_INVALID'（来自 api/daoIndex.js）= 口令错误
    if (e?.code === 'TOKEN_INVALID' || e?.message === '口令错误') {
      errorMsg.value = '口令错误，请重新输入'
      token.value = ''
      await nextTick()
      tokenInputRef.value?.focus()
    } else {
      errorMsg.value = `触发失败：${e?.message || e}`
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
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
  width: 420px;
  max-width: 90vw;
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
.dii-form-row { display: flex; align-items: center; margin-bottom: 14px; gap: 12px; }
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
.dii-form-error {
  margin-top: 6px;
  padding: 8px 10px;
  background: var(--bg-error-soft, #fff1f0);
  color: var(--text-error, #cf1124);
  border: 1px solid var(--border-error, #ffccc7);
  border-radius: 4px;
  font-size: 12.5px;
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

/* dark 模式补丁：状态色亮一档，遮罩稍透明 */
[data-theme="dark"] .dii-modal-mask {
  background: rgba(0, 0, 0, 0.6);
}
[data-theme="dark"] .dii-form-error {
  background: var(--bg-error-soft-dark, #3d1f1f);
  border-color: var(--border-error-dark, #6b3030);
  color: var(--text-error-dark, #ff7a7e);
}
[data-theme="dark"] .dii-btn-primary {
  background: var(--text-link-dark, #60a5fa);
  color: #0b1220;
}
[data-theme="dark"] .dii-btn-primary:hover:not(:disabled) {
  background: var(--text-link-hover-dark, #93bbfd);
}
</style>
