<?php
/**
 * Exclude "Hidden from Search" tag from Meilisearch
 *
 * - Prevents Yuto from indexing posts that have the hidden-from-search tag.
 * - Removes such posts from Meilisearch when they are saved with the tag.
 *
 * Requires: exclude_tag_from_search.php (defines ROSSVIDEO_HIDDEN_FROM_SEARCH_TAG_SLUG)
 * and Yuto plugin (indexing). Does nothing if Yuto or the constant is missing.
 *
 * @package RossVideo
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('ROSSVIDEO_HIDDEN_FROM_SEARCH_TAG_SLUG')) {
    return;
}

/**
 * Whether the post has the "Hidden from Search" tag.
 *
 * @param int|WP_Post $post_id Post ID or post object.
 * @return bool
 */
function rossvideo_post_has_hidden_from_search_tag($post_id) {
    $id = is_object($post_id) ? $post_id->ID : (int) $post_id;
    return $id && has_term(ROSSVIDEO_HIDDEN_FROM_SEARCH_TAG_SLUG, 'post_tag', $id);
}

/**
 * Prevent Yuto from indexing posts that have the Hidden from Search tag.
 */
add_action('init', function () {
    if (!class_exists('Yuto_Meilisearch_Client')) {
        return;
    }
    $yuto_callback = 'Yuto\Admin\index_post_to_meilisearch';
    if (!has_action('wp_after_insert_post', $yuto_callback)) {
        return;
    }
    remove_action('wp_after_insert_post', $yuto_callback, 10);
    add_action('wp_after_insert_post', function ($post_id, $post, $update) use ($yuto_callback) {
        if (rossvideo_post_has_hidden_from_search_tag($post_id)) {
            return;
        }
        call_user_func($yuto_callback, $post_id, $post, $update);
    }, 10, 3);
}, 20);

/**
 * When a post is saved with the Hidden from Search tag, remove it from Meilisearch.
 */
add_action('wp_after_insert_post', function ($post_id, $post, $update) {
    if (!rossvideo_post_has_hidden_from_search_tag($post_id) || !class_exists('Yuto_Meilisearch_Client')) {
        return;
    }
    $yuto = get_option('yuto_settings');
    if (empty($yuto['defaultPostTypesUIDs']) || !isset($post->post_type)) {
        return;
    }
    $pt = get_post_type_object($post->post_type);
    if (!$pt) {
        return;
    }
    $rest_base = isset($pt->rest_base) ? $pt->rest_base : $pt->name;
    if (empty($yuto['defaultPostTypesUIDs'][$rest_base])) {
        return;
    }
    $index_name = $yuto['defaultPostTypesUIDs'][$rest_base];
    $client = new Yuto_Meilisearch_Client($index_name);
    $client->delete_document((string) $post_id);
}, 15, 3);
