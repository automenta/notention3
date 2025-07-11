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
let capturedPromptMessages: any[] = []; // To store the messages passed to ChatPromptTemplate.fromMessages
let mockChatPromptTemplateInstance: any; // To store the instance returned by fromMessages

vi.mock("@langchain/core/prompts", async () => {
    const actual = await vi.importActual("@langchain/core/prompts") as any;
    // Define a base mock for the chainable prompt template instance
    mockChatPromptTemplateInstance = {
        pipe: vi.fn().mockReturnThis(), // For chaining: prompt.pipe(model)
        invoke: vi.fn(), // For: prompt.invoke(input)
    };
    return {
        ...actual, // Spread actual to keep other exports like HumanMessagePromptTemplate
        ChatPromptTemplate: {
            ...actual.ChatPromptTemplate, // Spread actual ChatPromptTemplate if it has other static methods
            fromMessages: vi.fn((messages) => {
                capturedPromptMessages = messages; // Capture messages
                // Reset the mock instance's methods for each call to fromMessages
                // to ensure clean state for chained calls like pipe().pipe().invoke()
                mockChatPromptTemplateInstance.pipe.mockClear().mockReturnThis();
                mockChatPromptTemplateInstance.invoke.mockClear();
                return mockChatPromptTemplateInstance; // Return the persistent, resettable mock instance
            }),
        },
        // Ensure other specific prompt types used by the service are also available if not covered by actual
        SystemMessagePromptTemplate: actual.SystemMessagePromptTemplate,
        HumanMessagePromptTemplate: actual.HumanMessagePromptTemplate,
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
    (StringOutputParser as vi.Mock).mockImplementation(() => {
      // This mock needs to be an object that can be .piped from.
      // If the chain is model.pipe(new StringOutputParser()), then StringOutputParser itself doesn't need methods.
      // If the chain is prompt.pipe(model).pipe(new StringOutputParser()), then the StringOutputParser instance
      // is the last part of the chain, and its result is what's returned by the LangChain execution.
      // The actual AIService code does `prompt.pipe(model).pipe(new StringOutputParser())`.
      // So, the result of `model.pipe(new StringOutputParser())` is what `invoke` would act upon.
      // For simplicity, let's assume the mock for model instances handles this.
      // The `invoke` on the model mock should return the final string.
      return {
        // No methods needed here if it's the last element in a pipe that's invoked.
      };
    });


    // Reset instance method mocks
    vi.mocked(mockOllamaInstance.invoke).mockReset();
    vi.mocked(mockOllamaInstance.pipe).mockClear().mockReturnThis();
    vi.mocked(mockOllamaEmbeddingsInstance.embedQuery).mockReset();
    vi.mocked(mockGeminiInstance.invoke).mockReset();
    vi.mocked(mockGeminiInstance.pipe).mockClear().mockReturnThis();
    vi.mocked(mockGeminiEmbeddingsInstance.embedQuery).mockReset();

    // Reset captured prompt messages
    capturedPromptMessages = [];

    // Set a default non-AI enabled state
    setMockStoreUserProfile({ aiEnabled: false }); // This also calls aiService.reinitializeModels()
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
          expect(console.warn).toHaveBeenCalledWith(`No active AI chat model for ${method.replace('get', '').replace('OntologySuggestions', 'ontology suggestions').replace('AutoTags', 'auto-tags').toLowerCase()}.`);
        });

        it(`should call preferred model (Gemini) and return parsed response for ${method}`, async () => {
          setMockStoreUserProfile({ aiEnabled: true, geminiApiKey: 'gemini-key', aiProviderPreference: 'gemini' });
          // The invoke is on the model instance after piping from the prompt
          vi.mocked(mockGeminiInstance.invoke).mockResolvedValue(mockReturn);


          const result = await (aiService as any)[method](...args);
          // Check that the prompt's invoke was called, which means the chain executed.
          // The ChatPromptTemplate.fromMessages returns an object that has .pipe().invoke()
          // The model's .invoke() is what gets called at the end of the chain like: prompt.pipe(model).pipe(parser) -> model.invoke()
          expect(mockChatPromptTemplateInstance.pipe).toHaveBeenCalledWith(mockGeminiInstance); // First pipe to model
          expect(mockChatPromptTemplateInstance.pipe).toHaveBeenCalledWith(expect.any(StringOutputParser)); // Second pipe to parser
          expect(mockGeminiInstance.invoke).toHaveBeenCalled(); // This is the one that should be called by the chain.

          expect(result).toEqual(typeof mockReturn === 'string' && method !== 'getSummarization' ? JSON.parse(mockReturn) : mockReturn);

          expect(capturedPromptMessages.length).toBeGreaterThan(0);
          // Example check for one of the methods
          if (method === 'getOntologySuggestions') {
            // Check that the system message is a SystemMessagePromptTemplate containing the expected text
            expect(capturedPromptMessages[0].constructor.name).toContain("SystemMessagePromptTemplate");
            // Accessing template string directly might be tricky due to langchain internals.
            // A more robust check would be to ensure the `messages` array passed to `fromMessages`
            // contains objects with expected `prompt.template` values if the mock allows deeper inspection.
            // For now, checking constructor name and that messages were captured is a good start.
          }
        });

        it(`should call preferred model (Ollama) and return parsed response for ${method}`, async () => {
          setMockStoreUserProfile({ aiEnabled: true, ollamaApiEndpoint: 'ollama-ep', aiProviderPreference: 'ollama' });
          vi.mocked(mockOllamaInstance.invoke).mockResolvedValue(mockReturn);

          const result = await (aiService as any)[method](...args);
          expect(mockChatPromptTemplateInstance.pipe).toHaveBeenCalledWith(mockOllamaInstance);
          expect(mockChatPromptTemplateInstance.pipe).toHaveBeenCalledWith(expect.any(StringOutputParser));
          expect(mockOllamaInstance.invoke).toHaveBeenCalled();
          expect(result).toEqual(typeof mockReturn === 'string' && method !== 'getSummarization' ? JSON.parse(mockReturn) : mockReturn);
        });

        it(`should handle errors gracefully for ${method}`, async () => {
          setMockStoreUserProfile({ aiEnabled: true, geminiApiKey: 'gemini-key', aiProviderPreference: 'gemini' });
          vi.mocked(mockGeminiInstance.invoke).mockRejectedValue(new Error('AI API Error'));
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
      vi.mocked(mockOllamaEmbeddingsInstance.embedQuery).mockRejectedValue(new Error("Embedding API Error"));
      const vector = await aiService.getEmbeddingVector("test text");
      expect(vector).toEqual([]);
      expect(console.error).toHaveBeenCalledWith("Error getting embedding vector:", expect.any(Error));
    });
  });

  describe('Reinitialization on Store Change', () => {
    beforeEach(() => {
      // Ensure the store listener is set up before each test in this block
      // And clear any previous subscriptions if the mock was global
      vi.mocked(useAppStore.subscribe).mockClear(); // Clear previous subscribe calls
      storeSubscribeCallback = null; // Reset captured callback
      setupAiServiceStoreListener(); // This will call useAppStore.subscribe
      expect(useAppStore.subscribe).toHaveBeenCalledTimes(1); // Verify listener is attached
    });

    it('should reinitialize models when relevant store preferences change', () => {
      const initialPrefs = { ...defaultUserProfilePreferences, aiEnabled: false };
      setMockStoreUserProfile(initialPrefs); // Initial state, Ollama not called
      expect(Ollama).not.toHaveBeenCalled();

      const newPrefs = {
        ...defaultUserProfilePreferences,
        aiEnabled: true,
        ollamaApiEndpoint: 'http://new-ollama-ep',
      };

      // Simulate store update by manually triggering the subscribe callback
      if (storeSubscribeCallback) {
        // The callback expects the new state and the previous state.
        // Previous state for this test was `initialPrefs`.
        storeSubscribeCallback(
          { userProfile: { preferences: newPrefs } }, // New state
          { userProfile: { preferences: initialPrefs } }  // Previous state
        );
      } else {
        throw new Error("Store subscribe callback not captured by setupAiServiceStoreListener");
      }

      // AIService's reinitializeModels should have been called by the subscription callback.
      // This reinitialization should then call the Ollama constructor with new settings.
      expect(Ollama).toHaveBeenCalledWith({ baseUrl: 'http://new-ollama-ep', model: 'llama3' });
      expect(OllamaEmbeddings).toHaveBeenCalledWith({ baseUrl: 'http://new-ollama-ep', model: 'nomic-embed-text' });
    });

    it('should not reinitialize if AI settings have not changed', () => {
       const prefs = { ...defaultUserProfilePreferences, aiEnabled: true, geminiApiKey: 'key1' };
       setMockStoreUserProfile(prefs); // Initial state with Gemini
       vi.mocked(ChatGoogleGenerativeAI).mockClear(); // Clear calls from initial setMockStoreUserProfile

       if (storeSubscribeCallback) {
         storeSubscribeCallback(
           { userProfile: { preferences: prefs } }, // Same state
           { userProfile: { preferences: prefs } }   // Same previous state
         );
       } else {
         throw new Error("Store subscribe callback not captured");
       }
       // Since settings didn't change, reinitializeModels (and thus ChatGoogleGenerativeAI constructor) should not be called again.
       expect(ChatGoogleGenerativeAI).not.toHaveBeenCalled();
    });
  });
});
