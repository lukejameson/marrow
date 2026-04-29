<script lang="ts">
  import AIBadge from './AIBadge.svelte';
  import AIButton from './AIButton.svelte';
  import { apiClient } from '$lib/api/client';
  import { getItemTexts } from '$lib/utils/recipe-helpers';
  import type { RecipeItemList } from '$lib/server/db/schema';

  interface Variation {
    name: string;
    description: string;
    keyChanges: string[];
    adaptedIngredients: string[];
    addedIngredients: string[];
    removedIngredients: string[];
  }

  interface Props {
    recipe: {
      id: string;
      title: string;
      ingredients: RecipeItemList;
      instructions: RecipeItemList;
    };
    onClose: () => void;
    onSaveVariation: (variation: { title: string; description: string; ingredients: string[]; instructions: string[] }) => void;
  }

  let { recipe, onClose, onSaveVariation }: Props = $props();
  let loading = $state(true);
  let error = $state('');
  let variations = $state<Variation[]>([]);
  let selectedVariation = $state<Variation | null>(null);
  let saving = $state(false);

  $effect(() => {
    loadVariations();
  });

  async function loadVariations() {
    loading = true;
    error = '';
    try {
      const result = await apiClient.suggestVariations({
        recipe: {
          title: recipe.title,
          ingredients: getItemTexts(recipe.ingredients),
          instructions: getItemTexts(recipe.instructions)
        }
      });
      variations = result.variations || [];
    } catch (err: any) {
      error = err.message || 'Failed to get variations';
    } finally {
      loading = false;
    }
  }

  async function handleSaveVariation(variation: Variation) {
    saving = true;
    try {
      const fullIngredients = [
        ...variation.removedIngredients.map(i => `WITHOUT: ${i}`),
        ...variation.adaptedIngredients,
        ...variation.addedIngredients.map(i => `ADD: ${i}`)
      ];
      await onSaveVariation({
        title: `${recipe.title} (${variation.name})`,
        description: variation.description,
        ingredients: fullIngredients,
        instructions: getItemTexts(recipe.instructions)
      });
      onClose();
    } catch (err: any) {
      error = err.message || 'Failed to save variation';
    } finally {
      saving = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose} aria-hidden="true">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="variations-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div>
        <h3 id="variations-title">Recipe Variations</h3>
        <p class="recipe-name">{recipe.title}</p>
      </div>
      <button class="btn-close" onclick={onClose} aria-label="Close modal">&times;</button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="loading-state">
          <span class="spinner"></span>
          <p>Creating variations...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
          <AIButton onclick={loadVariations} label="Try Again" variant="subtle" />
        </div>
      {:else if variations.length === 0}
        <div class="empty-state">
          <p>No variations could be generated.</p>
        </div>
      {:else}
        <div class="variations-grid">
          {#each variations as variation, index}
            <div class="variation-card" class:selected={selectedVariation?.name === variation.name}>
              <button class="variation-header" onclick={() => selectedVariation = selectedVariation?.name === variation.name ? null : variation}>
                <div class="variation-name">{variation.name}</div>
                <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              
              {#if selectedVariation?.name === variation.name}
                <div class="variation-details">
                  <p class="variation-description">{variation.description}</p>
                  
                  {#if variation.keyChanges.length > 0}
                    <div class="detail-section">
                      <h4>Key Changes</h4>
                      <ul class="change-list">
                        {#each variation.keyChanges as change}
                          <li>{change}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                  
                  {#if variation.addedIngredients.length > 0}
                    <div class="detail-section">
                      <h4>Add</h4>
                      <ul class="ingredient-list added">
                        {#each variation.addedIngredients as ingredient}
                          <li>+ {ingredient}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                  
                  {#if variation.removedIngredients.length > 0}
                    <div class="detail-section">
                      <h4>Remove</h4>
                      <ul class="ingredient-list removed">
                        {#each variation.removedIngredients as ingredient}
                          <li>- {ingredient}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                  
                  <button class="btn-save" onclick={() => handleSaveVariation(variation)} disabled={saving}>
                    {saving ? 'Saving...' : 'Save as New Recipe'}
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <AIBadge />
      <button class="btn-secondary" onclick={onClose}>Close</button>
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
  }

  .loading-state,
  .error-state,
  .empty-state {
    text-align: center;
    padding: var(--spacing-6);
    color: var(--color-text-light);
  }

  .loading-state .spinner {
    display: block;
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto var(--spacing-3);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-state {
    color: var(--color-error);
  }

  .variations-grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .variation-card {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 2px solid transparent;
    transition: var(--transition-fast);
  }

  .variation-card.selected {
    border-color: var(--color-primary);
  }

  .variation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--spacing-3) var(--spacing-4);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .variation-name {
    font-weight: 600;
    font-size: var(--text-base);
    color: var(--color-text);
  }

  .chevron {
    width: 20px;
    height: 20px;
    color: var(--color-text-light);
    transition: transform 0.2s;
  }

  .variation-card.selected .chevron {
    transform: rotate(180deg);
  }

  .variation-details {
    padding: 0 var(--spacing-4) var(--spacing-4);
    border-top: 1px solid var(--color-border);
    margin-top: var(--spacing-2);
    padding-top: var(--spacing-3);
  }

  .variation-description {
    margin: 0 0 var(--spacing-3);
    font-size: var(--text-sm);
    color: var(--color-text-light);
    line-height: 1.5;
  }

  .detail-section {
    margin-bottom: var(--spacing-3);
  }

  .detail-section h4 {
    margin: 0 0 var(--spacing-1);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-light);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .change-list,
  .ingredient-list {
    margin: 0;
    padding-left: var(--spacing-4);
    font-size: var(--text-sm);
  }

  .change-list li,
  .ingredient-list li {
    margin-bottom: var(--spacing-1);
  }

  .ingredient-list.added li {
    color: var(--color-success);
  }

  .ingredient-list.removed li {
    color: var(--color-error);
  }

  .btn-save {
    width: 100%;
    margin-top: var(--spacing-3);
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-save:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3) var(--spacing-5);
    border-top: 1px solid var(--color-border);
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
