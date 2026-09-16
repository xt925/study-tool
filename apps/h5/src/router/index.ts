import { createRouter, createWebHistory } from 'vue-router'

import BattleGame from '@/views/BattleGame.vue'
import GamesView from '@/views/GamesView.vue'
import GradesView from '@/views/GradesView.vue'
import HomeView from '@/views/HomeView.vue'
import LearnView from '@/views/LearnView.vue'
import ListenGame from '@/views/ListenGame.vue'
import MatchGame from '@/views/MatchGame.vue'
import QuizView from '@/views/QuizView.vue'
import UnitsView from '@/views/UnitsView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/grades', name: 'grades', component: GradesView },
    { path: '/grades/:gradeId', name: 'units', component: UnitsView },
    { path: '/learn/:gradeId/:unitId', name: 'learn', component: LearnView },
    { path: '/quiz/:gradeId/:unitId', name: 'quiz', component: QuizView },
    { path: '/games', name: 'games', component: GamesView },
    { path: '/games/listen', name: 'listen-game', component: ListenGame },
    { path: '/games/match', name: 'match-game', component: MatchGame },
    { path: '/games/battle', name: 'battle-game', component: BattleGame },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
