// Auto Insurance Patient Visit Frequency Service

export const autoInsuranceService = {
    /**
     * Calculate days since injury
     * @param {string} injuryDate - Date string in YYYY-MM-DD format
     * @returns {number} Days since injury
     */
    calculateDaysSinceInjury: (injuryDate) => {
        if (!injuryDate) return 0;

        const injury = new Date(injuryDate);
        const today = new Date();

        // Reset time to midnight for accurate day calculation
        injury.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffTime = today - injury;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    },

    /**
     * Get current visit frequency period
     * @param {string} injuryDate - Date string in YYYY-MM-DD format
     * @returns {object} Period information
     */
    getVisitPeriod: (injuryDate) => {
        const days = autoInsuranceService.calculateDaysSinceInjury(injuryDate);

        // Period 1: 0-21 days (0-3 weeks) - Daily
        if (days <= 21) {
            return {
                period: 1,
                name: '초기 (0-3주)',
                description: '매일 내원 가능',
                visitsPerWeek: 7,
                color: 'red',
                startDay: 0,
                endDay: 21
            };
        }

        // Period 2: 22-77 days (4-11 weeks) - 3 times per week
        if (days <= 77) {
            return {
                period: 2,
                name: '중기 (4-11주)',
                description: '주 3회 내원 가능',
                visitsPerWeek: 3,
                color: 'orange',
                startDay: 22,
                endDay: 77
            };
        }

        // Period 3: 180+ days (6+ months) - Once per week
        if (days >= 180) {
            return {
                period: 3,
                name: '후기 (6개월 이후)',
                description: '주 1회 내원 가능',
                visitsPerWeek: 1,
                color: 'green',
                startDay: 180,
                endDay: null
            };
        }

        // Transition period: 78-179 days (between 11 weeks and 6 months)
        return {
            period: 'transition',
            name: '전환기 (11주~6개월)',
            description: '보험사 확인 필요',
            visitsPerWeek: null,
            color: 'gray',
            startDay: 78,
            endDay: 179
        };
    },

    /**
     * Format period badge info for UI
     * @param {string} injuryDate - Date string in YYYY-MM-DD format
     * @returns {object} Badge styling and text
     */
    getPeriodBadge: (injuryDate) => {
        const period = autoInsuranceService.getVisitPeriod(injuryDate);

        const colorClasses = {
            red: 'bg-red-100 text-red-700 border-red-200',
            orange: 'bg-orange-100 text-orange-700 border-orange-200',
            green: 'bg-green-100 text-green-700 border-green-200',
            gray: 'bg-gray-100 text-gray-700 border-gray-200'
        };

        return {
            text: period.name,
            description: period.description,
            className: `px-2 py-1 text-xs font-medium rounded border ${colorClasses[period.color]}`,
            period: period
        };
    },

    /**
     * Check if patient is auto insurance patient
     * @param {object} patient - Patient object
     * @returns {boolean}
     */
    isAutoInsurance: (patient) => {
        return patient?.isAutoInsurance === true;
    },

    /**
     * Get days remaining in current period
     * @param {string} injuryDate - Date string in YYYY-MM-DD format
     * @returns {number|null} Days remaining, or null if no end date
     */
    getDaysRemainingInPeriod: (injuryDate) => {
        const days = autoInsuranceService.calculateDaysSinceInjury(injuryDate);
        const period = autoInsuranceService.getVisitPeriod(injuryDate);

        if (period.endDay === null) return null;

        return period.endDay - days;
    },

    /**
     * Get formatted summary for patient detail page
     * @param {string} injuryDate - Date string in YYYY-MM-DD format
     * @returns {object} Formatted summary information
     */
    getSummary: (injuryDate) => {
        const days = autoInsuranceService.calculateDaysSinceInjury(injuryDate);
        const period = autoInsuranceService.getVisitPeriod(injuryDate);
        const remaining = autoInsuranceService.getDaysRemainingInPeriod(injuryDate);

        return {
            daysSinceInjury: days,
            currentPeriod: period,
            daysRemainingInPeriod: remaining,
            formattedInjuryDate: new Date(injuryDate).toLocaleDateString('ko-KR'),
            nextPeriodStartsIn: remaining
        };
    },

    // ========== Herbal Medicine Prescription Functions ==========

    /**
     * Check if herbal medicine prescription is allowed (12-week cutoff)
     * @param {string} injuryDate - Date string in YYYY-MM-DD format
     * @param {string} firstVisitDate - First visit date string in YYYY-MM-DD format
     * @returns {object} { allowed: boolean, reason: string, daysFromInjury: number }
     */
    canPrescribeHerbal: (injuryDate, firstVisitDate) => {
        if (!injuryDate || !firstVisitDate) {
            return { allowed: false, reason: '수상일 또는 첫 내원일 없음', daysFromInjury: 0 };
        }

        const injury = new Date(injuryDate);
        const firstVisit = new Date(firstVisitDate);

        injury.setHours(0, 0, 0, 0);
        firstVisit.setHours(0, 0, 0, 0);

        const diffTime = firstVisit - injury;
        const daysFromInjury = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        // 12-week cutoff = 84 days
        const CUTOFF_DAYS = 84;

        if (daysFromInjury >= CUTOFF_DAYS) {
            return {
                allowed: false,
                reason: '수상일로부터 12주 경과 (첩약 처방 불가)',
                daysFromInjury: daysFromInjury
            };
        }

        return {
            allowed: true,
            reason: '처방 가능',
            daysFromInjury: daysFromInjury
        };
    },

    /**
     * Check if prescription period crosses 12-week cutoff
     * @param {string} injuryDate - Date string in YYYY-MM-DD format
     * @param {string} prescriptionStartDate - Prescription start date
     * @returns {object} Warning information
     */
    checkPrescriptionCutoff: (injuryDate, prescriptionStartDate) => {
        if (!injuryDate || !prescriptionStartDate) {
            return { crossesCutoff: false, warning: null };
        }

        const injury = new Date(injuryDate);
        const prescStart = new Date(prescriptionStartDate);

        injury.setHours(0, 0, 0, 0);
        prescStart.setHours(0, 0, 0, 0);

        // Prescription end date (1 week later)
        const prescEnd = new Date(prescStart);
        prescEnd.setDate(prescEnd.getDate() + 7);

        // 12-week cutoff date
        const cutoffDate = new Date(injury);
        cutoffDate.setDate(cutoffDate.getDate() + 84);

        // Check if prescription period crosses cutoff
        if (prescEnd > cutoffDate && prescStart < cutoffDate) {
            const validDays = Math.floor((cutoffDate - prescStart) / (1000 * 60 * 60 * 24));
            return {
                crossesCutoff: true,
                warning: `처방 기간 중 12주 경과 (${validDays}일만 유효, 삭감 가능)`,
                validDays: validDays,
                cutoffDate: cutoffDate.toISOString().split('T')[0]
            };
        }

        return { crossesCutoff: false, warning: null };
    },

    /**
     * Get remaining prescription count (max 3)
     * @param {array} prescriptions - Array of prescription objects
     * @returns {number} Remaining prescriptions (0-3)
     */
    getRemainingPrescriptions: (prescriptions) => {
        if (!prescriptions || !Array.isArray(prescriptions)) return 3;

        const used = prescriptions.filter(p => p.status !== 'cancelled').length;
        return Math.max(0, 3 - used);
    },

    /**
     * Get comprehensive warnings for auto insurance herbal medicine
     * @param {object} patient - Patient object
     * @returns {array} Array of warning objects
     */
    getHerbalWarnings: (patient) => {
        const warnings = [];

        if (!patient.isAutoInsurance) return warnings;

        // Check if prescription is allowed
        if (patient.firstVisitDate) {
            const prescCheck = autoInsuranceService.canPrescribeHerbal(
                patient.injuryDate,
                patient.firstVisitDate
            );

            if (!prescCheck.allowed) {
                warnings.push({
                    type: 'error',
                    message: prescCheck.reason,
                    icon: '🔴'
                });
            }
        }

        // Check remaining prescriptions
        const remaining = autoInsuranceService.getRemainingPrescriptions(patient.herbalPrescriptions);
        if (remaining === 0) {
            warnings.push({
                type: 'info',
                message: '첩약 처방 3회 모두 소진됨',
                icon: '⚫'
            });
        } else if (remaining <= 1) {
            warnings.push({
                type: 'warning',
                message: `첩약 처방 ${remaining}회 남음`,
                icon: '🟡'
            });
        }

        return warnings;
    }
};
