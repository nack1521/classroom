<script setup lang="ts">
const { user, isLoading, isConfigured, authError, signOutError, signInWithGoogle, signOut } = useAuth()
const route = useRoute()

const authRequiredNotice = computed(() => route.query.auth_required === 'true')
const siteUrl = computed(() => {
  if (import.meta.client) {
    return window.location.origin
  }
  return 'http://localhost:3000'
})
const callbackUrl = computed(() => `${siteUrl.value}/auth/callback`)
</script>

<template>
  <div class="page-container">
    <header class="header">
      <div class="badge">Gate 0 Spike</div>
      <h1>Classroom — Google OAuth Verification</h1>
      <p class="subtitle">
        Local Nuxt + TypeScript + Supabase spike to prove OAuth identity flow, session lifecycle, and route guards.
      </p>
    </header>

    <!-- Auth required banner from redirect -->
    <div v-if="authRequiredNotice" class="alert alert-warning">
      <strong>Access Denied:</strong> You attempted to access a protected route (<code>/protected</code>) without being authenticated. The route guard redirected you here.
    </div>

    <!-- Sign out error notification -->
    <div v-if="signOutError" class="alert alert-danger">
      <strong>Sign-Out Notice:</strong> {{ signOutError }}
    </div>

    <!-- Auth error notification -->
    <div v-if="authError" class="alert alert-danger">
      <strong>Authentication Notice:</strong> {{ authError }}
    </div>

    <!-- Main Grid -->
    <div class="grid">
      <!-- Session / Safe Signed-in State Card -->
      <section class="card">
        <h2>Safe Identity Status</h2>
        <p class="card-desc">Observes current session state without exposing tokens or sensitive secrets.</p>

        <div v-if="isLoading" class="status-box status-loading">
          Checking local authentication status...
        </div>

        <div v-else-if="user?.signedIn" class="status-box status-authenticated">
          <div class="status-indicator-dot online"></div>
          <div class="status-content">
            <span class="status-title">Active Session</span>
            <div class="user-detail-row">
              <span class="detail-label">Safe Email:</span>
              <code class="detail-value">{{ user.email }}</code>
            </div>
            <div class="user-detail-row">
              <span class="detail-label">User ID:</span>
              <code class="detail-value">{{ user.id }}</code>
            </div>
            <div class="user-detail-row">
              <span class="detail-label">Security Notice:</span>
              <span class="detail-value text-muted">Tokens and secrets are omitted from UI and logs.</span>
            </div>
          </div>
        </div>

        <div v-else class="status-box status-unauthenticated">
          <div class="status-indicator-dot offline"></div>
          <div class="status-content">
            <span class="status-title">Unauthenticated (Visitor)</span>
            <span class="status-desc">No active Supabase session found.</span>
          </div>
        </div>

        <div class="actions">
          <button
            v-if="!user?.signedIn"
            id="google-signin-btn"
            class="btn btn-primary"
            @click="signInWithGoogle"
          >
            Sign in with Google
          </button>

          <button
            v-else
            id="signout-btn"
            class="btn btn-secondary"
            @click="signOut"
          >
            Sign Out
          </button>

          <NuxtLink to="/protected" class="btn btn-outline" id="test-protected-btn">
            Test Protected Route (/protected)
          </NuxtLink>
        </div>
      </section>

      <!-- Configuration & External Prerequisites Card -->
      <section class="card">
        <h2>Environment & External Gate</h2>
        <p class="card-desc">Tracks external OAuth and Supabase configuration requirements.</p>

        <div class="config-status">
          <div class="config-row">
            <span>Supabase URL & Key:</span>
            <span v-if="isConfigured" class="tag tag-success">Configured</span>
            <span v-else class="tag tag-danger">Missing in .env</span>
          </div>

          <div v-if="!isConfigured" class="blocker-banner">
            <strong>Blocker Status:</strong> Google round-trip is
            <span class="blocker-tag">BLOCKED PENDING OAUTH / SUPABASE CONFIGURATION</span>.
            External credentials are intentionally absent to ensure secrets remain untracked.
          </div>
        </div>

        <div class="setup-details">
          <h3>Required External Setup Values</h3>
          <div class="setup-step">
            <span class="setup-step-title">1. Google Cloud Console (Web Client)</span>
            <p class="text-small">
              Authorized Redirect URI = Supabase project callback (from Supabase Auth -> Providers -> Google):
            </p>
            <div class="code-copy-box">
              <code>https://&lt;project-ref&gt;.supabase.co/auth/v1/callback</code>
            </div>
            <p class="text-small">
              Authorized JavaScript origin: <code>{{ siteUrl }}</code>
            </p>
          </div>

          <div class="setup-step">
            <span class="setup-step-title">2. Supabase Dashboard (Auth URL Configuration)</span>
            <p class="text-small">
              Add the local app callback to <strong>Redirect URLs</strong> allow-list:
            </p>
            <div class="code-copy-box">
              <code>{{ callbackUrl }}</code>
            </div>
            <p class="text-small">
              Site URL: <code>{{ siteUrl }}</code>
            </p>
          </div>

          <div class="setup-step">
            <span class="setup-step-title">3. Local Environment</span>
            <p class="text-small">
              Copy <code>.env.example</code> to <code>.env</code> with <code>SUPABASE_URL</code> and <code>SUPABASE_KEY</code>.
            </p>
          </div>
        </div>
      </section>
    </div>

    <!-- Security & Architecture Notes -->
    <section class="notes-section">
      <h3>Spike Scope Boundary & Security Guardrails</h3>
      <div class="notes-grid">
        <div class="note-item">
          <strong>Identity vs Course Access:</strong> A Google login proves identity only. A school email domain (<code>@rpr.ac.th</code>) does NOT authorize access to course content; reviewed enrollment records are required in later slices.
        </div>
        <div class="note-item">
          <strong>No Real Student Data:</strong> No student rosters, real identifiers, or credentials are added to the codebase, chat, or version control.
        </div>
        <div class="note-item">
          <strong>Honest Reporting:</strong> Without external OAuth project credentials, the sign-in redirect correctly reports its blocked state rather than mocking an artificial login.
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
}

