<?php
/**
 * Meilisearch AJAX Handlers
 * 
 * Handles AJAX requests for server-side Meilisearch queries
 * 
 * @package RossVideo
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * AJAX handler for Meilisearch search
 */
add_action('wp_ajax_meili_search', 'rossvideo_meili_search_ajax');
add_action('wp_ajax_nopriv_meili_search', 'rossvideo_meili_search_ajax');

function rossvideo_meili_search_ajax() {
    // Verify nonce
    if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'meili_search_nonce')) {
        wp_send_json_error(array('message' => 'Invalid security token'), 403);
    }
    
    $query = isset($_POST['query']) ? sanitize_text_field($_POST['query']) : '';
    $post_types = isset($_POST['post_types']) ? array_map('sanitize_text_field', (array) $_POST['post_types']) : array();
    $limit = isset($_POST['limit']) ? absint($_POST['limit']) : 20;
    $offset = isset($_POST['offset']) ? absint($_POST['offset']) : 0;
    
    if (empty($query)) {
        wp_send_json_error(array('message' => 'Search query is required'), 400);
    }
    
    $client = rossvideo_get_meili_client();
    
    $filters = array();
    if (!empty($post_types)) {
        $filters['post_type'] = $post_types;
    }
    
    $options = array(
        'limit' => $limit,
        'offset' => $offset,
    );
    
    $results = $client->search_all($query, $filters, $options);
    
    if (is_wp_error($results)) {
        wp_send_json_error(array(
            'message' => $results->get_error_message(),
        ), 500);
    }
    
    wp_send_json_success($results);
}

/**
 * AJAX handler for instant search / autocomplete
 */
add_action('wp_ajax_meili_instant_search', 'rossvideo_meili_instant_search_ajax');
add_action('wp_ajax_nopriv_meili_instant_search', 'rossvideo_meili_instant_search_ajax');

function rossvideo_meili_instant_search_ajax() {
    $query = isset($_GET['query']) ? sanitize_text_field($_GET['query']) : '';
    
    if (empty($query) || strlen($query) < 2) {
        wp_send_json_success(array('hits' => array()));
    }
    
    $client = rossvideo_get_meili_client();
    
    $results = $client->search_all($query, array(), array(
        'limit' => 8,
        'attributesToRetrieve' => array('title', 'url', 'permalink', 'post_type', 'excerpt', 'thumbnail', 'featured_image'),
        'attributesToHighlight' => array('title'),
    ));
    
    if (is_wp_error($results)) {
        wp_send_json_error(array(
            'message' => $results->get_error_message(),
        ), 500);
    }
    
    // Format results for autocomplete
    $formatted = array();
    foreach ($results['hits'] as $hit) {
        $formatted[] = array(
            'title' => $hit['_formatted']['title'] ?? $hit['title'] ?? '',
            'url' => $hit['link'] ?? $hit['url'] ?? $hit['permalink'] ?? '#',
            'type' => $hit['post_type'] ?? $hit['_index'] ?? 'page',
            'thumbnail' => $hit['featured_media_url'] ?? $hit['thumbnail'] ?? $hit['featured_image'] ?? '',
            'excerpt' => isset($hit['excerpt']) ? wp_trim_words(strip_tags($hit['excerpt']), 15) : 
                        (isset($hit['strippedContent']) ? wp_trim_words(strip_tags($hit['strippedContent']), 15) : ''),
        );
    }
    
    wp_send_json_success(array(
        'hits' => $formatted,
        'query' => $query,
        'totalHits' => $results['estimatedTotalHits'] ?? count($formatted),
    ));
}

/**
 * AJAX handler to get search results HTML
 */
add_action('wp_ajax_meili_search_html', 'rossvideo_meili_search_html_ajax');
add_action('wp_ajax_nopriv_meili_search_html', 'rossvideo_meili_search_html_ajax');

