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
## EMO API 用户协议

**生效日期：${EFFECTIVE_DATE}**  
**运营方：SEMO AI, Inc.（以下简称“SEMO”）**

本协议适用于 EMO API 网站、控制台、API、充值余额及相关服务（合称“服务”）。您注册账户、勾选同意、充值、创建 API Key 或调用服务，即表示您已阅读并同意本协议。若您代表公司、学校或其他组织使用服务，您确认有权代表该组织接受本协议。

### 1. 服务内容

1. EMO API 提供第三方人工智能模型的统一接入、请求转发、路由、额度管理、计量计费及相关控制台功能。
2. SEMO 通常不是底层模型的开发者。模型输出、可用性、速率限制、内容政策和技术能力可能由第三方提供商决定。
3. SEMO 可因技术升级、安全、供应商变化、法律要求或运营需要调整模型、接口、价格或功能，并将在合理可行时提前通知重大变更。

### 2. 账户、组织与凭证

1. 您应提供真实、准确且持续有效的信息，并对账户、密码、API Key、验证码和组织成员权限承担保管责任。
2. 通过您的账户或 API Key 发起的操作视为由您授权。发现泄露或未经授权使用时，应立即撤销相关凭证并联系 SEMO。
3. 您不得出售、出租、公开分享账户、余额或 API Key。组织管理员应确保成员仅获得完成工作所需的权限，并对其成员的使用负责。
4. SEMO 可要求进行邮箱验证、身份验证、企业验证或其他合理的反欺诈审查。

### 3. 充值、计费与退款

1. 除页面另有说明外，余额以美元计价。实际支付币种、税费、汇率和支付手续费以结账页面及支付服务商显示为准。
2. 模型费用可按输入 Token、输出 Token、缓存写入、缓存读取、图片、音频、工具调用、请求次数、上下文长度或其他页面载明的单位计算。平台记录是计费和对账的主要依据。
3. 余额为预付服务额度，不是银行存款、电子货币或投资产品，不计利息，且不得在用户之间转让或提现。
4. 已消耗额度、促销额度和赠送额度通常不可退款。未消耗的付费余额按适用法律、页面公布的退款政策及支付渠道规则处理。
5. 如发生重复扣款、系统计费错误或未授权交易，请在发现后尽快联系 SEMO。恶意拒付、支付欺诈或利用退款规则可能导致账户和额度被冻结。
6. SEMO 可在供应商价格、汇率、税费或运营成本变化时调整价格；新价格仅适用于调整后发生的使用，除非法律另有要求。

### 4. 合法与可接受使用

您不得使用服务从事以下行为：

- 违反适用法律、法院命令、制裁或出口管制；
- 侵犯隐私、个人信息、知识产权、商业秘密或其他第三方权利；
- 生成或传播恶意软件、钓鱼、欺诈、骚扰、仇恨、剥削儿童或其他严重有害内容；
- 攻击、扫描、绕过或干扰 SEMO、上游供应商或第三方系统；
- 恶意高并发、刷量、绕过限流或计费、批量注册、共享或转售未经许可的访问能力；
- 将服务用于适用法律或上游政策禁止的高风险自动决策或其他用途。

您还应遵守所调用模型供应商的适用使用政策。为保护平台和其他用户，SEMO 可限制、拒绝或审查异常请求。

### 5. 输入、输出与知识产权

1. 在您与 SEMO 之间，您保留对合法拥有的输入内容的权利。您授予 SEMO 为提供服务所必需的、非独占的处理权，包括传输、格式转换、路由、缓存和故障排查。
2. 在适用法律及上游条款允许的范围内，您可使用模型输出；但 SEMO 不保证输出具有唯一性、准确性、完整性、合法性或不侵犯第三方权利。
3. 您应自行检查输出，特别是用于医疗、法律、金融、招聘、教育评价、安全或其他高风险场景时。模型输出不构成专业意见。
4. 您确认有权提交输入内容，并不得提交无权处理的个人信息、机密信息、源代码、访问令牌或受限制数据。

### 6. 数据方案与处理差异

您的组织或 API Key 可被分配至不同数据方案。控制台、订单或组织合同中显示的方案决定以下规则：

#### 6.1 Private（私密方案）

