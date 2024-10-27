// 从 @vueuse/core 引入 createFetch 和 useClipboard，用于创建 HTTP 请求和剪贴板操作
import { createFetch, useClipboard } from '@vueuse/core'
// 使用 mitt 库实现事件总线（事件的发射和监听）
import mitt from 'mitt'
// 引入事件类型定义
import type { EmitterEvents } from '@shared/types/renderer/composable'
// API 端口常量
import { API_PORT } from '../../main/config'
// 引入文件夹和代码片段的状态管理
import { useFolderStore } from '@/store/folders'
import { useSnippetStore } from '@/store/snippets'
// 用于与 Electron 主进程通信
import { ipc } from '@/electron'
// 用于统计事件
import { track } from '@/services/analytics'
// 引入类型定义
import type { NotificationRequest } from '@shared/types/main'
import type { Snippet, SnippetsSort } from '@shared/types/main/db'
// 应用程序状态管理
import { useAppStore } from '@/store/app'

// 创建 HTTP 请求工具，设置基础 URL
export const useApi = createFetch({
  baseUrl: `http://localhost:${API_PORT}`
})

// 创建全局事件发射器
export const emitter = mitt<EmitterEvents>()

// 删除所有代码片段和文件夹
export const onDeleteAllSnippets = () => {
  const snippetStore = useSnippetStore()
  const folderStore = useFolderStore()
  snippetStore.deleteAllSnippets()
  folderStore.deleteFolders()
}

// 添加新的代码片段
export const onAddNewSnippet = async () => {
  const folderStore = useFolderStore()
  const snippetStore = useSnippetStore()
  console.log(111) // 打印调试信息
  console.log(snippetStore.all) // 打印所有片段
  snippetStore.fragment = 0 // 重置片段状态
  snippetStore.isMarkdownPreview = false // 关闭 Markdown 预览

  await snippetStore.addNewSnippet() // 添加新片段

  if (folderStore.selectedId) {
    // 如果有选择的文件夹，获取对应的片段
    await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
  } else {
    snippetStore.setSnippetsByAlias('inbox') // 否则设置为默认文件夹
  }

  emitter.emit('snippet:focus-name', true) // 发射事件聚焦片段名称输入
  track('snippets/add-new') // 追踪添加操作
}

// 添加新的代码片段，与上一个函数类似
export const onNewSnippet = async () => {
  const folderStore = useFolderStore()
  const snippetStore = useSnippetStore()

  snippetStore.fragment = 0
  snippetStore.isMarkdownPreview = false

  await snippetStore.addNewSnippet()

  if (folderStore.selectedId) {
    await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
  } else {
    snippetStore.setSnippetsByAlias('inbox')
  }

  emitter.emit('snippet:focus-name', true)
  track('snippets/add-new')
}

// 使用给定的内容创建新的代码片段
export const onCreateSnippet = async (body: Partial<Snippet>) => {
  const snippetStore = useSnippetStore()

  await snippetStore.addNewSnippet(body)
  await snippetStore.getSnippets()
  snippetStore.setSnippetsByAlias('inbox')
  track('api/snippet-create')
}

// 向当前片段添加新的片段部分
export const onAddNewFragment = async () => {
  const snippetStore = useSnippetStore()

  await snippetStore.addNewFragmentToSnippetsById(snippetStore.selectedId!)
  track('snippets/add-fragment')
}

// 添加描述到当前选中的片段
export const onAddDescription = async () => {
  const snippetStore = useSnippetStore()

  // 如果已有描述，则直接返回
  if (typeof snippetStore.selected?.description === 'string') return

  // 如果没有描述，则添加一个空字符串
  if (
    snippetStore.selected?.description === undefined ||
    snippetStore.selected?.description === null
  ) {
    await snippetStore.patchSnippetsById(snippetStore.selectedId!, {
      description: ''
    })
  }

  track('snippets/add-description')
}

// 添加新文件夹
export const onAddFolder = async () => {
  const folderStore = useFolderStore()
  const snippetStore = useSnippetStore()

  const folder = await folderStore.addNewFolder()
  snippetStore.selected = undefined

  emitter.emit('scroll-to:folder', folder.id)
  track('folders/add-new')
}

// 添加新文件夹，与上一个函数类似
export const onAddNewFolder = async () => {
  const folderStore = useFolderStore()
  const snippetStore = useSnippetStore()

  const folder = await folderStore.addNewFolder()
  snippetStore.selected = undefined

  emitter.emit('scroll-to:folder', folder.id)
  track('folders/add-new')
}

// 复制当前片段内容到剪贴板
export const onCopySnippet = () => {
  const snippetStore = useSnippetStore()

  const { copy } = useClipboard({ source: snippetStore.currentContent })
  copy()

  ipc.invoke<any, NotificationRequest>('main:notification', {
    body: 'Snippet copied'
  })
  track('snippets/copy')
}

// 导航到特定代码片段，并更新 UI 状态
export const goToSnippet = async (snippetId: string, history?: boolean) => {
  if (!snippetId) return

  const folderStore = useFolderStore()
  const snippetStore = useSnippetStore()
  const appStore = useAppStore()

  const snippet = snippetStore.findSnippetById(snippetId)

  if (!snippet) return

  folderStore.selectId(snippet.folderId)

  expandParentFolders(snippet.folderId)

  snippetStore.fragment = 0

  await snippetStore.getSnippetsById(snippetId)
  await snippetStore.setSnippetsByFolderIds()

  if (history) appStore.history.push(snippetId)

  emitter.emit('folder:click', snippet.folderId)
  emitter.emit('scroll-to:snippet', snippetId)
  emitter.emit('scroll-to:folder', snippet.folderId)
}

// 展开给定文件夹的所有父文件夹
export const expandParentFolders = (folderId: string) => {
  const folderStore = useFolderStore()

  const findParentAndExpand = async (id: string) => {
    const folder = folderStore.folders.find(i => i.id === id)

    if (!folder) return

    await folderStore.patchFoldersById(folder.id, {
      isOpen: true
    })

    if (folder.parentId) {
      findParentAndExpand(folder.parentId)
    }
  }

  findParentAndExpand(folderId)
}

// 设置滚动条位置
export const setScrollPosition = (el: HTMLElement, offset: number) => {
  const ps = el.querySelector('.ps')
  if (ps) ps.scrollTop = offset
}

// 根据给定的排序方式对代码片段排序
export const sortSnippetsBy = (snippets: Snippet[], sort: SnippetsSort) => {
  if (sort === 'updatedAt') {
    snippets.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
  }

  if (sort === 'createdAt') {
    snippets.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
  }

  if (sort === 'name') {
    snippets.sort((a, b) =>
      a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1
    )
  }
}

// 动态加载代码高亮样式
export const useHljsTheme = async (theme: 'dark' | 'light') => {
  const { default: darkCSS } = await import(
    'highlight.js/styles/base16/material.css?raw'
  )
  const { default: lightCSS } = await import(
    'highlight.js/styles/github.css?raw'
  )

  document.querySelector('[data=hljs-theme]')?.remove()

  const style = document.createElement('style')
  style.setAttribute('data', 'hljs-theme')

  if (theme === 'dark') {
    style.innerHTML = darkCSS
  } else {
    style.innerHTML = lightCSS
  }

  document.head.appendChild(style)
}

// 打开指定的 URL
export const onClickUrl = (url: string) => {
  ipc.invoke('main:open-url', url)
  track('app/open-url', url)
}
