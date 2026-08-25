package auth

import (
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

var ErrInvalidToken = errors.New("invalid token")

type claims struct {
	jwt.RegisteredClaims
}

// ValidateToken verifies an HS256 access token against secret (the same
// JWT_ACCESS_SECRET the api service signs with) and returns the user id
// carried in the standard "sub" claim.
func ValidateToken(tokenString, secret string) (userID string, err error) {
	token, err := jwt.ParseWithClaims(tokenString, &claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}

	c, ok := token.Claims.(*claims)
	if !ok || !token.Valid || c.Subject == "" {
		return "", ErrInvalidToken
	}

	return c.Subject, nil
}
