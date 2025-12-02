export class OpenAIClient {
    constructor(model = "gpt-5.1", reasoningEffort = "none") {
        this.model = model;
        this.reasoningEffort = reasoningEffort;
        this.baseUrl = "/api/analyze";
    }

    async analyze(messages, systemPrompt) {
        const headers = {
            "Content-Type": "application/json"
        };

        // Construct full message history
        const fullMessages = [
            { role: "system", content: systemPrompt },
            ...messages
        ];

        const bodyData = {
            model: this.model,
            messages: fullMessages,
            reasoningEffort: this.reasoningEffort
        };

        try {
            const response = await fetch(this.baseUrl, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(bodyData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "API Request Failed");
            }

            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    }
}