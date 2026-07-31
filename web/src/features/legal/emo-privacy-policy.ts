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

const EFFECTIVE_DATE = '2026-07-31'

const zhCN = `
## EMO API 隐私政策

**生效日期：${EFFECTIVE_DATE}**  
**个人信息处理方：SEMO AI, Inc.（以下简称“SEMO”）**

本政策说明 SEMO 在运营 EMO API 网站、控制台、API、充值和相关服务（合称“服务”）时如何收集、使用、共享和保护信息。使用服务前，请结合您选择的 Private、Data Partner 或组织定制方案阅读本政策。

### 1. 我们收集的信息

我们可能处理以下类别的信息：

- **账户与组织信息：**用户名、邮箱、显示名称、组织、角色、认证状态及账户设置；
- **支付与交易信息：**充值金额、余额、订单、币种、退款和支付状态。银行卡等完整支付凭证由 Stripe 等支付服务商处理，SEMO 通常不保存完整卡号；
- **API 与使用元数据：**API Key 标识、模型、Token 数、费用、时间、延迟、错误码、IP 地址、设备和安全日志；
- **请求与响应内容：**提示词、上传内容、模型响应、工具调用和反馈，其处理方式取决于您的数据方案；
- **通信信息：**您发送的支持请求、投诉、问卷或其他联系内容；
- **Cookie 和类似技术：**用于登录会话、安全、语言、主题及必要偏好设置的信息。

请勿向服务提交您无权处理的个人信息、第三方秘密、生产凭证或不必要的敏感信息。

### 2. 使用目的

SEMO 为以下目的处理信息：

1. 创建和管理账户、组织、API Key、权限与登录会话；
2. 转发模型请求、返回响应、执行路由、缓存和故障恢复；
3. 计量用量、扣减额度、处理支付、退款、税务和对账；
4. 防止欺诈、滥用、攻击、凭证泄露和违反政策的行为；
5. 监控可用性、排查错误、提供支持并改进产品；
6. 履行法律、监管、审计、争议处理和执法协助义务；
7. 在获得适当同意时发送服务通知或其他通信。

### 3. 模型内容与数据方案

#### 3.1 Private

Private 方案下，SEMO 不会将请求正文或响应正文用于训练模型、构建可对外使用的数据集或改进通用模型。为完成请求，SEMO 和必要的上游模型提供商仍会临时处理内容。正文日志默认关闭；最低限度的计费、安全和运行元数据仍可被保留。

#### 3.2 Data Partner

只有在您明确选择 Data Partner 并同意相关条款后，SEMO 才可收集请求、响应、工具调用、错误和反馈轨迹，用于模型评估、训练、研究、质量改进和产品开发。SEMO 将采取合理的去标识化、秘密过滤、访问控制和安全措施。您可联系我们停止未来的数据贡献，但停止不影响此前已合法完成的处理、无法合理关联到您的去标识化数据或依法必须保留的记录。

#### 3.3 Internal 与组织定制方案

Internal 仅供 SEMO 授权人员使用。企业、学校或合作组织可通过单独的数据处理附件约定数据范围、保留期、处理地点和安全要求；该附件与本政策冲突时，以签署的附件为准。

### 4. 共享与委托处理

为提供服务，我们可能向以下接收方提供必要信息：

- 您选择或路由到的模型和云服务提供商；
- Google Cloud 等托管、数据库、缓存、日志和安全服务商；
- Stripe 等支付、反欺诈、退款和税务服务商；
- 邮件、监控、客户支持和分析服务商；
- 您所属组织中获得授权的管理员；
- 在法律要求、保护权利或调查安全事件时的监管、司法或执法机关；
- 在合并、融资、重组或资产转让中承担保密义务的交易参与方。

服务商仅应在提供约定服务所必需的范围内处理信息。上游模型提供商还可能依据其自身条款和隐私政策处理请求。

### 5. 跨境处理

SEMO 在日本运营，并使用可能位于日本、美国及其他国家或地区的模型、云和支付服务。数据保护规则可能与您所在地不同。SEMO 将根据适用法律采用合同、访问控制、加密及其他合理保障措施。

### 6. 保存期限

信息仅在实现本政策目的、履行合同、处理争议、保障安全和满足法律义务所需的期间内保存。交易、税务、安全和审计记录可能依法保存更长时间。账户关闭后，我们将删除或去标识化不再需要的信息，但备份和依法保留的记录可能在受控期限内继续存在。

### 7. 安全

SEMO 采用合理的传输加密、访问控制、密钥管理、日志、备份和最小权限措施。任何系统均无法保证绝对安全；您应保护密码和 API Key，限制成员权限，并在发现泄露时立即撤销凭证和联系我们。

### 8. 您的选择与权利

根据适用法律，您可以请求访问、更正、删除或停止使用您的个人信息，撤回基于同意的处理，或获取有关共享情况的说明。部分请求可能受身份核验、合同履行、安全、反欺诈、会计、税务或其他法律义务限制。组织账户的请求有时应先由组织管理员处理。

### 9. Cookie

服务使用登录、安全、语言和界面偏好所必需的 Cookie 或本地存储。禁用必要 Cookie 可能导致登录或控制台功能不可用。若未来引入非必要分析或广告技术，我们将按适用法律提供相应通知和选择。

### 10. 未成年人

服务主要面向具有签约能力的开发者、企业和组织，不以未成年人为目标。未达到所在地独立同意年龄的用户应由监护人或获得授权的组织提供必要同意。

### 11. 政策更新

SEMO 可因产品、法律或运营变化更新本政策。重大变更将通过网站、控制台或邮件给予合理通知，并在页面标明新的生效日期。

### 12. 联系我们

如需行使数据权利，或对本政策、账户安全和数据处理有疑问，请联系 **info@semo.one**。
`.trim()

