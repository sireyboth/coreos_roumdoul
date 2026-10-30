<?php

namespace App\Http\Controllers\Api\Account;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class ProfileController extends Controller
{
    public function update(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            // Someone who signs in with an employee ID has no email to lose, so it's optional for them.
            'email' => [$user->membership?->login_id !== null ? 'nullable' : 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'current_password' => ['nullable', 'string'],
            // Optional, so older apps that don't send it change nothing.
            'nickname' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        // The email is how you sign in, so replacing it needs your password —
        // otherwise a stolen session could lock the owner out. Adding a first
        // one (someone who signs in by employee ID) takes nothing away.
        if ($user->email !== null && ($data['email'] ?? null) !== $user->email && ! Hash::check((string) ($data['current_password'] ?? ''), $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => [__('Enter your current password to change your email.')],
            ]);
        }

        $user->update(collect($data)->only(['name', 'email'])->all());

        // Your nickname lives on your own employee record (no HR permission needed).
        // Only that record, never one picked by id; the change is audit-logged like any employee edit.
        $employee = Employee::query()->where('user_id', $user->id)->first();
        if ($employee && array_key_exists('nickname', $data)) {
            $employee->update(['nickname' => filled($data['nickname']) ? trim($data['nickname']) : null]);
        }

        return $user->only('id', 'name', 'email') + ['login_id' => $user->membership?->login_id, 'nickname' => $employee?->nickname];
    }

    public function updatePassword(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => [__('The current password is incorrect.')],
            ]);
        }

        $user->update(['password' => $data['password']]);

        // Signs out every other device, so whoever knew the old password is out.
        $current = $user->currentAccessToken();
        $user->tokens()->when($current instanceof PersonalAccessToken, fn ($q) => $q->whereKeyNot($current->getKey()))->delete();

        return response()->json(['message' => __('Password updated.')]);
    }
}
