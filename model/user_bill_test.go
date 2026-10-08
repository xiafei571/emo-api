package model

import (
	"context"
	"encoding/base64"
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupUserBillDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := DB, LOG_DB
	previousUnit, previousLogging := common.QuotaPerUnit, common.LogConsumeEnabled
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &Log{}, &TopUp{}, &Redemption{}))
	DB, LOG_DB = db, db
	common.QuotaPerUnit, common.LogConsumeEnabled = 500000, true
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.QuotaPerUnit, common.LogConsumeEnabled = previousUnit, previousLogging
		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})
	return db
}

func TestUserBillAggregatesLocalDaysActualChargesRefundsAndLargeTotals(t *testing.T) {
	db := setupUserBillDB(t)
	user := User{Username: "bill-user", Quota: 12345, UsedQuota: 90000}
	require.NoError(t, db.Create(&user).Error)
	location, err := time.LoadLocation("Asia/Tokyo")
	require.NoError(t, err)
	start := time.Date(2026, 4, 1, 0, 0, 0, 0, location)
	end := start.AddDate(0, 6, 0)
	logs := []Log{
		{UserId: user.Id, CreatedAt: start.Unix(), Type: LogTypeConsume, ModelName: "model-a", PromptTokens: 100, CompletionTokens: 30, Quota: 2000000000},
		{UserId: user.Id, CreatedAt: start.Add(23 * time.Hour).Unix(), Type: LogTypeConsume, ModelName: "model-a", PromptTokens: 50, CompletionTokens: 20, Quota: 2000000000},
		{UserId: user.Id, CreatedAt: start.AddDate(0, 0, 1).Unix(), Type: LogTypeRefund, ModelName: "model-a", PromptTokens: 100, Quota: 500},
		{UserId: user.Id, CreatedAt: start.AddDate(0, 0, 1).Unix(), Type: LogTypeConsume, ModelName: "model-b", PromptTokens: 5, CompletionTokens: 7, Quota: 100},
		{UserId: user.Id + 1, CreatedAt: start.Unix(), Type: LogTypeConsume, Quota: 1000},
		{UserId: user.Id, CreatedAt: start.Unix() - 1, Type: LogTypeConsume, Quota: 1000},
		{UserId: user.Id, CreatedAt: end.Unix(), Type: LogTypeConsume, Quota: 1000},
		{UserId: user.Id, CreatedAt: start.Unix(), Type: LogTypeError, Quota: 1000},
	}
	require.NoError(t, db.Create(&logs).Error)
	bill, err := GetUserBill(context.Background(), user.Id, start, end, location)
	require.NoError(t, err)
	assert.Equal(t, int64(155), bill.Totals.PromptTokens)
	assert.Equal(t, int64(57), bill.Totals.CompletionTokens)
	assert.Equal(t, int64(4000000100), bill.Totals.ChargedQuota)
	assert.Equal(t, int64(500), bill.Totals.RefundedQuota)
	assert.Equal(t, int64(3999999600), bill.Totals.NetQuota)
	require.Len(t, bill.Daily, 3)
	assert.Equal(t, BillUsage{Date: "2026-04-01", Model: "model-a", PromptTokens: 150, CompletionTokens: 50, ChargedQuota: 4000000000, NetQuota: 4000000000, UnpricedRequests: 2}, bill.Daily[0])
	assert.Equal(t, int64(-500), bill.Daily[1].NetQuota)
	require.Len(t, bill.Models, 2)
	assert.Equal(t, int64(3999999500), bill.Models[0].NetQuota)
	assert.Equal(t, "2026-09-30", bill.EndDate)
	assert.Equal(t, user.Quota, bill.CurrentQuota)
	assert.Equal(t, user.UsedQuota, bill.LifetimeUsedQuota)
}

