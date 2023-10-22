<script setup lang="ts">
import {Ref, ref, watch, onMounted, ComputedRef, computed} from 'vue'
import {api, apiWrapper} from "@frontend/src/lib/api";
import {GetPageChart} from "@backend/api-front/routes/stats/page";
// import Plotly from 'Plotly'
// import * as Plotly, {PlotData} from "plotly.js";
//@ts-ignore
import * as Plotly from "plotly.js-dist-min";
import { ArrowDown } from '@element-plus/icons-vue'
import {useDark} from "@vueuse/core";
import {DateUtils} from "@frontend/src/lib/date_utils";
import {groupBy} from "lodash";
import {PageFilter} from "@backend/lib/models/page_filter";
import Chart, {Graph, Props as ChartProps} from "@frontend/src/components/Chart.vue";

export interface Props {
  sites: string[],
  fromDate?: Date,
  toDate?: Date,
  filter: PageFilter
}
const props = withDefaults(defineProps<Props>(), { });

const emit = defineEmits<{
  (e: 'loading', val: boolean): void,
}>()

let pageViews: Ref<GetPageChart[] | undefined> = ref();

const loading = ref(true);
watch(() => [loading.value], async () => {
  emit('loading', loading.value)
})

function* getDatesInRange(startDate: string, endDate: string, hourly: boolean): Generator<string> {
  const currentDate = new Date(startDate);
  while (currentDate <= new Date(endDate)) {
    yield currentDate.toISOString();
    if (hourly) {
      currentDate.setHours(currentDate.getHours() + 1);
    } else {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
}

function fillMissingDates(chartData: GetPageChart[], minDate: string, maxDate: string, sites: string[], hourly: boolean): GetPageChart[] {
  const filledData: GetPageChart[] = [];

  for (const site of sites) {
    const groupedByData = chartData.filter((entry) => entry.site === site);
    for (const date of getDatesInRange(minDate, maxDate, hourly)) {
      const entry = groupedByData.find((x) => x.date_key === date);
      if (!entry) {
        filledData.push({
          site,
          date_key: date,
          visitors: 0,
          views: 0,
        });
      } else {
        filledData.push(entry);
      }
    }
  }

  return filledData;
}



async function loadData()
{
  if (props.sites.length === 0 || !props.fromDate || !props.toDate)
    return;

  // // TODO: now auto, later make this configurable in the settings pane + the chart type
  const daysBetween = DateUtils.daysBetween(props.fromDate, props.toDate);
  let period: "hour" | "day" = "day";
  if(daysBetween < 3)
    period = "hour";

  const timeZone = DateUtils.currentTimeZone();
  const resp = await apiWrapper(api.getPageChartViews.query({
    sites: props.sites,
    from: props.fromDate?.toISOString(),
    to: props.toDate?.toISOString(),
    filter: props.filter,
    period,
    timeZone
  }), loading);

  if (!resp)
    return;

  const filledInData = fillMissingDates(resp, props.fromDate.toISOString(), props.toDate.toISOString(),
      props.sites, period === "hour");
  pageViews.value = filledInData;
}
watch(() => [props.sites, props.fromDate, props.toDate, props.filter], async () => {
  await loadData();
}, {
  deep: true
})
async function refresh() {
  await loadData();
}
defineExpose({
  refresh
});


function getGraph(valueKey: keyof GetPageChart, pageViews: GetPageChart[], graphName: string)
{
  const dataX: string[] = [];
  const dataY: number[] = [];
  for(let row of pageViews)
  {
    const date = DateUtils.parseIso(row.date_key);
    const dateInTz = DateUtils.stringifyFormat(date, "yyyy-MM-dd HH");
    dataX.push(dateInTz);
    //@ts-ignore
    dataY.push(row[valueKey]);
  }
  const graph: Partial<Plotly.PlotData> = {
    name: graphName,
    x: dataX,
    y: dataY,
    // type: "bar",
    type: "bar",
    mode: 'lines+markers',
    hoverinfo: "x+y+name",
  };
  return graph;
}

const chartProps: Ref<Partial<ChartProps>> = ref({
  selector: {
    options: ["Views", "Visitors"],
    selected: "Views"
  },
  graphs: [],
})

function createGraphs()
{
  const groupedViews = groupBy(pageViews.value, "site");
  const graphs: Partial<Plotly.PlotData>[] = [];

  for(let [groupedBy, groupedChartViews] of Object.entries(groupedViews))
  {
    let graph:  Partial<Plotly.PlotData>;
    switch (chartProps.value.selector!.selected) {
      case "Views":
        graph = getGraph("views", groupedChartViews, groupedBy);
        break;
      case "Visitors":
        graph = getGraph("visitors", groupedChartViews, groupedBy);
        break;
      default:
        throw new Error("Unknown graph type");
    }

    graphs.push(graph);
  }

  // console.log("graphs", graphs)
  chartProps.value.graphs = graphs;
}

onMounted(() => {
  watch([pageViews, props], () => { //.selector.selected
    // console.log("pageViews changed", pageViews.value, props);
    createGraphs();
  }, {
    deep: true
  });

  /* Fix for Vite HMR that will not fire loadData because the watch will not fire, the data it is watching did not change */
  if(!pageViews.value)
    loadData();
})

function changeGraphSelection(command: string) {
  console.log("changeGraphSelection", command)
  chartProps.value.selector!.selected = command;
  createGraphs();
}

</script>

<template>
  <Chart v-bind:selector="chartProps.selector!" v-bind:graphs="chartProps.graphs!" v-bind:from-date="fromDate!"
         v-bind:to-date="toDate!" v-bind:loading="loading"
         @selector-changed="changeGraphSelection"/>
</template>

<style scoped>

</style>
