<template>
  <web-view :src="url" @message="onMessage"></web-view>
</template>

<script setup lang="ts">
// 整个 App 就是一个加载远程 H5 的壳
const url = 'https://www.ruohao.com.cn/english-study/'

function onMessage(e: { detail: { data: unknown[] } }) {
  console.log('web-view message', e.detail.data)
}
</script>
