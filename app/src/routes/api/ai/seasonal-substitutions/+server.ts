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

const seasonalSubstitutionsSchema = z.object({
	recipe: z.object({
		title: z.string(),
		ingredients: z.array(z.string())
	})
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
		const result = seasonalSubstitutionsSchema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const { recipe } = result.data;
		const aiService = await AIServiceV2.getInstance();

		const userMemories = await db
			.select()
			.from(memories)
			.where(eq(memories.userId, user.id))
			.orderBy(desc(memories.createdAt));

		const userContext = userMemories.length > 0
			? `User dietary restrictions: ${userMemories.map(m => m.content).join('; ')}`
			: '';

		const currentSeason = getCurrentSeason();
		const promptData = await PromptService.getPrompt(AIFeature.SEASONAL_SUBSTITUTIONS);
		let systemPrompt = promptData?.content || `Suggest seasonal ingredient substitutions for this recipe.
Current season: {{current_season}} (Spring/Summer/Fall/Winter)
Recipe: {{recipe_title}}
Ingredients: {{ingredients}}
{{user_context}}
Return a JSON object with seasonal substitutions.`;

		systemPrompt = PromptService.resolvePromptVariables(systemPrompt, {
			current_season: currentSeason,
			recipe_title: recipe.title,
			ingredients: recipe.ingredients.join('\n'),
			user_context: userContext
		});

		const generationResult = await aiService.generateForFeature(AIFeature.SEASONAL_SUBSTITUTIONS, {
			systemPrompt,
			messages: [{ role: 'user', content: 'Please suggest seasonal substitutions.' }]
		});

		const content = generationResult.content;
		let seasonal: Record<string, unknown> = {};

		try {
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				seasonal = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
			}
		} catch {
			seasonal = {};
		}

		return json({ seasonal });
	} catch (e) {
		if ('status' in e) throw e;
		if (isAIRateLimitError(e)) {
			throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
		}
		if (isAIConfigurationError(e)) {
			throw error(503, e.message);
		}
		console.error('Seasonal substitutions error:', e);
		throw error(500, 'Failed to suggest seasonal substitutions');
	}
};
