<script setup lang="ts">
import { API_BASE_PATH, type HealthResponse } from '@my-web-bookmarks/shared';
import { onMounted, ref } from 'vue';

type BackendState = 'checking' | 'available' | 'unavailable';

const backendState = ref<BackendState>('checking');

onMounted(async () => {
  try {
    const response = await fetch(`${API_BASE_PATH}/health`);
    const body = (await response.json()) as HealthResponse;

    backendState.value = response.ok && body.status === 'ok' ? 'available' : 'unavailable';
  } catch {
    backendState.value = 'unavailable';
  }
});
</script>

<template>
  <main class="app-shell">
    <section class="status-panel" aria-live="polite">
      <p class="eyebrow">My Web Bookmarks</p>
      <h1>Reading inbox foundation</h1>
      <p class="status-line">Backend: {{ backendState }}</p>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  align-items: center;
  background: #f6f7f9;
  color: #17202a;
  display: flex;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  min-height: 100vh;
  padding: 32px;
}

.status-panel {
  max-width: 720px;
}

.eyebrow {
  color: #51606f;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0;
  margin: 0 0 12px;
  text-transform: uppercase;
}

h1 {
  font-size: 3rem;
  line-height: 1;
  margin: 0 0 24px;
}

.status-line {
  font-size: 1.25rem;
  margin: 0;
}
</style>
