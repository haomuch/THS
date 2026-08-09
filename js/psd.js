/**
 * PSD (Power Split Device) Planetary Gear Visualization
 */

import { K } from './physics.js';

const TO_RAD = Math.PI / 180;

function makePath(toothCount, pitchR, isInternal, holeR) {
    const toothH = 6;
    const path = new Path2D();
    const step = (2 * Math.PI) / toothCount;
    const bAngle = step * 0.6;
    const tAngle = bAngle * 0.4;
    const rTip = isInternal ? pitchR - toothH / 2 : pitchR + toothH / 2;
    const rBase = isInternal ? pitchR + toothH / 2 : pitchR - toothH / 2;
    for (let i = 0; i < toothCount; i++) {
        const a = i * step;
        const bs = a - bAngle / 2, ts = a - tAngle / 2, te = a + tAngle / 2;
        const be = a + bAngle / 2, nbs = a + step - bAngle / 2;
        if (i === 0) {
            path.moveTo(rBase * Math.cos(bs), rBase * Math.sin(bs));
        } else {
            path.lineTo(rBase * Math.cos(bs), rBase * Math.sin(bs));
        }
        path.lineTo(rTip * Math.cos(ts), rTip * Math.sin(ts));
        path.arc(0, 0, rTip, ts, te);
        path.lineTo(rBase * Math.cos(be), rBase * Math.sin(be));
        path.arc(0, 0, rBase, be, nbs);
    }
    path.closePath();
    if (holeR) {
        path.moveTo(holeR, 0);
        path.arc(0, 0, holeR, 0, Math.PI * 2, true);
    }
    return path;
}

export function initCanvasGears(canvas) {
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const logicalSize = 240;
    canvas.width = logicalSize * dpr;
    canvas.height = logicalSize * dpr;
    canvas.style.width = logicalSize + 'px';
    canvas.style.height = logicalSize + 'px';
    const psdCtx = canvas.getContext('2d', { alpha: false });

    const scale = 1.28;
    const sunTeeth = 30;
    const planetTeeth = ((K - 1) * sunTeeth) / 2;
    const ringTeeth = K * sunTeeth;
    const sunR = sunTeeth * scale;
    const planetR = planetTeeth * scale;
    const ringR = ringTeeth * scale;
    const toothH = 6;
    const ringExtR = ringR + toothH + 8;

    const carrierR = sunR + planetR;
    const planetAngles = [-90, 30, 150].map(d => (d * Math.PI) / 180);

    const ringExt = makePath(ringTeeth, ringExtR, false, 0);
    const ringInt = makePath(ringTeeth, ringR, true, 0);
    const ringCombined = new Path2D(ringExt);
    ringCombined.addPath(ringInt);

    const carrierArms = new Path2D();
    planetAngles.forEach(rad => {
        const ratio = (carrierR - 15) / carrierR;
        carrierArms.moveTo(0, 0);
        carrierArms.lineTo(carrierR * ratio * Math.cos(rad), carrierR * ratio * Math.sin(rad));
    });
    const carrierCenter = new Path2D();
    carrierCenter.arc(0, 0, 12, 0, Math.PI * 2);

    return {
        ctx: psdCtx,
        paths: {
            sun: makePath(sunTeeth, sunR, false, 15),
            planet: makePath(planetTeeth, planetR, false, 12),
            ringExt,
            ringInt,
            ring: ringCombined,
            carrierArms,
            carrierCenter,
            planetOffsets: planetAngles.map(rad => ({
                x: carrierR * Math.cos(rad),
                y: carrierR * Math.sin(rad)
            })),
            ringMarkerR: Math.round((ringR + ringExtR) / 2),
            dpr
        }
    };
}

export function drawPSD(psdCtx, gearPaths, state) {
    if (!psdCtx || !gearPaths) return;
    const ctx = psdCtx;
    const dpr = gearPaths.dpr;
    const logicalSize = 240;
    const cx = logicalSize / 2;
    const cy = logicalSize / 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, logicalSize, logicalSize);
    ctx.translate(cx, cy);

    const angC = state.ang_carrier * TO_RAD;
    const angR = state.ang_ring * TO_RAD;
    const angS = state.ang_sun * TO_RAD;
    const angP = state.ang_planet * TO_RAD;

    // Ring gear
    ctx.save();
    ctx.rotate(angR);
    ctx.fillStyle = '#10B981';
    ctx.fill(gearPaths.ring, 'evenodd');
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 1;
    ctx.stroke(gearPaths.ringExt);
    ctx.stroke(gearPaths.ringInt);
    // Ring markers
    ctx.fillStyle = '#A7F3D0';
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(gearPaths.ringMarkerR * Math.cos(a), gearPaths.ringMarkerR * Math.sin(a), 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // Carrier
    ctx.save();
    ctx.rotate(angC);
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke(gearPaths.carrierArms);
    ctx.fillStyle = '#EF4444';
    ctx.fill(gearPaths.carrierCenter);
    ctx.restore();

    // Planets
    gearPaths.planetOffsets.forEach(p => {
        ctx.save();
        ctx.rotate(angC);
        ctx.translate(p.x, p.y);
        ctx.rotate(angP);
        ctx.fillStyle = '#6B7280';
        ctx.fill(gearPaths.planet, 'evenodd');
        ctx.strokeStyle = '#6B7280';
        ctx.lineWidth = 0.5;
        ctx.stroke(gearPaths.planet);
        // Planet markers
        ctx.fillStyle = '#D1D5DB';
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(20 * Math.cos(a), 20 * Math.sin(a), 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    });

    // Sun gear
    ctx.save();
    ctx.rotate(angS);
    ctx.fillStyle = '#3B82F6';
    ctx.fill(gearPaths.sun, 'evenodd');
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 0.5;
    ctx.stroke(gearPaths.sun);
    // Sun markers
    ctx.fillStyle = '#DBEAFE';
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(25 * Math.cos(a), 25 * Math.sin(a), 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
