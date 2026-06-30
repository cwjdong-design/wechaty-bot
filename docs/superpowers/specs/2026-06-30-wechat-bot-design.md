# 微信个人号 AI 聊天机器人设计

## 概述

基于 Wechaty + wechaty-puppet-wechat (UOS) 构建一个运行在微信个人号上的聊天机器人，能在群里自动回复消息，后期接入 AI 对话能力。

**目标**：用 UOS 协议绕过网页版微信的登录限制，先跑通基础的消息收发，再逐步加入 AI 能力。

**约束**：免费方案，能跑就跑，UOS 登录不上则放弃。

## 架构

```
微信客户端/群聊
      ↕
  微信服务器
      ↕
wechaty-puppet-wechat (UOS 补丁)
  → 启动 Chromium 浏览器（headless）
  → 注入 UOS 协议头（client-version + extspam）
  → 扫码登录微信 Web 协议
      ↕
Wechaty Core (Node.js + TypeScript)
  → 事件驱动：scan / login / message / logout
  → Message / Contact / Room API
      ↕
业务逻辑层
  → 关键词匹配 → 自动回复（阶段一）
  → AI API 调用 → 对话回复（阶段二）
```

## 技术选型

| 层 | 选型 | 版本/说明 |
|---|---|---|
| 运行时 | Node.js | >= 18 LTS |
| 语言 | TypeScript | `ts-node` 直接执行 |
| 核心 SDK | `wechaty` | v1.x（最新稳定版） |
| Puppet | `wechaty-puppet-wechat` | 开启 `uos: true`，headless 模式 |
| 包管理 | npm | — |
| AI（阶段二） | OpenAI 兼容 API | 通用的 chat completions 接口 |

## 分阶段实现

### 阶段一：Ding-Dong 基础验证

**目标**：验证整个链路能跑通——UOS 能否成功登录、能否在群里收发消息。

**功能**：
- 扫码登录微信账号
- 监听所有消息
- 收到 `ding` 回复 `dong`
- 终端打印扫码二维码、登录状态、收到的消息

**代码结构**（单文件 `bot.ts`）：

```typescript
import { WechatyBuilder } from 'wechaty'

const bot = WechatyBuilder.build({
  name: 'ding-dong-bot',
  puppet: 'wechaty-puppet-wechat',
  puppetOptions: {
    uos: true,     // 开启 UOS 协议补丁
    head: false,   // false = 无头模式（不显示浏览器窗口）
  },
})

bot.on('scan', (qrcode, status) => {
  console.log(`扫码登录: ${status}\nhttps://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`)
})

bot.on('login', (user) => {
  console.log(`✅ 登录成功: ${user.name()}`)
})

bot.on('logout', (user) => {
  console.log(`❌ ${user.name()} 已登出`)
})

bot.on('message', async (message) => {
  const text = message.text()
  const room = message.room()
  const talker = message.talker()

  // 忽略自己的消息
  if (message.self()) return

  // Ding-Dong 逻辑
  if (text.trim().toLowerCase() === 'ding') {
    const reply = room
      ? `@${talker.name()} dong~`
      : 'dong~'
    await message.say(reply)
    console.log(`回复: ${talker.name()} → dong`)
  }
})

bot.start()
  .then(() => console.log('机器人启动中...'))
  .catch((e) => console.error('启动失败:', e))
```

**验证标准**：
- [ ] `npm start` 后终端显示扫码二维码
- [ ] 手机微信扫码成功登录
- [ ] 终端显示 "登录成功"
- [ ] 在微信里给机器人发 `ding`，收到 `dong` 回复
- [ ] 在群聊里 @机器人 发 `ding`，收到回复（群昵称）

### 阶段二：接入 AI 对话

**前置条件**：阶段一通过验证。

**新增依赖**：OpenAI SDK（或兼容的 HTTP 请求）

**功能**：
- 群内被 @ 时，把消息转发给 AI，回复结果
- 私聊直接对话
- 按群/按人控制回复频率（避免刷屏和 API 费用失控）
- 支持基础的系统提示词设定机器人人设

**代码结构**（拆分为多文件）：

```
├── bot.ts          # 入口，Wechaty 实例化 + 事件绑定
├── ai.ts           # AI 调用封装（OpenAI 兼容接口）
├── handler.ts      # 消息处理逻辑（匹配规则、AI 调度）
└── config.ts       # 配置（API key、人设 prompt、频率限制等）
```

**消息处理流程**：

```
收到消息
  → 自己的消息？→ 忽略
  → 私聊？→ 直接调用 AI 回复
  → 群里 @了机器人？→ 调用 AI 回复（带有群上下文）
  → 群里没 @？→ 忽略（避免干扰）
```

**频率控制**：
- 每个群/每人 60 秒内最多触发一次 AI 回复
- AI 回复前加简短延迟（模拟人类打字）

**AI 调用封装**：

```typescript
// ai.ts
interface AIConfig {
  apiKey: string
  baseUrl: string   // 兼容 OpenAI / 各种代理
  model: string
  systemPrompt: string
}

async function chat(config: AIConfig, userMessage: string, history: Message[]): Promise<string> {
  // 调用 chat completions API
}
```

## 环境变量

```bash
# 必选
WECHATY_PUPPET=wechaty-puppet-wechat

# 阶段二需要
AI_API_KEY=sk-xxx
AI_BASE_URL=https://api.openai.com/v1  # 或其他兼容端点
AI_MODEL=gpt-4o
```

## 目录结构

```
wechaty-bot/
├── package.json
├── tsconfig.json
├── bot.ts             # 阶段一入口（单文件）
├── src/
│   ├── bot.ts         # 阶段二入口（拆分后）
│   ├── ai.ts          # AI 调用
│   ├── handler.ts     # 消息处理
│   └── config.ts      # 配置管理
├── .env.example       # 环境变量模板
└── .gitignore
```

## 风险与约束

| 风险 | 应对 |
|------|------|
| UOS 协议登录失败 | 终止，不继续投入。换付费方案或放弃 |
| 运行中掉线要求重新扫码 | 这是正常行为，重启进程扫码即可。不做自动重连 |
| 微信账号被限制 | 轻度使用（不群发、不加好友、低频率回复）风险较低 |
| AI API 费用失控 | 频率限制 + 只在被 @ 时才回复 |
| 群消息量大导致 API 狂刷 | 加上时间窗口限制，每群每 60s 最多一次 |

## 不做的事

- 不做自动重连/保活机制
- 不做 Web 管理面板
- 不做多账号支持
- 不做消息持久化存储
- 不主动加好友、不退群、不群发
- 不处理图片/语音/视频消息（只处理文字）
