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
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { useSystemConfig } from '@/hooks/use-system-config'
import { getSelf } from '@/lib/api'

import { AffiliateRewardsCard } from './components/affiliate-rewards-card'
import { BillingHistoryDialog } from './components/dialogs/billing-history-dialog'
import { CreemConfirmDialog } from './components/dialogs/creem-confirm-dialog'
import { PaymentConfirmDialog } from './components/dialogs/payment-confirm-dialog'
import { TransferDialog } from './components/dialogs/transfer-dialog'
import { RechargeFormCard } from './components/recharge-form-card'
import { SubscriptionPlansCard } from './components/subscription-plans-card'
import { WalletStatsCard } from './components/wallet-stats-card'
import { PAYMENT_TYPES } from './constants'
import {
  useTopupInfo,
  usePayment,
  useAffiliate,
  useRedemption,
  useCreemPayment,
  useWaffoPayment,
  useWaffoPancakePayment,
} from './hooks'
import {
  getDefaultPaymentType,
  getMinTopupAmount,
  dispatchSelectedPayment,
} from './lib'
import type {
  UserWalletData,
  PaymentMethod,
  PresetAmount,
  CreemProduct,
  PaymentMethodOption,
} from './types'

interface WalletProps {
  initialShowHistory?: boolean
}

