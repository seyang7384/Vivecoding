// Prescription Management Service

import { prescriptionParserService } from './prescriptionParserService';

const PRESCRIPTIONS_KEY = 'prescriptions';
const SCHEDULE_EVENTS_KEY = 'schedule_events';

export const prescriptionService = {
    /**
     * Create new prescription
     * @param {object} prescriptionData - Prescription data
     * @returns {object} Created prescription
     */
    createPrescription: (prescriptionData) => {
        const prescription = {
            id: Date.now(),
            ...prescriptionData,
            prescribedDate: new Date().toISOString().split('T')[0],
            createdAt: Date.now(),
            createdBy: '관리자'
        };

        // Calculate follow-up date
        prescription.followUpDate = prescriptionParserService.calculateFollowUpDate(
            prescription.prescribedDate,
            prescription.duration
        );

        // Save to localStorage
        const existing = prescriptionService.getAllPrescriptions();
        existing.push(prescription);
        localStorage.setItem(PRESCRIPTIONS_KEY, JSON.stringify(existing));

        return prescription;
    },

    /**
     * Get all prescriptions
     * @returns {array} Array of prescriptions
     */
    getAllPrescriptions: () => {
        const stored = localStorage.getItem(PRESCRIPTIONS_KEY);
        return stored ? JSON.parse(stored) : [];
    },

    /**
     * Get prescriptions for a specific patient
     * @param {string} patientId - Patient ID
     * @returns {array} Array of prescriptions
     */
    getPatientPrescriptions: (patientId) => {
        const all = prescriptionService.getAllPrescriptions();
        return all.filter(p => p.patientId === patientId);
    },

    /**
     * Create follow-up appointment in calendar
     * @param {object} prescription - Prescription object
     * @returns {object} Created event
     */
    createFollowUpAppointment: (prescription) => {
        const event = {
            id: `prescription-${prescription.id}`,
            title: `재처방 상담(자동생성) - ${prescription.patientName}`,
            start: prescription.followUpDate,
            allDay: true,
            backgroundColor: '#8b5cf6',
            borderColor: '#8b5cf6',
            extendedProps: {
                type: 'prescription_followup',
                prescriptionId: prescription.id,
                patientId: prescription.patientId,
                patientName: prescription.patientName
            }
        };

        // Get existing schedule events
        const existing = localStorage.getItem(SCHEDULE_EVENTS_KEY);
        const events = existing ? JSON.parse(existing) : [];

        // Add new event
        events.push(event);
        localStorage.setItem(SCHEDULE_EVENTS_KEY, JSON.stringify(events));

        return event;
    },

    /**
     * Send system message to chat
     * @param {object} prescription - Prescription object
     * @returns {object} Created message
     */
    sendChatNotification: (prescription) => {
        const message = {
            id: Date.now().toString(),
            text: prescriptionParserService.formatPrescription(prescription),
            userId: 'system',
            userName: '시스템',
            timestamp: Date.now(),
            read: false,
            isSystemMessage: true
        };

        // Save to "첩약 처방" chat room
        const storageKey = 'chat_messages_prescription';
        const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
        existing.push(message);
        localStorage.setItem(storageKey, JSON.stringify(existing));

        return message;
    },

    /**
     * Process prescription: parse, validate, save, schedule, notify
     * @param {string} text - Raw prescription text
     * @param {number} duration - Duration in days
     * @param {array} patients - Array of patients
     * @returns {object} Result with success status and data/error
     */
    processPrescription: (text, duration, patients) => {
        // 1. Parse text
        const parseResult = prescriptionParserService.parseText(text);
        if (!parseResult.success) {
            return parseResult;
        }

        const parsedData = parseResult.data;

        // 2. Find patient
        const patient = prescriptionParserService.findPatientByName(
            parsedData.patientName,
            patients
        );

        if (!patient) {
            return {
                success: false,
                error: '환자 정보를 찾을 수 없습니다.',
                patientName: parsedData.patientName,
                needsRegistration: true
            };
        }

        // 3. Create prescription
        const prescription = prescriptionService.createPrescription({
            ...parsedData,
            patientId: patient.id,
            duration: duration
        });

        // 4. Create follow-up appointment
        const appointment = prescriptionService.createFollowUpAppointment(prescription);

        // 5. Send chat notification
        const chatMessage = prescriptionService.sendChatNotification(prescription);

        return {
            success: true,
            prescription: prescription,
            appointment: appointment,
            chatMessage: chatMessage
        };
    }
};
