<script lang="ts">
  import { goto } from '$app/navigation';
  import { apiClient } from '$lib/api/client';
  import Header from '$lib/components/Header.svelte';
  import AIButton from '$lib/components/ai/AIButton.svelte';
  import AIBadge from '$lib/components/ai/AIBadge.svelte';
  import { getItemTexts } from '$lib/utils/recipe-helpers';
  import { authStore } from '$lib/stores/auth.svelte';

  let hasPhotoExtraction = $derived(authStore.user?.featureFlags?.photoExtraction ?? false);
  let hasRecipeGeneration = $derived(authStore.user?.featureFlags?.recipeGeneration ?? false);

  interface MatchedRecipe {
    recipeId: string;
    matchScore: number;
    matchedIngredients: string[];
    missingIngredients: string[];
    recipe?: {
      id: string;
      title: string;
      imageUrl?: string;
      prepTime?: number;
      cookTime?: number;
    };
  }

  let ingredientsInput = $state('');
  let loading = $state(false);
  let error = $state('');
  let matches = $state<MatchedRecipe[]>([]);
  let hasSearched = $state(false);

  interface DetectedItem {
    name: string;
    category: string;
  }

  let detectedItems = $state<DetectedItem[]>([]);
  let scanning = $state(false);
  let scanError = $state('');
  let newDetectedItem = $state('');

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });
  }

  async function handleScanFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    scanning = true;
    scanError = '';
    error = '';
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await apiClient.detectIngredients([dataUrl]);
      detectedItems = result.ingredients.map((i) => ({ name: i.name, category: i.category }));
      if (detectedItems.length === 0) {
        scanError = 'No food items detected. Try a clearer photo.';
      }
    } catch (err: any) {
      scanError = err.message || 'Failed to detect ingredients';
    } finally {
      scanning = false;
      input.value = '';
    }
  }

  function removeDetectedItem(index: number) {
    detectedItems = detectedItems.filter((_, i) => i !== index);
  }

  function addDetectedItem() {
    const name = newDetectedItem.trim();
    if (!name) return;
    detectedItems = [...detectedItems, { name, category: 'other' }];
    newDetectedItem = '';
  }

  function clearDetected() {
    detectedItems = [];
  }

  let generating = $state(false);
  let generatedRecipes = $state<any[]>([]);
  let genError = $state('');
  let savingToPantry = $state(false);
  let pantrySaveMsg = $state('');

  async function handleGenerate() {
    const ingredients = getSearchIngredients();
    if (ingredients.length === 0) {
      genError = 'Add or detect some ingredients first';
      return;
    }
    generating = true;
    genError = '';
    generatedRecipes = [];
    const angleHints = [
      'a quick and easy weeknight dinner',
      'a healthier, lighter option',
      'a comforting classic',
    ];
    try {
      const results = await Promise.allSettled(
        angleHints.map((hint) =>
          apiClient.generateRecipe(`a recipe using: ${ingredients.join(', ')} — ${hint}`)
        )
      );
      generatedRecipes = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map((r) => r.value.recipe)
        .filter((recipe) => recipe && recipe.title);
      if (generatedRecipes.length === 0) {
        genError = "Couldn't generate any recipes. Please try again.";
      }
    } finally {
      generating = false;
    }
  }

  function pickGeneratedRecipe(recipe: any) {
    try {
      sessionStorage.setItem('generatedRecipe', JSON.stringify(recipe));
    } catch {
      // ignore storage errors
    }
    goto('/recipe/new');
  }

  async function handleSaveToPantry() {
    if (detectedItems.length === 0) return;
    savingToPantry = true;
    pantrySaveMsg = '';
    try {
      for (const item of detectedItems) {
        const name = item.name.trim();
        if (!name) continue;
        await apiClient.addPantryItem({
          ingredient: name.toLowerCase(),
          displayName: name,
          category: item.category,
        });
      }
      pantrySaveMsg = 'Saved to pantry';
    } catch (err: any) {
      pantrySaveMsg = err.message || 'Failed to save to pantry';
    } finally {
      savingToPantry = false;
    }
  }

  function getSearchIngredients(): string[] {
    if (detectedItems.length > 0) {
      return detectedItems.map((d) => d.name.trim()).filter(Boolean);
    }
    return ingredientsInput
      .split(/[,\n]/)
      .map((i) => i.trim())
      .filter(Boolean);
  }

  async function handleSearch() {
    const ingredients = getSearchIngredients();

    if (ingredients.length === 0) {
      error = 'Please enter at least one ingredient';
      return;
    }

    loading = true;
    error = '';
    matches = [];

    try {
      // First, get all recipes
      const allRecipes = await apiClient.getRecipes({
        sortBy: 'date-newest',
      });

      if (allRecipes.length === 0) {
        error = 'No recipes found in your collection';
        loading = false;
        hasSearched = true;
        return;
      }

      // Pre-filter recipes by keyword matching (reduces AI API calls)
      const lowerIngredients = ingredients.map((i) => i.toLowerCase());
      const candidateRecipes = allRecipes
        .map((r: any) => {
          const ingredientTexts = getItemTexts(r.ingredients);
          return {
            id: r.id,
            title: r.title,
            ingredients: ingredientTexts,
            imageUrl: r.imageUrl,
            prepTime: r.prepTime,
            cookTime: r.cookTime,
            // Simple keyword match score for pre-filtering
            preScore: ingredientTexts.filter((ing: string) =>
              lowerIngredients.some((li) => ing.toLowerCase().includes(li))
            ).length,
          };
        })
        .filter((r: any) => r.preScore > 0)
        .sort((a: any, b: any) => b.preScore - a.preScore)
        .slice(0, 50); // Top 50 candidates for AI scoring

      if (candidateRecipes.length === 0) {
        // No keyword matches, try AI on a smaller sample
        const sampleRecipes = allRecipes.slice(0, 30).map((r: any) => ({
          id: r.id,
          title: r.title,
          ingredients: getItemTexts(r.ingredients),
          imageUrl: r.imageUrl,
          prepTime: r.prepTime,
          cookTime: r.cookTime,
        }));

        const aiMatches = await apiClient.findMatchingRecipes({
          availableIngredients: ingredients,
          recipes: sampleRecipes.map((r: any) => ({
            id: r.id,
            title: r.title,
            ingredients: r.ingredients,
          })),
        });

        matches = aiMatches
          .filter((m: any) => m.matchScore > 20)
          .map((m: any) => ({
            ...m,
            recipe: sampleRecipes.find((r: any) => r.id === m.recipeId),
          }));
      } else {
        // Use AI to score the pre-filtered candidates
        const aiMatches = await apiClient.findMatchingRecipes({
          availableIngredients: ingredients,
          recipes: candidateRecipes.map((r: any) => ({
            id: r.id,
            title: r.title,
            ingredients: r.ingredients,
          })),
        });

        matches = aiMatches
          .filter((m: any) => m.matchScore > 20)
          .map((m: any) => ({
            ...m,
            recipe: candidateRecipes.find((r: any) => r.id === m.recipeId),
          }));
      }

      hasSearched = true;
    } catch (err: any) {
      error = err.message || 'Failed to find matches';
    } finally {
      loading = false;
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'partial';
    return 'low';
  }

  function formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
</script>

<Header />

<main>
  <div class="container">
    <div class="page-header">
      <h1>What Can I Make?</h1>
      <p class="subtitle">Enter ingredients you have and find matching recipes</p>
    </div>

    <div class="input-section">
      {#if hasPhotoExtraction}
        <div class="scan-row">
          <label class="scan-btn" for="fridge-scan-input">
            {scanning ? 'Detecting...' : '📷 Scan fridge'}
          </label>
          <input
            id="fridge-scan-input"
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden-input"
            onchange={handleScanFile}
          />
        </div>
      {/if}

      {#if scanError}
        <p class="error">{scanError}</p>
      {/if}

      {#if detectedItems.length > 0}
        <div class="detected-section">
          <div class="detected-header">
            <span>Detected items — edit if needed</span>
            <button type="button" class="clear-detected" onclick={clearDetected}>Clear</button>
          </div>
          <div class="detected-list">
            {#each detectedItems as item, i}
              <div class="detected-item">
                <input bind:value={item.name} aria-label="Detected item" />
                <span class="detected-category">{item.category}</span>
                <button type="button" class="remove-item" onclick={() => removeDetectedItem(i)} aria-label="Remove">×</button>
              </div>
            {/each}
          </div>
          <div class="add-item-row">
            <input bind:value={newDetectedItem} placeholder="Add another item" />
            <button type="button" onclick={addDetectedItem}>Add</button>
          </div>
          <div class="detected-actions">
            <button type="button" class="save-pantry-btn" onclick={handleSaveToPantry} disabled={savingToPantry}>
              {savingToPantry ? 'Saving...' : '💾 Save to pantry'}
            </button>
            {#if pantrySaveMsg}
              <span class="pantry-save-msg">{pantrySaveMsg}</span>
            {/if}
          </div>
        </div>
      {/if}

      <label for="ingredients">Your Ingredients</label>
      <textarea
        id="ingredients"
        bind:value={ingredientsInput}
        placeholder="chicken&#10;garlic&#10;onion&#10;olive oil&#10;lemon"
        rows="6"
      ></textarea>
      <p class="hint">Enter one ingredient per line, or separate with commas</p>

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <AIButton
        onclick={handleSearch}
        {loading}
        label="Find Recipes"
        loadingLabel="Searching..."
        variant="primary"
        size="md"
      />

      {#if hasRecipeGeneration}
        <button
          type="button"
          class="generate-btn"
          onclick={handleGenerate}
          disabled={generating}
        >
          {generating ? 'Generating...' : '✨ Generate new recipes'}
        </button>
      {/if}

      {#if genError}
        <p class="error">{genError}</p>
      {/if}
    </div>

    {#if generatedRecipes.length > 0}
      <div class="generated-section">
        <div class="results-header">
          <h2>Generated recipes — pick one to save</h2>
        </div>
        <div class="generated-list">
          {#each generatedRecipes as recipe}
            <div class="generated-card">
              <div class="generated-details">
                <h3>{recipe.title}</h3>
                {#if recipe.description}
                  <p class="generated-desc">{recipe.description}</p>
                {/if}
                {#if recipe.prepTime || recipe.cookTime}
                  <p class="match-time">
                    {#if recipe.prepTime}Prep: {formatTime(recipe.prepTime)}{/if}
                    {#if recipe.prepTime && recipe.cookTime}•{/if}
                    {#if recipe.cookTime}Cook: {formatTime(recipe.cookTime)}{/if}
                  </p>
                {/if}
              </div>
              <button type="button" class="use-recipe-btn" onclick={() => pickGeneratedRecipe(recipe)}>
                Use this recipe
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if hasSearched}
      <div class="results-section">
        <div class="results-header">
          <h2>
            {#if matches.length > 0}
              Found {matches.length} matching recipe{matches.length !== 1 ? 's' : ''}
            {:else}
              No matches found
            {/if}
          </h2>
          <AIBadge size="md" />
        </div>

        {#if matches.length === 0}
          <p class="no-results">
            Try adding more common ingredients or check your pantry for staples like oil, salt, or garlic.
          </p>
        {:else}
          <div class="matches-list">
            {#each matches as match}
              <button class="match-card" onclick={() => goto(`/recipe/${match.recipeId}`)}>
                <div class="match-score {getScoreColor(match.matchScore)}">
                  {match.matchScore}%
                </div>

                <div class="match-content">
                  {#if match.recipe?.imageUrl}
                    <img src={match.recipe.imageUrl} alt="" class="match-image" />
                  {:else}
                    <div class="match-image-placeholder">🍽️</div>
                  {/if}

                  <div class="match-details">
                    <h3>{match.recipe?.title || 'Unknown Recipe'}</h3>

                    {#if match.recipe?.prepTime || match.recipe?.cookTime}
                      <p class="match-time">
                        {#if match.recipe.prepTime}
                          Prep: {formatTime(match.recipe.prepTime)}
                        {/if}
                        {#if match.recipe.prepTime && match.recipe.cookTime}
                          •
                        {/if}
                        {#if match.recipe.cookTime}
                          Cook: {formatTime(match.recipe.cookTime)}
                        {/if}
                      </p>
                    {/if}

                    <div class="match-ingredients">
                      <div class="matched">
                        <span class="label">Have:</span>
                        <span class="list">{match.matchedIngredients.slice(0, 5).join(', ')}{match.matchedIngredients.length > 5 ? '...' : ''}</span>
                      </div>
                      {#if match.missingIngredients.length > 0}
                        <div class="missing">
                          <span class="label">Need:</span>
                          <span class="list">{match.missingIngredients.slice(0, 3).join(', ')}{match.missingIngredients.length > 3 ? '...' : ''}</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</main>

<style>
  main {
    flex: 1;
    padding: var(--spacing-8) 0;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 var(--spacing-6);
  }

  .page-header {
    text-align: center;
    margin-bottom: var(--spacing-8);
  }

  .page-header h1 {
    font-size: var(--text-3xl);
    font-weight: 700;
    margin: 0 0 var(--spacing-2);
    color: var(--color-text);
  }

  .subtitle {
    color: var(--color-text-light);
    margin: 0;
    font-size: var(--text-lg);
  }

  .input-section {
    background: var(--color-surface);
    padding: var(--spacing-6);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border);
    margin-bottom: var(--spacing-8);
  }

  .input-section label {
    display: block;
    font-weight: 600;
    margin-bottom: var(--spacing-2);
    color: var(--color-text);
  }

  textarea {
    width: 100%;
    padding: var(--spacing-4);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-base);
    font-family: inherit;
    resize: vertical;
    margin-bottom: var(--spacing-2);
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin: 0 0 var(--spacing-4);
  }

  .error {
    color: var(--color-error);
    font-size: var(--text-sm);
    margin: 0 0 var(--spacing-3);
  }

  .results-section {
    background: var(--color-surface);
    padding: var(--spacing-6);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border);
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-4);
    padding-bottom: var(--spacing-4);
    border-bottom: 1px solid var(--color-border);
  }

  .results-header h2 {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 600;
  }

  .no-results {
    text-align: center;
    color: var(--color-text-light);
    padding: var(--spacing-6);
  }

  .matches-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .match-card {
    display: flex;
    align-items: stretch;
    gap: var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
    cursor: pointer;
    transition: var(--transition-fast);
    text-align: left;
    width: 100%;
  }

  .match-card:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .match-score {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 56px;
    font-size: var(--text-lg);
    font-weight: 700;
    border-radius: var(--radius-md);
    padding: var(--spacing-2);
  }

  .match-score.excellent {
    background: rgba(16, 185, 129, 0.1);
    color: var(--color-success);
  }

  .match-score.good {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .match-score.partial {
    background: rgba(245, 158, 11, 0.1);
    color: var(--color-warning);
  }

  .match-score.low {
    background: rgba(156, 163, 175, 0.1);
    color: var(--color-text-light);
  }

  .match-content {
    display: flex;
    gap: var(--spacing-4);
    flex: 1;
    min-width: 0;
  }

  .match-image {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: var(--radius-md);
    flex-shrink: 0;
  }

  .match-image-placeholder {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
    font-size: var(--text-2xl);
    flex-shrink: 0;
  }

  .match-details {
    flex: 1;
    min-width: 0;
  }

  .match-details h3 {
    margin: 0 0 var(--spacing-1);
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .match-time {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    margin: 0 0 var(--spacing-2);
  }

  .match-ingredients {
    font-size: var(--text-xs);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .match-ingredients .label {
    font-weight: 500;
    color: var(--color-text-light);
  }

  .match-ingredients .list {
    color: var(--color-text-secondary);
  }

  .matched .list {
    color: var(--color-success);
  }

  .missing .list {
    color: var(--color-warning);
  }

  .scan-row {
    margin-bottom: var(--spacing-4);
  }

  .scan-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-5);
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .hidden-input {
    display: none;
  }

  .detected-section {
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
    margin-bottom: var(--spacing-4);
  }

  .detected-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-3);
    font-weight: 600;
    font-size: var(--text-sm);
    color: var(--color-text);
  }

  .clear-detected {
    background: none;
    border: none;
    color: var(--color-text-light);
    cursor: pointer;
    font-size: var(--text-sm);
    text-decoration: underline;
  }

  .detected-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .detected-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .detected-item input {
    flex: 1;
    padding: var(--spacing-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .detected-category {
    font-size: var(--text-xs);
    color: var(--color-text-light);
    text-transform: capitalize;
    min-width: 64px;
  }

  .remove-item {
    background: none;
    border: none;
    color: var(--color-text-light);
    cursor: pointer;
    font-size: var(--text-lg);
    padding: 0 var(--spacing-1);
  }

  .add-item-row {
    display: flex;
    gap: var(--spacing-2);
    margin-top: var(--spacing-2);
  }

  .add-item-row input {
    flex: 1;
    padding: var(--spacing-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .add-item-row button {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .detected-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    margin-top: var(--spacing-3);
    flex-wrap: wrap;
  }

  .save-pantry-btn {
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  .save-pantry-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .pantry-save-msg {
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .generate-btn {
    display: block;
    margin-top: var(--spacing-3);
    padding: var(--spacing-3) var(--spacing-5);
    background: var(--color-bg-subtle);
    color: var(--color-text);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-weight: 600;
    cursor: pointer;
  }

  .generate-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .generated-section {
    background: var(--color-surface);
    padding: var(--spacing-6);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border);
    margin-bottom: var(--spacing-8);
  }

  .generated-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .generated-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-4);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
  }

  .generated-details {
    min-width: 0;
  }

  .generated-details h3 {
    margin: 0 0 var(--spacing-1);
    font-size: var(--text-base);
    font-weight: 600;
  }

  .generated-desc {
    margin: 0 0 var(--spacing-1);
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .use-recipe-btn {
    flex-shrink: 0;
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
  }

  @media (max-width: 640px) {
    main {
      padding: var(--spacing-4) 0;
    }

    .container {
      padding: 0 var(--spacing-4);
    }

    .page-header h1 {
      font-size: var(--text-2xl);
    }

    .subtitle {
      font-size: var(--text-base);
    }

    .input-section,
    .results-section {
      padding: var(--spacing-4);
    }

    .match-card {
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .match-score {
      align-self: flex-start;
      min-width: auto;
      padding: var(--spacing-1) var(--spacing-3);
    }

    .match-content {
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .match-image,
    .match-image-placeholder {
      width: 100%;
      height: 120px;
    }
  }
</style>
