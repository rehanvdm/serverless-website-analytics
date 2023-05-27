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
  if(idToken)
  {
    const systemStore = getSystemStore();
    systemStore.$patch({apiJwtToken: idToken});
    router.push({name: 'page_stats'});
  }

});

</script>
