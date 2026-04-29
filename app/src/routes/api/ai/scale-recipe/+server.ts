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

const scaleRecipeSchema = z.object({
	recipe: z.object({
		title: z.string(),
		servings: z.number().optional(),
		ingredients: z.array(z.string()),
		instructions: z.array(z.string())
	}),
	targetServings: z.number().optional(),
	panSize: z.string().optional()
});

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const body = await request.json();
		const result = scaleRecipeSchema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const { recipe, targetServings, panSize } = result.data;
		const aiService = await AIServiceV2.getInstance();

		const userMemories = await db
			.select()
			.from(memories)
			.where(eq(memories.userId, user.id))
			.orderBy(desc(memories.createdAt));

		const userContext = userMemories.length > 0
			? `User context: ${userMemories.map(m => m.content).join('; ')}`
			: '';

		const promptData = await PromptService.getPrompt(AIFeature.RECIPE_SCALING);
		let systemPrompt = promptData?.content || `Provide scaling advice for this recipe.
Recipe: {{recipe_title}}
Original servings: {{original_servings}}
Target: {{target_servings}} servings (or pan size: {{pan_size}})
Ingredients: {{ingredients}}
{{user_context}}
Return a JSON object with scaling advice.`;

		const originalServings = recipe.servings || 4;

		systemPrompt = PromptService.resolvePromptVariables(systemPrompt, {
			recipe_title: recipe.title,
			original_servings: String(originalServings),
			target_servings: String(targetServings || ''),
			pan_size: panSize || 'Not specified',
			ingredients: recipe.ingredients.join('\n'),
			user_context: userContext
		});

		const generationResult = await aiService.generateForFeature(AIFeature.RECIPE_SCALING, {
			systemPrompt,
			messages: [{ role: 'user', content: 'Please provide scaling advice.' }]
		});

		const content = generationResult.content;
		let scaling: Record<string, unknown> = {};

		try {
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				scaling = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
			}
		} catch {
			scaling = {};
		}

		return json({ scaling });
	} catch (e) {
		if ('status' in e) throw e;
		if (isAIRateLimitError(e)) {
			throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
		}
		if (isAIConfigurationError(e)) {
			throw error(503, e.message);
		}
		console.error('Scale recipe error:', e);
		throw error(500, 'Failed to scale recipe');
	}
};
