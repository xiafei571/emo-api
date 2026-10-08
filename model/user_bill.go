package model

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// BillUsage uses int64 totals: a multi-month bill can exceed a quota column's int32 range.
type BillUsage struct {
	Date             string                    `json:"date"`
	Model            string                    `json:"model"`
	PromptTokens     int64                     `json:"prompt_tokens"`
	CompletionTokens int64                     `json:"completion_tokens"`
	ChargedQuota     int64                     `json:"charged_quota"`
	RefundedQuota    int64                     `json:"refunded_quota"`
	NetQuota         int64                     `json:"net_quota"`
	Prices           map[string]BillPriceRange `json:"prices,omitempty"`
	UnpricedRequests int64                     `json:"unpriced_requests"`
}

type BillPriceRange struct {
	Min float64 `json:"min"`
	Max float64 `json:"max"`
}

// Historical per-million token rates include the effective group discount.
// Missing metadata, dynamic expressions and per-call billing cannot be inferred
// from total cost and token counts (cache and tool fees can contribute to cost).
func historicalBillPrices(other string) map[string]float64 {
	var metadata struct {
		ModelRatio           *float64 `json:"model_ratio"`
		GroupRatio           *float64 `json:"group_ratio"`
		UserGroupRatio       *float64 `json:"user_group_ratio"`
		CompletionRatio      *float64 `json:"completion_ratio"`
		CacheRatio           *float64 `json:"cache_ratio"`
		CacheCreationRatio   *float64 `json:"cache_creation_ratio"`
		CacheCreationRatio5m *float64 `json:"cache_creation_ratio_5m"`
		CacheCreationRatio1h *float64 `json:"cache_creation_ratio_1h"`
		ModelPrice           float64  `json:"model_price"`
		BillingMode          string   `json:"billing_mode"`
	}
	if common.UnmarshalJsonStr(other, &metadata) != nil || metadata.ModelRatio == nil || metadata.ModelPrice > 0 || metadata.BillingMode == "tiered_expr" {
		return nil
	}
	group := metadata.GroupRatio
	if metadata.UserGroupRatio != nil && *metadata.UserGroupRatio != -1 {
		group = metadata.UserGroupRatio
	}
	if group == nil || *group < 0 || *metadata.ModelRatio < 0 {
		return nil
	}
	base := *metadata.ModelRatio * 2 * *group
	if math.IsNaN(base) || math.IsInf(base, 0) {
		return nil
	}
	prices := map[string]float64{"input": base}
	for key, ratio := range map[string]*float64{
		"output": metadata.CompletionRatio, "cache_read": metadata.CacheRatio,
		"cache_write": metadata.CacheCreationRatio, "cache_write_5m": metadata.CacheCreationRatio5m,
		"cache_write_1h": metadata.CacheCreationRatio1h,
	} {
		if ratio == nil || *ratio < 0 {
			continue
		}
		price := base * *ratio
		if !math.IsNaN(price) && !math.IsInf(price, 0) {
			prices[key] = price
		}
	}
	return prices
}

type BillRecharge struct {
	ID            string  `json:"id"`
	Date          string  `json:"date"`
	TradeNo       string  `json:"trade_no"`
	PaymentMethod string  `json:"payment_method"`
	CreditUnits   float64 `json:"credit_units"`
}

type UserBill struct {
	UserID                  int            `json:"user_id"`
	Username                string         `json:"username"`
	StartDate               string         `json:"start_date"`
	EndDate                 string         `json:"end_date"`
	Timezone                string         `json:"timezone"`
	GeneratedAt             int64          `json:"generated_at"`
	QuotaPerUnit            float64        `json:"quota_per_unit"`
	CurrentQuota            int            `json:"current_quota"`
	LifetimeUsedQuota       int            `json:"lifetime_used_quota"`
	PeriodRechargeUnits     float64        `json:"period_recharge_units"`
	LifetimeRechargeUnits   float64        `json:"lifetime_recharge_units"`
	PeriodRedemptionQuota   int64          `json:"period_redemption_quota"`
	LifetimeRedemptionQuota int64          `json:"lifetime_redemption_quota"`
	ConsumptionLogging      bool           `json:"consumption_logging"`
	Totals                  BillUsage      `json:"totals"`
	Daily                   []BillUsage    `json:"daily"`
	Models                  []BillUsage    `json:"models"`
	Recharges               []BillRecharge `json:"recharges"`
}

