require('dotenv').config();
const WebSocket = require('ws');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Load Proto
const PROTO_PATH = path.join(__dirname, 'proto', 'nest.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
// Load from the official package path
const nestProto = grpc.loadPackageDefinition(packageDefinition).com.naver.clova.speech.client;

// Configuration
const PORT = 3000;
const CLOVA_API_URL = process.env.CLOVA_SPEECH_INVOKE_URL || 'clovaspeech-gw.ncloud.com:50051';
const CLOVA_SECRET = process.env.CLOVA_SPEECH_SECRET;

if (!CLOVA_SECRET) {
    console.error('❌ Error: CLOVA_SPEECH_SECRET is missing in .env file');
    process.exit(1);
}

// gRPC Client Factory
const createGrpcClient = () => {
    console.log(`[Debug] Secret Length: ${CLOVA_SECRET ? CLOVA_SECRET.length : 0}`);
    const metadata = new grpc.Metadata();
    metadata.add('Authorization', `Bearer ${CLOVA_SECRET}`);
    metadata.add('X-CLOVASPEECH-API-KEY', CLOVA_SECRET);

    // Use NestService as per official proto
    return {
        client: new nestProto.NestService(CLOVA_API_URL, grpc.credentials.createSsl()),
        metadata: metadata
    };
};

// WebSocket Server
const wss = new WebSocket.Server({ port: PORT });

console.log(`🚀 Proxy Server running on port ${PORT}`);
console.log(`🔗 Target Clova URL: ${CLOVA_API_URL}`);

wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const role = params.get('role') || 'Unknown';

    console.log(`🔌 Client connected. Role: ${role}`);

    let grpcStream = null;
    let isStreamOpen = false;

    const startRecognition = (config) => {
        console.log(`[${role}] Starting recognition with config:`, JSON.stringify(config));
        const { client, metadata } = createGrpcClient();

        // Log available methods on the client for debugging
        console.log(`[${role}] Client methods:`, Object.keys(Object.getPrototypeOf(client)));

        // CRITICAL FIX: metadata should be the SECOND parameter
        // First parameter is call options (can be empty {})
        grpcStream = client.recognize({}, metadata);
        isStreamOpen = true;

        // Handle gRPC responses
        grpcStream.on('data', (response) => {
            console.log(`[${role}] Received gRPC data. Length: ${response.contents ? response.contents.length : 0}`);
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    if (!response.contents) {
                        console.warn(`[${role}] Empty contents in response`);
                        return;
                    }
                    const content = JSON.parse(response.contents);
                    console.log(`[${role}] Parsed content:`, JSON.stringify(content).substring(0, 100) + '...');

                    ws.send(JSON.stringify({
                        type: 'transcription',
                        role: role,
                        data: content
                    }));
                } catch (e) {
                    console.error(`[${role}] Failed to parse response:`, e);
                    console.error(`[${role}] Raw contents:`, response.contents);
                }
            }
        });

        grpcStream.on('error', (error) => {
            console.error(`[${role}] gRPC Error:`, error);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: error.message }));
            }
            isStreamOpen = false;
        });

        grpcStream.on('end', () => {
            console.log(`[${role}] gRPC Stream ended`);
            isStreamOpen = false;
        });

        // Send Config
        try {
            const nestConfig = {
                config: JSON.stringify(config)
            };
            grpcStream.write({ config: nestConfig }, (err) => {
                if (err) console.error(`[${role}] Config write error:`, err);
                else console.log(`[${role}] Config sent successfully`);
            });
        } catch (e) {
            console.error(`[${role}] Failed to send config:`, e);
        }
    };

    ws.on('message', (message, isBinary) => {
        if (isBinary) {
            // Audio Data (Binary)
            if (isStreamOpen && grpcStream) {
                // Log every 100th packet to avoid flooding
                if (Math.random() < 0.01) console.log(`[${role}] Sending audio chunk...`);

                try {
                    grpcStream.write({ chunk: message }, (err) => {
                        if (err) console.error(`[${role}] Audio write error:`, err);
                    });
                } catch (e) {
                    console.error(`[${role}] Failed to write audio:`, e);
                }
            }
        } else {
            // Control Messages (Text/JSON)
            try {
                const msgString = message.toString();
                console.log(`[${role}] Received control message:`, msgString);
                const msg = JSON.parse(msgString);

                if (msg.type === 'start') {
                    startRecognition(msg.config);
                } else if (msg.type === 'stop') {
                    console.log(`[${role}] Stop requested`);
                    if (isStreamOpen && grpcStream) {
                        grpcStream.end();
                    }
                }
            } catch (e) {
                console.error(`[${role}] Invalid message:`, e);
            }
        }
    });

    ws.on('close', () => {
        console.log(`❌ Client disconnected. Role: ${role}`);
        if (isStreamOpen && grpcStream) {
            grpcStream.end();
        }
    });
});
