<template>
  <div class="practice">
    <el-card v-if="!currentWord" class="start-card">
      <div class="start-content">
        <h2>随手拼练习</h2>
        <p>根据中文提示拼写英文单词</p>
        <el-button type="primary" size="large" @click="startPractice">开始练习</el-button>
      </div>
    </el-card>

    <el-card v-else class="practice-card">
      <div class="progress">
        <span>进度: {{ currentIndex + 1 }} / {{ words.length }}</span>
        <el-button @click="saveProgress">保存进度</el-button>
      </div>

      <div class="word-display">
        <h3 class="chinese">{{ currentWord.chinese }}</h3>
        <p class="part-of-speech">{{ currentWord.part_of_speech }}</p>
      </div>

      <el-form @submit.prevent="checkAnswer">
        <el-form-item>
          <el-input
            v-model="userAnswer"
            placeholder="请输入英文单词"
            size="large"
            ref="inputRef"
            @keyup.enter="checkAnswer"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" @click="checkAnswer" :loading="checking">
            提交
          </el-button>
          <el-button size="large" @click="showAnswer">显示答案</el-button>
          <el-button size="large" @click="skipWord">跳过</el-button>
        </el-form-item>
      </el-form>

      <div v-if="showResult" class="result" :class="{ correct: isCorrect, wrong: !isCorrect }">
        <el-icon v-if="isCorrect"><SuccessFilled /></el-icon>
        <el-icon v-else><WarningFilled /></el-icon>
        <span>{{ isCorrect ? '正确！' : '错误！' }}</span>
        <p v-if="!isCorrect">正确答案: {{ currentWord.english }}</p>
        <el-button v-if="!isCorrect" type="primary" @click="tryAgain" style="margin-top: 10px;">
          再试一次
        </el-button>
        <el-button v-else type="primary" @click="nextWord" style="margin-top: 10px;">
          下一个
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { SuccessFilled, WarningFilled } from '@element-plus/icons-vue'
import { wordApi, type Word } from '../api'

const router = useRouter()
const words = ref<Word[]>([])
const currentIndex = ref(0)
const currentWord = ref<Word | null>(null)
const userAnswer = ref('')
const showResult = ref(false)
const isCorrect = ref(false)
const checking = ref(false)
const inputRef = ref()
const sessionId = ref<number | null>(null)

const loadWords = async () => {
  try {
    const res = await wordApi.getWords(1, 1000)
    words.value = res.data.words
  } catch (error) {
    ElMessage.error('加载单词失败')
  }
}

const loadProgress = async () => {
  try {
    const res = await wordApi.getSetting('practiceIndex')
    if (res.data.value !== null) {
      currentIndex.value = parseInt(res.data.value)
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

const startPractice = async () => {
  // 开始新的练习会话
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
  await loadProgress()
  if (currentIndex.value >= words.value.length) {
    currentIndex.value = 0
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
    // 添加到错题集
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
    if (currentIndex.value >= words.value.length) {
      currentIndex.value = 0
      ElMessage.success('恭喜完成一轮练习！')
      // 完成练习，结束会话
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

onMounted(() => {
  startPractice()
})

onBeforeUnmount(async () => {
  // 用户离开页面时，结束练习会话
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
  padding: 0 10px;
}

.start-card, .practice-card {
  text-align: center;
}

.start-content h2 {
  margin-bottom: 10px;
}

.start-content p {
  margin-bottom: 20px;
  color: #666;
}

.progress {
  display: flex;
  justify-content: space-between;
  margin-bottom: 30px;
  color: #666;
}

.word-display {
  margin-bottom: 40px;
}

.chinese {
  font-size: 32px;
  margin-bottom: 10px;
}

.part-of-speech {
  color: #909399;
  font-size: 18px;
}

.result {
  margin-top: 30px;
  padding: 20px;
  border-radius: 8px;
  font-size: 24px;
}

.result.correct {
  background-color: #f0f9eb;
  color: #67c23a;
}

.result.wrong {
  background-color: #fef0f0;
  color: #f56c6c;
}

.result p {
  font-size: 16px;
  margin-top: 10px;
}

@media (max-width: 768px) {
  .practice {
    padding: 0;
  }
  
  .chinese {
    font-size: 28px;
  }
  
  .part-of-speech {
    font-size: 16px;
  }
  
  .result {
    font-size: 20px;
  }
}

@media (max-width: 480px) {
  .chinese {
    font-size: 24px;
  }
  
  .result {
    font-size: 18px;
    padding: 15px;
  }
  
  .result p {
    font-size: 14px;
  }
}
</style>
