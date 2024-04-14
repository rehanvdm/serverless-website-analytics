<script setup lang="ts">
import {computed, onMounted, Ref, ref, unref, watch} from "vue";
import Totals from "@frontend/src/views/stats/page/components/totals.vue";
import ChartViews from "@frontend/src/views/stats/page/components/chart_views.vue";
import PageViews from "@frontend/src/views/stats/page/components/page_views.vue";
import ChartLocations from "@frontend/src/views/stats/page/components/chart_locations.vue";
import Referrers from "@frontend/src/views/stats/page/components/referrers.vue";
import UserInfo from "@frontend/src/views/stats/page/components/user_info.vue";
import UTM from "@frontend/src/views/stats/page/components/utm.vue";
import {PageFilter} from "@backend/lib/models/page_filter";
import {useRoute, useRouter} from "vue-router";

const route = useRoute();
const router = useRouter();

export interface Props {
  loading: boolean,
  sites: string[],
  fromDate?: Date,
  toDate?: Date,
}
const props = withDefaults(defineProps<Props>(), { });

const emit = defineEmits<{
  (e: 'loading', val: boolean): void,
}>()

/* ================================================================================================================== */
/* ================================================= Site Selector ================================================== */
/* ================================================================================================================== */

onMounted(async () => {
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
  return props.loading || loadingTotals.value || loadingPageViews.value ||
    loadingChartViews.value || loadingChartLocations.value || loadingReferrers.value || loadingUserInfo.value || loadingUtm.value;
});

const componentTotal = ref<InstanceType<typeof Totals>>();
const componentPageViews = ref<InstanceType<typeof PageViews>>();
const componentChartViews = ref<InstanceType<typeof ChartViews>>();
const componentChartLocations = ref<InstanceType<typeof ChartLocations>>();
const componentReferrers = ref<InstanceType<typeof Referrers>>();
const componentUserInfo = ref<InstanceType<typeof UserInfo>>();
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
defineExpose({
  refresh
});

const filter: Ref<PageFilter> = ref({
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
function filterChange(partialFilter: PageFilter) {
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
const hasFilters = computed(() => {
  return filter.value.page_url || filter.value.referrer || filter.value.country_name || filter.value.device_type ||
    filter.value.utm_source || filter.value.utm_medium || filter.value.utm_campaign || filter.value.utm_term ||
    filter.value.utm_content;
});

watch([filter], () => {
  router.push({ query: {
    ...route.query,
    filter: Object.values(filter.value).filter(v => v).length ? encodeURIComponent(JSON.stringify(filter!.value)) : undefined,
    }
  });
}, { deep: true });

</script>


<template>


  <el-header v-if="hasFilters"  style="height: inherit">

    <el-tag class="filter-tag" v-if="filter.page_url" closable @close="filter.page_url = undefined">
      <b>Page</b> = {{filter.page_url}}
    </el-tag>

    <el-tag class="filter-tag" v-if="filter.referrer" closable @close="filter.referrer = undefined">
      <b>Referrer</b> = {{filter.referrer}}
    </el-tag>
    <el-tag class="filter-tag" v-else-if="filter.referrer === null" closable @close="filter.referrer = undefined">
      <b>Referrer</b> = No Referrer
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
    <el-button text size="small" v-if="hasFilters" @click="clearFilters()">Clear filters</el-button>

  </el-header>


  <!--    v-if="selectedSites.length > 0 && fromDate && toDate"-->
      <el-main class="h100" style="overflow: visible; padding-top: 0;">
        <div class="main-row">
          <Totals ref="componentTotal" :sites="sites" :from-date="fromDate" :to-date="toDate"
                  @loading="(val) => loadingTotals = val"
                  :filter="filter"
          ></Totals>
        </div>

        <div class="main-row">
          <ChartViews ref="componentChartViews" :sites="sites" :from-date="fromDate" :to-date="toDate"
                      @loading="(val) => loadingChartViews = val"
                      :filter="filter"
                      style="overflow: scroll; width: 300px;"
          ></ChartViews>
        </div>

        <div class="main-row">
          <PageViews ref="componentPageViews" :sites="sites" :from-date="fromDate" :to-date="toDate"
                     @loading="(val) => loadingPageViews = val"
                     :filter="filter" @filter-change="filterChange"
          ></PageViews>
          <Referrers ref="componentReferrers" :sites="sites" :from-date="fromDate" :to-date="toDate"
                     @loading="(val) => loadingReferrers = val"
                     :filter="filter" @filter-change="filterChange"
          ></Referrers>
        </div>


        <div class="main-row">
          <ChartLocations ref="componentChartLocations" :sites="sites" :from-date="fromDate" :to-date="toDate"
                      @loading="(val) => loadingChartLocations = val"
                      :filter="filter" @filter-change="filterChange"></ChartLocations>
        </div>

        <div class="main-row">
          <UserInfo ref="componentUserInfo" :sites="sites" :from-date="fromDate" :to-date="toDate"
                    @loading="(val) => loadingUserInfo = val"
                    :filter="filter" @filter-change="filterChange"></UserInfo>
          <UTM ref="componentUtm" :sites="sites" :from-date="fromDate" :to-date="toDate"
               @loading="(val) => loadingUtm = val"
               :filter="filter" @filter-change="filterChange"></UTM>
        </div>

        <div class="main-row" style="margin-bottom: 100px;"></div>

      </el-main>

</template>

<style scoped>
</style>

