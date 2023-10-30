import { computed, ref, Ref } from 'vue';
import { defineStore } from 'pinia';
import { useLocalStorage } from '@vueuse/core';
import { FrontendEnvironment } from '@backend/api-front/routes/env';

export const getSystemStore = defineStore('counter', () => {
  const apiJwtToken = useLocalStorage('apiJwtToken', '');

  const frontendEnvironmentQueried = ref(false);
  const frontendEnvironment: Ref<FrontendEnvironment> = ref({});
  const cognitoLoginUrlWithRedirect = computed(() => {
    let ret =
      frontendEnvironment.value.cognitoLoginUrl +
      '&redirect_uri=' +
      encodeURIComponent(window.location.origin) +
      '/login_callback';

    const urlSplitByQuery = window.location.href.split('?');
    if (urlSplitByQuery.length > 1) {
      // Have to double encode because Cognito decodes when sending this back and we need it preserved
      ret += '&state=' + encodeURIComponent(encodeURIComponent(urlSplitByQuery[1]));
    }

    return ret;
  });
  return { apiJwtToken, frontendEnvironmentQueried, frontendEnvironment, cognitoLoginUrlWithRedirect };
});