func TestUserBillNormalizesRechargeProvidersAndUsesCompletionTime(t *testing.T) {
	db := setupUserBillDB(t)
	user := User{Username: "recharge-user"}
	require.NoError(t, db.Create(&user).Error)
	start := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 6, 0)
	topups := []TopUp{
		{UserId: user.Id, Amount: 10, Money: 70, CompleteTime: start.Unix(), Status: common.TopUpStatusSuccess, TradeNo: "epay"},
		{UserId: user.Id, Amount: 1000, Money: 12.5, PaymentProvider: PaymentProviderStripe, CompleteTime: start.Unix(), Status: common.TopUpStatusSuccess, TradeNo: "stripe"},
		{UserId: user.Id, Amount: 1000, Money: 2.5, PaymentMethod: PaymentMethodStripe, CompleteTime: start.Unix(), Status: common.TopUpStatusSuccess, TradeNo: "legacy"},
		{UserId: user.Id, Amount: 1500000, Money: 20, PaymentProvider: PaymentProviderCreem, CompleteTime: start.Unix(), Status: common.TopUpStatusSuccess, TradeNo: "creem"},
		{UserId: user.Id, Amount: 5, CompleteTime: start.Unix() - 1, Status: common.TopUpStatusSuccess, TradeNo: "past"},
		{UserId: user.Id, Amount: 7, CompleteTime: end.Unix(), Status: common.TopUpStatusSuccess, TradeNo: "end"},
		{UserId: user.Id, Amount: 99, CompleteTime: start.Unix(), Status: common.TopUpStatusPending, TradeNo: "pending"},
		{UserId: user.Id, Amount: 0, Money: 99, PaymentMethod: PaymentMethodStripe, CompleteTime: start.Unix(), Status: common.TopUpStatusSuccess, TradeNo: "subscription"},
		{UserId: user.Id + 1, Amount: 99, CompleteTime: start.Unix(), Status: common.TopUpStatusSuccess, TradeNo: "other"},
	}
	require.NoError(t, db.Create(&topups).Error)
	redemption := Redemption{Key: "secret-code", UsedUserId: user.Id, Quota: 500000, RedeemedTime: start.Unix(), Status: common.RedemptionCodeStatusUsed}
	require.NoError(t, db.Create(&redemption).Error)
	require.NoError(t, db.Delete(&redemption).Error)
	bill, err := GetUserBill(context.Background(), user.Id, start, end, time.UTC)
	require.NoError(t, err)
	assert.Equal(t, 28.0, bill.PeriodRechargeUnits)
	assert.Equal(t, 40.0, bill.LifetimeRechargeUnits)
	assert.Equal(t, int64(500000), bill.PeriodRedemptionQuota)
	require.Len(t, bill.Recharges, 5)
	assert.Equal(t, 1.0, bill.Recharges[4].CreditUnits)
	assert.Empty(t, bill.Recharges[4].TradeNo)
	assert.Empty(t, bill.Daily)
	assert.Empty(t, bill.Models)
}

func TestUserBillHandlesDSTCalendarBoundariesAndEmptyRecords(t *testing.T) {
	db := setupUserBillDB(t)
	user := User{Username: "dst-user"}
	require.NoError(t, db.Create(&user).Error)
	location, err := time.LoadLocation("America/New_York")
	require.NoError(t, err)
	start := time.Date(2026, 3, 8, 0, 0, 0, 0, location)
	end := start.AddDate(0, 0, 1) // 23-hour calendar day.
	common.LogConsumeEnabled = false
	bill, err := GetUserBill(context.Background(), user.Id, start, end, location)
	require.NoError(t, err)
	assert.Equal(t, "2026-03-08", bill.EndDate)
	assert.False(t, bill.ConsumptionLogging)
	assert.NotNil(t, bill.Daily)
	assert.NotNil(t, bill.Recharges)
	_, err = GetUserBill(context.Background(), user.Id, start, start, location)
	assert.Error(t, err)
	_, err = GetUserBill(context.Background(), user.Id, start, start.AddDate(1, 0, 0), location)
	assert.Error(t, err)
}

func TestUserBillHistoricalPricesIncludeDiscountsAndPreserveDailyChanges(t *testing.T) {
	db := setupUserBillDB(t)
	user := User{Username: "historical-prices"}
	require.NoError(t, db.Create(&user).Error)
	start := time.Date(2026, 10, 8, 0, 0, 0, 0, time.UTC)
	logs := []Log{
		{UserId: user.Id, CreatedAt: start.Unix(), Type: LogTypeConsume, ModelName: "model", Other: `{"model_ratio":1.5,"group_ratio":0.5,"user_group_ratio":-1,"completion_ratio":5,"cache_ratio":0.1,"cache_creation_ratio":1.25,"cache_creation_ratio_5m":1.25,"cache_creation_ratio_1h":2}`},
		{UserId: user.Id, CreatedAt: start.Unix() + 1, Type: LogTypeConsume, ModelName: "model", Other: `{"model_ratio":1.5,"group_ratio":0.5,"user_group_ratio":0.2,"completion_ratio":5,"cache_ratio":0.1}`},
		{UserId: user.Id, CreatedAt: start.Unix() + 2, Type: LogTypeRefund, ModelName: "model", Other: `{"model_ratio":999,"group_ratio":1}`},
		{UserId: user.Id, CreatedAt: start.Unix() + 3, Type: LogTypeConsume, ModelName: "model", Other: `{"model_ratio":999,"group_ratio":1,"model_price":0.5}`},
		{UserId: user.Id, CreatedAt: start.Unix() + 4, Type: LogTypeConsume, ModelName: "model", Other: `{"model_ratio":999,"group_ratio":1,"billing_mode":"tiered_expr"}`},
		{UserId: user.Id, CreatedAt: start.Unix() + 5, Type: LogTypeConsume, ModelName: "model", Other: `invalid`},
	}
	require.NoError(t, db.Create(&logs).Error)
	bill, err := GetUserBill(context.Background(), user.Id, start, start.AddDate(0, 0, 1), time.UTC)
	require.NoError(t, err)
	require.Len(t, bill.Daily, 1)
	assert.InDelta(t, 0.6, bill.Daily[0].Prices["input"].Min, 1e-10)
	assert.Equal(t, 1.5, bill.Daily[0].Prices["input"].Max)
	assert.InDelta(t, 3.0, bill.Daily[0].Prices["output"].Min, 1e-10)
	assert.Equal(t, 7.5, bill.Daily[0].Prices["output"].Max)
	assert.Equal(t, BillPriceRange{Min: 1.875, Max: 1.875}, bill.Daily[0].Prices["cache_write"])
	assert.Equal(t, BillPriceRange{Min: 3, Max: 3}, bill.Daily[0].Prices["cache_write_1h"])
	assert.Equal(t, int64(3), bill.Daily[0].UnpricedRequests)
	assert.Equal(t, bill.Daily[0].Prices, bill.Models[0].Prices)
}

