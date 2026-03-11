<?php
/**
 * Meilisearch Client Class
 * 
 * Handles all communication with the Meilisearch API
 * 
 * @package RossVideo
 */

if (!defined('ABSPATH')) {
    exit;
}

class RossVideo_Meilisearch_Client {
    
    /**
     * Meilisearch host URL
     */
    private $host;
    
    /**
     * Meilisearch API key
     */
    private $api_key;
    
    /**
     * Singleton instance
     */
    private static $instance = null;
    
    /**
     * Constructor
     */
    private function __construct() {
        $this->host = defined('MEILI_HOST') ? MEILI_HOST : 'https://search.rossvideo.app';
        $this->api_key = defined('MEILI_API_KEY') ? MEILI_API_KEY : '';
    }
    
    /**
     * Get singleton instance
     */
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Make HTTP request to Meilisearch
     * 
     * @param string $endpoint API endpoint
     * @param string $method HTTP method
     * @param array $body Request body
     * @return array|WP_Error Response data or error
     */
    private function request($endpoint, $method = 'GET', $body = null) {
        $url = trailingslashit($this->host) . ltrim($endpoint, '/');
        
        $args = array(
            'method' => $method,
            'headers' => array(
                'Authorization' => 'Bearer ' . $this->api_key,
                'Content-Type' => 'application/json',
            ),
            'timeout' => 15,
        );
        
        if ($body !== null && in_array($method, array('POST', 'PUT', 'PATCH'))) {
            $args['body'] = wp_json_encode($body);
        }
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) {
            error_log('Meilisearch request error: ' . $response->get_error_message());
            return $response;
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        $status_code = wp_remote_retrieve_response_code($response);
        if ($status_code >= 400) {
            $error_message = isset($data['message']) ? $data['message'] : 'Unknown error';
            error_log('Meilisearch API error (' . $status_code . '): ' . $error_message);
            return new WP_Error('meili_error', $error_message, array('status' => $status_code));
        }
        
        return $data;
    }
    
    /**
     * Search a single index
     * 
     * @param string $index Index name
     * @param string $query Search query
     * @param array $options Search options
     * @return array|WP_Error Search results or error
     */
    public function search($index, $query, $options = array()) {
        $default_options = array(
            'limit' => defined('MEILI_SEARCH_LIMIT') ? MEILI_SEARCH_LIMIT : 20,
            'attributesToHighlight' => array('*'),
            'highlightPreTag' => '<mark>',
            'highlightPostTag' => '</mark>',
        );
        
        $search_params = array_merge($default_options, $options);
        $search_params['q'] = $query;
        
        $endpoint = 'indexes/' . urlencode($index) . '/search';
        
        return $this->request($endpoint, 'POST', $search_params);
    }
    
    /**
     * Multi-index search
     * 
     * @param array $queries Array of search queries, each with 'indexUid' and 'q'
     * @return array|WP_Error Search results or error
     */
    public function multi_search($queries) {
        $endpoint = 'multi-search';
        
        return $this->request($endpoint, 'POST', array('queries' => $queries));
    }
    
