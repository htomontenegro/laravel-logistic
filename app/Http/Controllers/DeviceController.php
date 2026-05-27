<?php

namespace App\Http\Controllers;

use App\Models\WhitelistedDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $devices = $request->user()
            ->whitelistedDevices()
            ->orderByDesc('last_used_at')
            ->get();

        return response()->json(['devices' => $devices]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $deleted = WhitelistedDevice::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Device not found'], 404);
        }

        return response()->json(['message' => 'Device removed']);
    }

    public function trust(Request $request): JsonResponse
    {
        $request->validate(['name' => 'nullable|string|max:100']);

        $user              = $request->user();
        $deviceFingerprint = $request->header('X-Device-Fingerprint', hash('sha256', $request->userAgent() ?? ''));

        $device = WhitelistedDevice::updateOrCreate(
            ['user_id' => $user->id, 'device_fingerprint' => $deviceFingerprint],
            [
                'name'         => $request->input('name'),
                'ip_address'   => $request->ip(),
                'last_used_at' => now(),
            ]
        );

        return response()->json(['message' => 'Device trusted', 'device' => $device]);
    }
}
