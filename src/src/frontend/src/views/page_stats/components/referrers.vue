<script setup lang="ts">
import {Ref, ref, watch, computed, onMounted} from 'vue'
import {PageReferrer} from "@backend/api-front/routes/stats";
import TableData, {Column} from "@frontend/src/components/TableData.vue";
import {api, apiWrapper} from "@frontend/src/lib/api";


const loading = ref(true);

export interface Props {
  sites: string[],
  fromDate?: Date,
  toDate?: Date
}
const props = withDefaults(defineProps<Props>(), { });

//emit('loading', true);
const emit = defineEmits<{
  (e: 'loading', val: boolean): void
}>()

let pageReferrers: Ref<PageReferrer[] | undefined> = ref();

async function loadData()
{
  if (props.sites.length === 0 || !props.fromDate || !props.toDate)
    return;

  console.log("PROPS CHANGES - PAGE REFERRER", props.sites, props.fromDate, props.toDate);

  const resp = await apiWrapper(api.getPageReferrers.query({
    sites: props.sites,
    from: props.fromDate?.toISOString(),
    to: props.toDate?.toISOString(),
  }), loading);
  if (!resp)
    return;

  pageReferrers.value = resp;

  // loading.value = true;
  // await new Promise(resolve => setTimeout(resolve, 2000));
  // const data =  [
  //   { referrer: "No Referrer", views: 1231243 },
  //   { referrer: "something.com", views: 2 },
  // ]
  // loading.value = false;
  // pageReferrers.value = data;

}
watch(() => [props.sites, props.fromDate, props.toDate], async () =>
{
  await loadData();
})
async function refresh()
{
  await loadData();
}

defineExpose({
  refresh
});

onMounted(() => {
  /* Fix for Vite HMR that will not fire loadData because the watch will not fire, the data it is watching did not change */
  if(!pageReferrers.value)
    loadData();
})

const columns: Column[] = [
  { name: "Referrer", type: "string", index: "referrer", gridColumn: "6fr" },
  { name: "Views", type: "number", index: "views", gridColumn: "2fr" },
];

</script>

<template>
  <div class="container">
    <TableData :columns="columns" :rows="pageReferrers || []" :loading="loading" :page-size="16" ></TableData>
  </div>
</template>

<style scoped>

</style>
