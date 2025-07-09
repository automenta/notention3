import { Ollama } from "@langchain/community/llms/ollama";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";

import { useAppStore } from '../store'; // To access settings
import { Note, OntologyNode, OntologyTree } from "../../shared/types";

// TODO: Define more specific types for suggestions, tags, summaries, and embeddings

export class AIService {
  private static instance: AIService;
  private ollama: Ollama | null = null;
  private gemini: ChatGoogleGenerativeAI | null = null;
  private ollamaEmbeddings: OllamaEmbeddings | null = null;
  private geminiEmbeddings: GoogleGenerativeAIEmbeddings | null = null;

  private constructor() {
    this.initializeModels();
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private initializeModels() {
    const { userProfile } = useAppStore.getState(); // Access store state directly

    const { userProfile } = useAppStore.getState(); // Access store state directly

    if (userProfile?.preferences.aiEnabled) {
      const ollamaApiEndpoint = userProfile.preferences.ollamaApiEndpoint;
      const ollamaModel = userProfile.preferences.ollamaEmbeddingModel || "nomic-embed-text"; // Default embedding model
      const ollamaChatModel = userProfile.preferences.ollamaChatModel || "llama3";

      if (ollamaApiEndpoint) {
        try {
          this.ollama = new Ollama({
            baseUrl: ollamaApiEndpoint,
            model: ollamaChatModel,
          });
          this.ollamaEmbeddings = new OllamaEmbeddings({
            baseUrl: ollamaApiEndpoint,
            model: ollamaModel,
          });
          console.log("Ollama models initialized with endpoint:", ollamaApiEndpoint);
        } catch (error) {
          console.error("Failed to initialize Ollama models:", error);
          this.ollama = null;
          this.ollamaEmbeddings = null;
        }
      }

      const geminiApiKey = userProfile.preferences.geminiApiKey;
      const geminiEmbeddingModel = userProfile.preferences.geminiEmbeddingModel || "embedding-001"; // Default embedding model
      const geminiChatModel = userProfile.preferences.geminiChatModel || "gemini-pro";

      if (geminiApiKey) {
        try {
          this.gemini = new ChatGoogleGenerativeAI({
            apiKey: geminiApiKey,
            modelName: geminiChatModel,
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
              },
            ],
          });
          this.geminiEmbeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: geminiApiKey,
            modelName: geminiEmbeddingModel,
          });
          console.log("Gemini models initialized.");
        } catch (error) {
          console.error("Failed to initialize Gemini models:", error);
          this.gemini = null;
          this.geminiEmbeddings = null;
        }
      }
    }
  }

  // Call this method if AI settings change
  public reinitializeModels() {
    this.ollama = null;
    this.gemini = null;
    this.ollamaEmbeddings = null;
    this.geminiEmbeddings = null;
    this.initializeModels();
  }

  private getActiveChatModel(): Ollama | ChatGoogleGenerativeAI | null {
    // TODO: Make this selection configurable by the user, e.g., prefer Ollama, prefer Gemini, or specific model
    const preferredProvider = useAppStore.getState().userProfile?.preferences.aiProviderPreference;
    if (preferredProvider === 'gemini' && this.gemini) return this.gemini;
    if (preferredProvider === 'ollama' && this.ollama) return this.ollama;

    // Default preference
    if (this.gemini) return this.gemini;
    if (this.ollama) return this.ollama;
    return null;
  }

  private getActiveEmbeddingModel(): OllamaEmbeddings | GoogleGenerativeAIEmbeddings | null {
    // TODO: Make this selection configurable by the user
    const preferredProvider = useAppStore.getState().userProfile?.preferences.aiProviderPreference;
    if (preferredProvider === 'gemini' && this.geminiEmbeddings) return this.geminiEmbeddings;
    if (preferredProvider === 'ollama' && this.ollamaEmbeddings) return this.ollamaEmbeddings;

    // Default preference
    if (this.geminiEmbeddings) return this.geminiEmbeddings;
    if (this.ollamaEmbeddings) return this.ollamaEmbeddings;
    return null;
  }

  public isAIEnabled(): boolean {
    const { userProfile } = useAppStore.getState();
    return !!userProfile?.preferences.aiEnabled;
  }

  public async getOntologySuggestions(existingOntology: OntologyTree, context?: string): Promise<any[]> {
    if (!this.isAIEnabled()) return [];
    const model = this.getActiveChatModel();
    if (!model) {
      console.warn("No active AI chat model for ontology suggestions.");
      return [];
    }

    // TODO: Implement actual logic using LangChain
    console.log("AIService: getOntologySuggestions called with context:", context, "and ontology:", existingOntology);
    // Example prompt structure (very basic)
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        "You are an expert in knowledge organization. Given an existing ontology (as JSON) and optionally some context (like a user's note or query), suggest new concepts (nodes) or relationships that would enhance the ontology. Return suggestions as a JSON array of objects, where each object has 'label', 'parentId' (optional), and 'attributes' (optional, key-value pairs)."
      ),
      HumanMessagePromptTemplate.fromTemplate(
        `Existing Ontology: \n${JSON.stringify(existingOntology, null, 2)}\n\nContext: ${context || 'General suggestions based on the ontology structure.'}\n\nSuggest enhancements:`
      ),
    ]);

    try {
      const chain = prompt.pipe(model).pipe(new StringOutputParser());
      const response = await chain.invoke({}); // Empty object, context is in prompt
      console.log("AI Response (Ontology Suggestions):", response);
      return JSON.parse(response); // Assuming AI returns valid JSON string
    } catch (error) {
      console.error("Error getting ontology suggestions:", error);
      return [];
    }
  }

  public async getAutoTags(noteContent: string, noteTitle?: string, existingOntology?: OntologyTree): Promise<string[]> {
    if (!this.isAIEnabled()) return [];
    const model = this.getActiveChatModel();
    if (!model) {
      console.warn("No active AI chat model for auto-tagging.");
      return [];
    }

    // TODO: Implement actual logic
    console.log("AIService: getAutoTags called for note:", noteTitle, "with content snippet:", noteContent.substring(0,100));
    const ontologyContext = existingOntology ? `\nConsider the following ontology for tag selection (prefer tags from this ontology if relevant): \n${JSON.stringify(Object.values(existingOntology.nodes).map(n => n.label), null, 2)}` : "";

    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `You are an expert in semantic tagging. Given the content of a note, suggest relevant tags (e.g., #Topic, @Person). Return tags as a JSON array of strings. ${ontologyContext}`
      ),
      HumanMessagePromptTemplate.fromTemplate(
        `Note Title: ${noteTitle || 'Untitled'}\nNote Content:\n${noteContent}\n\nSuggest tags:`
      ),
    ]);

    try {
      const chain = prompt.pipe(model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      console.log("AI Response (Auto-Tags):", response);
      const parsedResponse = JSON.parse(response);
      return Array.isArray(parsedResponse) ? parsedResponse.filter(tag => typeof tag === 'string') : [];
    } catch (error) {
      console.error("Error getting auto-tags:", error);
      return [];
    }
  }

  public async getSummarization(noteContent: string, noteTitle?: string): Promise<string> {
    if (!this.isAIEnabled()) return "";
    const model = this.getActiveChatModel();
    if (!model) {
      console.warn("No active AI chat model for summarization.");
      return "";
    }

    // TODO: Implement actual logic
    console.log("AIService: getSummarization called for note:", noteTitle);
     const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        "You are an expert in summarizing text. Provide a concise summary of the following note."
      ),
      HumanMessagePromptTemplate.fromTemplate(
        `Note Title: ${noteTitle || 'Untitled'}\nNote Content:\n${noteContent}\n\nSummary:`
      ),
    ]);

    try {
      const chain = prompt.pipe(model).pipe(new StringOutputParser());
      const summary = await chain.invoke({});
      console.log("AI Response (Summary):", summary);
      return summary;
    } catch (error) {
      console.error("Error getting summarization:", error);
      return "";
    }
  }

  public async getEmbeddingVector(text: string): Promise<number[]> {
    if (!this.isAIEnabled()) return [];

    const embeddingModel = this.getActiveEmbeddingModel();
    if (!embeddingModel) {
      console.warn("AIService: getEmbeddingVector - No active embedding model configured or initialized.");
      return [];
    }

    console.log("AIService: getEmbeddingVector called for text snippet:", text.substring(0,100));
    try {
      const vector = await embeddingModel.embedQuery(text);
      console.log("AI Response (Embedding Vector):", vector ? `Vector of dimension ${vector.length}` : "Failed to generate embedding");
      return Array.isArray(vector) ? vector : [];
    } catch (error) {
      console.error("Error getting embedding vector:", error);
      // Check if the error is specific to model not found or misconfiguration
      if (error instanceof Error && (error.message.includes("404") || error.message.includes("model not found"))) {
        console.error(`Embedding model might not be available or endpoint is incorrect. Model: ${embeddingModel.constructor.name}`);
      }
      return [];
    }
  }
}

