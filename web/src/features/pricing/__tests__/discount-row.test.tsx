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
import assert from 'node:assert/strict'
import { test } from 'node:test'

import i18next from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { initReactI18next } from 'react-i18next'

import { DiscountPriceRow } from '../components/discount-price-row'
import type { PricingModel } from '../types'

await i18next
  .use(initReactI18next)
  .init({ lng: 'en', resources: {}, fallbackLng: 'en' })
const model: PricingModel = {
  id: 1,
  model_name: 'deepseek-v4-flash',
  quota_type: 0,
  model_ratio: 0.5,
  completion_ratio: 2,
  enable_groups: ['Deepseek'],
  billing_mode: 'tiered_expr',
  billing_expr:
    '(weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") <= 5 && ((hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12) || (hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18))) ? tier("peak", p * 3 + c * 9 + cr * 0.10) : tier("off_peak", p * 1.5 + c * 4.5 + cr * 0.05)',
}

test('dynamic group rows display discounted ranges and disclose peak schedule without tier controls', () => {
  const html = renderToStaticMarkup(
    <DiscountPriceRow
      model={model}
      group='Deepseek'
      ratio={0.1}
      description='Group description & details'
    />
  )
  assert.ok(html.includes('$0.15–$0.3'))
  assert.ok(html.includes('$0.45–$0.9'))
  assert.ok(html.includes('Deepseek'))
  assert.ok(html.includes('Group description &amp; details'))
  assert.ok(
    html.indexOf('Group description &amp; details') <
      html.indexOf('Dynamic pricing')
  )
  assert.ok(html.includes('Monday–Friday'))
  assert.ok(html.includes('09:00–12:00, 14:00–18:00'))
  assert.ok(html.includes('Asia/Shanghai'))
  assert.ok(!html.includes('line-through'))
})
test('unsupported expressions show request-dependent pricing without quoting stale fixed rates', () => {
  const html = renderToStaticMarkup(
    <DiscountPriceRow
      model={{
        ...model,
        billing_expr: 'tier("base", p * 3)|||when(header("fast") == "1") * 6',
      }}
      group='Deepseek'
      ratio={0.1}
    />
  )
  assert.ok(html.includes('Request-dependent'))
  assert.ok(html.includes('check the billing details before use'))
  assert.ok(!html.includes('$0.1'))
})
