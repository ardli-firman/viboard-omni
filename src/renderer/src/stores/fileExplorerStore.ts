import { create } from 'zustand'
import { toast } from 'sonner'

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg', '.avif'])
function isImageExt(ext: string): boolean {
  return IMAGE_EXTS.has(ext.toLowerCase())
}

export interface FileEntry {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  size: number
  extension: string
}

export interface FileTreeItem {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  size: number
  extension: string
  children?: FileTreeItem[]
}

export interface OpenFile {
  path: string
  name: string
  relativePath: string
  content: string | null
  loading: boolean
  error: string | null
  dirty: boolean
  isImage: boolean
  diffMode: boolean
  originalContent: string | null
}

interface FileExplorerState {
  tree: FileTreeItem[]
  treeLoading: boolean
  treeError: string | null
  expandedPaths: Set<string>
  gitStatus: Record<string, string>
  gitBranch: string | null
  openFiles: OpenFile[]
  activeFilePath: string | null
  panelOpen: boolean
  rootPath: string | null
  panelWidth: number
  viewMode: 'explorer' | 'git' | 'editor'
  loadTree: (rootPath: string) => Promise<void>
  refreshGitStatus: () => Promise<void>
  toggleExpand: (path: string) => void
  toggleDiffMode: (path: string) => Promise<void>
  openFile: (path: string, name: string, relativePath: string) => Promise<void>
  closeFile: (path: string) => void
  setActiveFile: (path: string | null) => void
  closeAllFiles: () => void
  togglePanel: () => void
  setPanelOpen: (open: boolean) => void
  setRootPath: (path: string | null) => void
  setPanelWidth: (width: number) => void
  resetPanelWidth: () => void
  setViewMode: (mode: 'explorer' | 'git' | 'editor') => void
}

