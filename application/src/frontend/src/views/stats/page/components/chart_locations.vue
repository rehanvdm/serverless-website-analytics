<script setup lang="ts">
import {Ref, ref, watch, onMounted, computed} from 'vue'

// import Plotly from 'Plotly'
// import * as Plotly, {PlotData} from "plotly.js";
//@ts-ignore
import * as Plotly from "plotly.js-dist-min";
import TableData, {Column} from "@frontend/src/components/TableData.vue";
import {api, apiWrapper} from "@frontend/src/lib/api";
import {GetPageUsersGroupedByStat} from "@backend/api-front/routes/stats/page";
import {PageFilter} from "@backend/lib/models/page_filter";
import ChartLocation, {Graph, Props as ChartProps} from "@frontend/src/components/ChartLocation.vue";


export interface Props {
  sites: string[],
  fromDate?: Date,
  toDate?: Date,
  filter: PageFilter
}
const props = withDefaults(defineProps<Props>(), { });

const emit = defineEmits<{
  (e: 'loading', val: boolean): void,
  (e: 'filter-change', val: PageFilter): void
}>()


let chartLocations: Ref<GetPageUsersGroupedByStat[] | undefined> = ref();

const loading = ref(true);
watch(() => [loading.value], async () => {
  emit('loading', loading.value)
})

async function loadData()
{
  if (props.sites.length === 0 || !props.fromDate || !props.toDate)
    return;

  const resp = await apiWrapper(api.getPageUsersGroupedByStatForPeriod.query({
    sites: props.sites,
    from: props.fromDate?.toISOString(),
    to: props.toDate?.toISOString(),
    filter: props.filter,
    groupBy: "country_name"
  }), loading);

  if (!resp)
    return;

  chartLocations.value = resp;
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



function getGraph()
{
  if(!chartLocations.value)
    return undefined;

  const dataLocations: string[] = [];
  const dataValues: number[] = [];
  for(let row of chartLocations.value)
  {
    dataLocations.push(row.group);
    dataValues.push(row.visitors);
  }
  const graph: Partial<Plotly.PlotData> = {
    name: "Visitors",
    type: 'choropleth',
    locationmode: 'country names',
    locations: dataLocations,
    z: dataValues,
    text: "Visitors",
    colorscale: [
      [0,'rgb(148,181,212)'],[1,'rgb(9,109,208)'],
    ],
    colorbar: {
      thickness: 10 // Color bar width
    },
  };
  return graph;
}

const chartProps: Ref<Partial<ChartProps>> = ref({
  graphs: [],
})

function paintChart()
{
  let graph = getGraph();
  if(!graph)
  {
    chartProps.value.graphs = [];
    return;
  }

  chartProps.value.graphs = [graph];
}

onMounted(() => {
  watch([chartLocations, props], () => {
    paintChart();
  });

  /* Fix for Vite HMR that will not fire loadData because the watch will not fire, the data it is watching did not change */
  if(!chartLocations.value)
    loadData();
})


const columns: Column[] = [
  { name: "Country", type: "string", index: "group", gridColumn: "6fr", canFilter: true },
  { name: "Visitors", type: "number", index: "visitors", gridColumn: "2fr" },
];

function rowClick(cell: Record<string, any>) {
  const keyName = Object.keys(cell)[0];
  const keyValue = cell[keyName];

  emit('filter-change', { country_name: keyValue })
}
</script>

<template>
  <div class="container chart-data-outer">
    <div class="chart-data" style="height: 100%;">
      <ChartLocation v-bind:graphs="chartProps.graphs!" v-bind:loading="loading" style="overflow: scroll; width: 100%;"></ChartLocation>
      <TableData class="table-data" :columns="columns" :rows="chartLocations || []" :loading="loading" :page-size="16"
                 @click="rowClick"></TableData>
    </div>
  </div>
</template>

<style scoped>
.chart-data {
  display: grid;
  grid-template-columns: 6fr 2fr;
  padding: 10px;
}
.table-data {
  min-width: 140px;
  margin-left: 10px;
}
.chart-data-outer {
  min-height: 490px;
}
@media all and (max-width: 699px) {
  .chart-data {
    display: flex;
    flex-flow: row wrap;
  }
  .table-data {
    order: -1;
    width: 100%;
    margin-bottom: 10px;
  }
  .chart-data-outer {
    height: fit-content;
  }
}
</style>
