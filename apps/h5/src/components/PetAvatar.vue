<script setup lang="ts">
import { computed } from 'vue'

import { petStage, type PetType } from '@study/core'

const props = withDefaults(
  defineProps<{
    type: PetType
    level?: number
    mood?: number
    size?: number
    /** 互动时触发一次开心跳跃 */
    happy?: boolean
  }>(),
  { level: 1, mood: 80, size: 200, happy: false },
)

const stage = computed(() => petStage(props.level))
const sad = computed(() => props.mood <= 30)
const scarfColor = computed(
  () =>
    ({
      cat: { main: '#7dd3fc', dark: '#38bdf8' },
      dragon: { main: '#a7f3d0', dark: '#6ee7b7' },
      penguin: { main: '#fcd34d', dark: '#f59e0b' },
    })[props.type],
)
</script>

<template>
  <svg
    class="pet-svg"
    :class="{ 'is-happy': happy }"
    :width="size"
    :height="size"
    viewBox="0 0 200 200"
    role="img"
    aria-label="宠物"
  >
    <ellipse cx="100" cy="184" rx="46" ry="9" fill="#0f172a" opacity="0.08" />

    <g class="pet-bob">
      <!-- 🐱 咪咪猫 -->
      <template v-if="type === 'cat'">
        <path
          class="tail"
          d="M138 158 C168 158 177 136 166 118"
          fill="none"
          stroke="#f3a95f"
          stroke-width="13"
          stroke-linecap="round"
        />
        <ellipse cx="100" cy="151" rx="40" ry="32" fill="#f8b878" />
        <ellipse cx="100" cy="157" rx="25" ry="22" fill="#fff6e9" />
        <ellipse cx="83" cy="178" rx="14" ry="8" fill="#fff6e9" />
        <ellipse cx="117" cy="178" rx="14" ry="8" fill="#fff6e9" />

        <path d="M62 80 L55 42 L89 59 Z" fill="#f8b878" />
        <path d="M138 80 L145 42 L111 59 Z" fill="#f8b878" />
        <path d="M66 73 L63 53 L82 63 Z" fill="#ffb7c5" />
        <path d="M134 73 L137 53 L118 63 Z" fill="#ffb7c5" />

        <circle cx="100" cy="99" r="46" fill="#f8b878" />
        <path
          d="M88 58 q-3 8 0 13 M100 55 q-3 8 0 14 M112 58 q3 8 0 13"
          stroke="#ef9c4c"
          stroke-width="3"
          stroke-linecap="round"
          fill="none"
          opacity="0.65"
        />

        <g class="eye">
          <ellipse cx="82" cy="96" rx="6.5" ry="8" fill="#3d3b4f" />
          <circle cx="84.2" cy="93" r="2.1" fill="#fff" />
        </g>
        <g class="eye eye-r">
          <ellipse cx="118" cy="96" rx="6.5" ry="8" fill="#3d3b4f" />
          <circle cx="120.2" cy="93" r="2.1" fill="#fff" />
        </g>

        <circle cx="64" cy="112" r="7.5" fill="#ffb0c0" opacity="0.7" />
        <circle cx="136" cy="112" r="7.5" fill="#ffb0c0" opacity="0.7" />

        <path d="M100 105 l-5 4 h10 Z" fill="#e07a5f" />
        <path
          v-if="sad"
          d="M91 120 q9 -7 18 0"
          stroke="#8a5a44"
          stroke-width="2.4"
          fill="none"
          stroke-linecap="round"
        />
        <path
          v-else
          d="M91 111 q4.5 6 9 0 q4.5 6 9 0"
          stroke="#8a5a44"
          stroke-width="2.4"
          fill="none"
          stroke-linecap="round"
        />
        <g v-if="sad">
          <path class="tear" d="M82 108 q3.5 6 0 9 q-3.5 -3 0 -9" fill="#7dd3fc" />
        </g>

        <path
          d="M57 104 L44 100 M57 112 L45 116 M143 104 L156 100 M143 112 L155 116"
          stroke="#d99050"
          stroke-width="2"
          stroke-linecap="round"
          opacity="0.75"
        />

        <g v-if="stage >= 1">
          <path d="M68 134 q32 17 64 0 l-4 12 q-28 15 -56 0 z" :fill="scarfColor.main" />
          <path d="M127 143 q10 4 9 12 q-1 9 -9 9 q-7 0 -6 -9 q0 -8 6 -12 z" :fill="scarfColor.dark" />
        </g>
        <g v-if="stage >= 2" class="crown">
          <path d="M80 52 l6 8 l14 -12 l14 12 l6 -8 v10 H80 Z" fill="#fbbf24" />
          <circle cx="100" cy="49" r="3" fill="#fb7185" />
          <circle cx="84" cy="56" r="2" fill="#fef3c7" />
          <circle cx="116" cy="56" r="2" fill="#fef3c7" />
        </g>
      </template>

      <!-- 🐲 小火龙 -->
      <template v-else-if="type === 'dragon'">
        <!-- 尾巴：末端是一团小火苗 -->
        <g class="tail">
          <path
            d="M139 157 C166 159 177 141 168 122"
            fill="none"
            stroke="#e85d3f"
            stroke-width="9.5"
            stroke-linecap="round"
          />
          <g transform="translate(170 122)">
            <path
              d="M0 8 C-12 2 -10 -12 2 -22 C8 -10 14 -4 8 4 C6 8 3 10 0 8 Z"
              fill="#fbbf24"
            />
            <path
              d="M1 6 C-5 3 -4 -6 3 -13 C6 -6 9 -2 7 2 C6 5 4 7 1 6 Z"
              fill="#f97316"
            />
            <path
              d="M2 4 C-1 2 0 -2 4 -7 C5 -2 7 0 6 2 C5 4 4 5 2 4 Z"
              fill="#ef4444"
            />
          </g>
        </g>

        <!-- 左右对称的圆角小翅膀 -->
        <path
          class="wing"
          d="M68 132 q-28 -8 -27 -31 q0 -8 8 -4 q10 6 14 17 q-1 -17 9 -19 q8 -2 5 9 q-3 14 -9 28 z"
          fill="#ffb59b"
        />
        <path
          class="wing wing-r"
          d="M132 132 q28 -8 27 -31 q0 -8 -8 -4 q-10 6 -14 17 q1 -17 -9 -19 q-8 -2 -5 9 q3 14 9 28 z"
          fill="#ffb59b"
        />

        <!-- 身体、小手、小脚 -->
        <ellipse cx="100" cy="151" rx="41" ry="33" fill="#f4774f" />
        <ellipse
          cx="67"
          cy="152"
          rx="9"
          ry="13"
          fill="#e85d3f"
          transform="rotate(18 67 152)"
        />
        <ellipse
          cx="133"
          cy="152"
          rx="9"
          ry="13"
          fill="#e85d3f"
          transform="rotate(-18 133 152)"
        />
        <ellipse cx="100" cy="157" rx="26" ry="22" fill="#fff1d9" />
        <ellipse cx="84" cy="181" rx="14" ry="7" fill="#fff1d9" />
        <ellipse cx="116" cy="181" rx="14" ry="7" fill="#fff1d9" />
        <path
          d="M79 182 v5 M84.5 182 v5 M90 182 v5 M110 182 v5 M115.5 182 v5 M121 182 v5"
          stroke="#e0c09a"
          stroke-width="1.3"
          stroke-linecap="round"
          opacity="0.8"
        />

        <!-- 圆角小角 -->
        <path
          d="M62 60 C57 45 61 33 71 29 C77 27 79 33 75 39 C71 46 69 53 71 59 Z"
          fill="#fbbf24"
        />
        <path
          d="M138 60 C143 45 139 33 129 29 C123 27 121 33 125 39 C129 46 131 53 129 59 Z"
          fill="#fbbf24"
        />

        <!-- 头 -->
        <circle cx="100" cy="96" r="45" fill="#f4774f" />

        <g class="eye">
          <ellipse cx="82" cy="95" rx="7" ry="8.5" fill="#3d2b2b" />
          <circle cx="84.4" cy="91.6" r="2.4" fill="#fff" />
          <circle cx="79.8" cy="99" r="1.2" fill="#fff" opacity="0.85" />
        </g>
        <g class="eye eye-r">
          <ellipse cx="118" cy="95" rx="7" ry="8.5" fill="#3d2b2b" />
          <circle cx="120.4" cy="91.6" r="2.4" fill="#fff" />
          <circle cx="115.8" cy="99" r="1.2" fill="#fff" opacity="0.85" />
        </g>

        <circle cx="68" cy="112" r="7" fill="#ff9db4" opacity="0.85" />
        <circle cx="132" cy="112" r="7" fill="#ff9db4" opacity="0.85" />

        <!-- 口鼻 + 小嘴 -->
        <ellipse cx="100" cy="115" rx="22" ry="14" fill="#fff1d9" />
        <circle cx="93.5" cy="112" r="1.7" fill="#b06a4a" />
        <circle cx="106.5" cy="112" r="1.7" fill="#b06a4a" />
        <path
          v-if="sad"
          d="M94 124 q6 -5 12 0"
          stroke="#b06a4a"
          stroke-width="2.2"
          fill="none"
          stroke-linecap="round"
        />
        <path
          v-else
          d="M94 121 q6 5 12 0"
          stroke="#b06a4a"
          stroke-width="2.2"
          fill="none"
          stroke-linecap="round"
        />
        <g v-if="sad">
          <path class="tear" d="M82 107 q3.5 6 0 9 q-3.5 -3 0 -9" fill="#7dd3fc" />
        </g>

        <g v-if="stage >= 1">
          <path d="M68 134 q32 17 64 0 l-4 12 q-28 15 -56 0 z" :fill="scarfColor.main" />
          <path d="M127 143 q10 4 9 12 q-1 9 -9 9 q-7 0 -6 -9 q0 -8 6 -12 z" :fill="scarfColor.dark" />
        </g>
        <g v-if="stage >= 2" class="crown">
          <path d="M78 50 l6 8 l16 -12 l16 12 l6 -8 v12 H78 Z" fill="#fbbf24" />
          <circle cx="100" cy="51" r="3" fill="#fb7185" />
          <circle cx="82" cy="58" r="2" fill="#fef3c7" />
          <circle cx="118" cy="58" r="2" fill="#fef3c7" />
        </g>
      </template>

      <!-- 🐧 团团企鹅 -->
      <template v-else>
        <!-- 圆滚滚的身体与白肚皮 -->
        <ellipse cx="100" cy="139" rx="45" ry="43" fill="#4e5d73" />
        <ellipse cx="100" cy="152" rx="31" ry="33" fill="#f8fafc" />
        <ellipse
          cx="55"
          cy="143"
          rx="10"
          ry="23"
          fill="#445267"
          transform="rotate(8 55 143)"
        />
        <ellipse
          cx="145"
          cy="143"
          rx="10"
          ry="23"
          fill="#445267"
          transform="rotate(-8 145 143)"
        />
        <ellipse cx="84" cy="181" rx="14" ry="7" fill="#f9a03f" />
        <ellipse cx="116" cy="181" rx="14" ry="7" fill="#f9a03f" />
        <path
          d="M79 182 v5 M84.5 182 v5 M90 182 v5 M110 182 v5 M115.5 182 v5 M121 182 v5"
          stroke="#dd8626"
          stroke-width="1.3"
          stroke-linecap="round"
          opacity="0.55"
        />

        <!-- 头 + 两撮柔软呆毛 -->
        <circle cx="100" cy="92" r="40" fill="#4e5d73" />
        <g v-if="stage < 2" fill="#4e5d73">
          <path d="M96 54 q-5 -9 1 -13 q5 -3 4 3 q-1 5 2 9 z" />
          <path d="M106 53 q4 -8 9 -6 q5 2 1 7 q-3 4 -8 4 z" />
        </g>
        <ellipse cx="100" cy="96" rx="29" ry="28" fill="#f8fafc" />
        <path
          d="M74 120 q26 11 52 0"
          stroke="#dfe6ef"
          stroke-width="2"
          fill="none"
          opacity="0.9"
        />

        <g class="eye">
          <ellipse cx="87" cy="91" rx="6.5" ry="8" fill="#2e3a49" />
          <circle cx="89.2" cy="87.8" r="2.2" fill="#fff" />
          <circle cx="85" cy="94.6" r="1.1" fill="#fff" opacity="0.85" />
        </g>
        <g class="eye eye-r">
          <ellipse cx="113" cy="91" rx="6.5" ry="8" fill="#2e3a49" />
          <circle cx="115.2" cy="87.8" r="2.2" fill="#fff" />
          <circle cx="111" cy="94.6" r="1.1" fill="#fff" opacity="0.85" />
        </g>

        <circle cx="79" cy="102" r="5" fill="#ff9db4" opacity="0.7" />
        <circle cx="121" cy="102" r="5" fill="#ff9db4" opacity="0.7" />

        <!-- 圆润的小嘴 -->
        <path
          d="M100 104 q8 5 8 8 q0 4 -8 7 q-8 -3 -8 -7 q0 -3 8 -8 z"
          fill="#f9a03f"
        />
        <path
          v-if="!sad"
          d="M94 110 h12"
          stroke="#e08a2f"
          stroke-width="1.2"
          stroke-linecap="round"
          opacity="0.45"
        />
        <g v-if="sad">
          <path
            d="M77 79 q7 3 13 1 M110 80 q7 2 13 -1"
            stroke="#2e3a49"
            stroke-width="2"
            stroke-linecap="round"
            fill="none"
          />
          <path class="tear" d="M87 101 q3.5 6 0 9 q-3.5 -3 0 -9" fill="#7dd3fc" />
        </g>

        <g v-if="stage >= 1">
          <path d="M70 126 q30 15 60 0 l-4 11 q-26 14 -52 0 z" :fill="scarfColor.main" />
          <path d="M124 136 q10 4 9 12 q-1 9 -9 9 q-7 0 -6 -9 q0 -8 6 -12 z" :fill="scarfColor.dark" />
        </g>
        <g v-if="stage >= 2" class="crown">
          <path d="M72 48 l7 9 l21 -15 l21 15 l7 -9 v14 H72 Z" fill="#fbbf24" />
          <circle cx="100" cy="47" r="3.2" fill="#fb7185" />
          <circle cx="78" cy="58" r="2.2" fill="#fef3c7" />
          <circle cx="122" cy="58" r="2.2" fill="#fef3c7" />
        </g>
      </template>
    </g>

    <!-- 闪光装饰 -->
    <g fill="#fcd34d">
      <path
        class="sparkle"
        d="M32 66 l2.6 6.4 l6.4 2.6 l-6.4 2.6 l-2.6 6.4 l-2.6 -6.4 l-6.4 -2.6 l6.4 -2.6 z"
      />
      <path
        class="sparkle s2"
        d="M170 84 l2.2 5.4 l5.4 2.2 l-5.4 2.2 l-2.2 5.4 l-2.2 -5.4 l-5.4 -2.2 l5.4 -2.2 z"
      />
      <path
        class="sparkle s3"
        d="M154 34 l1.8 4.4 l4.4 1.8 l-4.4 1.8 l-1.8 4.4 l-1.8 -4.4 l-4.4 -1.8 l4.4 -1.8 z"
      />
    </g>

    <!-- 互动时冒出的爱心 -->
    <g v-if="happy" fill="#fb7185">
      <g transform="translate(50 118)">
        <path class="heart" d="M0 5 C0 0 -8 -2 -8 -8 C-8 -13 -2 -14 0 -9 C2 -14 8 -13 8 -8 C8 -2 0 0 0 5 Z" />
      </g>
      <g transform="translate(152 112)">
        <path
          class="heart h2"
          d="M0 4 C0 0 -6 -1.5 -6 -6 C-6 -10 -1.5 -10.5 0 -7 C1.5 -10.5 6 -10 6 -6 C6 -1.5 0 0 0 4 Z"
        />
      </g>
      <g transform="translate(98 40)">
        <path
          class="heart h3"
          d="M0 4 C0 0 -6 -1.5 -6 -6 C-6 -10 -1.5 -10.5 0 -7 C1.5 -10.5 6 -10 6 -6 C6 -1.5 0 0 0 4 Z"
        />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.pet-svg {
  display: block;
  overflow: visible;
  filter: drop-shadow(0 10px 14px rgba(15, 23, 42, 0.16));
}