function rossvideo_meili_search_html_ajax() {
    $query = isset($_POST['query']) ? sanitize_text_field($_POST['query']) : '';
    $post_types = isset($_POST['post_types']) ? array_map('sanitize_text_field', (array) $_POST['post_types']) : array();
    $limit = isset($_POST['limit']) ? absint($_POST['limit']) : 20;
    $offset = isset($_POST['offset']) ? absint($_POST['offset']) : 0;
    
    if (empty($query)) {
        wp_send_json_error(array('message' => 'Search query is required'), 400);
    }
    
    $client = rossvideo_get_meili_client();
    
    $filters = array();
    if (!empty($post_types)) {
        $filters['post_type'] = $post_types;
    }
    
    $options = array(
        'limit' => $limit,
        'offset' => $offset,
    );
    
    $results = $client->search_all($query, $filters, $options);
    
    if (is_wp_error($results)) {
        ob_start();
        get_template_part('template-parts/search/search-content-none');
        $html = ob_get_clean();
        wp_send_json_success(array('html' => $html, 'totalHits' => 0));
        return;
    }
    
    ob_start();
    
    if (empty($results['hits'])) {
        get_template_part('template-parts/search/search-content-none');
    } else {
        // Group results by post type
        $grouped = array();
        foreach ($results['hits'] as $hit) {
            $type = $hit['post_type'] ?? 'content';
            if (!isset($grouped[$type])) {
                $grouped[$type] = array();
            }
            $grouped[$type][] = $hit;
        }
        
        // Render grouped results
        foreach ($grouped as $type => $hits) {
            echo '<div class="results-group-wrapper meili-results-group" data-container="' . esc_attr($type) . '">';
            
            // Get readable type name
            $type_name = rossvideo_get_post_type_label($type);
            echo '<p class="search-result-type">' . esc_html($type_name) . '</p>';
            
            foreach ($hits as $hit) {
                rossvideo_render_meili_search_result($hit);
            }
            
            echo '</div>';
        }
    }
    
    $html = ob_get_clean();
    
    wp_send_json_success(array(
        'html' => $html,
        'totalHits' => $results['estimatedTotalHits'] ?? count($results['hits']),
        'processingTimeMs' => $results['processingTimeMs'] ?? 0,
    ));
}

/**
 * Render a single Meilisearch search result
 * 
 * @param array $hit Meilisearch hit data
 */
function rossvideo_render_meili_search_result($hit) {
    $title = $hit['_formatted']['title'] ?? $hit['title'] ?? 'Untitled';
    $url = $hit['link'] ?? $hit['url'] ?? $hit['permalink'] ?? '#';
    // Prefer WordPress excerpt field, fallback to strippedContent
    $excerpt = $hit['_formatted']['excerpt'] ?? $hit['excerpt'] ?? $hit['_formatted']['strippedContent'] ?? $hit['strippedContent'] ?? '';
    $type = $hit['post_type'] ?? $hit['_index'] ?? 'page';
    
    // Strip tags from title but keep highlights
    $title = strip_tags($title, '<mark>');
    
    // Format excerpt
    if (!empty($excerpt)) {
        $excerpt = wp_trim_words(strip_tags($excerpt, '<mark>'), 30);
    }
    ?>
    <article class="meili-search-result">
        <a href="<?php echo esc_url($url); ?>" class="hyperlink">
            <span class="search-result-type"><?php echo esc_html(rossvideo_get_post_type_label($type)); ?></span>
            <h4 class="text-medium mb-3 color-red-text"><?php echo wp_kses_post($title); ?></h4>
            <?php if (!empty($excerpt)) : ?>
                <p class="text-small mb-0"><?php echo wp_kses_post($excerpt); ?></p>
            <?php endif; ?>
        </a>
    </article>
    <hr>
    <?php
}

/**
 * Get readable post type label
 * 
 * @param string $post_type Post type slug or Meilisearch index name
 * @return string Readable label
 */
function rossvideo_get_post_type_label($post_type) {
    $labels = array(
        // WordPress post types
        'product' => 'Products',
        'post' => 'Blog',
        'industries' => 'Industries',
        'use_cases' => 'Use Cases',
        'case_studies' => 'Case Studies',
        'news_releases' => 'News',
        'u_tutorials' => 'Tutorials',
        'resource' => 'Resources',
        'events' => 'Events',
        // Meilisearch index names
        'page' => 'Pages',
        'pdf_documents' => 'Documents',
        'product_resources' => 'Resources',
        'partners' => 'Partners',
    );
    
    if (isset($labels[$post_type])) {
        return $labels[$post_type];
    }
    
    // Try to get from WordPress
    $post_type_obj = get_post_type_object($post_type);
    if ($post_type_obj) {
        return $post_type_obj->labels->name;
    }
    
    return ucfirst(str_replace('_', ' ', $post_type));
}
