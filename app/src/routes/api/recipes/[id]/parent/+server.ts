import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, recipeComponents } from '$lib/server/db/schema';
import { getCurrentUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const token = cookies.get('auth_token');
    const user = await getCurrentUser(token);
    if (!user) {
      throw error(401, 'Not authenticated');
    }

    const [recipe] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, params.id), eq(recipes.userId, user.userId)))
      .limit(1);

    if (!recipe) {
      throw error(404, 'Recipe not found');
    }

    const parentLink = await db
      .select({
        id: recipeComponents.id,
        parentRecipeId: recipeComponents.parentRecipeId,
        servingsNeeded: recipeComponents.servingsNeeded,
        sortOrder: recipeComponents.sortOrder,
      })
      .from(recipeComponents)
      .where(eq(recipeComponents.childRecipeId, params.id))
      .limit(1);

    if (!parentLink || parentLink.length === 0) {
      return json({ parent: null });
    }

    const [parent] = await db
      .select({
        id: recipes.id,
        title: recipes.title,
      })
      .from(recipes)
      .where(eq(recipes.id, parentLink[0].parentRecipeId))
      .limit(1);

    return json({ 
      parent: parent ? {
        id: parent.id,
        title: parent.title,
        servingsNeeded: parentLink[0].servingsNeeded,
        sortOrder: parentLink[0].sortOrder,
      } : null
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Get parent error:', e);
    throw error(500, 'Internal server error');
  }
};
