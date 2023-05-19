import {App} from "vue";
import 'vue-material-design-icons/styles.css';
//@ts-ignore
import Cog  from 'vue-material-design-icons/Cog.vue';
//@ts-ignore
import InboxMultiple  from 'vue-material-design-icons/InboxMultiple.vue';
//@ts-ignore
import ChevronDown  from 'vue-material-design-icons/ChevronDown.vue';
//@ts-ignore
import Refresh  from 'vue-material-design-icons/Refresh.vue';

export function registerIconComponents(app: App<Element>)
{
  app.component('mdi-cog', Cog);
  app.component('mdi-inbox-multiple', InboxMultiple);
  app.component('mdi-chevron-down', ChevronDown);
  app.component('mdi-refresh', Refresh);
}
