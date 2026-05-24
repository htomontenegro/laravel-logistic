<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\MfaSetting;
use App\Services\MfaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use OTPHP\TOTP;
use Laravel\Sanctum\Sanctum;

class MfaTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private MfaService $mfaService;

    private function actingAsWithFullToken(): static
    {
        Sanctum::actingAs($this->user, ['*']);
    
        return $this;
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->mfaService = new MfaService();
    }

    // ===== MFA Setup Tests =====

    public function test_user_can_start_mfa_setup()
    {
        $response = $this->actingAsWithFullToken()
            ->postJson('/api/mfa/setup');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'secret',
                'qr_code_uri',
                'backup_codes',
                'message'
            ]);

        // Verify secret is 32 chars (base32 encoded)
        //$this->assertStringContainsString('secret', json_decode($response->getContent(), true));
    }

    public function test_mfa_setup_requires_authentication()
    {
        $response = $this->postJson('/api/mfa/setup');

        $response->assertStatus(401);
    }

    // ===== MFA Enable Tests =====

    public function test_user_can_enable_mfa_with_valid_code()
{
    $setup = $this->actingAsWithFullToken()
        ->postJson('/api/mfa/setup');

    $setup->assertStatus(200);
    $secret = $setup['secret'];
    $code = $this->generateValidTotp($secret);

    $response = $this->actingAsWithFullToken()
        ->postJson('/api/mfa/enable', [
            'code' => $code,
        ]);

    $response->assertStatus(200)
        ->assertJson([
            'message' => 'MFA enabled successfully',
            'mfa_enabled' => true,
        ]);

    $this->assertTrue($this->user->fresh()->mfa_enabled);
    $this->assertNotNull(MfaSetting::where('user_id', $this->user->id)->first());
}

    public function test_user_cannot_enable_mfa_with_invalid_code()
    {
        $setup = $this->actingAsWithFullToken()->postJson('/api/mfa/setup');
        $setup->assertStatus(200);
        
        $response = $this->actingAsWithFullToken()
            ->postJson('/api/mfa/enable', [
                'code' => '000000',
            ]);
    }

    public function test_mfa_enable_requires_valid_backup_codes_array()
    {
        $secret = $this->mfaService->generateSecretKey();
        $code = $this->generateValidTotp($secret);

        $response = $this->actingAsWithFullToken()
            ->postJson('/api/mfa/enable', [
                'secret' => $secret,
                'code' => $code,
                'backup_codes' => 'not-an-array', // Invalid
            ]);

        $response->assertStatus(422);
    }

    public function test_mfa_enable_requires_code()
{
    $this->actingAsWithFullToken()->postJson('/api/mfa/setup')->assertStatus(200);

    $response = $this->actingAsWithFullToken()
        ->postJson('/api/mfa/enable', []);

    $response->assertStatus(422);
}

    // ===== MFA Disable Tests =====

    public function test_user_can_disable_mfa_with_valid_password()
    {
        // First enable MFA
        $this->enableMfaForUser();

        $response = $this->actingAsWithFullToken()
            ->postJson('/api/mfa/disable', [
                'password' => 'password', // Default password from factory
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'MFA disabled successfully',
                'mfa_enabled' => false,
            ]);

        $this->assertFalse($this->user->fresh()->mfa_enabled);
    }

    public function test_user_cannot_disable_mfa_with_invalid_password()
    {
        $this->enableMfaForUser();

        $response = $this->actingAsWithFullToken()
            ->postJson('/api/mfa/disable', [
                'password' => 'wrong-password',
            ]);

        $response->assertStatus(422)
            ->assertJson(['message' => 'Invalid password']);

        // Verify MFA is still enabled
        $this->assertTrue($this->user->fresh()->mfa_enabled);
    }

    public function test_mfa_disable_requires_authentication()
    {
        $response = $this->postJson('/api/mfa/disable', [
            'password' => 'password',
        ]);

        $response->assertStatus(401);
    }

    // ===== MFA Status Tests =====

    public function test_user_can_check_mfa_status()
    {
        $this->enableMfaForUser();

        $response = $this->actingAsWithFullToken()
            ->getJson('/api/mfa/status');

        $response->assertStatus(200)
            ->assertJson([
                'mfa_enabled' => true,
            ])
            ->assertJsonStructure([
                'mfa_enabled',
                'mfa_verified_at',
            ]);
    }

    public function test_mfa_status_shows_disabled_by_default()
    {
        $response = $this->actingAsWithFullToken()
            ->getJson('/api/mfa/status');

        $response->assertStatus(200)
            ->assertJson(['mfa_enabled' => false]);
    }

    // ===== Backup Codes Tests =====

    public function test_user_can_regenerate_backup_codes()
    {
        $this->enableMfaForUser();

        $response = $this->actingAsWithFullToken()
        ->postJson('/api/mfa/backup-codes', [
            'password' => 'password',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'backup_codes',
                'message',
            ]);

        $this->assertCount(10, $response['backup_codes']);
    }

    public function test_cannot_regenerate_codes_if_mfa_not_enabled()
    {
        $response = $this->actingAsWithFullToken()
        ->postJson('/api/mfa/backup-codes', [
            'password' => 'password',
        ]);
    $response->assertStatus(422)
        ->assertJson(['message' => 'MFA is not enabled']);
    }

    // ===== Login with MFA Tests =====

    public function test_login_without_mfa_returns_token()
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => $this->user->email,
            'password' => 'password',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'user',
                'token',
                'message',
            ]);

        $this->assertFalse($response['mfa_required'] ?? false);
    }

    public function test_login_with_mfa_returns_temp_token()
    {
        $this->enableMfaForUser();

        $response = $this->postJson('/api/auth/login', [
            'email' => $this->user->email,
            'password' => 'password',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'mfa_required' => true,
                'message' => 'MFA verification required',
            ])
            ->assertJsonStructure(['temp_token']);
    }

    public function test_verify_mfa_with_valid_totp_code()
    {
        $this->enableMfaForUser();
        $tempToken = $this->loginAndGetTempToken();

        $mfaSetting = $this->user->mfaSetting;
        $secret = decrypt($mfaSetting->secret_key);
        $code = $this->generateValidTotp($secret);

        $response = $this->withHeader('Authorization', "Bearer $tempToken")
            ->postJson('/api/auth/verify-mfa', [
                'code' => $code,
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'user',
                'token',
                'message',
            ]);
    }

    public function test_verify_mfa_with_valid_backup_code()
    {
        $this->enableMfaForUser();
        $tempToken = $this->loginAndGetTempToken();

        $mfaSetting = $this->user->mfaSetting;
        $backupCodes = json_decode(decrypt($mfaSetting->backup_codes), true);
        $backupCode = $backupCodes[0];

        $response = $this->withHeader('Authorization', "Bearer $tempToken")
            ->postJson('/api/auth/verify-mfa', [
                'backup_code' => $backupCode,
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'user',
                'token',
            ]);

        // Verify backup code was removed (one-time use)
        $updatedCodes = json_decode(decrypt($mfaSetting->fresh()->backup_codes), true);
        $this->assertNotContains($backupCode, $updatedCodes);
    }

    public function test_verify_mfa_with_invalid_code_fails()
    {
        $this->enableMfaForUser();
        $tempToken = $this->loginAndGetTempToken();

        $response = $this->withHeader('Authorization', "Bearer $tempToken")
            ->postJson('/api/auth/verify-mfa', [
                'code' => '000000',
            ]);

        $response->assertStatus(422)
            ->assertJson(['message' => 'Invalid TOTP code or backup code']);
    }

    // ===== Helper Methods =====

    private function enableMfaForUser(): void
    {
        $secret = $this->mfaService->generateSecretKey();
        $code = $this->generateValidTotp($secret);
        $backupCodes = $this->mfaService->generateBackupCodes();

        MfaSetting::create([
            'user_id' => $this->user->id,
            'secret_key' => encrypt($secret),
            'is_enabled' => true,
            'backup_codes' => encrypt(json_encode($backupCodes)),
        ]);

        $this->user->update([
            'mfa_enabled' => true,
            'mfa_verified_at' => now(),
        ]);
    }

    private function loginAndGetTempToken(): string
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => $this->user->email,
            'password' => 'password',
        ]);

        return $response['temp_token'];
    }

    private function generateValidTotp(string $secret): string
    {
        return TOTP::create($secret)->now();
    }

  
}