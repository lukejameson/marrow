import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { db } from '$lib/server/db/db';
import { recipes, memories } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { PromptService } from '$lib/server/ai/prompt-service';
import { AIRateLimitError, isAIRateLimitError } from '$lib/utils/errors';

const defaultSuggestions = [
	"What can I make with chicken and rice?",
	"Suggest a quick weeknight dinner",
	"Give me a healthy salad recipe",
	"What should I make for a dinner party?",
	"Help me meal prep for the week",
	"Create a recipe using seasonal vegetables",
];

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const [userMemories, userRecipes] = await Promise.all([
			db
				.select()
				.from(memories)
				.where(eq(memories.userId, user.id))
				.orderBy(desc(memories.createdAt)),
			db
				.select({ id: recipes.id, title: recipes.title })
				.from(recipes)
				.where(eq(recipes.userId, user.id))
				.orderBy(desc(recipes.createdAt))
				.limit(10)
		]);

		const userContext = userMemories.length > 0
			? userMemories.map(m => m.content).join('; ')
			: 'No specific dietary restrictions';

		const userRecipesList = userRecipes.length > 0
			? userRecipes.map(r => r.title).join(', ')
			: 'No existing recipes';

		const aiService = await AIServiceV2.getInstance();
		const promptData = await PromptService.getPrompt(AIFeature.PERSONALIZED_SUGGESTIONS);
		let systemPrompt = promptData?.content || `Generate 6 personalized recipe suggestions based on user context.
User preferences: {{user_context}}
User's existing recipes: {{user_recipes}}
Return ONLY a JSON array of 6 suggestion strings.`;

		systemPrompt = PromptService.resolvePromptVariables(systemPrompt, {
			user_context: userContext,
			user_recipes: userRecipesList
		});

		const genResult = await aiService.generateForFeature(AIFeature.PERSONALIZED_SUGGESTIONS, {
			systemPrompt,
			messages: [{ role: 'user', content: 'Please suggest recipes based on my preferences.' }]
		});

		const content = genResult.content;
		let suggestions: string[];

		try {
			const jsonMatch = content.match(/\[[\s\S]*\]/);
			if (jsonMatch) {
				suggestions = JSON.parse(jsonMatch[0]) as string[];
				if (!Array.isArray(suggestions) || suggestions.length === 0) {
					suggestions = defaultSuggestions;
				}
			} else {
				suggestions = defaultSuggestions;
			}
		} catch {
			suggestions = defaultSuggestions;
		}

		return json({ suggestions });
	} catch (e) {
		if ('status' in e) throw e;
		if (isAIRateLimitError(e)) {
			return json({ suggestions: defaultSuggestions });
		}
		console.error('Get personalized suggestions error:', e);
		return json({ suggestions: defaultSuggestions });
	}
};
