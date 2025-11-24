// Smart Text Parsing Service for Prescription Entry

import { parsePrescription } from '../utils/SmartParser';

export const prescriptionParserService = {
    /**
     * Parse prescription text using SmartParser
     * Supports both System Format and Legacy Format
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

        try {
            // Use SmartParser
            const parsed = parsePrescription(text);

            // Validate essential fields
            if (!parsed.patientName) {
                return {
                    success: false,
                    error: '환자명을 찾을 수 없습니다.'
                };
            }

            // Clean patient name (extra safety)
            const cleanName = prescriptionParserService.cleanPatientName(parsed.patientName);

            // Format herbs for display (e.g., "당귀 10g, 천궁 8g")
            // If herbs extraction failed but text exists, we might want to handle it, 
            // but SmartParser focuses on extraction. 
            // We'll construct the string from extracted herbs.
            let prescriptionDetail = '';
            if (parsed.herbs && parsed.herbs.length > 0) {
                prescriptionDetail = parsed.herbs.map(h => `${h.name} ${h.amount}g`).join(', ');
            } else {
                // Fallback: if no herbs extracted, try to use the raw line if possible?
                // SmartParser doesn't return raw lines easily. 
                // We'll assume empty if not extracted, or maybe the user wants the raw text?
                // For now, let's leave it empty or generic message if extraction fails.
                prescriptionDetail = '약재 정보 없음 (파싱 실패)';
            }

            // Extract duration from memo (metaData[1])
            const memo = parsed.metaData[1] || '';
            const durationMatch = memo.match(/(\d+)일분/);
            const duration = durationMatch ? parseInt(durationMatch[1]) : 15; // Default 15 days

            return {
                success: true,
                data: {
                    patientName: cleanName,
                    prescriptionDetail: prescriptionDetail,
                    waterVolume: parsed.metaData[0] || '', // meta1
                    memo: memo, // meta2
                    duration: duration,
                    herbs: parsed.herbs // Keep structured data for future use
                }
            };

        } catch (error) {
            console.error('SmartParser Error:', error);
            return {
                success: false,
                error: '파싱 중 오류가 발생했습니다.\n형식을 확인해주세요.'
            };
        }
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
