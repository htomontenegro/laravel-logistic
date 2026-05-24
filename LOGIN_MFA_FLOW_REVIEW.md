# Login & MFA Flow Review

## Flow Order Assessment ✓ CORRECT

The intended login → MFA flow **IS in the right order**:

```
1. User enters credentials at /login
2. Backend validates credentials
3. If user has MFA enabled → return temp_token + mfa_required flag
4. Frontend shows MfaVerify component
5. User enters MFA code
6. Backend verifies code using temp_token
7. Backend returns full auth_token
8. Frontend navigates to /dashboard
```

## Critical Implementation Issues ❌

### Issue 1: Wrong API Endpoint (CRITICAL)
**Location:** `client/src/api/mfaApi.ts:29`

```typescript
// ❌ WRONG - This endpoint doesn't exist
async verify(payload: MfaVerifyRequest): Promise<{ token: string, user: any }> {
    const response = await apiClient.post('/mfa/verify-mfa', payload);
    return response.data;
}
```

**Expected:** `routes/api.php:14` defines `/auth/verify-mfa`

**Fix:** Change the endpoint to `/auth/verify-mfa`

---

### Issue 2: Temp Token Not Used for MFA Verification (CRITICAL)
**Location:** `client/src/api/client.ts:11-18`

```typescript
// ❌ PROBLEM: Only checks for 'token', not 'temp_token'
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
});
```

**Why it fails:**
- Login returns `temp_token` for MFA verification (5-minute expiry)
- Login stores: `localStorage.setItem('temp_token', response.data.temp_token)`
- But apiClient only looks for `token` in localStorage
- MFA verification endpoint gets no Authorization header → 401 error

**Fix:** Update apiClient to check for temp_token when regular token doesn't exist:

```typescript
// ✓ Check for either temp_token or regular token
const token = localStorage.getItem('token') || localStorage.getItem('temp_token');
```

---

### Issue 3: MfaVerify Component Can't Find Temp Token (MEDIUM)
**Location:** `client/src/components/MfaVerify.tsx:16`

```typescript
// ❌ Checks location.state, but Login.tsx doesn't pass it
const tempToken = location.state?.tempToken;
if (!tempToken) {
    return <div>Invalid session. Please login again.</div>;
}
```

**Why it fails:**
- `Login.tsx` stores temp_token in localStorage (line 31)
- But renders `<MfaVerify />` directly without navigation
- `useLocation()` has no state from route transition
- Component shows error instead of verifying MFA

**Why this doesn't cause a hard failure:**
- apiClient interceptor doesn't use it (Issue 2)
- But it should still be fixed for proper session handling

**Fix:** Update MfaVerify to check localStorage instead of location.state:

```typescript
// ✓ Check both sources
const tempToken = location.state?.tempToken || localStorage.getItem('temp_token');
```

---

## Testing the Flow

After fixes, test this sequence:

1. **Create a user with MFA:**
   - Register at `/register`
   - Go to dashboard → setup MFA
   - Disable MFA to reset

2. **Test login with MFA:**
   - Login with MFA-enabled account
   - Should see MfaVerify component
   - Enter valid TOTP code or backup code
   - Should navigate to dashboard

3. **Test login without MFA:**
   - Login with MFA-disabled account
   - Should skip MfaVerify and go straight to dashboard

---

## Implementation Checklist

- [ ] **Issue 1:** Change `/mfa/verify-mfa` → `/auth/verify-mfa` in mfaApi.ts
- [ ] **Issue 2:** Update apiClient.ts to check for temp_token fallback
- [ ] **Issue 3:** Update MfaVerify.tsx to check localStorage if location.state missing
- [ ] Test login without MFA enabled
- [ ] Test login with MFA enabled → verify with TOTP code
- [ ] Test login with MFA enabled → verify with backup code
- [ ] Verify tokens are cleared properly on logout
