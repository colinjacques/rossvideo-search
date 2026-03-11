<?php
/**
 * Meilisearch init – enqueue assets and admin
 *
 * @package RossVideo_Search
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('wp_enqueue_scripts', 'rossvideo_search_enqueue_meili_assets');

function rossvideo_search_enqueue_meili_assets() {
    $v = ROSSVIDEO_SEARCH_VERSION;
    $url = ROSSVIDEO_SEARCH_PLUGIN_URL;
    $theme_url = apply_filters('rossvideo_meili_theme_url', $url);
    $logo_url = apply_filters('rossvideo_meili_logo_url', $url . 'assets/img/ross-video-logo.svg');

    wp_enqueue_style(
        'rossvideo-meili-search',
        $url . 'assets/css/meilisearch.css',
        array(),
        $v
    );

    wp_enqueue_script(
        'rossvideo-meili-instant-search',
        $url . 'assets/js/meilisearch-instant.js',
        array('jquery'),
        $v,
        true
    );

    wp_enqueue_style(
        'rossvideo-meili-fullpage-search',
        $url . 'assets/css/meilisearch-fullpage.css',
        array('rossvideo-meili-search'),
        $v
    );

    wp_enqueue_script(
        'rossvideo-meili-fullpage-search',
        $url . 'assets/js/meilisearch-fullpage.js',
        array('jquery', 'rossvideo-meili-instant-search'),
        $v,
        true
    );

    wp_localize_script('rossvideo-meili-instant-search', 'rossVideoMeili', array(
        'host' => MEILI_HOST,
        'apiKey' => MEILI_API_KEY,
        'indexes' => rossvideo_get_meili_indexes(),
        'filterOptions' => rossvideo_get_meili_filter_options(),
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'searchNonce' => wp_create_nonce('meili_search_nonce'),
        'searchPageUrl' => home_url('/?s='),
        'themeUrl' => $theme_url,
        'logoUrl' => $logo_url,
        'strings' => array(
            'noResults' => __('No results found', 'rossvideo-search'),
            'searching' => __('Searching...', 'rossvideo-search'),
            'viewAll' => __('View all results', 'rossvideo-search'),
            'typeToSearch' => __('Type to search...', 'rossvideo-search'),
        ),
    ));

    if (is_search()) {
        wp_enqueue_script(
            'rossvideo-meili-search-page',
            $url . 'assets/js/meilisearch-page.js',
            array('jquery', 'rossvideo-meili-instant-search'),
            $v,
            true
        );
    }
}

add_action('admin_menu', 'rossvideo_search_meili_admin_menu');

function rossvideo_search_meili_admin_menu() {
    add_submenu_page(
        'options-general.php',
        'Meilisearch Settings',
        'Meilisearch',
        'manage_options',
        'rossvideo-meilisearch',
        'rossvideo_search_meili_settings_page'
    );
}

function rossvideo_search_meili_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $client = rossvideo_get_meili_client();
    $is_healthy = $client->is_healthy();
    $indexes = $client->list_indexes();
    ?>
    <div class="wrap">
        <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
        <div class="card">
            <h2>Connection Status</h2>
            <p>
                <strong>Host:</strong> <?php echo esc_html(MEILI_HOST); ?><br>
                <strong>Status:</strong>
                <?php if ($is_healthy) : ?>
                    <span style="color: green;">✓ Connected</span>
                <?php else : ?>
                    <span style="color: red;">✗ Not Connected</span>
                <?php endif; ?>
            </p>
        </div>
        <?php if (!is_wp_error($indexes) && isset($indexes['results'])) : ?>
        <div class="card">
            <h2>Available Indexes</h2>
            <table class="widefat">
                <thead>
                    <tr><th>Index Name (UID)</th><th>Primary Key</th><th>Created</th></tr>
                </thead>
                <tbody>
                    <?php foreach ($indexes['results'] as $index) : ?>
                    <tr>
                        <td><?php echo esc_html($index['uid']); ?></td>
                        <td><?php echo esc_html($index['primaryKey'] ?? 'N/A'); ?></td>
                        <td><?php echo esc_html(date('Y-m-d H:i', strtotime($index['createdAt']))); ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php endif; ?>
        <div class="card">
            <h2>Configuration</h2>
            <p>Set in <code>wp-config.php</code>: <code>MEILI_HOST</code>, <code>MEILI_API_KEY</code></p>
        </div>
        <div class="card">
            <h2>Test Search</h2>
            <form method="post" action="">
                <?php wp_nonce_field('meili_test_search'); ?>
                <p>
                    <input type="text" name="test_query" placeholder="Enter search query" class="regular-text" value="<?php echo isset($_POST['test_query']) ? esc_attr($_POST['test_query']) : ''; ?>">
                    <input type="submit" name="submit_test" class="button button-primary" value="Test Search">
                </p>
            </form>
            <?php
            if (isset($_POST['submit_test']) && wp_verify_nonce($_POST['_wpnonce'], 'meili_test_search')) {
                $test_query = sanitize_text_field($_POST['test_query'] ?? '');
                if ($test_query !== '') {
                    $results = $client->search_all($test_query);
                    if (is_wp_error($results)) {
                        echo '<div class="notice notice-error"><p>' . esc_html($results->get_error_message()) . '</p></div>';
                    } else {
                        echo '<h3>Results for "' . esc_html($test_query) . '"</h3>';
                        echo '<p>Found ' . count($results['hits']) . ' results</p>';
                        if (!empty($results['hits'])) {
                            echo '<ul>';
                            foreach (array_slice($results['hits'], 0, 10) as $hit) {
                                $title = $hit['title'] ?? 'Untitled';
                                $url = $hit['url'] ?? $hit['permalink'] ?? '#';
                                $type = $hit['post_type'] ?? 'unknown';
                                echo '<li><strong>[' . esc_html($type) . ']</strong> <a href="' . esc_url($url) . '" target="_blank">' . esc_html($title) . '</a></li>';
                            }
                            echo '</ul>';
                        }
                    }
                }
            }
            ?>
        </div>
    </div>
    <?php
}

function rossvideo_use_meilisearch() {
    return apply_filters('rossvideo_use_meilisearch', true);
}
