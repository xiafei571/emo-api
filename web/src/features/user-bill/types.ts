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
export interface BillUsage {
  date: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  charged_quota: number
  refunded_quota: number
  net_quota: number
}

export interface BillRecharge {
  id: string
  date: string
  trade_no: string
  payment_method: string
  credit_units: number
}

export interface UserBill {
  user_id: number
  username: string
  start_date: string
  end_date: string
  timezone: string
  generated_at: number
  quota_per_unit: number
  current_quota: number
  lifetime_used_quota: number
  period_recharge_units: number
  lifetime_recharge_units: number
  period_redemption_quota: number
  lifetime_redemption_quota: number
  consumption_logging: boolean
  totals: BillUsage
  daily: BillUsage[]
  models: BillUsage[]
  recharges: BillRecharge[]
}

export interface BillRange {
  start: string
  end: string
  timezone: string
}
