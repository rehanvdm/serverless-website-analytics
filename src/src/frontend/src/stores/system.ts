import {ref, computed, Ref} from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from "@vueuse/core"
import {FrontendEnvironment} from "@backend/api-front/routes/env";

export const getSystemStore = defineStore('counter', () => {
  const apiJwtToken = useLocalStorage("apiJwtToken", "");

  const frontendEnvironmentQueried = ref(false);
  const frontendEnvironment: Ref<FrontendEnvironment> = ref({});
  // const cognitoLoginUrlWithRedirect = computed(() => frontendEnvironment.value.cognitoLoginUrl + "?redirect=" + window.location.href);
  function cognitoLoginUrlWithRedirect() {
    console.log(" window.location.href", window.location.href)
    return frontendEnvironment.value.cognitoLoginUrl + "&redirect_uri=" + encodeURIComponent(window.location.href) + "login_callback";
  }
  return { apiJwtToken, frontendEnvironmentQueried, frontendEnvironment, cognitoLoginUrlWithRedirect};
});
