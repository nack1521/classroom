<script setup lang="ts">
definePageMeta({
  middleware: ['auth'],
})

const { user, signOut, signOutError } = useAuth()
</script>

<template>
  <div class="page-container">
    <div class="status-banner">
      <span class="lock-icon">🔒</span>
      <span>Protected Classroom Route (Authentication Verified)</span>
    </div>

    <div v-if="signOutError" class="alert alert-danger">
      <strong>Sign-Out Warning:</strong> {{ signOutError }}
    </div>

    <header class="header">
      <h1>Protected Learning Area</h1>
      <p class="subtitle">
        You have successfully accessed a protected route guarded by Nuxt middleware.
      </p>
    </header>

    <div class="content-card">
      <h2>Session Information</h2>
      <p class="desc">The identity below was authenticated via Supabase OAuth session:</p>

      <div class="user-info-table">
        <div class="row">
          <span class="label">Authenticated Email:</span>
          <code>{{ user?.email ?? 'Unknown' }}</code>
        </div>
        <div class="row">
          <span class="label">User Provider ID:</span>
          <code>{{ user?.id ?? 'Unknown' }}</code>
        </div>
        <div class="row">
          <span class="label">Identity Status:</span>
          <span class="tag tag-success">Authenticated</span>
        </div>
      </div>

      <div class="info-alert">
        <strong>Spike Verification Boundary:</strong>
        This route confirms session persistence and route guard enforcement.
        Note that under Gate 0, this confirms <em>identity</em> only. Live course content access will require teacher-reviewed enrollment records (Slice 2).
      </div>

      <div class="actions">
        <button id="protected-signout-btn" class="btn btn-danger" @click="signOut">
          Sign Out
        </button>

        <NuxtLink to="/" class="btn btn-outline" id="back-home-btn">
          Back to Public Route
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  max-width: 768px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
}

.status-banner {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background-color: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
  padding: 0.4rem 0.8rem;
  border-radius: 9999px;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 1.5rem;
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 1.05rem;
  color: #64748b;
  margin: 0 0 2rem 0;
  line-height: 1.5;
}

.content-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.content-card h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}

.desc {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1.25rem 0;
}

.user-info-table {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.label {
  color: #475569;
  font-weight: 500;
}

code {
  background-color: #e2e8f0;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #0f172a;
}

.tag {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.tag-success {
  background-color: #dcfce7;
  color: #166534;
}

.info-alert {
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  line-height: 1.45;
  margin-bottom: 1.5rem;
}

.actions {
  display: flex;
  gap: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  text-decoration: none;
  border: 1px solid transparent;
}

.btn-danger {
  background-color: #ef4444;
  color: #ffffff;
}

.btn-danger:hover {
  background-color: #dc2626;
}

.btn-outline {
  background-color: transparent;
  border-color: #cbd5e1;
  color: #334155;
}

.btn-outline:hover {
  background-color: #f8fafc;
  border-color: #94a3b8;
}

.alert-danger {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
  line-height: 1.4;
}
</style>
