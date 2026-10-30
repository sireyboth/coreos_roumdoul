<?php

namespace App\Services\Employees;

use App\Models\Employee;
use GdImage;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Saves and removes employee profile photos. Used both by HR (an employee's
 * page) and by the employee themselves (their own profile), so the two
 * always store photos the same way.
 *
 * Photos are personal data: they live on the private uploads disk (always
 * S3) and are only reachable through short-lived signed links (see
 * Employee::getPhotoUrlAttribute).
 */
class EmployeePhotoService
{
    private const SIZE = 512;

    private const MAX_SIDE = 12000;

    private const MAX_PIXELS = 40_000_000;

    /** Validation rules for the uploaded `photo` field. */
    public const RULES = ['photo' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:8192']];

    private function disk(): Filesystem
    {
        return Storage::disk(config('filesystems.uploads'));
    }

    /** Stores the new photo, then deletes the old file (if any). */
    public function replace(Employee $employee, UploadedFile $photo): void
    {
        $bytes = $this->normalise((string) file_get_contents($photo->getRealPath()));

        $path = "employee-photos/{$employee->company_id}/{$employee->id}-".Str::random(24).'.jpg';
        $this->disk()->put($path, $bytes);

        $old = $employee->photo_path;
        $employee->forceFill(['photo_path' => $path])->save();

        if ($old) {
            $this->disk()->delete($old);
        }
    }

    public function remove(Employee $employee): void
    {
        if ($employee->photo_path) {
            $this->disk()->delete($employee->photo_path);
            $employee->forceFill(['photo_path' => null])->save();
        }
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
            throw ValidationException::withMessages(['photo' => [__('That file is not a readable image.')]]);
        }

        // Guards memory: a tiny file can decode into a gigantic bitmap.
        if ($info[0] > self::MAX_SIDE || $info[1] > self::MAX_SIDE || $info[0] * $info[1] > self::MAX_PIXELS) {
            throw ValidationException::withMessages(['photo' => [__('That image is too large. Use a photo under about 40 megapixels.')]]);
        }

        $source = @imagecreatefromstring($raw);

        if (! $source instanceof GdImage) {
            throw ValidationException::withMessages(['photo' => [__('That file is not a readable image.')]]);
        }

        $source = $this->applyExifRotation($source, $raw, $info[2]);

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
