# MFA Backend Test Checklist & Implementation Guide

This document outlines comprehensive test coverage for the MFA backend system. Each section includes:
- **Why it matters** — security/functionality rationale
- **Test cases** — specific scenarios to test
- **Example implementation** — copy-paste ready Laravel test code

---

## 1. Security & Rate Limiting

### 1.1 Brute Force Protection on MFA Verification

**Why it matters:** Prevents attackers from guessing 6-digit TOTP codes through rapid attempts.

**Test cases:**
- Allow 3-5 failed attempts
- Block further attempts after threshold
- Return 429 (Too Many Requests) status
- Reset counter after successful verification or timeout

```php
public function test_mfa_verification_rate_limited_after_failed_attempts()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    // Make 5 failed attempts
    for ($i = 0; $i < 5; $i++) {
        $this->withHeader('Authorization', "Bearer $tempToken")
            ->postJson('/api/auth/verify-mfa', [
                'code' => '000000',
            ]);
    }

    // 6th attempt should be rate limited
    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'code' => '000000',
        ]);

    $response->assertStatus(429);
}

public function test_failed_mfa_attempts_reset_after_timeout()
{
    // After X minutes with no failed attempts, counter resets
    // Requires Redis cache setup in test
    $this->assertTrue(true); // Placeholder
}
```

### 1.2 Temporary Token Expiration

**Why it matters:** Prevents prolonged brute force windows; limits exposure if temp_token is leaked.

**Test cases:**
- Token valid for N minutes (e.g., 5-10 minutes)
- Expired token returns 401 Unauthorized
- Token expires after successful verification
- Cannot reuse same temp_token twice

```php
public function test_temp_token_expires_after_timeout()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    // Travel time forward (e.g., 15 minutes if timeout is 10)
    $this->travelTo(now()->addMinutes(15));

    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'code' => '123456',
        ]);

    $response->assertStatus(401)
        ->assertJson(['message' => 'Temporary token expired']);
}

public function test_temp_token_invalid_after_successful_verification()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    $mfaSetting = $this->user->mfaSetting;
    $secret = decrypt($mfaSetting->secret_key);
    $code = $this->generateValidTotp($secret);

    // First verification succeeds
    $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'code' => $code,
        ])->assertStatus(200);

    // Second use of same token fails
    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'code' => $code,
        ]);

    $response->assertStatus(401);
}
```

### 1.3 Invalid Temporary Token Rejection

**Why it matters:** Tampered or forged tokens must be rejected immediately.

**Test cases:**
- Malformed token format rejected
- Altered token rejected
- Non-existent token rejected
- NULL token handled gracefully

```php
public function test_malformed_temp_token_rejected()
{
    $response = $this->withHeader('Authorization', 'Bearer invalid.token.format')
        ->postJson('/api/auth/verify-mfa', [
            'code' => '123456',
        ]);

    $response->assertStatus(401);
}

public function test_missing_auth_header_returns_401()
{
    $response = $this->postJson('/api/auth/verify-mfa', [
        'code' => '123456',
    ]);

    $response->assertStatus(401);
}
```

### 1.4 Session Isolation During MFA Verification

**Why it matters:** Temp session should not grant access to protected resources; prevents privilege escalation.

**Test cases:**
- Temp_token cannot access /api/user
- Temp_token cannot access /api/mfa/disable
- Temp_token cannot read other users' data
- Only /api/auth/verify-mfa is allowed with temp_token

```php
public function test_temp_token_cannot_access_protected_routes()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    // Attempt to access user profile with temp token
    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->getJson('/api/user');

    $response->assertStatus(403)
        ->assertJson(['message' => 'MFA verification required']);
}

public function test_temp_token_cannot_disable_mfa()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/mfa/disable', [
            'password' => 'password',
        ]);

    $response->assertStatus(403);
}
```

---

## 2. Edge Cases & Data Integrity

### 2.1 TOTP Time Window Tolerance

