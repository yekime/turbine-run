// Inline SVG for the first-load call to action: a barman ringing last orders.
export const LAST_CALL_SVG = `
<svg class="bar" viewBox="0 0 360 300" role="img" aria-label="A barman rings the bell behind a bar of pints">
  <defs>
    <linearGradient id="lc-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b1670"/><stop offset="1" stop-color="#1a0b33"/></linearGradient>
    <linearGradient id="lc-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a5530"/><stop offset=".12" stop-color="#6b3520"/><stop offset="1" stop-color="#3a1a10"/></linearGradient>
    <linearGradient id="lc-stout" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1d12"/><stop offset="1" stop-color="#0d0605"/></linearGradient>
    <radialGradient id="lc-lamp" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#ffcf6a" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf6a" stop-opacity="0"/></radialGradient>
    <filter id="lc-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="360" height="300" fill="url(#lc-wall)"/>
  <ellipse cx="180" cy="0" rx="210" ry="190" fill="url(#lc-lamp)"/>
  <!-- back bar: mirror, shelves of glowing bottles, a neon shamrock -->
  <rect x="34" y="34" width="292" height="118" rx="6" fill="#241046" stroke="#5a2c95" stroke-width="2"/>
  <g filter="url(#lc-glow)">
    <path class="lc-sham" d="M70 70c-8-12-24-6-18 6-12 0-10 16 2 12-3 12 12 14 16 2 4 12 19 10 16-2 12 4 14-12 2-12 6-12-10-18-18-6zm0 12v26" fill="none" stroke="#19ff8c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g>
    <rect x="110" y="96" width="200" height="4" fill="#5a2c95"/><rect x="110" y="140" width="200" height="4" fill="#5a2c95"/>
    <g fill-opacity=".9">
      <rect x="118" y="70" width="10" height="26" rx="3" fill="#ff8a1f"/><rect x="132" y="64" width="9" height="32" rx="3" fill="#3ff3ff"/><rect x="145" y="74" width="12" height="22" rx="3" fill="#ffd23f"/>
      <rect x="161" y="66" width="9" height="30" rx="3" fill="#ff3fa4"/><rect x="174" y="72" width="11" height="24" rx="3" fill="#19ff8c"/><rect x="190" y="62" width="9" height="34" rx="3" fill="#ff8a1f"/>
      <rect x="203" y="70" width="12" height="26" rx="3" fill="#7a2cff"/><rect x="219" y="66" width="9" height="30" rx="3" fill="#ffd23f"/><rect x="232" y="74" width="11" height="22" rx="3" fill="#3ff3ff"/>
      <rect x="247" y="64" width="9" height="32" rx="3" fill="#ff3fa4"/><rect x="260" y="70" width="12" height="26" rx="3" fill="#19ff8c"/><rect x="276" y="66" width="9" height="30" rx="3" fill="#ff8a1f"/><rect x="289" y="72" width="11" height="24" rx="3" fill="#ffd23f"/>
      <rect x="118" y="114" width="12" height="26" rx="3" fill="#ffd23f"/><rect x="134" y="110" width="9" height="30" rx="3" fill="#ff3fa4"/><rect x="262" y="112" width="10" height="28" rx="3" fill="#3ff3ff"/><rect x="276" y="116" width="12" height="24" rx="3" fill="#ff8a1f"/><rect x="292" y="110" width="9" height="30" rx="3" fill="#19ff8c"/>
    </g>
  </g>
  <!-- the barman -->
  <g class="lc-man">
    <path d="M128 230c0-46 22-70 52-70s52 24 52 70z" fill="#fff6ec"/>
    <path d="M140 230c2-38 14-58 28-64l12 22 12-22c14 6 26 26 28 64z" fill="#17834a"/>
    <path d="M168 168l12 14 12-14-12 4z" fill="#e8243c"/>
    <circle cx="160" cy="196" r="2.2" fill="#ffd23f"/><circle cx="160" cy="210" r="2.2" fill="#ffd23f"/>
    <!-- left arm on the tap -->
    <path d="M140 186c-16 10-22 30-20 46" fill="none" stroke="#fff6ec" stroke-width="16" stroke-linecap="round"/>
    <!-- head -->
    <g class="lc-head">
      <ellipse cx="180" cy="128" rx="27" ry="30" fill="#ffd3a2"/>
      <path d="M154 120c-4 20 2 34 10 40l6-20zM206 120c4 20-2 34-10 40l-6-20z" fill="#d86d27"/>
      <path d="M156 104c4-18 44-20 50 0-14-6-36-6-50 0z" fill="#d86d27"/>
      <ellipse cx="170" cy="122" rx="3" ry="3.6" fill="#26312d"/><ellipse cx="190" cy="122" rx="3" ry="3.6" fill="#26312d"/>
      <path d="M164 113l10 3M196 113l-10 3" stroke="#a84e1a" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="180" cy="131" rx="5" ry="4" fill="#f2a882"/>
      <path d="M164 138c6-5 26-5 32 0-4 4-10 5-16 4-6 1-12 0-16-4z" fill="#d86d27"/>
      <ellipse class="lc-mouth" cx="180" cy="146" rx="9" ry="7" fill="#5a1620"/>
      <ellipse cx="180" cy="149" rx="5" ry="2.6" fill="#ff6b7a"/>
    </g>
    <!-- right arm up, ringing the bell -->
    <g class="lc-arm">
      <path d="M220 186c14-12 22-34 24-58" fill="none" stroke="#fff6ec" stroke-width="16" stroke-linecap="round"/>
      <circle cx="244" cy="124" r="9" fill="#ffd3a2"/>
      <g class="lc-bell">
        <rect x="241" y="96" width="6" height="22" rx="3" fill="#6b3520"/>
        <path d="M230 96c0-14 6-22 14-22s14 8 14 22l4 6h-36z" fill="#ffcc4a" stroke="#c99212" stroke-width="1.5"/>
        <circle cx="244" cy="104" r="3.5" fill="#c99212"/>
      </g>
      <path class="lc-ring" d="M262 70q8 6 6 16M268 60q14 10 10 28M222 70q-8 6-6 16" fill="none" stroke="#ffd23f" stroke-width="2.4" stroke-linecap="round"/>
    </g>
  </g>
  <!-- taps -->
  <g><rect x="92" y="190" width="40" height="10" rx="3" fill="#c99212"/>
    <rect x="98" y="164" width="7" height="28" rx="3" fill="#120d18"/><rect x="96" y="158" width="11" height="10" rx="2" fill="#fff1c8"/>
    <rect x="118" y="168" width="7" height="24" rx="3" fill="#120d18"/><rect x="116" y="162" width="11" height="9" rx="2" fill="#19c95a"/></g>
  <!-- bar counter -->
  <rect x="0" y="228" width="360" height="72" fill="url(#lc-wood)"/>
  <rect x="0" y="226" width="360" height="6" fill="#b5683a"/>
  <rect x="0" y="282" width="360" height="4" fill="#ffcc4a" opacity=".85"/>
  <!-- pints lined up -->
  <g class="lc-pints">
    ${[22, 64, 252, 294].map((x, i) => `
    <g transform="translate(${x} 0)">
      <path d="M2 184h30l-3 42H5z" fill="url(#lc-stout)"/>
      <path d="M1 178h32l1 8H0z" fill="#fff1c8"/>
      <ellipse cx="17" cy="178" rx="16" ry="3" fill="#fffaf0"/>
      <path d="M8 192v24" stroke="#ffffff" stroke-opacity=".18" stroke-width="3" stroke-linecap="round"/>
      <circle class="lc-bub" style="animation-delay:${i * .35}s" cx="${10 + i * 3}" cy="220" r="1.4" fill="#d9b48a"/>
      <circle class="lc-bub" style="animation-delay:${.6 + i * .3}s" cx="${22 - i * 2}" cy="222" r="1.1" fill="#d9b48a"/>
    </g>`).join('')}
  </g>
</svg>`;
