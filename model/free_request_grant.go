package model

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	FreeRequestGrantOptionKey          = "FreeRequestGrantSetting"
	FreeRequestGrantSourceAdminSwitch  = "admin_group_switch"
	FreeRequestGrantSourceDailyBalance = "daily_balance"
	FreeRequestGrantStatusActive       = "active"
	FreeRequestGrantStatusExpired      = "expired"
)

type FreeRequestGrantSetting struct {
	Enabled                      bool           `json:"enabled"`
	Group                        string         `json:"group"`
	AdminSwitchEnabled           bool           `json:"admin_switch_enabled"`
	AdminSwitchCount             int            `json:"admin_switch_count"`
	AdminSwitchValidDays         int            `json:"admin_switch_valid_days"`
	DailyBalanceEnabled          bool           `json:"daily_balance_enabled"`
	DailyBalanceCount            int            `json:"daily_balance_count"`
	DailyBalanceThreshold        float64        `json:"daily_balance_threshold"`
	DailyBalanceExpireAtMidnight bool           `json:"daily_balance_expire_at_midnight"`
	CampaignEndTime              int64          `json:"campaign_end_time"`
	DeductCountPerSuccess        int            `json:"deduct_count_per_success"`
	ModelDeductCounts            map[string]int `json:"model_deduct_counts"`
}

