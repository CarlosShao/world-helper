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
              <el-button type="danger" @click="batchDeleteSelected" :disabled="selectedWords.length === 0" size="small">
                <el-icon><Delete /></el-icon>
                批量删除 ({{ selectedWords.length }})
              </el-button>
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
            <el-button type="primary" @click="loadWords" size="small">
              <el-icon><Search /></el-icon>
            </el-button>
            <el-divider direction="vertical" />
            <el-button @click="toggleAllChinese" size="small">
              <el-icon><View /></el-icon>
              {{ allChineseHidden ? '显示中文' : '隐藏中文' }}
            </el-button>
            <el-button @click="toggleAllEnglish" size="small">
              <el-icon><Hide /></el-icon>
              {{ allEnglishHidden ? '显示英文' : '隐藏英文' }}
            </el-button>
            <el-button type="success" @click="goToPractice" size="small">
              <el-icon style="margin-right: 4px;"><Edit /></el-icon>
              随手拼
            </el-button>
          </div>
        </div>
      </template>

      <div class="table-wrapper">
        <el-table 
          :data="tableData" 
          class="word-table"
          style="width: 100%" 
          stripe
          row-key="id"
          :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
          v-loading="loading"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="50" align="center" :selectable="checkSelectable" />
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
          <el-table-column label="词性" width="150" align="left">
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
          <el-table-column label="操作" width="470" align="center" fixed="right">
            <template #default="{ row }">
              <template v-if="row.type !== 'group' && row.id && !row.isChild">
                <div class="action-buttons-row">
                  <el-button size="mini" @click="toggleChinese(row.id)" :class="hiddenChinese.has(row.id) ? 'btn-show' : 'btn-hide'">
                    <el-icon><View /></el-icon>
                    {{ hiddenChinese.has(row.id) ? '显示中文' : '隐藏中文' }}
                  </el-button>
                  <el-button size="mini" @click="toggleEnglish(row.id)" :class="hiddenEnglish.has(row.id) ? 'btn-show' : 'btn-hide'">
                    <el-icon><Hide /></el-icon>
                    {{ hiddenEnglish.has(row.id) ? '显示英文' : '隐藏英文' }}
                  </el-button>
                  <el-button size="mini" type="warning" @click="resetWordClassification(row.id)">
                    <el-icon><Refresh /></el-icon>
                    重新分类
                  </el-button>
                  <el-button size="mini" type="primary" @click="showManualClassification(row.id)">
                    <el-icon><Edit /></el-icon>
                    手动分类
                  </el-button>
                  <el-button size="mini" type="danger" @click="deleteWord(row)">
                    <el-icon><Delete /></el-icon>
                    删除
                  </el-button>
                </div>
              </template>
            </template>
          </el-table-column>
        </el-table>
      </div>

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
          <div class="relation-type-selector">
            <span class="type-label">关系类型：</span>
            <el-radio-group v-model="selectedRelationType" size="small">
              <el-radio value="derivative">衍生词</el-radio>
              <el-radio value="phrase">短语</el-radio>
            </el-radio-group>
          </div>
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
              @click="addRelation(word.id)"
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Search, View, Hide, Edit, Upload, 
  DocumentAdd, Notebook, Document, Refresh,
  Delete
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

const manualClassificationDialogVisible = ref(false)
const currentWordId = ref(0)
const currentWordData = ref<any>(null)
const manualSearchText = ref('')
const availableWords = ref<any[]>([])
const selectedRelationType = ref('derivative')
const selectedWords = ref<any[]>([])

const checkSelectable = (row: any) => {
  return row.type !== 'group' && row.id && !row.isChild
}

const handleSelectionChange = (selection: any[]) => {
  selectedWords.value = selection
}

