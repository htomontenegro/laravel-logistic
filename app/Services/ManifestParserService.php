<?php

namespace App\Services;

use PhpOffice\PhpSpreadsheet\IOFactory;

class ManifestParserService
{
    public function parse(string $filePath): array
    {
        $spreadsheet = IOFactory::load($filePath);
        $rows = $spreadsheet->getActiveSheet()->toArray(null, true, true, true);

        array_shift($rows); // Remove header row

        $valid = [];
        $invalid = [];

        foreach ($rows as $lineNumber => $row) {
            $zone = trim($row['A'] ?? '');
            $weightFrom = $row['B'];
            $weightTo = $row['C'];
            $pricePerKg = $row['D'];
            $baseRate = $row['E'];

            $error = $this->validateRow($zone, $weightFrom, $weightTo, $pricePerKg, $baseRate);

            if ($error) {
                $invalid[] = [
                    'row' => $lineNumber + 1,
                    'reason' => $error
                ];
                continue;
            }

            $valid[] = [
                'zone' => $zone,
                'weight_from' => $weightFrom,
                'weight_to' => $weightTo,
                'price_per_kg' => $pricePerKg,
                'base_rate' => $baseRate,
            ];
        }

        return [
            'valid' => $valid,
            'invalid' => $invalid
        ];
    }

    private function validateRow(mixed $zone, mixed $weightFrom, mixed $weightTo, mixed $pricePerKg, mixed $baseRate): ?string
    {
        if (empty($zone)) {
            return 'Row rejected when `zone` is empty';
        }

        if (!is_numeric($weightFrom) || !is_numeric($weightTo)) {
            return 'Row rejected when weight_from or weight_to is not numeric';
        }

        if ((float) $weightFrom >= (float) $weightTo) {
            return 'Row rejected when weight_from > weight_to';
        }

        if (!is_numeric($pricePerKg) || (float) $pricePerKg <= 0) {
            return 'Row rejected when price_per_kg or base_rate is not numeric';
        }

        return null;
    }
}
