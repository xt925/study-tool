<template>
  <view class="page">
    <text class="title">英语学习（uni-app）</text>
    <view v-for="grade in grades" :key="grade.id" class="grade">
      <text>{{ grade.emoji }} {{ grade.name }} · {{ grade.units.length }} 个单元</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { grades } from '@study/core'
</script>

<style>
.page {
  padding: 32rpx;
}
.title {
  font-size: 40rpx;
  font-weight: bold;
  display: block;
  margin-bottom: 24rpx;
}
.grade {
  padding: 16rpx 0;
  font-size: 32rpx;
}
</style>
