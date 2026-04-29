<script lang="ts">
  import AIBadge from './AIBadge.svelte';
  import AIButton from './AIButton.svelte';
  import { apiClient } from '$lib/api/client';
  import { getItemTexts } from '$lib/utils/recipe-helpers';
  import type { RecipeItemList } from '$lib/server/db/schema';

  interface MealPlan {
    mealName: string;
    mainDish: { name: string; notes: string };
    appetizer: { name: string; description: string; prepTime: number };
    sideDish1: { name: string; description: string; prepTime: number };
    sideDish2: { name: string; description: string; prepTime: number };
    dessert: { name: string; description: string; prepTime: number };
    winePairing: string;
    totalTime: number;
    instructions: string[];
  }

  interface Props {
    mainDish: {
      id: string;
      title: string;
      ingredients: RecipeItemList;
      instructions: RecipeItemList;
      prepTime?: number;
      cookTime?: number;
    };
    onClose: () => void;
  }

  let { mainDish, onClose }: Props = $props();
  let loading = $state(true);
  let error = $state('');
  let mealPlan = $state<MealPlan | null>(null);
  let saving = $state(false);
  let showTimingGuide = $state(false);

  $effect(() => {
    loadMealPlan();
  });

  async function loadMealPlan() {
    loading = true;
    error = '';
    try {
      const result = await apiClient.planMeal({
        mainDish: {
          title: mainDish.title,
          ingredients: getItemTexts(mainDish.ingredients),
          instructions: getItemTexts(mainDish.instructions)
        }
      });
      mealPlan = result.mealPlan;
    } catch (err: any) {
      error = err.message || 'Failed to plan meal';
    } finally {
      loading = false;
    }
  }

  async function handleSaveMealPlan() {
    if (!mealPlan) return;
    saving = true;
    try {
      await apiClient.createCollection(
        mealPlan.mealName,
        `Meal plan featuring ${mainDish.title} with ${mealPlan.appetizer?.name}, ${mealPlan.sideDish1?.name}, ${mealPlan.sideDish2?.name}, and ${mealPlan.dessert?.name}. Wine pairing: ${mealPlan.winePairing || 'None specified'}.`
      );
      onClose();
    } catch (err: any) {
      error = err.message || 'Failed to save meal plan';
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
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="meal-plan-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div>
        <h3 id="meal-plan-title">Meal Plan</h3>
        <p class="recipe-name">{mainDish.title}</p>
      </div>
      <button class="btn-close" onclick={onClose} aria-label="Close modal">&times;</button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="loading-state">
          <span class="spinner"></span>
          <p>Building your meal plan...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
          <AIButton onclick={loadMealPlan} label="Try Again" variant="subtle" />
        </div>
      {:else if !mealPlan}
        <div class="empty-state">
          <p>Could not generate a meal plan.</p>
        </div>
      {:else}
        <div class="meal-plan">
          <div class="meal-header">
            <h4 class="meal-name">{mealPlan.mealName}</h4>
            <div class="total-time">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              {formatTime(mealPlan.totalTime)} total
            </div>
          </div>

          <div class="menu-sections">
            <div class="menu-section">
              <span class="section-label">Appetizer</span>
              <div class="dish-card">
                <div class="dish-name">{mealPlan.appetizer.name}</div>
                <div class="dish-description">{mealPlan.appetizer.description}</div>
                <div class="dish-time">{formatTime(mealPlan.appetizer.prepTime)}</div>
              </div>
            </div>

            <div class="menu-section main">
              <span class="section-label">Main Dish</span>
              <div class="dish-card featured">
                <div class="dish-name">{mealPlan.mainDish.name}</div>
                <div class="dish-notes">{mealPlan.mainDish.notes}</div>
              </div>
            </div>

            <div class="menu-section">
              <span class="section-label">Sides</span>
              <div class="dish-card">
                <div class="dish-name">{mealPlan.sideDish1.name}</div>
                <div class="dish-description">{mealPlan.sideDish1.description}</div>
                <div class="dish-time">{formatTime(mealPlan.sideDish1.prepTime)}</div>
              </div>
              <div class="dish-card">
                <div class="dish-name">{mealPlan.sideDish2.name}</div>
                <div class="dish-description">{mealPlan.sideDish2.description}</div>
                <div class="dish-time">{formatTime(mealPlan.sideDish2.prepTime)}</div>
              </div>
            </div>

            <div class="menu-section">
              <span class="section-label">Dessert</span>
              <div class="dish-card">
                <div class="dish-name">{mealPlan.dessert.name}</div>
                <div class="dish-description">{mealPlan.dessert.description}</div>
                <div class="dish-time">{formatTime(mealPlan.dessert.prepTime)}</div>
              </div>
            </div>
          </div>

          {#if mealPlan.winePairing}
            <div class="wine-section">
              <span class="section-label">Wine Pairing</span>
              <div class="wine-pairing">{mealPlan.winePairing}</div>
            </div>
          {/if}

          {#if mealPlan.instructions.length > 0}
            <div class="instructions-section">
              <button class="instructions-toggle" onclick={() => showTimingGuide = !showTimingGuide}>
                <span>Timing Guide</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:rotated={showTimingGuide}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {#if showTimingGuide}
                <div class="timing-guide">
                  {#each mealPlan.instructions as instruction}
                    <p>{instruction}</p>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <AIBadge />
      <div class="footer-actions">
        {#if mealPlan}
          <AIButton onclick={handleSaveMealPlan} loading={saving} label="Save Meal Plan" variant="primary" />
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

  .meal-plan {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .meal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-3);
  }

  .meal-name {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text);
  }

  .total-time {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    font-size: var(--text-sm);
    color: var(--color-text-light);
    white-space: nowrap;
  }

  .total-time svg {
    width: 16px;
    height: 16px;
  }

  .menu-sections {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .menu-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .menu-section.main .dish-card {
    border: 2px solid var(--color-primary);
    background: linear-gradient(135deg, var(--color-primary-light) 0%, transparent 50%);
  }

  .section-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-light);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .dish-card {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-3);
  }

  .dish-card.featured {
    padding: var(--spacing-4);
  }

  .dish-name {
    font-weight: 600;
    font-size: var(--text-base);
    margin-bottom: var(--spacing-1);
  }

  .dish-description {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin-bottom: var(--spacing-1);
  }

  .dish-notes {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    font-style: italic;
  }

  .dish-time {
    font-size: var(--text-xs);
    color: var(--color-primary);
    font-weight: 500;
  }

  .wine-section {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-3);
  }

  .wine-pairing {
    font-size: var(--text-sm);
    color: var(--color-text);
  }

  .instructions-section {
    border-top: 1px solid var(--color-border);
    padding-top: var(--spacing-3);
  }

  .instructions-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--spacing-2);
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .instructions-toggle svg {
    width: 20px;
    height: 20px;
    color: var(--color-text-light);
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
  .instructions-toggle svg.rotated {
    transform: rotate(180deg);
  }
  .timing-guide {
    margin-top: var(--spacing-3);
    padding: var(--spacing-3);
    background: var(--color-background);
    border-radius: var(--radius-md);
  }
  .timing-guide p {
    margin: 0 0 var(--spacing-2);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .timing-guide p:last-child {
    margin-bottom: 0;
  }
</style>
