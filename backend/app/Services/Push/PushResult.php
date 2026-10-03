<?php

namespace App\Services\Push;

/** What happened to one push to one device. */
final class PushResult
{
    private function __construct(
        public readonly string $status, // sent / expired / failed
        public readonly ?string $reason = null,
    ) {}

    public static function sent(): self
    {
        return new self('sent');
    }

    /** The device is gone (app uninstalled, permission revoked): forget it. */
    public static function expired(?string $reason = null): self
    {
        return new self('expired', $reason);
    }

    /** Worth trying again later (the push service was down, a timeout…). */
    public static function failed(?string $reason = null): self
    {
        return new self('failed', $reason);
    }
}