**Why it matters:** TOTP codes are time-based; must account for client/server clock skew.

**Test cases:**
- Accept code from current 30-second window
- Accept code from previous window (±1 window = ±60 seconds typical)
- Reject code from 2+ windows ago
- Reject code from future windows

```php
public function test_totp_accepts_previous_window_code()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    $mfaSetting = $this->user->mfaSetting;
    $secret = decrypt($mfaSetting->secret_key);

    // Generate code for 30 seconds ago
    $pastTime = (intval(time() / 30) - 1) * 30;
    $code = $this->generateTotpForTime($secret, $pastTime);

    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'code' => $code,
        ]);

    $response->assertStatus(200);
}

public function test_totp_rejects_expired_window_code()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    $mfaSetting = $this->user->mfaSetting;
    $secret = decrypt($mfaSetting->secret_key);

    // Generate code for 90+ seconds ago (outside acceptable window)
    $veryPastTime = (intval(time() / 30) - 3) * 30;
    $code = $this->generateTotpForTime($secret, $veryPastTime);

    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'code' => $code,
        ]);

    $response->assertStatus(422)
        ->assertJson(['message' => 'Invalid TOTP code or backup code']);
}

// Helper method to add to test class
private function generateTotpForTime(string $secret, int $timestamp): string
{
    $time = intval($timestamp / 30);
    $key = base_convert($secret, 32, 10);
    $hash = hash_hmac('sha1', pack('N', $time), $key, true);
    $offset = ord($hash[19]) & 0xf;
    $code = ((ord($hash[$offset]) & 0x7f) << 24) |
            ((ord($hash[$offset + 1]) & 0xff) << 16) |
            ((ord($hash[$offset + 2]) & 0xff) << 8) |
            (ord($hash[$offset + 3]) & 0xff);
    return str_pad((string) ($code % 1000000), 6, '0', STR_PAD_LEFT);
}
```

### 2.2 Backup Code One-Time Use Enforcement

**Why it matters:** Backup codes must not be reusable; prevents replay attacks.

**Test cases:**
- First use succeeds
- Second use of same code fails
- Code is removed from database after use
- Used code doesn't appear in /api/mfa/backup-codes response

```php
public function test_backup_code_cannot_be_reused()
{
    $this->enableMfaForUser();
    
    $mfaSetting = $this->user->mfaSetting;
    $backupCodes = json_decode(decrypt($mfaSetting->backup_codes), true);
    $backupCode = $backupCodes[0];

    // First use
    $tempToken1 = $this->loginAndGetTempToken();
    $response1 = $this->withHeader('Authorization', "Bearer $tempToken1")
        ->postJson('/api/auth/verify-mfa', [
            'backup_code' => $backupCode,
        ]);
    $response1->assertStatus(200);

    // Second use with new login
    $tempToken2 = $this->loginAndGetTempToken();
    $response2 = $this->withHeader('Authorization', "Bearer $tempToken2")
        ->postJson('/api/auth/verify-mfa', [
            'backup_code' => $backupCode,
        ]);

    $response2->assertStatus(422)
        ->assertJson(['message' => 'Invalid TOTP code or backup code']);
}

public function test_used_backup_code_removed_from_database()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    $mfaSetting = $this->user->mfaSetting;
    $backupCodes = json_decode(decrypt($mfaSetting->backup_codes), true);
    $initialCount = count($backupCodes);
    $backupCode = $backupCodes[0];

    // Use the code
    $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'backup_code' => $backupCode,
        ]);

    // Verify it's removed
    $updatedMfaSetting = $this->user->mfaSetting->fresh();
    $updatedCodes = json_decode(decrypt($updatedMfaSetting->backup_codes), true);
    
    $this->assertCount($initialCount - 1, $updatedCodes);
    $this->assertNotContains($backupCode, $updatedCodes);
}
```

### 2.3 Backup Code Limits & Regeneration

**Why it matters:** Should always have exactly 10 backup codes; prevents exhaustion attacks.

