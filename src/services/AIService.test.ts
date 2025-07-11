import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService, aiService } from './AIService'; // Test the singleton instance
import { useAppStore } from '../store';
import { Ollama } from "@langchain/community/llms/ollama";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { StringOutputParser } from '@langchain/core/output_parsers';
import { setupAiServiceStoreListener } from './AIService'; // Import the setup function

// Mock the LangChain classes
vi.mock("@langchain/community/llms/ollama");
vi.mock("@langchain/community/embeddings/ollama");
vi.mock("@langchain/google-genai");
vi.mock("@langchain/core/output_parsers");
let capturedPromptMessages: any[] = [];
vi.mock("@langchain/core/prompts", async () => {
    const actual = await vi.importActual("@langchain/core/prompts") as any;
    return {
        ...actual,
        ChatPromptTemplate: {
            fromMessages: vi.fn((messages) => {
                capturedPromptMessages = messages;
                return {
                    pipe: vi.fn().mockReturnThis(), // For chaining
                    invoke: vi.fn()
                };
            }),
        }
    };
});


// Mock the store
let mockStoreState: any;
let storeSubscribeCallback: ((state: any, prevState: any) => void) | null = null;

vi.mock('../store', () => ({
  useAppStore: {
    getState: vi.fn(() => mockStoreState),
    subscribe: vi.fn((callback) => {
        storeSubscribeCallback = callback;
        return () => { storeSubscribeCallback = null; }; // Unsubscribe function
    }),
  }
}));

const mockOllamaInstance = {
  pipe: vi.fn().mockReturnThis(),
  invoke: vi.fn(),
};
const mockOllamaEmbeddingsInstance = {
  embedQuery: vi.fn(),
};
const mockGeminiInstance = {
  pipe: vi.fn().mockReturnThis(),
  invoke: vi.fn(),
};
const mockGeminiEmbeddingsInstance = {
  embedQuery: vi.fn(),
};


