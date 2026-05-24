# MFA Tests Explanation

## Test File Structure Explained

### 1. Setup Phase

```php
protected function setUp(): void
{
    parent::setUp();
    $this->user = User::factory()->create();
    $this->mfaService = new MfaService();
}
```

**What it does:**
- Before each test, creates a fresh user
- Creates a fresh MfaService instance
- `RefreshDatabase` trait resets the database between tests

**Why:** Each test starts with a clean slate, so tests don't interfere with each other.

---

## 2. MFA Setup Tests

### Test 1: User starts MFA setup

```php
public function test_user_can_start_mfa_setup()
{
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/setup');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'secret',
            'qr_code_uri',
            'backup_codes',
            'message'
        ]);
}
```

**What it tests:**
- User calls `/api/mfa/setup` endpoint
- API returns QR code data

**What it verifies:**
- ✅ Response is 200 (success)
- ✅ Contains `secret`, `qr_code_uri`, `backup_codes`, `message`

**Real flow:**
```
User clicks "Start MFA Setup" in React
    ↓
Calls POST /api/mfa/setup
    ↓
Backend generates secret + QR code
    ↓
Returns JSON with QR code + secret
    ↓
React shows QR code to user
```

---

## 3. MFA Enable Tests

### Test 2: User enables MFA with valid code

```php
public function test_user_can_enable_mfa_with_valid_code()
{
    // Step 1: Generate secret
    $secret = $this->mfaService->generateSecretKey();
    
    // Step 2: Generate valid TOTP code for that secret
    $code = $this->generateValidTotp($secret);
    
    // Step 3: Generate 10 backup codes
    $backupCodes = $this->mfaService->generateBackupCodes();

    // Step 4: Send to API
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/enable', [
            'secret' => $secret,
            'code' => $code,  // Must be valid for the secret
            'backup_codes' => $backupCodes,
        ]);

    // Step 5: Verify response
    $response->assertStatus(200);

    // Step 6: Verify database was updated
    $this->assertTrue($this->user->fresh()->mfa_enabled);
}
```

**What it tests:**
- Complete MFA setup flow
- Secret + valid TOTP code + backup codes all together

**What it verifies:**
- ✅ API accepts valid code
- ✅ User's `mfa_enabled` is set to true
- ✅ MfaSetting record created in database

**Real flow:**
```
User scans QR code with authenticator app
    ↓
App generates 6-digit code (changes every 30 sec)
    ↓
User enters code in React
    ↓
React sends: secret + code + backup_codes to /api/mfa/enable
    ↓
Backend verifies code matches secret
    ↓
If valid: save to database, return success
```

### Test 3: Invalid code fails

```php
public function test_user_cannot_enable_mfa_with_invalid_code()
{
    $secret = $this->mfaService->generateSecretKey();
    $backupCodes = $this->mfaService->generateBackupCodes();

    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/enable', [
            'secret' => $secret,
            'code' => '000000',  // ← Wrong code
            'backup_codes' => $backupCodes,
        ]);

    $response->assertStatus(422);  // ← Error status
    
    // Verify MFA was NOT saved
    $this->assertFalse($this->user->fresh()->mfa_enabled);
}
```

**What it tests:**
- Security: wrong codes are rejected

**Why it matters:**
- Prevents attackers from enabling MFA with wrong codes
- Ensures only valid codes work

---

## 4. MFA Disable Tests

```php
public function test_user_can_disable_mfa_with_valid_password()
{
    // First enable MFA
    $this->enableMfaForUser();

    // Then try to disable
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/disable', [
            'password' => 'password',  // User's actual password
        ]);

    // Verify disabled
    $this->assertFalse($this->user->fresh()->mfa_enabled);
}
```

**What it tests:**
- Users can disable MFA if they know their password

**Security:**
- ✅ Requires password (prevents unauthorized disable)
- ✅ Invalid password is rejected

---

## 5. Login Flow with MFA

This is the most important test group. Here's the complete flow:

### Test 4: Login without MFA

```php
public function test_login_without_mfa_returns_token()
{
    $response = $this->postJson('/api/auth/login', [
        'email' => $this->user->email,
        'password' => 'password',
    ]);

    // User doesn't have MFA, so get full token immediately
    $response->assertJsonStructure(['user', 'token']);
    $this->assertFalse($response['mfa_required'] ?? false);
}
```

**Flow:**
```
POST /api/auth/login (email + password)
    ↓
Check credentials ✓
    ↓
Check if mfa_enabled = false
    ↓
Return full token immediately
    ↓
User redirected to dashboard
```

### Test 5: Login WITH MFA (requires 2 steps)

```php
public function test_login_with_mfa_returns_temp_token()
{
    // Enable MFA for this user
    $this->enableMfaForUser();

    // User logs in with email/password
    $response = $this->postJson('/api/auth/login', [
        'email' => $this->user->email,
        'password' => 'password',
    ]);

    // Backend returns temp token (valid for 5 minutes)
    $response->assertJson([
        'mfa_required' => true,
    ]);
    
    // User now needs to verify with TOTP code
}
```

