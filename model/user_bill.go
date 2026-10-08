package model

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// BillUsage uses int64 totals: a multi-month bill can exceed a quota column's int32 range.
type BillUsage struct {
	Date             string `json:"date"`
	Model            string `json:"model"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CompletionTokens int64  `json:"completion_tokens"`
	ChargedQuota     int64  `json:"charged_quota"`
	RefundedQuota    int64  `json:"refunded_quota"`
	NetQuota         int64  `json:"net_quota"`
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
		Select("created_at", "type", "model_name", "quota", "prompt_tokens", "completion_tokens").
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
		for _, total := range []*BillUsage{&day, &model, &bill.Totals} {
			if log.Type == LogTypeConsume {
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
