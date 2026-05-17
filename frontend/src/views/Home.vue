<template>
  <div class="home">
    <el-card class="word-list-card">
      <template #header>
        <div class="card-header">
          <div class="header-top">
            <div class="header-left">
              <el-icon class="header-icon"><Notebook /></el-icon>
              <span>单词列表</span>
              <el-tag type="info" size="small" style="margin-left: 12px;">共 {{ total }} 个</el-tag>
            </div>
            <div class="header-actions">
              <div class="action-buttons">
                <el-button type="warning" @click="reclassifyWords" :loading="classifying" size="small">
                  <el-icon><Refresh /></el-icon>
                  重新分类
                </el-button>
                <el-button type="primary" @click="showUploadDialog" size="small">
                  <el-icon><Upload /></el-icon>
                  导入
                </el-button>
              </div>
            </div>
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

      <el-table 
        :data="tableData" 
        style="width: 100%" 
        stripe
        row-key="id"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        v-loading="loading"
      >
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column label="英文" min-width="180">
          <template #default="{ row }">
            <template v-if="row.type === 'group'">
              <el-tag size="small" type="warning">{{ row.title }}</el-tag>
            </template>
            <template v-else-if="row.id">
              <span v-if="!hiddenEnglish.has(row.id)" class="word-text">{{ row.english }}</span>
              <span v-else class="hidden-text">****</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="词性" width="100" align="left">
          <template #default="{ row }">
            <el-tag v-if="row.part_of_speech && row.type !== 'group'" size="small" type="info">{{ row.part_of_speech }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="中文" min-width="200">
          <template #default="{ row }">
            <template v-if="row.type !== 'group' && row.id">
              <span v-if="!hiddenChinese.has(row.id)">{{ row.chinese }}</span>
              <span v-else class="hidden-text">****</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" align="center">
          <template #default="{ row }">
            <template v-if="row.type !== 'group' && row.id">
              <div class="action-buttons-row">
                <el-button size="small" @click="toggleChinese(row.id)" text>
                  {{ hiddenChinese.has(row.id) ? '显示' : '隐藏' }}中文
                </el-button>
                <el-button size="small" @click="toggleEnglish(row.id)" text>
                  {{ hiddenEnglish.has(row.id) ? '显示' : '隐藏' }}英文
                </el-button>
                <el-button size="small" type="warning" @click="resetWordClassification(row.id)" text>
                  重新分类
                </el-button>
                <el-button size="small" type="primary" @click="showManualClassification(row.id)" text>
                  手动分类
                </el-button>
              </div>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadWords"
          @current-change="loadWords"
        />
      </div>
    </el-card>

    <!-- 手动分类对话框 -->
    <el-dialog
      v-model="manualClassificationDialogVisible"
      title="手动分类"
      width="800px"
      class="manual-classification-dialog"
    >
      <div class="manual-classification-content">
        <div class="current-word-section">
          <h4>当前单词</h4>
          <div v-if="currentWordData" class="current-word-card">
            <span class="word-name">{{ currentWordData.english }}</span>
            <el-tag size="small" type="info">{{ currentWordData.part_of_speech }}</el-tag>
            <span class="word-meaning">{{ currentWordData.chinese }}</span>
          </div>
        </div>

        <div class="relations-section">
          <h4>当前分类关系</h4>
          <div v-if="currentWordData && currentWordData.children && currentWordData.children.length > 0">
            <el-tree
              :data="currentWordData.children"
              :props="{ children: 'children', label: 'english' }"
              default-expand-all
            >
              <template #default="{ node, data }">
                <div class="tree-item">
                  <span>{{ data.english }}</span>
                  <el-tag v-if="data.type === 'group'" size="small" type="warning">{{ data.title }}</el-tag>
                  <el-button 
                    v-if="data.id" 
                    size="small" 
                    type="danger" 
                    text 
                    @click="removeRelation(data.relationId)"
                  >
                    删除
                  </el-button>
                </div>
              </template>
            </el-tree>
          </div>
          <div v-else class="empty-state">
            暂无分类关系
          </div>
        </div>

        <div class="add-section">
          <h4>添加到根词</h4>
          <div class="search-box">
            <el-input 
              v-model="manualSearchText" 
              placeholder="搜索根词"
              @input="() => {}"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </div>
          <div class="word-list">
            <div 
              v-for="word in availableWords.filter(w => 
                !manualSearchText || w.english.toLowerCase().includes(manualSearchText.toLowerCase())
              ).slice(0, 10)" 
              :key="word.id"
              class="word-item"
              @click="addToRootWord(word.id)"
            >
              <span class="word-label">{{ word.english }}</span>
              <span class="word-pos">{{ word.part_of_speech }}</span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeManualClassification">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 上传对话框 -->
    <el-dialog
      v-model="uploadDialogVisible"
      title="导入单词"
      width="520px"
      class="upload-dialog"
    >
      <div class="upload-content">
        <el-upload
          class="upload-area"
          drag
          action="/api/import"
          :auto-upload="false"
          :on-change="handleFileChange"
          accept=".pdf"
          ref="uploadRef"
        >
          <div class="upload-icon">
            <el-icon :size="48"><DocumentAdd /></el-icon>
          </div>
          <div class="upload-text">
            拖拽 PDF 文件到此处或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="upload-tip">
              支持 PDF 文件，将解析表格中的单词数据
            </div>
          </template>
        </el-upload>

        <div v-if="selectedFile" class="file-info">
          <el-icon><Document /></el-icon>
          <span>{{ selectedFile.name }}</span>
          <el-tag size="small" type="info" style="margin-left: 8px;">
            {{ formatFileSize(selectedFile.size) }}
          </el-tag>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="uploadDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleImport" :loading="importing">
            <el-icon style="margin-right: 6px;"><Upload /></el-icon>
            开始导入
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Search, View, Hide, Edit, Upload, 
  DocumentAdd, Notebook, Document, Refresh 
} from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { wordApi, type Word } from '../api'

