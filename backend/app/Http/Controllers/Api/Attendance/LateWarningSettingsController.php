<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\Request;

/**
 * The company's late warning rule (attendance.manage): warn after N late days
 * a month (null = off), and whether leaving early counts too. Read through
 * /me's company; the warnings themselves are sent by LateWarningNotifier.
 */
class LateWarningSettingsController extends Controller
{
    public function update(Request $request)
    {
        $data = $request->validate([
            'late_warning_limit' => ['nullable', 'integer', 'between:1,31'],
            'late_warning_counts_early' => ['required', 'boolean'],
        ]);

        $company = $request->user()->company;
        $before = $company->only(array_keys($data));
        $company->update($data);

        AuditLogger::record('company.settings_updated', $company, $data, beforeData: $before);

        return $company->only(['id', 'late_warning_limit', 'late_warning_counts_early']);
    }
}
