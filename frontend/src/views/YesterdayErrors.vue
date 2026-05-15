<template>
  <div class="yesterday-errors">
    <el-card>
      <template #header>
        <span>昨日错词巩固</span>
      </template>

      <div v-if="words.length === 0">
        <el-empty description="暂无错词" />
      </div>

      <div v-else class="practice-area">
        <div v-if="currentWord" class="word-card">
          <div class="progress">
            <span>进度: {{ currentIndex + 1 }} / {{ words.length }}</span>
          </div>
          <div class="word-display">
            <h3 class="chinese">{{ currentWord.chinese }}</h3>
            <p class="part-of-speech">{{ currentWord.part_of_speech }}</p>
          </div>
          <el-input
            v-model="userAnswer"
            placeholder="请输入英文单词"
            size="large"
            @keyup.enter="checkAnswer"
          />
          <div style="margin-top: 20px;">
            <el-button type="primary" @click="checkAnswer">提交</el-button>
            <el-button @click="showAnswer">显示答案</el-button>
          </div>
          <div v-if="showResult" class="result" :class="{ correct: isCorrect, wrong: !isCorrect }">
            <span>{{ isCorrect ? '正确！' : '错误！' }}</span>
            <p v-if="!isCorrect">正确答案: {{ currentWord.english }}</p>
            <div style="margin-top: 10px;">
              <el-button type="primary" @click="nextWord">继续</el-button>
            </div>
          </div>
        </div>
        <div v-else class="complete-card">
          <h2>恭喜完成昨日错词巩固！</h2>
          <el-button type="primary" @click="restart">再练一次</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { wordApi, type Word } from '../api'

const words = ref<Word[]>([])
const currentIndex = ref(0)
const currentWord = ref<Word | null>(null)
const userAnswer = ref('')
const showResult = ref(false)
const isCorrect = ref(false)

const loadWords = async () => {
  // 昨日错词其实就是错题集
  const res = await wordApi.getYesterdayErrors()
  words.value = res.data.words
  if (words.value.length > 0) {
    currentWord.value = words.value[0]
  }
}

const checkAnswer = async () => {
  if (!userAnswer.value.trim()) {
    ElMessage.warning('请输入答案')
    return
  }

  isCorrect.value = userAnswer.value.toLowerCase().trim() === currentWord.value!.english.toLowerCase().trim()
  showResult.value = true

  if (isCorrect.value) {
    // 答对了，从错题集移除，加入观察室
    await wordApi.removeErrorWord(currentWord.value!.id)
  } else {
    // 答错了，保持在错题集
    await wordApi.addErrorWord(currentWord.value!.id)
  }
}

const showAnswer = () => {
  ElMessage.info(`答案: ${currentWord.value?.english}`)
}

const nextWord = async () => {
  currentIndex.value++
  if (currentIndex.value >= words.value.length) {
    currentWord.value = null
  } else {
    // 重新加载错题集，因为可能已经有单词已经被移除
    await loadWords()
    if (currentIndex.value >= words.value.length) {
      currentWord.value = null
    } else {
      currentWord.value = words.value[currentIndex.value]
    }
    userAnswer.value = ''
    showResult.value = false
  }
}

const restart = () => {
  currentIndex.value = 0
  userAnswer.value = ''
  showResult.value = false
  loadWords()
}

onMounted(() => {
  loadWords()
})
</script>

<style scoped>
.yesterday-errors {
  max-width: 600px;
  margin: 0 auto;
}

.practice-area {
  text-align: center;
}

.word-card, .complete-card {
  padding: 20px;
}

.progress {
  margin-bottom: 30px;
  color: #666;
}

.word-display {
  margin-bottom: 30px;
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

.complete-card h2 {
  margin-bottom: 20px;
  color: #67c23a;
}
</style>
