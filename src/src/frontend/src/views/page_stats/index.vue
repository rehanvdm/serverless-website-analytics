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
import {Filter} from "@backend/lib/models/filter";
import {useRoute, useRouter} from "vue-router";

const route = useRoute();
const router = useRouter();

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

  // watch(route.query, () => {
  if(route.query.sites)
  {
    console.log("route.query.sites", route.query.sites)
    const sitesParam = decodeURIComponent(route.query.sites as string);
    selectedSites.value = sitesParam.split(',');
    selectedSitesConfirmed.value = sitesParam.split(',');
  }
  else
  {
    selectedSites.value = sites.value;
    selectedSitesConfirmed.value = sites.value;
  }

  if(route.query.date)
  {
    console.log("route.query.date", route.query.date)
    const dateParam = decodeURIComponent(route.query.date as string);
    const [startDate, endDate] = dateParam.split(',');
    dateFilter.value = [new Date(startDate), new Date(endDate)];
  }

  if(route.query.filter)
  {
    console.log("route.query.filter", route.query.filter)
    const validFilterKeys =  Object.keys(filter.value)
    const filterParam = JSON.parse(decodeURIComponent(route.query.filter as string)) as Record<string, string>
    for(const [key, val] of Object.entries(filterParam))
    {
      if(!validFilterKeys.includes(key))
        continue;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      filter.value[key] = val;
    }
  }
  // }, { deep: true, immediate: true });

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


let loadingTotals = ref(false);
let loadingPageViews = ref(false);
let loadingChartViews = ref(false);
let loadingChartLocations = ref(false);
let loadingReferrers = ref(false);
let loadingUserInfo = ref(false);
let loadingUtm = ref(false);
const loadingComponents = computed(() => {
  return loadingSites.value || loadingTotals.value || loadingPageViews.value ||
    loadingChartViews.value || loadingChartLocations.value || loadingReferrers.value || loadingUserInfo.value || loadingUtm.value;
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

const filter: Ref<Filter> = ref({
  page_url: undefined,
  referrer: undefined,
  country_name: undefined,
  device_type: undefined,
  utm_source: undefined,
  utm_medium: undefined,
  utm_campaign: undefined,
  utm_term: undefined,
  utm_content: undefined,
})
function filterChange(partialFilter: Filter) {
  filter.value = { ...filter.value, ...partialFilter };
}

function clearFilters() {
  filter.value = {
    page_url: undefined,
    referrer: undefined,
    country_name: undefined,
    device_type: undefined,
    utm_source: undefined,
    utm_medium: undefined,
    utm_campaign: undefined,
    utm_term: undefined,
    utm_content: undefined,
  };
}
const showClearFilters = computed(() => {
  return filter.value.page_url || filter.value.referrer || filter.value.country_name || filter.value.device_type ||
    filter.value.utm_source || filter.value.utm_medium || filter.value.utm_campaign || filter.value.utm_term ||
    filter.value.utm_content;
});

watch([sites, dateFilter, filter], () => {
  router.push({ query: {
    sites: encodeURIComponent(selectedSites.value.join(',')),
    date: encodeURIComponent(dateFilter.value.map(d => d.toISOString()).join(',')),
    filter: Object.values(filter.value).filter(v => v).length ? encodeURIComponent(JSON.stringify(filter!.value)) : undefined,
    }
  });
}, { deep: true });
</script>


<template>
  <el-container class="h100" style="display: flex; justify-content: center">

    <div style="width: 1280px;">

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

        <div style="margin-bottom: 10px">
          <el-tag class="filter-tag" v-if="filter.page_url" closable @close="filter.page_url = undefined">
            <b>Page</b> = {{filter.page_url}}
          </el-tag>
          <el-tag class="filter-tag" v-if="filter.referrer" closable @close="filter.referrer = undefined">
            <b>Referrer</b> = {{filter.referrer}}
          </el-tag>
          <el-tag class="filter-tag" v-if="filter.country_name" closable @close="filter.country_name = undefined">
            <b>Country</b> = {{filter.country_name}}
          </el-tag>
          <el-tag class="filter-tag" v-if="filter.device_type" closable @close="filter.device_type = undefined">
            <b>Device</b> = {{filter.device_type}}
          </el-tag>
          <el-tag class="filter-tag" v-if="filter.utm_source" closable @close="filter.utm_source = undefined">
            <b>UTM Source</b> = {{filter.utm_source}}
          </el-tag>
          <el-tag class="filter-tag" v-if="filter.utm_medium" closable @close="filter.utm_medium = undefined">
            <b>UTM Medium</b> = {{filter.utm_medium}}
          </el-tag>
          <el-tag class="filter-tag" v-if="filter.utm_campaign" closable @close="filter.utm_campaign = undefined">
            <b>UTM Campaign</b> = {{filter.utm_campaign}}
          </el-tag>
          <el-tag class="filter-tag" v-if="filter.utm_term" closable @close="filter.utm_term = undefined">
            <b>UTM Term</b> = {{filter.utm_term}}
          </el-tag>
          <el-tag class="filter-tag" v-if="filter.utm_content" closable @close="filter.utm_content = undefined">
            <b>UTM Content</b> = {{filter.utm_content}}
          </el-tag>
          <el-button text size="small" v-if="showClearFilters" @click="clearFilters()">Clear filters</el-button>
        </div>

      </el-header>

  <!--    v-if="selectedSites.length > 0 && fromDate && toDate"-->
      <el-main class="h100" style="overflow: visible;">
        <div class="main-row">
          <Totals ref="componentTotal" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
                  @loading="(val) => loadingTotals = val"
                  :filter="filter"
          ></Totals>
        </div>

        <div class="main-row">
          <ChartViews ref="componentChartViews" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
                      @loading="(val) => loadingChartViews = val"
                      :filter="filter"
          ></ChartViews>
        </div>

        <div class="main-row">
          <PageViews ref="componentPageViews" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
                     @loading="(val) => loadingPageViews = val"
                     :filter="filter" @filter-change="filterChange"
          ></PageViews>
          <Referrers ref="componentReferrers" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
                     @loading="(val) => loadingReferrers = val"
                     :filter="filter" @filter-change="filterChange"
          ></Referrers>
        </div>


        <div class="main-row">
          <ChartLocations ref="componentChartLocations" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
                      @loading="(val) => loadingChartLocations = val"
                      :filter="filter" @filter-change="filterChange"></ChartLocations>
        </div>

        <div class="main-row">
          <UserInfo ref="componentUserInfo" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
                    @loading="(val) => loadingUserInfo = val"
                    :filter="filter" @filter-change="filterChange"></UserInfo>
          <UTM ref="componentUtm" :sites="selectedSitesConfirmed" :from-date="fromDate" :to-date="toDate"
               @loading="(val) => loadingUtm = val"
               :filter="filter" @filter-change="filterChange"></UTM>
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

.filter-tag {
  margin: 5px 5px 0 0;
}

</style>

