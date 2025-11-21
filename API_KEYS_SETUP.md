# API 키 설정 안내

이 프로젝트는 **OpenAI Whisper API**와 **Google Gemini API**를 사용합니다.

## 1. API 키 준비

### OpenAI API 키
1. https://platform.openai.com/api-keys 방문
2. "Create new secret key" 클릭
3. 키 복사

### Google Gemini API 키
1. https://aistudio.google.com/app/apikey 방문
2. "Get API key" 또는 "Create API key" 클릭
3. 키 복사

## 2. .env 파일에 키 입력

프로젝트 루트 디렉토리의 `.env` 파일을 열고 다음과 같이 입력하세요:

```
VITE_OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 3. 개발 서버 재시작

환경 변수를 적용하려면 개발 서버를 재시작해야 합니다:

```bash
# Ctrl+C로 현재 서버 중지
# 그 다음:
npm run dev
```

## 4. 테스트

1. 브라우저에서 http://localhost:5173 접속
2. "음성 관제 (HQ)" 메뉴 클릭
3. 역할 선택 (예: 진료실)
4. 마이크 버튼 클릭 → 말하기 → 버튼 다시 클릭
5. AI 처리 중 로딩 메시지 확인
6. 교정된 텍스트가 대화 로그에 표시됨

## 주의사항

⚠️ **API 키는 절대 Git에 커밋하지 마세요!**
- `.env` 파일은 `.gitignore`에 포함되어 있습니다.
- 실수로 커밋하지 않도록 주의하세요.

💰 **비용 관련**
- OpenAI Whisper: 약 $0.006/분
- Google Gemini: 무료 티어 제공 (1분당 60회 요청까지)

🔧 **개발 모드**
- API 키가 없어도 mock 데이터로 동작합니다.
- 실제 API를 테스트하려면 반드시 키를 입력하세요.
