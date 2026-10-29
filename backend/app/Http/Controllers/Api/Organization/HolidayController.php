<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Holiday;
use App\Services\Attendance\AttendanceRecorder;
use App\Services\Requests\EmployeeRequestService;
use Illuminate\Http\Request;

/**
 * Company holidays. Adding, moving or removing one changes what was expected
 * on that date for everyone, so days already started are recalculated.
 */
class HolidayController extends Controller
{
    public function __construct(private readonly AttendanceRecorder $recorder) {}

    public function index()
    {
        return Holiday::query()->orderBy('date')->paginate(50);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'date' => ['required', 'date'],
            'is_recurring_yearly' => ['boolean'],
        ]);

        $holiday = Holiday::query()->create($data);
        $this->recalculate($request, $this->datesOf($holiday));

        return response()->json($holiday, 201);
    }

    /**
     * Adds many holidays at once (e.g. the official Cambodian list for a
     * year). A date that already has a holiday is skipped, never duplicated
     * or overwritten — the admin may have renamed or adjusted it.
     */
    public function import(Request $request)
    {
        $data = $request->validate([
            'holidays' => ['required', 'array', 'min:1', 'max:100'],
            'holidays.*.name' => ['required', 'string', 'max:255'],
            'holidays.*.date' => ['required', 'date_format:Y-m-d', 'distinct'],
        ]);

        // whereDate (not a plain string compare) so this behaves the same on
        // every database regardless of how it stores the date column.
        $dates = collect($data['holidays'])->pluck('date');
        $existing = Holiday::query()
            ->whereDate('date', '>=', $dates->min())
            ->whereDate('date', '<=', $dates->max())
            ->get()
            ->map(fn (Holiday $h) => $h->date->toDateString())
            ->all();

        $created = 0;
        $skipped = [];
        $added = [];

        foreach ($data['holidays'] as $holiday) {
            if (in_array($holiday['date'], $existing, true)) {
                $skipped[] = $holiday['date'];

                continue;
            }

            // Lunar dates move every year, so imported holidays are one-offs.
            Holiday::query()->create([
                'name' => $holiday['name'],
                'date' => $holiday['date'],
                'is_recurring_yearly' => false,
            ]);
            $created++;
            $added[] = $holiday['date'];
        }

        $this->recalculate($request, $added);

        return ['created' => $created, 'skipped' => $skipped];
    }

    public function show(Holiday $holiday)
    {
        return $holiday;
    }

    public function update(Request $request, Holiday $holiday)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'date' => ['sometimes', 'date'],
            'is_recurring_yearly' => ['boolean'],
        ]);

        $before = $this->datesOf($holiday);
        $holiday->update($data);
        $this->recalculate($request, [...$before, ...$this->datesOf($holiday)]);

        return $holiday;
    }

    public function destroy(Request $request, Holiday $holiday)
    {
        $dates = $this->datesOf($holiday);
        $holiday->delete();
        $this->recalculate($request, $dates);

        return response()->noContent();
    }

    /** The dates a holiday falls on that can matter now: its own, and this year's for a yearly one. */
    private function datesOf(Holiday $holiday): array
    {
        $dates = [$holiday->date->toDateString()];

        if ($holiday->is_recurring_yearly) {
            $dates[] = now()->format('Y').'-'.$holiday->date->format('m-d');
        }

        return $dates;
    }

    private function recalculate(Request $request, array $dates): void
    {
        // Leave first: a day that became a holiday is no longer a leave day, then attendance follows.
        app(EmployeeRequestService::class)->recountForDates($request->user()->company_id, array_values(array_unique($dates)));
        $this->recorder->recalculateDatesForCompany($request->user()->company, $dates);
    }
}
