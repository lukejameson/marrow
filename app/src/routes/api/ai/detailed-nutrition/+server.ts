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

const detailedNutritionSchema = z.object({
	recipe: z.object({
		title: z.string(),
		ingredients: z.array(z.string())
	}),
	servings: z.number().min(1)
});

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const body = await request.json();
		const result = detailedNutritionSchema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const { recipe, servings } = result.data;
		const aiService = await AIServiceV2.getInstance();

		const userMemories = await db
			.select()
			.from(memories)
			.where(eq(memories.userId, user.id))
			.orderBy(desc(memories.createdAt));

		const userContext = userMemories.length > 0
			? `User context: ${userMemories.map(m => m.content).join('; ')}`
			: '';

		const promptData = await PromptService.getPrompt(AIFeature.DETAILED_NUTRITION);
		let systemPrompt = promptData?.content || `Calculate detailed nutritional information per serving.
Recipe: {{recipe_title}}
Servings: {{servings}}
Ingredients: {{ingredients}}
{{user_context}}
Return a JSON object with detailed nutrition information.`;

		systemPrompt = PromptService.resolvePromptVariables(systemPrompt, {
			recipe_title: recipe.title,
			servings: String(servings),
			ingredients: recipe.ingredients.join('\n'),
			user_context: userContext
		});

		const generationResult = await aiService.generateForFeature(AIFeature.DETAILED_NUTRITION, {
			systemPrompt,
			messages: [{ role: 'user', content: 'Please calculate nutrition.' }]
		});

		const content = generationResult.content;
		let nutrition: Record<string, unknown> = {};

		try {
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				nutrition = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
			}
		} catch {
			nutrition = {};
		}

		return json({ nutrition });
	} catch (e) {
		if ('status' in e) throw e;
		if (isAIRateLimitError(e)) {
			throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
		}
		if (isAIConfigurationError(e)) {
			throw error(503, e.message);
		}
		console.error('Detailed nutrition error:', e);
		throw error(500, 'Failed to calculate nutrition');
	}
};
