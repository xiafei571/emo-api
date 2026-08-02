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
import { normalizeInterfaceLanguage } from '../../i18n/languages.ts'

const zhCN = `
# 关于 EMO API

EMO API 是由日本 **SEMO AI, Inc.** 运营的统一 AI API 网关。

我们为开发者和组织提供一致的 API 接口，通过一个工作空间访问多种 AI 模型、管理 API Key、查看用量并处理计费。

## 我们提供的服务

- 统一访问平台支持的 AI 模型
- 兼容 OpenAI 的 API 接口
- 按使用量计费并公开模型价格
- API Key、额度和账户管理
- 流式响应与多模态模型支持

## 我们的理念

我们致力于让 AI 模型接入更简单、更清晰、更易于使用，减少应用连接不同 AI 服务商时所需的开发与运维工作。

EMO API 并不开发底层 AI 模型。模型能力、可用性、速率限制和服务商政策可能有所不同。用户应自行审查模型输出，并遵守适用法律和相关政策使用本服务。

## 隐私与负责任使用

我们仅处理运营服务、转发 API 请求、计算用量、防止滥用和提供支持所必需的信息。请勿提交您无权处理的凭证、机密信息或个人数据。

使用 EMO API 即表示您同意我们的[用户协议](/user-agreement)，并确认已阅读[隐私政策](/privacy-policy)。

## 联系我们

如有账户、计费、合作或服务相关问题，请联系 [info@semo.one](mailto:info@semo.one)。

## 开源项目

EMO API 基于 QuantumNous 开发的 [New API](https://github.com/QuantumNous/new-api) 构建；New API 基于 JustSong 开发的 [One API](https://github.com/songquanpeng/one-api)。本项目依照 [GNU AGPL v3.0](https://github.com/QuantumNous/new-api/blob/main/LICENSE) 许可使用。
`.trim()

const en = `
# About EMO API

EMO API is a unified AI API gateway operated by **SEMO AI, Inc.** in Japan.

We provide developers and organizations with one consistent API for accessing multiple AI models, managing API keys, monitoring usage, and handling billing through a single workspace.

## What We Provide

- Unified access to supported AI models
- OpenAI-compatible API endpoints
- Usage-based billing with transparent model pricing
- API key, quota, and account management
- Streaming responses and multimodal model support

## Our Approach

We focus on making AI model integration simple, predictable, and accessible. Our goal is to reduce the development and operational work required to connect applications with different AI providers.

EMO API does not develop the underlying AI models. Model capabilities, availability, rate limits, and provider policies may vary. Users are responsible for reviewing model outputs and using the service in accordance with applicable laws and policies.

## Privacy and Responsible Use

We process only the information necessary to operate the service, route API requests, calculate usage, prevent abuse, and provide support. Please do not submit credentials, confidential information, or personal data that you are not authorized to process.

By using EMO API, you agree to our [User Agreement](/user-agreement) and acknowledge our [Privacy Policy](/privacy-policy).

## Contact

For account, billing, partnership, or service inquiries, contact [info@semo.one](mailto:info@semo.one).

## Open Source

EMO API is built on [New API](https://github.com/QuantumNous/new-api) by QuantumNous, which is based on [One API](https://github.com/songquanpeng/one-api) by JustSong. This project is used under the [GNU AGPL v3.0 License](https://github.com/QuantumNous/new-api/blob/main/LICENSE).
`.trim()

const ja = `
# EMO API について

EMO API は、日本の **SEMO AI, Inc.** が運営する統合 AI API ゲートウェイです。

開発者や組織向けに、複数の AI モデルへのアクセス、API キーの管理、利用状況の確認、課金管理をひとつのワークスペースで行える共通 API を提供しています。

## 提供するサービス

- 対応する AI モデルへの統合アクセス
- OpenAI 互換の API エンドポイント
- 明確なモデル価格に基づく従量課金
- API キー、クォータ、アカウントの管理
- ストリーミング応答とマルチモーダルモデルへの対応

## 私たちの考え方

AI モデルの導入を、より簡単で分かりやすく、利用しやすいものにすることを目指しています。異なる AI プロバイダーをアプリケーションに接続するための開発・運用負担を減らすことが私たちの目的です。

EMO API は基盤となる AI モデルの開発元ではありません。モデルの機能、提供状況、レート制限、プロバイダーのポリシーは異なる場合があります。利用者はモデルの出力を自ら確認し、適用法令および関連ポリシーに従って本サービスを利用する責任を負います。

## プライバシーと責任ある利用

本サービスの運営、API リクエストの転送、利用量の計算、不正利用の防止、サポートの提供に必要な情報のみを処理します。処理する権限のない認証情報、機密情報、個人データを送信しないでください。

EMO API を利用することにより、[利用規約](/user-agreement)に同意し、[プライバシーポリシー](/privacy-policy)を確認したものとみなされます。

## お問い合わせ

アカウント、課金、提携、サービスに関するお問い合わせは、[info@semo.one](mailto:info@semo.one) までご連絡ください。

## オープンソース

EMO API は QuantumNous が開発する [New API](https://github.com/QuantumNous/new-api) を基盤としており、New API は JustSong が開発する [One API](https://github.com/songquanpeng/one-api) を基にしています。本プロジェクトは [GNU AGPL v3.0](https://github.com/QuantumNous/new-api/blob/main/LICENSE) に基づいて使用しています。
`.trim()

const CONTENT = { zhCN, en, ja } as const

export function getEmoAboutContent(language?: string | null): string {
  const normalized = normalizeInterfaceLanguage(language)
  if (normalized === 'zhCN' || normalized === 'zhTW') return CONTENT.zhCN
  if (normalized === 'ja') return CONTENT.ja
  return CONTENT.en
}
