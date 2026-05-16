<template>
  <div class="home">
    <el-card class="import-card">
      <template #header>
        <div class="import-header">
          <el-icon class="header-icon"><DocumentAdd /></el-icon>
          <span>导入单词</span>
        </div>
      </template>
      <el-upload
        class="upload-demo"
        drag
        action="/api/import"
        :auto-upload="false"
        :on-change="handleFileChange"
        accept=".pdf"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          拖拽 PDF 文件到此处或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 PDF 文件，将解析表格中的单词数据
          </div>
        </template>
      </el-upload>
      <el-button type="primary" @click="handleImport" :loading="importing" style="margin-top: 16px;">
        <el-icon style="margin-right: 6px;"><Upload /></el-icon>
        导入单词
      </el-button>
    </el-card>

    <el-card class="word-list-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-icon class="header-icon"><Notebook /></el-icon>
            <span>单词列表</span>
            <el-tag type="info" size="small" style="margin-left: 12px;">共 {{ total }} 个</el-tag>
          </div>
          <div class="search-bar">
            <el-input
              v-model="searchText"
              placeholder="搜索中英文..."
              style="width: 220px;"
              clearable
              @keyup.enter="loadWords"
              @clear="loadWords"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button type="primary" @click="loadWords">
              <el-icon><Search /></el-icon>
            </el-button>
            <el-divider direction="vertical" />
            <el-button @click="toggleAllChinese">
              <el-icon><View /></el-icon>
              {{ allChineseHidden ? '显示中文' : '隐藏中文' }}
            </el-button>
            <el-button @click="toggleAllEnglish">
              <el-icon><Hide /></el-icon>
              {{ allEnglishHidden ? '显示英文' : '隐藏英文' }}
            </el-button>
            <el-button type="success" @click="goToPractice">
              <el-icon style="margin-right: 6px;"><Edit /></el-icon>
              随手拼
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="words" style="width: 100%" stripe>
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column label="英文" min-width="180">
          <template #default="{ row }">
            <span v-if="!hiddenEnglish.has(row.id)" class="word-text">{{ row.english }}</span>
            <span v-else class="hidden-text">****</span>
          </template>
        </el-table-column>
        <el-table-column label="词性" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.part_of_speech }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="中文" min-width="200">
          <template #default="{ row }">
            <span v-if="!hiddenChinese.has(row.id)">{{ row.chinese }}</span>
            <span v-else class="hidden-text">****</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center">
          <template #default="{ row }">
            <el-button size="small" @click="toggleChinese(row.id)" text>
              {{ hiddenChinese.has(row.id) ? '显示中文' : '隐藏中文' }}
            </el-button>
            <el-button size="small" @click="toggleEnglish(row.id)" text>
              {{ hiddenEnglish.has(row.id) ? '显示英文' : '隐藏英文' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadWords"
          @current-change="loadWords"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Search, View, Hide, Edit, Upload, DocumentAdd, Notebook } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { wordApi, type Word } from '../api'

const router = useRouter()

const searchText = ref('')
const words = ref<Word[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const importing = ref(false)
const selectedFile = ref<File | null>(null)

const hiddenChinese = ref<Set<number>>(new Set())
const hiddenEnglish = ref<Set<number>>(new Set())
const allChineseHidden = ref(false)
const allEnglishHidden = ref(false)

const loadWords = async () => {
  try {
    const res = await wordApi.getWords(currentPage.value, pageSize.value, searchText.value)
    words.value = res.data.words
    total.value = res.data.total
  } catch (error) {
    ElMessage.error('加载单词失败')
  }
}

const handleFileChange = (file: any) => {
  selectedFile.value = file.raw
  
  // 检测大文件，提示用户
  if (file.size > 1024 * 1024) { // 大于1MB
    ElMessage.warning({
      message: '文件较大，解析和导入可能需要一些时间，请耐心等待...',
      duration: 5000
    })
  }
}

const handleImport = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }
  
  // 再次提示大文件
  if (selectedFile.value.size > 1024 * 1024) {
    ElMessage.info('正在解析文件，请稍候...')
  }
  
  importing.value = true
  try {
    const res = await wordApi.importFile(selectedFile.value)
    ElMessage.success(`成功导入 ${res.data.count} 个单词`)
    loadWords()
  } catch (error) {
    ElMessage.error('导入失败，请检查文件格式是否正确')
  } finally {
    importing.value = false
  }
}

const toggleChinese = (id: number) => {
  if (hiddenChinese.value.has(id)) {
    hiddenChinese.value.delete(id)
  } else {
    hiddenChinese.value.add(id)
  }
}

const toggleEnglish = (id: number) => {
  if (hiddenEnglish.value.has(id)) {
    hiddenEnglish.value.delete(id)
  } else {
    hiddenEnglish.value.add(id)
  }
}

const toggleAllChinese = () => {
  allChineseHidden.value = !allChineseHidden.value
  if (allChineseHidden.value) {
    words.value.forEach(w => hiddenChinese.value.add(w.id))
  } else {
    hiddenChinese.value.clear()
  }
}

const toggleAllEnglish = () => {
  allEnglishHidden.value = !allEnglishHidden.value
  if (allEnglishHidden.value) {
    words.value.forEach(w => hiddenEnglish.value.add(w.id))
  } else {
    hiddenEnglish.value.clear()
  }
}

const goToPractice = () => {
  router.push('/practice')
}

onMounted(() => {
  loadWords()
})
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
}

.import-card {
  margin-bottom: 24px;
}

.import-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 20px;
  color: #667eea;
}

.word-list-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.word-text {
  font-weight: 500;
  color: #303133;
}

.hidden-text {
  color: #c0c4cc;
  letter-spacing: 2px;
}

.pagination-wrapper {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-upload-dragger) {
  border-radius: 10px;
  border: 2px dashed #dcdfe6;
  transition: all 0.3s ease;
}

:deep(.el-upload-dragger:hover) {
  border-color: #667eea;
}

:deep(.el-icon--upload) {
  color: #667eea;
}

@media (max-width: 768px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-left {
    width: 100%;
  }
  
  .search-bar {
    width: 100%;
  }
  
  .search-bar .el-input {
    flex: 1;
    min-width: 0;
  }
  
  .word-list-card :deep(.el-table) {
    font-size: 13px;
  }
  
  .word-list-card :deep(.el-button) {
    padding: 6px 10px;
    font-size: 12px;
  }
  
  .pagination-wrapper {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .word-list-card :deep(.el-button) {
    padding: 5px 8px;
    font-size: 11px;
  }
  
  .word-list-card :deep(.el-table-column) {
    min-width: 60px;
  }
  
  .search-bar {
    gap: 6px;
  }
}
</style>
