<?php

namespace App\Http\Controllers\Api\Access;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\Request;

/** Company-wide rules the company itself decides. Read through /me's company. */
class CompanySettingsController extends Controller
{
    public function update(Request $request)
    {
        $data = $request->validate([
            'allow_self_approval' => ['sometimes', 'boolean'],
        ]);

        $company = $request->user()->company;
        $before = $company->only(array_keys($data));
        $company->update($data);

        AuditLogger::record('company.settings_updated', $company, $data, beforeData: $before);

        return $company->only(['id', 'allow_self_approval']);
    }
}
