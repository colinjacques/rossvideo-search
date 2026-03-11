<?php
/**
 * AI Overview AJAX Handlers
 * 
 * Handles AJAX requests for AI-powered search overviews
 * 
 * @package RossVideo
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * AJAX handler for generating AI overview
 */
add_action('wp_ajax_ai_search_overview', 'rossvideo_ai_search_overview_ajax');
add_action('wp_ajax_nopriv_ai_search_overview', 'rossvideo_ai_search_overview_ajax');

function rossvideo_ai_search_overview_ajax() {
    // Verify nonce
    if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'ai_overview_nonce')) {
        wp_send_json_error(array('message' => 'Invalid security token'), 403);
    }
    
    // Check if AI overview is enabled
    if (!rossvideo_ai_overview_enabled()) {
        wp_send_json_error(array('message' => 'AI Overview is not enabled'), 400);
    }
    
    $query = isset($_POST['query']) ? sanitize_text_field($_POST['query']) : '';
    $results = isset($_POST['results']) ? $_POST['results'] : array();
    
    if (empty($query)) {
        wp_send_json_error(array('message' => 'Search query is required'), 400);
    }
    
    // Sanitize results array
    $sanitized_results = array();
    if (is_array($results)) {
        foreach ($results as $result) {
            $sanitized_results[] = array(
                'title' => isset($result['title']) ? sanitize_text_field(wp_strip_all_tags($result['title'])) : '',
                'post_type' => isset($result['post_type']) ? sanitize_text_field($result['post_type']) : '',
                '_index' => isset($result['_index']) ? sanitize_text_field($result['_index']) : '',
                'excerpt' => isset($result['excerpt']) ? sanitize_textarea_field(wp_strip_all_tags($result['excerpt'])) : '',
                'strippedContent' => isset($result['strippedContent']) ? sanitize_textarea_field(wp_strip_all_tags($result['strippedContent'])) : '',
                'url' => isset($result['url']) ? esc_url_raw($result['url']) : '',
            );
        }
    }
    
    // Get Gemini client and generate overview
    $client = rossvideo_get_gemini_client();
    $overview = $client->generate_search_overview($query, $sanitized_results);
    
    if (is_wp_error($overview)) {
        wp_send_json_error(array(
            'message' => $overview->get_error_message(),
            'code' => $overview->get_error_code(),
        ), 500);
    }
    
    // Clean up any markdown artifacts from the AI response
    $overview = rossvideo_clean_ai_response($overview);
    
    // Sanitize the AI response (allow basic HTML formatting and links)
    $allowed_html = array(
        'p' => array(),
        'strong' => array(),
        'em' => array(),
        'br' => array(),
        'ul' => array(),
        'ol' => array(),
        'li' => array(),
        'a' => array(
            'href' => array(),
            'title' => array(),
            'target' => array(),
        ),
    );
    $sanitized_overview = wp_kses($overview, $allowed_html);
    
    wp_send_json_success(array(
        'overview' => $sanitized_overview,
        'query' => $query,
    ));
}

/**
 * AJAX handler to check AI overview status
 */
add_action('wp_ajax_ai_overview_status', 'rossvideo_ai_overview_status_ajax');
add_action('wp_ajax_nopriv_ai_overview_status', 'rossvideo_ai_overview_status_ajax');

function rossvideo_ai_overview_status_ajax() {
    wp_send_json_success(array(
        'enabled' => rossvideo_ai_overview_enabled(),
        'configured' => !empty(GEMINI_API_KEY),
    ));
}
