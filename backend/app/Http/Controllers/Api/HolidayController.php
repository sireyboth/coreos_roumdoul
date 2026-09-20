<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Holiday;
use Illuminate\Http\Request;

class HolidayController extends Controller
{
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

        return response()->json(Holiday::query()->create($data), 201);
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
        }

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

        $holiday->update($data);

        return $holiday;
    }

    public function destroy(Holiday $holiday)
    {
        $holiday->delete();

        return response()->noContent();
    }
}
