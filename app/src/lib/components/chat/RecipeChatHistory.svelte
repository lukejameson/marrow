<script lang="ts">
  import { apiClient } from '$lib/api/client';
  import { MessageSquare, X, Trash2, Clock, ChevronRight } from 'lucide-svelte';
  interface ChatSession {
    id: string;
    title: string;
    isFavorite: boolean;
    lastMessagePreview: string | null;
    messageCount: number;
    createdAt: Date;
    updatedAt: Date;
  }
  interface Props {
    recipeId: string;
    recipeTitle: string;
    onClose: () => void;
    onSessionSelect: (sessionId: string) => void;
    onNewChat: () => void;
  }
  let { recipeId, recipeTitle, onClose, onSessionSelect, onNewChat }: Props = $props();
  let sessions = $state<ChatSession[]>([]);
  let loading = $state(true);
  let deletingId = $state<string | null>(null);
  async function loadSessions() {
    try {
      loading = true;
      sessions = await apiClient.listChatSessions({ recipeId });
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    } finally {
      loading = false;
    }
  }
  async function deleteSession(sessionId: string, event: MouseEvent) {
    event.stopPropagation();
    if (deletingId) return;
    if (!confirm('Delete this chat history?')) return;
    deletingId = sessionId;
    try {
      await apiClient.deleteChatSession(sessionId);
      sessions = sessions.filter(s => s.id !== sessionId);
    } catch (error) {
      console.error('Failed to delete session:', error);
    } finally {
      deletingId = null;
    }
  }
  function formatTimestamp(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function handleSessionClick(sessionId: string) {
    onSessionSelect(sessionId);
  }
  function handleNewChat() {
    onNewChat();
  }
  $effect(() => {
    loadSessions();
  });
</script>
<div class="chat-history-panel">
  <div class="history-header">
    <div class="header-title">
      <MessageSquare size={18} />
      <h3>Chat History</h3>
    </div>
    <button type="button" class="btn-close" onclick={onClose} title="Close">
      <X size={18} />
    </button>
  </div>
  <div class="history-content">
    <button type="button" class="btn-new-chat" onclick={handleNewChat}>
      <span class="new-chat-icon">+</span>
      <span>Start New Chat</span>
    </button>
    {#if loading}
      <div class="loading-sessions">
        {#each [1, 2, 3] as _}
          <div class="session-skeleton"></div>
        {/each}
      </div>
    {:else if sessions.length === 0}
      <div class="empty-state">
        <MessageSquare size={32} />
        <p>No chat history for this recipe</p>
      </div>
    {:else}
      <div class="sessions-list">
        {#each sessions as session (session.id)}
          <div
            class="session-item"
            onclick={() => handleSessionClick(session.id)}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && handleSessionClick(session.id)}
          >
            <div class="session-info">
              <div class="session-title">{session.title}</div>
              {#if session.lastMessagePreview}
                <div class="session-preview">{session.lastMessagePreview}</div>
              {/if}
              <div class="session-meta">
                <Clock size={12} />
                <span>{formatTimestamp(session.updatedAt)}</span>
                <span class="message-count">{session.messageCount} messages</span>
              </div>
            </div>
            <div class="session-actions">
              <button
                type="button"
                class="btn-delete"
                onclick={(e) => deleteSession(session.id, e)}
                disabled={deletingId === session.id}
                title="Delete chat"
              >
                <Trash2 size={14} />
              </button>
              <ChevronRight size={16} class="chevron" />
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
<style>
  .chat-history-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3) var(--spacing-4);
    background: var(--color-bg-subtle);
    border-bottom: 1px solid var(--color-border);
  }
  .header-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    color: var(--color-text);
  }
  .header-title h3 {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
  }
  .btn-close {
    background: none;
    border: none;
    padding: var(--spacing-2);
    cursor: pointer;
    border-radius: var(--radius-md);
    color: var(--color-text-light);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .btn-close:hover {
    background: var(--color-border-light);
    color: var(--color-text);
  }
  .history-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-3);
  }
  .btn-new-chat {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    width: 100%;
    padding: var(--spacing-3);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    margin-bottom: var(--spacing-3);
  }
  .btn-new-chat:hover {
    background: var(--color-primary-dark);
  }
  .new-chat-icon {
    font-size: 18px;
    font-weight: 600;
  }
  .loading-sessions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }
  .session-skeleton {
    height: 72px;
    background: linear-gradient(
      90deg,
      var(--color-background) 25%,
      var(--color-surface) 50%,
      var(--color-background) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-lg);
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-8) var(--spacing-4);
    text-align: center;
    color: var(--color-text-secondary);
    gap: var(--spacing-2);
  }
  .empty-state p {
    margin: 0;
    font-size: var(--text-sm);
  }
  .sessions-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }
  .session-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-3);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: var(--transition-fast);
  }
  .session-item:hover {
    border-color: var(--color-primary);
    background: var(--color-surface);
  }
  .session-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .session-title {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .session-preview {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .session-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    font-size: 11px;
    color: var(--color-text-light);
    margin-top: var(--spacing-1);
  }
  .message-count {
    padding-left: var(--spacing-2);
    border-left: 1px solid var(--color-border);
  }
  .session-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    flex-shrink: 0;
  }
  .btn-delete {
    background: none;
    border: none;
    padding: var(--spacing-1);
    cursor: pointer;
    border-radius: var(--radius-md);
    color: var(--color-text-light);
    opacity: 0;
    transition: var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .session-item:hover .btn-delete {
    opacity: 1;
  }
  .btn-delete:hover {
    color: var(--color-error);
    background: rgba(239, 68, 68, 0.1);
  }
  .btn-delete:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  :global(.chevron) {
    color: var(--color-text-light);
    opacity: 0;
    transition: var(--transition-fast);
  }
  .session-item:hover :global(.chevron) {
    opacity: 1;
  }
</style>
