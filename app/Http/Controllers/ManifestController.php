<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessManifestJob;
use App\Models\ManifestUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ManifestController extends Controller
{
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'carrier_id' => 'required|exists:carriers,id',
            'file' => 'required|file|mimes:xlsx|max:10240',
        ]);

        $uuid = Str::uuid();
        $s3Path     = "manifests/{$uuid}.xlsx";
        $file = $request->file('file');

        //Storage::disk('s3')->put($s3Path, file_get_contents($file->getRealPath()));
        Storage::disk('local')->put($s3Path, file_get_contents($file->getRealPath()));

        $manifest = ManifestUpload::create([
            'carrier_id' => $request->carrier_id,
            'original_filename' => $file->getClientOriginalName(),
            's3_path' => $s3Path,
            'status' => 'pending',
        ]);

        ProcessManifestJob::dispatch($manifest)->onQueue('manifests');

        return response()->json([
            'job_id' => $manifest->id,
            'status_url' => url("/api/manifests/{$manifest->id}/status"),

        ], 202);
    }

    public function status(ManifestUpload $manifest): JsonResponse
    {
        return response()->json([
            'status' => $manifest->status,
            'total_rows' => $manifest->total_rows,
            'valid_rows' => $manifest->valid_rows,
            'invalid_rows' => $manifest->invalid_rows ?? [],
        ]);
    }
}
