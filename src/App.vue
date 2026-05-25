<!--
  应用根组件
  原先直接挂 TransactionAnalysis；本期为支持 /login 路由切换，改为 router-view。
  原 TransactionAnalysis 被挂在路由 / 下，业务上零变化。
-->
<template>
  <router-view />
</template>

<script setup>
// 无副作用：路由由 router/index.js 注册并由 main.js use(router) 接入
</script>
