<script setup lang="ts">

</script>

<template>

  <el-container class="h100" style="display: flex; justify-content: center">
    <div style="width: 1280px;">
      <div style="display: flex;">
        <div>
          <el-menu default-active="page_views"  style="margin-top: 10px; border-right: none;">
            <el-menu-item index="page_views">
              <template #title>Page Views</template>
            </el-menu-item>
            <el-menu-item index="events">
              <template #title>Events</template>
            </el-menu-item>
          </el-menu>
        </div>

        <div style="width: 100%">
          <el-alert v-if="showDemoBanner" class="demo" type="warning" style="margin-top: 10px; width: 100%" >
            <div style="display: flex; justify-content: space-between; width: 100%">
              <div>
                This is the open source CDK <a style="font-weight: bold; color: inherit" href="https://github.com/rehanvdm/serverless-website-analytics" target="_blank">serverless-website-analytics</a>
                demo page, it tracks this page and some <a style="font-weight: bold; color: inherit" href="https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/DEMO-TRAFFIC.md" target="_blank">simulated traffic.</a>.
              </div>
              <div>
                <a style="margin-left: 20px" href="https://github.com/rehanvdm/serverless-website-analytics" target="_blank">
                  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/rehanvdm/serverless-website-analytics?label=Github&style=social">
                </a>
                <!--            <a style="margin-left: 20px" href="https://www.npmjs.com/package/serverless-website-analytics" target="_blank">-->
                <!--              <img alt="npm" src="https://img.shields.io/npm/dw/serverless-website-analytics">-->
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
.el-menu {
  height: 50px;
}
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
</style>


