<script setup lang="ts">
import type {
  Customer,
  PaginatedResponse,
  Segment,
  SegmentDeltaEvent,
} from '~/types/api';

const customers = ref<Customer[]>([]);
const segments = ref<Segment[]>([]);
const feed = ref<SegmentDeltaEvent[]>([]);
const loading = ref(true);
const submitting = ref(false);
const notice = ref('');

const transactionForm = reactive({
  customerId: '',
  amount: 120,
});

const timeoutForm = reactive({
  customerId: '',
  daysSinceLastTx: 120,
});

const fieldForm = reactive({
  customerId: '',
  field: 'tags',
  value: 'win-back,priority',
});

const bulkForm = reactive({
  count: 250,
});

const socket = useSocket();

async function loadContext() {
  loading.value = true;

  try {
    const [customerResponse, segmentResponse] = await Promise.all([
      useApi<PaginatedResponse<Customer>>('/customers?page=1&pageSize=200'),
      useApi<PaginatedResponse<Segment>>('/segments?page=1&pageSize=100'),
    ]);

    customers.value = customerResponse.items;
    segments.value = segmentResponse.items;

    if (!transactionForm.customerId && customers.value[0]) {
      transactionForm.customerId = customers.value[0].id;
      timeoutForm.customerId = customers.value[0].id;
      fieldForm.customerId = customers.value[0].id;
    }
  } finally {
    loading.value = false;
  }
}

function handleSegmentUpdate(event: SegmentDeltaEvent) {
  feed.value.unshift(event);
  feed.value = feed.value.slice(0, 25);
}

async function submit(path: string, body: object) {
  submitting.value = true;
  notice.value = '';

  try {
    await useApi(path, {
      method: 'POST',
      body,
    });
    notice.value = 'Simulation submitted.';
    await loadContext();
  } catch (error) {
    notice.value = error instanceof Error ? error.message : 'Request failed';
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await loadContext();

  if (!socket) {
    return;
  }

  socket.on('segment:updated', handleSegmentUpdate);

  for (const segment of segments.value) {
    socket.emit('join:segment', segment.id);
  }
});

onBeforeUnmount(() => {
  if (!socket) {
    return;
  }

  socket.off('segment:updated', handleSegmentUpdate);

  for (const segment of segments.value) {
    socket.emit('leave:segment', segment.id);
  }
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
</script>

<template>
  <section class="simulation">
    <div class="hero">
      <div>
        <p class="eyebrow">Phase 11.5</p>
        <h1>Simulation control panel</h1>
        <p class="lede">
          Trigger transactions, inactivity, field changes, and batch imports while watching segment
          deltas stream in live.
        </p>
      </div>
      <span class="badge">{{ segments.length }} tracked segments</span>
    </div>

    <p v-if="notice" class="notice">{{ notice }}</p>
    <p v-if="loading" class="notice">Loading customers and segments…</p>

    <div v-else class="grid">
      <section class="forms">
        <article class="card">
          <h2>Transaction</h2>
          <select v-model="transactionForm.customerId">
            <option v-for="customer in customers" :key="customer.id" :value="customer.id">
              {{ customer.name }}
            </option>
          </select>
          <input v-model.number="transactionForm.amount" type="number" min="1" />
          <button
            type="button"
            :disabled="submitting"
            @click="submit('/simulate/transaction', transactionForm)"
          >
            Send transaction
          </button>
        </article>

        <article class="card">
          <h2>Timeout</h2>
          <select v-model="timeoutForm.customerId">
            <option v-for="customer in customers" :key="customer.id" :value="customer.id">
              {{ customer.name }}
            </option>
          </select>
          <input v-model.number="timeoutForm.daysSinceLastTx" type="number" min="0" />
          <button
            type="button"
            :disabled="submitting"
            @click="submit('/simulate/timeout', timeoutForm)"
          >
            Simulate inactivity
          </button>
        </article>

        <article class="card">
          <h2>Field update</h2>
          <select v-model="fieldForm.customerId">
            <option v-for="customer in customers" :key="customer.id" :value="customer.id">
              {{ customer.name }}
            </option>
          </select>
          <select v-model="fieldForm.field">
            <option value="tags">tags</option>
            <option value="name">name</option>
            <option value="email">email</option>
            <option value="totalSpent">totalSpent</option>
          </select>
          <input v-model="fieldForm.value" type="text" />
          <button
            type="button"
            :disabled="submitting"
            @click="submit('/simulate/field-update', fieldForm)"
          >
            Apply field update
          </button>
        </article>

        <article class="card">
          <h2>Bulk import</h2>
          <input v-model.number="bulkForm.count" type="number" min="1" />
          <button
            type="button"
            :disabled="submitting"
            @click="submit('/simulate/bulk-import', bulkForm)"
          >
            Start import
          </button>
        </article>
      </section>

      <section class="feed card">
        <h2>Live feed</h2>
        <ul class="feed-list">
          <li v-for="event in feed" :key="`${event.segmentId}-${event.evaluatedAt}`">
            <strong>{{ event.segmentName }}</strong>
            <span>{{ event.addedCount }} added / {{ event.removedCount }} removed</span>
            <small>{{ formatDate(event.evaluatedAt) }}</small>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.simulation,
.forms {
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

.badge {
  padding: 0.55rem 0.8rem;
  border-radius: 999px;
  background: rgba(118, 26, 232, 0.9);
  color: white;
  font-size: 0.82rem;
  font-weight: 700;
}

.notice,
.card {
  border-radius: 1.3rem;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}

.notice {
  margin: 0;
  padding: 0.9rem 1rem;
}

.grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 1rem;
}

.forms {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.card {
  padding: 1rem;
}

.card h2 {
  margin-top: 0;
}

.card select,
.card input,
.card button {
  width: 100%;
  margin-top: 0.7rem;
  border-radius: 0.9rem;
  padding: 0.85rem 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: white;
}

.card button {
  border: none;
  background: linear-gradient(135deg, #761ae8, #1a0040);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.feed-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.85rem;
}

.feed-list li {
  display: grid;
  gap: 0.25rem;
  padding: 0.9rem;
  border-radius: 1rem;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.9), white);
}

.feed-list span,
.feed-list small {
  color: #64748b;
}

@media (max-width: 960px) {
  .grid,
  .forms {
    grid-template-columns: 1fr;
  }

  .hero {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
