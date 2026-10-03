<template>
  <web-view :src="url" @message="onMessage"></web-view>
</template>

<script setup lang="ts">
// 整个 App 就是一个加载远程 H5 的壳。
// 导航栏标题自动跟随 H5 的 document.title（web-view 的 update-title 默认开启），
// H5 路由切换时在 router.afterEach 里设置 document.title 即可。
// 只在冷启动时带一次时间戳，保证 index.html 不吃 HTTP 缓存。
// 回到前台不再重载：重载会把用户从当前单元页踢回首页、丢掉学习进度；
// 数据刷新交给 H5 内部监听 visibilitychange 处理。
// shell=app：告诉 H5 它跑在外壳 web-view 里，H5 据此把 PageHeader 的标题藏掉（只留返回键）
const url = `https://www.ruohao.com.cn/english-study/?launch=${Date.now()}&shell=app`

function onMessage(e: { detail: { data: unknown[] } }) {
  console.log('web-view message', e.detail.data)
}
</script>
