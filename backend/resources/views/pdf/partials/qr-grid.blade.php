{{--
    Renders a QR bit-grid (array<array<bool>>, from
    EmployeeCardController::qrGrid()) as a table of colored cells, at the
    given overall size in mm. Shared by the card's front and back so both
    QRs stay in sync if the size or cell colors ever change.
--}}
@php $cell = number_format($size / count($grid), 3); @endphp
<table cellpadding="0" cellspacing="0">
    @foreach ($grid as $row)
        <tr>
            @foreach ($row as $on)
                <td class="{{ $on ? 'on' : 'off' }}" style="width: {{ $cell }}mm; height: {{ $cell }}mm;"></td>
            @endforeach
        </tr>
    @endforeach
</table>
