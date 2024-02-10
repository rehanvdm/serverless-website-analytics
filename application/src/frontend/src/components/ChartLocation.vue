<script setup lang="ts">
import {ref, watch, onMounted} from 'vue'
// import Plotly from 'Plotly'
// import * as Plotly, {PlotData} from "plotly.js";
//@ts-ignore
import * as Plotly from "plotly.js-dist-min";
import { ArrowDown } from '@element-plus/icons-vue'
import {useDark} from "@vueuse/core";

export type Graph = Partial<Plotly.PlotData>;
export interface Props {
  graphs: Graph[],
  loading: boolean;
}
const props = withDefaults(defineProps<Props>(), { });

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

function paintChart()
{
  const chartBackground = isDark.value ? colors.dark.chartBackground : colors.light.chartBackground;
  const chartForeground =  isDark.value ? colors.dark.chartForeground : colors.light.chartForeground;

  Plotly.newPlot(chartRef.value, props.graphs,
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
  watch([isDark, props], () => {
    // console.log("painting chart", props);
    paintChart();
  }, {
    deep: true
  })
})
</script>

<template>
  <div style="height: 470px;">
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
</template>

<style scoped>
</style>
