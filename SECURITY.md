# Security Review — OWASP Top 10 (2021)

Review of the Security+ study app (Spring Boot API + Angular SPA). Status as of this review,
with fixes applied in code and remaining hardening recommendations.

| # | Category | Status | Notes |
|---|----------|--------|-------|
| A01 | Broken Access Control | ✅ Pass | Every per-user endpoint derives the user from the JWT principal (`@AuthenticationPrincipal`), never from the request body — no IDOR. Admin routes require `ROLE_ADMIN`. All `/api/**` except `auth`/`status` require authentication. |
| A02 | Cryptographic Failures | ✅ Fixed | Passwords hashed with BCrypt. **Fixed:** JWT now rejects secrets < 32 bytes instead of zero-padding them (which destroyed entropy), and warns loudly if the built-in dev secret is used. |
| A03 | Injection | ✅ Pass | All persistence is Spring Data JPA derived/parameterized queries — no raw SQL, no string concatenation. No shell/OS command execution. |
| A04 | Insecure Design | ✅ Pass | Stateless JWT auth; per-session content de-duplication; ownership checks on mutations. |
| A05 | Security Misconfiguration | ✅ Fixed | **Fixed:** CORS no longer combines `allowCredentials(true)` with a wildcard origin, and defaults to localhost instead of `*`. Error responses no longer echo arbitrary exception messages (info disclosure) — generic message to client, full detail logged server-side. H2 console disabled; no Actuator dependency. |
| A06 | Vulnerable & Outdated Components | ⚠️ Action | Spring Boot **3.2.5** is behind on patches. Bump to the latest 3.2.x (3.2.x ≥ 3.2.12) or 3.3.x and run `mvn versions:display-dependency-updates`. (Not auto-applied: requires a network-enabled build to fetch artifacts.) jjwt 0.12.6 is current. |
| A07 | Identification & Auth Failures | ✅ Pass | Uniform "Invalid email or password" on login (no oracle on the password check). BCrypt. Tokens expire (7 days). Min password length 8. *Minor:* registration reveals whether an email exists ("Email already registered") — acceptable for this app; tighten if account privacy matters. |
| A08 | Software & Data Integrity | ✅ Pass | No untrusted deserialization (Jackson binds to fixed DTOs with `FAIL_ON_UNKNOWN_PROPERTIES=false`); no dynamic code loading. AI JSON is normalized then bound to typed models. |
| A09 | Logging & Monitoring Failures | ✅ Pass | Auth and generation failures are logged server-side; no secrets or passwords are logged. |
| A10 | SSRF | ✅ Pass | The only outbound call is to the fixed Anthropic API URL from config — no user-controlled URLs are fetched. |

## Fixes applied in this review

- **CORS** (`CorsConfig.java`): wildcard origin now forces `allowCredentials(false)`; default origin is localhost, not `*`.
- **JWT** (`JwtService.java`): rejects secrets shorter than 32 bytes; logs a SEVERE warning when the dev default secret is in use; key built once at construction.
- **Error handling** (`GlobalExceptionHandler.java`): catch-all returns a generic message and logs the real exception; added safe handlers for validation (400), access denied (403), and not-found (404).

## Operational hardening (deploy-time, outside the codebase)

1. **Set `JWT_SECRET`** to a unique random ≥ 32-char value. The app now warns if you don't.
2. **Set `CORS_ORIGINS`** to your real frontend origin(s) in production.
3. **Bump Spring Boot** to the latest patch (A06) on a network-enabled build.
4. **Rate-limit** the AI-generation endpoints (exam/practice/simplify) at the edge or with a bucket filter — they're expensive; without limits they're a cost/DoS vector.
5. **Add a Content-Security-Policy** header at the nginx layer. Spring Security already sends `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` by default.
6. **Serve over HTTPS only** and add HSTS at the edge.

## Notes on accepted low risks

- The frontend renders AI-generated explanation HTML via `[innerHTML]` (`bypassSecurityTrustHtml`). The content is generated server-side by Claude and cached — it is **not** user-supplied — so XSS risk is low. If user-generated HTML is ever rendered, sanitize with DOMPurify first.
- JWTs are stored in `localStorage` (standard for SPA + Bearer auth). There is no unsanitized user-content rendering path for an attacker to exploit it via XSS.