const en = `
## EMO API Privacy Policy

**Effective date: ${EFFECTIVE_DATE}**  
**Data controller: SEMO AI, Inc. ("SEMO")**

This Policy explains how SEMO collects, uses, shares, and protects information when operating the EMO API website, console, APIs, prepaid balance, and related services (collectively, the "Services"). Please read it together with the terms for your Private, Data Partner, or custom organization plan.

### 1. Information we collect

We may process:

- **Account and organization data:** username, email, display name, organization, role, verification state, and account settings;
- **Payment and transaction data:** top-up amount, balance, order, currency, refund, and payment status. Full payment credentials are generally handled by providers such as Stripe rather than stored by SEMO;
- **API and usage metadata:** API-key identifier, model, token counts, charges, timestamps, latency, error codes, IP address, device, and security logs;
- **Request and response content:** prompts, uploads, model responses, tool calls, and feedback, as determined by your data plan;
- **Communications:** support requests, complaints, surveys, and other messages; and
- **Cookies and similar technology:** information needed for sessions, security, language, theme, and essential preferences.

Do not submit personal information, third-party secrets, production credentials, or sensitive information that you are not authorized or do not need to process.

### 2. Why we use information

SEMO processes information to:

1. create and administer accounts, organizations, API keys, permissions, and sessions;
2. forward model requests, return responses, route traffic, cache data, and recover from failures;
3. meter usage, deduct credits, process payments and refunds, calculate taxes, and reconcile transactions;
4. prevent fraud, abuse, attacks, credential exposure, and policy violations;
5. monitor availability, troubleshoot errors, provide support, and improve the product;
6. meet legal, regulatory, audit, dispute, and law-enforcement obligations; and
7. send service notices or other communications where appropriate consent exists.

### 3. Model content and data plans

#### 3.1 Private

Under the Private plan, SEMO does not use request or response bodies to train models, build generally available datasets, or improve general-purpose models. SEMO and necessary upstream model providers still process content temporarily to complete requests. Body logging is off by default, while minimum billing, security, and operational metadata may be retained.

#### 3.2 Data Partner

Only after you expressly select Data Partner and accept its terms may SEMO collect request, response, tool-call, error, and feedback traces for model evaluation, training, research, quality improvement, and product development. SEMO applies reasonable de-identification, secret filtering, access controls, and security safeguards. You may ask us to stop future contributions, but this does not reverse completed lawful processing, data that cannot reasonably be linked to you, or records that law requires us to retain.

#### 3.3 Internal and custom organization plans

Internal access is limited to authorized SEMO personnel. Companies, schools, and partners may use a separate data-processing addendum covering scope, retention, location, and security. A signed addendum prevails if it conflicts with this Policy.

### 4. Sharing and processors

We may provide necessary information to:

- model and cloud providers selected by you or used for routing;
- hosting, database, cache, logging, and security providers such as Google Cloud;
- payment, fraud-prevention, refund, and tax providers such as Stripe;
- email, monitoring, customer-support, and analytics providers;
- authorized administrators of your organization;
- regulators, courts, or law enforcement where required by law or necessary to protect rights and investigate security events; and
- transaction participants under confidentiality obligations in a merger, financing, restructuring, or asset transfer.

Service providers should process information only as needed to perform the agreed service. Upstream model providers may also process requests under their own terms and privacy policies.

### 5. International processing

SEMO operates in Japan and uses model, cloud, and payment services that may be located in Japan, the United States, and other countries. Their data-protection rules may differ from yours. SEMO uses contractual, access-control, encryption, and other reasonable safeguards required by applicable law.

### 6. Retention

We keep information only as long as needed for the purposes in this Policy, contract performance, dispute handling, security, and legal obligations. Transaction, tax, security, and audit records may be kept longer where required. After account closure, information no longer needed is deleted or de-identified, although controlled backups and legally required records may remain for a limited period.

### 7. Security

SEMO uses reasonable transport encryption, access controls, key management, logging, backups, and least-privilege practices. No system is perfectly secure. Protect passwords and API keys, limit member permissions, and revoke exposed credentials and contact us promptly after a suspected compromise.

### 8. Your choices and rights

Subject to applicable law, you may request access, correction, deletion, or cessation of use; withdraw consent-based processing; or ask about disclosures. Requests may be limited by identity verification, contract performance, security, fraud prevention, accounting, tax, or other legal obligations. Requests for organization-managed accounts may first need to be handled by the organization administrator.

### 9. Cookies

The Services use cookies or local storage required for login, security, language, and interface preferences. Disabling essential storage may prevent login or console operation. If SEMO later introduces non-essential analytics or advertising technology, we will provide notice and choices required by applicable law.

### 10. Children

The Services are intended mainly for developers, businesses, and organizations able to enter contracts, and are not directed to children. A user below the age of independent consent in their location should use the Services only with necessary guardian or authorized-organization consent.

### 11. Policy changes

SEMO may update this Policy for product, legal, or operational changes. Material changes will receive reasonable notice through the website, console, or email, and the updated effective date will appear on this page.

### 12. Contact

To exercise a data right or ask about this Policy, account security, or data processing, contact **info@semo.one**.
`.trim()