type FreeRequestGrant struct {
	Id         int    `json:"id"`
	UserId     int    `json:"user_id" gorm:"index;index:idx_free_grant_available,priority:1;index:idx_free_grant_daily,priority:1"`
	Group      string `json:"group" gorm:"type:varchar(64);not null;index:idx_free_grant_available,priority:2"`
	Source     string `json:"source" gorm:"type:varchar(32);not null;index:idx_free_grant_daily,priority:2"`
	TotalCount int    `json:"total_count" gorm:"type:int;not null;default:0"`
	UsedCount  int    `json:"used_count" gorm:"type:int;not null;default:0"`
	StartTime  int64  `json:"start_time" gorm:"type:bigint;not null;index"`
	EndTime    int64  `json:"end_time" gorm:"type:bigint;not null;index:idx_free_grant_available,priority:4"`
	GrantDate  string `json:"grant_date" gorm:"type:varchar(10);default:'';index:idx_free_grant_daily,priority:3"`
	Status     string `json:"status" gorm:"type:varchar(32);not null;default:'active';index:idx_free_grant_available,priority:3"`
	CreatedAt  int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt  int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (FreeRequestGrant) TableName() string {
	return "free_request_grants"
}

type FreeRequestGrantReservation struct {
	GrantId int
	UserId  int
	Group   string
	Count   int
	Items   []FreeRequestGrantReservationItem
}

type FreeRequestGrantReservationItem struct {
	GrantId      int
	Count        int
	OriginalUsed int // snapshot of used_count at reservation time for confirm
}

type FreeRequestGrantSummaryItem struct {
	Type          string `json:"type"`
	Status        string `json:"status"`
	Remaining     int    `json:"remaining"`
	Total         int    `json:"total"`
	StartTime     int64  `json:"start_time"`
	EndTime       int64  `json:"end_time"`
	ResetTime     int64  `json:"reset_time"`
	Group         string `json:"group"`
	Message       string `json:"message"`
	BalanceNeeded bool   `json:"balance_needed"`
}

type FreeRequestGrantSummary struct {
	Enabled          bool                          `json:"enabled"`
	Group            string                        `json:"group"`
	UserGroup        string                        `json:"user_group"`
	Activated        bool                          `json:"activated"`
	BalanceQualified bool                          `json:"balance_qualified"`
	BalanceThreshold int                           `json:"balance_threshold"`
	Now              int64                         `json:"now"`
	Items            []FreeRequestGrantSummaryItem `json:"items"`
}

func freeRequestGrantGroupCol() string {
	if commonGroupCol != "" {
		return commonGroupCol
	}
	if common.UsingPostgreSQL {
		return `"group"`
	}
	return "`group`"
}

func DefaultFreeRequestGrantSetting() FreeRequestGrantSetting {
	return FreeRequestGrantSetting{
		Enabled:                      false,
		Group:                        "",
		AdminSwitchEnabled:           true,
		AdminSwitchCount:             500,
		AdminSwitchValidDays:         3,
		DailyBalanceEnabled:          true,
		DailyBalanceCount:            100,
		DailyBalanceThreshold:        0,
		DailyBalanceExpireAtMidnight: true,
		CampaignEndTime:              0,
		DeductCountPerSuccess:        1,
		ModelDeductCounts:            map[string]int{},
	}
}

func ResetFreeRequestGrantSettingForTest() {
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	delete(common.OptionMap, FreeRequestGrantOptionKey)
	common.OptionMapRWMutex.Unlock()
}

func GetFreeRequestGrantSetting() FreeRequestGrantSetting {
	setting := DefaultFreeRequestGrantSetting()
	common.OptionMapRWMutex.RLock()
	raw := ""
	if common.OptionMap != nil {
		raw = strings.TrimSpace(common.OptionMap[FreeRequestGrantOptionKey])
	}
	common.OptionMapRWMutex.RUnlock()
	if raw == "" {
		return setting
	}
	if err := common.UnmarshalJsonStr(raw, &setting); err != nil {
		common.SysLog("failed to parse free request grant setting: " + err.Error())
		return DefaultFreeRequestGrantSetting()
	}
	if strings.TrimSpace(setting.Group) == "" {
		setting.Group = ""
	}
	// [FIX #4] Ensure DeductCountPerSuccess has a minimum of 1
	if setting.DeductCountPerSuccess <= 0 {
		setting.DeductCountPerSuccess = 1
	}
	if setting.ModelDeductCounts == nil {
		setting.ModelDeductCounts = map[string]int{}
	}
	return setting
}

func GetFreeRequestGrantDeductCount(modelName string) int {
	setting := GetFreeRequestGrantSetting()
	count := setting.DeductCountPerSuccess
	modelName = strings.TrimSpace(modelName)
	if modelName != "" {
		if modelCount, ok := setting.ModelDeductCounts[modelName]; ok && modelCount > 0 {
			count = modelCount
		}
	}
	if count <= 0 {
		count = 1
	}
	return count
}

func FreeRequestGrantDefaultSettingJSONString() string {
	bytes, err := common.Marshal(DefaultFreeRequestGrantSetting())
	if err != nil {
		return "{}"
	}
	return string(bytes)
}

func CreateDefaultFreeRequestGrantOptionIfNeed() error {
	if DB == nil {
		return nil
	}
	option := Option{Key: FreeRequestGrantOptionKey}
	err := DB.Where("key = ?", FreeRequestGrantOptionKey).First(&option).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		option = Option{
			Key:   FreeRequestGrantOptionKey,
			Value: FreeRequestGrantDefaultSettingJSONString(),
		}
		if err := DB.Create(&option).Error; err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	common.OptionMapRWMutex.Lock()
	if common.OptionMap != nil {
		if _, ok := common.OptionMap[FreeRequestGrantOptionKey]; !ok {
			common.OptionMap[FreeRequestGrantOptionKey] = option.Value
		}
	}
	common.OptionMapRWMutex.Unlock()
	return nil
}

// CreateAdminFreeRequestGrantOnGroupSwitch creates a grant when admin switches user to the target group.
// [FIX #1] Only creates if the user has never received an admin_group_switch grant before (active or expired).
func CreateAdminFreeRequestGrantOnGroupSwitch(userId int, oldGroup string, newGroup string) (*FreeRequestGrant, error) {
	setting := GetFreeRequestGrantSetting()
	targetGroup := strings.TrimSpace(setting.Group)
	if !setting.Enabled || !setting.AdminSwitchEnabled || userId <= 0 || targetGroup == "" {
		return nil, nil
	}
	if strings.TrimSpace(oldGroup) == targetGroup || strings.TrimSpace(newGroup) != targetGroup {
		return nil, nil
	}
	if setting.AdminSwitchCount <= 0 || setting.AdminSwitchValidDays <= 0 {
		return nil, nil
	}
	if setting.CampaignEndTime > 0 && GetDBTimestamp() >= setting.CampaignEndTime {
		return nil, nil
	}

	// [FIX #1] Check if user already has any admin_group_switch grant (active or expired)
	var existingCount int64
	if err := DB.Model(&FreeRequestGrant{}).
		Where("user_id = ? AND source = ? AND "+freeRequestGrantGroupCol()+" = ?",
			userId, FreeRequestGrantSourceAdminSwitch, targetGroup).
		Count(&existingCount).Error; err != nil {
		return nil, err
	}
	if existingCount > 0 {
		// User has already received an admin switch grant before, skip
		return nil, nil
	}

	now := GetDBTimestamp()
	grant := &FreeRequestGrant{
		UserId:     userId,
		Group:      targetGroup,
		Source:     FreeRequestGrantSourceAdminSwitch,
		TotalCount: setting.AdminSwitchCount,
		UsedCount:  0,
		StartTime:  now,
		EndTime:    now + int64(setting.AdminSwitchValidDays)*24*3600,
		Status:     FreeRequestGrantStatusActive,
	}
	if setting.CampaignEndTime > 0 && grant.EndTime > setting.CampaignEndTime {
		grant.EndTime = setting.CampaignEndTime
	}
	if err := DB.Create(grant).Error; err != nil {
		return nil, err
	}
	RecordLog(userId, LogTypeManage, fmt.Sprintf("切换到%s分组，赠送%d次免费请求，有效期%d天", targetGroup, setting.AdminSwitchCount, setting.AdminSwitchValidDays))
	return grant, nil
}

// EnsureDailyBalanceFreeRequestGrant creates a daily grant if conditions are met.
// [FIX #6 TOCTOU] Balance check and grant creation are now in a single transaction.
func EnsureDailyBalanceFreeRequestGrant(userId int) (*FreeRequestGrant, error) {
	setting := GetFreeRequestGrantSetting()
	targetGroup := strings.TrimSpace(setting.Group)
	if !setting.Enabled || !setting.DailyBalanceEnabled || userId <= 0 || targetGroup == "" || setting.DailyBalanceCount <= 0 {
		return nil, nil
	}
	now := GetDBTimestamp()
	if setting.CampaignEndTime > 0 && now >= setting.CampaignEndTime {
		return nil, nil
	}

	nowTime := time.Unix(now, 0).In(time.Local)
	grantDate := nowTime.Format("2006-01-02")

	// Check if today's grant already exists (outside transaction is fine, idempotent)
	var existing FreeRequestGrant
	query := DB.Where("user_id = ? AND source = ? AND grant_date = ? AND "+freeRequestGrantGroupCol()+" = ?",
		userId, FreeRequestGrantSourceDailyBalance, grantDate, targetGroup).
		First(&existing)
	if query.Error == nil {
		return &existing, nil
	}
	if !errors.Is(query.Error, gorm.ErrRecordNotFound) {
		return nil, query.Error
	}

	endTime := now + 24*3600
	if setting.DailyBalanceExpireAtMidnight {
		nextMidnight := time.Date(nowTime.Year(), nowTime.Month(), nowTime.Day(), 0, 0, 0, 0, nowTime.Location()).AddDate(0, 0, 1)
		endTime = nextMidnight.Unix()
	}
	if setting.CampaignEndTime > 0 && endTime > setting.CampaignEndTime {
		endTime = setting.CampaignEndTime
	}

	// [FIX #6 TOCTOU] Perform balance check and grant creation in a single transaction
	var grant *FreeRequestGrant
	err := DB.Transaction(func(tx *gorm.DB) error {
		// Re-check inside transaction to avoid TOCTOU
		var existingInTx FreeRequestGrant
		if err := tx.Where("user_id = ? AND source = ? AND grant_date = ? AND "+freeRequestGrantGroupCol()+" = ?",
			userId, FreeRequestGrantSourceDailyBalance, grantDate, targetGroup).
			First(&existingInTx).Error; err == nil {
			grant = &existingInTx
			return nil
		}

		// [FIX #6] Check balance inside the transaction
		quota, err := GetUserQuota(userId, false)
		if err != nil {
			return err
		}
		thresholdQuota := int(math.Ceil(setting.DailyBalanceThreshold * common.QuotaPerUnit))
		if thresholdQuota < 0 {
			thresholdQuota = 0
		}
		if quota <= thresholdQuota {
			// Balance insufficient, return a sentinel error to indicate no-op
			grant = nil
			return nil
		}

		newGrant := &FreeRequestGrant{
			UserId:     userId,
			Group:      targetGroup,
			Source:     FreeRequestGrantSourceDailyBalance,
			TotalCount: setting.DailyBalanceCount,
			UsedCount:  0,
			StartTime:  now,
			EndTime:    endTime,
			GrantDate:  grantDate,
			Status:     FreeRequestGrantStatusActive,
		}
		if err := tx.Create(newGrant).Error; err != nil {
			// Handle race: another request may have created it
			var dup FreeRequestGrant
			if err2 := tx.Where("user_id = ? AND source = ? AND grant_date = ? AND "+freeRequestGrantGroupCol()+" = ?",
				userId, FreeRequestGrantSourceDailyBalance, grantDate, targetGroup).First(&dup).Error; err2 == nil {
				grant = &dup
				return nil
			}
			return err
		}
		grant = newGrant
		return nil
	})
	if err != nil {
		return nil, err
	}
	return grant, nil
}

// ReserveFreeRequestGrant reserves count from available grants using earliest-expiry-first.
// [FIX #5 SQLite FOR UPDATE] Uses optimistic locking instead of FOR UPDATE for cross-DB compatibility.
func ReserveFreeRequestGrant(userId int, group string, count int) (*FreeRequestGrantReservation, error) {
	setting := GetFreeRequestGrantSetting()
	targetGroup := strings.TrimSpace(setting.Group)
	group = strings.TrimSpace(group)
	if !setting.Enabled || userId <= 0 || targetGroup == "" || group != targetGroup {
		return nil, nil
	}
	if count <= 0 {
		count = 1
	}
	if _, err := EnsureDailyBalanceFreeRequestGrant(userId); err != nil {
		return nil, err
	}
	now := GetDBTimestamp()
	reservation := &FreeRequestGrantReservation{UserId: userId, Group: group, Count: count}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var grants []FreeRequestGrant
		// [FIX #5] Removed FOR UPDATE — use optimistic locking with WHERE used_count = snapshot
		query := tx.Where(
			"user_id = ? AND "+freeRequestGrantGroupCol()+" = ? AND status = ? AND start_time <= ? AND end_time > ? AND used_count < total_count",
			userId, group, FreeRequestGrantStatusActive, now, now,
		).Order("end_time asc, id asc").Find(&grants)
		if query.Error != nil {
			return query.Error
		}
		remainingToReserve := count
		for _, grant := range grants {
			available := grant.TotalCount - grant.UsedCount
			if available <= 0 {
				continue
			}
			consume := available
			if consume > remainingToReserve {
				consume = remainingToReserve
			}
			if consume <= 0 {
				break
			}
			// [FIX #5] Optimistic locking: include used_count in WHERE to detect concurrent modifications
			result := tx.Model(&FreeRequestGrant{}).
				Where("id = ? AND used_count = ? AND used_count + ? <= total_count", grant.Id, grant.UsedCount, consume).
				Update("used_count", gorm.Expr("used_count + ?", consume))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				// Another request modified this row, skip and try next grant
				continue
			}
			reservation.Items = append(reservation.Items, FreeRequestGrantReservationItem{
				GrantId:      grant.Id,
				Count:        consume,
				OriginalUsed: grant.UsedCount,
			})
			if reservation.GrantId == 0 {
				reservation.GrantId = grant.Id
			}
			remainingToReserve -= consume
			if remainingToReserve == 0 {
				return nil
			}
		}
		return gorm.ErrRecordNotFound
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return reservation, nil
}

