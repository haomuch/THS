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

export function getEfficiency(rpm, torque) {
    if (rpm <= 0 || torque <= 0) return 0;

    const PEAK_RPM = 2600;
    const PEAK_TORQUE = 125;
    const PEAK_EFF = 0.41; // 41% max

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
 * Pre-renders static ICE efficiency heat map to an offscreen canvas
 */
export function createIceMapBackground(canvas) {
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;

    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const ctx = bgCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const PADDING_LEFT = 25;
    const PADDING_TOP = 5;
    const PADDING_BOTTOM = 5;
    const rpmMax = 6000;
    const torqueMax = 200;
    const ORIGIN_X = PADDING_LEFT;
    const ORIGIN_Y = logicalHeight - PADDING_BOTTOM;

    const R_STEPS = 600;
    const T_STEPS = 400;
    const stepR = rpmMax / R_STEPS;
    const W = logicalWidth - PADDING_LEFT;
    const H = logicalHeight - PADDING_BOTTOM - PADDING_TOP;

    const stepT = torqueMax / T_STEPS;
    const wR = W / R_STEPS + 0.5;
    const hT = H / T_STEPS + 0.5;

    for (let i = 0; i < R_STEPS; i++) {
        const r = i * stepR;
        const maxT = getMaxTorque(r);

        for (let j = 0; j < T_STEPS; j++) {
            const t = j * stepT;
            const x = ORIGIN_X + i * (W / R_STEPS);
            const y = ORIGIN_Y - ((j + 1) * (H / T_STEPS));

            if (t > maxT) {
                ctx.fillStyle = '#F3F4F6';
            } else {
                const eff = getEfficiency(r, t);
                if (eff >= 0.40) ctx.fillStyle = '#059669';
                else if (eff >= 0.38) ctx.fillStyle = '#10B981';
                else if (eff >= 0.35) ctx.fillStyle = '#F59E0B';
                else ctx.fillStyle = '#EF4444';
            }
            ctx.fillRect(x, y, wR, hT);
        }
    }

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
    const ctx = canvas.getContext('2d');

    const currentParams = `${rpm.toFixed(1)}_${torque.toFixed(1)}`;
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
