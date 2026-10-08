<?php

namespace App\Console\Commands;

use App\Models\Attachment;
use App\Models\Employee;
use Illuminate\Console\Command;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;

/**
 * Copies photos and request attachments uploaded before UPLOADS_DISK changed
 * (e.g. from the server's own disk to S3), so they keep opening afterwards.
 * Safe to run more than once: files already on the target are skipped.
 */
class MoveUploadsCommand extends Command
{
    protected $signature = 'uploads:move
        {--from=local : The disk the old files are on}
        {--delete : Remove each file from the old disk once it is copied}';

    protected $description = 'Copy employee photos and request attachments to the uploads disk (UPLOADS_DISK)';

    public function handle(): int
    {
        $fromName = $this->option('from');
        $toName = config('filesystems.uploads');

        if ($fromName === $toName) {
            $this->error("UPLOADS_DISK is already \"{$toName}\". Set it to the new disk (e.g. s3) first.");

            return self::FAILURE;
        }

        $from = Storage::disk($fromName);
        $to = Storage::disk($toName);
        $this->info("Copying uploads from \"{$fromName}\" to \"{$toName}\"…");

        $photos = Employee::query()->withoutGlobalScopes()->whereNotNull('photo_path')->pluck('photo_path');
        [$copied, $missing] = $this->copy($from, $to, $photos->all());
        $this->line("Employee photos: {$copied} copied, {$missing} not found on \"{$fromName}\".");

        $copied = $missing = 0;
        Attachment::query()->withoutGlobalScopes()->where('disk', $fromName)->chunkById(200, function ($attachments) use ($from, $to, $toName, &$copied, &$missing) {
            foreach ($attachments as $attachment) {
                [$ok, $lost] = $this->copy($from, $to, [$attachment->path]);
                if ($ok) {
                    $attachment->forceFill(['disk' => $toName])->save();
                }
                $copied += $ok;
                $missing += $lost;
            }
        });
        $this->line("Request attachments: {$copied} copied, {$missing} not found on \"{$fromName}\".");

        if (! $this->option('delete')) {
            $this->comment("The old files are still on \"{$fromName}\". Once everything opens fine, run again with --delete to remove them.");
        }

        return self::SUCCESS;
    }

    /**
     * @param  array<int, string>  $paths
     * @return array{0: int, 1: int} copied (or already there), not found
     */
    private function copy(Filesystem $from, Filesystem $to, array $paths): array
    {
        $copied = $missing = 0;

        foreach ($paths as $path) {
            if (! $to->exists($path)) {
                if (! $from->exists($path)) {
                    $missing++;

                    continue;
                }
                $to->writeStream($path, $from->readStream($path));
            }
            $copied++;

            if ($this->option('delete') && $from->exists($path)) {
                $from->delete($path);
            }
        }

        return [$copied, $missing];
    }
}