.header {
  margin-bottom: 2rem;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  background-color: #e0e7ff;
  color: #3730a3;
  font-weight: 600;
  font-size: 0.75rem;
  border-radius: 9999px;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  margin: 0;
  line-height: 1.5;
}

.alert {
  padding: 1rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
  line-height: 1.4;
}

.alert-warning {
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
}

.alert-danger {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.card h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
  color: #0f172a;
}

.card-desc {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1.25rem 0;
}

.status-box {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
}

.status-loading {
  background-color: #f8fafc;
  color: #64748b;
  font-size: 0.9rem;
}

.status-authenticated {
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.status-unauthenticated {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
}

.status-indicator-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}

.status-indicator-dot.online {
  background-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
}

.status-indicator-dot.offline {
  background-color: #94a3b8;
}

.status-content {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex-grow: 1;
}

.status-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: #0f172a;
}

.status-desc {
  font-size: 0.85rem;
  color: #64748b;
}

.user-detail-row {
  font-size: 0.875rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.detail-label {
  font-weight: 500;
  color: #475569;
}

.detail-value {
  color: #0f172a;
  word-break: break-all;
}

.text-muted {
  color: #64748b;
  font-size: 0.8rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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

.btn-primary {
  background-color: #2563eb;
  color: #ffffff;
}

.btn-primary:hover {
  background-color: #1d4ed8;
}

.btn-secondary {
  background-color: #e2e8f0;
  color: #334155;
}

.btn-secondary:hover {
  background-color: #cbd5e1;
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

.config-status {
  margin-bottom: 1.25rem;
}

.config-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
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

.tag-danger {
  background-color: #fee2e2;
  color: #991b1b;
}

.blocker-banner {
  background-color: #fff1f2;
  border: 1px solid #fecdd3;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #9f1239;
  line-height: 1.4;
}

.blocker-tag {
  font-weight: 700;
  color: #be123c;
}

.setup-details h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
}

.text-small {
  font-size: 0.825rem;
  color: #64748b;
  margin: 0 0 0.5rem 0;
}

.code-copy-box {
  background-color: #f1f5f9;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.825rem;
  margin-bottom: 0.75rem;
  word-break: break-all;
  border: 1px solid #e2e8f0;
}

.setup-step {
  margin-bottom: 1rem;
}

.setup-step-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
  display: block;
  margin-bottom: 0.25rem;
}

.setup-checklist {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.825rem;
  color: #475569;
  line-height: 1.5;
}

.notes-section {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
}

.notes-section h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 0.75rem 0;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.note-item {
  font-size: 0.825rem;
  color: #475569;
  line-height: 1.45;
}
</style>
