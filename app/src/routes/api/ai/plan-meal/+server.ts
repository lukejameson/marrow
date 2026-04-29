import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { PromptService } from '$lib/server/ai/prompt-service';
import { AIConfigurationError, isAIConfigurationError, AIRateLimitError, isAIRateLimitError } from '$lib/utils/errors';
import { db } from '$lib/server/db/db';
import { memories } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

const planMealSchema = z.object({
	mainDish: z.object({
		title: z.string(),
		ingredients: z.array(z.string()),
		instructions: z.array(z.string())
	}),
	timeAvailable: z.number().optional(),
	dietaryPrefs: z.array(z.string()).optional()
});

function getCurrentSeason(): string {
	const month = new Date().getMonth();
	if (month >= 2 && month <= 4) return 'Spring';
	if (month >= 5 && month <= 7) return 'Summer';
	if (month >= 8 && month <= 10) return 'Fall';
	return 'Winter';
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const body = await request.json();
		const result = planMealSchema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const { mainDish, timeAvailable, dietaryPrefs } = result.data;
		const aiService = await AIServiceV2.getInstance();

		const userMemories = await db
			.select()
			.from(memories)
			.where(eq(memories.userId, user.id))
			.orderBy(desc(memories.createdAt));

		const userContext = userMemories.length > 0
			? userMemories.map(m => m.content).join('; ')
			: '';

		const currentSeason = getCurrentSeason();
		const promptData = await PromptService.getPrompt(AIFeature.MEAL_PLANNING);
		let systemPrompt = promptData?.content || `Create a complete meal plan featuring this recipe as the main dish.
Main dish: {{recipe_title}}
Available time: {{time_available}} minutes
Dietary preferences: {{dietary_preferences}}
Current season: {{current_season}}
{{user_context}}
Return a JSON object with the complete meal plan.`;

		systemPrompt = PromptService.resolvePromptVariables(systemPrompt, {
			recipe_title: mainDish.title,
			time_available: String(timeAvailable || 90),
			dietary_preferences: dietaryPrefs?.join(', ') || 'No restrictions',
			current_season: currentSeason,
			user_context: userContext
		});

		const generationResult = await aiService.generateForFeature(AIFeature.MEAL_PLANNING, {
			systemPrompt,
			messages: [{ role: 'user', content: 'Please create a meal plan.' }]
		});

		const content = generationResult.content;
		let mealPlan: Record<string, unknown> = {};

		try {
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				mealPlan = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
			}
		} catch {
			mealPlan = {};
		}

		return json({ mealPlan });
	} catch (e) {
		if ('status' in e) throw e;
		if (isAIRateLimitError(e)) {
			throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
		}
		if (isAIConfigurationError(e)) {
			throw error(503, e.message);
		}
		console.error('Plan meal error:', e);
		throw error(500, 'Failed to plan meal');
	}
};
