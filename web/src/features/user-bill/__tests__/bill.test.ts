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

import {
  billToCSV,
  formatBillMoney,
  getBillBlendedPrice,
  getBillRange,
  isValidBillRange,
} from '../lib/bill'
import { billFixture } from './fixtures'

describe('bill periods and export', () => {
  test('six-month preset includes today in the selected timezone', () => {
    const now = new Date('2026-10-07T16:00:00Z')
    assert.deepEqual(getBillRange(6, 'Asia/Tokyo', now), {
      start: '2026-04-09',
      end: '2026-10-08',
      timezone: 'Asia/Tokyo',
    })
    assert.equal(getBillRange(0, 'UTC', now).end, '2026-10-07')
    assert.ok(isValidBillRange(getBillRange(6, 'Asia/Tokyo', now)))
  })

  test('invalid, reversed and oversized periods cannot be submitted', () => {
    for (const [start, end] of [
      ['', '2026-10-08'],
      ['2026-02-30', '2026-03-01'],
      ['2026-10-08', '2026-10-07'],
      ['2026-01-01', '2026-10-08'],
    ]) {
      assert.equal(isValidBillRange({ start, end, timezone: 'UTC' }), false)
    }
    assert.ok(
      isValidBillRange({
        start: '2026-04-01',
        end: '2026-09-30',
        timezone: 'UTC',
      })
    )
  })

  test('export contains daily actual costs, refunds, recharge totals and current balance', () => {
    const csv = billToCSV(billFixture)
    assert.ok(csv.startsWith('\uFEFF'))
    assert.ok(csv.includes('"Current wallet balance","2"'))
    assert.ok(csv.includes('"Lifetime paid recharge credits","20"'))
    assert.ok(
      csv.includes('"2026-04-01","model-a","100","20","120","1","0.2","0.8"')
    )
    assert.ok(csv.includes('"2026-04-01 12:00:00","order-1","alipay","10"'))
    assert.ok(
      csv.includes('retained records') || csv.includes('Retained records')
    )
    assert.equal(formatBillMoney(0.000002), '$0.000002')
  })

  test('export quotes commas, quotes and newlines and neutralizes formula cells', () => {
    const csv = billToCSV({
      ...billFixture,
      username: '=HYPERLINK("bad")',
      daily: [{ ...billFixture.daily[0], model: ' @SUM(1,2)\n"model"' }],
    })
    assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'))
    assert.ok(csv.includes('"\' @SUM(1,2)\n""model"""'))
  })
})

test('export includes historical per-million rates and changed-price ranges without inferring missing rates', () => {
  const csv = billToCSV({
    ...billFixture,
    daily: [
      {
        ...billFixture.daily[0],
        prices: {
          input: { min: 0.6, max: 1.5 },
          output: { min: 3, max: 7.5 },
          cache_read: { min: 0.15, max: 0.15 },
        },
        unpriced_requests: 2,
      },
    ],
  })
  assert.ok(csv.includes('"Input price (USD/M)"'))
  assert.ok(
    csv.includes(
      '"0.6 ~ 1.5","3 ~ 7.5","0.15","Not separately recorded","Not separately recorded","Not separately recorded","2"'
    )
  )
})

test('missing rates export a labeled blended reference based on charges rather than net cost', () => {
  const csv = billToCSV(billFixture)
  assert.ok(csv.includes('"Blended cost (USD/M)"'))
  assert.ok(csv.includes('"Blended reference: 8333.3333333333"'))
  assert.ok(!csv.includes('"—"'))
  assert.equal(getBillBlendedPrice(billFixture.daily[0], 500000), 1e6 / 120)
  assert.equal(
    getBillBlendedPrice({ ...billFixture.daily[0], charged_quota: 0 }, 500000),
    0
  )
  assert.equal(
    getBillBlendedPrice(
      { ...billFixture.daily[0], prompt_tokens: 0, completion_tokens: 0 },
      500000
    ),
    undefined
  )
  assert.equal(getBillBlendedPrice(billFixture.daily[0], 0), undefined)
})
