<script setup lang="ts">
import type { CampaignLogEntry, PaginatedResponse } from '~/types/api';

const logs = ref<CampaignLogEntry[]>([]);
const loading = ref(true);
const errorMessage = ref('');

const socket = useSocket();

async function loadLogs() {
  loading.value = true;
  errorMessage.value = '';

  try {
    const response = await useApi<PaginatedResponse<CampaignLogEntry>>(
      '/campaigns/log?page=1&pageSize=50',
    );
    logs.value = response.items;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load campaign log';
  } finally {
    loading.value = false;
  }
}

function handleCampaignUpdate(entry: CampaignLogEntry) {
  logs.value.unshift(entry);
  logs.value = logs.value.slice(0, 60);
}

onMounted(async () => {
  await loadLogs();

  if (!socket) {
    return;
  }

  socket.emit('join:campaigns');
  socket.on('campaign:updated', handleCampaignUpdate);
});

onBeforeUnmount(() => {
  if (!socket) {
    return;
  }

  socket.emit('leave:campaigns');
  socket.off('campaign:updated', handleCampaignUpdate);
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
</script>

<template>
  <section class="campaigns">
    <div class="hero">
      <div>
        <p class="eyebrow">Phase 11.6</p>
        <h1>Campaign activity</h1>
        <p class="lede">
          Background campaign enrollment and removal activity, persisted in MongoDB and streamed to
          the UI.
        </p>
      </div>
      <button class="ghost" type="button" @click="loadLogs">Refresh</button>
    </div>

    <p v-if="errorMessage" class="notice notice--error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="notice">Loading campaign log…</p>

    <div v-else class="log-grid">
      <article v-for="entry in logs" :key="entry.id" class="log-card">
        <div class="log-card__head">
          <strong>{{ entry.segmentName }}</strong>
          <span>{{ formatDate(entry.evaluatedAt) }}</span>
        </div>
        <p>{{ entry.message }}</p>
        <div class="log-card__meta">
          <span>Added: {{ entry.addedCount }}</span>
          <span>Removed: {{ entry.removedCount }}</span>
          <span>Total: {{ entry.totalCount }}</span>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.campaigns {
  display: grid;
  gap: 1rem;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: end;
}

.eyebrow {
  margin: 0 0 0.35rem;
  color: #761ae8;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 0.78rem;
}

.hero h1,
.hero p {
  margin: 0;
}

.lede {
  margin-top: 0.45rem !important;
  color: #64748b;
}

.ghost,
.notice,
.log-card {
  border-radius: 1.25rem;
}

.ghost {
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: white;
  padding: 0.8rem 1rem;
  cursor: pointer;
}

.notice {
  margin: 0;
  padding: 0.9rem 1rem;
  background: white;
}

.notice--error {
  color: #b91c1c;
}

.log-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.log-card {
  padding: 1rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.94));
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 20px 42px rgba(15, 23, 42, 0.08);
}

.log-card__head,
.log-card__meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.log-card__head span,
.log-card__meta span {
  color: #64748b;
}

.log-card p {
  color: #334155;
  line-height: 1.5;
}

@media (max-width: 720px) {
  .hero {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
