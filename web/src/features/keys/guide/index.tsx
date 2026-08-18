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
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  BookOpen,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  KeyRound,
  Laptop,
  LifeBuoy,
  LockKeyhole,
  MessagesSquare,
  Server,
  TerminalSquare,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { GuideCodeBlock } from './components/guide-code-block'

const GUIDE_SECTIONS = [
  { id: 'quick-start', labelKey: 'apiGuide.nav.quickStart', icon: KeyRound },
  { id: 'environment', labelKey: 'apiGuide.nav.environment', icon: Laptop },
  { id: 'connection', labelKey: 'apiGuide.nav.connection', icon: Server },
  { id: 'codex', labelKey: 'apiGuide.nav.codex', icon: TerminalSquare },
  { id: 'claude-code', labelKey: 'apiGuide.nav.claudeCode', icon: Code2 },
  { id: 'cherry-studio', labelKey: 'apiGuide.nav.cherryStudio', icon: Bot },
  { id: 'chatbox', labelKey: 'apiGuide.nav.chatbox', icon: MessagesSquare },
  { id: 'open-webui', labelKey: 'apiGuide.nav.openWebUI', icon: Laptop },
  { id: 'opencode', labelKey: 'apiGuide.nav.openCode', icon: TerminalSquare },
  { id: 'other-tools', labelKey: 'apiGuide.nav.otherTools', icon: BookOpen },
  { id: 'billing', labelKey: 'apiGuide.nav.billing', icon: CircleDollarSign },
  {
    id: 'troubleshooting',
    labelKey: 'apiGuide.nav.troubleshooting',
    icon: LifeBuoy,
  },
  { id: 'security', labelKey: 'apiGuide.nav.security', icon: LockKeyhole },
] as const

const TROUBLESHOOTING_ROWS = [
  {
    id: '401',
    nameKey: 'apiGuide.troubleshooting.401.name',
    causeKey: 'apiGuide.troubleshooting.401.cause',
    solutionKey: 'apiGuide.troubleshooting.401.solution',
  },
  {
    id: '403',
    nameKey: 'apiGuide.troubleshooting.403.name',
    causeKey: 'apiGuide.troubleshooting.403.cause',
    solutionKey: 'apiGuide.troubleshooting.403.solution',
  },
  {
    id: '404',
    nameKey: 'apiGuide.troubleshooting.404.name',
    causeKey: 'apiGuide.troubleshooting.404.cause',
    solutionKey: 'apiGuide.troubleshooting.404.solution',
  },
  {
    id: '429',
    nameKey: 'apiGuide.troubleshooting.429.name',
    causeKey: 'apiGuide.troubleshooting.429.cause',
    solutionKey: 'apiGuide.troubleshooting.429.solution',
  },
  {
    id: 'model',
    nameKey: 'apiGuide.troubleshooting.model.name',
    causeKey: 'apiGuide.troubleshooting.model.cause',
    solutionKey: 'apiGuide.troubleshooting.model.solution',
  },
  {
    id: 'quota',
    nameKey: 'apiGuide.troubleshooting.quota.name',
    causeKey: 'apiGuide.troubleshooting.quota.cause',
    solutionKey: 'apiGuide.troubleshooting.quota.solution',
  },
] as const

type GuideSectionProps = {
  id: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}

function GuideSection(props: GuideSectionProps) {
  return (
    <section
      id={props.id}
      className={cn(
        'scroll-mt-20 rounded-xl border bg-card p-5 shadow-xs sm:p-7',
        props.className
      )}
    >
      <h2 className='text-xl font-semibold tracking-tight'>{props.title}</h2>
      {props.description && (
        <p className='text-muted-foreground mt-2 leading-7'>
          {props.description}
        </p>
      )}
      <div className='mt-5 space-y-5'>{props.children}</div>
    </section>
  )
}

function NumberedStep(props: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <div className='flex gap-3'>
      <span className='bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold'>
        {props.number}
      </span>
      <div className='min-w-0 pt-0.5'>
        <h3 className='font-medium'>{props.title}</h3>
        <div className='text-muted-foreground mt-1 text-sm leading-6'>
          {props.children}
        </div>
      </div>
    </div>
  )
}

