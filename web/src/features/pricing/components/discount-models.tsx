/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { Sparkles } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { normalizeInterfaceLanguage } from '@/i18n/languages'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import { getSuccessRateDotClass } from '@/features/performance-metrics/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'

import { usePricingData } from '../hooks/use-pricing-data'
import { getDisplayGroupRatio } from '../lib/model-helpers'

type DiscountCopy = {
  title: string
  subtitle: string
  official: string
  savings: string
  docs: string
  note: string
  badge: string
  aiModel: string
  categories: Record<string, string>
}

const copy: Record<string, DiscountCopy> = {
  zh: {
    title: '折扣 AI 模型',
    subtitle:
      '以低于官方价格的优惠价格使用 GPT、Claude、Gemini、DeepSeek 和 KIMI 等模型。',
    official: '官方价',
    savings: '节省',
    docs: '查看文档',
    note: '价格以当前用户组和实际模型配置为准。',
    badge: '限时优惠',
    aiModel: 'AI 模型',
    categories: {
      GPT: 'GPT',
      Claude: 'Claude',
      Gemini: 'Gemini',
      DeepSeek: 'DeepSeek',
      KIMI: 'KIMI',
    },
  },
  en: {
    title: 'Discounted AI Models',
    subtitle:
      'Use GPT, Claude, Gemini, DeepSeek and KIMI at prices below the official rates.',
    official: 'Official price',
    savings: 'Save',
    docs: 'View docs',
    note: 'Pricing depends on your user group and the selected model configuration.',
    badge: 'Discount',
    aiModel: 'AI model',
    categories: {
      GPT: 'GPT',
      Claude: 'Claude',
      Gemini: 'Gemini',
      DeepSeek: 'DeepSeek',
      KIMI: 'KIMI',
    },
  },
  ja: {
    title: '割引 AI モデル',
    subtitle:
      'GPT、Claude、Gemini、DeepSeek、KIMI などを公式価格より安く利用できます。',
    official: '公式価格',
    savings: 'お得',
    docs: 'ドキュメントを見る',
    note: '料金はユーザーグループとモデル設定によって異なります。',
    badge: '割引',
    aiModel: 'AI モデル',
    categories: {
      GPT: 'GPT',
      Claude: 'Claude',
      Gemini: 'Gemini',
      DeepSeek: 'DeepSeek',
      KIMI: 'KIMI',
    },
  },
}

const categoryOrder = ['GPT', 'Claude', 'Gemini', 'DeepSeek', 'KIMI']

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
  return null
}

function formatRatio(language: string, ratio: number, official: string) {
  const percentage = Math.round(ratio * 100)
  const normalized = normalizeInterfaceLanguage(language)
  if (normalized === 'zhCN') return `${official} ${Math.round(ratio * 10)}折`
  if (normalized === 'ja') return `公式価格の ${percentage}%`
  return `${percentage}% of official price`
}

