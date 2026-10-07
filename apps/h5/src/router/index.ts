import { createRouter, createWebHistory } from 'vue-router'

import AdminView from '@/views/AdminView.vue'
import BattleGame from '@/views/BattleGame.vue'
import ChangePasswordView from '@/views/ChangePasswordView.vue'
import GamesView from '@/views/GamesView.vue'
import GradesView from '@/views/GradesView.vue'
import HomeView from '@/views/HomeView.vue'
import LearnView from '@/views/LearnView.vue'
import ListenGame from '@/views/ListenGame.vue'
import LoginView from '@/views/LoginView.vue'
import MatchGame from '@/views/MatchGame.vue'
import ProfileView from '@/views/ProfileView.vue'
import QuizView from '@/views/QuizView.vue'
import SearchView from '@/views/SearchView.vue'
import TypingGame from '@/views/TypingGame.vue'
import UnitWordsView from '@/views/UnitWordsView.vue'
import UnitsView from '@/views/UnitsView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView, meta: { title: '账号登录' } },
    { path: '/admin', name: 'admin', component: AdminView, meta: { title: '家长中心' } },
    { path: '/profile', name: 'profile', component: ProfileView, meta: { title: '个人信息' } },
    {
      path: '/profile/password',
      name: 'change-password',
      component: ChangePasswordView,
      meta: { title: '修改密码' },
    },
    { path: '/grades', name: 'grades', component: GradesView, meta: { title: '选择年级' } },
    {
      path: '/grades/:gradeId',
      name: 'units',
      component: UnitsView,
      meta: { title: '选择单元' },
    },
    {
      path: '/grades/:gradeId/:unitId',
      name: 'unit-words',
      component: UnitWordsView,
      meta: { title: '单词表' },
    },
    {
      path: '/learn/:gradeId/:unitId',
      name: 'learn',
      component: LearnView,
      meta: { title: '学习' },
    },
    {
      path: '/quiz/:gradeId/:unitId',
      name: 'quiz',
      component: QuizView,
      meta: { title: '练习' },
    },
    { path: '/games', name: 'games', component: GamesView, meta: { title: '游戏乐园' } },
    { path: '/search', name: 'search', component: SearchView, meta: { title: '查单词' } },
    {
      path: '/games/listen',
      name: 'listen-game',
      component: ListenGame,
      meta: { title: '🎧 听音选词' },
    },
    {
      path: '/games/match',
      name: 'match-game',
      component: MatchGame,
      meta: { title: '🧩 单词配对' },
    },
    {
      path: '/games/battle',
      name: 'battle-game',
      component: BattleGame,
      meta: { title: '⚔️ 打怪游戏' },
    },
    {
      path: '/games/typing',
      name: 'typing-game',
      component: TypingGame,
      meta: { title: '🐸 打字过河' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// document.title 跟随路由标题：
// - 浏览器里体现在标签页标题
// - uni-app 外壳里，web-view 的 update-title 默认开启，原生导航栏标题自动跟随 document.title
router.afterEach((to) => {
  document.title = (to.meta.title as string) ?? 'English Adventure 英语学习'
})
