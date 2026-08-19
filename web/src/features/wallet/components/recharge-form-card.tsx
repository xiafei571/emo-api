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
import {
  Gift,
  ExternalLink,
  Loader2,
  Receipt,
  Sparkles,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import { getDiscountLabel } from '../lib'
import type { PresetAmount, TopupInfo, CreemProduct } from '../types'
import { CreemProductsSection } from './creem-products-section'

interface RechargeFormCardProps {
  topupInfo: TopupInfo | null
  presetAmounts: PresetAmount[]
  selectedPreset: number | null
  onSelectPreset: (preset: PresetAmount) => void
  topupAmount: number
  paymentAmount: number
  topupRatio: number
  currentBalanceCredits: number
  onTopupAmountChange: (amount: number) => void
  currencyUnit: string
  onRecharge: () => void
  rechargeDisabled: boolean
  rechargeLoading: boolean
  redemptionCode: string
  onRedemptionCodeChange: (code: string) => void
  onRedeem: () => void
  redeeming: boolean
  topupLink?: string
  loading?: boolean
  onOpenBilling?: () => void
  creemProducts?: CreemProduct[]
  enableCreemTopup?: boolean
  onCreemProductSelect?: (product: CreemProduct) => void
}

export function RechargeFormCard({
  topupInfo,
  presetAmounts,
  selectedPreset,
  onSelectPreset,
  topupAmount,
  paymentAmount,
  topupRatio,
  currentBalanceCredits,
  currencyUnit,
  onRecharge,
  rechargeDisabled,
  rechargeLoading,
  redemptionCode,
  onRedemptionCodeChange,
  onRedeem,
  redeeming,
  topupLink,
  loading,
  onOpenBilling,
  creemProducts,
  enableCreemTopup,
  onCreemProductSelect,
}: RechargeFormCardProps) {
  const { t } = useTranslation()
  const hasConfigurableTopup =
    topupInfo?.enable_stripe_topup ||
    topupInfo?.enable_waffo_topup ||
    topupInfo?.enable_waffo_pancake_topup
  const hasAnyTopup = hasConfigurableTopup || enableCreemTopup
  const redemptionEnabled = topupInfo?.enable_redemption !== false

  if (loading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardHeader className='border-b p-3 !pb-3 sm:p-5 sm:!pb-5'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-4 p-3 sm:space-y-6 sm:p-5'>
          <div className='space-y-4 sm:space-y-6'>
            {/* Preset Amounts Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-16' />
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                {Array.from({ length: 8 }, (_, index) => `preset-${index}`).map(
                  (key) => (
                    <Skeleton key={key} className='h-[72px] rounded-lg' />
                  )
                )}
              </div>
            </div>

            <Skeleton className='ml-auto h-10 w-28 rounded-lg' />
          </div>

          {/* Redemption Code Section Skeleton */}
          <div className='space-y-3 border-t pt-8'>
            <Skeleton className='h-3 w-24' />
            <div className='flex gap-2'>
              <Skeleton className='h-10 flex-1' />
              <Skeleton className='h-10 w-20' />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TitledCard
      title={t('Add Funds')}
      description={t('Choose an amount and payment method')}
      icon={<WalletCards className='h-4 w-4' />}
      iconTone='success'
      disableHoverEffect
      action={
        onOpenBilling ? (
          <Button
            variant='outline'
            size='sm'
            onClick={onOpenBilling}
            className='w-full gap-2 sm:w-auto'
          >
            <Receipt className='h-4 w-4' />
            {t('Order History')}
          </Button>
        ) : null
      }
      contentClassName='space-y-4 sm:space-y-6'
    >
      {/* Online Topup Section */}
      {hasAnyTopup ? (
        <div className='space-y-4 sm:space-y-6'>
          {hasConfigurableTopup && (
            <>
              <div className='bg-muted/30 flex items-center justify-between rounded-lg border px-4 py-3'>
                <div className='flex items-center gap-2'>
                  <Sparkles className='h-4 w-4 text-amber-500' />
                  <span className='text-muted-foreground text-sm'>
                    {t('Current balance')}
                  </span>
                </div>
                <div className='text-foreground font-mono text-sm font-semibold tabular-nums'>
                  {formatNumber(currentBalanceCredits)}{' '}
                  <span className='text-muted-foreground font-sans text-xs font-normal'>
                    {t('credits')}
                  </span>
                </div>
              </div>

              {presetAmounts.length > 0 && (
                <div className='space-y-2.5 sm:space-y-3'>
                  <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                    {t('Select package')}
                  </Label>
                  <div className='grid gap-2'>
                    {presetAmounts.map((preset) => {
                      const discount =
                        preset.discount ||
                        topupInfo?.discount?.[preset.value] ||
                        1.0
                      const hasDiscount = discount > 0 && discount < 1
                      const creditedAmount = Math.round(
                        preset.value * topupRatio
                      )
                      const hasBonus = topupRatio > 1
                      return (
                        <Button
                          key={preset.value}
                          variant='outline'
                          className={cn(
                            'relative flex min-h-[68px] items-center justify-between rounded-md px-4 py-2.5 text-left whitespace-normal transition-all sm:min-h-[76px] sm:px-5 sm:py-3',
                            selectedPreset === preset.value
                              ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                              : 'border-muted hover:border-primary/40 hover:bg-muted/30'
                          )}
                          onClick={() => onSelectPreset(preset)}
                        >
                          <div className='flex min-w-0 items-center gap-3'>
                            <span
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                                selectedPreset === preset.value
                                  ? 'border-foreground'
                                  : 'border-muted-foreground/40'
                              )}
                            >
                              {selectedPreset === preset.value && (
                                <span className='bg-foreground h-2 w-2 rounded-full' />
                              )}
                            </span>
                            <div className='flex min-w-0 items-center gap-2'>
                              <span className='text-sm font-medium sm:text-base'>
                                {formatNumber(preset.value)} {t('credits')}
                              </span>
                              {hasDiscount && (
                                <span className='rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400'>
                                  {getDiscountLabel(discount)}
                                </span>
                              )}
                              {hasBonus && (
                                <span className='text-xs font-medium text-emerald-600 dark:text-emerald-400'>
                                  +{formatNumber(creditedAmount - preset.value)}{' '}
                                  {t('bonus')}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className='ml-3 shrink-0 text-sm font-semibold sm:text-base'>
                            {formatNumber(preset.value)} {currencyUnit}
                          </span>
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className='flex flex-col items-end gap-3'>
                <div className='bg-muted/30 w-full max-w-md space-y-2 rounded-md border px-3 py-2.5'>
                  <div className='flex items-center justify-between gap-3'>
                    <span className='text-muted-foreground'>{t('Pay')}</span>
                    <span className='text-sm font-semibold'>
                      {formatNumber(paymentAmount || topupAmount)}{' '}
                      {currencyUnit}
                    </span>
                  </div>
                  {topupRatio > 1 && (
                    <div className='flex items-center justify-between gap-3'>
                      <span className='text-muted-foreground'>
                        {t('Bonus credits')}
                      </span>
                      <span className='text-xs font-medium text-emerald-600 dark:text-emerald-400'>
                        +
                        {formatNumber(
                          Math.round(topupAmount * (topupRatio - 1))
                        )}{' '}
                        {t('credits')}
                      </span>
                    </div>
                  )}
                  <div className='flex items-center justify-between gap-3 border-t pt-2'>
                    <span className='text-muted-foreground text-xs'>
                      {t('Credits added')}
                    </span>
                    <span className='text-base font-bold'>
                      {formatNumber(Math.round(topupAmount * topupRatio))}{' '}
                      {t('credits')}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={onRecharge}
                  disabled={rechargeDisabled || rechargeLoading}
                  className='min-w-28'
                >
                  {rechargeLoading && (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  )}
                  {t('Continue to payment')}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <Alert>
          <AlertDescription>
            {t(
              'Online topup is not enabled. Please use redemption code or contact administrator.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Creem Products Section */}
      {enableCreemTopup &&
        Array.isArray(creemProducts) &&
        creemProducts.length > 0 &&
        onCreemProductSelect && (
          <div className='space-y-2.5 border-t pt-4 sm:space-y-3 sm:pt-6'>
            <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {t('Creem Payment')}
            </Label>
            <CreemProductsSection
              products={creemProducts}
              onProductSelect={onCreemProductSelect}
            />
          </div>
        )}

      {/* Redemption Code Section */}
      {redemptionEnabled ? (
        <div className='space-y-2.5 border-t pt-4 sm:space-y-3 sm:pt-6'>
          <div className='flex items-center gap-2'>
            <IconBadge tone='warning' size='xs'>
              <Gift />
            </IconBadge>
            <Label
              htmlFor='redemption-code'
              className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
            >
              {t('Have a Code?')}
            </Label>
          </div>
          <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
            <Input
              id='redemption-code'
              value={redemptionCode}
              onChange={(e) => onRedemptionCodeChange(e.target.value)}
              placeholder={t('Enter your redemption code')}
              className='h-9 min-w-0'
            />
            <Button
              onClick={onRedeem}
              disabled={redeeming}
              variant='outline'
              className='h-9 px-4'
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
        </div>
      ) : (
        <Alert className='border-t'>
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
