<template>
  <!--
    环境切换：下拉选择 dev / sit / uat
    使用方式：<DiiEnvSwitcher v-model="env" />
  -->
  <div class="dii-env-dd" :class="{ open }" v-click-outside="close">
    <button
      type="button"
      class="dii-env-trigger"
      :title="`当前环境：${current.label}`"
      @click="open = !open"
    >
      <span class="dii-env-dot" :style="{ background: current.color }"></span>
      <span class="dii-env-label">{{ current.label }}</span>
      <ChevronDown
        :size="14"
        :stroke-width="2"
        class="dii-env-chev"
        :class="{ flip: open }"
      />
    </button>

    <transition name="dii-env-pop">
      <ul v-if="open" class="dii-env-menu" role="listbox">
        <li
          v-for="e in envs"
          :key="e.key"
          class="dii-env-item"
          :class="{ active: modelValue === e.key }"
          role="option"
          :aria-selected="modelValue === e.key"
          @click="onPick(e.key)"
        >
          <span class="dii-env-dot" :style="{ background: e.color }"></span>
          <span class="dii-env-label">{{ e.label }}</span>
          <Check v-if="modelValue === e.key" :size="13" :stroke-width="2.5" class="dii-env-check" />
        </li>
      </ul>
    </transition>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'
import { DII_ENVS } from '../constants.js'

const props = defineProps({
  modelValue: { type: String, default: 'uat' },
  envs: { type: Array, default: () => DII_ENVS },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
function close() { open.value = false }

const current = computed(
  () => props.envs.find(e => e.key === props.modelValue) || props.envs[0],
)

function onPick(key) {
  emit('update:modelValue', key)
  open.value = false
}

/* 极简的"点击外部关闭"指令：避免引入 vue-clickaway 之类的依赖 */
const vClickOutside = {
  mounted(el, binding) {
    el.__handler = (e) => { if (!el.contains(e.target)) binding.value() }
    document.addEventListener('mousedown', el.__handler)
  },
  unmounted(el) {
    document.removeEventListener('mousedown', el.__handler)
  },
}
</script>

<style scoped>
.dii-env-dd {
  position: relative;
  display: inline-block;
}

.dii-env-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px 10px;
  height: 30px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, #e1e5eb);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary, #14171c);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  font: inherit;
  font-size: 12px;
  min-width: 92px;
}
.dii-env-trigger:hover {
  border-color: var(--text-faint, #8990a0);
}
.dii-env-dd.open .dii-env-trigger {
  border-color: #0b70db;
}

.dii-env-label {
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.dii-env-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.dii-env-chev {
  margin-left: auto;
  color: var(--text-faint, #8990a0);
  transition: transform 0.18s ease;
}
.dii-env-chev.flip { transform: rotate(180deg); }

/* 下拉菜单 */
.dii-env-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 50;
  min-width: 100%;
  padding: 4px;
  margin: 0;
  list-style: none;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, #e1e5eb);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04);
}

.dii-env-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary, #14171c);
  white-space: nowrap;
}
.dii-env-item:hover { background: var(--bg-domain-hover, #f1f3f5); }
.dii-env-item.active { color: #0b70db; font-weight: 600; }
.dii-env-check { color: #0b70db; flex-shrink: 0; }

/* dark 主题：弹层换暗色 */
[data-theme="dark"] .dii-env-trigger {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.10);
  color: #f1f3f8;
}
[data-theme="dark"] .dii-env-trigger:hover { border-color: rgba(255, 255, 255, 0.20); }
[data-theme="dark"] .dii-env-dd.open .dii-env-trigger { border-color: #FF5543; }
[data-theme="dark"] .dii-env-menu {
  background: #161c28;
  border-color: rgba(255, 255, 255, 0.10);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}
[data-theme="dark"] .dii-env-item { color: #c8cad0; }
[data-theme="dark"] .dii-env-item:hover { background: rgba(255, 255, 255, 0.04); }
[data-theme="dark"] .dii-env-item.active { color: #FF5543; }
[data-theme="dark"] .dii-env-check { color: #FF5543; }

/* 弹出动画 */
.dii-env-pop-enter-active,
.dii-env-pop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.dii-env-pop-enter-from,
.dii-env-pop-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
</style>
