<script setup lang="ts">
import {ref, watch, onMounted} from 'vue'
// import Plotly from 'Plotly'
// import * as Plotly, {PlotData} from "plotly.js";
//@ts-ignore
import * as Plotly from "plotly.js-dist-min";
import { ArrowDown } from '@element-plus/icons-vue'
import {useDark} from "@vueuse/core";

export type Graph = Partial<Plotly.PlotData>; // & { selectorName: string };
export interface Props {
  selector: {
    options: string[],
    selected: string
  }
  graphs: Graph[],
  fromDate: Date,
  toDate: Date,
  loading: boolean;
}
const props = withDefaults(defineProps<Props>(), { });
const emit = defineEmits<{
  (e: 'selectorChanged', selected: string): void
}>()


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
      barmode: 'stack',
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
      scene: {
        xaxis: {
          color: chartForeground
        },
        yaxis: {
          color: chartForeground
        },
        zaxis: {
          color: chartForeground
        },
      },
      hoverlabel: {
        font: {
          color: chartForeground
        }
      },
      showlegend: false,
      autosize: true,
      margin: {
        l: 20,
        r: 0,
        b: 40,
        t: 10,
        pad: 5
      },
      hovermode: "x unified",
      xaxis : {
        color: chartForeground,
        range: [props.fromDate!.getTime(),props.toDate!.getTime()],
        showgrid: false,
        zeroline: false,
        showline: false,
      },
      yaxis : {
        color: chartForeground,
        automargin: true,
        fixedrange: true,
        rangemode: "tozero", //nonnegative
        // zeroline: true,
      },
    }, {
      responsive: true,
      displayModeBar: false,
    });
  Plotly.Plots.resize(chartRef.value); /* Because div is hidden, plotly can not calculate width */
}


function changeGraphSelection(command: string) {
  emit('selectorChanged', command);
}

onMounted(() => {
  watch([isDark, props], () => { //.graphs, props.selector, props.fromDate, props.toDate
    // console.log("painting chart", props);
    paintChart();
  }, {
    deep: true
  })
})
</script>

<template>
  <div class="container" style="height: 470px;">
    <div v-show="!loading" style="position: relative; padding: 10px;">
      <el-dropdown class="chart_selector" trigger="click" @command="changeGraphSelection">
      <span>
        {{selector.selected}}
        <el-icon style="top: 2px;"> <arrow-down /> </el-icon>
      </span>
        <template #dropdown>
          <el-dropdown-menu v-for="opt of selector.options">
            <el-dropdown-item :command="opt">{{opt}}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <div class="chart" ref="chartRef"></div>
    </div>
    <el-skeleton v-show="loading" :loading="true" animated style="height: 100%">
      <template #template>
        <el-skeleton-item variant="image" style="height: 91%; margin: 20px;" />
      </template>
    </el-skeleton>
  </div>
</template>

<style scoped>

.chart_selector {
  /*margin-top: 5px;*/
  font-weight: bold;
  cursor: pointer;
  outline: none;

  position: absolute;
  top: 0;
  right: 0;
  z-index: 1000;
}
.chart_selector span {
  outline: none;
  padding: 10px;
  backdrop-filter: blur(1rem);
}



</style>
