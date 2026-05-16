<template>
  <el-container class="app-container">
    <el-header>
      <el-menu :default-active="activeMenu" mode="horizontal" router>
        <el-menu-item index="/">首页</el-menu-item>
        <el-menu-item index="/error-words">错题集</el-menu-item>
        <el-menu-item index="/yesterday-errors">昨日错词巩固</el-menu-item>
      </el-menu>
    </el-header>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  min-height: 100vh;
}

.el-header {
  background-color: #409eff;
  padding: 0;
  height: auto;
}

.el-menu {
  border-bottom: none;
}

.el-main {
  padding: 20px;
}

@media (max-width: 768px) {
  .el-main {
    padding: 10px;
  }
  
  .el-menu-item {
    padding: 0 10px;
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .el-menu-item {
    padding: 0 8px;
    font-size: 13px;
  }
}
</style>