    /**
     * Search across all configured indexes
     * 
     * @param string $query Search query
     * @param array $filters Optional filters (e.g., post_type)
     * @param array $options Additional search options
     * @return array Combined and sorted search results
     */
    public function search_all($query, $filters = array(), $options = array()) {
        $indexes = rossvideo_get_meili_indexes();
        $queries = array();
        
        $default_options = array(
            'limit' => defined('MEILI_SEARCH_LIMIT') ? MEILI_SEARCH_LIMIT : 20,
            'attributesToHighlight' => array('title', 'content', 'excerpt'),
            'highlightPreTag' => '<mark>',
            'highlightPostTag' => '</mark>',
            'attributesToRetrieve' => array('*'),
        );
        
        $search_options = array_merge($default_options, $options);
        
        // Build filter string if post_type filter is provided
        $filter_string = '';
        if (!empty($filters['post_type'])) {
            if (is_array($filters['post_type'])) {
                $type_filters = array_map(function($type) {
                    return 'post_type = "' . esc_attr($type) . '"';
                }, $filters['post_type']);
                $filter_string = '(' . implode(' OR ', $type_filters) . ')';
            } else {
                $filter_string = 'post_type = "' . esc_attr($filters['post_type']) . '"';
            }
        }
        
        foreach ($indexes as $index) {
            $query_params = array_merge($search_options, array(
                'indexUid' => $index,
                'q' => $query,
            ));
            
            if (!empty($filter_string)) {
                $query_params['filter'] = $filter_string;
            }
            
            $queries[] = $query_params;
        }
        
        $result = $this->multi_search($queries);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        // Combine and process results
        return $this->process_multi_search_results($result, $query);
    }
    
    /**
     * Process and combine multi-search results
     * 
     * @param array $result Raw multi-search result
     * @param string $query Original search query
     * @return array Processed results
     */
    private function process_multi_search_results($result, $query) {
        $combined_hits = array();
        $total_hits = 0;
        $processing_time = 0;
        
        if (isset($result['results']) && is_array($result['results'])) {
            foreach ($result['results'] as $index_result) {
                if (isset($index_result['hits'])) {
                    foreach ($index_result['hits'] as $hit) {
                        // Transform URLs for dev environment (Meilisearch uses 'link' field)
                        if (isset($hit['link'])) {
                            $hit['link'] = rossvideo_transform_meili_url($hit['link']);
                        }
                        if (isset($hit['url'])) {
                            $hit['url'] = rossvideo_transform_meili_url($hit['url']);
                        }
                        if (isset($hit['permalink'])) {
                            $hit['permalink'] = rossvideo_transform_meili_url($hit['permalink']);
                        }
                        if (isset($hit['featured_media_url'])) {
                            $hit['featured_media_url'] = rossvideo_transform_meili_url($hit['featured_media_url']);
                        }
                        
                        // Add index info for reference and derive post_type from index
                        $index_uid = $index_result['indexUid'] ?? '';
                        $hit['_index'] = $index_uid;
                        
                        // Map index name to post_type for filtering UI
                        if (!isset($hit['post_type'])) {
                            $hit['post_type'] = $index_uid;
                        }
                        
                        $combined_hits[] = $hit;
                    }
                }
                
                $total_hits += $index_result['estimatedTotalHits'] ?? $index_result['totalHits'] ?? 0;
                $processing_time = max($processing_time, $index_result['processingTimeMs'] ?? 0);
            }
        }
        
        // Sort by relevance score if available
        usort($combined_hits, function($a, $b) {
            $score_a = $a['_rankingScore'] ?? 0;
            $score_b = $b['_rankingScore'] ?? 0;
            return $score_b <=> $score_a;
        });
        
        return array(
            'hits' => $combined_hits,
            'query' => $query,
            'processingTimeMs' => $processing_time,
            'estimatedTotalHits' => $total_hits,
        );
    }
    
    /**
     * Get index stats
     * 
     * @param string $index Index name
     * @return array|WP_Error Index stats or error
     */
    public function get_index_stats($index) {
        return $this->request('indexes/' . urlencode($index) . '/stats');
    }
    
    /**
     * List all indexes
     * 
     * @return array|WP_Error List of indexes or error
     */
    public function list_indexes() {
        return $this->request('indexes');
    }
    
    /**
     * Health check
     * 
     * @return bool True if Meilisearch is healthy
     */
    public function is_healthy() {
        $result = $this->request('health');
        return !is_wp_error($result) && isset($result['status']) && $result['status'] === 'available';
    }
}

/**
 * Get Meilisearch client instance
 * 
 * @return RossVideo_Meilisearch_Client
 */
function rossvideo_get_meili_client() {
    return RossVideo_Meilisearch_Client::get_instance();
}
