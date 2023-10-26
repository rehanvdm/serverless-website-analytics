<script setup lang="ts">
import {Ref, ref, watch, computed, onMounted, ComputedRef} from 'vue'
import {uniqBy} from 'lodash'
import {api, apiWrapper} from "@frontend/src/lib/api";
import { GetEventOutput } from "@backend/api-front/routes/stats/event";
import TableData, {Column} from "@frontend/src/components/TableData.vue";
import { EventFilter } from "@backend/lib/models/event_filter";

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

const loading = ref(true);
watch(() => [loading.value], async () => {
  emit('loading', loading.value)
})

let events: Ref<GetEventOutput[] | undefined> = ref();
let eventsQueryExecutionId: string | undefined = undefined;
let eventsNextToken: string | undefined = undefined;
const isPageViewsSameSite = computed(() => !events.value?.length ? true : uniqBy(events.value, 'site').length === 1);

async function loadData()
{
  if (props.sites.length === 0 || !props.fromDate || !props.toDate)
    return;

  const resp = await apiWrapper(api.getEvents.query({
    sites: props.sites,
    from: props.fromDate?.toISOString(),
    to: props.toDate?.toISOString(),
    filter: props.filter,
    queryExecutionId: eventsQueryExecutionId,
    nextToken: eventsNextToken
  }), loading);
  if (!resp)
    return;

  if(!events.value)
    events.value = [];

  events.value = events.value.concat(resp.data);

  // events.value = events.value.concat(resp.data.slice(0,20));
  eventsQueryExecutionId = resp.queryExecutionId;
  eventsNextToken = resp.nextToken;
  // console.log("EVENTS", events.value);

}
watch(() => [props.sites, props.fromDate, props.toDate, props.filter], async () => {
  events.value = [];
  eventsQueryExecutionId = undefined;
  eventsNextToken = undefined;
  await loadData();
}, {
  deep: true
})

async function refresh() {
  events.value = [];
  eventsQueryExecutionId = undefined;
  eventsNextToken = undefined;
  await loadData();
}

defineExpose({
  refresh
});

onMounted(() => {
  /* Fix for Vite HMR that will not fire loadData because the watch will not fire, the data it is watching did not change */
  if(!events.value)
    loadData();
})

const columns: ComputedRef<Column[]> = computed(()  => {
  const ret: Column[] = [
    { name: "Category", type: "string", index: "category", gridColumn: "3fr", canFilter: true },
    { name: "Event", type: "string", index: "event", gridColumn: "5fr", canFilter: true },
    { name: "Sum", type: "number", index: "sum", gridColumn: "1fr" },
    { name: "Count", type: "number", index: "count", gridColumn: "1.1fr" },
    { name: "Avg", type: "number", index: "avg", gridColumn: "1fr" },
    { name: "Min", type: "number", index: "min", gridColumn: "1fr" },
    { name: "Max", type: "number", index: "max", gridColumn: "1fr" },
  ];

  const filterHasValues = Object.values(props.filter).some(v => v);
  if(!isPageViewsSameSite.value || filterHasValues)
    ret.unshift({ name: "Site", type: "string", index: "site", gridColumn: "2fr" });

  return ret;
});

function rowClick(cell: Record<string, any>) {
  const keyName = Object.keys(cell)[0];
  if(keyName === "event")
    emit('filter-change', { event: cell.event })
  else if(keyName === "category")
    emit('filter-change', { category: cell.category })
}
</script>

<template>
  <div class="container">
    <TableData :columns="columns" :rows="events || []" :loading="loading" :page-size="16"
               :load-more-promise="loadData" :enable-page-forward="!!eventsNextToken"
               @click="rowClick"></TableData>
  </div>
</template>

<style scoped>

</style>
