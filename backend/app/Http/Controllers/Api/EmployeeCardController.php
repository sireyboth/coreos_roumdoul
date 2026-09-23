<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use BaconQrCode\Common\ErrorCorrectionLevel;
use BaconQrCode\Encoder\Encoder;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Printable ID card PDFs — a plan-gated module (see module:id_cards), so it's
 * sold and toggled per company the same way Attendance/HR/Payroll are.
 */
class EmployeeCardController extends Controller
{
    public function show(Request $request, Employee $employee)
    {
        $employee->loadMissing(['department', 'branch']);
        $company = $request->user()->company;

        // Read straight off the private disk EmployeePhotoController writes to —
        // no signed link needed here, since this always runs as the company's
        // own authenticated user (the route is permission + module gated).
        $photoData = null;
        if ($employee->photo_path && Storage::disk('local')->exists($employee->photo_path)) {
            $photoData = 'data:image/jpeg;base64,'.base64_encode(Storage::disk('local')->get($employee->photo_path));
        }

        // The QR opens this employee's record in the dashboard — it identifies
        // the *person* to whoever scans the badge, unlike the work-location QR
        // (WorkLocation::qr_token) which identifies a *place* and is scanned by
        // an already-authenticated employee at check-in. Different purpose,
        // deliberately not the same mechanism.
        $pdf = Pdf::loadView('pdf.employee-card', [
            'employee' => $employee,
            'company' => $company,
            'photoData' => $photoData,
            'qrGrid' => $this->qrGrid(config('frontend.url')."/dashboard/employees/{$employee->id}"),
            // Stands in for a "website" row on the back of the card — the
            // company has no dedicated website field, but this is real,
            // useful data: the same link admins already share for sign-in.
            'signInLink' => config('frontend.url')."/c/{$company->slug}/login",
        ]);

        return $pdf->stream("employee-card-{$employee->employee_code}.pdf");
    }

    /**
     * The QR's raw black/white grid, as a plain array of arrays of booleans —
     * we render it ourselves as an HTML table of colored cells (see the
     * view), rather than as an image or inline SVG. Both of those looked
     * reasonable in isolation but dompdf either dropped them outright (an
     * SVG's leading XML declaration breaks its HTML parser when inlined) or
     * needs a rendering backend this server doesn't have (PNG output here
     * needs Imagick, which isn't installed — only GD is). A table of cells
     * is exactly the kind of markup dompdf already renders reliably, which
     * is also why the card's own layout above is a table rather than
     * floated/absolutely-positioned divs.
     *
     * @return array<int, array<int, bool>>
     */
    private function qrGrid(string $content): array
    {
        $matrix = Encoder::encode($content, ErrorCorrectionLevel::M())->getMatrix();
        $size = $matrix->getWidth();

        $grid = [];
        for ($y = 0; $y < $size; $y++) {
            $row = [];
            for ($x = 0; $x < $size; $x++) {
                $row[] = $matrix->get($x, $y) === 1;
            }
            $grid[] = $row;
        }

        return $grid;
    }
}