// ConfirmFreeRequestGrantReservation confirms a successful reservation.
// [FIX #3] Now properly validates the reservation by checking that used_count matches expectations.
func ConfirmFreeRequestGrantReservation(reservation *FreeRequestGrantReservation) error {
	if reservation == nil || reservation.GrantId <= 0 {
		return nil
	}
	if len(reservation.Items) == 0 {
		return nil
	}
	// Validate that each item's used_count is consistent with what we reserved
	for _, item := range reservation.Items {
		if item.GrantId <= 0 {
			continue
		}
		var grant FreeRequestGrant
		if err := DB.Where("id = ?", item.GrantId).First(&grant).Error; err != nil {
			return err
		}
		// The used_count should be at least OriginalUsed + Count after our reservation
		expectedMin := item.OriginalUsed + item.Count
		if grant.UsedCount < expectedMin {
			return fmt.Errorf("free request grant confirm: grant %d used_count=%d, expected >= %d", item.GrantId, grant.UsedCount, expectedMin)
		}
	}
	return nil
}

func GetFreeRequestGrantSummary(userId int) (*FreeRequestGrantSummary, error) {
	setting := GetFreeRequestGrantSetting()
	targetGroup := strings.TrimSpace(setting.Group)
	now := GetDBTimestamp()
	summary := &FreeRequestGrantSummary{
		Enabled: setting.Enabled,
		Group:   targetGroup,
		Now:     now,
		Items:   []FreeRequestGrantSummaryItem{},
	}
	if userId <= 0 || targetGroup == "" {
		return summary, nil
	}
	user, err := GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	summary.UserGroup = user.Group
	summary.Activated = strings.TrimSpace(user.Group) == targetGroup
	thresholdQuota := int(math.Ceil(setting.DailyBalanceThreshold * common.QuotaPerUnit))
	if thresholdQuota < 0 {
		thresholdQuota = 0
	}
	summary.BalanceThreshold = thresholdQuota
	summary.BalanceQualified = user.Quota > thresholdQuota
	if !setting.Enabled {
		return summary, nil
	}
	if !summary.Activated {
		summary.Items = append(summary.Items, FreeRequestGrantSummaryItem{
			Type:    "activation",
			Status:  "not_activated",
			Group:   targetGroup,
			Message: "请联系管理员激活",
		})
		return summary, nil
	}

	dailyItem, err := buildDailyFreeRequestGrantSummaryItem(userId, targetGroup, setting, summary.BalanceQualified, now)
	if err != nil {
		return nil, err
	}
	summary.Items = append(summary.Items, dailyItem)

	trialItem, ok, err := buildTrialFreeRequestGrantSummaryItem(userId, targetGroup, now)
	if err != nil {
		return nil, err
	}
	if ok {
		summary.Items = append(summary.Items, trialItem)
	}
	return summary, nil
}

