# Session contract

`GET /auth/me` requires a valid access JWT and returns `{ userId, email, name, role }` from the current verified database account. Browser clients use this endpoint for role information; access and refresh credentials remain in HttpOnly proxy cookies.

`POST /auth/logout` accepts `{ refreshToken }`, requires no access JWT, and returns HTTP 200 with `{ success: true }`. It revokes only the matching refresh token, and is idempotent when the token is already invalid. The frontend proxy supplies the token from its HttpOnly cookie and clears both cookies. A revoked access JWT still works until its short expiration; logout prevents renewal. The same access-token lifetime applies after a password reset or unverification.

`POST /auth/refresh` rotates refresh credentials using a conditional database update. Of concurrent requests presenting the same token, at most one returns credentials. A losing request receives HTTP 401. There is no cross-instance grace/retry window in this implementation: a losing proxy response can clear the browser cookies after a successful concurrent response, requiring another sign-in. This fails closed; it does not share identities or reuse old credentials. The proxy should coalesce refreshes for a single session where possible. Password reset and unverification clear stored refresh credentials in the same write as the account change; an in-flight rotation cannot restore them.

Login also checks the validated password hash, verification state, and role at session persistence time, and fails if they changed while the token issuer was running. Login and refresh do not return credentials when session persistence fails.

The existing schema still stores **one refresh token per user**, so a new login replaces earlier device/application refresh sessions. Refresh tokens are currently stored directly in the existing columns. Independent sessions, hashed refresh storage, shared throttling across API instances, and immediate access-token revocation require subsequent work. No schema migration is introduced here.

Local tests cover real HTTP authentication and throttle behavior with generated keys and a loopback JWKS server. Rotation/revocation race tests use a stateful database substitute, not a live PostgreSQL server.

Optional-auth reads allow absent credentials, but malformed/expired supplied credentials return 401 so the proxy can refresh. Read visibility checks use current verified database roles, including for drafts and moderated comments.
