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
import { describe, test } from 'node:test'

import { getDiscountPricing } from '../lib/discount-price'
import type { PricingModel } from '../types'

const model: PricingModel = {
  id: 1,
  model_name: 'deepseek-v4-flash',
  quota_type: 0,
  model_ratio: 0.5,
  completion_ratio: 2,
  cache_ratio: 0.02,
  enable_groups: ['Deepseek'],
  billing_mode: 'tiered_expr',
  billing_expr:
    '(weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") <= 5 && ((hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12) || (hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18))) ? tier("peak", p * 3 + c * 9 + cr * 0.10) : tier("off_peak", p * 1.5 + c * 4.5 + cr * 0.05)',
}

describe('discount catalog follows settlement configuration', () => {
  test('DeepSeek uses all dynamic tiers times the selected group, ignoring stale ratios', () => {
    const pricing = getDiscountPricing(model, 0.1)
    assert.ok(Math.abs(pricing.rates.input.min - 0.15) < 1e-10)
    assert.ok(Math.abs(pricing.rates.input.max - 0.3) < 1e-10)
    assert.ok(Math.abs(pricing.rates.output.min - 0.45) < 1e-10)
    assert.ok(Math.abs(pricing.rates.output.max - 0.9) < 1e-10)
    assert.ok(Math.abs(pricing.rates.cache.min - 0.005) < 1e-10)
    assert.ok(Math.abs(pricing.rates.cache.max - 0.01) < 1e-10)
    assert.deepEqual(
      pricing.tiers.map((tier) => tier.label),
      ['peak', 'off_peak']
    )
    assert.deepEqual(pricing.timeSchedule, {
      timezone: 'Asia/Shanghai',
      weekdayStart: 1,
      weekdayEnd: 5,
      windows: [
        [9, 12],
        [14, 18],
      ],
    })
  })
  test('Astra uses its dynamic base and cache write instead of legacy model ratios', () => {
    const pricing = getDiscountPricing(
      {
        ...model,
        model_name: 'gpt-6-astra',
        model_ratio: 37.5,
        billing_expr: 'tier("base", p * 10 + c * 50 + cr * 1 + cc * 12.5)',
      },
      0.1
    )
    assert.deepEqual(pricing.rates.input, { min: 1, max: 1 })
    assert.deepEqual(pricing.rates.output, { min: 5, max: 5 })
    assert.deepEqual(pricing.rates.create_cache, { min: 1.25, max: 1.25 })
  })
  test('request multipliers and unsupported nonlinear expressions never fall back to misleading fixed rates', () => {
    for (const expr of [
      'tier("base", p * 10) * 2',
      'len > 10 ? tier("base", p * 10) : 12',
      'tier("base", p * 10 + max(c, 100) * 5)',
      'tier("base", p * 10)|||when(header("fast") == "1") * 6',
      '',
    ]) {
      const pricing = getDiscountPricing({ ...model, billing_expr: expr }, 0.1)
      assert.equal(pricing.unsupported, true)
      assert.deepEqual(pricing.rates, {})
    }
  })
  test('fixed pricing preserves explicit free rates and request prices', () => {
    assert.deepEqual(
      getDiscountPricing(
        { ...model, billing_mode: undefined, create_cache_ratio: 1.25 },
        0
      ).rates.input,
      { min: 0, max: 0 }
    )
    assert.deepEqual(
      getDiscountPricing(
        { ...model, billing_mode: undefined, quota_type: 1, model_price: 2 },
        0.3
      ).rates.input,
      { min: 0.6, max: 0.6 }
    )
  })
})
