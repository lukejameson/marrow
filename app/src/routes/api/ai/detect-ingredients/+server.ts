import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { z } from 'zod';
import { AIServiceV2 } from '$lib/server/ai/service-v2';
import { AIFeature } from '$lib/server/ai/features';
import { PromptService } from '$lib/server/ai/prompt-service';
import { isAIConfigurationError, isAIRateLimitError } from '$lib/utils/errors';

const detectSchema = z.object({
	images: z.array(z.string()).min(1),
});

const PANTRY_CATEGORIES = [
	'produce',
	'dairy',
	'meat',
	'grains',
	'canned',
	'condiments',
	'spices',
	'frozen',
	'snacks',
	'other',
];

interface DetectedItem {
	name: string;
	category: string;
	quantity?: number;
	unit?: string;
}

function normalizeCategory(category: unknown): string {
	if (typeof category !== 'string') return 'other';
	const normalized = category.toLowerCase().trim();
	return PANTRY_CATEGORIES.includes(normalized) ? normalized : 'other';
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const token = cookies.get('auth_token');
		const user = await getCurrentUser(token);
		if (!user) {
			throw error(401, 'Not authenticated');
		}

		const body = await request.json();
		const result = detectSchema.safeParse(body);
		if (!result.success) {
			throw error(400, result.error.message);
		}

		const { images } = result.data;

		const aiService = await AIServiceV2.getInstance();

		// Pre-flight: block only on a real vision/config problem, not the
		// "no per-feature config yet" case (generateForFeature falls back).
		const validation = await aiService.validateFeatureConfig(AIFeature.INGREDIENT_DETECTION);
		if (!validation.valid && !validation.error?.startsWith('No configuration found')) {
			throw error(503, validation.error || 'No vision-capable AI model is configured.');
		}

		const imageData = images.map((img) => {
			const isPng = img.startsWith('data:image/png');
			const base64Data = img.split(',')[1];
			return {
				mimeType: isPng ? 'image/png' : 'image/jpeg',
				data: base64Data,
			};
		});

		const promptData = await PromptService.getPrompt(AIFeature.INGREDIENT_DETECTION);
		const systemPrompt =
			promptData?.content ||
			`You are a food-detection assistant. Look at the provided photo(s) and identify every distinct food item or ingredient that is visible. Return ONLY a valid JSON array of objects with fields: name (string), category (one of: produce, dairy, meat, grains, canned, condiments, spices, frozen, snacks, other), quantity (optional number), unit (optional string). List only items you can see; do not guess hidden items; do not include non-food items.`;

		const generationResult = await aiService.generateForFeature(AIFeature.INGREDIENT_DETECTION, {
			systemPrompt,
			messages: [{ role: 'user', content: 'List every food item visible in these images.' }],
			images: imageData,
			jsonMode: true,
		});

		const content = generationResult.content;
		let rawItems: unknown = [];
		try {
			const jsonMatch = content.match(/\[[\s\S]*\]/);
			if (jsonMatch) {
				rawItems = JSON.parse(jsonMatch[0]);
			}
		} catch {
			rawItems = [];
		}

		if (!Array.isArray(rawItems)) {
			rawItems = [];
		}

		const ingredients: DetectedItem[] = (rawItems as unknown[])
			.map((item): DetectedItem | null => {
				if (typeof item === 'string') {
					const name = item.trim();
					return name ? { name, category: 'other' } : null;
				}
				if (typeof item !== 'object' || item === null) return null;
				const obj = item as Record<string, unknown>;
				const name = typeof obj.name === 'string' ? obj.name.trim() : '';
				if (!name) return null;
				const quantity = typeof obj.quantity === 'number' ? obj.quantity : undefined;
				const unit = typeof obj.unit === 'string' && obj.unit.trim() ? obj.unit.trim() : undefined;
				const category = normalizeCategory(obj.category);
				return {
					name,
					category,
					...(quantity !== undefined && { quantity }),
					...(unit !== undefined && { unit }),
				};
			})
			.filter((item): item is DetectedItem => item !== null);

		return json({ ingredients });
	} catch (e) {
		if (e instanceof Error && 'status' in e) throw e;
		if (isAIRateLimitError(e)) {
			throw error(503, 'AI service is temporarily busy. Please try again in a moment.');
		}
		if (isAIConfigurationError(e)) {
			throw error(503, e instanceof Error ? e.message : 'AI configuration error');
		}
		console.error('Detect ingredients error:', e);
		throw error(500, 'Failed to detect ingredients');
	}
};
