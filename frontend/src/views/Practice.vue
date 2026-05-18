<template>
  <div class="practice">
    <el-card v-if="!currentWord" class="start-card">
      <div class="start-content">
        <div class="icon-wrapper">
          <el-icon class="practice-icon"><EditPen /></el-icon>
        </div>
        <h2>随手拼练习</h2>
        <p>根据中文提示拼写英文单词，提升记忆效果</p>
        <div class="start-buttons">
          <el-button type="primary" size="large" @click="startPractice" class="start-btn">
            <el-icon style="margin-right: 8px;"><CaretRight /></el-icon>
            开始练习
          </el-button>
          <el-button size="large" @click="clearProgress" class="clear-btn">
            <el-icon style="margin-right: 8px;"><Delete /></el-icon>
            清除进度
          </el-button>
        </div>
        <div v-if="savedIndex > 0" class="progress-hint">
          <el-icon><Timer /></el-icon>
          <span>上次练习到第 {{ savedIndex + 1 }} 个单词</span>
        </div>
      </div>
    </el-card>

    <el-card v-else class="practice-card">
      <div class="progress-bar">
        <div class="progress-info">
          <span class="progress-text">进度</span>
          <span class="progress-count">{{ getProgressText() }}</span>
        </div>
        <el-progress 
          :percentage="Math.round((currentIndex / words.length) * 100)" 
          :show-text="false"
          :stroke-width="8"
          class="progress-line"
        />
        <div class="progress-actions">
          <el-button @click="saveProgress" size="small" text>
            <el-icon><FolderChecked /></el-icon>
            保存进度
          </el-button>
          <el-button @click="clearProgress" size="small" text>
            <el-icon><Delete /></el-icon>
            清除进度
          </el-button>
          <el-button @click="goBack" size="small" text :disabled="currentIndex === 0">
            <el-icon><ArrowLeft /></el-icon>
            上一个
          </el-button>
          <el-button @click="goHome" size="small" text>
            <el-icon><HomeFilled /></el-icon>
            返回首页
          </el-button>
        </div>
      </div>

      <div class="word-display">
        <div class="word-label">中文释义</div>
        <h3 class="chinese">{{ currentWord.chinese }}</h3>
        <el-tag size="small" type="info" class="pos-tag">{{ currentWord.part_of_speech }}</el-tag>
      </div>

      <el-form @submit.prevent="checkAnswer" class="answer-form">
        <el-form-item>
          <el-input
            v-model="userAnswer"
            placeholder="请输入英文单词..."
            size="large"
            ref="inputRef"
            @keyup.enter="checkAnswer"
            class="answer-input"
          >
            <template #prefix>
              <el-icon><Edit /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item class="btn-group">
          <el-button type="primary" size="large" @click="checkAnswer" :loading="checking">
            <el-icon style="margin-right: 6px;"><Check /></el-icon>
            提交
          </el-button>
          <el-button size="large" @click="showAnswer">
            <el-icon><View /></el-icon>
            显示答案
          </el-button>
          <el-button size="large" @click="skipWord">
            <el-icon><ArrowRight /></el-icon>
            跳过
          </el-button>
        </el-form-item>
      </el-form>

      <transition name="fade">
        <div v-if="showResult" class="result" :class="{ correct: isCorrect, wrong: !isCorrect }">
          <div class="result-icon">
            <el-icon v-if="isCorrect" :size="48"><CircleCheckFilled /></el-icon>
            <el-icon v-else :size="48"><CircleCloseFilled /></el-icon>
          </div>
          <span class="result-text">{{ isCorrect ? '回答正确！' : '回答错误' }}</span>
          <p v-if="!isCorrect" class="correct-answer">正确答案: <strong>{{ currentWord.english }}</strong></p>
          <el-button v-if="!isCorrect" type="primary" @click="tryAgain" class="result-btn">
            <el-icon style="margin-right: 6px;"><Refresh /></el-icon>
            再试一次
          </el-button>
          <el-button v-else type="success" @click="nextWord" class="result-btn">
            <el-icon style="margin-right: 6px;"><ArrowRight /></el-icon>
            下一个
          </el-button>
        </div>
      </transition>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  EditPen, CaretRight, FolderChecked, Edit, Check, View, ArrowRight, 
  CircleCheckFilled, CircleCloseFilled, Refresh, Delete, Timer, ArrowLeft, HomeFilled
} from '@element-plus/icons-vue'
import { wordApi, type Word } from '../api'