function SettingRow(props: { label: string; value: string }) {
  return (
    <div className='grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4'>
      <dt className='text-muted-foreground text-sm'>{props.label}</dt>
      <dd className='font-mono text-sm break-all'>{props.value}</dd>
    </div>
  )
}

export function ApiUsageGuide() {
  const { t } = useTranslation()
  const origin = window.location.origin
  const openAIBaseUrl = `${origin}/v1`
  const setApiKey = 'export EMO_API_KEY="your-emo-api-key"'
  const codexConfig = `[model_providers.emo]
name = "EMO API"
base_url = "${openAIBaseUrl}"
wire_api = "responses"
env_key = "EMO_API_KEY"`
  const codexCommand = `codex --config model_provider='"emo"' --model gpt-5.6-terra`
  const claudeSettings = `{
  "env": {
    "ANTHROPIC_BASE_URL": "${origin}",
    "ANTHROPIC_MODEL": "claude-opus-4-6",
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "1"
  }
}`
  const curlModels = `curl -sS "${openAIBaseUrl}/models" \\
  -H "Authorization: Bearer $EMO_API_KEY"
echo`
  const curlResponses = `curl -sS "${openAIBaseUrl}/responses" \\
  -H "Authorization: Bearer $EMO_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5.6-terra",
    "input": "Hello from EMO API"
  }'
echo`
  const openWebUiDocker = `docker run -d -p 3000:8080 \\
  -e OPENAI_API_BASE_URL="${openAIBaseUrl}" \\
  -e OPENAI_API_KEY="your-emo-api-key" \\
  -v open-webui:/app/backend/data \\
  --name open-webui \\
  ghcr.io/open-webui/open-webui:main`
  const openCodeConfig = `export EMO_API_KEY="your-emo-api-key"
opencode`
  const openClawConfig = `{
  "models": {
    "providers": {
      "emo": {
        "baseUrl": "${openAIBaseUrl}",
        "apiKey": "your-emo-api-key",
        "api": "openai-completions",
        "models": [{ "id": "your-model-id", "name": "EMO model" }]
      }
    }
  }
}`

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('apiGuide.title')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button variant='outline' size='sm' render={<Link to='/keys' />}>
          <ArrowLeft />
          {t('apiGuide.backToKeys')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-[240px_minmax(0,1fr)]'>
          <aside className='self-start lg:sticky lg:top-16'>
            <nav
              aria-label={t('apiGuide.tableOfContents')}
              className='bg-muted/25 rounded-xl border p-3'
            >
              <p className='text-muted-foreground px-2 pb-2 text-xs font-semibold tracking-wider uppercase'>
                {t('apiGuide.tableOfContents')}
              </p>
              <div className='grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1'>
                {GUIDE_SECTIONS.map((section) => {
                  const Icon = section.icon
                  return (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className='hover:bg-muted flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors'
                    >
                      <Icon className='size-4 shrink-0 text-amber-600 dark:text-amber-400' />
                      <span className='truncate'>{t(section.labelKey)}</span>
                    </a>
                  )
                })}
              </div>
            </nav>
          </aside>

          <main className='min-w-0 space-y-5 pb-10'>
            <div className='via-card to-card overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 p-6 sm:p-8 dark:border-amber-900 dark:from-amber-950/40'>
              <div className='mb-4 flex size-11 items-center justify-center rounded-xl bg-amber-400 text-amber-950'>
                <BookOpen className='size-6' />
              </div>
              <h1 className='text-2xl font-bold tracking-tight sm:text-3xl'>
                {t('apiGuide.heroTitle')}
              </h1>
              <p className='text-muted-foreground mt-3 max-w-3xl leading-7'>
                {t('apiGuide.heroDescription')}
              </p>
            </div>

            <GuideSection
              id='quick-start'
              title={t('apiGuide.quickStart.title')}
              description={t('apiGuide.quickStart.description')}
            >
              <NumberedStep
                number={1}
                title={t('apiGuide.quickStart.step1Title')}
              >
                {t('apiGuide.quickStart.step1Body')}
              </NumberedStep>
              <GuideCodeBlock code={setApiKey} language='bash' />
              <NumberedStep
                number={2}
                title={t('apiGuide.quickStart.step2Title')}
              >
                {t('apiGuide.quickStart.step2Body')}
              </NumberedStep>
              <NumberedStep
                number={3}
                title={t('apiGuide.quickStart.step3Title')}
              >
                {t('apiGuide.quickStart.step3Body')}
              </NumberedStep>
              <NumberedStep
                number={4}
                title={t('apiGuide.quickStart.step4Title')}
              >
                {t('apiGuide.quickStart.step4Body')}
              </NumberedStep>
            </GuideSection>

            <GuideSection
              id='environment'
              title={t('apiGuide.environment.title')}
              description={t('apiGuide.environment.description')}
            >
              <div className='grid gap-4 md:grid-cols-3'>
                <div className='rounded-lg border p-4'>
                  <h3 className='font-medium'>
                    {t('apiGuide.environment.windowsTitle')}
                  </h3>
                  <p className='text-muted-foreground mt-1 text-sm leading-6'>
                    {t('apiGuide.environment.windowsBody')}
                  </p>
                  <GuideCodeBlock
                    code={'node --version\nnpm --version\ngit --version'}
                    language='PowerShell'
                  />
                </div>
                <div className='rounded-lg border p-4'>
                  <h3 className='font-medium'>
                    {t('apiGuide.environment.macosTitle')}
                  </h3>
                  <p className='text-muted-foreground mt-1 text-sm leading-6'>
                    {t('apiGuide.environment.macosBody')}
                  </p>
                  <GuideCodeBlock
                    code={'node -v\nnpm -v\ngit --version'}
                    language='Terminal'
                  />
                </div>
                <div className='rounded-lg border p-4'>
                  <h3 className='font-medium'>
                    {t('apiGuide.environment.linuxTitle')}
                  </h3>
                  <p className='text-muted-foreground mt-1 text-sm leading-6'>
                    {t('apiGuide.environment.linuxBody')}
                  </p>
                  <GuideCodeBlock
                    code={'sudo apt update\nsudo apt install -y nodejs npm git'}
                    language='bash'
                  />
                </div>
              </div>
              <div className='rounded-lg border p-4'>
                <h3 className='font-medium'>
                  {t('apiGuide.environment.claudeInstallTitle')}
                </h3>
                <p className='text-muted-foreground mt-1 text-sm leading-6'>
                  {t('apiGuide.environment.claudeInstallBody')}
                </p>
                <GuideCodeBlock
                  code={
                    'npm install -g @anthropic-ai/claude-code\nclaude --version'
                  }
                  language='bash'
                />
              </div>
              <div className='rounded-lg border p-4'>
                <h3 className='font-medium'>
                  {t('apiGuide.environment.editorTitle')}
                </h3>
                <p className='text-muted-foreground mt-1 text-sm leading-6'>
                  {t('apiGuide.environment.editorBody')}
                </p>
              </div>
            </GuideSection>

            <GuideSection
              id='connection'
              title={t('apiGuide.connection.title')}
              description={t('apiGuide.connection.description')}
            >
              <dl className='rounded-lg border px-4'>
                <SettingRow
                  label={t('apiGuide.connection.openAIBase')}
                  value={openAIBaseUrl}
                />
                <SettingRow
                  label={t('apiGuide.connection.claudeBase')}
                  value={origin}
                />
                <SettingRow
                  label={t('apiGuide.connection.auth')}
                  value='Authorization: Bearer <your-emo-api-key>'
                />
                <SettingRow
                  label={t('apiGuide.connection.model')}
                  value={t('apiGuide.connection.modelValue')}
                />
              </dl>
              <p className='text-muted-foreground text-sm leading-6'>
                {t('apiGuide.connection.listModels')}
              </p>
              <GuideCodeBlock code={curlModels} language='bash' />
              <p className='text-muted-foreground text-sm leading-6'>
                {t('apiGuide.connection.testRequest')}
              </p>
              <GuideCodeBlock code={curlResponses} language='bash' />
            </GuideSection>

            <GuideSection
              id='codex'
              title={t('apiGuide.codex.title')}
              description={t('apiGuide.codex.description')}
            >
              <NumberedStep number={1} title={t('apiGuide.codex.step1Title')}>
                {t('apiGuide.codex.step1Body')}
              </NumberedStep>
              <GuideCodeBlock code={setApiKey} language='bash' />
              <NumberedStep number={2} title={t('apiGuide.codex.step2Title')}>
                {t('apiGuide.codex.step2Body')}
              </NumberedStep>
              <GuideCodeBlock code={codexConfig} language='toml' />
              <NumberedStep number={3} title={t('apiGuide.codex.step3Title')}>
                {t('apiGuide.codex.step3Body')}
              </NumberedStep>
              <GuideCodeBlock code={codexCommand} language='bash' />
              <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'>
                {t('apiGuide.codex.note')}
              </div>
            </GuideSection>

            <GuideSection
              id='claude-code'
              title={t('apiGuide.claudeCode.title')}
              description={t('apiGuide.claudeCode.description')}
            >
              <NumberedStep
                number={1}
                title={t('apiGuide.claudeCode.step1Title')}
              >
                {t('apiGuide.claudeCode.step1Body')}
              </NumberedStep>
              <GuideCodeBlock
                code={`export ANTHROPIC_BASE_URL="${origin}"
export ANTHROPIC_AUTH_TOKEN="your-emo-api-key"
export ANTHROPIC_MODEL="claude-opus-4-6"
export CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1
claude`}
                language='bash'
              />
              <NumberedStep
                number={2}
                title={t('apiGuide.claudeCode.step2Title')}
              >
                {t('apiGuide.claudeCode.step2Body')}
              </NumberedStep>
              <GuideCodeBlock code={claudeSettings} language='json' />
              <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'>
                {t('apiGuide.claudeCode.note')}
              </div>
            </GuideSection>

            <GuideSection
              id='cherry-studio'
              title={t('apiGuide.cherryStudio.title')}
              description={t('apiGuide.cherryStudio.description')}
            >
              <ol className='list-decimal space-y-2 pl-5 text-sm leading-7'>
                <li>{t('apiGuide.cherryStudio.step1')}</li>
                <li>{t('apiGuide.cherryStudio.step2')}</li>
                <li>{t('apiGuide.cherryStudio.step3', { origin })}</li>
                <li>{t('apiGuide.cherryStudio.step4')}</li>
                <li>{t('apiGuide.cherryStudio.step5')}</li>
              </ol>
            </GuideSection>

            <GuideSection
              id='chatbox'
              title={t('apiGuide.chatbox.title')}
              description={t('apiGuide.chatbox.description')}
            >
              <ol className='list-decimal space-y-2 pl-5 text-sm leading-7'>
                <li>{t('apiGuide.chatbox.step1')}</li>
                <li>{t('apiGuide.chatbox.step2')}</li>
                <li>{t('apiGuide.chatbox.step3', { origin })}</li>
                <li>{t('apiGuide.chatbox.step4')}</li>
                <li>{t('apiGuide.chatbox.step5')}</li>
              </ol>
            </GuideSection>

            <GuideSection
              id='open-webui'
              title={t('apiGuide.openWebUI.title')}
              description={t('apiGuide.openWebUI.description')}
            >
              <ol className='list-decimal space-y-2 pl-5 text-sm leading-7'>
                <li>{t('apiGuide.openWebUI.step1')}</li>
                <li>{t('apiGuide.openWebUI.step2', { openAIBaseUrl })}</li>
                <li>{t('apiGuide.openWebUI.step3')}</li>
                <li>{t('apiGuide.openWebUI.step4')}</li>
              </ol>
              <p className='text-muted-foreground text-sm leading-6'>
                {t('apiGuide.openWebUI.docker')}
              </p>
              <GuideCodeBlock code={openWebUiDocker} language='bash' />
            </GuideSection>

            <GuideSection
              id='opencode'
              title={t('apiGuide.openCode.title')}
              description={t('apiGuide.openCode.description')}
            >
              <NumberedStep
                number={1}
                title={t('apiGuide.openCode.step1Title')}
              >
                {t('apiGuide.openCode.step1Body')}
              </NumberedStep>
              <GuideCodeBlock code={openCodeConfig} language='bash' />
              <NumberedStep
                number={2}
                title={t('apiGuide.openCode.step2Title')}
              >
                {t('apiGuide.openCode.step2Body', { openAIBaseUrl })}
              </NumberedStep>
              <GuideCodeBlock code={openClawConfig} language='json' />
              <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'>
                {t('apiGuide.openCode.note')}
              </div>
            </GuideSection>

            <GuideSection
              id='other-tools'
              title={t('apiGuide.otherTools.title')}
              description={t('apiGuide.otherTools.description')}
            >
              <div className='grid gap-3 sm:grid-cols-2'>
                {['Cursor', 'Cline', 'Continue', 'LobeChat'].map((tool) => (
                  <div key={tool} className='rounded-lg border p-4'>
                    <h3 className='font-medium'>{tool}</h3>
                    <p className='text-muted-foreground mt-1 text-sm leading-6'>
                      {t('apiGuide.otherTools.card', { openAIBaseUrl })}
                    </p>
                  </div>
                ))}
              </div>
            </GuideSection>

            <GuideSection
              id='billing'
              title={t('apiGuide.billing.title')}
              description={t('apiGuide.billing.description')}
            >
              <ul className='space-y-3 text-sm leading-7'>
                <li className='flex gap-2'>
                  <CheckCircle2 className='mt-1 size-4 shrink-0 text-emerald-600' />
                  {t('apiGuide.billing.item1')}
                </li>
                <li className='flex gap-2'>
                  <CheckCircle2 className='mt-1 size-4 shrink-0 text-emerald-600' />
                  {t('apiGuide.billing.item2')}
                </li>
                <li className='flex gap-2'>
                  <CheckCircle2 className='mt-1 size-4 shrink-0 text-emerald-600' />
                  {t('apiGuide.billing.item3')}
                </li>
              </ul>
            </GuideSection>

            <GuideSection
              id='troubleshooting'
              title={t('apiGuide.troubleshooting.title')}
              description={t('apiGuide.troubleshooting.description')}
            >
              <div className='overflow-x-auto rounded-lg border'>
                <table className='w-full min-w-[620px] text-left text-sm'>
                  <thead className='bg-muted/50'>
                    <tr>
                      <th className='px-4 py-3 font-medium'>
                        {t('apiGuide.troubleshooting.error')}
                      </th>
                      <th className='px-4 py-3 font-medium'>
                        {t('apiGuide.troubleshooting.cause')}
                      </th>
                      <th className='px-4 py-3 font-medium'>
                        {t('apiGuide.troubleshooting.solution')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y'>
                    {TROUBLESHOOTING_ROWS.map((row) => (
                      <tr key={row.id}>
                        <td className='px-4 py-3 font-mono'>
                          {t(row.nameKey)}
                        </td>
                        <td className='text-muted-foreground px-4 py-3'>
                          {t(row.causeKey)}
                        </td>
                        <td className='text-muted-foreground px-4 py-3'>
                          {t(row.solutionKey)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GuideSection>

            <GuideSection
              id='security'
              title={t('apiGuide.security.title')}
              description={t('apiGuide.security.description')}
            >
              <ul className='list-disc space-y-2 pl-5 text-sm leading-7'>
                <li>{t('apiGuide.security.item1')}</li>
                <li>{t('apiGuide.security.item2')}</li>
                <li>{t('apiGuide.security.item3')}</li>
                <li>{t('apiGuide.security.item4')}</li>
                <li>{t('apiGuide.security.item5')}</li>
              </ul>
              <div className='bg-muted/30 rounded-lg border p-4 text-sm leading-6'>
                {t('apiGuide.security.finalNote')}
              </div>
            </GuideSection>
          </main>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
