<script setup lang="ts">
import {Ref, ref, watch} from 'vue'
import {humanizeNumber} from "@frontend/src/lib/ui_utils";

export type Card = {
  name: string,
  index: string,
  isPercent?: boolean
};
export interface Props {
  cards: Card[],
  loading: boolean;
  data: any,
  //TODO: Maybe just represent as any or use generics but would then have to define type just for the sake of types
  // data: {
  //   [key: string]: any
  //   previous: {
  //     [key: string]: any
  //   }
  // }
}
const props = withDefaults(defineProps<Props>(), { });

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
    <div class="card" v-for="card of cards">
      <div v-if="!loading">
<!--      <div v-if="false">-->
        <el-tooltip v-if="typeof data[card.index] != undefined && data.period != undefined" :show-after="1000" :content="tooltipContent(data[card.index], data.period.from, data.period.to, data.previous[card.index], data.previous.period.from, data.previous.period.to)" raw-content>
            <div class="card_inner">
              <div class="card__value">{{humanizeNumber(data[card.index])}}</div>
              <div class="card__title">
                {{card.name}}
                <div class="card__value__change" :class="classValueChange(data[card.index], data.previous[card.index])">
                  {{humanizeValueChange(data[card.index], data.previous[card.index], typeof card.isPercent == undefined ? false : card.isPercent, true)}}
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
  flex-flow: row wrap;
  justify-content: space-between;
  box-shadow: var(--el-box-shadow-lighter);
  border-radius: 10px;
  min-height: inherit;
}

.card {
  flex: 0 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 5px;
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
