/**
 * THS Simulator Main Application Controller
 */

import { RATIO_SUN_PLANET, calculatePhysics } from './physics.js';
import { createIceMapBackground, drawIceMap } from './ice-map.js';
import { drawNomograph } from './nomograph.js';
import { initCanvasGears, drawPSD } from './psd.js';

// Service Worker Registration for Offline Cache
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(() => console.log('Service Worker registered successfully'))
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}

(function () {
    // State Container
    const state = {
        v: 0,
        n_ice: 0,
        t_ice: 0,
        t_load: 0,
        n_mg2: 0,
        n_mg1: 0,
        ang_sun: 0,
        ang_carrier: 0,
        ang_ring: 0,
        ang_planet: 0,
        lastDomUpdate: 0
    };

    // Cache References for Canvas Rendering
    const cacheRef = {
        lastLeverState: { n_s: null, n_c: null, n_r: null, t_mg1: null, t_ice: null, t_mg2: null, t_load: null },
        nomographBackgroundCanvas: null,
        iceMapBackgroundCanvas: null,
        lastIceParams: null
    };

    const elements = {};
    let psdCtx = null;
    let gearPaths = null;
    let animationFrameId = null;
    let resizeObserver = null;
    let isInitialized = false;

    // DOM Helpers
    const $ = id => document.getElementById(id);
    const safeSetText = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    const safeSetWidth = (el, widthStr) => { if (el?.style && el.style.width !== widthStr) el.style.width = widthStr; };

    function cacheElements() {
        const elementIds = [
            'v_input', 'v_val', 'nice_input', 'nice_val', 'tice_input', 'tice_val',
            'tload_input', 'tload_val', 'rpm_sun', 'rpm_carrier', 'rpm_ring',
            'p_ice_disp', 'bar_ice', 'p_wheel_disp', 'bar_wheel_pos', 'bar_wheel_neg',
            'p_batt_disp', 'bar_batt_dis', 'bar_batt_chg', 'p_mg1_disp', 'mg1_state_text',
            'p_mg2_disp', 'mg2_state_text', 'current_efficiency', 'ice_map_canvas',
            'nomograph_canvas', 'psd_canvas'
        ];

        elementIds.forEach(id => {
            elements[id] = $(id);
        });
    }

    function updateCanvasDimensions(canvas) {
        if (!canvas) return false;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const dpr = window.devicePixelRatio || 1;
        const physicalWidth = Math.round(rect.width * dpr);
        const physicalHeight = Math.round(rect.height * dpr);

        if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
            canvas.width = physicalWidth;
            canvas.height = physicalHeight;
            return true;
        }
        return false;
    }

    function updatePhysics() {
        if (!elements.v_input || !elements.nice_input || !elements.tice_input || !elements.tload_input) return;

        state.v = parseFloat(elements.v_input.value);
        state.n_ice = parseFloat(elements.nice_input.value);
        state.t_ice = parseFloat(elements.tice_input.value);
        state.t_load = parseFloat(elements.tload_input.value);

        const phys = calculatePhysics(state.v, state.n_ice, state.t_ice, state.t_load);

        state.n_mg1 = phys.n_mg1;
        state.n_mg2 = phys.n_mg2;

        const now = performance.now();
        if (!state.lastDomUpdate || now - state.lastDomUpdate > 16) {
            state.lastDomUpdate = now;

            safeSetText(elements.rpm_sun, state.n_mg1.toFixed(0));
            safeSetText(elements.rpm_carrier, state.n_ice.toFixed(0));
            safeSetText(elements.rpm_ring, state.n_mg2.toFixed(0));

            // Power Gauges
            let iceText = phys.p_ice.toFixed(1) + ' kW';
            if (Math.abs(phys.p_ice) > 112.05) iceText += ' (Overload)';
            safeSetText(elements.p_ice_disp, iceText);
            if (elements.bar_ice) safeSetWidth(elements.bar_ice, Math.min(phys.p_ice / 1.12, 100) + '%');

            let wheelText = phys.p_wheel.toFixed(1) + ' kW';
            if (Math.abs(phys.p_wheel) > 145.05) wheelText += ' (Overload)';
            safeSetText(elements.p_wheel_disp, wheelText);
            const w_pct = Math.min((Math.abs(phys.p_wheel) / 145) * 50, 50);
            if (phys.p_wheel >= 0) {
                safeSetWidth(elements.bar_wheel_pos, w_pct + '%');
                safeSetWidth(elements.bar_wheel_neg, '0');
            } else {
                safeSetWidth(elements.bar_wheel_pos, '0');
                safeSetWidth(elements.bar_wheel_neg, w_pct + '%');
            }

            let battText = phys.p_batt.toFixed(1) + ' kW';
            if (Math.abs(phys.p_batt) > 33.05) battText += ' (Overload)';
            safeSetText(elements.p_batt_disp, battText);
            const b_pct = Math.min((Math.abs(phys.p_batt) / 33) * 50, 50);
            if (phys.p_batt > 0) {
                safeSetWidth(elements.bar_batt_dis, b_pct + '%');
                safeSetWidth(elements.bar_batt_chg, '0');
            } else {
                safeSetWidth(elements.bar_batt_dis, '0');
                safeSetWidth(elements.bar_batt_chg, b_pct + '%');
            }

            const mg1LoadRate = (Math.abs(phys.p_mg1) / 50.05) * 100;
            const mg1LoadText = mg1LoadRate > 100 ? '(Overload)' : `(${mg1LoadRate.toFixed(0)}%)`;
            const mg1Text = `${phys.p_mg1.toFixed(1)} kW ${mg1LoadText}`;
            safeSetText(elements.p_mg1_disp, mg1Text);
            safeSetText(elements.mg1_state_text, Math.abs(phys.p_mg1) < 0.1 ? 'Idle' : (phys.p_mg1 > 0 ? 'Motoring (驱动)' : 'Generating (发电)'));

            const mg2LoadRate = (Math.abs(phys.p_mg2) / 83.05) * 100;
            const mg2LoadText = mg2LoadRate > 100 ? '(Overload)' : `(${mg2LoadRate.toFixed(0)}%)`;
            const mg2Text = `${phys.p_mg2.toFixed(1)} kW ${mg2LoadText}`;
            safeSetText(elements.p_mg2_disp, mg2Text);
            safeSetText(elements.mg2_state_text, Math.abs(phys.p_mg2) < 0.1 ? 'Idle' : (phys.p_mg2 > 0 ? 'Motoring (驱动)' : 'Generating (发电)'));
        }

        drawNomograph(elements.nomograph_canvas, state.n_mg1, state.n_ice, state.n_mg2, phys.t_mg1, state.t_ice, phys.t_mg2, state.t_load, cacheRef);
        drawIceMap(elements.ice_map_canvas, cacheRef.iceMapBackgroundCanvas, state.n_ice, state.t_ice, elements.current_efficiency, cacheRef);
    }

    function updateInputDisplay(input) {
        const value = parseFloat(input.value);
        const displayId = input.id.replace('_input', '_val');
        const displayElement = elements[displayId];
        if (displayElement) {
            displayElement.textContent = value.toFixed(0);
        }
    }

    function setupEventListeners() {
        const inputIds = ['v_input', 'nice_input', 'tice_input', 'tload_input'];
        inputIds.forEach(id => {
            const el = elements[id];
            if (el) {
                el.addEventListener('input', (e) => {
                    updateInputDisplay(e.target);
                    updatePhysics();
                }, { passive: true });
            }
        });
    }

    const scale = 0.01;
    const fixedDt = 1 / 60;

    function animate() {
        state.ang_sun += (state.n_mg1 / 60 * 360 * fixedDt) * scale;
        state.ang_carrier += (state.n_ice / 60 * 360 * fixedDt) * scale;
        state.ang_ring += (state.n_mg2 / 60 * 360 * fixedDt) * scale;

        const rpm_planet_rel = (state.n_mg1 - state.n_ice) * (-RATIO_SUN_PLANET);
        state.ang_planet += (rpm_planet_rel / 60 * 360 * fixedDt) * scale;

        drawPSD(psdCtx, gearPaths, state);

        animationFrameId = requestAnimationFrame(animate);
    }

    function startAnimation() {
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(animate);
        }
    }

    function stopAnimation() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    function setupResponsiveCanvas() {
        const nomographCanvas = elements.nomograph_canvas;
        const iceMapCanvas = elements.ice_map_canvas;
        if (!nomographCanvas || !iceMapCanvas) return;

        resizeObserver = new ResizeObserver(entries => {
            window.requestAnimationFrame(() => {
                if (!entries || !entries.length) return;
                let needsUpdate = false;

                for (const entry of entries) {
                    if (entry.target === nomographCanvas) {
                        if (updateCanvasDimensions(nomographCanvas)) {
                            needsUpdate = true;
                        }
                    } else if (entry.target === iceMapCanvas) {
                        if (updateCanvasDimensions(iceMapCanvas)) {
                            cacheRef.iceMapBackgroundCanvas = createIceMapBackground(iceMapCanvas);
                            cacheRef.lastIceParams = null;
                            needsUpdate = true;
                        }
                    }
                }

                if (needsUpdate) {
                    updatePhysics();
                }
            });
        });
        resizeObserver.observe(nomographCanvas);
        resizeObserver.observe(iceMapCanvas);
    }

    function cleanup() {
        stopAnimation();
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
    }

    function setupPageVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopAnimation();
            } else {
                startAnimation();
            }
        });
    }

    function init() {
        if (isInitialized) return;
        isInitialized = true;

        cacheElements();

        // Sync inputs
        const inputIds = ['v_input', 'nice_input', 'tice_input', 'tload_input'];
        inputIds.forEach(id => {
            const el = elements[id];
            if (el) {
                const val = parseFloat(el.value);
                if (id === 'v_input') state.v = val;
                if (id === 'nice_input') state.n_ice = val;
                if (id === 'tice_input') state.t_ice = val;
                if (id === 'tload_input') state.t_load = val;
                updateInputDisplay(el);
            }
        });

        // Sync canvas sizes before first frame
        updateCanvasDimensions(elements.nomograph_canvas);
        updateCanvasDimensions(elements.ice_map_canvas);

        cacheRef.iceMapBackgroundCanvas = createIceMapBackground(elements.ice_map_canvas);

        const psdData = initCanvasGears(elements.psd_canvas);
        if (psdData) {
            psdCtx = psdData.ctx;
            gearPaths = psdData.paths;
        }

        setupEventListeners();
        setupResponsiveCanvas();
        setupPageVisibilityHandling();

        updatePhysics();
        startAnimation();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('beforeunload', cleanup);
})();
