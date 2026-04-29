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

const suggestVariationsSchema = z.object({
	recipe: z.object({
		title: z.string(),
		ingredients: z.array(z.string()),
		instructions: z.array(z.string())
	})
});

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const body = await request.json();
		const result = suggestVariationsSchema.safeParse(body);
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
			? `User preferences: ${userMemories.map(m => m.content).join('; ')}`
			: '';

		const promptData = await PromptService.getPrompt(AIFeature.RECIPE_VARIATIONS);
		let systemPrompt = promptData?.content || `Create 3-5 variations of this recipe with different styles or flavor profiles.
Recipe: {{recipe_title}}
Ingredients: {{ingredients}}
Instructions: {{instructions}}
{{user_context}}
Return a JSON array of variation objects.`;

		systemPrompt = PromptService.resolvePromptVariables(systemPrompt, {
			recipe_title: recipe.title,
			ingredients: recipe.ingredients.join('\n'),
			instructions: recipe.instructions.join('\n'),
			user_context: userContext
		});

		const generationResult = await aiService.generateForFeature(AIFeature.RECIPE_VARIATIONS, {
			systemPrompt,
			messages: [{ role: 'user', content: 'Please create recipe variations.' }]
		});

		const content = generationResult.content;
		let variations: Array<Record<string, unknown>>;

		try {
			const jsonMatch = content.match(/\[[\s\S]*\]/);
			if (jsonMatch) {
				variations = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
			} else {
				variations = [];
			}
		} catch {
			variations = [];
		}

		return json({ variations });
	} catch (e) {
		if ('status' in e) throw e;
		if (isAIRateLimitError(e)) {
			throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
		}
		if (isAIConfigurationError(e)) {
			throw error(503, e.message);
		}
		console.error('Suggest variations error:', e);
		throw error(500, 'Failed to suggest variations');
	}
};
