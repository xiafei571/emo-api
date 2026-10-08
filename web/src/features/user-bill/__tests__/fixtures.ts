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
import type { UserBill } from '../types'

export const billFixture: UserBill = {
  user_id: 7,
  username: 'buyer',
  start_date: '2026-04-01',
  end_date: '2026-09-30',
  timezone: 'Asia/Tokyo',
  generated_at: 1790780400,
  quota_per_unit: 500000,
  current_quota: 1000000,
  lifetime_used_quota: 300000,
  period_recharge_units: 10,
  lifetime_recharge_units: 20,
  period_redemption_quota: 500000,
  lifetime_redemption_quota: 1000000,
  consumption_logging: true,
  totals: {
    date: '',
    model: '',
    prompt_tokens: 100,
    completion_tokens: 20,
    charged_quota: 500000,
    refunded_quota: 100000,
    net_quota: 400000,
  },
  daily: [
    {
      date: '2026-04-01',
      model: 'model-a',
      prompt_tokens: 100,
      completion_tokens: 20,
      charged_quota: 500000,
      refunded_quota: 100000,
      net_quota: 400000,
    },
  ],
  models: [
    {
      date: '',
      model: 'model-a',
      prompt_tokens: 100,
      completion_tokens: 20,
      charged_quota: 500000,
      refunded_quota: 100000,
      net_quota: 400000,
    },
  ],
  recharges: [
    {
      id: 'topup:1',
      date: '2026-04-01 12:00:00',
      trade_no: 'order-1',
      payment_method: 'alipay',
      credit_units: 10,
    },
  ],
}
