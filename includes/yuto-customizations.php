<?php
/**
 * Yuto Meilisearch customizations (custom fields, etc.)
 *
 * @package RossVideo_Search
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('admin_enqueue_scripts', 'rossvideo_search_enqueue_yuto_customizations');

function rossvideo_search_enqueue_yuto_customizations($hook) {
    wp_enqueue_script('wp-hooks');
    wp_enqueue_script(
        'rossvideo-yuto-custom-fields',
        ROSSVIDEO_SEARCH_PLUGIN_URL . 'assets/js/yuto-custom-fields.js',
        array('wp-hooks'),
        ROSSVIDEO_SEARCH_VERSION,
        true
    );
}
