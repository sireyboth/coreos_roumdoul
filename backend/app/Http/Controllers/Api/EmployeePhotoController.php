<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use GdImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Employee profile photos. They are personal data, so they live on the
 * private disk and are only reachable through short-lived signed links that
 * the API hands to people who can already see the employee (see
 * Employee::getPhotoUrlAttribute).
 */
class EmployeePhotoController extends Controller
{
    private const SIZE = 512;

    private const MAX_SIDE = 12000;

    private const MAX_PIXELS = 40_000_000;

    private function disk()
    {
        return Storage::disk('local');
    }

    public function store(Request $request, Employee $employee)
    {
        $request->validate([
            'photo' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
        ]);

        $bytes = $this->normalise(file_get_contents($request->file('photo')->getRealPath()));

        $path = "employee-photos/{$employee->company_id}/{$employee->id}-".Str::random(24).'.jpg';
        $this->disk()->put($path, $bytes);

        $old = $employee->photo_path;
        $employee->forceFill(['photo_path' => $path])->save();

        if ($old) {
            $this->disk()->delete($old);
        }

        return ['photo_url' => $employee->fresh()->photo_url];
    }

    public function destroy(Employee $employee)
    {
        if ($employee->photo_path) {
            $this->disk()->delete($employee->photo_path);
            $employee->forceFill(['photo_path' => null])->save();
        }

        return response()->noContent();
    }

    /**
     * Reached through a signed link (no login header — an <img> tag can't send
     * one). The `v` value ties the link to one specific photo, so a link to a
     * replaced or removed photo stops working straight away.
     */
    public function show(Request $request, int $employee)
    {
        // Explicitly unscoped: there is no logged-in user here; the signature is the proof.
        $employee = Employee::query()->withoutGlobalScopes()->findOrFail($employee);

        abort_unless(
            $employee->photo_path
                && hash_equals(basename($employee->photo_path, '.jpg'), (string) $request->query('v'))
                && $this->disk()->exists($employee->photo_path),
            404,
        );

        return $this->disk()->response($employee->photo_path, null, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Whatever was uploaded is decoded and re-drawn as a fresh 512x512 JPEG.
     * That drops metadata (phones embed GPS position in photos), fixes
     * rotation, and means a file that is not really an image, or that hides
     * something inside one, is never stored or served as-is.
     */
    private function normalise(string $raw): string
    {
        $info = @getimagesizefromstring($raw);

        if (! $info || $info[0] < 1 || $info[1] < 1) {
            throw ValidationException::withMessages(['photo' => ['That file is not a readable image.']]);
        }

        // Guards memory: a tiny file can decode into a gigantic bitmap.
        if ($info[0] > self::MAX_SIDE || $info[1] > self::MAX_SIDE || $info[0] * $info[1] > self::MAX_PIXELS) {
            throw ValidationException::withMessages(['photo' => ['That image is too large. Use a photo under about 40 megapixels.']]);
        }

        $source = @imagecreatefromstring($raw);

        if (! $source instanceof GdImage) {
            throw ValidationException::withMessages(['photo' => ['That file is not a readable image.']]);
        }

        $source = $this->applyExifRotation($source, $raw, $info[2] ?? 0);

        $width = imagesx($source);
        $height = imagesy($source);
        $side = min($width, $height);

        $canvas = imagecreatetruecolor(self::SIZE, self::SIZE);
        // Transparent PNG/WebP corners become white rather than black.
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        imagecopyresampled($canvas, $source, 0, 0, intdiv($width - $side, 2), intdiv($height - $side, 2), self::SIZE, self::SIZE, $side, $side);

        ob_start();
        imagejpeg($canvas, null, 85);

        return (string) ob_get_clean();
    }

    private function applyExifRotation(GdImage $image, string $raw, int $type): GdImage
    {
        if ($type !== IMAGETYPE_JPEG || ! function_exists('exif_read_data')) {
            return $image;
        }

        $exif = @exif_read_data('data://image/jpeg;base64,'.base64_encode($raw));
        $angle = match ($exif['Orientation'] ?? 1) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };

        return $angle === 0 ? $image : (imagerotate($image, $angle, 0) ?: $image);
    }
}