.pet-bob {
  animation: pet-bob 3.4s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center bottom;
}

@keyframes pet-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.pet-svg.is-happy .pet-bob {
  animation: pet-jump 0.55s ease-in-out 2;
}

@keyframes pet-jump {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  35% {
    transform: translateY(-16px) scale(1.03, 0.98);
  }
  65% {
    transform: translateY(0) scale(0.99, 1.02);
  }
}

.eye {
  animation: pet-blink 4.6s infinite;
  transform-box: fill-box;
  transform-origin: center;
}

.eye-r {
  animation-delay: 0.1s;
}

@keyframes pet-blink {
  0%,
  93%,
  100% {
    transform: scaleY(1);
  }
  96% {
    transform: scaleY(0.08);
  }
}

.tail {
  animation: pet-tail 2.6s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: 8% 90%;
}

@keyframes pet-tail {
  0%,
  100% {
    transform: rotate(-4deg);
  }
  50% {
    transform: rotate(6deg);
  }
}

.wing {
  animation: pet-wing 2.8s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: 50% 8%;
}

.wing-r {
  animation-name: pet-wing-r;
}

@keyframes pet-wing {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(-6deg);
  }
}

@keyframes pet-wing-r {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(6deg);
  }
}

.sparkle {
  transform-box: fill-box;
  transform-origin: center;
  animation: sparkle 2.8s ease-in-out infinite;
  opacity: 0.6;
}

.sparkle.s2 {
  animation-delay: 0.9s;
}

.sparkle.s3 {
  animation-delay: 1.7s;
}

@keyframes sparkle {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.75) rotate(0deg);
  }
  50% {
    opacity: 0.95;
    transform: scale(1.1) rotate(18deg);
  }
}

.heart {
  animation: heart-float 1.2s ease-out forwards;
}

.heart.h2 {
  animation-delay: 0.12s;
}

.heart.h3 {
  animation-delay: 0.24s;
}

@keyframes heart-float {
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.6);
  }
  35% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-26px) scale(1.15);
  }
}

.tear {
  animation: tear-drop 1.8s ease-in infinite;
}

@keyframes tear-drop {
  0% {
    opacity: 0;
    transform: translateY(-2px);
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(10px);
  }
}

.crown {
  animation: crown-shine 3s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center bottom;
}

@keyframes crown-shine {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}
</style>
