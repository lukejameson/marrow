<script lang="ts">
	interface Model {
		id: string;
		name: string;
		maker: string;
		contextWindow?: number;
		supportsVision?: boolean;
	}

	interface Props {
		models: Model[];
		value: string;
		onselect: (modelId: string) => void;
		placeholder?: string;
	}

	let { models, value, onselect, placeholder = 'Search models...' }: Props = $props();

	let searchQuery = $state('');
	let isOpen = $state(false);
	let highlightedIndex = $state(-1);
	let containerEl: HTMLDivElement;

	const filteredModels = $derived(() => {
		if (!searchQuery.trim()) {
			return [...models].sort((a, b) => (a.maker || '').localeCompare(b.maker || '') || a.name.localeCompare(b.name));
		}
		const query = searchQuery.toLowerCase();
		return models
			.filter(m =>
				m.name.toLowerCase().includes(query) ||
				(m.maker || '').toLowerCase().includes(query) ||
				m.id.toLowerCase().includes(query)
			)
			.sort((a, b) => (a.maker || '').localeCompare(b.maker || '') || a.name.localeCompare(b.name));
	});

	const selectedModel = $derived(models.find(m => m.id === value));

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen) {
			if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
				isOpen = true;
				e.preventDefault();
			}
			return;
		}
		switch (e.key) {
			case 'Escape':
				isOpen = false;
				searchQuery = '';
				break;
			case 'ArrowDown':
				highlightedIndex = Math.min(highlightedIndex + 1, filteredModels().length - 1);
				e.preventDefault();
				break;
			case 'ArrowUp':
				highlightedIndex = Math.max(highlightedIndex - 1, 0);
				e.preventDefault();
				break;
			case 'Enter':
				if (highlightedIndex >= 0 && filteredModels()[highlightedIndex]) {
					selectModel(filteredModels()[highlightedIndex].id);
				}
				e.preventDefault();
				break;
		}
	}

	function selectModel(modelId: string) {
		onselect(modelId);
		isOpen = false;
		searchQuery = '';
		highlightedIndex = -1;
	}

	function handleClickOutside(e: MouseEvent) {
		if (containerEl && !containerEl.contains(e.target as Node)) {
			isOpen = false;
			searchQuery = '';
		}
	}

	$effect(() => {
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="searchable-select" bind:this={containerEl}>
	<button
		type="button"
		class="select-trigger"
		class:open={isOpen}
		onclick={() => { isOpen = !isOpen; }}
		onkeydown={handleKeydown}
		aria-haspopup="listbox"
		aria-expanded={isOpen}
	>
		<span class="selected-value">
			{#if selectedModel}
				<span class="model-name">{selectedModel.name}</span>
				<span class="model-maker">{selectedModel.maker}</span>
			{:else}
				<span class="placeholder">{placeholder}</span>
			{/if}
		</span>
		<span class="chevron" class:rotated={isOpen}>
			<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
				<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		</span>
	</button>

	{#if isOpen}
		<div class="dropdown-panel" role="listbox">
			<div class="search-wrapper">
				<input
					type="text"
					class="search-input"
					placeholder={placeholder}
					bind:value={searchQuery}
					onkeydown={handleKeydown}
				/>
			</div>
			<div class="models-list">
				{#each filteredModels() as model, index}
					<button
						type="button"
						class="model-option"
						class:highlighted={index === highlightedIndex}
						class:selected={model.id === value}
						onclick={() => selectModel(model.id)}
						onmouseenter={() => highlightedIndex = index}
						role="option"
						aria-selected={model.id === value}
					>
						<span class="model-info">
							<span class="model-name">{model.name}</span>
							<span class="model-maker">{model.maker}</span>
						</span>
						{#if model.id === value}
							<span class="check">✓</span>
						{/if}
					</button>
				{:else}
					<div class="no-results">No models found</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.searchable-select {
		position: relative;
		width: 100%;
	}

	.select-trigger {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: var(--input-bg, #fff);
		border: 1px solid var(--border-color, #d1d5db);
		border-radius: 0.375rem;
		cursor: pointer;
		font-size: 0.875rem;
		text-align: left;
		min-height: 42px;
	}

	.select-trigger:hover {
		border-color: var(--border-hover, #9ca3af);
	}

	.select-trigger.open {
		border-color: var(--primary, #3b82f6);
		box-shadow: 0 0 0 1px var(--primary, #3b82f6);
	}

	.selected-value {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex: 1;
		min-width: 0;
	}

	.model-name {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.model-maker {
		font-size: 0.75rem;
		color: var(--text-muted, #6b7280);
	}

	.placeholder {
		color: var(--text-muted, #6b7280);
	}

	.chevron {
		flex-shrink: 0;
		color: var(--text-muted, #6b7280);
		transition: transform 0.15s ease;
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	.dropdown-panel {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: 0.25rem;
		background: var(--input-bg, #fff);
		border: 1px solid var(--border-color, #d1d5db);
		border-radius: 0.375rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		z-index: 50;
		max-height: 320px;
		display: flex;
		flex-direction: column;
	}

	.search-wrapper {
		padding: 0.5rem;
		border-bottom: 1px solid var(--border-color, #e5e7eb);
	}

	.search-input {
		width: 100%;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--border-color, #d1d5db);
		border-radius: 0.25rem;
		font-size: 0.875rem;
		outline: none;
	}

	.search-input:focus {
		border-color: var(--primary, #3b82f6);
		box-shadow: 0 0 0 1px var(--primary, #3b82f6);
	}

	.models-list {
		overflow-y: auto;
		max-height: 240px;
	}

	.model-option {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.75rem;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		font-size: 0.875rem;
		gap: 0.5rem;
	}

	.model-option:hover,
	.model-option.highlighted {
		background: var(--bg-hover, #f3f4f6);
	}

	.model-option.selected {
		background: var(--primary-light, #eff6ff);
	}

	.model-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex: 1;
		min-width: 0;
	}

	.check {
		color: var(--primary, #3b82f6);
		font-weight: 600;
	}

	.no-results {
		padding: 1rem;
		text-align: center;
		color: var(--text-muted, #6b7280);
		font-size: 0.875rem;
	}
</style>
