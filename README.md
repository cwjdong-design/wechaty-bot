# 微信机器人 —— HTTP API 发通知 + 可选 AI 回复

基于 [Wechaty](https://github.com/wechaty/wechaty) 的微信个人号机器人，核心能力是通过 HTTP API 给联系人和群聊发消息，可选开启 AI 自动回复。

## 环境要求

- Node.js >= 18（推荐 LTS）
- 一个能登录的微信号（小号更安全）

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置
cp settings.example.json settings.json
# 编辑 settings.json，填白名单等

# 3. 启动
npm start
# 终端会显示登录二维码，手机微信扫码
```

## 配置说明

编辑 `settings.json`，支持热加载（改完不用重启）：

| 字段 | 说明 |
|------|------|
| `aiEnabled` | `true` 开启 AI 回复，`false` 仅作通知工具 |
| `ai.apiKey` | AI API Key（DeepSeek/OpenAI 等） |
| `ai.baseURL` | AI API 地址 |
| `ai.model` | 模型名称 |
| `whitelistUsers` | 允许触发 AI 的用户（微信昵称模糊匹配） |
| `whitelistRooms` | 允许触发 AI 的群（群名模糊匹配） |
| `cooldownSeconds` | AI 回复冷却时间（秒） |

热加载配置：
```bash
# 更新配置
curl -X POST http://127.0.0.1:3000/config -d '{"whitelistUsers":["张三","李四"]}'

# 从文件重新加载
curl -X POST http://127.0.0.1:3000/config/reload

# 查看当前配置
curl http://127.0.0.1:3000/config
```

## HTTP API

服务监听 `127.0.0.1:3000`，仅本机可访问。

### 发消息给联系人

```bash
curl -X POST http://127.0.0.1:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"张三","text":"服务器部署完成 ✅"}'
```

### 给群发消息

```bash
curl -X POST http://127.0.0.1:3000/room/send \
  -H "Content-Type: application/json" \
  -d '{"room":"技术群","text":"@所有人 开会了"}'
```

### 健康检查

```bash
curl http://127.0.0.1:3000/health
```

## 注意事项

- 基于微信 Web 协议，偶尔需要重新扫码，属正常现象
- 不要高频群发、批量加好友，降低账号风险
- 建议用小号运行，不与主号混用
- 改代码 `npm start` 会自动重启（tsx watch），但需重新扫码

## 项目结构

```
├── bot.ts              # 入口
├── settings.json       # 配置（热加载）
├── settings.example.json
├── package.json
└── src/
    ├── api.ts          # HTTP API 服务
    ├── ai.ts           # AI 调用
    ├── handler.ts      # 消息处理（白名单 + AI 调度）
    ├── config.ts       # 框架配置
    └── settings.ts     # 配置管理
```
