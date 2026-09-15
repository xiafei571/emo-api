/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { ArrowRight, Layers3, TrendingDown, Zap } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import { getSuccessRateDotClass } from '@/features/performance-metrics/lib/format'
import { normalizeInterfaceLanguage } from '@/i18n/languages'
import { getLobeIcon } from '@/lib/lobe-icon'

import { usePricingData } from '../hooks/use-pricing-data'
import { formatFixedPrice, formatGroupPrice } from '../lib/price'
import type { PricingModel } from '../types'

type DiscountCopy = {
  title: string
  subtitle: string
  official: string
  actual: string
  savings: string
  perMillion: string
  groups: string
  models: string
  bestDeal: string
  note: string
  input: string
  output: string
  request: string
  details: string
  group: string
  standard: string
  categories: Record<string, string>
}

const copy: Record<string, DiscountCopy> = {
  zh: {
    title: '同一模型，不同分组，价格一眼看清',
    subtitle:
      '每个模型集中展示所有可用分组。官方原价与各分组实际价格并排对比，直接选择更合适的价格。',
    official: '官方价',
    actual: '实际价',
    savings: '立省',
    perMillion: '/ 1M',
    groups: '价格分组',
    models: '可用模型',
    bestDeal: '最高优惠',
    note: '同一模型的 default 与优惠分组在同一张卡片内对比。',
    input: '输入',
    output: '输出',
    request: '每次请求',
    details: '跨分组价格对比',
    group: '分组',
    standard: '原价',
    categories: {
      GPT: 'GPT',
      Claude: 'Claude',
      Gemini: 'Gemini',
      DeepSeek: 'DeepSeek',
      KIMI: 'KIMI',
      Other: '其他模型',
    },
  },
  en: {
    title: 'One model. Every group price, side by side.',
    subtitle:
      'See every available group inside each model. Compare official rates with the actual group price and choose the better deal.',
    official: 'Official',
    actual: 'Actual',
    savings: 'Save',
    perMillion: '/ 1M',
    groups: 'Price groups',
    models: 'Available models',
    bestDeal: 'Best deal',
    note: 'Compare default and discounted groups for the same model in one card.',
    input: 'Input',
    output: 'Output',
    request: 'Per request',
    details: 'Prices across groups',
    group: 'Group',
    standard: 'List price',
    categories: {
      GPT: 'GPT',
      Claude: 'Claude',
      Gemini: 'Gemini',
      DeepSeek: 'DeepSeek',
      KIMI: 'KIMI',
      Other: 'Other models',
    },
  },
  ja: {
    title: '同じモデルのグループ価格を一目で比較',
    subtitle:
      '各モデルですべての利用可能なグループをまとめて表示。公式価格とグループ別の実価格を比較できます。',
    official: '公式価格',
    actual: '実価格',
    savings: 'お得',
    perMillion: '/ 1M',
    groups: '価格グループ',
    models: '利用可能モデル',
    bestDeal: '最大割引',
    note: '同じモデルの default と割引グループを一つのカードで比較します。',
    input: '入力',
    output: '出力',
    request: 'リクエストごと',
    details: 'グループ別料金比較',
    group: 'グループ',
    standard: '通常価格',
    categories: {
      GPT: 'GPT',
      Claude: 'Claude',
      Gemini: 'Gemini',
      DeepSeek: 'DeepSeek',
      KIMI: 'KIMI',
      Other: 'その他',
    },
  },
}

const categoryOrder = ['GPT', 'Claude', 'Gemini', 'DeepSeek', 'KIMI', 'Other']

function getCopy(language: string) {
  const normalized = normalizeInterfaceLanguage(language)
  return copy[normalized === 'zhCN' ? 'zh' : normalized] ?? copy.en
}

function getCategory(modelName: string) {
  const normalized = modelName.toLowerCase()
  if (normalized.includes('claude')) return 'Claude'
  if (normalized.includes('gemini')) return 'Gemini'
  if (normalized.includes('deepseek')) return 'DeepSeek'
  if (normalized.includes('kimi')) return 'KIMI'
  if (normalized.includes('gpt')) return 'GPT'
  return 'Other'
}

function ratioLabel(language: string, ratio: number, standard: string) {
  if (ratio === 1) return standard
  const normalized = normalizeInterfaceLanguage(language)
  const percentage = Math.round(ratio * 100)
  if (normalized === 'zhCN') return `${Math.round(ratio * 10)} 折`
  return `${percentage}%`
}

