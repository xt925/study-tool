<template>
  <web-view :src="url" @message="onMessage"></web-view>
</template>

<script setup lang="ts">
// 整个 App 就是一个加载远程 H5 的壳。
// 只在冷启动时带一次时间戳，保证 index.html 不吃 HTTP 缓存。
// 回到前台不再重载：重载会把用户从当前单元页踢回首页、丢掉学习进度；
// 数据刷新交给 H5 内部监听 visibilitychange 处理。
const url = `https://www.ruohao.com.cn/english-study/?launch=${Date.now()}`

function onMessage(e: { detail: { data: unknown[] } }) {
  console.log('web-view message', e.detail.data)
}
</script>
