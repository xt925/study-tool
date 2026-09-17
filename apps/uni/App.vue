<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  console.log('App Launch')
  // #ifdef APP-PLUS
  // 启动时主动申请麦克风权限：web-view 里 H5 的 getUserMedia 依赖系统权限已授予
  // @ts-expect-error plus 是 5+ 运行时全局对象
  plus.android.requestPermissions(
    ['android.permission.RECORD_AUDIO'],
    () => console.log('录音权限已就绪'),
    () => console.warn('录音权限被拒绝'),
  )
  // #endif
})
</script>

<style>
/* 全局样式 */
</style>
