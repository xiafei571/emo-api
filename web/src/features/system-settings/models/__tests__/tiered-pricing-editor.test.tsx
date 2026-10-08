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

import { TieredPricingEditor } from '../tiered-pricing-editor'

await i18next
  .use(initReactI18next)
  .init({ lng: 'en', resources: {}, fallbackLng: 'en' })

test('time-dependent billing opens with the saved expression instead of a zero-price visual draft', () => {
  const expression =
    '(hour("Asia/Shanghai") >= 9) ? tier("peak", p * 3 + c * 9) : tier("off_peak", p * 1.5 + c * 4.5)'
  const html = renderToStaticMarkup(
    <TieredPricingEditor
      modelName='deepseek-v4-flash'
      billingExpr={expression}
      requestRuleExpr=''
      onBillingExprChange={() => {}}
      onRequestRuleExprChange={() => {}}
    />
  )
  assert.ok(html.includes('p * 3 + c * 9'))
  assert.ok(html.includes('p * 1.5 + c * 4.5'))
  assert.ok(!html.includes('p * 0 + c * 0'))
})
