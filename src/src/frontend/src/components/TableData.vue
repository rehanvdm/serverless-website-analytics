<script setup lang="ts">
import { ref, computed } from "vue";
import { humanizeNumber } from "@frontend/src/lib/ui_utils";

export type Column = { name: string, index: string, type: "string" | "number", gridColumn: `${number}fr` };
export type Props = {
  columns: Column[];
  rows: any[] | undefined;
  pageSize: number;
  loading: boolean;
  loadMorePromise?: (() => Promise<void>);
  enablePageForward?: boolean;
}
const props = withDefaults(defineProps<Props>(), {});

const pageCurrent = ref(1);
// const pageSize = 10;
const pageData = computed( () => {
  if (!props.rows)
    return [];
  const startIndex = (pageCurrent.value - 1) * props.pageSize;
  const endIndex = startIndex + props.pageSize;
  return props.rows.slice(startIndex, endIndex);
});
const pageTotal = computed(() => {
  if (!props.rows)
    return 0;
  return Math.ceil(props.rows.length / props.pageSize)
});
async function nextPage()
{
  if (!props.rows)
    return;

  if(!props.loadMorePromise)
  {
    if(pageCurrent.value < pageTotal.value)
    {
      pageCurrent.value++;
      return;
    }
  }
  else
  {
    if(pageCurrent.value < pageTotal.value && ((pageCurrent.value+1)*props.pageSize) <= props.rows.length)
    {
      // console.log("next page", ((pageCurrent.value+1)*props.pageSize), props.rows.length)
      pageCurrent.value++;
      return;
    }

    if(props.enablePageForward)
      await props.loadMorePromise();

    pageCurrent.value++;
  }

}
function prevPage()
{
  if (pageCurrent.value > 1)
    pageCurrent.value--;
}

const rowGridColumnCss = computed(() => {
  return {
    gridTemplateColumns: `${props.columns.map(col => col.gridColumn).join(" ")}`
  };
});

const canPageBackward = computed(() => pageCurrent.value > 1);
const canPageForward = computed(() => {
  return pageCurrent.value < pageTotal.value;
});
</script>

<template>
  <div class="table-container">
    <div class="table">
      <div class="row row--header" :style="rowGridColumnCss">
        <div class="column" v-for="col of columns">{{ col.name }}</div>
      </div>

      <div v-if="!loading">
        <div class="row" :style="rowGridColumnCss" v-for="row of pageData">
          <template v-for="col of columns">
            <template v-if="col.type === 'string'">
              <el-tooltip :show-after="1000" :content="row[col.index]">
                <div class="column column--overflow">{{ row[col.index] }}</div>
              </el-tooltip>
            </template>
            <template v-if="col.type === 'number'">
              <div class="column">{{ humanizeNumber(row[col.index]) }}</div>
            </template>
          </template>
        </div>
      </div>
      <el-skeleton v-else :loading="true" animated class="skeleton">
        <template #template>
          <div class="row" :style="rowGridColumnCss" v-for="i in pageSize" :key="i">
            <template v-for="col of columns">
              <el-skeleton-item class="column skeleton-item"></el-skeleton-item>
            </template>
          </div>
        </template>
      </el-skeleton>
    </div>

    <div v-if="!loading && (canPageBackward || canPageForward)" class="pagination-container">
      <el-button text @click="prevPage()" size="small" :disabled="!canPageBackward"
                 class="pagination-button pagination-button--prev">&lt;</el-button>
      <el-button text @click="nextPage()" size="small" :disabled="!canPageForward"
                 class="pagination-button pagination-button--next">&gt;</el-button>
    </div>
  </div>
</template>

<style scoped>

.table-container {
  min-height: 100%;
}

.table {
  display: grid;
  align-content: start;
  width: 100%;
  min-height: 92%;
}

.row {
  display: grid;
  width: 100%;
  font-size: small;
  grid-column-gap: 10px;
  margin-top: 5px;
}

.row--header {
  font-size: small;
  font-weight: bold;
  padding-bottom: 0;
  margin-top: 10px;
}

.column {
}

.column--overflow {
  display: inline-block;
  width: 100%; /* adjust width as needed */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skeleton {
  padding-bottom: 50px;
}

.skeleton-item {
  height: 15px;
  margin: 2px 0;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin: 5px;
}

.pagination-button {
  text-align: center;
}

.pagination-button--prev {
  margin-right: 5px;
}

.pagination-button--next {
  margin-left: 5px;
}
</style>
