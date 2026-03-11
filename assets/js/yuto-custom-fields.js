/**
 * Add excerpt field to Meilisearch documents via Yuto
 * 
 * This filter adds the WordPress excerpt to the indexed data
 * so it can be displayed in search results.
 */

console.log('🔍 Yuto custom fields script loaded');
console.log('wp.hooks available:', typeof wp !== 'undefined' && typeof wp.hooks !== 'undefined');

if (typeof wp !== 'undefined' && typeof wp.hooks !== 'undefined') {
    
    wp.hooks.addFilter(
        'yuto_modify_documents_data',
        'rossvideo/add-excerpt',
        function(data, post, UID, restBase) {
            console.log('🔍 yuto_modify_documents_data filter called for:', post?.title?.rendered || 'unknown');
            console.log('   Post excerpt available:', !!post?.excerpt?.rendered);
            
            // Add the WordPress excerpt to the indexed data
            if (post && post.excerpt && post.excerpt.rendered) {
                // Strip HTML tags from excerpt
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = post.excerpt.rendered;
                data.excerpt = (tempDiv.textContent || tempDiv.innerText || '').trim();
                console.log('   ✓ Added excerpt:', data.excerpt.substring(0, 50) + '...');
            } else {
                console.log('   ✗ No excerpt to add');
            }
            
            // Also add featured image if available and not already set
            if (!data.featured_media_url && post?.featured_media_src_url) {
                data.featured_media_url = post.featured_media_src_url;
            }
            
            return data;
        }
    );

    // Also add excerpt to searchable attributes
    wp.hooks.addFilter(
        'yuto_searchable_attributes',
        'rossvideo/add-excerpt-searchable',
        function(searchableAttributes, UID) {
            console.log('🔍 yuto_searchable_attributes filter called');
            // Add excerpt to searchable attributes if not already present
            if (!searchableAttributes.includes('excerpt')) {
                searchableAttributes.push('excerpt');
                console.log('   ✓ Added excerpt to searchable attributes');
            }
            return searchableAttributes;
        }
    );
    
    console.log('🔍 Yuto filters registered');
    
} else {
    console.error('❌ wp.hooks not available - Yuto customizations cannot be applied');
}
