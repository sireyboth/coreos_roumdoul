<?php

namespace App\Services;

use App\Models\Company;
use App\Models\UsageRecord;

/**
 * Appends a point-in-time reading of a metric for a company. Called whenever
 * something that plan limits care about changes (employee count today;
 * branch count, storage, etc. can call this the same way later) so usage
 * can be reviewed over time instead of only "right now".
 */
class UsageRecorder
{
    public static function record(Company $company, string $metric, int $value): UsageRecord
    {
        return UsageRecord::query()->create([
            'company_id' => $company->id,
            'metric' => $metric,
            'value' => $value,
            'recorded_at' => now(),
        ]);
    }
}
