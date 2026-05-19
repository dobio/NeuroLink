# NeuroLink Code Agent

一个本地 TypeScript MVP，用于验证类似 Claude Code 的命令行代码 Agent。

## 安装

```bash
npm install
```

## 运行

未配置 API Key 时，CLI 会使用占位模型客户端：

```bash
npm run dev -- "explain this project"
```

使用 Anthropic Messages API：

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run dev -- "search for TODO comments"
```

可选：指定模型：

```bash
ANTHROPIC_MODEL=claude-sonnet-4-5 ANTHROPIC_API_KEY=sk-ant-... npm run dev -- "summarize the codebase"
```

可选：指定自定义 Anthropic 兼容服务地址：

```bash
ANTHROPIC_BASE_URL=https://proxy.example.com/anthropic/v1 ANTHROPIC_API_KEY=sk-ant-... npm run dev -- "summarize the codebase"
```

`ANTHROPIC_BASE_URL` 默认值为 `https://api.anthropic.com/v1`。传入地址时可以带末尾斜杠，客户端会自动拼接 `/messages`。

## 工具

当前 Agent 暴露以下工具：

- `read_file`：读取工作区内的 UTF-8 文件。
- `list_files`：列出文件，并排除 `.git`、`node_modules` 和 `dist`。
- `search_files`：在工作区文件中执行纯文本搜索。
- `apply_patch`：应用 Git 风格 unified diff，可修改、新增或删除工作区内文件。
- `run_command`：在交互确认后运行 shell 命令。

## 安全

工作区解析器会拒绝当前工作目录之外的文件路径。Shell 命令仍会通过本地 shell 执行，因此在加入更强的命令策略之前，请将这个 MVP 限制在个人使用场景中。

## 验证

```bash
npm test
```
