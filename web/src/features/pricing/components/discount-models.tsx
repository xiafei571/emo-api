/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { Database, Gauge, Layers3 } from 'lucide-react'
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
import type { PricingModel, PriceType } from '../types'

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
  models: string
  categories: Record<string, string>
}

const copy: Record<string, Copy> = {
  zh: {
    title: '模型价格表',
    subtitle: '按模型查看每个分组的输入、输出与缓存价格。',
    modelCount: '个模型',
    groupCount: '个分组',
    best: '最低折扣',
    input: '输入',
    output: '输出',
    cache: '缓存读取',
    cacheWrite: '缓存写入',
    request: '每次请求',
    official: '原价',
    models: '模型',
    categories: { GPT: 'GPT', Claude: 'Claude', Gemini: 'Gemini', DeepSeek: 'DeepSeek', KIMI: 'KIMI', Other: '其他' },
  },
  en: {
    title: 'Model pricing',
    subtitle: 'Input, output and cache prices for every available group.',
    modelCount: 'models',
    groupCount: 'groups',
    best: 'Best deal',
    input: 'Input',
    output: 'Output',
    cache: 'Cache read',
    cacheWrite: 'Cache write',
    request: 'per request',
    official: 'List',
    models: 'Models',
    categories: { GPT: 'GPT', Claude: 'Claude', Gemini: 'Gemini', DeepSeek: 'DeepSeek', KIMI: 'KIMI', Other: 'Other' },
  },
  ja: {
    title: 'モデル料金表',
    subtitle: '利用可能な各グループの入力、出力、キャッシュ料金。',
    modelCount: 'モデル',
    groupCount: 'グループ',
    best: '最安',
    input: '入力',
    output: '出力',
    cache: 'キャッシュ読取',
    cacheWrite: 'キャッシュ書込',
    request: 'リクエストごと',
    official: '通常',
    models: 'モデル',
    categories: { GPT: 'GPT', Claude: 'Claude', Gemini: 'Gemini', DeepSeek: 'DeepSeek', KIMI: 'KIMI', Other: 'その他' },
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

function formatPrice(model: PricingModel, group: string, ratios: Record<string, number>, type: PriceType) {
  if (model.quota_type === 1) return formatFixedPrice(model, group, false, 1, 1, ratios)
  return formatGroupPrice(model, group, type, 'M', false, 1, 1, ratios)
}

function PriceValue({ model, group, ratio, ratios, type }: { model: PricingModel; group: string; ratio: number; ratios: Record<string, number>; type: PriceType }) {
  const actual = formatPrice(model, group, ratios, type)
  const hasPrice = actual !== '-'
  if (!hasPrice) return <span className='text-muted-foreground'>—</span>
  if (ratio === 1) return <span className='font-mono text-[11px] font-bold'>{actual}</span>
  return <span className='text-right'><span className='text-muted-foreground mr-1 font-mono text-[9px] line-through'>{formatPrice(model, group, { [group]: 1 }, type)}</span><span className='text-primary font-mono text-[11px] font-bold'>{actual}</span></span>
}

function GroupRow({ model, group, ratio, ratios, text }: { model: PricingModel; group: string; ratio: number; ratios: Record<string, number>; text: Copy }) {
  const cache = model.cache_ratio != null
  const cacheWrite = model.create_cache_ratio != null
  const isRequest = model.quota_type === 1
  return <div className='grid grid-cols-[minmax(76px,0.8fr)_repeat(4,minmax(52px,1fr))] items-center gap-1 border-t px-3 py-2 first:border-t-0 sm:grid-cols-[minmax(104px,0.9fr)_repeat(4,minmax(66px,1fr))]'>
    <div className='flex min-w-0 items-center gap-1.5'><span className='truncate font-mono text-[10px] font-semibold sm:text-[11px]'>{group}</span><span className={ratio < 1 ? 'bg-primary/10 text-primary rounded px-1 py-0.5 text-[8px] font-bold' : 'bg-muted text-muted-foreground rounded px-1 py-0.5 text-[8px]'}>{ratio === 1 ? text.official : `${Math.round(ratio * 100)}%`}</span></div>
    <div className='text-right'><PriceValue model={model} group={group} ratio={ratio} ratios={ratios} type={isRequest ? 'input' : 'input'} /></div>
    <div className='text-right'><PriceValue model={model} group={group} ratio={ratio} ratios={ratios} type={isRequest ? 'input' : 'output'} /></div>
    <div className='text-right'>{cache ? <PriceValue model={model} group={group} ratio={ratio} ratios={ratios} type='cache' /> : <span className='text-muted-foreground'>—</span>}</div>
    <div className='text-right'>{cacheWrite ? <PriceValue model={model} group={group} ratio={ratio} ratios={ratios} type='create_cache' /> : <span className='text-muted-foreground'>—</span>}</div>
  </div>
}

export function DiscountModels() {
  const { i18n } = useTranslation()
  const { models, groupRatio, isLoading } = usePricingData('/api/discount-pricing')
  const perfQuery = useQuery({ queryKey: ['perf-metrics-summary', 24], queryFn: () => getPerfMetricsSummary(24), staleTime: 60 * 1000, retry: false })
  const language = i18n.resolvedLanguage ?? i18n.language
  const text = getCopy(language)
  const perfMap = useMemo(() => new Map((perfQuery.data?.data?.models ?? []).map((item) => [item.model_name, item])), [perfQuery.data])
  useEffect(() => { document.title = `${text.title} | EMO API` }, [text.title])

  const items = useMemo(() => (models || []).map((model) => {
    const enabled = model.enable_groups?.includes('all') ? Object.keys(groupRatio) : model.enable_groups || []
    const groups = enabled.filter((group) => Number.isFinite(groupRatio[group]) && groupRatio[group] > 0).map((group) => ({ group, ratio: groupRatio[group] })).sort((a, b) => {
      if (a.group === 'default') return -1
      if (b.group === 'default') return 1
      return a.ratio - b.ratio || a.group.localeCompare(b.group)
    })
    return { model, groups, category: getCategory(model.model_name) }
  }).filter((item) => item.groups.length > 0).sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) || a.model.model_name.localeCompare(b.model.model_name)), [groupRatio, models])

  const sections = useMemo(() => categoryOrder.map((category) => ({ category, items: items.filter((item) => item.category === category) })).filter((section) => section.items.length > 0), [items])
  const groupCount = new Set(items.flatMap((item) => item.groups.map(({ group }) => group))).size
  const bestRatio = items.reduce((value, item) => Math.min(value, ...item.groups.map(({ ratio }) => ratio)), 1)

  return <PublicLayout showMainContainer={false}><PageTransition className='mx-auto w-full max-w-[1500px] px-4 pt-20 pb-16 sm:px-8'>
    <header className='mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-5'><div><h1 className='text-3xl font-black tracking-tight sm:text-4xl'>{text.title}</h1><p className='text-muted-foreground mt-2 text-sm'>{text.subtitle}</p></div><div className='text-muted-foreground flex items-center gap-4 text-xs'><span className='inline-flex items-center gap-1.5'><Layers3 className='text-primary size-4' />{groupCount} {text.groupCount}</span><span className='inline-flex items-center gap-1.5'><Database className='text-primary size-4' />{items.length} {text.modelCount}</span><span className='inline-flex items-center gap-1.5'><Gauge className='text-primary size-4' />{Math.round((1 - bestRatio) * 100)}% {text.best}</span></div></header>
    {isLoading ? <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className='bg-muted/40 h-48 animate-pulse rounded-2xl border' />)}</div> : <div className='space-y-8'>{sections.map((section) => <section key={section.category}><div className='mb-3 flex items-center gap-2'><span className='bg-primary size-2 rounded-full' /><h2 className='text-lg font-bold'>{text.categories[section.category] ?? section.category}</h2><span className='text-muted-foreground text-xs'>{section.items.length} {text.models}</span></div><div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>{section.items.map(({ model, groups }) => { const iconKey = model.icon || model.vendor_icon; const perf = perfMap.get(model.model_name); const hasRate = typeof perf?.success_rate === 'number' && Number.isFinite(perf.success_rate); return <article key={model.model_name} className='bg-background overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md'><div className='flex items-center gap-2.5 px-3.5 py-3'><div className='bg-muted/70 flex size-9 shrink-0 items-center justify-center rounded-xl'>{iconKey ? getLobeIcon(iconKey, 26) : <span className='font-bold'>{model.model_name.charAt(0)}</span>}</div><div className='min-w-0 flex-1'><h3 className='truncate font-mono text-xs font-bold sm:text-sm'>{model.model_name}</h3><div className='text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[10px]'>{hasRate && <><span className={`size-1.5 rounded-full ${getSuccessRateDotClass(perf.success_rate)}`} />{perf.success_rate.toFixed(1)}%</>}</div></div><span className='text-muted-foreground text-[9px]'>/ 1M</span></div><div className='grid grid-cols-[minmax(76px,0.8fr)_repeat(4,minmax(52px,1fr))] gap-1 border-y bg-muted/25 px-3 py-1.5 text-[9px] font-medium sm:grid-cols-[minmax(104px,0.9fr)_repeat(4,minmax(66px,1fr))]'><span>{text.models}</span><span className='text-right'>{text.input}</span><span className='text-right'>{model.quota_type === 1 ? text.request : text.output}</span><span className='text-right'>{text.cache}</span><span className='text-right'>{text.cacheWrite}</span></div><div>{groups.map(({ group, ratio }) => <GroupRow key={group} model={model} group={group} ratio={ratio} ratios={groupRatio} text={text} />)}</div></article> })}</div></section>)}</div>}
  </PageTransition></PublicLayout>
}
