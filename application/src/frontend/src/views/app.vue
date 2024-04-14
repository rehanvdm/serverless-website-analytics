<script setup lang="ts">

import {computed, ref} from "vue";
import {getSystemStore} from "@frontend/src/stores/system";
import {trackLinkClick, trackRouterClick} from "@frontend/src/lib/track";

const showDemoBanner = computed(() => {
  const systemStore = getSystemStore();
  return !!systemStore.frontendEnvironment.isDemoPage;
});

</script>

<template>

  <el-container class="h100" style="">
    <div style="max-width: 1280px; width: 100%; margin: auto;">
      <div style="display: flex; flex-flow: row nowrap;">
        <div class="invis-when-narrow" style="width: 140px; flex: 0 0;">
          <el-menu :default-active="$route.path" style="margin-top: 10px; border-right: none;">
            <el-menu-item index="/stats/page" @click="trackRouterClick('menu_page', '/stats/page')">
              <template #title>Page Views</template>
            </el-menu-item>
            <el-menu-item index="/stats/event" @click="trackRouterClick('menu_event', '/stats/event')">
              <template #title>Events</template>
            </el-menu-item>
          </el-menu>
        </div>

        <div style="width: 100%; flex: 1 1;">
          <el-alert v-if="showDemoBanner" class="demo" type="warning" style="margin-top: 10px; margin-left: 10px; width: 97%;" >
            <div style="display: flex; flex-flow: row wrap-reverse; justify-content: space-between; width: 100%;">
              <div style="flex: 1 1; min-width: 200px;">
                This is the open source CDK <a style="font-weight: bold; color: inherit" href="https://github.com/rehanvdm/serverless-website-analytics" target="_blank">serverless-website-analytics</a>
                demo page, it tracks this page and some <a style="font-weight: bold; color: inherit" href="https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/DEMO-TRAFFIC.md" target="_blank">simulated traffic.</a>.
              </div>
              <div style="flex: 0 1; padding-right: 25px; margin-left: auto;">
                <a style="margin-left: 20px" class="link-explicit"
                   @click="trackLinkClick('github', 'https://github.com/rehanvdm/serverless-website-analytics')">
                  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/rehanvdm/serverless-website-analytics?label=Github&style=social">
                </a>
                <!--            <a style="margin-left: 20px" href="https://www.npmjs.com/package/serverless-website-analytics" target="_blank">-->
                <!--              <img alt="npm" application="https://img.shields.io/npm/dw/serverless-website-analytics">-->
                <!--            </a>-->
              </div>
            </div>
          </el-alert>

          <router-view></router-view>

        </div>

      </div>
    </div>
  </el-container>

</template>

<style scoped>
.el-menu-item {
  border-radius: 5px;
  font-size: large;
  margin-right: 5px;
  margin-bottom: 5px;
}
.el-menu-item.is-active {
  background-color: var(--el-color-primary-light-8);
  border-color: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}

.invis-when-narrow {
  display: block;
}
@media all and (max-width: 699px) {
  .invis-when-narrow {
    display: none;
  }
}
</style>


