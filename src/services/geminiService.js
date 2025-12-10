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

    /**
     * Generate personalized message based on transcript (Single Channel Audio)
     * @param {string} transcript - Full conversation text (mixed voices)
     * @param {string} patientName - Target patient name
     * @param {string} type - 'PRIORITY' (우선배정) or 'RECALL' (리콜)
     */
    async generatePersonalizedMessage(transcript, patientName, type = 'RECALL') {
        if (!this.apiKey) return "API Key가 설정되지 않았습니다.";

        try {
            const systemPrompt = `
            너는 '세양한의원'의 베테랑 상담 실장이야.
            제공되는 텍스트는 **원장님이 마이크를 차고 진료한 녹음 내용**이야. (원장님 목소리와 환자 목소리가 섞여 있어)
            
            [목표]
            환자에게 보낼 **개인화된 문자 메시지**를 작성해.
            
            [분석 방법]
            1. **화자 구분**: 텍스트에서 '원장님'이 "${patientName}님"이라고 부르는 부분을 찾아서 문맥을 파악해.
            2. **정보 추출**:
               - **{{pain_site}}**: 환자가 아프다고 한 부위 (예: 허리, 뒷목).
               - **표현**: 환자가 사용한 구체적 표현 (예: "뻐근하다", "시리다", "욱신거린다")을 찾아내서 메시지에 녹여내.
               - **{{reject_reason}}**: (예약 거절 시) 환자가 댄 핑계나 사유 (예: "김장하러 가서", "야근 때문에").
            
            [메시지 작성 규칙]
            - **톤앤매너**: 정중하면서도 환자를 진심으로 걱정하는 따뜻한 어조.
            - **필수 포함**: 원장님의 당부 사항 ("염증이 걱정되니 꼭 오셔야 합니다" 등 문맥에 맞게).
            - **길이**: 3~4문장 이내로 간결하게.
            
            [상황별 가이드]
            - **PRIORITY (우선 배정)**: "아까 말씀하신 [사유] 때문에 일정 잡기 어려우셨죠? 원장님이 [부위] 염증 걱정하시며 18:00까지는 자리를 비워두라고 하셨습니다. 편하실 때 연락 주세요."
            - **RECALL (리콜)**: "지난번 [부위]가 [표현]하다고 하셨는데 좀 어떠신가요? 원장님이 많이 궁금해하십니다. 야간진료 열려있으니 편하게 내원하세요."
            
            [출력 형식]
            메시지 내용만 출력해. (부가 설명 금지)
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
                        { role: "user", content: `[환자명: ${patientName}]\n[녹음 내용]\n${transcript}` }
                    ],
                    temperature: 0.7
                })
            });

            if (!response.ok) throw new Error('OpenAI API Error');
            const data = await response.json();
            return data.choices?.[0]?.message?.content || "메시지 생성 실패";

        } catch (error) {
            console.error('AI Message Generation Failed:', error);
            return "AI 메시지 생성 중 오류가 발생했습니다.";
        }
    }
}

export const geminiService = new GeminiService();