- SEMO 不会将请求正文或响应正文用于训练模型、构建可对外使用的数据集或改进通用模型。
- 为完成请求、保障安全、计费、反滥用和故障排查，SEMO 及必要的上游提供商仍会临时处理内容。
- SEMO 可保留最低限度的账户、计费、模型、Token 数、时间、错误码和安全事件元数据。正文保留应默认为关闭；因您主动启用日志或支持工单而保存的内容按对应设置处理。

#### 6.2 Data Partner（数据贡献方案）

- 只有在您明确选择并同意数据贡献条款后，SEMO 才可收集请求、响应、工具调用、错误和反馈轨迹。
- 您授予 SEMO 在去标识化、过滤明显秘密并采取合理安全措施后，为模型评估、训练、研究、质量改进和产品开发而使用这些数据的非独占、全球性许可。
- 您保证有权作出该授权，并应避免上传个人敏感信息、第三方秘密、生产凭证或其他无权贡献的数据。
- 您可申请停止未来的数据贡献。停止不影响此前已合法完成的处理、已经去标识化且无法合理关联到您的数据，或法律要求保留的记录。

#### 6.3 Internal 与组织定制方案

Internal 仅供 SEMO 授权人员使用。企业、学校或合作组织可适用单独的价格、额度、模型范围、保留期和数据处理附件；单独签署的书面条款与本协议冲突时，以书面条款为准。

### 7. 隐私、安全与跨境处理

1. SEMO 将依据适用的数据保护法律和隐私政策处理账户信息、付款信息、日志和其他个人信息。
2. 为调用国际模型、云服务、支付、邮件或监控服务，数据可能在您所在国家或地区以外处理。SEMO 将采取适用法律要求的合同、技术和组织措施。
3. SEMO 采用合理的访问控制、加密、密钥管理和日志措施，但任何互联网服务均无法保证绝对安全。您应对发送至模型的信息进行必要的最小化和脱敏。
4. 具体处理目的、保留期、接收方类别及您的权利，以隐私政策和适用的数据处理附件为准。

### 8. 第三方服务

服务依赖模型供应商、Google Cloud、Stripe、邮件服务商及其他第三方。第三方服务受其自身条款和隐私政策约束。SEMO 不控制第三方的持续可用性、模型行为或政策变更，但会在合理范围内提供路由、错误信息和运营支持。

### 9. 服务可用性与变更

服务按“现状”和“可用”状态提供。SEMO 不承诺服务无中断、无错误或所有模型永久可用。计划维护、紧急安全事件、上游故障、不可抗力或法律要求可能导致限流、暂停或终止。除单独服务等级协议外，不提供可用性保证。

### 10. 暂停与终止

1. 您可停止使用服务并申请关闭账户。
2. 如存在安全风险、欠款、拒付、违法使用、违反本协议、上游要求或对平台造成重大风险，SEMO 可立即限制或暂停账户；在合理可行时将说明原因并提供申诉渠道。
3. 账户终止后，访问权限立即停止。依法应保留的交易、安全和审计记录可在必要期限内继续保存。

### 11. 责任限制

在法律允许的最大范围内，SEMO 不对间接损失、利润或数据损失、业务中断、模型输出导致的决定或第三方服务故障负责。SEMO 对与服务有关的累计责任，以导致责任事件前六个月您实际向 SEMO 支付的服务费用为上限。本限制不适用于因故意或重大过失造成的责任，也不排除适用消费者法律不得排除的权利。

### 12. 协议更新

SEMO 可因产品、法律或运营变化更新本协议。重大变更将通过网站、控制台或邮件给予合理通知。变更生效后继续使用服务表示接受更新；如不同意，应停止使用并在生效日前关闭账户。

### 13. 适用法律与争议

本协议适用日本法律，但不影响您依据居住地强制性消费者法律享有的权利。争议应先通过诚信协商解决；协商不成时，以东京地方裁判所为第一审专属合意管辖法院，但适用法律另有强制规定的除外。

### 14. 联系方式

有关账户、计费、数据处理或本协议的问题，请联系 **info@semo.one**。
`.trim()

const en = `
## EMO API User Agreement

**Effective date: ${EFFECTIVE_DATE}**  
**Operator: SEMO AI, Inc. ("SEMO")**

This Agreement governs the EMO API website, console, APIs, prepaid balance, and related services (collectively, the "Services"). By creating an account, accepting this Agreement, adding funds, creating an API key, or using the Services, you agree to these terms. If you act for a company, school, or other organization, you confirm that you are authorized to bind it.

