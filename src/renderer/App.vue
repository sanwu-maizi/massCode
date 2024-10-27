<template>
  <!-- 应用程序标题栏，根据平台不同显示不同样式 -->
  <div
    class="app-title-bar"
    :class="{ 'is-win': appStore.platform === 'win32' }"
  />
  <!-- 路由视图，用于显示应用的不同页面内容 -->
  <RouterView />
  <!-- 顶部通知区域，用于显示特定的通知，如更新提示 -->
  <div class="top-notification">
    <!-- 当应用未赞助且没有更新可用时，显示特定通知 -->
    <span
      v-if="!appStore.isSponsored && !isUpdateAvailable"
      class="unsponsored"
    >
      <span v-if="!isDev">
        {{ i18n.t('special:unsponsored') }}
      </span>
    </span>
    <!-- 如果有更新可用，显示更新提示，并点击可以触发更新动作 -->
    <span
      v-if="isUpdateAvailable"
      class="update"
      @click="onClickUpdate"
    >
      {{ i18n.t('updateAvailable') }}
    </span>
  </div>
  <!-- 全局模态窗口，用于显示应用的文件夹图标 -->
  <AppModal v-model:show="appStore.showModal">
    <AppFolderIcons />
  </AppModal>
</template>

<script setup lang="ts">
import router from '@/router' // 引入路由
import { nextTick, ref, watch } from 'vue' // Vue 的工具函数和响应式 API
import { ipc, store, i18n } from './electron' // 导入与 Electron 相关的工具
import { track } from '@/services/analytics' // 用于统计事件
import { EDITOR_DEFAULTS, useAppStore } from './store/app' // 应用状态管理
import { useSnippetStore } from './store/snippets' // 片段状态管理
import {
  onAddNewSnippet,
  onAddNewFragment,
  onAddNewFolder,
  onCopySnippet,
  emitter,
  onCreateSnippet,
  onAddDescription,
  goToSnippet
} from '@/composable' // 引入各种操作函数
import { useRoute } from 'vue-router' // 引入路由信息
import type { Snippet } from '@shared/types/main/db' // 类型定义
import { loadWASM } from 'onigasm' // 用于 WebAssembly 解析
import onigasmFile from 'onigasm/lib/onigasm.wasm?url' // WebAssembly 文件
import { loadGrammars } from '@/components/editor/grammars' // 加载编辑器语法
import {
  useSupportNotification,
  checkForRemoteNotification
} from '@/composable/notification' // 支持和远程通知

// 设置应用启动时的默认路由为根路径
router.push('/')

const appStore = useAppStore() // 获取应用状态
const snippetStore = useSnippetStore() // 获取片段状态
const route = useRoute() // 获取当前路由信息

const { showSupportToast } = useSupportNotification() // 显示支持通知

const isUpdateAvailable = ref(false) // 更新状态标志
const isDev = import.meta.env.DEV // 检查是否为开发环境

// 初始化函数，设置应用程序的默认状态
const init = async () => {
  loadWASM(onigasmFile) // 加载 WebAssembly 文件
  await loadGrammars() // 加载语法

  const theme = store.preferences.get('theme') // 获取主题设置
  const dateInstallation = store.app.get('dateInstallation') // 获取安装日期
  const isValid = appStore.isEditorSettingsValid(
    store.preferences.get('editor')
  ) // 验证编辑器设置

  if (isValid) appStore.editor = store.preferences.get('editor') // 设置编辑器

  // 设置应用的各个部分的尺寸和状态
  appStore.sizes.sidebar = store.app.get('sidebarWidth')
  appStore.sizes.snippetList = store.app.get('snippetListWidth')
  appStore.screenshot = store.preferences.get('screenshot')
  appStore.markdown = {
    ...appStore.markdown,
    ...store.preferences.get('markdown')
  }

  // 设置片段的排序和显示模式
  snippetStore.sort = store.app.get('sort')
  snippetStore.hideSubfolderSnippets = store.app.get('hideSubfolderSnippets')
  snippetStore.compactMode = store.app.get('compactMode')

  // 如果存在用户主题，设置为用户主题，否则使用默认主题
  if (theme) {
    appStore.setTheme(theme)
  } else {
    appStore.setTheme('light:github')
  }

  // 如果没有安装日期，设置当前日期为安装日期
  if (!dateInstallation) {
    store.app.set('dateInstallation', new Date().valueOf())
  }

  trackAppUpdate() // 追踪应用更新
  checkForRemoteNotification() // 检查远程通知
}

// 设置页面主题
const setTheme = (theme: string) => {
  document.body.dataset.theme = theme
}

// 点击更新按钮，打开更新页面
const onClickUpdate = () => {
  ipc.invoke(
    'main:open-url',
    'https://masscode.io/download/latest-release.html'
  )
  track('app/update')
}

// 追踪应用更新，检查版本变化
const trackAppUpdate = () => {
  const installedVersion = store.app.get('version')

  if (!installedVersion) track('app/install')

  if (installedVersion && appStore.version !== installedVersion) {
    track('app/update', `from-${installedVersion}`)
  }

  store.app.set('version', appStore.version)
}

init() // 调用初始化函数

