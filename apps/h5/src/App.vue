<script setup lang="ts"></script>

<template>
  <div class="mx-auto min-h-screen w-full max-w-md bg-slate-50 shadow-xl">
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </div>
</template>
