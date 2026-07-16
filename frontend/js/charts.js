/**
 * Minimal canvas chart helpers -- no external charting library, keeping the
 * frontend to plain HTML/CSS/JS as required.
 */
(function () {
  function drawDonut(canvas, segments, { thickness = 16 } = {}) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - thickness / 2 - 2;

    let start = -Math.PI / 2;
    segments.forEach((seg) => {
      const angle = (seg.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, start + angle);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = thickness;
      ctx.lineCap = segments.length > 1 ? 'butt' : 'round';
      ctx.stroke();
      start += angle;
    });

    if (total === 0 || segments.every((s) => s.value === 0)) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(150,150,150,0.25)';
      ctx.lineWidth = thickness;
      ctx.stroke();
    }
  }

  function drawBars(canvas, values, { color = '#3e7cb1', gap = 6 } = {}) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const max = Math.max(...values, 1);
    const barWidth = (w - gap * (values.length - 1)) / values.length;

    values.forEach((v, i) => {
      const barHeight = Math.max((v / max) * (h - 4), 2);
      const x = i * (barWidth + gap);
      const y = h - barHeight;
      const radius = Math.min(4, barWidth / 2);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
      ctx.lineTo(x + barWidth, h);
      ctx.lineTo(x, h);
      ctx.closePath();
      ctx.fill();
    });
  }

  window.DVCharts = { drawDonut, drawBars };
})();