// Export a singleton instance
export const aiService = AIService.getInstance();

// Listener for store changes to reinitialize AI models if settings change
useAppStore.subscribe(
  (state, prevState) => {
    const currentPrefs = state.userProfile?.preferences;
    const prevPrefs = prevState.userProfile?.preferences;

    if (!currentPrefs || !prevPrefs) return; // Should not happen if userProfile is always defined after init

    const aiSettingsChanged =
      currentPrefs.aiEnabled !== prevPrefs.aiEnabled ||
      currentPrefs.ollamaApiEndpoint !== prevPrefs.ollamaApiEndpoint ||
      currentPrefs.geminiApiKey !== prevPrefs.geminiApiKey ||
      currentPrefs.ollamaEmbeddingModel !== prevPrefs.ollamaEmbeddingModel ||
      currentPrefs.ollamaChatModel !== prevPrefs.ollamaChatModel ||
      currentPrefs.geminiEmbeddingModel !== prevPrefs.geminiEmbeddingModel ||
      currentPrefs.geminiChatModel !== prevPrefs.geminiChatModel ||
      currentPrefs.aiProviderPreference !== prevPrefs.aiProviderPreference;

    if (aiSettingsChanged) {
      console.log("AI settings changed, reinitializing AI models.");
      aiService.reinitializeModels();
    }
  }
);
