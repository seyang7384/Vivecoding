// Smart Text Parsing Service for Prescription Entry

export const prescriptionParserService = {
    /**
     * Parse prescription text (4-line format)
     * Line 1: Patient name (remove honorifics)
     * Line 2: Prescription detail  
     * Line 3: Water volume
     * Line 4: Memo (extract days from pattern like "14팩-7일분")
     * 
     * @param {string} text - Raw text input
     * @returns {object} Parsed data or error
     */
    parseText: (text) => {
        if (!text || !text.trim()) {
            return {
                success: false,
                error: '텍스트를 입력해주세요.'
            };
        }

        // Split by newlines and filter out empty lines
        const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length < 4) {
            return {
                success: false,
                error: '최소 4줄 필요합니다.\n(이름, 처방 구성, 물 용량, 비고)'
            };
        }

        // Extract duration from 4th line (e.g., "14팩-7일분")
        const durationMatch = lines[3].match(/(\d+)일분/);
        const duration = durationMatch ? parseInt(durationMatch[1]) : 15; // Default 15 days

        return {
            success: true,
            data: {
                patientName: prescriptionParserService.cleanPatientName(lines[0]),
                prescriptionDetail: lines[1],
                waterVolume: lines[2],
                memo: lines[3],
                duration: duration
            }
        };
    },

    /**
     * Remove honorifics from patient name
     * @param {string} name - Raw name with possible honorifics
     * @returns {string} Cleaned name
     */
    cleanPatientName: (name) => {
        if (!name) return '';

        // Remove common Korean honorifics
        return name
            .replace(/(님|환자|귀하)\s*$/g, '')
            .trim();
    },

    /**
     * Find patient by name in patient list
     * @param {string} name - Patient name to search
     * @param {array} patients - Array of patient objects
     * @returns {object|null} Patient object or null
     */
    findPatientByName: (name, patients) => {
        if (!name || !patients || patients.length === 0) {
            return null;
        }

        const cleanedName = prescriptionParserService.cleanPatientName(name);

        return patients.find(patient =>
            patient.name === cleanedName
        ) || null;
    },

    /**
     * Calculate follow-up date
     * @param {string} prescribedDate - Prescription date (YYYY-MM-DD)
     * @param {number} duration - Duration in days
     * @returns {string} Follow-up date (YYYY-MM-DD)
     */
    calculateFollowUpDate: (prescribedDate, duration) => {
        const date = new Date(prescribedDate);
        date.setDate(date.getDate() + duration);
        return date.toISOString().split('T')[0];
    },

    /**
     * Format prescription for display
     * @param {object} prescription - Prescription object
     * @returns {string} Formatted text
     */
    formatPrescription: (prescription) => {
        return `📋 [처방 등록 완료]
성함: ${prescription.patientName}
약재: ${prescription.prescriptionDetail}
물량: ${prescription.waterVolume}
비고: ${prescription.memo}
📅 복용 기간: ${prescription.duration}일
🔔 재상담 예정일: ${new Date(prescription.followUpDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}로 자동 예약되었습니다.`;
    }
};
