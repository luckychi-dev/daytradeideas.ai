<?php
if (!defined('ABSPATH')) {
    exit;
}
?>
<div class="wrap dtiai-admin">
    <div class="dtiai-admin-head">
        <div>
            <span class="dtiai-kicker">Day Trade Ideas</span>
            <h1>Jason Sen AI Mentor</h1>
            <p>Monitor usage, manage access and configure the live mentor.</p>
        </div>
        <a class="button" href="<?php echo esc_url(admin_url('options-general.php?page=dtiai-bridge')); ?>">
            Connection settings
        </a>
    </div>
    <div id="dtiai-admin-notice" class="dtiai-notice" hidden></div>
    <nav class="nav-tab-wrapper dtiai-tabs" aria-label="AI management sections">
        <button class="nav-tab nav-tab-active" data-tab="overview">Overview</button>
        <button class="nav-tab" data-tab="subscribers">Subscribers</button>
        <button class="nav-tab" data-tab="knowledge">Knowledge</button>
        <button class="nav-tab" data-tab="activity">Activity</button>
        <button class="nav-tab" data-tab="feedback">Feedback</button>
        <button class="nav-tab" data-tab="settings">Configuration</button>
    </nav>
    <main class="dtiai-admin-body">
        <section data-panel="overview"></section>
        <section data-panel="subscribers" hidden></section>
        <section data-panel="knowledge" hidden></section>
        <section data-panel="activity" hidden></section>
        <section data-panel="feedback" hidden></section>
        <section data-panel="settings" hidden></section>
    </main>
</div>
