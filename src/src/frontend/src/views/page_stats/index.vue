<script setup lang="ts">
import { useDark } from '@vueuse/core';
import {computed, onMounted, Ref, ref, unref, watch} from "vue";
import {api, apiWrapper} from "@frontend/src/lib/api";
import Totals from "@frontend/src/views/page_stats/components/totals.vue";
import ChartViews from "@frontend/src/views/page_stats/components/chart_views.vue";
import {DateUtils} from "@frontend/src/lib/date_utils";
import PageViews from "@frontend/src/views/page_stats/components/page_views.vue";
import ChartLocations from "@frontend/src/views/page_stats/components/chart_locations.vue";
import Referrers from "@frontend/src/views/page_stats/components/referrers.vue";
import UserInfo from "@frontend/src/views/page_stats/components/user_info.vue";
import UTM from "@frontend/src/views/page_stats/components/utm.vue";
import {getSystemStore} from "@frontend/src/stores/system";

/* ================================================================================================================== */
/* ==================================================== Settings  =================================================== */
/* ================================================================================================================== */
const isDark = useDark();
const showSettings = ref(false);
const showDemoBanner = computed(() => {
  const systemStore = getSystemStore();
  return !!systemStore.frontendEnvironment.isDemoPage;
});

/* ================================================================================================================== */
/* ================================================== Date Filter =================================================== */
/* ================================================================================================================== */
const {startDate, endDate} = DateUtils.getDayRange("last_7_days");
const dateFilter: Ref<Date[]> = ref([startDate, endDate]); // Set default date as last week
let fromDate: Ref<Date | undefined> = ref(startDate);
let toDate: Ref<Date | undefined> = ref(endDate);
watch(dateFilter, async () => {
  // const [_fromDate, _toDate] =  dateFilter.value;
  fromDate.value = DateUtils.startOfDay(dateFilter.value[0]);
  toDate.value = DateUtils.endOfDay(dateFilter.value[1]);
  // console.log("DATES", dateFilter.value, fromDate, toDate);
})
const dateQuickSelectOptions = [
  {
    text: 'Today',
    value: () => {
      const {startDate, endDate} = DateUtils.getDayRange("today");
      return [startDate, endDate];
    },
  },
  {
    text: 'Yesterday',
    value: () => {
      const {startDate, endDate} = DateUtils.getDayRange("yesterday");
      return [startDate, endDate];
    },
  },
  {
    text: 'Last 7 days',
    value: () => {
       const {startDate, endDate} = DateUtils.getDayRange("last_7_days");
      return [startDate, endDate];
    },
  },
  {
    text: 'Last 30 days',
    value: () => {
      const {startDate, endDate} = DateUtils.getDayRange("last_30_days");
      return [startDate, endDate];
    },
  },
  {
    text: 'This month',
    value: () => {
      const {startDate, endDate} = DateUtils.getAbsoluteDayRange("this_month");
      return [startDate, endDate];
    },
  },
  {
    text: 'Previous week',
    value: () => {
      const {startDate, endDate} = DateUtils.getAbsoluteDayRange("last_week");
      return [startDate, endDate];
    },
  },
  {
    text: 'Previous month',
    value: () => {
      const {startDate, endDate} = DateUtils.getAbsoluteDayRange("last_month");
      return [startDate, endDate];
    },
  },
];

/* ================================================================================================================== */
/* ================================================= Site Selector ================================================== */
/* ================================================================================================================== */
let sites: Ref<string[]> = ref([]);
let selectedSites: Ref<string[]> = ref([]);
let selectedSitesConfirmed: Ref<string[]> = ref([]);
const loadingSites = ref(false);
onMounted(async () => {
  const resp = await apiWrapper(api.sites.query(), loadingSites);
  if(!resp)
    return;
  sites.value = resp;
  selectedSites.value = sites.value;
  selectedSitesConfirmed.value = sites.value;
  console.log(sites.value);
});

const showUpdateSearch = computed(() => {
  //get all the values of both arrays, order alphabetically and compare
  const selectedSitesSorted = [...selectedSites.value].sort();
  const selectedSitesConfirmedSorted = [...selectedSitesConfirmed.value].sort();
  return selectedSitesSorted.join(',') !== selectedSitesConfirmedSorted.join(',');
});

/* ================================================================================================================== */
/* =========================================== Refresh and loading state ============================================ */
/* ================================================================================================================== */

const loadingTotals = ref(false);
const loadingPageViews = ref(false);
const loadingChartViews = ref(false);
const loadingChartLocations = ref(false);
const loadingReferrers = ref(false);
const loadingUserInfo = ref(false);
const loadingUtm = ref(false);
const loadingComponents = computed(() => {
  return loadingSites.value || loadingTotals.value || loadingPageViews.value ||
    loadingChartViews.value || loadingChartLocations.value || loadingUserInfo.value || loadingUtm.value;
});

const componentTotal = ref<InstanceType<typeof Totals>>();
const componentPageViews = ref<InstanceType<typeof PageViews>>();
const componentChartViews = ref<InstanceType<typeof ChartViews>>();
const componentChartLocations = ref<InstanceType<typeof ChartLocations>>();
const componentReferrers = ref<InstanceType<typeof Referrers>>();
const componentUserInfo = ref<InstanceType<typeof Referrers>>();
const componentUtm = ref<InstanceType<typeof UTM>>();
async function refresh()
{
  if(componentTotal.value)
    componentTotal.value.refresh();

  if(componentPageViews.value)
    componentPageViews.value.refresh();

  if(componentChartViews.value)
    componentChartViews.value.refresh();

  if(componentChartLocations.value)
    componentChartLocations.value.refresh();

  if(componentReferrers.value)
    componentReferrers.value.refresh();

  if(componentUserInfo.value)
    componentUserInfo.value.refresh();

  if(componentUtm.value)
    componentUtm.value.refresh();
}

