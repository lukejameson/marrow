import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/db';
import { recipes, photos, recipePhotos } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getStorageProviderForAdmin } from '$lib/server/storage/service';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { token, key } = params;

    if (!token || !key) {
      throw error(400, 'Token and key are required');
    }

    const [recipe] = await db
      .select({ userId: recipes.userId })
      .from(recipes)
      .where(and(eq(recipes.shareToken, token), eq(recipes.isShared, true)))
      .limit(1);

    if (!recipe) {
      throw error(404, 'Shared recipe not found');
    }

    const keyParts = key.split('/');
    const photoIdCandidate = keyParts[0];

    const [photo] = await db
      .select()
      .from(photos)
      .where(eq(photos.id, photoIdCandidate))
      .limit(1);

    if (!photo) {
      throw error(404, 'Photo not found');
    }

    const provider = await getStorageProviderForAdmin(recipe.userId);
    if (!provider) {
      throw error(404, 'Storage not configured');
    }

    const fileBuffer = await (provider as any).getFile(key);
    if (!fileBuffer) {
      throw error(404, 'File not found');
    }

    const ext = key.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'webp': 'image/webp',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml'
    };
    const contentType = mimeTypes[ext || ''] || 'application/octet-stream';

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    console.error('Serve shared photo error:', e);
    throw error(500, 'Internal server error');
  }
};