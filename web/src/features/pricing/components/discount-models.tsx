/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { getLobeIcon } from '@/lib/lobe-icon'

import { usePricingData } from '../hooks/use-pricing-data'

type DiscountCopy = {
  title: string
  subtitle: string
  official: string
  savings: string
  docs: string
  note: string
  badge: string
  categories: Record<string, string>
}

const copy: Record<string, DiscountCopy> = {
  zh: {
    title: '折扣 AI 模型',
    subtitle:
      '以官方价格 2–4 折使用 GPT、Claude、Gemini、DeepSeek 和 KIMI 等模型。',
    official: '官方价',
    savings: '节省',
    docs: '查看文档',
    note: '价格以当前用户组和实际模型配置为准。',
    badge: '限时优惠',
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
      'Use GPT, Claude, Gemini, DeepSeek and KIMI at 20%–40% of official prices.',
    official: 'Official price',
    savings: 'Save',
    docs: 'View docs',
    note: 'Pricing depends on your user group and the selected model configuration.',
    badge: 'Discount',
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
      'GPT、Claude、Gemini、DeepSeek、KIMI などを公式価格の 20〜40% で利用できます。',
    official: '公式価格',
    savings: 'お得',
    docs: 'ドキュメントを見る',
    note: '料金はユーザーグループとモデル設定によって異なります。',
    badge: '割引',
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
  return copy[language.split('-')[0]] ?? copy.en
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

export function DiscountModels() {
  const { i18n } = useTranslation()
  const { models, isLoading } = usePricingData('/api/discount-pricing')
  const text = getCopy(i18n.language)

  useEffect(() => {
    document.title = `${text.title} | EMO API`
  }, [text.title])

  const discountedModels = useMemo(() => {
    return (models || [])
      .map((model) => ({ ...model, category: getCategory(model.model_name) }))
      .filter(
        (model) =>
          model.category && model.model_ratio > 0 && model.model_ratio <= 0.4
      )
      .sort((a, b) => {
        const categoryDiff =
          categoryOrder.indexOf(a.category!) - categoryOrder.indexOf(b.category!)
        return categoryDiff || a.model_ratio - b.model_ratio
      })
  }, [models])

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
          <div className='mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {discountedModels.map((model) => {
              const ratio = model.model_ratio
              const discount = Math.round((1 - ratio) * 100)
              const iconKey = model.icon || model.vendor_icon
              const icon = iconKey ? getLobeIcon(iconKey, 28) : null

              return (
                <article
                  key={model.model_name}
                  className='group bg-background relative flex min-h-52 flex-col rounded-2xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md'
                >
                  <div className='flex items-start justify-between gap-3'>
                    <div className='flex min-w-0 items-center gap-3'>
                      <div className='bg-muted/60 flex size-11 shrink-0 items-center justify-center rounded-xl'>
                        {icon || (
                          <span className='text-muted-foreground font-semibold'>
                            {model.model_name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className='min-w-0'>
                        <h2 className='truncate font-mono text-lg font-semibold'>
                          {model.model_name}
                        </h2>
                        <p className='text-muted-foreground text-sm'>
                          {text.categories[model.category!] || model.category}
                        </p>
                      </div>
                    </div>
                    <span className='bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold'>
                      {text.official} {Math.round(ratio * 10)}折
                    </span>
                  </div>

                  <div className='mt-auto pt-8'>
                    <div className='flex items-end justify-between gap-3'>
                      <div>
                        <p className='text-muted-foreground text-sm'>
                          {text.savings} {discount}%
                        </p>
                        <p className='mt-1 text-2xl font-bold'>
                          {Math.round(ratio * 100)}%
                          <span className='text-muted-foreground ml-1 text-sm font-normal'>
                            {text.official}
                          </span>
                        </p>
                      </div>
                      <Link
                        to='/guide'
                        className='text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline'
                      >
                        {text.docs}
                        <ArrowRight className='size-4 transition-transform group-hover:translate-x-0.5' />
                      </Link>
                    </div>
                    <div className='text-muted-foreground mt-4 flex items-center gap-1.5 border-t pt-3 text-xs'>
                      <Check className='size-3.5 text-emerald-500' />
                      {text.note}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </PageTransition>
    </PublicLayout>
  )
}
