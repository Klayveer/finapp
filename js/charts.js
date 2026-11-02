import { esc, money, moneyCompact, pct } from './utils.js';

function niceMax(v) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

function roundedTop(x, y, w, h, r = 4) {
  if (h <= 0.5) return '';
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Barras agrupadas (ex.: receitas x despesas por mês).
 * data: [{ label, title, values: { [key]: number } }]
 * series: [{ key, name, color }]  (color = CSS var)
 */
export function mountGroupedBars(el, data, series, { height = 240, footer } = {}) {
  let lastW = 0;
  const draw = () => {
    const W = Math.max(280, el.clientWidth);
    lastW = el.clientWidth;
    const H = height;
    const m = { t: 10, r: 4, b: 28, l: 52 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => d.values[s.key] || 0))));
    const y = (v) => m.t + ih - (v / max) * ih;
    const gw = iw / data.length;
    const gap = 2;
    const bw = Math.max(6, Math.min(26, (gw * 0.62 - gap * (series.length - 1)) / series.length));
    const groupW = bw * series.length + gap * (series.length - 1);

    let svg = `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras">`;
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      const yy = Math.round(y(v)) + 0.5;
      svg += `<line class="${i === 0 ? 'axis' : 'grid'}" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/>`;
      svg += `<text class="tick" x="${m.l - 8}" y="${yy + 4}" text-anchor="end">${esc(moneyCompact(v))}</text>`;
    }
    data.forEach((d, i) => {
      const gx = m.l + i * gw;
      const x0 = gx + (gw - groupW) / 2;
      svg += `<rect class="hover-band" data-i="${i}" x="${gx + 2}" y="${m.t}" width="${gw - 4}" height="${ih}" rx="6"/>`;
      series.forEach((s, j) => {
        const v = d.values[s.key] || 0;
        const top = y(v);
        svg += `<path d="${roundedTop(x0 + j * (bw + gap), top, bw, m.t + ih - top)}" fill="${s.color}"/>`;
      });
      svg += `<text class="tick ${d.current ? 'tick-strong' : ''}" x="${gx + gw / 2}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>`;
      svg += `<rect class="hit" data-i="${i}" x="${gx}" y="0" width="${gw}" height="${H}"/>`;
    });
    svg += '</svg>';

    const legend = `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
    const table = `<table class="sr-only"><thead><tr><th>Mês</th>${series.map((s) => `<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${data
      .map((d) => `<tr><td>${esc(d.title)}</td>${series.map((s) => `<td>${money(d.values[s.key])}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;
    el.innerHTML = `${legend}<div class="chart-wrap">${svg}<div class="tooltip" hidden></div></div>${table}`;

    const wrap = el.querySelector('.chart-wrap');
    const tip = el.querySelector('.tooltip');
    const bands = el.querySelectorAll('.hover-band');
    const show = (i) => {
      const d = data[i];
      bands.forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === i));
      tip.innerHTML = `<strong>${esc(d.title)}</strong>${series
        .map((s) => `<div class="tip-row"><span><i style="background:${s.color}"></i>${esc(s.name)}</span><b>${money(d.values[s.key])}</b></div>`)
        .join('')}${footer ? footer(d) : ''}`;
      tip.hidden = false;
      const cx = m.l + i * gw + gw / 2;
      const tw = tip.offsetWidth;
      const left = Math.min(Math.max(4, cx - tw / 2), W - tw - 4);
      tip.style.left = `${left}px`;
      tip.style.top = `${m.t}px`;
    };
    const hide = () => {
      tip.hidden = true;
      bands.forEach((b) => b.classList.remove('on'));
    };
    el.querySelectorAll('.hit').forEach((h) => {
      h.addEventListener('mouseenter', () => show(Number(h.dataset.i)));
      h.addEventListener('click', () => show(Number(h.dataset.i)));
    });
    wrap.addEventListener('mouseleave', hide);
  };
  draw();
  new ResizeObserver(() => {
    if (el.isConnected && Math.abs(el.clientWidth - lastW) > 4) draw();
  }).observe(el);
}

/** Lista de barras horizontais com rótulo e valor diretos (um só tom = magnitude). */
export function hbars(rows, { color = 'var(--expense)', total } = {}) {
  if (!rows.length) return '';
  const max = Math.max(...rows.map((r) => r.value));
  const sum = total ?? rows.reduce((s, r) => s + r.value, 0);
  return `<ul class="hbars">${rows
    .map(
      (r) => `<li title="${esc(r.label)}: ${money(r.value)}">
        <div class="hbar-top"><span class="hbar-label">${esc(r.label)}</span><span class="hbar-val">${money(r.value)}<small>${pct(r.value, sum)}%</small></span></div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${max ? Math.max(1.5, (r.value / max) * 100) : 0}%;background:${color}"></div></div>
      </li>`,
    )
    .join('')}</ul>`;
}

/** Barra de progresso (ex.: limite usado). */
export function meter(value, max, { label = '' } = {}) {
  const p = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const level = p >= 90 ? 'crit' : p >= 70 ? 'warn' : '';
  return `<div class="meter ${level}" role="meter" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(label)}"><div style="width:${p}%"></div></div>`;
}
