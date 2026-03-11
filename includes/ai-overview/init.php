<?php
/**
 * AI Overview init – enqueue assets and admin
 *
 * @package RossVideo_Search
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('wp_enqueue_scripts', 'rossvideo_search_enqueue_ai_overview_assets');

function rossvideo_search_enqueue_ai_overview_assets() {
    if (!rossvideo_ai_overview_enabled()) {
        return;
    }

    $v = ROSSVIDEO_SEARCH_VERSION;
    $url = ROSSVIDEO_SEARCH_PLUGIN_URL;

    if (is_search()) {
        wp_enqueue_style(
            'rossvideo-ai-overview',
            $url . 'assets/css/ai-overview.css',
            array(),
            $v
        );
        wp_enqueue_script(
            'rossvideo-ai-overview',
            $url . 'assets/js/ai-overview.js',
            array('jquery'),
            $v,
            true
        );
    }

    wp_localize_script('rossvideo-meili-fullpage-search', 'rossVideoAIOverview', array(
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('ai_overview_nonce'),
        'enabled' => rossvideo_ai_overview_enabled(),
        'strings' => array(
            'generating' => __('Generating AI overview...', 'rossvideo-search'),
            'error' => __('Unable to generate AI overview. Please try again.', 'rossvideo-search'),
            'title' => __('AI Overview', 'rossvideo-search'),
            'poweredBy' => sprintf(__('Powered by %s', 'rossvideo-search'), 'Gemini'),
        ),
    ));
}

add_action('admin_menu', 'rossvideo_search_ai_overview_admin_menu');

function rossvideo_search_ai_overview_admin_menu() {
    add_submenu_page(
        'options-general.php',
        'AI Overview Settings',
        'AI Overview',
        'manage_options',
        'rossvideo-ai-overview',
        'rossvideo_search_ai_overview_settings_page'
    );
}

function rossvideo_search_ai_overview_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $client = rossvideo_get_gemini_client();
    $is_configured = $client->is_configured();
    ?>
    <div class="wrap">
        <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
        <div class="card">
            <h2>Configuration Status</h2>
            <p>
                <strong>API Key:</strong>
                <?php if ($is_configured) : ?>
                    <span style="color: green;">✓ Configured</span>
                <?php else : ?>
                    <span style="color: red;">✗ Not Configured</span>
                <?php endif; ?>
            </p>
            <p><strong>Model:</strong> <?php echo esc_html(GEMINI_MODEL); ?></p>
            <p>
                <strong>AI Overview:</strong>
                <?php if (rossvideo_ai_overview_enabled()) : ?>
                    <span style="color: green;">✓ Enabled</span>
                <?php else : ?>
                    <span style="color: orange;">○ Disabled (API key not set)</span>
                <?php endif; ?>
            </p>
        </div>
        <div class="card">
            <h2>Configuration</h2>
            <p>Set in <code>wp-config.php</code>: <code>GEMINI_API_KEY</code>, <code>GEMINI_MODEL</code>, <code>AI_OVERVIEW_ENABLED</code></p>
        </div>
        <?php if ($is_configured) : ?>
        <div class="card">
            <h2>Test AI Overview</h2>
            <form method="post" action="">
                <?php wp_nonce_field('ai_overview_test'); ?>
                <p>
                    <input type="text" name="test_query" placeholder="Enter search query" class="regular-text" value="<?php echo isset($_POST['test_query']) ? esc_attr($_POST['test_query']) : ''; ?>">
                    <input type="submit" name="submit_test" class="button button-primary" value="Test AI Overview">
                </p>
            </form>
            <?php
            if (isset($_POST['submit_test']) && wp_verify_nonce($_POST['_wpnonce'] ?? '', 'ai_overview_test')) {
                $test_query = sanitize_text_field($_POST['test_query'] ?? '');
                if ($test_query !== '') {
                    $meili_client = rossvideo_get_meili_client();
                    $search_results = $meili_client->search_all($test_query, array(), array('limit' => defined('AI_OVERVIEW_MAX_RESULTS') ? AI_OVERVIEW_MAX_RESULTS : 10));
                    if (!is_wp_error($search_results) && !empty($search_results['hits'])) {
                        $overview = $client->generate_search_overview($test_query, $search_results['hits']);
                        if (is_wp_error($overview)) {
                            echo '<div class="notice notice-error"><p>' . esc_html($overview->get_error_message()) . '</p></div>';
                        } else {
                            echo '<h3>AI Overview for "' . esc_html($test_query) . '"</h3>';
                            echo '<div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #0073aa;">';
                            echo wp_kses_post($overview);
                            echo '</div>';
                        }
                    } else {
                        echo '<div class="notice notice-warning"><p>No search results found.</p></div>';
                    }
                }
            }
            ?>
        </div>
        <?php endif; ?>
        <div class="card">
            <h2>How to Get a Gemini API Key</h2>
            <ol>
                <li>Go to <a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a></li>
                <li>Sign in and create an API key</li>
                <li>Add <code>GEMINI_API_KEY</code> to <code>wp-config.php</code></li>
            </ol>
        </div>
    </div>
    <?php
}

/**
 * Output the AI Overview block for the search results page.
 * Theme calls: do_action('rossvideo_search_ai_overview');
 */
add_action('rossvideo_search_ai_overview', 'rossvideo_search_render_ai_overview_block');

function rossvideo_search_render_ai_overview_block() {
    if (!function_exists('rossvideo_ai_overview_enabled') || !rossvideo_ai_overview_enabled()) {
        return;
    }
    ?>
    <div id="ai-overview-container" class="ai-overview-container is-loading">
        <div class="ai-overview-header">
            <div class="ai-overview-title-group">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="ai-overview-title"><?php esc_html_e('AI Overview', 'rossvideo-search'); ?></span>
            </div>
            <button type="button" class="ai-overview-toggle" aria-label="Toggle AI Overview">
                <span class="ai-overview-toggle-icon">&minus;</span>
            </button>
        </div>
        <div class="ai-overview-body">
            <div class="ai-overview-loader">
                <div class="ai-overview-spinner"></div>
                <span><?php esc_html_e('Generating AI overview...', 'rossvideo-search'); ?></span>
            </div>
            <div class="ai-overview-content"></div>
        </div>
        <div class="ai-overview-footer">
            <span class="ai-overview-badge"><?php printf(esc_html__('Powered by %s', 'rossvideo-search'), 'Gemini'); ?></span>
        </div>
    </div>
    <?php
}
