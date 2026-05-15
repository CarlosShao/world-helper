<template>
  <div class="error-words">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>错题集</span>
          <el-button type="primary" @click="startPractice">开始练习错题</el-button>
        </div>
      </template>

      <el-table :data="words" style="width: 100%" v-loading="loading">
        <el-table-column type="index" label="序号" width="80" />
        <el-table-column label="英文" width="200">
          <template #default="{ row }">{{ row.english }}</template>
        </el-table-column>
        <el-table-column label="词性" width="120">
          <template #default="{ row }">{{ row.part_of_speech }}</template>
        </el-table-column>
        <el-table-column label="中文">
          <template #default="{ row }">{{ row.chinese }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="removeFromErrorWords(row.id)">
              已掌握
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="words.length === 0 && !loading" description="暂无错题" />
    </el-card>

    <!-- 练习对话框 -->
    <el-dialog v-model="practiceDialogVisible" title="错题练习" width="500px">
      <div v-if="practiceWords.length > 0 && currentPracticeWord" class="practice-content">
        <div class="progress">
          <span>进度: {{ practiceIndex + 1 }} / {{ practiceWords.length }}</span>
        </div>
        <div class="word-display">
          <h3 class="chinese">{{ currentPracticeWord.chinese }}</h3>
          <p class="part-of-speech">{{ currentPracticeWord.part_of_speech }}</p>
        </div>
        <el-input
          v-model="practiceAnswer"
          placeholder="请输入英文单词"
          size="large"
          @keyup.enter="checkPracticeAnswer"
        />
        <div style="margin-top: 20px;">
          <el-button type="primary" @click="checkPracticeAnswer">提交</el-button>
          <el-button @click="showPracticeAnswer">显示答案</el-button>
        </div>
        <div v-if="practiceResult" class="result" :class="{ correct: practiceIsCorrect, wrong: !practiceIsCorrect }">
          <span>{{ practiceIsCorrect ? '正确！' : '错误！' }}</span>
          <p v-if="!practiceIsCorrect">正确答案: {{ currentPracticeWord.english }}</p>
          <div v-if="practiceIsCorrect" style="margin-top: 10px;">
            <el-button type="primary" @click="nextPracticeWord">下一个</el-button>
          </div>
        </div>
      </div>
      <div v-else class="practice-content">
        <el-empty description="练习完成！" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { wordApi, type Word } from '../api'

const words = ref<Word[]>([])
const loading = ref(false)
const practiceDialogVisible = ref(false)
const practiceWords = ref<Word[]>([])
const practiceIndex = ref(0)
const currentPracticeWord = ref<Word | null>(null)
const practiceAnswer = ref('')
const practiceResult = ref(false)
const practiceIsCorrect = ref(false)

const loadErrorWords = async () => {
  loading.value = true
  try {
    const res = await wordApi.getErrorWords()
    words.value = res.data.words
  } catch (error) {
    ElMessage.error('加载错题失败')
  } finally {
    loading.value = false
  }
}

const removeFromErrorWords = async (wordId: number) => {
  try {
    await wordApi.removeErrorWord(wordId)
    ElMessage.success('已移至观察室')
    loadErrorWords()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const startPractice = () => {
  if (words.value.length === 0) {
    ElMessage.warning('暂无错题')
    return
  }
  practiceWords.value = [...words.value]
  practiceIndex.value = 0
  practiceAnswer.value = ''
  practiceResult.value = false
  currentPracticeWord.value = practiceWords.value[0]
  practiceDialogVisible.value = true
}

const checkPracticeAnswer = async () => {
  if (!practiceAnswer.value.trim()) {
    ElMessage.warning('请输入答案')
    return
  }
  
  practiceIsCorrect.value = practiceAnswer.value.toLowerCase().trim() === currentPracticeWord.value!.english.toLowerCase().trim()
  practiceResult.value = true

  if (practiceIsCorrect.value) {
    // 答对了，从错题集移除，加入观察室
    await wordApi.removeErrorWord(currentPracticeWord.value!.id)
  } else {
    // 答错了，保持在错题集
    await wordApi.addErrorWord(currentPracticeWord.value!.id)
  }
}

const showPracticeAnswer = () => {
  ElMessage.info(`答案: ${currentPracticeWord.value?.english}`)
}

const nextPracticeWord = () => {
  practiceIndex.value++
  if (practiceIndex.value >= practiceWords.value.length) {
    currentPracticeWord.value = null
    loadErrorWords()
  } else {
    currentPracticeWord.value = practiceWords.value[practiceIndex.value]
    practiceAnswer.value = ''
    practiceResult.value = false
  }
}

onMounted(() => {
  loadErrorWords()
})
</script>

<style scoped>
.error-words {
  max-width: 1000px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.practice-content {
  text-align: center;
}

.progress {
  margin-bottom: 30px;
  color: #666;
}

.word-display {
  margin-bottom: 30px;
}

.chinese {
  font-size: 28px;
  margin-bottom: 10px;
}

.part-of-speech {
  color: #909399;
}

.result {
  margin-top: 20px;
  padding: 15px;
  border-radius: 8px;
}

.result.correct {
  background-color: #f0f9eb;
  color: #67c23a;
}

.result.wrong {
  background-color: #fef0f0;
  color: #f56c6c;
}
</style>
