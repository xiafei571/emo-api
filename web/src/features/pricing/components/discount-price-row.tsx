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
  description?: string
}) {
  const { t } = useTranslation()
  const pricing = getDiscountPricing(props.model, props.ratio)
  const schedule = pricing.timeSchedule
  const isRequest = props.model.quota_type === 1 && !pricing.dynamic
  const description = props.description?.trim()
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
      {description && description !== '-' && (
        <p className='text-muted-foreground mt-2 whitespace-pre-line break-words text-[10px] leading-relaxed'>
          {description}
        </p>
      )}
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
