/**
 * 配置管理 —— 热加载，改 settings.json 无需重启
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SETTINGS_PATH = resolve(__dirname, '..', 'settings.json')

export interface Settings {
  aiEnabled: boolean
  ai: {
    apiKey: string
    baseURL: string
    model: string
  }
  systemPrompt: string
  cooldownSeconds: number
  whitelistUsers: string[]
  whitelistRooms: string[]
}

function loadFromFile(): Settings {
  if (!existsSync(SETTINGS_PATH)) {
    throw new Error(`settings.json 不存在: ${SETTINGS_PATH}`)
  }
  const raw = readFileSync(SETTINGS_PATH, 'utf-8')
  return JSON.parse(raw) as Settings
}

/** 内存中的配置，热加载就是更新这个对象 */
let settings: Settings = loadFromFile()

/** 获取当前配置 */
export function getSettings(): Settings {
  return settings
}

/** 重新从文件读取配置 */
export function reloadSettings(): Settings {
  settings = loadFromFile()
  console.log('🔄 配置已重新加载')
  return settings
}

/** 更新并持久化配置 */
export function updateSettings(patch: Partial<Settings>): Settings {
  settings = { ...settings, ...patch }
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
  console.log('💾 配置已更新并保存')
  return settings
}
