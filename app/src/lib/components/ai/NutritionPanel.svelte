<script lang="ts">
  import AIBadge from './AIBadge.svelte';
  import { apiClient } from '$lib/api/client';
  import { getItemTexts } from '$lib/utils/recipe-helpers';
  import type { RecipeItemList } from '$lib/server/db/schema';

  interface NutritionData {
    perServing: {
      calories: number;
      protein: number;
      carbohydrates: number;
      fat: number;
      saturatedFat: number;
      fiber: number;
      sugar: number;
      sodium: number;
      cholesterol: number;
      vitaminA?: number;
      vitaminC?: number;
      calcium?: number;
      iron?: number;
    };
    healthLabels: string[];
    dietaryFlags: string[];
    macrosPercentage: { protein: number; carbs: number; fat: number };
  }

  interface Props {
    recipe: {
      id: string;
      title: string;
      servings?: number;
      ingredients: RecipeItemList;
    };
    onClose: () => void;
  }

  let { recipe, onClose }: Props = $props();
  let loading = $state(true);
  let error = $state('');
  let nutrition = $state<NutritionData | null>(null);
  let saving = $state(false);
  let saved = $state(false);

  $effect(() => {
    loadNutrition();
  });

  async function loadNutrition() {
    loading = true;
    error = '';
    try {
      const result = await apiClient.getDetailedNutrition({
        recipe: {
          title: recipe.title,
          ingredients: getItemTexts(recipe.ingredients)
        },
        servings: recipe.servings || 4
      });
      nutrition = result.nutrition;
    } catch (err: any) {
      error = err.message || 'Failed to calculate nutrition';
    } finally {
      loading = false;
    }
  }

  function getDailyValuePercent(value: number, dailyValue: number): number {
    return Math.round((value / dailyValue) * 100);
  }

  const dailyValues: Record<string, number> = {
    calories: 2000,
    protein: 50,
    carbohydrates: 300,
    fat: 65,
    saturatedFat: 20,
    fiber: 25,
    sugar: 50,
    sodium: 2300,
    cholesterol: 300,
    vitaminA: 900,
    vitaminC: 90,
    calcium: 1300,
    iron: 18
  };

  async function handleSaveNutrition() {
    if (!nutrition || !recipe.id) return;
    saving = true;
    error = '';
    try {
      await apiClient.updateRecipe(recipe.id, {
        nutrition: {
          calories: nutrition.perServing.calories,
          protein: nutrition.perServing.protein,
          carbohydrates: nutrition.perServing.carbohydrates,
          fat: nutrition.perServing.fat,
          saturatedFat: nutrition.perServing.saturatedFat,
          fiber: nutrition.perServing.fiber,
          sugar: nutrition.perServing.sugar,
          sodium: nutrition.perServing.sodium,
          cholesterol: nutrition.perServing.cholesterol
        }
      });
      saved = true;
      setTimeout(() => { saved = false; }, 2000);
    } catch (err: any) {
      error = err.message || 'Failed to save nutrition';
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
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="nutrition-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div>
        <h3 id="nutrition-title">Nutrition Analysis</h3>
        <p class="recipe-name">{recipe.title}</p>
      </div>
      <button class="btn-close" onclick={onClose} aria-label="Close modal">&times;</button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="loading-state">
          <span class="spinner"></span>
          <p>Analyzing nutrition...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
          <button class="btn-retry" onclick={loadNutrition}>Try Again</button>
        </div>
      {:else if !nutrition}
        <div class="empty-state">
          <p>Could not calculate nutrition.</p>
        </div>
      {:else}
        <div class="calories-hero">
          <div class="calories-circle">
            <span class="calories-value">{nutrition.perServing.calories}</span>
            <span class="calories-label">calories</span>
          </div>
          <p class="per-serving">per serving ({recipe.servings || 4} servings)</p>
        </div>

        {#if nutrition.macrosPercentage}
          <div class="macros-section">
            <h4>Macros</h4>
            <div class="macro-bars">
              <div class="macro-bar">
                <div class="macro-header">
                  <span class="macro-name">Protein</span>
                  <span class="macro-value">{nutrition.perServing.protein}g ({nutrition.macrosPercentage.protein}%)</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill protein" style="width: {nutrition.macrosPercentage.protein}%"></div>
                </div>
              </div>
              <div class="macro-bar">
                <div class="macro-header">
                  <span class="macro-name">Carbs</span>
                  <span class="macro-value">{nutrition.perServing.carbohydrates}g ({nutrition.macrosPercentage.carbs}%)</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill carbs" style="width: {nutrition.macrosPercentage.carbs}%"></div>
                </div>
              </div>
              <div class="macro-bar">
                <div class="macro-header">
                  <span class="macro-name">Fat</span>
                  <span class="macro-value">{nutrition.perServing.fat}g ({nutrition.macrosPercentage.fat}%)</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill fat" style="width: {nutrition.macrosPercentage.fat}%"></div>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <div class="nutrients-section">
          <h4>Nutrients</h4>
          <div class="nutrients-grid">
            <div class="nutrient-row">
              <span class="nutrient-name">Saturated Fat</span>
              <div class="nutrient-bar-container">
                <div class="nutrient-bar">
                  <div class="bar-fill sat-fat" style="width: {getDailyValuePercent(nutrition.perServing.saturatedFat, dailyValues.saturatedFat)}%"></div>
                </div>
              </div>
              <span class="nutrient-value">{nutrition.perServing.saturatedFat}g</span>
            </div>
            <div class="nutrient-row">
              <span class="nutrient-name">Fiber</span>
              <div class="nutrient-bar-container">
                <div class="nutrient-bar">
                  <div class="bar-fill fiber" style="width: {getDailyValuePercent(nutrition.perServing.fiber, dailyValues.fiber)}%"></div>
                </div>
              </div>
              <span class="nutrient-value">{nutrition.perServing.fiber}g</span>
            </div>
            <div class="nutrient-row">
              <span class="nutrient-name">Sugar</span>
              <div class="nutrient-bar-container">
                <div class="nutrient-bar">
                  <div class="bar-fill sugar" style="width: {getDailyValuePercent(nutrition.perServing.sugar, dailyValues.sugar)}%"></div>
                </div>
              </div>
              <span class="nutrient-value">{nutrition.perServing.sugar}g</span>
            </div>
            <div class="nutrient-row">
              <span class="nutrient-name">Sodium</span>
              <div class="nutrient-bar-container">
                <div class="nutrient-bar">
                  <div class="bar-fill sodium" style="width: {getDailyValuePercent(nutrition.perServing.sodium, dailyValues.sodium)}%"></div>
                </div>
              </div>
              <span class="nutrient-value">{nutrition.perServing.sodium}mg</span>
            </div>
            <div class="nutrient-row">
              <span class="nutrient-name">Cholesterol</span>
              <div class="nutrient-bar-container">
                <div class="nutrient-bar">
                  <div class="bar-fill cholesterol" style="width: {getDailyValuePercent(nutrition.perServing.cholesterol, dailyValues.cholesterol)}%"></div>
                </div>
              </div>
              <span class="nutrient-value">{nutrition.perServing.cholesterol}mg</span>
            </div>
          </div>
        </div>

        {#if nutrition.perServing.vitaminA || nutrition.perServing.vitaminC || nutrition.perServing.calcium || nutrition.perServing.iron}
          <div class="vitamins-section">
            <h4>Vitamins & Minerals</h4>
            <div class="vitamins-grid">
              {#if nutrition.perServing.vitaminA}
                <div class="vitamin-item">
                  <span class="vitamin-name">Vitamin A</span>
                  <span class="vitamin-value">{nutrition.perServing.vitaminA}% DV</span>
                </div>
              {/if}
              {#if nutrition.perServing.vitaminC}
                <div class="vitamin-item">
                  <span class="vitamin-name">Vitamin C</span>
                  <span class="vitamin-value">{nutrition.perServing.vitaminC}% DV</span>
                </div>
              {/if}
              {#if nutrition.perServing.calcium}
                <div class="vitamin-item">
                  <span class="vitamin-name">Calcium</span>
                  <span class="vitamin-value">{nutrition.perServing.calcium}% DV</span>
                </div>
              {/if}
              {#if nutrition.perServing.iron}
                <div class="vitamin-item">
                  <span class="vitamin-name">Iron</span>
                  <span class="vitamin-value">{nutrition.perServing.iron}% DV</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        {#if nutrition.healthLabels.length > 0}
          <div class="labels-section">
            <h4>Health Labels</h4>
            <div class="health-labels">
              {#each nutrition.healthLabels as label}
                <span class="health-label">{label}</span>
              {/each}
            </div>
          </div>
        {/if}

        {#if nutrition.dietaryFlags.length > 0}
          <div class="flags-section">
            <h4>Dietary Flags</h4>
            <div class="dietary-flags">
              {#each nutrition.dietaryFlags as flag}
                <span class="dietary-flag">{flag.replace(/-/g, ' ')}</span>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>

    <div class="modal-footer">
      <AIBadge />
      <div class="footer-actions">
        {#if nutrition && !saved}
          <button class="btn-save" onclick={handleSaveNutrition} disabled={saving || !recipe.id}>
            {#if saving}
              Saving...
            {:else}
              Save to Recipe
            {/if}
          </button>
        {:else if saved}
          <span class="saved-indicator">Saved!</span>
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

  .btn-retry {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-weight: 500;
    cursor: pointer;
  }

  .calories-hero {
    text-align: center;
    padding: var(--spacing-4);
    background: var(--color-background);
    border-radius: var(--radius-lg);
  }

  .calories-circle {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: var(--color-border);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 0 auto var(--spacing-3);
    position: relative;
  }

  .calories-circle::before {
    content: '';
    position: absolute;
    width: 100px;
    height: 100px;
    background: var(--color-background);
    border-radius: 50%;
  }

  .calories-value {
    position: relative;
    font-size: var(--text-2xl);
    font-weight: 700;
    color: var(--color-text);
  }

  .calories-label {
    position: relative;
    font-size: var(--text-xs);
    color: var(--color-text-light);
  }

  .per-serving {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .macros-section,
  .nutrients-section,
  .vitamins-section,
  .labels-section,
  .flags-section {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-3);
  }

  .macros-section h4,
  .nutrients-section h4,
  .vitamins-section h4,
  .labels-section h4,
  .flags-section h4 {
    margin: 0 0 var(--spacing-3);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-light);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .macro-bars {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .macro-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--spacing-1);
  }

  .macro-name {
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .macro-value {
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .bar-track {
    height: 8px;
    background: var(--color-border);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: var(--radius-full);
    transition: width 0.3s ease;
  }

  .bar-fill.protein { background: var(--color-primary); }
  .bar-fill.carbs { background: var(--color-success); }
  .bar-fill.fat { background: var(--color-warning); }
  .bar-fill.sat-fat { background: var(--color-error); }
  .bar-fill.fiber { background: var(--color-success); }
  .bar-fill.sugar { background: var(--color-warning); }
  .bar-fill.sodium { background: var(--color-error); }
  .bar-fill.cholesterol { background: var(--color-error); }

  .nutrients-grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .nutrient-row {
    display: grid;
    grid-template-columns: 100px 1fr 60px;
    align-items: center;
    gap: var(--spacing-2);
  }

  .nutrient-name {
    font-size: var(--text-sm);
    color: var(--color-text);
  }

  .nutrient-bar-container {
    padding: 4px 0;
  }

  .nutrient-bar {
    height: 6px;
    background: var(--color-border);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .nutrient-value {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    text-align: right;
  }

  .vitamins-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-2);
  }

  .vitamin-item {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-2);
    background: var(--color-surface);
    border-radius: var(--radius-md);
  }

  .vitamin-name {
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .vitamin-value {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text);
  }

  .health-labels {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .health-label {
    font-size: var(--text-xs);
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-success);
    color: white;
    border-radius: var(--radius-full);
    font-weight: 500;
  }

  .dietary-flags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .dietary-flag {
    font-size: var(--text-xs);
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-warning);
    color: white;
    border-radius: var(--radius-full);
    font-weight: 500;
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
    align-items: center;
  }

  .btn-save {
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

  .saved-indicator {
    font-size: var(--text-sm);
    color: var(--color-success);
    font-weight: 500;
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
