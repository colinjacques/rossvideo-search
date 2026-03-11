<?php
/**
 * Plugin Name: Ross Video Search
 * Description: Meilisearch full-page search and AI Overview (Gemini) for Ross Video sites. Easy to transfer and version with Git.
 * Version: 1.0.0
 * Author: Ross Video
 * Text Domain: rossvideo-search
 * Requires at least: 5.9
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('ROSSVIDEO_SEARCH_VERSION', '1.0.0');
define('ROSSVIDEO_SEARCH_PLUGIN_FILE', __FILE__);
define('ROSSVIDEO_SEARCH_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('ROSSVIDEO_SEARCH_PLUGIN_URL', plugin_dir_url(__FILE__));

// "Hidden from Search" tag slug (used by Meilisearch exclusion; theme may also use for WP search)
if (!defined('ROSSVIDEO_HIDDEN_FROM_SEARCH_TAG_SLUG')) {
    define('ROSSVIDEO_HIDDEN_FROM_SEARCH_TAG_SLUG', 'hidden-from-search');
}

// Load Meilisearch (enqueues scripts/styles, admin page, Yuto integration)
require_once ROSSVIDEO_SEARCH_PLUGIN_DIR . 'includes/meilisearch/config.php';
require_once ROSSVIDEO_SEARCH_PLUGIN_DIR . 'includes/meilisearch/class-meilisearch-client.php';
require_once ROSSVIDEO_SEARCH_PLUGIN_DIR . 'includes/meilisearch/ajax-handlers.php';
if (defined('ROSSVIDEO_HIDDEN_FROM_SEARCH_TAG_SLUG')) {
    require_once ROSSVIDEO_SEARCH_PLUGIN_DIR . 'includes/meilisearch/hidden-from-search-meili.php';
}
require_once ROSSVIDEO_SEARCH_PLUGIN_DIR . 'includes/meilisearch/init.php';

// Load AI Overview (Gemini)
require_once ROSSVIDEO_SEARCH_PLUGIN_DIR . 'includes/ai-overview/config.php';
require_once ROSSVIDEO_SEARCH_PLUGIN_DIR . 'includes/ai-overview/class-gemini-client.php';
require_once ROSSVIDEO_SEARCH_PLUGIN_DIR . 'includes/ai-overview/ajax-handlers.php';
require_once ROSSVIDEO_SEARCH_PLUGIN_DIR . 'includes/ai-overview/init.php';

// Yuto customizations (optional)
require_once ROSSVIDEO_SEARCH_PLUGIN_DIR . 'includes/yuto-customizations.php';
