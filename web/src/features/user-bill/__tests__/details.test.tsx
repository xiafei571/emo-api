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

import i18next from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { initReactI18next } from 'react-i18next'

import { BillDetails } from '../components/bill-details'
import { billFixture } from './fixtures'

await i18next
  .use(initReactI18next)
  .init({ lng: 'en', resources: {}, fallbackLng: 'en' })

describe('bill details', () => {
  test('populated bill shows daily model tokens, refunds, net cost and current wallet balance', () => {
    const html = renderToStaticMarkup(<BillDetails bill={billFixture} />)
    assert.ok(html.includes('Daily usage by model'))
    assert.ok(html.includes('model-a'))
    assert.ok(html.includes('$0.20'))
    assert.ok(html.includes('$0.80'))
    assert.ok(html.includes('Current wallet balance'))
    assert.ok(html.includes('$2.00'))
    assert.ok(html.includes('Asia/Tokyo'))
    assert.ok(html.includes('order-1'))
    assert.ok(!html.includes('role="alert"'))
  })

  test('empty bill displays usage and recharge empty states and warns when logging is disabled', () => {
    const html = renderToStaticMarkup(
      <BillDetails
        bill={{
          ...billFixture,
          daily: [],
          models: [],
          recharges: [],
          consumption_logging: false,
        }}
      />
    )
    assert.ok(html.includes('No usage in this period'))
    assert.ok(html.includes('No recharges in this period'))
    assert.ok(html.includes('role="alert"'))
    assert.ok(html.includes('usage records may be incomplete'))
  })

  test('model names are escaped and long names retain a full-text title', () => {
    const model = `<script>${'very-long-model'.repeat(30)}`
    const html = renderToStaticMarkup(
      <BillDetails
        bill={{ ...billFixture, daily: [{ ...billFixture.daily[0], model }] }}
      />
    )
    assert.ok(!html.includes('<script>'))
    assert.ok(html.includes('title="&lt;script&gt;'))
  })
})
