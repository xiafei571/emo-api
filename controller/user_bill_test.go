package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserBillValidatesRangesAndPreventsAccessToPeerAccounts(t *testing.T) {
	db := setupManageUserTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.TopUp{}, &model.Redemption{}))
	user := model.User{Username: "bill-target", Role: common.RoleAdminUser}
	require.NoError(t, db.Create(&user).Error)
	for _, tt := range []struct {
		name, query, target string
		role, status        int
	}{
		{"peer denied", "start_date=2026-04-01&end_date=2026-09-30", fmt.Sprint(user.Id), common.RoleAdminUser, http.StatusForbidden},
		{"non-admin denied", "start_date=2026-04-01&end_date=2026-09-30", fmt.Sprint(user.Id), common.RoleCommonUser, http.StatusForbidden},
		{"root can read", "start_date=2026-04-01&end_date=2026-09-30", fmt.Sprint(user.Id), common.RoleRootUser, http.StatusOK},
		{"non-admin cannot read own bill without target", "start_date=2026-04-01&end_date=2026-09-30", "", common.RoleCommonUser, http.StatusForbidden},
		{"missing target cannot fall back to own bill", "start_date=2026-04-01&end_date=2026-09-30", "", common.RoleRootUser, http.StatusBadRequest},
		{"reversed range", "start_date=2026-09-30&end_date=2026-04-01", fmt.Sprint(user.Id), common.RoleRootUser, http.StatusBadRequest},
		{"over six months", "start_date=2026-01-01&end_date=2026-09-30", fmt.Sprint(user.Id), common.RoleRootUser, http.StatusBadRequest},
		{"invalid date", "start_date=2026-02-30&end_date=2026-03-01", fmt.Sprint(user.Id), common.RoleRootUser, http.StatusBadRequest},
		{"invalid timezone", "start_date=2026-04-01&end_date=2026-09-30&timezone=Invalid", fmt.Sprint(user.Id), common.RoleRootUser, http.StatusBadRequest},
		{"invalid ID", "start_date=2026-04-01&end_date=2026-09-30", "-1", common.RoleRootUser, http.StatusBadRequest},
	} {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodGet, "/?"+tt.query, nil)
			c.Set("id", user.Id)
			c.Set("role", tt.role)
			if tt.target != "" {
				c.Params = gin.Params{{Key: "id", Value: tt.target}}
			}
			GetUserBill(c)
			assert.Equal(t, tt.status, recorder.Code)
			if tt.status == http.StatusOK {
				assert.Contains(t, recorder.Body.String(), `"success":true`)
				assert.Contains(t, recorder.Body.String(), fmt.Sprintf(`"user_id":%d`, user.Id))
			}
		})
	}
}
