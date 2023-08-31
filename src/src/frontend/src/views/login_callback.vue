<template>
  <main>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {getSystemStore} from "@frontend/src/stores/system";
import router from '@frontend/src/router';

onMounted(() => {
  const idToken = new URLSearchParams(window.location.hash).get('#id_token');
  let state = new URLSearchParams(window.location.href).get('state');
  let queryObject: Record<string, string> | undefined = undefined;
  if(state)
  {
      state = decodeURIComponent(state);
      queryObject = state.split("&").reduce((acc: Record<string, string>, pair) => {
          const [key, value] = pair.split("=");
          acc[key] = value;
          return acc;
      }, {});
  }
  if(idToken)
  {
    const systemStore = getSystemStore();
    systemStore.$patch({apiJwtToken: idToken});
    router.push({name: 'page_stats', query: queryObject});
  }

});

</script>
