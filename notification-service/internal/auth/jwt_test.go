package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret"

func signToken(t *testing.T, secret string, sub string, expiresAt time.Time, method jwt.SigningMethod) string {
	t.Helper()
	c := claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   sub,
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	token := jwt.NewWithClaims(method, c)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}
	return signed
}

func TestValidateToken_AcceptsAValidHS256Token(t *testing.T) {
	tok := signToken(t, testSecret, "user-1", time.Now().Add(time.Hour), jwt.SigningMethodHS256)

	userID, err := ValidateToken(tok, testSecret)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if userID != "user-1" {
		t.Fatalf("expected userID %q, got %q", "user-1", userID)
	}
}

func TestValidateToken_RejectsWrongSecret(t *testing.T) {
	tok := signToken(t, testSecret, "user-1", time.Now().Add(time.Hour), jwt.SigningMethodHS256)

	_, err := ValidateToken(tok, "wrong-secret")
	if err == nil {
		t.Fatal("expected an error for a token signed with a different secret")
	}
}

func TestValidateToken_RejectsExpiredToken(t *testing.T) {
	tok := signToken(t, testSecret, "user-1", time.Now().Add(-time.Hour), jwt.SigningMethodHS256)

	_, err := ValidateToken(tok, testSecret)
	if err == nil {
		t.Fatal("expected an error for an expired token")
	}
}

func TestValidateToken_RejectsNonHMACSigningMethod(t *testing.T) {
	// Regression guard: without pinning the accepted signing method, a token
	// forged with alg "none" or an asymmetric algorithm could bypass the
	// shared-secret check entirely.
	c := claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user-1",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodNone, c)
	signed, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("failed to sign none-alg token: %v", err)
	}

	_, err = ValidateToken(signed, testSecret)
	if err == nil {
		t.Fatal("expected alg=none token to be rejected")
	}
}

func TestValidateToken_RejectsMalformedToken(t *testing.T) {
	_, err := ValidateToken("not-a-jwt", testSecret)
	if err == nil {
		t.Fatal("expected an error for a malformed token")
	}
}

func TestValidateToken_RejectsEmptySubject(t *testing.T) {
	tok := signToken(t, testSecret, "", time.Now().Add(time.Hour), jwt.SigningMethodHS256)

	_, err := ValidateToken(tok, testSecret)
	if err == nil {
		t.Fatal("expected an error for a token with an empty subject")
	}
}
