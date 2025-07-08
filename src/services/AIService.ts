import { Ollama } from "@langchain/community/llms/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
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

    if (userProfile?.preferences.aiEnabled) {
      if (userProfile.preferences.ollamaApiEndpoint) {
        try {
          this.ollama = new Ollama({
            baseUrl: userProfile.preferences.ollamaApiEndpoint,
            model: "llama3", // TODO: Make model configurable
          });
          console.log("Ollama model initialized with endpoint:", userProfile.preferences.ollamaApiEndpoint);
        } catch (error) {
          console.error("Failed to initialize Ollama:", error);
          this.ollama = null;
        }
      }

      if (userProfile.preferences.geminiApiKey) {
        try {
          this.gemini = new ChatGoogleGenerativeAI({
            apiKey: userProfile.preferences.geminiApiKey,
            modelName: "gemini-pro", // TODO: Make model configurable
            safetySettings: [ // Default safety settings
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
              },
            ],
          });
          console.log("Gemini model initialized.");
        } catch (error) {
          console.error("Failed to initialize Gemini:", error);
          this.gemini = null;
        }
      }
    }
  }

  // Call this method if AI settings change
  public reinitializeModels() {
    this.ollama = null;
    this.gemini = null;
    this.initializeModels();
  }

  private getActiveModel(): Ollama | ChatGoogleGenerativeAI | null {
    // Prioritize Gemini if available, then Ollama
    // TODO: Make this selection configurable by the user
    if (this.gemini) return this.gemini;
    if (this.ollama) return this.ollama;
    return null;
  }

  public isAIEnabled(): boolean {
    const { userProfile } = useAppStore.getState();
    return !!userProfile?.preferences.aiEnabled;
  }

  public async getOntologySuggestions(existingOntology: OntologyTree, context?: string): Promise<any[]> {
    if (!this.isAIEnabled()) return [];
    const model = this.getActiveModel();
    if (!model) {
      console.warn("No active AI model for ontology suggestions.");
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
    const model = this.getActiveModel();
    if (!model) {
      console.warn("No active AI model for auto-tagging.");
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
    const model = this.getActiveModel();
    if (!model) {
      console.warn("No active AI model for summarization.");
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
    // This requires an embedding model. Ollama and Gemini might support embeddings directly
    // or require a separate Langchain Embeddings class.
    // For Ollama, you can use OllamaEmbeddings. For Gemini, GoogleGenerativeAIEmbeddings.

    // Placeholder: This part needs specific embedding model integration.
    // For now, let's assume the main model can also do embeddings if it's a multimodal one or supports it.
    // This is a simplification and might not work directly.
    const model = this.getActiveModel();

    // Placeholder for actual embedding model check
    // For now, we assume only dedicated embedding models will be implemented later.
    // So, this function will return [] until a proper embedding model is integrated.
    // To use with Ollama, you'd use OllamaEmbeddings. For Gemini, GoogleGenerativeAIEmbeddings.
    const hasEmbeddingCapability = false; // TODO: Set this based on actual embedding model availability

    if (!model || !hasEmbeddingCapability) {
        console.warn("AIService: getEmbeddingVector - No active or suitable AI model with embedding capabilities configured.");
        return [];
    }

    console.log("AIService: getEmbeddingVector called for text snippet:", text.substring(0,100));
    try {
      // This is a conceptual call. The actual method might differ based on the model wrapper.
      // e.g., for OllamaEmbeddings: await this.ollamaEmbeddings.embedQuery(text);
      // For some chat models, this might not be directly available.
      // We might need to use a dedicated embedding model.
      const vector = await (model as any).embedQuery(text); // This is speculative
      console.log("AI Response (Embedding Vector):", vector ? `Vector of dimension ${vector.length}` : "Failed");
      return Array.isArray(vector) ? vector : [];
    } catch (error) {
      console.error("Error getting embedding vector:", error);
      return [];
    }
  }
}

// Export a singleton instance
export const aiService = AIService.getInstance();

// Listener for store changes to reinitialize AI models if settings change
useAppStore.subscribe(
  (state, prevState) => {
    const aiEnabledChanged = state.userProfile?.preferences.aiEnabled !== prevState.userProfile?.preferences.aiEnabled;
    const ollamaEndpointChanged = state.userProfile?.preferences.ollamaApiEndpoint !== prevState.userProfile?.preferences.ollamaApiEndpoint;
    const geminiKeyChanged = state.userProfile?.preferences.geminiApiKey !== prevState.userProfile?.preferences.geminiApiKey;

    if (aiEnabledChanged || ollamaEndpointChanged || geminiKeyChanged) {
      console.log("AI settings changed, reinitializing AI models.");
      aiService.reinitializeModels();
    }
  }
);