</script>


<template>
  <el-container class="h100" style="display: flex; justify-content: center">

    <div style="width: 1280px; ">

      <el-alert v-if="showDemoBanner" class="demo" type="warning" style="margin-top: 10px; width: 100%" >
        <div style="display: flex; justify-content: space-between; width: 100%">
          <div>
            This is the open source CDK <a style="font-weight: bold; color: inherit" href="https://github.com/rehanvdm/serverless-website-analytics" target="_blank">serverless-website-analytics</a> demo page, it tracks this page and some simulated traffic.
          </div>
          <div>
            <a style="margin-left: 20px" href="https://github.com/rehanvdm/serverless-website-analytics" target="_blank">
              <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/rehanvdm/serverless-website-analytics?label=Github&style=social">
            </a>
            <a style="margin-left: 20px" href="https://www.npmjs.com/package/serverless-website-analytics" target="_blank">
              <img alt="npm" src="https://img.shields.io/npm/dw/serverless-website-analytics">
            </a>
          </div>
        </div>
      </el-alert>

      <el-header>
        <div style="display: flex; justify-content: space-between; padding-top:23px">
          <div>
            <div v-if="loadingSites && !sites.length">
  <!--          <div v-if="true">-->
              <el-skeleton style="width: 250px;" animated>
                <template #template>
                  <el-skeleton-item  style="height: 32px;" />
                </template>
              </el-skeleton>

            </div>
            <div v-else>
              <el-select v-model="selectedSites" multiple collapse-tags collapse-tags-tooltip placeholder="Select Site(s)"
                         :loading="loadingSites"
                         style="width: 250px">
                <el-option  v-for="site in sites" :key="site" :label="site" :value="site" />
              </el-select>
              <el-button v-if="showUpdateSearch" type="primary" text @click="selectedSitesConfirmed = selectedSites">Update search</el-button>
            </div>
          </div>
          <div>
            <el-date-picker v-model="dateFilter" type="daterange" :shortcuts="dateQuickSelectOptions"
              range-separator="To" start-placeholder="Start date" end-placeholder="End date"
            />

            <el-tooltip content="Refresh">
              <el-button class="menu-button" text round plain :loading="loadingComponents" @click="refresh()">
                <template #loading>
                  <mdi-refresh class="menu-button__icon spin"></mdi-refresh>
                </template>

                <mdi-refresh v-if="!loadingComponents" class="menu-button__icon"></mdi-refresh>
              </el-button>
            </el-tooltip>

            <el-divider direction="vertical" style="height: 1.5rem; top: -3px;"></el-divider>

            <el-tooltip content="Settings">
              <el-button class="menu-button" text round plain @click="showSettings = !showSettings" >
                <mdi-cog class="menu-button__icon"></mdi-cog>
              </el-button>
            </el-tooltip>



          </div>
        </div>
      </el-header>

  <!--    v-if="selectedSites.length > 0 && fromDate && toDate"-->
      <el-main class="h100" style="overflow: visible;">
        <div class="main-row">
          <Totals ref="componentTotal" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
                  @loading="(val) => loadingTotals = val" ></Totals>
        </div>

        <div class="main-row">
          <ChartViews ref="componentChartViews" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
                      @loading="(val) => loadingChartViews = val"></ChartViews>
        </div>

        <div class="main-row">
          <PageViews ref="componentPageViews" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
                     @loading="(val) => loadingPageViews = val" ></PageViews>
          <Referrers ref="componentReferrers" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
                     @loading="(val) => loadingReferrers = val"></Referrers>
        </div>


        <div class="main-row">
          <ChartLocations ref="componentChartLocations" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
                      @loading="(val) => loadingChartLocations = val"></ChartLocations>
        </div>

        <div class="main-row">
          <UserInfo ref="componentUserInfo" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
                    @loading="(val) => loadingUserInfo = val"></UserInfo>
          <UTM ref="componentUtm" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
               @loading="(val) => loadingUtm = val"></UTM>
        </div>

        <div class="main-row" style="margin-bottom: 100px;"></div>

      </el-main>
    </div>

    <el-drawer class="hidden-sm-and-down" v-model="showSettings" title="Settings" direction="rtl" size="100%" style="max-width: 500px" >
      <div class="settings-label-single" style="display: flex; justify-content: space-between">
        <span class="settings-label">Theme</span>
        <el-switch class="header__switch" v-model="isDark" inactive-text="Light" active-text="Dark" />
      </div>
    </el-drawer>

  </el-container>
</template>

<style scoped>

.main-row {
  display: flex; width: 100%; margin-top: 10px; column-gap: 10px;
}

.menu-button {
  margin-top: -5px;
  padding: 10px;
  margin-left: 5px;
}
.menu-button__icon {
  font-size: medium;
}

.header__switch {
  --el-switch-on-color: rgba(255,255,0,0.47);
  --el-switch-off-color: rgba(24,24,24,0.5);
  /*--el-switch-off-color: rgba(255,255,0,0.47);*/
  /*--el-switch-on-color: rgba(24,24,24,0.5);*/
  margin-left: 20px;
  margin-top: -5px;
}

.settings-label {
  font-size: medium;
  font-weight: normal;
}
.settings-label-single { /* No collapse */
 padding: 10px 0;
}

</style>

