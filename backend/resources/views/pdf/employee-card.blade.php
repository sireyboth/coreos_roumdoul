@php
    /*
     * EMPLOYEE ID CARD — CLEAN CORPORATE (vertical CR80, 54mm x 85.6mm)
     * ------------------------------------------------------------------
     * Dompdf-safe rules:
     * - Absolute positioning in mm inside a fixed-size side.
     * - No flex/grid, no transforms, no gradients, no background-size.
     * - Diagonal accents use CSS border triangles (no rotate).
     * - QR stays as the existing pdf.partials.qr-grid table partial.
     */

    // ---- Palette ----
    $c = [
        'paper' => '#f7f8fa',
        'navy'  => '#13284f',
        'navy2' => '#1b3566',   // lighter navy for back accents
        'blue'  => '#2f5597',   // accent on front
        'text'  => '#1e3a6e',
        'muted' => '#6b7a90',
        'line'  => '#d5dbe5',
        'soft'  => '#b8c4d9',   // muted text on navy
        'white' => '#ffffff',
    ];

    $logoPath = public_path('logoroumdoul.png');
    $logo     = file_exists($logoPath) ? $logoPath : null;

    $tagline1 = 'Better People';
    $tagline2 = 'Bigger Tomorrow';
    $motto    = 'WORK  ·  GROW  ·  TOGETHER';

    $showPattern   = true;   // faint logo pattern in the background
    $showRings     = true;   // concentric guilloche-style rings
    $showDots      = true;   // dot-matrix blocks beside the photo
    $showMicrotext = true;   // security-style microtext line

    // Rings: [centerX mm, centerY mm, first radius, last radius, step]
    $frontRings = [[54, 0, 6, 46, 3.2], [0, 62, 4, 22, 3]];
    $backRings  = [[0, 0, 6, 40, 3.2]];

    $microtext = str_repeat(strtoupper($company->name) . ' • ', 12);

    // Contact rows on the back (employee first, then company fallback)
    $contacts = array_filter([
        ['&#9742;', $employee->phone   ?? $company->phone   ?? null],
        ['&#9993;', $employee->email   ?? $company->email   ?? null],
        ['&#8962;', isset($company->address) ? \Illuminate\Support\Str::limit($company->address, 60) : null],
        ['&#8853;', $company->website  ?? null],
    ], fn ($row) => filled($row[1]));
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page { size: 54mm 85.6mm; margin: 0; }

        html, body {
            margin: 0;
            padding: 0;
            width: 54mm;
            height: 85.6mm;
            font-family: "DejaVu Sans", sans-serif;
            color: {{ $c['navy'] }};
        }

        * { box-sizing: content-box; }

        .side {
            position: relative;
            width: 54mm;
            height: 85.5mm;
            overflow: hidden;
            background: {{ $c['paper'] }};
        }

        .side.back {
            page-break-before: always;
            background: {{ $c['navy'] }};
            color: {{ $c['white'] }};
        }

        .pattern-img {
            position: absolute;
            width: 6mm;
            height: 6mm;
        }

        /* ---------- professional pattern ---------- */
        .ring {
            position: absolute;
            border-style: solid;
            border-width: 0.18mm;
        }

        .dot {
            position: absolute;
            width: 0.55mm;
            height: 0.55mm;
            border-radius: 0.3mm;
        }

        .microtext {
            position: absolute;
            left: 0;
            width: 54mm;
            height: 1.6mm;
            overflow: hidden;
            white-space: nowrap;
            font-size: 2.4pt;
            line-height: 1.6mm;
            letter-spacing: 0.3pt;
        }


        /* ================= FRONT ================= */
        .header {
            position: absolute;
            top: 4.5mm;
            left: 4.5mm;
            width: 45mm;
        }

        .header td { padding: 0; vertical-align: middle; }

        .header-logo { width: 5.5mm; height: 5.5mm; }

        .header-name {
            padding-left: 1.5mm !important;
            font-size: 6.6pt;
            font-weight: bold;
            letter-spacing: 0.3pt;
            text-transform: uppercase;
            color: {{ $c['navy'] }};
        }

        .header-tag {
            text-align: right;
            white-space: nowrap;
            font-size: 3.6pt;
            line-height: 1.35;
            color: {{ $c['muted'] }};
        }

        .photo,
        .photo-placeholder {
            position: absolute;
            top: 13mm;
            left: 12mm;
            width: 30mm;
            height: 31mm;
            border-radius: 2.5mm;
        }

        .photo { object-fit: cover; }

        .photo-placeholder { background: #e3e7ee; }

        .name {
            position: absolute;
            top: 47mm;
            left: 4.5mm;
            width: 45mm;
            height: 5mm;
            overflow: hidden;
            font-family: "DejaVu Sans Condensed", sans-serif;
            font-size: 11pt;
            line-height: 1.1;
            font-weight: bold;
            text-transform: uppercase;
            color: {{ $c['navy'] }};
        }

        .job-title {
            position: absolute;
            top: 52.6mm;
            left: 4.5mm;
            width: 45mm;
            font-size: 6pt;
            line-height: 1.2;
            color: {{ $c['text'] }};
            white-space: nowrap;
            overflow: hidden;
        }

        .divider {
            position: absolute;
            top: 57mm;
            left: 4.5mm;
            width: 17mm;
            height: 0.25mm;
            background: {{ $c['line'] }};
        }

        .department {
            position: absolute;
            top: 58.6mm;
            left: 4.5mm;
            width: 45mm;
            font-size: 6pt;
            color: {{ $c['text'] }};
        }

        .field-label {
            position: absolute;
            left: 4.5mm;
            font-size: 3.9pt;
            letter-spacing: 0.5pt;
            text-transform: uppercase;
            color: {{ $c['muted'] }};
        }

        .field-value {
            position: absolute;
            left: 4.5mm;
            font-size: 6pt;
            color: {{ $c['navy'] }};
        }

        .qr-front {
            position: absolute;
            top: 64.5mm;
            left: 35mm;
        }

        .qr table { border-collapse: collapse; }
        .qr td { padding: 0; line-height: 0; }
        .qr .on  { background-color: {{ $c['navy'] }}; }
        .qr .off { background-color: {{ $c['white'] }}; }

        /* diagonal bottom-left accents (border triangles) */
        .tri {
            position: absolute;
            left: 0;
            bottom: 0;
            width: 0;
            height: 0;
            border-style: solid;
            border-color: transparent;
        }

        /* ================= BACK ================= */
        .back-logo {
            position: absolute;
            top: 6mm;
            left: 22.5mm;
            width: 9mm;
            height: 9mm;
        }

        .back-company {
            position: absolute;
            top: 16.5mm;
            left: 0;
            width: 54mm;
            text-align: center;
            font-size: 7.6pt;
            font-weight: bold;
            letter-spacing: 0.8pt;
            text-transform: uppercase;
            color: {{ $c['white'] }};
        }

        .section-title {
            position: absolute;
            top: 24mm;
            left: 5mm;
            font-size: 5pt;
            font-weight: bold;
            letter-spacing: 0.6pt;
            text-transform: uppercase;
            color: {{ $c['white'] }};
        }

        .rule {
            position: absolute;
            left: 5mm;
            height: 0.2mm;
            background: #3a5282;
        }

        .contacts {
            position: absolute;
            top: 29.5mm;
            left: 5mm;
            width: 44mm;
        }

        .contacts td {
            padding: 0 0 2.2mm 0;
            vertical-align: top;
        }

        .contact-icon {
            width: 5mm;
            font-size: 6.5pt;
            line-height: 1;
            color: {{ $c['white'] }};
        }

        .contact-text {
            font-size: 5.2pt;
            line-height: 1.3;
            color: #e6ecf5;
            word-break: break-all;
        }

        .qr-box {
            position: absolute;
            top: 57.5mm;
            left: 19mm;
            width: 16mm;
            height: 16mm;
            background: {{ $c['white'] }};
            border-radius: 0.8mm;
        }

        .qr-box .qr {
            position: absolute;
            top: 1mm;
            left: 1mm;
        }

        .scan-caption {
            position: absolute;
            top: 75mm;
            left: 0;
            width: 54mm;
            text-align: center;
            font-size: 4.4pt;
            color: {{ $c['soft'] }};
        }

        .motto {
            position: absolute;
            top: 80.2mm;
            left: 0;
            width: 54mm;
            text-align: center;
            font-size: 3.8pt;
            letter-spacing: 0.9pt;
            color: {{ $c['soft'] }};
        }
    </style>
</head>

<body>

{{-- ============================================================
     FRONT
     ============================================================ --}}
<div class="side front">

    @if ($logo && $showPattern)
        @for ($row = 0; $row < 9; $row++)
            @for ($col = 0; $col < 6; $col++)
                <img class="pattern-img" src="{{ $logo }}"
                     style="opacity: 0.04; top: {{ $row * 10 }}mm; left: {{ $col * 11 + ($row % 2 ? 5.5 : 0) - 2 }}mm;">
            @endfor
        @endfor
    @endif

    {{-- concentric rings --}}
    @if ($showRings)
        @foreach ($frontRings as [$cx, $cy, $r0, $r1, $step])
            @for ($r = $r0; $r <= $r1; $r += $step)
                <div class="ring" style="left: {{ $cx - $r }}mm; top: {{ $cy - $r }}mm; width: {{ $r * 2 }}mm; height: {{ $r * 2 }}mm; border-radius: {{ $r }}mm; border-color: #e1e7f0;"></div>
            @endfor
        @endforeach
    @endif

    {{-- dot matrix beside the photo --}}
    @if ($showDots)
        @for ($row = 0; $row < 9; $row++)
            @for ($col = 0; $col < 3; $col++)
                <div class="dot" style="left: {{ 4.5 + $col * 2 }}mm; top: {{ 17 + $row * 2 }}mm; background: #cdd6e4;"></div>
                <div class="dot" style="left: {{ 45 + $col * 2 }}mm; top: {{ 27 + $row * 2 }}mm; background: #cdd6e4;"></div>
            @endfor
        @endfor
    @endif

    {{-- security microtext --}}
    @if ($showMicrotext)
        <div class="microtext" style="top: 44.8mm; color: #c9d2e0;">{{ $microtext }}</div>
    @endif

    {{-- header --}}
    <table class="header" cellpadding="0" cellspacing="0">
        <tr>
            @if ($logo)
                <td style="width: 5.5mm;"><img class="header-logo" src="{{ $logo }}"></td>
            @endif
            <td class="header-name">{{ \Illuminate\Support\Str::limit($company->name, 20) }}</td>
            <td class="header-tag">{{ $tagline1 }}<br>{{ $tagline2 }}</td>
        </tr>
    </table>

    {{-- photo --}}
    @if ($photoData)
        <img class="photo" src="{{ $photoData }}" alt="">
    @else
        <div class="photo-placeholder"></div>
    @endif

    {{-- identity --}}
    <div class="name">{{ \Illuminate\Support\Str::limit($employee->name, 22) }}</div>

    @if ($employee->job_title)
        <div class="job-title">{{ \Illuminate\Support\Str::limit($employee->job_title, 36) }}</div>
    @endif

    <div class="divider"></div>

    @if ($employee->department)
        <div class="department">{{ \Illuminate\Support\Str::limit($employee->department->name, 34) }}</div>
    @endif

    <div class="field-label" style="top: 65mm;">Employee ID</div>
    <div class="field-value" style="top: 67mm;">{{ $employee->employee_code ?: '—' }}</div>

    <div class="field-label" style="top: 71.6mm;">Join Date</div>
    <div class="field-value" style="top: 73.6mm;">{{ $employee->hire_date ? $employee->hire_date->format('Y-m-d') : '—' }}</div>

    <div class="qr qr-front">
        @include('pdf.partials.qr-grid', [
            'grid' => $qrGrid,
            'size' => 14
        ])
    </div>

    {{-- bottom-left diagonal accents --}}
    <div class="tri" style="border-width: 0 40mm 6.5mm 0; border-bottom-color: #e2e8f2;"></div>
    <div class="tri" style="border-width: 0 27mm 5mm 0; border-bottom-color: {{ $c['blue'] }};"></div>
    <div class="tri" style="border-width: 0 18mm 3.6mm 0; border-bottom-color: {{ $c['navy'] }};"></div>

</div>


{{-- ============================================================
     BACK
     ============================================================ --}}
<div class="side back">

    @if ($logo && $showPattern)
        @for ($row = 0; $row < 9; $row++)
            @for ($col = 0; $col < 6; $col++)
                <img class="pattern-img" src="{{ $logo }}"
                     style="opacity: 0.04; top: {{ $row * 10 }}mm; left: {{ $col * 11 + ($row % 2 ? 5.5 : 0) - 2 }}mm;">
            @endfor
        @endfor
    @endif

    @if ($showRings)
        @foreach ($backRings as [$cx, $cy, $r0, $r1, $step])
            @for ($r = $r0; $r <= $r1; $r += $step)
                <div class="ring" style="left: {{ $cx - $r }}mm; top: {{ $cy - $r }}mm; width: {{ $r * 2 }}mm; height: {{ $r * 2 }}mm; border-radius: {{ $r }}mm; border-color: #1f3a6b;"></div>
            @endfor
        @endforeach
    @endif

    @if ($showMicrotext)
        <div class="microtext" style="top: 21.2mm; color: #2c4a80;">{{ $microtext }}</div>
    @endif

    {{-- soft diagonal in bottom-right --}}
    <div class="tri" style="left: auto; right: 0; border-width: 0 0 30mm 54mm; border-bottom-color: {{ $c['navy2'] }};"></div>

    @if ($logo)
        <img class="back-logo" src="{{ $logo }}">
    @endif

    <div class="back-company">{{ \Illuminate\Support\Str::limit($company->name, 24) }}</div>

    <div class="section-title">Contact Details</div>
    <div class="rule" style="top: 27.6mm; width: 30mm;"></div>

    <table class="contacts" cellpadding="0" cellspacing="0">
        @foreach ($contacts as [$icon, $text])
            <tr>
                <td class="contact-icon">{!! $icon !!}</td>
                <td class="contact-text">{{ $text }}</td>
            </tr>
        @endforeach
    </table>

    <div class="rule" style="top: 54mm; width: 44mm;"></div>

    <div class="qr-box">
        <div class="qr">
            @include('pdf.partials.qr-grid', [
                'grid' => $qrGrid,
                'size' => 14
            ])
        </div>
    </div>

    <div class="scan-caption">Scan for profile</div>

    <div class="motto">{{ $motto }}</div>

</div>

</body>
</html>