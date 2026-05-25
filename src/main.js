import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router/index.js'

// 接入 vue-router：原项目无 router，本期为支持 /login 引入 vue-router 4
createApp(App).use(router).mount('#app')
