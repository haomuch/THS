/**
 * ICE Efficiency Map (M20A-FXS Engine Simulation)
 */

export function getMaxTorque(rpm) {
    if (rpm < 100) return rpm * (30 / 100);
    if (rpm < 1000) return 30 + (rpm - 100) * (100 / 900);
    if (rpm < 2400) return 130 + (rpm - 1000) * (40 / 1400);
    if (rpm < 4400) return 170 + (rpm - 2400) * (18 / 2000);
    if (rpm <= 5200) return 188;
    return 188 - (rpm - 5200) * (10 / 800);
}

const PEAK_RPM = 2600;
const PEAK_TORQUE = 125;
const PEAK_EFF = 0.41; // 41% max

export function getEfficiency(rpm, torque) {
    if (rpm <= 0 || torque <= 0) return 0;

    const rpmDist = (rpm - PEAK_RPM) / 6000;
    const torqueDist = (torque - PEAK_TORQUE) / 188;

    const dist = Math.sqrt(rpmDist * rpmDist + torqueDist * torqueDist);
    let eff = PEAK_EFF - 0.2 * dist;

    if (torque < 40) {
        eff -= 0.01 * Math.pow((40 - torque) / 40, 2);
    }
    if (rpm > 3000) {
        eff -= 0.01 * Math.pow((rpm - 3000) / 3000, 2);
    }

    return Math.max(0.2, Math.min(eff, PEAK_EFF));
}

/**
 * Packs an #RRGGBB color into a platform-endianness-correct RGBA32 word
 * so it can be written straight into an ImageData buffer.
 */
function packRGBA(hex) {
    const buf = new ArrayBuffer(4);
    new Uint8Array(buf).set([
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
        255
    ]);
    return new Uint32Array(buf)[0];
}

const C_OUT_OF_BOUNDS = packRGBA('#F3F4F6');
const C_EFF_40 = packRGBA('#059669');
const C_EFF_38 = packRGBA('#10B981');
const C_EFF_35 = packRGBA('#F59E0B');
const C_EFF_LOW = packRGBA('#EF4444');

/**
 * Pre-renders static ICE efficiency heat map to an offscreen canvas.
 *
 * The heat field is rasterised straight into an ImageData buffer and uploaded
 * with a single putImageData call. The previous implementation issued
 * 600 x 400 = 240,000 sub-pixel fillRect calls, which blocked the main thread
 * for hundreds of milliseconds on mobile Safari and delayed the very first
 * paint of every canvas on the page.
 */
