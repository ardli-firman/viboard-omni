import { type ReactElement, useRef, useCallback } from 'react'
import Editor, { loader, type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import type { OpenFile } from '../../stores/fileExplorerStore'
import { useThemeStore } from '../../stores/themeStore'

// Configure Monaco to load from locally bundled monaco-editor
// (avoids runtime CDN download in Electron)
import * as monaco from 'monaco-editor'
loader.config({ monaco })

function getMonacoLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    jsonc: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    md: 'markdown',
    mdx: 'markdown',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    h: 'cpp',
    hpp: 'cpp',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    plist: 'xml',
    sql: 'sql',
    vue: 'html',
    svelte: 'html',
    toml: 'ini',
    ini: 'ini',
    env: 'plaintext',
    txt: 'plaintext',
    log: 'plaintext',
    gitignore: 'plaintext',
    svg: 'xml',
    graphql: 'graphql',
    gql: 'graphql',
    dockerfile: 'dockerfile',
    cs: 'csharp',
    fs: 'fsharp',
    dart: 'dart',
    lua: 'lua',
    php: 'php',
    r: 'r',
    pl: 'perl',
    pm: 'perl',
  }
  return map[ext] ?? 'plaintext'
}

interface FileEditorProps {
  file: OpenFile
}

export function FileEditor({ file }: FileEditorProps): ReactElement {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const theme = useThemeStore((s) => s.theme)

  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs'

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
  }, [])

  if (file.loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (file.error) {
    return (
      <div className="flex flex-1 items-center justify-center py-8">
        <div className="text-center">
          <p className="text-sm text-destructive">{file.error}</p>
        </div>
      </div>
    )
  }

  if (file.content === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">No content</p>
      </div>
    )
  }

  const language = getMonacoLanguage(file.name)

  return (
    <div className="flex-1 overflow-hidden">
      <Editor
        height="100%"
        language={language}
        value={file.content}
        theme={monacoTheme}
        onMount={handleMount}
        options={{
          fontSize: 13,
          fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
          fontLigatures: true,
          minimap: { enabled: true },
          readOnly: true,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          automaticLayout: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          padding: { top: 8 },
        }}
      />
    </div>
  )
}
