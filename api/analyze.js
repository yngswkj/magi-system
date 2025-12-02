import OpenAI from 'openai';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const config = {
    runtime: 'edge',
};

// Redis接続
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : null;

// レート制限: 1分間に50リクエスト
const ratelimit = redis
    ? new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(50, '1 m'),
        analytics: true,
        prefix: 'magi_ratelimit',
    })
    : null;

function validateRequest(data) {
    const errors = [];
    if (!data.messages || !Array.isArray(data.messages)) {
        errors.push('messages array is required');
    } else {
        if (data.messages.length > 50) {
            errors.push('Too many messages (max 50)');
        }
        // Check total content length roughly
        const totalLength = JSON.stringify(data.messages).length;
        if (totalLength > 50000) { // 50KB limit
            errors.push('Payload too large');
        }
    }

    // Allow gpt-4o as well if needed, or stick to strict list
    if (data.model && !['gpt-5.1', 'gpt-5-mini', 'gpt-4o'].includes(data.model)) {
        errors.push('Invalid model');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

export default async function handler(request) {
    // 環境変数の読み込みをハンドラ内で行う
    const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
        .split(',')
        .map(o => o.trim())
        .filter(o => o);

    // デフォルト値（環境変数が設定されていない場合のみ）
    if (ALLOWED_ORIGINS.length === 0) {
        ALLOWED_ORIGINS.push(
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'https://magi-system.vercel.app'
        );
    }

    function isOriginAllowed(origin) {
        if (!origin) return true; // Allow non-browser requests (e.g. curl) if needed, or block.

        // 1. Check explicit allowed list
        if (ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
            return true;
        }

        // 2. Allow any localhost origin dynamically (for development flexibility)
        // This avoids hardcoding specific ports (3000, 3001, etc.)
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
            return true;
        }

        return false;
    }

    const origin = request.headers.get('origin');

    // CORS Headers
    const headers = {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (isOriginAllowed(origin)) {
        headers['Access-Control-Allow-Origin'] = origin || '*';
    }

    // Handle Preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers
        });
    }

    // Origin Check for POST
    if (origin && !isOriginAllowed(origin)) {
        console.error(`[Security] Blocked origin: ${origin}`);
        // Debug: List available env keys (security safe: only keys)
        console.error(`[Security] Available Env Keys: ${Object.keys(process.env).join(', ')}`);
        return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
            status: 403,
            headers
        });
    }

    // IP Check (Simplified)
    const ip = request.ip || request.headers.get('x-forwarded-for');
    // TODO: Implement IP range check if ALLOWED_IP_RANGES is set

    // Rate Limiting
    if (ratelimit && ip) {
        try {
            const { success, limit, reset, remaining } = await ratelimit.limit(ip);
            headers['X-RateLimit-Limit'] = limit.toString();
            headers['X-RateLimit-Remaining'] = remaining.toString();
            headers['X-RateLimit-Reset'] = reset.toString();

            if (!success) {
                return new Response(JSON.stringify({ error: 'Too many requests' }), {
                    status: 429,
                    headers
                });
            }
        } catch (e) {
            console.error("Rate limit error:", e);
            // Fail open or closed? Fail open for now to avoid blocking on redis error
        }
    }

    try {
        const body = await request.json();

        // Validation
        const validation = validateRequest(body);
        if (!validation.isValid) {
            return new Response(JSON.stringify({ error: 'Validation failed', details: validation.errors }), {
                status: 400,
                headers
            });
        }

        const { messages, model, reasoningEffort } = body;
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Server configuration error' }), {
                status: 500,
                headers
            });
        }

        const openai = new OpenAI({
            apiKey: apiKey,
        });

        const bodyData = {
            model: model || "gpt-5.1",
            messages: messages,
            response_format: { type: "json_object" }
        };

        if (model === "gpt-5.1" && reasoningEffort && reasoningEffort !== "none") {
            bodyData.reasoning_effort = reasoningEffort;
        }

        if (model !== "gpt-5.1" && model !== "gpt-5-mini") {
            bodyData.temperature = 0.7;
        } else {
            bodyData.temperature = 1;
        }

        const completion = await openai.chat.completions.create(bodyData);
        const content = completion.choices[0].message.content;

        let parsedContent;
        try {
            parsedContent = JSON.parse(content);
        } catch (e) {
            console.error("Failed to parse OpenAI response", content);
            return new Response(JSON.stringify({ error: 'Invalid response from AI' }), {
                status: 502,
                headers
            });
        }

        return new Response(JSON.stringify(parsedContent), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('OpenAI API Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers
        });
    }
}