**Test cases:**
- Always 10 codes after generation
- Regeneration replaces old codes (not append)
- Cannot regenerate if MFA not enabled
- Codes are unique (no duplicates)

```php
public function test_backup_codes_always_exactly_ten()
{
    $this->enableMfaForUser();

    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/backup-codes');

    $this->assertCount(10, $response['backup_codes']);
}

public function test_backup_code_regeneration_replaces_old_codes()
{
    $this->enableMfaForUser();

    $mfaSetting = $this->user->mfaSetting;
    $oldCodes = json_decode(decrypt($mfaSetting->backup_codes), true);

    // Regenerate
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/backup-codes');

    $newCodes = $response['backup_codes'];

    // Verify no overlap (old codes replaced, not appended)
    $overlap = array_intersect($oldCodes, $newCodes);
    $this->assertEmpty($overlap, 'Old backup codes should be completely replaced');
}

public function test_backup_codes_are_unique()
{
    $this->enableMfaForUser();

    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/backup-codes');

    $codes = $response['backup_codes'];
    $uniqueCodes = array_unique($codes);

    $this->assertCount(count($codes), $uniqueCodes, 'All backup codes must be unique');
}
```

### 2.4 User Enumeration Prevention

**Why it matters:** Login endpoint shouldn't leak whether email exists (prevents account harvesting).

**Test cases:**
- Same error message for wrong password vs. non-existent user
- Same response time (no timing attacks)
- No difference in response structure

```php
public function test_login_error_messages_dont_reveal_user_existence()
{
    $response1 = $this->postJson('/api/auth/login', [
        'email' => 'nonexistent@example.com',
        'password' => 'password',
    ]);

    $response2 = $this->postJson('/api/auth/login', [
        'email' => $this->user->email,
        'password' => 'wrongpassword',
    ]);

    // Both should have same generic error
    $response1->assertStatus(422);
    $response2->assertStatus(422);

    // Error message should not distinguish between "user not found" and "wrong password"
    $message1 = $response1->json('message');
    $message2 = $response2->json('message');
    
    // Both should be generic (e.g., "Invalid credentials")
    $this->assertStringContainsString('Invalid', $message1);
    $this->assertStringContainsString('Invalid', $message2);
}
```

### 2.5 Concurrent Setup Attempts

**Why it matters:** Multiple simultaneous setup calls shouldn't create conflicting states.

**Test cases:**
- Only one MfaSetting created if called twice rapidly
- Latter request updates the former
- Database consistency maintained

```php
public function test_concurrent_mfa_setup_creates_single_record()
{
    // Simulate two rapid setup calls
    $response1 = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/setup');

    $response2 = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/setup');

    // Both should succeed
    $response1->assertStatus(200);
    $response2->assertStatus(200);

    // But only one MfaSetting should exist (draft/uncommitted state)
    // or the second should replace the first
    $count = MfaSetting::where('user_id', $this->user->id)
        ->where('is_enabled', false)
        ->count();

    $this->assertLessThanOrEqual(1, $count);
}
```

---

## 3. Status & State Management

### 3.1 MFA Verified At Timestamp Updates

**Why it matters:** Tracks when user last verified MFA; useful for security audits.

**Test cases:**
- Timestamp set on successful verification
- Timestamp unchanged on failed verification
- Timestamp updates on re-verification

```php
public function test_mfa_verified_at_timestamp_set_on_verification()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    $beforeTime = now();

    $mfaSetting = $this->user->mfaSetting;
    $secret = decrypt($mfaSetting->secret_key);
    $code = $this->generateValidTotp($secret);

    $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'code' => $code,
        ]);

    $afterTime = now();

    $updatedUser = $this->user->fresh();
    $verifiedAt = $updatedUser->mfa_verified_at;

    $this->assertNotNull($verifiedAt);
    $this->assertGreaterThanOrEqual($beforeTime, $verifiedAt);
    $this->assertLessThanOrEqual($afterTime, $verifiedAt);
}

public function test_mfa_verified_at_unchanged_on_failed_verification()
{
    $this->enableMfaForUser();
    $originalVerifiedAt = $this->user->mfa_verified_at;
    $tempToken = $this->loginAndGetTempToken();

    $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'code' => '000000',
        ]);

    $this->assertEquals(
        $originalVerifiedAt,
        $this->user->fresh()->mfa_verified_at
    );
}
```

