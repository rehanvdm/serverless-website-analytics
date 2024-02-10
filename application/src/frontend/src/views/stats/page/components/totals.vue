<script setup lang="ts">
import {onMounted, Ref, ref, watch} from 'vue'
import {GetPageTopLevelStats} from "@backend/api-front/routes/stats/page";
import {humanizeNumber} from "@frontend/src/lib/ui_utils";
import {api, apiWrapper} from "@frontend/src/lib/api";
import {PageFilter} from "@backend/lib/models/page_filter";
import Totals from "@frontend/src/components/TotalsData.vue";
import {Card} from "@frontend/src/components/TotalsData.vue";

export interface Props {
  sites: string[],
  fromDate?: Date,
  toDate?: Date,
  filter: PageFilter
}
const props = withDefaults(defineProps<Props>(), { });

const emit = defineEmits<{
  (e: 'loading', val: boolean): void
}>()

let stats: Ref<GetPageTopLevelStats | undefined> = ref();

const loading = ref(true);
watch(() => [loading.value], async () => {
  emit('loading', loading.value)
})

async function loadData()
{
  if (props.sites.length === 0 || !props.fromDate || !props.toDate)
    return;

  const resp = await apiWrapper(api.getPageTopLevelStats.query({
    sites: props.sites,
    from: props.fromDate?.toISOString(),
    to: props.toDate?.toISOString(),
    filter: props.filter,
  }), loading);
  if (!resp)
    return;

  stats.value = resp;
}
watch(() => [props.sites, props.fromDate, props.toDate, props.filter], async () =>{
  await loadData();
}, {
  deep: true
})

async function refresh(){
  await loadData();
}
defineExpose({
  refresh
});

onMounted(() => {
  /* Fix for Vite HMR that will not fire loadData because the watch will not fire, the data it is watching did not change */
  if(!stats.value)
    loadData();
})

const cards: Card[] = [
  { name: 'Visitors', index: 'visitors' },
  { name: 'Views', index: 'page_views' },
  { name: 'Time on page', index: 'avg_time_on_page' },
  { name: 'Bounce rate', index: 'bounce_rate', isPercent: true },
]

</script>

<template>
  <Totals :cards="cards" :data="stats || []" :loading="loading" />
</template>

<style scoped>

</style>
