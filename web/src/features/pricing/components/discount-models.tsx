import { useQuery } from '@tanstack/react-query'
/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { Database, Gauge, Layers3 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import { getSuccessRateDotClass } from '@/features/performance-metrics/lib/format'
import { normalizeInterfaceLanguage } from '@/i18n/languages'
import { getLobeIcon } from '@/lib/lobe-icon'

import { usePricingData } from '../hooks/use-pricing-data'
import { DiscountPriceRow } from './discount-price-row'

type Copy = {
  title: string
  subtitle: string
  modelCount: string
  groupCount: string
  best: string
  input: string
  output: string
  cache: string
  cacheWrite: string
  request: string
  official: string
  group: string
  categories: Record<string, string>
}

const copy: Record<string, Copy> = {
  zh: {
    title: '模型价格表',
    subtitle:
      '实际计费基础价 × 分组倍率，单位美元/百万 tokens。动态价格显示完整区间，缓存命中单独计价。',
    modelCount: '个模型',
    groupCount: '个分组',
    best: '最低折扣',
    input: '输入',
    output: '输出',
    cache: '缓存读取',
    cacheWrite: '缓存写入',
    request: '每次请求',
    official: '原价',
    group: '分组',
    categories: {
      GPT: 'GPT',
      Claude: 'Claude',
      Gemini: 'Gemini',
      DeepSeek: 'DeepSeek',
      KIMI: 'KIMI',
      Other: '其他',
    },
  },
  en: {
    title: 'Model pricing',
    subtitle:
      'Billing base × group multiplier, in USD per million tokens. Dynamic prices show all tiers; cached tokens are charged separately.',
    modelCount: 'models',
    groupCount: 'groups',
    best: 'Best deal',
    input: 'Input',
    output: 'Output',
    cache: 'Cache read',
    cacheWrite: 'Cache write',
    request: 'per request',
    official: 'List',
    group: 'Group',
    categories: {
      GPT: 'GPT',
      Claude: 'Claude',
      Gemini: 'Gemini',
      DeepSeek: 'DeepSeek',
      KIMI: 'KIMI',
      Other: 'Other',
    },
  },
  ja: {
    title: 'モデル料金表',
    subtitle:
      '課金基本単価 × グループ倍率（USD/百万 tokens）。変動料金は全範囲を表示し、キャッシュは別料金です。',
    modelCount: 'モデル',
    groupCount: 'グループ',
    best: '最安',
    input: '入力',
    output: '出力',
    cache: 'キャッシュ読取',
    cacheWrite: 'キャッシュ書込',
    request: 'リクエストごと',
    official: '通常',
    group: 'グループ',
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

function getCategory(name: string) {
  const value = name.toLowerCase()
  if (value.includes('claude')) return 'Claude'
  if (value.includes('gemini')) return 'Gemini'
  if (value.includes('deepseek')) return 'DeepSeek'
  if (value.includes('kimi')) return 'KIMI'
  if (value.includes('gpt')) return 'GPT'
  return 'Other'
}

export function DiscountModels() {
  const { i18n, t } = useTranslation()
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

  const items = useMemo(
    () =>
      (models || [])
        .map((model) => {
          const enabled = model.enable_groups?.includes('all')
            ? Object.keys(groupRatio)
            : model.enable_groups || []
          const groups = enabled
            .filter(
              (group) =>
                Number.isFinite(groupRatio[group]) && groupRatio[group] > 0
            )
            .map((group) => ({ group, ratio: groupRatio[group] }))
            .sort((a, b) => {
              if (a.group === 'default') return -1
              if (b.group === 'default') return 1
              return a.ratio - b.ratio || a.group.localeCompare(b.group)
            })
          return { model, groups, category: getCategory(model.model_name) }
        })
        .filter((item) => item.groups.length > 0)
        .sort(
          (a, b) =>
            categoryOrder.indexOf(a.category) -
              categoryOrder.indexOf(b.category) ||
            a.model.model_name.localeCompare(b.model.model_name)
        ),
    [groupRatio, models]
  )

  const sections = useMemo(
    () =>
      categoryOrder
        .map((category) => ({
          category,
          items: items.filter((item) => item.category === category),
        }))
        .filter((section) => section.items.length > 0),
    [items]
  )
  const groupCount = new Set(
    items.flatMap((item) => item.groups.map(({ group }) => group))
  ).size
  const bestRatio = items.reduce(
    (value, item) => Math.min(value, ...item.groups.map(({ ratio }) => ratio)),
    1
  )

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition className='mx-auto w-full max-w-[1500px] px-4 pt-20 pb-16 sm:px-8'>
        <header className='mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-5'>
          <div>
            <h1 className='text-3xl font-black tracking-tight sm:text-4xl'>
              {text.title}
            </h1>
            <p className='text-muted-foreground mt-2 text-sm'>
              {text.subtitle}
            </p>
          </div>
          <div className='text-muted-foreground flex items-center gap-4 text-xs'>
            <span className='inline-flex items-center gap-1.5'>
              <Layers3 className='text-primary size-4' />
              {groupCount} {text.groupCount}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <Database className='text-primary size-4' />
              {items.length} {text.modelCount}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <Gauge className='text-primary size-4' />
              {Math.round((1 - bestRatio) * 100)}% {text.best}
            </span>
          </div>
        </header>
        {isLoading ? (
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className='bg-muted/40 h-48 animate-pulse rounded-2xl border'
              />
            ))}
          </div>
        ) : (
          <div className='space-y-8'>
            {sections.map((section) => (
              <section key={section.category}>
                <div className='mb-3 flex items-center gap-2'>
                  <span className='bg-primary size-2 rounded-full' />
                  <h2 className='text-lg font-bold'>
                    {text.categories[section.category] ?? section.category}
                  </h2>
                  <span className='text-muted-foreground text-xs'>
                    {section.items.length} {text.modelCount}
                  </span>
                </div>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                  {section.items.map(({ model, groups }) => {
                    const iconKey = model.icon || model.vendor_icon
                    const perf = perfMap.get(model.model_name)
                    const hasRate =
                      typeof perf?.success_rate === 'number' &&
                      Number.isFinite(perf.success_rate)
                    return (
                      <article
                        key={model.model_name}
                        className='bg-background overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md'
                      >
                        <div className='flex items-center gap-2.5 px-3.5 py-3'>
                          <div className='bg-muted/70 flex size-9 shrink-0 items-center justify-center rounded-xl'>
                            {iconKey ? (
                              getLobeIcon(iconKey, 26)
                            ) : (
                              <span className='font-bold'>
                                {model.model_name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className='min-w-0 flex-1'>
                            <h3 className='truncate font-mono text-xs font-bold sm:text-sm'>
                              {model.model_name}
                            </h3>
                            <div className='text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[10px]'>
                              {hasRate && (
                                <>
                                  <span
                                    className={`size-1.5 rounded-full ${getSuccessRateDotClass(perf.success_rate)}`}
                                  />
                                  {perf.success_rate.toFixed(1)}%
                                </>
                              )}
                            </div>
                          </div>
                          <span className='text-muted-foreground text-[9px]'>
                            {model.quota_type === 1 &&
                            model.billing_mode !== 'tiered_expr'
                              ? 'USD / request'
                              : 'USD / 1M'}
                          </span>
                        </div>
                        <p className='text-muted-foreground px-3 pb-2 text-[10px] sm:hidden'>
                          {t('Swipe horizontally to view all price columns')}
                        </p>
                        <div className='overflow-x-auto'>
                          <div className='bg-muted/25 grid min-w-[460px] grid-cols-[minmax(104px,0.9fr)_repeat(4,minmax(86px,1fr))] gap-1 border-y px-3 py-1.5 text-[9px] font-medium'>
                            <span>{text.group}</span>
                            <span className='text-right'>{text.input}</span>
                            <span className='text-right'>
                              {model.quota_type === 1
                                ? text.request
                                : text.output}
                            </span>
                            <span className='text-right'>{text.cache}</span>
                            <span className='text-right'>
                              {text.cacheWrite}
                            </span>
                          </div>
                          <div>
                            {groups.map(({ group, ratio }) => (
                              <DiscountPriceRow
                                key={group}
                                model={model}
                                group={group}
                                ratio={ratio}
                              />
                            ))}
                          </div>
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