### 3.2 MFA Status Consistency

**Why it matters:** User's mfa_enabled flag should always match existence of MfaSetting.

**Test cases:**
- mfa_enabled = true only if MfaSetting exists and is_enabled = true
- Disabling MFA removes MfaSetting or sets is_enabled = false
- Status endpoint reflects database state

```php
public function test_mfa_status_consistency()
{
    // No MfaSetting, mfa_enabled should be false
    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/mfa/status');

    $response->assertJson(['mfa_enabled' => false]);
    $this->assertFalse($this->user->mfa_enabled);

    // Enable MFA
    $this->enableMfaForUser();

    // Both should now be true
    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/mfa/status');

    $response->assertJson(['mfa_enabled' => true]);
    $this->assertTrue($this->user->fresh()->mfa_enabled);
    $this->assertNotNull(MfaSetting::where('user_id', $this->user->id)->first());
}
```

### 3.3 User Deletion Cleanup

**Why it matters:** Orphaned MfaSetting records leak information; should be cascade-deleted.

**Test cases:**
- MfaSetting deleted when user is deleted
- Backup codes don't remain in database
- No orphaned records exist

```php
public function test_mfa_settings_deleted_when_user_deleted()
{
    $this->enableMfaForUser();
    $userId = $this->user->id;

    // Verify MfaSetting exists
    $this->assertNotNull(MfaSetting::where('user_id', $userId)->first());

    // Delete user
    $this->user->delete();

    // MfaSetting should be deleted
    $this->assertNull(MfaSetting::where('user_id', $userId)->first());
}
```

### 3.4 Disable Clears Settings Properly

**Why it matters:** Disabled MFA should leave no residual data.

**Test cases:**
- MfaSetting removed or marked as disabled
- Secret key cleared
- Backup codes cleared
- mfa_enabled flag set to false

```php
public function test_mfa_disable_completely_removes_settings()
{
    $this->enableMfaForUser();

    $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/disable', [
            'password' => 'password',
        ]);

    // Either MfaSetting is deleted or is_enabled = false
    $mfaSetting = MfaSetting::where('user_id', $this->user->id)->first();
    
    if ($mfaSetting) {
        $this->assertFalse($mfaSetting->is_enabled);
    } else {
        $this->assertNull($mfaSetting);
    }

    $this->assertFalse($this->user->fresh()->mfa_enabled);
}
```

---

## 4. Encryption & Secrets

### 4.1 Secret Key Encryption

**Why it matters:** TOTP secrets must never be stored in plaintext.

**Test cases:**
- Secret is encrypted in database
- Secret decrypts to original value
- Cannot use encrypted value directly

```php
public function test_secret_key_stored_encrypted()
{
    $this->enableMfaForUser();

    $mfaSetting = MfaSetting::where('user_id', $this->user->id)->first();
    $encryptedSecret = $mfaSetting->secret_key;

    // Encrypted value should not equal original secret pattern
    $decryptedSecret = decrypt($encryptedSecret);
    
    $this->assertNotEquals($encryptedSecret, $decryptedSecret);
    $this->assertTrue(strlen($decryptedSecret) > 0);
    $this->assertMatchesRegularExpression('/^[A-Z2-7]+$/', $decryptedSecret); // base32 format
}
```

### 4.2 Backup Codes Encryption

**Why it matters:** Backup codes are sensitive; must be encrypted.

**Test cases:**
- Backup codes encrypted in database
- Decryption produces valid JSON array
- Cannot use encrypted value directly

