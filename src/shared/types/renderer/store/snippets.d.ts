import type { Folder, Snippet, SnippetsSort } from '@shared/types/main/db'

export interface SnippetWithFolder extends Snippet {
  folder: Folder
}

export interface State {
  all: SnippetWithFolder[]
  snippets: SnippetWithFolder[]
  selected?: Snippet
  selectedMultiple: Snippet[]
  fragment: number
  searchQuery?: string
  searchQueryEscaped?: string
  sort: SnippetsSort
  hideSubfolderSnippets: boolean
  compactMode: boolean
  isContextState: boolean
  isMarkdownPreview: boolean
  isMindmapPreview: boolean
  isScreenshotPreview: boolean
  isCodePreview: boolean
  isShareActive?: boolean
  snippetsByFilter: Snippet[] // 这里需要添加 snippetsByFilter 属性
}

export type PreviewType = 'markdown' | 'mindmap' | 'screenshot' | 'code'
