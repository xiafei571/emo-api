package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetStripeCurrencyConfigSelectsConfiguredPrice(t *testing.T) {
	originalUSD := setting.StripePriceId
	originalCNY := setting.StripePriceIdCNY
	originalJPY := setting.StripePriceIdJPY
	t.Cleanup(func() {
		setting.StripePriceId = originalUSD
		setting.StripePriceIdCNY = originalCNY
		setting.StripePriceIdJPY = originalJPY
	})

	setting.StripePriceId = "price_usd"
	setting.StripePriceIdCNY = "price_cny"
	setting.StripePriceIdJPY = "price_jpy"

	tests := []struct {
		input     string
		currency  string
		priceID   string
		unitPrice float64
	}{
		{input: "", currency: "USD", priceID: "price_usd", unitPrice: setting.StripeUnitPrice},
		{input: "cny", currency: "CNY", priceID: "price_cny", unitPrice: setting.StripeUnitPriceCNY},
		{input: " JPY ", currency: "JPY", priceID: "price_jpy", unitPrice: setting.StripeUnitPriceJPY},
	}

	for _, test := range tests {
		config, err := getStripeCurrencyConfig(test.input)
		require.NoError(t, err)
		assert.Equal(t, test.currency, config.Currency)
		assert.Equal(t, test.priceID, config.PriceID)
		assert.Equal(t, test.unitPrice, config.UnitPrice)
	}
}

func TestGetStripeCurrencyConfigRejectsUnsupportedCurrency(t *testing.T) {
	_, err := getStripeCurrencyConfig("EUR")
	require.Error(t, err)
}
