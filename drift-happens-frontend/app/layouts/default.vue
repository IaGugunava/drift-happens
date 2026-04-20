<template>
  <div class="shell">
    <div class="shell__glow shell__glow--left" />
    <div class="shell__glow shell__glow--right" />
    <header class="masthead">
      <NuxtLink class="brand" to="/segments">
        <span class="brand__mark">DH</span>
        <span>
          <strong>Drift Happens</strong>
          <small>Customer Segmentation Console</small>
        </span>
      </NuxtLink>

      <nav class="nav">
        <NuxtLink class="nav__link" to="/segments">Segments</NuxtLink>
        <NuxtLink class="nav__link" to="/simulation">Simulation</NuxtLink>
        <NuxtLink class="nav__link" to="/campaigns">Campaigns</NuxtLink>
      </nav>
    </header>

    <main class="content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
:global(body) {
  margin: 0;
  font-family: "Segoe UI", "Trebuchet MS", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(118, 26, 232, 0.18), transparent 32%),
    radial-gradient(circle at bottom right, rgba(155, 78, 240, 0.13), transparent 26%),
    linear-gradient(180deg, #f2eafe 0%, #f6f1ff 45%, #fdfbff 100%);
  color: #1f2937;
}

:global(a) {
  color: inherit;
  text-decoration: none;
}

:global(*) {
  box-sizing: border-box;
}

.shell {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.shell__glow {
  position: fixed;
  inset: auto;
  width: 28rem;
  height: 28rem;
  border-radius: 999px;
  filter: blur(72px);
  opacity: 0.6;
  pointer-events: none;
}

.shell__glow--left {
  top: -8rem;
  left: -10rem;
  background: rgba(118, 26, 232, 0.22);
}

.shell__glow--right {
  right: -8rem;
  bottom: -12rem;
  background: rgba(155, 78, 240, 0.16);
}

.masthead {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  backdrop-filter: blur(18px);
  background: rgba(253, 251, 255, 0.82);
  border-bottom: 1px solid rgba(148, 163, 184, 0.22);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.9rem;
}

.brand__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.9rem;
  background: linear-gradient(135deg, #9b4ef0, #3d0a8c);
  color: white;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.brand strong,
.brand small {
  display: block;
}

.brand small {
  color: #64748b;
}

.nav {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.nav__link {
  padding: 0.7rem 0.95rem;
  border-radius: 999px;
  color: #475569;
  transition: all 160ms ease;
}

.nav__link:hover,
.router-link-active.nav__link {
  background: #1a0040;
  color: #f8fafc;
}

.content {
  position: relative;
  z-index: 1;
  padding: 1.5rem 1.25rem 2.5rem;
  max-width: 1240px;
  margin: 0 auto;
}

@media (max-width: 720px) {
  .masthead {
    align-items: flex-start;
    flex-direction: column;
  }

  .content {
    padding-inline: 0.9rem;
  }
}
</style>
