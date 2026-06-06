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
}

interface FileExplorerState {
  tree: FileTreeItem[]
  treeLoading: boolean
  treeError: string | null
  expandedPaths: Set<string>
  openFiles: OpenFile[]
  activeFilePath: string | null
  panelOpen: boolean
  rootPath: string | null
  panelWidth: number
  loadTree: (rootPath: string) => Promise<void>
  toggleExpand: (path: string) => void
  openFile: (path: string, name: string, relativePath: string) => Promise<void>
  closeFile: (path: string) => void
  setActiveFile: (path: string | null) => void
  closeAllFiles: () => void
  togglePanel: () => void
  setPanelOpen: (open: boolean) => void
  setRootPath: (path: string | null) => void
  setPanelWidth: (width: number) => void
  resetPanelWidth: () => void
}

export const useFileExplorerStore = create<FileExplorerState>((set, get) => ({
  tree: [],
  treeLoading: false,
  treeError: null,
  expandedPaths: new Set<string>(),
  openFiles: [],
  activeFilePath: null,
  panelOpen: true,
  rootPath: null,

  panelWidth: 320,
  loadTree: async (rootPath: string) => {
    set({ treeLoading: true, treeError: null, rootPath })
    try {
      const tree = await window.electronAPI.getFileTree(rootPath)
      set({ tree, treeLoading: false })
    } catch (err) {
      console.error('[fileExplorer] Failed to load tree:', err)
      set({ treeLoading: false, treeError: String(err) })
      toast.error('Failed to load project files')
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
      set({ activeFilePath: path })
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
    }

    set({
      openFiles: [...state.openFiles, placeholder],
      activeFilePath: path,
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
        set((s) => ({
          openFiles: s.openFiles.map((f) =>
            f.path === path
              ? {
                  ...f,
                  content,
                  loading: false,
                  error: content === null ? 'Binary or unreadable file' : null,
                }
              : f,
          ),
        }))
      }
    } catch (err) {
      set((s) => ({
        openFiles: s.openFiles.map((f) =>
          f.path === path
            ? { ...f, loading: false, error: String(err) }
            : f,
        ),
      }))
      toast.error(`Failed to open ${name}`)
    }
  },

  closeFile: (path: string) => {
    set((state) => {
      const remaining = state.openFiles.filter((f) => f.path !== path)
      let nextActive = state.activeFilePath
      if (state.activeFilePath === path) {
        if (remaining.length === 0) {
          nextActive = null
        } else {
          const idx = state.openFiles.findIndex((f) => f.path === path)
          const fallback = remaining[Math.min(idx, remaining.length - 1)]
          nextActive = fallback?.path ?? null
        }
      }
      return { openFiles: remaining, activeFilePath: nextActive }
    })
  },

  setActiveFile: (path) => {
    set({ activeFilePath: path })
  },

  closeAllFiles: () => {
    set({ openFiles: [], activeFilePath: null })
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
}))