func buildDailyFreeRequestGrantSummaryItem(userId int, targetGroup string, setting FreeRequestGrantSetting, balanceQualified bool, now int64) (FreeRequestGrantSummaryItem, error) {
	nowTime := time.Unix(now, 0).In(time.Local)
	resetTime := time.Date(nowTime.Year(), nowTime.Month(), nowTime.Day(), 0, 0, 0, 0, nowTime.Location()).AddDate(0, 0, 1).Unix()
	item := FreeRequestGrantSummaryItem{
		Type:          "daily_balance",
		Status:        "pending",
		Total:         setting.DailyBalanceCount,
		ResetTime:     resetTime,
		Group:         targetGroup,
		BalanceNeeded: !balanceQualified,
	}
	if !setting.DailyBalanceEnabled || setting.DailyBalanceCount <= 0 {
		item.Status = "disabled"
		return item, nil
	}
	grantDate := nowTime.Format("2006-01-02")
	var grant FreeRequestGrant
	query := DB.Where("user_id = ? AND source = ? AND grant_date = ? AND "+freeRequestGrantGroupCol()+" = ?",
		userId, FreeRequestGrantSourceDailyBalance, grantDate, targetGroup).
		Order("id desc").First(&grant)
	if query.Error == nil {
		item.Total = grant.TotalCount
		item.Remaining = grant.TotalCount - grant.UsedCount
		if item.Remaining < 0 {
			item.Remaining = 0
		}
		item.StartTime = grant.StartTime
		item.EndTime = grant.EndTime
		item.ResetTime = grant.EndTime
		if grant.Status == FreeRequestGrantStatusActive && grant.EndTime > now && item.Remaining > 0 {
			item.Status = "active"
		} else {
			item.Status = "used_up"
		}
		return item, nil
	}
	if !errors.Is(query.Error, gorm.ErrRecordNotFound) {
		return item, query.Error
	}
	if balanceQualified {
		item.Status = "available"
		item.Remaining = setting.DailyBalanceCount
	} else {
		item.Status = "pending"
	}
	return item, nil
}

