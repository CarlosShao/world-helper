<template>
  <div class="home">
    <el-card class="word-list-card">
      <template #header>
        <div class="card-header">
          <div class="header-top">
            <div class="header-left">
              <el-icon class="header-icon"><Notebook /></el-icon>
              <span>单词列表</span>
              <el-tag type="info" size="small" style="margin-left: 12px;">共 {{ total }} 个主词</el-tag>
            </div>
            <div class="header-actions">
              <el-button type="warning" @click="reclassifyWords" :loading="classifying">
                <el-icon><RefreshCw /></el-icon>
                重新分类
              </el-button>
              <el-button type="primary" @click="showUploadDialog">
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
              @keyup.enter="loadTree"
              @clear="loadTree"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button type="primary" @click="loadTree">
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

      <div class="tree-container">
        <div
          v-for="root in treeData"
          :key="root.id"
          class="tree-item"
        >
          <div class="root-row" @click="toggleExpand(root.id)">
            <div class="expand-icon" v-if="root.hasChildren">
              <el-icon v-if="expandedIds.has(root.id)"><ChevronDown /></el-icon>
              <el-icon v-else><ChevronRight /></el-icon>
            </div>
            <div class="expand-icon" v-else style="width: 18px;"></div>
            <div class="word-info">
              <span class="word-text" :class="{ 'root-word': true }">
                {{ allEnglishHidden ? '****' : root.english }}
              </span>
              <el-tag size="small" type="info" class="pos-tag">{{ root.part_of_speech }}</el-tag>
              <span class="chinese-text">{{ allChineseHidden ? '****' : root.chinese }}</span>
            </div>
            <div class="word-actions">
              <el-button size="small" @click.stop="toggleChinese(root.id)" text>
                {{ hiddenChinese.has(root.id) ? '显示中文' : '隐藏中文' }}
              </el-button>
              <el-button size="small" @click.stop="toggleEnglish(root.id)" text>
                {{ hiddenEnglish.has(root.id) ? '显示英文' : '隐藏英文' }}
              </el-button>
              <el-dropdown @command="(cmd) => handleCommand(cmd, root)">
                <el-button size="small" text>
                  更多 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="setRoot">设为主词</el-dropdown-item>
                    <el-dropdown-item command="addToOther">关联到其他词</el-dropdown-item>
                    <el-dropdown-item command="removeRelations">设为独立词</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <div v-if="expandedIds.has(root.id) && root.children && root.children.length > 0" class="children-container">
            <div
              v-for="category in root.children"
              :key="category.type"
              class="category-section"
            >
              <div class="category-header">
                <el-icon><Folder /></el-icon>
                <span>{{ category.title }}</span>
                <span class="count-badge">{{ category.children.length }}</span>
              </div>
              <div
                v-for="child in category.children"
                :key="child.id"
                class="child-row"
              >
                <div class="word-info child-info">
                  <span class="word-text" :class="{ [`${category.type}-word`]: true }">
                    {{ hiddenEnglish.has(child.id) ? '****' : child.english }}
                  </span>
                  <el-tag size="small" type="info" class="pos-tag">{{ child.part_of_speech }}</el-tag>
                  <span class="chinese-text">{{ hiddenChinese.has(child.id) ? '****' : child.chinese }}</span>
                </div>
                <div class="word-actions">
                  <el-button size="small" @click="toggleChinese(child.id)" text>
                    {{ hiddenChinese.has(child.id) ? '显示中文' : '隐藏中文' }}
                  </el-button>
                  <el-button size="small" @click="toggleEnglish(child.id)" text>
                    {{ hiddenEnglish.has(child.id) ? '显示英文' : '隐藏英文' }}
                  </el-button>
                  <el-dropdown @command="(cmd) => handleCommand(cmd, child)">
                    <el-button size="small" text>
                      更多 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-item command="setRoot">设为主词</el-dropdown-item>
                      <el-dropdown-item command="addToOther">关联到其他词</el-dropdown-item>
                      <el-dropdown-item command="removeRelations">设为独立词</el-dropdown-item>
                    </el-dropdown-menu>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="treeData.length === 0" class="empty-state">
        <el-icon :size="48" class="empty-icon"><BookOpen /></el-icon>
        <p>暂无单词数据</p>
        <p class="empty-hint">请先导入单词文件</p>
      </div>
    </el-card>

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
          </span>
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

    <!-- 关联到其他词对话框 -->
    <el-dialog
      v-model="relationDialogVisible"
      title="关联到其他词"
      width="480px"
    >
      <el-form>
        <el-form-item label="选择主词">
          <el-select v-model="selectedRootId" filterable placeholder="请选择主词">
            <el-option
              v-for="word in rootWords"
              :key="word.id"
              :label="`${word.english} - ${word.chinese}`"
              :value="word.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关联类型">
          <el-radio-group v-model="relationType">
            <el-radio label="derivative">衍生词</el-radio>
            <el-radio label="phrase">短语</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="relationDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmRelation">确认关联</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElConfirm } from 'element-plus'
import {
  UploadFilled, Search, View, Hide, Edit, Upload,
  DocumentAdd, Notebook, Document, RefreshCw,
  ChevronDown, ChevronRight, Folder, ArrowDown, BookOpen
} from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { wordApi } from '../api'

const router = useRouter()

const searchText = ref('')
const treeData = ref<any[]>([])
const total = ref(0)
const importing = ref(false)
const classifying = ref(false)
const selectedFile = ref<File | null>(null)
const uploadDialogVisible = ref(false)
const relationDialogVisible = ref(false)
const uploadRef = ref()

