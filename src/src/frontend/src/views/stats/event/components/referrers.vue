<script setup lang="ts">
import {Ref, ref, watch, computed, onMounted} from 'vue'
import {GetEventReferrer} from "@backend/api-front/routes/stats/event";
import {EventFilter} from "@backend/lib/models/event_filter";
import TableData, {Column} from "@frontend/src/components/TableData.vue";
import {api, apiWrapper} from "@frontend/src/lib/api";

export interface Props {
  sites: string[],
  fromDate?: Date,
  toDate?: Date,
  filter: EventFilter
}
const props = withDefaults(defineProps<Props>(), { });

const emit = defineEmits<{
  (e: 'loading', val: boolean): void,
  (e: 'filter-change', val: EventFilter): void
}>()

let eventReferrers: Ref<GetEventReferrer[] | undefined> = ref();

const loading = ref(true);
watch(() => [loading.value], async () => {
  emit('loading', loading.value)
})

async function loadData() {
  if (props.sites.length === 0 || !props.fromDate || !props.toDate)
    return;

  const resp = await apiWrapper(api.getEventReferrers.query({
    sites: props.sites,
    from: props.fromDate?.toISOString(),
    to: props.toDate?.toISOString(),
    filter: props.filter,
  }), loading);
  if (!resp)
    return;

  eventReferrers.value = resp;
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

onMounted(() => {
  /* Fix for Vite HMR that will not fire loadData because the watch will not fire, the data it is watching did not change */
  if(!eventReferrers.value)
    loadData();
})

const columns: Column[] = [
  { name: "Referrer", type: "string", index: "referrer", gridColumn: "6fr", canFilter: true, openExternalColumn: "referrer" },
  { name: "Sum", type: "number", index: "sum", gridColumn: "2fr" },
];

function rowClick(cell: Record<string, any>) {
  const keyName = Object.keys(cell)[0];
  const keyValue = cell[keyName];

  if(keyValue === "No Referrer")
    emit('filter-change', { referrer: null })
  else
    emit('filter-change', { referrer: keyValue })
}
</script>

<template>
  <div class="container">
    <TableData :columns="columns" :rows="eventReferrers || []" :loading="loading" :page-size="16"
               @click="rowClick"></TableData>
  </div>
</template>

<style scoped>

</style>
