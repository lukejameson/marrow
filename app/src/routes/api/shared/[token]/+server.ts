import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, tags, recipeTags, photos, recipePhotos } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { normalizeRecipeData } from '$lib/utils/recipe-helpers';

interface SharedPhoto {
  id: string;
  isMain: boolean;
  sortOrder: number;
  urls: {
    thumbnail: string | null;
    medium: string | null;
    original: string;
  };
}

export const GET: RequestHandler = async ({ params }) => {
  try {
    if (!params.token) {
      throw error(400, 'Share token is required');
    }
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.shareToken, params.token), eq(recipes.isShared, true)))
      .limit(1);
    if (!recipe) {
      throw error(404, 'Shared recipe not found');
    }
    const recipeTagsResult = await db
      .select({
        name: tags.name,
      })
      .from(recipeTags)
      .innerJoin(tags, eq(recipeTags.tagId, tags.id))
      .where(eq(recipeTags.recipeId, recipe.id));

    const recipePhotosList = await db
      .select({
        photoId: recipePhotos.photoId,
        isMain: recipePhotos.isMain,
        sortOrder: recipePhotos.sortOrder,
        originalKey: photos.originalKey,
        thumbnailKey: photos.thumbnailKey,
        mediumKey: photos.mediumKey,
      })
      .from(recipePhotos)
      .innerJoin(photos, eq(recipePhotos.photoId, photos.id))
      .where(eq(recipePhotos.recipeId, recipe.id))
      .orderBy(desc(recipePhotos.isMain), recipePhotos.sortOrder);

    const photosResult: SharedPhoto[] = recipePhotosList.map(rp => ({
      id: rp.photoId,
      isMain: rp.isMain,
      sortOrder: rp.sortOrder,
      urls: {
        thumbnail: rp.thumbnailKey ? `/api/shared/photos/${params.token}/${rp.thumbnailKey}` : null,
        medium: rp.mediumKey ? `/api/shared/photos/${params.token}/${rp.mediumKey}` : null,
        original: `/api/shared/photos/${params.token}/${rp.originalKey}`,
      },
    }));

    const normalizedRecipe = normalizeRecipeData(recipe);
    return json({
      ...normalizedRecipe,
      tags: recipeTagsResult.map(rt => rt.name),
      photos: photosResult,
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get shared recipe error:', e);
    throw error(500, 'Internal server error');
  }
};