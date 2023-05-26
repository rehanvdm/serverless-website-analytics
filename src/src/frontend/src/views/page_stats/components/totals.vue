<script setup lang="ts">
import {Ref, ref, watch} from 'vue'
import {GetTopLevelStats} from "@backend/api-front/routes/stats";
import {humanizeNumber} from "@frontend/src/lib/ui_utils";
import {api, apiWrapper} from "@frontend/src/lib/api";

const loadingTotals = ref(true);

export interface Props {
  sites: string[],
  fromDate?: Date,
  toDate?: Date
}
const props = withDefaults(defineProps<Props>(), { });

const emit = defineEmits<{
  (e: 'loading', val: boolean): void
}>()

let stats: Ref<GetTopLevelStats | undefined> = ref();

async function loadData()
{
  if (props.sites.length === 0 || !props.fromDate || !props.toDate)
    return;

  const resp = await apiWrapper(api.getTopLevelStats.query({
    sites: props.sites,
    from: props.fromDate?.toISOString(),
    to: props.toDate?.toISOString()
  }), loadingTotals);
  if (!resp)
    return;

  stats.value = resp;

  // loadingTotals.value = false;
  // stats.value =  {
  //   "visitors": 2,
  //   "page_views": 1137863,
  //   "avg_time_on_page": 30.51,
  //   "bounce_rate": 19.83,
  //   "latest_page_opened_at": "2023-04-23T19:51:43.370Z",
  //   "period": {
  //     "from": "2023-04-15T22:00:00.000Z",
  //     "to": "2023-04-23T21:59:59.999Z"
  //   },
  //   "previous": {
  //     "visitors": 1,
  //     "page_views": 1152097,
  //     "avg_time_on_page": 30.51,
  //     "bounce_rate": 23.33,
  //     "period": {
  //       "from": "2023-04-07T22:00:00.000Z",
  //       "to": "2023-04-15T21:59:59.999Z"
  //     }
  //   }
  // };
  //
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


function humanizeValueChange(value: number, valuePrevious: number, isPercent: boolean = false, round: boolean = false)
{
  let change = value - valuePrevious;
  if(round)
    change = Number(change.toFixed(2));

  let ret = humanizeNumber(change);
  ret = change > 0 ? `+${ret}` : `${ret}`;
  return isPercent ? `${ret}%` : ret;
}
function classValueChange(value: number, valuePrevious: number)
{
  const change = value - valuePrevious;
  if(change === 0)
    return 'card__value__change--same';
  return change > 0 ? 'card__value__change--increase' : 'card__value__change--decrease';
}
function tooltipContent(value: number, from: string, to: string, prevValue: number, prevFrom: string, prevTo: string)
{
  return `<span style='font-weight:bold;'>Value</span>: <span>${value}</span> <br>
          <span style='font-weight:bold;'>Period</span>: <span>${from} to ${to}</span> <br>
          <span style='font-weight:bold;'>Previous</span>: <span>${prevValue}</span> <br>
          <span style='font-weight:bold;'>Previous Period</span>: <span>${prevFrom} to ${prevTo}</span> <br>`;
}
</script>

<template>
  <div class="container totals">

    <div class="card">
      <div v-if="!loadingTotals">
<!--      <div v-if="false">-->
        <el-tooltip v-if="stats" :show-after="1000" :content="tooltipContent(stats.visitors, stats.period.from, stats.period.to, stats.previous.visitors, stats.previous.period.from, stats.previous.period.to)" raw-content>
            <div class="card_inner">
              <div class="card__value">{{humanizeNumber(stats.visitors)}}</div>
              <div class="card__title">
                Visitors
                <div class="card__value__change" :class="classValueChange(stats.visitors, stats.previous.visitors)">
                  {{humanizeValueChange(stats.visitors, stats.previous.visitors)}}
                </div>
              </div>
            </div>
        </el-tooltip>
      </div>
      <el-skeleton v-else  :loading="true" animated class="card_inner">
        <template #template>
            <el-skeleton-item class="card__value card__value__skeleton"></el-skeleton-item>
            <el-skeleton-item class="card__title card__title__skeleton"></el-skeleton-item>
        </template>
      </el-skeleton>
    </div>

    <div class="card">
      <div v-if="!loadingTotals">
        <!--    <div v-if="false">-->
        <el-tooltip v-if="stats" :show-after="1000" :content="tooltipContent(stats.page_views, stats.period.from, stats.period.to, stats.previous.page_views, stats.previous.period.from, stats.previous.period.to)" raw-content>
          <div class="card_inner">
            <div class="card__value">{{humanizeNumber(stats.page_views)}}</div>
            <div class="card__title">
              Views
              <div class="card__value__change" :class="classValueChange(stats.page_views, stats.previous.page_views)">
                {{humanizeValueChange(stats.page_views, stats.previous.page_views)}}
              </div>
            </div>
          </div>
        </el-tooltip>
      </div>
      <el-skeleton v-else  :loading="true" animated class="card_inner">
        <template #template>
          <el-skeleton-item class="card__value card__value__skeleton"></el-skeleton-item>
          <el-skeleton-item class="card__title card__title__skeleton"></el-skeleton-item>
        </template>
      </el-skeleton>
    </div>

    <div class="card">
      <div v-if="!loadingTotals">
        <!--    <div v-if="false">-->
        <el-tooltip v-if="stats" :show-after="1000" :content="tooltipContent(stats.avg_time_on_page, stats.period.from, stats.period.to, stats.previous.avg_time_on_page, stats.previous.period.from, stats.previous.period.to)" raw-content>
          <div class="card_inner">
            <div class="card__value">{{humanizeNumber(stats.avg_time_on_page)}}</div>
            <div class="card__title">
              Time on page
              <div class="card__value__change" :class="classValueChange(stats.avg_time_on_page, stats.previous.avg_time_on_page)">
                {{humanizeValueChange(stats.avg_time_on_page, stats.previous.avg_time_on_page, false, true)}}
              </div>
            </div>
          </div>
        </el-tooltip>
      </div>
      <el-skeleton v-else  :loading="true" animated class="card_inner">
        <template #template>
          <el-skeleton-item class="card__value card__value__skeleton"></el-skeleton-item>
          <el-skeleton-item class="card__title card__title__skeleton"></el-skeleton-item>
        </template>
      </el-skeleton>
    </div>

    <div class="card">
      <div v-if="!loadingTotals">
        <!--    <div v-if="false">-->
        <el-tooltip v-if="stats" :show-after="1000" :content="tooltipContent(stats.bounce_rate, stats.period.from, stats.period.to, stats.previous.bounce_rate, stats.previous.period.from, stats.previous.period.to)" raw-content>
          <div class="card_inner">
            <div class="card__value">{{humanizeNumber(stats.bounce_rate)}}</div>
            <div class="card__title">
              Bounce rate
              <div class="card__value__change" :class="classValueChange(stats.bounce_rate, stats.previous.bounce_rate)">
                {{humanizeValueChange(stats.bounce_rate, stats.previous.bounce_rate, true, true)}}
              </div>
            </div>
          </div>
        </el-tooltip>
      </div>
      <el-skeleton v-else  :loading="true" animated class="card_inner">
        <template #template>
          <el-skeleton-item class="card__value card__value__skeleton"></el-skeleton-item>
          <el-skeleton-item class="card__title card__title__skeleton"></el-skeleton-item>
        </template>
      </el-skeleton>
    </div>

  </div>
</template>

<style scoped>

.totals {
  display: flex;
  justify-content: space-between;
  box-shadow: var(--el-box-shadow-lighter);
  border-radius: 10px;
  min-height: inherit;
}

.card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 15px;
  width: 25%;
  min-width: 100px;
}
.card__skeleton {
  margin-top: 5px;
}

.card_inner {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.card_inner__skeleton {

}

.card__value {
  font-size: 2rem;
  /*font-weight: 600;*/
}
.card__value__skeleton {
  height: 30px;
  width: 100px;
  margin-bottom: 10px;
}

.card__title {
  /*font-size: 0.8rem;*/
  /*font-weight: 600;*/
  margin-top: 0px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.card__title__skeleton {
  max-width: 300px;
}

.card__value__change {
  font-size: 0.8rem;
  /*font-weight: 600;*/
  margin-left: 5px;
}

.card__value__change--same {
  color: var(--el-color-warning);
}
.card__value__change--increase {
  color: var(--el-color-success);
}
.card__value__change--decrease {
  color: var(--el-color-error);
}

</style>
