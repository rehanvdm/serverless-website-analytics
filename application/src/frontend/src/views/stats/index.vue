<script setup lang="ts">
import { useDark } from '@vueuse/core';
import {computed, onMounted, Ref, ref, unref, watch} from "vue";
import {api, apiWrapper} from "@frontend/src/lib/api";
import PageStats from "@frontend/src/views/stats/page/index.vue";
import EventStats from "@frontend/src/views/stats/event/index.vue";
import {DateUtils} from "@frontend/src/lib/date_utils";
import {useRoute, useRouter} from "vue-router";
import {sendTrack, trackButtonClick, trackRouterClick} from "@frontend/src/lib/track";

const route = useRoute();
const router = useRouter();

/* ================================================================================================================== */
/* ==================================================== Settings  =================================================== */
/* ================================================================================================================== */
const isDark = useDark();
const showSettings = ref(false);
const showContent = ref(false);

/* ================================================================================================================== */
/* ================================================== Date Filter =================================================== */
/* ================================================================================================================== */
const {startDate, endDate} = DateUtils.getDayRange("last_7_days");
const dateFilter: Ref<Date[]> = ref([startDate, endDate]); // Set default date as last week
let fromDate: Ref<Date | undefined> = ref(startDate);
let toDate: Ref<Date | undefined> = ref(endDate);
watch(dateFilter, async () => {
  sendTrack("date_filter_changed", "none");
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
});

const showUpdateSearch = computed(() => {
  //get all the values of both arrays, order alphabetically and compare
  const selectedSitesSorted = [...selectedSites.value].sort();
  const selectedSitesConfirmedSorted = [...selectedSitesConfirmed.value].sort();
  return selectedSitesSorted.join(',') !== selectedSitesConfirmedSorted.join(',');
});

function setSelectedSites() {
  sendTrack("selected_sites_changed", "none");
  selectedSitesConfirmed.value = selectedSites.value;
}

/* ================================================================================================================== */
/* =========================================== Refresh and loading state ============================================ */
/* ================================================================================================================== */

const isLoading = ref(false);
watch([loadingSites], () => {
  isLoading.value = loadingSites.value;
});

const componentPageStats = ref<InstanceType<typeof PageStats>>();
const componentEventStats = ref<InstanceType<typeof EventStats>>();
function refresh()
{
  trackButtonClick("refresh");
  if(componentPageStats.value)
    componentPageStats.value.refresh();
  if(componentEventStats.value)
    componentEventStats.value.refresh();
}

function setQueryStringParams(keepExisting: boolean)
{
  router.push({ query: {
      sites: encodeURIComponent(selectedSitesConfirmed.value.join(',')),
      date: encodeURIComponent(dateFilter.value.map(d => d.toISOString()).join(',')),
      ...(keepExisting ? route.query : {})
    }
  });
}
watch([selectedSitesConfirmed, dateFilter], () => {
  setQueryStringParams(true);
}, { deep: true });

/* Routing and filter param hand off */
let loadFor = "" ;
watch(() => route.path, async () => {
  console.log("route.path", route.path)
  if(route.path === "/stats/page") {
    loadFor = "page";
  }
  else if(route.path === "/stats/event") {
    loadFor = "event";
  }
  setQueryStringParams(false);
}, { immediate: true });

</script>

<template>

  <div style="width: 100%">

    <el-header style="height: inherit">

      <div class="header-surround" style="display: flex; justify-content: space-between; padding-top: 10px; gap: 10px;">
        <div style="flex: 1 1; display: flex; flex-flow: row wrap; justify-content: space-between;  padding-top: 0px; max-width: 100%; gap: 10px;">
          <div style="flex: 1 1; text-align: center; min-width: 125px; max-width: 100%;">
            <div v-if="loadingSites && !sites.length">
              <el-skeleton style="width: 100%; max-width: 100%;" animated>
                <template #template>
                  <el-skeleton-item  style="height: 32px;" />
                </template>
              </el-skeleton>
            </div>
            <div v-else>
              <el-select v-model="selectedSites" multiple collapse-tags collapse-tags-tooltip placeholder="Select Site(s)"
                         :loading="loadingSites"
                         style="width: 100%; max-width: 100%;">
                <el-option  v-for="site in sites" :key="site" :label="site" :value="site" />
              </el-select>
              <el-button v-if="showUpdateSearch" type="primary" text @click="setSelectedSites()">Update search</el-button>
            </div>
          </div>
          <div style="flex: 1 1; text-align: center; display: flex; flex-flow: row nowrap; max-width: 100%;">
            <el-date-picker v-model="dateFilter" type="daterange" :shortcuts="dateQuickSelectOptions"
                            range-separator="To" start-placeholder="Start date" end-placeholder="End date"/>

          </div>
        </div>

        <div class="setting-area" style="flex: 0 0; display: flex; flex-flow: row nowrap;">
          <el-tooltip content="Content" style="flex: 0 0;">
            <el-button class="menu-button vis-when-narrow" text round plan @click="showContent = !showContent" style="margin-left: 0px;">
              <mdi-menu class="menu-button__icon"></mdi-menu>
            </el-button>
          </el-tooltip>

          <div style="flex: 1 1;" class="vis-when-narrow">{{ $route.name }}</div>

          <el-tooltip content="Refresh">
            <el-button class="menu-button" text round plain :loading="isLoading" @click="refresh()">
              <template #loading>
                <mdi-refresh class="menu-button__icon spin"></mdi-refresh>
              </template>
              <mdi-refresh v-if="!isLoading" class="menu-button__icon"></mdi-refresh>
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

    <PageStats v-if="loadFor === 'page'"
               ref="componentPageStats"
               :loading="isLoading"
               :from-date="fromDate"
               :to-date="toDate"
               :sites="selectedSitesConfirmed"
    ></PageStats>
    <EventStats v-else-if="loadFor === 'event'"
                ref="componentEventStats"
                :loading="isLoading"
                :from-date="fromDate"
                :to-date="toDate"
                :sites="selectedSitesConfirmed"
    ></EventStats>

  </div>

  <el-drawer class="hidden-sm-and-down" v-model="showSettings" title="Settings" direction="rtl" size="100%" style="max-width: 500px" >
    <div class="settings-label-single" style="display: flex; justify-content: space-between">
      <span class="settings-label">Theme</span>
      <el-switch class="header__switch" v-model="isDark" inactive-text="Light" active-text="Dark" />
    </div>
  </el-drawer>

  <el-drawer class="hidden-sm-and-down" v-model="showContent" title="Content" direction="rtl" size="100%" style="max-width: 500px;">
    <div style="">
      <el-menu :default-active="$route.path" style="margin-top: 10px; border-right: none;">
        <el-menu-item index="/stats/page" @click="trackRouterClick('menu_page', '/stats/page')">
          <template #title>Page Views</template>
        </el-menu-item>
        <el-menu-item index="/stats/event" @click="trackRouterClick('menu_event', '/stats/event')">
          <template #title>Events</template>
        </el-menu-item>
      </el-menu>
    </div>
  </el-drawer>

</template>

<style scoped>

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

.header-surround {
  flex-flow: row nowrap;
}
.vis-when-narrow {
  display: none;
}
@media all and (max-width: 699px) {
  .header-surround {
    flex-flow: row wrap;
  }
  .vis-when-narrow {
    display: block;
  }
  .setting-area {
    order: -1;
    min-width: 100%;
  }
}
</style>


