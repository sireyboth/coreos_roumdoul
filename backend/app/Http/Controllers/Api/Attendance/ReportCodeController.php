<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\LeaveType;
use App\Support\ReportCodes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Attendance → Status codes: how every status looks, in one place. Day
 * statuses and leave types come and go together, so every screen loads them
 * with one call. Everyone who sees attendance reads them; managers change them.
 */
class ReportCodeController extends Controller
{
    public function show(Request $request)
    {
        return $this->current($request);
    }

    /**
     * The whole page at once: {"statuses": {"P": {code, color, text, bold}, …},
     * "leave": {"<leave type id>": {code, color, text, bold}, …}} (leave optional).
     */
    public function update(Request $request)
    {
        $statuses = array_keys(ReportCodes::DEFAULTS);
        $types = LeaveType::query()->get()->keyBy('id');

        $request->merge(['statuses' => $this->upper($request->input('statuses')), 'leave' => $this->upper($request->input('leave'))]);
        $look = fn (string $prefix, array $colors) => [
            "$prefix.code" => ['required', 'string', 'max:3', 'regex:/^[\p{L}\p{M}\p{N}]+$/u', Rule::notIn(['LV'])],
            "$prefix.color" => ['required', Rule::in($colors)],
            "$prefix.text" => ['required', Rule::in(ReportCodes::TEXT_COLORS)],
            "$prefix.bold" => ['required', 'boolean'],
        ];
        $data = $request->validate([
            'statuses' => ['required', 'array:'.implode(',', $statuses)],
            ...collect($statuses)->flatMap(fn (string $s) => ["statuses.$s" => ['required', 'array'], ...$look("statuses.$s", ReportCodes::COLORS)])->all(),
            'leave' => ['sometimes', 'array:'.$types->keys()->implode(',')],
            // Only the types sent; the others keep their look.
            ...$types->keys()->intersect(array_keys((array) $request->input('leave', [])))
                ->flatMap(fn (int $id) => ["leave.$id" => ['array'], ...$look("leave.$id", LeaveType::COLORS)])->all(),
        ]);

        $leave = $data['leave'] ?? [];
        $this->assertNoClash($data['statuses'], $leave, $types->all());

        $company = $this->company($request);
        DB::transaction(function () use ($company, $data, $leave, $types) {
            $company->update(['report_codes' => collect($data['statuses'])->map(fn (array $row) => [
                'code' => $row['code'], 'color' => $row['color'], 'text' => $row['text'], 'bold' => (bool) $row['bold'],
            ])->all()]);

            foreach ($leave as $id => $row) {
                $types->get($id)->update([
                    'report_code' => $row['code'], 'color' => $row['color'],
                    'text_color' => $row['text'] === 'auto' ? null : $row['text'], 'bold' => (bool) $row['bold'],
                ]);
            }
        });

        return $this->current($request);
    }

    /** Back to P, L, E… and AL, SL… in their usual colours; a company's own leave types keep their codes. */
    public function destroy(Request $request)
    {
        $company = $this->company($request);
        DB::transaction(function () use ($company) {
            $company->update(['report_codes' => null]);
            foreach (LeaveType::query()->get() as $type) {
                [$code, $color] = ReportCodes::LEAVE_DEFAULTS[$type->code] ?? [$type->report_code, 'violet'];
                $type->update(['report_code' => $code, 'color' => $color, 'text_color' => null, 'bold' => true]);
            }
        });

        return $this->current($request);
    }

    private function current(Request $request): array
    {
        return ['statuses' => ReportCodes::forCompany($this->company($request)), 'leave' => ReportCodes::leaveFor()];
    }

    private function company(Request $request): Company
    {
        return Company::query()->findOrFail($request->user()->company_id);
    }

    /** "lt" and "Lt" are the same code as "LT"; Khmer has no case and stays as typed. */
    private function upper(mixed $rows): mixed
    {
        if (! is_array($rows)) {
            return $rows;
        }

        return array_map(fn ($row) => is_array($row) && is_string($row['code'] ?? null) ? [...$row, 'code' => mb_strtoupper(trim($row['code']))] : $row, $rows);
    }

    /**
     * One code, one meaning: no two statuses or leave types may share one —
     * "AL" can't mean both late and annual leave. Leave types not sent keep
     * their code, so they count too.
     *
     * @param  array<int, LeaveType>  $types
     */
    private function assertNoClash(array $statuses, array $leave, array $types): void
    {
        $owners = [];
        foreach ($types as $id => $type) {
            $code = $leave[$id]['code'] ?? $type->report_code;
            if ($code !== null) {
                $owners[$code][] = ["leave.$id.code", $type->name];
            }
        }
        foreach ($statuses as $status => $row) {
            $owners[$row['code']][] = ["statuses.$status.code", null];
        }

        $errors = [];
        foreach ($owners as $code => $users) {
            if (count($users) < 2) {
                continue;
            }
            $leaveName = collect($users)->pluck(1)->filter()->first();
            foreach ($users as [$field]) {
                $errors[$field] = [$leaveName
                    ? __(':code is already the code of :leave.', ['code' => $code, 'leave' => $leaveName])
                    : __(':code is already used for another status.', ['code' => $code])];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
