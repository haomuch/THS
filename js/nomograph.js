/**
 * THS Nomograph (Lever Diagram) Visualizer
 */

// K is now a global from physics.js

function drawAxis(ctx, x, label, color, h) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawPoint(ctx, x, y, color, text) {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    let textY = y - 10;
    if (textY < 20) textY = y + 20;

    ctx.font = 'bold 12px Inter, sans-serif';
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;

    const padding = 4;
    const rectX = x + 12;
    const rectY = textY - 12;
    const rectWidth = textWidth + padding * 2;
    const rectHeight = 16;

    ctx.fillStyle = '#f7f7f7';
    ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, rectX + padding, rectY + rectHeight / 2);
}

function drawTorqueArrow(ctx, x, y, torque, color, label, scale, spacing) {
    if (Math.abs(torque) < 0.1) return;

    const arrowLength = Math.abs(torque) * scale;
    const maxArrowLength = 80;
    const limitedLength = Math.min(arrowLength, maxArrowLength);

    const direction = torque > 0 ? -1 : 1;
    const startY = y + spacing * direction;
    const endY = startY + limitedLength * direction;

    const arrowHeadSize = 12;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.moveTo(x, endY);
    ctx.lineTo(x - arrowHeadSize / 2, endY - arrowHeadSize * direction);
    ctx.lineTo(x + arrowHeadSize / 2, endY - arrowHeadSize * direction);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = direction > 0 ? 'top' : 'bottom';
    const textY = endY + 15 * direction;
    ctx.fillText(torque.toFixed(0) + ' Nm', x, textY);
}

function drawStaticNomograph(ctx, w, h) {
    const axisY = h / 2;
    const x_mg1 = w * 0.2;
    const x_mg2 = w * 0.8;
    const dist_total = x_mg2 - x_mg1;
    const x_ice = x_mg1 + dist_total * (K / (1 + K));

    ctx.beginPath();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.moveTo(0, axisY);
    ctx.lineTo(w, axisY);
    ctx.stroke();

    drawAxis(ctx, x_mg1, 'Sun (MG1)', '#3B82F6', h);
    drawAxis(ctx, x_ice, 'Carrier (ICE)', '#EF4444', h);
    drawAxis(ctx, x_mg2, 'Ring (MG2)', '#10B981', h);
}

function drawNomograph(canvas, n_s, n_c, n_r, t_mg1, t_ice, t_mg2, t_load, cacheRef) {
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = w / dpr;
    const logicalHeight = h / dpr;

    const lastState = cacheRef.lastLeverState;
    const hasStateChanged =
        lastState.n_s !== n_s || lastState.n_c !== n_c || lastState.n_r !== n_r ||
        lastState.t_mg1 !== t_mg1 || lastState.t_ice !== t_ice ||
        lastState.t_mg2 !== t_mg2 || lastState.t_load !== t_load;

    const bgCanvas = cacheRef.nomographBackgroundCanvas;
    const isBgInvalid = !bgCanvas || bgCanvas.width !== w || bgCanvas.height !== h;

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (!hasStateChanged && !isBgInvalid) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(bgCanvas, 0, 0);
    } else {
        ctx.clearRect(0, 0, w, h);
        if (isBgInvalid) {
            const newBgCanvas = document.createElement('canvas');
            newBgCanvas.width = w;
            newBgCanvas.height = h;
            const bgCtx = newBgCanvas.getContext('2d');
            bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            drawStaticNomograph(bgCtx, logicalWidth, logicalHeight);
            cacheRef.nomographBackgroundCanvas = newBgCanvas;
        }
        ctx.drawImage(cacheRef.nomographBackgroundCanvas, 0, 0);
        cacheRef.lastLeverState = { n_s, n_c, n_r, t_mg1, t_ice, t_mg2, t_load };
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const axisY = logicalHeight / 2;
    const scaleY = 0.01;

    const x_mg1 = logicalWidth * 0.2;
    const x_mg2 = logicalWidth * 0.8;
    const dist_total = x_mg2 - x_mg1;
    const x_ice = x_mg1 + dist_total * (K / (1 + K));

    const y_mg1 = axisY - (n_s * scaleY);
    const y_ice = axisY - (n_c * scaleY);
    const y_mg2 = axisY - (n_r * scaleY);

    // Draw Lever Line
    ctx.beginPath();
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 4;
    ctx.moveTo(x_mg1, y_mg1);
    ctx.lineTo(x_mg2, y_mg2);
    ctx.stroke();

    // Draw Points
    drawPoint(ctx, x_mg1, y_mg1, '#3B82F6', n_s.toFixed(0));
    drawPoint(ctx, x_ice, y_ice, '#EF4444', n_c.toFixed(0));
    drawPoint(ctx, x_mg2, y_mg2, '#10B981', n_r.toFixed(0));

    // Draw Torque Distribution Arrows
    const arrowScale = 0.03;
    const arrowSpacing = 30;
    const arrowSpacingLoad = 75;

    const isReverse = n_r < 0;
    const display_t_mg2 = isReverse ? -t_mg2 : t_mg2;
    const display_t_load = isReverse ? t_load : -t_load;

    drawTorqueArrow(ctx, x_mg1, y_mg1, t_mg1, '#3B82F6', 'MG1', arrowScale, arrowSpacing);
    drawTorqueArrow(ctx, x_ice, y_ice, t_ice, '#EF4444', 'ICE', arrowScale, arrowSpacing);
    drawTorqueArrow(ctx, x_mg2, y_mg2, display_t_mg2, '#10B981', 'MG2', arrowScale, arrowSpacing);
    drawTorqueArrow(ctx, x_mg2, y_mg2, display_t_load, '#6B7280', 'Load', arrowScale, arrowSpacingLoad);
}
