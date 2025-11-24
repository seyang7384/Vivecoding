// src/utils/SmartParser.js

export const parsePrescription = (text) => {
    const trimmedText = text.trim();

    // [판별 로직] 텍스트에 "성함:"과 "약재:"가 포함되어 있으면 '시스템 포맷'으로 간주
    const isSystemFormat = trimmedText.includes("성함:") && trimmedText.includes("약재:");

    if (isSystemFormat) {
        return parseSystemFormat(trimmedText);
    } else {
        return parseLegacyFormat(trimmedText);
    }
};

// ---------------------------------------------------------
// 1. 시스템 포맷 파서 (복붙한 결과 메시지 해석용)
// ---------------------------------------------------------
const parseSystemFormat = (text) => {
    const lines = text.split('\n');
    let patientName = "";
    let herbString = "";
    let meta1 = ""; // 물량 (가격/코드)
    let meta2 = ""; // 비고

    lines.forEach(line => {
        const cleanLine = line.trim();

        if (cleanLine.startsWith("성함:")) {
            patientName = cleanLine.replace("성함:", "").trim();
        } else if (cleanLine.startsWith("약재:")) {
            herbString = cleanLine.replace("약재:", "").trim();
        } else if (cleanLine.startsWith("물량:")) {
            meta1 = cleanLine.replace("물량:", "").trim();
        } else if (cleanLine.startsWith("비고:")) {
            meta2 = cleanLine.replace("비고:", "").trim();
        }
    });

    return {
        rawText: text,
        patientName, // "김철수"
        herbs: extractHerbs(herbString), // 약재 리스트 추출
        metaData: [meta1, meta2]
    };
};

// ---------------------------------------------------------
// 2. 레거시 포맷 파서 (기존 카톡 4줄 복붙용)
// ---------------------------------------------------------
const parseLegacyFormat = (text) => {
    const lines = text.split('\n');

    // 데이터가 불완전할 경우 대비
    const line1 = lines[0] || ""; // 이름 라인
    const line2 = lines[1] || ""; // 약재 라인
    const line3 = lines[2] || ""; // 메타1
    const line4 = lines[3] || ""; // 메타2

    // "김철수님" -> "김철수"
    const patientName = line1.replace("님", "").trim();

    return {
        rawText: text,
        patientName,
        herbs: extractHerbs(line2), // 2번째 줄에서 약재 추출
        metaData: [line3, line4]
    };
};

// ---------------------------------------------------------
// [공통 함수] 약재 문자열에서 {이름, 용량} 뽑아내기
// ---------------------------------------------------------
const extractHerbs = (herbLine) => {
    // 예: "백하수오60 인삼60" -> [{name: "백하수오", amount: 60}, ...]
    // [수정] 띄어쓰기(\s*) 허용, 뒤에 잡다한 문자(g, 콤마 등) 무시
    const herbPattern = /([가-힣]+)\s*(\d+)/g;
    const herbs = [];
    let match;

    while ((match = herbPattern.exec(herbLine)) !== null) {
        herbs.push({
            name: match[1],   // 약재명
            amount: parseInt(match[2], 10) // g수
        });
    }
    return herbs;
};
