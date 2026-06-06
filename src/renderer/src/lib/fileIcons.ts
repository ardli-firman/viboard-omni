import {
  File,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  Folder,
  FolderOpen,
  Archive,
  Braces,
  type LucideIcon,
} from 'lucide-react'

const EXTENSION_ICON_MAP: Record<string, LucideIcon> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  mjs: FileCode,
  cjs: FileCode,
  json: FileJson,
  jsonc: FileJson,
  html: FileCode,
  htm: FileCode,
  css: FileCode,
  scss: FileCode,
  sass: FileCode,
  less: FileCode,
  md: FileText,
  mdx: FileText,
  txt: FileText,
  log: FileText,
  env: FileText,
  gitignore: FileText,
  toml: FileText,
  yaml: FileText,
  yml: FileText,
  xml: FileCode,
  py: FileCode,
  rb: FileCode,
  go: FileCode,
  rs: FileCode,
  java: FileCode,
  c: FileCode,
  cpp: FileCode,
  h: FileCode,
  hpp: FileCode,
  sh: FileCode,
  bash: FileCode,
  zsh: FileCode,
  ps1: FileCode,
  sql: FileCode,
  vue: FileCode,
  svelte: FileCode,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  webp: FileImage,
  svg: FileImage,
  ico: FileImage,
  bmp: FileImage,
  zip: Archive,
  tar: Archive,
  gz: Archive,
  rar: Archive,
  '7z': Archive,
  cs: Braces,
  csproj: Braces,
  sln: Braces,
}

const COLOR_BY_EXTENSION: Record<string, string> = {
  ts: 'text-sky-500',
  tsx: 'text-sky-500',
  js: 'text-yellow-500',
  jsx: 'text-yellow-500',
  json: 'text-emerald-500',
  jsonc: 'text-emerald-500',
  html: 'text-orange-500',
  css: 'text-blue-500',
  scss: 'text-pink-500',
  md: 'text-zinc-500',
  py: 'text-yellow-500',
  go: 'text-cyan-500',
  rs: 'text-orange-600',
  java: 'text-red-500',
  png: 'text-purple-500',
  jpg: 'text-purple-500',
  jpeg: 'text-purple-500',
  gif: 'text-purple-500',
  svg: 'text-purple-500',
  zip: 'text-amber-600',
  tar: 'text-amber-600',
  gz: 'text-amber-600',
}

export function getFileIcon(name: string, extension: string, isDirectory: boolean, isOpen: boolean): LucideIcon {
  if (isDirectory) {
    return isOpen ? FolderOpen : Folder
  }

  const lowerName = name.toLowerCase()
  if (lowerName === '.gitignore' || lowerName === '.env' || lowerName === 'license') {
    return FileText
  }

  const ext = extension.replace(/^\./, '').toLowerCase()
  return EXTENSION_ICON_MAP[ext] ?? File
}

export function getFileIconColor(extension: string): string {
  const ext = extension.replace(/^\./, '').toLowerCase()
  return COLOR_BY_EXTENSION[ext] ?? 'text-muted-foreground'
}