func buildTrialFreeRequestGrantSummaryItem(userId int, targetGroup string, now int64) (FreeRequestGrantSummaryItem, bool, error) {
	var grant FreeRequestGrant
	query := DB.Where("user_id = ? AND source = ? AND "+freeRequestGrantGroupCol()+" = ?",
		userId, FreeRequestGrantSourceAdminSwitch, targetGroup).
		Order("end_time desc, id desc").First(&grant)
	if errors.Is(query.Error, gorm.ErrRecordNotFound) {
		return FreeRequestGrantSummaryItem{}, false, nil
	}
	if query.Error != nil {
		return FreeRequestGrantSummaryItem{}, false, query.Error
	}
	if grant.EndTime > 0 && grant.EndTime+7*24*3600 <= now {
		return FreeRequestGrantSummaryItem{}, false, nil
	}
	remaining := grant.TotalCount - grant.UsedCount
	if remaining < 0 {
		remaining = 0
	}
	item := FreeRequestGrantSummaryItem{
		Type:      "admin_group_switch",
		Status:    "active",
		Remaining: remaining,
		Total:     grant.TotalCount,
		StartTime: grant.StartTime,
		EndTime:   grant.EndTime,
		Group:     targetGroup,
	}
	if grant.Status != FreeRequestGrantStatusActive || grant.EndTime <= now {
		item.Status = "expired"
	} else if remaining <= 0 {
		item.Status = "used_up"
	}
	return item, true, nil
}

