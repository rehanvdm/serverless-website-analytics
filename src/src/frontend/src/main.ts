import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import '@fontsource/nunito/latin.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './views/app.vue';
import router from './router';
import './assets/main.css';
import { registerIconComponents } from '@frontend/src/components/vue-material-design-icons';

const app = createApp(App);
app.use(ElementPlus);
registerIconComponents(app);
app.use(createPinia());
app.use(router);
app.mount('#app');
