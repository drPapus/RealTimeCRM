<script setup lang="ts">
import DispatchBoard from './components/DispatchBoard.vue'
import { useDispatchStore } from './stores/dispatchStore'

const store = useDispatchStore()
</script>

<template>
  <main class="app">
    <header class="header">
      <h1>Cleaning Dispatch</h1>
      <span>Today</span>
    </header>

    <div v-if="store.error" class="error-banner">
      {{ store.error }}
    </div>

    <DispatchBoard />
  </main>
</template>
