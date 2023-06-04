import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import '@fontsource/nunito/latin.css';

import { createApp, watch } from 'vue';
import { createPinia } from 'pinia';
import App from './views/app.vue';
import router from './router';
import './assets/main.css';
import { registerIconComponents } from '@frontend/src/components/vue-material-design-icons';
import * as swaClient from 'serverless-website-analytics-client';
import { getSystemStore } from '@frontend/src/stores/system';
const ingestUrl = import.meta.env.VITE_INGEST_URL;

const app = createApp(App);
app.use(ElementPlus);
registerIconComponents(app);
app.use(createPinia());
app.use(router);

let analyticsLoaded = false;
watch([getSystemStore().frontendEnvironment], () => {
  const systemStore = getSystemStore();
  console.log('frontendEnvironment', systemStore.frontendEnvironment);
  if (systemStore.frontendEnvironment && systemStore.frontendEnvironment.trackOwnDomain && !analyticsLoaded) {
    const site = window.location.host.includes(':') ? window.location.host.split(':')[0] : window.location.host;
    swaClient.v1.analyticsPageInit({
      inBrowser: true,
      site,
      apiUrl: ingestUrl,
    });
    analyticsLoaded = true;

    swaClient.v1.analyticsPageChange('/');
  }
});

router.afterEach((event) => {
  if (analyticsLoaded) swaClient.v1.analyticsPageChange(event.path);
});

app.mount('#app');
