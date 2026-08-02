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
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'

import type { PaymentMethodOption } from '../../types'

interface PaymentConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  topupAmount: number
  currencyUnit: string
  paymentOptions: PaymentMethodOption[]
  selectedPaymentOptionValue?: string
  onPaymentMethodChange: (value: string) => void
  calculating: boolean
  processing: boolean
}

export function PaymentConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  topupAmount,
  currencyUnit,
  paymentOptions,
  selectedPaymentOptionValue,
  onPaymentMethodChange,
  calculating,
  processing,
}: PaymentConfirmDialogProps) {
  const { t } = useTranslation()
  const selectedOption = paymentOptions.find(
    (option) => option.value === selectedPaymentOptionValue
  )

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-xl font-semibold'>
            {t('Confirm Payment')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('Review your payment details')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='space-y-3 py-3 sm:space-y-4 sm:py-4'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-sm'>
              {t('Topup Amount')}
            </span>
            <span className='text-lg font-semibold'>
              {formatNumber(topupAmount)} {currencyUnit}
            </span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-sm'>
              {t('You Pay')}
            </span>
            {calculating ? (
              <Skeleton className='h-6 w-24' />
            ) : (
              <div className='flex items-baseline gap-2'>
                <span className='text-2xl font-semibold'>
                  {formatNumber(topupAmount)} {currencyUnit}
                </span>
              </div>
            )}
          </div>

          <div className='border-t pt-4'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                {t('Payment Method')}
              </span>
              <NativeSelect
                value={selectedPaymentOptionValue ?? ''}
                onChange={(event) => onPaymentMethodChange(event.target.value)}
                disabled={processing || calculating}
                className='w-52 max-w-[65%]'
                aria-label={t('Payment Method')}
              >
                {paymentOptions.map((option) => (
                  <NativeSelectOption
                    key={option.value}
                    value={option.value}
                    disabled={!option.enabled}
                  >
                    {option.method.name}
                    {!option.enabled
                      ? ` — ${option.disabledReason ?? t('Not configured')}`
                      : ''}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        </div>

        <AlertDialogFooter className='grid grid-cols-2 gap-2 sm:flex'>
          <AlertDialogCancel disabled={processing}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={processing || calculating || !selectedOption?.enabled}
          >
            {processing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Confirm Payment')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