describe('AIService', () => {
  const defaultUserProfilePreferences = {
    aiEnabled: false,
    ollamaApiEndpoint: '',
    ollamaChatModel: 'llama3',
    ollamaEmbeddingModel: 'nomic-embed-text',
    geminiApiKey: '',
    geminiChatModel: 'gemini-pro',
    geminiEmbeddingModel: 'embedding-001',
    aiProviderPreference: 'gemini' as 'ollama' | 'gemini',
  };

  const setMockStoreUserProfile = (preferences: Partial<typeof defaultUserProfilePreferences>) => {
    mockStoreState = {
      userProfile: {
        preferences: { ...defaultUserProfilePreferences, ...preferences },
      },
    };
    // After setting state, we need to manually trigger reinitialization for the singleton
    aiService.reinitializeModels();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset LangChain constructor mocks
    (Ollama as vi.Mock).mockImplementation(() => mockOllamaInstance);
    (OllamaEmbeddings as vi.Mock).mockImplementation(() => mockOllamaEmbeddingsInstance);
    (ChatGoogleGenerativeAI as vi.Mock).mockImplementation(() => mockGeminiInstance);
    (GoogleGenerativeAIEmbeddings as vi.Mock).mockImplementation(() => mockGeminiEmbeddingsInstance);
    (StringOutputParser as vi.Mock).mockImplementation(() => ({
        // mock StringOutputParser if its methods are used by the chain
    }));


    // Reset instance method mocks
    mockOllamaInstance.invoke.mockReset();
    mockOllamaInstance.pipe.mockReturnThis(); // Ensure pipe is chainable
    mockOllamaEmbeddingsInstance.embedQuery.mockReset();
    mockGeminiInstance.invoke.mockReset();
    mockGeminiInstance.pipe.mockReturnThis(); // Ensure pipe is chainable
    mockGeminiEmbeddingsInstance.embedQuery.mockReset();

    // Set a default non-AI enabled state
    setMockStoreUserProfile({ aiEnabled: false });
    vi.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console.error for tests expecting errors
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as vi.Mock).mockRestore();
    (console.warn as vi.Mock).mockRestore();
    (console.log as vi.Mock).mockRestore();
  });

  describe('Initialization', () => {
    it('should not initialize models if AI is disabled', () => {
      setMockStoreUserProfile({ aiEnabled: false });
      expect(Ollama).not.toHaveBeenCalled();
      expect(ChatGoogleGenerativeAI).not.toHaveBeenCalled();
      expect(OllamaEmbeddings).not.toHaveBeenCalled();
      expect(GoogleGenerativeAIEmbeddings).not.toHaveBeenCalled();
    });

    it('should initialize Ollama models if enabled and endpoint provided', () => {
      setMockStoreUserProfile({ aiEnabled: true, ollamaApiEndpoint: 'http://localhost:11434' });
      expect(Ollama).toHaveBeenCalledWith({ baseUrl: 'http://localhost:11434', model: 'llama3' });
      expect(OllamaEmbeddings).toHaveBeenCalledWith({ baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' });
    });

    it('should initialize Gemini models if enabled and API key provided', () => {
      setMockStoreUserProfile({ aiEnabled: true, geminiApiKey: 'test-gemini-key' });
      expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'test-gemini-key', modelName: 'gemini-pro' }));
      expect(GoogleGenerativeAIEmbeddings).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'test-gemini-key', modelName: 'embedding-001' }));
    });

    it('should handle errors during Ollama initialization', () => {
        (Ollama as vi.Mock).mockImplementationOnce(() => { throw new Error("Ollama init failed")});
        setMockStoreUserProfile({ aiEnabled: true, ollamaApiEndpoint: 'http://bad-endpoint' });
        expect(aiService['ollama']).toBeNull();
        expect(console.error).toHaveBeenCalledWith("Failed to initialize Ollama models:", expect.any(Error));
    });
  });

  describe('AI Feature Methods', () => {
    it('isAIEnabled should reflect store state', () => {
        setMockStoreUserProfile({ aiEnabled: true });
        expect(aiService.isAIEnabled()).toBe(true);
        setMockStoreUserProfile({ aiEnabled: false });
        expect(aiService.isAIEnabled()).toBe(false);
    });

    const testCases = [
      { method: 'getOntologySuggestions', args: [{}, 'context'], expectedResultOnError: [], mockReturn: JSON.stringify([{label: "Suggestion"}]) },
      { method: 'getAutoTags', args: ['content'], expectedResultOnError: [], mockReturn: JSON.stringify(['#tag']) },
      { method: 'getSummarization', args: ['content'], expectedResultOnError: "", mockReturn: "Summary" },
    ];

    testCases.forEach(({ method, args, expectedResultOnError, mockReturn }) => {
      describe(method, () => {
        it('should return empty/default if AI is disabled', async () => {
          setMockStoreUserProfile({ aiEnabled: false });
          const result = await (aiService as any)[method](...args);
          expect(result).toEqual(expectedResultOnError);
        });

        it('should return empty/default if no model is active', async () => {
          setMockStoreUserProfile({ aiEnabled: true }); // Enabled, but no endpoint/key
          const result = await (aiService as any)[method](...args);
          expect(result).toEqual(expectedResultOnError);
          expect(console.warn).toHaveBeenCalledWith(`No active AI chat model for ${method.replace('get', '').replace('Suggestions', ' suggestions').replace('Tags', '-tagging').toLowerCase()}.`);
        });

        it.skip(`should call preferred model (Gemini) and return parsed response for ${method}`, async () => {
          setMockStoreUserProfile({ aiEnabled: true, geminiApiKey: 'gemini-key', aiProviderPreference: 'gemini' });
          mockGeminiInstance.invoke.mockResolvedValue(mockReturn);

          const result = await (aiService as any)[method](...args);
          expect(mockGeminiInstance.invoke).toHaveBeenCalled();
          expect(result).toEqual(typeof mockReturn === 'string' && method !== 'getSummarization' ? JSON.parse(mockReturn) : mockReturn);

          // Check captured prompt messages for specific content
          expect(capturedPromptMessages.length).toBeGreaterThan(0);
          if (method === 'getOntologySuggestions') {
            expect(capturedPromptMessages[0].prompt.template).toContain("You are an expert in knowledge organization.");
            expect(capturedPromptMessages[1].prompt.template).toContain("Existing Ontology:");
          } else if (method === 'getAutoTags') {
            expect(capturedPromptMessages[0].prompt.template).toContain("You are an expert in semantic tagging.");
            expect(capturedPromptMessages[1].prompt.template).toContain("Note Content:");
          } else if (method === 'getSummarization') {
            expect(capturedPromptMessages[0].prompt.template).toContain("You are an expert in summarizing text.");
            expect(capturedPromptMessages[1].prompt.template).toContain("Note Content:");
          }
        });

        it.skip(`should call preferred model (Ollama) and return parsed response for ${method}`, async () => {
          setMockStoreUserProfile({ aiEnabled: true, ollamaApiEndpoint: 'ollama-ep', aiProviderPreference: 'ollama' });
          mockOllamaInstance.invoke.mockResolvedValue(mockReturn);

          const result = await (aiService as any)[method](...args);
          expect(mockOllamaInstance.invoke).toHaveBeenCalled();
          expect(result).toEqual(typeof mockReturn === 'string' && method !== 'getSummarization' ? JSON.parse(mockReturn) : mockReturn);

          // Check captured prompt messages for specific content
          expect(capturedPromptMessages.length).toBeGreaterThan(0);
          if (method === 'getOntologySuggestions') {
            expect(capturedPromptMessages[0].prompt.template).toContain("You are an expert in knowledge organization.");
            expect(capturedPromptMessages[1].prompt.template).toContain("Existing Ontology:");
          } else if (method === 'getAutoTags') {
            expect(capturedPromptMessages[0].prompt.template).toContain("You are an expert in semantic tagging.");
            expect(capturedPromptMessages[1].prompt.template).toContain("Note Content:");
          } else if (method === 'getSummarization') {
            expect(capturedPromptMessages[0].prompt.template).toContain("You are an expert in summarizing text.");
            expect(capturedPromptMessages[1].prompt.template).toContain("Note Content:");
          }
        });

        it.skip(`should handle errors gracefully for ${method}`, async () => {
          setMockStoreUserProfile({ aiEnabled: true, geminiApiKey: 'gemini-key' });
          mockGeminiInstance.invoke.mockRejectedValue(new Error('AI API Error'));
          const result = await (aiService as any)[method](...args);
          expect(result).toEqual(expectedResultOnError);
          expect(console.error).toHaveBeenCalledWith(`Error getting ${method.replace('get', '').replace('OntologySuggestions', 'ontology suggestions').replace('AutoTags', 'auto-tags').toLowerCase()}:`, expect.any(Error));
        });
      });
    });
  });

  describe('getEmbeddingVector', () => {
    it('should return empty array if AI is disabled', async () => {
      setMockStoreUserProfile({ aiEnabled: false });
      const vector = await aiService.getEmbeddingVector("test text");
      expect(vector).toEqual([]);
    });

    it('should return empty array if no embedding model is active', async () => {
      setMockStoreUserProfile({ aiEnabled: true }); // Enabled, but no endpoint/key
      const vector = await aiService.getEmbeddingVector("test text");
      expect(vector).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith("AIService: getEmbeddingVector - No active embedding model configured or initialized.");
    });

    it('should call Ollama embedding model if preferred and configured', async () => {
      setMockStoreUserProfile({ aiEnabled: true, ollamaApiEndpoint: 'ollama-ep', aiProviderPreference: 'ollama' });
      mockOllamaEmbeddingsInstance.embedQuery.mockResolvedValue([0.1, 0.2, 0.3]);
      const vector = await aiService.getEmbeddingVector("test text");
      expect(mockOllamaEmbeddingsInstance.embedQuery).toHaveBeenCalledWith("test text");
      expect(vector).toEqual([0.1, 0.2, 0.3]);
    });

    it('should call Gemini embedding model if preferred and configured', async () => {
      setMockStoreUserProfile({ aiEnabled: true, geminiApiKey: 'gemini-key', aiProviderPreference: 'gemini' });
      mockGeminiEmbeddingsInstance.embedQuery.mockResolvedValue([0.4, 0.5, 0.6]);
      const vector = await aiService.getEmbeddingVector("test text");
      expect(mockGeminiEmbeddingsInstance.embedQuery).toHaveBeenCalledWith("test text");
      expect(vector).toEqual([0.4, 0.5, 0.6]);
    });

    it('should fallback to default preference (Gemini then Ollama) for embeddings', async () => {
      // Scenario 1: Gemini configured, Ollama not, no specific preference (should use Gemini)
      setMockStoreUserProfile({ aiEnabled: true, geminiApiKey: 'gemini-key', ollamaApiEndpoint: '' });
      mockGeminiEmbeddingsInstance.embedQuery.mockResolvedValue([0.7, 0.8, 0.9]);
      let vector = await aiService.getEmbeddingVector("test text gemini");
      expect(mockGeminiEmbeddingsInstance.embedQuery).toHaveBeenCalledWith("test text gemini");
      expect(vector).toEqual([0.7, 0.8, 0.9]);
      mockGeminiEmbeddingsInstance.embedQuery.mockClear();

      // Scenario 2: Ollama configured, Gemini not, no specific preference (should use Ollama)
      setMockStoreUserProfile({ aiEnabled: true, geminiApiKey: '', ollamaApiEndpoint: 'ollama-ep' });
      mockOllamaEmbeddingsInstance.embedQuery.mockResolvedValue([0.1, 0.2, 0.3]);
      vector = await aiService.getEmbeddingVector("test text ollama");
      expect(mockOllamaEmbeddingsInstance.embedQuery).toHaveBeenCalledWith("test text ollama");
      expect(vector).toEqual([0.1, 0.2, 0.3]);
    });

    it('should handle errors from embedding model gracefully', async () => {
      setMockStoreUserProfile({ aiEnabled: true, ollamaApiEndpoint: 'ollama-ep', aiProviderPreference: 'ollama' });
      mockOllamaEmbeddingsInstance.embedQuery.mockRejectedValue(new Error("Embedding API Error"));
      const vector = await aiService.getEmbeddingVector("test text");
      expect(vector).toEqual([]);
      expect(console.error).toHaveBeenCalledWith("Error getting embedding vector:", expect.any(Error));
    });
  });

  describe('Reinitialization on Store Change', () => {
    beforeEach(() => {
      // Ensure the store listener is set up before each test in this block
      setupAiServiceStoreListener();
    });

    it('should reinitialize models when relevant store preferences change', () => {
      // Initial setup: AI disabled
      setMockStoreUserProfile({ aiEnabled: false });
      expect(Ollama).not.toHaveBeenCalled();

      // Simulate store update that enables AI and provides Ollama endpoint
      const newPreferences = {
        ...defaultUserProfilePreferences,
        aiEnabled: true,
        ollamaApiEndpoint: 'http://new-ollama-ep',
      };
      // Manually trigger the subscribe callback as if the store updated
      if (storeSubscribeCallback) {
         storeSubscribeCallback({ userProfile: { preferences: newPreferences } }, mockStoreState);
      } else {
        throw new Error("Store subscribe callback not captured");
      }

      // AIService's reinitializeModels should be called by the subscription
      expect(Ollama).toHaveBeenCalledWith({ baseUrl: 'http://new-ollama-ep', model: 'llama3' });
      expect(OllamaEmbeddings).toHaveBeenCalledWith({ baseUrl: 'http://new-ollama-ep', model: 'nomic-embed-text' });
    });
  });
});
