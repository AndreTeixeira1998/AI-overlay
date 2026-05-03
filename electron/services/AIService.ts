import axios from 'axios';

export interface AIConfig {
  apiUrl: string;
  apiKey: string;
  model?: string;
}

export interface AIServiceResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class AIService {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  async processWithAI(
    prompt: string,
    imageDataList: string[],
    signal: AbortSignal,
    onProgress?: (chunk: string) => void
  ): Promise<AIServiceResponse> {
    console.log('processing with AI:', prompt);
    try {
      const response = await axios.post(
        this.config.apiUrl,
        {
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                ...imageDataList.map(img => ({
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${img}`
                  }
                }))
              ]
            }
          ]
        },
        {
          signal,
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0]?.message?.content || '';

      if (onProgress) {
        onProgress(content);
      }

      console.log('AI Response:', content);

      return {
        success: true,
        data: content
      };

    } catch (error: any) {
      console.error('AI Processing Error:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to process with AI'
      };
    }
  }
}