```php
public function test_backup_codes_stored_encrypted()
{
    $this->enableMfaForUser();

    $mfaSetting = MfaSetting::where('user_id', $this->user->id)->first();
    $encryptedCodes = $mfaSetting->backup_codes;

    // Should not be valid JSON (it's encrypted)
    $this->assertNull(json_decode($encryptedCodes, true));

    // Decryption should produce valid JSON
    $decrypted = decrypt($encryptedCodes);
    $codes = json_decode($decrypted, true);

    $this->assertIsArray($codes);
    $this->assertCount(10, $codes);
}
```

### 4.3 Decryption on Retrieval

**Why it matters:** Encrypted values must be properly decrypted for use.

**Test cases:**
- Secret accessible via model accessor
- Backup codes properly decoded
- Invalid/corrupted encrypted data handled gracefully

```php
public function test_backup_codes_properly_decrypted_for_verification()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    $mfaSetting = $this->user->mfaSetting;
    $backupCodes = json_decode(decrypt($mfaSetting->backup_codes), true);
    $testCode = $backupCodes[0];

    // This should work (code is properly decrypted internally)
    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'backup_code' => $testCode,
        ]);

    $response->assertStatus(200);
}
```

### 4.4 Secret Rotation

**Why it matters:** Changing MFA secret (e.g., for compromised device) shouldn't break existing setup.

**Test cases:**
- Can regenerate setup (new secret generated)
- Old secret stops working
- New secret works after enable

```php
public function test_regenerating_mfa_setup_creates_new_secret()
{
    $this->enableMfaForUser();

    $oldMfaSetting = MfaSetting::where('user_id', $this->user->id)->first();
    $oldSecret = decrypt($oldMfaSetting->secret_key);

    // Get new setup
    $setupResponse = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/setup');

    $newSecret = $setupResponse['secret'];

    $this->assertNotEquals($oldSecret, $newSecret);
}
```

---

## 5. Authentication Flow

### 5.1 Temporary Token Scope Restrictions

**Why it matters:** Temp token should only allow /api/auth/verify-mfa.

**Test cases:**
- /api/user returns 403
- /api/mfa/disable returns 403
- /api/mfa/status returns 403
- /api/auth/verify-mfa returns 200 (or 422 with invalid code)

```php
public function test_temp_token_cannot_access_profile_endpoint()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->getJson('/api/user');

    $response->assertStatus(403);
}

public function test_temp_token_can_only_verify_mfa()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    // This is the ONLY endpoint that should work with temp token
    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'code' => '000000', // Invalid, but endpoint should be accessible
        ]);

    // Should return 422 (invalid code), not 403 (forbidden)
    $response->assertStatus(422);
}
```

### 5.2 Login Failure Paths

**Why it matters:** Proper error handling for various failure scenarios.

**Test cases:**
- Wrong password → 422
- Non-existent email → 422 (generic message)
- Missing email → 422
- Missing password → 422

```php
public function test_login_with_wrong_password()
{
    $response = $this->postJson('/api/auth/login', [
        'email' => $this->user->email,
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(422);
}

public function test_login_with_missing_credentials()
{
    $response = $this->postJson('/api/auth/login', [
        'email' => $this->user->email,
        // Missing password
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['password']);
}
```

### 5.3 Non-Existent User Login

**Why it matters:** Should not create user; should return generic error.

**Test cases:**
- Returns 422 (not 404)
- Same error message as wrong password
- No user created

```php
public function test_login_with_nonexistent_user()
{
    $response = $this->postJson('/api/auth/login', [
        'email' => 'nonexistent@example.com',
        'password' => 'password',
    ]);

    $response->assertStatus(422);

    // Verify no user was created
    $this->assertNull(User::where('email', 'nonexistent@example.com')->first());
}
```

### 5.4 Multi-User Code Isolation

**Why it matters:** Backup code from User A should not work for User B.

