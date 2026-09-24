<script setup lang="ts">
const { handleCallback, authError, user, isLoading } = useAuth()
const router = useRouter()

const callbackStatus = ref<'processing' | 'success' | 'error'>('processing')
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  const result = await handleCallback(window.location.href)
  if (!result.success) {
    callbackStatus.value = 'error'
    errorMessage.value = result.error || authError.value || 'Authentication failed'
  } else if (result.user?.signedIn || user.value?.signedIn) {
    callbackStatus.value = 'success'
    setTimeout(() => {
      router.push('/protected')
    }, 1200)
  } else {
    // Session could not be recovered or unconfigured
    callbackStatus.value = 'error'
    errorMessage.value = authError.value || 'No active session returned by authentication provider.'
  }
})
</script>

<template>
  <div class="callback-container">
    <div class="callback-card">
      <div v-if="callbackStatus === 'processing' || isLoading" class="state-box">
        <div class="spinner"></div>
        <h2>Processing OAuth Session</h2>
        <p>Exchanging provider authorization for authenticated session...</p>
      </div>

      <div v-else-if="callbackStatus === 'success'" class="state-box state-success">
        <div class="icon-circle success">✓</div>
        <h2>Authentication Succeeded</h2>
        <p>Identity established for <code>{{ user?.email }}</code>.</p>
        <p class="redirect-hint">Redirecting to protected classroom route...</p>
        <NuxtLink to="/protected" class="btn btn-primary">
          Continue to Protected Area
        </NuxtLink>
      </div>

      <div v-else class="state-box state-error">
        <div class="icon-circle error">✕</div>
        <h2>OAuth Authentication Notice</h2>
        <p class="error-text">{{ errorMessage }}</p>

        <div class="callout">
          <strong>Troubleshooting Note:</strong>
          If this says <code>access_denied</code>, ensure:
          <ol class="trouble-list">
            <li>Google Cloud Console Web Client has Supabase callback URL (<code>https://&lt;project-ref&gt;.supabase.co/auth/v1/callback</code>).</li>
            <li>Supabase Auth URL Configuration includes <code>http://localhost:3000/auth/callback</code> in Redirect URLs.</li>
          </ol>
        </div>

        <NuxtLink to="/" class="btn btn-secondary">
          Return to Public Home
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.callback-container {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
}

.callback-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 2.5rem 2rem;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.spinner {
  width: 44px;
  height: 44px;
  border: 4px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1.25rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

h2 {
  font-size: 1.35rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
}

p {
  font-size: 0.95rem;
  color: #64748b;
  margin: 0 0 1rem 0;
}

.icon-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.icon-circle.success {
  background-color: #dcfce7;
  color: #166534;
}

.icon-circle.error {
  background-color: #fee2e2;
  color: #991b1b;
}

.redirect-hint {
  font-size: 0.85rem;
  color: #059669;
  font-style: italic;
}

.error-text {
  color: #b91c1c;
  background-color: #fef2f2;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  width: 100%;
  word-break: break-word;
  font-size: 0.9rem;
}

.callout {
  text-align: left;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.85rem;
  font-size: 0.825rem;
  color: #475569;
  margin-bottom: 1.5rem;
  line-height: 1.45;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-primary {
  background-color: #2563eb;
  color: #ffffff;
}

.btn-secondary {
  background-color: #f1f5f9;
  color: #334155;
  border-color: #cbd5e1;
}

.btn-secondary:hover {
  background-color: #e2e8f0;
}
</style>
