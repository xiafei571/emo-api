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
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

import { billToCSV, getBillRange, isValidBillRange } from '../lib/bill'
import type { BillRange, UserBill } from '../types'
import { BillDetails } from './bill-details'

export function UserBillDialog(props: {
  userId: number
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [range, setRange] = useState<BillRange>(() =>
    getBillRange(
      6,
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
    )
  )
  const [applied, setApplied] = useState(range)
  const valid = isValidBillRange(range)
  const query = useQuery({
    queryKey: ['user-bill', props.userId, applied],
    staleTime: 0,
    queryFn: async ({ signal }): Promise<UserBill> => {
      const path = `/api/user/${props.userId}/bill`
      const response = await api.get<{
        success: boolean
        message?: string
        data: UserBill
      }>(path, {
        signal,
        params: {
          start_date: applied.start,
          end_date: applied.end,
          timezone: applied.timezone,
        },
      })
      if (!response.data.success) {
        throw new Error(response.data.message || t('Failed to load bill'))
      }
      return response.data.data
    },
  })
  const exportBill = (): void => {
    if (!query.data) return
    const url = URL.createObjectURL(
      new Blob([billToCSV(query.data)], { type: 'text/csv;charset=utf-8' })
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `bill-${query.data.user_id}-${query.data.start_date}-${query.data.end_date}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Dialog
      open
      onOpenChange={props.onOpenChange}
      title={t('Detailed bill')}
      description={t(
        'Daily model usage and recharge credits, up to six months. All amounts are USD credits.'
      )}
      contentClassName='sm:max-w-5xl'
      bodyClassName='space-y-4'
      footer={
        <Button
          onClick={exportBill}
          disabled={!query.data || query.isFetching || query.isError}
        >
          {t('Export CSV')}
        </Button>
      }
    >
      <div className='flex flex-wrap gap-2'>
        {[
          { months: 0, label: t('Today') },
          { months: 1, label: t('Last month') },
          { months: 3, label: t('Last three months') },
          { months: 6, label: t('Last six months') },
        ].map((preset) => (
          <Button
            key={preset.months}
            variant='outline'
            size='sm'
            onClick={() => {
              const next = getBillRange(preset.months, range.timezone)
              setRange(next)
              setApplied(next)
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <form
        className='flex flex-wrap items-end gap-3'
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) {
            setApplied({ ...range })
            if (
              range.start === applied.start &&
              range.end === applied.end &&
              range.timezone === applied.timezone
            ) {
              void query.refetch()
            }
          }
        }}
      >
        <div className='space-y-1'>
          <Label htmlFor='bill-start'>{t('Start date')}</Label>
          <Input
            id='bill-start'
            type='date'
            value={range.start}
            onChange={(event) =>
              setRange({ ...range, start: event.target.value })
            }
          />
        </div>
        <div className='space-y-1'>
          <Label htmlFor='bill-end'>{t('End date')}</Label>
          <Input
            id='bill-end'
            type='date'
            value={range.end}
            onChange={(event) =>
              setRange({ ...range, end: event.target.value })
            }
          />
        </div>
        <div className='space-y-1'>
          <Label htmlFor='bill-timezone'>{t('Timezone')}</Label>
          <select
            id='bill-timezone'
            className='bg-background h-9 rounded-md border px-2 text-sm'
            value={range.timezone}
            onChange={(event) =>
              setRange({ ...range, timezone: event.target.value })
            }
          >
            {[
              ...new Set([
                Intl.DateTimeFormat().resolvedOptions().timeZone ||
                  'Asia/Shanghai',
                'Asia/Shanghai',
                'Asia/Tokyo',
                'UTC',
              ]),
            ].map((timezone) => (
              <option key={timezone}>{timezone}</option>
            ))}
          </select>
        </div>
        <Button type='submit' disabled={!valid || query.isFetching}>
          {t('Generate bill')}
        </Button>
      </form>
      {!valid && (
        <p role='alert' className='text-destructive text-sm'>
          {t('Select valid dates within six months')}
        </p>
      )}
      {query.isFetching && <p role='status'>{t('Loading...')}</p>}
      {query.isError && (
        <div role='alert'>
          <p>{t('Failed to load bill')}</p>
          <Button variant='outline' onClick={() => void query.refetch()}>
            {t('Retry')}
          </Button>
        </div>
      )}
      {query.data && !query.isError && !query.isFetching && (
        <BillDetails bill={query.data} />
      )}
    </Dialog>
  )
}