const router = useRouter()

const searchText = ref('')
const words = ref<Word[]>([])
const tableData = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const importing = ref(false)
const selectedFile = ref<File | null>(null)
const uploadDialogVisible = ref(false)
const uploadRef = ref()

const hiddenChinese = ref<Set<number>>(new Set())
const hiddenEnglish = ref<Set<number>>(new Set())
const allChineseHidden = ref(false)
const allEnglishHidden = ref(false)
const classifying = ref(false)
const loading = ref(false)

const loadWords = async () => {
  loading.value = true
  try {
    const res = await wordApi.getWordsTree(searchText.value)
    tableData.value = res.data.words
    total.value = res.data.total
    words.value = flattenTreeData(res.data.words)
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const flattenTreeData = (tree: any[]): Word[] => {
  const result: Word[] = []
  const flatten = (nodes: any[]) => {
    for (const node of nodes) {
      if (node.id && node.type !== 'group') {
        result.push(node as Word)
      }
      if (node.children && node.children.length > 0) {
        flatten(node.children)
      }
    }
  }
  flatten(tree)
  return result
}

const showUploadDialog = () => {
  uploadDialogVisible.value = true
  selectedFile.value = null
}

const handleFileChange = (file: any) => {
  selectedFile.value = file.raw
  
  if (file.size > 1024 * 1024) {
    ElMessage.warning({
      message: '文件较大，解析和导入可能需要一些时间，请耐心等待...',
      duration: 5000
    })
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const handleImport = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }
  
  if (selectedFile.value.size > 1024 * 1024) {
    ElMessage.info('正在解析文件，请稍候...')
  }
  
  importing.value = true
  try {
    const res = await wordApi.importFile(selectedFile.value)
    ElMessage.success(`成功导入 ${res.data.count} 个单词`)
    uploadDialogVisible.value = false
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

const toggleAllChineseSimple = () => {
  allChineseHidden.value = !allChineseHidden.value
  if (allChineseHidden.value) {
    tableData.value.forEach(w => {
      if (w.id && w.type !== 'group') {
        hiddenChinese.value.add(w.id)
      }
    })
  } else {
    hiddenChinese.value.clear()
  }
}

const goToPractice = () => {
  router.push('/practice')
}

const reclassifyWords = async () => {
  try {
    classifying.value = true
    const res = await wordApi.classifyAll(false)
    ElMessage.success(`成功分类 ${res.data.classified} 个单词`)
    loadWords()
  } catch (error) {
    ElMessage.error('分类失败')
  } finally {
    classifying.value = false
  }
}

const manualClassificationDialogVisible = ref(false)
const currentWordId = ref(0)
const currentWordData = ref<any>(null)
const manualSearchText = ref('')
const availableWords = ref<any[]>([])

const showManualClassification = async (wordId: number) => {
  currentWordId.value = wordId
  manualClassificationDialogVisible.value = true
  await loadCurrentWordData(wordId)
}

const loadCurrentWordData = async (wordId: number) => {
  try {
    const res = await wordApi.getWordsTree('')
    currentWordData.value = findWordInTree(res.data.words, wordId)
    
    const allWordsRes = await wordApi.getWords(1, 10000)
    availableWords.value = allWordsRes.data.words.filter(w => w.id !== wordId)
  } catch (error) {
    ElMessage.error('加载数据失败')
  }
}

const findWordInTree = (tree: any[], wordId: number): any => {
  for (const node of tree) {
    if (node.id === wordId) {
      return node
    }
    if (node.children && node.children.length > 0) {
      const found = findWordInTree(node.children, wordId)
      if (found) return found
    }
  }
  return null
}

const addToRootWord = async (rootWordId: number) => {
  try {
    await wordApi.addRelation(rootWordId, currentWordId.value, 'derivative')
    ElMessage.success('添加成功')
    await loadCurrentWordData(currentWordId.value)
    loadWords()
  } catch (error) {
    ElMessage.error('添加失败')
  }
}

const removeRelation = async (relationId: number) => {
  try {
    await wordApi.deleteRelation(relationId)
    ElMessage.success('移除成功')
    await loadCurrentWordData(currentWordId.value)
    loadWords()
  } catch (error) {
    ElMessage.error('移除失败')
  }
}

const closeManualClassification = () => {
  manualClassificationDialogVisible.value = false
  currentWordId.value = 0
  currentWordData.value = null
  manualSearchText.value = ''
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

.word-list-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 20px;
  color: #667eea;
}

.header-actions {
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

.action-buttons-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}

.pagination-wrapper {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}

.upload-content {
  padding: 20px 0;
}

.upload-area {
  width: 100%;
}

.upload-icon {
  color: #667eea;
  margin-bottom: 16px;
}

.upload-text {
  color: #606266;
  font-size: 14px;
}

.upload-text em {
  color: #667eea;
  font-style: normal;
}

.upload-tip {
  color: #909399;
  font-size: 12px;
  margin-top: 8px;
}

.file-info {
  display: flex;
  align-items: center;
  margin-top: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  font-size: 14px;
  color: #606266;
}

.file-info .el-icon {
  margin-right: 8px;
  color: #667eea;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

:deep(.upload-area .el-upload-dragger) {
  border-radius: 12px;
  border: 2px dashed #dcdfe6;
  transition: all 0.3s ease;
  padding: 40px 20px;
}

:deep(.upload-area .el-upload-dragger:hover) {
  border-color: #667eea;
  background: #f5f7fa;
}

@media (max-width: 768px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .header-left {
    width: 100%;
  }
  
  .header-actions {
    width: 100%;
    justify-content: space-between;
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

/* 手动分类对话框样式 */
.manual-classification-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.current-word-section h4,
.relations-section h4,
.add-section h4 {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.current-word-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.word-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.word-meaning {
  color: #606266;
  font-size: 14px;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: #909399;
  background: #f5f7fa;
  border-radius: 8px;
}

.search-box {
  margin-bottom: 12px;
}

.word-list {
  max-height: 200px;
  overflow-y: auto;
}

.word-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.word-item:hover {
  background: #f5f7fa;
}

.word-label {
  font-weight: 500;
  color: #303133;
}

.word-pos {
  font-size: 12px;
  color: #909399;
}
</style>