### 1. The Services

1. EMO API provides unified access to third-party AI models, request forwarding, routing, quota management, metering, billing, and related console features.
2. SEMO generally does not develop the underlying models. Model behavior, availability, rate limits, content policies, and technical capabilities may be controlled by third-party providers.
3. SEMO may change models, interfaces, prices, or features for technical, security, supplier, legal, or operational reasons. We will give reasonable notice of material changes when practicable.

### 2. Accounts, organizations, and credentials

1. You must provide accurate and current information and safeguard account passwords, API keys, verification codes, and organization permissions.
2. Activity performed with your account or API key is treated as authorized by you. If credentials are exposed or used without permission, revoke them immediately and contact SEMO.
3. You may not sell, lease, or publicly share accounts, balances, or API keys. Organization administrators must apply least-privilege access and are responsible for their members' use.
4. SEMO may require email, identity, business, or other reasonable anti-fraud verification.

### 3. Funds, billing, and refunds

1. Unless stated otherwise, balances are denominated in U.S. dollars. The checkout page and payment provider determine the payment currency, taxes, exchange rate, and fees.
2. Charges may be based on input tokens, output tokens, cache writes, cache reads, images, audio, tool calls, request count, context length, or another disclosed unit. Platform records are the primary source for billing reconciliation.
3. A prepaid balance is a service credit, not a bank deposit, electronic money, or investment. It earns no interest and cannot be transferred between users or withdrawn.
4. Consumed credits, promotional credits, and bonus credits are generally non-refundable. Unused paid credits are handled under applicable law, the published refund policy, and payment-channel rules.
5. Report duplicate charges, metering errors, or unauthorized transactions promptly. Fraudulent chargebacks, payment abuse, or exploitation of refund rules may result in a balance or account hold.
6. SEMO may update prices when provider costs, exchange rates, taxes, or operating costs change. New prices apply only to future usage unless applicable law requires otherwise.

### 4. Acceptable use

You must not use the Services to:

- violate applicable law, court orders, sanctions, or export controls;
- infringe privacy, personal information, intellectual property, trade secrets, or other third-party rights;
- create or distribute malware, phishing, fraud, harassment, hateful material, child exploitation, or other seriously harmful content;
- attack, scan, bypass, or disrupt SEMO, an upstream provider, or another system;
- generate abusive traffic, evade limits or billing, create accounts in bulk, or resell access without permission; or
- perform high-risk automated decisions or other activities prohibited by law or an upstream policy.

You must also comply with the applicable policies of each model provider. SEMO may limit, reject, or review anomalous requests to protect the platform and its users.

### 5. Inputs, outputs, and intellectual property

1. As between you and SEMO, you retain rights in inputs that you lawfully control. You grant SEMO a non-exclusive right to process them as needed to provide the Services, including transmission, format conversion, routing, caching, and troubleshooting.
2. You may use outputs to the extent permitted by law and upstream terms. SEMO does not guarantee that outputs are unique, accurate, complete, lawful, or non-infringing.
3. You must independently review outputs, especially for medical, legal, financial, employment, educational, safety, or other high-risk uses. Outputs are not professional advice.
4. You confirm that you have the right to submit each input and must not submit personal, confidential, source-code, credential, or restricted data that you are not authorized to process.

### 6. Data plans and different processing rules

Your organization or API key may be assigned a data plan. The plan shown in the console, order, or organization agreement controls the following terms.

#### 6.1 Private plan

- SEMO will not use request or response bodies to train models, build generally available datasets, or improve general-purpose models.
- SEMO and necessary upstream providers still process content temporarily to complete requests, secure the Services, meter usage, prevent abuse, and troubleshoot failures.
- SEMO may retain minimum account, billing, model, token-count, timing, error-code, and security-event metadata. Body logging is off by default; content saved because you enable logging or open a support case follows the applicable setting.

#### 6.2 Data Partner plan

- SEMO may collect request, response, tool-call, error, and feedback traces only after you expressly choose and accept the data-contribution terms.
- You grant SEMO a non-exclusive, worldwide license to use contributed data for model evaluation, training, research, quality improvement, and product development after reasonable de-identification, secret filtering, and security safeguards.
- You confirm that you can grant this permission and must avoid personal sensitive information, third-party secrets, production credentials, and other data you cannot contribute.
- You may ask to stop future contributions. The request does not reverse completed lawful processing, data that has been de-identified so it cannot reasonably be linked to you, or records that law requires SEMO to retain.

