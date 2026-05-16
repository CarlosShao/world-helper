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

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  min-height: 100vh;
}

.app-container {
  min-height: 100vh;
}

.el-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 0;
  height: auto;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.el-menu {
  border-bottom: none;
  background: transparent;
}

.el-menu--horizontal > .el-menu-item {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  font-size: 15px;
  transition: all 0.3s ease;
}

.el-menu--horizontal > .el-menu-item:hover {
  background-color: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.el-menu--horizontal > .el-menu-item.is-active {
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  border-bottom: 2px solid #fff;
}

.el-main {
  padding: 30px 20px;
  background: transparent;
}

.el-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.el-card:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

.el-card__header {
  border-bottom: 1px solid #f0f2f5;
  padding: 18px 24px;
  font-weight: 600;
  font-size: 16px;
  color: #303133;
}

.el-card__body {
  padding: 24px;
}

.el-button--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition: all 0.3s ease;
}

.el-button--primary:hover {
  background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.el-button--success {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  border: none;
}

.el-button--success:hover {
  background: linear-gradient(135deg, #0f8a7f 0%, #32d971 100%);
  transform: translateY(-1px);
}

.el-button {
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.el-button:hover {
  transform: translateY(-1px);
}

.el-input__wrapper {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
}

.el-input__wrapper:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.el-input__wrapper.is-focus {
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.el-table {
  border-radius: 8px;
  overflow: hidden;
}

.el-table th.el-table__cell {
  background-color: #f8f9fb;
  font-weight: 600;
  color: #606266;
}

.el-table--enable-row-hover .el-table__body tr:hover > td.el-table__cell {
  background-color: #f5f7fa;
}

.el-pagination {
  margin-top: 24px;
}

.el-pagination button, .el-pagination .el-pager li {
  border-radius: 6px;
  margin: 0 3px;
}

.el-pagination .el-pager li.is-active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.el-dialog {
  border-radius: 16px;
}

.el-dialog__header {
  border-radius: 16px 16px 0 0;
}

.el-message {
  border-radius: 10px;
}

@media (max-width: 768px) {
  .el-main {
    padding: 15px 10px;
  }
  
  .el-menu-item {
    padding: 0 12px;
    font-size: 14px;
  }
  
  .el-card__header {
    padding: 14px 16px;
  }
  
  .el-card__body {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .el-menu-item {
    padding: 0 8px;
    font-size: 13px;
  }
}
</style>
