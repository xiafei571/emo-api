/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'

import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'

interface HeroModelWallProps {
  className?: string
}

export function HeroModelWall(props: HeroModelWallProps) {
  const { t } = useTranslation()
  const { models, isLoading } = usePricingData('/api/discount-pricing')

  const visibleModels = useMemo(
    () =>
      (models || []).filter((model) => model.model_name).slice(0, 48),
    [models]
  )

  return (
    <div className={cn('mx-auto w-full max-w-2xl', props.className)}>
      <div className='border-border/60 bg-white/90 relative h-[460px] overflow-hidden rounded-2xl border p-6 shadow-[0_20px_50px_-25px_rgba(15,23,42,0.18)] backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#0b0f17]/90 dark:shadow-[0_20px_60px_-25px_rgba(0,0,0,0.7)]'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase'>
              {t('Model Square')}
            </p>
            <h2 className='mt-1 text-xl font-semibold tracking-tight'>
              {t('All your favorite models in one place')}
            </h2>
          </div>
          <span className='bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full px-2.5 py-1 text-xs font-medium'>
            {models?.length || 0}+
          </span>
        </div>

        <div className='from-background pointer-events-none absolute inset-x-0 top-20 z-10 h-8 bg-gradient-to-b to-transparent' />
        <div className='relative mt-6'>
          <div className='scrollbar-thin grid max-h-[260px] grid-cols-2 gap-2.5 overflow-y-auto pb-16 pr-1 sm:grid-cols-3'>
          {isLoading
            ? Array.from({ length: 18 }, (_, index) => (
                <div
                  key={index}
                  className='bg-muted/50 h-[72px] animate-pulse rounded-xl'
                />
              ))
            : visibleModels.map((model) => {
                const iconKey = model.icon || model.vendor_icon
                return (
                  <div
                    key={model.model_name}
                    className='border-border/60 bg-background/70 hover:border-primary/40 hover:bg-muted/30 flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors'
                  >
                    <div className='bg-muted/60 flex size-9 shrink-0 items-center justify-center rounded-lg'>
                      {getLobeIcon(iconKey, 23)}
                    </div>
                    <span className='truncate font-mono text-xs font-medium'>
                      {model.model_name}
                    </span>
                  </div>
                )
              })}
          </div>
          <div
            aria-hidden
            className='from-background pointer-events-none absolute inset-x-0 bottom-0 z-10 h-14 bg-gradient-to-t to-transparent'
          />
        </div>
        <div className='absolute inset-x-6 bottom-6 flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3'>
          <div>
            <p className='text-sm font-medium'>{t('Explore all models')}</p>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              {t('Compare models and find the right API for your workflow')}
            </p>
          </div>
          <Link
            to='/discounts'
            className='text-primary shrink-0 text-sm font-medium hover:underline'
          >
            {t('View models')} →
          </Link>
        </div>
      </div>
    </div>
  )
}
