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

import { formatBillMoney, formatBillPrice } from '../lib/bill'
import type { BillUsage, UserBill } from '../types'

function UsageTable(props: {
  rows: BillUsage[]
  quotaPerUnit: number
  daily: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className='max-h-80 overflow-auto rounded-md border'>
      <table className='w-full text-left text-sm whitespace-nowrap'>
        <thead className='bg-muted sticky top-0'>
          <tr>
            {props.daily && <th className='p-2'>{t('Date')}</th>}
            {[
              t('Model'),
              t('Input tokens'),
              t('Output tokens'),
              t('Total tokens'),
              t('Charges'),
              t('Refunds'),
              t('Net cost'),
              t('Input price (USD/M)'),
              t('Output price (USD/M)'),
              t('Cache read price (USD/M)'),
              t('Cache write price (USD/M)'),
              t('Cache write 5m price (USD/M)'),
              t('Cache write 1h price (USD/M)'),
              t('Requests without historical token prices'),
            ].map((label) => (
              <th key={label} className='p-2'>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={`${row.date}:${row.model}`} className='border-t'>
              {props.daily && <td className='p-2'>{row.date}</td>}
              <td className='max-w-72 truncate p-2' title={row.model}>
                {row.model || t('Unspecified')}
              </td>
              <td className='p-2'>{row.prompt_tokens.toLocaleString()}</td>
              <td className='p-2'>{row.completion_tokens.toLocaleString()}</td>
              <td className='p-2'>
                {(row.prompt_tokens + row.completion_tokens).toLocaleString()}
              </td>
              <td className='p-2'>
                {formatBillMoney(row.charged_quota / props.quotaPerUnit)}
              </td>
              <td className='p-2'>
                {formatBillMoney(row.refunded_quota / props.quotaPerUnit)}
              </td>
              <td className='p-2'>
                {formatBillMoney(row.net_quota / props.quotaPerUnit)}
              </td>
              {[
                'input',
                'output',
                'cache_read',
                'cache_write',
                'cache_write_5m',
                'cache_write_1h',
              ].map((key) => (
                <td key={key} className='p-2'>
                  {formatBillPrice(row.prices?.[key])}
                </td>
              ))}
              <td className='p-2'>{row.unpriced_requests ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {props.rows.length === 0 && (
        <p className='text-muted-foreground p-4'>
          {t('No usage in this period')}
        </p>
      )}
    </div>
  )
}

export function BillDetails(props: { bill: UserBill }) {
  const { t } = useTranslation()
  const bill = props.bill
  const summaries = [
    [
      t('Total tokens'),
      (
        bill.totals.prompt_tokens + bill.totals.completion_tokens
      ).toLocaleString(),
    ],
    [
      t('Net cost'),
      formatBillMoney(bill.totals.net_quota / bill.quota_per_unit),
    ],
    [
      t('Period paid recharge credits'),
      formatBillMoney(bill.period_recharge_units),
    ],
    [
      t('Lifetime paid recharge credits'),
      formatBillMoney(bill.lifetime_recharge_units),
    ],
    [
      t('Period redemption credits'),
      formatBillMoney(bill.period_redemption_quota / bill.quota_per_unit),
    ],
    [
      t('Lifetime redemption credits'),
      formatBillMoney(bill.lifetime_redemption_quota / bill.quota_per_unit),
    ],
    [
      t('Current wallet balance'),
      formatBillMoney(bill.current_quota / bill.quota_per_unit),
    ],
  ]
  return (
    <div className='space-y-4'>
      <p className='text-sm'>
        {bill.username} · {bill.start_date} — {bill.end_date} · {bill.timezone}{' '}
        · USD
      </p>
      <div className='grid gap-3 sm:grid-cols-3'>
        {summaries.map(([label, value]) => (
          <div key={label} className='rounded-md border p-3'>
            <p className='text-muted-foreground text-xs'>{label}</p>
            <p className='mt-1 font-semibold'>{value}</p>
          </div>
        ))}
      </div>
      <p className='text-muted-foreground text-xs'>
        {t(
          'Bills use retained records. Usage includes wallet and subscription charges. Recharge credits exclude subscriptions, gifts and manual adjustments. Balance is current, not period-end.'
        )}
      </p>
      {!bill.consumption_logging && (
        <p role='alert' className='text-destructive text-sm'>
          {t(
            'Consumption logging is disabled; usage records may be incomplete.'
          )}
        </p>
      )}
      <h3 className='font-medium'>{t('Usage by model')}</h3>
      <p className='text-muted-foreground text-xs'>
        {t(
          'Historical USD/M prices include group discounts. Multiple prices show a range. Missing metadata, per-call and dynamic pricing show no token price.'
        )}
      </p>
      <UsageTable
        rows={bill.models}
        quotaPerUnit={bill.quota_per_unit}
        daily={false}
      />
      <h3 className='font-medium'>{t('Daily usage by model')}</h3>
      <UsageTable rows={bill.daily} quotaPerUnit={bill.quota_per_unit} daily />
      <h3 className='font-medium'>{t('Recharge details')}</h3>
      <div className='max-h-64 overflow-auto rounded-md border'>
        <table className='w-full text-left text-sm whitespace-nowrap'>
          <thead className='bg-muted sticky top-0'>
            <tr>
              {[
                t('Date'),
                t('Order'),
                t('Payment method'),
                t('Recharge credits'),
              ].map((label) => (
                <th key={label} className='p-2'>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bill.recharges.map((record) => (
              <tr key={record.id} className='border-t'>
                <td className='p-2'>{record.date}</td>
                <td className='p-2'>{record.trade_no || '—'}</td>
                <td className='p-2'>
                  {record.payment_method === 'redemption'
                    ? t('Redemption code')
                    : record.payment_method}
                </td>
                <td className='p-2'>{formatBillMoney(record.credit_units)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {bill.recharges.length === 0 && (
          <p className='text-muted-foreground p-4'>
            {t('No recharges in this period')}
          </p>
        )}
      </div>
    </div>
  )
}
