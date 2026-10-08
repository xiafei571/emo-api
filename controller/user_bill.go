package controller

import (
	"net/http"
	"strconv"
	"time"
	_ "time/tzdata"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetUserBill(c *gin.Context) {
	if c.GetInt("role") < common.RoleAdminUser {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Permission denied"})
		return
	}
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || userID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid user ID"})
		return
	}
	user, err := model.GetUserById(userID, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !canManageTargetRole(c.GetInt("role"), user.Role) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Permission denied"})
		return
	}
	location, err := time.LoadLocation(c.DefaultQuery("timezone", "Asia/Shanghai"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid timezone"})
		return
	}
	start, startErr := time.ParseInLocation(time.DateOnly, c.Query("start_date"), location)
	endDate, endErr := time.ParseInLocation(time.DateOnly, c.Query("end_date"), location)
	end := endDate.AddDate(0, 0, 1)
	if startErr != nil || endErr != nil || start.Year() < 1970 || endDate.Before(start) || endDate.After(start.AddDate(0, 6, 0)) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Select valid dates within six months"})
		return
	}
	bill, err := model.GetUserBill(c.Request.Context(), userID, start, end, location)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": bill})
}