export function createIceMapBackground(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return null;
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;

    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const ctx = bgCanvas.getContext('2d');

    const PADDING_LEFT = 25;
    const PADDING_TOP = 5;
    const PADDING_BOTTOM = 5;
    const rpmMax = 6000;
    const torqueMax = 200;
    const ORIGIN_X = PADDING_LEFT;
    const ORIGIN_Y = logicalHeight - PADDING_BOTTOM;

    const W = logicalWidth - PADDING_LEFT;
    const H = logicalHeight - PADDING_BOTTOM - PADDING_TOP;

    // --- Heat field: one ImageData upload instead of 240k fillRect ---
    const px0 = Math.max(0, Math.round(ORIGIN_X * dpr));
    const px1 = Math.min(bgCanvas.width, Math.round((ORIGIN_X + W) * dpr));
    const py0 = Math.max(0, Math.round(PADDING_TOP * dpr));
    const py1 = Math.min(bgCanvas.height, Math.round(ORIGIN_Y * dpr));
    const spanX = px1 - px0;
    const spanY = py1 - py0;

    if (spanX > 0 && spanY > 0) {
        const img = ctx.createImageData(bgCanvas.width, bgCanvas.height);
        const pixels = new Uint32Array(img.data.buffer);
        const stride = bgCanvas.width;

        // Per-column constants (depend on RPM only)
        const rpmDistSq = new Float64Array(spanX);
        const rpmPenalty = new Float64Array(spanX);
        const maxTorque = new Float64Array(spanX);
        for (let i = 0; i < spanX; i++) {
            const r = ((i + 0.5) / spanX) * rpmMax;
            const rd = (r - PEAK_RPM) / rpmMax;
            rpmDistSq[i] = rd * rd;
            rpmPenalty[i] = r > 3000 ? 0.01 * ((r - 3000) / 3000) * ((r - 3000) / 3000) : 0;
            maxTorque[i] = getMaxTorque(r);
        }

        // Per-row constants (depend on torque only)
        for (let j = 0; j < spanY; j++) {
            const t = ((spanY - 0.5 - j) / spanY) * torqueMax;
            const td = (t - PEAK_TORQUE) / 188;
            const torqueDistSq = td * td;
            const torquePenalty = t < 40 ? 0.01 * ((40 - t) / 40) * ((40 - t) / 40) : 0;

            let p = (py0 + j) * stride + px0;
            for (let i = 0; i < spanX; i++, p++) {
                if (t > maxTorque[i]) {
                    pixels[p] = C_OUT_OF_BOUNDS;
                    continue;
                }
                const eff = PEAK_EFF
                    - 0.2 * Math.sqrt(rpmDistSq[i] + torqueDistSq)
                    - torquePenalty
                    - rpmPenalty[i];
                pixels[p] = eff >= 0.40 ? C_EFF_40
                    : eff >= 0.38 ? C_EFF_38
                        : eff >= 0.35 ? C_EFF_35
                            : C_EFF_LOW;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Draw Max Torque Line
    ctx.beginPath();
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    for (let r = 0; r <= rpmMax; r += 50) {
        const t = getMaxTorque(r);
        const x = ORIGIN_X + (r / rpmMax) * W;
        const y = ORIGIN_Y - (t / torqueMax) * H;
        if (r === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Axes Lines
    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ORIGIN_X, 0); ctx.lineTo(ORIGIN_X, ORIGIN_Y);
    ctx.moveTo(ORIGIN_X, ORIGIN_Y); ctx.lineTo(logicalWidth, ORIGIN_Y);
    ctx.stroke();

    // Y-axis Ticks
    ctx.fillStyle = '#6B7280';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('200', ORIGIN_X - 5, ORIGIN_Y - H + 5);
    ctx.fillText('0', ORIGIN_X - 5, ORIGIN_Y - 5);

    return bgCanvas;
}

/**
 * Renders ICE Map canvas with current operating point marker
 */
export function drawIceMap(canvas, bgCanvas, rpm, torque, effElement, cacheRef) {
    if (!canvas || !bgCanvas) return;
    // The offscreen background must match the current bitmap size, otherwise
    // drawImage would stretch a stale map over a freshly resized canvas.
    if (bgCanvas.width !== canvas.width || bgCanvas.height !== canvas.height) return;
    const ctx = canvas.getContext('2d');

    // Bitmap size is part of the key: assigning canvas.width/height wipes the
    // bitmap, so a resize must always force a repaint.
    const currentParams = `${canvas.width}x${canvas.height}_${rpm.toFixed(1)}_${torque.toFixed(1)}`;
    if (cacheRef && cacheRef.lastIceParams === currentParams) return;
    if (cacheRef) cacheRef.lastIceParams = currentParams;

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;

    const PADDING_LEFT = 25;
    const PADDING_TOP = 5;
    const PADDING_BOTTOM = 5;
    const W = logicalWidth - PADDING_LEFT;
    const H = logicalHeight - PADDING_BOTTOM - PADDING_TOP;
    const rpmMax = 6000;
    const torqueMax = 200;
    const ORIGIN_X = PADDING_LEFT;
    const ORIGIN_Y = logicalHeight - PADDING_BOTTOM;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bgCanvas, 0, 0);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const currentX = ORIGIN_X + (rpm / rpmMax) * W;
    const currentY = ORIGIN_Y - (torque / torqueMax) * H;
    const currentEff = getEfficiency(rpm, torque);
    const maxT_current = getMaxTorque(rpm);

    if (rpm > 0 && torque > 0) {
        const isOutOfBounds = torque > maxT_current;

        ctx.beginPath();
        ctx.arc(currentX, currentY, 5, 0, Math.PI * 2);
        ctx.fillStyle = isOutOfBounds ? '#9CA3AF' : 'black';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();

        const effPercent = (currentEff * 100).toFixed(1);
        const effText = isOutOfBounds ? `超出扭矩边界` : `当前热效率: ${effPercent}%`;
        if (effElement && effElement.textContent !== effText) {
            effElement.textContent = effText;
        }

        let newClass = '';
        if (isOutOfBounds) {
            newClass = 'text-center font-bold text-sm mt-2 text-gray-500';
        } else if (currentEff >= 0.40) {
            newClass = 'text-center font-bold text-sm mt-2 text-[#059669]';
        } else if (currentEff >= 0.38) {
            newClass = 'text-center font-bold text-sm mt-2 text-[#10B981]';
        } else if (currentEff >= 0.35) {
            newClass = 'text-center font-bold text-sm mt-2 text-[#F59E0B]';
        } else {
            newClass = 'text-center font-bold text-sm mt-2 text-[#EF4444]';
        }
        if (effElement && effElement.className !== newClass) {
            effElement.className = newClass;
        }
    } else {
        const defaultText = `当前热效率: N/A`;
        if (effElement && effElement.textContent !== defaultText) {
            effElement.textContent = defaultText;
        }
        const newClass = 'text-center font-bold text-sm mt-2 text-gray-700';
        if (effElement && effElement.className !== newClass) {
            effElement.className = newClass;
        }
    }
}