func RefundFreeRequestGrantReservation(reservation *FreeRequestGrantReservation) error {
	if reservation == nil {
		return nil
	}
	if len(reservation.Items) == 0 && reservation.GrantId > 0 {
		count := reservation.Count
		if count <= 0 {
			count = 1
		}
		reservation.Items = []FreeRequestGrantReservationItem{{GrantId: reservation.GrantId, Count: count}}
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		for _, item := range reservation.Items {
			if item.GrantId <= 0 || item.Count <= 0 {
				continue
			}
			var grant FreeRequestGrant
			if err := tx.Where("id = ?", item.GrantId).First(&grant).Error; err != nil {
				return err
			}
			refund := item.Count
			if refund > grant.UsedCount {
				refund = grant.UsedCount
			}
			if refund <= 0 {
				continue
			}
			if err := tx.Model(&FreeRequestGrant{}).Where("id = ? AND used_count >= ?", item.GrantId, refund).
				Update("used_count", gorm.Expr("used_count - ?", refund)).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func ExpireDueFreeRequestGrants(limit int) (int, error) {
	if limit <= 0 {
		limit = 500
	}
	now := GetDBTimestamp()
	res := DB.Model(&FreeRequestGrant{}).
		Where("status = ? AND end_time <= ?", FreeRequestGrantStatusActive, now).
		Limit(limit).
		Update("status", FreeRequestGrantStatusExpired)
	return int(res.RowsAffected), res.Error
}