const expandedIds = ref<Set<number>>(new Set())
const hiddenChinese = ref<Set<number>>(new Set())
const hiddenEnglish = ref<Set<number>>(new Set())
const allChineseHidden = ref(false)
const allEnglishHidden = ref(false)

const rootWords = ref<any[]>([])
const selectedRootId = ref<number | null>(null)
const relationType = ref('derivative')
const currentTargetWord = ref<any>(null)

const loadTree = async () => {
  try {
    const res = await wordApi.getWordsTree(searchText.value)
    treeData.value = res.data.words
    total.value = res.data.total
    expandedIds.value.clear()
  } catch (error) {
    ElMessage.error('加载单词失败')
  }
}

const loadRootWords = async () => {
  try {
    const res = await wordApi.getRootWords()
    rootWords.value = res.data.words
  } catch (error) {
    ElMessage.error('加载主词列表失败')
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
    
    await classifyAllWords()
    
    loadTree()
  } catch (error) {
    ElMessage.error('导入失败，请检查文件格式是否正确')
  } finally {
    importing.value = false
  }
}

const classifyAllWords = async () => {
  classifying.value = true
  try {
    const res = await wordApi.classifyAll()
    ElMessage.success(`分类完成，共关联 ${res.data.classified} 个单词`)
  } catch (error) {
    ElMessage.error('分类失败')
  } finally {
    classifying.value = false
  }
}

const reclassifyWords = async () => {
  await ElConfirm('确定要重新分类所有单词吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
  
  classifying.value = true
  try {
    const res = await wordApi.classifyAll(false)
    ElMessage.success(`重新分类完成，共关联 ${res.data.classified} 个单词`)
    loadTree()
  } catch (error) {
    ElMessage.error('重新分类失败')
  } finally {
    classifying.value = false
  }
}

const toggleExpand = (id: number) => {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
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
  hiddenChinese.value.clear()
}

const toggleAllEnglish = () => {
  allEnglishHidden.value = !allEnglishHidden.value
  hiddenEnglish.value.clear()
}

const goToPractice = () => {
  router.push('/practice')
}

const handleCommand = async (cmd: string, word: any) => {
  switch (cmd) {
    case 'setRoot':
      await setAsRoot(word)
      break
    case 'addToOther':
      await addToOther(word)
      break
    case 'removeRelations':
      await removeAllRelations(word)
      break
  }
}

const setAsRoot = async (word: any) => {
  await ElConfirm(`确定要将 "${word.english}" 设为主词吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
  
  try {
    await wordApi.removeWordRelations(word.id)
    ElMessage.success('已设为主词')
    loadTree()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const addToOther = async (word: any) => {
  currentTargetWord.value = word
  selectedRootId.value = null
  relationType.value = word.english.includes(' ') ? 'phrase' : 'derivative'
  await loadRootWords()
  relationDialogVisible.value = true
}

const confirmRelation = async () => {
  if (!selectedRootId.value || !currentTargetWord.value) {
    ElMessage.warning('请选择主词')
    return
  }

  try {
    await wordApi.addRelation(selectedRootId.value, currentTargetWord.value.id, relationType.value)
    ElMessage.success('关联成功')
    relationDialogVisible.value = false
    loadTree()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '关联失败')
  }
}

const removeAllRelations = async (word: any) => {
  await ElConfirm(`确定要将 "${word.english}" 设为独立词吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
  
  try {
    await wordApi.removeWordRelations(word.id)
    ElMessage.success('已设为独立词')
    loadTree()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadTree()
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
  gap: 8px;
}

.search-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.tree-container {
  padding: 8px 0;
}

.tree-item {
  margin-bottom: 4px;
}

.root-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.root-row:hover {
  background: #f0f0f0;
}

.expand-icon {
  width: 18px;
  color: #909399;
  font-size: 14px;
}

.word-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.child-info {
  padding-left: 36px;
}

.word-text {
  font-weight: 500;
  color: #303133;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.root-word {
  font-size: 15px;
}

.derivative-word {
  color: #67c23a;
}

.phrase-word {
  color: #409eff;
}

.pos-tag {
  flex-shrink: 0;
}

.chinese-text {
  color: #606266;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.word-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.children-container {
  margin-top: 4px;
  border-left: 2px solid #e4e7ed;
  margin-left: 9px;
}

.category-section {
  margin-bottom: 8px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px 8px 24px;
  background: #f5f7fa;
  font-weight: 500;
  color: #606266;
  font-size: 14px;
}

.count-badge {
  background: #e4e7ed;
  color: #606266;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
}

.child-row {
  display: flex;
  align-items: center;
  padding: 10px 16px 10px 36px;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s ease;
}

.child-row:hover {
  background: #fafafa;
}

.empty-state {
  text-align: center;
  padding: 60px 0;
  color: #909399;
}

.empty-icon {
  margin-bottom: 16px;
  color: #c0c4cc;
}

.empty-hint {
  font-size: 14px;
  margin-top: 8px;
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

  .word-info {
    flex-wrap: wrap;
    gap: 6px;
  }

  .word-actions {
    flex-wrap: wrap;
    gap: 2px;
  }

  .word-actions .el-button {
    padding: 4px 8px;
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .root-row {
    padding: 10px 8px;
  }

  .child-row {
    padding: 8px 8px 8px 24px;
  }

  .category-header {
    padding: 6px 8px 6px 16px;
  }

  .header-actions {
    flex-wrap: wrap;
  }

  .search-bar {
    gap: 6px;
  }
}
</style>