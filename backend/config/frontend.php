<?php

return [
    // The Next.js app's own origin, no trailing slash — used to build links
    // back into the dashboard from places that aren't the dashboard itself
    // (e.g. the QR code on a printed employee ID card).
    'url' => rtrim(env('FRONTEND_URL', 'http://localhost:3000'), '/'),
];