#### 6.3 Internal and custom organization plans

Internal access is limited to authorized SEMO personnel. Companies, schools, and partners may have separate pricing, quotas, model access, retention periods, and data-processing addenda. A signed written agreement prevails if it conflicts with this Agreement.

### 7. Privacy, security, and international processing

1. SEMO processes account, payment, log, and other personal information under applicable data-protection law and its Privacy Policy.
2. Data may be processed outside your country to call international models or use cloud, payment, email, and monitoring services. SEMO will apply contractual, technical, and organizational safeguards required by applicable law.
3. SEMO uses reasonable access controls, encryption, key management, and logging, but no internet service is perfectly secure. You should minimize and redact information sent to models.
4. Processing purposes, retention periods, recipient categories, and individual rights are described in the Privacy Policy and applicable data-processing addenda.

### 8. Third-party services

The Services rely on model providers, Google Cloud, Stripe, email vendors, and other third parties. Their own terms and privacy policies apply. SEMO does not control their continuing availability, model behavior, or policy changes, but will provide reasonable routing, error reporting, and operational support.

### 9. Availability and changes

The Services are provided "as is" and "as available." SEMO does not promise uninterrupted or error-free operation or permanent access to every model. Planned maintenance, security incidents, upstream outages, force majeure, and legal requirements may cause throttling, suspension, or termination. No availability commitment applies unless stated in a separate service-level agreement.

### 10. Suspension and termination

1. You may stop using the Services and request account closure.
2. SEMO may immediately restrict or suspend an account for security risk, nonpayment, chargebacks, unlawful use, breach of this Agreement, upstream requirements, or material risk to the platform. When reasonably practicable, SEMO will explain the reason and provide an appeal channel.
3. Access ends when an account is terminated. Transaction, security, and audit records may remain for the period required by law or legitimate operational needs.

### 11. Limitation of liability

To the maximum extent permitted by law, SEMO is not liable for indirect damages, lost profits or data, business interruption, decisions based on model outputs, or third-party service failures. SEMO's aggregate liability relating to the Services is limited to the fees you paid SEMO during the six months before the event giving rise to liability. This limit does not apply to intentional misconduct or gross negligence and does not exclude rights that applicable consumer law does not permit us to exclude.

### 12. Changes to this Agreement

SEMO may update this Agreement for product, legal, or operational changes. Material changes will receive reasonable notice through the website, console, or email. Continued use after the effective date means you accept the update. If you disagree, stop using the Services and close the account before the update takes effect.

### 13. Governing law and disputes

Japanese law governs this Agreement without limiting mandatory consumer rights in your place of residence. The parties should first try to resolve disputes in good faith. If that fails, the Tokyo District Court has exclusive jurisdiction at first instance, except where mandatory law requires otherwise.

### 14. Contact

For questions about accounts, billing, data processing, or this Agreement, contact **info@semo.one**.
`.trim()

const ja = `
## EMO API 利用規約

**施行日：${EFFECTIVE_DATE}**  
**運営者：SEMO AI, Inc.（以下「SEMO」）**

本規約は、EMO API のウェブサイト、コンソール、API、前払残高および関連サービス（総称して「本サービス」）に適用されます。アカウントの作成、本規約への同意、入金、API キーの作成または本サービスの利用により、お客様は本規約に同意したものとみなされます。会社、学校その他の組織を代表する場合、お客様は当該組織を拘束する権限を有することを表明します。

### 1. 本サービス

1. EMO API は、第三者の AI モデルへの統一アクセス、リクエスト転送、ルーティング、クォータ管理、計測、課金および関連するコンソール機能を提供します。
2. SEMO は通常、基盤モデルの開発者ではありません。モデルの挙動、可用性、レート制限、コンテンツポリシーおよび技術的機能は、第三者プロバイダーにより決定される場合があります。
3. SEMO は、技術、安全、供給元、法令または運用上の理由により、モデル、インターフェース、価格または機能を変更できます。重要な変更については、合理的に可能な範囲で事前に通知します。

### 2. アカウント、組織および認証情報

