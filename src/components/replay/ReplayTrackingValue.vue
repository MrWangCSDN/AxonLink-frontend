<template>
  <span
    class="replay-tracking-value-wrap"
    @mouseenter="openPopover"
    @mouseleave="scheduleClose"
    @focusin="openPopover"
    @focusout="scheduleClose"
  >
    <span
      ref="valueRef"
      class="replay-tracking-value-text"
      data-testid="tracking-value"
      :tabindex="interactive ? 0 : undefined"
      @mouseenter="openPopover"
      @mouseleave="scheduleClose"
      @focus="openPopover"
      @blur="scheduleClose"
    >{{ displayValue }}</span>
    <span
      v-if="popoverOpen"
      class="replay-tracking-value-popover"
      data-testid="tracking-value-popover"
      role="tooltip"
      @mouseenter="cancelClose"
      @mouseleave="scheduleClose"
    >
      <span class="replay-tracking-value-full">{{ textValue }}</span>
      <button
        class="replay-tracking-value-copy"
        type="button"
        data-testid="tracking-value-copy"
        :aria-label="copyLabel"
        :title="copyLabel"
        @click.stop="copyValue"
      >
        <Check v-if="copyState === 'copied'" :size="14" aria-hidden="true" />
        <Copy v-else :size="14" aria-hidden="true" />
        {{ copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制' }}
      </button>
    </span>
  </span>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, Copy } from 'lucide-vue-next'

const props = defineProps({
  value: {
    type: [String, Number],
    default: '',
  },
})

const valueRef = ref(null)
const overflowed = ref(false)
const popoverOpen = ref(false)
const copyState = ref('idle')
let closeTimer = null
let copyTimer = null
let resizeObserver = null

const textValue = computed(() => props.value === null || props.value === undefined ? '' : String(props.value))
const displayValue = computed(() => textValue.value === '' ? '-' : textValue.value)
const interactive = computed(() => textValue.value !== '' && overflowed.value)
const copyLabel = computed(() => copyState.value === 'copied' ? '复制成功' : copyState.value === 'failed' ? '复制失败' : '复制完整内容')

function measureOverflow() {
  const element = valueRef.value
  overflowed.value = Boolean(element && textValue.value && element.scrollWidth > element.clientWidth + 1)
  if (!overflowed.value) popoverOpen.value = false
}

function openPopover() {
  cancelClose()
  if (interactive.value) popoverOpen.value = true
}

function scheduleClose() {
  cancelClose()
  closeTimer = window.setTimeout(() => {
    popoverOpen.value = false
  }, 120)
}

function cancelClose() {
  if (closeTimer !== null) window.clearTimeout(closeTimer)
  closeTimer = null
}

async function copyValue() {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(textValue.value)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = textValue.value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      textarea.remove()
      if (!copied) throw new Error('copy failed')
    }
    copyState.value = 'copied'
  } catch {
    copyState.value = 'failed'
  }
  if (copyTimer !== null) window.clearTimeout(copyTimer)
  copyTimer = window.setTimeout(() => {
    copyState.value = 'idle'
  }, 1600)
}

watch(textValue, async () => {
  await nextTick()
  measureOverflow()
})

onMounted(() => {
  nextTick(measureOverflow)
  window.addEventListener('resize', measureOverflow)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(measureOverflow)
    if (valueRef.value) resizeObserver.observe(valueRef.value)
  }
})

onBeforeUnmount(() => {
  cancelClose()
  if (copyTimer !== null) window.clearTimeout(copyTimer)
  window.removeEventListener('resize', measureOverflow)
  resizeObserver?.disconnect()
})
</script>

<style scoped>
.replay-tracking-value-wrap { position: relative; display: block; min-width: 0; }
.replay-tracking-value-text { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.replay-tracking-value-text[tabindex] { cursor: help; outline-offset: 2px; }
.replay-tracking-value-popover { position: absolute; z-index: 30; top: calc(100% + 5px); right: 0; width: max-content; max-width: min(360px, calc(100vw - 48px)); display: grid; gap: 8px; padding: 9px; border: 1px solid var(--border, #d7dee8); border-radius: 5px; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); box-shadow: 0 8px 24px rgba(13, 20, 36, .2); }
.replay-tracking-value-full { white-space: normal; overflow-wrap: anywhere; font-size: 12px; line-height: 18px; }
.replay-tracking-value-copy { justify-self: end; display: inline-flex; align-items: center; gap: 4px; min-height: 26px; padding: 3px 7px; border: 1px solid var(--border, #d7dee8); border-radius: 4px; color: var(--text-active, #3b5adb); background: var(--bg-card, #fff); font: inherit; font-size: 11px; cursor: pointer; }
.replay-tracking-value-copy:hover { border-color: var(--text-active, #3b5adb); background: var(--bg-active, #f5f7ff); }
</style>
