<script setup lang="ts">
import type { RuleNode } from '~/types/api';

defineProps<{
  node: RuleNode;
}>();

function describe(node: RuleNode) {
  switch (node.type) {
    case 'FIELD':
      return `${node.field} ${node.op} ${String(node.value)}`;
    case 'DATE_WITHIN':
      return `${node.field} within ${node.days} days`;
    case 'DATE_OLDER':
      return `${node.field} older than ${node.days} days`;
    case 'IN_SEGMENT':
      return `In segment ${node.segmentId}`;
    default:
      return node.type;
  }
}
</script>

<template>
  <div class="tree">
    <div class="tree__node" :data-kind="node.type">
      <span class="tree__type">{{ node.type }}</span>
      <span class="tree__label">{{ describe(node) }}</span>
    </div>

    <div v-if="node.type === 'AND' || node.type === 'OR'" class="tree__children">
      <RuleTreeNode v-for="(child, index) in node.children" :key="index" :node="child" />
    </div>

    <div v-else-if="node.type === 'NOT'" class="tree__children">
      <RuleTreeNode :node="node.child" />
    </div>
  </div>
</template>

<style scoped>
.tree {
  display: grid;
  gap: 0.7rem;
}

.tree__node {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
  padding: 0.8rem 0.95rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.05);
}

.tree__type {
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: #0f172a;
  color: white;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.tree__label {
  color: #334155;
  font-weight: 600;
}

.tree__children {
  margin-left: 1rem;
  padding-left: 1rem;
  border-left: 2px solid rgba(15, 118, 110, 0.18);
  display: grid;
  gap: 0.7rem;
}
</style>
