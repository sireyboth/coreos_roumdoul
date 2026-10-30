{{--
    The kbach damask filling one ID card side (54 x 85.6mm), faded by $opacity.
    PDF: dompdf has no background-size, so the 320x384px tile is laid as
    54 x 64.8mm images (2 rows). On screen: one layer with a repeating
    background, so the (inlined) image is in the page once, not per tile.
--}}
@if ($forScreen)
    <div style="position: absolute; top: 0; left: 0; width: 54mm; height: 85.6mm; opacity: {{ $opacity }}; background-image: url('{{ $src }}'); background-repeat: repeat; background-size: 54mm auto;"></div>
@else
    @foreach ([0, 64.8] as $top)
        <img src="{{ $src }}" style="position: absolute; top: {{ $top }}mm; left: 0; width: 54mm; height: 64.8mm; opacity: {{ $opacity }};">
    @endforeach
@endif
