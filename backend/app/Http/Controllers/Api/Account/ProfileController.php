<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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

        return $user->only('id', 'name', 'email') + ['login_id' => $user->membership?->login_id];
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
