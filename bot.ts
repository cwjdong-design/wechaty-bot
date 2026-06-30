/**
 * Wechaty 微信 AI 机器人入口
 */
import { WechatyBuilder } from 'wechaty'
import { handleMessage } from './src/handler.js'
import { startApiServer } from './src/api.js'

const bot = WechatyBuilder.build({
  name: 'wechat-ai-bot',
  puppet: 'wechaty-puppet-wechat',
  puppetOptions: {
    uos: true,
    head: false,
  },
})

bot.on('scan', (qrcode, status) => {
  console.log(`\n📱 扫码登录`)
  // 方式1：wechaty.js.org 渲染（方便）
  console.log(`🔗 https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`)
  // 方式2：原始链接（备份，用任意二维码生成器都能扫）
  console.log(`🔗 ${qrcode}\n`)
})

bot.on('login', (user) => {
  console.log(`✅ 登录成功: ${user.name()}\n`)
  startApiServer(bot)
})

bot.on('logout', (user) => {
  console.log(`❌ ${user.name()} 已登出\n`)
})

bot.on('message', handleMessage)

bot.start()
  .then(() => console.log('🤖 AI 机器人启动中...\n'))
  .catch((e) => console.error('启动失败:', e))
