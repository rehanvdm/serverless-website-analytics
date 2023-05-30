import { createTRPCProxyClient, httpLink, TRPCClientError } from '@trpc/client';
import { AppRouter } from '@backend/api-front/server';
import { Ref } from 'vue';
import { ElNotification } from 'element-plus';
import { getSystemStore } from '@frontend/src/stores/system';
import { TRPCError } from '@trpc/server';

const frontendUrl = import.meta.env.VITE_FRONTEND_URL;

export const api = createTRPCProxyClient<AppRouter>({
  links: [
    httpLink({
      // httpBatchLink
      headers() {
        const systemStore = getSystemStore();
        return {
          Authorization: systemStore.apiJwtToken,
        };
      },
      url: frontendUrl,
      // url: 'https://d3nhr87nci4rd5.cloudfront.net/api/', // make relative
      // url: 'http://localhost:3001/api', //Start the `start-local-api-front` from the package.json
    }),
  ],
});

export async function apiWrapper<T>(func: Promise<T>, loadingState?: Ref<boolean>, displayError = true) {
  const systemStore = getSystemStore();
  try {
    if (loadingState) {
      loadingState.value = true;
    }

    if (!systemStore.frontendEnvironmentQueried) {
      console.log('No cognitoLoginUrl, getting from API');
      const resp = await api.getFrontendEnvironment.query();
      if (!resp) {
        return false;
      }
      console.log('Got cognitoLoginUrl', resp.cognitoLoginUrl);
      systemStore.$patch({ frontendEnvironmentQueried: true });
      systemStore.$patch({ frontendEnvironment: resp });
    }

    if (systemStore.frontendEnvironment.cognitoLoginUrl && !systemStore.apiJwtToken) {
      console.log('No JWT token, redirecting to login', systemStore.apiJwtToken);
      document.location.href = systemStore.cognitoLoginUrlWithRedirect;
      return false;
    }

    return await func;
  } catch (err) {
    if (systemStore.frontendEnvironment.cognitoLoginUrl) {
      if (err instanceof TRPCClientError && err.message === 'Not authenticated') {
        console.log('Not authenticated, redirecting to login', systemStore.cognitoLoginUrlWithRedirect);
        document.location.href = systemStore.cognitoLoginUrlWithRedirect;
        return false;
      }
    }

    if (displayError) {
      ElNotification({ title: 'API Error', message: (err as Error).message, type: 'error', position: 'bottom-right' });
    }

    return false;
  } finally {
    if (loadingState) {
      loadingState.value = false;
    }
  }
}
