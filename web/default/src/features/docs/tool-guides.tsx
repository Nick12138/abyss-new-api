/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  KeyRound,
  LinkIcon,
  Terminal,
} from 'lucide-react'
import { SiApple, SiLinux, SiNodedotjs } from 'react-icons/si'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { getPricing } from '@/features/pricing/api'
import type { PricingModel } from '@/features/pricing/types'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PublicLayout } from '@/components/layout'
import type { ComponentType } from 'react'

type ToolId =
  | 'config-intro'
  | 'nodejs'
  | 'claude-code'
  | 'codex'
  | 'gemini-cli'
  | 'openclaw'
  | 'cherry-studio'
  | 'cursor'
  | 'cline'
  | 'continue'
  | 'chatbox'
  | 'opencode'
  | 'open-webui'
  | 'lobechat'
  | 'cc-switch'
  | 'troubleshooting'
type SystemId = 'mac' | 'windows' | 'linux'

type CommandBlock = {
  title: string
  language: 'bash' | 'powershell' | 'toml' | 'json' | 'yaml' | 'env' | 'text'
  code: string
  note?: string
}

type PracticalReference = {
  screenshotTitle: string
  screenshotDescription: string
  screenshots?: ScreenshotPlaceholder[]
  checklist: string[]
}

type ScreenshotPlaceholder = {
  title: string
  description: string
  imageUrl?: string
}

type GuideStep = {
  title: string
  description: string
  commands: Partial<Record<SystemId, CommandBlock[]>>
  reference?: PracticalReference
  openUrl?: string
  tip?: string
}

type ToolGuide = {
  id: ToolId
  name: string
  iconNames: string[]
  imageUrl?: string
  summary: string
  modelHint: string
  modelHintUrl?: string
  endpointTypes?: string[]
  useAllPricingModels?: boolean
  copyValue?: string
  copyLabel?: string
  steps: GuideStep[]
}

const recommendedTools: ToolId[] = ['claude-code', 'cursor', 'cherry-studio']

const serviceUrl = 'https://abyssai.cc'
const endpoint = `${serviceUrl}/v1`
const apiKey = 'sk-your-abyssai-key'

const systemOptions: {
  id: SystemId
  label: string
  icon: ComponentType<{ className?: string }>
  iconClassName: string
}[] = [
  {
    id: 'mac',
    label: 'macOS',
    icon: SiApple,
    iconClassName: 'text-neutral-950 dark:text-neutral-50',
  },
  {
    id: 'windows',
    label: 'Windows',
    icon: WindowsLogo,
    iconClassName: 'text-[#0078D4]',
  },
  {
    id: 'linux',
    label: 'Linux',
    icon: SiLinux,
    iconClassName: 'text-neutral-950 dark:text-neutral-50',
  },
]

function WindowsLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='currentColor'
      aria-hidden='true'
    >
      <path d='M3 4.2 10.6 3v8.2H3V4.2Zm8.6-1.35L21 1.4v9.8h-9.4V2.85ZM3 12.8h7.6V21L3 19.8v-7Zm8.6 0H21v9.8l-9.4-1.45V12.8Z' />
    </svg>
  )
}

function allSystems(commands: CommandBlock[]) {
  return {
    mac: commands,
    windows: commands,
    linux: commands,
  }
}

function shellSystems(mac: CommandBlock[], windows: CommandBlock[], linux = mac) {
  return {
    mac,
    windows,
    linux,
  }
}

