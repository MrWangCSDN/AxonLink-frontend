<template>
  <!--
    AI 品牌图标：仿 Adobe Illustrator (Ai) 风格——深棕方块底 + 大号橙色 "Ai" 字母
    用法：<AiBrandIcon :size="20" />
    颜色固定（品牌色），不跟随主题文字色。
  -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    preserveAspectRatio="xMidYMid meet"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    role="img"
  >
    <!-- 深棕底色方块 -->
    <rect
      x="0" y="0"
      width="32" height="32"
      rx="4"
      fill="#2C1808"
    />

    <!-- "Ai" 字母（大写 A + 小写 i，橙色加粗） -->
    <text
      x="16"
      y="24"
      text-anchor="middle"
      font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
      font-weight="900"
      font-size="22"
      fill="#E89020"
      letter-spacing="-0.5"
    >Ai</text>
  </svg>
</template>

<script setup>
defineProps({
  size: { type: [Number, String], default: 20 },
})
</script>
