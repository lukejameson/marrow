export enum AIFeature {
	RECIPE_CHAT = 'recipe_chat',
	RECIPE_CHAT_CONTEXTUAL = 'recipe_chat_contextual',
	RECIPE_GENERATION = 'recipe_generation',
	RECIPE_FROM_PHOTOS = 'recipe_from_photos',
	RECIPE_FROM_INSTAGRAM = 'recipe_from_instagram',
	PHOTO_GROUPING = 'photo_grouping',
	TAG_SUGGESTIONS = 'tag_suggestions',
	IMPROVEMENT_SUGGESTIONS = 'improvement_suggestions',
	APPLY_IMPROVEMENTS = 'apply_improvements',
	INGREDIENT_SUBSTITUTIONS = 'ingredient_substitutions',
	RECIPE_ADAPTATION = 'recipe_adaptation',
	NUTRITION_CALCULATION = 'nutrition_calculation',
	TECHNIQUE_EXPLANATION = 'technique_explanation',
	PANTRY_MATCHING = 'pantry_matching',
	RECIPE_MENTION_SEARCH = 'recipe_mention_search',
	IMAGE_PROMPT_GENERATION = 'image_prompt_generation',
	IMAGE_GENERATION = 'image_generation',
	PERSONALIZED_SUGGESTIONS = 'personalized_suggestions',
	RECIPE_VARIATIONS = 'recipe_variations',
	MEAL_PLANNING = 'meal_planning',
	RECIPE_SCALING = 'recipe_scaling',
	COOKING_COACH = 'cooking_coach',
	SEASONAL_SUBSTITUTIONS = 'seasonal_substitutions',
	DETAILED_NUTRITION = 'detailed_nutrition'
}
export interface FeatureConfig {
	feature: AIFeature;
	providerId: string;
	modelId: string;
	temperature?: number;
	maxTokens?: number;
	enabled: boolean;
}
export const DEFAULT_FEATURE_CONFIGS: Record<AIFeature, { temperature: number; maxTokens: number; requiresVision: boolean }> = {
	[AIFeature.RECIPE_CHAT]: {
		temperature: 0.7,
		maxTokens: 4096,
		requiresVision: false
	},
	[AIFeature.RECIPE_CHAT_CONTEXTUAL]: {
		temperature: 0.7,
		maxTokens: 4096,
		requiresVision: false
	},
	[AIFeature.RECIPE_GENERATION]: {
		temperature: 0.7,
		maxTokens: 4096,
		requiresVision: false
	},
	[AIFeature.RECIPE_FROM_PHOTOS]: {
		temperature: 0.3,
		maxTokens: 4096,
		requiresVision: true
	},
	[AIFeature.RECIPE_FROM_INSTAGRAM]: {
		temperature: 0.3,
		maxTokens: 4096,
		requiresVision: true
	},
	[AIFeature.PHOTO_GROUPING]: {
		temperature: 0.3,
		maxTokens: 2048,
		requiresVision: true
	},
	[AIFeature.TAG_SUGGESTIONS]: {
		temperature: 0.3,
		maxTokens: 1024,
		requiresVision: false
	},
	[AIFeature.IMPROVEMENT_SUGGESTIONS]: {
		temperature: 0.5,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.APPLY_IMPROVEMENTS]: {
		temperature: 0.3,
		maxTokens: 4096,
		requiresVision: false
	},
	[AIFeature.INGREDIENT_SUBSTITUTIONS]: {
		temperature: 0.4,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.RECIPE_ADAPTATION]: {
		temperature: 0.5,
		maxTokens: 4096,
		requiresVision: false
	},
	[AIFeature.NUTRITION_CALCULATION]: {
		temperature: 0.2,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.TECHNIQUE_EXPLANATION]: {
		temperature: 0.5,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.PANTRY_MATCHING]: {
		temperature: 0.3,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.RECIPE_MENTION_SEARCH]: {
		temperature: 0.2,
		maxTokens: 1024,
		requiresVision: false
	},
	[AIFeature.IMAGE_PROMPT_GENERATION]: {
		temperature: 0.3,
		maxTokens: 1024,
		requiresVision: false
	},
	[AIFeature.IMAGE_GENERATION]: {
		temperature: 0.5,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.PERSONALIZED_SUGGESTIONS]: {
		temperature: 0.7,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.RECIPE_VARIATIONS]: {
		temperature: 0.7,
		maxTokens: 4096,
		requiresVision: false
	},
	[AIFeature.MEAL_PLANNING]: {
		temperature: 0.7,
		maxTokens: 4096,
		requiresVision: false
	},
	[AIFeature.RECIPE_SCALING]: {
		temperature: 0.4,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.COOKING_COACH]: {
		temperature: 0.5,
		maxTokens: 4096,
		requiresVision: false
	},
	[AIFeature.SEASONAL_SUBSTITUTIONS]: {
		temperature: 0.4,
		maxTokens: 2048,
		requiresVision: false
	},
	[AIFeature.DETAILED_NUTRITION]: {
		temperature: 0.3,
		maxTokens: 2048,
		requiresVision: false
	}
};
export const FEATURE_NAMES: Record<AIFeature, string> = {
	[AIFeature.RECIPE_CHAT]: 'Recipe Chat',
	[AIFeature.RECIPE_CHAT_CONTEXTUAL]: 'Recipe Chat (Contextual)',
	[AIFeature.RECIPE_GENERATION]: 'Recipe Generation',
	[AIFeature.RECIPE_FROM_PHOTOS]: 'Recipe from Photos',
	[AIFeature.RECIPE_FROM_INSTAGRAM]: 'Recipe from Instagram',
	[AIFeature.PHOTO_GROUPING]: 'Photo Grouping',
	[AIFeature.TAG_SUGGESTIONS]: 'Tag Suggestions',
	[AIFeature.IMPROVEMENT_SUGGESTIONS]: 'Improvement Suggestions',
	[AIFeature.APPLY_IMPROVEMENTS]: 'Apply Improvements',
	[AIFeature.INGREDIENT_SUBSTITUTIONS]: 'Ingredient Substitutions',
	[AIFeature.RECIPE_ADAPTATION]: 'Recipe Adaptation',
	[AIFeature.NUTRITION_CALCULATION]: 'Nutrition Calculation',
	[AIFeature.TECHNIQUE_EXPLANATION]: 'Technique Explanation',
	[AIFeature.PANTRY_MATCHING]: 'Pantry Matching',
	[AIFeature.RECIPE_MENTION_SEARCH]: 'Recipe Mention Search',
	[AIFeature.IMAGE_PROMPT_GENERATION]: 'Image Prompt Generation',
	[AIFeature.IMAGE_GENERATION]: 'Image Generation',
	[AIFeature.PERSONALIZED_SUGGESTIONS]: 'Personalized Suggestions',
	[AIFeature.RECIPE_VARIATIONS]: 'Recipe Variations',
	[AIFeature.MEAL_PLANNING]: 'Meal Planning',
	[AIFeature.RECIPE_SCALING]: 'Recipe Scaling',
	[AIFeature.COOKING_COACH]: 'Cooking Coach',
	[AIFeature.SEASONAL_SUBSTITUTIONS]: 'Seasonal Substitutions',
	[AIFeature.DETAILED_NUTRITION]: 'Detailed Nutrition'
};
export const FEATURE_DESCRIPTIONS: Record<AIFeature, string> = {
	[AIFeature.RECIPE_CHAT]: 'General chat about recipes and cooking',
	[AIFeature.RECIPE_CHAT_CONTEXTUAL]: 'Chat about a specific recipe with full context',
	[AIFeature.RECIPE_GENERATION]: 'Generate new recipes from text descriptions',
	[AIFeature.RECIPE_FROM_PHOTOS]: 'Extract recipes from uploaded photos (requires vision)',
	[AIFeature.RECIPE_FROM_INSTAGRAM]: 'Extract recipes from Instagram posts via oEmbed (requires vision)',
	[AIFeature.PHOTO_GROUPING]: 'Group photos by recipe (requires vision)',
	[AIFeature.TAG_SUGGESTIONS]: 'Suggest tags for recipes',
	[AIFeature.IMPROVEMENT_SUGGESTIONS]: 'Suggest improvements to recipes',
	[AIFeature.APPLY_IMPROVEMENTS]: 'Apply suggested improvements to recipes',
	[AIFeature.INGREDIENT_SUBSTITUTIONS]: 'Suggest ingredient substitutions',
	[AIFeature.RECIPE_ADAPTATION]: 'Adapt recipes for dietary restrictions or serving sizes',
	[AIFeature.NUTRITION_CALCULATION]: 'Calculate nutritional information',
	[AIFeature.TECHNIQUE_EXPLANATION]: 'Explain cooking techniques',
	[AIFeature.PANTRY_MATCHING]: 'Find recipes matching available pantry items',
	[AIFeature.RECIPE_MENTION_SEARCH]: 'Search for recipes mentioned in text',
	[AIFeature.IMAGE_PROMPT_GENERATION]: 'Generate image prompts from recipe details',
	[AIFeature.IMAGE_GENERATION]: 'Generate images from text prompts',
	[AIFeature.PERSONALIZED_SUGGESTIONS]: 'Generate personalized recipe suggestions based on user preferences',
	[AIFeature.RECIPE_VARIATIONS]: 'Create style and flavor variations of existing recipes',
	[AIFeature.MEAL_PLANNING]: 'Build complete meal plans with appetizers, sides, and desserts',
	[AIFeature.RECIPE_SCALING]: 'Smart recipe scaling with AI-powered advice',
	[AIFeature.COOKING_COACH]: 'Step-by-step cooking guidance with timing and technique tips',
	[AIFeature.SEASONAL_SUBSTITUTIONS]: 'Suggest seasonal ingredient substitutions based on current season',
	[AIFeature.DETAILED_NUTRITION]: 'Calculate detailed nutritional information with health labels'
};
export enum FeatureCategory {
	CHAT = 'chat',
	GENERATION = 'generation',
	ENHANCEMENT = 'enhancement',
	ANALYSIS = 'analysis'
}
export const FEATURE_CATEGORIES: Record<AIFeature, FeatureCategory> = {
	[AIFeature.RECIPE_CHAT]: FeatureCategory.CHAT,
	[AIFeature.RECIPE_CHAT_CONTEXTUAL]: FeatureCategory.CHAT,
	[AIFeature.RECIPE_GENERATION]: FeatureCategory.GENERATION,
	[AIFeature.RECIPE_FROM_PHOTOS]: FeatureCategory.GENERATION,
	[AIFeature.RECIPE_FROM_INSTAGRAM]: FeatureCategory.GENERATION,
	[AIFeature.PHOTO_GROUPING]: FeatureCategory.GENERATION,
	[AIFeature.TAG_SUGGESTIONS]: FeatureCategory.ENHANCEMENT,
	[AIFeature.IMPROVEMENT_SUGGESTIONS]: FeatureCategory.ENHANCEMENT,
	[AIFeature.APPLY_IMPROVEMENTS]: FeatureCategory.ENHANCEMENT,
	[AIFeature.INGREDIENT_SUBSTITUTIONS]: FeatureCategory.ENHANCEMENT,
	[AIFeature.RECIPE_ADAPTATION]: FeatureCategory.ENHANCEMENT,
	[AIFeature.NUTRITION_CALCULATION]: FeatureCategory.ANALYSIS,
	[AIFeature.TECHNIQUE_EXPLANATION]: FeatureCategory.ANALYSIS,
	[AIFeature.PANTRY_MATCHING]: FeatureCategory.ANALYSIS,
	[AIFeature.RECIPE_MENTION_SEARCH]: FeatureCategory.ANALYSIS,
	[AIFeature.IMAGE_PROMPT_GENERATION]: FeatureCategory.GENERATION,
	[AIFeature.IMAGE_GENERATION]: FeatureCategory.GENERATION,
	[AIFeature.PERSONALIZED_SUGGESTIONS]: FeatureCategory.GENERATION,
	[AIFeature.RECIPE_VARIATIONS]: FeatureCategory.ENHANCEMENT,
	[AIFeature.MEAL_PLANNING]: FeatureCategory.GENERATION,
	[AIFeature.RECIPE_SCALING]: FeatureCategory.ENHANCEMENT,
	[AIFeature.COOKING_COACH]: FeatureCategory.ANALYSIS,
	[AIFeature.SEASONAL_SUBSTITUTIONS]: FeatureCategory.ENHANCEMENT,
	[AIFeature.DETAILED_NUTRITION]: FeatureCategory.ANALYSIS
};
export const CATEGORY_NAMES: Record<FeatureCategory, string> = {
	[FeatureCategory.CHAT]: 'Chat',
	[FeatureCategory.GENERATION]: 'Generation',
	[FeatureCategory.ENHANCEMENT]: 'Enhancement',
	[FeatureCategory.ANALYSIS]: 'Analysis'
};