const docZhText: Record<string, string> = {
  'API configuration guide': 'API 配置教程',
  'Tool setup tutorials': '工具配置教程',
  'Configure popular coding tools to connect to your unified API gateway, with install, configuration, startup, and verification steps for each operating system.':
    '按照工具和系统整理 API 中转配置流程，包含安装、配置、启动、验证和常见问题排查。',
  'Step by step': '分步教程',
  'Practical reference operations': '实际参考操作',
  'Copy code': '复制代码',
  Copy: '复制',
  Loading: '加载中',
  'Quick start': '快速开始',
  Recommended: '推荐',
  'No models found': '没有可用模型',
  'Configuration overview': '配置介绍',
  'Node.js installation': 'Node.js 安装',
  'Start here: copy the Abyss AI service address, create an API key, and confirm which base URL each tool needs.':
    '从服务地址开始，获取 API Key，然后通过 Playground 快速体验对话能力。',
  'Copy service address': '复制服务地址',
  'Open page': '打开页面',
  'Service address': '服务地址',
  'The API service address is https://abyssai.cc. Click the copy button before pasting it into tools or configuration files.':
    'API 服务地址是 https://abyssai.cc。填写工具配置前，建议先复制服务地址并确认工具要求的是站点根地址还是 /v1 地址。',
  'API service address': 'API 服务地址',
  'OpenAI compatible base URL': 'OpenAI 兼容 Base URL',
  'Use this /v1 address for tools that ask for an OpenAI-compatible base URL.':
    '当工具要求填写 OpenAI-compatible Base URL 时，通常使用这个 /v1 地址。',
  'Get an API key': '获取 API Key',
  'Create an API key from the console and keep it secure. The key is required for all tool configurations and the Playground.':
    '在控制台创建 API Key 并妥善保管。所有工具配置都需要此密钥，请勿将密钥透露。',
  'Open the API Keys page': '打开 API 密钥页面',
  'Open the API Keys page from the left sidebar of the console.':
    '从控制台左侧导航栏进入「API 密钥」页面。',
  'Create a new key': '创建新密钥',
  'Click the create button, enter a name for the key, select the model group that corresponds to the models you want to use, and save.':
    '点击创建按钮，填写密钥名称，选择与目标模型对应的模型分组，然后保存。',
  'Copy the key': '复制密钥',
  'After the key is created, copy it immediately. The full key is only shown once — store it somewhere safe and never share it publicly.':
    '密钥创建成功后请立即复制并妥善保存。完整密钥仅在创建时显示一次，请勿泄露或分享。',
  'Screenshot placeholder: API Keys page': '截图占位：API 密钥页面',
  'Add a screenshot that highlights the create button and the key list on the API Keys page.':
    '这里后续补一张截图，标出 API 密钥页面的创建按钮和密钥列表。',
  'Screenshot placeholder: open and create key': '截图占位：打开并创建密钥',
  'Add a screenshot that highlights the API Keys page and the create button.':
    '',
  'Screenshot placeholder: key name and group': '截图占位：密钥名称和分组',
  'Add a screenshot that highlights the name field, group selector, and save button.':
    '注意：选择的分组跟请求的模型一定要对应，否则无法使用，提示该分c组下无请求的模型',
  'Screenshot placeholder: copy key': '截图占位：复制密钥',
  'Add a screenshot that highlights the copy button next to the newly created key.':
    '',
  'Open the API Keys page and click the create button.': '打开 API 密钥页面并点击创建按钮。',
  'Enter a name, select the correct model group, and save.': '输入名称，选择正确的模型分组，然后保存。',
  'Copy the key and store it securely.': '复制密钥并妥善保存。',
  'Quick tryout': '快速体验',
  'Use the built-in 游乐场 to verify connectivity before configuring external tools. Select a group, pick a model, and start a conversation right away.':
    '选择分组和模型后即可直接在后台开始对话。',
  'Screenshot placeholder: 游乐场 page': '截图占位：游乐场页面',
  'Add a screenshot that highlights the group selector, model selector, and chat input on the 游乐场 page.':
    '这里后续补一张截图，标出游乐场页面的分组选择器、模型选择器和聊天输入框。',
  'Screenshot placeholder: open 游乐场': '截图占位：打开游乐场',
  'Add a screenshot that shows how to open the 游乐场 from the console sidebar.':
    '注意：选择的分组跟请求的模型一定要对应，否则无法使用，提示该分组下无请求的模型',
  'Screenshot placeholder: select and chat': '截图占位：选择模型并对话',
  'Add a screenshot that highlights the group selector, model selector, chat input, and a successful response.':
    '',
  'Open the 游乐场 from the console sidebar.': '从控制台左侧导航栏打开游乐场，选择正确的分组和模型，发送一条测试消息。',
  'Select a group, pick a model, send a test message, and confirm the response.':
    '确认成功收到回复。',
  'Environment variable example': '环境变量示例',
  'Connection notes': '连接注意事项',
  'Most CLI tools need a fresh terminal after changing environment variables. If a tool cannot connect, check the base URL, API key, model name, and whether the selected model is available in your account.':
    '多数 CLI 工具修改环境变量后需要重新打开终端。如果连接失败，优先检查 Base URL、API Key、模型名称和账号是否有权限调用该模型。',
  'Quick endpoint check': '快速接口检查',
  'Install Node.js and npm first, because most coding CLI tools in this guide are distributed through npm.':
    '先安装 Node.js 和 npm，因为多数编程类 CLI 工具都通过 npm 分发或依赖 Node.js 运行环境。',
  Install: '安装',
  'Install Node.js (latest LTS). The recommended path is Homebrew on macOS, winget on Windows, and nvm on Linux.':
    '安装最新 LTS 版本的 Node.js。macOS 推荐 Homebrew，Windows 推荐 winget，Linux 推荐 nvm。',
  'Install with Homebrew': '使用 Homebrew 安装',
  'If brew is not installed, install Homebrew first from https://brew.sh.':
    '如果还没有安装 brew，请先从 https://brew.sh 安装 Homebrew。',
  'Install with winget': '使用 winget 安装',
  'Restart PowerShell after installation if node is not found.':
    '安装后如果找不到 node 命令，请重新打开 PowerShell。',
  'Install with nvm': '使用 nvm 安装',
  'Using nvm avoids permission problems when installing global npm packages.':
    '使用 nvm 可以避免全局安装 npm 包时遇到权限问题。',
  'Configure npm global path': '配置 npm 全局路径',
  'Make sure globally installed CLI commands can be found from a new terminal window.':
    '确认全局安装的 CLI 命令能在新终端窗口中被找到。',
  'Check npm global path': '检查 npm 全局路径',
  'Verify Setup': '验证安装',
  'Run a small verification command before installing Claude Code, Codex, Gemini CLI, or OpenClaw.':
    '在安装 Claude Code、Codex、Gemini CLI 或 OpenClaw 前，先运行一次基础验证。',
  'Node.js verification': 'Node.js 验证',
  'Use Claude Code through an Anthropic-compatible endpoint exposed by your gateway.':
    '通过暴露的 Anthropic 兼容接口使用 Claude Code。',
  'Install Node.js first, then install the Claude Code command line tool.':
    '安装 Claude Code 命令行工具。',
  'Install with npm': '使用 npm 安装',
  'Configure API': '配置 API',
  'Edit the Claude Code settings file to point it to your gateway. Save the file and open a new terminal to apply.':
    '编辑 Claude Code 的配置文件，保存后打开新终端即可生效。',
  'Edit settings file': '编辑配置文件',
  'Replace the model values with the model you want to use. Open a new terminal after saving.':
    '将模型值替换为你要使用的模型。保存后打开新终端即可生效。',
  Start: '启动',
  'Open a project directory and start an interactive Claude Code session.':
    '进入项目目录并启动 Claude Code 交互会话。',
  'Run in a project': '在项目中运行',
  'Configure Codex with an OpenAI-compatible provider backed by your gateway.':
    '使用 Codex cli 安装、配置和请求 OpenAI 兼容模型服务。',
  'Install the Codex CLI globally, then confirm the binary is available.':
    '全局安装 Codex CLI，并确认命令可以正常运行。',
  'Edit the Codex auth and config files to connect to your gateway. Save and open a new terminal to apply.':
    '编辑 Codex 的认证和配置文件，保存后打开新终端即可生效。',
  'Start Codex in your repository and ask it to inspect the project.':
    '在仓库目录中启动 Codex，并先让它完成一次只读检查。',
  'Use Gemini CLI with GEMINI_API_KEY and a Gemini model for command line workflows.':
    '使用 GEMINI_API_KEY 和 Gemini 模型配置 Gemini CLI。',
  'Install Gemini CLI with npm, then confirm the gemini command is available.':
    '通过 npm 安装 Gemini CLI，并确认 gemini 命令可用。',
  'Edit the Gemini CLI config files to connect to your gateway. Save and open a new terminal to apply.':
    '编辑 Gemini CLI 的配置文件，保存后打开新终端即可生效。',
  'Start Gemini CLI in a project directory and run a small smoke test.':
    '在项目目录中启动 Gemini CLI，并运行一次简单测试。',
  'Configure OpenClaw with an OpenAI-compatible gateway and run it in your project.':
    '将 OpenClaw 配置为连接 OpenAI 兼容中转接口，并在项目中运行。',
  'Install OpenClaw after Node.js and the CLI runtime are ready.':
    '确认 Node.js 和 CLI 运行环境可用后，再安装 OpenClaw。',
  'Point OpenClaw to your OpenAI-compatible gateway and read the key from OPENAI_API_KEY.':
    '把 OpenClaw 指向 OpenAI 兼容中转接口，并从 OPENAI_API_KEY 读取 Key。',
  'Start OpenClaw in a project directory after the API key is available.':
    'API Key 生效后，在项目目录中启动 OpenClaw。',
  'Connect Cherry Studio as an OpenAI-compatible desktop client, add models from the live pricing list, and verify the provider before chatting.':
    '把 Cherry Studio 作为 OpenAI 兼容桌面客户端接入，按实时模型列表添加模型，并在聊天前完成服务商检查。',
  'Install Cherry Studio': '安装 Cherry Studio',
  'Download Cherry Studio for your operating system, install it, and open the app before adding a custom model provider.':
    '下载对应系统版本的 Cherry Studio，安装并打开应用，然后再添加自定义模型服务商。',
  'Open download page': '打开下载页面',
  'Download the macOS .dmg or .zip package, then drag Cherry Studio into Applications.':
    '下载 macOS 的 .dmg 或 .zip 安装包，然后把 Cherry Studio 拖入 Applications。',
  'Download the Windows setup.exe installer or portable package. Windows 7 is not supported by Cherry Studio.':
    '下载 Windows setup.exe 安装包或便携版。Cherry Studio 不支持 Windows 7。',
  'Install Linux package': '安装 Linux 软件包',
  'Choose the package that matches your CPU architecture from the official release page.':
    '请在官方发布页选择和 CPU 架构匹配的软件包。',
  'Screenshot placeholder: Cherry Studio download page': '截图占位：Cherry Studio 下载页面',
  'Add a screenshot that highlights the Windows, macOS, and Linux download entries.':
    '这里后续补一张截图，标出 Windows、macOS 和 Linux 下载入口。',
  'Open the official Cherry Studio download page.': '打开 Cherry Studio 官方下载页面。',
  'Download the package that matches the current operating system and CPU architecture.':
    '下载匹配当前系统和 CPU 架构的安装包。',
  'Install and launch Cherry Studio once.': '完成安装并启动一次 Cherry Studio。',
  'Confirm the Settings entry is visible in the left sidebar.':
    '确认左侧边栏可以看到 Settings 设置入口。',
  'Add an OpenAI provider': '添加 OpenAI 服务商',
  'Open Settings, enter Model Services, add a provider, and choose OpenAI as the provider type for the gateway.':
    '进入 Settings 的 Model Services，添加服务商，并选择 OpenAI 作为服务网站的服务商类型。',
  'Provider fields': '服务商字段',
  'Cherry Studio usually asks for the service root address here. Do not paste the full /v1/chat/completions path.':
    'Cherry Studio 这里通常填写服务根地址，不要粘贴完整的 /v1/chat/completions 路径。',
  'Screenshot placeholder: add provider dialog': '截图占位：添加服务商弹窗',
  'Add a screenshot of Settings -> Model Services -> Add, with Provider Type set to OpenAI.':
    '这里后续补 Settings -> Model Services -> Add 的截图，并标出 Provider Type 选择 OpenAI。',
  'Click the Settings icon in Cherry Studio.': '点击 Cherry Studio 的 Settings 图标。',
  'Open Model Services.': '打开 Model Services。',
  'Click Add at the bottom of the provider list.': '点击服务商列表底部的 Add。',
  'Set the provider name to Abyss AI and provider type to OpenAI.':
    '服务商名称填写 Abyss AI，服务商类型选择 OpenAI。',
  'Confirm the provider is created.': '确认服务商创建完成。',
  'Fill API key and model': '填写 API Key 和模型',
  'Paste the API key, use the correct API address, add the exact model ID, then run the built-in check and enable the provider.':
    '粘贴 API Key，填写正确 API 地址，添加精确模型 ID，然后运行内置检查并启用服务商。',
  'Recommended values': '推荐填写值',
  'If the request returns 404, check whether /v1 or /chat/completions was duplicated by the client.':
    '如果请求返回 404，请检查客户端是否重复拼接了 /v1 或 /chat/completions。',
  'Manual model examples': '手动模型示例',
  'Only add model IDs that exist in the live pricing list and that your account can call.':
    '只添加实时模型列表中存在、且当前账号有权限调用的模型 ID。',
  'Screenshot placeholder: provider configuration page': '截图占位：服务商配置页面',
  'Add a screenshot that marks API Key, API address, model management, Check, and the enable switch.':
    '这里后续补服务商配置截图，并标出 API Key、API address、模型管理、Check 和启用开关。',
  'Paste the API key into the API Key field.': '把 API Key 粘贴到 API Key 字段。',
  'Paste the API address exactly as shown in this guide.':
    '按照本教程展示的格式粘贴 API 地址。',
  'Open model management and add the selected model ID.':
    '打开模型管理并添加当前选择的模型 ID。',
  'Click Check to test the provider.': '点击 Check 测试服务商。',
  'Turn on the provider switch so the model appears in chat.':
    '打开服务商启用开关，让模型出现在聊天模型列表中。',
  'Start a chat test': '开始聊天测试',
  'Create a new conversation, choose the added model, and send a short test prompt to confirm the relay path works.':
    '新建会话，选择刚添加的模型，发送一条短提示词，确认中转链路可用。',
  'Smoke test prompt': '冒烟测试提示词',
  'Screenshot placeholder: chat model selector': '截图占位：聊天模型选择器',
  'Add a screenshot of the chat page with the Abyss AI model selected.':
    '这里后续补聊天页面截图，并展示已选择 Abyss AI 模型。',
  'Create a new chat.': '新建一个聊天。',
  'Select the model added under the Abyss AI provider.':
    '选择 Abyss AI 服务商下刚添加的模型。',
  'Send the smoke test prompt.': '发送冒烟测试提示词。',
  'If no model appears, return to Model Services and confirm the provider switch is enabled.':
    '如果看不到模型，回到 Model Services 确认服务商开关已经启用。',
  'Configure Cursor to use a custom OpenAI-compatible base URL, add an exact model ID, and verify it in the chat panel.':
    '配置 Cursor 使用自定义 OpenAI 兼容 Base URL，添加精确模型 ID，并在聊天面板中验证。',
  'Open Cursor model settings': '打开 Cursor 模型设置',
  'Install or open Cursor, then go to Cursor Settings, Models, and API Keys.':
    '安装或打开 Cursor，然后进入 Cursor Settings、Models、API Keys。',
  'Settings path': '设置路径',
  'Screenshot placeholder: Cursor model settings': '截图占位：Cursor 模型设置',
  'Add a screenshot that highlights Models and API Keys in Cursor Settings.':
    '这里后续补一张截图，标出 Cursor Settings 中的 Models 和 API Keys。',
  'Configure OpenAI API key': '配置 OpenAI API Key',
  'Fill the OpenAI API Key field and override the OpenAI Base URL with the gateway /v1 endpoint.':
    '填写 OpenAI API Key，并将 OpenAI Base URL 覆盖为服务网站 /v1 地址。',
  'Cursor OpenAI-compatible values': 'Cursor OpenAI 兼容配置值',
  'Some Cursor versions label this field OpenAI Base URL. The setting can affect all OpenAI-routed Cursor chat models.':
    '部分 Cursor 版本会把该字段显示为 OpenAI Base URL。这个设置可能影响所有走 OpenAI 路由的 Cursor 聊天模型。',
  'Screenshot placeholder: Cursor API key and base URL': '截图占位：Cursor API Key 和 Base URL',
  'Add a screenshot that marks OpenAI API Key, Override OpenAI Base URL, and Verify.':
    '这里后续补截图，并标出 OpenAI API Key、Override OpenAI Base URL 和 Verify。',
  'Add custom model': '添加自定义模型',
  'Open View All Models or Add Custom Model, enter the exact model ID, enable it, then test from Cursor Chat.':
    '打开 View All Models 或 Add Custom Model，输入精确模型 ID，启用后在 Cursor Chat 中测试。',
  'Model test prompt': '模型测试提示词',
  'Screenshot placeholder: Cursor custom model': '截图占位：Cursor 自定义模型',
  'Add a screenshot of the custom model entry and the model selected in Cursor Chat.':
    '这里后续补自定义模型条目，以及 Cursor Chat 中已选择模型的截图。',
  'Use Cline with the OpenAI Compatible provider by filling Base URL, API Key, and Model ID.':
    '在 Cline 中选择 OpenAI Compatible 服务商，并填写 Base URL、API Key 和 Model ID。',
  'Install Cline': '安装 Cline',
  'Install Cline in VS Code or a compatible editor, then open the Cline side panel settings.':
    '在 VS Code 或兼容编辑器中安装 Cline，然后打开 Cline 侧边栏设置。',
  'Extension search keyword': '扩展搜索关键词',
  'Screenshot placeholder: Cline extension page': '截图占位：Cline 扩展页面',
  'Add a screenshot of the extension page or the Cline side panel.':
    '这里后续补扩展页面或 Cline 侧边栏截图。',
  'Select OpenAI Compatible': '选择 OpenAI Compatible',
  'In Cline provider settings, choose OpenAI Compatible instead of the official OpenAI provider.':
    '在 Cline 服务商设置中选择 OpenAI Compatible，不要选择官方 OpenAI 服务商。',
  'Cline provider values': 'Cline 服务商配置值',
  'The Model ID must match one model returned by the pricing API.':
    'Model ID 必须匹配 pricing 接口实时返回的某个模型。',
  'Screenshot placeholder: Cline provider settings': '截图占位：Cline 服务商设置',
  'Add a screenshot that marks API Provider, Base URL, API Key, and Model ID.':
    '这里后续补截图，并标出 API Provider、Base URL、API Key 和 Model ID。',
  'Verify in Cline': '在 Cline 中验证',
  'Save the provider, run the built-in verification if available, and ask Cline to complete a small task.':
    '保存服务商配置；如果有内置验证则先运行验证，然后让 Cline 完成一个小任务。',
  'Small task': '小任务',
  'Screenshot placeholder: Cline test result': '截图占位：Cline 测试结果',
  'Add a screenshot showing Cline responding with the selected provider.':
    '这里后续补一张 Cline 使用所选服务商响应的截图。',
  'Configure Continue with provider openai, apiBase, apiKey, and an exact model ID in config.yaml.':
    '在 Continue 的 config.yaml 中配置 provider openai、apiBase、apiKey 和精确模型 ID。',
  'Open Continue configuration': '打开 Continue 配置',
  'Install Continue, open its configuration file, and add a model entry for the gateway.':
    '安装 Continue，打开配置文件，并为服务网站添加一个模型配置项。',
  'Common config path': '常见配置路径',
  'Screenshot placeholder: Continue config entry': '截图占位：Continue 配置入口',
  'Add a screenshot of Continue settings or the opened config.yaml file.':
    '这里后续补 Continue 设置页或已打开的 config.yaml 截图。',
  'Add OpenAI-compatible model': '添加 OpenAI 兼容模型',
  'Use provider openai, set apiBase to the gateway /v1 endpoint, and set model to the selected model ID.':
    'provider 使用 openai，apiBase 填服务网站 /v1 地址，model 填当前选择的模型 ID。',
  'config.yaml model entry': 'config.yaml 模型配置',
  'Continue uses apiBase. The name field is only the local display name; model is the ID sent to the API.':
    'Continue 使用 apiBase 字段。name 只是本地显示名，真正发送给 API 的是 model。',
  'Screenshot placeholder: Continue YAML model': '截图占位：Continue YAML 模型配置',
  'Add a screenshot that highlights provider, model, apiBase, and apiKey.':
    '这里后续补截图，并标出 provider、model、apiBase 和 apiKey。',
  'Reload and test Continue': '重载并测试 Continue',
  'Reload the editor or Continue extension, select the configured model name, and run a chat or edit request.':
    '重载编辑器或 Continue 扩展，选择配置好的模型名称，然后发起一次聊天或编辑请求。',
  'Test prompt': '测试提示词',
  'Screenshot placeholder: Continue model selector': '截图占位：Continue 模型选择器',
  'Add a screenshot of the configured Abyss AI model selected in Continue.':
    '这里后续补 Continue 中已选择 Abyss AI 模型的截图。',
  'Add Abyss AI as an OpenAI API compatible provider in Chatbox and run a quick conversation test.':
    '在 Chatbox 中把 Abyss AI 添加为 OpenAI API compatible 服务商，并完成一次快速聊天测试。',
  'Install Chatbox': '安装 Chatbox',
  'Install Chatbox on Windows, macOS, or Linux, then open Settings and Model Provider.':
    '在 Windows、macOS 或 Linux 上安装 Chatbox，然后打开 Settings 和 Model Provider。',
  'Download page': '下载页面',
  'Screenshot placeholder: Chatbox settings': '截图占位：Chatbox 设置',
  'Add a screenshot of Settings -> Model Provider.':
    '这里后续补 Settings -> Model Provider 的截图。',
  'Add OpenAI API compatible provider': '添加 OpenAI API compatible 服务商',
  'Choose OpenAI API compatible, fill API Host, API Key, and add at least one model ID.':
    '选择 OpenAI API compatible，填写 API Host、API Key，并至少添加一个模型 ID。',
  'Chatbox provider values': 'Chatbox 服务商配置值',
  'Leave API Path empty unless your Chatbox version requires it. If connection fails, check whether /v1 was duplicated.':
    '除非当前 Chatbox 版本要求填写，否则 API Path 保持为空。连接失败时检查是否重复拼接了 /v1。',
  'Screenshot placeholder: Chatbox provider form': '截图占位：Chatbox 服务商表单',
  'Add a screenshot that marks API Host, API Key, model list, and Check.':
    '这里后续补截图，并标出 API Host、API Key、模型列表和 Check。',
  'Create a test conversation': '创建测试对话',
  'Return to the chat page, select the configured provider model, and send a short test prompt.':
    '回到聊天页面，选择已配置的服务商模型，并发送一条短测试提示词。',
  'Screenshot placeholder: Chatbox conversation': '截图占位：Chatbox 对话',
  'Add a screenshot of Chatbox with the Abyss AI model selected.':
    '这里后续补 Chatbox 中已选择 Abyss AI 模型的截图。',
  'Configure OpenCode with the openai-compatible AI SDK provider, a /v1 baseURL, and a live model from pricing.':
    '使用 openai-compatible AI SDK provider、/v1 baseURL 和 pricing 实时模型配置 OpenCode。',
  'Install OpenCode': '安装 OpenCode',
  'Install OpenCode from its official installer or package manager, then confirm the command is available.':
    '通过官方安装脚本或包管理器安装 OpenCode，并确认命令可用。',
  'Install with official script': '使用官方脚本安装',
  'Screenshot placeholder: OpenCode install result': '截图占位：OpenCode 安装结果',
  'Add a terminal screenshot showing opencode --version.':
    '这里后续补一张显示 opencode --version 的终端截图。',
  'Create OpenCode provider config': '创建 OpenCode 服务商配置',
  'Create opencode.json and declare a custom provider using @ai-sdk/openai-compatible.':
    '创建 opencode.json，并使用 @ai-sdk/openai-compatible 声明自定义服务商。',
  'Screenshot placeholder: OpenCode config file': '截图占位：OpenCode 配置文件',
  'Add a screenshot of opencode.json with provider and model highlighted.':
    '这里后续补 opencode.json 截图，并标出 provider 和 model。',
  'Start and select model': '启动并选择模型',
  'Run OpenCode, inspect available models, and send a simple request with the configured provider model.':
    '运行 OpenCode，检查可用模型，并使用配置好的服务商模型发送一个简单请求。',
  'Run OpenCode': '运行 OpenCode',
  'Screenshot placeholder: OpenCode model list': '截图占位：OpenCode 模型列表',
  'Add a screenshot showing abyssai/gpt-5.1 in the OpenCode model list.':
    '这里后续补一张 OpenCode 模型列表截图，展示 abyssai/gpt-5.1。',
  'Connect a self-hosted Open WebUI instance to the gateway from Admin Settings or environment variables.':
    '通过 Admin Settings 或环境变量，把自托管 Open WebUI 实例连接到服务网站。',
  'Add OpenAI connection': '添加 OpenAI 连接',
  'Open Admin Settings, Connections, OpenAI, then add a connection for the gateway.':
    '打开 Admin Settings、Connections、OpenAI，然后为服务网站添加一个连接。',
  'Admin path': '管理路径',
  'Screenshot placeholder: Open WebUI connections': '截图占位：Open WebUI 连接设置',
  'Add a screenshot that highlights Admin Settings -> Connections -> OpenAI.':
    '这里后续补截图，并标出 Admin Settings -> Connections -> OpenAI。',
  'Fill URL and API key': '填写 URL 和 API Key',
  'Set the connection URL to the gateway /v1 endpoint and paste the API key.':
    '把连接 URL 设置为服务网站 /v1 地址，并粘贴 API Key。',
  'Connection values': '连接配置值',
  'Use Model IDs Filter if Open WebUI cannot load /models from the provider.':
    '如果 Open WebUI 无法从服务商加载 /models，可以使用 Model IDs Filter 手动指定模型。',
  'Docker environment alternative': 'Docker 环境变量方式',
  'Screenshot placeholder: Open WebUI connection form': '截图占位：Open WebUI 连接表单',
  'Add a screenshot that marks URL, API Key, Model IDs Filter, and Save.':
    '这里后续补截图，并标出 URL、API Key、Model IDs Filter 和 Save。',
  'Verify model selector': '验证模型选择器',
  'Return to chat, confirm the model appears in the model selector, and send a smoke test.':
    '回到聊天页，确认模型出现在模型选择器中，并发送一次冒烟测试。',
  'Docker localhost note': 'Docker localhost 注意事项',
  'Screenshot placeholder: Open WebUI model selector': '截图占位：Open WebUI 模型选择器',
  'Add a screenshot of the model selector after saving the connection.':
    '这里后续补保存连接后的模型选择器截图。',
  'Use LobeChat with an OpenAI proxy address, API key, and an explicit model list for the gateway.':
    '在 LobeChat 中使用 OpenAI proxy address、API Key 和明确模型列表连接服务网站。',
  'Open model provider settings': '打开模型服务商设置',
  'Open Settings, Language Models, and the OpenAI provider configuration.':
    '打开 Settings、Language Models 和 OpenAI 服务商配置。',
  'Screenshot placeholder: LobeChat provider settings': '截图占位：LobeChat 服务商设置',
  'Add a screenshot of Settings -> Language Models -> OpenAI.':
    '这里后续补 Settings -> Language Models -> OpenAI 的截图。',
  'Configure proxy address and model list': '配置代理地址和模型列表',
  'Paste the API key, set API Proxy Address to the /v1 endpoint, then fetch or manually add the selected model.':
    '粘贴 API Key，把 API Proxy Address 设置为 /v1 地址，然后拉取或手动添加所选模型。',
  'LobeChat UI values': 'LobeChat 界面配置值',
  'Use +model to add a model. Use -all,+model if you want to show only selected gateway models.':
    '使用 +model 添加模型。如果只想显示指定中转模型，可以使用 -all,+model。',
  'Self-hosted environment alternative': '自托管环境变量方式',
  'Screenshot placeholder: LobeChat OpenAI form': '截图占位：LobeChat OpenAI 表单',
  'Add a screenshot that marks API Proxy Address, Model List, Get Model List, and Connectivity Check.':
    '这里后续补截图，并标出 API Proxy Address、Model List、Get Model List 和 Connectivity Check。',
  'Return to the chat page, select the configured model, and send a short verification prompt.':
    '回到聊天页面，选择已配置模型，并发送一条短验证提示词。',
  'Verification prompt': '验证提示词',
  'Screenshot placeholder: LobeChat chat page': '截图占位：LobeChat 聊天页',
  'Add a screenshot with the gateway model selected in chat.':
    '这里后续补聊天页截图，并展示已选择服务网站模型。',
  'Install CC Switch to manage and switch providers for Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, and other coding agents.':
    '安装 CC Switch，用于管理并切换 Claude Code、Codex、Gemini CLI、OpenCode、OpenClaw 等编程 Agent 的服务商配置。',
  'Download and install CC Switch for your operating system. The app is built with Tauri 2 (Rust) and is code-signed on macOS and Windows.':
    '下载并安装适用于当前操作系统的 CC Switch。应用基于 Tauri 2（Rust）构建，macOS 和 Windows 均已签名。',
  'Homebrew cask is the recommended way on macOS. The app is code-signed and notarized by Apple.':
    'macOS 推荐使用 Homebrew cask 安装，应用已通过 Apple 签名和公证。',
  'Or download manually': '或手动下载',
  'Download the .dmg installer from the Releases page.': '从 Releases 页面下载 .dmg 安装包。',
  'Download installer': '下载安装包',
  'Download CC-Switch-v{version}-Windows.msi (installer) or Windows-Portable.zip (portable version, no install needed).':
    '下载 CC-Switch-v{version}-Windows.msi（安装版）或 Windows-Portable.zip（便携版，免安装）。',
  'Arch Linux (AUR)': 'Arch Linux（AUR）',
  'Debian / Ubuntu (.deb)': 'Debian / Ubuntu（.deb）',
  'Download .deb for Debian/Ubuntu, .rpm for Fedora/RHEL, or .AppImage for universal Linux.':
    'Debian/Ubuntu 下载 .deb，Fedora/RHEL 下载 .rpm，或下载 .AppImage 通用包。',
  'Open CC Switch, click Add Provider, then choose from 50+ built-in presets or create a custom provider. Fill in the base URL and API key below, then click Import.':
    '打开 CC Switch，点击 Add Provider，从 50+ 内置预设中选择或创建自定义服务商，填写以下 Base URL 和 API Key，然后点击 Import。',
  'Switch & Use': '切换与使用',
  'Select the target CLI tool tab in CC Switch, choose a provider and click Enable. Claude Code supports hot-switching; for Codex, Gemini CLI, OpenClaw and others, restart the terminal after switching.':
    '在 CC Switch 中选择目标 CLI 工具标签页，选择服务商并点击 Enable。Claude Code 支持热切换；Codex、Gemini CLI、OpenClaw 等需重启终端。',
  'Quick switch': '快速切换',
  'System tray → click CC Switch icon → select provider → Enable': '系统托盘 → 点击 CC Switch 图标 → 选择服务商 → Enable',
  'You can also switch providers directly from the system tray without opening the full app.':
    '也可以直接从系统托盘切换服务商，无需打开完整界面。',
  'Open Cursor.': '打开 Cursor。',
  'Open Cursor Settings.': '打开 Cursor Settings。',
  'Enter the Models page.': '进入 Models 页面。',
  'Find the API Keys section.': '找到 API Keys 区域。',
  'Paste the API key into OpenAI API Key.': '把 API Key 粘贴到 OpenAI API Key。',
  'Set Override OpenAI Base URL to the /v1 endpoint.':
    '将 Override OpenAI Base URL 设置为 /v1 地址。',
  'Click Verify if your Cursor version shows a verify button.':
    '如果当前 Cursor 版本显示 Verify 按钮，请点击验证。',
  'Do not paste /chat/completions into the base URL field.':
    '不要把 /chat/completions 粘贴进 Base URL 字段。',
  'Open View All Models or Add Custom Model.': '打开 View All Models 或 Add Custom Model。',
  'Add the selected model ID exactly.': '精确添加当前选择的模型 ID。',
  'Enable the model in Cursor.': '在 Cursor 中启用该模型。',
  'Open Cursor Chat and select the custom model.': '打开 Cursor Chat 并选择自定义模型。',
  'Send the test prompt.': '发送测试提示词。',
  'Open the editor extension marketplace.': '打开编辑器扩展市场。',
  'Search for Cline.': '搜索 Cline。',
  'Install and enable the extension.': '安装并启用扩展。',
  'Open the Cline side panel.': '打开 Cline 侧边栏。',
  'Click the settings icon in the Cline panel.': '点击 Cline 面板中的设置图标。',
  'Set API Provider to OpenAI Compatible.': '将 API Provider 设置为 OpenAI Compatible。',
  'Paste the /v1 Base URL.': '粘贴 /v1 Base URL。',
  'Paste the API key.': '粘贴 API Key。',
  'Enter the selected Model ID.': '输入当前选择的 Model ID。',
  'Save the provider configuration.': '保存服务商配置。',
  'Run Verify if Cline shows it.': '如果 Cline 显示 Verify，请运行验证。',
  'Submit the small task.': '提交小任务。',
  'If the request fails, confirm Provider is OpenAI Compatible and the model ID is exact.':
    '如果请求失败，确认 Provider 是 OpenAI Compatible，并且模型 ID 完全正确。',
  'Install Continue in the editor.': '在编辑器中安装 Continue。',
  'Open Continue settings.': '打开 Continue 设置。',
  'Open config.yaml.': '打开 config.yaml。',
  'Locate the models section.': '找到 models 配置区。',
  'Add a model item under models.': '在 models 下添加一个模型项。',
  'Set provider to openai.': '将 provider 设置为 openai。',
  'Set apiBase to the /v1 endpoint.': '将 apiBase 设置为 /v1 地址。',
  'Set model to the selected model ID.': '将 model 设置为当前选择的模型 ID。',
  'Save config.yaml.': '保存 config.yaml。',
  'Reload Continue or restart the editor.': '重载 Continue 或重启编辑器。',
  'Open the Continue model selector.': '打开 Continue 模型选择器。',
  'Choose the configured Abyss AI model.': '选择配置好的 Abyss AI 模型。',
  'Install and open Chatbox.': '安装并打开 Chatbox。',
  'Open Settings from the sidebar.': '从侧边栏打开 Settings。',
  'Enter Model Provider.': '进入 Model Provider。',
  'Click Add if no suitable provider exists.': '如果没有合适服务商，点击 Add。',
  'Select OpenAI API compatible as the provider type.':
    '选择 OpenAI API compatible 作为服务商类型。',
  'Paste the /v1 API Host.': '粘贴 /v1 API Host。',
  'Add the exact model ID.': '添加精确模型 ID。',
  'Click Check.': '点击 Check。',
  'Select the added model.': '选择刚添加的模型。',
  'If the model is missing, return to Model Provider and add it manually.':
    '如果模型缺失，返回 Model Provider 手动添加。',
  'Install OpenCode.': '安装 OpenCode。',
  'Open a fresh terminal.': '打开一个新终端。',
  'Run opencode --version.': '运行 opencode --version。',
  'Confirm the command is available in PATH.': '确认命令已经加入 PATH。',
  'Create the OpenCode config file.': '创建 OpenCode 配置文件。',
  'Set npm to @ai-sdk/openai-compatible.': '将 npm 设置为 @ai-sdk/openai-compatible。',
  'Set baseURL to the /v1 endpoint.': '将 baseURL 设置为 /v1 地址。',
  'Use an environment variable for the API key.': '使用环境变量保存 API Key。',
  'Set model to provider-id/model-id.': '将 model 设置为 provider-id/model-id。',
  'Run OpenCode inside a project.': '在项目中运行 OpenCode。',
  'Open /models.': '打开 /models。',
  'Confirm the custom provider model is visible.': '确认可以看到自定义服务商模型。',
  'Send a small prompt to verify the connection.': '发送一个小提示词验证连接。',
  'Log in as an Open WebUI admin.': '以 Open WebUI 管理员身份登录。',
  'Open Admin Settings.': '打开 Admin Settings。',
  'Open Connections.': '打开 Connections。',
  'Open the OpenAI connection section.': '打开 OpenAI 连接区域。',
  'Click Add Connection.': '点击 Add Connection。',
  'Paste the /v1 URL.': '粘贴 /v1 URL。',
  'Add the selected model to Model IDs Filter if needed.':
    '如有需要，把当前选择的模型加入 Model IDs Filter。',
  'Save the connection.': '保存连接。',
  'Open the chat page.': '打开聊天页面。',
  'Open the model selector.': '打开模型选择器。',
  'Choose the gateway model.': '选择服务网站模型。',
  'Send a smoke test prompt.': '发送冒烟测试提示词。',
  'Open LobeChat settings.': '打开 LobeChat 设置。',
  'Enter Language Models.': '进入 Language Models。',
  'Open the OpenAI provider.': '打开 OpenAI 服务商。',
  'Confirm API Key and API Proxy Address fields are visible.':
    '确认可以看到 API Key 和 API Proxy Address 字段。',
  'Paste the /v1 proxy address.': '粘贴 /v1 代理地址。',
  'Click Get Model List or add the model manually.':
    '点击 Get Model List，或手动添加模型。',
  'Run Connectivity Check.': '运行 Connectivity Check。',
  'Open a new chat.': '新建聊天。',
  'Select the gateway model.': '选择服务网站模型。',
  'Send the verification prompt.': '发送验证提示词。',
  'If the response is empty, check whether the /v1 suffix is correct.':
    '如果响应为空，检查 /v1 后缀是否正确。',
  '截图占位：补充关键填写区域': '截图占位：补充关键填写区域',
  '这里预留给表单字段、模型选择、Base URL 或 API Key 填写位置的细节截图。':
    '这里预留给表单字段、模型选择、Base URL 或 API Key 填写位置的细节截图。',
  '截图占位：补充验证结果': '截图占位：补充验证结果',
  '这里预留给 Check、Verify、终端输出、聊天响应或成功状态的截图。':
    '这里预留给 Check、Verify、终端输出、聊天响应或成功状态的截图。',
  '这里预留给当前小步骤的详细说明，后续可以补充截图说明、注意事项或失败排查。':
    '这里预留给当前小步骤的详细说明，后续可以补充截图说明、注意事项或失败排查。',
  '这里预留给后续补充的实际操作说明，可放工具界面截图、关键字段说明或验证结果。':
    '这里预留给后续补充的实际操作说明，可放工具界面截图、关键字段说明或验证结果。',
  '查看详情/截图': '查看详情/截图',
  '需要截图': '需要截图',
  '详细说明': '详细说明',
  '截图预览': '截图预览',
  '5 个小步骤': '5 个小步骤',
  '当前步骤相关命令或配置': '当前步骤相关命令或配置',
  '同一流程的小步骤': '同一流程的小步骤',
  '补充实操步骤 1': '补充实操步骤 1',
  '补充实操步骤 2': '补充实操步骤 2',
  '补充实操步骤 3': '补充实操步骤 3',
  '补充实操步骤 4': '补充实操步骤 4',
  '补充实操步骤 5': '补充实操步骤 5',
  'Visit official site': '访问官网',
  'CC Switch is recommended for managing and switching provider configs across Claude Code, Codex, Gemini CLI, OpenClaw, and other coding agents.':
    '建议使用 CC Switch 来管理和切换 Claude Code、Codex、Gemini CLI、OpenClaw 等编程 Agent 的服务商配置。',
}

