<script setup lang="ts">
import { useDark } from '@vueuse/core';
import {computed, onMounted, Ref, ref, unref, watch} from "vue";
import {api, apiWrapper} from "@frontend/src/lib/api";
// import EventStats from "@frontend/src/views/stats/event/index.vue";
import PageStats from "@frontend/src/views/stats/page/index.vue";
import {DateUtils} from "@frontend/src/lib/date_utils";
import {getSystemStore} from "@frontend/src/stores/system";
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

const isLoading = ref(false);
watch([loadingSites], () => {
  isLoading.value = loadingSites.value;
});

//TODO: refresh, create component here, let parnt then call child? OR pass the refresh boolean, let child listen? NO do as function
// const componentTotal = ref<InstanceType<typeof Totals>>();
// componentTotal.value.refresh();
function refresh()
{
  console.log("TODO REFRESH")
}

//TODO: these might need to move to the child components...
watch([selectedSitesConfirmed, dateFilter], () => {
  router.push({ query: {
      sites: encodeURIComponent(selectedSitesConfirmed.value.join(',')),
      date: encodeURIComponent(dateFilter.value.map(d => d.toISOString()).join(',')),
      ...route.query
    }
  });
}, { deep: true });

let loadFor = "" ;
//watch the router, if path is page/stats then the page compnent else if the page/event path then the event component
watch(() => route.path, async () => {
  console.log("route.path", route.path)
  if(route.path === "/stats/page")
  {
    loadFor = "page";
    // await pageStats.value.refresh();
  }
  else if(route.path === "/stats/event")
  {
    loadFor = "event";
    // await eventStats.value.refresh();
  }
}, { immediate: true });

</script>

<template>



<div style="width: 100%">

  <el-header>

    <div style="display: flex; justify-content: space-between;  padding-top: 10px; ">
      <div>
        <div v-if="loadingSites && !sites.length">
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
                        range-separator="To" start-placeholder="Start date" end-placeholder="End date"/>
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
             :loading="isLoading"
             :from-date="fromDate"
             :to-date="toDate"
             :sites="selectedSitesConfirmed"
  ></PageStats>
<!--  <EventStats v-else-if="loadFor === 'event'"></EventStats>-->

</div>



  <el-drawer class="hidden-sm-and-down" v-model="showSettings" title="Settings" direction="rtl" size="100%" style="max-width: 500px" >
    <div class="settings-label-single" style="display: flex; justify-content: space-between">
      <span class="settings-label">Theme</span>
      <el-switch class="header__switch" v-model="isDark" inactive-text="Light" active-text="Dark" />
    </div>
  </el-drawer>



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


