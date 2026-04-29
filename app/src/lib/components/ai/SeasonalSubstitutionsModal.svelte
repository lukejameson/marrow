<script lang="ts">
  import AIBadge from './AIBadge.svelte';
  import AIButton from './AIButton.svelte';
  import { apiClient } from '$lib/api/client';
  import { getItemTexts } from '$lib/utils/recipe-helpers';
  import type { RecipeItemList } from '$lib/server/db/schema';

  interface Substitution {
    originalIngredient: string;
    seasonalAlternative: string;
    reason: string;
    bestFor: string[];
    swapRatio: string;
    seasonAvailability: string;
  }

  interface SeasonalResult {
    season: string;
    substitutions: Substitution[];
    seasonalIngredients: string[];
    avoidIngredients: string[];
  }

  interface Props {
    recipe: {
      id: string;
      title: string;
      ingredients: RecipeItemList;
    };
    onClose: () => void;
    onApply: (substitutions: Substitution[]) => void;
  }

  let { recipe, onClose, onApply }: Props = $props();
  let loading = $state(true);
  let error = $state('');
  let seasonal = $state<SeasonalResult | null>(null);
  let activeTab = $state<'substitutions' | 'seasonal' | 'avoid'>('substitutions');
  let appliedSubs = $state<Set<number>>(new Set());

  $effect(() => {
    loadSeasonalSubstitutions();
  });

  async function loadSeasonalSubstitutions() {
    loading = true;
    error = '';
    try {
      const result = await apiClient.getSeasonalSubstitutions({
        recipe: {
          title: recipe.title,
          ingredients: getItemTexts(recipe.ingredients)
        }
      });
      seasonal = result.seasonal;
    } catch (err: any) {
      error = err.message || 'Failed to get seasonal substitutions';
    } finally {
      loading = false;
    }
  }

  function toggleSub(index: number) {
    const newSet = new Set(appliedSubs);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    appliedSubs = newSet;
  }

  function handleApplySelected() {
    if (!seasonal) return;
    const selected = seasonal.substitutions.filter((_, i) => appliedSubs.has(i));
    onApply(selected);
  }

  function handleApplyAll() {
    if (!seasonal) return;
    onApply(seasonal.substitutions);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose} aria-hidden="true">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="seasonal-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div>
        <h3 id="seasonal-title">Seasonal Substitutions</h3>
        <p class="recipe-name">{recipe.title}</p>
      </div>
      <button class="btn-close" onclick={onClose} aria-label="Close modal">&times;</button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="loading-state">
          <span class="spinner"></span>
          <p>Finding seasonal alternatives...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
          <AIButton onclick={loadSeasonalSubstitutions} label="Try Again" variant="subtle" />
        </div>
      {:else if !seasonal}
        <div class="empty-state">
          <p>Could not analyze seasonal options.</p>
        </div>
      {:else}
        <div class="season-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          Current Season: <strong>{seasonal.season}</strong>
        </div>

        <div class="tabs">
          <button
            class="tab"
            class:active={activeTab === 'substitutions'}
            onclick={() => activeTab = 'substitutions'}
          >
            Swap These ({seasonal.substitutions.length})
          </button>
          <button
            class="tab"
            class:active={activeTab === 'seasonal'}
            onclick={() => activeTab = 'seasonal'}
          >
            In Season ({seasonal.seasonalIngredients.length})
          </button>
          <button
            class="tab"
            class:active={activeTab === 'avoid'}
            onclick={() => activeTab = 'avoid'}
          >
            Avoid ({seasonal.avoidIngredients.length})
          </button>
        </div>

        <div class="tab-content">
          {#if activeTab === 'substitutions'}
            {#if seasonal.substitutions.length === 0}
              <p class="empty-message">All your ingredients are in season!</p>
            {:else}
              <div class="substitutions-list">
                {#each seasonal.substitutions as sub, index}
                  <button
                    class="sub-card"
                    class:selected={appliedSubs.has(index)}
                    onclick={() => toggleSub(index)}
                    type="button"
                  >
                    <div class="sub-header">
                      <span class="original">{sub.originalIngredient}</span>
                      <span class="arrow">→</span>
                      <span class="alternative">{sub.seasonalAlternative}</span>
                    </div>
                    <p class="sub-reason">{sub.reason}</p>
                    <div class="sub-meta">
                      <span class="meta-item">
                        <span class="meta-label">Ratio:</span> {sub.swapRatio}
                      </span>
                      <span class="meta-item">
                        <span class="meta-label">Availability:</span> {sub.seasonAvailability}
                      </span>
                    </div>
                    {#if sub.bestFor.length > 0}
                      <div class="best-for">
                        {#each sub.bestFor as use}
                          <span class="use-tag">{use}</span>
                        {/each}
                      </div>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          {:else if activeTab === 'seasonal'}
            {#if seasonal.seasonalIngredients.length === 0}
              <p class="empty-message">No specific seasonal recommendations.</p>
            {:else}
              <div class="ingredient-list">
                {#each seasonal.seasonalIngredients as ingredient}
                  <div class="list-item in-season">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    {ingredient}
                  </div>
                {/each}
              </div>
            {/if}
          {:else if activeTab === 'avoid'}
            {#if seasonal.avoidIngredients.length === 0}
              <p class="empty-message">No ingredients to avoid.</p>
            {:else}
              <div class="ingredient-list">
                {#each seasonal.avoidIngredients as ingredient}
                  <div class="list-item avoid">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    {ingredient}
                  </div>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <AIBadge />
      <div class="footer-actions">
        {#if seasonal && seasonal.substitutions.length > 0 && appliedSubs.size > 0}
          <AIButton onclick={handleApplySelected} label={`Apply (${appliedSubs.size})`} variant="primary" />
        {/if}
        {#if seasonal && seasonal.substitutions.length > 0}
          <AIButton onclick={handleApplyAll} label="Apply All" variant="subtle" />
        {/if}
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

  .season-badge {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3);
    background: var(--color-background);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .season-badge svg {
    width: 20px;
    height: 20px;
    color: var(--color-warning);
  }

  .season-badge strong {
    color: var(--color-text);
  }

  .tabs {
    display: flex;
    gap: var(--spacing-1);
    background: var(--color-background);
    padding: var(--spacing-1);
    border-radius: var(--radius-lg);
  }

  .tab {
    flex: 1;
    padding: var(--spacing-2);
    background: none;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    color: var(--color-text-light);
  }

  .tab.active {
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-sm);
  }

  .tab-content {
    flex: 1;
  }

  .empty-message {
    text-align: center;
    padding: var(--spacing-4);
    color: var(--color-text-light);
    font-size: var(--text-sm);
  }

  .substitutions-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .sub-card {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-3);
    cursor: pointer;
    border: 2px solid transparent;
    transition: var(--transition-fast);
  }

  .sub-card:hover {
    border-color: var(--color-border);
  }

  .sub-card.selected {
    border-color: var(--color-primary);
    background: linear-gradient(135deg, var(--color-primary-light) 0%, transparent 50%);
  }

  .sub-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-2);
    flex-wrap: wrap;
  }

  .original {
    font-weight: 600;
    color: var(--color-text);
  }

  .arrow {
    color: var(--color-text-light);
  }

  .alternative {
    font-weight: 600;
    color: var(--color-primary);
  }

  .sub-reason {
    margin: 0 0 var(--spacing-2);
    font-size: var(--text-sm);
    color: var(--color-text-light);
    line-height: 1.5;
  }

  .sub-meta {
    display: flex;
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-2);
  }

  .meta-item {
    font-size: var(--text-xs);
    color: var(--color-text-light);
  }

  .meta-label {
    font-weight: 500;
  }

  .best-for {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-1);
  }

  .use-tag {
    font-size: var(--text-xs);
    padding: 0.125rem 0.5rem;
    background: var(--color-surface);
    border-radius: var(--radius-full);
    color: var(--color-text-light);
  }

  .ingredient-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-background);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .list-item svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .list-item.in-season {
    color: var(--color-success);
  }

  .list-item.avoid {
    color: var(--color-error);
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