function docText(text: string) {
  return docZhText[text] ?? text
}

const guides: ToolGuide[] = [
  {
    id: 'config-intro',
    name: 'Quick start',
    iconNames: [],
    imageUrl: 'https://abyssai.cc/aybssai-logo.png',
    summary:
      'Start here: copy the Abyss AI service address, create an API key, and confirm which base URL each tool needs.',
    modelHint: 'https://abyssai.cc',
    copyValue: serviceUrl,
    copyLabel: 'Copy service address',
    steps: [
      {
        title: 'Service address',
        description:
          'The API service address is https://abyssai.cc. Click the copy button before pasting it into tools or configuration files.',
        commands: {
          mac: [
            {
              title: 'API service address',
              language: 'text',
              code: serviceUrl,
            },
            {
              title: 'OpenAI compatible base URL',
              language: 'text',
              code: endpoint,
              note: 'Use this /v1 address for tools that ask for an OpenAI-compatible base URL.',
            },
          ],
          windows: [
            {
              title: 'API service address',
              language: 'text',
              code: serviceUrl,
            },
            {
              title: 'OpenAI compatible base URL',
              language: 'text',
              code: endpoint,
              note: 'Use this /v1 address for tools that ask for an OpenAI-compatible base URL.',
            },
          ],
          linux: [
            {
              title: 'API service address',
              language: 'text',
              code: serviceUrl,
            },
            {
              title: 'OpenAI compatible base URL',
              language: 'text',
              code: endpoint,
              note: 'Use this /v1 address for tools that ask for an OpenAI-compatible base URL.',
            },
          ],
        },
      },
      {
        title: 'Get an API key',
        description:
          'Create an API key from the console and keep it secure. The key is required for all tool configurations and the Playground.',
        commands: {},
        openUrl: 'https://abyssai.cc/keys',
        reference: {
          screenshotTitle: 'Screenshot placeholder: API Keys page',
          screenshotDescription:
            'Add a screenshot that highlights the create button and the key list on the API Keys page.',
          screenshots: [
            {
              title: 'Screenshot placeholder: open and create key',
              description:
                'Add a screenshot that highlights the API Keys page and the create button.',
              imageUrl: '/images/docs/tool-setup/quick-start/step-2-1-open-and-create-key.png',
            },
            {
              title: 'Screenshot placeholder: key name and group',
              description:
                'Add a screenshot that highlights the name field, group selector, and save button.',
              imageUrl: '/images/docs/tool-setup/quick-start/step-2-2-key-name-and-group.png',
            },
            {
              title: 'Screenshot placeholder: copy key',
              description:
                'Add a screenshot that highlights the copy button next to the newly created key.',
              imageUrl: '/images/docs/tool-setup/quick-start/step-2-3-copy-key.png',
            },
          ],
          checklist: [
            'Open the API Keys page and click the create button.',
            'Enter a name, select the correct model group, and save.',
            'Copy the key and store it securely.',
          ],
        },
      },
      {
        title: 'Quick tryout',
        description:
          'Use the built-in 游乐场 to verify connectivity before configuring external tools. Select a group, pick a model, and start a conversation right away.',
        commands: {},
        openUrl: 'https://abyssai.cc/playground',
        reference: {
          screenshotTitle: 'Screenshot placeholder: 游乐场 page',
          screenshotDescription:
            'Add a screenshot that highlights the group selector, model selector, and chat input on the 游乐场 page.',
          screenshots: [
            {
              title: 'Screenshot placeholder: open 游乐场',
              description:
                'Add a screenshot that shows how to open the 游乐场 from the console sidebar.',
              imageUrl: '/images/docs/tool-setup/quick-start/step-3-1-open-playground.png',
            },
            {
              title: 'Screenshot placeholder: select and chat',
              description:
                'Add a screenshot that highlights the group selector, model selector, chat input, and a successful response.',
              imageUrl: '/images/docs/tool-setup/quick-start/step-3-2-select-and-chat.png',
            },
          ],
          checklist: [
            'Open the 游乐场 from the console sidebar.',
            'Select a group, pick a model, send a test message, and confirm the response.',
          ],
        },
      },
    ],
  },
  {
    id: 'nodejs',
    name: 'Node.js installation',
    iconNames: [],
    summary:
      'Install Node.js and npm first, because most coding CLI tools in this guide are distributed through npm.',
    modelHint: 'Node.js LTS',
    modelHintUrl: 'https://nodejs.org/en/download',
    steps: [
      {
        title: 'Install',
        description:
          'Install Node.js (latest LTS). The recommended path is Homebrew on macOS, winget on Windows, and nvm on Linux.',
        commands: {
          mac: [
            {
              title: 'Install with Homebrew',
              language: 'bash',
              code: 'brew install node\nnode -v\nnpm -v',
              note: 'If brew is not installed, install Homebrew first from https://brew.sh.',
            },
          ],
          windows: [
            {
              title: 'Install with winget',
              language: 'powershell',
              code: 'winget install OpenJS.NodeJS.LTS\nnode -v\nnpm -v',
              note: 'Restart PowerShell after installation if node is not found.',
            },
          ],
          linux: [
            {
              title: 'Install with nvm',
              language: 'bash',
              code: 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash\n. "$HOME/.nvm/nvm.sh"\nnvm install --lts\nnode -v\nnpm -v',
              note: 'Using nvm avoids permission problems when installing global npm packages.',
            },
          ],
        },
      },
      {
        title: 'Configure npm global path',
        description:
          'Make sure globally installed CLI commands can be found from a new terminal window.',
        commands: {
          mac: [
            {
              title: 'Check npm global path',
              language: 'bash',
              code: 'npm config get prefix\nnpm list -g --depth=0',
            },
          ],
          windows: [
            {
              title: 'Check npm global path',
              language: 'powershell',
              code: 'npm config get prefix\n$env:Path -split ";" | Select-String npm',
            },
          ],
          linux: [
            {
              title: 'Check npm global path',
              language: 'bash',
              code: 'npm config get prefix\nnpm list -g --depth=0',
            },
          ],
        },
      },
      {
        title: 'Verify Setup',
        description:
          'Run a small verification command before installing Claude Code, Codex, Gemini CLI, or OpenClaw.',
        commands: {
          mac: [
            {
              title: 'Node.js verification',
              language: 'bash',
              code: 'node -e "console.log(process.version)"\nnpm doctor',
            },
          ],
          windows: [
            {
              title: 'Node.js verification',
              language: 'powershell',
              code: 'node -e "console.log(process.version)"\nnpm doctor',
            },
          ],
          linux: [
            {
              title: 'Node.js verification',
              language: 'bash',
              code: 'node -e "console.log(process.version)"\nnpm doctor',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    iconNames: ['ClaudeCode.Color'],
    summary:
      'Use Claude Code through an Anthropic-compatible endpoint exposed by your gateway.',
    modelHint: 'claude-3-5-sonnet-latest',
    modelHintUrl: 'https://claude.com/product/claude-code',
    endpointTypes: ['anthropic'],
    steps: [
      {
        title: 'Install',
        description:
          'Install Node.js first, then install the Claude Code command line tool.',
        commands: {
          mac: [
            {
              title: 'Install with npm',
              language: 'bash',
              code: 'npm install -g @anthropic-ai/claude-code\nclaude --version',
            },
          ],
          windows: [
            {
              title: 'Install with npm',
              language: 'powershell',
              code: 'npm install -g @anthropic-ai/claude-code\nclaude --version',
            },
          ],
          linux: [
            {
              title: 'Install with npm',
              language: 'bash',
              code: 'npm install -g @anthropic-ai/claude-code\nclaude --version',
            },
          ],
        },
      },
      {
        title: 'Configure API',
        description:
          'Edit the Claude Code settings file to point it to your gateway. Save the file and open a new terminal to apply.',
        commands: {
          mac: [
            {
              title: 'Edit settings file',
              language: 'bash',
              code: `mkdir -p ~/.claude\ncat > ~/.claude/settings.json << 'EOF'\n{\n  "env": {\n    "ANTHROPIC_AUTH_TOKEN": "${apiKey}",\n    "ANTHROPIC_BASE_URL": "${serviceUrl}",\n    "ANTHROPIC_MODEL": "claude-3-5-sonnet-latest",\n    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-3-5-sonnet-latest",\n    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-3-5-sonnet-latest",\n    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-3-5-sonnet-latest"\n  }\n}\nEOF`,
              note: 'Replace the model values with the model you want to use. Open a new terminal after saving.',
            },
          ],
          windows: [
            {
              title: 'Edit settings file',
              language: 'powershell',
              code: `$dir = "$env:USERPROFILE\\.claude"\nif (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force }\nSet-Content -Path "$dir\\settings.json" -Value @'\n{\n  "env": {\n    "ANTHROPIC_AUTH_TOKEN": "${apiKey}",\n    "ANTHROPIC_BASE_URL": "${serviceUrl}",\n    "ANTHROPIC_MODEL": "claude-3-5-sonnet-latest",\n    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-3-5-sonnet-latest",\n    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-3-5-sonnet-latest",\n    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-3-5-sonnet-latest"\n  }\n}\n'@`,
              note: 'Replace the model values with the model you want to use. Open a new terminal after saving.',
            },
          ],
          linux: [
            {
              title: 'Edit settings file',
              language: 'bash',
              code: `mkdir -p ~/.claude\ncat > ~/.claude/settings.json << 'EOF'\n{\n  "env": {\n    "ANTHROPIC_AUTH_TOKEN": "${apiKey}",\n    "ANTHROPIC_BASE_URL": "${serviceUrl}",\n    "ANTHROPIC_MODEL": "claude-3-5-sonnet-latest",\n    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-3-5-sonnet-latest",\n    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-3-5-sonnet-latest",\n    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-3-5-sonnet-latest"\n  }\n}\nEOF`,
              note: 'Replace the model values with the model you want to use. Open a new terminal after saving.',
            },
          ],
        },
        tip: 'CC Switch is recommended for managing and switching provider configs across Claude Code, Codex, Gemini CLI, OpenClaw, and other coding agents.',
      },
      {
        title: 'Start',
        description:
          'Open a project directory and start an interactive Claude Code session.',
        commands: {
          mac: [
            {
              title: 'Run in a project',
              language: 'bash',
              code: 'cd /path/to/your/project\nclaude',
            },
          ],
          windows: [
            {
              title: 'Run in a project',
              language: 'powershell',
              code: 'cd C:\\path\\to\\your\\project\nclaude',
            },
          ],
          linux: [
            {
              title: 'Run in a project',
              language: 'bash',
              code: 'cd /path/to/your/project\nclaude',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'codex',
    name: 'Codex',
    iconNames: ['Codex.Color'],
    summary:
      'Configure Codex with an OpenAI-compatible provider backed by your gateway.',
    modelHint: 'gpt-5.1',
    modelHintUrl: 'https://openai.com/en/codex/',
    endpointTypes: ['openai', 'image-generation'],
    steps: [
      {
        title: 'Install',
        description:
          'Install the Codex CLI globally, then confirm the binary is available.',
        commands: {
          mac: [
            {
              title: 'Install with npm',
              language: 'bash',
              code: 'npm install -g @openai/codex\ncodex --version',
            },
          ],
          windows: [
            {
              title: 'Install with npm',
              language: 'powershell',
              code: 'npm install -g @openai/codex\ncodex --version',
            },
          ],
          linux: [
            {
              title: 'Install with npm',
              language: 'bash',
              code: 'npm install -g @openai/codex\ncodex --version',
            },
          ],
        },
      },
      {
        title: 'Configure API',
        description:
          'Edit the Codex auth and config files to connect to your gateway. Save and open a new terminal to apply.',
        commands: {
          mac: [
            {
              title: '~/.codex/auth.json',
              language: 'json',
              code: `mkdir -p ~/.codex\ncat > ~/.codex/auth.json << 'EOF'\n{\n  "OPENAI_API_KEY": "${apiKey}"\n}\nEOF`,
            },
            {
              title: '~/.codex/config.toml',
              language: 'toml',
              code: `cat > ~/.codex/config.toml << 'EOF'\nmodel_provider = "my_codex"\nmodel = "gpt-5.1"\nmodel_reasoning_effort = "high"\ndisable_response_storage = true\n\n[model_providers.my_codex]\nname = "my_codex"\nbase_url = "${endpoint}"\nwire_api = "responses"\nrequires_openai_auth = true\nEOF`,
            },
          ],
          windows: [
            {
              title: '%USERPROFILE%\\.codex\\auth.json',
              language: 'powershell',
              code: `$dir = "$env:USERPROFILE\\.codex"\nif (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force }\nSet-Content -Path "$dir\\auth.json" -Value @'\n{\n  "OPENAI_API_KEY": "${apiKey}"\n}\n'@`,
            },
            {
              title: '%USERPROFILE%\\.codex\\config.toml',
              language: 'toml',
              code: `model_provider = "my_codex"\nmodel = "gpt-5.1"\nmodel_reasoning_effort = "high"\ndisable_response_storage = true\n\n[model_providers.my_codex]\nname = "my_codex"\nbase_url = "${endpoint}"\nwire_api = "responses"\nrequires_openai_auth = true`,
            },
          ],
          linux: [
            {
              title: '~/.codex/auth.json',
              language: 'json',
              code: `mkdir -p ~/.codex\ncat > ~/.codex/auth.json << 'EOF'\n{\n  "OPENAI_API_KEY": "${apiKey}"\n}\nEOF`,
            },
            {
              title: '~/.codex/config.toml',
              language: 'toml',
              code: `cat > ~/.codex/config.toml << 'EOF'\nmodel_provider = "my_codex"\nmodel = "gpt-5.1"\nmodel_reasoning_effort = "high"\ndisable_response_storage = true\n\n[model_providers.my_codex]\nname = "my_codex"\nbase_url = "${endpoint}"\nwire_api = "responses"\nrequires_openai_auth = true\nEOF`,
            },
          ],
        },
        tip: 'CC Switch is recommended for managing and switching provider configs across Claude Code, Codex, Gemini CLI, OpenClaw, and other coding agents.',
      },
      {
        title: 'Start',
        description:
          'Start Codex in your repository and ask it to inspect the project.',
        commands: {
          mac: [
            {
              title: 'Run in a project',
              language: 'bash',
              code: 'cd /path/to/your/project\ncodex "summarize this repository"',
            },
          ],
          windows: [
            {
              title: 'Run in a project',
              language: 'powershell',
              code: 'cd C:\\path\\to\\your\\project\ncodex "summarize this repository"',
            },
          ],
          linux: [
            {
              title: 'Run in a project',
              language: 'bash',
              code: 'cd /path/to/your/project\ncodex "summarize this repository"',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    iconNames: ['Gemini.Color'],
    summary:
      'Use Gemini CLI with GEMINI_API_KEY and a Gemini model for command line workflows.',
    modelHint: 'gemini-2.5-flash',
    modelHintUrl: 'https://geminicli.com/',
    endpointTypes: ['gemini'],
    steps: [
      {
        title: 'Install',
        description:
          'Install Gemini CLI with npm, then confirm the gemini command is available.',
        commands: {
          mac: [
            {
              title: 'Gemini CLI',
              language: 'bash',
              code: 'npm install -g @google/gemini-cli\ngemini --version',
            },
          ],
          windows: [
            {
              title: 'Gemini CLI',
              language: 'powershell',
              code: 'npm install -g @google/gemini-cli\ngemini --version',
            },
          ],
          linux: [
            {
              title: 'Gemini CLI',
              language: 'bash',
              code: 'npm install -g @google/gemini-cli\ngemini --version',
            },
          ],
        },
      },
      {
        title: 'Configure API',
        description:
          'Edit the Gemini CLI config files to connect to your gateway. Save and open a new terminal to apply.',
        commands: {
          mac: [
            {
              title: '~/.gemini/.env',
              language: 'bash',
              code: `mkdir -p ~/.gemini\ncat > ~/.gemini/.env << 'EOF'\nGOOGLE_GEMINI_BASE_URL=${endpoint}\nGEMINI_API_KEY=${apiKey}\nGEMINI_MODEL=gemini-2.5-flash\nEOF`,
            },
          ],
          windows: [
            {
              title: '%USERPROFILE%\\.gemini\\.env',
              language: 'powershell',
              code: `$dir = "$env:USERPROFILE\\.gemini"\nif (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force }\nSet-Content -Path "$dir\\.env" -Value @'\nGOOGLE_GEMINI_BASE_URL=${endpoint}\nGEMINI_API_KEY=${apiKey}\nGEMINI_MODEL=gemini-2.5-flash\n'@`,
            },
          ],
          linux: [
            {
              title: '~/.gemini/.env',
              language: 'bash',
              code: `mkdir -p ~/.gemini\ncat > ~/.gemini/.env << 'EOF'\nGOOGLE_GEMINI_BASE_URL=${endpoint}\nGEMINI_API_KEY=${apiKey}\nGEMINI_MODEL=gemini-2.5-flash\nEOF`,
            },
          ],
        },
        tip: 'CC Switch is recommended for managing and switching provider configs across Claude Code, Codex, Gemini CLI, OpenClaw, and other coding agents.',
      },
      {
        title: 'Start',
        description:
          'Start Gemini CLI in a project directory and run a small smoke test.',
        commands: {
          mac: [
            {
              title: 'Gemini CLI',
              language: 'bash',
              code: 'cd /path/to/your/project\ngemini -p "explain the project structure"',
            },
          ],
          windows: [
            {
              title: 'Gemini CLI',
              language: 'powershell',
              code: 'cd C:\\path\\to\\your\\project\ngemini -p "explain the project structure"',
            },
          ],
          linux: [
            {
              title: 'Gemini CLI',
              language: 'bash',
              code: 'cd /path/to/your/project\ngemini -p "explain the project structure"',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    iconNames: ['OpenClaw.Color'],
    summary:
      'Configure OpenClaw with an OpenAI-compatible gateway and run it in your project.',
    modelHint: 'gpt-5.1',
    useAllPricingModels: true,
    steps: [
      {
        title: 'Install',
        description:
          'Install OpenClaw after Node.js and the CLI runtime are ready.',
        commands: {
          mac: [
            {
              title: 'OpenClaw',
              language: 'bash',
              code: 'curl -fsSL https://openclaw.ai/install.sh | bash\nopenclaw --version',
            },
          ],
          windows: [
            {
              title: 'OpenClaw',
              language: 'powershell',
              code: 'npm install -g openclaw\nopenclaw --version',
            },
          ],
          linux: [
            {
              title: 'OpenClaw',
              language: 'bash',
              code: 'curl -fsSL https://openclaw.ai/install.sh | bash\nopenclaw --version',
            },
          ],
        },
      },
      {
        title: 'Configure API',
        description:
          'Point OpenClaw to your OpenAI-compatible gateway and read the key from OPENAI_API_KEY.',
        commands: {
          mac: [
            {
              title: '~/.openclaw/openclaw.json',
              language: 'json',
              code: `{\n  "providers": {\n    "new-api": {\n      "type": "openai-compatible",\n      "baseURL": "${endpoint}",\n      "apiKey": "$OPENAI_API_KEY",\n      "model": "gpt-5.1"\n    }\n  }\n}`,
            },
            {
              title: 'Environment',
              language: 'bash',
              code: `export OPENAI_API_KEY="${apiKey}"`,
            },
          ],
          windows: [
            {
              title: '%USERPROFILE%\\.openclaw\\openclaw.json',
              language: 'json',
              code: `{\n  "providers": {\n    "new-api": {\n      "type": "openai-compatible",\n      "baseURL": "${endpoint}",\n      "apiKey": "%OPENAI_API_KEY%",\n      "model": "gpt-5.1"\n    }\n  }\n}`,
            },
            {
              title: 'Environment',
              language: 'powershell',
              code: `$env:OPENAI_API_KEY="${apiKey}"`,
            },
          ],
          linux: [
            {
              title: '~/.openclaw/openclaw.json',
              language: 'json',
              code: `{\n  "providers": {\n    "new-api": {\n      "type": "openai-compatible",\n      "baseURL": "${endpoint}",\n      "apiKey": "$OPENAI_API_KEY",\n      "model": "gpt-5.1"\n    }\n  }\n}`,
            },
            {
              title: 'Environment',
              language: 'bash',
              code: `export OPENAI_API_KEY="${apiKey}"`,
            },
          ],
        },
      },
      {
        title: 'Start',
        description:
          'Start OpenClaw in a project directory after the API key is available.',
        commands: {
          mac: [
            {
              title: 'OpenClaw',
              language: 'bash',
              code: 'cd /path/to/your/project\nopenclaw',
            },
          ],
          windows: [
            {
              title: 'OpenClaw',
              language: 'powershell',
              code: 'cd C:\\path\\to\\your\\project\nopenclaw',
            },
          ],
          linux: [
            {
              title: 'OpenClaw',
              language: 'bash',
              code: 'cd /path/to/your/project\nopenclaw',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'cherry-studio',
    name: 'Cherry Studio',
    iconNames: ['CherryStudio.Color'],
    summary:
      'Connect Cherry Studio as an OpenAI-compatible desktop client, add models from the live pricing list, and verify the provider before chatting.',
    modelHint: 'gpt-5.1',
    useAllPricingModels: true,
    steps: [
      {
        title: 'Install Cherry Studio',
        description:
          'Download Cherry Studio for your operating system, install it, and open the app before adding a custom model provider.',
        commands: shellSystems(
          [
            {
              title: 'Open download page',
              language: 'bash',
              code: 'open https://docs.cherry-ai.com/cherry-studio/download',
              note: 'Download the macOS .dmg or .zip package, then drag Cherry Studio into Applications.',
            },
          ],
          [
            {
              title: 'Open download page',
              language: 'powershell',
              code: 'Start-Process "https://docs.cherry-ai.com/cherry-studio/download"',
              note: 'Download the Windows setup.exe installer or portable package. Windows 7 is not supported by Cherry Studio.',
            },
          ],
          [
            {
              title: 'Install Linux package',
              language: 'bash',
              code: '# Debian / Ubuntu\nsudo dpkg -i Cherry-Studio-*-amd64.deb\n\n# RPM distributions\nsudo rpm -i Cherry-Studio-*.rpm\n\n# AppImage\nchmod +x Cherry-Studio-*.AppImage\n./Cherry-Studio-*.AppImage',
              note: 'Choose the package that matches your CPU architecture from the official release page.',
            },
          ]
        ),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Cherry Studio download page',
          screenshotDescription:
            'Add a screenshot that highlights the Windows, macOS, and Linux download entries.',
          checklist: [
            'Open the official Cherry Studio download page.',
            'Download the package that matches the current operating system and CPU architecture.',
            'Install and launch Cherry Studio once.',
            'Confirm the Settings entry is visible in the left sidebar.',
          ],
        },
      },
      {
        title: 'Add an OpenAI provider',
        description:
          'Open Settings, enter Model Services, add a provider, and choose OpenAI as the provider type for the gateway.',
        commands: allSystems([
          {
            title: 'Provider fields',
            language: 'text',
            code: `Provider name: Abyss AI\nProvider type: OpenAI\nAPI Key: ${apiKey}\nAPI address: ${serviceUrl}\nModel: gpt-5.1`,
            note: 'Cherry Studio usually asks for the service root address here. Do not paste the full /v1/chat/completions path.',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: add provider dialog',
          screenshotDescription:
            'Add a screenshot of Settings -> Model Services -> Add, with Provider Type set to OpenAI.',
          checklist: [
            'Click the Settings icon in Cherry Studio.',
            'Open Model Services.',
            'Click Add at the bottom of the provider list.',
            'Set the provider name to Abyss AI and provider type to OpenAI.',
            'Confirm the provider is created.',
          ],
        },
      },
      {
        title: 'Fill API key and model',
        description:
          'Paste the API key, use the correct API address, add the exact model ID, then run the built-in check and enable the provider.',
        commands: allSystems([
          {
            title: 'Recommended values',
            language: 'text',
            code: `API Key: ${apiKey}\nAPI address: ${serviceUrl}\nModel ID: gpt-5.1`,
            note: 'If the request returns 404, check whether /v1 or /chat/completions was duplicated by the client.',
          },
          {
            title: 'Manual model examples',
            language: 'text',
            code: 'gpt-5.1\nclaude-3-5-sonnet-latest\ngemini-2.5-flash',
            note: 'Only add model IDs that exist in the live pricing list and that your account can call.',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: provider configuration page',
          screenshotDescription:
            'Add a screenshot that marks API Key, API address, model management, Check, and the enable switch.',
          checklist: [
            'Paste the API key into the API Key field.',
            'Paste the API address exactly as shown in this guide.',
            'Open model management and add the selected model ID.',
            'Click Check to test the provider.',
            'Turn on the provider switch so the model appears in chat.',
          ],
        },
      },
      {
        title: 'Start a chat test',
        description:
          'Create a new conversation, choose the added model, and send a short test prompt to confirm the relay path works.',
        commands: allSystems([
          {
            title: 'Smoke test prompt',
            language: 'text',
            code: 'Please reply with one sentence: Cherry Studio is connected.',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: chat model selector',
          screenshotDescription:
            'Add a screenshot of the chat page with the Abyss AI model selected.',
          checklist: [
            'Create a new chat.',
            'Select the model added under the Abyss AI provider.',
            'Send the smoke test prompt.',
            'If no model appears, return to Model Services and confirm the provider switch is enabled.',
          ],
        },
      },
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    iconNames: ['Cursor.Color'],
    summary:
      'Configure Cursor to use a custom OpenAI-compatible base URL, add an exact model ID, and verify it in the chat panel.',
    modelHint: 'gpt-5.1',
    endpointTypes: ['openai', 'image-generation'],
    steps: [
      {
        title: 'Open Cursor model settings',
        description:
          'Install or open Cursor, then go to Cursor Settings, Models, and API Keys.',
        commands: allSystems([
          {
            title: 'Settings path',
            language: 'text',
            code: 'Cursor Settings -> Models -> API Keys',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Cursor model settings',
          screenshotDescription:
            'Add a screenshot that highlights Models and API Keys in Cursor Settings.',
          checklist: [
            'Open Cursor.',
            'Open Cursor Settings.',
            'Enter the Models page.',
            'Find the API Keys section.',
          ],
        },
      },
      {
        title: 'Configure OpenAI API key',
        description:
          'Fill the OpenAI API Key field and override the OpenAI Base URL with the gateway /v1 endpoint.',
        commands: allSystems([
          {
            title: 'Cursor OpenAI-compatible values',
            language: 'text',
            code: `OpenAI API Key: ${apiKey}\nOverride OpenAI Base URL: ${endpoint}\nCustom model: gpt-5.1`,
            note: 'Some Cursor versions label this field OpenAI Base URL. The setting can affect all OpenAI-routed Cursor chat models.',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Cursor API key and base URL',
          screenshotDescription:
            'Add a screenshot that marks OpenAI API Key, Override OpenAI Base URL, and Verify.',
          checklist: [
            'Paste the API key into OpenAI API Key.',
            'Set Override OpenAI Base URL to the /v1 endpoint.',
            'Click Verify if your Cursor version shows a verify button.',
            'Do not paste /chat/completions into the base URL field.',
          ],
        },
      },
      {
        title: 'Add custom model',
        description:
          'Open View All Models or Add Custom Model, enter the exact model ID, enable it, then test from Cursor Chat.',
        commands: allSystems([
          {
            title: 'Model test prompt',
            language: 'text',
            code: 'Use the selected custom model and reply: Cursor gateway test passed.',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Cursor custom model',
          screenshotDescription:
            'Add a screenshot of the custom model entry and the model selected in Cursor Chat.',
          checklist: [
            'Open View All Models or Add Custom Model.',
            'Add the selected model ID exactly.',
            'Enable the model in Cursor.',
            'Open Cursor Chat and select the custom model.',
            'Send the test prompt.',
          ],
        },
      },
    ],
  },
  {
    id: 'cline',
    name: 'Cline',
    iconNames: ['Cline.Color'],
    summary:
      'Use Cline with the OpenAI Compatible provider by filling Base URL, API Key, and Model ID.',
    modelHint: 'gpt-5.1',
    useAllPricingModels: true,
    steps: [
      {
        title: 'Install Cline',
        description:
          'Install Cline in VS Code or a compatible editor, then open the Cline side panel settings.',
        commands: allSystems([
          {
            title: 'Extension search keyword',
            language: 'text',
            code: 'Cline',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Cline extension page',
          screenshotDescription:
            'Add a screenshot of the extension page or the Cline side panel.',
          checklist: [
            'Open the editor extension marketplace.',
            'Search for Cline.',
            'Install and enable the extension.',
            'Open the Cline side panel.',
          ],
        },
      },
      {
        title: 'Select OpenAI Compatible',
        description:
          'In Cline provider settings, choose OpenAI Compatible instead of the official OpenAI provider.',
        commands: allSystems([
          {
            title: 'Cline provider values',
            language: 'text',
            code: `API Provider: OpenAI Compatible\nBase URL: ${endpoint}\nAPI Key: ${apiKey}\nModel ID: gpt-5.1`,
            note: 'The Model ID must match one model returned by the pricing API.',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Cline provider settings',
          screenshotDescription:
            'Add a screenshot that marks API Provider, Base URL, API Key, and Model ID.',
          checklist: [
            'Click the settings icon in the Cline panel.',
            'Set API Provider to OpenAI Compatible.',
            'Paste the /v1 Base URL.',
            'Paste the API key.',
            'Enter the selected Model ID.',
          ],
        },
      },
      {
        title: 'Verify in Cline',
        description:
          'Save the provider, run the built-in verification if available, and ask Cline to complete a small task.',
        commands: allSystems([
          {
            title: 'Small task',
            language: 'text',
            code: 'Create a short TODO list for this project without editing files.',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Cline test result',
          screenshotDescription:
            'Add a screenshot showing Cline responding with the selected provider.',
          checklist: [
            'Save the provider configuration.',
            'Run Verify if Cline shows it.',
            'Submit the small task.',
            'If the request fails, confirm Provider is OpenAI Compatible and the model ID is exact.',
          ],
        },
      },
    ],
  },
  {
    id: 'continue',
    name: 'Continue',
    iconNames: ['Continue.Color'],
    summary:
      'Configure Continue with provider openai, apiBase, apiKey, and an exact model ID in config.yaml.',
    modelHint: 'gpt-5.1',
    useAllPricingModels: true,
    steps: [
      {
        title: 'Open Continue configuration',
        description:
          'Install Continue, open its configuration file, and add a model entry for the gateway.',
        commands: shellSystems(
          [
            {
              title: 'Common config path',
              language: 'bash',
              code: 'code ~/.continue/config.yaml',
            },
          ],
          [
            {
              title: 'Common config path',
              language: 'powershell',
              code: 'code $env:USERPROFILE\\.continue\\config.yaml',
            },
          ]
        ),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Continue config entry',
          screenshotDescription:
            'Add a screenshot of Continue settings or the opened config.yaml file.',
          checklist: [
            'Install Continue in the editor.',
            'Open Continue settings.',
            'Open config.yaml.',
            'Locate the models section.',
          ],
        },
      },
      {
        title: 'Add OpenAI-compatible model',
        description:
          'Use provider openai, set apiBase to the gateway /v1 endpoint, and set model to the selected model ID.',
        commands: allSystems([
          {
            title: 'config.yaml model entry',
            language: 'yaml',
            code: `name: Abyss AI\nversion: 0.0.1\nschema: v1\n\nmodels:\n  - name: Abyss AI gpt-5.1\n    provider: openai\n    model: gpt-5.1\n    apiBase: ${endpoint}\n    apiKey: ${apiKey}`,
            note: 'Continue uses apiBase. The name field is only the local display name; model is the ID sent to the API.',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Continue YAML model',
          screenshotDescription:
            'Add a screenshot that highlights provider, model, apiBase, and apiKey.',
          checklist: [
            'Add a model item under models.',
            'Set provider to openai.',
            'Set apiBase to the /v1 endpoint.',
            'Set model to the selected model ID.',
            'Save config.yaml.',
          ],
        },
      },
      {
        title: 'Reload and test Continue',
        description:
          'Reload the editor or Continue extension, select the configured model name, and run a chat or edit request.',
        commands: allSystems([
          {
            title: 'Test prompt',
            language: 'text',
            code: 'Explain what files are currently open and do not modify anything.',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Continue model selector',
          screenshotDescription:
            'Add a screenshot of the configured Abyss AI model selected in Continue.',
          checklist: [
            'Reload Continue or restart the editor.',
            'Open the Continue model selector.',
            'Choose the configured Abyss AI model.',
            'Send the test prompt.',
          ],
        },
      },
    ],
  },
  {
    id: 'chatbox',
    name: 'Chatbox',
    iconNames: ['ChatBox.Color'],
    summary:
      'Add Abyss AI as an OpenAI API compatible provider in Chatbox and run a quick conversation test.',
    modelHint: 'gpt-5.1',
    useAllPricingModels: true,
    steps: [
      {
        title: 'Install Chatbox',
        description:
          'Install Chatbox on Windows, macOS, or Linux, then open Settings and Model Provider.',
        commands: allSystems([
          {
            title: 'Download page',
            language: 'text',
            code: 'https://chatboxai.app',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Chatbox settings',
          screenshotDescription:
            'Add a screenshot of Settings -> Model Provider.',
          checklist: [
            'Install and open Chatbox.',
            'Open Settings from the sidebar.',
            'Enter Model Provider.',
            'Click Add if no suitable provider exists.',
          ],
        },
      },
      {
        title: 'Add OpenAI API compatible provider',
        description:
          'Choose OpenAI API compatible, fill API Host, API Key, and add at least one model ID.',
        commands: allSystems([
          {
            title: 'Chatbox provider values',
            language: 'text',
            code: `Provider type: OpenAI API compatible\nAPI Host: ${endpoint}\nAPI Key: ${apiKey}\nModel: gpt-5.1`,
            note: 'Leave API Path empty unless your Chatbox version requires it. If connection fails, check whether /v1 was duplicated.',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Chatbox provider form',
          screenshotDescription:
            'Add a screenshot that marks API Host, API Key, model list, and Check.',
          checklist: [
            'Select OpenAI API compatible as the provider type.',
            'Paste the /v1 API Host.',
            'Paste the API key.',
            'Add the exact model ID.',
            'Click Check.',
          ],
        },
      },
      {
        title: 'Create a test conversation',
        description:
          'Return to the chat page, select the configured provider model, and send a short test prompt.',
        commands: allSystems([
          {
            title: 'Test prompt',
            language: 'text',
            code: 'Reply with: Chatbox is connected to Abyss AI.',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Chatbox conversation',
          screenshotDescription:
            'Add a screenshot of Chatbox with the Abyss AI model selected.',
          checklist: [
            'Create a new chat.',
            'Select the added model.',
            'Send the test prompt.',
            'If the model is missing, return to Model Provider and add it manually.',
          ],
        },
      },
    ],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    iconNames: ['OpenCode.Color'],
    summary:
      'Configure OpenCode with the openai-compatible AI SDK provider, a /v1 baseURL, and a live model from pricing.',
    modelHint: 'gpt-5.1',
    useAllPricingModels: true,
    steps: [
      {
        title: 'Install OpenCode',
        description:
          'Install OpenCode from its official installer or package manager, then confirm the command is available.',
        commands: shellSystems(
          [
            {
              title: 'Install with official script',
              language: 'bash',
              code: 'curl -fsSL https://opencode.ai/install | bash\nopencode --version',
            },
            {
              title: 'Install with npm',
              language: 'bash',
              code: 'npm install -g opencode-ai\nopencode --version',
            },
          ],
          [
            {
              title: 'Install with npm',
              language: 'powershell',
              code: 'npm install -g opencode-ai\nopencode --version',
            },
          ]
        ),
        reference: {
          screenshotTitle: 'Screenshot placeholder: OpenCode install result',
          screenshotDescription:
            'Add a terminal screenshot showing opencode --version.',
          checklist: [
            'Install OpenCode.',
            'Open a fresh terminal.',
            'Run opencode --version.',
            'Confirm the command is available in PATH.',
          ],
        },
      },
      {
        title: 'Create OpenCode provider config',
        description:
          'Create opencode.json and declare a custom provider using @ai-sdk/openai-compatible.',
        commands: shellSystems(
          [
            {
              title: 'Environment',
              language: 'bash',
              code: `export NEWAPI_API_KEY="${apiKey}"`,
            },
            {
              title: '~/.config/opencode/opencode.json',
              language: 'json',
              code: `{\n  "$schema": "https://opencode.ai/config.json",\n  "provider": {\n    "abyssai": {\n      "npm": "@ai-sdk/openai-compatible",\n      "name": "Abyss AI",\n      "options": {\n        "baseURL": "${endpoint}",\n        "apiKey": "{env:NEWAPI_API_KEY}"\n      },\n      "models": {\n        "gpt-5.1": {\n          "name": "gpt-5.1"\n        }\n      }\n    }\n  },\n  "model": "abyssai/gpt-5.1"\n}`,
            },
          ],
          [
            {
              title: 'Environment',
              language: 'powershell',
              code: `$env:NEWAPI_API_KEY="${apiKey}"`,
            },
            {
              title: '%USERPROFILE%\\.config\\opencode\\opencode.json',
              language: 'json',
              code: `{\n  "$schema": "https://opencode.ai/config.json",\n  "provider": {\n    "abyssai": {\n      "npm": "@ai-sdk/openai-compatible",\n      "name": "Abyss AI",\n      "options": {\n        "baseURL": "${endpoint}",\n        "apiKey": "{env:NEWAPI_API_KEY}"\n      },\n      "models": {\n        "gpt-5.1": {\n          "name": "gpt-5.1"\n        }\n      }\n    }\n  },\n  "model": "abyssai/gpt-5.1"\n}`,
            },
          ]
        ),
        reference: {
          screenshotTitle: 'Screenshot placeholder: OpenCode config file',
          screenshotDescription:
            'Add a screenshot of opencode.json with provider and model highlighted.',
          checklist: [
            'Create the OpenCode config file.',
            'Set npm to @ai-sdk/openai-compatible.',
            'Set baseURL to the /v1 endpoint.',
            'Use an environment variable for the API key.',
            'Set model to provider-id/model-id.',
          ],
        },
      },
      {
        title: 'Start and select model',
        description:
          'Run OpenCode, inspect available models, and send a simple request with the configured provider model.',
        commands: shellSystems(
          [
            {
              title: 'Run OpenCode',
              language: 'bash',
              code: 'cd /path/to/your/project\nopencode\n# inside OpenCode: /models',
            },
          ],
          [
            {
              title: 'Run OpenCode',
              language: 'powershell',
              code: 'cd C:\\path\\to\\your\\project\nopencode\n# inside OpenCode: /models',
            },
          ]
        ),
        reference: {
          screenshotTitle: 'Screenshot placeholder: OpenCode model list',
          screenshotDescription:
            'Add a screenshot showing abyssai/gpt-5.1 in the OpenCode model list.',
          checklist: [
            'Run OpenCode inside a project.',
            'Open /models.',
            'Confirm the custom provider model is visible.',
            'Send a small prompt to verify the connection.',
          ],
        },
      },
    ],
  },
  {
    id: 'open-webui',
    name: 'Open WebUI',
    iconNames: ['OpenWebUI.Color'],
    summary:
      'Connect a self-hosted Open WebUI instance to the gateway from Admin Settings or environment variables.',
    modelHint: 'gpt-5.1',
    useAllPricingModels: true,
    steps: [
      {
        title: 'Add OpenAI connection',
        description:
          'Open Admin Settings, Connections, OpenAI, then add a connection for the gateway.',
        commands: allSystems([
          {
            title: 'Admin path',
            language: 'text',
            code: 'Admin Settings -> Connections -> OpenAI -> Add Connection',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Open WebUI connections',
          screenshotDescription:
            'Add a screenshot that highlights Admin Settings -> Connections -> OpenAI.',
          checklist: [
            'Log in as an Open WebUI admin.',
            'Open Admin Settings.',
            'Open Connections.',
            'Open the OpenAI connection section.',
            'Click Add Connection.',
          ],
        },
      },
      {
        title: 'Fill URL and API key',
        description:
          'Set the connection URL to the gateway /v1 endpoint and paste the API key.',
        commands: allSystems([
          {
            title: 'Connection values',
            language: 'text',
            code: `URL: ${endpoint}\nAPI Key: ${apiKey}\nModel IDs Filter: gpt-5.1`,
            note: 'Use Model IDs Filter if Open WebUI cannot load /models from the provider.',
          },
          {
            title: 'Docker environment alternative',
            language: 'env',
            code: `ENABLE_OPENAI_API=True\nOPENAI_API_BASE_URL=${endpoint}\nOPENAI_API_KEY=${apiKey}`,
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Open WebUI connection form',
          screenshotDescription:
            'Add a screenshot that marks URL, API Key, Model IDs Filter, and Save.',
          checklist: [
            'Paste the /v1 URL.',
            'Paste the API key.',
            'Add the selected model to Model IDs Filter if needed.',
            'Save the connection.',
          ],
        },
      },
      {
        title: 'Verify model selector',
        description:
          'Return to chat, confirm the model appears in the model selector, and send a smoke test.',
        commands: allSystems([
          {
            title: 'Docker localhost note',
            language: 'text',
            code: 'If Open WebUI runs in Docker and the gateway is on the host machine, use host.docker.internal instead of localhost.',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: Open WebUI model selector',
          screenshotDescription:
            'Add a screenshot of the model selector after saving the connection.',
          checklist: [
            'Open the chat page.',
            'Open the model selector.',
            'Choose the gateway model.',
            'Send a smoke test prompt.',
          ],
        },
      },
    ],
  },
  {
    id: 'lobechat',
    name: 'LobeChat / LobeHub',
    iconNames: ['LobeHub.Color'],
    summary:
      'Use LobeChat with an OpenAI proxy address, API key, and an explicit model list for the gateway.',
    modelHint: 'gpt-5.1',
    useAllPricingModels: true,
    steps: [
      {
        title: 'Open model provider settings',
        description:
          'Open Settings, Language Models, and the OpenAI provider configuration.',
        commands: allSystems([
          {
            title: 'Settings path',
            language: 'text',
            code: 'Settings -> Language Models -> OpenAI',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: LobeChat provider settings',
          screenshotDescription:
            'Add a screenshot of Settings -> Language Models -> OpenAI.',
          checklist: [
            'Open LobeChat settings.',
            'Enter Language Models.',
            'Open the OpenAI provider.',
            'Confirm API Key and API Proxy Address fields are visible.',
          ],
        },
      },
      {
        title: 'Configure proxy address and model list',
        description:
          'Paste the API key, set API Proxy Address to the /v1 endpoint, then fetch or manually add the selected model.',
        commands: allSystems([
          {
            title: 'LobeChat UI values',
            language: 'text',
            code: `API Key: ${apiKey}\nAPI Proxy Address: ${endpoint}\nModel List: +gpt-5.1`,
            note: 'Use +model to add a model. Use -all,+model if you want to show only selected gateway models.',
          },
          {
            title: 'Self-hosted environment alternative',
            language: 'env',
            code: `ENABLED_OPENAI=1\nOPENAI_API_KEY=${apiKey}\nOPENAI_PROXY_URL=${endpoint}\nOPENAI_MODEL_LIST=+gpt-5.1`,
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: LobeChat OpenAI form',
          screenshotDescription:
            'Add a screenshot that marks API Proxy Address, Model List, Get Model List, and Connectivity Check.',
          checklist: [
            'Paste the API key.',
            'Paste the /v1 proxy address.',
            'Click Get Model List or add the model manually.',
            'Run Connectivity Check.',
          ],
        },
      },
      {
        title: 'Start a chat',
        description:
          'Return to the chat page, select the configured model, and send a short verification prompt.',
        commands: allSystems([
          {
            title: 'Verification prompt',
            language: 'text',
            code: 'Reply with: LobeChat gateway configuration is working.',
          },
        ]),
        reference: {
          screenshotTitle: 'Screenshot placeholder: LobeChat chat page',
          screenshotDescription:
            'Add a screenshot with the gateway model selected in chat.',
          checklist: [
            'Open a new chat.',
            'Select the gateway model.',
            'Send the verification prompt.',
            'If the response is empty, check whether the /v1 suffix is correct.',
          ],
        },
      },
    ],
  },
  {
    id: 'cc-switch',
    name: 'CC Switch',
    iconNames: [],
    imageUrl: 'https://ccswitch.io/assets/cc-switch-logo-BPrI77SG.png',
    summary:
      'Install CC Switch to manage and switch providers for Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, and other coding agents.',
    modelHintUrl: 'https://ccswitch.io/',
    useAllPricingModels: true,
    steps: [
      {
        title: 'Install',
        description:
          'Download and install CC Switch for your operating system. The app is built with Tauri 2 (Rust) and is code-signed on macOS and Windows.',
        commands: {
          mac: [
            {
              title: 'Install with Homebrew',
              language: 'bash',
              code: 'brew install --cask cc-switch\nopen -a "CC Switch"',
              note: 'Homebrew cask is the recommended way on macOS. The app is code-signed and notarized by Apple.',
            },
            {
              title: 'Or download manually',
              language: 'bash',
              code: 'open https://github.com/farion1231/cc-switch/releases',
              note: 'Download the .dmg installer from the Releases page.',
            },
          ],
          windows: [
            {
              title: 'Download installer',
              language: 'powershell',
              code: 'Start-Process "https://github.com/farion1231/cc-switch/releases"',
              note: 'Download CC-Switch-v{version}-Windows.msi (installer) or Windows-Portable.zip (portable version, no install needed).',
            },
          ],
          linux: [
            {
              title: 'Arch Linux (AUR)',
              language: 'bash',
              code: 'paru -S cc-switch-bin',
            },
            {
              title: 'Debian / Ubuntu (.deb)',
              language: 'bash',
              code: 'xdg-open https://github.com/farion1231/cc-switch/releases',
              note: 'Download .deb for Debian/Ubuntu, .rpm for Fedora/RHEL, or .AppImage for universal Linux.',
            },
          ],
        },
      },
      {
        title: '添加服务商',
        description:
          'Open CC Switch, click Add Provider, then choose from 50+ built-in presets or create a custom provider. Fill in the base URL and API key below, then click Import.',
        commands: {
          mac: [
            {
              title: 'Provider values',
              language: 'text',
              code: `Base URL: ${endpoint}\nAPI Key: ${apiKey}`,
            },
          ],
          windows: [
            {
              title: 'Provider values',
              language: 'text',
              code: `Base URL: ${endpoint}\nAPI Key: ${apiKey}`,
            },
          ],
          linux: [
            {
              title: 'Provider values',
              language: 'text',
              code: `Base URL: ${endpoint}\nAPI Key: ${apiKey}`,
            },
          ],
        },
      },
      {
        title: 'Switch & Use',
        description:
          'Select the target CLI tool tab in CC Switch, choose a provider and click Enable. Claude Code supports hot-switching; for Codex, Gemini CLI, OpenClaw and others, restart the terminal after switching.',
        commands: {
          mac: [
            {
              title: 'Quick switch',
              language: 'text',
              code: 'System tray → click CC Switch icon → select provider → Enable',
              note: 'You can also switch providers directly from the system tray without opening the full app.',
            },
            {
              title: 'Data location',
              language: 'bash',
              code: '~/.cc-switch/cc-switch.db   # providers, MCP, prompts, skills\n~/.cc-switch/settings.json  # device-level UI preferences\n~/.cc-switch/backups/       # auto-rotated backups',
            },
          ],
          windows: [
            {
              title: 'Quick switch',
              language: 'text',
              code: 'System tray → click CC Switch icon → select provider → Enable',
              note: 'You can also switch providers directly from the system tray without opening the full app.',
            },
            {
              title: 'Data location',
              language: 'powershell',
              code: '$env:USERPROFILE\\.cc-switch\\cc-switch.db   # providers, MCP, prompts, skills\n$env:USERPROFILE\\.cc-switch\\settings.json  # device-level UI preferences\n$env:USERPROFILE\\.cc-switch\\backups\\       # auto-rotated backups',
            },
          ],
          linux: [
            {
              title: 'Quick switch',
              language: 'text',
              code: 'System tray → click CC Switch icon → select provider → Enable',
              note: 'You can also switch providers directly from the system tray without opening the full app.',
            },
            {
              title: 'Data location',
              language: 'bash',
              code: '~/.cc-switch/cc-switch.db   # providers, MCP, prompts, skills\n~/.cc-switch/settings.json  # device-level UI preferences\n~/.cc-switch/backups/       # auto-rotated backups',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'troubleshooting',
    name: '常见问题排查',
    iconNames: [],
    summary:
      '集中排查 API Key、Base URL、模型权限、环境变量和旧配置覆盖等最常见连接问题。',
    modelHint: 'gpt-5.1',
    useAllPricingModels: true,
    steps: [
      {
        title: '先验证接口是否可访问',
        description:
          '在排查工具之前，先用 curl 验证服务网站、API Key 和模型列表接口是否正常。',
        commands: shellSystems(
          [
            {
              title: '检查模型列表',
              language: 'bash',
              code: `curl ${endpoint}/models \\\n  -H "Authorization: Bearer ${apiKey}"`,
            },
            {
              title: '检查聊天接口',
              language: 'bash',
              code: `curl ${endpoint}/chat/completions \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"gpt-5.1","messages":[{"role":"user","content":"ping"}]}'`,
            },
          ],
          [
            {
              title: '检查模型列表',
              language: 'powershell',
              code: `curl.exe ${endpoint}/models ` +
                "`\n  -H \"Authorization: Bearer ${apiKey}\"",
            },
            {
              title: '检查聊天接口',
              language: 'powershell',
              code: `curl.exe ${endpoint}/chat/completions ` +
                "`\n  -H \"Authorization: Bearer ${apiKey}\" " +
                "`\n  -H \"Content-Type: application/json\" " +
                "`\n  -d '{\"model\":\"gpt-5.1\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}]}'",
            },
          ]
        ),
        reference: {
          screenshotTitle: '截图占位：接口检查结果',
          screenshotDescription:
            '这里后续补终端成功返回模型列表或聊天响应的截图。',
          checklist: [
            '先复制当前页面显示的 /v1 地址。',
            '使用自己的真实 API Key 替换示例 Key。',
            '运行模型列表检查。',
            '运行聊天接口检查。',
            '如果 curl 都失败，优先排查服务网站、Key、余额和权限，不要先怀疑工具配置。',
          ],
        },
      },
      {
        title: '检查 Base URL 是否填错',
        description:
          '不同工具对地址拼接规则不同，最常见错误是重复填写 /v1 或把完整接口路径填进 Base URL。',
        commands: allSystems([
          {
            title: '常见地址填写方式',
            language: 'text',
            code: `站点根地址: ${serviceUrl}\nOpenAI 兼容 Base URL: ${endpoint}\n不要填: ${endpoint}/chat/completions\n不要重复: ${endpoint}/v1`,
          },
        ]),
        reference: {
          screenshotTitle: '截图占位：Base URL 字段',
          screenshotDescription:
            '这里后续补一个工具配置页截图，并标出应该填写 Base URL 的位置。',
          checklist: [
            '确认工具要求的是站点根地址还是 /v1 地址。',
            '不要把 /chat/completions、/responses 这类完整接口路径填入 Base URL。',
            '如果工具会自动拼接路径，尝试使用站点根地址。',
            '如果工具明确要求 OpenAI-compatible Base URL，通常填写 /v1 地址。',
            '检查地址末尾是否重复出现 /v1。',
          ],
        },
      },
      {
        title: '检查模型权限和旧配置覆盖',
        description:
          '模型名称必须来自实时 pricing 数据；如果工具仍然调用旧模型，通常是配置文件、环境变量或客户端缓存没有刷新。',
        commands: allSystems([
          {
            title: '重点检查项',
            language: 'text',
            code: '401: API Key 无效或没有传入\n403: 当前账号、分组或模型没有权限\n404: Base URL 或接口路径错误\nmodel_not_found: 模型名不存在或拼写不一致\nempty response: 重点检查 /v1 后缀和模型权限',
          },
        ]),
        reference: {
          screenshotTitle: '截图占位：错误提示位置',
          screenshotDescription:
            '这里后续补常见错误弹窗、终端报错或网络请求截图。',
          checklist: [
            '确认页面模型选择器中显示的是 pricing 接口实时返回的模型。',
            '确认工具里填写的模型名和页面选择的模型完全一致。',
            '重新打开终端或重启客户端，让环境变量重新加载。',
            '检查旧配置文件是否仍然指定了旧 Base URL、旧 Key 或旧模型。',
            '确认账号余额、分组权限和模型权限没有被限制。',
          ],
        },
      },
    ],
  },
]

function ToolLogo({
  guide,
  active,
  size = 'sm',
}: {
  guide: ToolGuide
  active?: boolean
  size?: 'sm' | 'md'
}) {
  const iconSize = size === 'md' ? 24 : 18
  const isPair = guide.iconNames.length > 1
  const fallbackIconClassName =
    size === 'md' ? 'size-6 text-muted-foreground' : 'size-4 text-muted-foreground'

  return (
    <div
      className={cn(
        'bg-muted/40 flex shrink-0 items-center justify-center rounded-lg border',
        size === 'md' ? 'size-11' : 'size-8',
        active ? 'border-primary/30 bg-primary/5' : 'border-border/70'
      )}
      aria-hidden='true'
    >
      {guide.imageUrl ? (
        <img
          src={guide.imageUrl}
          alt=''
          className={cn(
            'rounded-md object-contain',
            size === 'md' ? 'size-8' : 'size-6'
          )}
        />
      ) : isPair ? (
        <div className='flex -space-x-1.5'>
          {guide.iconNames.map((iconName) => (
            <span
              key={iconName}
              className='bg-background flex size-5 items-center justify-center rounded-full ring-1 ring-border'
            >
              {getLobeIcon(iconName, 15)}
            </span>
          ))}
        </div>
      ) : guide.iconNames[0] ? (
        getLobeIcon(guide.iconNames[0], iconSize)
      ) : guide.id === 'nodejs' ? (
        <SiNodedotjs
          className={cn(
            size === 'md' ? 'size-6' : 'size-4',
            'text-[#5FA04E]'
          )}
        />
      ) : (
        <Download className={fallbackIconClassName} />
      )}
    </div>
  )
}

function CodeBlock({ command }: { command: CommandBlock }) {
  return (
    <div className='border-border/70 bg-card overflow-hidden rounded-lg border shadow-sm'>
      <div className='bg-muted/40 flex items-center justify-between gap-3 border-b px-3 py-2'>
        <div className='flex min-w-0 items-center gap-2'>
          <Terminal className='text-muted-foreground size-4 shrink-0' />
          <span className='truncate text-xs font-medium'>
            {docText(command.title)}
          </span>
          <Badge variant='outline' className='hidden sm:inline-flex'>
            {command.language}
          </Badge>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-7 shrink-0'
          aria-label={docText('Copy code')}
          onClick={() => copyToClipboard(command.code)}
        >
          <Copy className='size-3.5' />
        </Button>
      </div>
      <pre className='bg-zinc-950 p-4 text-[13px] leading-6 text-zinc-100'>
        <code className='block overflow-x-auto font-mono'>{command.code}</code>
      </pre>
      {command.note ? (
        <div className='text-muted-foreground border-t px-3 py-2 text-xs'>
          {docText(command.note)}
        </div>
      ) : null}
    </div>
  )
}

function getPricingModelName(model?: PricingModel) {
  return model?.model_name || model?.key || ''
}

function getGuidePricingModels(guide: ToolGuide, models: PricingModel[]) {
  const availableModels = models.filter((model) => getPricingModelName(model))

  if (guide.useAllPricingModels) {
    return availableModels
  }

  if (!guide.endpointTypes?.length) {
    return []
  }

  return availableModels.filter((model) =>
    guide.endpointTypes?.some((endpointType) =>
      model.supported_endpoint_types?.includes(endpointType)
    )
  )
}

function getDefaultPricingModelName(guide: ToolGuide, models: PricingModel[]) {
  const modelNames = models.map((model) => getPricingModelName(model))

  if (guide.id === 'claude-code') {
    const claudeModels = modelNames.filter((name) =>
      name.toLowerCase().includes('claude')
    )
    const opusModel = claudeModels.find((name) =>
      name.toLowerCase().includes('opus')
    )
    const sonnetModel = claudeModels.find((name) =>
      name.toLowerCase().includes('sonnet')
    )

    return opusModel || sonnetModel || claudeModels[0] || modelNames[0] || ''
  }

  if (guide.id === 'codex') {
    const gptModels = modelNames.filter((name) =>
      name.toLowerCase().includes('gpt')
    )
    const nonImageGptModel = gptModels.find(
      (name) => !name.toLowerCase().includes('image')
    )

    return nonImageGptModel || gptModels[0] || modelNames[0] || ''
  }

  if (guide.id === 'gemini-cli') {
    const geminiModel = modelNames.find((name) =>
      name.toLowerCase().includes('gemini')
    )

    return geminiModel || modelNames[0] || ''
  }

  return modelNames[0] || ''
}

function getSelectedGuide(guide: ToolGuide, selectedModel?: string): ToolGuide {
  if (!selectedModel || selectedModel === guide.modelHint) {
    return guide
  }

  return {
    ...guide,
    modelHint: selectedModel,
    steps: guide.steps.map((step) => ({
      ...step,
      commands: Object.fromEntries(
        Object.entries(step.commands).map(([system, commands]) => [
          system,
          commands?.map((command) => ({
            ...command,
            code: command.code.split(guide.modelHint).join(selectedModel),
          })),
        ])
      ) as Partial<Record<SystemId, CommandBlock[]>>,
      reference: step.reference,
    })),
  }
}

function StepCard({
  step,
  system,
  index,
}: {
  step: GuideStep
  system: SystemId
  index: number
}) {
  const commands = step.commands[system] ?? []
  const reference = step.reference

  return (
    <div className='border-border/70 rounded-lg border'>
      <AccordionItem value={`step-${index}`}>
        <AccordionTrigger className='px-4 py-3 hover:no-underline'>
          <div className='flex flex-1 gap-3 text-left'>
            <div className='bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold'>
              {index + 1}
            </div>
            <div className='min-w-0 space-y-1'>
              <div className='flex items-center gap-2'>
                <h2 className='text-base font-semibold tracking-tight'>
                  {docText(step.title)}
                </h2>
                {step.openUrl && (
                  <a
                    href={step.openUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground no-underline transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary'
                    onClick={(e) => e.stopPropagation()}
                  >
                    {docText('Open page')}
                    <svg className='size-3' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                      <path d='M7 17L17 7' />
                      <path d='M7 7h10v10' />
                    </svg>
                  </a>
                )}
              </div>
              <p className='text-muted-foreground text-sm leading-6'>
                {docText(step.description)}
              </p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className='px-4 pb-4'>
          <div className='space-y-5'>
            {/* Code blocks */}
            {commands.length > 0 && (
              <div className='grid gap-3'>
                {commands.map((command) => (
                  <CodeBlock key={`${command.title}-${command.language}`} command={command} />
                ))}
              </div>
            )}
	            {/* Detailed steps with text + screenshot placeholders */}
            {reference && reference.checklist.length > 0 && (
              <div className='space-y-4'>
                {reference.checklist.map((item, i) => {
                  const screenshot = reference.screenshots?.[i]
                  return (
                    <div
                      key={`detail-${index}-${i}`}
                      className='border-border/60 bg-muted/30 rounded-lg border p-4'
                    >
                      <div className='flex items-start gap-3'>
                        <span className='bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold'>
                          {i + 1}
                        </span>
                        <div className='min-w-0 flex-1 space-y-3'>
                          {/* Step title */}
                          <h3 className='text-sm font-semibold leading-snug'>
                            {docText(item)}
                          </h3>
                          {/* Text description */}
                          <p className='text-muted-foreground text-sm leading-relaxed'>
                            {screenshot?.description
                              ? docText(screenshot.description)
                              : docText(
                                  '这里预留给当前小步骤的详细说明，后续可以补充截图说明、注意事项或失败排查。'
                                )}
                          </p>
                          {/* Screenshot */}
                          {screenshot?.imageUrl ? (
                            <div className='overflow-hidden rounded-md border border-border/50'>
                              <img
                                src={screenshot.imageUrl}
                                alt={docText(screenshot.title)}
                                className='w-full object-contain'
                                loading='lazy'
                              />
                            </div>
                          ) : (
                            <div className='border-border/50 bg-muted/60 flex items-center justify-center rounded-md border border-dashed py-8'>
                              <div className='text-center space-y-1'>
                                <div className='text-muted-foreground/60 text-2xl'>
                                  <span role='img' aria-label='screenshot'>
                                    🖼
                                  </span>
                                </div>
                                <p className='text-muted-foreground/60 text-xs'>
                                  {screenshot
                                    ? docText(screenshot.title)
                                    : docText('截图占位 — 后续补充实际截图')}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {step.tip && (
              <div className='mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-700'>
                <svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='mt-0.5 shrink-0 text-blue-500'><circle cx='12' cy='12' r='10'/><path d='M12 16v-4'/><path d='M12 8h.01'/></svg>
                <span>{docText(step.tip)}</span>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </div>
  )
}

function ToolButton({
  guide,
  active,
  onClick,
}: {
  guide: ToolGuide
  active: boolean
  onClick: () => void
}) {
  const guideName =
    guide.id === 'config-intro' || guide.id === 'nodejs'
      ? docText(guide.name)
      : guide.name

  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
        active
          ? 'border-primary/50 bg-primary/5'
          : 'border-border/70 bg-card hover:bg-muted/40'
      )}
    >
      <ToolLogo guide={guide} active={active} />
      <div className='min-w-0 flex-1 space-y-1'>
        <div className='flex items-center justify-between gap-2'>
          <span className='text-sm font-semibold'>{guideName}</span>
          <div className='flex items-center gap-1.5'>
            {recommendedTools.includes(guide.id) && (
              <span className='inline-flex h-5 items-center rounded-md bg-blue-500/10 px-1.5 text-[11px] font-medium text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'>
                {docText('Recommended')}
              </span>
            )}
            <ChevronRight
              className={cn(
                'size-4 shrink-0 transition-transform',
                active && 'translate-x-0.5'
              )}
            />
          </div>
        </div>
        <p className='text-muted-foreground line-clamp-2 text-xs leading-5'>
          {docText(guide.summary)}
        </p>
      </div>
    </button>
  )
}

export function ToolGuides() {
  const [activeTool, setActiveTool] = useState<ToolId>('config-intro')
  const [activeSystem, setActiveSystem] = useState<SystemId>('windows')
  const [selectedModels, setSelectedModels] = useState<
    Partial<Record<ToolId, string>>
  >({})
  const pricingQuery = useQuery({
    queryKey: ['docs-pricing-models'],
    queryFn: getPricing,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const baseGuide = useMemo(
    () => guides.find((item) => item.id === activeTool) ?? guides[0],
    [activeTool]
  )
  const guidePricingModels = useMemo(
    () => getGuidePricingModels(baseGuide, pricingQuery.data?.data ?? []),
    [baseGuide, pricingQuery.data?.data]
  )
  const currentSelectedModel = selectedModels[baseGuide.id]
  const selectedModel =
    currentSelectedModel &&
    guidePricingModels.some(
      (model) => getPricingModelName(model) === currentSelectedModel
    )
      ? currentSelectedModel
      : getDefaultPricingModelName(baseGuide, guidePricingModels)

  useEffect(() => {
    if (!baseGuide.endpointTypes?.length && !baseGuide.useAllPricingModels) {
      return
    }
    if (!selectedModel || selectedModels[baseGuide.id] === selectedModel) {
      return
    }
    setSelectedModels((prev) => ({
      ...prev,
      [baseGuide.id]: selectedModel,
    }))
  }, [baseGuide, selectedModel, selectedModels])

  const guide = useMemo(
    () => getSelectedGuide(baseGuide, selectedModel),
    [baseGuide, selectedModel]
  )
  const hasModelSelector =
    Boolean(baseGuide.endpointTypes?.length || baseGuide.useAllPricingModels)
  const guideName =
    guide.id === 'config-intro' || guide.id === 'nodejs'
      ? docText(guide.name)
      : guide.name

  return (
    <PublicLayout>
      <div className='mx-auto max-w-7xl pb-12'>
        <div className='border-border/70 bg-card/60 mb-6 rounded-lg border px-5 py-6 shadow-sm md:px-6'>
          <div className='grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-end'>
            <div className='space-y-4'>
              <Badge variant='outline' className='gap-1.5'>
                <KeyRound className='size-3' />
                {docText('API configuration guide')}
              </Badge>
              <div className='max-w-3xl space-y-3'>
                <h1 className='text-3xl font-semibold tracking-tight md:text-4xl'>
                  {docText('Tool setup tutorials')}
                </h1>
                <p className='text-muted-foreground text-sm leading-6 md:text-base'>
                  {docText(
                    'Configure popular coding tools to connect to your unified API gateway, with install, configuration, startup, and verification steps for each operating system.'
                  )}
                </p>
              </div>
            </div>
            <div className='grid grid-cols-3 gap-2 rounded-lg border bg-background/60 p-2'>
              {systemOptions.map((system) => {
                const Icon = system.icon
                const active = activeSystem === system.id
                return (
                  <button
                    key={system.id}
                    type='button'
                    onClick={() => setActiveSystem(system.id)}
                    className={cn(
                      'flex h-20 flex-col items-center justify-center gap-2 rounded-md border text-xs font-medium transition-colors',
                      active
                        ? 'border-primary/50 bg-primary/5 text-foreground shadow-sm'
                        : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('size-5', system.iconClassName)} />
                    {system.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className='grid gap-6 lg:grid-cols-[20rem_1fr]'>
          <aside className='lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto'>
            <div className='grid gap-2'>
              {guides.map((item) => (
                <ToolButton
                  key={item.id}
                  guide={item}
                  active={item.id === guide.id}
                  onClick={() => setActiveTool(item.id)}
                />
              ))}
            </div>
          </aside>

          <div className='min-w-0 space-y-5'>
            <div className='border-border/70 bg-card rounded-lg border p-5 shadow-sm'>
              <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
                <div className='flex min-w-0 gap-3'>
                  <ToolLogo guide={guide} active size='md' />
                  <div className='min-w-0 space-y-2'>
                    <h2 className='text-2xl font-semibold tracking-tight'>
                      {guideName}
                    </h2>
                    <p className='text-muted-foreground max-w-2xl text-sm leading-6'>
                      {docText(guide.summary)}
                    </p>
                  </div>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  {guide.copyValue && guide.id !== 'config-intro' ? (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='gap-1.5'
                      onClick={() => copyToClipboard(guide.copyValue!)}
                    >
                      <Copy className='size-3.5' />
                      {docText(guide.copyLabel ?? 'Copy')}
                    </Button>
                  ) : null}
                  {guide.id !== 'config-intro' ? (
                    <div className='bg-muted text-muted-foreground flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium'>
                      <ChevronRight className='size-3' />
                      {systemOptions.find((system) => system.id === activeSystem)?.label}
                    </div>
                  ) : null}
                  {hasModelSelector ? (
                    <div className='flex min-w-0 items-center'>
                      <Select
                        items={guidePricingModels.map((model) => {
                          const modelName = getPricingModelName(model)
                          return {
                            value: modelName,
                            label: modelName,
                          }
                        })}
                        value={selectedModel || ''}
                        onValueChange={(value) => {
                          if (!value) return
                          setSelectedModels((prev) => ({
                            ...prev,
                            [baseGuide.id]: value,
                          }))
                        }}
                        disabled={
                          pricingQuery.isLoading || guidePricingModels.length === 0
                        }
                      >
                        <SelectTrigger
                          size='sm'
                          className='max-w-[22rem] rounded-lg pr-2'
                        >
                          <CheckCircle2 className='text-muted-foreground size-3.5' />
                          <SelectValue
                            placeholder={
                              pricingQuery.isLoading
                                ? docText('Loading')
                                : docText('No models found')
                            }
                          />
                        </SelectTrigger>
                        <SelectContent
                          align='end'
                          alignItemWithTrigger={false}
                          className='max-h-80 min-w-72'
                        >
                          <SelectGroup>
                            {guidePricingModels.map((model) => {
                              const modelName = getPricingModelName(model)
                              return (
                                <SelectItem key={modelName} value={modelName}>
                                  <span className='max-w-64 truncate'>
                                    {modelName}
                                  </span>
                                </SelectItem>
                              )
                            })}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : guide.id === 'config-intro' ? (
                    <div className='flex min-w-0 items-center gap-2'>
                      <div className='border-border bg-background text-foreground flex min-h-9 min-w-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium'>
                        <LinkIcon className='text-muted-foreground size-4 shrink-0' />
                        <span className='truncate'>{guide.modelHint}</span>
                      </div>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='size-9 shrink-0 rounded-lg'
                        aria-label={docText(guide.copyLabel ?? 'Copy')}
                        onClick={() => copyToClipboard(guide.copyValue!)}
                      >
                        <Copy className='size-4' />
                      </Button>
                    </div>
                  ) : null}
                  {guide.modelHintUrl && guide.id !== 'config-intro' && (
                    <a
                      href={guide.modelHintUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='border-border text-foreground inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium no-underline transition-colors hover:border-primary/40 hover:text-primary'
                    >
                      <svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='size-3'><path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/></svg>
                      {docText('Visit official site')}
                    </a>
                  )}
                  {!guide.modelHintUrl && !hasModelSelector && guide.id !== 'config-intro' && (
                    <div className='border-border text-foreground flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium'>
                      <CheckCircle2 className='size-3' />
                      {guide.modelHint}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className='border-border/70 bg-card rounded-lg border p-5 shadow-sm'>
              <Accordion multiple defaultValue={guide.steps.map((_, i) => `step-${i}`)}>
                {guide.steps.map((step, index) => (
                  <StepCard
                    key={step.title}
                    step={step}
                    system={activeSystem}
                    index={index}
                  />
                ))}
                {guide.tip && (
                  <div className='mt-3 flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground'>
                    <svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='mt-0.5 shrink-0'><circle cx='12' cy='12' r='10'/><path d='M12 16v-4'/><path d='M12 8h.01'/></svg>
                    <span>{docText(guide.tip)}</span>
                  </div>
                )}
              </Accordion>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