export const useFileExplorerStore = create<FileExplorerState>((set, get) => ({
  tree: [],
  treeLoading: false,
  treeError: null,
  expandedPaths: new Set<string>(),
  gitStatus: {},
  gitBranch: null,
  openFiles: [],
  activeFilePath: null,
  panelOpen: true,
  rootPath: null,
  panelWidth: 320,
  viewMode: 'explorer',

  setViewMode: (viewMode) => {
    set({ viewMode })
  },

  loadTree: async (rootPath: string) => {
    set({ treeLoading: true, treeError: null, rootPath })
    try {
      const tree = await window.electronAPI.getFileTree(rootPath)
      set({ tree, treeLoading: false })
      await get().refreshGitStatus()
      await window.electronAPI.watchProject(rootPath)
    } catch (err) {
      console.error('[fileExplorer] Failed to load tree:', err)
      set({ treeLoading: false, treeError: String(err) })
      toast.error('Failed to load project files')
    }
  },

  refreshGitStatus: async () => {
    const { rootPath } = get()
    if (!rootPath) return
    try {
      const status = await window.electronAPI.getGitStatus(rootPath)
      let branch: string | null = null
      try {
        branch = await window.electronAPI.getGitBranch(rootPath)
      } catch (err) {
        // Ignored
      }
      set({ gitStatus: status, gitBranch: branch || null })
    } catch (err) {
      // Ignored
    }
  },

  toggleExpand: (path: string) => {
    set((state) => {
      const next = new Set(state.expandedPaths)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return { expandedPaths: next }
    })
  },

  openFile: async (path: string, name: string, relativePath: string) => {
    const state = get()
    const existing = state.openFiles.find((f) => f.path === path)

    if (existing) {
      set({ activeFilePath: path, viewMode: 'editor' })
      return
    }
    const ext = '.' + (name.split('.').pop() ?? '').toLowerCase()
    const isImage = isImageExt(ext)
    const placeholder: OpenFile = {
      path,
      name,
      relativePath,
      content: null,
      loading: true,
      error: null,
      dirty: false,
      isImage,
      diffMode: false,
      originalContent: null,
    }

    set({
      openFiles: [...state.openFiles, placeholder],
      activeFilePath: path,
      viewMode: 'editor',
    })

    try {
      if (isImage) {
        const img = await window.electronAPI.readImage(path)
        set((s) => ({
          openFiles: s.openFiles.map((f) =>
            f.path === path
              ? {
                  ...f,
                  content: img?.dataUrl ?? null,
                  loading: false,
                  error: img ? null : 'Failed to load image',
                }
              : f,
          ),
        }))
      } else {
        const content = await window.electronAPI.readFile(path)
        const status = state.gitStatus[relativePath]
        const isModified = status?.includes('M')

        let orig: string | null = null
        let shouldDiff = false

        if (isModified && state.rootPath) {
          try {
            orig = await window.electronAPI.getGitHeadContent(state.rootPath, relativePath)
            shouldDiff = orig !== null
          } catch (e) {
            console.error('Failed to pre-fetch Git Head content:', e)
          }
        }

        set((s) => ({
          openFiles: s.openFiles.map((f) =>
            f.path === path
              ? {
                  ...f,
                  content,
                  loading: false,
                  diffMode: shouldDiff,
                  originalContent: orig,
                  error: content === null ? 'Binary or unreadable file' : null,
                }
              : f,
          ),
        }))
      }
    } catch (err) {
      set((s) => ({
        openFiles: s.openFiles.map((f) =>
          f.path === path ? { ...f, loading: false, error: String(err) } : f,
        ),
      }))
      toast.error(`Failed to open ${name}`)
    }
  },

  closeFile: (path: string) => {
    set((state) => {
      const remaining = state.openFiles.filter((f) => f.path !== path)
      let nextActive = state.activeFilePath
      let nextViewMode = state.viewMode

      if (state.activeFilePath === path) {
        if (remaining.length === 0) {
          nextActive = null
          nextViewMode = 'explorer'
        } else {
          const idx = state.openFiles.findIndex((f) => f.path === path)
          const fallback = remaining[Math.min(idx, remaining.length - 1)]
          nextActive = fallback?.path ?? null
          nextViewMode = 'editor'
        }
      }
      return { openFiles: remaining, activeFilePath: nextActive, viewMode: nextViewMode }
    })
  },

  toggleDiffMode: async (path: string) => {
    const state = get()
    const file = state.openFiles.find((f) => f.path === path)
    if (!file) return

    if (file.diffMode) {
      set((s) => ({
        openFiles: s.openFiles.map((f) => (f.path === path ? { ...f, diffMode: false } : f)),
      }))
      return
    }

    // Entering diff mode, need originalContent
    if (file.originalContent !== null) {
      set((s) => ({
        openFiles: s.openFiles.map((f) => (f.path === path ? { ...f, diffMode: true } : f)),
      }))
      return
    }

    try {
      if (!state.rootPath) return
      const orig = await window.electronAPI.getGitHeadContent(state.rootPath, file.relativePath)
      const currentContent = await window.electronAPI.readFile(file.path)

      set((s) => ({
        openFiles: s.openFiles.map((f) =>
          f.path === path
            ? {
                ...f,
                diffMode: true,
                originalContent: orig ?? '',
                content: currentContent ?? f.content,
              }
            : f,
        ),
      }))
    } catch (err) {
      toast.error('Failed to load diff content')
    }
  },

  setActiveFile: (path) => {
    if (path === null) {
      set({ activeFilePath: null, viewMode: 'explorer' })
    } else {
      set({ activeFilePath: path, viewMode: 'editor' })
    }
  },

  closeAllFiles: () => {
    set({ openFiles: [], activeFilePath: null, viewMode: 'explorer' })
  },

  togglePanel: () => {
    set((state) => ({ panelOpen: !state.panelOpen }))
  },

  setPanelOpen: (open: boolean) => {
    set({ panelOpen: open })
  },

  setRootPath: (path: string | null) => {
    if (path === get().rootPath) return
    if (path === null) {
      void window.electronAPI.unwatchProject()
      set({
        rootPath: null,
        tree: [],
        expandedPaths: new Set(),
      })
      return
    }
    void get().loadTree(path)
  },

  setPanelWidth: (width: number) => {
    set({ panelWidth: width })
  },

  resetPanelWidth: () => {
    set({ panelWidth: 320 })
  },
})
)
