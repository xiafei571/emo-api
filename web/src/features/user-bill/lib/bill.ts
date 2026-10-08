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
import dayjs from 'dayjs'

import type { BillRange, BillUsage, UserBill } from '../types'

export function getBillRange(
  months: number,
  timezone: string,
  now = new Date()
): BillRange {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string): string =>
    parts.find((value) => value.type === type)?.value ?? ''
  const today = `${part('year')}-${part('month')}-${part('day')}`
  const start =
    months === 0
      ? today
      : dayjs(today)
          .subtract(months, 'month')
          .add(1, 'day')
          .format('YYYY-MM-DD')
  return { start, end: today, timezone }
}

export function isValidBillRange(range: BillRange): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(range.start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(range.end)
  ) {
    return false
  }
  if (
    dayjs(range.start).format('YYYY-MM-DD') !== range.start ||
    dayjs(range.end).format('YYYY-MM-DD') !== range.end
  ) {
    return false
  }
  return (
    range.start >= '1970-01-01' &&
    range.end >= range.start &&
    range.end <= dayjs(range.start).add(6, 'month').format('YYYY-MM-DD')
  )
}

export function formatBillMoney(units: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(units)
}

// This observed cost blends all charge components. It is a reference, not an
// inferred input/output/cache tariff; refunds do not change historical rates.
export function getBillBlendedPrice(
  usage: BillUsage,
  quotaPerUnit: number
): number | undefined {
  const tokens = usage.prompt_tokens + usage.completion_tokens
  if (tokens <= 0 || quotaPerUnit <= 0 || usage.charged_quota < 0) {
    return undefined
  }
  const price = (usage.charged_quota / quotaPerUnit / tokens) * 1_000_000
  return Number.isFinite(price) ? price : undefined
}

// Quote every cell and neutralize spreadsheet formulas in user/model/order strings.
export function billToCSV(bill: UserBill): string {
  const rows: (string | number)[][] = [
    ['User ID', bill.user_id],
    ['Username', bill.username],
    ['Start date', bill.start_date],
    ['End date', bill.end_date],
    ['Timezone', bill.timezone],
    ['Generated at (UTC)', new Date(bill.generated_at * 1000).toISOString()],
    ['Currency', 'USD credits'],
    ['Current wallet balance', bill.current_quota / bill.quota_per_unit],
    ['Period paid recharge credits', bill.period_recharge_units],
    ['Lifetime paid recharge credits', bill.lifetime_recharge_units],
    [
      'Period redemption credits',
      bill.period_redemption_quota / bill.quota_per_unit,
    ],
    [
      'Lifetime redemption credits',
      bill.lifetime_redemption_quota / bill.quota_per_unit,
    ],
    ['Input tokens', bill.totals.prompt_tokens],
    ['Output tokens', bill.totals.completion_tokens],
    ['Total tokens', bill.totals.prompt_tokens + bill.totals.completion_tokens],
    ['Charges', bill.totals.charged_quota / bill.quota_per_unit],
    ['Refunds', bill.totals.refunded_quota / bill.quota_per_unit],
    ['Net cost', bill.totals.net_quota / bill.quota_per_unit],
    [
      'Price basis',
      'Historical USD/M rates include effective group discounts. Ranges indicate different rates in the period. Saved dynamic expressions and matched tiers are used when recoverable. Missing input/output rates show a blended reference: charges divided by recorded input plus output tokens, including cache and other fees. This is not a separate input/output tariff and cannot be directly compared with official prices. Refunds are excluded.',
    ],
    [
      'Scope',
      'Retained records only. Usage includes wallet and subscription charges. Recharge credits exclude subscriptions, gifts and manual adjustments. Balance is current, not period-end.',
    ],
    [],
    [
      'Date',
      'Model',
      'Input tokens',
      'Output tokens',
      'Total tokens',
      'Charges (USD)',
      'Refunds (USD)',
      'Net cost (USD)',
      'Input price (USD/M)',
      'Output price (USD/M)',
      'Cache read price (USD/M)',
      'Cache write price (USD/M)',
      'Cache write 5m price (USD/M)',
      'Cache write 1h price (USD/M)',
      'Requests without historical token prices',
      'Blended cost (USD/M)',
    ],
  ]
  for (const usage of bill.daily) {
    const blended = getBillBlendedPrice(usage, bill.quota_per_unit)
    const reference =
      blended === undefined
        ? 'Cannot calculate: no token usage'
        : `Blended reference: ${formatBillPrice({ min: blended, max: blended })}`
    rows.push([
      usage.date,
      usage.model,
      usage.prompt_tokens,
      usage.completion_tokens,
      usage.prompt_tokens + usage.completion_tokens,
      usage.charged_quota / bill.quota_per_unit,
      usage.refunded_quota / bill.quota_per_unit,
      usage.net_quota / bill.quota_per_unit,
      ...[
        'input',
        'output',
        'cache_read',
        'cache_write',
        'cache_write_5m',
        'cache_write_1h',
      ].map((key) => {
        if (usage.prices?.[key]) return formatBillPrice(usage.prices[key])
        return key === 'input' || key === 'output'
          ? reference
          : 'Not separately recorded'
      }),
      usage.unpriced_requests ?? 0,
      blended ?? 'Cannot calculate: no token usage',
    ])
  }
  rows.push([], ['Recharge date', 'Order', 'Payment method', 'Credits (USD)'])
  for (const recharge of bill.recharges) {
    rows.push([
      recharge.date,
      recharge.trade_no,
      recharge.payment_method,
      recharge.credit_units,
    ])
  }
  return `\uFEFF${rows
    .map((row) =>
      row
        .map((value) => {
          let cell = String(value)
          if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(cell)) {
            cell = `'${cell}`
          }
          return `"${cell.replaceAll('"', '""')}"`
        })
        .join(',')
    )
    .join('\r\n')}`
}

export function formatBillPrice(price?: { min: number; max: number }): string {
  if (!price) return '—'
  const format = (value: number): string =>
    new Intl.NumberFormat('en-US', {
      useGrouping: false,
      maximumFractionDigits: 10,
    }).format(value)
  if (price.min === price.max) return format(price.min)
  return `${format(price.min)} ~ ${format(price.max)}`
}
