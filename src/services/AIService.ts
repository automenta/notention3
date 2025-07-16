import { Ollama } from '@langchain/community/llms/ollama';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import {
	ChatGoogleGenerativeAI,
	GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
	ChatPromptTemplate,
	HumanMessagePromptTemplate,
	SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import { UserProfile, OntologyTree } from '../../shared/types';

type AIPreferences = UserProfile['preferences'];

export class AIService {
	private ollama: Ollama | null = null;
	private gemini: ChatGoogleGenerativeAI | null = null;
	private ollamaEmbeddings: OllamaEmbeddings | null = null;
	private geminiEmbeddings: GoogleGenerativeAIEmbeddings | null = null;
	private preferences: AIPreferences | undefined;

	constructor(preferences?: AIPreferences) {
		this.preferences = preferences;
		this.initializeModels();
	}

	private initializeModels() {
		if (this.preferences?.aiEnabled) {
			const {
				ollamaApiEndpoint,
				ollamaEmbeddingModel = 'nomic-embed-text',
				ollamaChatModel = 'llama3',
				geminiApiKey,
				geminiEmbeddingModel = 'embedding-001',
				geminiChatModel = 'gemini-pro',
			} = this.preferences;

			if (ollamaApiEndpoint) {
				try {
					this.ollama = new Ollama({
						baseUrl: ollamaApiEndpoint,
						model: ollamaChatModel,
					});
					this.ollamaEmbeddings = new OllamaEmbeddings({
						baseUrl: ollamaApiEndpoint,
						model: ollamaEmbeddingModel,
					});
				} catch (error) {
					console.error('Failed to initialize Ollama models:', error);
				}
			}

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
				} catch (error) {
					console.error('Failed to initialize Gemini models:', error);
				}
			}
		}
	}

	private getActiveChatModel(): Ollama | ChatGoogleGenerativeAI | null {
		const preferredProvider = this.preferences?.aiProviderPreference;
		if (preferredProvider === 'gemini' && this.gemini) return this.gemini;
		if (preferredProvider === 'ollama' && this.ollama) return this.ollama;
		return this.gemini || this.ollama;
	}

	private getActiveEmbeddingModel():
		| OllamaEmbeddings
		| GoogleGenerativeAIEmbeddings
		| null {
		const preferredProvider = this.preferences?.aiProviderPreference;
		if (preferredProvider === 'gemini' && this.geminiEmbeddings)
			return this.geminiEmbeddings;
		if (preferredProvider === 'ollama' && this.ollamaEmbeddings)
			return this.ollamaEmbeddings;
		return this.geminiEmbeddings || this.ollamaEmbeddings;
	}

	public isAIEnabled(): boolean {
		return !!this.preferences?.aiEnabled;
	}

	public async getOntologySuggestions(
		existingOntology: OntologyTree,
		context?: string
	): Promise<any[]> {
		const model = this.getActiveChatModel();
		if (!model) return [];

		const prompt = ChatPromptTemplate.fromMessages([
			SystemMessagePromptTemplate.fromTemplate(
				"You are an expert in knowledge organization. Given an existing ontology (as JSON) and optionally some context, suggest new concepts (nodes) or relationships. Return suggestions as a JSON array of objects, where each object has 'label', 'parentId' (optional), and 'attributes' (optional)."
			),
			HumanMessagePromptTemplate.fromTemplate(
				`Existing Ontology: \n${JSON.stringify(
					existingOntology,
					null,
					2
				)}\n\nContext: ${
					context || 'General suggestions.'
				}\n\nSuggest enhancements:`
			),
		]);

		try {
			const chain = prompt.pipe(model).pipe(new StringOutputParser());
			const response = await chain.invoke({});
			return JSON.parse(response);
		} catch (error) {
			console.error('Error getting ontology suggestions:', error);
			return [];
		}
	}

	public async autoTag(
		noteContent: string,
		noteTitle?: string,
		existingOntology?: OntologyTree
	): Promise<string[]> {
		const model = this.getActiveChatModel();
		if (!model) return [];

		const ontologyContext = existingOntology
			? `\nConsider these existing tags: ${JSON.stringify(
					Object.values(existingOntology.nodes).map(n => n.label)
				)}`
			: '';

		const prompt = ChatPromptTemplate.fromMessages([
			SystemMessagePromptTemplate.fromTemplate(
				`You are an expert in semantic tagging. Suggest relevant tags for a note. Return tags as a JSON array of strings. ${ontologyContext}`
			),
			HumanMessagePromptTemplate.fromTemplate(
				`Note Title: ${noteTitle || 'Untitled'}\nNote Content:\n${noteContent}`
			),
		]);

		try {
			const chain = prompt.pipe(model).pipe(new StringOutputParser());
			const response = await chain.invoke({});
			const parsed = JSON.parse(response);
			return Array.isArray(parsed) ? parsed : [];
		} catch (error) {
			console.error('Error auto-tagging:', error);
			return [];
		}
	}

	public async summarize(
		noteContent: string,
		noteTitle?: string
	): Promise<string> {
		const model = this.getActiveChatModel();
		if (!model) return '';

		const prompt = ChatPromptTemplate.fromMessages([
			SystemMessagePromptTemplate.fromTemplate(
				'Provide a concise summary of the following note.'
			),
			HumanMessagePromptTemplate.fromTemplate(
				`Note Title: ${
					noteTitle || 'Untitled'
				}\nNote Content:\n${noteContent}`
			),
		]);

		try {
			const chain = prompt.pipe(model).pipe(new StringOutputParser());
			return await chain.invoke({});
		} catch (error) {
			console.error('Error summarizing:', error);
			return '';
		}
	}

	public async getEmbeddingVector(text: string): Promise<number[]> {
		const embeddingModel = this.getActiveEmbeddingModel();
		if (!embeddingModel) return [];

		try {
			return await embeddingModel.embedQuery(text);
		} catch (error) {
			console.error('Error getting embedding vector:', error);
			return [];
		}
	}
}

export const aiService = new AIService();
