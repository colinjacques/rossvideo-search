<?php
/**
 * AI Overview Configuration
 * 
 * Settings for Gemini AI integration
 * 
 * @package RossVideo
 */

if (!defined('ABSPATH')) {
    exit;
}

// Gemini API Configuration
// These can be overridden in wp-config.php
if (!defined('GEMINI_API_KEY')) {
    // Default empty - must be set in wp-config.php for production
    define('GEMINI_API_KEY', '');
}

if (!defined('GEMINI_MODEL')) {
    // Use Gemini 2.0 Flash for fast responses
    define('GEMINI_MODEL', 'gemini-2.0-flash');
}

if (!defined('GEMINI_API_URL')) {
    define('GEMINI_API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/');
}

// AI Overview settings
if (!defined('AI_OVERVIEW_ENABLED')) {
    define('AI_OVERVIEW_ENABLED', true);
}

if (!defined('AI_OVERVIEW_MAX_RESULTS')) {
    // Maximum number of search results to include in AI context
    define('AI_OVERVIEW_MAX_RESULTS', 10);
}

if (!defined('AI_OVERVIEW_MAX_TOKENS')) {
    // Maximum tokens for AI response
    define('AI_OVERVIEW_MAX_TOKENS', 500);
}

/**
 * Check if AI Overview is enabled and configured
 * 
 * @return bool
 */
function rossvideo_ai_overview_enabled() {
    return AI_OVERVIEW_ENABLED && !empty(GEMINI_API_KEY);
}

/**
 * Get the AI Overview system prompt
 * 
 * @return string
 */
function rossvideo_get_ai_overview_system_prompt() {
    return apply_filters('rossvideo_ai_overview_system_prompt', 
        'You are a helpful assistant for Ross Video, a leading provider of live video production solutions. ' .
        'Based on the search query and the search results provided, generate a concise, informative overview ' .
        'that helps the user understand what Ross Video offers related to their search. ' .
        'Focus on being helpful and accurate. Keep your response to 2-3 short paragraphs. ' .
        'If the search results don\'t seem relevant to the query, acknowledge that and suggest what the user might be looking for. ' .
        'Do not make up information that is not in the search results. ' .
        'IMPORTANT: When mentioning specific products, tutorials, or resources from the search results, include hyperlinks using HTML anchor tags. ' .
        'Example: <a href="https://example.com/product">Product Name</a>. Only link to URLs provided in the search results. ' .
        'Do NOT use markdown formatting, code blocks, or backticks. Use plain HTML only (<p>, <a>, <strong>, <em> tags are allowed).'
    );
}

/**
 * Clean AI response by removing markdown artifacts
 * 
 * @param string $response The AI response
 * @return string Cleaned response
 */
function rossvideo_clean_ai_response($response) {
    // Remove markdown code fences
    $response = preg_replace('/^```[\w]*\s*/m', '', $response);
    $response = preg_replace('/\s*```$/m', '', $response);
    // Remove any remaining backticks
    $response = str_replace('```', '', $response);
    return trim($response);
}
