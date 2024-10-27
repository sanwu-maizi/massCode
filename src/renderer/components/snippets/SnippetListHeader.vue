<template>
  <div class="action">
    <!-- 显示搜索图标 -->
    <UniconsSearch />
    <!-- 绑定输入框的引用，并通过 v-model 绑定 query 变量，设置占位符 -->
    <input
      ref="inputRef"
      v-model="query"
      :placeholder="`${i18n.t('search')}...`"
    >
    <!-- 当没有搜索查询时，显示删除所有片段的按钮 -->
    <AppActionButton
      v-if="!query"
      v-tooltip="i18n.t('deleteAllSnippets')"
      class="item"
      @click="onDeleteAllSnippets"
    >
      <UniconsTrash />
    </AppActionButton>
    <!-- 当没有搜索查询时，显示新建片段的按钮 -->
    <AppActionButton
      v-if="!query"
      v-tooltip="i18n.t('newSnippet')"
      class="item"
      @click="onAddNewSnippet"
    >
      <UniconsPlus />
    </AppActionButton>
    <!-- 当有搜索查询时，显示重置按钮 -->
    <AppActionButton
      v-else
      class="item"
      @click="onReset"
    >
      <UniconsTimes />
    </AppActionButton>
  </div>
</template>

<script setup lang="ts">
import { emitter, onAddNewSnippet, onDeleteAllSnippets } from '@/composable' // 导入事件发射器和操作函数
import { useSnippetStore } from '@/store/snippets' // 引入片段状态管理
import { useDebounceFn } from '@vueuse/core' // 使用防抖函数
import { computed, onUnmounted, ref } from 'vue' // 导入 Vue 的基础功能
import { i18n } from '@/electron' // 导入 i18n 国际化工具
import { track } from '@/services/analytics' // 引入统计分析工具

const snippetStore = useSnippetStore() // 获取片段状态

const inputRef = ref<HTMLInputElement>() // 定义输入框的引用

// 定义一个计算属性 query，用于双向绑定片段搜索查询
const query = computed({
  get: () => snippetStore.searchQuery, // 获取当前的搜索查询
  set: useDebounceFn(async v => {
    snippetStore.searchQuery = v // 更新片段搜索查询
    await snippetStore.setSnippetsByAlias('all') // 设置所有片段
    snippetStore.search(v!) // 执行搜索
    track('snippets/search') // 追踪搜索行为
  }, 300) // 防抖延迟 300ms
})

// 定义重置搜索的函数，清空查询并显示所有片段
const onReset = () => {
  snippetStore.searchQuery = undefined // 清除当前查询
  snippetStore.setSnippetsByAlias('all') // 重置为所有片段
}

// 当收到“search:focus”事件时，聚焦输入框
emitter.on('search:focus', () => {
  inputRef.value?.focus()
})

// 在组件卸载时移除事件监听
onUnmounted(() => {
  emitter.off('search:focus')
})
</script>

<style lang="scss" scoped>
.action {
  display: flex; // 使子元素水平排列
  align-items: center; // 垂直居中对齐
  padding: 0 var(--spacing-sm); // 添加左右内边距
  position: relative;
  top: var(--title-bar-height-offset); // 设置相对于标题栏的偏移
  width: 100%; // 宽度为 100%
  input {
    outline: none; // 去掉输入框的外边框
    border: none; // 去掉输入框的边框
    width: 100%; // 输入框宽度占满容器
    padding: 0 var(--spacing-xs); // 设置内边距
    height: 24px; // 输入框的高度
    background-color: var(--color-snippet-list); // 输入框背景色
    color: var(--color-text); // 输入框文字颜色
  }
  :deep(svg) {
    flex-shrink: 0; // 阻止图标缩小
    fill: var(--color-button-action); // 图标颜色
  }
  .item {
    position: relative;
    right: -8px; // 向右偏移
  }
}
</style>
