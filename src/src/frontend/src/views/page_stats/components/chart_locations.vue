<script setup lang="ts">
import {Ref, ref, watch, onMounted, computed} from 'vue'

// import Plotly from 'Plotly'
// import * as Plotly, {PlotData} from "plotly.js";
//@ts-ignore
import * as Plotly from "plotly.js-dist-min";
import {useDark} from "@vueuse/core";
import TableData, {Column} from "@frontend/src/components/TableData.vue";
import {api, apiWrapper} from "@frontend/src/lib/api";
import {UsersGroupedByStat} from "@backend/api-front/routes/stats";
import {Filter} from "@backend/lib/models/filter";

export interface Props {
  sites: string[],
  fromDate?: Date,
  toDate?: Date,
  filter: Filter
}
const props = withDefaults(defineProps<Props>(), { });

const emit = defineEmits<{
  (e: 'loading', val: boolean): void,
  (e: 'filter-change', val: Filter): void
}>()


let chartLocations: Ref<UsersGroupedByStat[] | undefined> = ref();

const loading = ref(true);
watch(() => [loading.value], async () => {
  emit('loading', loading.value)
})

async function loadData()
{
  if (props.sites.length === 0 || !props.fromDate || !props.toDate)
    return;

  const resp = await apiWrapper(api.getUsersGroupedByStatForPeriod.query({
    sites: props.sites,
    from: props.fromDate?.toISOString(),
    to: props.toDate?.toISOString(),
    filter: props.filter,
    groupBy: "country_name"
  }), loading);

  if (!resp)
    return;

  chartLocations.value = resp;

  // loading.value = true;
  // await new Promise(resolve => setTimeout(resolve, 1000));
  // chartLocations.value = [
  //   {"group":"United States","visitors":3166555},
  //   {"group":"United Kingdom","visitors":1850},
  //   {"group":"Ireland","visitors":983},
  //   {"group":"Scotland","visitors":983},
  //   {"group":"South Africa long very long","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  //   {"group":"South Africa","visitors":209},
  // ];
  // loading.value = false;
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


const isDark = useDark();
const colors = {
  dark: {
    chartBackground: "#1c1b22",
    chartForeground: "#fff"
  },
  light: {
    chartBackground: "#fff",
    chartForeground: "#1c1b22"
  }
};

const chartRef = ref();
function getGraph()
{
  const dataLocations: string[] = [];
  const dataValues: number[] = [];
  for(let row of chartLocations.value!)
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

function paintChart()
{
  const chartBackground = isDark.value ? colors.dark.chartBackground : colors.light.chartBackground;
  const chartForeground =  isDark.value ? colors.dark.chartForeground : colors.light.chartForeground;

  let graph = getGraph();

  Plotly.newPlot(chartRef.value, [
      graph
    ],
    {
      plot_bgcolor: chartBackground,
      paper_bgcolor: chartBackground,
      legend: {
        font: {
          color: chartForeground
        },
      },
      title: {
        font: {
          color: chartForeground
        }
      },
      autosize: true,
      // dragmode: false, //disable zoom
      margin: { l: 0, r: 0, b: 0, t: 0, pad: 0 },
      //https://plotly.com/javascript/reference/layout/geo/#layout-geo-countrycolor
      geo:{
        // showframe: true, //TODO: For testing only
        showframe: false,
        projection:{
          // type: 'equirectangular',
          type: "natural earth",
          // type: "nell hammer",
        },
        showland: true, //Land masses
        showcountries: true, //Lines between land masses
        showcoastlines: true,
        landcolor: "rgba(153,153,153,0.30)",
        countrycolor : chartBackground,
        coastlinecolor: chartBackground,
        lakecolor: chartBackground,
        bgcolor: chartBackground,
      }
    }, {
      responsive: true,
      displayModeBar: false,
    });
  // Plotly.Plots.resize(chartRef.value); /* Because div is hidden, plotly can not calculate width */
}



onMounted(() => {
  watch([isDark, chartLocations], () => {
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

function rowClick(rowText: any) {
  emit('filter-change', { country_name: rowText })
}
</script>

<template>
  <div class="container" style="height: 470px;">

    <div style="display: grid; grid-template-columns: 6fr 2fr; height: 100%;">
      <div>
        <div v-show="!loading" class="chart" ref="chartRef" style="height: 100%; width: 870px;"></div>
        <el-skeleton v-show="loading" :loading="true" animated style="height: 100%">
          <template #template>
            <div style="display: flex; height: 100%; width: 100%; margin-top: 10px; column-gap: 10px;">
              <div class="chart" style="height: 100%; width: 900px; ">
                <el-skeleton-item variant="image" style="height: 85%; margin: 20px;" />
              </div>
            </div>
          </template>
        </el-skeleton>
      </div>
      <TableData :columns="columns" :rows="chartLocations || []" :loading="loading" :page-size="16"
                 @click="rowClick"></TableData>
    </div>

  </div>
</template>

<style scoped>
</style>
