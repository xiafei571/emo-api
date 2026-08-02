package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBuildEmailVerificationMessage(t *testing.T) {
	subject, content := buildEmailVerificationMessage("EMO API", "876448", 10)

	assert.Equal(t, "EMO API Email Verification", subject)
	assert.Equal(t, "<p>Hello,</p><p>Use the following verification code to verify your email address for EMO API:</p><p><strong>876448</strong></p><p>This code expires in 10 minutes. If you did not request it, you can safely ignore this email.</p>", content)
}

func TestBuildPasswordResetMessage(t *testing.T) {
	resetLink := "https://api.semo.one/user/reset?email=user@example.com&token=reset-token"
	subject, content := buildPasswordResetMessage("EMO API", resetLink, 10)

	assert.Equal(t, "EMO API Password Reset", subject)
	assert.Equal(t, "<p>Hello,</p><p>We received a request to reset your password for EMO API.</p><p><a href=\"https://api.semo.one/user/reset?email=user@example.com&amp;token=reset-token\">Reset your password</a></p><p>If the link does not work, copy and paste this URL into your browser:</p><p>https://api.semo.one/user/reset?email=user@example.com&amp;token=reset-token</p><p>This link expires in 10 minutes. If you did not request a password reset, you can safely ignore this email.</p>", content)
}
