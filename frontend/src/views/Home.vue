<template>
  <div class="home">
    <el-card class="import-card">
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
      <el-button type="primary" @click="handleImport" :loading="importing" style="margin-top: 10px;">
        导入单词
      </el-button>
    </el-card>

    <el-card class="word-list-card">
      <template #header>
        <div class="card-header">
          <span>单词列表</span>
          <div>
            <el-input
              v-model="searchText"
              placeholder="搜索中英文"
              style="width: 200px; margin-right: 10px;"
              @keyup.enter="loadWords"
            />
            <el-button @click="loadWords">搜索</el-button>
            <el-button @click="toggleAllChinese" style="margin-left: 10px;">
              {{ allChineseHidden ? '显示全部中文' : '隐藏全部中文' }}
            </el-button>
            <el-button @click="toggleAllEnglish">
              {{ allEnglishHidden ? '显示全部英文' : '隐藏全部英文' }}
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="words" style="width: 100%">
        <el-table-column type="index" label="序号" width="80" />
        <el-table-column label="英文" width="200">
          <template #default="{ row }">
            <span v-if="!hiddenEnglish.has(row.id)">{{ row.english }}</span>
            <span v-else style="color: #909399;">****</span>
          </template>
        </el-table-column>
        <el-table-column label="词性" width="120">
          <template #default="{ row }">{{ row.part_of_speech }}</template>
        </el-table-column>
        <el-table-column label="中文">
          <template #default="{ row }">
            <span v-if="!hiddenChinese.has(row.id)">{{ row.chinese }}</span>
            <span v-else style="color: #909399;">****</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250">
          <template #default="{ row }">
            <el-button size="small" @click="toggleChinese(row.id)">
              {{ hiddenChinese.has(row.id) ? '显示中文' : '隐藏中文' }}
            </el-button>
            <el-button size="small" @click="toggleEnglish(row.id)">
              {{ hiddenEnglish.has(row.id) ? '显示英文' : '隐藏英文' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadWords"
        @current-change="loadWords"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { wordApi, type Word } from '../api'

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
}

const handleImport = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }
  importing.value = true
  try {
    const res = await wordApi.importFile(selectedFile.value)
    ElMessage.success(`成功导入 ${res.data.count} 个单词`)
    loadWords()
  } catch (error) {
    ElMessage.error('导入失败')
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
  margin-bottom: 20px;
}

.word-list-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