1. お客様は正確かつ最新の情報を提供し、パスワード、API キー、確認コードおよび組織権限を適切に管理するものとします。
2. お客様のアカウントまたは API キーによる操作は、お客様が承認したものとして扱われます。漏えいまたは不正利用を発見した場合、直ちに認証情報を無効化し SEMO に連絡してください。
3. アカウント、残高または API キーを販売、賃貸または公開共有してはなりません。組織管理者は最小権限を適用し、構成員による利用に責任を負います。
4. SEMO は、メール、本人、法人その他の合理的な不正防止確認を求めることがあります。

### 3. 入金、課金および返金

1. 別途表示がない限り、残高は米ドル建てです。支払通貨、税、為替レートおよび手数料は、決済画面と決済事業者の表示に従います。
2. 料金は、入力 Token、出力 Token、キャッシュ書込み、キャッシュ読出し、画像、音声、ツール呼出し、リクエスト数、コンテキスト長その他表示された単位に基づきます。照合にはプラットフォームの記録を主たる資料として使用します。
3. 前払残高はサービスクレジットであり、預金、電子マネーまたは投資商品ではありません。利息は付かず、ユーザー間の譲渡または換金はできません。
4. 消費済み、販促および無償クレジットは原則として返金されません。未使用の有償残高は、適用法令、公表された返金方針および決済手段の規則に従います。
5. 二重請求、計測誤りまたは不正取引は速やかに申告してください。不正なチャージバック、決済濫用または返金制度の悪用に対して、残高またはアカウントを保留することがあります。
6. 供給元価格、為替、税または運用コストの変化に応じて価格を変更できます。法令上必要な場合を除き、新価格は変更後の利用にのみ適用されます。

### 4. 適正利用

本サービスを次の目的で利用してはなりません。

- 法令、裁判所命令、制裁または輸出規制への違反
- プライバシー、個人情報、知的財産、営業秘密その他第三者の権利の侵害
- マルウェア、フィッシング、詐欺、嫌がらせ、差別的表現、児童搾取その他重大な有害コンテンツの作成または配布
- SEMO、上流プロバイダーまたは第三者システムへの攻撃、走査、回避または妨害
- 悪質な大量通信、制限・課金の回避、大量登録、無許可の共有または再販売
- 法令または上流ポリシーが禁止する高リスクの自動判断その他の用途

利用するモデルプロバイダーの適用ポリシーも遵守してください。プラットフォームと利用者を保護するため、SEMO は異常なリクエストを制限、拒否または確認できます。

### 5. 入力、出力および知的財産

1. お客様と SEMO の間では、お客様が適法に管理する入力の権利はお客様に留保されます。お客様は、送信、形式変換、ルーティング、キャッシュおよび障害対応を含め、本サービス提供に必要な非独占的処理権を SEMO に許諾します。
2. 法令および上流規約が許す範囲で出力を利用できます。ただし、SEMO は出力の独自性、正確性、完全性、適法性または第三者権利の非侵害を保証しません。
3. 医療、法律、金融、採用、教育評価、安全その他の高リスク用途では、出力を独自に確認してください。出力は専門的助言ではありません。
4. お客様は入力を提出する権利を有することを確認し、処理権限のない個人情報、機密情報、ソースコード、認証情報または制限データを提出してはなりません。

### 6. データプランごとの取扱い

組織または API キーにはデータプランが割り当てられます。コンソール、注文または組織契約に表示されたプランにより、以下の条件が決まります。

#### 6.1 Private（プライベート）

- SEMO は、リクエスト本文またはレスポンス本文を、モデル学習、一般提供データセットの構築または汎用モデルの改善に使用しません。
- リクエスト処理、セキュリティ、計測、不正防止および障害対応のため、SEMO と必要な上流プロバイダーはコンテンツを一時的に処理します。
- SEMO は、アカウント、課金、モデル、Token 数、時刻、エラーコードおよびセキュリティイベントに関する最小限のメタデータを保持できます。本文ログは初期状態で無効とし、お客様がログ保存を有効化した場合またはサポートを依頼した場合は、その設定に従います。

#### 6.2 Data Partner（データ提供）