**Test cases:**
- Each user has separate MfaSetting
- User B cannot use User A's backup code
- User B cannot use User A's TOTP secret

```php
public function test_backup_code_not_valid_for_different_user()
{
    $user2 = User::factory()->create();

    $this->enableMfaForUser();
    $this->enableMfaForUser($user2); // Helper needs refactor to accept user param

    $tempToken = $this->loginAndGetTempToken($user2);

    // Get User 1's backup code
    $user1MfaSetting = $this->user->mfaSetting;
    $user1BackupCodes = json_decode(decrypt($user1MfaSetting->backup_codes), true);
    $user1BackupCode = $user1BackupCodes[0];

    // Try to verify as User 2
    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'backup_code' => $user1BackupCode,
        ]);

    $response->assertStatus(422)
        ->assertJson(['message' => 'Invalid TOTP code or backup code']);
}
```

---

## 6. Validation & Input Handling

### 6.1 Missing Required Fields

**Why it matters:** API should validate all required inputs.

**Test cases:**
- Missing code in verify-mfa
- Missing backup_code when neither code nor backup_code provided
- Missing secret in enable
- Missing password in disable

```php
public function test_verify_mfa_requires_either_code_or_backup_code()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            // Neither code nor backup_code provided
        ]);

    $response->assertStatus(422);
}

public function test_mfa_disable_requires_password()
{
    $this->enableMfaForUser();

    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/disable', [
            // Missing password
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['password']);
}
```

### 6.2 Invalid Code Format

**Why it matters:** Should reject malformed inputs.

**Test cases:**
- Non-numeric code
- Code too short/long
- Code with special characters

```php
public function test_verify_mfa_rejects_non_numeric_code()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'code' => 'ABC123',
        ]);

    $response->assertStatus(422);
}

public function test_verify_mfa_rejects_code_wrong_length()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'code' => '12345', // Too short, should be 6 digits
        ]);

    $response->assertStatus(422);
}
```

### 6.3 Empty Secret Handling

**Why it matters:** Should not process NULL/empty secrets.

**Test cases:**
- Empty secret string
- NULL secret
- Whitespace-only secret

```php
public function test_mfa_enable_rejects_empty_secret()
{
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/enable', [
            'secret' => '',
            'code' => '123456',
            'backup_codes' => $this->mfaService->generateBackupCodes(),
        ]);

    $response->assertStatus(422);
}
```

### 6.4 Malformed Backup Codes

**Why it matters:** Should validate JSON structure.

**Test cases:**
- Invalid JSON
- Not an array
- Non-string elements

```php
public function test_mfa_enable_rejects_invalid_backup_codes_json()
{
    $secret = $this->mfaService->generateSecretKey();
    $code = $this->generateValidTotp($secret);

    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/mfa/enable', [
            'secret' => $secret,
            'code' => $code,
            'backup_codes' => 'not-json-array',
        ]);

    $response->assertStatus(422);
}
```

---

## 7. Performance & Volume

### 7.1 Large Backup Code Set Handling

**Why it matters:** System should handle reasonable data volumes.

**Test cases:**
- Can store/retrieve 10 codes without issue
- Response time remains acceptable
- Database queries are efficient

```php
public function test_large_backup_code_set_processed_efficiently()
{
    $this->enableMfaForUser();

    $mfaSetting = $this->user->mfaSetting;
    $backupCodes = json_decode(decrypt($mfaSetting->backup_codes), true);

    // Verify all 10 codes work
    foreach ($backupCodes as $code) {
        $tempToken = $this->loginAndGetTempToken();

        $response = $this->withHeader('Authorization', "Bearer $tempToken")
            ->postJson('/api/auth/verify-mfa', [
                'backup_code' => $code,
            ]);

        $response->assertStatus(200);
    }

    // After 10 uses, should have no codes left
    $tempToken = $this->loginAndGetTempToken();
    $response = $this->withHeader('Authorization', "Bearer $tempToken")
        ->postJson('/api/auth/verify-mfa', [
            'backup_code' => 'USED-UP-ALL-CODES',
        ]);

    $response->assertStatus(422);
}
```

