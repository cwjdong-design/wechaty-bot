/**
 * 消息处理模块
 * - 群里被 @ 机器人时触发 AI 回复
 * - 私聊直接 AI 对话
 * - 频率控制避免刷屏
 */
import type { Message } from 'wechaty'
import { chat } from './ai.js'
import { getSettings } from './settings.js'

/** 记录每个会话上次 AI 回复的时间戳 */
const lastReplyTime = new Map<string, number>()

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function handleMessage(message: Message) {
  // 忽略自己的消息
  if (message.self()) return

  const text = message.text().trim()
  if (!text) return

  const room = message.room()
  const talker = message.talker()

  // ====== Ding-Dong 保留（快速测试用） ======
  if (text.toLowerCase() === 'ding') {
    const reply = room ? `@${talker.name()} dong~` : 'dong~'
    await message.say(reply)
    console.log(`💬 Ding-Dong: ${talker.name()} → dong`)
    return
  }

  // ====== AI 对话（如果关闭 AI，只保留 ding-dong）======
  const s = getSettings()
  if (!s.aiEnabled) return
  const isPrivate = !room

  // 私聊：检查用户白名单
  if (isPrivate && s.whitelistUsers.length > 0) {
    if (!s.whitelistUsers.some(name => talker.name().includes(name))) {
      console.log(`🚫 非白名单用户: ${talker.name()}`)
      return
    }
  }

  // 群聊：检查群白名单
  if (!isPrivate && s.whitelistRooms.length > 0) {
    const topic = await room!.topic()
    if (!s.whitelistRooms.some(keyword => topic.includes(keyword))) {
      console.log(`🚫 非白名单群: ${topic}`)
      return
    }
  }

  // 群聊：只有 @了机器人 才回复
  if (!isPrivate && !(await message.mentionSelf())) {
    return
  }

  // 频率控制
  const sessionId = isPrivate ? talker.id : room!.id
  const now = Date.now()
  const last = lastReplyTime.get(sessionId) ?? 0
  if (now - last < s.cooldownSeconds * 1000) {
    console.log(`⏳ 频率限制，跳过: ${talker.name()}`)
    return
  }
  lastReplyTime.set(sessionId, now)

  // 清理 @ 标记，提取纯文本
  let prompt = text
  if (!isPrivate) {
    // 去掉机器人被 @ 的部分，保留真实问题
    prompt = text.replace(/@[^\s]+\s*/g, '').trim()
    if (!prompt) {
      // 只 @ 了机器人没说话
      await message.say(`@${talker.name()} 我在呢，有什么事？`)
      return
    }
  }

  console.log(`🤖 AI 请求: ${talker.name()} → "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`)

  // 模拟打字延迟（500~1500ms）
  await delay(500 + Math.random() * 1000)

  // 调用 AI
  const reply = await chat(sessionId, prompt)

  // 群聊回复加上 @
  const finalReply = isPrivate ? reply : `@${talker.name()} ${reply}`

  await message.say(finalReply)
  console.log(`💬 AI 回复: → ${talker.name()}: "${reply.slice(0, 60)}${reply.length > 60 ? '...' : ''}"`)
}