- お客様が明示的に選択し、データ提供条件に同意した場合に限り、SEMO はリクエスト、レスポンス、ツール呼出し、エラーおよびフィードバックのトレースを収集できます。
- お客様は、合理的な匿名化、秘密情報のフィルタリングおよび安全措置を行った後、モデル評価、学習、研究、品質改善および製品開発に利用するための非独占的かつ世界的なライセンスを SEMO に許諾します。
- お客様は当該許諾権限を有することを保証し、要配慮個人情報、第三者の秘密、本番認証情報その他提供権限のないデータを送信してはなりません。
- お客様は将来のデータ提供停止を申請できます。停止は、既に適法に完了した処理、合理的にお客様と関連付けられない匿名化済みデータまたは法令上保存が必要な記録には影響しません。

#### 6.3 Internal および組織向け個別プラン

Internal は SEMO の承認された担当者のみ利用できます。企業、学校またはパートナーには、個別の価格、クォータ、モデル範囲、保存期間およびデータ処理付属契約が適用される場合があります。署名済みの書面と本規約が抵触する場合、当該書面が優先します。

### 7. プライバシー、安全および国外処理

1. SEMO は、適用される個人情報保護法およびプライバシーポリシーに従い、アカウント、決済、ログその他の個人情報を処理します。
2. 国際的なモデル、クラウド、決済、メールまたは監視サービスを利用するため、データがお客様の所在国以外で処理される場合があります。SEMO は適用法令上必要な契約上、技術上および組織上の措置を講じます。
3. SEMO は合理的なアクセス制御、暗号化、鍵管理およびログ管理を実施しますが、インターネットサービスに絶対的な安全性はありません。モデルに送信する情報を最小化し、必要に応じて匿名化してください。
4. 処理目的、保存期間、受領者の類型および本人の権利は、プライバシーポリシーと適用されるデータ処理付属契約に定めます。

### 8. 第三者サービス

本サービスは、モデルプロバイダー、Google Cloud、Stripe、メール事業者その他第三者に依存します。各事業者の規約およびプライバシーポリシーが適用されます。SEMO は第三者の継続的可用性、モデル挙動またはポリシー変更を管理できませんが、合理的なルーティング、エラー情報および運用支援を提供します。

### 9. 可用性および変更

本サービスは「現状有姿」かつ「提供可能な範囲」で提供されます。中断やエラーがないこと、またはすべてのモデルが永続的に利用できることを保証しません。保守、緊急の安全事象、上流障害、不可抗力または法的要請により、制限、停止または終了する場合があります。別途サービスレベル契約がない限り、可用性保証はありません。

### 10. 利用停止および終了

1. お客様は利用を停止し、アカウント閉鎖を申請できます。
2. 安全上のリスク、未払、チャージバック、違法利用、本規約違反、上流からの要請またはプラットフォームへの重大な危険がある場合、SEMO は直ちに制限または停止できます。合理的に可能な場合、理由と異議申立て方法を案内します。
3. 終了後はアクセスできません。取引、安全および監査記録は、法令または正当な運用目的に必要な期間保持される場合があります。

### 11. 責任の制限

法令で認められる最大限の範囲で、SEMO は、間接損害、利益・データの喪失、事業中断、モデル出力に基づく判断または第三者サービスの障害について責任を負いません。本サービスに関する SEMO の累積責任は、原因事象前の6か月間にお客様が SEMO に実際に支払った料金を上限とします。この制限は故意または重過失には適用されず、消費者法上排除できない権利を制限しません。

### 12. 規約の変更

SEMO は、製品、法令または運用上の変更に応じて本規約を更新できます。重要な変更は、ウェブサイト、コンソールまたはメールで合理的に通知します。施行後の継続利用は更新への同意を意味します。同意しない場合、施行前に利用を停止しアカウントを閉鎖してください。

### 13. 準拠法および紛争

本規約は日本法に準拠します。ただし、お客様の居住地における強行的な消費者保護上の権利を妨げません。まず誠実に協議し、解決しない場合、東京地方裁判所を第一審の専属的合意管轄裁判所とします。ただし、強行法規が別段の定めを置く場合を除きます。

### 14. お問い合わせ

アカウント、課金、データ処理または本規約に関するお問い合わせは **info@semo.one** までご連絡ください。
`.trim()

const AGREEMENTS = { zhCN, en, ja } as const

export function getEmoUserAgreement(language?: string | null): string {
  const normalized = normalizeInterfaceLanguage(language)
  if (normalized === 'zhCN' || normalized === 'ja') {
    return AGREEMENTS[normalized]
  }
  return AGREEMENTS.en
}