// GetUserBill reads persisted accounting records without re-pricing historical requests.
// Dates are inclusive calendar dates in location; the DB interval is [start, end).
// Rows are streamed so a six-month range does not load every request into memory.
func GetUserBill(ctx context.Context, userID int, start, end time.Time, location *time.Location) (*UserBill, error) {
	if userID <= 0 || location == nil || !end.After(start) || end.Sub(start) > 186*24*time.Hour || common.QuotaPerUnit <= 0 {
		return nil, errors.New("invalid bill range or quota unit")
	}
	var user User
	if err := DB.WithContext(ctx).Select("id", "username", "quota", "used_quota").First(&user, userID).Error; err != nil {
		return nil, err
	}
	bill := &UserBill{
		UserID: user.Id, Username: user.Username,
		StartDate: start.In(location).Format(time.DateOnly), EndDate: end.In(location).AddDate(0, 0, -1).Format(time.DateOnly),
		Timezone: location.String(), GeneratedAt: time.Now().Unix(), QuotaPerUnit: common.QuotaPerUnit,
		CurrentQuota: user.Quota, LifetimeUsedQuota: user.UsedQuota, ConsumptionLogging: common.LogConsumeEnabled,
		Daily: []BillUsage{}, Models: []BillUsage{}, Recharges: []BillRecharge{},
	}
	rows, err := LOG_DB.WithContext(ctx).Model(&Log{}).
		Select("created_at", "type", "model_name", "quota", "prompt_tokens", "completion_tokens", "other").
		Where("user_id = ? AND created_at >= ? AND created_at < ? AND type IN ?", userID, start.Unix(), end.Unix(), []int{LogTypeConsume, LogTypeRefund}).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type usageKey struct{ date, model string }
	daily := make(map[usageKey]BillUsage)
	models := make(map[string]BillUsage)
	for rows.Next() {
		var log Log
		if err = LOG_DB.ScanRows(rows, &log); err != nil {
			return nil, err
		}
		date := time.Unix(log.CreatedAt, 0).In(location).Format(time.DateOnly)
		key := usageKey{date, log.ModelName}
		day, model := daily[key], models[log.ModelName]
		day.Date, day.Model, model.Model = date, log.ModelName, log.ModelName
		var prices map[string]float64
		if log.Type == LogTypeConsume {
			prices = historicalBillPrices(log.Other)
		}
		for _, total := range []*BillUsage{&day, &model, &bill.Totals} {
			if log.Type == LogTypeConsume {
				if len(prices) == 0 {
					total.UnpricedRequests++
				}
				for key, price := range prices {
					if total.Prices == nil {
						total.Prices = make(map[string]BillPriceRange)
					}
					rangeValue, exists := total.Prices[key]
					if !exists {
						rangeValue = BillPriceRange{Min: price, Max: price}
					}
					rangeValue.Min = math.Min(rangeValue.Min, price)
					rangeValue.Max = math.Max(rangeValue.Max, price)
					total.Prices[key] = rangeValue
				}
				total.PromptTokens += int64(log.PromptTokens)
				total.CompletionTokens += int64(log.CompletionTokens)
				total.ChargedQuota += int64(log.Quota)
			} else {
				total.RefundedQuota += int64(log.Quota)
			}
			total.NetQuota = total.ChargedQuota - total.RefundedQuota
		}
		daily[key], models[log.ModelName] = day, model
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	// Release the log connection before querying the primary DB (they may share a pool).
	if err = rows.Close(); err != nil {
		return nil, err
	}
	for _, usage := range daily {
		bill.Daily = append(bill.Daily, usage)
	}
	for _, usage := range models {
		bill.Models = append(bill.Models, usage)
	}
	sort.Slice(bill.Daily, func(i, j int) bool {
		if bill.Daily[i].Date == bill.Daily[j].Date {
			return bill.Daily[i].Model < bill.Daily[j].Model
		}
		return bill.Daily[i].Date < bill.Daily[j].Date
	})
	sort.Slice(bill.Models, func(i, j int) bool { return bill.Models[i].Model < bill.Models[j].Model })

	// Amount=0 records represent subscription purchases, which do not credit the wallet.
	// Read all successful wallet topups for lifetime totals, rather than the 30-day history API.
	rows, err = DB.WithContext(ctx).Model(&TopUp{}).
		Select("id", "amount", "money", "payment_provider", "payment_method", "complete_time", "trade_no").
		Where("user_id = ? AND status = ? AND amount > 0", userID, common.TopUpStatusSuccess).
		Order("complete_time ASC, id ASC").Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var topup TopUp
		if err = DB.ScanRows(rows, &topup); err != nil {
			return nil, err
		}
		units := float64(topup.Amount)
		provider := topup.PaymentProvider
		if provider == "" {
			provider = topup.PaymentMethod // Legacy orders predate payment_provider.
		}
		switch provider {
		case PaymentProviderStripe:
			units = topup.Money
		case PaymentProviderCreem:
			units /= bill.QuotaPerUnit
		}
		bill.LifetimeRechargeUnits += units
		if topup.CompleteTime >= start.Unix() && topup.CompleteTime < end.Unix() {
			bill.PeriodRechargeUnits += units
			bill.Recharges = append(bill.Recharges, BillRecharge{
				ID:      fmt.Sprintf("topup:%d", topup.Id),
				Date:    time.Unix(topup.CompleteTime, 0).In(location).Format("2006-01-02 15:04:05"),
				TradeNo: topup.TradeNo, PaymentMethod: topup.PaymentMethod, CreditUnits: units,
			})
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if err = rows.Close(); err != nil {
		return nil, err
	}
	rows, err = DB.WithContext(ctx).Unscoped().Model(&Redemption{}).
		Select("id", "quota", "redeemed_time").
		Where("used_user_id = ? AND status = ?", userID, common.RedemptionCodeStatusUsed).
		Order("redeemed_time ASC, id ASC").Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var redemption Redemption
		if err = DB.ScanRows(rows, &redemption); err != nil {
			return nil, err
		}
		bill.LifetimeRedemptionQuota += int64(redemption.Quota)
		if redemption.RedeemedTime >= start.Unix() && redemption.RedeemedTime < end.Unix() {
			bill.PeriodRedemptionQuota += int64(redemption.Quota)
			bill.Recharges = append(bill.Recharges, BillRecharge{
				ID:            fmt.Sprintf("redemption:%d", redemption.Id),
				Date:          time.Unix(redemption.RedeemedTime, 0).In(location).Format("2006-01-02 15:04:05"),
				PaymentMethod: "redemption", CreditUnits: float64(redemption.Quota) / bill.QuotaPerUnit,
			})
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	sort.SliceStable(bill.Recharges, func(i, j int) bool { return bill.Recharges[i].Date < bill.Recharges[j].Date })
	return bill, nil
}
