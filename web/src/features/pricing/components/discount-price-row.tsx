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
import { useTranslation } from 'react-i18next'

import { formatCatalogRate, getDiscountPricing } from '../lib/discount-price'
import type { PricingModel } from '../types'

const columns = ['input', 'output', 'cache', 'create_cache']
const labels: Record<string, string> = {
  input: 'Input',
  output: 'Output',
  cache: 'Cache read',
  create_cache: 'Cache write',
  cache_write_1h: 'Cache write (1h)',
  image: 'Image input',
  image_output: 'Image output',
  audio_input: 'Audio input',
  audio_output: 'Audio output',
}
const tierLabels: Record<string, string> = {
  peak: 'Peak',
  off_peak: 'Off-peak',
  base: 'Base',
  standard: 'Standard',
  long_context: 'Long context',
}
const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export function DiscountPriceRow(props: {
  model: PricingModel
  group: string
  ratio: number
}) {
  const { t } = useTranslation()
  const pricing = getDiscountPricing(props.model, props.ratio)
  const schedule = pricing.timeSchedule
  const isRequest = props.model.quota_type === 1 && !pricing.dynamic
  return (
    <div className='border-t px-3 py-2 first:border-t-0'>
      <div className='grid min-w-[460px] grid-cols-[minmax(104px,0.9fr)_repeat(4,minmax(86px,1fr))] items-start gap-1'>
        <div className='min-w-0'>
          <div
            className='truncate font-mono text-[11px] font-semibold'
            title={props.group}
          >
            {props.group}
          </div>
          <div className='text-primary mt-1 text-[9px]'>
            {t('{{percent}}% of billing base', {
              percent: Number((props.ratio * 100).toFixed(2)),
            })}
          </div>
        </div>
        {columns.map((key) => {
          const rate = pricing.rates[key]
          let value = t('Not separately priced')
          if (pricing.unsupported) value = t('Request-dependent')
          else if (isRequest && key !== 'input') value = t('Not applicable')
          else if (rate) value = formatCatalogRate(rate)
          return (
            <div
              key={key}
              className='text-primary text-right font-mono text-[11px] font-bold'
            >
              {value}
            </div>
          )
        })}
      </div>
      {pricing.dynamic && (
        <div className='text-muted-foreground mt-2 text-[10px]'>
          {t('Dynamic pricing · range includes all configured tiers')}
        </div>
      )}
      {schedule && (
        <p className='text-muted-foreground mt-1 max-w-lg text-[10px] leading-relaxed'>
          {t(
            'Peak hours: {{days}}, {{hours}} ({{timezone}}); all other times use off-peak prices.',
            {
              days: `${t(weekdays[schedule.weekdayStart])}–${t(weekdays[schedule.weekdayEnd])}`,
              hours: schedule.windows
                .map(
                  ([start, end]) =>
                    `${String(start).padStart(2, '0')}:00–${String(end).padStart(2, '0')}:00`
                )
                .join(', '),
              timezone: schedule.timezone,
              interpolation: { escapeValue: false },
            }
          )}
        </p>
      )}
      {pricing.unsupported && (
        <p className='text-muted-foreground mt-2 text-[10px]'>
          {t(
            'This model uses request-dependent billing. A fixed token price cannot be quoted; check the billing details before use.'
          )}
        </p>
      )}
      {pricing.tiers.length > 0 && (
        <details className='mt-2 text-[10px]'>
          <summary className='cursor-pointer font-medium'>
            {t('Pricing tiers and conditions')}
          </summary>
          <div className='mt-2 space-y-2'>
            {pricing.tiers.map((tier) => (
              <div key={tier.label} className='bg-muted/30 rounded-md p-2'>
                <div className='font-medium'>
                  {t(tierLabels[tier.label] ?? tier.label)}
                </div>
                {tier.conditions.length > 0 && (
                  <div className='text-muted-foreground'>
                    {tier.conditions
                      .map(
                        (condition) =>
                          `${t(condition.var === 'c' ? 'Output tokens' : 'Input context tokens')} ${condition.op} ${condition.value.toLocaleString()}`
                      )
                      .join(' · ')}
                  </div>
                )}
                {!schedule &&
                  pricing.tiers.length > 1 &&
                  tier.conditions.length === 0 && (
                    <div className='text-muted-foreground'>
                      {t(
                        'Applies when the preceding tier conditions do not match'
                      )}
                    </div>
                  )}
                <div className='mt-1 flex flex-wrap gap-x-3 gap-y-1'>
                  {Object.entries(tier.rates).map(([key, rate]) => (
                    <span key={key}>
                      {t(labels[key] ?? key)}:{' '}
                      <strong className='font-mono'>
                        {formatCatalogRate(rate)}
                      </strong>
                      /M
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      {!pricing.dynamic && pricing.rates.cache_write_1h && (
        <p className='text-muted-foreground mt-2 text-[10px]'>
          {t('Cache write (1h)')}:{' '}
          <strong className='font-mono'>
            {formatCatalogRate(pricing.rates.cache_write_1h)}
          </strong>
          /M
        </p>
      )}
    </div>
  )
}
