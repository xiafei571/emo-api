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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Database, HardDrive, Link2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PanelWrapper } from '@/features/dashboard/components/ui/panel-wrapper'
import { toIntlLocale } from '@/i18n/languages'

import { getTraceArchiveStats } from '../api'

const QUERY_KEY = ['system-info', 'trace-archive'] as const

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return bytes === 0 ? '0 B' : '-'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(bytes / 1024 ** index)} ${units[index]}`
}

export function TraceArchivePanel() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getTraceArchiveStats(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  const refresh = async () => {
    setRefreshing(true)
    try {
      const next = await getTraceArchiveStats(true)
      queryClient.setQueryData(QUERY_KEY, next)
    } catch {
      toast.error(t('Failed to refresh trace archive statistics'))
    } finally {
      setRefreshing(false)
    }
  }

  if (query.isLoading) {
    return (
      <PanelWrapper
        title={t('Trace Archive')}
        description={t('Uploaded raw LLM API interaction traces')}
      >
        <Skeleton className='h-48 w-full' />
      </PanelWrapper>
    )
  }
  if (query.isError || !query.data?.success) {
    return (
      <PanelWrapper title={t('Trace Archive')}>
        <ErrorState
          className='min-h-48'
          description={
            query.data?.message || t('Unable to load trace archive statistics')
          }
          onRetry={() => void query.refetch()}
        />
      </PanelWrapper>
    )
  }

  const data = query.data.data
  if (!data?.enabled || !data.inventory) {
    return (
      <PanelWrapper
        title={t('Trace Archive')}
        empty
        height='h-28'
        emptyMessage={t('Trace archiving is disabled')}
      />
    )
  }

  const inventory = data.inventory
  const process = data.process
  const coverage = inventory.objects
    ? (inventory.known_session_objects / inventory.objects) * 100
    : 0
  const cards = [
    {
      label: t('Uploaded traces'),
      value: new Intl.NumberFormat().format(inventory.objects),
      detail: t('One file per LLM API exchange'),
      icon: Archive,
    },
    {
      label: t('Compressed storage'),
      value: formatBytes(inventory.compressed_bytes),
      detail: t('Current S3 object size'),
      icon: HardDrive,
    },
    {
      label: t('Known sessions'),
      value: new Intl.NumberFormat().format(inventory.unique_known_sessions),
      detail: `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(coverage)}% ${t('request coverage')}`,
      icon: Link2,
    },
    {
      label: t('Users captured'),
      value: new Intl.NumberFormat().format(inventory.unique_users),
      detail: `${new Intl.NumberFormat().format(inventory.unknown_session_objects)} ${t('unknown-session traces')}`,
      icon: Database,
    },
  ]

  return (
    <PanelWrapper
      title={t('Trace Archive')}
      description={t('Uploaded raw LLM API interaction traces')}
      headerActions={
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? 'animate-spin' : ''} />
          {t('Refresh S3')}
        </Button>
      }
    >
      <div className='space-y-4'>
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <Card key={card.label} size='sm'>
                <CardContent className='flex items-start gap-3'>
                  <div className='bg-primary/10 text-primary rounded-lg p-2'>
                    <Icon className='size-4' />
                  </div>
                  <div className='min-w-0'>
                    <div className='text-muted-foreground text-xs'>
                      {card.label}
                    </div>
                    <div className='mt-0.5 text-xl font-semibold tabular-nums'>
                      {card.value}
                    </div>
                    <div className='text-muted-foreground mt-1 truncate text-xs'>
                      {card.detail}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className='overflow-x-auto rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow className='bg-muted/40 hover:bg-muted/40'>
                <TableHead>{t('Date')}</TableHead>
                <TableHead className='text-right'>
                  {t('Uploaded traces')}
                </TableHead>
                <TableHead className='text-right'>
                  {t('Compressed storage')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.daily.map((day) => (
                <TableRow key={day.date}>
                  <TableCell className='font-mono'>{day.date}</TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>
                    {new Intl.NumberFormat().format(day.objects)}
                  </TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>
                    {formatBytes(day.compressed_bytes)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className='text-muted-foreground flex flex-wrap justify-between gap-2 text-xs'>
          <span>
            {t('S3 inventory updated')}:{' '}
            {new Intl.DateTimeFormat(toIntlLocale(i18n.language), {
              dateStyle: 'medium',
              timeStyle: 'medium',
            }).format(new Date(inventory.calculated_at))}
          </span>
          <span>
            {t('Current process')}:{' '}
            {new Intl.NumberFormat().format(process?.uploaded ?? 0)}{' '}
            {t('uploaded')}
            {' · '}
            {new Intl.NumberFormat().format(process?.failures ?? 0)}{' '}
            {t('failures')}
            {' · '}
            {formatBytes(process?.spool_bytes ?? 0)} {t('spooled')}
          </span>
        </div>
      </div>
    </PanelWrapper>
  )
}