// 监听应用主题变化，动态更新主题
watch(
  () => appStore.theme,
  () => setTheme(appStore.theme),
  { immediate: true }
)

// 监听片段选中项的变化，处理 Markdown 和 Mindmap 预览状态
watch(
  () => [snippetStore.selectedId, snippetStore.fragment],
  () => {
    const lang = snippetStore.selected?.content[snippetStore.fragment]?.language

    if (lang && lang !== 'markdown') {
      snippetStore.isMarkdownPreview = false
      snippetStore.isMindmapPreview = false
    }
  }
)

// 监听路由变化，进行页面滚动操作
watch(
  () => route.path,
  () => {
    if (route.path === '/') {
      nextTick(() => {
        emitter.emit('scroll-to:snippet', snippetStore.selectedId!)
      })
    }
  }
)

// 监听编辑器设置变化，动态保存
watch(
  () => appStore.editor,
  v => {
    store.preferences.set('editor', { ...v })
  },
  { deep: true }
)

// 设置多个 IPC 监听事件，处理更新通知、导航和各种操作
ipc.on('main:update-available', () => {
  isUpdateAvailable.value = true
})

ipc.on('main:focus', () => {
  showSupportToast()
})

ipc.on('main:app-protocol', (event, payload: string) => {
  if (/^masscode:\/\/snippets/.test(payload)) {
    const snippetId = payload.split('/').pop()
    if (snippetId) goToSnippet(snippetId, true)
  }
})

// 监听菜单操作，处理各类快捷操作和导航
ipc.on('main-menu:preferences', () => {
  router.push('/preferences')
})

ipc.on('main-menu:devtools', () => {
  router.push('/devtools')
})

ipc.on('main-menu:new-folder', async () => {
  await onAddNewFolder()
})

ipc.on('main-menu:new-snippet', async () => {
  await onAddNewSnippet()
})

ipc.on('main-menu:new-fragment', () => {
  onAddNewFragment()
})

ipc.on('main-menu:preview-markdown', async () => {
  if (snippetStore.currentLanguage === 'markdown') {
    snippetStore.togglePreview('markdown')
    track('snippets/markdown-preview')
  }
})

ipc.on('main-menu:presentation-mode', async () => {
  if (snippetStore.currentLanguage === 'markdown') {
    router.push('/presentation')
  }
})

ipc.on('main-menu:preview-code', () => {
  snippetStore.togglePreview('code')
})

ipc.on('main-menu:preview-mindmap', () => {
  snippetStore.togglePreview('mindmap')
})

ipc.on('main-menu:copy-snippet', () => {
  onCopySnippet()
})

ipc.on('main-menu:format-snippet', () => {
  emitter.emit('snippet:format', true)
})

ipc.on('main-menu:search', () => {
  emitter.emit('search:focus', true)
})

ipc.on('main-menu:sort-snippets', (event, sort) => {
  snippetStore.setSort(sort)
})

ipc.on('main-menu:hide-subfolder-snippets', () => {
  snippetStore.hideSubfolderSnippets = !snippetStore.hideSubfolderSnippets
  store.app.set('hideSubfolderSnippets', snippetStore.hideSubfolderSnippets)
})

ipc.on('main-menu:compact-mode-snippets', () => {
  snippetStore.compactMode = !snippetStore.compactMode
  store.app.set('compactMode', snippetStore.compactMode)
})

ipc.on('main-menu:add-description', async () => {
  await onAddDescription()
})

ipc.on('main-menu:font-size-increase', async () => {
  appStore.editor.fontSize += 1
  emitter.emit('editor:refresh', true)
})

ipc.on('main-menu:font-size-decrease', async () => {
  if (appStore.editor.fontSize === 1) return
  appStore.editor.fontSize -= 1
  emitter.emit('editor:refresh', true)
})

ipc.on('main-menu:font-size-reset', async () => {
  appStore.editor.fontSize = EDITOR_DEFAULTS.fontSize
  emitter.emit('editor:refresh', true)
})

ipc.on('main-menu:history-back', async () => {
  appStore.historyBack()
})

ipc.on('main-menu:history-forward', async () => {
  appStore.historyForward()
})

ipc.on('api:snippet-create', (event, body: Snippet) => {
  onCreateSnippet(body)
})
</script>

<style lang="scss">
body {
  margin: 0;
}

#app {
  height: 100vh;
  overflow: hidden;
}

/* 标题栏样式 */
.app {
  &-title-bar {
    position: absolute;
    top: 0;
    width: 100%;
    height: var(--title-bar-height);
    user-select: none;
    -webkit-app-region: drag;
    z-index: 1010;
    transition: all 0.5s;

    &.is-win {
      border-top: 1px solid var(--color-border);
    }
  }
}

/* 顶部通知样式 */
.top-notification {
  position: absolute;
  top: 5px;
  right: var(--spacing-sm);
  z-index: 1020;
  text-transform: uppercase;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  gap: var(--spacing-sm);
}

/* 动画效果 */
.update {
  background: -webkit-linear-gradient(60deg, var(--color-primary), limegreen);
  -webkit-text-fill-color: transparent;
  background-size: 200% auto;
  animation: shine 3s ease infinite;
}

@keyframes shine {
  from {
    background-position: 200%;
  }
}
</style>
