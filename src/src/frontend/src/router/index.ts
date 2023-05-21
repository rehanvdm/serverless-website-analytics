import { createRouter, createWebHistory } from 'vue-router';
import loginCallback from '../views/login_callback.vue';
import pageStats from '../views/page_stats/index.vue';
import error from '../views/error.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'page_stats',
      component: pageStats,
    },
    {
      path: '/error',
      name: 'error',
      component: error,
    },
    {
      path: '/login_callback',
      name: 'login_callback',
      component: loginCallback,
    },
    // {
    //   path: '/about',
    //   name: 'about',
    //   // route level code-splitting
    //   // this generates a separate chunk (About.[hash].js) for this route
    //   // which is lazy-loaded when the route is visited.
    //   component: () => import('../views/AboutView.vue')
    // }
  ],
});

export default router;
