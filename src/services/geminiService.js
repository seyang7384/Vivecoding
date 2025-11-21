class GeminiService {
    constructor() {
        this.isAnalyzing = false;
        this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    }

    async getPatientNames() {
        try {
            // Try to get from localStorage (mock data)
            const patientsJson = localStorage.getItem('patients');
            if (patientsJson) {
                const patients = JSON.parse(patientsJson);
                return patients.map(p => p.name).filter(Boolean);
            }
            return [];
        } catch (error) {
            console.warn('⚠️ Failed to load patient names:', error);
            return [];
        }
    }

    async correctText(rawText) {
        if (!this.apiKey || this.apiKey.includes('your_openai_api_key')) return rawText;

        try {
            // Get patient names for context
            const patientNames = await this.getPatientNames();
            const patientContext = patientNames.length > 0 
                ? `\n[실제 환자 명단]\n${patientNames.join(', ')}\n` 
                : '';

            const systemPrompt = `
            너는 '세양한의원'의 스마트 진료 기록 비서야.
            사용자가 말하는 음성 텍스트는 발음이 부정확할 수 있어. 
            ${patientContext}
            [너의 임무]
            너의 방대한 **한의학 지식(본초, 경혈, 사상체질)**과 **병원 업무 센스**를 발휘해서 오타를 완벽하게 교정해.

            [교정 규칙]
            1. **환자 이름 우선:** 위 환자 명단에 있는 이름이면 정확히 매칭해. 발음이 비슷한 이름도 찾아줘 (예: "송미령"과 "송미경", "박철수"와 "방철수")
            2. **전문 용어 우선:** '백자격'→'백작약', '단귀'→'당귀', '혈압수정'→'혈압 측정' 처럼 문맥에 맞는 용어로 고쳐.
            3. **자연스러운 문장:** 끊어진 문장이 있으면 자연스럽게 이어줘.
            4. **강조:** 핵심 키워드(약재명, 치료 행위, 인명)는 **굵게** 표시해.
            5. **출력:** 잡담은 절대 하지 말고, '교정된 결과 텍스트'만 딱 출력해.
            `;

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: rawText }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) return rawText;
            const data = await response.json();
            return data.choices?.[0]?.message?.content || rawText;

        } catch (error) {
            console.error('OpenAI 교정 실패:', error);
            return rawText;
        }
    }

    // (로그 분석 함수 유지)
    async analyzeLogs(logs) {
        if (this.isAnalyzing || logs.length === 0) return null;
        this.isAnalyzing = true;
        await new Promise(resolve => setTimeout(resolve, 1500));
        const summary = { treatment: [], reservation: [], etc: [] };
        logs.forEach(log => {
            const text = log.text;
            if (text.includes('치료') || text.includes('완료')) {
                summary.treatment.push({ id: log.id, text: `${log.roleName}: ${text}`, timestamp: log.timestamp });
            } else if (text.includes('예약') || text.includes('수납')) {
                summary.reservation.push({ id: log.id, text: `${log.roleName}: ${text}`, timestamp: log.timestamp });
            } else {
                summary.etc.push({ id: log.id, text: `${log.roleName}: ${text}`, timestamp: log.timestamp });
            }
        });
        this.isAnalyzing = false;
        return summary;
    }
}

export const geminiService = new GeminiService();