// Its own tiny entry point, so the barman draws before Three.js has even downloaded.
import { LAST_CALL_SVG } from './lastcall.svg.js';
document.getElementById('lc-art').innerHTML = LAST_CALL_SVG;