const batchDeleteSelected = async () => {
  if (selectedWords.value.length === 0) {
    ElMessage.warning('请先选择要删除的单词')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedWords.value.length} 个单词吗？`,
      '批量删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    loading.value = true
    const wordIds = selectedWords.value.map(w => w.id)
    await wordApi.batchDeleteWords(wordIds)
    ElMessage.success(`成功删除 ${wordIds.length} 个单词`)
    selectedWords.value = []
    await loadWords()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败')
    }
  } finally {
    loading.value = false
  }
}

const loadWords = async () => {
  loading.value = true
  try {
    const res = await wordApi.getWords(currentPage.value, pageSize.value, searchText.value)
    const flatWords = res.data.words
    
    const treeRes = await wordApi.getWordsTree(searchText.value)
    
    const treeMap = new Map<number, any>()
    const buildTreeMap = (nodes: any[], parentId: number | null = null) => {
      for (const node of nodes) {
        if (node.id && node.type !== 'group') {
          treeMap.set(node.id, {
            hasChildren: node.children && node.children.length > 0,
            children: node.children,
            parentId
          })
        }
        if (node.children && node.children.length > 0) {
          buildTreeMap(node.children, node.id)
        }
      }
    }
    buildTreeMap(treeRes.data.words)
    
    const result: any[] = []
    for (const word of flatWords) {
      const treeInfo = treeMap.get(word.id)
      const children = treeInfo?.children || []
      
      const processedChildren = children.map((child: any) => {
        if (child.type === 'group') {
          return {
            ...child,
            children: child.children.map((c: any) => ({
              ...c,
              isChild: true
            }))
          }
        }
        return {
          ...child,
          isChild: true
        }
      })
      
      result.push({
        ...word,
        hasChildren: processedChildren.length > 0,
        children: processedChildren,
        isChild: treeInfo?.parentId !== null
      })
    }
    
    tableData.value = result
    total.value = res.data.total
    words.value = flatWords
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
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
    currentPage.value = 1
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

const reclassifyWords = async () => {
  loading.value = true
  try {
    classifying.value = true
    const res = await wordApi.classifyAll(false)
    ElMessage.success(`成功分类 ${res.data.classified} 个单词`)
    await loadWords()
  } catch (error) {
    ElMessage.error('分类失败')
  } finally {
    classifying.value = false
    loading.value = false
  }
}

const resetWordClassification = async (wordId: number) => {
  loading.value = true
  try {
    await wordApi.resetWordClassification(wordId)
    ElMessage.success('重置分类成功')
    await loadWords()
  } catch (error) {
    ElMessage.error('重置分类失败')
  } finally {
    loading.value = false
  }
}

const deleteWord = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除单词 "${row.english}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    loading.value = true
    await wordApi.deleteWord(row.id)
    ElMessage.success('删除成功')
    await loadWords()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  } finally {
    loading.value = false
  }
}

const showManualClassification = async (wordId: number) => {
  currentWordId.value = wordId
  manualClassificationDialogVisible.value = true
  await loadCurrentWordData(wordId)
}

const loadCurrentWordData = async (wordId: number) => {
  try {
    const res = await wordApi.getWordRelations(wordId)
    currentWordData.value = res.data
    
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

const addRelation = async (childWordId: number) => {
  try {
    await wordApi.addRelation(currentWordId.value, childWordId, selectedRelationType.value)
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
  selectedRelationType.value = 'derivative'
}

onMounted(() => {
  loadWords()
})
</script>

<style scoped>
.home {
  max-width: 95%;
  margin: 0 auto;
  min-width: 1200px;
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

.header-actions .el-button {
  padding: 6px 16px;
  font-size: 13px;
}

.search-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.search-bar .el-button {
  padding: 6px 14px;
  font-size: 13px;
}

.word-text {
  font-weight: 500;
  color: #303133;
}

.hidden-text {
  color: #c0c4cc;
  letter-spacing: 2px;
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.word-table {
  min-width: 100%;
}

/* 操作栏固定列的样式优化 */
.word-table :deep(.el-table__fixed-right) {
  box-shadow: -4px 0 6px rgba(0, 0, 0, 0.08);
  z-index: 10;
}

.word-table :deep(.el-table__fixed-right-patch) {
  background-color: #f7f8fa !important;
  box-shadow: -4px 0 6px rgba(0, 0, 0, 0.08);
  z-index: 10;
}

.word-table :deep(.el-table__fixed-right .el-table__header-wrapper th) {
  background-color: #f7f8fa !important;
}

/* 确保表格内容不会被操作栏挡住 */
.word-table :deep(.el-table__body-wrapper) {
  overflow-x: auto;
}

/* 操作栏内边距优化 */
.word-table :deep(.el-table__fixed-right .cell) {
  padding-right: 0;
}

.action-buttons-row {
  display: flex;
  gap: 6px;
  justify-content: center;
  align-items: center;
}

.action-buttons-row .el-button {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
}

.action-buttons-row .btn-hide {
  background: #f5f7fa;
  color: #606266;
  border-color: #dcdfe6;
}

.action-buttons-row .btn-show {
  background: #fff;
  color: #667eea;
  border-color: #667eea;
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
    padding: 4px 8px;
    font-size: 11px;
  }
  
  .pagination-wrapper {
    justify-content: center;
  }
  
  .action-buttons-row {
    flex-wrap: wrap;
    gap: 2px;
  }
}

@media (max-width: 480px) {
  .word-list-card :deep(.el-button) {
    padding: 3px 6px;
    font-size: 10px;
  }
  
  .word-list-card :deep(.el-table-column) {
    min-width: 60px;
  }
  
  .search-bar {
    gap: 4px;
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

.relation-type-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.type-label {
  font-size: 14px;
  color: #606266;
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
