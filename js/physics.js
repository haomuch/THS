/**
 * THS Physics & Kinematics Engine
 */

export const K = 2.6; // Ring / Sun teeth ratio
export const RATIO_SUN_PLANET = 2 / (K - 1); // r_sun / r_planet
export const FACTOR_KMH_TO_RPM = 25.5;
export const CONST_9550 = 9550;

/**
 * Calculate mechanical power in kW from RPM and Torque (Nm)
 */
export function calculateSignedPower(rpm, torque) {
    return (Math.abs(rpm) * torque) / CONST_9550;
}

/**
 * Perform THS power split kinematics and dynamic calculations
 */
export function calculatePhysics(v, n_ice, t_ice, t_load) {
    // Kinematics
    const n_mg2 = v * FACTOR_KMH_TO_RPM;
    const n_mg1 = (1 + K) * n_ice - K * n_mg2;

    // Torque Balance
    const t_ring_from_ice = t_ice * (K / (1 + K));
    const t_sun_from_ice = t_ice * (1 / (1 + K));
    const t_mg1 = -t_sun_from_ice;

    const t_wheel = t_load;
    let t_mg2;
    if ((n_mg2 >= 0 && t_ring_from_ice >= 0) || (n_mg2 < 0 && t_ring_from_ice <= 0)) {
        t_mg2 = t_wheel - t_ring_from_ice;
    } else {
        t_mg2 = t_wheel + Math.abs(t_ring_from_ice);
    }

    // Power
    const p_ice = (n_ice * t_ice) / CONST_9550;
    const p_wheel = calculateSignedPower(n_mg2, t_load);
    const p_mg1 = (n_mg1 * t_mg1) / CONST_9550;
    const p_mg2 = calculateSignedPower(n_mg2, t_mg2);
    const p_batt = p_mg1 + p_mg2;

    return {
        n_mg1,
        n_mg2,
        t_mg1,
        t_mg2,
        t_ring_from_ice,
        t_sun_from_ice,
        p_ice,
        p_wheel,
        p_mg1,
        p_mg2,
        p_batt
    };
}
