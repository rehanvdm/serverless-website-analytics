<template>
  <div class="not-found">
    <div class="content">
      <h1>404 - Page not found</h1>
      <p>Oops! You seem lost.</p>
      <router-link to="/" >
        <el-button type="primary" size="large" style="font-size: larger">Go Home</el-button>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">

</script>

<style scoped>
.not-found {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.content {
  width: 700px;
  text-align: center;
  padding: 20px 20px 50px 20px;
  border-radius: 10px;
  box-shadow: var(--el-box-shadow-lighter);
}

h1 {
  font-size: xxx-large;
}

p {
  font-size: xx-large;
}
</style>
