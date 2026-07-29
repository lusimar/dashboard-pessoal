import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
    },
    {
      path: '/companies',
      name: 'companies',
      component: () => import('../views/CompaniesView.vue'),
    },
    {
      path: '/documents',
      name: 'documents',
      component: () => import('../views/DocumentsView.vue'),
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('../views/ProjectsView.vue'),
    },
    {
      path: '/finances',
      name: 'finances',
      component: () => import('../views/FinancesView.vue'),
    },
    {
      path: '/cards',
      name: 'cards',
      component: () => import('../views/CardsView.vue'),
    },
    {
      path: '/college',
      name: 'college',
      component: () => import('../views/CollegeView.vue'),
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: () => import('../views/TasksView.vue'),
    },
    {
      path: '/tasks/:id',
      name: 'task-editor',
      component: () => import('../views/TaskEditorView.vue'),
      meta: { fullscreen: true },
    },
    {
      path: '/reminders',
      name: 'reminders',
      component: () => import('../views/RemindersView.vue'),
    },
    {
      path: '/notes',
      name: 'notes',
      component: () => import('../views/NotesView.vue'),
    },
    {
      path: '/notes/:id',
      name: 'note-editor',
      component: () => import('../views/NoteEditorView.vue'),
      meta: { fullscreen: true },
    },
    {
      path: '/jobs',
      name: 'jobs',
      component: () => import('../views/JobsView.vue'),
    },
    {
      path: '/jobs/:id',
      name: 'job-editor',
      component: () => import('../views/JobEditorView.vue'),
      meta: { fullscreen: true },
    },
    {
      path: '/college/:id',
      name: 'college-editor',
      component: () => import('../views/CollegeEditorView.vue'),
      meta: { fullscreen: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const { session, waitForInit } = useAuth()
  await waitForInit()

  if (!to.meta.public && !session.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && session.value) {
    return { name: 'dashboard' }
  }
})

export default router
