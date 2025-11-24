// 네이버 클로바 서버에 직접 연결해서 어떤 메서드를 지원하는지 확인
require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, 'proto', 'nest.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const nestProto = grpc.loadPackageDefinition(packageDefinition).com.naver.clova.speech.client;

const CLOVA_API_URL = process.env.CLOVA_SPEECH_INVOKE_URL || 'clovaspeech-gw.ncloud.com:50051';
const CLOVA_SECRET = process.env.CLOVA_SPEECH_SECRET;

console.log('=== 테스트 시작 ===');
console.log('URL:', CLOVA_API_URL);
console.log('Secret 길이:', CLOVA_SECRET ? CLOVA_SECRET.length : 0);
console.log('\n로드된 서비스들:');
console.log(Object.keys(nestProto));

console.log('\n각 서비스의 메서드들:');
Object.keys(nestProto).forEach(serviceName => {
    const service = nestProto[serviceName];
    if (service && typeof service === 'function') {
        console.log(`\n${serviceName}:`);
        const instance = new service(CLOVA_API_URL, grpc.credentials.createSsl());
        console.log('  메서드:', Object.keys(Object.getPrototypeOf(instance)));
    }
});

// 실제 연결 테스트
console.log('\n=== 실제 연결 테스트 ===');
const metadata = new grpc.Metadata();
metadata.add('Authorization', `Bearer ${CLOVA_SECRET}`);

const client = new nestProto.NestService(CLOVA_API_URL, grpc.credentials.createSsl());
const stream = client.recognize({}, metadata);

stream.on('data', (response) => {
    console.log('✅ 응답 받음:', response);
});

stream.on('error', (error) => {
    console.error('❌ 에러:', error.message);
    console.error('에러 코드:', error.code);
    console.error('에러 세부사항:', error.details);
});

stream.on('end', () => {
    console.log('스트림 종료');
    process.exit(0);
});

// 설정 전송
const config = {
    config: JSON.stringify({
        language: 'ko-KR',
        completion: 'sync'
    })
};

stream.write({ config: config });

// 5초 후 종료
setTimeout(() => {
    stream.end();
}, 5000);
