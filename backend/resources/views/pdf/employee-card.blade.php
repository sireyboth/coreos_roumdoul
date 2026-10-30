@php
    /*
     * EMPLOYEE ID CARD — ROUMDOUL KBACH (vertical CR80, 54mm x 85.6mm)
     * ------------------------------------------------------------------
     * The app's brand look: cream front and espresso back, the kbach damask
     * pattern and kbach flower in caramel / gold (same as the home page's
     * KbachCorner in components/dashboard/shared/kbach.tsx).
     *
     * One view, two uses:
     * - PDF (dompdf): $forScreen = false. Images are local file paths.
     * - On screen ($forScreen = true): shown in the app's preview, so images are
     *   inlined as data URIs and the two sides sit next to each other.
     *
     * Dompdf-safe rules:
     * - Absolute positioning in mm inside a fixed-size side.
     * - No flex/grid, no transforms, no gradients, no background-size, no masks
     *   (hence the pre-coloured PNGs in public/id-card/, made from the web's
     *   roumdolkbach.png and kbach-pattern.webp).
     * - QR stays as the pdf.partials.qr-grid table partial.
     */

    $forScreen ??= false;

    // ---- Palette (the app's light / dark brand tokens) ----
    $c = [
        'cream'    => '#fbf6ef',
        'espresso' => '#2b1b12',
        'caramel'  => '#a3561c',
        'gold'     => '#e3a462',
        'ink'      => '#3b2a1f',
        'muted'    => '#8a7462',
        'line'     => '#e6d6c3',
        'soft'     => '#cdb69c',   // muted text on espresso
        'rule'     => '#5a3d28',   // hairlines on espresso
        'white'    => '#ffffff',
    ];

    $image = fn (string $file) => $forScreen
        ? 'data:image/png;base64,'.base64_encode((string) file_get_contents(public_path("id-card/{$file}")))
        : public_path("id-card/{$file}");

    $logo = $image('logo.png');
    $front = ['pattern' => $image('pattern-caramel.png'), 'flower' => $image('kbach-caramel.png')];
    $back = ['pattern' => $image('pattern-gold.png'), 'flower' => $image('kbach-gold.png')];

    $tagline1 = 'Better People';
    $tagline2 = 'Bigger Tomorrow';
    $motto    = 'WORK  ·  GROW  ·  TOGETHER';

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
    @if ($forScreen)
    {{-- Match the app's light/dark scheme so the frame around the card stays transparent. --}}
    <meta name="color-scheme" content="light dark">
    @endif
    <style>
        @page { size: 54mm 85.6mm; margin: 0; }

        html, body {
            margin: 0;
            padding: 0;
            width: 54mm;
            height: 85.6mm;
            font-family: "DejaVu Sans", sans-serif;
            color: {{ $c['ink'] }};
        }

        * { box-sizing: content-box; }

        .side {
            position: relative;
            width: 54mm;
            height: 85.5mm;
            overflow: hidden;
            background: {{ $c['cream'] }};
        }

        .side.back {
            page-break-before: always;
            background: {{ $c['espresso'] }};
            color: {{ $c['white'] }};
        }

        .flower { position: absolute; }


        /* band along the bottom edge of both sides */
        .band {
            position: absolute;
            left: 0;
            bottom: 0;
            width: 54mm;
            height: 2.6mm;
            background: {{ $c['caramel'] }};
        }

        .band-line {
            position: absolute;
            left: 0;
            bottom: 2.6mm;
            width: 54mm;
            height: 0.5mm;
            background: {{ $c['gold'] }};
        }

        .qr table { border-collapse: collapse; }
        .qr td { padding: 0; line-height: 0; }
        .qr .on  { background-color: {{ $c['espresso'] }}; }
        .qr .off { background-color: {{ $c['white'] }}; }

        .qr-box {
            position: absolute;
            width: 16mm;
            height: 16mm;
            background: {{ $c['white'] }};
            border-radius: 1.2mm;
        }

        .qr-box .qr {
            position: absolute;
            top: 1mm;
            left: 1mm;
        }

        /* ================= FRONT ================= */
        .header {
            position: absolute;
            top: 4.5mm;
            left: 4.5mm;
            width: 45mm;
        }

        .header td { padding: 0; vertical-align: middle; }

        .header-logo { width: 6mm; height: 6mm; }

        .header-name {
            padding-left: 1.5mm !important;
            font-size: 6.4pt;
            font-weight: bold;
            letter-spacing: 0.3pt;
            text-transform: uppercase;
            color: {{ $c['espresso'] }};
        }

        .header-tag {
            text-align: right;
            white-space: nowrap;
            font-size: 3.6pt;
            line-height: 1.35;
            color: {{ $c['caramel'] }};
        }

        .photo,
        .photo-placeholder {
            position: absolute;
            top: 13.5mm;
            left: 12mm;
            width: 30mm;
            height: 31mm;
            border-radius: 3mm;
        }

        .photo { object-fit: cover; }

        .photo-placeholder { background: #efe3d4; }

        /* caramel frame just outside the photo */
        .photo-frame {
            position: absolute;
            top: 12.7mm;
            left: 11.2mm;
            width: 30mm;
            height: 31mm;
            border: 0.8mm solid {{ $c['caramel'] }};
            border-radius: 3.6mm;
        }

        .name {
            position: absolute;
            top: 47.5mm;
            left: 4.5mm;
            width: 45mm;
            height: 5mm;
            overflow: hidden;
            font-family: "DejaVu Sans Condensed", sans-serif;
            font-size: 11pt;
            line-height: 1.1;
            font-weight: bold;
            text-transform: uppercase;
            color: {{ $c['espresso'] }};
        }

        .job-title {
            position: absolute;
            top: 53mm;
            left: 4.5mm;
            width: 45mm;
            font-size: 6pt;
            font-weight: bold;
            line-height: 1.2;
            color: {{ $c['caramel'] }};
            white-space: nowrap;
            overflow: hidden;
        }

        .divider {
            position: absolute;
            top: 57.2mm;
            left: 4.5mm;
            width: 12mm;
            height: 0.4mm;
            background: {{ $c['gold'] }};
        }

        .department {
            position: absolute;
            top: 58.6mm;
            left: 4.5mm;
            width: 45mm;
            font-size: 5.8pt;
            color: {{ $c['muted'] }};
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
            font-weight: bold;
            color: {{ $c['espresso'] }};
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
            color: {{ $c['cream'] }};
        }

        .section-title {
            position: absolute;
            top: 24mm;
            left: 5mm;
            font-size: 5pt;
            font-weight: bold;
            letter-spacing: 0.6pt;
            text-transform: uppercase;
            color: {{ $c['gold'] }};
        }

        .rule {
            position: absolute;
            left: 5mm;
            height: 0.2mm;
            background: {{ $c['rule'] }};
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
            color: {{ $c['gold'] }};
        }

        .contact-text {
            font-size: 5.2pt;
            line-height: 1.3;
            color: #f1e6d8;
            word-break: break-all;
        }

        .scan-caption {
            position: absolute;
            top: 74.6mm;
            left: 0;
            width: 54mm;
            text-align: center;
            font-size: 4.4pt;
            color: {{ $c['soft'] }};
        }

        .motto {
            position: absolute;
            top: 78.6mm;
            left: 0;
            width: 54mm;
            text-align: center;
            font-size: 3.8pt;
            letter-spacing: 0.9pt;
            color: {{ $c['gold'] }};
        }

        @if ($forScreen)
        /* On screen: both sides next to each other (stacked when narrow), drawn 1.5x. */
        html, body { width: auto; height: auto; background: transparent; }
        body {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 5mm;
            padding: 2mm;
            zoom: 1.5;
        }
        .side {
            flex: none;
            border-radius: 3mm;
            box-shadow: 0 1px 2px rgb(43 27 18 / 0.08), 0 8px 20px -10px rgb(43 27 18 / 0.35);
        }
        @endif
    </style>
</head>

<body>

{{-- ============================================================
     FRONT
     ============================================================ --}}
<div class="side front">

    {{-- kbach damask, faint, then the flower peeking in from the top-right corner --}}
    @include('pdf.partials.card-pattern', ['src' => $front['pattern'], 'opacity' => 0.08])
    <img class="flower" src="{{ $front['flower'] }}" style="opacity: 0.3; top: -15mm; left: 36mm; width: 34mm; height: 31.7mm;">

    {{-- header --}}
    <table class="header" cellpadding="0" cellspacing="0">
        <tr>
            <td style="width: 6mm;"><img class="header-logo" src="{{ $logo }}"></td>
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
    <div class="photo-frame"></div>

    {{-- identity --}}
    <div class="name">{{ \Illuminate\Support\Str::limit($employee->name, 22) }}</div>

    @if ($employee->job_title)
        <div class="job-title">{{ \Illuminate\Support\Str::limit($employee->job_title, 36) }}</div>
    @endif

    <div class="divider"></div>

    @if ($employee->department)
        <div class="department">{{ \Illuminate\Support\Str::limit($employee->department->name, 34) }}</div>
    @endif

    <div class="field-label" style="top: 64.6mm;">Employee ID</div>
    <div class="field-value" style="top: 66.6mm;">{{ $employee->employee_code ?: '—' }}</div>

    <div class="field-label" style="top: 71.2mm;">Join Date</div>
    <div class="field-value" style="top: 73.2mm;">{{ $employee->hire_date ? $employee->hire_date->format('Y-m-d') : '—' }}</div>

    <div class="qr-box" style="top: 63.4mm; left: 34mm;">
        <div class="qr">
            @include('pdf.partials.qr-grid', ['grid' => $qrGrid, 'size' => 14])
        </div>
    </div>

    <div class="band-line"></div>
    <div class="band"></div>

</div>


{{-- ============================================================
     BACK
     ============================================================ --}}
<div class="side back">

    @include('pdf.partials.card-pattern', ['src' => $back['pattern'], 'opacity' => 0.06])
    {{-- large flower behind the contact details --}}
    <img class="flower" src="{{ $back['flower'] }}" style="opacity: 0.12; top: 24mm; left: 6mm; width: 42mm; height: 39.2mm;">

    <img class="back-logo" src="{{ $logo }}">

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

    <div class="qr-box" style="top: 57mm; left: 19mm;">
        <div class="qr">
            @include('pdf.partials.qr-grid', ['grid' => $qrGrid, 'size' => 14])
        </div>
    </div>

    <div class="scan-caption">Scan for profile</div>

    <div class="motto">{{ $motto }}</div>

    <div class="band-line"></div>
    <div class="band"></div>

</div>

</body>
</html>
