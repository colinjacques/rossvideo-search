<?php
/**
 * Gemini API Client
 * 
 * Handles communication with Google's Gemini AI API
 * 
 * @package RossVideo
 */

if (!defined('ABSPATH')) {
    exit;
}

class RossVideo_Gemini_Client {
    
    /**
     * Singleton instance
     */
    private static $instance = null;
    
    /**
     * API Key
     */
    private $api_key;
    
    /**
     * Model name
     */
    private $model;
    
    /**
     * API base URL
     */
    private $api_url;
    
    /**
     * Constructor
     */
    private function __construct() {
        $this->api_key = GEMINI_API_KEY;
        $this->model = GEMINI_MODEL;
        $this->api_url = GEMINI_API_URL;
    }
    
    /**
     * Get singleton instance
     * 
     * @return RossVideo_Gemini_Client
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Check if the client is configured
     * 
     * @return bool
     */
    public function is_configured() {
        return !empty($this->api_key);
    }
    
    /**
     * Generate content using Gemini
     * 
     * @param string $prompt The user prompt
     * @param string $system_instruction Optional system instruction
     * @param array $options Additional options
     * @return string|WP_Error
     */
    public function generate_content($prompt, $system_instruction = '', $options = array()) {
        if (!$this->is_configured()) {
            return new WP_Error('not_configured', 'Gemini API key is not configured');
        }
        
        $url = $this->api_url . $this->model . ':generateContent?key=' . $this->api_key;
        
        // Build the request body
        $body = array(
            'contents' => array(
                array(
                    'parts' => array(
                        array('text' => $prompt)
                    )
                )
            ),
            'generationConfig' => array(
                'temperature' => isset($options['temperature']) ? $options['temperature'] : 0.7,
                'maxOutputTokens' => isset($options['max_tokens']) ? $options['max_tokens'] : AI_OVERVIEW_MAX_TOKENS,
                'topP' => isset($options['top_p']) ? $options['top_p'] : 0.95,
            ),
            'safetySettings' => array(
                array(
                    'category' => 'HARM_CATEGORY_HARASSMENT',
                    'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'
                ),
                array(
                    'category' => 'HARM_CATEGORY_HATE_SPEECH',
                    'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'
                ),
                array(
                    'category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'
                ),
                array(
                    'category' => 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'
                )
            )
        );
        
        // Add system instruction if provided
        if (!empty($system_instruction)) {
            $body['systemInstruction'] = array(
                'parts' => array(
                    array('text' => $system_instruction)
                )
            );
        }
        
        $response = wp_remote_post($url, array(
            'headers' => array(
                'Content-Type' => 'application/json',
            ),
            'body' => json_encode($body),
            'timeout' => 30,
            'sslverify' => false,
        ));
        
        if (is_wp_error($response)) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log('[Gemini] wp_remote_post WP_Error: ' . $response->get_error_message());
            }
            return $response;
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);
        $data = json_decode($response_body, true);
        
        if ($response_code !== 200 && defined('WP_DEBUG') && WP_DEBUG) {
            error_log('[Gemini] HTTP ' . $response_code . ' body: ' . substr($response_body, 0, 500));
        }

        if ($response_code !== 200) {
            $error_message = isset($data['error']['message']) ? $data['error']['message'] : 'Unknown error';
            return new WP_Error('api_error', 'Gemini API error: ' . $error_message, array('status' => $response_code));
        }
        
        // Extract the generated text
        if (isset($data['candidates'][0]['content']['parts'][0]['text'])) {
            return $data['candidates'][0]['content']['parts'][0]['text'];
        }
        
        // Check for blocked content
        if (isset($data['candidates'][0]['finishReason']) && $data['candidates'][0]['finishReason'] === 'SAFETY') {
            return new WP_Error('content_blocked', 'Content was blocked by safety filters');
        }
        
        return new WP_Error('no_content', 'No content generated');
    }
    
    /**
     * Generate a search overview
     * 
     * @param string $query The search query
     * @param array $results The search results
     * @return string|WP_Error
     */
    public function generate_search_overview($query, $results) {
        // Build context from search results
        $context = $this->build_search_context($query, $results);
        
        // Get system prompt
        $system_prompt = rossvideo_get_ai_overview_system_prompt();
        
        // Generate the overview
        return $this->generate_content($context, $system_prompt, array(
            'temperature' => 0.5, // Lower temperature for more focused responses
            'max_tokens' => AI_OVERVIEW_MAX_TOKENS,
        ));
    }
    
    /**
     * Build context string from search results
     * 
     * @param string $query The search query
     * @param array $results The search results
     * @return string
     */
    private function build_search_context($query, $results) {
        $context = "User's search query: \"" . $query . "\"\n\n";
        $context .= "Search results from Ross Video website (with URLs you can link to):\n\n";
        
        $count = 0;
        foreach ($results as $result) {
            if ($count >= AI_OVERVIEW_MAX_RESULTS) {
                break;
            }
            
            $title = isset($result['title']) ? $result['title'] : 'Untitled';
            $type = isset($result['post_type']) ? $result['post_type'] : (isset($result['_index']) ? $result['_index'] : 'content');
            $url = isset($result['url']) ? $result['url'] : '';
            $excerpt = '';
            
            // Get excerpt or content snippet
            if (isset($result['excerpt']) && !empty($result['excerpt'])) {
                $excerpt = wp_strip_all_tags($result['excerpt']);
            } elseif (isset($result['strippedContent']) && !empty($result['strippedContent'])) {
                $excerpt = wp_trim_words(wp_strip_all_tags($result['strippedContent']), 50);
            }
            
            $context .= ($count + 1) . ". [" . ucfirst(str_replace('_', ' ', $type)) . "] " . $title . "\n";
            if (!empty($url)) {
                $context .= "   URL: " . $url . "\n";
            }
            if (!empty($excerpt)) {
                $context .= "   " . $excerpt . "\n";
            }
            $context .= "\n";
            
            $count++;
        }
        
        if ($count === 0) {
            $context .= "No relevant results were found for this query.\n";
        }
        
        $context .= "\nBased on the above search results, provide a helpful overview for the user. When mentioning specific products or resources, include hyperlinks using HTML anchor tags like <a href=\"URL\">Product Name</a>.";
        
        return $context;
    }
}

/**
 * Get the Gemini client instance
 * 
 * @return RossVideo_Gemini_Client
 */
function rossvideo_get_gemini_client() {
    return RossVideo_Gemini_Client::get_instance();
}
