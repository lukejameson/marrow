<script lang="ts">
  import { tick } from 'svelte';
  import { apiClient } from '$lib/api/client';
  import Markdown from '$lib/components/Markdown.svelte';
  import type { RecipeItemList } from '$lib/server/db/schema';

  interface TweakRecipe {
    title: string;
    description?: string;
    ingredients: RecipeItemList | string[];
    instructions: RecipeItemList | string[];
    prepTime?: number;
    cookTime?: number;
    servings?: number;
  }

  interface RewrittenRecipe {
    title: string;
    description?: string;
    ingredients: string[];
    instructions: string[];
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    tags?: string[];
  }

  interface Message {
    role: 'user' | 'assistant';
    content: string;
  }

  let {
    recipe,
    onApply,
    onClose,
  }: {
    recipe: TweakRecipe;
    onApply: (rewritten: RewrittenRecipe) => void;
    onClose: () => void;
  } = $props();

  const QUICK_PILLS = [
    { label: 'Make it veggie 🌱', prompt: 'Make this recipe vegetarian.' },
    { label: 'Halve it', prompt: 'Halve this recipe to 2 servings.' },
    { label: 'Simplify', prompt: 'Simplify this recipe — fewer ingredients and steps.' },
  ];

  let messages = $state<Message[]>([]);
  let inputValue = $state('');
  let sending = $state(false);
  let error = $state('');
  let pendingRecipe = $state<RewrittenRecipe | null>(null);
  let applied = $state(false);
  let container: HTMLDivElement;

  function flattenItems(items: RecipeItemList | string[] | undefined): string[] {
    if (Array.isArray(items)) return items;
    if (items?.items) {
      return items.items.map((i) => (i.isHeader ? `## ${i.text}` : i.text));
    }
    return [];
  }

  async function scrollToBottom() {
    await tick();
    if (container) container.scrollTop = container.scrollHeight;
  }

  function usePill(prompt: string) {
    inputValue = prompt;
    send(prompt);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    inputValue = '';
    error = '';
    pendingRecipe = null;
    applied = false;

    const userMsg: Message = { role: 'user', content };
    messages = [...messages, userMsg];
    sending = true;
    scrollToBottom();

    try {
      const result = await apiClient.recipeChat({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        referencedRecipes: [
          {
            id: 'import-draft',
            title: recipe.title,
            description: recipe.description,
            ingredients: flattenItems(recipe.ingredients),
            instructions: flattenItems(recipe.instructions),
          },
        ],
      });

      messages = [...messages, { role: 'assistant', content: result.message || 'Done.' }];
      if (result.recipe) {
        pendingRecipe = result.recipe;
      }
    } catch (err: any) {
      error = err.message || 'Failed to get a response';
    } finally {
      sending = false;
      scrollToBottom();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(inputValue);
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }

  function apply() {
    if (!pendingRecipe) return;
    applied = true;
    onApply(pendingRecipe);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="backdrop" onclick={onClose} aria-hidden="true"></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label="Tweak recipe">
  <div class="sheet-header">
    <div>
      <h3>Tweak with AI</h3>
      <p class="recipe-name">{recipe.title}</p>
    </div>
    <button class="btn-close" onclick={onClose} aria-label="Close">&times;</button>
  </div>

  <div class="messages" bind:this={container}>
    {#if messages.length === 0}
      <div class="empty">
        <p>Ask for any tweak — e.g. "make it veggie", "halve it", or "swap the beef for lentils".</p>
      </div>
    {:else}
      {#each messages as msg}
        <div class="msg {msg.role}">
          <div class="bubble">
            {#if msg.role === 'assistant'}
              <Markdown content={msg.content} />
            {:else}
              {msg.content}
            {/if}
          </div>
        </div>
      {/each}
    {/if}

    {#if sending}
      <div class="msg assistant">
        <div class="bubble typing">Thinking…</div>
      </div>
    {/if}

    {#if error}
      <div class="error">{error}</div>
    {/if}

    {#if pendingRecipe && !applied}
      <div class="apply-bar">
        <span>Updated recipe ready</span>
        <button class="btn-apply" onclick={apply}>Apply changes</button>
      </div>
    {/if}
    {#if applied}
      <div class="apply-bar applied">✓ Applied</div>
    {/if}
  </div>

  <div class="pills">
    {#each QUICK_PILLS as pill}
      <button
        type="button"
        class="pill"
        onclick={() => usePill(pill.prompt)}
        disabled={sending}
      >
        {pill.label}
      </button>
    {/each}
  </div>

  <div class="input-row">
    <textarea
      rows="1"
      placeholder="Ask to tweak this recipe…"
      bind:value={inputValue}
      onkeydown={handleKeydown}
      disabled={sending}
    ></textarea>
    <button class="btn-send" onclick={() => send(inputValue)} disabled={sending || !inputValue.trim()}>
      Send
    </button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 900;
  }

  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 901;
    background: var(--color-surface);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
    margin: 0 auto;
  }

  @media (min-width: 640px) {
    .sheet {
      left: 50%;
      right: auto;
      bottom: 2rem;
      transform: translateX(-50%);
      width: 560px;
      max-width: calc(100vw - 2rem);
      border-radius: var(--radius-xl);
    }
  }

  .sheet-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--spacing-4) var(--spacing-5);
    border-bottom: 1px solid var(--color-border);
  }

  .sheet-header h3 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .recipe-name {
    margin: var(--spacing-1) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-light);
  }

  .btn-close {
    background: none;
    border: none;
    font-size: var(--text-xl);
    color: var(--color-text-light);
    cursor: pointer;
    line-height: 1;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-4) var(--spacing-5);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    min-height: 160px;
  }

  .empty {
    text-align: center;
    color: var(--color-text-light);
    font-size: var(--text-sm);
    padding: var(--spacing-6) 0;
  }

  .msg {
    display: flex;
  }

  .msg.user {
    justify-content: flex-end;
  }

  .bubble {
    max-width: 85%;
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    line-height: 1.5;
    word-break: break-word;
  }

  .msg.user .bubble {
    background: var(--color-primary);
    color: white;
    border-bottom-right-radius: var(--radius-sm);
  }

  .msg.assistant .bubble {
    background: var(--color-bg-subtle);
    color: var(--color-text);
    border-bottom-left-radius: var(--radius-sm);
  }

  .bubble.typing {
    color: var(--color-text-light);
    font-style: italic;
  }

  .error {
    color: var(--color-error);
    font-size: var(--text-sm);
  }

  .apply-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-3);
    padding: var(--spacing-3) var(--spacing-4);
    background: rgba(107, 158, 124, 0.12);
    border: 1px solid var(--color-success);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
  }

  .apply-bar.applied {
    color: var(--color-success);
    font-weight: 500;
  }

  .btn-apply {
    background: var(--color-success);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    padding: var(--spacing-2) var(--spacing-4);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .pills {
    display: flex;
    gap: var(--spacing-2);
    padding: 0 var(--spacing-4) var(--spacing-2);
    overflow-x: auto;
    flex-shrink: 0;
  }

  .pill {
    white-space: nowrap;
    padding: var(--spacing-2) var(--spacing-3);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    cursor: pointer;
    color: var(--color-text-secondary);
    transition: var(--transition-fast);
  }

  .pill:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .pill:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input-row {
    display: flex;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-4);
    padding-bottom: calc(var(--spacing-4) + env(safe-area-inset-bottom));
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .input-row textarea {
    flex: 1;
    resize: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--text-base);
    font-family: inherit;
    min-height: 44px;
    max-height: 120px;
  }

  .btn-send {
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    padding: 0 var(--spacing-4);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
