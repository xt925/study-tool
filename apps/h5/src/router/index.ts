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
import SpeechGame from '@/views/SpeechGame.vue'
import UnitsView from '@/views/UnitsView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/admin', name: 'admin', component: AdminView },
    { path: '/profile', name: 'profile', component: ProfileView },
    {
      path: '/profile/password',
      name: 'change-password',
      component: ChangePasswordView,
    },
    { path: '/grades', name: 'grades', component: GradesView },
    { path: '/grades/:gradeId', name: 'units', component: UnitsView },
    { path: '/learn/:gradeId/:unitId', name: 'learn', component: LearnView },
    { path: '/quiz/:gradeId/:unitId', name: 'quiz', component: QuizView },
    { path: '/games', name: 'games', component: GamesView },
    { path: '/games/listen', name: 'listen-game', component: ListenGame },
    { path: '/games/match', name: 'match-game', component: MatchGame },
    { path: '/games/battle', name: 'battle-game', component: BattleGame },
    { path: '/games/speech', name: 'speech-game', component: SpeechGame },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