export function DiscountModels() {
  const { i18n } = useTranslation()
  const { models, groupRatio, isLoading } = usePricingData('/api/discount-pricing')
  const perfQuery = useQuery({
    queryKey: ['perf-metrics-summary', 24],
    queryFn: () => getPerfMetricsSummary(24),
    staleTime: 60 * 1000,
    retry: false,
  })
  const text = getCopy(i18n.resolvedLanguage ?? i18n.language)
  const language = i18n.resolvedLanguage ?? i18n.language
  const perfMap = useMemo(
    () => new Map((perfQuery.data?.data?.models ?? []).map((item) => [item.model_name, item])),
    [perfQuery.data]
  )

  useEffect(() => {
    document.title = `${text.title} | EMO API`
  }, [text.title])

  const discountedGroups = useMemo(() => {
    return Object.entries(groupRatio)
      .filter(([, ratio]) => ratio > 0 && ratio < 1)
      .map(([group, ratio]) => ({
        group,
        ratio,
        models: (models || [])
          .filter((model) => model.enable_groups?.includes(group))
          .map((model) => ({
            ...model,
            category: getCategory(model.model_name),
            displayRatio: getDisplayGroupRatio(model, group),
          }))
          .filter((model) => model.displayRatio > 0 && model.displayRatio < 1)
          .sort((a, b) => {
            const categoryDiff =
              (a.category ? categoryOrder.indexOf(a.category) : categoryOrder.length) -
              (b.category ? categoryOrder.indexOf(b.category) : categoryOrder.length)
            return categoryDiff || a.model_name.localeCompare(b.model_name)
          }),
      }))
      .filter((section) => section.models.length > 0)
      .sort((a, b) => a.ratio - b.ratio)
  }, [groupRatio, models])

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition className='mx-auto w-full max-w-[1400px] px-4 pt-24 pb-16 sm:px-8'>
        <header className='mx-auto max-w-3xl text-center'>
          <div className='bg-primary/10 text-primary mx-auto mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium'>
            <Sparkles className='size-4' />
            {text.badge}
          </div>
          <h1 className='text-4xl font-bold tracking-tight sm:text-6xl'>
            {text.title}
          </h1>
          <p className='text-muted-foreground mx-auto mt-5 max-w-2xl text-base leading-7 sm:text-lg'>
            {text.subtitle}
          </p>
        </header>

        {isLoading ? (
          <div className='mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className='bg-muted/40 h-52 animate-pulse rounded-2xl border'
              />
            ))}
          </div>
        ) : (
          <div className='mt-12 space-y-10'>
            {discountedGroups.map((section) => (
              <section key={section.group}>
                <div className='mb-4 flex items-baseline gap-3'>
                  <h2 className='text-xl font-semibold leading-none tracking-tight'>
                    {section.group}
                  </h2>
                  <span className='text-primary text-sm font-semibold leading-none'>
                    {formatRatio(language, section.ratio, text.official)}
                  </span>
                </div>
                <div className='grid grid-cols-1 gap-3 pb-2 sm:grid-cols-[repeat(2,minmax(0,280px))] lg:grid-cols-[repeat(4,minmax(0,280px))]'>
                  {section.models.map((model) => {
                    const iconKey = model.icon || model.vendor_icon
                    return (
                      <article
                        key={`${section.group}-${model.model_name}`}
                        className='bg-background flex h-[72px] w-full items-center gap-2.5 rounded-xl border p-2.5 shadow-sm transition-colors hover:border-primary/50'
                      >
                        <div className='bg-muted/60 flex size-9 shrink-0 items-center justify-center rounded-lg'>
                          {iconKey ? getLobeIcon(iconKey, 28) : model.model_name.charAt(0)}
                        </div>
                        <div className='min-w-0'>
                          <h3 className='truncate font-mono text-sm font-semibold'>
                            {model.model_name}
                          </h3>
                          <p className='text-muted-foreground mt-1 text-xs'>
                            {(() => {
                              const rate = perfMap.get(model.model_name)?.success_rate
                              const hasRate =
                                typeof rate === 'number' && Number.isFinite(rate)
                              const recentRates = perfMap.get(model.model_name)?.recent_success_rates ?? []
                              const signalRates = (
                                recentRates.length > 0
                                  ? recentRates.slice(-3)
                                  : hasRate
                                    ? [rate]
                                    : []
                              ).slice(-3)
                              const signalBars = [
                                ...Array(Math.max(0, 3 - signalRates.length)).fill(null),
                                ...signalRates,
                              ]
                              return (
                                <span className='inline-flex items-center gap-1.5'>
                                  <span className='flex h-3 items-end gap-0.5'>
                                    {signalBars.map((value, index) => (
                                      <span
                                        key={`${model.model_name}-signal-${index}`}
                                        className={`w-1 rounded-full ${index === 0 ? 'h-2' : index === 1 ? 'h-2.5' : 'h-3'} ${value == null ? 'bg-muted-foreground/15' : getSuccessRateDotClass(value)}`}
                                      />
                                    ))}
                                  </span>
                                  {hasRate ? `${rate.toFixed(1)}%` : '—'}
                                </span>
                              )
                            })()}
                          </p>
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
