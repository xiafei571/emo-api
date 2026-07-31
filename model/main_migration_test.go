package model

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestShouldRunMigrations(t *testing.T) {
	tests := []struct {
		name     string
		value    string
		expected bool
	}{
		{name: "defaults to enabled", expected: true},
		{name: "explicitly enabled", value: "true", expected: true},
		{name: "explicitly disabled", value: "false", expected: false},
		{name: "invalid value uses enabled default", value: "invalid", expected: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("RUN_MIGRATIONS", test.value)
			assert.Equal(t, test.expected, shouldRunMigrations())
		})
	}
}

func TestRunMigrationsWithoutPostgreSQLLock(t *testing.T) {
	expectedErr := errors.New("migration failed")
	calls := 0

	err := runMigrationsWithLock(nil, false, func() error {
		calls++
		return expectedErr
	})

	assert.ErrorIs(t, err, expectedErr)
	assert.Equal(t, 1, calls)
}
