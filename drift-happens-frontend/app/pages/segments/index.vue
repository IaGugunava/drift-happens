<script setup lang="ts">
import type { PaginatedResponse, Segment, SegmentDeltaEvent } from '~/types/api';

const segments = ref<Segment[]>([]);
const loading = ref(true);
const errorMessage = ref('');

const socket = useSocket();

async function loadSegments() {
  loading.value = true;
  errorMessage.value = '';

  try {
    const response = await useApi<PaginatedResponse<Segment>>('/segments?page=1&pageSize=100');
    segments.value = response.items;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load segments';
  } finally {
    loading.value = false;
  }
}

function applySegmentUpdate(event: SegmentDeltaEvent) {
  const segment = segments.value.find((entry) => entry.id === event.segmentId);
  if (!segment) {
    return;
  }

  segment.memberCount = event.totalCount;
  segment.lastEvaluatedAt = event.evaluatedAt;
}

onMounted(async () => {
  await loadSegments();

  if (!socket) {
    return;
  }

  socket.on('segment:updated', applySegmentUpdate);

  for (const segment of segments.value) {
    socket.emit('join:segment', segment.id);
  }
});

onBeforeUnmount(() => {
  if (!socket) {
    return;
  }

  socket.off('segment:updated', applySegmentUpdate);

  for (const segment of segments.value) {
    socket.emit('leave:segment', segment.id);
  }
});

function badgeLabel(segment: Segment) {
  if (segment.type === 'static' && segment.frozenAt) {
    return 'STATIC · FROZEN';
  }

  return segment.type.toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
</script>

<template>
  <section class="panel">
    <div class="hero">
      <div>
        <p class="eyebrow">Phase 11.2</p>
        <h1>Segments overview</h1>
        <p class="lede">
          Live counts update as customer activity moves through the debounce, evaluator, and event
          pipeline.
        </p>
      </div>
      <button class="ghost" type="button" @click="loadSegments">Refresh</button>
    </div>

    <p v-if="errorMessage" class="notice notice--error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="notice">Loading segment registry…</p>

    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Members</th>
            <th>Last evaluated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="segment in segments" :key="segment.id">
            <td>
              <strong>{{ segment.name }}</strong>
              <div class="subtle">{{ segment.dependsOnSegments.length }} dependencies</div>
            </td>
            <td>
              <span class="badge">{{ badgeLabel(segment) }}</span>
            </td>
            <td class="count">{{ segment.memberCount }}</td>
            <td>{{ formatDate(segment.lastEvaluatedAt) }}</td>
            <td class="link-cell">
              <NuxtLink class="link" :to="`/segments/${segment.id}`">Open</NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: grid;
  gap: 1.25rem;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: end;
  padding: 1.4rem;
  border-radius: 1.6rem;
  background: linear-gradient(135deg, rgba(26, 0, 64, 0.96), rgba(118, 26, 232, 0.92));
  color: #f8fafc;
  box-shadow: 0 28px 56px rgba(15, 23, 42, 0.18);
}

.eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 0.78rem;
  opacity: 0.7;
}

.hero h1,
.hero p {
  margin: 0;
}

.lede {
  margin-top: 0.5rem !important;
  max-width: 42rem;
  color: rgba(248, 250, 252, 0.76);
}

.ghost {
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.08);
  color: white;
  border-radius: 999px;
  padding: 0.8rem 1rem;
  cursor: pointer;
}

.notice {
  margin: 0;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.notice--error {
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.25);
}

.table-wrap {
  overflow-x: auto;
  border-radius: 1.4rem;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
}

.table th {
  color: #64748b;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.subtle {
  margin-top: 0.3rem;
  color: #94a3b8;
  font-size: 0.82rem;
}

.badge {
  display: inline-flex;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: rgba(118, 26, 232, 0.1);
  color: #761ae8;
  font-size: 0.78rem;
  font-weight: 700;
}

.count {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
}

.link-cell {
  text-align: right;
}

.link {
  font-weight: 700;
  color: #761ae8;
}

@media (max-width: 720px) {
  .hero {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