const ja = `
## EMO API プライバシーポリシー

**施行日：${EFFECTIVE_DATE}**  
**個人情報取扱事業者：SEMO AI, Inc.（以下「SEMO」）**

本ポリシーは、SEMO が EMO API のウェブサイト、コンソール、API、前払残高および関連サービス（総称して「本サービス」）を運営する際の情報の収集、利用、共有および保護について説明します。Private、Data Partner または組織向け個別プランの条件と併せてお読みください。

### 1. 取得する情報

SEMO は次の情報を取り扱う場合があります。

- **アカウント・組織情報：**ユーザー名、メール、表示名、組織、役割、確認状態および設定
- **決済・取引情報：**入金額、残高、注文、通貨、返金および決済状態。完全なカード情報等は通常、SEMO ではなく Stripe 等の決済事業者が処理します
- **API・利用メタデータ：**API キー識別子、モデル、Token 数、料金、時刻、遅延、エラーコード、IP アドレス、端末およびセキュリティログ
- **リクエスト・レスポンス内容：**プロンプト、アップロード、モデル応答、ツール呼出しおよびフィードバック。取扱いはデータプランにより異なります
- **通信情報：**サポート依頼、苦情、アンケートその他の連絡
- **Cookie 等：**セッション、安全、言語、テーマおよび必要な設定に使用する情報

処理権限のない個人情報、第三者の秘密、本番認証情報または不要な機微情報を送信しないでください。

### 2. 利用目的

SEMO は次の目的で情報を取り扱います。

1. アカウント、組織、API キー、権限およびセッションの作成・管理
2. モデルリクエストの転送、応答、ルーティング、キャッシュおよび障害回復
3. 利用量計測、クレジット控除、決済・返金、税務および取引照合
4. 不正、濫用、攻撃、認証情報漏えいおよびポリシー違反の防止
5. 可用性監視、障害調査、サポートおよび製品改善
6. 法令、監査、紛争および法執行上の義務の履行
7. 適切な同意がある場合のサービス通知その他の連絡

### 3. モデル内容とデータプラン

#### 3.1 Private

Private では、SEMO はリクエスト本文またはレスポンス本文を、モデル学習、一般提供データセットの構築または汎用モデルの改善に使用しません。リクエスト完了のため、SEMO と必要な上流モデル事業者は内容を一時的に処理します。本文ログは初期状態で無効ですが、最小限の課金、安全および運用メタデータは保持される場合があります。

#### 3.2 Data Partner

お客様が Data Partner を明示的に選択し条件に同意した場合に限り、SEMO はリクエスト、レスポンス、ツール呼出し、エラーおよびフィードバックのトレースを、モデル評価、学習、研究、品質改善および製品開発に使用できます。合理的な匿名化、秘密情報のフィルタリング、アクセス制御および安全措置を行います。将来の提供停止を申請できますが、既に適法に完了した処理、合理的に関連付けられないデータまたは法令上保存が必要な記録には影響しません。

#### 3.3 Internal・組織向け個別プラン

Internal は SEMO の承認された担当者のみ利用できます。企業、学校およびパートナーは、範囲、保存期間、処理場所および安全要件を定めたデータ処理付属契約を利用できます。署名済み付属契約と本ポリシーが抵触する場合、付属契約が優先します。

### 4. 共有および委託先

本サービス提供のため、必要な情報を次の者に提供する場合があります。

- お客様が選択した、またはルーティングに使用するモデル・クラウド事業者
- Google Cloud 等のホスティング、データベース、キャッシュ、ログおよび安全管理事業者
- Stripe 等の決済、不正防止、返金および税務事業者
- メール、監視、顧客対応および分析事業者
- お客様の組織で権限を有する管理者
- 法令、権利保護または安全事象の調査に必要な規制、司法または法執行機関
- 合併、資金調達、組織再編または資産譲渡において守秘義務を負う関係者

委託先は合意されたサービスに必要な範囲で情報を取り扱うものとします。上流モデル事業者は、自らの規約およびプライバシーポリシーに基づいてリクエストを処理する場合があります。

### 5. 国外処理

SEMO は日本で事業を行い、日本、米国その他の国に所在するモデル、クラウドおよび決済サービスを利用します。保護法制が異なる場合があります。SEMO は適用法令に従い、契約、アクセス制御、暗号化その他の合理的な措置を講じます。

### 6. 保存期間

本ポリシーの目的、契約履行、紛争対応、安全および法的義務に必要な期間のみ情報を保存します。取引、税務、安全および監査記録は法令により長期間保存されることがあります。アカウント閉鎖後、不要な情報は削除または匿名化しますが、管理されたバックアップおよび法定記録は一定期間残る場合があります。

### 7. 安全管理

SEMO は合理的な通信暗号化、アクセス制御、鍵管理、ログ、バックアップおよび最小権限を採用します。ただし絶対的な安全性はありません。パスワードと API キーを保護し、構成員の権限を制限し、漏えい時は直ちに認証情報を無効化してご連絡ください。

### 8. お客様の選択と権利

適用法令に従い、開示、訂正、削除、利用停止、同意の撤回または第三者提供に関する説明を請求できます。本人確認、契約履行、安全、不正防止、会計、税務その他の法的義務により制限される場合があります。組織管理アカウントでは、まず組織管理者による対応が必要な場合があります。

### 9. Cookie

ログイン、安全、言語および画面設定に必要な Cookie またはローカルストレージを使用します。無効化するとログインやコンソールが動作しない場合があります。将来、不要不急の分析または広告技術を導入する場合、適用法令上必要な通知と選択肢を提供します。

### 10. 未成年者

本サービスは主に契約能力を有する開発者、企業および組織を対象とし、児童を対象としていません。所在地で独立して同意できる年齢に達しない場合、必要な保護者または権限ある組織の同意を得てください。

### 11. 本ポリシーの変更

製品、法令または運用上の変更に応じて本ポリシーを更新できます。重要な変更はウェブサイト、コンソールまたはメールで合理的に通知し、新しい施行日を本ページに表示します。

### 12. お問い合わせ

個人情報に関する権利行使、本ポリシー、アカウント安全またはデータ処理については **info@semo.one** までご連絡ください。
`.trim()

const POLICIES = { zhCN, en, ja } as const

export function getEmoPrivacyPolicy(language?: string | null): string {
  const normalized = normalizeInterfaceLanguage(language)
  if (normalized === 'zhCN' || normalized === 'ja') {
    return POLICIES[normalized]
  }
  return POLICIES.en
}
