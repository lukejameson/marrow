<script lang="ts">
  import AIBadge from './AIBadge.svelte';
  import AIButton from './AIButton.svelte';
  import { apiClient } from '$lib/api/client';
  import { getItemTexts } from '$lib/utils/recipe-helpers';
  import { scaleIngredient, scaleRecipe } from '$lib/utils/recipe-scaling';
  import type { RecipeItemList } from '$lib/server/db/schema';

  interface ScalingResult {
    scaleFactor: number;
    scaledServings: number;
    adjustedIngredients: { original: string; scaled: string; notes: string }[];
    scalingNotes: string[];
    equipmentAdvice: string;
  }

  interface Props {
    recipe: {
      id: string;
      title: string;
      servings?: number;
      ingredients: RecipeItemList;
      instructions: RecipeItemList;
    };
    onClose: () => void;
    onSaveScaled: (scaled: { title: string; description?: string; ingredients: string[]; instructions: string[]; servings?: number }) => void;
  }

  let { recipe, onClose, onSaveScaled }: Props = $props();
  let targetServings = $state(recipe.servings || 4);
  let loading = $state(false);
  let error = $state('');
  let scalingAdvice = $state<ScalingResult | null>(null);
  let scaledIngredients = $state<string[]>([]);
  let saving = $state(false);

  const originalServings = recipe.servings || 4;

  $effect(() => {
    updateScaledIngredients();
  });

  function updateScaledIngredients() {
    const ingredients = getItemTexts(recipe.ingredients);
    scaledIngredients = scaleRecipe(ingredients, originalServings, targetServings);
  }

  async function loadScalingAdvice() {
    loading = true;
    error = '';
    try {
      const result = await apiClient.getScalingAdvice({
        recipe: {
          title: recipe.title,
          servings: recipe.servings || 4,
          ingredients: getItemTexts(recipe.ingredients),
          instructions: getItemTexts(recipe.instructions)
        },
        targetServings
      });
      scalingAdvice = result.scaling;
    } catch (err: any) {
      error = err.message || 'Failed to get scaling advice';
    } finally {
      loading = false;
    }
  }

  async function handleSaveScaled() {
    saving = true;
    try {
      await onSaveScaled({
        title: `${recipe.title} (${targetServings} servings)`,
        ingredients: scaledIngredients,
        instructions: getItemTexts(recipe.instructions),
        servings: targetServings
      });
      onClose();
    } catch (err: any) {
      error = err.message || 'Failed to save scaled recipe';
    } finally {
      saving = false;
    }
  }

  function formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose} aria-hidden="true">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="scaling-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div>
        <h3 id="scaling-title">Scale Recipe</h3>
        <p class="recipe-name">{recipe.title}</p>
      </div>
      <button class="btn-close" onclick={onClose} aria-label="Close modal">&times;</button>
    </div>

    <div class="modal-body">
      <div class="scaling-controls">
        <div class="servings-control">
          <label for="servings-input">Target Servings</label>
          <div class="servings-input-group">
            <button class="servings-btn" onclick={() => targetServings = Math.max(1, targetServings - 1)}>-</button>
            <input
              id="servings-input"
              type="number"
              min="1"
              max="100"
              bind:value={targetServings}
              class="servings-input"
            />
            <button class="servings-btn" onclick={() => targetServings = Math.min(100, targetServings + 1)}>+</button>
          </div>
        </div>

        <div class="scale-factor">
          Scale factor: <strong>{(targetServings / originalServings).toFixed(2)}x</strong>
        </div>

        <button class="btn-advice" onclick={loadScalingAdvice} disabled={loading}>
          {loading ? 'Loading...' : 'Get AI Scaling Advice'}
        </button>
      </div>

      {#if scalingAdvice}
        <div class="scaling-advice">
          {#if scalingAdvice.equipmentAdvice}
            <div class="advice-card equipment">
              <h4>Equipment Advice</h4>
              <p>{scalingAdvice.equipmentAdvice}</p>
            </div>
          {/if}
          
          {#if scalingAdvice.scalingNotes.length > 0}
            <div class="advice-card notes">
              <h4>Important Notes</h4>
              <ul>
                {#each scalingAdvice.scalingNotes as note}
                  <li>{note}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}

      <div class="ingredients-preview">
        <h4>Scaled Ingredients ({targetServings} servings)</h4>
        <ul class="ingredients-list">
          {#each scaledIngredients as ingredient, index}
            <li>
              <span class="original">{getItemTexts(recipe.ingredients)[index]}</span>
              <span class="arrow">→</span>
              <span class="scaled">{ingredient}</span>
            </li>
          {/each}
        </ul>
      </div>
    </div>

    <div class="modal-footer">
      <AIBadge />
      <div class="footer-actions">
        <AIButton onclick={handleSaveScaled} loading={saving} label="Save as New Recipe" variant="primary" />
        <button class="btn-secondary" onclick={onClose}>Close</button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 1000;
    padding: var(--spacing-4);
    padding-top: calc(var(--spacing-4) + env(safe-area-inset-top));
    overflow-y: auto;
  }

  .modal {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 560px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--spacing-4) var(--spacing-5);
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-light);
  }

  .recipe-name {
    margin: var(--spacing-1) 0 0;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text);
  }

  .btn-close {
    background: none;
    border: none;
    font-size: var(--text-xl);
    color: var(--color-text-light);
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
  }

  .btn-close:hover {
    color: var(--color-text);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-4) var(--spacing-5);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .scaling-controls {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    background: var(--color-background);
    padding: var(--spacing-4);
    border-radius: var(--radius-lg);
  }

  .servings-control {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .servings-control label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .servings-input-group {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
  }

  .servings-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-lg);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .servings-btn:hover {
    background: var(--color-border-light);
  }

  .servings-input {
    width: 80px;
    height: 40px;
    text-align: center;
    font-size: var(--text-lg);
    font-weight: 600;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .servings-input::-webkit-inner-spin-button,
  .servings-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .scale-factor {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    text-align: center;
  }

  .scale-factor strong {
    color: var(--color-primary);
  }

  .btn-advice {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-advice:hover:not(:disabled) {
    background: var(--color-border-light);
  }

  .btn-advice:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .scaling-advice {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .advice-card {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-3);
  }

  .advice-card h4 {
    margin: 0 0 var(--spacing-2);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-light);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .advice-card p,
  .advice-card li {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text);
    line-height: 1.5;
  }

  .advice-card ul {
    margin: 0;
    padding-left: var(--spacing-4);
  }

  .advice-card ul li {
    margin-bottom: var(--spacing-1);
  }

  .advice-card.equipment {
    border-left: 3px solid var(--color-primary);
  }

  .ingredients-preview h4 {
    margin: 0 0 var(--spacing-3);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text);
  }

  .ingredients-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .ingredients-list li {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    font-size: var(--text-sm);
    padding: var(--spacing-2);
    background: var(--color-background);
    border-radius: var(--radius-md);
  }

  .ingredients-list .original {
    flex: 1;
    color: var(--color-text-light);
    text-decoration: line-through;
  }

  .ingredients-list .arrow {
    color: var(--color-text-light);
  }

  .ingredients-list .scaled {
    flex: 1;
    font-weight: 500;
    color: var(--color-text);
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3) var(--spacing-5);
    border-top: 1px solid var(--color-border);
  }

  .footer-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .btn-secondary {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-secondary:hover {
    background: var(--color-surface);
  }
</style>