function formatModelPrice(
  model: PricingModel,
  group: string,
  groupRatio: Record<string, number>,
  type: 'input' | 'output',
  official: boolean
) {
  const ratios = official ? { [group]: 1 } : groupRatio
  return model.quota_type === 1
    ? formatFixedPrice(model, group, false, 1, 1, ratios)
    : formatGroupPrice(model, group, type, 'M', false, 1, 1, ratios)
}

function PriceCell({
  model,
  group,
  groupRatio,
  ratio,
  type,
}: {
  model: PricingModel
  group: string
  groupRatio: Record<string, number>
  ratio: number
  type: 'input' | 'output'
}) {
  const actual = formatModelPrice(model, group, groupRatio, type, false)
  if (ratio === 1) {
    return <span className='font-mono text-xs font-bold sm:text-sm'>{actual}</span>
  }

  return (
    <span className='flex items-center justify-end gap-1.5 whitespace-nowrap'>
      <span className='text-muted-foreground font-mono text-[10px] line-through'>
        {formatModelPrice(model, group, groupRatio, type, true)}
      </span>
      <ArrowRight className='text-primary/50 size-3 shrink-0' />
      <span className='font-mono text-xs font-bold sm:text-sm'>{actual}</span>
    </span>
  )
}

export function DiscountModels() {
  const { i18n } = useTranslation()
  const { models, groupRatio, isLoading } = usePricingData(
    '/api/discount-pricing'
  )
  const perfQuery = useQuery({
    queryKey: ['perf-metrics-summary', 24],
    queryFn: () => getPerfMetricsSummary(24),
    staleTime: 60 * 1000,
    retry: false,
  })
  const language = i18n.resolvedLanguage ?? i18n.language
  const text = getCopy(language)
  const perfMap = useMemo(
    () =>
      new Map(
        (perfQuery.data?.data?.models ?? []).map((item) => [
          item.model_name,
          item,
        ])
      ),
    [perfQuery.data]
  )

  useEffect(() => {
    document.title = `${text.title} | EMO API`
  }, [text.title])

  const comparisons = useMemo(() => {
    return (models || [])
      .map((model) => {
        const enabledGroups = model.enable_groups?.includes('all')
          ? Object.keys(groupRatio)
          : model.enable_groups || []
        const groups = enabledGroups
          .filter((group) => {
            const ratio = groupRatio[group]
            return Number.isFinite(ratio) && ratio > 0
          })
          .map((group) => ({ group, ratio: groupRatio[group] }))
          .sort((a, b) => {
            if (a.group === 'default') return -1
            if (b.group === 'default') return 1
            return a.ratio - b.ratio || a.group.localeCompare(b.group)
          })

        return { model, groups, category: getCategory(model.model_name) }
      })
      .filter((item) => item.groups.some(({ ratio }) => ratio < 1))
      .sort((a, b) => {
        const categoryDiff =
          categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
        return categoryDiff || a.model.model_name.localeCompare(b.model.model_name)
      })
  }, [groupRatio, models])

  const sections = useMemo(
    () =>
      categoryOrder
        .map((category) => ({
          category,
          items: comparisons.filter((item) => item.category === category),
        }))
        .filter((section) => section.items.length > 0),
    [comparisons]
  )

  const stats = useMemo(() => {
    const groups = new Set(
      comparisons.flatMap((item) => item.groups.map(({ group }) => group))
    )
    const best = comparisons.reduce(
      (value, item) =>
        Math.min(value, ...item.groups.map(({ ratio }) => ratio)),
      1
    )
    return { groups: groups.size, models: comparisons.length, best }
  }, [comparisons])

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition className='mx-auto w-full max-w-[1500px] px-4 pt-20 pb-16 sm:px-8'>
        <section className='relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-primary/90 to-indigo-700 px-6 py-10 text-white shadow-xl shadow-primary/15 sm:px-10 sm:py-12'>
          <div className='pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-cyan-300/20 blur-3xl' />
          <div className='pointer-events-none absolute -bottom-36 left-1/3 size-96 rounded-full bg-fuchsia-400/20 blur-3xl' />
          <div className='relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end'>
            <div>
              <h1 className='max-w-3xl text-4xl font-black tracking-tight sm:text-5xl'>
                {text.title}
              </h1>
              <p className='mt-4 max-w-2xl text-sm leading-6 text-white/75 sm:text-base'>
                {text.subtitle}
              </p>
            </div>
            <div className='grid grid-cols-3 gap-2'>
              {[
                { icon: Layers3, value: stats.groups, label: text.groups },
                { icon: Zap, value: stats.models, label: text.models },
                {
                  icon: TrendingDown,
                  value: `${Math.round((1 - stats.best) * 100)}%`,
                  label: text.bestDeal,
                },
              ].map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className='rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur sm:p-4'
                >
                  <div className='flex items-center justify-between gap-2'>
                    <Icon className='size-4 text-cyan-200' />
                    <div className='text-xl font-black sm:text-2xl'>{value}</div>
                  </div>
                  <div className='mt-3 text-[11px] text-white/60 sm:text-xs'>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className='mt-7 flex flex-wrap items-baseline gap-x-3 gap-y-1'>
          <div className='bg-primary size-2 rounded-full' />
          <h2 className='text-lg font-bold sm:text-xl'>{text.details}</h2>
          <span className='text-muted-foreground text-xs'>{text.note}</span>
        </div>

        {isLoading ? (
          <div className='mt-4 grid gap-4 lg:grid-cols-2'>
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className='bg-muted/40 h-60 animate-pulse rounded-2xl border'
              />
            ))}
          </div>
        ) : (
          <div className='mt-4 space-y-6'>
            {sections.map((section) => (
              <section key={section.category}>
                <div className='mb-2.5 flex items-center gap-2'>
                  <h3 className='text-base font-bold'>
                    {text.categories[section.category] ?? section.category}
                  </h3>
                  <span className='text-muted-foreground text-xs'>
                    {section.items.length}
                  </span>
                </div>
                <div className='grid items-start gap-3 lg:grid-cols-2'>
                  {section.items.map(({ model, groups }) => {
                    const iconKey = model.icon || model.vendor_icon
                    const rate = perfMap.get(model.model_name)?.success_rate
                    const hasRate =
                      typeof rate === 'number' && Number.isFinite(rate)
                    const priceTypeLabel =
                      model.quota_type === 1 ? text.request : text.perMillion

                    return (
                      <article
                        key={model.model_name}
                        className='bg-background overflow-hidden rounded-xl border shadow-sm'
                      >
                        <header className='flex items-center gap-2.5 border-b px-3 py-2.5'>
                          <div className='bg-muted/60 flex size-8 shrink-0 items-center justify-center rounded-lg'>
                            {iconKey ? (
                              getLobeIcon(iconKey, 24)
                            ) : (
                              <span className='font-bold'>
                                {model.model_name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <h4 className='min-w-0 flex-1 truncate font-mono text-sm font-bold'>
                            {model.model_name}
                          </h4>
                          {hasRate && (
                            <span className='text-muted-foreground inline-flex shrink-0 items-center gap-1 text-[10px]'>
                              <span
                                className={`size-1.5 rounded-full ${getSuccessRateDotClass(rate)}`}
                              />
                              {rate.toFixed(1)}%
                            </span>
                          )}
                          <span className='text-muted-foreground shrink-0 text-[9px]'>
                            {priceTypeLabel}
                          </span>
                        </header>

                        <div className='grid grid-cols-[minmax(68px,0.8fr)_minmax(96px,1.2fr)_minmax(96px,1.2fr)] items-center gap-x-2 border-b bg-muted/20 px-3 py-1.5 text-[10px] font-medium'>
                          <span className='text-muted-foreground'>{text.group}</span>
                          <span className='text-muted-foreground text-right'>
                            {text.input}
                          </span>
                          {model.quota_type !== 1 && (
                            <span className='text-muted-foreground text-right'>
                              {text.output}
                            </span>
                          )}
                        </div>

                        <div className='divide-y'>
                          {groups.map(({ group, ratio }) => (
                            <div
                              key={group}
                              className='grid min-h-10 grid-cols-[minmax(68px,0.8fr)_minmax(96px,1.2fr)_minmax(96px,1.2fr)] items-center gap-x-2 px-3 py-2'
                            >
                              <div className='flex min-w-0 items-center gap-1.5'>
                                <span className='truncate font-mono text-[11px] font-semibold'>
                                  {group}
                                </span>
                                <span
                                  className={
                                    ratio < 1
                                      ? 'bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold'
                                      : 'bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium'
                                  }
                                >
                                  {ratioLabel(language, ratio, text.standard)}
                                </span>
                              </div>
                              <div className='text-right'>
                                <PriceCell
                                  model={model}
                                  group={group}
                                  groupRatio={groupRatio}
                                  ratio={ratio}
                                  type='input'
                                />
                              </div>
                              {model.quota_type !== 1 && (
                                <div className='text-right'>
                                  <PriceCell
                                    model={model}
                                    group={group}
                                    groupRatio={groupRatio}
                                    ratio={ratio}
                                    type='output'
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </PageTransition>
    </PublicLayout>
  )
}
