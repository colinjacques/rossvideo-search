<?php
/**
 * Meilisearch Configuration
 * 
 * Settings for connecting to the external Meilisearch instance
 * 
 * @package RossVideo
 */

if (!defined('ABSPATH')) {
    exit;
}

// Meilisearch API Configuration
// These can be overridden in wp-config.php
if (!defined('MEILI_HOST')) {
    define('MEILI_HOST', 'https://search.rossvideo.app');
}

if (!defined('MEILI_API_KEY')) {
    define('MEILI_API_KEY', '27024c8e7b24757d95f85b9803044818911d64928f68fcaf2d01bb95e48d5317');
}

// Default search settings
if (!defined('MEILI_SEARCH_LIMIT')) {
    define('MEILI_SEARCH_LIMIT', 20);
}

// Index names - these must match the actual Meilisearch index UIDs on search.rossvideo.app
if (!defined('MEILI_INDEX_PRODUCT')) {
    define('MEILI_INDEX_PRODUCT', 'product');
}

if (!defined('MEILI_INDEX_CASE_STUDIES')) {
    define('MEILI_INDEX_CASE_STUDIES', 'case_studies');
}

if (!defined('MEILI_INDEX_EVENTS')) {
    define('MEILI_INDEX_EVENTS', 'events');
}

if (!defined('MEILI_INDEX_PAGE')) {
    define('MEILI_INDEX_PAGE', 'page');
}

// Server index is "documents" (not pdf_documents)
if (!defined('MEILI_INDEX_PDF_DOCUMENTS')) {
    define('MEILI_INDEX_PDF_DOCUMENTS', 'documents');
}

// product_resources may not exist on server; omit from default indexes if missing
if (!defined('MEILI_INDEX_PRODUCT_RESOURCES')) {
    define('MEILI_INDEX_PRODUCT_RESOURCES', 'product_resources');
}

// Multi-index search configuration
// Map WordPress post types to Meilisearch index names
function rossvideo_get_meili_index_map() {
    return apply_filters('rossvideo_meili_index_map', array(
        'product'          => MEILI_INDEX_PRODUCT,
        'case_studies'     => MEILI_INDEX_CASE_STUDIES,
        'events'           => MEILI_INDEX_EVENTS,
        'page'             => MEILI_INDEX_PAGE,
        'resource'         => MEILI_INDEX_PRODUCT_RESOURCES,
        'pdf_documents'    => MEILI_INDEX_PDF_DOCUMENTS,
    ));
}

// Get all available Meilisearch indexes for search (must match index UIDs on server)
function rossvideo_get_meili_indexes() {
    return apply_filters('rossvideo_meili_indexes', array(
        MEILI_INDEX_PRODUCT,
        MEILI_INDEX_CASE_STUDIES,
        MEILI_INDEX_EVENTS,
        MEILI_INDEX_PAGE,
        MEILI_INDEX_PDF_DOCUMENTS,
        // MEILI_INDEX_PRODUCT_RESOURCES - not present on search.rossvideo.app; add if index is created
    ));
}

/**
 * Filter options for fullpage search UI (index UID => label).
 * Only include indexes that exist in rossvideo_get_meili_indexes().
 * Single source of truth for both API queries and filter buttons.
 */
function rossvideo_get_meili_filter_options() {
    $indexes = rossvideo_get_meili_indexes();
    $labels = array(
        'product'       => 'Products',
        'page'          => 'Pages',
        'case_studies'  => 'Case Studies',
        'events'        => 'Events',
        'documents'     => 'Documents',
        'pdf_documents' => 'Documents',
        'product_resources' => 'Resources',
        'post'          => 'Blog',
        'u_tutorials'   => 'Tutorials',
        'news_releases' => 'News',
    );
    $out = array();
    foreach ($indexes as $uid) {
        $out[] = array(
            'key'   => $uid,
            'label' => isset($labels[$uid]) ? $labels[$uid] : ucfirst(str_replace('_', ' ', $uid)),
        );
    }
    return apply_filters('rossvideo_meili_filter_options', $out);
}

// URL transformation for dev environment
// Adjust URLs returned from Meilisearch to work in dev environment
function rossvideo_transform_meili_url($url) {
    if (empty($url)) {
        return $url;
    }
    
    // Get current site domain
    $current_domain = parse_url(home_url(), PHP_URL_HOST);
    
    // Domains to transform from (production/staging)
    $source_domains = array(
        'ross-video-2023.local',  // Local staging
        'rossvideo.com',          // Production
        'www.rossvideo.com',      // Production with www
        'rossvideo20dev.wpengine.com', // WPEngine dev
        'rossvideo20staging.wpengine.com', // WPEngine staging
    );
    
    // Transform URLs to current environment
    foreach ($source_domains as $source_domain) {
        if (strpos($url, $source_domain) !== false) {
            $url = str_replace($source_domain, $current_domain, $url);
            break;
        }
    }
    
    return apply_filters('rossvideo_meili_transform_url', $url);
}
