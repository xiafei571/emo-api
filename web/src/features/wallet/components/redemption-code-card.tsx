/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { ExternalLink, Gift, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TitledCard } from '@/components/ui/titled-card'

interface RedemptionCodeCardProps {
  enabled: boolean
  code: string
  onCodeChange: (code: string) => void
  onRedeem: () => void
  redeeming: boolean
  topupLink?: string
}

export function RedemptionCodeCard({
  enabled,
  code,
  onCodeChange,
  onRedeem,
  redeeming,
  topupLink,
}: RedemptionCodeCardProps) {
  const { t } = useTranslation()

  return (
    <TitledCard
      title={t('Have a Code?')}
      description={t('Redeem credits with a code')}
      icon={
        <IconBadge tone='warning' size='xs'>
          <Gift />
        </IconBadge>
      }
      iconTone='warning'
      disableHoverEffect
      contentClassName='space-y-3'
    >
      {enabled ? (
        <>
          <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
            <Label htmlFor='redemption-code' className='sr-only'>
              {t('Have a Code?')}
            </Label>
            <Input
              id='redemption-code'
              value={code}
              onChange={(event) => onCodeChange(event.target.value)}
              placeholder={t('Enter your redemption code')}
              className='h-10 min-w-0'
            />
            <Button
              onClick={onRedeem}
              disabled={redeeming}
              variant='outline'
              className='h-10 px-4'
            >
              {redeeming && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {t('Redeem')}
            </Button>
          </div>
          {topupLink && (
            <p className='text-muted-foreground text-xs'>
              {t('Need a redemption code?')}{' '}
              <a
                href={topupLink}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1 underline-offset-4 hover:underline'
              >
                {t('Get one here')}
                <ExternalLink className='h-3 w-3' />
              </a>
            </p>
          )}
        </>
      ) : (
        <Alert>
          <AlertDescription>
            {t(
              'Redemption codes are disabled until the administrator confirms compliance terms.'
            )}
          </AlertDescription>
        </Alert>
      )}
    </TitledCard>
  )
}