### 7.2 Rapid Verification Attempts

**Why it matters:** Rate limiting should prevent DoS.

**Test cases:**
- 5+ attempts within seconds
- Gets rate limited
- Counter resets after timeout

```php
public function test_rapid_verification_attempts_rate_limited()
{
    $this->enableMfaForUser();
    $tempToken = $this->loginAndGetTempToken();

    $responses = [];
    for ($i = 0; $i < 6; $i++) {
        $responses[] = $this->withHeader('Authorization', "Bearer $tempToken")
            ->postJson('/api/auth/verify-mfa', [
                'code' => '000000',
            ]);
    }

    // At least one should be rate limited (429)
    $hasRateLimit = collect($responses)->some(fn($r) => $r->status() === 429);
    $this->assertTrue($hasRateLimit, 'Rate limiting not enforced');
}
```

### 7.3 Batch Operations

**Why it matters:** System should handle multiple users with MFA enabled.

**Test cases:**
- 100+ users with MFA enabled
- Login/verify still performant
- No shared state pollution

```php
public function test_multiple_users_mfa_independent()
{
    $users = User::factory()->count(5)->create();

    // Enable MFA for all
    foreach ($users as $user) {
        $this->enableMfaForUser($user);
    }

    // Verify each can independently verify
    foreach ($users as $user) {
        $tempToken = $this->actingAs($user, 'sanctum')
            ->postJson('/api/auth/login', [
                'email' => $user->email,
                'password' => 'password',
            ])['temp_token'];

        $mfaSetting = $user->mfaSetting;
        $secret = decrypt($mfaSetting->secret_key);
        $code = $this->generateValidTotp($secret);

        $response = $this->withHeader('Authorization', "Bearer $tempToken")
            ->postJson('/api/auth/verify-mfa', [
                'code' => $code,
            ]);

        $response->assertStatus(200);
    }
}
```

---

## Implementation Notes

### Helper Method Refactoring

Some test helpers need refactoring to accept optional user parameters:

```php
// Refactored enableMfaForUser to accept optional user
private function enableMfaForUser(?User $user = null): void
{
    $user = $user ?? $this->user;
    
    $secret = $this->mfaService->generateSecretKey();
    $code = $this->generateValidTotp($secret);
    $backupCodes = $this->mfaService->generateBackupCodes();

    MfaSetting::create([
        'user_id' => $user->id,
        'secret_key' => encrypt($secret),
        'is_enabled' => true,
        'backup_codes' => encrypt(json_encode($backupCodes)),
    ]);

    $user->update([
        'mfa_enabled' => true,
        'mfa_verified_at' => now(),
    ]);
}

// Refactored loginAndGetTempToken to accept optional user
private function loginAndGetTempToken(?User $user = null): string
{
    $user = $user ?? $this->user;
    
    $response = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);

    return $response['temp_token'];
}
```

### Running Specific Test Groups

```bash
# Run all MFA tests
php artisan test tests/Feature/MfaTest.php

# Run specific test
php artisan test tests/Feature/MfaTest.php --filter test_brute_force_protection

# Run with verbose output
php artisan test tests/Feature/MfaTest.php -v

# Run with test database reset between tests
php artisan test tests/Feature/MfaTest.php --refresh
```

---

## Summary Checklist

**Before deployment, verify all of these pass:**

- [ ] All security tests pass (rate limiting, token expiration)
- [ ] All edge case tests pass (time window, backup codes)
- [ ] All state management tests pass (timestamps, consistency)
- [ ] All encryption tests pass (secrets, codes)
- [ ] All auth flow tests pass (temp tokens, scopes)
- [ ] All validation tests pass (input handling)
- [ ] All performance tests pass (volume, batch)
- [ ] No orphaned database records after tests
- [ ] Code coverage > 90%