const router = useRouter()
import { useRoute } from 'vue-router'

const route = useRoute()
const words = ref<Word[]>([])
const currentIndex = ref(0)
const savedIndex = ref(0)
const currentWord = ref<Word | null>(null)
const userAnswer = ref('')
const showResult = ref(false)
const isCorrect = ref(false)
const checking = ref(false)
const inputRef = ref()
const sessionId = ref<number | null>(null)

const fromIndex = ref<number | null>(null)
const fromPage = ref<number | null>(null)
const totalWords = ref(0)

const loadWords = async () => {
  try {
    const res = await wordApi.getWords(1, 1000)
    words.value = res.data.words
    totalWords.value = res.data.total || res.data.words.length
  } catch (error) {
    ElMessage.error('加载单词失败')
  }
}

const getProgressText = () => {
  if (fromIndex.value !== null) {
    const progress = currentIndex.value - fromIndex.value + 1
    const total = totalWords.value - fromIndex.value
    return `${progress} / ${total}`
  }
  return `${currentIndex.value + 1} / ${totalWords.value}`
}

const loadProgress = async () => {
  try {
    const res = await wordApi.getSetting('practiceIndex')
    if (res.data.value !== null) {
      const index = parseInt(res.data.value)
      savedIndex.value = index
      currentIndex.value = index
    }
  } catch (error) {
    console.error('Load progress error:', error)
  }
}

const saveProgress = async () => {
  try {
    await wordApi.saveSetting('practiceIndex', currentIndex.value.toString())
    ElMessage.success('进度已保存')
  } catch (error) {
    ElMessage.error('保存进度失败')
  }
}

const autoSaveProgress = async () => {
  try {
    await wordApi.saveSetting('practiceIndex', currentIndex.value.toString())
  } catch (error) {
    console.error('Auto save progress error:', error)
  }
}

const clearProgress = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清除练习进度吗？下次将从第一个单词开始练习。',
      '清除进度',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await wordApi.saveSetting('practiceIndex', '0')
    savedIndex.value = 0
    currentIndex.value = 0
    ElMessage.success('进度已清除')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清除失败')
    }
  }
}

const startPractice = async () => {
  try {
    const res = await wordApi.startPractice()
    sessionId.value = res.data.sessionId
  } catch (error) {
    console.error('Start practice error:', error)
  }
  
  await loadWords()
  if (words.value.length === 0) {
    ElMessage.warning('请先导入单词')
    router.push('/')
    return
  }
  
  const queryFromIndex = route.query.fromIndex
  const queryFromPage = route.query.fromPage
  
  if (queryFromIndex !== undefined) {
    fromIndex.value = parseInt(queryFromIndex as string)
    currentIndex.value = fromIndex.value
    if (queryFromPage !== undefined) {
      fromPage.value = parseInt(queryFromPage as string)
    }
  } else {
    await loadProgress()
    if (currentIndex.value >= words.value.length) {
      currentIndex.value = 0
    }
  }
  
  showCurrentWord()
}

const showCurrentWord = () => {
  currentWord.value = words.value[currentIndex.value]
  userAnswer.value = ''
  showResult.value = false
  nextTick(() => {
    inputRef.value?.focus()
  })
}

const checkAnswer = async () => {
  if (!userAnswer.value.trim()) {
    ElMessage.warning('请输入答案')
    return
  }
  checking.value = true
  
  isCorrect.value = userAnswer.value.toLowerCase().trim() === currentWord.value!.english.toLowerCase().trim()
  showResult.value = true
  checking.value = false

  if (!isCorrect.value) {
    await wordApi.addErrorWord(currentWord.value!.id)
  }
}

const showAnswer = () => {
  ElMessage.info(`答案: ${currentWord.value?.english}`)
}

const skipWord = () => {
  nextWord()
}

const tryAgain = () => {
  userAnswer.value = ''
  showResult.value = false
  nextTick(() => {
    inputRef.value?.focus()
  })
}

const nextWord = async () => {
  if (isCorrect.value) {
    currentIndex.value++
    await autoSaveProgress()
    if (currentIndex.value >= words.value.length) {
      currentIndex.value = 0
      await autoSaveProgress()
      ElMessage.success('恭喜完成一轮练习！')
      if (sessionId.value) {
        try {
          await wordApi.endPractice(sessionId.value)
        } catch (error) {
          console.error('End practice error:', error)
        }
      }
    }
  }
  showCurrentWord()
}

