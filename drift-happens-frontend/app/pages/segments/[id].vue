<script setup lang="ts">
import type {
  Customer,
  PaginatedResponse,
  Segment,
  SegmentDeltaEvent,
  SegmentEventRecord,
} from '~/types/api';

const route = useRoute();
const segmentId = computed(() => String(route.params.id));

const segment = ref<Segment | null>(null);
const members = ref<Customer[]>([]);
const events = ref<SegmentEventRecord[]>([]);
const loading = ref(true);
const membersLoading = ref(true);
const eventsLoading = ref(true);
const refreshing = ref(false);
const errorMessage = ref('');

const socket = useSocket();

async function loadSegment() {
  segment.value = await useApi<Segment>(`/segments/${segmentId.value}`);
}

async function loadMembers() {
  membersLoading.value = true;

  try {
    const response = await useApi<PaginatedResponse<Customer>>(
      `/segments/${segmentId.value}/members?page=1&pageSize=25`,
    );
    members.value = response.items;
  } finally {
    membersLoading.value = false;
  }
}

async function loadEvents() {
  eventsLoading.value = true;

  try {
    const response = await useApi<PaginatedResponse<SegmentEventRecord>>(
      `/segments/${segmentId.value}/events?page=1&pageSize=20`,
    );
    events.value = response.items;
  } finally {
    eventsLoading.value = false;
  }
}

async function loadPage() {
  loading.value = true;
  errorMessage.value = '';

  try {
    await Promise.all([loadSegment(), loadMembers(), loadEvents()]);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load segment';
  } finally {
    loading.value = false;
  }
}

async function refreshStaticSegment() {
  refreshing.value = true;

  try {
    await useApi(`/segments/${segmentId.value}/refresh`, {
      method: 'POST',
    });
    await loadPage();
  } finally {
    refreshing.value = false;
  }
}

function handleSegmentUpdate(event: SegmentDeltaEvent) {
  if (!segment.value || event.segmentId !== segment.value.id) {
    return;
  }

  segment.value.memberCount = event.totalCount;
  segment.value.lastEvaluatedAt = event.evaluatedAt;
  events.value.unshift({
    id: `${event.segmentId}-${event.evaluatedAt}`,
    segmentId: event.segmentId,
    evaluatedAt: event.evaluatedAt,
    addedIds: event.added,
    removedIds: event.removed,
    addedCount: event.addedCount,
    removedCount: event.removedCount,
    totalCount: event.totalCount,
    triggeredBy: event.triggeredBy,
  });
  void loadMembers();
}

onMounted(async () => {
  await loadPage();

  if (!socket) {
    return;
  }

  socket.emit('join:segment', segmentId.value);
  socket.on('segment:updated', handleSegmentUpdate);
});

onBeforeUnmount(() => {
  if (!socket) {
    return;
  }

  socket.emit('leave:segment', segmentId.value);
  socket.off('segment:updated', handleSegmentUpdate);
});

watch(
  () => segmentId.value,
  async () => {
    if (socket) {
      socket.emit('leave:segment', segmentId.value);
      socket.emit('join:segment', segmentId.value);
    }

    await loadPage();
  },
);

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
  <section class="detail">
    <p v-if="errorMessage" class="notice notice--error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="notice">Loading segment detail…</p>

    <template v-else-if="segment">
      <div class="headline">
        <div>
          <p class="eyebrow">Segment detail</p>
          <h1>{{ segment.name }}</h1>
          <p class="lede">
            {{ segment.type.toUpperCase() }} segment with {{ segment.memberCount }} current members.
          </p>
        </div>

        <button
          v-if="segment.type === 'static'"
          class="action"
          type="button"
          :disabled="refreshing"
          @click="refreshStaticSegment"
        >
          {{ refreshing ? 'Refreshing…' : 'Refresh Segment' }}
        </button>
      </div>

      <div class="stats">
        <article class="stat">
          <span>Members</span>
          <strong>{{ segment.memberCount }}</strong>
        </article>
        <article class="stat">
          <span>Frozen at</span>
          <strong>{{ formatDate(segment.frozenAt) }}</strong>
        </article>
        <article class="stat">
          <span>Last evaluated</span>
          <strong>{{ formatDate(segment.lastEvaluatedAt) }}</strong>
        </article>
      </div>

      <div class="grid">
        <section class="card">
          <h2>Rules</h2>
          <RuleTreeNode :node="segment.rules" />
        </section>

        <section class="card">
          <h2>Delta log</h2>
          <p v-if="eventsLoading" class="subtle">Loading activity…</p>
          <ul v-else class="log-list">
            <li v-for="event in events" :key="event.id">
              <strong>{{ event.addedCount }} added</strong>,
              <strong>{{ event.removedCount }} removed</strong>
              <span>at {{ formatDate(event.evaluatedAt) }}</span>
            </li>
          </ul>
        </section>
      </div>

      <section class="card">
        <h2>Members</h2>
        <p v-if="membersLoading" class="subtle">Loading members…</p>
        <div v-else class="member-grid">
          <article v-for="member in members" :key="member.id" class="member">
            <strong>{{ member.name }}</strong>
            <span>{{ member.email }}</span>
            <span>${{ member.totalSpent.toLocaleString() }}</span>
            <small>Last transaction: {{ formatDate(member.lastTransactionAt) }}</small>
          </article>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.detail {
  display: grid;
  gap: 1.2rem;
}

.headline {
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

.headline h1,
.headline p {
  margin: 0;
}

.lede {
  margin-top: 0.45rem !important;
  color: #64748b;
}

.action,
.notice {
  padding: 0.85rem 1rem;
  border-radius: 1rem;
}

.action {
  border: none;
  background: linear-gradient(135deg, #761ae8, #5a10c0);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.stats,
.grid {
  display: grid;
  gap: 1rem;
}

.stats {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.grid {
  grid-template-columns: 1.2fr 1fr;
}

.stat,
.card {
  border-radius: 1.35rem;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.08);
}

.stat {
  padding: 1rem;
}

.stat span {
  display: block;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.stat strong {
  font-size: 1.05rem;
}

.card {
  padding: 1.1rem;
}

.card h2 {
  margin-top: 0;
}

.log-list {
  padding-left: 1rem;
  display: grid;
  gap: 0.75rem;
}

.member-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.9rem;
}

.member {
  display: grid;
  gap: 0.35rem;
  padding: 0.95rem;
  border-radius: 1rem;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.9), white);
  border: 1px solid rgba(226, 232, 240, 0.9);
}

.member span,
.member small,
.subtle {
  color: #64748b;
}

.notice {
  margin: 0;
  background: white;
}

.notice--error {
  color: #b91c1c;
}

@media (max-width: 900px) {
  .stats,
  .grid {
    grid-template-columns: 1fr;
  }

  .headline {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
