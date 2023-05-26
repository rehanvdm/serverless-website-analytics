<script setup lang="ts">
import { useDark } from '@vueuse/core';
import {computed, onMounted, Ref, ref, unref, watch} from "vue";
import {api, apiWrapper} from "@frontend/src/lib/api";
import {SitePartition} from "@backend/lib/models/site";
import Totals from "@frontend/src/views/page_stats/components/totals.vue";
import ChartViews from "@frontend/src/views/page_stats/components/chart_views.vue";
import {DateUtils} from "@frontend/src/lib/date_utils";
import PageViews from "@frontend/src/views/page_stats/components/page_views.vue";
import ChartLocations from "@frontend/src/views/page_stats/components/chart_locations.vue";
import Referrers from "@frontend/src/views/page_stats/components/referrers.vue";
import UserInfo from "@frontend/src/views/page_stats/components/user_info.vue";
import UTM from "@frontend/src/views/page_stats/components/utm.vue";
import assert from "assert";

/* ================================================================================================================== */
/* ============================================= Settings & Partitions ============================================== */
/* ================================================================================================================== */
const isDark = useDark();
const showSettings = ref(false);
let partitions: Ref<SitePartition[]> = ref([]);
let loadingPartitions = ref(false);
onMounted(async () => {
  const resp = await apiWrapper(api.sitesGetPartitions.query(), loadingPartitions);
  if(!resp)
    return;
  partitions.value = resp;
});
async function refreshPartitions(forceRepair: boolean)
{
  const resp = await apiWrapper(api.sitesUpdatePartition.mutate({forceRepair}), loadingPartitions);
  if(!resp)
    return;
  partitions.value = resp;
}

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
  return loadingSites.value || loadingPartitions.value || loadingTotals.value || loadingPageViews.value ||
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
  assert(componentTotal.value);
  componentTotal.value.refresh();

  assert(componentPageViews.value);
  componentPageViews.value.refresh();

  assert(componentChartViews.value);
  componentChartViews.value.refresh();

  assert(componentChartLocations.value);
  componentChartLocations.value.refresh();

  assert(componentReferrers.value);
  componentReferrers.value.refresh();

  assert(componentUserInfo.value);
  componentUserInfo.value.refresh();

  assert(componentUtm.value);
  componentUtm.value.refresh();
}

</script>


<template>
  <el-container class="h100" style="display: flex; justify-content: center" >
    <div style="width: 1280px; ">
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

            <el-tooltip content="Refresh partitions">
              <el-button class="menu-button" text round plain @click="refreshPartitions(false)" :disabled="loadingPartitions">
                <mdi-inbox-multiple class="menu-button__icon"></mdi-inbox-multiple>
              </el-button>
            </el-tooltip>

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

      <el-collapse>
        <el-collapse-item>
          <template #title>
            <span class="settings-label">
              Partitions ({{partitions.length}})
              <el-button-group>
                <el-button style="margin-left: 100px;" plain type="primary"
                           @click.stop="refreshPartitions(false)" :loading="loadingPartitions">
                  Refresh
                </el-button>
                <el-popover popper-style="padding: 3px;" trigger="hover" placement="bottom-end">
                  <template #reference>
                    <el-button plain type="primary" style="padding-left: 5px; padding-right: 5px;"
                               @click.stop="" :disabled="loadingPartitions">
                      <mdi-chevron-down></mdi-chevron-down>
                    </el-button>
                  </template>
                  <template #default style="padding: 0">
                    <el-button plain type="primary" text
                               @click.stop="refreshPartitions(true)" :loading="loadingPartitions">
                        Force Repair
                    </el-button>
                  </template>
                </el-popover>

              </el-button-group>
            </span>
          </template>

          <el-table :data="partitions" style="width: 100%" stripe v-loading="loadingPartitions">
            <el-table-column prop="site" label="Site" sortable />
            <el-table-column prop="year" label="Year" width="100" sortable />
            <el-table-column prop="month" label="Month" width="100" sortable />
          </el-table>

        </el-collapse-item>
      </el-collapse>

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

