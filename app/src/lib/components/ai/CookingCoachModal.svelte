<script lang="ts">
  import AIBadge from './AIBadge.svelte';
  import AIButton from './AIButton.svelte';
  import { apiClient } from '$lib/api/client';
  import { getItemTexts } from '$lib/utils/recipe-helpers';
  import type { RecipeItemList } from '$lib/server/db/schema';

  interface CookingStep {
    stepNumber: number;
    phase: string;
    instruction: string;
    estimatedMinutes: number;
    technique: string;
    tip: string;
    watchFor: string;
    canDoAhead: string;
  }

  interface CookingGuide {
    steps: CookingStep[];
    totalEstimatedTime: number;
    difficulty: string;
    keyTechniques: string[];
    commonMistakes: string[];
    makeAheadTips: string[];
  }

  interface Props {
    recipe: {
      id: string;
      title: string;
      ingredients: RecipeItemList;
      instructions: RecipeItemList;
    };
    onClose: () => void;
  }

  let { recipe, onClose }: Props = $props();
  let loading = $state(true);
  let error = $state('');
  let coaching = $state<CookingGuide | null>(null);
  let currentStepIndex = $state(0);
  let activePhase = $state('all');
  let timerActive = $state(false);
  let timerSeconds = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    loadCookingCoach();
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  });

  async function loadCookingCoach() {
    loading = true;
    error = '';
    try {
      const result = await apiClient.getCookingCoach({
        recipe: {
          title: recipe.title,
          ingredients: getItemTexts(recipe.ingredients),
          instructions: getItemTexts(recipe.instructions)
        }
      });
      coaching = result.coaching;
    } catch (err: any) {
      error = err.message || 'Failed to load cooking guide';
    } finally {
      loading = false;
    }
  }

  function startTimer(minutes: number) {
    if (timerInterval) clearInterval(timerInterval);
    timerSeconds = minutes * 60;
    timerActive = true;
    timerInterval = setInterval(() => {
      timerSeconds--;
      if (timerSeconds <= 0) {
        timerActive = false;
        if (timerInterval) clearInterval(timerInterval);
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerActive = false;
    timerSeconds = 0;
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatMinutes(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  function getPhases(): string[] {
    if (!coaching) return [];
    const phases = new Set(coaching.steps.map(s => s.phase));
    return ['all', ...Array.from(phases)];
  }

  function filteredSteps(): CookingStep[] {
    if (!coaching) return [];
    if (activePhase === 'all') return coaching.steps;
    return coaching.steps.filter(s => s.phase === activePhase);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose} aria-hidden="true">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="coach-title" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div>
        <h3 id="coach-title">Cooking Coach</h3>
        <p class="recipe-name">{recipe.title}</p>
      </div>
      <button class="btn-close" onclick={onClose} aria-label="Close modal">&times;</button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="loading-state">
          <span class="spinner"></span>
          <p>Creating cooking guide...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
          <AIButton onclick={loadCookingCoach} label="Try Again" variant="subtle" />
        </div>
      {:else if !coaching}
        <div class="empty-state">
          <p>Could not generate cooking guide.</p>
        </div>
      {:else}
        <div class="coach-info">
          <div class="info-row">
            <span class="info-label">Total Time:</span>
            <span class="info-value">{formatMinutes(coaching.totalEstimatedTime)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Difficulty:</span>
            <span class="info-value difficulty-{coaching.difficulty}">{coaching.difficulty}</span>
          </div>
        </div>

        {#if coaching.keyTechniques.length > 0}
          <div class="key-techniques">
            <h4>Key Techniques</h4>
            <div class="technique-tags">
              {#each coaching.keyTechniques as technique}
                <span class="technique-tag">{technique}</span>
              {/each}
            </div>
          </div>
        {/if}

        <div class="phase-tabs">
          {#each getPhases() as phase}
            <button
              class="phase-tab"
              class:active={activePhase === phase}
              onclick={() => activePhase = phase}
            >
              {phase === 'all' ? 'All Steps' : phase}
            </button>
          {/each}
        </div>

        <div class="steps-list">
          {#each filteredSteps() as step, index}
            <div class="step-card" class:active={currentStepIndex === coaching.steps.indexOf(step)}>
              <div class="step-header">
                <span class="step-number">Step {step.stepNumber}</span>
                <span class="step-time">{formatMinutes(step.estimatedMinutes)}</span>
              </div>
              
              <p class="step-instruction">{step.instruction}</p>
              
              <div class="step-meta">
                <div class="meta-item">
                  <span class="meta-label">Technique</span>
                  <span class="meta-value">{step.technique}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Pro Tip</span>
                  <span class="meta-value tip">{step.tip}</span>
                </div>
                {#if step.watchFor}
                  <div class="meta-item">
                    <span class="meta-label">Watch For</span>
                    <span class="meta-value warning">{step.watchFor}</span>
                  </div>
                {/if}
                {#if step.canDoAhead}
                  <div class="meta-item">
                    <span class="meta-label">Can Do Ahead</span>
                    <span class="meta-value">{step.canDoAhead}</span>
                  </div>
                {/if}
              </div>

              <button class="btn-timer" onclick={() => startTimer(step.estimatedMinutes)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Start Timer ({formatMinutes(step.estimatedMinutes)})
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    {#if timerActive}
      <div class="timer-bar">
        <div class="timer-display">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          {formatTime(timerSeconds)}
        </div>
        <button class="btn-stop-timer" onclick={stopTimer}>Stop</button>
      </div>
    {/if}

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
    max-height: 90vh;
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

  .coach-info {
    display: flex;
    gap: var(--spacing-4);
    padding: var(--spacing-3);
    background: var(--color-background);
    border-radius: var(--radius-lg);
  }

  .info-row {
    display: flex;
    gap: var(--spacing-2);
  }

  .info-label {
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .info-value {
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .difficulty-easy { color: var(--color-success); }
  .difficulty-medium { color: var(--color-warning); }
  .difficulty-hard { color: var(--color-error); }

  .key-techniques h4 {
    margin: 0 0 var(--spacing-2);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-light);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .technique-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .technique-tag {
    font-size: var(--text-xs);
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-weight: 500;
  }

  .phase-tabs {
    display: flex;
    gap: var(--spacing-1);
    overflow-x: auto;
    padding-bottom: var(--spacing-2);
  }

  .phase-tab {
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: var(--transition-fast);
  }

  .phase-tab.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .steps-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .step-card {
    background: var(--color-background);
    border-radius: var(--radius-lg);
    padding: var(--spacing-4);
    border: 2px solid transparent;
    transition: var(--transition-fast);
  }

  .step-card.active {
    border-color: var(--color-primary);
  }

  .step-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-2);
  }

  .step-number {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .step-time {
    font-size: var(--text-sm);
    color: var(--color-text-light);
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
  }

  .step-time svg {
    width: 14px;
    height: 14px;
  }

  .step-instruction {
    margin: 0 0 var(--spacing-3);
    font-size: var(--text-base);
    line-height: 1.6;
  }

  .step-meta {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-3);
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .meta-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-light);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .meta-value {
    font-size: var(--text-sm);
    color: var(--color-text);
  }

  .meta-value.tip {
    color: var(--color-primary);
  }

  .meta-value.warning {
    color: var(--color-warning);
  }

  .btn-timer {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-timer:hover {
    background: var(--color-border-light);
  }

  .btn-timer svg {
    width: 16px;
    height: 16px;
  }

  .timer-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3) var(--spacing-5);
    background: var(--color-primary);
    color: white;
  }

  .timer-display {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    font-size: var(--text-xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .timer-display svg {
    width: 24px;
    height: 24px;
  }

  .btn-stop-timer {
    padding: var(--spacing-2) var(--spacing-4);
    background: rgba(255,255,255,0.2);
    border: none;
    border-radius: var(--radius-md);
    color: white;
    font-weight: 500;
    cursor: pointer;
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