const goBack = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    showCurrentWord()
  }
}

const goHome = () => {
  if (fromPage.value !== null) {
    router.push({ path: '/', query: { page: fromPage.value } })
  } else {
    router.push('/')
  }
}

onMounted(() => {
  startPractice()
})

onBeforeUnmount(async () => {
  if (sessionId.value) {
    try {
      await wordApi.endPractice(sessionId.value)
    } catch (error) {
      console.error('End practice error:', error)
    }
  }
})
</script>

<style scoped>
.practice {
  max-width: 600px;
  margin: 0 auto;
}

.start-card, .practice-card {
  text-align: center;
}

.start-content {
  padding: 40px 20px;
}

.icon-wrapper {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.practice-icon {
  font-size: 40px;
  color: #fff;
}

.start-content h2 {
  margin-bottom: 12px;
  font-size: 28px;
  color: #303133;
}

.start-content p {
  margin-bottom: 32px;
  color: #909399;
  font-size: 15px;
}

.start-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 24px;
}

.start-btn {
  padding: 12px 40px;
  font-size: 16px;
}

.clear-btn {
  padding: 12px 40px;
  font-size: 16px;
  background: #f5f7fa;
  color: #606266;
  border: 1px solid #dcdfe6;
}

.clear-btn:hover {
  background: #e4e7ed;
  color: #606266;
}

.progress-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fffbe6;
  border-radius: 8px;
  color: #d4a76a;
  font-size: 14px;
}

.progress-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
  padding: 16px;
  background: #f8f9fb;
  border-radius: 10px;
}

.progress-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 80px;
}

.progress-text {
  font-size: 12px;
  color: #909399;
}

.progress-count {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.progress-line {
  flex: 1;
}

.progress-actions {
  display: flex;
  gap: 8px;
}

.word-display {
  margin-bottom: 40px;
  padding: 30px;
  background: linear-gradient(135deg, #f8f9fb 0%, #f0f2f5 100%);
  border-radius: 12px;
}

.word-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.chinese {
  font-size: 36px;
  margin-bottom: 12px;
  color: #303133;
  font-weight: 600;
}

.pos-tag {
  font-size: 13px;
}

.answer-form {
  margin-bottom: 20px;
}

.answer-input {
  font-size: 16px;
}

.btn-group {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}

.result {
  margin-top: 32px;
  padding: 32px;
  border-radius: 12px;
}

.result.correct {
  background: linear-gradient(135deg, #f0f9eb 0%, #e1f3d8 100%);
}

.result.wrong {
  background: linear-gradient(135deg, #fef0f0 0%, #fde2e2 100%);
}

.result-icon {
  margin-bottom: 16px;
}

.result.correct .result-icon {
  color: #67c23a;
}

.result.wrong .result-icon {
  color: #f56c6c;
}

.result-text {
  font-size: 24px;
  font-weight: 600;
}

.result.correct .result-text {
  color: #67c23a;
}

.result.wrong .result-text {
  color: #f56c6c;
}

.correct-answer {
  font-size: 16px;
  margin-top: 12px;
  color: #606266;
}

.correct-answer strong {
  color: #303133;
}

.result-btn {
  margin-top: 20px;
  padding: 10px 30px;
}

.fade-enter-active, .fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 768px) {
  .start-content {
    padding: 30px 15px;
  }
  
  .icon-wrapper {
    width: 60px;
    height: 60px;
  }
  
  .practice-icon {
    font-size: 30px;
  }
  
  .chinese {
    font-size: 28px;
  }
  
  .word-display {
    padding: 20px;
  }
  
  .result {
    font-size: 20px;
    padding: 24px;
  }
  
  .btn-group {
    flex-wrap: wrap;
  }
  
  .progress-bar {
    flex-wrap: wrap;
  }
  
  .progress-actions {
    margin-top: 8px;
  }
}

@media (max-width: 480px) {
  .chinese {
    font-size: 24px;
  }
  
  .result {
    padding: 20px;
  }
  
  .result-text {
    font-size: 20px;
  }
  
  .correct-answer {
    font-size: 14px;
  }
  
  .progress-bar {
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .start-buttons {
    flex-direction: column;
    align-items: center;
  }
}
</style>