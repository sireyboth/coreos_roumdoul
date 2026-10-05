<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\URL;

/**
 * A file kept privately on a record (e.g. a medical certificate on a leave
 * request). Opened only through a short-lived signed link, like employee photos.
 */
class Attachment extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'attachable_type', 'attachable_id', 'disk', 'path', 'original_name', 'mime', 'size', 'uploaded_by'];

    protected $hidden = ['company_id', 'attachable_type', 'attachable_id', 'disk', 'path', 'uploaded_by', 'updated_at'];

    protected $appends = ['url'];

    public function attachable(): MorphTo
    {
        return $this->morphTo();
    }

    public function getUrlAttribute(): string
    {
        return URL::temporarySignedRoute('attachments.show', now()->addMinutes(30), ['attachment' => $this->id], absolute: false);
    }
}
