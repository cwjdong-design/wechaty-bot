/**
 * DeepSeek AI 调用封装（兼容 OpenAI 协议）
 */
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { getSettings } from './settings.js'

function getClient(): OpenAI {
  const s = getSettings()
  return new OpenAI({
    apiKey: s.ai.apiKey,
    baseURL: s.ai.baseURL,
  })
}

/** 对话上下文（按会话 ID 存储，保留最近 10 轮） */
const histories = new Map<string, ChatCompletionMessageParam[]>()

function getHistory(sessionId: string, systemPrompt: string): ChatCompletionMessageParam[] {
  if (!histories.has(sessionId)) {
    histories.set(sessionId, [
      { role: 'system', content: systemPrompt },
    ])
  }
  return histories.get(sessionId)!
}

export async function chat(
  sessionId: string,
  userMessage: string,
): Promise<string> {
  const s = getSettings()
  const client = getClient()
  const history = getHistory(sessionId, s.systemPrompt)

  // 添加用户消息
  history.push({ role: 'user', content: userMessage })

  // 只用最近 10 轮（加上 system prompt 共 21 条）
  while (history.length > 21) {
    // 保留 system prompt（第 0 条），删除最旧的对话
    history.splice(1, 2)
  }

  try {
    const response = await client.chat.completions.create({
      model: s.ai.model,
      messages: history,
      temperature: 0.7,
      max_tokens: 1000,
    })

    const reply = response.choices[0]?.message?.content?.trim() ?? '（出小差了，稍后再试）'

    // 助手回复也存入历史
    history.push({ role: 'assistant', content: reply })

    return reply
  } catch (error: any) {
    if (error?.status) {
      console.error('AI 调用失败:', error.status, error?.message ?? error)
    } else if (error?.response) {
      console.error('AI 调用失败:', JSON.stringify(error.response, null, 2))
    } else {
      console.error('AI 调用失败:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    }
    return '抱歉，我现在脑子有点转不过来，等会儿再试试~'
  }
}
