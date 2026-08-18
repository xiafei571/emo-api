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
import { Link } from '@tanstack/react-router'
import { BookOpen, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'

import { useApiKeys } from './api-keys-provider'

export function ApiKeysPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen } = useApiKeys()
  const apiBaseUrl = window.location.origin

  return (
    <div className='flex flex-wrap items-center justify-end gap-2'>
      <div className='bg-muted/30 flex max-w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-1.5'>
        <span className='text-muted-foreground shrink-0 text-xs font-medium'>
          {t('API Base URL')}
        </span>
        <span className='bg-border h-4 w-px shrink-0' />
        <code className='min-w-0 truncate font-mono text-sm' title={apiBaseUrl}>
          {apiBaseUrl}
        </code>
        <CopyButton
          value={apiBaseUrl}
          size='icon'
          className='size-7'
          tooltip={t('Copy API Base URL')}
          successTooltip={t('Copied!')}
        />
      </div>
      <Button
        size='sm'
        className='border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100 dark:hover:bg-amber-900/70'
        render={<Link to='/guide' />}
      >
        <BookOpen className='h-4 w-4' />
        {t('apiGuide.button')}
      </Button>
      <Button size='sm' onClick={() => setOpen('create')}>
        <Plus className='h-4 w-4' />
        {t('Create API Key')}
      </Button>
    </div>
  )
}