func TestHistoricalBillPricesDoNotInventMissingRatesAndAllowFreeRates(t *testing.T) {
	for _, other := range []string{`{}`, `{"model_ratio":1}`, `{"model_ratio":-1,"group_ratio":1}`, `{"model_ratio":1,"group_ratio":-1}`} {
		assert.Nil(t, historicalBillPrices(other))
	}
	prices := historicalBillPrices(`{"model_ratio":1,"group_ratio":1,"user_group_ratio":0,"completion_ratio":2}`)
	assert.Equal(t, map[string]float64{"input": 0, "output": 0}, prices)
}

func TestUserBillRecoversSavedDynamicPrices(t *testing.T) {
	db := setupUserBillDB(t)
	user := User{Username: "dynamic-prices"}
	require.NoError(t, db.Create(&user).Error)
	start := time.Date(2026, 10, 8, 0, 0, 0, 0, time.UTC)
	expression := `v1:hour("UTC") < 12 ? tier("off_peak", p * 0.15 + c * 0.6 + cr * 0.003) : tier("peak", p * 0.3 + c * 1.2 + cr * 0.006)`
	for _, tier := range []string{"off_peak", "peak"} {
		other, err := common.Marshal(map[string]interface{}{
			"billing_mode": "tiered_expr", "expr_b64": base64.StdEncoding.EncodeToString([]byte(expression)),
			"matched_tier": tier, "group_ratio": 1, "user_group_ratio": 0.5,
		})
		require.NoError(t, err)
		require.NoError(t, db.Create(&Log{UserId: user.Id, CreatedAt: start.Unix(), Type: LogTypeConsume, ModelName: "deepseek", Quota: 42, Other: string(other)}).Error)
	}
	bill, err := GetUserBill(context.Background(), user.Id, start, start.AddDate(0, 0, 1), time.UTC)
	require.NoError(t, err)
	require.Len(t, bill.Daily, 1)
	assert.Equal(t, BillPriceRange{Min: 0.075, Max: 0.15}, bill.Daily[0].Prices["input"])
	assert.Equal(t, BillPriceRange{Min: 0.3, Max: 0.6}, bill.Daily[0].Prices["output"])
	assert.Equal(t, BillPriceRange{Min: 0.0015, Max: 0.003}, bill.Daily[0].Prices["cache_read"])
	assert.Equal(t, int64(0), bill.Daily[0].UnpricedRequests)
	assert.Equal(t, int64(84), bill.Daily[0].ChargedQuota)
	assert.Equal(t, bill.Daily[0].Prices, bill.Models[0].Prices)
}

func TestHistoricalExpressionPricesRejectAmbiguousOrNonlinearRates(t *testing.T) {
	for _, expression := range []string{
		`tier("base", p * c)`,
		`tier("base", p * 2 + 10)`,
		`tier("base", p * 2) * 6`,
		`tier("base", p * -2)`,
		`tier("base", p / 0)`,
		`len > 10 ? tier("base", p * 2) : tier("base", p * 3)`,
		`tier("base", p * 2)|||when(header("x") == "y") * 6`,
		`tier("different", p * 2)`,
	} {
		assert.Empty(t, historicalExpressionPrices(expression, "base", 1), expression)
	}
	assert.Equal(t, map[string]float64{"input": 0, "output": 2, "cache_write": 1.25, "cache_write_5m": 1.25, "cache_write_1h": 2},
		historicalExpressionPrices(`p * 0 + (c * 4 + cc * 2.5 + cc1h * 4) / 2`, "", 1))
}
