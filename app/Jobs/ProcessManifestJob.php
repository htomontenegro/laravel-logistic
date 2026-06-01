<?php

namespace App\Jobs;

use App\Models\ManifestUpload;
use App\Models\RateCard;
use App\Models\RateCardItem;

use App\Services\ManifestParserService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ProcessManifestJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public ManifestUpload $manifest) {}

    public function handle(ManifestParserService $parser): void
    {
        $this->manifest->update(['status' => 'processing']);

        try {
            $localPath = tempnam(sys_get_temp_dir(), 'manifest_');
            //file_put_contents($localPath, Storage::disk('s3')->get($this->manifest->s3_path));
            file_put_contents($localPath, Storage::disk('local')->get($this->manifest->s3_path));

            $result = $parser->parse($localPath);
            unlink($localPath);

            $validRows = $result['valid'];
            $invalidRows = $result['invalid'];


            DB::transaction(function () use ($validRows) {
                // soft-delete the carrier's current rate card
                RateCard::where('carrier_id', $this->manifest->carrier_id)
                    ->whereNull('deleted_at')
                    ->each(fn($src) => $src->delete());

                $rateCard = RateCard::create([
                    'carrier_id' => $this->manifest->carrier_id,
                    'valid_from' => now()->toDateString(),
                    'valid_to' => null,
                ]);

                $now = now();

                $items = array_map(fn($row) => array_merge($row, [
                    'rate_card_id' => $rateCard->id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]), $validRows);

                foreach (array_chunk($items, 500) as $chunk) {
                    RateCardItem::insert($chunk);
                }
            });

            $this->manifest->update([
                'status' => 'completed',
                'total_rows' => count($validRows) + count($invalidRows),
                'valid_rows' => count($validRows),
                'invalid_rows' => ($invalidRows) ?: null,
            ]);
        } catch (\Throwable $e) {
            $this->manifest->update(['status' => 'failed']);
            throw $e; // never swallow - let laravel log to failed jobs


        }
    }
}