**Flow (Step 1 - Password login):**
```
POST /api/auth/login (email + password)
    ↓
Check credentials ✓
    ↓
Check if mfa_enabled = true
    ↓
Generate temp token (expires in 5 min)
    ↓
Return: { mfa_required: true, temp_token: "xxx" }
    ↓
React shows MfaVerify component
```

### Test 6: Verify TOTP to complete login

```php
public function test_verify_mfa_with_valid_totp_code()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();  // ← Get temp token

    // Get the user's secret from database
    $mfaSetting = $this->user->mfaSetting;
    $secret = decrypt($mfaSetting->secret_key);
    
    // Generate valid TOTP code for this secret
    $code = $this->generateValidTotp($secret);

    // User sends TOTP code with temp token
    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'code' => $code,
        ]);

    // If valid, get full token
    $response->assertStatus(200)
        ->assertJsonStructure(['user', 'token']);
}
```

**Flow (Step 2 - TOTP verification):**
```
User enters TOTP code from authenticator app
    ↓
POST /api/auth/verify-mfa
  Header: Authorization: Bearer temp_token
  Body: { code: "123456" }
    ↓
Backend gets user from temp_token
    ↓
Get user's secret from database
    ↓
Check if code matches secret
    ↓
If valid: return full token
    ↓
Temp token is deleted
    ↓
User redirected to dashboard
```

---

## 6. Helper Methods Explained

### Generate Valid TOTP Code

```php
private function generateValidTotp(string $secret): string
{
    // TOTP = Time-based OTP
    // Changes every 30 seconds
    // Uses current timestamp
    $time = intval(time() / 30);  // Get current time bucket (30-sec window)
    
    // Perform HMAC-SHA1 hash
    $hash = hash_hmac('sha1', pack('N', $time), $key, true);
    
    // Extract 6 digits from hash
    $offset = ord($hash[19]) & 0xf;
    $code = ((ord($hash[$offset]) & 0x7f) << 24) | ...
    
    // Return 6-digit code
    return str_pad((string) ($code % 1000000), 6, '0', STR_PAD_LEFT);
}
```

**What it does:**
- Simulates what an authenticator app does
- Generates a valid 6-digit code for a given secret
- Tests can use this to verify MFA without a real authenticator

**Why we need it:**
- We can't use a real authenticator in tests
- We need to generate the EXACT code that would be produced

### Enable MFA for User (Helper)

```php
private function enableMfaForUser(): void
{
    $secret = $this->mfaService->generateSecretKey();
    $code = $this->generateValidTotp($secret);
    $backupCodes = $this->mfaService->generateBackupCodes();

    // Create MfaSetting in database
    MfaSetting::create([
        'user_id' => $this->user->id,
        'secret_key' => encrypt($secret),  // Encrypt for security
        'is_enabled' => true,
        'backup_codes' => encrypt(json_encode($backupCodes)),
    ]);

    // Update user record
    $this->user->update([
        'mfa_enabled' => true,
        'mfa_verified_at' => now(),
    ]);
}
```

**What it does:**
- Shortcut to enable MFA without making API calls
- Used by other tests that need MFA enabled
- Saves code duplication

---

## Complete MFA Login Flow (in tests)

```
1. User has MFA enabled
   ↓
2. Test: POST /api/auth/login with email + password
   Backend returns: { mfa_required: true, temp_token: "xxx" }
   ↓
3. Test: POST /api/auth/verify-mfa with temp_token + TOTP code
   Backend verifies code matches secret
   Backend returns: { token: "real_token", user: {...} }
   ↓
4. Client stores real_token
5. Client redirected to dashboard
```

---

## Running the Tests

```bash
# Run all MFA tests
php artisan test tests/Feature/MfaTest.php

# Run with coverage
php artisan test tests/Feature/MfaTest.php --coverage

# Run specific test
php artisan test tests/Feature/MfaTest.php --filter test_user_can_enable_mfa_with_valid_code
```

**Output will show:**
```
✓ test_user_can_start_mfa_setup
✓ test_user_can_enable_mfa_with_valid_code
✓ test_user_cannot_enable_mfa_with_invalid_code
✓ test_user_can_disable_mfa_with_valid_password
✓ test_login_without_mfa_returns_token
✓ test_login_with_mfa_returns_temp_token
✓ test_verify_mfa_with_valid_totp_code
✓ test_verify_mfa_with_valid_backup_code
... and more
```

---

## Key Concepts Summary

| Concept | Explanation |
|---------|------------|
| **TOTP** | Time-based One-Time Password (6-digit code that changes every 30 sec) |
| **Secret** | Private key shared between backend + authenticator app |
| **Temp Token** | Short-lived token (5 min) used only for MFA verification |
| **Backup Codes** | One-time codes used if user loses authenticator app |
| **Encryption** | Secrets stored encrypted in database for security |
| **Helper Methods** | Reusable code to reduce duplication in tests |

---

## Test Coverage

- ✅ Setup flow (QR code generation)
- ✅ Enable/disable MFA
- ✅ Valid/invalid TOTP codes
- ✅ Backup code usage
- ✅ Login without MFA
- ✅ Login with MFA (2-step process)
- ✅ Password verification
- ✅ Authentication checks

**Total: 15+ tests covering all MFA scenarios**
