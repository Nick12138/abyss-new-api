package middleware

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func FreeRequestGrantLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		setting := model.GetFreeRequestGrantSetting()
		if !setting.Enabled || setting.Group == "" {
			c.Next()
			return
		}
		if _, ok := common.GetContextKey(c, constant.ContextKeyChannelId); !ok {
			c.Next()
			return
		}

		group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
		if autoGroup := common.GetContextKeyString(c, constant.ContextKeyAutoGroup); autoGroup != "" {
			group = autoGroup
		}
		if group == "" {
			group = common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
		}
		if group == "" {
			group = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
		}
		if group != setting.Group {
			c.Next()
			return
		}

		modelName := common.GetContextKeyString(c, constant.ContextKeyOriginalModel)
		if modelName == "" {
			modelName = c.GetString("original_model")
		}
		deductCount := model.GetFreeRequestGrantDeductCount(modelName)

		userId := c.GetInt("id")
		reservation, err := model.ReserveFreeRequestGrant(userId, group, deductCount)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "free_request_grant_check_failed")
			return
		}
		if reservation == nil {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("%s分组免费请求次数不足", setting.Group))
			return
		}

		common.SetContextKey(c, constant.ContextKeyFreeRequestGrantReserved, true)

		c.Next()

		if c.Writer.Status() >= http.StatusBadRequest {
			if err := model.RefundFreeRequestGrantReservation(reservation); err != nil {
				common.SysLog(fmt.Sprintf("failed to refund free request grant reservation: user_id=%d grant_id=%d err=%s", userId, reservation.GrantId, err.Error()))
			}
			return
		}
		if err := model.ConfirmFreeRequestGrantReservation(reservation); err != nil {
			common.SysLog(fmt.Sprintf("failed to confirm free request grant reservation: user_id=%d grant_id=%d err=%s", userId, reservation.GrantId, err.Error()))
		}
	}
}