export function Wallet(props: WalletProps) {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>()
  const [selectedWaffoMethodIndex, setSelectedWaffoMethodIndex] = useState<
    number | null
  >(null)
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [selectedPaymentOptionValue, setSelectedPaymentOptionValue] =
    useState<string>()
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [billingDialogOpen, setBillingDialogOpen] = useState(false)
  const [redemptionCode, setRedemptionCode] = useState('')
  const [creemDialogOpen, setCreemDialogOpen] = useState(false)
  const [selectedCreemProduct, setSelectedCreemProduct] =
    useState<CreemProduct | null>(null)
  const [showSubscriptionPanel, setShowSubscriptionPanel] = useState(true)

  const { currency } = useSystemConfig()
  const { topupInfo, presetAmounts, loading: topupLoading } = useTopupInfo()

  const currencyUnit = useMemo(() => {
    if (currency?.quotaDisplayType === 'CNY') return 'CNY'
    if (currency?.quotaDisplayType === 'CUSTOM') {
      return currency.customCurrencySymbol?.trim() || 'USD'
    }
    return 'USD'
  }, [currency?.customCurrencySymbol, currency?.quotaDisplayType])
  const {
    amount: paymentAmount,
    calculating,
    processing,
    calculatePaymentAmount,
    processPayment,
  } = usePayment()
  const configuredTopupRatio = topupInfo?.topup_group_ratio ?? 1
  const topupRatio = configuredTopupRatio > 0 ? configuredTopupRatio : 1
  const creditAmount = Math.round(topupAmount * topupRatio)
  const currentBalanceCredits =
    (user?.quota ?? 0) / (currency?.quotaPerUnit || 500000)
  const {
    affiliateLink,
    loading: affiliateLoading,
    transferQuota,
    transferring,
  } = useAffiliate()
  const { redeeming, redeemCode } = useRedemption()
  const { processing: creemProcessing, processCreemPayment } = useCreemPayment()
  const { processing: waffoProcessing, processWaffoPayment } = useWaffoPayment()
  const { processing: pancakeProcessing, processWaffoPancakePayment } =
    useWaffoPancakePayment()

  const paymentOptions = useMemo<PaymentMethodOption[]>(() => {
    const configuredMethods = topupInfo?.pay_methods ?? []
    const coreMethods = [{ type: PAYMENT_TYPES.STRIPE, name: 'Stripe' }]

    const options: PaymentMethodOption[] = coreMethods.map(({ type, name }) => {
      const configured = configuredMethods.find(
        (method) => method.type === type
      )
      const gatewayEnabled = Boolean(topupInfo?.enable_stripe_topup)
      const gatewayMinimum = topupInfo?.stripe_min_topup || 0
      const minimum = Math.max(configured?.min_topup || 0, gatewayMinimum)
      const meetsMinimum = topupAmount >= minimum
      let disabledReason: string | undefined
      if (!gatewayEnabled) {
        disabledReason = t('Not configured')
      } else if (!meetsMinimum) {
        disabledReason = t('Minimum topup amount: {{amount}}', {
          amount: minimum,
        })
      }

      return {
        value: type,
        method: configured ?? { name, type },
        enabled: gatewayEnabled && meetsMinimum,
        disabledReason,
      }
    })

    if (topupInfo?.enable_waffo_topup) {
      const minimum = topupInfo.waffo_min_topup || 0
      topupInfo.waffo_pay_methods?.forEach((method, index) => {
        const meetsMinimum = topupAmount >= minimum
        options.push({
          value: `waffo:${index}`,
          method: {
            name: method.name,
            type: PAYMENT_TYPES.WAFFO,
            icon: method.icon,
          },
          enabled: meetsMinimum,
          disabledReason: meetsMinimum
            ? undefined
            : t('Minimum topup amount: {{amount}}', { amount: minimum }),
          waffoMethodIndex: index,
        })
      })
    }

    if (topupInfo?.enable_waffo_pancake_topup) {
      const minimum = topupInfo.waffo_pancake_min_topup || 0
      const meetsMinimum = topupAmount >= minimum
      options.push({
        value: PAYMENT_TYPES.WAFFO_PANCAKE,
        method: {
          name: 'Waffo Pancake',
          type: PAYMENT_TYPES.WAFFO_PANCAKE,
        },
        enabled: meetsMinimum,
        disabledReason: meetsMinimum
          ? undefined
          : t('Minimum topup amount: {{amount}}', { amount: minimum }),
      })
    }

    return options
  }, [t, topupAmount, topupInfo])

  // Fetch and refresh user data
  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user data:', error)
    } finally {
      setUserLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    if (props.initialShowHistory) {
      setBillingDialogOpen(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [props.initialShowHistory])

  // Initialize topup amount when topup info is loaded
  const topupAmountInitializedRef = useRef(false)
  useEffect(() => {
    if (
      topupInfo &&
      !topupAmountInitializedRef.current &&
      (presetAmounts.length > 0 || topupInfo.amount_options.length === 0)
    ) {
      topupAmountInitializedRef.current = true
      const minTopup = getMinTopupAmount(topupInfo)
      const defaultPreset =
        presetAmounts.find((preset) => preset.value === 5) || presetAmounts[0]
      const initialAmount = defaultPreset?.value ?? minTopup

      setTopupAmount(initialAmount)
      setSelectedPreset(defaultPreset?.value ?? null)

      // Calculate initial payment amount with default payment type
      const defaultPaymentType = getDefaultPaymentType(topupInfo)
      calculatePaymentAmount(initialAmount, defaultPaymentType)
    }
  }, [topupInfo, presetAmounts, calculatePaymentAmount])

  // Get current payment type (selected or default)
  const getCurrentPaymentType = useCallback(() => {
    return selectedPaymentMethod?.type || getDefaultPaymentType(topupInfo)
  }, [selectedPaymentMethod, topupInfo])

  // Handle preset selection
  const handleSelectPreset = (preset: PresetAmount) => {
    setTopupAmount(preset.value)
    setSelectedPreset(preset.value)
    calculatePaymentAmount(preset.value, getCurrentPaymentType())
  }

  // Handle topup amount change
  const handleTopupAmountChange = (amount: number) => {
    setTopupAmount(amount)
    setSelectedPreset(null)
    calculatePaymentAmount(amount, getCurrentPaymentType())
  }

  const selectPaymentOption = useCallback(
    async (option: PaymentMethodOption) => {
      if (!option.enabled) return false

      setSelectedPaymentOptionValue(option.value)
      setSelectedPaymentMethod(option.method)
      setSelectedWaffoMethodIndex(option.waffoMethodIndex ?? null)
      setPaymentLoading(option.value)

      try {
        await calculatePaymentAmount(topupAmount, option.method.type)
        return true
      } finally {
        setPaymentLoading(null)
      }
    },
    [calculatePaymentAmount, topupAmount]
  )

  const handleOpenRecharge = async () => {
    const option =
      paymentOptions.find(
        (candidate) =>
          candidate.value === selectedPaymentOptionValue && candidate.enabled
      ) ?? paymentOptions.find((candidate) => candidate.enabled)
    if (!option) return

    const selected = await selectPaymentOption(option)
    if (selected) setConfirmDialogOpen(true)
  }

  const handlePaymentMethodChange = async (value: string) => {
    const option = paymentOptions.find((candidate) => candidate.value === value)
    if (option) await selectPaymentOption(option)
  }

  // Handle payment confirmation
  const handlePaymentConfirm = async () => {
    if (!selectedPaymentMethod) return

    const success = await dispatchSelectedPayment(
      selectedPaymentMethod,
      topupAmount,
      selectedWaffoMethodIndex,
      {
        regular: processPayment,
        waffo: processWaffoPayment,
        waffoPancake: processWaffoPancakePayment,
      }
    )

    if (success) {
      setConfirmDialogOpen(false)
      await fetchUser()
    }
  }

  // Handle redemption
  const handleRedeem = async () => {
    if (!redemptionCode) return

    const success = await redeemCode(redemptionCode)
    if (success) {
      setRedemptionCode('')
      await fetchUser()
    }
  }

  // Handle transfer
  const handleTransfer = async (amount: number) => {
    const success = await transferQuota(amount)
    if (success) {
      await fetchUser()
    }
    return success
  }

  // Handle Creem product selection
  const handleCreemProductSelect = (product: CreemProduct) => {
    setSelectedCreemProduct(product)
    setCreemDialogOpen(true)
  }

  // Handle Creem payment confirmation
  const handleCreemConfirm = async () => {
    if (!selectedCreemProduct) return

    const success = await processCreemPayment(selectedCreemProduct.productId)
    if (success) {
      setCreemDialogOpen(false)
      setSelectedCreemProduct(null)
      await fetchUser()
    }
  }

  const handleSubscriptionAvailabilityChange = useCallback(
    (available: boolean) => {
      setShowSubscriptionPanel(available)
    },
    []
  )

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Wallet')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            <WalletStatsCard user={user} loading={userLoading} />

            <div
              className={
                showSubscriptionPanel
                  ? 'grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] xl:items-start'
                  : 'grid gap-4'
              }
            >
              <div id='wallet-add-funds' className='scroll-mt-4'>
                <RechargeFormCard
                  topupInfo={topupInfo}
                  presetAmounts={presetAmounts}
                  selectedPreset={selectedPreset}
                  onSelectPreset={handleSelectPreset}
                  topupAmount={topupAmount}
                  paymentAmount={paymentAmount}
                  topupRatio={topupRatio}
                  currentBalanceCredits={currentBalanceCredits}
                  onTopupAmountChange={handleTopupAmountChange}
                  currencyUnit={currencyUnit}
                  onRecharge={handleOpenRecharge}
                  rechargeDisabled={
                    !paymentOptions.some((option) => option.enabled)
                  }
                  rechargeLoading={Boolean(paymentLoading)}
                  redemptionCode={redemptionCode}
                  onRedemptionCodeChange={setRedemptionCode}
                  onRedeem={handleRedeem}
                  redeeming={redeeming}
                  topupLink={topupInfo?.topup_link}
                  loading={topupLoading}
                  onOpenBilling={() => setBillingDialogOpen(true)}
                  creemProducts={topupInfo?.creem_products}
                  enableCreemTopup={topupInfo?.enable_creem_topup}
                  onCreemProductSelect={handleCreemProductSelect}
                />
              </div>

              <SubscriptionPlansCard
                topupInfo={topupInfo}
                onAvailabilityChange={handleSubscriptionAvailabilityChange}
                userQuota={user?.quota}
                onPurchaseSuccess={fetchUser}
              />
            </div>

            <AffiliateRewardsCard
              user={user}
              affiliateLink={affiliateLink}
              onTransfer={() => setTransferDialogOpen(true)}
              complianceConfirmed={
                topupInfo?.payment_compliance_confirmed !== false
              }
              loading={affiliateLoading}
            />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <PaymentConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handlePaymentConfirm}
        topupAmount={topupAmount}
        creditAmount={creditAmount}
        paymentAmount={paymentAmount}
        currencyUnit={currencyUnit}
        paymentOptions={paymentOptions}
        selectedPaymentOptionValue={selectedPaymentOptionValue}
        onPaymentMethodChange={handlePaymentMethodChange}
        calculating={calculating}
        processing={processing || waffoProcessing || pancakeProcessing}
      />

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onConfirm={handleTransfer}
        availableQuota={user?.aff_quota ?? 0}
        transferring={transferring}
      />

      <BillingHistoryDialog
        open={billingDialogOpen}
        onOpenChange={setBillingDialogOpen}
      />

      <CreemConfirmDialog
        open={creemDialogOpen}
        onOpenChange={setCreemDialogOpen}
        onConfirm={handleCreemConfirm}
        product={selectedCreemProduct}
        processing={creemProcessing}
      />
    </>
  )
}
