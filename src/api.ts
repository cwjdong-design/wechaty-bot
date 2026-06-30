/**
 * HTTP API 服务 —— 让外部程序调用机器人发消息
 */
import { createServer } from 'http'
import type { Wechaty } from 'wechaty'
import { config } from './config.js'
import { getSettings, reloadSettings, updateSettings } from './settings.js'

function json(res: any, status: number, data: object) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function parseBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: string) => (body += chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch {
        resolve({})
      }
    })
  })
}

export function startApiServer(bot: Wechaty) {
  const { port, token } = config.http

  createServer(async (req, res) => {
    // Token 校验（如果配置了）
    if (token) {
      const url = new URL(req.url || '/', `http://localhost:${port}`)
      if (url.searchParams.get('token') !== token) {
        return json(res, 401, { ok: false, error: 'Token 无效' })
      }
    }

    // POST /send
    if (req.url?.startsWith('/send') && req.method === 'POST') {
      const { to, text } = await parseBody(req)
      if (!to || !text) {
        return json(res, 400, { ok: false, error: '缺少 to 或 text 参数' })
      }

      // 白名单检查
      const s = getSettings()
      if (s.whitelistUsers.length > 0 && !s.whitelistUsers.some(name => to.includes(name))) {
        return json(res, 403, { ok: false, error: `"${to}" 不在白名单中` })
      }

      const contacts = await bot.Contact.findAll({ name: to })
      console.log(`🔍 查找"${to}": 找到 ${contacts.length} 个匹配: ${contacts.map(c => `${c.name()}(${c.type()})`).join(', ')}`)
      if (contacts.length === 0) {
        return json(res, 404, { ok: false, error: `未找到联系人: ${to}` })
      }
      // 过滤：只要个人好友，排除公众号、机器人自己
      const selfId = bot.currentUser?.id
      const targets = contacts.filter(c => c.id !== selfId && c.type() === 1) // 1 = Individual
      if (targets.length === 0) {
        return json(res, 404, { ok: false, error: `找到的联系人是机器人自己: ${to}` })
      }
      for (const c of targets) {
        await c.say(text)
      }
      const names = targets.map(c => c.name()).join(', ')
      console.log(`📤 API发送 → [${names}]: "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`)
      return json(res, 200, { ok: true, message: `已发送给 ${names}`, count: targets.length })
    }

    // POST /room/send
    if (req.url?.startsWith('/room/send') && req.method === 'POST') {
      const { room, text } = await parseBody(req)
      if (!room || !text) {
        return json(res, 400, { ok: false, error: '缺少 room 或 text 参数' })
      }

      // 白名单检查
      const s = getSettings()
      if (s.whitelistRooms.length > 0 && !s.whitelistRooms.some(name => room.includes(name) || s.whitelistRooms.includes(room))) {
        return json(res, 403, { ok: false, error: `"${room}" 不在群白名单中` })
      }

      // 按关键词查找群（模糊匹配）
      const rooms = await bot.Room.findAll({ topic: new RegExp(room) })
      console.log(`🔍 查找群"${room}": 找到 ${rooms.length} 个匹配`)
      if (rooms.length === 0) {
        return json(res, 404, { ok: false, error: `未找到群: ${room}` })
      }
      const roomObj = rooms[0]
      if (!roomObj) {
        return json(res, 404, { ok: false, error: `未找到群: ${room}` })
      }
      await roomObj.say(text)
      const topic = await roomObj.topic()
      console.log(`📤 API发送 → 群"${topic}": "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`)
      return json(res, 200, { ok: true, message: `已发送到群 ${topic}` })
    }

    // POST /config/reload —— 从 settings.json 重新加载
    if (req.url?.startsWith('/config/reload') && req.method === 'POST') {
      const s = reloadSettings()
      return json(res, 200, { ok: true, message: '配置已重新加载', settings: s })
    }

    // POST /config —— 更新配置并持久化
    if (req.url?.startsWith('/config') && req.method === 'POST') {
      const patch = await parseBody(req)
      if (!patch || Object.keys(patch).length === 0) {
        return json(res, 400, { ok: false, error: '缺少配置参数' })
      }
      const s = updateSettings(patch)
      return json(res, 200, { ok: true, message: '配置已更新', settings: s })
    }

    // GET /config —— 查看当前配置
    if (req.url?.startsWith('/config') && req.method === 'GET') {
      return json(res, 200, getSettings())
    }

    // POST /health 健康检查
    if (req.url?.startsWith('/health')) {
      return json(res, 200, { ok: true, loggedIn: bot.isLoggedIn })
    }

    json(res, 404, { ok: false, error: '未知接口' })
  }).listen(port, '127.0.0.1', () => {
    console.log(`🌐 HTTP API 已启动: http://127.0.0.1:${port}`)
  })
}
