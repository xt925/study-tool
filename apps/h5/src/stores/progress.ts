import { initStorage, levelFromStars, levelProgress, useProgressStore } from '@study/core'

// h5 平台：进度持久化到 localStorage
initStorage({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
})

export { levelFromStars, levelProgress, useProgressStore }
