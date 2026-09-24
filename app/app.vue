<script setup lang="ts">
const { initAuth } = useAuth()

onMounted(() => {
  initAuth()
})
</script>

<template>
  <div class="app-root">
    <nav class="nav-bar">
      <div class="nav-inner">
        <NuxtLink to="/" class="nav-brand">
          <span class="brand-icon">🏫</span>
          <span class="brand-text">Classroom</span>
        </NuxtLink>
        <div class="nav-links">
          <NuxtLink to="/" class="nav-link" active-class="active">Public Home</NuxtLink>
          <NuxtLink to="/protected" class="nav-link" active-class="active">Protected Route</NuxtLink>
        </div>
      </div>
    </nav>
    <main class="main-content">
      <NuxtPage />
    </main>
  </div>
</template>

<style>
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background-color: #f8fafc;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.nav-bar {
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 50;
}

.nav-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  font-weight: 700;
  font-size: 1.15rem;
  color: #0f172a;
}

.brand-icon {
  font-size: 1.3rem;
}

.nav-links {
  display: flex;
  gap: 1.25rem;
}

.nav-link {
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  color: #64748b;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: color 0.15s ease;
}

.nav-link:hover, .nav-link.active {
  color: #2563eb;
}

.main-content {
  flex-grow: 1;
}
</style>
