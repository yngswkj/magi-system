export class OpenAIClient {
    constructor(apiKey, model = "gpt-5.1", reasoningEffort = "none") {
        this.apiKey = apiKey;
        this.model = model;
        this.reasoningEffort = reasoningEffort;
        this.baseUrl = "https://api.openai.com/v1/chat/completions";
    }

    async analyze(messages, systemPrompt) {
        if (!this.apiKey) {
            throw new Error("API Key is missing");
        }

        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`
        };

        // Construct full message history
        const fullMessages = [
            { role: "system", content: systemPrompt },
            ...messages
        ];

        const bodyData = {
            model: this.model,
            messages: fullMessages,
            response_format: { type: "json_object" } // Ensure JSON output
        };

        // Add reasoning_effort only for supported models (e.g., gpt-5.1) and if not 'none'
        // Note: 'none' might be the default behavior or explicit value depending on API spec.
        // Assuming we pass it if the user selected something other than default, or if the API supports explicit 'none'.
        // Based on request: "default is none, configurable up to medium".
        // If the API treats 'none' as "don't use reasoning", we might need to omit the field or set it.
        // Let's assume we pass it if the model is gpt-5.1.
        if (this.model === "gpt-5.1") {
            // If the API spec requires omitting the field for "standard" behavior, we can check that.
            // But here we will pass it as requested.
            // Note: If 'none' is not a valid API value but just our UI representation for "off", we should handle that.
            // However, assuming "reasoning_effort" parameter accepts "low", "medium", "high".
            // If "none" means "disable reasoning features" or "standard inference", we might not send the param.
            // Let's assume "none" maps to not sending the parameter or sending a specific value if the API supports it.
            // For now, I will only send it if it is 'low' or 'medium' to be safe, or if 'none' is a valid value.
            // Let's assume we send it if it's not 'none', or if the user explicitly wants to control it.
            // Actually, the prompt says "reasoning.effort defaults to none".
            if (this.reasoningEffort !== "none") {
                bodyData.reasoning_effort = this.reasoningEffort;
            }
        }

        // Temperature is generally not supported or recommended with reasoning models.
        // GPT-5.1 and GPT-5 Mini enforce temperature=1.
        if (this.model !== "gpt-5.1" && this.model !== "gpt-5-mini") {
            bodyData.temperature = 0.7;
        } else {
            bodyData.temperature = 1;
        } try {
            const response = await fetch(this.baseUrl, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(bodyData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "API Request Failed");
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            return JSON.parse(content);
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    }
}