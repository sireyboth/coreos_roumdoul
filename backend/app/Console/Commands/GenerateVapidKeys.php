<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * Makes the VAPID key pair that signs our push messages. Run once per
 * environment and keep the result in .env — a new pair means every device
 * has to turn notifications on again. Uses OpenSSL directly, so it works
 * even where the push library isn't installed.
 */
class GenerateVapidKeys extends Command
{
    protected $signature = 'webpush:vapid';

    protected $description = 'Generate the VAPID key pair for Web Push notifications';

    public function handle(): int
    {
        $options = ['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1'];
        $key = openssl_pkey_new($options);

        // Some Windows PHP builds (e.g. XAMPP) can't find openssl.cnf. Making
        // an EC key needs nothing from it, so an empty one will do.
        if (! $key) {
            $config = tempnam(sys_get_temp_dir(), 'ssl');
            // default_bits only satisfies PHP's minimum-length check; an EC key ignores it.
            file_put_contents($config, "[req]\ndefault_bits = 2048\ndistinguished_name = dn\n[dn]\n");
            $key = openssl_pkey_new([...$options, 'config' => $config]);
            @unlink($config);
        }

        $ec = $key ? (openssl_pkey_get_details($key)['ec'] ?? null) : null;

        if (! $ec) {
            $this->error('OpenSSL could not create a P-256 key on this machine.');

            return self::FAILURE;
        }

        $pad = fn (string $bytes) => str_pad($bytes, 32, "\0", STR_PAD_LEFT);
        $base64url = fn (string $bytes) => rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');

        $this->line('Add these to .env (keep the private key secret):');
        $this->newLine();
        $this->line('VAPID_PUBLIC_KEY='.$base64url("\x04".$pad($ec['x']).$pad($ec['y'])));
        $this->line('VAPID_PRIVATE_KEY='.$base64url($pad($ec['d'])));

        return self::SUCCESS;
    }
}
