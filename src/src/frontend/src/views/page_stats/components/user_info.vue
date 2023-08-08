<script setup lang="ts">
import {Ref, ref, watch, computed, onMounted} from 'vue'
import {PageReferrer, UsersGroupedByStat} from "@backend/api-front/routes/stats";
import TableData, {Column} from "@frontend/src/components/TableData.vue";
import {api, apiWrapper} from "@frontend/src/lib/api";
import {Filter} from "@backend/lib/models/filter";

export interface Props {
  sites: string[],
  fromDate?: Date,
  toDate?: Date,
  filter: Filter
}
const props = withDefaults(defineProps<Props>(), { });

const activeTab = ref('device')

const emit = defineEmits<{
  (e: 'loading', val: boolean): void,
  (e: 'filter-change', val: Filter): void
}>()

let pageDevices: Ref<UsersGroupedByStat[] | undefined> = ref();
let pageBrowsers: Ref<UsersGroupedByStat[] | undefined> = ref();
let pageOperatingSystem: Ref<UsersGroupedByStat[] | undefined> = ref();

const loading = ref(true);
watch(() => [loading.value], async () => {
  emit('loading', loading.value)
})

//TODO: Later | "browser" | "os"
async function loadData(groupBy: "device_type") {
  if (props.sites.length === 0 || !props.fromDate || !props.toDate)
    return;

  const resp = await apiWrapper(api.getUsersGroupedByStatForPeriod.query({
    sites: props.sites,
    from: props.fromDate?.toISOString(),
    to: props.toDate?.toISOString(),
    filter: props.filter,
    groupBy
  }), loading);

  if(!resp)
    return;

  if(groupBy === "device_type")
    pageDevices.value = resp;
  else if(groupBy === "browser")
    pageBrowsers.value = resp;
  else if(groupBy === "os")
    pageOperatingSystem.value = resp;


  // loading.value = true;
  // await new Promise(resolve => setTimeout(resolve, 2000));
  // const data =  [
  //   { "group": "desktop", "visitors": 2 },
  //   { "group": "mobile", "visitors": 569 },
  // ]
  // loading.value = false;
  // pageDevices.value = data;
}
watch(() => [props.sites, props.fromDate, props.toDate, activeTab, props.filter], async () =>
{
  if(activeTab.value === "device")
    await loadData("device_type");
  // else if(activeTab.value === "browsers")
  //   await loadData("browser");
  // else if(activeTab.value === "os")
  //   await loadData("os");
}, {
  deep: true
});

async function refresh() {
  await loadData("device_type");
}
defineExpose({
  refresh
});

onMounted(() => {
  /* Fix for Vite HMR that will not fire loadData because the watch will not fire, the data it is watching did not change */
  if(!pageDevices.value)
    loadData("device_type");
})

const columns: Column[] = [
  { name: "Device", type: "string", index: "group", gridColumn: "6fr", canFilter: true },
  { name: "Visitors", type: "number", index: "visitors", gridColumn: "2fr" },
];

function rowClick(rowText: any) {
  emit('filter-change', { device_type: rowText })
}
</script>

<template>
  <div class="container">
    <el-tabs v-model="activeTab" tab-position="top" style="margin-top: 10px;">
      <el-tab-pane name="device" label="Device" style="padding: 0 10px; margin-top: -10px;">
        <TableData :columns="columns" :rows="pageDevices || []" :loading="loading" :page-size="16"
                   @click="rowClick"></TableData>
      </el-tab-pane>
      <el-tab-pane name="browser" disabled label="Browser">Browser</el-tab-pane>
      <el-tab-pane name="os" disabled label="Operating System">Operating System</el-tab-pane>
    </el-tabs>

  </div>
</template>

<style scoped>

</style>
