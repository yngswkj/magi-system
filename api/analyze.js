import OpenAI from 'openai';

export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { messages, model, reasoningEffort } = await request.json();
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Server configuration error: API Key missing' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
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

        // Handle reasoning_effort
        if (model === "gpt-5.1" && reasoningEffort && reasoningEffort !== "none") {
            bodyData.reasoning_effort = reasoningEffort;
        }

        // Handle temperature
        if (model !== "gpt-5.1" && model !== "gpt-5-mini") {
            bodyData.temperature = 0.7;
        } else {
            bodyData.temperature = 1;
        }

        const completion = await openai.chat.completions.create(bodyData);
        const content = completion.choices[0].message.content;

        return new Response(JSON.stringify(JSON.parse(content)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('OpenAI API Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
